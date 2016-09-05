//
//  VkTool utils
//
function __() {};

__.$ = function __$(selector, elem) {
    elem = elem || document;
    return Array.prototype.slice.apply(elem.querySelectorAll(selector));
}

__.$contains = function __$contains(selector1, selector2, elem) {
    var elems = __.$(selector1, elem);
    var result = [];
    for(var i in elems) {
        var elem = elems[i];
        var check = VT.$(selector2, elem);
        if(check.length) result.push(elem);
    }
    return result;
}


__.logger = function(level, args) {
    var args = Array.prototype.slice.call(args);
    args.unshift('--- [Gmail EAC Plugin] -');
    level.apply(console, args);
}

__.info = function __debug() {
    __.logger(console.info, arguments);
}

__.debug = function() {
    __.logger(console.warn, arguments);
}

__.error = function() {
    __.logger(console.error, arguments);
}




// VT.runtimeSendMessage = chrome.runtime && chrome.runtime.sendMessage ? chrome.runtime.sendMessage : chrome.extension.sendRequest;

// VT.sendMessage = function(data, sendResponse) {
    // VT.runtimeSendMessage('cejbhhnockfoghpphcdklbidfceeiehk', data, sendResponse);
// }



function Gmail() {}


Gmail.get = function(url, callback, self) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);

    if (!self) self = this;

    xhr.onload = function() {
        __.debug('Gmail XHR GET', url, 'success')
        if (callback) {
            callback.call(self, xhr.response);
        }
    }

    xhr.onerror = function() {
        __.error('Gmail XHR GET', url, 'error')
    }

    __.debug('Gmail XHR GET', url, 'start');
    xhr.send();
}



Gmail.feeds = {};

Gmail.parseFeedResponse = function(resp) {
    var data = JSON.parse(resp.slice(5));
    
    data = data[0].filter(function(x) {
        return x[0] == 'tb'
    });

    var messages = data.reduce(function(arr, x) {
        return arr.concat(x[2]);
    }, []);

    __.debug('Gmail Feed Messages:\n', messages);
    return messages;
}

Gmail.updateFeed = function() {
    __.debug('Update Gmail Feed');

    var d = this.currentDirectory();
    
    if (!this.feeds.hasOwnProperty(d))
        this.feeds[d] = {};

    var start = (this.currentPage()-1) * this.messagesPerPage();
    var query = `?ui=2&ik=${this.userToken()}&view=tl&start=${start}&num=${this.messagesPerPage()}&rt=j&search=${d}`

    var url = this.absUrl(query);
    
    this.get(url, function(resp) {
        var messages = this.parseFeedResponse(resp);
        
        messages.forEach(function(x) {
            Gmail.feeds[d][x[0]] = x;
        })
    });
}



Gmail.userEmail = function() {
    return GLOBALS[10];
}

Gmail.userToken = function() {
    return GLOBALS[9];
}

Gmail.userUrl = function() {
    return GLOBALS[31];
}

Gmail.absUrl = function(query) {
    return `${this.userUrl()}${query}`
}

Gmail.messagesPerPage = function() {
    return GLOBALS[8];
}




Gmail.currentDirectory = function() {
    var parts = window.location.hash.split('/');
    if (parts.length == 1) return parts[0].slice(1);
    return parts.slice(0, -1).join('/').slice(1);
}

Gmail.currentPage = function() {
    var parts = window.location.hash.split('/');
    if (parts.length < 2) return 1;
    
    var page = parts[parts.length-1];
    if (page[0] == 'p') return page.slice(1);

    return 1;
}



Gmail.messageId = function() {
    var parts = window.location.hash.split('/');
    if (parts.length < 2) return '';
    
    var id = parts[parts.length-1];
    if (id[0] == 'p') return '';

    return id;
}

Gmail.originalMessageId = function() {
    var id = this.messageId();
    
    var d = this.feeds[this.currentDirectory()];
    if (!d) return id;

    var message = d[id];
    if (!message) return id;

    return message[2];
}

Gmail.messageUrl = function() {
    var id = this.originalMessageId();
    if (!id) return '';
    return this.absUrl(`?ui=2&view=om&ik=${this.userToken()}&th=${id}`)
}

