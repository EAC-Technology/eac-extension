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
    args.unshift('--- [EAC Plugin] -');
    level.apply(console, args);
}

__.info = function __debug() {
    __.logger(console.info, arguments);
}

__.debug = function() {
    Appinmail 
        && Appinmail.debug
        && __.logger(console.warn, arguments);
}

__.error = function() {
    __.logger(console.error, arguments);
}




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
    if (d[0] == 'imp') d = ['is', 'important'];
    if (/p\d+/.test(d.slice(-1)[0])) d = d.slice(0, -1); 
    if (d.length < 2) d.unshift('in');
    if (d[0] == 'search') d.shift();

    var q = d.join('%3A');
    
    if (!this.feeds.hasOwnProperty(d))
        this.feeds[d] = {};

    var start = (this.currentPage()-1) * this.messagesPerPage();
    var query = `?ui=2&ik=${this.userToken()}&at=${this.actionToken()}&view=tl&start=${start}&num=${this.messagesPerPage()}&rt=j&search=query&q=${q}`
    
    var url = this.absUrl(query);
    
    this.get(url, function(resp) {
        var messages = this.parseFeedResponse(resp);
        
        messages.forEach(function(x) {
            Gmail.feeds[d][x[0]] = x;
        })
    });
}


Gmail.actionToken = function() {
    return GM_ACTION_TOKEN;
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
    return `${this.userUrl()}${query}`;
}

Gmail.messagesPerPage = function() {
    return GLOBALS[8];
}




Gmail.currentDirectory = function() {
    return window.location.hash.slice(1).split('/');
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
    return this.absUrl(`?ui=2&view=om&ik=${this.userToken()}&th=${id}`);
    // return this.absUrl(`?view=att&th=${id}&attid=0&disp=comp&safe=1&zw`);
}

Gmail.getMessageContent = function(callback) {
    var url = this.messageUrl();
    __.debug('Get Message Content', this.messageId(), url, 'start');

    var CONTENT_START = '<pre class="raw_message_text" id="raw_message_text">';
    var REPLACEMENTS = {
        '&amp;'     :   '&',
        '&gt;'      :   '>',
        '&lt;'      :   '<',
        '&quot;'    :   '"',
        '&#39;'     :   "'"
    };

    if (!url) return callback('');
    this.get(url, function(content) {
        var i = content.indexOf(CONTENT_START) + CONTENT_START.length;
        var j = content.indexOf('</pre>', i);
        content = content.slice(i, j);

        content = content.replace(/(&amp;|&gt;|&lt;|&quot;|&#39;)/gi, function(x) {
            return REPLACEMENTS[x];
        });

        callback(content);
    });
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
    eacviewer.innerHTML = `
        <div style="font-size: 10pt">
            <a href="http://appinmail.io/" target="_blank" style="text-decoration: none">
                <img src="${Appinmail.logoUrl}" alt="Appinmail"/>
                <span style="vertical-align: super; color: #9ca0a7;">Powered by EAC technology</span>
            </a>
        </div>
        <iframe width=100% height=800px frameBorder="0px" src="${url}"></iframe>
    `;

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

            __.info('EAC content detected!');

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
    // var text = content.replace(/=(?:\r\n|\n\r)/g, '').replace(/=([0-9A-F]{2})/g, function(x, p) {
        // return String.fromCharCode(parseInt(p, 16));
    // });

    var text = content
;
    // RFC 3986 (URL)
    var unreserved  = `a-zA-Z0-9-._~`;
    var sub_delims  = `!\$&'()*+,;=`;
    var pchar = `${unreserved}%${sub_delims}:@`;
    var query = `${pchar}\\/\\?`;

    var link = `(https?:\\/\\/a[a-z]+\\.appinmail\\.io\\/u[rl]{0,2}\\?k[ey]{0,2}\\=[${query}]+)`;
    var linkRe = RegExp(link, 'gi');
        
    var m = text.match(linkRe);
    if (!m) return '';

    var url = m[0];

    // check url
    var parts = url.split('=');
    var key = (parts.length > 1) ? parts[1] : null;
    if (!key) return url;

    if (key.startsWith('3D') && key.length == 9)
        return [parts[0], key.slice(2)].join('=');

    return url;
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
        'eac_token'         : '',
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
}




__.info('injection - ok');
