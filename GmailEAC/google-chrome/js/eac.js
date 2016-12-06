var EAC = (function() {
    function EAC(content) {
        this.sourceContent = content;
        
        this.messageId = null;
        this.ts = null;
        
        this.eacToken = EAC.parseEacToken(content);
        this.eacMethod = EAC.parseEacMethod(content);
        this.eacViewerUrl = EAC.parseEacviewerUrl(content);

        this.serialize = function() {
            return EAC.serialize(this);
        }
    };


    EAC.isEacMessage = function (content) {
        if (!content) return null;

        var m = content.match(/Content-Type:\s+text\/wholexml/gi);
        if (!m || m.length < 1) return false;
        return Boolean(EAC.parseEacToken(content));
        // return Boolean(EAC.parseEacToken(content) && EAC.parseEacMethod(content));
    }


    EAC.parseEacviewerUrl = function parseEacviewerUrl(content) {
        if (!content) return null;

        // RFC 1341 (MIME)
        // var text = content.replace(/=(?:\r\n|\n\r)/g, '').replace(/=([0-9A-F]{2})/g, function(x, p) {
            // return String.fromCharCode(parseInt(p, 16));
        // });

        var text = content;
        
        // RFC 3986 (URL)
        var unreserved  = `a-zA-Z0-9-._~`;
        var sub_delims  = `!\$&'()*+,;=`;
        var pchar = `${unreserved}%${sub_delims}:@`;
        var query = `${pchar}\\/\\?`;

        var link = `(https?:\\/\\/a[a-z]+\\.appinmail\\.(io|pw|top)\\/u[rl]{0,2}\\?k[ey]{0,2}\\=[${query}]+)`;
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

        var atMarker = 'https://at.';
        if (url.toLowerCase().startsWith(atMarker)) {
            url = 'https://admin.' + url.slice(11);
        }

        return url;
        
    }

    
    EAC.parseEacToken = function parseEacToken(content) {
        if (!content) return null;

        var re = /EAC-Token:\s+(\S+)/gi;
        var m = re.exec(content);
        return (m && m.length > 0) ? m[1] : '';
    }

    EAC.parseEacMethod = function parseEacMethod(content) {
        var re = /EAC-Method:\s+(\S+)/gi;
        var m = re.exec(content);
        return (m && m.length > 0) ? m[1] : '';
    }

    EAC.parse = function(content) {
        if (EAC.isEacMessage(content)) 
            return new EAC(content);
        return null;
    }

    EAC.serialize = function(eac) {
        var obj = Object.assign({}, eac);

        ['sourceContent', 'serialize', 'processEacMethod'].forEach(function(key) {
            delete obj[key];
        });

        return obj;
    }

    EAC.deserialize = function(obj) {
        var eac = new EAC();
        
        Object.keys(obj).forEach(function(key) {
            eac[key] = obj[key];
        })

        return eac;
    }
   

    return EAC;    

})();
