var GmailAPI = (function() {
	function API(details) {
		var self = this;

        details = details || {};

        this.url = details.url;
        if (this.url && this.url.slice(-1) != '/') this.url += '/';

        this.userToken = details.userToken;
        this.actionToken = details.actionToken;

        
        function ajax_call(method, query, data) {
        	data = data || {};
        	Object.assign(data, this.tokens());
        	return method(this.absUrl(query), data);
    	}

    	this.ajax = {
	        get : ajax_call.bind(self, ajax.get),
	        post : ajax_call.bind(self, ajax.post)
    	}


    	this.threads = {
    		fetch : function(params, offset, limit) {
		        offset = offset || 0;
		        limit = limit || 20;

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
		                threads = threads.map(Gmail.Message.parse);
		                __.debug('Gmail Feed Threads:\n', threads);
		                return threads;
		            });
		    },

            trash : function(threadId) {

            },

            untrash : function(threadId) {

            }

    	};


        this.messages = {
            get : function(messageId) {

            },


            list : function(threadId) {
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
                            .map(Gmail.Message.parse)
                            .sort(Utils.cmpByKey('ts'));
                    });
            },

            trash : function(messageId) {

            },

            untrash : function(messageId) {

            }
        };
    }


    API.prototype.extend = function(obj) {
    	var self = this;
    	obj = obj || {};

    	Object.keys(obj).forEach(function(key) {
    		self[key] = obj[key];
    	})

    	return this;
    }

	API.prototype.absUrl = function(query) {
        if (query.indexOf('://') > -1) return query;
        if (query[0] == '/') query = query.slice(0);
        return this.url + query;
    }

    API.prototype.tokens = function() {
        return {
            ik : this.userToken,
            at : this.actionToken
        };
    }

    
	return API;
})();