Gmail.getMessageContent = function(callback) {
    var url = this.messageUrl();
    __.debug('Get Message Content', this.messageId(), url, 'start');

    if (!url) return callback('');
    this.get(url, callback);
}

Gmail.isEacViewerInserted = function() {
    return __.$('#appinmail-eac-viewer').length > 0;
}


Gmail.insertEacViewer = function(url) {
    __.info('Insert EAC Viewer into message content');

    if (Gmail.isEacViewerInserted()) {
        __.debug('EAC Viewer has inserted');
        return;
    }

    var listitem = __.$('div[role="listitem"]')[0]
    var message = __.$('div.adn', listitem[0])

    var gmailContent = message[0].childNodes[1].childNodes[6];
    __.debug('Gmail Message Content Element: ', gmailContent);

    var eacviewer = document.createElement('div');
    eacviewer.id = 'appinmail-eac-viewer';
    eacviewer.innerHTML = `<iframe width=100% height=600px src="${url}"></iframe>`;

    gmailContent.parentElement.insertBefore(eacviewer, gmailContent);
    return gmailContent;
}




Gmail.splitMultiparts = function(content) {
    var m = content.match(/Content-Type: multipart\/mixed; boundary=(.+\S)/gi);
    if (!m) return [];

    var boundary = m[0].match(/boundary=(.+\S)/i)[1];

    content = content.split(`--${boundary}--`, 1)[0]
    var res = content.split(`--${boundary}`);

    res = res.map(function(x) {
        return x.trim();
    });
    
    return res;
}








Gmail.onHashChanged = function() {
    Gmail.updateFeed();

    __.info('Gmail url changed!')
    __.debug('Detected Message ID:', Gmail.messageId());

    if (Gmail.messageId()) {
        Gmail.getMessageContent(function(resp) {
            __.debug('Message Source Content:\n\n', resp);

            if (!EAC.isEacMessage(resp)) {
                __.debug('It is not EAC message!')
                return;
            }

            __.info('EAC content detected !!!!!!!!!!!!!!!!!!!!!!!!!');

            var url = EAC.parseEacviewerUrl(resp);
            __.debug('EAC Viewer URL:', url);

            Gmail.insertEacViewer(url);
        });
    }
}


Gmail.updateFeed();

window.addEventListener("hashchange", Gmail.onHashChanged);

setTimeout(Gmail.onHashChanged, 3000);








function EAC() {};


EAC.isEacMessage = function(content) {
    var m = content.match(/Content-Type:\s+text\/wholexml/gi);
    return m && m.length > 0;
}


EAC.parseEacXml = function(content) {
    var parts = Gmail.splitMultiparts(content).filter(function(x) {
        return EAC.isEacMessage(x);
    });

    if (parts.length == 0) return '';

    var data = parts[0].split('\n\r', 2)[1];
    var xml = atob(data);

    var parser = new DOMParser();
    var dom = parser.parseFromString(xml, 'text/xml');

    return dom.childNodes[0];
}


EAC.parseEacviewerUrl = function(content) {
    // RFC 1341 (MIME)
    var text = content.replace(/=(?:\r\n|\n\r)/g, '').replace(/=([0-9A-F]{2})/g, function(x, p) {
        return String.fromCharCode(parseInt(p, 16));
    });

    // RFC 3986 (URL)
    var unreserved  = `a-zA-Z0-9-._~`;
    var sub_delims  = `!\$&'()*+,;=`;
    var pchar = `${unreserved}%${sub_delims}:@`;
    var query = `${pchar}\\/\\?`;

    // var link = `(https?:\\/\\/promail-pis\\d+\\.appinmail\\.[a-zA-Z]+\\/eacviewer\\?[${query}]+)`;
    var link = `(https?:\\/\\/a[a-z]+\\.appinmail\\.io\\/u[rl]{0,2}\\?k[ey]{0,2}\\=[${query}]+)`;
    var linkRe = RegExp(link, 'gi');
    
    var m = text.match(linkRe);
    return m ? m[0] : '';
}


EAC.xmlFilter = function(xml, lambda) {
    function deep(node) {
        if (lambda(node)) return node;

        var res = null;

        for (var i in node.childNodes) {
            res = deep(node.childNodes[i]);
            if (res) break;
        }

        return res;
    }

    return deep(xml);
}


