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

  function profileFromDocument(doc, resources, importedCss) {
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
        if (node.hasAttribute(attr)) node.setAttribute(attr, rewriteResources(node.getAttribute(attr), resources));
      });
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[style]'), function (node) {
      node.setAttribute('style', rewriteResources(node.getAttribute('style'), resources));
    });

    var importedStyles = [];
    Array.prototype.forEach.call(doc.head ? doc.head.querySelectorAll('style') : [], function (style) {
      importedStyles.push(rewriteResources(style.textContent || '', resources));
    });
    if (importedCss) importedStyles.push(importedCss);

    var root = doc.getElementById('root');
    if (!doc.querySelector('.pp-uc-title, .profile-info-stack, .pp-cc-list-container')) {
      throw new Error('This does not look like a JanitorAI profile page. Save the profile page itself, then try again.');
    }
    var content = root ? root.outerHTML : doc.body.innerHTML;
    var about = doc.querySelector('.pp-uc-about-me, .profile-about-me');
    var title = doc.querySelector('.pp-uc-title');
    var avatar = doc.querySelector('.pp-uc-avatar');
    var followers = doc.querySelector('.pp-uc-followers-count');
    var since = doc.querySelector('.pp-uc-member-since');
    var cards = doc.querySelectorAll('.pp-cc-wrapper').length;

    return {
      html: content,
      css: importedStyles.join('\n'),
      aboutMe: about ? about.innerHTML : null,
      data: {
        username: title ? title.textContent.replace(/^\s*@/, '').trim() : null,
        avatar: avatar ? avatar.getAttribute('src') : null,
        followers: followers ? followers.textContent.replace(/followers/i, '').trim() : null,
        memberSince: since ? since.textContent.replace(/^\s*member\s+since\s*/i, '').trim() : null,
        cardCount: cards || null
      }
    };
  }

  function makeResources(parts, urls) {
    var resources = {};
    var css = [];
    parts.forEach(function (part) {
      if (part.type === 'text/html') return;
      if (part.type === 'text/css') {
        // The preview already links every font stylesheet JanitorAI loads, so
        // re-injecting them adds a couple of megabytes of @font-face rules for
        // no visual difference at all.
        if (!/fonts\.googleapis\.com/i.test(part.location || '')) {
          css.push(textFromBytes(part.bytes));
        }
        return;
      }
      if (!part.location && !part.id) return;
      var url = URL.createObjectURL(new Blob([part.bytes], { type: part.type || 'application/octet-stream' }));
      urls.push(url);
      if (part.location) resources[part.location] = url;
      if (part.id) resources[part.id] = url;
    });
    return { map: resources, css: css.join('\n') };
  }

  function release() {
    objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    objectUrls = [];
  }

  function read(file) {
    if (!file) return Promise.reject(new Error('Choose a profile file first.'));
    var nextUrls = [];
    return file.arrayBuffer().then(function (buffer) {
      var isMhtml = /\.(mht|mhtml)$/i.test(file.name) || /multipart\/related/i.test(file.type);
      var parsed = isMhtml ? parseMhtml(buffer) : { html: textFromBytes(new Uint8Array(buffer)), parts: [] };
      var resources = makeResources(parsed.parts, nextUrls);
      var doc = new DOMParser().parseFromString(parsed.html, 'text/html');
      var profile = profileFromDocument(doc, resources.map, rewriteResources(resources.css, resources.map));
      release();
      objectUrls = nextUrls;
      return profile;
    }).catch(function (error) {
      nextUrls.forEach(function (url) { URL.revokeObjectURL(url); });
      throw error;
    });
  }

  window.JaiProfileImport = { read: read, release: release };
})();
