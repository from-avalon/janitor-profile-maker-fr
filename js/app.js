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
    panel: 'design',
    zoom: 'fit',
    customWidth: 1600,
    autoParts: []          // template part ids added only because another part needed them
  };

  var importedProfile = false;
  var hadSavedData = false;

  var frameReady = false;
  var index = {};          // normalised selector -> { property: value }
  var lintIssues = [];

  // ------------------------------------------------------------ persistence

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        code: state.code, data: state.data, viewport: state.viewport,
        enforce: state.enforce, customWidth: state.customWidth, autoParts: state.autoParts
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
        css: window.JaiPayload.allCss(payload),
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
    var scale = state.zoom === 'actual' ? 1 : Math.max(0.05, Math.min(1, avail / vp.w));

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
    $('#stage-zoom').textContent = Math.round(scale * 100) + '%';
    $('#stage-zoom').classList.toggle('is-on', state.zoom === 'actual');
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
    // Blocked ranges are painted first so the wavy underline wraps whole
    // declarations rather than individual tokens.
    lintIssues.forEach(function (it) {
      if (it.start < cursor) return;
      html += tokeniseMixed(css.slice(cursor, it.start));
      html += '<span class="tok-blocked">' + tokeniseMixed(css.slice(it.start, it.end)) + '</span>';
      cursor = it.end;
    });
    html += tokeniseMixed(css.slice(cursor));
    highlight.innerHTML = html + '\n';

    var lines = css.split('\n').length;
    var bad = {};
    lintIssues.forEach(function (it) { bad[it.line] = true; });
    var g = '';
    for (var i = 1; i <= lines; i++) g += '<div' + (bad[i] ? ' class="has-issue"' : '') + '>' + i + '</div>';
    gutter.innerHTML = g;

    input.style.height = 'auto';
    input.style.height = Math.max(highlightPre.scrollHeight, editorScroll.clientHeight) + 'px';
    $('#code-stats').textContent = lines + ' lines · ' + css.length + ' chars';
  }

  editorScroll.addEventListener('scroll', function () {
    gutter.scrollTop = editorScroll.scrollTop;
  });

  function renderLint() {
    var box = $('#lint');
    if (!lintIssues.length) {
      box.innerHTML = '<div class="lint-clean"><b>✓ Clean</b> — nothing here gets stripped by JanitorAI.</div>';
      return;
    }
    var html = '<div class="lint-head">' + lintIssues.length +
      (lintIssues.length === 1 ? ' blocked rule' : ' blocked rules') + '</div>';
    lintIssues.forEach(function (it, i) {
      html += '<button type="button" class="lint-item" data-issue="' + i + '">' +
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

  $('#lint').addEventListener('click', function (e) {
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

  $('#control-search').addEventListener('input', function (e) {
    var q = e.target.value.trim().toLowerCase();
    controlNodes.forEach(function (c) {
      var hay = (c.def.label + ' ' + c.def.sel + ' ' + c.def.prop).toLowerCase();
      c.node.style.display = !q || hay.indexOf(q) !== -1 ? '' : 'none';
    });
    $$('.group').forEach(function (g) {
      var visible = $$('.ctrl', g).some(function (n) { return n.style.display !== 'none'; });
      g.style.display = visible ? '' : 'none';
      if (q && visible) g.classList.add('is-open');
    });
  });

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

  function updateImportStatus(message, imported) {
    $('#profile-import-status').textContent = message;
    $('#reset-import').hidden = !imported;
  }

  function applyImportedProfile(profile, filename) {
    importedProfile = true;
    Object.keys(profile.data).forEach(function (key) {
      if (profile.data[key] != null && profile.data[key] !== '') state.data[key] = profile.data[key];
    });
    if (typeof profile.aboutMe === 'string') setCode(profile.aboutMe);
    renderProfileFields();
    pushProfile(profile);
    pushData();
    pushPayload();
    save();
    reportToHost('profile_imported');
    updateImportStatus('Using “' + filename + '” in this preview. Your file was read locally and is not kept after a refresh.', true);
    toast('Profile imported — your About Me content is now in the editor');
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

  $('#reset-import').addEventListener('click', function () {
    importedProfile = false;
    window.JaiProfileImport.release();
    state.data = Object.assign({}, DEFAULT_DATA);
    hadSavedData = false;
    renderProfileFields();
    post({ type: 'profile', reset: true });
    pushData();
    pushPayload();
    loadBundledProfile();
    toast('Switched back to ' + DEFAULT_PROFILE_LABEL);
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
    if (importedProfile) return Promise.resolve(false);
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
        // Only fill in fields the creator has not already set for themselves.
        if (!hadSavedData) {
          Object.keys(profile.data).forEach(function (key) {
            if (profile.data[key] != null && profile.data[key] !== '') {
              state.data[key] = profile.data[key];
            }
          });
          renderProfileFields();
        }
        pushProfile(profile);
        pushData();
        pushPayload();
        updateImportStatus('Using ' + DEFAULT_PROFILE_LABEL +
          '. Pick a file below to design against a different one.', false);
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
    var label = t.selector;
    var out = $('#pick-result');
    out.textContent = label + '  ↵ add rule';
    out.dataset.sel = label;
    out.title = 'Labels: ' + (t.labels.join(' ') || '—') +
                '\nEmotion: ' + (t.emotion.join(' ') || '—') +
                '\nClick to add a rule for this element.';
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
    layoutStage();
    input.focus();
    input.setSelectionRange(caret, caret);
    editorScroll.scrollTop = Math.max(0, (window.CssModel.lineOf(state.code, caret) - 5) * 19.2);
  }

  // ------------------------------------------------------------- toolbar

  var customWidth = $('#custom-width');

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
      $$('.panel').forEach(function (p) { p.hidden = p.dataset.panel !== state.panel; });
    });
  });

  $('#stage-zoom').addEventListener('click', function () {
    state.zoom = state.zoom === 'fit' ? 'actual' : 'fit';
    layoutStage();
  });

  $('#enforce').addEventListener('change', function () {
    state.enforce = this.checked;
    pushPayload();
    save();
  });

  $('#inspect-toggle').addEventListener('click', function () {
    state.inspector = !state.inspector;
    this.classList.toggle('is-on', state.inspector);
    post({ type: 'inspector', on: state.inspector });
    if (!state.inspector) $('#pick-result').textContent = '';
  });

  function toggleCodePane() {
    var hidden = $('.layout').classList.toggle('code-hidden');
    $('#show-code').hidden = !hidden;
    setTimeout(layoutStage, 0);
  }
  $('#toggle-code').addEventListener('click', toggleCodePane);
  $('#show-code').addEventListener('click', toggleCodePane);

  $('#copy-css').addEventListener('click', function () {
    copy(state.code);
    reportToHost('css_copied', blocked_label(lintIssues.length));
    var blocked = lintIssues.length;
    toast(blocked
      ? 'Copied — but ' + blocked + ' thing' + (blocked > 1 ? 's' : '') +
        ' in it will be stripped by JanitorAI'
      : 'Copied. Paste into JanitorAI → profile settings → About Me.');
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

  // ------------------------------------------------------------------ start

  load();
  $('#enforce').checked = state.enforce;
  $$('.viewport-switch button').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.viewport === state.viewport);
  });
  $('#custom-width').value = state.customWidth;
  $('#custom-width').hidden = state.viewport !== 'custom';

  renderControls();
  renderPresets();
  renderTemplates();
  renderCustomPresets();
  renderProfileFields();
  renderReference('');
  setCode(state.code || window.JaiPayload.STARTER);
  layoutStage();
  reportToHost('studio_ready');
  if (window.JaiControls.groups.length) $('.group').classList.add('is-open');
})();
