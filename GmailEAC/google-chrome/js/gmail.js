var Gmail = (function() {
    function $$(selector, startNode) {
        startNode = startNode || document;
        return Array.prototype.slice.apply(startNode.querySelectorAll(selector));
    }

    function $(selector, startNode) {
        startNode = startNode || document;
        return startNode.querySelector(selector);
    }



    function Gmail() {};


    Gmail.Account = function(details) {
        var self = this;

        this.url = details.url;
        if (this.url.slice(-1) != '/') this.url += '/';

        this.email = details.email;
        this.userToken = details.userToken;
        this.actionToken = details.actionToken;
        this.avatar = details.avatar;

        Gmail.Account.accounts[this.email] = this;

        this.absUrl = function(query) {
            if (query.indexOf('://') > -1) return query;
            if (query[0] == '/') query = query.slice(0);
            return this.url + query;
        }

        this.tokens = function() {
            return {
                ik : this.userToken,
                at : this.actionToken
            };
        }

        this.serialize = function() {
            var obj = {};

            [
                'url',
                'email',
                'userToken',
                'actionToken',
                'avatar'

            ].forEach(function(key) {
                obj[key] = self[key];
            });

            return obj;
        }


        function ajax_call(method, query, data) {
            data = data || {};
            Object.assign(data, self.tokens());
            return method(self.absUrl(query), data);
        }

        this.ajax = {
            get : ajax_call.bind(null, ajax.get),
            post : ajax_call.bind(null, ajax.post)
        }


        this.fetchThreads = function(params, offset, limit) {
            offset = offset || 0;
            limit = limit || 20;

            var url = `?ui=2&view=tl&start=${offset}&num=${limit}&rt=j`;
            
            return this.ajax.get(url, params)
                .then(function(resp) {
                    var data = JSON.parse(resp.slice(5));
                
                    data = data[0].filter(function(x) {
                        return x[0] == 'tb';
                    });

                    var threads = data.reduce(function(arr, x) {
                        return arr.concat(x[2]);
                    }, []);

                    return threads;
                })

                .then(function(threads) {
                    threads = threads.map(Gmail.Message.parse);
                    __.debug('Gmail Feed Threads:\n', threads);
                    return threads;
                });
        }


    };


    Gmail.Account.accounts = {};
    
    Gmail.Account.all = function() {
        return Object.values(Gmail.Account.accounts);
    }

    Gmail.Account.current = function() {
        var details = {
            email : Gmail.userEmail(),
            userToken : Gmail.userToken(),
            actionToken : Gmail.actionToken(),
            url : Gmail.userUrl(),
            avatar : Gmail.userAvatar()
        }

        return new Gmail.Account(details);
    }




    Gmail.Message = function() {
        this.id = '';
        this.lastThreadMessageId = '';
        this.ts = null;
        this.fromEmail = '';
        this.subject = '';
        this.content = '';
        this.eac = null;

        this.getContent = function() {
            if (this.content) return Promise.resolve(this.content);
            if (!this.id) return Promise.resolve('');

            if (!this.lastThreadMessageId) {
                this.lastThreadMessageId = Gmail.originalMessageId(this.id) || this.id;
            }

            var self = this;

            return Gmail
                .getMessageSource(this.lastThreadMessageId)
                .then(function(content) {
                    self.content = content;
                    return content;
                });
        }


        this.getEAC = function() {
            if (this.eac) return Promise.resolve(this.eac);

            var self = this;
            
            var obj = Object
                .values(Gmail.storage.eacs)

                .reduce(function(res, eacData) {
                    if (res) return res;
                    return eacData.messages[self.id] || eacData.threads[self.id];
                }, null);

            if (obj) 
                return Promise.resolve(EAC.deserialize(obj));


            return this
                .getContent()
                .then(EAC.parse)
                .then(function(eac) {
                    if (eac) {
                        eac.messageId = self.id;
                        eac.ts = self.ts;
                        eac.subject = self.subject;
                    }
                    self.eac = eac;
                    return eac;
                });
        }


        this.serialize = function() {
            return Gmail.Message.serialize(this);
        }
    };

    
    Gmail.Message.parseFromThreadArray = function(arr) {
        var res = new Gmail.Message();
        
        res.id          = arr[0];
        res.ts          = arr[16] / 1000;
        res.fromEmail   = arr[28];
        res.subject     = arr[9];
        
        res.lastThreadMessageId = arr[2];
        
        // var m = /.*>(.*)<.*/i.exec(arr[7]);
        // res.fromName = (m) ? m[1] : '';

        return res;
    };

    Gmail.Message.parseFromMessageArray = function(arr) {
        var res = new Gmail.Message();

        res.id          = arr[1];
        res.ts          = arr[7];
        res.fromEmail   = arr[36];
        res.subject     = arr[12];
        
        res.lastThreadMessageId = arr[1];
        
        // var m = /"(.*)"\s+<.*>/i.exec(arr[4]);
        // res.fromName = (m) ? m[1] : '';

        return res;
    };

    Gmail.Message.parse = function(arr) {
        if (arr.length > 60) 
            return Gmail.Message.parseFromMessageArray(arr);
        return Gmail.Message.parseFromThreadArray(arr);
    };


    Gmail.Message.serialize = function(message) {
        var obj = {};

        ['id', 'lastThreadMessageId', 'ts', 'fromEmail', 'fromName', 'subject'].forEach(function(key) {
            obj[key] = message[key];
        });

        if (message.eac) 
            obj['eac'] = EAC.serialize(message.eac);

        return JSON.stringify(obj);
    };

    Gmail.Message.deserialize = function(jstr) {
        var obj = JSON.parse(jstr);
        var message = new Gmail.Message();

        ['id', 'lastThreadMessageId', 'ts', 'fromEmail', 'fromName', 'subject'].forEach(function(key) {
            message[key] = obj[key];
        });

        if (obj.eac) 
            message['eac'] = EAC.deserialize(obj.eac);

        return message;
    };




    Gmail.threads = {};



    Gmail.fetchThreads = function(params, offset, limit) {
        offset = offset || 0;
        limit = limit || 20;

        var url = Gmail.absUrl(`?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=tl&start=${offset}&num=${limit}&rt=j`);
        
        return ajax.get(url, params)
            .then(function(resp) {
                var data = JSON.parse(resp.slice(5));
            
                data = data[0].filter(function(x) {
                    return x[0] == 'tb';
                });

                var threads = data.reduce(function(arr, x) {
                    return arr.concat(x[2]);
                }, []);

                return threads;
            })

            .then(function(threads) {
                threads = threads.map(Gmail.Message.parse);
                __.debug('Gmail Feed Threads:\n', threads);
                return threads;
            });
    }



    Gmail.fetchUnreadThreads = function() {
        return Gmail
            .fetchThreads({
                search : 'query', 
                q : 'label:unread has:attachment filename:xml'
            }, 0, 100);
    }



    Gmail.getThreads = function() {
        var d = Gmail.currentDirectory();
        var offset = (Gmail.currentPage()-1) * Gmail.messagesPerPage();
        var limit = Gmail.messagesPerPage();

        if (/p\d+/.test(d.slice(-1)[0])) d = d.slice(0, -1); 
        if (/[0-9a-f]{16}/.test(d.slice(-1)[0])) d.splice(-1);

        __.debug('Get threads d:', d);

        function createQuery(d) {
            function search(x) {return {'search' : x}};
            function query(x) {return {'search' : 'query', 'q' : x}};

            if (d[0] == 'search') return query(d[1]);
            if (d.length == 2) return query(d.join(':'));
            return search(d[0]);
        }

        var query = createQuery(d);
        __.debug('Get threads query:', query);

        return Gmail.fetchThreads(query, offset, limit);
    }



    Gmail.getThreadMessages = function(threadId) {
        var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&rt=j&view=cv&search=trash&th=${threadId}&type=${threadId}`;
        var url = Gmail.absUrl(query);
        
        return ajax.get(url)
            
            .then(function(resp) {
                var data = JSON.parse(resp.slice(5));
                
                return data[0].filter(function(x) {
                    return x[0] == 'ms';
                })
            })

            .then(function(rawMessages) {
                return rawMessages.filter(function(arr) {
                    return arr[9].indexOf('^k') < 0;
                });
            })
            
            .then(function(rawMessages) {
                return rawMessages
                    .map(Gmail.Message.parse)
                    .sort(Utils.cmpByKey('ts'));
            });
    }



    Gmail.trashThread = function(threadId) {
        var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=up&act=tr&rt=j&search=all&t=${threadId}`;
        var url = Gmail.absUrl(query);
        return ajax.get(url);
    }


    Gmail.untrashThread = function(threadId) {
        var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=up&act=ib&rt=j&search=trash&t=${threadId}`;
        var url = Gmail.absUrl(query);
        return ajax.get(url);
    }

    Gmail.trashMessage = function(messageId) {
        __.debug('Trash message', messageId);
        var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=up&act=dm&rt=j&search=all&m=${messageId}`;
        var url = Gmail.absUrl(query);
        return ajax.get(url);
    }

    Gmail.untrashMessage = function(messageId) {
        var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=up&act=ib&rt=j&search=trash&m=${messageId}`;
        var url = Gmail.absUrl(query);
        return ajax.get(url);
    }



    Gmail.updateThreads = function() {
        __.debug('Update Gmail Feed');

        Gmail
            .getThreads()
            .then(function(threads) {
                threads.forEach(function(x) {
                    Gmail.threads[x.id] = x;
                })
            })
    }


    Gmail.actionToken = function() {
        return GM_ACTION_TOKEN;
    }

    Gmail.userEmail = function() {
        return GLOBALS[10];
    }

    Gmail.userToken = function() {
        return GLOBALS[9];
    }

    Gmail.userUrl = function() {
        return GLOBALS[31];
    }


    Gmail._userAvatar = null;
    Gmail.userAvatar = function() {
        if (!Gmail._userAvatar) {
            var x = $('.gbii');
            if (!x) return '';

            var url = window.getComputedStyle(x).backgroundImage;
            if (!url) return '';

            Gmail._userAvatar = url.slice(5, -2);
        }

        return Gmail._userAvatar || '';
    }


    Gmail.absUrl = function(query) {
        return `${Gmail.userUrl()}${query}`;
    }

    Gmail.messagesPerPage = function() {
        return GLOBALS[8];
    }



    Gmail.needRefreshUIFlag = false;

    Gmail.needRefreshUI = function() {
        Gmail.needRefreshUIFlag = (Gmail.refreshUI() == false);
    }

    Gmail.refreshUI = function() {
        function isVisible(el) {
            for (var node=el; node != null; node = node.parentElement)
                if (node.style && node.style.display == 'none')
                    return false;
            
            return true;
        }


        function emulateMouseClick(elem) {
            elem.click(); // try usuall
            
            // also emulate mouse behaviour
            
            function mouseEvent(name) {
                var event = document.createEvent("MouseEvents");
                event.initEvent(name, true, false);
                return event;               
            }

            elem.dispatchEvent(mouseEvent('mousedown'));
            elem.dispatchEvent(mouseEvent('mouseup'));
        }


        function click(selector) {
            var buttons = $$(selector);
            
            return buttons.some(function(el) {
                if (isVisible(el)) {
                    __.debug('Refresh Gmail UI', 'Selector: "', selector, '"');
                    emulateMouseClick(el);
                    return true;
                }

                return false;
            });
        }

        // try to find button for current directory
        var res = click(`a[href="${window.location.toString()}"]`);
        if (res) return true;

        // try to find Refresh button
        res = click('[act="20"][role="button"]');
        if (res) return true;


        __.debug("Can't refresh Gmail UI");
        return false;
    }



    Gmail.currentDirectory = function() {
        return window.location.hash
            .slice(1)
            .split('?')[0]
            .split('/')
            .map(decodeURIComponent);

        if (parts.length == 1) return parts[0].slice(1);
        return parts.slice(0, -1).join('/').slice(1);
    }

    Gmail.currentPage = function() {
        var parts = window.location.hash
            .split('?')[0]
            .split('/');

        if (parts.length < 2) return 1;
        
        var page = parts[parts.length-1];
        if (page[0] == 'p') return page.slice(1);

        return 1;
    }



    Gmail.messageId = function() {
        var parts = window.location.hash
            .split('?')[0]
            .split('/');

        if (parts.length < 2) return '';
        
        var id = parts[parts.length-1];
        if (id[0] == 'p') return '';

        return id;
    }

    Gmail.originalMessageId = function(id) {
        var id = id || Gmail.messageId();
        
        var message = Gmail.threads[id];
        return (message && message.lastThreadMessageId) || id;
    }

    Gmail.messageUrl = function(id) {
        id = Gmail.originalMessageId(id) || id;
        if (!id) return '';
        return Gmail.absUrl(`?ui=2&view=om&ik=${Gmail.userToken()}&th=${id}`);
        // return Gmail.absUrl(`?view=att&th=${id}&attid=0&disp=comp&safe=1&zw`);
    }


    Gmail.getMessageSource = function(messageId) {
        var url = Gmail.messageUrl(messageId);
        if (!url) return Promise.resolve('');

        var CONTENT_START = '<pre class="raw_message_text" id="raw_message_text">';
        
        return ajax.get(url)
            .then(function(content) {
                var i = content.indexOf(CONTENT_START) + CONTENT_START.length;
                var j = content.indexOf('</pre>', i);
                content = content.slice(i, j);

                var pre = document.createElement('pre');
                pre.innerHTML = content;
                content = pre.innerText;

                var lines = content.split('\n');
                content = lines
                    .map(function(l) {
                        if (l.length == 76 && l.endsWith('='))
                            return l.slice(0, -1);
                        return l + '\n';
                    })

                    .join('');

                return content;
            });
    }



    Gmail.getMessageContent = function() {
        __.debug('Get Message Content', Gmail.messageId(), Gmail.messageUrl(), 'start');
        return Gmail.getMessageSource();
    }


    Gmail.isEacViewerInserted = function() {
        return __.$('#appinmail-eac-viewer').length > 0;
    }


    Gmail.insertEacViewer = function(url) {
        __.info('Insert EAC Viewer into message content');

        if (Gmail.isEacViewerInserted()) {
            __.debug('EAC Viewer has inserted');
            return;
        }

        var listitem = __.$('div[role="listitem"]')[0]
        var message = __.$('div.adn', listitem[0])

        var gmailContent = message[0].childNodes[1].childNodes[6];
        __.debug('Gmail Message Content Element: ', gmailContent);

        var eacviewer = document.createElement('div');
        eacviewer.id = 'appinmail-eac-viewer';
        eacviewer.innerHTML = `
            <div style="font-size: 10pt">
                <a href="http://appinmail.io/" target="_blank" style="text-decoration: none">
                    <img src="${Extension.logoUrl}" alt="Appinmail"/>
                    <span style="vertical-align: super; color: #9ca0a7;">Powered by EAC technology</span>
                </a>
            </div>
            <iframe width=100% height=800px frameBorder="0px" src="${url}"></iframe>
        `;

        gmailContent.parentElement.insertBefore(eacviewer, gmailContent);
        return gmailContent;
    }




    Gmail.splitMultiparts = function(content) {
        var m = content.match(/Content-Type: multipart\/mixed; boundary=(.+\S)/gi);
        if (!m) return [];

        var boundary = m[0].match(/boundary=(.+\S)/i)[1];

        content = content.split(`--${boundary}--`, 1)[0];
        var res = content.split(`--${boundary}`);

        res = res.map(function(x) {
            return x.trim();
        });
        
        return res;
    }



    Gmail.skipThreads = {};



    Gmail.fetchNewThreads = function() {
        var lastTs = Gmail.storage.options.lastTs || (new Date(2016, 08, 01)).getTime(); // 2016-09-01
        // var lastTs = (new Date(2016, 09, 01)).getTime() * 1000; // Google use msecs

        var query = {
            search : 'query',
            q      : 'has:attachment label:(-trash) filename:xml',
        };

        function fetch(offset) {
            return Gmail.fetchThreads(query, offset, 25);
        }

        return new Promise(function(resolve, reject) {
            var result = [];

            function stopIteration() {
                if (result.length) {
                    Gmail.storage.options.lastTs = result[0].ts;
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
                            return Boolean(Gmail.skipThreads[skipKey(x)]) == false;
                        })
                    })

                    // save threads for skip after
                    .then(function(threads) {
                        threads.forEach(function(x) {
                            Gmail.skipThreads[skipKey(x)] = true;
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



    Gmail.filterEacMessages = function(threads) {
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



    Gmail.fetchNewEacs = function() {
        __.debug('Fetching new EACs..');

        return Gmail
            .fetchNewThreads()
            .then(Gmail.filterEacMessages)
            .then(function(eacs) {
                __.debug('Founded eacs:', eacs);

                return eacs.sort(Utils.cmpByKey('ts'));
            })
    }




    Gmail.onHashChanged = function() {
        __.info('Gmail url changed!')

        if (Gmail.needRefreshUIFlag) Gmail.refreshUI();

        Gmail.updateThreads();
        
        if (!Gmail.messageId()) {
            __.debug('There is no Message ID.');
            return;
        }
        
        __.debug('Detected Message ID:', Gmail.messageId());
               
        Gmail
            .getMessageContent()
            
            .then(function(resp) {
                __.debug('Message Source Content:\n\n', resp);

                if (!EAC.isEacMessage(resp)) {
                    __.debug('It is not EAC message!');
                    return;
                }

                __.info('EAC content detected!');

                var url = EAC.parseEacviewerUrl(resp);
                __.debug('EAC Viewer URL:', url);

                Gmail.insertEacViewer(url);
            });
    }


    Gmail.processEacs = function(eacs) {
        __.debug('Processing EACs..');

        return Utils.Promise
            .map(function(eac) {
                
                // save thread ID for this EAC
                var threads = Gmail.storage.setDefault(
                    ['eacs', eac.eacToken.toLowerCase()], 
                    {threads : {}, messages : {}}
                ).threads;

                threads[eac.messageId] = eac.serialize();

                return Gmail
                    // load all Gmail thread of messages for EAC
                    .getThreadMessages(eac.messageId)

                    // load EAC object for each message in thread
                    .then(function(messages) {
                        return Utils.Promise
                            .map(function(m) {
                                return m.getEAC();
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
                    return eac.processEacMethod();
                }, allEacs);
            })

            // save storage
            .then(function(allEacs) {
                return new Promise(function(resolve, reject) {
                    Gmail.storage
                        .save()
                        .then(function() {
                            resolve(allEacs)
                        });
                });
            })

    }



    Gmail.workers = {};


    Gmail.init = function() {
        return Utils
            .Promise.waitUntil(function() {
                __.debug('Wait loading window.MainDB');
                return window.MainDB && window.Extension && window.Extension.Storages;
            })
            
            .then(function() {
                __.debug('Load Plugin Storage')
                return Extension.Storages.get(Gmail.userEmail());
            })

            .then(function(storage) {
                __.debug('Check storage scheme');

                Gmail.storage = storage;
                
                var needInit = ['eacs', 'options'].some(function(key) {
                    return (key in storage) == false;
                });

                needInit = needInit || Object.values(storage.eacs).some(function(eacData) {
                    return ('messages' in eacData) == false || ('threads' in eacData) == false;
                });

                if (needInit) {
                    storage.eacs = {};
                    storage.options = {};
                    return storage.save();
                }

                return storage;
            })

            .then(function() {
                return Utils.Promise.waitUntil(function() {
                    return document.readyState == 'complete';
                })
            })

            .then(function() {
                __.debug('Update Threads..')
                Gmail.updateThreads();
                
                window.addEventListener("hashchange", Gmail.onHashChanged);
                Gmail.onHashChanged();

                return;
            })

            .then(function() {
                Gmail.workers.checkEacs = Utils.Promise.worker(function() {
                    __.debug('Check new EACs worker.');

                    return Gmail
                        .fetchNewEacs()
                        
                        .then(Gmail.processEacs)

                        .then(function(eacs) {
                            if (eacs.length) Gmail.needRefreshUI();
                            return eacs;
                        })

                        .then(function() {
                            __.debug('Check unread EACs');

                            return Gmail
                                .fetchUnreadThreads()

                                .then(function(messages) {
                                    var eacIds = Object
                                        .values(Gmail.storage.eacs)
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
                                    })
                                })

                                .then(function(messages) {
                                    Extension.setUnreadCountBadge(messages.length);
                                })

                                .then(function() {
                                    __.debug('Send info to background worker');

                                    return Extension.sendMessage({
                                        action : 'setUserInfo', 
                                        value : Gmail.Account.current().serialize()
                                    });
                                })
                            
                        })
                        
                        .then(function() {
                            return 20000; // timeout
                        })

                        .catch(function(err) {
                            __.error(err);
                            return Promise.resolve(20000); // failover
                        })
                })
            })
    }



    return Gmail;
})();


