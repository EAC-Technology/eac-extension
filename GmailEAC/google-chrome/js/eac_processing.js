var EACProcessing = (function() {
	
    function EACProcessing(account) {
        var self = this;
        
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
    }


    EACProcessing.prototype.fetchUnreadThreads = function() {
        return this.gapi.threads.list({
                search : 'query', 
                q : 'label:unread has:attachment filename:xml'
            }, 0, 100);
    }


    EACProcessing.prototype.fetchNewThreads = function() {
        var self = this;

        var lastTs = this.storage.options.lastTs || (new Date(2016, 08, 01)).getTime(); // 2016-09-01

        var query = {
            search : 'query',
            q      : 'has:attachment label:(-trash) filename:xml',
        };

        function fetch(offset) {
            return self.gapi.threads.list(query, offset, 25);
        }

        return new Promise(function(resolve) {
            var result = [];

            function stopIteration() {
                if (result.length) {
                    self.storage.options.lastTs = result[0].ts;
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
                            return t.ts < lastTs;
                        });

                        if (isEnd) return stopIteration();

                        threads = threads
                            .sort(Utils.cmpByKey('ts'))
                            .reverse() //first - new messages
                            .filter(function(th) {
                                return th.ts >= lastTs; // save messages that older lastTs
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
                console.log(self.gapi);
                return thread.getEAC(self.gapi);
            }, threads)
            
            .then(function(eacs) {
                return eacs
                    .filter(function(e) {
                        return Boolean(e);
                    })
            }) 
    }



    EACProcessing.prototype.fetchNewEacs = function() {
        __.debug('Fetching new EACs..');

        var self = this;

        return this
            .fetchNewThreads()
            .then(self.filterEacMessages)
            .then(function(eacs) {
                __.debug('Founded eacs:', eacs);

                return eacs.sort(Utils.cmpByKey('ts'));
            })
    }



    EACProcessing.prototype.processEacs = function(eacs) {
        __.debug('Processing EACs..');

        var self = this;

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

        __.debug('Process EAC:', token, '"', method, '"', eac.messageId);

        var messages = self.storage.setDefault(['eacs', token], {messages: {}, threads: {}}).messages;

        __.debug('Messages for EAC ' + eac.eacToken, messages);

        if (method != 'delete' && eac.messageId in messages) {
            __.debug('This EAC was processed early. No need to do something.');
            return Promise.resolve(eac);
        }


        if (method == 'new') {
            messages[eac.messageId] = eac.serialize();
            return Promise.resolve(eac);
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

            __.debug('Deleting old EACs. Messages IDs:', ids);

            return Utils.Promise
                .map(function(id) {
                    return self.gapi.messages.trash(id)
                        .then(function(res) {
                            __.debug('Message', id, 'has deleted.');
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
                    return self.gapi.messages.trash(eac.messageId);
                })

                .then(function() {
                    delete self.storage.eacs[eac.eacToken];
                    return eac;
                });
        }
        
    }


    return EACProcessing;

})();





