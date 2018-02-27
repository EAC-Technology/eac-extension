var ajax = (function() {
	function Ajax() {};
	

	Ajax.urlencodeParams = function(data) {
		var params = Object.keys(data || {}).map(function(key) {
			var values = data[key] || '';
			if (values.map == undefined) values = [values];
			
			key = encodeURIComponent(key);

			values = values.map(function(val) {
				return key + '=' + encodeURIComponent(val);
			})

			return values.join('&');				
		});

		return params.join('&');
	}


	Ajax.xhr = function(method, url, withCredentials) {
		var xhr = new XMLHttpRequest();
		xhr.withCredentials = Boolean(withCredentials);
		xhr.open(method, url, true);
		return xhr;
	}


	Ajax.call = function(xhr, body) {
		return new Promise(function(resolve, reject) {
			xhr.onload = function() {
				resolve(xhr.response);
			}

			xhr.onerror = function(error) {
				reject(error);
			}

			xhr.send(body);
		});
	}


	Ajax.get = function(url, data, withCredentials) {
		if (data) {
			if (url.indexOf('?') < 0) 
				url += '?';
			else
				url += '&';

			url += Ajax.urlencodeParams(data);
		}

		var xhr = Ajax.xhr('GET', url, withCredentials);
		return Ajax.call(xhr);
	}

		
	Ajax.post = function(url, data, withCredentials) {
		var xhr = Ajax.xhr('POST', url, withCredentials);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		data = (data) ? Ajax.urlencodeParams(data) : null;
		return Ajax.call(xhr, data);
	}


	

	return Ajax;
})();
