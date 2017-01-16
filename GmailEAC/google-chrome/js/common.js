function $$(selector, startNode) {
    startNode = startNode || document;
    return Array.prototype.slice.apply(startNode.querySelectorAll(selector));
}

function $(selector, startNode) {
    startNode = startNode || document;
    return startNode.querySelector(selector);
}



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
    return new Promise(function(resolve) {
        if (!Extension.EXTENSION_ID) return resolve(null);
        
        if (Extension.isBackgroundPage) {
            BackgroundMessaging.sendMessage(message, {}, resolve);
            return;
        }
        
        chrome.runtime.sendMessage(Extension.EXTENSION_ID, message, resolve);
    });
}


Extension.sendBroadcastMessage = function(message) {
    if (! Extension.isBackgroundPage) return;

    Object.values(ports || {}).forEach(function(account) {
        Object.values(account || {}).forEach(function(tab) {
            tab.postMessage(message);
        })
    })
}


// Extension.port = null;
// Extension.handlers = [];

// Extension.getConnection = function() {
//     if (Extension.port) return Promise.resolve(Extension.port);

//     if (!Extension.EXTENSION_ID) return Promise.resolve(null);

//     return new Promise(function(resolve) {
//         var port = chrome.runtime.connect(Extension.EXTENSION_ID);
//         Extension.port = port;

//         port.onDisconnect.addListener(function() {
//             Extension.port = null;
//         });

//         Extension.handlers.forEach(function(handler) {
//             port.onMessage.addListener(handler);
//         })

//         resolve(port);
//     });
// }

// Extension.onMessage = {
//     addListener : function(handler) {
//         Extension.handlers.push(handler);
//         if (Extension.port) 
//             Extension.port.onMessage.addListener(handler);
//     }
// }



// Extension.InternalConnection = (function() {
//     var Port = function() {
//         var self = this;

//         this.remotePort = null;
        
//         this.handlers = {
//             onMessage : [],
//             onDisconnect : []
//         };

//         this.connect = function(port) {
//             this.remotePort = port;
//             port.remotePort = this;
//         }

//         this.disconnect = function() {
//             this.remotePort.
//         }


//         this.onMessage = {
//             addListener : function(handler) {
//                 self.handlers.onMessage.push(handler);
//             }
//         }

//         this.onDisconnect = {
//             addListener : function(handler) {
//                 self.handlers.onDisconnect.push(handler);
//             }
//         }
        

//         this.receiveMessage = function(message) {
//             self.handlers.forEach(function(handler) {
//                 handler(message, self.remotePort);
//             })
//         }

//         this.postMessage = function(message) {
//             this.remotePort.receiveMessage(message);
//         }
//     }

// })();




// Extension.onMessage = function() {

// }



Extension.setBadgeText = function(text) {
    return Extension.sendMessage({action : 'setBadgeText', value : text});
}

Extension.setUnreadCount = function(url, value) {
    return Extension.sendMessage({action : 'setUnreadCount', url : url, value : value});
}



Extension.options = {};

Extension.getOptions = function() {
    return Extension
        .sendMessage({action : 'getExtensionOptions'})
        .then(function(options) {
            Extension.options = options;
            return options;
        })
}

Extension.setOptions = function(options) {
    Object.assign(Extension.options, options);
    return Extension.sendMessage({action : 'updateExtensionOptions', value : options});
}


Extension.isContentScript = function() {
    return Boolean(chrome.app.getDetails()) == false;
}





Extension.connectionPort = null;

Extension.connect = function() {
    if (Extension.connectionPort) 
        Extension.connectionPort.disconnect();

    var port = chrome.runtime.connect(Extension.EXTENSION_ID);
    Extension.connectionPort = port;
        
    port.onDisconnect.addListener(function() {
        Extension.connectionPort = null;
    });

    Extension.onMessageHandlers.forEach(function(handler) {
        port.onMessage.addListener(handler);
    })
}

Extension.onMessageHandlers = [];

Extension.onMessage = {
    addListener : function(handler) {
        Extension.onMessageHandlers.push(handler);
        if (Extension.connectionPort) Extension.connectionPort.onMessage.addListener(handler);
    }

}

Extension.checkConnection = function() {
    return Extension.sendMessage({action : 'checkConnection'});
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

    this.isBackgroundPage = false;


    Extension.getOptions();

    if (Extension.isContentScript()) {
        Extension.connect();
        
        this.heartBeatWorker = Utils.Promise.worker(function() {
            return Extension
                .checkConnection()
                .then(function(status) {
                    if (status == false) Extension.connect();
                    return 20000;
                })
                .catch(function(err) {
                    __.error(err);
                    return Promise.resolve(20000);
                })
        });
    }

    
    Extension.onMessage.addListener(function(message) {
        if (message == 'optionsModified') Extension.getOptions();
    })

}


Extension.needRefreshUI = function(account) {
    if (Extension.isContentScript()) {
        Gmail.needRefreshUI();
        return;
    }

    if (Extension.isBackgroundPage) {
        var key = getUserKey(account.url);
       
        Object.values(ports[key] || {}).forEach(function(port) {
            port.postMessage('needRefreshUI');
        });

        return;
    }

    console.warn('needRefreshUI is not implemented!');
}



Extension.init();


window.Appinmail = Extension; // alias

