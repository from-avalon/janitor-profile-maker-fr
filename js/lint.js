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
    var issues = analysePayload(payload);
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
    analysePayload: analysePayload,
    sanitisePayload: sanitisePayload,
    blockedHtml: BLOCKED_HTML,
    blockedTags: BLOCKED_TAGS,
    blockedProperties: BLOCKED_PROPERTIES
  };
})(window);
