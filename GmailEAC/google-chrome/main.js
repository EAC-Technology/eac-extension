function inject_script(script, remove) {
    if (remove == null) remove = true;

    var injection = document.createElement('script');

    if (script.fileName)
    	injection.src = chrome.extension.getURL(script.fileName);

    else if (script.code)
    	injection.innerText = script.code;

    else 
    	return;

    if( remove ) {
        injection.onload = function() {
            this.parentNode.removeChild(this);
        }
    }

    (document.head || document.documentElement).appendChild(injection);
}



var Appinmail = {};
Appinmail.logoUrl = chrome.extension.getURL('icons/logo_16.png');


var send_variables = `
	window.Appinmail = ${JSON.stringify(Appinmail)};
`;

inject_script({code : send_variables});


inject_script({fileName : 'injection.js'});
