
// console.log(chrome)

// chrome.webRequest.onHeadersReceived.addListener(function(details) {
//     console.log(details);
// }, {
//   urls: ['https://mail.google.com/*'],
//   types: ['main_frame']
// }, ['blocking', 'responseHeaders']);




// var hosts = 'https://ya.ru/';
var iframeHosts = '*.appinmail.io';
// iframeHosts = '*'


chrome.webRequest.onHeadersReceived.addListener(function(details) {
    for (var i = 0; i < details.responseHeaders.length; i++) {
        var isCSPHeader = /content-security-policy/i.test(details.responseHeaders[i].name);
        if (isCSPHeader) {
            var csp = details.responseHeaders[i].value;
            // csp = csp.replace('script-src', 'script-src ' + hosts);
            // csp = csp.replace('style-src', 'style-src ' + hosts);
            csp = csp.replace('frame-src', 'frame-src ' + iframeHosts);
            details.responseHeaders[i].value = csp;
        }
    }

    return {
        responseHeaders: details.responseHeaders
    };
}, { urls: ['https://mail.google.com/*'], types: ['main_frame'] }, ['blocking', 'responseHeaders']);













// function getImageSizeSync(url) {
//     var xhr = new XMLHttpRequest();
//     xhr.open('GET', url, false);
//     xhr.send(null);

//     if (xhr.readyState === 4 && xhr.status == 200 ) {
//         return xhr.getResponseHeader('Content-Length');
//     }

//     return null;
// }



// function getImageSizeAsync(url, callback) {
//     var xhr = new XMLHttpRequest();
//     xhr.open('GET', url, true);

//     xhr.onreadystatechange = function() {
//         if (xhr.readyState === 4 && xhr.status == 200 ) {
//             callback(xhr.getResponseHeader('Content-Length'));
//         }
//     }
    
//     xhr.send(null);
// }





// var onMessage = chrome.runtime && chrome.runtime.onMessage ? chrome.runtime.onMessage : chrome.extension.onRequest;
// var onMessageExternal = chrome.runtime && chrome.runtime.onMessageExternal ? chrome.runtime.onMessageExternal : chrome.extension.onRequestExternal;


// onMessageExternal.addListener(function(request, sender, sendResponse) {
//     if (request.type == 'GET_IMAGE_SIZE' && request.url) {
//         // var size = getImageSizeSync(request.url);
//         // sendResponse({url : request.url, size : size });
//         // return;

//         getImageSizeAsync(request.url, function(size) {
//             sendResponse.call(self, {url : request.url, size : size });
//         })

//         return true;
//     }
// });

