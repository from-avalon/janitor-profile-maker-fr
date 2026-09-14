/*
 * JanitorAI strips a specific set of CSS features from profile stylesheets.
 * Anything in that set will look fine in a normal browser and then silently do
 * nothing once you paste it into your profile — which is exactly the failure
 * this app exists to prevent.
 *
 * So the linter does two jobs: it reports the offending declarations, and it
 * removes them from the stylesheet before the preview sees it. What renders in
 * the preview is therefore what JanitorAI will actually render.
 *
 * Source: "Disabled CSS / HTML Properties on JAI" in Puppy's reference guide.
 */
(function (global) {
  'use strict';

  /* Exact property names JanitorAI drops. */
  var BLOCKED_PROPERTIES = {
    'scrollbar-width': 'Scrollbars cannot be restyled on JanitorAI.',
    'scrollbar-color': 'Scrollbars cannot be restyled on JanitorAI.',
    'scrollbar-gutter': 'Scrollbars cannot be restyled on JanitorAI.',
    'overflow-clip-margin': 'Not supported on JanitorAI.',
    'scroll-behavior': 'Scroll control is disabled on JanitorAI.',
    'scroll-behaviour': 'Scroll control is disabled on JanitorAI.',
    'place-items': 'Use align-items and justify-items instead.',
    'column-gap': 'Use the gap shorthand instead.',
    'row-gap': 'Use the gap shorthand instead.',
    'offset-path': 'Motion paths are disabled on JanitorAI.',
    'offset-distance': 'Motion paths are disabled on JanitorAI.',
    'offset-rotate': 'Motion paths are disabled on JanitorAI.',
    'offset-anchor': 'Motion paths are disabled on JanitorAI.',
    'mask-composite': 'Use the mask shorthand instead.',
    'interpolate-size': 'Use width: calc-size(...) instead.'
  };

  /* Property-name patterns that are blocked as a family. */
  var BLOCKED_PATTERNS = [
    { re: /^scroll-margin(-|$)/, msg: 'Scroll control is disabled on JanitorAI.' },
    { re: /^scroll-padding(-|$)/, msg: 'Scroll control is disabled on JanitorAI.' },
    { re: /^scroll-snap-/, msg: 'Scroll snapping is disabled on JanitorAI.' },
    {
      re: /-(inline|block)-(start|end)$/,
      msg: 'Logical inset/margin/padding properties are disabled. Use the physical property (top/right/bottom/left).'
    }
  ];

  var BLOCKED_AT_RULES = {
    property: '@property is disabled on JanitorAI.',
    container: '@container queries are disabled on JanitorAI.'
  };

  /* Elements JanitorAI removes from profile/bio HTML. CSS may still select
   * them where the site renders them itself; this list is for the reference
   * panel, not for linting stylesheets. */
  var BLOCKED_HTML = [
    'svg', 'button', 'label', 'video src', 'audio', 'path', 'script', 'textpath'
  ];

  function issue(css, node, start, end, severity, title, hint) {
    return {
      line: global.CssModel.lineOf(css, start),
      start: start,
      end: end,
      severity: severity,
      title: title,
      hint: hint,
      context: node && node.type === 'rule' ? node.selectorRaw : (node && node.prelude) || ''
    };
  }

  /* Finds a substring in a declaration while ignoring quoted text. */
  function findOutsideStrings(text, re) {
    var stripped = text.replace(/(['"])(?:\\.|[^\\])*?\1/g, function (m) {
      return new Array(m.length + 1).join(' ');
    });
    re.lastIndex = 0;
    return re.exec(stripped);
  }

  function analyse(css) {
    var nodes = global.CssModel.parse(css);
    var issues = [];

    nodes.forEach(function (node) {
      if (node.type === 'atrule') {
        var blockedAt = BLOCKED_AT_RULES[node.name];
        if (blockedAt) {
          issues.push(issue(css, node, node.start, node.end, 'blocked',
            '@' + node.name + ' is stripped by JanitorAI', blockedAt));
        }
        return;
      }
      if (node.type !== 'rule') return;

      if (node.hasNestedBlock) {
        issues.push(issue(css, node, node.start, node.end, 'blocked',
          'CSS nesting is stripped by JanitorAI',
          'Write each selector as its own top-level rule, e.g. `.a .b { … }`.'));
        return;
      }

      node.decls.forEach(function (d) {
        var prop = d.prop.toLowerCase();

        if (prop.indexOf('--') === 0) {
          issues.push(issue(css, node, d.start, d.end, 'blocked',
            'Custom properties are stripped by JanitorAI',
            'Replace `' + d.prop + '` with the literal value everywhere it is used.'));
          return;
        }

        var msg = BLOCKED_PROPERTIES[prop];
        if (!msg) {
          for (var i = 0; i < BLOCKED_PATTERNS.length; i++) {
            if (BLOCKED_PATTERNS[i].re.test(prop)) { msg = BLOCKED_PATTERNS[i].msg; break; }
          }
        }
        if (msg) {
          issues.push(issue(css, node, d.start, d.end, 'blocked',
            '`' + d.prop + '` is stripped by JanitorAI', msg));
          return;
        }

        if (findOutsideStrings(d.value, /\bvar\s*\(/i)) {
          issues.push(issue(css, node, d.start, d.end, 'blocked',
            'var() is stripped by JanitorAI',
            'CSS variables do not work in profile CSS — paste the literal value in.'));
          return;
        }
        if (findOutsideStrings(d.value, /\burl\s*\(/i)) {
          issues.push(issue(css, node, d.start, d.end, 'blocked',
            'url() is stripped by JanitorAI',
            'Backgrounds have to be gradients or plain colours. Real images go in your ' +
            'profile picture, banner and bio fields, not in the stylesheet.'));
          return;
        }
        if (findOutsideStrings(d.value, /\battr\s*\(/i)) {
          issues.push(issue(css, node, d.start, d.end, 'blocked',
            'attr() is stripped by JanitorAI',
            'Write the text literally in `content` instead.'));
        }
      });
    });

    issues.sort(function (a, b) { return a.start - b.start; });
    return issues;
  }

  /*
   * Removes every blocked construct so the preview shows what JanitorAI shows.
   * Cuts run back-to-front so earlier offsets stay valid.
   */
  function sanitise(css) {
    var issues = analyse(css);
    var out = css;
    for (var i = issues.length - 1; i >= 0; i--) {
      var it = issues[i];
      var start = it.start;
      var end = it.end;
      if (out[end] === ';') end++;
      // Take the indentation and the now-empty line with it, so the sanitised
      // sheet stays readable if anyone looks at it.
      while (start > 0 && (out[start - 1] === ' ' || out[start - 1] === '\t')) start--;
      if (out[start - 1] === '\n' && /^[ \t]*(\n|$)/.test(out.slice(end))) {
        var nl = out.indexOf('\n', end);
        end = nl === -1 ? out.length : nl + 1;
      }
      out = out.slice(0, start) + out.slice(end);
    }
    return out;
  }

  // ------------------------------------------------------------------- HTML
  //
  // The payload is About Me markup, so the disabled-elements list applies to it
  // directly: JanitorAI removes these before your profile ever renders.

  var BLOCKED_TAGS = {
    script: 'Scripts never run on JanitorAI.',
    svg: 'Inline SVG is removed. Use an <img> or a CSS gradient shape instead.',
    path: 'Part of an <svg>, which JanitorAI removes.',
    textpath: 'Part of an <svg>, which JanitorAI removes.',
    button: 'Use a styled <div> or <a> instead.',
    label: 'Use a styled <span> or <div> instead.',
    audio: 'Audio embeds are removed.',
    input: 'Every input type is disabled on JanitorAI.'
  };

  var TAG_RE = /<\s*([a-zA-Z][\w-]*)\b[^>]*>/g;
  var VOID_TAGS = { input: 1, img: 1, br: 1, hr: 1, source: 1, track: 1 };

  /* End offset of an element, counting nested same-name tags. */
  function elementEnd(html, tag, openStart, openEnd) {
    if (VOID_TAGS[tag] || /\/>\s*$/.test(html.slice(openStart, openEnd))) return openEnd;
    var re = new RegExp('<\\s*(/?)' + tag + '\\b[^>]*>', 'gi');
    re.lastIndex = openEnd;
    var depth = 1;
    var m;
    while ((m = re.exec(html))) {
      depth += m[1] ? -1 : 1;
      if (!depth) return m.index + m[0].length;
    }
    return html.length;   // unclosed; JanitorAI would drop the rest anyway
  }

  // ---------------------------------------------------------------- SPACING
  //
  // Not a JanitorAI quirk — a plain HTML/CSS one that bites just as hard here:
  // a whitespace-only text node between two inline-level siblings renders as a
  // real space. Writing a row of chips one per line (the readable way to write
  // markup) is exactly the shape that triggers it. This is advisory, not
  // blocked — nothing is stripped, and the preview already renders the gap
  // faithfully — it just points at where to look before wondering why a chip
  // row has more air in it than the CSS asked for.

  /* display for tags whose UA default isn't 'inline', for the tags this app's
   * own markup actually uses. Anything missing falls back to 'inline', same
   * as a browser's default for an unrecognised or custom tag. */
  var DEFAULT_DISPLAY = {
    style: 'none', script: 'none', template: 'none',
    div: 'block', section: 'block', article: 'block', header: 'block',
    footer: 'block', nav: 'block', aside: 'block', main: 'block', p: 'block',
    h1: 'block', h2: 'block', h3: 'block', h4: 'block', h5: 'block', h6: 'block',
    ul: 'block', ol: 'block', li: 'block', figure: 'block', figcaption: 'block',
    blockquote: 'block', hr: 'block', details: 'block', summary: 'block'
  };

  var INLINE_LEVEL = { inline: 1, 'inline-block': 1, 'inline-flex': 1, 'inline-grid': 1, 'inline-table': 1 };
  var FLOW_BREAKS_GAP = { flex: 1, 'inline-flex': 1, grid: 1, 'inline-grid': 1 };

  /* Splits selector text on top-level occurrences of a character, skipping
   * anything inside [], () or quotes so `:not(a, b)` and `[data-x=", "]`
   * don't get cut in half. */
  function splitOutside(text, ch) {
    var out = [], depth = 0, quote = null, start = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '[' || c === '(') depth++;
      else if (c === ']' || c === ')') depth--;
      else if (depth === 0 && c === ch) { out.push(text.slice(start, i)); start = i + 1; }
    }
    out.push(text.slice(start));
    return out;
  }

  /* Splits a selector chain into its combinator-separated compounds, e.g.
   * `.cs-tags a` → ['.cs-tags', 'a']. The last one is the part that actually
   * matches the element carrying the declaration; earlier ones name its
   * ancestors. */
  function combinatorParts(chain) {
    var text = chain.trim();
    var depth = 0, quote = null, start = 0, parts = [];
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '[' || c === '(') depth++;
      else if (c === ']' || c === ')') depth--;
      else if (depth === 0 && (c === '>' || c === '+' || c === '~' || /\s/.test(c))) {
        if (i > start) parts.push(text.slice(start, i));
        while (i < text.length && /[>+~\s]/.test(text[i])) i++;
        start = i--;
      }
    }
    if (start < text.length) parts.push(text.slice(start));
    return parts;
  }

  /* Tag name and class list a compound simple selector matches, or null for a
   * pseudo-element (::before, ::after — no DOM node of its own to gap). */
  function tagAndClasses(compound) {
    if (compound.indexOf('::') !== -1) return null;
    var tag = /^[a-zA-Z][\w-]*/.exec(compound);
    var classes = [], re = /\.([\w-]+)/g, m;
    while ((m = re.exec(compound))) classes.push(m[1]);
    if (!tag && !classes.length) return null;
    return { tag: tag ? tag[0].toLowerCase() : null, classes: classes };
  }

  /*
   * The display/position the creator's own CSS declares for a tag or class,
   * last-declared-in-document-order wins within each map — a heuristic, not a
   * cascade, good enough to warn with (these issues stay advisory and never
   * feed sanitisePayload's removal logic).
   *
   * A *bare* key (`tag:a`, `class:cs-launch`) applies wherever that tag/class
   * shows up, which is wrong when a selector only meant it under one ancestor
   * — `.cs-tags span { display: inline-block }` and a later, unrelated
   * `.roster-head span { display: none }` would otherwise fight over the same
   * `tag:span` key. So a chain with more than one compound (`.cs-tags a`)
   * also registers a *qualified* key scoping the tail to its nearest named
   * ancestor (`class:cs-tags>tag:a`); resolving an element checks those
   * against its real ancestor chain before falling back to the bare map.
   */
  function declaredStyles(payload) {
    var display = {}, qDisplay = {}, position = {}, qPosition = {};
    global.JaiPayload.styleBlocks(payload).forEach(function (block) {
      global.CssModel.parse(block.css).forEach(function (node) {
        if (node.type !== 'rule' || node.hasNestedBlock) return;
        var disp = null, pos = null;
        node.decls.forEach(function (d) {
          var prop = d.prop.toLowerCase();
          if (prop === 'display') disp = d.value.toLowerCase();
          else if (prop === 'position') pos = d.value.toLowerCase();
        });
        if (!disp && !pos) return;
        splitOutside(node.selectorRaw, ',').forEach(function (chain) {
          var parts = combinatorParts(chain);
          if (!parts.length) return;
          var tail = tagAndClasses(parts[parts.length - 1]);
          if (!tail) return;
          var tailKeys = tail.classes.map(function (c) { return 'class:' + c; });
          if (tail.tag) tailKeys.push('tag:' + tail.tag);
          tailKeys.forEach(function (k) {
            if (disp) display[k] = disp;
            if (pos) position[k] = pos;
          });

          if (parts.length < 2) return;
          var ancestor = tagAndClasses(parts[parts.length - 2]);
          if (!ancestor) return;
          var ancKeys = ancestor.classes.map(function (c) { return 'class:' + c; });
          if (ancestor.tag) ancKeys.push('tag:' + ancestor.tag);
          ancKeys.forEach(function (ak) {
            tailKeys.forEach(function (tk) {
              var key = ak + '>' + tk;
              if (disp) qDisplay[key] = disp;
              if (pos) qPosition[key] = pos;
            });
          });
        });
      });
    });
    return { display: display, qDisplay: qDisplay, position: position, qPosition: qPosition };
  }

  function readAttr(name, attrs) {
    var m = new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(attrs || '');
    return m ? (m[2] != null ? m[2] : m[3]) : '';
  }

  var SPACING_TAG_RE = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)\b([^>]*)>/g;

  /*
   * Finds whitespace-only text nodes between two sibling elements that are
   * both inline-level inside a normal-flow parent — the shape that turns an
   * indented, readable chip row into one with visible extra gaps. A comment
   * between two tags is treated as breaking the adjacency rather than as
   * transparent: it under-reports a rarer edge case in exchange for never
   * flagging something that isn't really a sibling gap.
   */
  function analyseSpacing(payload) {
    var styles = declaredStyles(payload);
    var blocks = global.JaiPayload.styleBlocks(payload);
    function inStyleCss(i) {
      return blocks.some(function (b) { return i >= b.cssStart && i < b.cssEnd; });
    }

    function elementOf(tag, attrs) {
      var classAttr = readAttr('class', attrs).trim();
      return { tag: tag.toLowerCase(), classes: classAttr ? classAttr.split(/\s+/) : [] };
    }
    function tokensOf(el) {
      var t = el.classes.map(function (c) { return 'class:' + c; });
      if (el.tag) t.push('tag:' + el.tag);
      return t;
    }
    /* Checks the qualified map against `el`'s real ancestor chain (nearest
     * first) before falling back to the bare, ancestor-blind map. */
    function effective(el, ancestors, bare, qualified, fallback) {
      var elTokens = tokensOf(el);
      for (var a = ancestors.length - 1; a >= 0; a--) {
        var ancTokens = tokensOf(ancestors[a]);
        for (var i = 0; i < ancTokens.length; i++) {
          for (var j = 0; j < elTokens.length; j++) {
            var v = qualified[ancTokens[i] + '>' + elTokens[j]];
            if (v != null) return v;
          }
        }
      }
      var value = null;
      el.classes.forEach(function (c) { if (bare['class:' + c] != null) value = bare['class:' + c]; });
      if (value == null && bare['tag:' + el.tag] != null) value = bare['tag:' + el.tag];
      return value == null ? fallback : value;
    }
    function displayOf(el, ancestors) {
      return effective(el, ancestors, styles.display, styles.qDisplay, DEFAULT_DISPLAY[el.tag] || 'inline');
    }
    function outOfFlow(el, ancestors) {
      var p = effective(el, ancestors, styles.position, styles.qPosition, 'static');
      return p === 'absolute' || p === 'fixed';
    }

    var issues = [];
    var stack = [{ tag: '', classes: [] }];   // synthetic root: whatever wraps About Me content
    var lastEnd = 0;
    var lastEl = null;   // the element that most recently finished (closed, void, or self-closing)
    var m;

    SPACING_TAG_RE.lastIndex = 0;
    while ((m = SPACING_TAG_RE.exec(payload))) {
      if (inStyleCss(m.index)) continue;   // raw CSS text: never a sibling gap

      var gap = payload.slice(lastEnd, m.index);
      var isComment = m[0].slice(0, 4) === '<!--';

      if (!isComment && m[2] && lastEl && gap !== '' && /^\s+$/.test(gap)) {
        // An element is about to open, right after another one finished, with
        // nothing but whitespace between them: a real sibling-gap candidate.
        var next = elementOf(m[2], m[3]);
        var parent = stack[stack.length - 1];
        if (!FLOW_BREAKS_GAP[displayOf(parent, stack.slice(0, -1))] &&
            INLINE_LEVEL[displayOf(lastEl, stack)] && INLINE_LEVEL[displayOf(next, stack)] &&
            !outOfFlow(lastEl, stack) && !outOfFlow(next, stack)) {
          issues.push({
            line: global.CssModel.lineOf(payload, m.index - gap.length),
            start: m.index - gap.length,
            end: m.index,
            severity: 'advisory',
            title: 'Whitespace between `<' + lastEl.tag + '>` and `<' + next.tag + '>` will show as a gap',
            hint: 'Both sit inline in normal flow, so the blank space between their tags renders as ' +
                  'a real space beyond any margin or gap you set. Close one tag and open the next with ' +
                  'no space between `>` and `<`, or break the run with an HTML comment instead.',
            context: '<' + lastEl.tag + '> … <' + next.tag + '>'
          });
        }
      }

      lastEnd = m.index + m[0].length;
      if (isComment) { lastEl = null; continue; }

      if (m[1]) {
        // Closing tag: pop back to (and including) the element it closes.
        var closed = null;
        for (var s = stack.length - 1; s >= 1; s--) {
          if (stack[s].tag === m[1].toLowerCase()) { closed = stack.splice(s)[0]; break; }
        }
        lastEl = closed || { tag: m[1].toLowerCase(), classes: [] };
        continue;
      }

      var el = elementOf(m[2], m[3]);
      if (VOID_TAGS[el.tag] || /\/\s*>$/.test(m[0])) {
        lastEl = el;   // self-closing or void: opens and finishes in the same token
      } else {
        stack.push(el);
        lastEl = null;   // now inside it — nothing has *finished* yet
      }
    }

    return issues;
  }

  /* Reports disabled elements, ignoring anything inside a <style> block. */
  function analyseHtml(payload) {
    var blocks = global.JaiPayload.styleBlocks(payload);
    function inStyle(i) {
      return blocks.some(function (b) { return i >= b.start && i < b.end; });
    }

    var issues = [];
    var m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(payload))) {
      if (inStyle(m.index)) continue;
      var tag = m[1].toLowerCase();
      var why = BLOCKED_TAGS[tag];
      if (!why) continue;
      issues.push({
        line: global.CssModel.lineOf(payload, m.index),
        // The underline covers just the opening tag so the editor stays
        // readable; `cutEnd` is where the removal actually stops.
        start: m.index,
        end: m.index + m[0].length,
        cutEnd: elementEnd(payload, tag, m.index, m.index + m[0].length),
        severity: 'blocked',
        title: '`<' + tag + '>` is removed by JanitorAI',
        hint: why + ' The element and its contents are dropped, which is what ' +
              'the preview shows.',
        context: 'About Me markup'
      });
    }
    return issues;
  }

  /*
   * Lints the whole About Me payload: the CSS inside every <style> block, plus
   * the markup around them. Offsets are reported against the payload so the
   * editor can underline them.
   */
  function analysePayload(payload) {
    var issues = analyseHtml(payload);
    global.JaiPayload.styleBlocks(payload).forEach(function (block) {
      analyse(block.css).forEach(function (it) {
        it.start += block.cssStart;
        it.end += block.cssStart;
        it.line = global.CssModel.lineOf(payload, it.start);
        issues.push(it);
      });
    });
    issues = issues.concat(analyseSpacing(payload));
    issues.sort(function (a, b) { return a.start - b.start; });

    // A blocked element can contain more blocked elements (<svg> holds <path>).
    // Only the outermost is reported: it is the one the creator has to delete,
    // and it keeps the removal ranges in sanitisePayload from overlapping.
    var kept = [];
    var covered = -1;
    issues.forEach(function (it) {
      if (it.start < covered) return;
      kept.push(it);
      covered = Math.max(covered, it.cutEnd != null ? it.cutEnd : it.end);
    });
    return kept;
  }

  /*
   * What JanitorAI would actually store: blocked declarations gone from the
   * style blocks, blocked elements gone from the markup. This is what the
   * preview renders, which is why the preview can be trusted.
   */
  function sanitisePayload(payload) {
    // Advisory issues (see analyseSpacing) flag whitespace the preview should
    // keep rendering exactly as JanitorAI would — nothing here gets removed.
    var issues = analysePayload(payload).filter(function (it) { return it.severity !== 'advisory'; });
    var out = payload;
    for (var i = issues.length - 1; i >= 0; i--) {
      var it = issues[i];
      var start = it.start;
      var end = it.cutEnd != null ? it.cutEnd : it.end;
      if (it.cutEnd == null) {
        // A CSS declaration: take its semicolon and its now-empty line too.
        if (out[end] === ';') end++;
        while (start > 0 && (out[start - 1] === ' ' || out[start - 1] === '\t')) start--;
        if (out[start - 1] === '\n' && /^[ \t]*(\n|$)/.test(out.slice(end))) {
          var nl = out.indexOf('\n', end);
          end = nl === -1 ? out.length : nl + 1;
        }
      }
      out = out.slice(0, start) + out.slice(end);
    }
    return out;
  }

  global.JaiLint = {
    analyse: analyse,
    sanitise: sanitise,
    analyseHtml: analyseHtml,
    analyseSpacing: analyseSpacing,
    analysePayload: analysePayload,
    sanitisePayload: sanitisePayload,
    blockedHtml: BLOCKED_HTML,
    blockedTags: BLOCKED_TAGS,
    blockedProperties: BLOCKED_PROPERTIES
  };
})(window);
