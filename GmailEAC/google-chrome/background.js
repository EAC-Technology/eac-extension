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
		return fix_csp_response_headers(details, 'frame-src', '*.appinmail.io');
	}, 
	
	{
		urls: ['https://mail.google.com/*'], 
		types: ['main_frame'] 
	}, 

	['blocking', 'responseHeaders']
);

