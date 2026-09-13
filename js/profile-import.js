/*
 * Turns a browser-saved JanitorAI profile into the pieces the simulator needs.
 * MHTML is preferred because its images and CSS are embedded in the one file.
 * Nothing in this module uploads a file or makes a network request.
 */
(function () {
  'use strict';

  var objectUrls = [];

  function textFromBytes(bytes) {
    try { return new TextDecoder('utf-8').decode(bytes); }
    catch (e) {
      var out = '';
      for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return out;
    }
  }

  function latin1ToText(value) {
    var bytes = new Uint8Array(value.length);
    for (var i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 255;
    return textFromBytes(bytes);
  }

  function headerValue(headers, name) {
    var re = new RegExp('^' + name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + ':\\s*([^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*)', 'im');
    var match = headers.match(re);
    return match ? match[1].replace(/\r?\n[ \t]+/g, ' ').trim() : '';
  }

  function bytesFromQuotedPrintable(value) {
    value = value.replace(/=\r?\n/g, '').replace(/=([0-9a-f]{2})/gi, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
    var bytes = new Uint8Array(value.length);
    for (var i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 255;
    return bytes;
  }

  function bytesFromBase64(value) {
    var decoded = atob(value.replace(/\s/g, ''));
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return bytes;
  }

  function decodePart(value, encoding) {
    encoding = (encoding || '').toLowerCase();
    if (encoding.indexOf('base64') !== -1) return bytesFromBase64(value);
    if (encoding.indexOf('quoted-printable') !== -1) return bytesFromQuotedPrintable(value);
    var bytes = new Uint8Array(value.length);
    for (var i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 255;
    return bytes;
  }

  function parseMhtml(buffer) {
    var raw = new TextDecoder('iso-8859-1').decode(buffer);
    var headerEnd = raw.search(/\r?\n\r?\n/);
    if (headerEnd < 0) throw new Error('This MHTML file has no MIME header.');
    var topHeaders = raw.slice(0, headerEnd);
    var contentType = headerValue(topHeaders, 'content-type');
    var boundaryMatch = contentType.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
    if (!boundaryMatch) throw new Error('This MHTML file has no multipart boundary.');
    var boundary = boundaryMatch[1] || boundaryMatch[2];
    var chunks = raw.slice(headerEnd).split('--' + boundary);
    var parts = [];

    chunks.slice(1).forEach(function (chunk) {
      if (/^--/.test(chunk)) return;
      chunk = chunk.replace(/^\r?\n/, '');
      var split = chunk.search(/\r?\n\r?\n/);
      if (split < 0) return;
      var headers = chunk.slice(0, split);
      var body = chunk.slice(split).replace(/^\r?\n\r?\n/, '').replace(/\r?\n$/, '');
      var type = headerValue(headers, 'content-type').split(';')[0].trim().toLowerCase();
      if (!type) return;
      parts.push({
        type: type,
        location: headerValue(headers, 'content-location'),
        id: headerValue(headers, 'content-id').replace(/^<|>$/g, ''),
        bytes: decodePart(body, headerValue(headers, 'content-transfer-encoding'))
      });
    });

    var htmlPart = parts.filter(function (p) { return p.type === 'text/html'; })[0];
    if (!htmlPart) throw new Error('No HTML profile page was found in this MHTML file.');
    return { html: textFromBytes(htmlPart.bytes), parts: parts };
  }

  function rewriteResources(value, resources) {
    return value.replace(/(?:cid:|https?:\/\/|file:\/\/\/)[^\s"'()<>]+/gi, function (url) {
      return resources[url] || resources[url.replace(/^cid:/i, '')] || url;
    });
  }

  function profileFromDocument(doc, resources, capturedStyles) {
    // MHTML stores stylesheets as separate MIME parts, but MIME part order is
    // not cascade order. Rebuild the cascade from the links/styles in <head>,
    // which is the order the saved page actually rendered them in.
    var importedStyles = [];
    var creatorStyles = [];
    var usedStyles = {};
    var aboutClassNames = {};
    var aboutIds = {};
    var aboutMarkup = (doc.querySelector('.pp-uc-about-me, .profile-about-me') || {}).innerHTML || '';
    aboutMarkup.replace(/class\s*=\s*["']([^"']+)["']/gi, function (_, classes) {
      classes.split(/\s+/).forEach(function (name) {
        if (name && !/^(pp|profile|css|chakra|_)/i.test(name)) aboutClassNames[name] = true;
      });
      return _;
    });
    aboutMarkup.replace(/id\s*=\s*["']([^"']+)["']/gi, function (_, id) {
      if (id && !/^(root|app|profile)/i.test(id)) aboutIds[id] = true;
      return _;
    });
    function isCreatorStylesheet(css) {
      var hasClassRule = Object.keys(aboutClassNames).some(function (name) {
        return new RegExp('\\.' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(css);
      });
      if (hasClassRule) return true;
      return Object.keys(aboutIds).some(function (id) {
        return new RegExp('#' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(css);
      });
    }
    Array.prototype.forEach.call(doc.head ? doc.head.querySelectorAll('style, link[rel~="stylesheet"]') : [], function (node) {
      if (node.tagName === 'STYLE') {
        var inlineCss = rewriteResources(node.textContent || '', resources);
        if (isCreatorStylesheet(inlineCss)) creatorStyles.push(inlineCss);
        else importedStyles.push(inlineCss);
        return;
      }
      var href = node.getAttribute('href') || '';
      var css = capturedStyles[href] || capturedStyles[href.replace(/^cid:/i, '')];
      if (css != null && !usedStyles[href]) {
        if (isCreatorStylesheet(css)) creatorStyles.push(css);
        else importedStyles.push(css);
        usedStyles[href] = true;
      }
    });

    Array.prototype.forEach.call(doc.querySelectorAll('script, noscript, base'), function (node) { node.remove(); });
    // The import is a saved webpage, not executable application code. Keep its
    // visual markup but discard inline event handlers and javascript: URLs.
    Array.prototype.forEach.call(doc.querySelectorAll('*'), function (node) {
      Array.prototype.slice.call(node.attributes || []).forEach(function (attr) {
        if (/^on/i.test(attr.name) ||
            (/^(href|src)$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value))) {
          node.removeAttribute(attr.name);
        }
      });
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[src], [poster], [href], [srcset]'), function (node) {
      ['src', 'poster', 'href', 'srcset'].forEach(function (attr) {
        if (!node.hasAttribute(attr)) return;
        var original = node.getAttribute(attr);
        // MHTML resources become blob: URLs so the private local preview works
        // offline. Keep an image's public address alongside that temporary URL:
        // the Cards detector can safely publish the former, never the latter.
        if (attr === 'src' && node.tagName === 'IMG' && node.closest('.pp-cc-wrapper') &&
            /^(https?:)?\/\//i.test(original || '')) {
          node.setAttribute('data-jai-source-src', original);
        }
        node.setAttribute(attr, rewriteResources(original, resources));
      });
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[style]'), function (node) {
      node.setAttribute('style', rewriteResources(node.getAttribute('style'), resources));
    });

    var root = doc.getElementById('root');
    if (!doc.querySelector('.pp-uc-title, .profile-info-stack, .pp-cc-list-container')) {
      throw new Error('This does not look like a JanitorAI profile page. Save the profile page itself, then try again.');
    }
    var about = doc.querySelector('.pp-uc-about-me, .profile-about-me');
    var aboutMe = about ? about.innerHTML : null;
    if (aboutMe && creatorStyles.length) {
      aboutMe = '<style>\n' + creatorStyles.join('\n') + '\n</style>\n' + aboutMe;
    }
    // About Me is the user's document, not part of the captured site canvas.
    // Keep it in `aboutMe` for the editor, but remove its <style> blocks from
    // the snapshot so toggling custom CSS really can show the base profile.
    if (about) {
      Array.prototype.forEach.call(about.querySelectorAll('style'), function (style) { style.remove(); });
    }
    var content = root ? root.outerHTML : doc.body.innerHTML;
    var title = doc.querySelector('.pp-uc-title');
    var avatar = doc.querySelector('.pp-uc-avatar');
    var followers = doc.querySelector('.pp-uc-followers-count');
    var since = doc.querySelector('.pp-uc-member-since');
    var cards = doc.querySelectorAll('.pp-cc-wrapper').length;
    var total = doc.querySelector('.pp-pg-total-count, .profile-badge-total-count');
    var totalCards = total ? parseInt((total.textContent || '').replace(/[^\d]/g, ''), 10) : 0;

    return {
      html: content,
      css: importedStyles.join('\n'),
      aboutMe: aboutMe,
      data: {
        username: title ? title.textContent.replace(/^\s*@/, '').trim() : null,
        avatar: avatar ? avatar.getAttribute('src') : null,
        followers: followers ? followers.textContent.replace(/followers/i, '').trim() : null,
        memberSince: since ? since.textContent.replace(/^\s*member\s+since\s*/i, '').trim() : null,
        // The first page only contains some cards. The profile's counter is the
        // creator's actual total, so prefer it when choosing the initial preview
        // density; the frame can safely duplicate captured cards if needed.
        cardCount: totalCards || cards || null
      }
    };
  }

  function makeResources(parts, urls) {
    var resources = {};
    var capturedStyles = {};

    // Binary resources first, so url(...) references inside captured CSS can
    // be rewritten to their local object URLs in the second pass.
    parts.forEach(function (part) {
      if (part.type === 'text/html' || part.type === 'text/css') return;
      if (!part.location && !part.id) return;
      var url = URL.createObjectURL(new Blob([part.bytes], { type: part.type || 'application/octet-stream' }));
      urls.push(url);
      if (part.location) resources[part.location] = url;
      if (part.id) resources[part.id] = url;
    });

    parts.forEach(function (part) {
      if (part.type !== 'text/css') return;
      // The preview already loads JanitorAI's font catalogue. Avoid adding the
      // multi-megabyte Google Fonts capture again.
      if (/fonts\.googleapis\.com/i.test(part.location || '')) return;
      var css = rewriteResources(textFromBytes(part.bytes), resources);
      if (part.location) capturedStyles[part.location] = css;
      if (part.id) {
        capturedStyles[part.id] = css;
        capturedStyles['cid:' + part.id] = css;
      }
    });
    return { map: resources, styles: capturedStyles };
  }

  function release() {
    objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    objectUrls = [];
  }

  function releaseSome(urls) {
    if (!urls || !urls.length) return;
    urls.forEach(function (url) { URL.revokeObjectURL(url); });
    objectUrls = objectUrls.filter(function (url) { return urls.indexOf(url) === -1; });
  }

  function read(file) {
    if (!file) return Promise.reject(new Error('Choose a profile file first.'));
    var nextUrls = [];
    return file.arrayBuffer().then(function (buffer) {
      var isMhtml = /\.(mht|mhtml)$/i.test(file.name) || /multipart\/related/i.test(file.type);
      var parsed = isMhtml ? parseMhtml(buffer) : { html: textFromBytes(new Uint8Array(buffer)), parts: [] };
      var resources = makeResources(parsed.parts, nextUrls);
      var doc = new DOMParser().parseFromString(parsed.html, 'text/html');
      var profile = profileFromDocument(doc, resources.map, resources.styles);
      objectUrls = objectUrls.concat(nextUrls);
      profile.release = function () { releaseSome(nextUrls); };
      return profile;
    }).catch(function (error) {
      nextUrls.forEach(function (url) { URL.revokeObjectURL(url); });
      throw error;
    });
  }

  window.JaiProfileImport = { read: read, release: release };
})();
