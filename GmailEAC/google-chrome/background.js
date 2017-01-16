__.info('background.js imported');

Extension.isBackgroundPage = true;
// Extension.debug = true;


function fix_csp_response_headers(details, key, value) {
    
    for (var i = 0; i < details.responseHeaders.length; i++) {
        var isCSPHeader = /content-security-policy/i.test(details.responseHeaders[i].name);
        if (isCSPHeader) {
            var csp = details.responseHeaders[i].value;
            csp = csp.replace(key, key + ' ' + value);
            details.responseHeaders[i].value = csp;
        }
    }
    
    return {responseHeaders: details.responseHeaders};
}



chrome.webRequest.onHeadersReceived.addListener(
	function(details) {
		var url = details.url.toLowerCase();
        fix_csp_response_headers(details, 'frame-src', '*.appinmail.io *.appinmail.pw *.appinmail.top');

        return {responseHeaders: details.responseHeaders}
	}, 
	
	{
		urls: ['https://mail.google.com/*'], 
		types: ['main_frame'] 
	}, 

	['blocking', 'responseHeaders']
);




var unreadCounts = {};
var ports = {};
var worker = null;



function getUserKey(url) {
    var m = /(http.*mail\.google\.com\/mail\/u\/\d+)\D.*/i.exec(url);
    return (m) ? m[1] : 'unknown';
}





var Storage = MainDB.SimpleStorage('background_storage', null, function() {});

Storage.init()
    .then(function() {
        Storage.setDefault(['accounts'], {});
        
        Storage.setDefault(['options'], {
            'enable_eac_processing' : true,
            'enable_unread_count' : true,
            'enable_background_checks' : true,
            'enable_move_to_trash' : true,
        });
    })

    .then(function() {
        restartEacProcessing();
    })






function Actions() {};

Actions.setUnreadCount = function(message, sender) {
    var key = getUserKey(message.url);
    unreadCounts[key] = message.value;

    refreshIcon();    
    
    return true;
}

Actions.setBadgeText = function(message, sender) {
    chrome.browserAction.setBadgeText(message.value);
    return true;
}

Actions.saveAccountInfo = function(message, sender) {
    Storage.accounts[message.value.email] = message.value;
    Storage.save();
    return true;
}

Actions.getStats = function(message, sender) {
    var stats = Object
        .values(Storage.accounts)

        .map(function(account) {
            var key = getUserKey(account.url);

            var res = Object.assign({}, account || {});
            res.unreadCount = unreadCounts[key] || '';

            ['userToken', 'actionToken'].forEach(function(key) {
                delete res[key];
            })

            return res;
        })

        .sort(Utils.cmpByKey('url'));

    return stats;
}


Actions.getExtensionOptions = function(message, sender) {
    return Storage.options;
}

Actions.updateExtensionOptions = function(message, sender) {
    Object.assign(Storage.options, message.value);
    
    Extension.sendBroadcastMessage('optionsModified');
    
    Storage.save();

    refreshIcon();
    restartEacProcessing();

    return Storage.options;
}

Actions.checkConnection = function(message, sender) {
    var key = getUserKey(sender.url);
    return Boolean(ports[key] && ports[key][sender.tab.id]);
}





var BackgroundMessaging = (function() {
    var Messaging = function() {};

    var handlers = [];

    Messaging.onMessage = {
        addListener : function(handler) {
            handlers.push(handler);
        }
    }

    Messaging.sendMessage = function(message, sender, sendResponse) {
        handlers.forEach(function(handler) {
            handler(message, sender || {}, sendResponse || function() {});
        })
    }

    return Messaging;

})();





function onMessage(message, sender, sendResponse) {
    __.debug(message, sender);

    var action = Actions[message.action] || null;
    var res = action && action(message, sender);

    sendResponse(res);
    return true;
}


chrome.runtime.onMessage.addListener(onMessage);
chrome.runtime.onMessageExternal.addListener(onMessage);
BackgroundMessaging.onMessage.addListener(onMessage);





function onConnect(port) {
    __.debug('New connection from', port.sender.url);

    var key = getUserKey(port.sender.url);

    if (!(key in ports)) ports[key] = {};
    ports[key][port.sender.tab.id] = port;

    port.onDisconnect.addListener(function() {
        delete ports[key][port.sender.tab.id];
    })
}

chrome.runtime.onConnect.addListener(onConnect);
chrome.runtime.onConnectExternal.addListener(onConnect);






function refreshIcon() {
    var count = '';

    if (Storage.options.enable_eac_processing && Storage.options.enable_unread_count) {
        count = Object
            .values(unreadCounts)
            .reduce(function(res, x) {
                return res + x;
            }, 0);

        count = (count) ? count.toString() : '';
    }

    chrome.browserAction.getBadgeText({}, function(val) {
        if (count != val)
            chrome.browserAction.setBadgeText({text : count});
    })
}



function restartEacProcessing() {
    __.info('Restart EACs Processing');

    Extension.sendBroadcastMessage('restartEacProcessing');

    if (worker) worker.stop();

    if (! Storage.options.enable_eac_processing) {
        __.info('EAC Processing is disabled');
        return;
    }

    if (! Storage.options.enable_background_checks) {
        __.info('Background checks is disabled');
        return;
    }

    worker = Utils.Promise.worker(function() {
        return Extension
            .getOptions()
            
            .then(function() {
                return Utils.Promise
                    .map(function(account) {
                        return (new EACProcessing(account)).run();
                    }, Object.values(Storage.accounts))
            })

            .then(function() {
                return 20000; // 20 sec
            })

            .catch(function(err) {
                __.error(err);
                return Promise.resolve(20000);
            })
    });
}




