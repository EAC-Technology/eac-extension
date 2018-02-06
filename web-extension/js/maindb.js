

var MainDB = (function() {
	var MainDB = function() {};


	MainDB._db = null;
	MainDB._version = 1;
	MainDB._name = 'EACPlugin_MainDB';


	function PromiseRequest(request) {
		return new Promise(function(resolve, reject) {
			request.onsuccess = function() {
				resolve(request.result);
			}

			request.onerror = function(event) {
				reject(event);
			}
		});
	}

	
	MainDB.open = function() {
		if (MainDB._db) return Promise.resolve(MainDB._db);
		
		var request = window.indexedDB.open(MainDB._name, MainDB._version);

		request.onupgradeneeded = function(ev) {
			var db = ev.target.result;
			db.createObjectStore('eac_storage', {keyPath : 'key'});
		}
		
		return PromiseRequest(request)
			.then(function(res) {
				MainDB._db = res;
				return res;
			});
	}


	MainDB.objectStore = function(name, mode) {
		mode = mode || 'readonly';
		return MainDB
			.open()
			.then(function(db) {
				return db
					.transaction([name], mode)
					.objectStore(name);
			})
	}


	MainDB.getEacStorage = function(mode) {
		return MainDB.objectStore('eac_storage', mode);
	}


	MainDB.get = function(key) {
		return MainDB
			.getEacStorage('readonly')
			.then(function(storage) {
				return PromiseRequest(storage.get(key));
			})
	}

	MainDB.put = function(data) {
		return MainDB
			.getEacStorage('readwrite')
			.then(function(storage) {
				return PromiseRequest(storage.put(data));
			})
			.catch(function(err) {
				console.error(data);
			})
	}

	MainDB.delete = function(key) {
		return MainDB
			.getEacStorage('readwrite')
			.then(function(storage) {
				return PromiseRequest(storage.delete(key));
			})
	}


	MainDB.SimpleStorage = function(key, data) {
        function addStorageMethods(obj) {
            obj.init = init;
            obj.save = save;
            obj.refresh = refresh;
            obj.clear = clear;
            obj.delete = _delete;
            obj.setDefault = setDefault;
        }

        function deleteStorageMethods(obj) {
        	[
        		'save',
        		'refresh',
        		'clear',
        		'delete',
        		'setDefault',
        		'init'

        	].forEach(function(key) {
        		if (obj[key]) delete obj[key];
        	})
        }


        function init() {
        	return Promise.resolve(data.value);
        }


        function save() {
            var obj = Object.assign({}, data.value); // clone
            deleteStorageMethods(obj);

            return MainDB
                .put({key : data.key, value : obj})
                .then(function() {
                    return data.value;
                })
        }

        
        function setDefault(path, value) {
            return path.reduce(function(res, key, i) {
                if (res.hasOwnProperty(key) == false) 
                    if (i == path.length - 1)
                        res[key] = value;
                    else
                        res[key] = {};
                
                return res[key];
            }, data.value);
        }


        function refresh() {
            return MainDB
                .get(data.key)
                .then(function(obj) {
                    Object.keys(data.value).forEach(function(key) {
                        delete data.value[key];
                    });

                    Object.assign(data.value, obj.value);
                    addStorageMethods(data.value);
                });
        }

        function clear() {
        	data.value = {};
        	return save();
        }

        function _delete() {
        	return MainDB.delete(data.key);
        }


        if (!data) {
            data = {key : key, value : {}};

            var promise = refresh()
            	.catch(save)
            	.then(function() {
            		addStorageMethods(data.value)
            		return data.value;
            	});

            init = function() {
            	return promise;
            }

            data.value.init = init;
        }
        else {
        	data.value.init = function() {
        		return Promise.resolve(data.value);
        	}
        }


        addStorageMethods(data.value);
        return data.value;
    }


	
	return MainDB;
	
})();



