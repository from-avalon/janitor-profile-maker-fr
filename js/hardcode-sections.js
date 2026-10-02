/*
 * Hardcoded character appearances outside the studio's generated selector.
 *
 * A creator may use the same character in several hand-written parts of one
 * About Me document: a featured selector, a scrolling reel and a full archive
 * are common examples. These sections are deliberately detected from the
 * document in the editor rather than registered by a template. That lets an
 * imported or pasted profile keep using the Profile panel after it has been
 * customised by hand.
 *
 * Detection is conservative. We only offer an Add action when the markup has
 * a shape we know how to extend without serialising the rest of the document.
 * Unknown links remain visible in the code and preview, untouched.
 */
(function (global) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function attr(value) { return esc(value).replace(/"/g, '&quot;'); }

  function tags(entry) {
    var value = entry && entry.tags ? entry.tags : [];
    if (typeof value === 'string') value = value.split(',');
    return value.map(function (tag) { return String(tag).trim(); }).filter(Boolean);
  }

  function characterLink(value) {
    var match = String(value || '').match(/(?:https?:\/\/janitorai\.com)?(\/characters\/[^?#"']+)/i);
    return match ? match[1].replace(/\/$/, '').toLowerCase() : '';
  }

  function nameKey(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function sameCharacter(a, b) {
    var leftLink = characterLink(a && a.link);
    var rightLink = characterLink(b && b.link);
    if (leftLink && rightLink) return leftLink === rightLink;
    return !!nameKey(a && a.name) && nameKey(a.name) === nameKey(b && b.name);
  }

  function documentFrom(payload) {
    return new DOMParser().parseFromString(String(payload || ''), 'text/html');
  }

  function text(node) {
    return node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function classId(node, prefix, ignored) {
    var classes = String(node && node.className || '').split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
      if (classes[i].indexOf(prefix) !== 0) continue;
      var value = classes[i].slice(prefix.length);
      if (!ignored || ignored.indexOf(value) === -1) return value;
    }
    return '';
  }

  function contactCharacters(shell) {
    if (!shell) return [];
    var out = [];
    Array.prototype.forEach.call(shell.querySelectorAll('.cs-slot-live'), function (slot) {
      var id = classId(slot, 'cs-slot-', ['live']) || String(slot.getAttribute('href') || '').replace(/^#sig-/, '');
      if (!id) return;
      var identity = shell.querySelector('.cs-identity.cs-for-' + cssEscape(id));
      var launch = shell.querySelector('.cs-launch.cs-for-' + cssEscape(id));
      var slotImage = slot.querySelector('.cs-slot-thumb');
      var stageImage = shell.querySelector('.cs-scene-art.cs-art-' + cssEscape(id));
      var hoverImage = slot.querySelector('.cs-stage-preview');
      var tagBox = shell.querySelector('.cs-tags.cs-for-' + cssEscape(id));
      var foundTags = [];
      Array.prototype.forEach.call(tagBox ? tagBox.children : [], function (tag) {
        var label = text(tag);
        if (label) foundTags.push(label);
      });
      out.push({
        name: text(identity && identity.querySelector('.cs-name')) || id,
        link: launch ? launch.getAttribute('href') || '' : '',
        id: id,
        tagline: text(identity && identity.querySelector('.cs-title')),
        quote: text(identity && identity.querySelector('.cs-quote')),
        description: text(identity && identity.querySelector('.cs-desc')),
        tags: foundTags,
        portrait: slotImage ? slotImage.getAttribute('src') || '' : '',
        art: stageImage ? stageImage.getAttribute('src') || '' : '',
        hover: hoverImage ? hoverImage.getAttribute('src') || '' : ''
      });
    });
    return out;
  }

  function cssEscape(value) {
    if (global.CSS && global.CSS.escape) return global.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function archiveCharacters(node) {
    var out = [];
    Array.prototype.forEach.call(node.querySelectorAll('.px-roll-row'), function (row) {
      out.push({
        name: text(row.querySelector('.px-roll-text > b, .px-roll-text b')),
        link: row.getAttribute('href') || ''
      });
    });
    return out;
  }

  function reelCharacters(node) {
    var out = [];
    Array.prototype.forEach.call(node.querySelectorAll('.px-frame'), function (frame) {
      var label = frame.querySelector('.px-frame-name');
      var clone = label && label.cloneNode(true);
      if (clone) Array.prototype.forEach.call(clone.querySelectorAll('b'), function (b) { b.remove(); });
      out.push({ name: text(clone), link: '' });
    });
    return out;
  }

  function uniqueCharacters(entries) {
    var out = [];
    entries.forEach(function (entry) {
      if (!entry.name && !entry.link) return;
      if (!out.some(function (seen) { return sameCharacter(seen, entry); })) out.push(entry);
    });
    return out;
  }

  function detect(payload) {
    var doc = documentFrom(payload);
    var sections = [];
    var shell = doc.querySelector('.cs-shell');
    if (shell && String(payload || '').indexOf(global.JaiHardcode.markers.htmlStart) !== -1) {
      var contacts = uniqueCharacters(contactCharacters(shell));
      sections.push({
        id: 'generated-selector',
        kind: 'generated',
        label: 'Featured character selector',
        detail: 'Generated @jai:hardcode block',
        count: contacts.length,
        characters: contacts
      });
    }

    Array.prototype.forEach.call(doc.querySelectorAll('.px-roll'), function (node, index) {
      var entries = uniqueCharacters(archiveCharacters(node));
      if (!entries.length) return;
      sections.push({
        id: 'px-roll:' + index,
        kind: 'archive',
        index: index,
        label: index ? 'Character archive ' + (index + 1) : 'Character archive',
        detail: '.px-roll-row cards',
        count: entries.length,
        characters: entries
      });
    });

    Array.prototype.forEach.call(doc.querySelectorAll('.px-film-track'), function (node, index) {
      var entries = uniqueCharacters(reelCharacters(node));
      if (!entries.length) return;
      sections.push({
        id: 'px-film-track:' + index,
        kind: 'reel',
        index: index,
        label: index ? 'Character film reel ' + (index + 1) : 'Character film reel',
        detail: 'Duplicated .px-frame loop',
        count: entries.length,
        characters: entries
      });
    });
    return sections;
  }

  /* Find an element in the original source so only its inner markup changes.
   * DOMParser is used for recognition; this small scanner is used for editing
   * because serialising the DOM would rewrite the creator's whole document. */
  function elementsByClass(source, className) {
    var found = [];
    var open = /<([a-z][\w:-]*)\b[^>]*>/gi;
    var match;
    while ((match = open.exec(source))) {
      if (/^<\//.test(match[0]) || /\/>$/.test(match[0])) continue;
      var classMatch = /\bclass\s*=\s*(["'])([\s\S]*?)\1/i.exec(match[0]);
      if (!classMatch || classMatch[2].split(/\s+/).indexOf(className) === -1) continue;
      var tag = match[1];
      var tokens = new RegExp('<\\/?' + tag + '\\b[^>]*>', 'gi');
      tokens.lastIndex = open.lastIndex;
      var depth = 1;
      var token;
      while ((token = tokens.exec(source))) {
        if (new RegExp('^<\\/' + tag, 'i').test(token[0])) depth--;
        else if (!/\/>$/.test(token[0])) depth++;
        if (!depth) {
          found.push({
            start: match.index,
            openEnd: open.lastIndex,
            closeStart: token.index,
            end: tokens.lastIndex,
            tag: tag
          });
          break;
        }
      }
    }
    return found;
  }

  function sectionById(payload, id) {
    return detect(payload).filter(function (section) { return section.id === id; })[0] || null;
  }

  function contains(section, entry) {
    return !!section && section.characters.some(function (found) { return sameCharacter(found, entry); });
  }

  function freshEntries(current, roster) {
    return current.map(function (found) {
      var fresh = roster.filter(function (entry) { return sameCharacter(found, entry); })[0];
      if (!fresh) return found;
      var merged = Object.assign({}, found, fresh);
      // These belong to this particular appearance. A profile import only has
      // the bot's ordinary avatar; it must not erase hand-picked stage, hover
      // or portrait art that was already wired into a featured selector.
      ['id', 'portrait', 'art', 'hover'].forEach(function (key) {
        if (found[key]) merged[key] = found[key];
      });
      return merged;
    });
  }

  function addUnique(list, entries) {
    entries.forEach(function (entry) {
      if (!list.some(function (seen) { return sameCharacter(seen, entry); })) list.push(entry);
    });
    return list;
  }

  function archiveMarkup(entry, number) {
    var prepared = global.JaiHardcode.prepare([entry])[0];
    var allTags = tags(entry);
    var classes = ['px-roll-row', 'px-n-' + prepared.name.charAt(0).toLowerCase()];
    allTags.forEach(function (tag) {
      if (global.JaiTags.isLinkable(tag)) classes.push('px-t-' + global.JaiTags.slug(tag));
    });
    var image = prepared.portrait || prepared.art;
    var summary = prepared.quote;
    if (prepared.description) summary += (summary ? ' ' : '') + prepared.description;
    if (!summary) summary = prepared.tagline;
    var chips = allTags.map(function (tag) {
      var label = global.JaiTags.label(tag);
      var custom = global.JaiTags.idOf(tag) == null && !/^(limitless|sfw|nsfw)$/i.test(label);
      return '<span' + (custom ? ' class="px-hash"' : '') + '>' + esc(custom ? '#' + label : label) + '</span>';
    }).join('');
    return '<a class="' + attr(classes.join(' ')) + '" href="' + attr(prepared.link) + '">' +
      '<span class="px-roll-face">' +
      (image ? '<img src="' + attr(image) + '" alt="">' : '') +
      '<span class="px-roll-no">' + (number < 10 ? '0' : '') + number + '</span></span>' +
      '<span class="px-roll-text"><b>' + esc(prepared.name) + '</b>' +
      (summary ? '<small>' + esc(summary) + '</small>' : '') +
      '<span class="px-roll-tags">' + chips + '</span><span class="px-roll-foot"><em>' +
      (entry.chats ? esc(entry.chats) + ' chats' : 'New release') +
      '</em><span class="px-roll-go">Chat ↗</span></span></span></a>';
  }

  function updateArchiveMeta(source, count) {
    var metas = elementsByClass(source, 'px-pane-meta');
    if (!metas.length) return source;
    for (var i = 0; i < metas.length; i++) {
      var body = source.slice(metas[i].openEnd, metas[i].closeStart);
      if (!/\b\d+\s+public\b/i.test(body)) continue;
      var next = body.replace(/\b\d+(?=\s+public\b)/i, String(count));
      return source.slice(0, metas[i].openEnd) + next + source.slice(metas[i].closeStart);
    }
    return source;
  }

  function ensureLetterFilter(source, entry) {
    var letter = String(entry.name || '').trim().charAt(0).toLowerCase();
    if (!/^[a-z]$/.test(letter) || source.indexOf('cf-n-' + letter) !== -1) return source;
    if (source.indexOf('px-cf-letter') === -1 || source.indexOf('.px-roll-row:not(.px-n-') === -1) return source;

    var hubs = elementsByClass(source, 'px-hub');
    if (hubs.length) {
      var key = '<span class="px-key px-cf" id="cf-n-' + letter + '"></span>';
      source = source.slice(0, hubs[0].openEnd) + key + source.slice(hubs[0].openEnd);
    }
    var rows = elementsByClass(source, 'px-finder-row');
    if (rows.length) {
      var row = rows[rows.length - 1];
      var chip = '<a class="px-cf-chip px-cf-letter px-cf-n-' + letter + '" href="#cf-n-' + letter + '">' +
        letter.toUpperCase() + '</a>';
      source = source.slice(0, row.closeStart) + chip + source.slice(row.closeStart);
    }
    var styleEnd = source.indexOf('</style>');
    if (styleEnd !== -1) {
      var rule = '.px-hub:has(#cf-n-' + letter + ':target) .px-roll-row:not(.px-n-' + letter + ') { display: none; }\n';
      source = source.slice(0, styleEnd) + rule + source.slice(styleEnd);
    }
    return source;
  }

  function addToArchive(payload, section, entries) {
    var source = payload;
    var added = 0;
    entries.forEach(function (entry) {
      var current = sectionById(source, section.id);
      if (!current || contains(current, entry)) return;
      var containers = elementsByClass(source, 'px-roll');
      var container = containers[section.index];
      if (!container) return;
      var markup = archiveMarkup(entry, current.count + 1);
      source = source.slice(0, container.closeStart) + markup + source.slice(container.closeStart);
      source = updateArchiveMeta(source, current.count + 1);
      source = ensureLetterFilter(source, entry);
      added++;
    });
    return { payload: source, added: added };
  }

  function reelMarkup(entry, number, duplicate) {
    var prepared = global.JaiHardcode.prepare([entry])[0];
    var image = prepared.portrait || prepared.art;
    return '<div class="px-frame"><span class="px-frame-cell">' +
      (image ? '<img src="' + attr(image) + '" alt="' + attr(duplicate ? '' : prepared.name + ' chibi') + '">' : '') +
      '<span class="px-frame-name"><b>' + (number < 10 ? '0' : '') + number + '</b>' +
      esc(prepared.name) + '</span></span></div>';
  }

  function frameNames(source, ranges) {
    return ranges.map(function (range) {
      var doc = documentFrom(source.slice(range.start, range.end));
      var label = doc.querySelector('.px-frame-name');
      if (!label) return '';
      Array.prototype.forEach.call(label.querySelectorAll('b'), function (b) { b.remove(); });
      return nameKey(text(label));
    });
  }

  function repeatedHalf(names) {
    if (names.length < 2 || names.length % 2) return 0;
    var half = names.length / 2;
    for (var i = 0; i < half; i++) if (names[i] !== names[i + half]) return 0;
    return half;
  }

  function addToReel(payload, section, entries) {
    var source = payload;
    var added = 0;
    entries.forEach(function (entry) {
      var current = sectionById(source, section.id);
      if (!current || contains(current, entry)) return;
      var tracks = elementsByClass(source, 'px-film-track');
      var track = tracks[section.index];
      if (!track) return;
      var inner = source.slice(track.openEnd, track.closeStart);
      var frames = elementsByClass(inner, 'px-frame');
      var names = frameNames(inner, frames);
      var half = repeatedHalf(names);
      var number = current.count + 1;
      if (half) {
        var firstEnd = track.openEnd + frames[half - 1].end;
        var secondEnd = track.openEnd + frames[frames.length - 1].end;
        source = source.slice(0, secondEnd) + reelMarkup(entry, number, true) + source.slice(secondEnd);
        source = source.slice(0, firstEnd) + reelMarkup(entry, number, false) + source.slice(firstEnd);
      } else {
        source = source.slice(0, track.closeStart) + reelMarkup(entry, number, false) + source.slice(track.closeStart);
      }
      added++;
    });
    return { payload: source, added: added };
  }

  function add(payload, sectionId, entries, roster, opts) {
    var section = sectionById(payload, sectionId);
    if (!section) return { payload: payload, added: 0, error: 'That section is no longer in the current code.' };
    entries = entries || [];
    if (section.kind === 'generated') {
      var nextRoster = freshEntries(section.characters, roster || []);
      var before = nextRoster.length;
      addUnique(nextRoster, entries);
      return {
        payload: global.JaiHardcode.apply(payload, nextRoster, opts),
        added: nextRoster.length - before
      };
    }
    if (section.kind === 'archive') return addToArchive(payload, section, entries);
    if (section.kind === 'reel') return addToReel(payload, section, entries);
    return { payload: payload, added: 0, error: 'This section is read-only.' };
  }

  function rosterForGenerated(payload, roster) {
    var section = sectionById(payload, 'generated-selector');
    return section ? freshEntries(section.characters, roster || []) : (roster || []);
  }

  global.JaiHardcodeSections = {
    detect: detect,
    contains: contains,
    add: add,
    rosterForGenerated: rosterForGenerated
  };
})(window);
