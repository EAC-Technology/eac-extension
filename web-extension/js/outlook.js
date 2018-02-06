var Outlook = (function() {
    
    function $$(selector, startNode) {
        startNode = startNode || document;
        return Array.prototype.slice.apply(startNode.querySelectorAll(selector));
    }

    function $(selector, startNode) {
        startNode = startNode || document;
        return startNode.querySelector(selector);
    }



    function Outlook() {};

    Outlook.HOST = window.location.host;


    function _logger(method, isDebug) {
        return function() {
            if (isDebug && !Outlook.debug) return;
            var args = Array.prototype.slice.apply(arguments);
            args.unshift('[EAC Extension] --');
            method.apply(null, args);
        }
    }


    var _info = _logger(console.info);
    var _debug = _logger(console.warn, true);
    



    Outlook.Actions = new (function() {

        function _OWA_Call(action, url, request) {
            return new Promise(function(resolve) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);

                var headers = {
                    'Action'            : action,
                    'Content-Type'      : 'application/json',
                    'X-OWA-CANARY'      : Outlook.cookies()['X-OWA-CANARY'],
                    'X-OWA-UrlPostData' : encodeURIComponent(JSON.stringify(request))
                }

                for (var key in headers)
                    xhr.setRequestHeader(key, headers[key]);

                xhr.onload = function() {
                    resolve(JSON.parse(xhr.responseText));
                }

                xhr.send();
            });
        }

        
        this.GetItem = function(messageId) {
            if (!messageId) return Promise.resolve(null);

            var url = `https://${Outlook.HOST}/owa/service.svc?action=GetItem`;


            var request = {
                '__type' : 'GetItemJsonRequest:#Exchange',
                
                'Header' : {
                    '__type' : 'JsonRequestHeaders:#Exchange',

                    'RequestServerVersion' : 'Exchange2013', 

                    'TimeZoneContext' : {
                        '__type' : 'TimeZoneContext:#Exchange',

                        'TimeZoneDefinition' : {
                            '__type' : 'TimeZoneDefinitionType:#Exchange', 
                            'Id' : Outlook.sessionData().owaUserConfig.UserOptions.TimeZone
                        }
                    }
                }, 


                'Body' : {
                    '__type' : 'GetItemRequest:#Exchange',

                    'ItemShape' : {
                        '__type' : 'ItemResponseShape:#Exchange',
                        'IncludeMimeContent' : true, 
                        'BaseShape' : 'IdOnly'
                    }, 

                    'ItemIds' : [
                        {
                            '__type' : 'ItemId:#Exchange',
                            'Id' : messageId
                        }
                    ]
                }
            }

            return _OWA_Call('GetItem', url, request);
        }


        this.GetConversationItems = function(conversationId) {
            if (!conversationId) return Promise.resolve(null);

            var url = `https://${Outlook.HOST}/owa/service.svc?action=GetConversationItems`;

            var request = {
                '__type' : 'GetConversationItemsJsonRequest:#Exchange',

                'Header' : {
                    '__type' : 'JsonRequestHeaders:#Exchange',
                    'RequestServerVersion' : 'V2016_06_24',
                    'TimeZoneContext' : {
                        '__type' : 'TimeZoneContext:#Exchange',

                        'TimeZoneDefinition' : {
                            '__type' : 'TimeZoneDefinitionType:#Exchange',
                            'Id' : Outlook.sessionData().owaUserConfig.UserOptions.TimeZone
                        }
                    }
                },

                'Body' : {
                    '__type' : 'GetConversationItemsRequest:#Exchange',

                    'Conversations' : [
                        {
                            '__type' : 'ConversationRequestType:#Exchange',
                            'ConversationId' : {
                                '__type' : 'ItemId:#Exchange',
                                'Id' : conversationId
                            },
                            
                            'SyncState' : ''
                        }
                    ],

                    'SortOrder' : 'DateOrderDescending'
                }
            }

            return _OWA_Call('GetConversationItems', url, request);
        }

    })();




    Outlook.cookies = function() {
        return decodeURIComponent(document.cookie)
            .split(/;\s*/)
            .reduce(function(res, x) {
                var item = x.split('=');
                var k = item[0], 
                    v = item.slice(1).join('='); 
                res[k] = v; 
                return res;
            }, {});
    }


    Outlook.sessionData = function() {
        return JSON.parse(window.owaSDState.data);
    }




    Outlook.UI = new (function() {
        var self = this;

        function isElementVisible(x) {
            var s = window.getComputedStyle(x);
            return (s.visibility !== 'hidden');
        }

        function findActiveElement(selector) {
            var res = $$('div[role=presentation][aria-selected=true] ' + selector).filter(isElementVisible);
            if (res.length) return res[0];

            res = $$('div[role=presentation][aria-selected] ' + selector).filter(isElementVisible);
            if (res.length) return res[0];

            return $$('div[role=presentation] ' + selector).filter(isElementVisible)[0] || null;
        }


        this.getActiveConversationId = function() {
            var a = $$('div[aria-selected=true][data-convid]')[0];
            if (!Boolean(a)) return;

            return a.attributes['data-convid'].value;
        }

        this.getActiveMessageHeader = function() {
            return findActiveElement('div[role="heading"][aria-label]');
        }

        this.getActiveMessageBody = function() {
            return findActiveElement('div[id="Item.MessagePartBody"]');
        }


        this.isEacViewerInserted = function() {
            return Boolean(this.getActiveEacViewer());
        }

        this.getActiveEacViewer = function() {
            return $$('#appinmail-eac-viewer').filter(isElementVisible)[0] || null;
        }

        this.deleteEacViewer = function() {
            var eacViewer = this.getActiveEacViewer();
            if (Boolean(eacViewer)) eacViewer.remove();
        }


        this.refreshEacViewer = function() {
            var eacViewer = this.getActiveEacViewer();

            var iframe = $('iframe', eacViewer);
            var url = iframe.src;

            eacViewer.remove();
            this.insertEacViewer(url);
        }

        this.scrollEacViewer = function() {
            var eacViewer = this.getActiveEacViewer();
            if (!eacViewer) return;

            eacViewer.scrollIntoView();
        }


        this.insertEacViewer = function(url) {
            if (!url) return;

            this.deleteEacViewer();
            
            var messageBody = this.getActiveMessageBody();
            if (!Boolean(messageBody)) return;

            
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

            _info('Active Content has launched!');

            var placeholder = messageBody;

            var messageHeader = this.getActiveMessageHeader();
            if (Boolean(messageHeader)) {
                placeholder = $$('div[role=region][aria-label]', messageHeader)[0] || null;
                placeholder = (placeholder && placeholder.nextElementSibling && placeholder.nextElementSibling.firstElementChild) || messageBody;
            }


            placeholder.parentElement.insertBefore(eacviewer, placeholder);

            var refreshButton = $('#appinmail-eac-refresh-button');
            
            if (refreshButton) {
                refreshButton.onclick = function() {
                    Outlook.UI.refreshEacViewer();
                }
                
                // refreshButton.onmouseover = function() {
                //     refreshButton.style.transform = 'rotate(90deg)';
                // }
                // refreshButton.onmouseout = function() {
                //     refreshButton.style.transform = 'rotate(0deg)';
                // }
            }


            Utils.Promise.waitUntil(function() {
                return self.isEacViewerInserted();
            })

            .then(function() {
                Outlook.UI.scrollEacViewer();
            });



        }


        this.onMessageSelected = function() {};

        var lastConvId = null;

        this.init = function() {
            $('#primaryContainer').addEventListener('DOMSubtreeModified', function() {
                if (!Outlook.UI.getActiveMessageBody()) {
                    lastConvId = null;
                    return;
                }

                var activeConvId = Outlook.UI.getActiveConversationId();

                if (activeConvId != lastConvId) {
                    _debug('Conversation selected', activeConvId);
                    (Outlook.UI.onMessageSelected || function() {})();
                    lastConvId = activeConvId;
                }
            })
        }


    })();




    Outlook.Message = new (function() {

        this.getConversationMessages = function(conversationId) {
            return Outlook.Actions
                .GetConversationItems(conversationId)

                .then(function(resp) {
                    if (!resp) return [];
                    
                    return resp
                        .Body
                        .ResponseMessages
                        .Items[0]
                        .Conversation
                        .ConversationNodes
                            .map(function(node) {
                                return node.Items[0].ItemId.Id;
                            });
                })

                .then(function(ids) {
                    _debug('Conversation:', conversationId, 'Messages:', ids);
                    return ids;
                })
        }


        this.getContent = function(messageId) {
            if (!messageId) return Promise.resolve(null);

            return Outlook.Actions
                .GetItem(messageId)

                .then(function(resp) {
                    if (!resp) return null;
                    var bdata = resp.Body.ResponseMessages.Items[0].Items[0].MimeContent.Value;
                    return atob(bdata);
                })

                .then(function(content) {
                    _debug('Message:', messageId, 'Content:', content);
                    return content;
                })
        }


        this.parseEacViewerUrl = function(content) {
            var text = content;
        
            // RFC 3986 (URL)
            var unreserved  = `a-zA-Z0-9-._~`;
            var sub_delims  = `!\$&'()*+,;=`;
            var pchar = `${unreserved}%${sub_delims}:@`;
            var query = `${pchar}\\/\\?`;

            var link = `(https?:\\/\\/a[a-z]+\\.appinmail\\.(io|pw|top)\\/u[rl]{0,2}\\?k[ey]{0,2}\\=[${query}]+)`;
            var linkRe = RegExp(link, 'gi');
                
            var m = text.match(linkRe);
            if (!m) return '';

            var url = m[0];

            // check url
            var parts = url.split('=');
            var key = (parts.length > 1) ? parts[1] : null;
            if (!key) return url;

            if (key.startsWith('3D') && key.length == 9)
                return [parts[0], key.slice(2)].join('=');

            var atMarker = 'https://at.';
            if (url.toLowerCase().startsWith(atMarker)) {
                url = 'https://admin.' + url.slice(11);
            }

            return url;
            
        }



        this.getEacViewerUrl = function(messageId) {
            if (!messageId) return Promise.resolve(null);

            function parseHeader(content, key) {
                if (!content) return null;
                var re = RegExp(`${key}:\\s+(\\S+)`, 'gi');
                var m = re.exec(content);
                return (m && m.length && m[1]) || null;
            }


            return this
                .getContent(messageId)

                .then(function(content) {
                    if (!parseHeader(content, 'EAC-Token')) return null;
                    if (!parseHeader(content, 'EAC-Method')) return null;

                    return parseHeader(content, 'EAC-URL') || Outlook.Message.parseEacViewerUrl(content) || null;
                })

                .then(function(url) {
                    _debug('Message:', messageId, 'Eac Url:', url);
                    if (url) _info('EAC Message detected!');
                    return url;
                })
        }



    })();



    Outlook.UI.onMessageSelected = function() {
        var conversationId = Outlook.UI.getActiveConversationId();
        if (!conversationId) return;

        // remote EAC Viewer if it was added from another message
        Outlook.UI.deleteEacViewer();

        Outlook.Message
            .getConversationMessages(conversationId)

            .then(function(messageIds) {
                return Outlook.Message.getEacViewerUrl(messageIds.slice(-1)[0]);
            })

            .then(function(url) {
                Outlook.UI.insertEacViewer(url);
            })
    }


    Outlook.init = function() {
        Utils.Promise
            .waitUntil(function() {
                return Boolean($('#primaryContainer'));
            })

            .then(function() {
                return Outlook.UI.init();
            })

            .then(function() {
                _info('running');
            })
    }



    if (Extension.isContentScript())
        Outlook.init();


    return Outlook;    

})();


