/*
 * A source-mapped view of the markup half of the About Me document.
 *
 * The canvas lets you click, drag and retype elements in the preview, but the
 * preview is only a rendering: the document in the editor is still the single
 * source of truth. So every element the creator wrote needs an address in that
 * text. This module walks the payload, records where each element starts and
 * ends, and performs edits as plain splices on those offsets — which is what
 * keeps a drag from reformatting, re-quoting or re-indenting anything else the
 * creator wrote.
 *
 * `tagged()` is the other half of the seam: it hands the preview a copy of the
 * payload with a `data-jx` number on every opening tag, so a click in the
 * rendered page can be traced back to a node here. The numbers ride on the
 * elements themselves, so they survive whatever tree repairs the browser's
 * HTML parser makes. The copy is never stored and never copied to JanitorAI.
 *
 * No DOM in here: everything is offsets into a string.
 */
(function (global) {
  'use strict';

  var VOID = {
    area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1,
    link: 1, meta: 1, source: 1, track: 1, wbr: 1
  };

  /* Contents are not markup: a `<` inside a stylesheet is not a tag. */
  var RAW = { style: 1, script: 1 };

  /* The implied end tags that actually come up in hand-written bios. Without
   * these a `<p>` left open before a `<div>` would swallow the rest of the
   * document as its child, and a move would drag half the page with it. */
  var CLOSES_P = {
    address: 1, article: 1, aside: 1, blockquote: 1, details: 1, div: 1, dl: 1,
    figcaption: 1, figure: 1, footer: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1,
    h6: 1, header: 1, hr: 1, main: 1, nav: 1, ol: 1, p: 1, pre: 1, section: 1,
    table: 1, ul: 1
  };
  var CLOSES_SIBLING = {
    li: { li: 1 }, dt: { dt: 1, dd: 1 }, dd: { dt: 1, dd: 1 },
    tr: { tr: 1 }, td: { td: 1, th: 1 }, th: { td: 1, th: 1 }, option: { option: 1 }
  };

  /* Elements that can sensibly hold other elements dropped into them. */
  var CONTAINERS = {
    div: 1, section: 1, article: 1, aside: 1, header: 1, footer: 1, main: 1,
    nav: 1, ul: 1, ol: 1, li: 1, details: 1, figure: 1, blockquote: 1, td: 1,
    th: 1, center: 1, a: 1
  };

  var LOCK_START = '<!-- @jai:hardcode:start -->';
  var LOCK_END = '<!-- @jai:hardcode:end -->';

  var TAG_NAMES = {
    h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading',
    h6: 'Heading', p: 'Text', span: 'Text', b: 'Text', strong: 'Text', i: 'Text',
    em: 'Text', small: 'Text', img: 'Image', a: 'Link', div: 'Box',
    section: 'Section', article: 'Section', header: 'Section', footer: 'Section',
    nav: 'Section', aside: 'Section', main: 'Section', ul: 'List', ol: 'List',
    li: 'List item', details: 'Collapsible', summary: 'Summary', hr: 'Divider',
    br: 'Line break', blockquote: 'Quote', figure: 'Figure',
    figcaption: 'Caption', table: 'Table', tr: 'Row', td: 'Cell', th: 'Cell',
    center: 'Centered box', marquee: 'Marquee', iframe: 'Embed', video: 'Video'
  };

  function escapeText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(value) {
    return escapeText(value).replace(/"/g, '&quot;');
  }

  function unescape(value) {
    return String(value == null ? '' : value)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  }

  /* Index just past the `>` that ends the tag starting before `from`. Quote
   * aware, because an attribute value may legitimately contain `>`. */
  function tagEnd(text, from) {
    var quote = null;
    for (var i = from; i < text.length; i++) {
      var c = text[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '>') return i + 1;
    }
    return text.length;
  }

  var ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  function parseAttrs(text, offset) {
    var out = [];
    var m;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(text))) {
      var value = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : null;
      out.push({
        name: m[1].toLowerCase(),
        value: value == null ? '' : unescape(value),
        bare: value == null,
        start: offset + m.index,
        end: offset + m.index + m[0].length
      });
    }
    return out;
  }

  function lockedRanges(payload) {
    var out = [];
    var from = 0;
    for (;;) {
      var start = payload.indexOf(LOCK_START, from);
      if (start === -1) break;
      var end = payload.indexOf(LOCK_END, start);
      end = end === -1 ? payload.length : end + LOCK_END.length;
      out.push([start, end]);
      from = end;
    }
    return out;
  }

  /*
   * Every element in the markup, in document order:
   *   { id, tag, attrs, classes, start, nameEnd, openEnd, closeStart, end,
   *     parent, children, void, locked, depth }
   * `start..end` is the whole element; `openEnd..closeStart` is its contents.
   * An element with no closing tag of its own ends where its parent does.
   */
  var cacheKey = null;
  var cacheValue = null;

  function parse(payload) {
    payload = String(payload || '');
    if (payload === cacheKey) return cacheValue;

    var nodes = [];
    var stack = [];
    var locks = lockedRanges(payload);
    var len = payload.length;
    var i = 0;

    function close(node, closeStart, end) {
      node.closeStart = closeStart;
      node.end = end;
    }

    function isLocked(offset) {
      for (var k = 0; k < locks.length; k++) {
        if (offset >= locks[k][0] && offset < locks[k][1]) return true;
      }
      return false;
    }

    while (i < len) {
      var lt = payload.indexOf('<', i);
      if (lt === -1) break;

      if (payload.substr(lt, 4) === '<!--') {
        var commentEnd = payload.indexOf('-->', lt + 4);
        i = commentEnd === -1 ? len : commentEnd + 3;
        continue;
      }

      var m = /^<(\/?)([a-zA-Z][\w:-]*)/.exec(payload.substr(lt, 80));
      if (!m) { i = lt + 1; continue; }
      var name = m[2].toLowerCase();
      var nameEnd = lt + m[0].length;
      var end = tagEnd(payload, nameEnd);

      if (m[1]) {
        // A closing tag ends the nearest open element of that name and, with
        // it, anything left open inside. A stray one closes nothing.
        var s = stack.length - 1;
        while (s >= 0 && stack[s].tag !== name) s--;
        if (s >= 0) {
          while (stack.length > s + 1) close(stack.pop(), lt, lt);
          close(stack.pop(), lt, end);
        }
        i = end;
        continue;
      }

      if (RAW[name]) {
        var rawClose = new RegExp('</' + name + '\\s*>', 'i').exec(payload.slice(end));
        i = rawClose ? end + rawClose.index + rawClose[0].length : len;
        continue;
      }

      var top = stack[stack.length - 1];
      if (top && ((top.tag === 'p' && CLOSES_P[name]) ||
                  (CLOSES_SIBLING[name] && CLOSES_SIBLING[name][top.tag]))) {
        close(stack.pop(), lt, lt);
        top = stack[stack.length - 1];
      }

      var attrs = parseAttrs(payload.slice(nameEnd, end - 1), nameEnd);
      var classAttr = null;
      attrs.forEach(function (a) { if (a.name === 'class') classAttr = a; });
      var selfClosing = payload[end - 2] === '/';
      var node = {
        id: nodes.length,
        tag: name,
        attrs: attrs,
        classes: classAttr ? classAttr.value.split(/\s+/).filter(Boolean) : [],
        start: lt,
        nameEnd: nameEnd,
        openEnd: end,
        closeStart: end,
        end: end,
        parent: top ? top.id : -1,
        children: [],
        void: !!VOID[name] || selfClosing,
        locked: isLocked(lt),
        depth: stack.length
      };
      nodes.push(node);
      if (top) top.children.push(node.id);
      if (!node.void) stack.push(node);
      i = end;
    }

    while (stack.length) close(stack.pop(), len, len);

    cacheKey = payload;
    cacheValue = {
      nodes: nodes,
      roots: nodes.filter(function (n) { return n.parent === -1; }).map(function (n) { return n.id; })
    };
    return cacheValue;
  }

  /* The payload with ` data-jx="<id>"` on every opening tag, for the preview
   * only. Generated (regenerated-on-demand) elements are marked too, so the
   * canvas knows not to offer a drag that the next rebuild would undo. */
  function tagged(payload) {
    payload = String(payload || '');
    var nodes = parse(payload).nodes;
    if (!nodes.length) return payload;
    var out = '';
    var cursor = 0;
    nodes.forEach(function (node) {
      out += payload.slice(cursor, node.nameEnd) + ' data-jx="' + node.id + '"' +
        (node.locked ? ' data-jx-lock' : '');
      cursor = node.nameEnd;
    });
    return out + payload.slice(cursor);
  }

  function attr(node, name) {
    for (var i = 0; i < node.attrs.length; i++) {
      if (node.attrs[i].name === name) return node.attrs[i];
    }
    return null;
  }

  function attrValue(node, name) {
    var a = attr(node, name);
    return a ? a.value : '';
  }

  function inner(payload, node) {
    return payload.slice(node.openEnd, node.closeStart);
  }

  /* The readable text inside an element, tags dropped, whitespace collapsed. */
  function text(payload, node) {
    return unescape(inner(payload, node)
      .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(?:"[^"]*"|'[^']*'|[^>"'])*>/g, ' '))
      .replace(/\s+/g, ' ').trim();
  }

  function isLeaf(node) { return !node.children.length; }

  /* Whether the element's contents can be retyped in place: only when there is
   * nothing in there that the preview does not carry (a stylesheet or a marker
   * comment would be silently lost on the way back). */
  function editable(payload, node) {
    if (node.void) return false;
    return !/<style\b|<!--/i.test(inner(payload, node));
  }

  function canContain(node) { return !node.void && !!CONTAINERS[node.tag]; }

  function contains(parsed, ancestor, node) {
    for (var n = node; n; n = parsed.nodes[n.parent]) {
      if (n === ancestor) return true;
      if (n.parent === -1) break;
    }
    return false;
  }

  /* A short human name: what the element is, then what the creator called it. */
  function describe(node, blockNames) {
    var friendly = null;
    if (blockNames) {
      node.classes.some(function (c) {
        if (blockNames[c]) { friendly = blockNames[c]; return true; }
        return false;
      });
    }
    return friendly || TAG_NAMES[node.tag] || '<' + node.tag + '>';
  }

  // ------------------------------------------------------------------ edits

  /* The indentation of the line an element starts on, when nothing else shares
   * its first or last line — i.e. the creator writes this markup one element
   * per line. Returns null for elements written back to back. */
  function ownLineIndent(payload, node) {
    var lineStart = payload.lastIndexOf('\n', node.start - 1) + 1;
    var before = payload.slice(lineStart, node.start);
    if (!/^[ \t]*$/.test(before)) return null;
    return /^[ \t]*(\r?\n|$)/.test(payload.slice(node.end)) ? before : null;
  }

  /*
   * Where, and wrapped in what whitespace, a new element goes. Markup written
   * one-per-line gets the same treatment; markup written back to back stays
   * back to back, because a newline between two inline elements renders as a
   * visible gap and is exactly the kind of thing the creator removed on purpose.
   *
   * where: 'before' | 'after' (siblings of ref), 'inside' (last child),
   *        'first' (first child). No ref means the end of the document.
   * Returns { at, text, lead } — `lead` is how far into `text` the element is.
   */
  function place(payload, parsed, html, ref, where) {
    if (!ref) {
      var body = payload.replace(/\s+$/, '');
      var gap = body ? '\n' : '';
      return { at: body.length, text: gap + html + '\n', lead: gap.length, tail: payload.length };
    }
    if (where === 'inside' || where === 'first') {
      if (ref.children.length) {
        var kids = ref.children;
        return where === 'inside'
          ? place(payload, parsed, html, parsed.nodes[kids[kids.length - 1]], 'after')
          : place(payload, parsed, html, parsed.nodes[kids[0]], 'before');
      }
      return { at: where === 'inside' ? ref.closeStart : ref.openEnd, text: html, lead: 0 };
    }
    if (ref.locked) {
      // Beside a block that is linked to Profile data means outside its
      // markers: whatever sits between them is rewritten on the next rebuild,
      // and would be marked as generated in the meantime.
      var range = lockRangeAt(payload, ref.start);
      if (range) {
        return where === 'before'
          ? { at: range[0], text: html + '\n', lead: 0 }
          : { at: range[1], text: '\n' + html, lead: 1 };
      }
    }
    var indent = ownLineIndent(payload, ref);
    if (indent == null) {
      return { at: where === 'before' ? ref.start : ref.end, text: html, lead: 0 };
    }
    if (where === 'before') {
      return { at: ref.start - indent.length, text: indent + html + '\n', lead: indent.length };
    }
    return { at: ref.end, text: '\n' + indent + html, lead: 1 + indent.length };
  }

  /* The span to cut for an element: the whole line when it owns one. */
  function cutRange(payload, node) {
    var start = node.start;
    var end = node.end;
    var indent = ownLineIndent(payload, node);
    if (indent != null) {
      var nl = payload.indexOf('\n', end);
      start -= indent.length;
      end = nl === -1 ? payload.length : nl + 1;
    }
    return [start, end];
  }

  /* The edit's outcome: the new text, and the id of the element now at
   * `start` — or the first one after it, when what was inserted opens with a
   * comment rather than a tag. */
  function result(payload, start) {
    if (start == null) return { payload: payload, id: null };
    var nodes = parse(payload).nodes;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].start >= start) return { payload: payload, id: nodes[i].id };
    }
    return { payload: payload, id: null };
  }

  /* The id of the first element at or after an offset. */
  function nodeAfter(payload, offset) {
    return result(payload, offset).id;
  }

  // ------------------------------------------------------- generated blocks
  //
  // A hardcoded layout is written between marker comments and rebuilt from
  // Profile data whenever that changes — which is what lets a roster grow
  // without retyping it, and also what would undo any edit made inside it by
  // hand. The canvas does not forbid those edits; it *unlinks* the block first
  // (the markers go, every byte of markup and CSS stays), after which the
  // layout is ordinary markup that belongs to the creator. Undo links it back.

  var LOCK_MARKERS = [
    LOCK_START, LOCK_END,
    '/* @jai:hardcode:start */', '/* @jai:hardcode:end */',
    '/* @jai:hardcode:style:start */', '/* @jai:hardcode:style:end */'
  ];

  function lockRangeAt(payload, offset) {
    var ranges = lockedRanges(payload);
    for (var i = 0; i < ranges.length; i++) {
      if (offset >= ranges[i][0] && offset < ranges[i][1]) return ranges[i];
    }
    return null;
  }

  function isLinked(payload) {
    return String(payload || '').indexOf(LOCK_START) !== -1;
  }

  function unlink(payload) {
    var out = String(payload || '');
    LOCK_MARKERS.forEach(function (marker) {
      var at;
      while ((at = out.indexOf(marker)) !== -1) {
        var end = at + marker.length;
        // Take the line with it when the marker had one to itself.
        var lineStart = out.lastIndexOf('\n', at - 1) + 1;
        if (/^[ \t]*$/.test(out.slice(lineStart, at)) && /^[ \t]*\r?\n/.test(out.slice(end))) {
          at = lineStart;
          end = out.indexOf('\n', end) + 1;
        }
        out = out.slice(0, at) + out.slice(end);
      }
    });
    return out;
  }

  /* Whether placing something at (ref, where) would land between the markers.
   * Next to the block's outermost element does not: place() puts that outside. */
  function landsInLock(parsed, refId, where) {
    var ref = refId == null ? null : parsed.nodes[refId];
    if (!ref || !ref.locked) return false;
    if (where === 'inside' || where === 'first') return true;
    return ref.parent !== -1 && parsed.nodes[ref.parent].locked;
  }

  function insert(payload, html, refId, where) {
    var parsed = parse(payload);
    var ref = refId == null ? null : parsed.nodes[refId];
    var spot = place(payload, parsed, html, ref, where);
    var tail = spot.tail != null ? spot.tail : spot.at;
    return result(payload.slice(0, spot.at) + spot.text + payload.slice(tail), spot.at + spot.lead);
  }

  function remove(payload, id) {
    var node = parse(payload).nodes[id];
    if (!node) return { payload: payload, id: null };
    var cut = cutRange(payload, node);
    return { payload: payload.slice(0, cut[0]) + payload.slice(cut[1]), id: null };
  }

  function duplicate(payload, id) {
    var node = parse(payload).nodes[id];
    if (!node) return { payload: payload, id: null };
    return insert(payload, payload.slice(node.start, node.end), id, 'after');
  }

  /* Moves an element next to (or into) another. Refuses to drop an element
   * inside itself, which would delete it. */
  function move(payload, id, refId, where) {
    var parsed = parse(payload);
    var node = parsed.nodes[id];
    var ref = refId == null ? null : parsed.nodes[refId];
    if (!node || (refId != null && !ref)) return null;
    if (ref && contains(parsed, node, ref)) return null;

    var html = payload.slice(node.start, node.end);
    var spot = place(payload, parsed, html, ref, where);
    var cut = cutRange(payload, node);
    var tail = spot.tail != null ? spot.tail : spot.at;
    if (spot.at > cut[0] && spot.at < cut[1]) return null;

    var next, start;
    if (spot.at >= cut[1]) {
      next = payload.slice(0, cut[0]) + payload.slice(cut[1], spot.at) + spot.text + payload.slice(tail);
      start = spot.at - (cut[1] - cut[0]) + spot.lead;
    } else {
      next = payload.slice(0, spot.at) + spot.text + payload.slice(tail, cut[0]) + payload.slice(cut[1]);
      start = spot.at + spot.lead;
    }
    if (next === payload) return null;
    return result(next, start);
  }

  /* Swaps an element with its previous (-1) or next (+1) sibling. */
  function nudge(payload, id, direction) {
    var parsed = parse(payload);
    var node = parsed.nodes[id];
    if (!node) return null;
    var siblings = node.parent === -1 ? parsed.roots : parsed.nodes[node.parent].children;
    var other = siblings[siblings.indexOf(id) + direction];
    if (other == null) return null;
    return move(payload, id, other, direction < 0 ? 'before' : 'after');
  }

  function setInner(payload, id, html) {
    var node = parse(payload).nodes[id];
    if (!node || node.void) return { payload: payload, id: id };
    return result(payload.slice(0, node.openEnd) + html + payload.slice(node.closeStart), node.start);
  }

  /* Sets, adds or (value == null) removes one attribute, leaving the rest of
   * the tag byte-identical. */
  function setAttr(payload, id, name, value) {
    var node = parse(payload).nodes[id];
    if (!node) return { payload: payload, id: id };
    var existing = attr(node, name);
    var next;
    if (existing) {
      if (value == null) {
        var from = existing.start;
        while (from > node.nameEnd && /\s/.test(payload[from - 1])) from--;
        next = payload.slice(0, from) + payload.slice(existing.end);
      } else {
        next = payload.slice(0, existing.start) + name + '="' + escapeAttr(value) + '"' +
          payload.slice(existing.end);
      }
    } else if (value == null) {
      next = payload;
    } else {
      next = payload.slice(0, node.nameEnd) + ' ' + name + '="' + escapeAttr(value) + '"' +
        payload.slice(node.nameEnd);
    }
    return result(next, node.start);
  }

  function addClass(payload, id, cls) {
    var node = parse(payload).nodes[id];
    if (!node || node.classes.indexOf(cls) !== -1) return { payload: payload, id: id };
    return setAttr(payload, id, 'class', node.classes.concat(cls).join(' '));
  }

  /* A class name nothing in the document uses yet, for one element's own
   * styling. It always carries a digit, which is what tells it apart from the
   * word-like class a block shares between its instances (`jx-text`). */
  var INSTANCE_CLASS = /^jx-(?=[a-z0-9]*\d)[a-z0-9]{4}$/;

  function uniqueClass(payload) {
    var name;
    do {
      name = 'jx-' + Math.random().toString(36).slice(2, 6);
    } while (!INSTANCE_CLASS.test(name) || payload.indexOf(name) !== -1);
    return name;
  }

  function isInstanceClass(cls) { return INSTANCE_CLASS.test(cls); }

  /* How many elements carry a class — whether a rule written against it would
   * restyle one element or several. */
  function classCount(parsed, cls) {
    var n = 0;
    parsed.nodes.forEach(function (node) { if (node.classes.indexOf(cls) !== -1) n++; });
    return n;
  }

  global.JaiMarkup = {
    parse: parse,
    tagged: tagged,
    attr: attr,
    attrValue: attrValue,
    inner: inner,
    text: text,
    isLeaf: isLeaf,
    editable: editable,
    canContain: canContain,
    describe: describe,
    insert: insert,
    remove: remove,
    duplicate: duplicate,
    move: move,
    nudge: nudge,
    setInner: setInner,
    setAttr: setAttr,
    addClass: addClass,
    nodeAfter: nodeAfter,
    isLinked: isLinked,
    unlink: unlink,
    landsInLock: landsInLock,
    uniqueClass: uniqueClass,
    isInstanceClass: isInstanceClass,
    classCount: classCount,
    escapeText: escapeText,
    escapeAttr: escapeAttr
  };
})(window);