EAC.generateUrl = function(xml) {
    if (!xml) return '';

    function find(dom, tag) {
        tag = tag.toLowerCase();

        return EAC.xmlFilter(dom, function(x) {
            return x.tagName && x.tagName.toLowerCase() == tag;
        });
    }

    function attr(dom, key) {
        key = key.toLowerCase();

        attributes = Array.prototype.slice.apply(dom.attributes);

        var res = attributes.filter(function(x) {
            return x.name.toLowerCase() == key;
        });

        return res.length ? res[0].value : null;
    }

    var api = find(xml, 'api');
    var login = find(api, 'login');
    var get = find(api, 'get');
    var post = find(api, 'post');

    var pattern = find(get, 'pattern')

    var host = api['server'];

    var query = {
        'eac_token'         : '123',
        'session_token'     : '',

        'server'            : attr(api, 'server'),
        'app_id'            : attr(api, 'appId'),
        'email'             : Gmail.userEmail(),

        'login_action'      : attr(login, 'action'),
        'login_container'   : attr(login, 'container'),
        
        'get_action'        : attr(get, 'action'),
        'get_container'     : attr(get, 'container'),
        
        'post_action'       : attr(post, 'action'),
        'post_container'    : attr(post, 'container'),

        'pattern'           : escape(pattern.textContent.trim())
    }

    var eacviewerUrl = `https://${query.server}/eacviewer`;

    var args = [];
    for (var key in query)
        args.push(`${key}=${query[key]}`)

    query = args.join('&');

    var url = `${eacviewerUrl}?${query}`;

    console.log(url)
}



// (function(content) {
//     // RFC 1341 (MIME)
//     var text = content.replace(/=(?:\r\n|\n\r)/g, '').replace(/=([0-9A-F]{2})/g, function(x, p) {
//         return String.fromCharCode(parseInt(p, 16));
//     });

//     // RFC 3986 (URL)
//     var unreserved  = `a-zA-Z0-9-._~`;
//     var sub_delims  = `!\$&'()*+,;=`;
//     var pchar = `${unreserved}%${sub_delims}:@`;
//     var query = `${pchar}\\/\\?`;

//     var link = `(https?:\\/\\/promail-pis\\d+\\.appinmail\\.[a-zA-Z]+\\/eacviewer\\?[${query}]+)`;
//     var linkRe = RegExp(link, 'gi');
    
//     var m = text.match(linkRe); 
//     return m ? m[1] : '';

// })(s)











// def get_eacviewer_url(self, host, email):
//         param = urllib.urlencode({
//             'eac_token': self.eac_token,
//             'session_token': self.session_token,
//             'pattern': self.get_data
//         })

//         protocol = 'http'
//         if '://' in host:
//             protocol, host = host.split('://', 1)

//         return urlparse.urlunparse((protocol, host, '/eacviewer', '', param, ''))









// (function() {
//     var url = "https://mail.google.com/mail/u/0/?ui=2&view=om&ik=e9a80ab15e&th=154dc9e911ec7ac4&_r=" + Math.random();
//     console.log(url);

//     var xhr = new XMLHttpRequest();
//     xhr.open('GET', url, true);

//     // xhr.onreadystatechange = function(e) {
//     //     if (xhr.readyStatus != 4) return;
//     //     console.log(xhr.response);
//     //     // console.log('---------------------------------------------------');
//     //     // console.log(e.target.responseText);
//     //     // console.log(xhr.responseText);
//     //     // xhr.abort()

//     // }

//     // xhr.onerror = function() {
//     //     console.log('error')
//     // }

//     xhr.onload = function() {
//         console.log(xhr.response)
//     }

//     xhr.send();

// })()



// XMLHttpRequest.prototype.__tmp_open = XMLHttpRequest.prototype.open;

// XMLHttpRequest.prototype.open = function() {
//     console.log('XHR open', this);
//     XMLHttpRequest.prototype.__tmp_open.apply(this, arguments);
// }


// https://mail.google.com/mail/u/0/?ui=2&ik=e9a80ab15e&view=tl&start=0&num=1&rt=c&search=inbox

__.info('injection - ok');
