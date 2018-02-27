var EAC = (function() {

    function parseSMTPHeader(content, key) {
        if (!content) return null;
        var re = RegExp(`${key}:\\s+(\\S+)`, 'gi');
        var m = re.exec(content);
        return (m && m.length && m[1]) || null;
    }

    function EAC(content) {
        this.sourceContent = content;
        
        this.messageId = null;
        this.ts = null;
        
        this.rawRecipients = EAC.parseRecipients(content);
        this.recipients = this.rawRecipients;

        if (window.Gmail && Gmail.normalizeEmailAddress)
            this.recipients = this.rawRecipients.map(Gmail.normalizeEmailAddress);
        
        this.eacToken = EAC.parseEacToken(content);
        this.eacMethod = EAC.parseEacMethod(content);
        this.eacViewerUrl = EAC.parseEacviewerUrl(content);

        this.eacWholeXml = EAC.parseWholeXml(content);


        this.serialize = function() {
            return EAC.serialize(this);
        }


        this.checkRecipient = function(email) {
            if (this.recipients === null) return true;
            
            return this.recipients.some(function(x) {
                return x == email;
            })
        }


        this.pushToEacViewer = function(eacviewerUrl, userEmail) {
            var self = this;

            eacviewerUrl = eacviewerUrl || 'https://eacviewer.appinmail.io';
            if (eacviewerUrl.endsWith('/')) eacviewerUrl = eacviewerUrl.slice(0, -1);

            userEmail = userEmail || self.rawRecipients[0];

            var pushUrl = eacviewerUrl + '/push_wholexml';

            return ajax
                .post(pushUrl, {'wholexml' : this.eacWholeXml}, true)

                .then(function(resp) {
                    var data = JSON.parse(resp);

                    if (data[0] !== 'success') {
                        throw(data[1]);
                    }

                    var params = data[1];

                    params['eac_token'] = self.eacToken;
                    params['email'] = userEmail;

                    return eacviewerUrl + '/eacviewer?' + ajax.urlencodeParams(params);
                });
        }


        this.getEacViewerUrl = function() {
            var self = this;

            var eacXmlSize = (self.eacWholeXml || '').length || 0;

            var urlFromHeader = parseSMTPHeader(self.sourceContent, 'EAC-URL');
            if (urlFromHeader && eacXmlSize < 30000)
                return Promise.resolve(urlFromHeader);

            return self
                .pushToEacViewer()
                .then(function(url) {
                    return url;
                })
                .catch(function() {
                    return EAC.parseEacviewerUrl(self.sourceContent);
                })
        }


    };


    EAC.isEacMessage = function (content) {
        if (!content) return null;

        var m = content.match(/Content-Type:\s+text\/wholexml/gi);
        if (!m || m.length < 1) return false;
        return Boolean(EAC.parseEacToken(content));
        // return Boolean(EAC.parseEacToken(content) && EAC.parseEacMethod(content));
    }


    EAC.parseRecipients = function(content) {
        if (!content) return null;

        var re = /^To: (.*)$/gmi;
        var lines = [];
        
        while (true) {
            var res = re.exec(content);
            if (res == null) break;
            lines.push(res[1]);
        }

        var emails = lines
            .map(function(l) {
                return l.replace(/".*"/, '').split(',');
            })

            .reduce(function(res, arr) {
                return res.concat(arr);
            }, [])

            .map(function(s) {
                var m1 = /<(.+@.+)>/i.exec(s);
                if (m1 !== null) return m1[1].trim();

                var m2 = /(\S+@\S+)/i.exec(s);
                if (m2 !== null) return m2[1].trim();

                return null;
            })

            .filter(function(x) {
                return Boolean(x);
            })

        return emails;
    }



    EAC.parseEacviewerUrl = function parseEacviewerUrl(content) {
        if (!content) return null;

        var url = parseSMTPHeader(content, 'EAC-URL')
        if (url) return url;

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
        return parseSMTPHeader(content, 'EAC-Token') || '';
    }

    EAC.parseEacMethod = function parseEacMethod(content) {
        return parseSMTPHeader(content, 'EAC-Method') || '';
    }


    EAC.parseWholeXml = function(content) {
        // split multiparts
        var m = content.match(/Content-Type: multipart\/(?:mixed|related);\s*boundary=(.+\S)/gi);
        if (!m) return '';

        var boundary = m[0].match(/boundary="(.+\S)"/i)[1];

        var multiparts = content
            .split(`--${boundary}--`, 1)[0]
            .split(`--${boundary}`)
            .map(function(x) {
                return x.trim();
            });

        // find WholXml part
        var wholexmlPart = multiparts
            .filter(function(part) {
                return /Content-Type:\s+text\/wholexml/gi.test(part);
            })[0];

        if (!wholexmlPart) return '';

        // skip headers
        var b64content = wholexmlPart
            .split('\n')

            .reduce(function(res, l) {
                if (res[0]) {
                    res.push(l);
                    return res;
                }

                if (l.trim() === '')
                    return [true]

                return [false]
            }, [false])

            .slice(1)

            .join('\n')

        // try to decode file content
        try {
            return atob(b64content);
        }
        catch(err) {
            return b64content;
        }
    }







    EAC.parse = function(content) {
        if (EAC.isEacMessage(content)) 
            return new EAC(content);
        return null;
    }

    EAC.serialize = function(eac) {
        var obj = Object.assign({}, eac);

        [
            'sourceContent',
            'serialize',
            'processEacMethod',
            'checkRecipient',
            'eacWholeXml',
            'pushToEacViewer',
            'getEacViewerUrl'

        ].forEach(function(key) {
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
