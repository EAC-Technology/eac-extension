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


    Gmail.normalizeEmailAddress = function(email) {
        var parts = email.toLowerCase().split('@');
        var name = parts[0], domain = parts[1];

        name = name.split('+')[0];

        if (domain == 'googlemail.com') 
            domain = 'gmail.com'

        if (domain == 'gmail.com')
            name = name.replace('.', '');

        return [name, domain].join('@');
    }


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

        this.gapi = null;

        this.getContent = function() {
            if (this.content) return Promise.resolve(this.content);
            if (!this.id) return Promise.resolve('');

            if (!this.lastThreadMessageId) {
                this.lastThreadMessageId = Gmail.originalMessageId(this.id) || this.id;
            }

            var self = this;

            return this.gapi.messages.get(this.lastThreadMessageId)
                .then(function(content) {
                    self.content = content;
                    return content;
                });
        }


        this.getEAC = function() {
            if (this.eac) return Promise.resolve(this.eac);

            var self = this;
            
            // var obj = Object
            //     .values(Gmail.storage.eacs)

            //     .reduce(function(res, eacData) {
            //         if (res) return res;
            //         return eacData.messages[self.id] || eacData.threads[self.id];
            //     }, null);

            // if (obj) 
            //     return Promise.resolve(EAC.deserialize(obj));


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




    Gmail.apiInstance = null;
    
    Gmail.setAccount = function(details) {
        Gmail.apiInstance = new GmailAPI(details);
    }    
    
    Gmail.api = function() {
        if (Gmail.apiInstance == null)
            Gmail.apiInstance = new GmailAPI(Gmail.Account.current());
        return Gmail.apiInstance;
    }

    
    

    Gmail.threads = {};



    Gmail.fetchThreads = function(params, offset, limit) {
        return Gmail.api().threads.list(params, offset, limit);

        // offset = offset || 0;
        // limit = limit || 20;

        // var url = Gmail.absUrl(`?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=tl&start=${offset}&num=${limit}&rt=j`);
        
        // return ajax.get(url, params)
        //     .then(function(resp) {
        //         var data = JSON.parse(resp.slice(5));
            
        //         data = data[0].filter(function(x) {
        //             return x[0] == 'tb';
        //         });

        //         var threads = data.reduce(function(arr, x) {
        //             return arr.concat(x[2]);
        //         }, []);

        //         return threads;
        //     })

        //     .then(function(threads) {
        //         threads = threads.map(Gmail.Message.parse);
        //         __.debug('Gmail Feed Threads:\n', threads);
        //         return threads;
        //     });
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
        return Gmail.api().threads.get(threadId);

        // var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&rt=j&view=cv&search=trash&th=${threadId}&type=${threadId}`;
        // var url = Gmail.absUrl(query);
        
        // return ajax.get(url)
            
        //     .then(function(resp) {
        //         var data = JSON.parse(resp.slice(5));
                
        //         return data[0].filter(function(x) {
        //             return x[0] == 'ms';
        //         })
        //     })

        //     .then(function(rawMessages) {
        //         return rawMessages.filter(function(arr) {
        //             return arr[9].indexOf('^k') < 0;
        //         });
        //     })
            
        //     .then(function(rawMessages) {
        //         return rawMessages
        //             .map(Gmail.Message.parse)
        //             .sort(Utils.cmpByKey('ts'));
        //     });
    }



    Gmail.trashThread = function(threadId) {
        return Gmail.api().threads.trash(threadId);
        // var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=up&act=tr&rt=j&search=all&t=${threadId}`;
        // var url = Gmail.absUrl(query);
        // return ajax.get(url);
    }


    Gmail.untrashThread = function(threadId) {
        return Gmail.api().threads.untrash(threadId);
        // var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=up&act=ib&rt=j&search=trash&t=${threadId}`;
        // var url = Gmail.absUrl(query);
        // return ajax.get(url);
    }

    Gmail.trashMessage = function(messageId) {
        __.debug('Trash message', messageId);
        return Gmail.api().messages.trash(messageId);
        // var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=up&act=dm&rt=j&search=all&m=${messageId}`;
        // var url = Gmail.absUrl(query);
        // return ajax.get(url);
    }

    Gmail.untrashMessage = function(messageId) {
        return Gmail.api().messages.untrash(messageId);
        // var query = `?ui=2&ik=${Gmail.userToken()}&at=${Gmail.actionToken()}&view=up&act=ib&rt=j&search=trash&m=${messageId}`;
        // var url = Gmail.absUrl(query);
        // return ajax.get(url);
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


        // disable refresh if composer is active
        var is_composer = window.location.toString().indexOf('compose=') >= 0;
        if (is_composer) {
            __.debug('Disable UI refresh, because Composer is active');
            return false;
        }

        // disable refresh if filter-dialog is active
        var is_filter = Boolean($('.ZZ:hover'));
        if (is_filter) {
            __.debug('Disable UI refresh, because Filter Dialog is active');
            return false;
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
        messageId = messageId || Gmail.originalMessageId();
        return Gmail.api().messages.get(messageId);
        
        // var url = Gmail.messageUrl(messageId);
        // if (!url) return Promise.resolve('');

        // var CONTENT_START = '<pre class="raw_message_text" id="raw_message_text">';
        
        // return ajax.get(url)
        //     .then(function(content) {
        //         var i = content.indexOf(CONTENT_START) + CONTENT_START.length;
        //         var j = content.indexOf('</pre>', i);
        //         content = content.slice(i, j);

        //         var pre = document.createElement('pre');
        //         pre.innerHTML = content;
        //         content = pre.innerText;

        //         var lines = content.split('\n');
        //         content = lines
        //             .map(function(l) {
        //                 if (l.length == 76 && l.endsWith('='))
        //                     return l.slice(0, -1);
        //                 return l + '\n';
        //             })

        //             .join('');

        //         return content;
        //     });
    }



    Gmail.getMessageContent = function() {
        __.debug('Get Message Content', Gmail.messageId(), Gmail.messageUrl(), 'start');
        return Gmail.getMessageSource();
    }


    Gmail.isEacViewerInserted = function() {
        return __.$('#appinmail-eac-viewer').length > 0;
    }

    
    Gmail.refreshEacViewer = function() {
        var eacViewer = __.$('#appinmail-eac-viewer')[0];
        if (!eacViewer) return;

        var iframe = __.$('iframe', eacViewer)[0];
        var url = iframe.src;

        eacViewer.remove();
        Gmail.insertEacViewer(url);
    }


    Gmail.insertEacViewer = function(url) {
        __.info('Insert EAC Viewer into message content');

        if (Gmail.isEacViewerInserted()) {
            __.debug('EAC Viewer has inserted');
            return;
        }

        var t1 = Date.now();

        // wait for Gmail UI is complete loaded
        Utils.Promise.waitUntil(function() {
            if (Date.now() - t1 > 10000) return true; // wait only 10 sec
            return __.$('div[role="listitem"] div.adn').length > 0;
        })

        .then(function() {
            var messageDiv = __.$('div[role="listitem"] div.adn')[0];

            if (!messageDiv) {
                __.error('Can\'t insert EACViewer, GMail UI elements not found!');
                return;
            }

            var gmailContent = messageDiv.childNodes[1].childNodes[6];
            __.debug('Gmail Message Content Element: ', gmailContent);

            var eacviewer = document.createElement('div');
            eacviewer.id = 'appinmail-eac-viewer';
            eacviewer.innerHTML = `
                <div style="font-size: 10pt; margin-bottom: 3px;">
                    <a href="http://appinmail.io/" target="_blank" style="text-decoration: none">
                        <img src="${Extension.logoUrl}" alt="EAC" style="vertical-align: middle;"/>
                        <span style="color: #9ca0a7;">Powered by EAC technology</span>
                    </a>

                    <img id="appinmail-eac-refresh-button" src="${Extension.refreshIconUrl}" alt="Refresh" style="vertical-align: middle; margin-left:4px; cursor: pointer;">
                </div>
                <iframe width=100% height=800px frameBorder="0px" src="${url}"></iframe>
            `;

            gmailContent.parentElement.insertBefore(eacviewer, gmailContent);

            var refreshButton = __.$('#appinmail-eac-refresh-button')[0];
            if (refreshButton) {
                refreshButton.onclick = function() {Gmail.refreshEacViewer();}
                
                // refreshButton.onmouseover = function() {
                //     refreshButton.style.transform = 'rotate(90deg)';
                // }
                // refreshButton.onmouseout = function() {
                //     refreshButton.style.transform = 'rotate(0deg)';
                // }
            }


            return gmailContent;
        })
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



    Gmail.workers = {};


    Gmail.init = function() {
        return Utils
            .Promise.waitUntil(function() {
                __.debug('Wait loading of main libs..');
                
                return window.Extension 
                    && window.Extension.Storages
                    && window.ajax
                    && window.MainDB
                    && window.EAC
                    && window.EACProcessing;
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
                __.debug('Wait document is ready..');

                return Utils.Promise.waitUntil(function() {
                    return document.readyState == 'complete';
                })
            })

            .then(function() {
                Extension.onMessage.addListener(function(message) {
                    if (message == 'needRefreshUI') Gmail.needRefreshUI();
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
                if (Extension.options.enable_eac_processing 
                        && Extension.options.enable_background_checks == false) {
                    
                    var eacProcessor = new EACProcessing(Gmail.Account.current());
                    Gmail.workers.checkEacs = eacProcessor.startWorker();
                }


                Extension.onMessage.addListener(function(message) {
                    if (message == 'restartEacProcessing') {
                        __.info('Restart EAC Processing');

                        if (Gmail.workers.checkEacs) Gmail.workers.checkEacs.stop();
                        
                        Extension
                            .getOptions()

                            .then(function(options) {
                                if (options.enable_eac_processing == false) {
                                    __.info('EAC Processing is disabled');
                                    return;
                                }

                                if (options.enable_background_checks) {
                                    __.info('EAC Processing works in background. No need to launch.');
                                    return;
                                }

                                Gmail.workers.checkEacs = (new EACProcessing(Gmail.Account.current())).startWorker();
                            })
                    }
                });
                


                Gmail.workers.updateAccountDetails = Utils.Promise.worker(function() {
                    __.debug('Send account info to background worker');

                    return Extension.sendMessage({
                            action : 'saveAccountInfo',
                            value : Gmail.Account.current().serialize()
                        })

                        .then(function() {
                            return 120000;
                        })

                        .catch(function(err) {
                            __.error(err);
                            return Promise.resolve(120000);
                        })
                });
            })

    }


    Gmail.init();


    return Gmail;

})();


