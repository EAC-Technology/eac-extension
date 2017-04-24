var EACProcessing = (function() {
	
    function EACProcessing(account) {
        var self = this;

        this.account = account;
        
        this.gapi = new GmailAPI(account);
        this.storage = {};

        var promise = Extension.Storages
            .get(account.email)
            .then(function(storage) {
                storage.setDefault(['options'], {});
                storage.setDefault(['eacs'], {});
                self.storage = storage;
            });

        this.init = function() {
            return promise;
        }

        this.skipThreads = {};

        this._lastMessageTs = null;
    }


    EACProcessing.prototype.fetchUnreadThreads = function() {
        return this.gapi.threads.list({
                search : 'query', 
                q : 'to:me label:unread has:attachment filename:xml'
            }, 0, 100);
    }


    EACProcessing.prototype.fetchPotentialEACThreads = function(limit) {
        limit = limit || 100;

        return this.gapi.threads.list({
                search : 'query', 
                q : 'to:me label:(-trash) has:attachment filename:xml'
            }, 0, limit);
    }


    EACProcessing.prototype.fetchNewThreads = function() {
        var self = this;

        var lastTs = this.storage.options.lastMessageTs || (new Date(2016, 08, 01)).getTime(); // 2016-09-01

        var query = {
            search : 'query',
            q      : 'to:me has:attachment label:(-trash) filename:xml',
        };

        function fetch(offset) {
            return self.gapi.threads.list(query, offset, 25);
        }

        return new Promise(function(resolve) {
            var result = [];

            function stopIteration() {
                if (result.length) {
                    self._lastMessageTs = result[0].ts;
                }

                resolve(result);
            }

            function next(offset) {
                offset = offset || 0;

                function skipKey(th) {return th.id + '_' + th.ts};

                fetch(offset)
                    // skip threads that was processed early
                    .then(function(threads) {
                        return threads.filter(function(x) {
                            return Boolean(self.skipThreads[skipKey(x)]) == false;
                        })
                    })

                    // save threads for skip after
                    .then(function(threads) {
                        threads.forEach(function(x) {
                            self.skipThreads[skipKey(x)] = true;
                        })

                        return threads;
                    })

                    .then(function(threads) {
                        var threadsCount = threads.length;
                        if (!threadsCount) return stopIteration();

                        var isEnd = threads.every(function(t) {
                            return t.ts <= lastTs;
                        });

                        if (isEnd) return stopIteration();

                        threads = threads
                            .sort(Utils.cmpByKey('ts'))
                            .reverse() //first - new messages
                            .filter(function(th) {
                                return th.ts > lastTs; // save messages that older lastTs
                            });

                        result = result.concat(threads);
                        next(offset + threadsCount);
                    });
            }

            next();
        });
    }



    EACProcessing.prototype.filterEacMessages = function(threads) {
        return Utils.Promise
            .map(function(thread) {
                return thread.getEAC();
            }, threads)
            
            .then(function(eacs) {
                return eacs
                    .filter(function(e) {
                        return Boolean(e);
                    })
            }) 
    }



    EACProcessing.prototype.fetchNewEacs = function() {
        var self = this;
        
        __.debug(self.account.email, 'Fetching new EACs..');

        return this
            .fetchNewThreads()
            .then(self.filterEacMessages)
            .then(function(eacs) {
                __.debug(self.account.email, 'Founded eacs:', eacs);

                return eacs.sort(Utils.cmpByKey('ts'));
            })
    }



    EACProcessing.prototype.processEacs = function(eacs) {
        var self = this;
        
        __.debug(self.account.email, 'Processing EACs..');

        return Utils.Promise
            .map(function(eac) {
                
                // save thread ID for this EAC
                var threads = self.storage.setDefault(
                    ['eacs', eac.eacToken.toLowerCase()], 
                    {threads : {}, messages : {}}
                ).threads;

                threads[eac.messageId] = eac.serialize();

                return self
                    // load all Gmail thread of messages for EAC
                    .gapi.threads.get(eac.messageId)
                    
                    // load EAC object for each message in thread
                    .then(function(messages) {
                        return Utils.Promise
                            .map(function(m) {
                                return m.getEAC(self.gapi);
                            }, messages)
                    });
            }, eacs)

            // reduce - filter - sort of all EACs
            .then(function(allEacs) {
                return allEacs
                    .reduce(function(res, x) {
                        return res.concat(x);
                    }, [])

                    .filter(function(x) {
                        return Boolean(x);
                    })

                    .sort(Utils.cmpByKey('ts'));
            })

            // process EAC-Methods
            .then(function(allEacs) {
                return Utils.Promise.map(function(eac) {
                    return self.processEacMethod(eac);
                }, allEacs);
            })

            // save storage
            .then(function(allEacs) {
                return new Promise(function(resolve) {
                    self.storage
                        .save()
                        .then(function() {
                            resolve(allEacs)
                        });
                });
            })

    }



    EACProcessing.prototype.processEacMethod = function(eac) {
        var self = this;

        var method = eac.eacMethod.toLowerCase();
        var token = eac.eacToken.toLowerCase();

        __.debug(self.account.email, 'Process EAC:', token, '"', method, '"', eac.messageId);

        var messages = self.storage.setDefault(['eacs', token], {messages: {}, threads: {}}).messages;

        __.debug(self.account.email, 'Messages for EAC ' + eac.eacToken, messages);

        if (method != 'delete' && eac.messageId in messages) {
            __.debug(self.account.email, 'This EAC was processed early. No need to do something.');
            return Promise.resolve(eac);
        }


        if (method == 'new') {
            messages[eac.messageId] = eac.serialize();
            return Promise.resolve(eac);
        }



        function moveMessageToTrashIfEnabled(messageId) {
            if (Extension.options.enable_eac_processing && Extension.options.enable_move_to_trash)
                return self.gapi.messages.trash(messageId);

            return Promise.resolve(true);
        }



        function trashOldEacs() {
            var ids = Object
                .values(messages)
                .sort(Utils.cmpByKey('ts'))
                .map(function(e) {
                    if (!e || !e.messageId) {
                        __.error(eac, messages, e);
                    }

                    return e.messageId;
                })
                .filter(function(id) {
                    return Boolean(id);
                });

            __.debug(self.account.email, 'Deleting old EACs. Messages IDs:', ids);

            return Utils.Promise
                .map(function(id) {
                    return moveMessageToTrashIfEnabled(id)
                        .then(function(res) {
                            __.debug(self.account.email, 'Message', id, 'has deleted.');
                            delete messages[id];
                            return res;
                        })
                }, ids);            
        }


        if (method == 'update') {
            return trashOldEacs()
                
                .then(function() {
                    messages[eac.messageId] = eac.serialize();
                    return eac;
                });
        }


        if (method == 'delete') {
            return trashOldEacs()

                .then(function() {
                    return moveMessageToTrashIfEnabled(eac.messageId);
                })

                .then(function() {
                    delete self.storage.eacs[eac.eacToken];
                    return eac;
                });
        }
        
    }



    EACProcessing.prototype.checkUnreadEacs = function() {
        var self = this;
        
        __.debug(self.account.email, 'Check unread EACs');

        return this
            .fetchUnreadThreads()

            .then(function(messages) {
                var eacIds = Object
                    .values(self.storage.eacs || {})
                    .reduce(function(res, eac) {
                        Object.keys(eac.messages || {}).forEach(function(key) {
                            res[key] = true;
                        });

                        Object.keys(eac.threads || {}).forEach(function(key) {
                            res[key] = true;
                        })

                        return res;
                    }, {});

                return messages.filter(function(m) {
                    return eacIds[m.id];
                });
            })

            .then(function(messages) {
                Extension.setUnreadCount(self.account.email, messages.length);
            });

    }


    EACProcessing.prototype.checkNewEacs = function() {
        var self = this;

        __.debug(self.account.email, 'Check new EACs worker.');

        return this
            .fetchNewEacs()
            
            .then(function(eacs) {
                return self.processEacs(eacs);
            })

            .then(function(eacs) {
                if (eacs.length) Extension.needRefreshUI(self.account);
                return eacs;
            })
    }



    EACProcessing.prototype.isAtomFeedUpdated = function() {
        var self = this;
        
        __.debug(self.account.email, 'Check Atom Feed.');

        return self.gapi.feed.atom()
            .then(function(xml) {
                var modified = xml.querySelector('modified').textContent;
                var options = self.storage.setDefault(['options'], {});
                var feedAtomDt = options.feedAtomDt || null
                var result = (modified > feedAtomDt);
                options.feedAtomDt = modified;
                
                return new Promise(function(resolve) {
                    self.storage.save()
                        .then(function() {
                            resolve(result);
                        });
                });
            });
    }



    EACProcessing.prototype.isTimeoutExpired = function(timeout) {
        var self = this;

        __.debug(self.account.email, 'Check Timeout.');

        timeout = timeout || 600000; // 10 min

        var options = this.storage.setDefault(['options'], {});
        var lastCheckTs = options.lastCheckTs || null;
        var result = (Date.now() > lastCheckTs + timeout); // 10 min
       
        return Promise.resolve(result);
    }



    EACProcessing.prototype.isNeedToRunEACProcessing = function() {
        var self = this;

        return this
            .isAtomFeedUpdated()
            
            .then(function(res) {
                return res || self.isTimeoutExpired();
            })
    }



    EACProcessing.prototype.run = function() {
        var self = this;

        return this
            .init()

            .then(function() {
                return self.isNeedToRunEACProcessing();
            })

            .then(function(result) {
                if (!result) {
                    __.debug(self.account.email, 'Feed was not changed. No need to check new EACs.');
                    return;
                }
                
                return Promise.resolve()

                    .then(function() {
                        return self.checkNewEacs()
                    })
                    
                    .then(function() {
                        return self.checkUnreadEacs();
                    })

                    .then(function() {
                        var options = self.storage.setDefault(['options'], {});
                        
                        options.lastCheckTs = Date.now();
                        
                        if (self._lastMessageTs)
                            options.lastMessageTs = self._lastMessageTs;
                        
                        return self.storage.save();
                    });
            })
            

    }



    EACProcessing.prototype.integrityCheck = function() {
        var self = this;

        this
            .fetchPotentialEACThreads()
            .then(self.filterEacMessages)
            .then(function(eacs) {
                return eacs
                    .filter(function(e) {
                        return (e.eacToken in self.storage.eacs) == false;
                    })
            })
            .then(function(eacs) {
                if (!eacs.length) __.debug('Integrity Check is Ok');
                __.debug('Integrity Check is Fail');
                var options = self.storage.setDefault(['options'], {});
                options.lastCheckTs = null;
                options.lastMessageTs = null;
                self.storage.save();
            })
    }


    EACProcessing.prototype.resetLastCheckTs = function() {
        var self = this;

        return this
            .init()
            
            .then(function() {
                __.debug(self.account.email, 'Reset lastCheckTs');

                self.storage.options.lastCheckTs = null;
                return self.storage.save();
            });
    }



    EACProcessing.prototype.startWorker = function() {
        var self = this;

        // fake worker if processing is disabled
        if (Extension.options.enable_eac_processing == false)
            return Utils.Promise.worker(function() {
                return 300000; // 5 min
            })

        this.resetLastCheckTs();

        return Utils.Promise.worker(function() {
            return self
                .run()

                .then(function() {
                    return 20000; // 20 sec
                })

                .catch(function(err) {
                    __.error(err);
                    return Promise.resolve(120000); // failover 2 min
                })
        })
    }

            

    return EACProcessing;


})();





