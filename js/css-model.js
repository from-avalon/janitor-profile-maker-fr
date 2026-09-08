/*
 * A small, tolerant CSS parser.
 *
 * The stylesheet the creator types is the single source of truth in this app —
 * the visual controls are just another view onto it. That means we need to read
 * a declaration back out of arbitrary text, and write one into it without
 * disturbing anything else the creator wrote (including their comments and
 * formatting). Hence a hand-rolled parser that tracks source offsets rather
 * than an AST-and-reprint round trip.
 */
(function (global) {
  'use strict';

  /* Collapses insignificant whitespace so `.a > .b` and `.a>.b` compare equal. */
  function normaliseSelector(sel) {
    return String(sel)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([>+~,])\s*/g, '$1')
      .trim();
  }

  /* Splits a declaration body into { prop, value, important, start, end }. */
  function parseDeclarations(text, offset) {
    var out = [];
    var i = 0;
    var start = 0;
    var depth = 0;
    var quote = null;

    function flush(end) {
      var raw = text.slice(start, end);
      if (raw.trim()) {
        var colon = -1;
        var q = null;
        var d = 0;
        for (var k = 0; k < raw.length; k++) {
          var ch = raw[k];
          if (q) { if (ch === q && raw[k - 1] !== '\\') q = null; continue; }
          if (ch === '"' || ch === "'") { q = ch; continue; }
          if (ch === '(') d++;
          else if (ch === ')') d--;
          else if (ch === ':' && d === 0) { colon = k; break; }
        }
        if (colon > -1) {
          var value = raw.slice(colon + 1);
          var important = /!\s*important\s*$/i.test(value.trim());
          // Report the span of the declaration itself, not the whitespace and
          // comments separating it from the previous one — callers replace this
          // range in place and must not eat the indentation.
          var lead = raw.length - raw.replace(/^\s+/, '').length;
          var trail = raw.length - raw.replace(/\s+$/, '').length;
          out.push({
            prop: raw.slice(0, colon).trim(),
            value: value.replace(/!\s*important\s*$/i, '').trim(),
            important: important,
            start: offset + start + lead,
            end: offset + end - trail
          });
        }
      }
      start = end + 1;
    }

    for (; i < text.length; i++) {
      var c = text[i];
      if (quote) {
        if (c === quote && text[i - 1] !== '\\') quote = null;
        continue;
      }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '/' && text[i + 1] === '*') {
        var close = text.indexOf('*/', i + 2);
        i = close === -1 ? text.length : close + 1;
        continue;
      }
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ';' && depth === 0) flush(i);
    }
    flush(text.length);
    return out;
  }

  /*
   * Walks the sheet and returns a flat list of nodes:
   *   { type:'rule', selector, selectorRaw, atPath:[], decls:[], … offsets }
   *   { type:'atrule', name, params, … offsets }
   * `atPath` records enclosing at-rule preludes, so a rule inside
   * `@media (max-width:575.98px)` is distinguishable from a top-level one.
   */
  function parse(css) {
    var nodes = [];
    var i = 0;
    var len = css.length;
    var stack = [];

    function skipComment() {
      if (css[i] === '/' && css[i + 1] === '*') {
        var close = css.indexOf('*/', i + 2);
        i = close === -1 ? len : close + 2;
        return true;
      }
      return false;
    }

    while (i < len) {
      if (skipComment()) continue;
      var c = css[i];
      if (c === '}') {
        if (stack.length) {
          var open = stack.pop();
          open.node.end = i + 1;
          open.node.bodyEnd = i;
        }
        i++;
        continue;
      }
      if (/\s/.test(c)) { i++; continue; }

      // Read a prelude up to `{` or `;`.
      var preludeStart = i;
      var quote = null;
      var depth = 0;
      while (i < len) {
        var ch = css[i];
        if (quote) {
          if (ch === quote && css[i - 1] !== '\\') quote = null;
          i++;
          continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
        if (ch === '/' && css[i + 1] === '*') { skipComment(); continue; }
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if ((ch === '{' || ch === ';' || ch === '}') && depth === 0) break;
        i++;
      }
      var prelude = css.slice(preludeStart, i);
      if (css[i] === ';' || i >= len || css[i] === '}') {
        // Statement at-rule (@import, @charset) or stray text.
        if (prelude.trim()) {
          nodes.push({
            type: 'statement',
            text: prelude.trim(),
            start: preludeStart,
            end: i + 1,
            atPath: stack.map(function (s) { return s.node.prelude; })
          });
        }
        i++;
        continue;
      }

      var bodyStart = i + 1;
      var isAt = prelude.trim()[0] === '@';
      // @media/@supports/@layer hold rules; @keyframes/@font-face hold blocks we
      // do not need to index further, but tracking them keeps brace depth right.
      var nestsRules = isAt && /^@(media|supports|layer|document|scope)\b/i.test(prelude.trim());

      var node;
      if (isAt) {
        var m = /^@([\w-]+)\s*([\s\S]*)$/.exec(prelude.trim());
        node = {
          type: 'atrule',
          name: m ? m[1].toLowerCase() : '',
          params: m ? m[2].trim() : '',
          prelude: prelude.trim(),
          start: preludeStart,
          bodyStart: bodyStart,
          atPath: stack.map(function (s) { return s.node.prelude; })
        };
      } else {
        node = {
          type: 'rule',
          selectorRaw: prelude.trim(),
          selector: normaliseSelector(prelude),
          prelude: prelude.trim(),
          start: preludeStart,
          bodyStart: bodyStart,
          atPath: stack.map(function (s) { return s.node.prelude; })
        };
      }
      nodes.push(node);

      if (nestsRules || (isAt && !/^@(font-face|page|keyframes|-webkit-keyframes|property|counter-style|font-palette-values)\b/i.test(prelude.trim()))) {
        stack.push({ node: node });
        i = bodyStart;
        continue;
      }

      // Leaf block: scan to its matching close brace and read declarations.
      var d2 = 1;
      var j = bodyStart;
      var q2 = null;
      for (; j < len; j++) {
        var cc = css[j];
        if (q2) { if (cc === q2 && css[j - 1] !== '\\') q2 = null; continue; }
        if (cc === '"' || cc === "'") { q2 = cc; continue; }
        if (cc === '/' && css[j + 1] === '*') {
          var cl = css.indexOf('*/', j + 2);
          j = cl === -1 ? len : cl + 1;
          continue;
        }
        if (cc === '{') d2++;
        else if (cc === '}') { d2--; if (!d2) break; }
      }
      node.bodyEnd = j;
      node.end = Math.min(j + 1, len);
      node.body = css.slice(bodyStart, j);
      // A nested rule inside a rule means the creator used CSS nesting, which
      // JanitorAI strips. Flag it rather than trying to interpret it.
      node.hasNestedBlock = /\{/.test(node.body);
      node.decls = node.hasNestedBlock ? [] : parseDeclarations(node.body, bodyStart);
      i = node.end;
    }

    // Any unterminated block still on the stack runs to end of input.
    stack.forEach(function (s) {
      s.node.end = len;
      s.node.bodyEnd = len;
      s.node.unterminated = true;
    });

    return nodes;
  }

  function lineOf(css, index) {
    var line = 1;
    for (var i = 0; i < index && i < css.length; i++) if (css[i] === '\n') line++;
    return line;
  }

  /* Top-level rules only (not inside @media), matching a normalised selector. */
  function findRule(css, selector, opts) {
    var wanted = normaliseSelector(selector);
    var media = opts && opts.media ? normaliseSelector(opts.media) : '';
    var nodes = parse(css);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.type !== 'rule') continue;
      if (n.selector !== wanted) continue;
      var path = (n.atPath || []).map(normaliseSelector).join(' ');
      if (media ? path.indexOf(media) === -1 : path !== '') continue;
      return n;
    }
    return null;
  }

  function getDeclaration(css, selector, prop, opts) {
    var rule = findRule(css, selector, opts);
    if (!rule) return null;
    var found = null;
    rule.decls.forEach(function (d) {
      if (d.prop.toLowerCase() === prop.toLowerCase()) found = d; // last wins
    });
    return found;
  }

  function indentOf(css, rule) {
    var lineStart = css.lastIndexOf('\n', rule.start) + 1;
    var m = /^[ \t]*/.exec(css.slice(lineStart, rule.start));
    return (m ? m[0] : '') + '  ';
  }

  /*
   * Inserts, updates or (value === null) removes one declaration, leaving the
   * rest of the sheet byte-identical.
   */
  function setDeclaration(css, selector, prop, value, opts) {
    opts = opts || {};
    var rule = findRule(css, selector, opts);
    var remove = value === null || value === undefined || value === '';

    if (!rule) {
      if (remove) return css;
      var block = selector + ' {\n  ' + prop + ': ' + value + ';\n}\n';
      if (opts.media) {
        block = '@media ' + opts.media + ' {\n  ' + selector +
          ' {\n    ' + prop + ': ' + value + ';\n  }\n}\n';
      }
      var sep = css && !/\n\s*$/.test(css) ? '\n\n' : (css ? '\n' : '');
      return css + sep + block;
    }

    var existing = null;
    rule.decls.forEach(function (d) {
      if (d.prop.toLowerCase() === prop.toLowerCase()) existing = d;
    });

    if (existing) {
      if (remove) {
        // Delete the whole line when the declaration owns one, so removing a
        // property does not leave a stranded blank line behind.
        var from = existing.start;
        var to = existing.end;
        while (css[to] === ' ' || css[to] === '\t') to++;
        if (css[to] === ';') to++;
        while (from > 0 && (css[from - 1] === ' ' || css[from - 1] === '\t')) from--;
        if (css[from - 1] === '\n' && /^[ \t]*(\n|$)/.test(css.slice(to))) {
          var nl = css.indexOf('\n', to);
          to = nl === -1 ? css.length : nl + 1;
        }
        return css.slice(0, from) + css.slice(to);
      }
      var replacement = prop + ': ' + value + (existing.important ? ' !important' : '');
      return css.slice(0, existing.start) + replacement + css.slice(existing.end);
    }

    if (remove) return css;

    // Append as its own line, re-indented to match the rule, with the closing
    // brace put back where it was.
    var indent = indentOf(css, rule);
    var closeIndent = indent.slice(0, -2);
    var body = css.slice(rule.bodyStart, rule.bodyEnd).replace(/\s+$/, '');
    var needsSemi = body && !/;$/.test(body);
    return css.slice(0, rule.bodyStart) + body + (needsSemi ? ';' : '') +
      '\n' + indent + prop + ': ' + value + ';\n' + closeIndent +
      css.slice(rule.bodyEnd);
  }

  global.CssModel = {
    parse: parse,
    normaliseSelector: normaliseSelector,
    findRule: findRule,
    getDeclaration: getDeclaration,
    setDeclaration: setDeclaration,
    lineOf: lineOf
  };
})(window);
