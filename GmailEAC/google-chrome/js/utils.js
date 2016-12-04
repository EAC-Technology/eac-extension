var Utils = (function() {
	
	var Utils = function() {};


	Utils.clone = function(obj) {
		return JSON.parse(JSON.stringify(obj));
	}


	Utils.cmpByKey = function(key) {
		return function(a, b) {
			if (a[key] < b[key]) return -1;
			if (a[key] > b[key]) return 1;
			return 0;
		}
	}


	Utils.Promise = (function() {
		function SugarPromise() {}


		SugarPromise.delay = function(tout) {
			tout = tout || 1;

			return new Promise(function(resolve, reject) {
				setTimeout(resolve, tout);
			});
		}


		SugarPromise.worker = function(func) {
			function next() {
				return Promise
					.resolve(func())
					.then(SugarPromise.delay)
					.then(function() {
						if (isRunning) return next();
					});
			}

			var isRunning = true;
			
			function stop() {
				isRunning = false;
			}

			next();
			return {stop : stop, isRunning : isRunning};
		}


		SugarPromise.map = function(func, data) {
			var result = [];
			var values = Object.values(data);

			return new Promise(function(resolve, reject) {
				function next() {
					if (!values.length) return resolve(result);
					
					var res = func(values.shift());
					
					Promise
						.resolve(res)
						.then(function(value) {
							result.push(value);
							return;
						})
						.then(Utils.Promise.delay)
						.then(next);
				}

				next();
			});
		}


		SugarPromise.waitUntil = function(func, timeout) {
			if (func())	return Promise.resolve();

			timeout = timeout || 100;

			return new Promise(function(resolve, reject) {
				var intervalId = setInterval(function() {
					if (func()) {
						clearInterval(intervalId);
						resolve();
					}
				}, timeout);
				
			});
		}

		return SugarPromise;


	})();


	return Utils;

})();