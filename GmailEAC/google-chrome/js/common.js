function __() {};

__.$ = function __$(selector, elem) {
    elem = elem || document;
    return Array.prototype.slice.apply(elem.querySelectorAll(selector));
}


__.$contains = function __$contains(selector1, selector2, elem) {
    var elems = __.$(selector1, elem);
    var result = [];
    for(var i in elems) {
        var elem = elems[i];
        var check = VT.$(selector2, elem);
        if(check.length) result.push(elem);
    }
    return result;
}


__.logger = function(level, args) {
    var args = Array.prototype.slice.call(args);
    args.unshift('--- [EAC Plugin] -');
    level.apply(console, args);
}

__.info = function __debug() {
    __.logger(console.info, arguments);
}

__.debug = function() {
    Extension 
        && Extension.debug
        && __.logger(console.warn, arguments);
}

__.error = function() {
    __.logger(console.error, arguments);
}








if (!window.Extension) window.Extension = function() {};


Extension.getURL = function(path) {
    return `${this.EXTENSION_URL}${path}`;
}


Extension.inject_script = function(path, remove) {
    if (remove == null) remove = true;

    var injection = document.createElement('script');

    if (path)
        injection.src = this.getURL(path);

    else 
        return;

    if( remove ) {
        injection.onload = function() {
            this.parentNode.removeChild(this);
        }
    }

    (document.head || document.documentElement).appendChild(injection);
}



Extension.Storages = (function() {
    function Storages() {};

    Storages.get = function(key) {
        return MainDB
            .get(key)
            
            .then(function(data) {
                return MainDB.SimpleStorage(key, data);
            })
    }

    return Storages;
})();



Extension.sendMessage = function(message) {
    return new Promise(function(resolve, reject) {
        if (!Extension.EXTENSION_ID) return resolve(null);
        chrome.runtime.sendMessage(Extension.EXTENSION_ID, message, resolve);
    });
}



Extension.setBadgeText = function(text) {
    return Extension.sendMessage({action : 'setBadgeText', value : text});
}

Extension.setUnreadCountBadge = function(value) {
    return Extension.sendMessage({action : 'setUnreadCountBadge', value : value});
}




Extension.init = function() {
    if (!this.EXTENSION_URL) {
        this.EXTENSION_URL = 
            chrome
                && chrome.runtime
                && chrome.runtime.getURL
                && chrome.runtime.getURL('');

        this.EXTENSION_URL = this.EXTENSION_URL || '';
    }

    this.logoUrl = this.getURL('icons/logo_16.png');

    this.EXTENSION_ID = this.EXTENSION_URL.split('/', 3).slice(-1)[0];
}


Extension.init();


window.Appinmail = Extension; // alias

