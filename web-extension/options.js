var version = document.getElementById('version');
if (version) version.innerText = chrome.runtime.getManifest().version_name;

var version = document.getElementById('name');
if (version) version.innerText = chrome.runtime.getManifest().name;




function toggleCheckboxes() {
    var disableStatus = $('[option-id="enable_eac_processing"]').checked == false;

    $$('input[type=checkbox][class=option]').forEach(function(cb) {
        if (cb.attributes['option-id'].value == 'enable_eac_processing') return;
        cb.disabled = disableStatus;
    })
}



Extension
    .getOptions()

    .then(function(options) {
        options = options || {};
        Object.keys(options).forEach(function(key) {
            var checkbox = $(`input[type=checkbox][option-id=${key}`);
            if (!checkbox) return;

            checkbox.checked = options[key];
        })
    })

    .then(toggleCheckboxes);



$$('input[type=checkbox][class=option]').forEach(function(el) {
    var key = el.attributes['option-id'].value;

    var update = {};
    update[key] = undefined;

    el.addEventListener('click', function() {
        update[key] = el.checked;
        Extension.setOptions(update);
    });
});




var enabler = $('[option-id="enable_eac_processing"]');
if (enabler)    enabler.onchange = toggleCheckboxes;




var PERMISSIONS = {
    'gmail' : {
        permissions : {
            origins : [
                "*://mail.google.com/*"
            ]
        },

        content_script : {
            id : 'gmailContentScript',

            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: {
                        hostEquals: 'mail.google.com'
                    }
                })
            ],

            actions: [
                new chrome.declarativeContent.RequestContentScript({
                    js : ['main.js']
                })
            ]

        }
    },

    'outlook' : {
        permissions : {
            origins : [
                "*://outlook.live.com/*",
                "*://outlook.office.com/*",
                "*://outlook.office365.com/*"
            ]
        },

        content_script : {
            id : 'outlookContentScript',

            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: {
                        hostEquals: 'outlook.live.com'
                    }
                }),

                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: {
                        hostEquals: 'outlook.office.com'
                    }
                }),

                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: {
                        hostEquals: 'outlook.office365.com'
                    }
                })
            ],

            actions: [
                new chrome.declarativeContent.RequestContentScript({
                    js : ['main.js']
                })
            ]

        }
    }
}




$$('input[type=checkbox][class=permission]').forEach(function(el) {
    var key = el.attributes['permission-id'].value;

    if (!PERMISSIONS[key]) {
        el.disabled = true;
        return;
    }

    var permissions = PERMISSIONS[key].permissions;
    var content_script = PERMISSIONS[key].content_script;


    chrome.permissions.contains(permissions, granted => {
        chrome.declarativeContent.onPageChanged.getRules([content_script.id], rules => {
            el.checked = granted && (rules.length > 0);
        })
    })


    el.addEventListener('click', function() {
        if (el.checked) {
            chrome.permissions.request(permissions, granted => {
                if (granted) {
                    chrome.declarativeContent.onPageChanged.addRules([content_script], rules => {
                        el.checked = granted && (rules.length > 0);
                    });

                    Extension.sendMessage({action : 'restartCSPProcessing'});
                }
            });
        }
        else {
            chrome.permissions.remove(permissions, removed => {
                chrome.declarativeContent.onPageChanged.removeRules([content_script.id], () => {
                    chrome.declarativeContent.onPageChanged.getRules([content_script.id], rules => {
                        el.checked = !removed || (rules.length > 0);
                    });
                });
            });
        }
    });
});
