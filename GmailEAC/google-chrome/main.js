function inject_script(script, remove) {
    if (remove == null) remove = true;

    var injection = document.createElement('script');

    if (script.fileName)
    	injection.src = chrome.runtime.getURL(script.fileName);

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




var send_variables = `
    window.Extension = function() {};
	window.Extension.EXTENSION_URL = '${chrome.runtime.getURL('')}';
`;


inject_script({code : send_variables});

inject_script({fileName : 'js/utils.js'});

inject_script({fileName : 'js/maindb.js'})

inject_script({fileName : 'js/common.js'});

inject_script({fileName : 'js/ajax.js'});


var currentHost = window.location.host.toLowerCase();

if (currentHost === 'mail.google.com') {
    inject_script({fileName : 'js/gmail_api.js'});

    inject_script({fileName : 'js/eac.js'});

    inject_script({fileName : 'js/eac_processing.js'});

    inject_script({fileName : 'js/gmail.js'});
}


if (currentHost === 'outlook.live.com') {
    inject_script({fileName : 'js/outlook.js'});
}


console.log('EAC Plugin started');


// inject_script({fileName : 'injection.js'});

