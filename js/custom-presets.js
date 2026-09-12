/*
 * User-authored presets: named collections of CSS/HTML snippets the creator
 * selects out of their own About Me code and saves for reuse, the same way an
 * advanced template ships pre-cut parts (see js/presets.js) except these are
 * defined by the creator instead of a template author, and persist in
 * localStorage rather than shipping with the app.
 *
 * Apply/remove uses the same marker-splice technique as js/presets.js, with a
 * distinct marker prefix so a custom part can never collide with a basic
 * preset or an advanced-template part.
 */
(function (global) {
  'use strict';

  var STORE_KEY = 'jai-custom-presets';

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function persist(presets) {
    try { global.localStorage.setItem(STORE_KEY, JSON.stringify(presets)); }
    catch (e) { /* storage full or unavailable -- presets just won't survive a reload */ }
  }

  function list() { return load(); }

  function find(presets, id) {
    for (var i = 0; i < presets.length; i++) if (presets[i].id === id) return presets[i];
    return null;
  }

  function create(name) {
    var presets = load();
    var preset = { id: uid('preset'), name: name || 'Untitled preset', parts: [] };
    presets.push(preset);
    persist(presets);
    return preset;
  }

  function rename(id, name) {
    var presets = load();
    var preset = find(presets, id);
    if (preset && name) { preset.name = name; persist(presets); }
    return preset;
  }

  function deletePreset(id) {
    var presets = load().filter(function (p) { return p.id !== id; });
    persist(presets);
  }

  function addPart(presetId, part) {
    var presets = load();
    var preset = find(presets, presetId);
    if (!preset) return null;
    var saved = {
      id: uid('part'),
      name: (part && part.name) || 'Untitled part',
      css: part && part.css ? part.css : undefined,
      html: part && part.html ? part.html : undefined
    };
    preset.parts.push(saved);
    persist(presets);
    return saved;
  }

  function renamePart(presetId, partId, name) {
    var presets = load();
    var preset = find(presets, presetId);
    var part = preset && preset.parts.filter(function (p) { return p.id === partId; })[0];
    if (part && name) { part.name = name; persist(presets); }
    return part;
  }

  function deletePart(presetId, partId) {
    var presets = load();
    var preset = find(presets, presetId);
    if (!preset) return;
    preset.parts = preset.parts.filter(function (p) { return p.id !== partId; });
    persist(presets);
  }

  // ------------------------------------------------------- apply / remove
  //
  // Mirrors js/presets.js's marker convention (OPEN/CLOSE for CSS via
  // JaiPayload.editCss, HTML_OPEN/HTML_CLOSE for markup), under a prefix that
  // cannot collide with a basic preset or a template part.

  var OPEN = '/* ==> jai-custom:';
  var CLOSE = '/* <== jai-custom:';
  var HTML_OPEN = '<!-- ==> jai-custom:';
  var HTML_CLOSE = '<!-- <== jai-custom:';

  function header(part) { return OPEN + ' ' + part.id + ' — ' + part.name + ' */'; }
  function footer(part) { return CLOSE + ' ' + part.id + ' */'; }
  function htmlHeader(part) { return HTML_OPEN + ' ' + part.id + ' — ' + part.name + ' -->'; }
  function htmlFooter(part) { return HTML_CLOSE + ' ' + part.id + ' -->'; }

  function isPartApplied(payload, part) {
    if (part.css && global.JaiPayload.allCss(payload).indexOf(OPEN + ' ' + part.id + ' ') !== -1) {
      return true;
    }
    return !!(part.html && payload.indexOf(HTML_OPEN + ' ' + part.id + ' ') !== -1);
  }

  function appendBlock(text, block) {
    var sep = text && !/\n\s*$/.test(text) ? '\n\n' : (text ? '\n' : '');
    return text + sep + block + '\n';
  }

  function applyPart(payload, part) {
    if (isPartApplied(payload, part)) return payload;
    var out = payload;
    if (part.css) {
      out = global.JaiPayload.editCss(out, function (css) {
        return appendBlock(css, header(part) + '\n' + part.css.replace(/\n+$/, '') + '\n' + footer(part));
      });
    }
    if (part.html) {
      out = appendBlock(out, htmlHeader(part) + '\n' + part.html.replace(/\n+$/, '') + '\n' + htmlFooter(part));
    }
    return out;
  }

  function cutBlock(text, openMarker, endMarker, id) {
    var start = text.indexOf(openMarker + ' ' + id + ' ');
    if (start === -1) return text;
    var end = text.indexOf(endMarker, start);
    if (end === -1) return text;
    end += endMarker.length;
    if (text[end] === '\n') end++;
    while (start > 0 && text[start - 1] === '\n') start--;
    return (text.slice(0, start) + '\n' + text.slice(end)).replace(/\n{3,}/g, '\n\n');
  }

  function removePart(payload, part) {
    var out = payload;
    if (part.css) {
      out = global.JaiPayload.editCss(out, function (css) {
        return cutBlock(css, OPEN, footer(part), part.id);
      });
    }
    if (part.html) {
      out = cutBlock(out, HTML_OPEN, htmlFooter(part), part.id);
    }
    return out;
  }

  global.JaiCustomPresets = {
    list: list,
    create: create,
    rename: rename,
    deletePreset: deletePreset,
    addPart: addPart,
    renamePart: renamePart,
    deletePart: deletePart,
    isPartApplied: isPartApplied,
    applyPart: applyPart,
    removePart: removePart
  };
})(window);
