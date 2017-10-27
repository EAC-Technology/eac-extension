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




function main() {
    if (document.__EAC_Extension_Injected) return;

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


    if (['outlook.live.com', 'outlook.office.com', 'outlook.office365.com'].indexOf(currentHost) > -1) {
        inject_script({fileName : 'js/outlook.js'});
    }


    document.__EAC_Extension_Injected = true;
    console.log('EAC Plugin started');
}



if (!document.__EAC_Extension_Injected) {
    var intervalId = setInterval(function() {
        if (document.head || document.documentElement) {
            main();
            clearInterval(intervalId);            
        }
    }, 200);
}

