/*
 * JanitorAI Profile CSS Studio.
 *
 * The editor holds one document: the contents of your JanitorAI About Me box,
 * which is HTML with <style> blocks in it. That document is the only state that
 * matters. The visual controls read their values out of its CSS and write back
 * into it; the preview is fed the same document after the linter has removed
 * whatever JanitorAI would strip. Nothing renders in the preview that would not
 * render on your profile.
 */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var STORE_KEY = 'jai-css-studio:v2';

  var VIEWPORTS = {
    wide: { w: 1920, h: 1080, label: 'Wide' },
    desktop: { w: 1440, h: 900, label: 'Desktop' },
    laptop: { w: 1200, h: 820, label: 'Laptop' },
    tablet: { w: 768, h: 1024, label: 'Tablet' },
    mobile: { w: 390, h: 844, label: 'Mobile' },
    custom: { w: 1600, h: 1000, label: 'Custom' }
  };

  var DEFAULT_DATA = {
    username: 'Sweepercom',
    avatar: 'assets/WtA9WX5eLu1adhMz9xxrA-8778bb.webp',
    followers: '1,192',
    memberSince: 'Jan 6, 2025',
    background: '',
    // username/avatar/followers/memberSince/background are no longer editable
    // in the Settings panel -- click them directly in the preview instead
    // (see the 'fieldEdit' message case below). They stay in DEFAULT_DATA
    // because the bundled/imported profile still supplies real values for them.
    showBadges: true,
    janitorPlus: false,
    viewMode: 'visitor',
    cardCount: 12,
    userMenu: false
  };

  var state = {
    code: '',
    data: Object.assign({}, DEFAULT_DATA),
    viewport: 'desktop',
    enforce: true,
    inspector: false,
    panel: 'presets',
    zoom: 'fit',
    zoomScale: 1,
    previewCss: true,
    customWidth: 1600,
    sidebarWidth: null,
    inspectorWidth: null,
    sidebarHidden: false,
    inspectorHidden: false,
    autoParts: []          // template part ids added only because another part needed them
  };

  var importedProfile = false;
  var hadSavedData = false;
  var profileSnapshots = [];
  var activeProfileId = null;
  var keepDefaultProfile = true;
  var profileIdSeq = 0;

  var frameReady = false;
  var index = {};          // normalised selector -> { property: value }
  var lintIssues = [];

  // ------------------------------------------------------------ persistence

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        code: state.code, data: state.data, viewport: state.viewport,
        enforce: state.enforce, customWidth: state.customWidth, zoom: state.zoom,
        zoomScale: state.zoomScale, previewCss: state.previewCss, autoParts: state.autoParts,
        sidebarWidth: state.sidebarWidth, inspectorWidth: state.inspectorWidth,
        sidebarHidden: state.sidebarHidden, inspectorHidden: state.inspectorHidden
      }));
    } catch (e) { /* private mode, quota — not worth interrupting the user */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (typeof saved.code === 'string') state.code = saved.code;
      if (typeof saved.customWidth === 'number') state.customWidth = saved.customWidth;
      if (saved.zoom === 'fit' || saved.zoom === 'actual' || saved.zoom === 'manual') state.zoom = saved.zoom;
      if (typeof saved.zoomScale === 'number') state.zoomScale = Math.max(0.25, Math.min(2, saved.zoomScale));
      if (typeof saved.previewCss === 'boolean') state.previewCss = saved.previewCss;
      if (typeof saved.sidebarWidth === 'number') state.sidebarWidth = saved.sidebarWidth;
      if (typeof saved.inspectorWidth === 'number') state.inspectorWidth = saved.inspectorWidth;
      if (typeof saved.sidebarHidden === 'boolean') state.sidebarHidden = saved.sidebarHidden;
      if (typeof saved.inspectorHidden === 'boolean') state.inspectorHidden = saved.inspectorHidden;
      if (Array.isArray(saved.autoParts)) state.autoParts = saved.autoParts;
      if (saved.data) {
        state.data = Object.assign({}, DEFAULT_DATA, saved.data);
        hadSavedData = true;
      }
      if (saved.viewport && VIEWPORTS[saved.viewport]) state.viewport = saved.viewport;
      if (typeof saved.enforce === 'boolean') state.enforce = saved.enforce;
    } catch (e) { /* corrupt payload; fall back to defaults */ }
  }

  // ---------------------------------------------------------------- preview

  var frame = $('#preview');

  function post(msg) {
    if (frameReady && frame.contentWindow) frame.contentWindow.postMessage(msg, '*');
  }

  var pushTimer = null;
  function pushPayload() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      var payload = state.enforce
        ? window.JaiLint.sanitisePayload(state.code)
        : state.code;
      // The <style> blocks are hoisted out of the markup and handed to the
      // frame separately. They still land last in the cascade, so the result is
      // identical to leaving them in the About Me box — but CSS-only edits then
      // never rebuild the DOM, which keeps images and animations from flashing
      // on every keystroke.
      post({
        type: 'payload',
        css: state.previewCss ? window.JaiPayload.allCss(payload) : '',
        html: stripStyleBlocks(payload)
      });
    }, 60);
  }

  function stripStyleBlocks(payload) {
    var blocks = window.JaiPayload.styleBlocks(payload);
    var out = payload;
    for (var i = blocks.length - 1; i >= 0; i--) {
      out = out.slice(0, blocks[i].start) + out.slice(blocks[i].end);
    }
    return out;
  }

  function pushData() { post({ type: 'data', data: state.data }); }

  /*
   * When the studio is embedded (see next/app/studio), the host page forwards
   * these to GA4. Names and a coarse label only -- never the creator's CSS,
   * which is their work. A no-op when running standalone.
   */
  function reportToHost(name, label) {
    if (window.parent === window) {
      // Standalone: no host to forward to, so report to GA directly if the
      // page loaded it. Same contract — a name and a coarse label, never CSS.
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, { label: label || '', content_group: 'janitor-profile-maker' });
      }
      return;
    }
    try {
      window.parent.postMessage(
        { source: 'jai-studio', type: 'analytics', name: name, label: label || '' },
        window.location.origin);
    } catch (e) { /* embedded cross-origin; nothing to report to */ }
  }

  function pushProfile(profile) {
    post({ type: 'profile', html: profile.html, css: profile.css });
  }

  /*
   * The frame announces itself with a 'ready' message, but that can arrive
   * before this listener exists: the browser starts loading the iframe as soon
   * as the parser reaches it, which is before app.js runs. Miss that message
   * and the preview never receives anything at all. So the iframe's own load
   * event is treated as the real handshake -- by then the frame is definitely
   * listening -- and 'ready' is kept as a second, idempotent path.
   */
  function connectFrame() {
    if (frameReady) return;
    frameReady = true;
    pushData();
    pushPayload();
    post({ type: 'inspector', on: state.inspector });
    loadBundledProfile();
  }

  frame.addEventListener('load', connectFrame);
  try {
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
      connectFrame();
    }
  } catch (e) { /* not same-origin yet; the load event will cover it */ }

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'ready') {
      connectFrame();
    } else if (m.type === 'pick') {
      onPick(m);
    } else if (m.type === 'userMenu') {
      // The preview's own avatar click can open the menu; keep the Settings
      // panel's checkbox showing the truth.
      state.data.userMenu = m.open;
      var box = $('#profile-fields input[data-key="userMenu"]');
      if (box) box.checked = m.open;
      save();
    } else if (m.type === 'fieldEdit') {
      // Username, followers, member-since, avatar and background are edited
      // directly in the preview now (click text to edit; right-click an image
      // to swap it) rather than through Settings-panel fields.
      state.data[m.key] = m.value;
      pushData();
      save();
    }
  });

  // -------------------------------------------------------- stage sizing
  //
  // The iframe is given the real pixel width of the device being simulated and
  // then scaled down to fit the pane. Scaling the frame rather than resizing it
  // is what keeps JanitorAI's own media queries firing at the right widths.

  function layoutStage() {
    var vp = VIEWPORTS[state.viewport];
    if (state.viewport === 'custom') vp = { w: state.customWidth, h: 1000 };
    var scroll = $('#stage-scroll');
    var sizer = $('#stage-sizer');
    var wrap = $('#stage-frame');
    var avail = scroll.clientWidth - 32;
    // clientWidth can read as 0 mid-relayout (toggling the code pane), which
    // would otherwise flash a nonsense zoom figure.
    var fitScale = Math.max(0.05, Math.min(1, avail / vp.w));
    var scale = state.zoom === 'actual' ? 1
      : state.zoom === 'manual' ? state.zoomScale
      : fitScale;

    frame.style.width = vp.w + 'px';
    frame.style.height = vp.h + 'px';
    wrap.style.width = vp.w + 'px';
    wrap.style.height = vp.h + 'px';
    wrap.style.transform = 'scale(' + scale + ')';
    // A transform does not affect layout size, so the sizer reserves the space
    // the scaled frame actually occupies.
    sizer.style.width = Math.round(vp.w * scale) + 'px';
    sizer.style.height = Math.round(vp.h * scale) + 'px';

    $('#stage-size').textContent = vp.w + ' × ' + vp.h;
    $('#stage-zoom').textContent = state.zoom === 'fit' ? 'Fit · ' + Math.round(scale * 100) + '%' : Math.round(scale * 100) + '%';
    $('#stage-zoom').classList.toggle('is-on', state.zoom !== 'fit');
    $('#stage-zoom-slider').value = Math.round(scale * 100);
    // JanitorAI's mobile chrome lives below 576px and was not in the capture.
    $('#stage-notice').hidden = vp.w >= 576;
  }

  window.addEventListener('resize', layoutStage);

  // ----------------------------------------------------------------- editor

  var input = $('#css-input');
  var highlight = $('#highlight');
  // <code id="highlight"> is where the tokenised HTML is written (correct —
  // that's the semantically right element for code content), but it's an
  // inline element, so its own .scrollHeight is unreliable and often reads 0
  // regardless of how much text it holds. The height calc below needs the
  // block-level, absolutely-positioned <pre> that wraps it instead, since
  // that's the element whose scrollHeight actually reflects the full
  // multi-line rendered height.
  var highlightPre = highlight.parentElement;
  var gutter = $('#gutter');
  var editorScroll = $('#editor-scroll');

  function escapeHtml(s) {
    return s.replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  /*
   * The document is HTML with CSS islands, so colouring runs in two modes and
   * switches at the <style> boundaries.
   */
  function tokeniseMixed(text) {
    var blocks = window.JaiPayload.styleBlocks(text);
    var out = '';
    var cursor = 0;
    blocks.forEach(function (b) {
      out += tokeniseHtml(text.slice(cursor, b.cssStart));
      out += tokenise(text.slice(b.cssStart, b.cssEnd));
      cursor = b.cssEnd;
    });
    return out + tokeniseHtml(text.slice(cursor));
  }

  function tokeniseHtml(text) {
    var out = '';
    var re = /(<!--[\s\S]*?(?:-->|$))|(<\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?>)?/g;
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      out += escapeHtml(text.slice(last, m.index));
      if (m[1]) {
        out += '<span class="tok-comment">' + escapeHtml(m[1]) + '</span>';
      } else {
        out += '<span class="tok-punct">' + escapeHtml(m[2]) + '</span>' +
               '<span class="tok-tag">' + escapeHtml(m[3]) + '</span>' +
               tokeniseAttrs(m[4] || '') +
               '<span class="tok-punct">' + escapeHtml(m[5] || '') + '</span>';
      }
      last = re.lastIndex;
    }
    return out + escapeHtml(text.slice(last));
  }

  function tokeniseAttrs(text) {
    var out = '';
    var re = /([\w-]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)?/g;
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      out += escapeHtml(text.slice(last, m.index));
      out += '<span class="tok-attr">' + escapeHtml(m[1]) + '</span>' +
             '<span class="tok-punct">' + escapeHtml(m[2]) + '</span>' +
             '<span class="tok-str">' + escapeHtml(m[3] || '') + '</span>';
      last = re.lastIndex;
    }
    return out + escapeHtml(text.slice(last));
  }

  /* Regex-based colouring. Good enough for a stylesheet you can see all of. */
  function tokenise(text) {
    var out = '';
    var re = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[\w-]+)|(!\s*important)|([\w-]+)(\s*:)|(-?\d*\.?\d+(?:px|rem|em|%|vh|vw|deg|s|ms|fr|ch|ex|pt)?)|(#[0-9a-fA-F]{3,8})|([{};,])/g;
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      out += escapeHtml(text.slice(last, m.index));
      if (m[1]) out += '<span class="tok-comment">' + escapeHtml(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tok-str">' + escapeHtml(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tok-at">' + escapeHtml(m[3]) + '</span>';
      else if (m[4]) out += '<span class="tok-imp">' + escapeHtml(m[4]) + '</span>';
      else if (m[5]) out += '<span class="tok-prop">' + escapeHtml(m[5]) + '</span><span class="tok-punct">' + escapeHtml(m[6]) + '</span>';
      else if (m[7]) out += '<span class="tok-num">' + escapeHtml(m[7]) + '</span>';
      else if (m[8]) out += '<span class="tok-num">' + escapeHtml(m[8]) + '</span>';
      else if (m[9]) out += '<span class="tok-punct">' + escapeHtml(m[9]) + '</span>';
      last = re.lastIndex;
    }
    return out + escapeHtml(text.slice(last));
  }

  function renderHighlight() {
    var css = state.code;
    var html = '';
    var cursor = 0;
    // Blocked and advisory ranges are painted first so the underline wraps
    // whole declarations rather than individual tokens.
    lintIssues.forEach(function (it) {
      if (it.start < cursor) return;
      var tok = it.severity === 'advisory' ? 'tok-advisory' : 'tok-blocked';
      html += tokeniseMixed(css.slice(cursor, it.start));
      html += '<span class="' + tok + '">' + tokeniseMixed(css.slice(it.start, it.end)) + '</span>';
      cursor = it.end;
    });
    html += tokeniseMixed(css.slice(cursor));
    highlight.innerHTML = html + '\n';

    var lines = css.split('\n').length;
    // A line with any blocked issue reads as blocked even if it also has an
    // advisory one; only advisory-only lines get the milder amber marker.
    var bad = {};
    lintIssues.forEach(function (it) {
      if (bad[it.line] !== 'blocked') bad[it.line] = it.severity === 'advisory' ? 'advisory' : 'blocked';
    });
    var g = '';
    for (var i = 1; i <= lines; i++) {
      var cls = bad[i] === 'blocked' ? ' class="has-issue"' : bad[i] === 'advisory' ? ' class="has-advisory"' : '';
      g += '<div' + cls + '>' + i + '</div>';
    }
    gutter.innerHTML = g;

    input.style.height = 'auto';
    input.style.height = Math.max(highlightPre.scrollHeight, editorScroll.clientHeight) + 'px';
    // Match the textarea's box to the widest line. Hardcoded markup is one long
    // line by design, and a textarea left at pane width makes everything you
    // scroll right to impossible to click, select or type into.
    input.style.width = Math.max(highlightPre.scrollWidth, editorScroll.clientWidth) + 'px';
    $('#code-stats').textContent = lines + ' lines · ' + css.length + ' chars';
  }

  editorScroll.addEventListener('scroll', function () {
    gutter.scrollTop = editorScroll.scrollTop;
  });

  function renderLint() {
    var box = $('#lint');
    if (!lintIssues.length) {
      box.innerHTML = '<div class="lint-clean"><b>✓ Clean</b> — nothing here gets stripped by JanitorAI, ' +
        'and no layout gaps either.</div>';
      return;
    }
    // Blocked (JanitorAI strips it) and advisory (nothing stripped, but a
    // whitespace-only text node between two inline elements will render as a
    // gap — see js/lint.js's analyseSpacing) are counted separately: the
    // wording for one would be wrong for the other.
    var blocked = lintIssues.filter(function (it) { return it.severity !== 'advisory'; }).length;
    var advisory = lintIssues.length - blocked;
    var head = [];
    if (blocked) head.push(blocked + (blocked === 1 ? ' blocked rule' : ' blocked rules'));
    if (advisory) head.push(advisory + (advisory === 1 ? ' layout warning' : ' layout warnings'));
    // Amber heading only when there is nothing worse to report — a mix, or
    // blocked issues alone, keeps the more urgent red.
    var html = '<div class="lint-head' + (!blocked && advisory ? ' lint-head--advisory' : '') + '">' +
      head.join(' · ') +
      (advisory ? '<button type="button" class="lint-fix" id="lint-fix-all">Remove ' +
        (advisory === 1 ? 'it' : 'all ' + advisory) + '</button>' : '') +
      '</div>';
    lintIssues.forEach(function (it, i) {
      html += '<button type="button" class="lint-item' + (it.severity === 'advisory' ? ' lint-item--advisory' : '') +
        '" data-issue="' + i + '">' +
        // Titles quote the offending markup, e.g. `<button>`, so escape first
        // and only then turn the backticks into <code>.
        '<div class="lint-title">' +
          escapeHtml(it.title).replace(/`([^`]+)`/g, '<code>$1</code>') + '</div>' +
        '<div class="lint-meta">line ' + it.line + (it.context ? ' · ' + escapeHtml(it.context.slice(0, 60)) : '') + '</div>' +
        '<div class="lint-hint">' + escapeHtml(it.hint) + '</div>' +
        '</button>';
    });
    box.innerHTML = html;
  }

  /*
   * A layout warning marks a run of whitespace that renders as a gap, so the
   * fix is simply to delete that run — the same edit by hand is fiddly to do
   * without disturbing the tags on either side. Cuts run back-to-front so the
   * earlier offsets stay valid.
   */
  function removeGapWhitespace() {
    var gaps = lintIssues.filter(function (it) { return it.severity === 'advisory'; });
    if (!gaps.length) return;
    var next = state.code;
    for (var i = gaps.length - 1; i >= 0; i--) {
      next = next.slice(0, gaps[i].start) + next.slice(gaps[i].end);
    }
    setCode(next, 'lint-fix');
    toast(gaps.length === 1 ? 'Whitespace removed.' : gaps.length + ' gaps closed up.');
  }

  $('#lint').addEventListener('click', function (e) {
    if (e.target.id === 'lint-fix-all') { removeGapWhitespace(); return; }
    var btn = e.target.closest('.lint-item');
    if (!btn) return;
    var it = lintIssues[+btn.dataset.issue];
    if (!it) return;
    input.focus();
    input.setSelectionRange(it.start, it.end);
    // setSelectionRange does not scroll a transparent textarea reliably.
    var lineHeight = 19.2;
    editorScroll.scrollTop = Math.max(0, (it.line - 4) * lineHeight);
  });

  // -------------------------------------------------------------- css state

  function buildIndex(css) {
    var map = {};
    window.CssModel.parse(css).forEach(function (n) {
      if (n.type !== 'rule' || (n.atPath && n.atPath.length)) return;
      // Multiple selectors in one rule (".a, .b") each get the declarations.
      n.selectorRaw.split(',').forEach(function (part) {
        var key = window.CssModel.normaliseSelector(part);
        if (!key) return;
        var bucket = map[key] || (map[key] = {});
        n.decls.forEach(function (d) { bucket[d.prop.toLowerCase()] = d.value; });
      });
    });
    return map;
  }

  var syncingEditor = false;
  var renderTimer = null;
  var RENDER_DEBOUNCE_MS = 180;

  /*
   * Parsing, linting, syntax-highlighting and re-syncing ~130 design controls
   * all scale with document size, and a real theme (hundreds of rules, lots of
   * comments) can push a single pass past a second -- measured ~1.6s at 280KB.
   * Running that synchronously on every keystroke is what makes a big paste
   * feel like the editor has locked up: the browser can't process the next
   * keystroke until the current pass finishes, so several keystrokes in a row
   * can compound into many seconds of apparent unresponsiveness.
   *
   * The textarea itself is native and always instant regardless of any of
   * this -- what's slow is our own analysis, so that's the only part deferred.
   * `state.code` (and, for non-typed changes, the visible textarea) update
   * immediately; the expensive pass runs a beat after things go quiet, so it
   * never fights an in-progress keystroke and only ever runs once per pause
   * rather than once per character.
   */
  function setCode(code, from) {
    state.code = code;

    if (from !== 'editor') {
      syncingEditor = true;
      input.value = code;
      syncingEditor = false;
    }

    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { runAnalysis(from); }, RENDER_DEBOUNCE_MS);
  }

  function runAnalysis(from) {
    try {
      index = buildIndex(window.JaiPayload.allCss(state.code));
      lintIssues = window.JaiLint.analysePayload(state.code);
      renderHighlight();
      renderLint();
      if (from !== 'controls') syncControls();
      if (from !== 'presets') syncPresets();
    syncTemplates();
    syncCustomPresets();
    } catch (err) {
      // Whatever tripped this, the document itself is intact (state.code and
      // the textarea were already updated above) -- only the derived UI, which
      // this call rebuilds from scratch next time, is out of date.
      console.error('JAI Studio: analysis pass failed, will retry on next edit', err);
    }
    pushPayload();
    save();
  }

  /* Runs an edit against the CSS inside the payload's <style> block, creating
   * one if the About Me box does not have a stylesheet yet. */
  function editCss(fn, from) {
    setCode(window.JaiPayload.editCss(state.code, fn), from);
  }

  function readValue(sel, prop) {
    var bucket = index[window.CssModel.normaliseSelector(sel)];
    return bucket ? bucket[prop.toLowerCase()] : undefined;
  }

  function writeValue(sel, prop, value) {
    editCss(function (css) {
      return window.CssModel.setDeclaration(css, sel, prop, value);
    }, 'controls');
  }

  input.addEventListener('input', function () {
    if (syncingEditor) return;
    setCode(input.value, 'editor');
  });

  /* Tab indents instead of leaving the field. */
  input.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    var s = input.selectionStart, t = input.selectionEnd;
    input.value = input.value.slice(0, s) + '  ' + input.value.slice(t);
    input.selectionStart = input.selectionEnd = s + 2;
    setCode(input.value, 'editor');
  });

  // ----------------------------------------------------------- colour utils

  var probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);

  function toHex(value) {
    if (!value) return null;
    var v = String(value).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase();
    }
    if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7).toLowerCase();
    probe.style.color = '';
    probe.style.color = v;
    if (!probe.style.color) return null;
    var rgb = getComputedStyle(probe).color.match(/\d+/g);
    if (!rgb) return null;
    return '#' + rgb.slice(0, 3).map(function (n) {
      return ('0' + (+n).toString(16)).slice(-2);
    }).join('').toLowerCase();
  }

  var SWATCHES = ['#ffffff', '#0e0f13', '#c084fc', '#ff2d95', '#2de2e6', '#57ff8f',
                  '#fbbf24', '#f87171', '#7dd3fc', 'transparent'];

  // --------------------------------------------------------------- controls

  var controlNodes = [];
  var selectedControlTokens = [];

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function clearButton(onClear) {
    var b = el('button', 'ctrl-clear', '×');
    b.type = 'button';
    b.title = 'Remove this property';
    b.addEventListener('click', onClear);
    return b;
  }

  function parseLength(value) {
    var m = /^(-?\d*\.?\d+)\s*([a-z%]*)$/i.exec(String(value || '').trim());
    return m ? { n: parseFloat(m[1]), u: m[2] || '' } : null;
  }

  function buildControl(def) {
    var wrap = el('div', 'ctrl');
    var head = el('div', 'ctrl-head');
    head.appendChild(el('span', 'ctrl-label', escapeHtml(def.label)));
    var chip = el('button', 'ctrl-sel', escapeHtml(def.sel));
    chip.type = 'button';
    chip.title = 'Copy selector and scroll the preview to it';
    chip.addEventListener('click', function () {
      copy(def.sel);
      post({ type: 'scrollTo', selector: def.sel.replace(/:hover.*$/, '').split(':')[0] });
    });
    head.appendChild(chip);
    wrap.appendChild(head);

    var row = el('div', 'ctrl-row');
    wrap.appendChild(row);
    var sync;

    if (def.type === 'color') {
      var picker = el('input');
      picker.type = 'color';
      var textIn = el('input');
      textIn.type = 'text';
      textIn.placeholder = 'e.g. #ff2d95 or rgba(0,0,0,.4)';
      picker.addEventListener('input', function () {
        textIn.value = picker.value;
        writeValue(def.sel, def.prop, picker.value);
      });
      textIn.addEventListener('change', function () {
        writeValue(def.sel, def.prop, textIn.value.trim() || null);
      });
      row.appendChild(picker);
      row.appendChild(textIn);
      row.appendChild(clearButton(function () { writeValue(def.sel, def.prop, null); }));

      var sw = el('div', 'swatch-row');
      SWATCHES.forEach(function (c) {
        var b = el('button', 'swatch');
        b.type = 'button';
        b.title = c;
        b.style.background = c === 'transparent'
          ? 'repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/8px 8px'
          : c;
        b.addEventListener('click', function () { writeValue(def.sel, def.prop, c); });
        sw.appendChild(b);
      });
      wrap.appendChild(sw);

      sync = function (v) {
        textIn.value = v || '';
        var hex = toHex(v);
        if (hex) picker.value = hex;
      };

    } else if (def.type === 'length' || def.type === 'number') {
      var range = el('input');
      range.type = 'range';
      range.min = def.min; range.max = def.max; range.step = def.step;
      var numIn = el('input', 'num');
      numIn.type = 'text';
      var unitSel = null;
      if (def.type === 'length') {
        unitSel = el('select');
        def.units.forEach(function (u) {
          var o = el('option', null, u); o.value = u; unitSel.appendChild(o);
        });
        unitSel.value = def.unit;
      }
      function emit(n) {
        if (n === '' || n === null) return writeValue(def.sel, def.prop, null);
        writeValue(def.sel, def.prop, n + (unitSel ? unitSel.value : ''));
      }
      range.addEventListener('input', function () { numIn.value = range.value; emit(range.value); });
      numIn.addEventListener('change', function () {
        var raw = numIn.value.trim();
        if (!raw) return writeValue(def.sel, def.prop, null);
        // Anything that is not a bare number goes in verbatim — calc(), clamp()…
        if (/^-?\d*\.?\d+$/.test(raw)) emit(raw);
        else writeValue(def.sel, def.prop, raw);
      });
      if (unitSel) unitSel.addEventListener('change', function () {
        if (numIn.value.trim()) emit(numIn.value.trim());
      });
      row.appendChild(range);
      row.appendChild(numIn);
      if (unitSel) row.appendChild(unitSel);
      row.appendChild(clearButton(function () { writeValue(def.sel, def.prop, null); }));

      sync = function (v) {
        if (v == null) { numIn.value = ''; range.value = def.min; return; }
        var p = parseLength(v);
        if (p) {
          numIn.value = String(p.n);
          range.value = p.n;
          range.disabled = false;
          if (unitSel && p.u && def.units.indexOf(p.u) !== -1) unitSel.value = p.u;
        } else {
          numIn.value = v;         // calc(), clamp(), keywords
          range.disabled = true;
        }
      };

    } else if (def.type === 'select' || def.type === 'font') {
      var sel = el('select');
      var blank = el('option', null, '—'); blank.value = '';
      sel.appendChild(blank);
      def.values.forEach(function (v) {
        var o = el('option', null, escapeHtml(v));
        o.value = def.type === 'font' ? '"' + v + '"' : v;
        sel.appendChild(o);
      });
      var raw = el('input');
      raw.type = 'text';
      raw.placeholder = 'or type a value';
      sel.addEventListener('change', function () {
        if (!sel.value) return writeValue(def.sel, def.prop, null);
        writeValue(def.sel, def.prop, sel.value);
      });
      raw.addEventListener('change', function () {
        writeValue(def.sel, def.prop, raw.value.trim() || null);
      });
      row.appendChild(sel);
      row.appendChild(raw);
      row.appendChild(clearButton(function () { writeValue(def.sel, def.prop, null); }));

      sync = function (v) {
        raw.value = v || '';
        var match = '';
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value && v && sel.options[i].value === v.trim()) { match = sel.options[i].value; break; }
        }
        sel.value = match;
      };

    } else if (def.type === 'toggle') {
      var box = el('label', 'field-inline');
      var cb = el('input'); cb.type = 'checkbox';
      box.appendChild(cb);
      box.appendChild(el('span', null, 'Hidden'));
      cb.addEventListener('change', function () {
        writeValue(def.sel, def.prop, cb.checked ? def.on : null);
      });
      row.appendChild(box);
      sync = function (v) { cb.checked = v === def.on; };

    } else if (def.type === 'gradient') {
      var gval = el('input');
      gval.type = 'text';
      gval.placeholder = 'linear-gradient(160deg, #2a1520, #55283c)';
      gval.addEventListener('change', function () {
        writeValue(def.sel, def.prop, gval.value.trim() || null);
      });
      row.appendChild(gval);
      row.appendChild(clearButton(function () { writeValue(def.sel, def.prop, null); }));

      var grid = el('div', 'ctrl-grid');
      var kind = el('select');
      ['linear', 'radial', 'solid'].forEach(function (k) {
        var o = el('option', null, k); o.value = k; kind.appendChild(o);
      });
      var angle = el('input'); angle.type = 'number'; angle.value = '160';
      var c1 = el('input'); c1.type = 'color'; c1.value = '#2a1520';
      var c2 = el('input'); c2.type = 'color'; c2.value = '#55283c';
      function build() {
        if (kind.value === 'solid') return c1.value;
        if (kind.value === 'radial') return 'radial-gradient(circle at 50% 30%, ' + c1.value + ', ' + c2.value + ')';
        return 'linear-gradient(' + (angle.value || 0) + 'deg, ' + c1.value + ', ' + c2.value + ')';
      }
      [kind, angle, c1, c2].forEach(function (n) {
        n.addEventListener('input', function () {
          gval.value = build();
          writeValue(def.sel, def.prop, gval.value);
        });
      });
      grid.appendChild(labelled('type', kind));
      grid.appendChild(labelled('angle', angle));
      grid.appendChild(labelled('from', c1));
      grid.appendChild(labelled('to', c2));
      wrap.appendChild(grid);
      sync = function (v) { gval.value = v || ''; };

    } else if (def.type === 'shadow') {
      var sval = el('input');
      sval.type = 'text';
      sval.placeholder = '0 8px 32px rgba(0,0,0,.45)';
      sval.addEventListener('change', function () {
        writeValue(def.sel, def.prop, sval.value.trim() || null);
      });
      row.appendChild(sval);
      row.appendChild(clearButton(function () { writeValue(def.sel, def.prop, null); }));

      var sgrid = el('div', 'ctrl-grid');
      var sx = el('input'); sx.type = 'number'; sx.value = '0';
      var sy = el('input'); sy.type = 'number'; sy.value = '8';
      var sb = el('input'); sb.type = 'number'; sb.value = '28';
      var sc = el('input'); sc.type = 'color'; sc.value = '#000000';
      function buildShadow() {
        return sx.value + 'px ' + sy.value + 'px ' + sb.value + 'px ' + sc.value;
      }
      [sx, sy, sb, sc].forEach(function (n) {
        n.addEventListener('input', function () {
          sval.value = buildShadow();
          writeValue(def.sel, def.prop, sval.value);
        });
      });
      sgrid.appendChild(labelled('x', sx));
      sgrid.appendChild(labelled('y', sy));
      sgrid.appendChild(labelled('blur', sb));
      sgrid.appendChild(labelled('colour', sc));
      wrap.appendChild(sgrid);
      sync = function (v) { sval.value = v || ''; };

    } else { // text
      var t = el('input');
      t.type = 'text';
      t.placeholder = def.placeholder || '';
      t.addEventListener('change', function () {
        writeValue(def.sel, def.prop, t.value.trim() || null);
      });
      row.appendChild(t);
      row.appendChild(clearButton(function () { writeValue(def.sel, def.prop, null); }));
      sync = function (v) { t.value = v || ''; };
    }

    if (def.help) wrap.appendChild(el('p', 'ctrl-help', escapeHtml(def.help)));

    controlNodes.push({ def: def, node: wrap, sync: sync });
    return wrap;
  }

  function labelled(text, node) {
    var d = el('div');
    d.appendChild(el('label', null, text));
    d.appendChild(node);
    return d;
  }

  function renderControls() {
    var host = $('#control-groups');
    host.innerHTML = '';
    window.JaiControls.groups.forEach(function (g) {
      var group = el('section', 'group');
      group.dataset.group = g.id;
      var head = el('button', 'group-head',
        '<span>' + escapeHtml(g.title) + '</span>' +
        '<span class="group-count" data-count>0</span>' +
        '<span class="chev">›</span>');
      head.type = 'button';
      head.addEventListener('click', function () { group.classList.toggle('is-open'); });
      group.appendChild(head);

      var body = el('div', 'group-body');
      if (g.blurb) body.appendChild(el('p', 'group-blurb', g.blurb));
      g.controls.forEach(function (def) { body.appendChild(buildControl(def)); });
      group.appendChild(body);
      host.appendChild(group);
    });
    syncControls();
  }

  function syncControls() {
    var counts = {};
    controlNodes.forEach(function (c) {
      var v = readValue(c.def.sel, c.def.prop);
      c.sync(v);
      var set = v !== undefined;
      c.node.classList.toggle('is-set', set);
      var group = c.node.closest('.group');
      if (group && set) counts[group.dataset.group] = (counts[group.dataset.group] || 0) + 1;
    });
    $$('.group').forEach(function (g) {
      var badge = $('[data-count]', g);
      var n = counts[g.dataset.group] || 0;
      badge.textContent = n;
      badge.style.visibility = n ? 'visible' : 'hidden';
    });
  }

  function filterControls() {
    var q = $('#control-search').value.trim().toLowerCase();
    controlNodes.forEach(function (c) {
      var hay = (c.def.label + ' ' + c.def.sel + ' ' + c.def.prop).toLowerCase();
      var selected = !selectedControlTokens.length || selectedControlTokens.some(function (token) {
        return hay.indexOf('.' + token.toLowerCase()) !== -1;
      });
      c.node.style.display = selected && (!q || hay.indexOf(q) !== -1) ? '' : 'none';
    });
    $$('.group').forEach(function (g) {
      var visible = $$('.ctrl', g).some(function (n) { return n.style.display !== 'none'; });
      g.style.display = visible ? '' : 'none';
      if ((q || selectedControlTokens.length) && visible) g.classList.add('is-open');
    });
  }

  $('#control-search').addEventListener('input', filterControls);

  // ---------------------------------------------------------------- presets

  function renderPresets() {
    var host = $('#preset-list');
    host.innerHTML = '';
    window.JaiPresets.all.forEach(function (p) {
      var card = el('div', 'preset');
      card.dataset.preset = p.id;
      card.title = p.blurb;
      card.appendChild(el('div', 'preset-main',
        '<div class="preset-cat">' + escapeHtml(p.category) + '</div>' +
        '<div class="preset-name">' + escapeHtml(p.name) + '</div>'));
      var btn = el('button', 'btn btn-sm', 'Add');
      btn.type = 'button';
      btn.addEventListener('click', function () {
        var on = window.JaiPresets.isApplied(window.JaiPayload.allCss(state.code), p);
        if (!on) reportToHost('preset_applied', p.id);
        editCss(function (css) {
          return on ? window.JaiPresets.remove(css, p) : window.JaiPresets.apply(css, p);
        }, 'presets');
        syncPresets();
        toast(on ? 'Removed “' + p.name + '”' : 'Added “' + p.name + '”');
      });
      card.appendChild(btn);
      host.appendChild(card);
    });
    syncPresets();
  }

  function syncPresets() {
    $$('.preset').forEach(function (card) {
      var p = window.JaiPresets.all.filter(function (x) { return x.id === card.dataset.preset; })[0];
      if (!p) return;
      var on = window.JaiPresets.isApplied(window.JaiPayload.allCss(state.code), p);
      card.classList.toggle('is-on', on);
      $('button', card).textContent = on ? 'Remove' : 'Add';
    });
  }

  // ------------------------------------------------------- advanced templates
  //
  // A template is a whole profile design by a community creator, cut into
  // components (see tools/build_template.py). Each renders as a card that opens
  // into its parts, so a creator can take the status box without inheriting the
  // bot card redesign.

  function templateList() { return window.JaiPresets.templates(); }
  var templateFilter = 'all';

  /* Metadata belongs to a part, not a whole template: one theme can contribute
   * a header, cards and a footer independently. New packages declare `affects`;
   * the name fallback keeps older community packages browseable too. */
  function partAreas(part) {
    return part.affects && part.affects.length ? part.affects : [part.name];
  }

  function renderTemplateFilters() {
    var host = $('#template-filters');
    if (!host) return;
    var areas = {};
    templateList().forEach(function (tpl) {
      tpl.components.forEach(function (part) {
        partAreas(part).forEach(function (area) { areas[area] = true; });
      });
    });

    host.innerHTML = '';
    ['all'].concat(Object.keys(areas).sort()).forEach(function (area) {
      var label = area === 'all' ? 'All parts' : area;
      var button = el('button', 'btn btn-sm template-filter', label);
      button.type = 'button';
      button.classList.toggle('is-active', area === templateFilter);
      button.addEventListener('click', function () {
        templateFilter = area;
        renderTemplates();
      });
      host.appendChild(button);
    });
  }

  /* `part` plus everything it depends on, in canonical order, deduped. */
  function withDependencies(part) {
    var byId = {};
    window.JaiPresets.allParts().forEach(function (p) { byId[p.id] = p; });

    var chosen = {};
    (function walk(p) {
      if (!p || chosen[p.id]) return;
      (p.needs || []).forEach(function (id) { walk(byId[id]); });
      chosen[p.id] = true;
    })(part);

    return window.JaiPresets.allParts().filter(function (p) { return chosen[p.id]; });
  }

  /* Anything still applied that depends on `part`. */
  function dependantsOf(part) {
    return window.JaiPresets.allParts().filter(function (p) {
      return (p.needs || []).indexOf(part.id) !== -1 &&
             window.JaiPresets.isPartApplied(state.code, p);
    });
  }

  /* A dependency the user never chose goes again with the last part that
   * needed it; one they added themselves stays. Without this, adding one part
   * and removing it left its whole foundation (background, fonts, grid) behind. */
  function markAuto(id, on) {
    var i = state.autoParts.indexOf(id);
    if (on && i === -1) state.autoParts.push(id);
    if (!on && i !== -1) state.autoParts.splice(i, 1);
  }

  /* `part` plus the auto-added dependencies nothing else applied still needs,
   * dependants first so removal runs in reverse canonical order. */
  function withOrphans(part) {
    var gone = {};
    gone[part.id] = true;
    var candidates = withDependencies(part).filter(function (p) {
      return p.id !== part.id && state.autoParts.indexOf(p.id) !== -1 &&
             window.JaiPresets.isPartApplied(state.code, p);
    });
    var changed = true;
    while (changed) {
      changed = false;
      candidates.forEach(function (dep) {
        if (gone[dep.id]) return;
        var stillNeeded = window.JaiPresets.allParts().some(function (p) {
          return !gone[p.id] && (p.needs || []).indexOf(dep.id) !== -1 &&
                 window.JaiPresets.isPartApplied(state.code, p);
        });
        if (!stillNeeded) { gone[dep.id] = true; changed = true; }
      });
    }
    return window.JaiPresets.allParts().filter(function (p) { return gone[p.id]; }).reverse();
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function applyParts(parts) {
    var code = state.code;
    parts.forEach(function (p) { code = window.JaiPresets.applyPart(code, p); });
    setCode(code, 'presets');
    syncTemplates();
  }

  function removeParts(parts) {
    var code = state.code;
    parts.forEach(function (p) { code = window.JaiPresets.removePart(code, p); });
    setCode(code, 'presets');
    syncTemplates();
  }

  function renderTemplates() {
    var host = $('#template-list');
    if (!host) return;
    renderTemplateFilters();
    host.innerHTML = '';

    templateList().forEach(function (tpl) {
      var visibleParts = tpl.components.filter(function (part) {
        return templateFilter === 'all' || partAreas(part).indexOf(templateFilter) !== -1;
      });
      if (!visibleParts.length) return;

      var card = el('article', 'template');
      card.dataset.template = tpl.id;
      card.title = tpl.blurb || '';

      var head = el('div', 'template-head',
        '<div class="preset-cat">Advanced template</div>' +
        '<div class="preset-name">' + escapeHtml(tpl.name) + '</div>' +
        '<div class="template-credit">' + escapeHtml(tpl.credit) + '</div>');

      var actions = el('div', 'template-actions');
      var addAll = el('button', 'btn btn-sm', 'Add all');
      addAll.type = 'button';
      addAll.addEventListener('click', function () {
        var on = tpl.components.every(function (c) {
          return window.JaiPresets.isPartApplied(state.code, c);
        });
        tpl.components.forEach(function (c) { markAuto(c.id, false); });
        if (on) {
          removeParts(tpl.components.slice().reverse());
          toast('Removed “' + tpl.name + '”');
        } else {
          applyParts(tpl.components);
          reportToHost('template_applied', tpl.id);
          toast('Added “' + tpl.name + '” — ' + tpl.components.length + ' parts');
        }
      });
      actions.appendChild(addAll);
      head.appendChild(actions);
      card.appendChild(head);

      var parts = el('details', 'template-parts');
      var summary = el('summary', null,
        '<span>Parts' + (templateFilter === 'all' ? '' : ' · ' + visibleParts.length + ' match') +
        '</span><span class="template-parts-count">' + tpl.components.length + '</span>');
      parts.appendChild(summary);
      parts.open = templateFilter !== 'all';

      visibleParts.forEach(function (comp) {
        var row = el('div', 'part');
        row.dataset.part = comp.id;
        row.title = comp.blurb || comp.name;

        var badges = '';
        if (comp.required) badges += '<span class="part-badge">required</span>';
        if (comp.recommended) badges += '<span class="part-badge is-good">please keep</span>';
        if (comp.html) badges += '<span class="part-badge is-html">+ markup</span>';

        row.appendChild(el('div', 'part-main',
          '<div class="part-name">' + escapeHtml(comp.name) + badges + '</div>'));

        var toggle = el('button', 'btn btn-sm', 'Add');
        toggle.type = 'button';
        toggle.addEventListener('click', function () {
          if (window.JaiPresets.isPartApplied(state.code, comp)) {
            var dependants = dependantsOf(comp);
            if (dependants.length) {
              toast('Remove ' + dependants[0].name + ' first — it needs this');
              return;
            }
            var removing = withOrphans(comp);
            removing.forEach(function (p) { markAuto(p.id, false); });
            removeParts(removing);
            if (removing.length > 1) {
              toast('Also removed ' + plural(removing.length - 1, 'part') + ' it had added');
            }
          } else {
            // Only what is not already on: a dependency the user added
            // themselves must not become "auto" and vanish with this part.
            var needed = withDependencies(comp).filter(function (p) {
              return !window.JaiPresets.isPartApplied(state.code, p);
            });
            needed.forEach(function (p) { markAuto(p.id, p.id !== comp.id); });
            applyParts(needed);
            reportToHost('template_part_applied', comp.id);
            if (needed.length > 1) {
              toast('Also added ' + plural(needed.length - 1, 'part') + ' it depends on');
            }
          }
        });
        row.appendChild(toggle);
        parts.appendChild(row);
      });

      card.appendChild(parts);
      host.appendChild(card);
    });

    syncTemplates();
  }

  function syncTemplates() {
    $$('.template').forEach(function (card) {
      var tpl = templateList().filter(function (t) { return t.id === card.dataset.template; })[0];
      if (!tpl) return;

      var applied = 0;
      $$('.part', card).forEach(function (row) {
        var comp = tpl.components.filter(function (c) { return c.id === row.dataset.part; })[0];
        if (!comp) return;
        var on = window.JaiPresets.isPartApplied(state.code, comp);
        if (on) applied++;
        row.classList.toggle('is-on', on);
        $('button', row).textContent = on ? 'Remove' : 'Add';
      });

      card.classList.toggle('is-on', applied > 0);
      $('.template-actions button', card).textContent =
        applied === tpl.components.length ? 'Remove all' : 'Add all';
      $('.template-parts-count', card).textContent =
        applied ? applied + ' / ' + tpl.components.length : tpl.components.length;
    });

    var basic = $('#basic-count');
    if (basic) {
      var onBasic = window.JaiPresets.all.filter(function (p) {
        return window.JaiPresets.isApplied(window.JaiPayload.allCss(state.code), p);
      }).length;
      basic.textContent = onBasic ? onBasic + ' / ' + window.JaiPresets.all.length
                                  : window.JaiPresets.all.length;
    }
    var advanced = $('#advanced-count');
    if (advanced) {
      var onParts = window.JaiPresets.allParts().filter(function (p) {
        return window.JaiPresets.isPartApplied(state.code, p);
      }).length;
      advanced.textContent = onParts ? onParts + ' parts on' : templateList().length;
    }
  }

  // ------------------------------------------------------------ profile data

  var PROFILE_FIELDS = [
    // Username, avatar, followers, member-since and background are edited
    // directly in the preview (click text to edit; right-click an image to
    // swap it) -- see the 'sim-edit-value' wiring in preview/frame.js.
    { key: 'cardCount', label: 'Bot cards shown', type: 'number', min: 1, max: 250 },
    { key: 'viewMode', label: 'Viewing as', type: 'select',
      values: [['visitor', 'A visitor (Follow + Options)'], ['owner', 'Yourself (Edit profile)']] },
    { key: 'showBadges', label: 'Show event badges', type: 'checkbox' },
    { key: 'janitorPlus', label: 'Show Janitor+ badge', type: 'checkbox' },
    { key: 'userMenu', label: 'Open the user menu', type: 'checkbox',
      hint: 'The popup behind your avatar in the header. You can also just click the avatar in the preview.' }
  ];

  function renderProfileFields() {
    var host = $('#profile-fields');
    host.innerHTML = '';
    PROFILE_FIELDS.forEach(function (f) {
      var wrap = el('div', 'field');
      var node;
      if (f.type === 'textarea') {
        node = el('textarea');
      } else if (f.type === 'select') {
        node = el('select');
        f.values.forEach(function (v) {
          var o = el('option', null, escapeHtml(v[1])); o.value = v[0]; node.appendChild(o);
        });
      } else if (f.type === 'checkbox') {
        node = el('input'); node.type = 'checkbox';
        node.dataset.key = f.key;
      } else {
        node = el('input');
        node.type = f.type === 'number' ? 'number' : 'text';
        if (f.min != null) node.min = f.min;
        if (f.max != null) node.max = f.max;
      }

      if (f.type === 'checkbox') {
        var inline = el('label', 'field-inline');
        inline.appendChild(node);
        inline.appendChild(el('span', null, escapeHtml(f.label)));
        wrap.appendChild(inline);
      } else {
        wrap.appendChild(el('label', null, escapeHtml(f.label)));
        wrap.appendChild(node);
      }
      if (f.hint) wrap.appendChild(el('p', 'field-hint', f.hint));

      function read() {
        if (f.type === 'checkbox') return node.checked;
        if (f.type === 'number') return parseInt(node.value, 10) || 1;
        return node.value;
      }
      node.addEventListener(f.type === 'checkbox' || f.type === 'select' ? 'change' : 'input', function () {
        state.data[f.key] = read();
        pushData();
        save();
      });

      var current = state.data[f.key];
      if (f.type === 'checkbox') node.checked = !!current;
      else node.value = current == null ? '' : current;

      host.appendChild(wrap);
    });

    var reset = el('button', 'btn btn-ghost btn-sm', 'Reset preview content');
    reset.type = 'button';
    reset.addEventListener('click', function () {
      state.data = Object.assign({}, DEFAULT_DATA);
      renderProfileFields();
      pushData();
      save();
    });
    host.appendChild(reset);
  }

  function updateImportStatus(message) {
    $('#profile-import-status').textContent = message;
  }

  function copyData(data) {
    return Object.assign({}, DEFAULT_DATA, data || {});
  }

  function activeSnapshot() {
    return profileSnapshots.filter(function (entry) { return entry.id === activeProfileId; })[0] || null;
  }

  function visibleSnapshots() {
    return profileSnapshots.filter(function (entry) { return !entry.builtin || keepDefaultProfile; });
  }

  function saveActiveSnapshot() {
    var entry = activeSnapshot();
    if (!entry) return;
    entry.code = state.code;
    entry.data = copyData(state.data);
    entry.cssEnabled = state.previewCss;
  }

  function renderProfileSwitcher() {
    var select = $('#profile-switcher');
    var snapshots = visibleSnapshots();
    select.innerHTML = '';
    snapshots.forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.label;
      select.appendChild(option);
    });
    select.disabled = !snapshots.length;
    if (activeProfileId && snapshots.some(function (entry) { return entry.id === activeProfileId; })) {
      select.value = activeProfileId;
    }
    var entry = activeSnapshot();
    $('#remove-profile').hidden = !entry || entry.builtin || profileSnapshots.length < 2;
    $('#profile-css-toggle').disabled = !entry;
    $('#profile-css-toggle').textContent = state.previewCss ? 'Hide custom CSS' : 'Show custom CSS';
    $('#keep-default-profile').checked = keepDefaultProfile;
  }

  function activateSnapshot(entry, message) {
    if (!entry) return;
    saveActiveSnapshot();
    activeProfileId = entry.id;
    state.data = copyData(entry.data);
    state.previewCss = entry.cssEnabled !== false;
    setCode(typeof entry.code === 'string' ? entry.code : (entry.profile.aboutMe || window.JaiPayload.STARTER));
    renderProfileFields();
    pushProfile(entry.profile);
    pushData();
    pushPayload();
    renderProfileSwitcher();
    updateImportStatus(message || ('Using ' + entry.label + '. Snapshots stay loaded until you remove them or reload.'), true);
    save();
  }

  function applyImportedProfile(profile, filename) {
    importedProfile = true;
    var username = profile.data && profile.data.username ? ' @' + profile.data.username : '';
    var entry = {
      id: 'profile-' + (++profileIdSeq),
      label: filename.replace(/\.(m?html?)$/i, '') + username,
      profile: profile,
      data: copyData(profile.data),
      code: typeof profile.aboutMe === 'string' ? profile.aboutMe : window.JaiPayload.STARTER,
      cssEnabled: true,
      builtin: false
    };
    profileSnapshots.push(entry);
    activateSnapshot(entry, 'Using “' + filename + '”. Switch profiles above whenever you want; the snapshot stays loaded until you remove it or reload.');
    reportToHost('profile_imported');
    toast('Profile snapshot added — you can now switch between profiles');
  }

  function handleProfileFileChange() {
    var file = this.files && this.files[0];
    if (!file) return;
    updateImportStatus('Reading “' + file.name + '”…', false);
    window.JaiProfileImport.read(file).then(function (profile) {
      applyImportedProfile(profile, file.name);
    }).catch(function (error) {
      updateImportStatus('Could not import this file: ' + error.message, importedProfile);
      toast('Could not import that profile file');
    });
    this.value = '';
  }

  // The same import lives in both the Settings and Presets panels, so a
  // creator building off a template can pull in their own profile without
  // switching tabs.
  $('#profile-file').addEventListener('change', handleProfileFileChange);
  $('#profile-file-presets').addEventListener('change', handleProfileFileChange);

  $('#profile-switcher').addEventListener('change', function () {
    var entry = activeSnapshot();
    var next = profileSnapshots.filter(function (candidate) { return candidate.id === this.value; }, this)[0];
    if (next && (!entry || next.id !== entry.id)) activateSnapshot(next);
  });

  $('#profile-css-toggle').addEventListener('click', function () {
    state.previewCss = !state.previewCss;
    var entry = activeSnapshot();
    if (entry) entry.cssEnabled = state.previewCss;
    pushPayload();
    renderProfileSwitcher();
    save();
  });

  $('#keep-default-profile').addEventListener('change', function () {
    if (!this.checked && !profileSnapshots.some(function (entry) { return !entry.builtin; })) {
      this.checked = true;
      toast('Import another profile before hiding Sweepercom.');
      return;
    }
    keepDefaultProfile = this.checked;
    var entry = activeSnapshot();
    renderProfileSwitcher();
    if (!keepDefaultProfile && entry && entry.builtin) {
      activateSnapshot(visibleSnapshots()[0]);
    }
  });

  $('#remove-profile').addEventListener('click', function () {
    var entry = activeSnapshot();
    if (!entry || entry.builtin) return;
    saveActiveSnapshot();
    if (entry.profile.release) entry.profile.release();
    profileSnapshots = profileSnapshots.filter(function (candidate) { return candidate.id !== entry.id; });
    var next = visibleSnapshots()[0];
    if (!next) {
      // Never leave the canvas without a source profile. If the user hid the
      // built-in snapshot and then removes their last imported one, restore
      // Sweepercom as the safe fallback so the preview remains useful.
      keepDefaultProfile = true;
      next = visibleSnapshots()[0];
    }
    activeProfileId = null;
    if (next) activateSnapshot(next, 'Removed the snapshot. Using ' + next.label + '.');
    else renderProfileSwitcher();
    toast('Removed ' + entry.label + ' from the profile switcher');
  });

  // ------------------------------------------------------------- My presets
  //
  // User-authored presets: a name plus zero or more parts, each a snippet the
  // creator selected out of their own editor and saved (see "Save selection…"
  // in the code pane, wired further down). Persisted via js/custom-presets.js.

  function renderCustomPresets() {
    var host = $('#custom-preset-list');
    if (!host) return;
    host.innerHTML = '';
    var presets = window.JaiCustomPresets.list();

    $('#custom-count').textContent = presets.length || '';

    presets.forEach(function (preset) {
      var card = el('article', 'template');
      card.dataset.customPreset = preset.id;

      var head = el('div', 'template-head',
        '<div class="preset-cat">My preset</div>' +
        '<div class="preset-name">' + escapeHtml(preset.name) + '</div>');

      var actions = el('div', 'template-actions');
      var rename = el('button', 'btn btn-ghost btn-sm', 'Rename');
      rename.type = 'button';
      rename.addEventListener('click', function () {
        var name = window.prompt('Rename preset', preset.name);
        if (name) { window.JaiCustomPresets.rename(preset.id, name); renderCustomPresets(); }
      });
      var del = el('button', 'btn btn-ghost btn-sm', 'Delete');
      del.type = 'button';
      del.addEventListener('click', function () {
        if (!window.confirm('Delete “' + preset.name + '” and its ' + plural(preset.parts.length, 'part') + '?')) return;
        window.JaiCustomPresets.deletePreset(preset.id);
        renderCustomPresets();
      });
      actions.appendChild(rename);
      actions.appendChild(del);
      head.appendChild(actions);
      card.appendChild(head);

      var parts = el('details', 'template-parts');
      parts.open = true;
      var summary = el('summary', null,
        '<span>Parts</span><span class="template-parts-count">' + preset.parts.length + '</span>');
      parts.appendChild(summary);

      if (!preset.parts.length) {
        parts.appendChild(el('p', 'panel-note', 'No parts yet — select code in the editor and use “Save selection…”.'));
      }

      preset.parts.forEach(function (part) {
        var row = el('div', 'part');
        row.dataset.part = part.id;
        row.appendChild(el('div', 'part-main', '<div class="part-name">' + escapeHtml(part.name) + '</div>'));

        var toggle = el('button', 'btn btn-sm', 'Add');
        toggle.type = 'button';
        toggle.addEventListener('click', function () {
          var on = window.JaiCustomPresets.isPartApplied(state.code, part);
          setCode(on ? window.JaiCustomPresets.removePart(state.code, part)
                     : window.JaiCustomPresets.applyPart(state.code, part), 'presets');
          syncCustomPresets();
          toast(on ? 'Removed “' + part.name + '”' : 'Added “' + part.name + '”');
        });
        row.appendChild(toggle);

        var delPart = el('button', 'btn btn-ghost btn-sm', 'Delete');
        delPart.type = 'button';
        delPart.addEventListener('click', function () {
          if (!window.confirm('Delete the saved part “' + part.name + '”?')) return;
          window.JaiCustomPresets.deletePart(preset.id, part.id);
          renderCustomPresets();
        });
        row.appendChild(delPart);

        parts.appendChild(row);
      });

      card.appendChild(parts);
      host.appendChild(card);
    });

    syncCustomPresets();
  }

  function syncCustomPresets() {
    $$('.template[data-custom-preset]').forEach(function (card) {
      var preset = window.JaiCustomPresets.list().filter(function (p) { return p.id === card.dataset.customPreset; })[0];
      if (!preset) return;
      $$('.part', card).forEach(function (row) {
        var part = preset.parts.filter(function (p) { return p.id === row.dataset.part; })[0];
        if (!part) return;
        var on = window.JaiCustomPresets.isPartApplied(state.code, part);
        row.classList.toggle('is-on', on);
        $('.btn:not(.btn-ghost)', row).textContent = on ? 'Remove' : 'Add';
      });
    });
  }

  $('#new-custom-preset').addEventListener('click', function () {
    var name = window.prompt('Name this preset');
    if (!name) return;
    window.JaiCustomPresets.create(name);
    renderCustomPresets();
    toast('Created “' + name + '”');
  });

  // Selecting text in the editor lets you save it into one of your presets as
  // a reusable part, the same way an advanced template ships pre-cut parts.
  function updateSaveSelectionButton() {
    var has = input.selectionStart !== input.selectionEnd;
    $('#save-selection').disabled = !has;
  }
  input.addEventListener('select', updateSaveSelectionButton);
  input.addEventListener('keyup', updateSaveSelectionButton);
  input.addEventListener('mouseup', updateSaveSelectionButton);

  $('#save-selection').addEventListener('click', function () {
    var start = input.selectionStart, end = input.selectionEnd;
    if (start === end) return;
    var selected = state.code.slice(start, end);
    if (!selected.trim()) return;

    var inStyle = window.JaiPayload.styleBlocks(state.code).some(function (b) {
      return start >= b.cssStart && end <= b.cssEnd;
    });

    var presets = window.JaiCustomPresets.list();
    var preset;
    if (presets.length) {
      var names = presets.map(function (p, i) { return (i + 1) + '. ' + p.name; }).join('\n');
      var choice = window.prompt('Save to which preset? Enter a number, or a new name to create one:\n' + names);
      if (!choice) return;
      var index = parseInt(choice, 10);
      preset = (index >= 1 && index <= presets.length) ? presets[index - 1] : window.JaiCustomPresets.create(choice);
    } else {
      var name = window.prompt('No presets yet — name one to create it:');
      if (!name) return;
      preset = window.JaiCustomPresets.create(name);
    }

    var partName = window.prompt('Name this part', '');
    if (!partName) return;
    var part = {};
    part[inStyle ? 'css' : 'html'] = selected;
    part.name = partName;
    window.JaiCustomPresets.addPart(preset.id, part);
    toast('Saved “' + partName + '” to “' + preset.name + '”');
    if (state.panel === 'presets') renderCustomPresets();
  });

  // ------------------------------------------------------- bundled profile
  //
  // The preview ships with a capture of the owner's own JanitorAI profile, so
  // the canvas you design against is your real profile — your bots, your
  // follower count, your avatar — with no import step.
  //
  // It supplies the *canvas* only. The editor's contents are your document and
  // are never touched by this, and any profile fields you have already changed
  // by hand are left alone too.

  var DEFAULT_PROFILE_URL = 'preview/profiles/default.mhtml';
  var DEFAULT_PROFILE_LABEL = 'your profile (@' + DEFAULT_DATA.username + ')';

  /*
   * The bundled capture carries its owner's background photo, set on the page
   * background element through one of its emotion classes. Everyone else would
   * be designing on top of someone else's picture, so the bundled profile starts
   * on JanitorAI's plain page instead. The declaration is removed rather than
   * set to `none`: the imported CSS comes after #sim-data, so `none` would also
   * beat the Background image field. An imported profile keeps its own.
   */
  function withoutPageBackground(html, css) {
    var m = /<[^>]*class="([^"]*\bpp-page-background\b[^"]*)"/.exec(html || '');
    if (!m || !css) return css;
    m[1].split(/\s+/).filter(function (c) { return /^css-[\w-]+$/.test(c); }).forEach(function (cls) {
      var rule = new RegExp('(\\.' + cls + '\\s*\\{[^}]*?)background-image\\s*:\\s*url\\([^)]*\\)\\s*;?', 'g');
      css = css.replace(rule, '$1');
    });
    return css;
  }

  function loadBundledProfile() {
    updateImportStatus('Loading ' + DEFAULT_PROFILE_LABEL + '…', false);

    return fetch(DEFAULT_PROFILE_URL)
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.blob();
      })
      .then(function (blob) {
        return window.JaiProfileImport.read(
          new File([blob], 'default.mhtml', { type: 'multipart/related' }));
      })
      .then(function (profile) {
        profile.css = withoutPageBackground(profile.html, profile.css);
        var existing = profileSnapshots.filter(function (entry) { return entry.builtin; })[0];
        if (existing && existing.profile.release) existing.profile.release();
        // Blob URLs are intentionally used while an imported MHTML snapshot is
        // alive, but they cannot survive a reload. Do not restore a stale
        // imported About Me document into the bundled profile after that URL
        // has expired; the built-in capture is the safe source of truth.
        var savedCode = state.code;
        var defaultCode = /\bblob:/i.test(savedCode || '')
          ? (profile.aboutMe || window.JaiPayload.STARTER)
          : (savedCode || window.JaiPayload.STARTER);
        var defaultData = hadSavedData ? copyData(state.data) : copyData(profile.data);
        if (/^blob:/i.test(defaultData.avatar || '') && profile.data.avatar) defaultData.avatar = profile.data.avatar;
        if (/^blob:/i.test(defaultData.background || '')) defaultData.background = profile.data.background || '';
        var entry = {
          id: 'default',
          label: 'Sweepercom' + (profile.data.username ? ' @' + profile.data.username : ''),
          profile: profile,
          data: defaultData,
          code: defaultCode,
          cssEnabled: state.previewCss,
          builtin: true
        };
        profileSnapshots = profileSnapshots.filter(function (candidate) { return !candidate.builtin; });
        profileSnapshots.unshift(entry);
        if (!activeProfileId) activateSnapshot(entry, 'Using ' + DEFAULT_PROFILE_LABEL + '. Import another profile to add it to the switcher.');
        else renderProfileSwitcher();
        return true;
      })
      .catch(function (error) {
        // Not fatal: the built-in snapshot is the same profile, just captured
        // at build time, so the preview is still correct without this.
        updateImportStatus('Using the built-in snapshot (' + error.message + ').', false);
        return false;
      });
  }

  // -------------------------------------------------------------- reference

  function renderReference(query) {
    var host = $('#reference-list');
    var q = (query || '').trim().toLowerCase();
    var rows = (window.JAI_REFERENCE || []).filter(function (r) {
      if (!q) return true;
      return (r.element + ' ' + r.group + ' ' + r.sub + ' ' +
              r.labels.join(' ') + ' ' + r.ids.join(' ')).toLowerCase().indexOf(q) !== -1;
    });

    if (!rows.length) {
      host.innerHTML = '<p class="ref-empty">Nothing matches “' + escapeHtml(query) + '”.</p>';
      return;
    }

    var html = '';
    var lastSection = null;
    rows.slice(0, 400).forEach(function (r) {
      var section = r.group + (r.sub ? ' · ' + r.sub : '');
      if (section !== lastSection) {
        html += '<h4>' + escapeHtml(section) + '</h4>';
        lastSection = section;
      }
      html += '<div class="ref-item"><div class="ref-element">' + escapeHtml(r.element) + '</div><div class="ref-sels">';
      r.labels.forEach(function (s) {
        html += '<button type="button" class="ref-sel" data-sel="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>';
      });
      r.ids.forEach(function (s) {
        html += '<button type="button" class="ref-sel is-id" data-sel="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>';
      });
      html += '</div></div>';
    });
    if (rows.length > 400) html += '<p class="ref-empty">…and ' + (rows.length - 400) + ' more. Narrow your search.</p>';
    host.innerHTML = html;
  }

  $('#reference-search').addEventListener('input', function (e) { renderReference(e.target.value); });

  $('#reference-list').addEventListener('click', function (e) {
    var b = e.target.closest('.ref-sel');
    if (!b) return;
    addRuleStub(b.dataset.sel);
  });

  // -------------------------------------------------------------- inspector

  function onPick(msg) {
    var t = msg.target;
    // Text often lands on a plain span inside the useful component. Prefer the
    // nearest ancestor carrying one of JanitorAI's stable labels so the user
    // sees and edits a meaningful element, not an anonymous HTML tag.
    var labelledTarget = (msg.chain || []).filter(function (part) {
      return part.labels && part.labels.length;
    })[0] || t;
    var label = labelledTarget.selector;
    var out = $('#pick-result');
    out.textContent = label + '  ↵ add rule';
    out.dataset.sel = label;
    out.title = 'Labels: ' + (labelledTarget.labels.join(' ') || '—') +
                '\nEmotion: ' + (labelledTarget.emotion.join(' ') || '—') +
                '\nClick to add a rule for this element.';

    selectedControlTokens = [];
    (msg.chain || [t]).slice(0, 4).forEach(function (part) {
      (part.labels || []).forEach(function (token) {
        if (selectedControlTokens.indexOf(token) === -1) selectedControlTokens.push(token);
      });
    });
    var selection = $('#inspector-selection');
    selection.classList.add('has-selection');
    $('.inspector-selection-label', selection).textContent = label;
    $('#inspector-show-all').hidden = false;
    showWorkspacePanel('design');
    filterControls();
  }

  $('#pick-result').addEventListener('click', function () {
    var sel = this.dataset.sel;
    if (sel) addRuleStub(sel);
  });

  /* Appends an empty rule for `selector` and drops the caret inside it. */
  function addRuleStub(selector) {
    var existing = window.CssModel.findRule(window.JaiPayload.allCss(state.code), selector);
    var caret;
    if (existing) {
      toast(selector + ' already has a rule');
      caret = window.JaiPayload.cssOffsetToPayload(state.code, existing.bodyEnd);
    } else {
      var offset = 0;
      editCss(function (inner) {
        var sep = inner && !/\n\s*$/.test(inner) ? '\n\n' : (inner ? '\n' : '');
        offset = inner.length + sep.length + selector.length + ' {\n  '.length;
        return inner + sep + selector + ' {\n  \n}\n';
      });
      caret = window.JaiPayload.cssOffsetToPayload(state.code, offset);
    }
    $('.layout').classList.remove('code-hidden');
    $('#show-code').classList.add('is-active');
    layoutStage();
    input.focus();
    input.setSelectionRange(caret, caret);
    editorScroll.scrollTop = Math.max(0, (window.CssModel.lineOf(state.code, caret) - 5) * 19.2);
  }

  // ------------------------------------------------------------- toolbar

  var customWidth = $('#custom-width');

  function applyPanelLayout() {
    var root = document.documentElement;
    var layout = $('.layout');
    if (state.sidebarWidth) root.style.setProperty('--sidebar-w', state.sidebarWidth + 'px');
    if (state.inspectorWidth) root.style.setProperty('--inspector-w', state.inspectorWidth + 'px');
    layout.classList.toggle('sidebar-hidden', state.sidebarHidden);
    layout.classList.toggle('inspector-hidden', state.inspectorHidden);

    var sidebarButton = $('#toggle-sidebar');
    sidebarButton.title = state.sidebarHidden ? 'Show library' : 'Hide library';
    sidebarButton.setAttribute('aria-label', sidebarButton.title);
    sidebarButton.setAttribute('aria-expanded', String(!state.sidebarHidden));
    var inspectorButton = $('#toggle-inspector');
    inspectorButton.title = state.inspectorHidden ? 'Show properties' : 'Hide properties';
    inspectorButton.setAttribute('aria-label', inspectorButton.title);
    inspectorButton.setAttribute('aria-expanded', String(!state.inspectorHidden));
  }

  function resizePanel(handle, stateKey, variable, direction, min, max) {
    handle.addEventListener('pointerdown', function (down) {
      if (window.matchMedia('(max-width: 1150px)').matches) return;
      down.preventDefault();
      var startX = down.clientX;
      var start = state[stateKey] || parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue(variable));
      document.body.classList.add('is-resizing');

      function move(event) {
        var width = Math.max(min, Math.min(max, Math.round(start + (event.clientX - startX) * direction)));
        state[stateKey] = width;
        document.documentElement.style.setProperty(variable, width + 'px');
        layoutStage();
      }
      function end() {
        document.body.classList.remove('is-resizing');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        save();
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end, { once: true });
    });
  }

  $('#toggle-sidebar').addEventListener('click', function () {
    state.sidebarHidden = !state.sidebarHidden;
    applyPanelLayout();
    layoutStage();
    save();
  });
  $('#toggle-inspector').addEventListener('click', function () {
    state.inspectorHidden = !state.inspectorHidden;
    applyPanelLayout();
    layoutStage();
    save();
  });
  resizePanel($('#resize-sidebar'), 'sidebarWidth', '--sidebar-w', 1, 240, 520);
  resizePanel($('#resize-inspector'), 'inspectorWidth', '--inspector-w', -1, 280, 560);

  var workspaceTitles = {
    design: 'Design',
    view: 'Preview',
    reference: 'Selectors',
    help: 'Help'
  };

  /* The four utility panels live in the right-hand inspector. Keeping their
   * existing DOM nodes (rather than cloning them) preserves every established
   * listener and lets older saved themes keep using the same controls. */
  var inspectorBody = $('#inspectorpane-body');
  $$('.panel[data-workspace-panel]').forEach(function (panel) {
    inspectorBody.appendChild(panel);
  });

  function showWorkspacePanel(name) {
    name = workspaceTitles[name] ? name : 'design';
    $$('.panel[data-workspace-panel]', inspectorBody).forEach(function (panel) {
      panel.hidden = panel.dataset.workspacePanel !== name;
    });
    $$('.workspace-tool').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.workspacePanel === name);
    });
    $('#inspector-title').textContent = workspaceTitles[name];
    $('#inspector-home').hidden = name === 'design';
  }

  $$('.workspace-tool').forEach(function (button) {
    button.addEventListener('click', function () {
      showWorkspacePanel(button.dataset.workspacePanel);
    });
  });
  $('#inspector-home').addEventListener('click', function () { showWorkspacePanel('design'); });
  $('#inspector-show-all').addEventListener('click', function () {
    selectedControlTokens = [];
    var selection = $('#inspector-selection');
    selection.classList.remove('has-selection');
    $('.inspector-selection-label', selection).textContent = 'All properties';
    this.hidden = true;
    filterControls();
  });
  showWorkspacePanel('design');

  $$('.viewport-switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.viewport-switch button').forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      state.viewport = b.dataset.viewport;
      reportToHost('viewport_changed', state.viewport);
      customWidth.hidden = state.viewport !== 'custom';
      layoutStage();
      save();
    });
  });

  customWidth.addEventListener('input', function () {
    var w = parseInt(customWidth.value, 10);
    if (!w || w < 320) return;
    state.customWidth = Math.min(3840, w);
    layoutStage();
    save();
  });

  $$('.sidebar-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.sidebar-tabs button').forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      state.panel = b.dataset.panel;
      $$('.panel', $('.sidebar-body')).forEach(function (p) { p.hidden = p.dataset.panel !== state.panel; });
    });
  });

  $('#stage-zoom').addEventListener('click', function () {
    state.zoom = state.zoom === 'fit' ? 'actual' : 'fit';
    layoutStage();
    save();
  });

  $('#stage-zoom-slider').addEventListener('input', function () {
    state.zoom = 'manual';
    state.zoomScale = Math.max(0.25, Math.min(2, Number(this.value) / 100));
    layoutStage();
    save();
  });

  /* Keep browser zoom untouched: Ctrl/Cmd + wheel only changes the canvas
   * while the pointer is over it. Ordinary wheel events still scroll the
   * captured profile vertically or pan it horizontally as usual. */
  $('#stage-scroll').addEventListener('wheel', function (event) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    var current = Number($('#stage-zoom-slider').value) / 100;
    var next = current + (event.deltaY < 0 ? 0.05 : -0.05);
    state.zoom = 'manual';
    state.zoomScale = Math.max(0.25, Math.min(2, Math.round(next * 20) / 20));
    layoutStage();
    save();
  }, { passive: false });

  $('#enforce').addEventListener('change', function () {
    state.enforce = this.checked;
    pushPayload();
    save();
  });

  $('#inspect-toggle').addEventListener('click', function () {
    state.inspector = !state.inspector;
    this.classList.toggle('is-on', state.inspector);
    post({ type: 'inspector', on: state.inspector });
    if (state.inspector) showWorkspacePanel('design');
    if (!state.inspector) $('#pick-result').textContent = '';
  });

  function toggleCodePane() {
    var hidden = $('.layout').classList.toggle('code-hidden');
    $('#show-code').classList.toggle('is-active', !hidden);
    setTimeout(layoutStage, 0);
  }
  $('#toggle-code').addEventListener('click', toggleCodePane);
  $('#show-code').addEventListener('click', toggleCodePane);

  $('#copy-css').addEventListener('click', function () {
    copy(state.code);
    var blocked = lintIssues.filter(function (it) { return it.severity !== 'advisory'; }).length;
    var advisory = lintIssues.length - blocked;
    reportToHost('css_copied', blocked_label(blocked));
    var msg;
    if (blocked) {
      msg = 'Copied — but ' + blocked + ' thing' + (blocked > 1 ? 's' : '') + ' in it will be stripped by JanitorAI';
    } else if (advisory) {
      msg = 'Copied — but ' + advisory + ' spot' + (advisory > 1 ? 's show' : ' shows') +
        ' an extra gap, see the layout warning below';
    } else {
      msg = 'Copied. Paste into JanitorAI → profile settings → About Me.';
    }
    toast(msg);
  });

  $('#clear-css').addEventListener('click', function () {
    if (state.code && !confirm('Delete everything in the About Me box?')) return;
    setCode(window.JaiPayload.STARTER);
  });

  $('#format-css').addEventListener('click', function () {
    editCss(function (css) { return tidy(css); });
  });

  /*
   * Re-indents by brace depth. Deliberately line-based: reflowing arbitrary CSS
   * properly means reprinting from the parser, which would throw away the
   * creator's own formatting and comments. This only fixes indentation.
   */
  function tidy(css) {
    var out = '';
    var depth = 0;

    function indent(n) { return new Array(n + 1).join('  '); }

    css.split(/\n/).forEach(function (line) {
      var t = line.trim();
      if (!t) { out += '\n'; return; }
      if (t[0] === '}') depth = Math.max(0, depth - 1);
      out += indent(depth) + t + '\n';
      if (/\{\s*$/.test(t)) depth++;
    });
    return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing else to try */ }
    document.body.removeChild(ta);
  }

  function blocked_label(count) { return count ? 'with-blocked' : 'clean'; }

  var toastTimer = null;
  function toast(message) {
    var t = $('#toast');
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ------------------------------------------------------------------ cards
  //
  // The roster of hardcoded characters. It is deliberately *not* part of the
  // document: the document is the output, this is the source it is generated
  // from, so it lives in its own storage key and survives clearing the editor.
  // js/hardcode.js turns it into markup and the slice of CSS that scales with
  // it; everything else in the stylesheet stays hand-written.

  var CARDS_KEY = 'jai-css-studio:cards';
  var FIELDS = [
    { key: 'name', label: 'Name', placeholder: 'Celeste' },
    { key: 'tagline', label: 'Tagline', placeholder: 'The “Bully” · Awkward friendship route' },
    { key: 'quote', label: 'Quote (optional)', placeholder: '“MON DIEU!”' },
    { key: 'description', label: 'Short description', type: 'textarea', placeholder: 'One or two lines.' },
    { key: 'tags', label: 'Tags (comma separated)', placeholder: 'Female, OC, AnyPOV, Fluff' },
    { key: 'link', label: 'Character link', placeholder: 'https://janitorai.com/characters/…' },
    { key: 'portrait', label: 'Portrait override (optional)', placeholder: 'Defaults to the bot image' },
    { key: 'art', label: 'Stage art override (optional)', placeholder: 'Defaults to the bot image; any aspect ratio works' },
    { key: 'hover', label: 'Hover art override (optional)', placeholder: 'Any aspect ratio; centered and clipped' }
  ];

  var cards = { roster: [], options: {}, search: '', selected: {} };
  var cardIdSeq = 0;

  function ensureCardId(entry) {
    if (!entry || entry._studioId) return entry && entry._studioId;
    Object.defineProperty(entry, '_studioId', {
      value: 'card-' + (++cardIdSeq), enumerable: false, configurable: false
    });
    return entry._studioId;
  }

  function ensureCardIds() {
    cards.roster.forEach(ensureCardId);
  }

  function cardIsSelected(entry) {
    return !!(entry && cards.selected[ensureCardId(entry)]);
  }

  function setCardSelected(entry, selected) {
    if (!entry) return;
    var id = ensureCardId(entry);
    if (selected) cards.selected[id] = true;
    else delete cards.selected[id];
  }

  function visibleCardEntries() {
    var query = cards.search.trim().toLowerCase();
    return cards.roster.filter(function (entry) {
      return !query || String(entry.name || '').toLowerCase().indexOf(query) !== -1;
    });
  }

  function updateCardSelectionUi() {
    var visible = visibleCardEntries();
    var selected = cards.roster.filter(cardIsSelected);
    var visibleSelected = visible.filter(cardIsSelected);
    var selectAll = $('#cards-select-all');
    if (selectAll) {
      selectAll.checked = !!visible.length && visibleSelected.length === visible.length;
      selectAll.indeterminate = !!visibleSelected.length && visibleSelected.length < visible.length;
      selectAll.disabled = !visible.length;
    }
    var count = $('#cards-selection-count');
    if (count) count.textContent = selected.length + ' selected';
    var clear = $('#cards-clear-selection');
    if (clear) clear.disabled = !selected.length;
    var remove = $('#cards-delete-selected');
    if (remove) remove.disabled = !selected.length;
  }

  function loadCards() {
    try {
      var saved = JSON.parse(localStorage.getItem(CARDS_KEY) || 'null');
      if (saved && Array.isArray(saved.roster)) {
        cards.roster = saved.roster;
        cards.options = saved.options || {};
      }
    } catch (e) { /* corrupt or private mode: start with an empty roster */ }
    ensureCardIds();
  }

  function saveCards() {
    try {
      localStorage.setItem(CARDS_KEY, JSON.stringify({ roster: cards.roster, options: cards.options }));
    } catch (e) { /* quota or private mode — not worth interrupting the user */ }
  }

  /*
   * Which layout stylesheet to write. Left alone, the panel guesses: a document
   * that already styles .cs-shell has a look of its own and should keep it,
   * an empty one would otherwise produce a pile of unstyled divs.
   */
  function effectiveStyle() {
    if (cards.options.style) return cards.options.style;
    // Once a style has been written, its own .cs-shell rules are in the
    // document — so the guess has to stop guessing, or the next write would
    // decide the document is hand-styled and take the stylesheet back out.
    if (state.code.indexOf(window.JaiHardcode.markers.styleStart) !== -1) return 'contact-select';
    return /\.cs-shell\s*[,{]/.test(state.code) ? 'none' : 'contact-select';
  }

  /* Writing is the moment a guess becomes a decision. */
  function commitStyle() {
    if (!cards.options.style) { cards.options.style = effectiveStyle(); saveCards(); }
  }

  function cardOption(key) {
    return cards.options[key] != null && cards.options[key] !== ''
      ? cards.options[key] : window.JaiHardcode.defaults[key];
  }

  /* The emitter takes a chip count; the panel spells it as "0 turns it off". */
  function cardEmitOptions() {
    var opts = {};
    Object.keys(window.JaiHardcode.defaults).forEach(function (k) { opts[k] = cardOption(k); });
    opts.style = effectiveStyle();
    var chips = parseInt(cards.options.filterChips, 10);
    var listed = String(cards.options.filterList || '').trim();
    opts.filters = listed ? listed : (isNaN(chips) ? true : chips > 0);
    opts.filterLimit = isNaN(chips) ? undefined : chips;
    return opts;
  }

  function renderCards() {
    var list = $('#cards-list');
    ensureCardIds();
    var query = cards.search.trim().toLowerCase();
    if (!cards.roster.length) {
      list.innerHTML = '<p class="cards-empty">No characters yet. <b>Detect from profile</b> reads the ' +
        'cards already in your preview; <b>Add blank card</b> starts one by hand.</p>';
    } else {
      list.innerHTML = cards.roster.map(function (entry, i) {
        var name = entry.name || 'Untitled';
        if (query && name.toLowerCase().indexOf(query) === -1) return '';
        var tagCount = (typeof entry.tags === 'string'
          ? entry.tags.split(',').filter(function (t) { return t.trim(); })
          : (entry.tags || [])).length;
        return '<details class="card-row" data-index="' + i + '">' +
          '<summary><input type="checkbox" class="card-select" data-select aria-label="Select ' + escapeHtml(name) + '"' +
          (cardIsSelected(entry) ? ' checked' : '') + '><span class="card-row-name">' + escapeHtml(name) + '</span>' +
          '<span class="card-row-meta">' + (i + 1 < 10 ? '0' : '') + (i + 1) +
          (tagCount ? ' · ' + tagCount + ' tag' + (tagCount === 1 ? '' : 's') : '') +
          (entry.art || entry.portrait ? '' : ' · no image') + '</span></summary>' +
          FIELDS.map(function (f) {
            var value = entry[f.key];
            if (f.key === 'tags' && Array.isArray(value)) value = value.join(', ');
            return '<label class="field">' + escapeHtml(f.label) +
              (f.type === 'textarea'
                ? '<textarea rows="3" data-field="' + f.key + '" placeholder="' +
                  escapeHtml(f.placeholder) + '">' + escapeHtml(value || '') + '</textarea>'
                : '<input type="text" data-field="' + f.key + '" placeholder="' +
                  escapeHtml(f.placeholder) + '" value="' + escapeHtml(value || '') + '">') +
              '</label>';
          }).join('') +
          '<div class="card-row-buttons">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-move="-1" title="Move up">↑</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-move="1" title="Move down">↓</button>' +
            '<button type="button" class="btn btn-ghost btn-sm card-remove" data-remove>Remove</button>' +
          '</div></details>';
      }).join('') || '<p class="cards-empty">No character matches “' + escapeHtml(cards.search) + '”.</p>';
    }

    var styleSelect = $('#cards-opt-style');
    if (!styleSelect.options.length) {
      styleSelect.innerHTML = window.JaiHardcodeStyles.list.map(function (style) {
        return '<option value="' + style.id + '">' + escapeHtml(style.name) + '</option>';
      }).join('');
    }
      styleSelect.value = effectiveStyle();
    $('#cards-style-hint').textContent = window.JaiHardcodeStyles.get(effectiveStyle()).blurb;

    $('#cards-opt-title').value = cards.options.title || '';
    $('#cards-opt-kicker').value = cards.options.kicker || '';
    $('#cards-opt-launch').value = cards.options.launch || '';
    $('#cards-opt-slots').value = cardOption('slots');
    $('#cards-opt-filters').value = cards.options.filterChips != null ? cards.options.filterChips : 8;
    $('#cards-opt-filterlist').value = cards.options.filterList || '';
    $('#cards-opt-accent').value = cardOption('accent');
    $('#cards-opt-preview').value = cardOption('preview');
    ['profileLabel', 'profileMark', 'aboutTitle', 'aboutBody', 'creatorNotes', 'friendsTitle', 'discord', 'footerText']
      .forEach(function (key) { $('#cards-opt-' + key).value = cardOption(key); });

    var applied = window.JaiHardcode.isApplied(state.code);
    $('#cards-insert').textContent = applied ? 'Update About Me' : 'Insert into About Me';
    $('#cards-insert').disabled = !cards.roster.length;
    $('#cards-insert-hint').textContent = !cards.roster.length ? ''
      : applied ? 'Rewrites only the generated block.'
      : 'Adds a generated block; the rest of your code is untouched.';
    updateCardSelectionUi();
  }

  function cardsStatus(message) { $('#cards-status').textContent = message || ''; }

  /*
   * Once the generated block is in the document, the roster and the document
   * have to stay in step: typing a new name and watching the old one sit in the
   * preview is just a bug with extra steps. Debounced, because every keystroke
   * would otherwise rebuild the payload and re-render the preview.
   */
  var reapplyTimer = null;
  function reapplyCards(delay) {
    if (!window.JaiHardcode.isApplied(state.code)) return;
    clearTimeout(reapplyTimer);
    reapplyTimer = setTimeout(function () {
      var next = cards.roster.length
        ? window.JaiHardcode.apply(state.code, cards.roster, cardEmitOptions())
        : window.JaiHardcode.remove(state.code);
      if (next !== state.code) setCode(next, 'cards');
    }, delay == null ? 260 : delay);
  }

  $('#cards-list').addEventListener('input', function (e) {
    var row = e.target.closest('.card-row');
    var field = e.target.dataset.field;
    if (!row || !field) return;
    var entry = cards.roster[+row.dataset.index];
    if (!entry) return;
    entry[field] = e.target.value;
    if (field === 'name') $('.card-row-name', row).textContent = e.target.value || 'Untitled';
    saveCards();
    reapplyCards();
  });

  $('#cards-list').addEventListener('change', function (e) {
    if (!e.target.matches('[data-select]')) return;
    var row = e.target.closest('.card-row');
    if (!row) return;
    var entry = cards.roster[+row.dataset.index];
    if (!entry) return;
    setCardSelected(entry, e.target.checked);
    updateCardSelectionUi();
  });

  $('#cards-list').addEventListener('click', function (e) {
    var row = e.target.closest('.card-row');
    if (!row) return;
    if (e.target.matches('[data-select]')) {
      // Selecting a card should not also open/close its details row.
      e.preventDefault();
      e.stopPropagation();
      var entry = cards.roster[+row.dataset.index];
      var checked = !e.target.checked;
      e.target.checked = checked;
      setCardSelected(entry, checked);
      updateCardSelectionUi();
      return;
    }
    var index = +row.dataset.index;
    if (e.target.dataset.remove != null) {
      if (!confirm('Remove ' + (cards.roster[index].name || 'this card') + ' from the roster?')) return;
      delete cards.selected[ensureCardId(cards.roster[index])];
      cards.roster.splice(index, 1);
    } else if (e.target.dataset.move) {
      var to = index + (+e.target.dataset.move);
      if (to < 0 || to >= cards.roster.length) return;
      cards.roster.splice(to, 0, cards.roster.splice(index, 1)[0]);
    } else {
      return;
    }
    saveCards();
    renderCards();
    reapplyCards(0);
  });

  $('#cards-select-all').addEventListener('change', function () {
    visibleCardEntries().forEach(function (entry) {
      var id = ensureCardId(entry);
      if ($('#cards-select-all').checked) cards.selected[id] = true;
      else delete cards.selected[id];
    });
    renderCards();
  });

  $('#cards-clear-selection').addEventListener('click', function () {
    cards.selected = {};
    renderCards();
  });

  $('#cards-delete-selected').addEventListener('click', function () {
    var selected = cards.roster.filter(cardIsSelected);
    if (!selected.length) return;
    var noun = selected.length === 1 ? 'card' : 'cards';
    if (!confirm('Delete ' + selected.length + ' selected ' + noun + ' from the roster?')) return;
    cards.roster = cards.roster.filter(function (entry) { return !cardIsSelected(entry); });
    cards.selected = {};
    saveCards();
    renderCards();
    reapplyCards(0);
    cardsStatus('Deleted ' + selected.length + ' ' + noun + '.');
  });

  $('#cards-search').addEventListener('input', function () {
    cards.search = this.value;
    renderCards();
  });

  $('#cards-add').addEventListener('click', function () {
    cards.roster.push({ name: '', tagline: '', quote: '', description: '', tags: '', link: '', portrait: '', art: '', hover: '' });
    cards.search = '';
    $('#cards-search').value = '';
    saveCards();
    renderCards();
    var last = $$('.card-row').pop();
    if (last) { last.open = true; last.scrollIntoView({ block: 'nearest' }); }
    cardsStatus('');
  });

  /*
   * The preview iframe holds the real captured profile, so the cards in it are
   * the site's own markup — name, description, tags, link and avatar come
   * straight off them. The bot image fills both portrait and stage art by
   * default; tagline, quote and optional art overrides stay creator-controlled.
   */
  $('#cards-detect').addEventListener('click', function () {
    var doc = frame.contentDocument;
    var found = doc ? window.JaiHardcode.fromDocument(doc) : [];
    if (!found.length) {
      cardsStatus('No cards found in the preview. Import a profile in Settings first.');
      return;
    }
    var have = {};
    cards.roster.forEach(function (entry) { have[String(entry.name || '').toLowerCase()] = entry; });
    var added = 0, updated = 0;
    found.forEach(function (entry) {
      var key = entry.name.toLowerCase();
      var existing = have[key];
      if (existing) {
        var changed = false;
        ['portrait', 'art'].forEach(function (field) {
          if (!existing[field] && entry[field]) { existing[field] = entry[field]; changed = true; }
        });
        if (changed) updated++;
        return;
      }
      entry.tags = entry.tags.join(', ');
      cards.roster.push(entry);
      have[key] = entry;
      added++;
    });
    saveCards();
    renderCards();
    reapplyCards(0);
    reportToHost('cards_detected', String(added));
    cardsStatus(added || updated
      ? (added ? 'Added ' + added + ' character' + (added === 1 ? '' : 's') + '. ' : '') +
        (updated ? 'Filled the missing images for ' + updated + ' existing character' +
          (updated === 1 ? '. ' : 's. ') : '') +
        'Bot images fill the portraits and centered stage art by default; taglines, quotes and optional overrides are still yours.'
      : 'Every character in the preview is already in the roster.');
  });

  $('#cards-opt-style').addEventListener('change', function () {
    cards.options.style = this.value;
    saveCards();
    renderCards();
    reapplyCards(0);
  });

  $$('#cards-opt-title, #cards-opt-kicker, #cards-opt-launch, #cards-opt-slots, #cards-opt-filters, #cards-opt-filterlist, #cards-opt-accent, #cards-opt-preview, #cards-opt-profileLabel, #cards-opt-profileMark, #cards-opt-aboutTitle, #cards-opt-aboutBody, #cards-opt-creatorNotes, #cards-opt-friendsTitle, #cards-opt-discord, #cards-opt-footerText')
    .forEach(function (input) {
      input.addEventListener('input', function () {
        var key = input.id.replace('cards-opt-', '');
        if (key === 'filters') cards.options.filterChips = input.value;
        else if (key === 'filterlist') cards.options.filterList = input.value;
        else if (key === 'slots') cards.options.slots = parseInt(input.value, 10) || 1;
        else cards.options[key] = input.value;
        saveCards();
        reapplyCards();
      });
    });

  $('#cards-insert').addEventListener('click', function () {
    commitStyle();
    var next = window.JaiHardcode.apply(state.code, cards.roster, cardEmitOptions());
    if (next === state.code) { toast('About Me already matches the roster.'); return; }
    setCode(next, 'cards');
    reportToHost('cards_inserted', String(cards.roster.length));
    toast(cards.roster.length + ' character' + (cards.roster.length === 1 ? '' : 's') + ' written into About Me.');
    renderCards();
  });

  $('#hardcoding-toggle').addEventListener('click', function () {
    var tab = $('.sidebar-tabs button[data-panel="cards"]');
    if (tab) tab.click();
    $('#cards-search').focus();
  });

  // ------------------------------------------------------------------ start

  load();
  renderProfileSwitcher();
  applyPanelLayout();
  $('#enforce').checked = state.enforce;
  $$('.viewport-switch button').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.viewport === state.viewport);
  });
  $('#custom-width').value = state.customWidth;
  $('#custom-width').hidden = state.viewport !== 'custom';

  loadCards();
  renderControls();
  renderPresets();
  renderTemplates();
  renderCustomPresets();
  renderCards();
  renderProfileFields();
  renderReference('');
  setCode(state.code || window.JaiPayload.STARTER);
  layoutStage();
  reportToHost('studio_ready');
  if (window.JaiControls.groups.length) $('.group').classList.add('is-open');
})();
