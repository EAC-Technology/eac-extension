
function inject_script(script, remove, callback) {
    if (remove == null) remove = true;

    var injection = document.createElement('script');

    if (script.fileName)
    	injection.src = chrome.runtime.getURL(script.fileName);

    else if (script.code)
    	injection.innerText = script.code;

    else 
    	return;

    injection.onload = function() {
        if (remove)
            this.parentNode.removeChild(this);

        if (callback)
            callback();
    };

    (document.head || document.documentElement).appendChild(injection);
}




function inject_all_files(files) {
    function next() {
        if (!files.length) return;
        var file = files.shift();
        inject_script({fileName: file}, true, next);
    }

    next();
}




function main() {
    if (document.__EAC_Extension_Injected) return;

    var send_variables = `
        window.Extension = function() {};
        window.Extension.EXTENSION_URL = '${chrome.runtime.getURL('')}';
    `;

    inject_script({code: send_variables});


    var requirements = [
        'js/utils.js',
        'js/maindb.js',
        'js/common.js',
        'js/ajax.js',
        'js/eac.js'
    ];


    var currentHost = window.location.host.toLowerCase();

    if (currentHost === 'mail.google.com') {
        requirements = requirements.concat([
            'js/gmail_api.js',
            'js/eac_processing.js',
            'js/gmail.js'
        ]);
    }


    if (['outlook.live.com', 'outlook.office.com', 'outlook.office365.com'].indexOf(currentHost) > -1) {
        requirements = requirements.concat([
            'js/outlook.js'
        ]);
    }


    inject_all_files(requirements);

    console.log('EAC Plugin started');

    document.__EAC_Extension_Injected = true;
}



if (!document.__EAC_Extension_Injected) {
    var intervalId = setInterval(function() {
        if (document.head || document.documentElement) {
            main();
            clearInterval(intervalId);            
        }
    }, 200);
}

