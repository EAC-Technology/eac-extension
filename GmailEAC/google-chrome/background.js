var iframeHosts = '*.appinmail.io';

chrome.webRequest.onHeadersReceived.addListener(function(details) {
    for (var i = 0; i < details.responseHeaders.length; i++) {
        var isCSPHeader = /content-security-policy/i.test(details.responseHeaders[i].name);
        if (isCSPHeader) {
            var csp = details.responseHeaders[i].value;
            csp = csp.replace('frame-src', 'frame-src ' + iframeHosts);
            details.responseHeaders[i].value = csp;
        }
    }

    return {responseHeaders: details.responseHeaders};

}, { urls: ['https://mail.google.com/*'], types: ['main_frame'] }, ['blocking', 'responseHeaders']);

