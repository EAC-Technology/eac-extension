var GmailAPI = (function() {
	function GmailAPI(details) {
		var self = this;

        details = details || {};

        this.url = details.url;
        if (this.url && this.url.slice(-1) != '/') this.url += '/';

        this.userToken = details.userToken;
        this.actionToken = details.actionToken;

        
        function ajax_call(method, query, data) {
        	data = data || {};
        	Object.assign(data, self.tokens());
        	return method(self.absUrl(query), data);
    	}

    	this.ajax = {
	        get : ajax_call.bind(self, ajax.get),
	        post : ajax_call.bind(self, ajax.post)
    	}


    	this.threads = {
    		list : function(params, offset, limit) {
		        params = params || {search : 'inbox'};
                offset = offset || 0;
		        limit  = limit || 20;

		        var url = `?ui=2&view=tl&start=${offset}&num=${limit}&rt=j`;
		        
		        return self.ajax.get(url, params)
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
		                threads = threads
                            .map(function(x) {
                                var message = Gmail.Message.parse(x);
                                message.gapi = self;
                                return message;
                            })

		                __.debug('Gmail Feed Threads:\n', threads);
		                return threads;
		            });
		    },


            get : function(threadId) {
                var url = `?ui=2&rt=j&view=cv&search=trash&th=${threadId}&type=${threadId}`;
                
                return self.ajax.get(url)
                    
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
                            .map(function(x) {
                                var message = Gmail.Message.parse(x);
                                message.gapi = self;
                                return message;
                            })
                            .sort(Utils.cmpByKey('ts'));
                    });
            },


            trash : function(threadId) {
                var query = `?ui=2&view=up&act=tr&rt=j&search=all&t=${threadId}`;
                return self.ajax.get(query);
            },


            untrash : function(threadId) {
                var query = `?ui=2&view=up&act=ib&rt=j&search=trash&t=${threadId}`;
                return self.ajax.get(query);
            }
    	};

     
    

        this.messages = {
            get : function(messageId) {
                if (!messageId) return Promise.resolve('');

                var query = `?ui=2&view=om&th=${messageId}`;
                var url = self.absUrl(query);

                var CONTENT_START = '<pre class="raw_message_text" id="raw_message_text">';
                
                return ajax.get(url, {'ik' : self.userToken})
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

            },


            trash : function(messageId) {
                var query = `?ui=2&view=up&act=dm&rt=j&search=all&m=${messageId}`;
                return self.ajax.get(query);
            },


            untrash : function(messageId) {
                var query = `?ui=2&view=up&act=ib&rt=j&search=trash&m=${messageId}`;
                return self.ajax.get(query);
            }
        };


        this.feed = {
            atom : function(label) {
                label = label || '';
                if (label.startsWith('/')) label = label.slice(1)

                return ajax
                    .get(self.url + 'feed/atom/' + label)
                    
                    .then(function(response) {
                        var xml = (new DOMParser()).parseFromString(response, 'text/xml');
                        
                        var title = xml.querySelector('title').textContent;
                        var email = title.split(' ').slice(-1)[0];
                        
                        if (email != details.email) 
                            throw('Invalid account info');

                        return xml;                        
                    })
            },

            test : function() {
                return self.feed.atom()
                    .then(function(xml) {
                        return true;
                    })

                    .catch(function() {
                        return false;
                    })
            }
        };

    }


    GmailAPI.prototype.extend = function(obj) {
    	var self = this;
    	obj = obj || {};

    	Object.keys(obj).forEach(function(key) {
    		self[key] = obj[key];
    	})

    	return this;
    }

	GmailAPI.prototype.absUrl = function(query) {
        if (query.indexOf('://') > -1) return query;
        if (query[0] == '/') query = query.slice(0);
        return this.url + query;
    }

    GmailAPI.prototype.tokens = function() {
        return {
            ik : this.userToken,
            at : this.actionToken
        };
    }

    
	return GmailAPI;
})();
