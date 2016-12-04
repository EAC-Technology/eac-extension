console.info('background.js imported');


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
var userInfo = {};


function getUserKey(url) {
    var m = /(http.*mail\.google\.com\/mail\/u\/\d+)\D.*/i.exec(url);
    return (m) ? m[1] : 'unknown';
}





var Storage = MainDB.SimpleStorage('background_storage', null, function() {});

Storage.init()
    .then(function() {
        Storage.setDefault(['accounts'], {});
    });






function Actions() {};

Actions.setUnreadCountBadge = function(message, sender) {
    var key = getUserKey(sender.url);
    unreadCounts[key] = message.value;
    
    var count = Object
        .values(unreadCounts)
        .reduce(function(res, x) {
            return res + x;
        }, 0);

    count = (count) ? count.toString() : '';
    chrome.browserAction.setBadgeText({text: count});
    
    return true;
}

Actions.setBadgeText = function(message, sender) {
    chrome.browserAction.setBadgeText(message.value);
    return true;
}

Actions.setUserInfo = function(message, sender) {
    var key = getUserKey(sender.url);
    userInfo[key] = message.value;

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






function onMessage(message, sender, sendResponse) {
    console.info({message : message, sender : sender});

    var action = Actions[message.action] || null;
    var res = action && action(message, sender);

    sendResponse(res);
    return true;
}



chrome.runtime.onMessage.addListener(onMessage);
chrome.runtime.onMessageExternal.addListener(onMessage);



// chrome.browserAction.onClicked.addListener(function(tab) {
//     chrome.browserAction.setPopup({popup : "popup.html"});
// })





