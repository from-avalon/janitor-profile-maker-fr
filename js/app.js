/*
 * JanitorAI Profile CSS Studio.
 *
 * The studio holds one document: the contents of your JanitorAI About Me box,
 * which is HTML with <style> blocks in it. That document is the only state that
 * matters. Everything done on the canvas — restyling an element, dragging one
 * somewhere else, retyping its text — is an edit to that text; the properties
 * panel reads its values back out of it; and the preview is fed the same
 * document after the linter has removed whatever JanitorAI would strip. Nothing
 * renders in the preview that would not render on your profile.
 *
 * This file is the core: the document, its history, the preview bridge, the
 * shell, and the Templates and Profile data panels. The canvas-facing pieces
 * live in their own files (canvas.js, layers.js, insert.js, inspector.js) and
 * reach in through `window.JaiStudio`, defined at the bottom.
 */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var STORE_KEY = 'jai-css-studio:v2';
  // Captures themselves live in IndexedDB (see profile-library.js); this
  // small record only remembers which one was open and the library options.
  var PROFILE_LIBRARY_KEY = 'jai-css-studio:profile-library-settings';

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
    // username/avatar/followers/memberSince/background are edited directly in
    // the preview -- double-click the text, right-click the image (see the
    // 'fieldEdit' message case below). They stay in DEFAULT_DATA
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
    mode: 'design',        // 'design' selects and drags; 'preview' behaves like the page
    panel: 'layers',
    zoom: 'fit',
    zoomScale: 1,
    previewCss: true,
    customWidth: 1600,
    sidebarWidth: null,
    inspectorWidth: null,
    sidebarHidden: false,
    uiHidden: false,
    dockOpen: false,       // the About Me code, under the canvas
    dockTab: 'code',
    dockHeight: null,
    autoParts: []          // template part ids added only because another part needed them
  };

  var importedProfile = false;
  var hadSavedData = false;
  var profileSnapshots = [];
  var activeProfileId = null;
  var keepDefaultProfile = true;
  var profileIdSeq = 0;
  var profileBootPromise = null;
  var profileSaveTimers = {};
  var appReady = false;

  var frameReady = false;
  var index = {};          // normalised selector -> { property: value }
  var lintIssues = [];

  // ---------------------------------------------------------------- events
  //
  // The canvas modules are separate files loaded after this one. They hear
  // about changes here rather than being called by name, so this file does not
  // need to know which of them exist.

  var listeners = {};

  function on(name, fn) { (listeners[name] || (listeners[name] = [])).push(fn); }

  function emit(name, data) {
    (listeners[name] || []).forEach(function (fn) {
      try { fn(data); } catch (err) {
        // One panel failing to redraw must not stop the document being saved.
        console.error('JAI Studio: a "' + name + '" listener failed', err);
      }
    });
  }

  // ------------------------------------------------------------ persistence

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        code: state.code, data: state.data, viewport: state.viewport,
        enforce: state.enforce, customWidth: state.customWidth, zoom: state.zoom,
        zoomScale: state.zoomScale, previewCss: state.previewCss, autoParts: state.autoParts,
        sidebarWidth: state.sidebarWidth, inspectorWidth: state.inspectorWidth,
        sidebarHidden: state.sidebarHidden, panel: state.panel,
        dockOpen: state.dockOpen, dockTab: state.dockTab, dockHeight: state.dockHeight
      }));
    } catch (e) { /* private mode, quota — not worth interrupting the user */ }
    saveProfileLibrarySettings();
    queueSnapshotPersist(activeSnapshot());
  }

  function saveProfileLibrarySettings() {
    try {
      localStorage.setItem(PROFILE_LIBRARY_KEY, JSON.stringify({
        activeProfileId: activeProfileId,
        keepDefaultProfile: keepDefaultProfile,
        profileIdSeq: profileIdSeq
      }));
    } catch { /* IndexedDB remains useful even if this preference cannot persist */ }
  }

  function loadProfileLibrarySettings() {
    try {
      var saved = JSON.parse(localStorage.getItem(PROFILE_LIBRARY_KEY) || 'null');
      if (!saved) return;
      if (typeof saved.activeProfileId === 'string') activeProfileId = saved.activeProfileId;
      if (typeof saved.keepDefaultProfile === 'boolean') keepDefaultProfile = saved.keepDefaultProfile;
      if (typeof saved.profileIdSeq === 'number') profileIdSeq = saved.profileIdSeq;
    } catch { /* invalid settings should not stop the editor opening */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (typeof saved.code === 'string') state.code = saved.code;
        if (typeof saved.customWidth === 'number') state.customWidth = saved.customWidth;
        if (saved.zoom === 'fit' || saved.zoom === 'actual' || saved.zoom === 'manual') state.zoom = saved.zoom;
        if (typeof saved.zoomScale === 'number') state.zoomScale = Math.max(0.25, Math.min(2, saved.zoomScale));
        if (typeof saved.previewCss === 'boolean') state.previewCss = saved.previewCss;
        if (typeof saved.sidebarWidth === 'number') state.sidebarWidth = saved.sidebarWidth;
        if (typeof saved.inspectorWidth === 'number') state.inspectorWidth = saved.inspectorWidth;
        if (typeof saved.sidebarHidden === 'boolean') state.sidebarHidden = saved.sidebarHidden;
        if (typeof saved.panel === 'string') state.panel = saved.panel;
        if (typeof saved.dockOpen === 'boolean') state.dockOpen = saved.dockOpen;
        if (saved.dockTab === 'code' || saved.dockTab === 'reference') state.dockTab = saved.dockTab;
        if (typeof saved.dockHeight === 'number') state.dockHeight = saved.dockHeight;
        if (Array.isArray(saved.autoParts)) state.autoParts = saved.autoParts;
        if (saved.data) {
          state.data = Object.assign({}, DEFAULT_DATA, saved.data);
          hadSavedData = true;
        }
        if (saved.viewport && VIEWPORTS[saved.viewport]) state.viewport = saved.viewport;
        if (typeof saved.enforce === 'boolean') state.enforce = saved.enforce;
      }
    } catch (e) { /* corrupt payload; fall back to defaults */ }
    loadProfileLibrarySettings();
  }

  // ---------------------------------------------------------------- preview

  var frame = $('#preview');

  function post(msg) {
    if (frameReady && frame.contentWindow) frame.contentWindow.postMessage(msg, '*');
  }

  var pushTimer = null;

  function sendPayload() {
    // Every element is numbered first (data-jx), so a click in the preview can
    // be traced back to its place in the document. The numbers go on before
    // the linter cuts anything out, which keeps them matching js/markup.js.
    var tagged = window.JaiMarkup.tagged(state.code);
    var payload = state.enforce ? window.JaiLint.sanitisePayload(tagged) : tagged;
    liveRules = {};
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
    emit('pushed');
  }

  /* `now` skips the debounce: a drag or a delete on the canvas should land in
   * the preview before the next thing the creator does to it. */
  function pushPayload(now) {
    clearTimeout(pushTimer);
    if (now) sendPayload();
    else pushTimer = setTimeout(sendPayload, 60);
  }

  /*
   * A value being dragged in the properties panel is written into the document
   * straight away, but the full pass that follows (parse, lint, re-highlight)
   * is debounced. Until it lands, the one declaration is shown through a small
   * extra sheet in the preview, so a scrub feels live. Nothing blocked is ever
   * shown this way: the preview must stay honest even for a quarter-second.
   */
  var liveRules = {};

  function setLive(selector, prop, value) {
    if (!state.previewCss) return;
    var key = selector + '\u0000' + prop;
    if (value == null || value === '') {
      delete liveRules[key];
    } else {
      var rule = selector + ' { ' + prop + ': ' + value + '; }';
      if (state.enforce && window.JaiLint.analyse(rule).length) return;
      liveRules[key] = rule;
    }
    post({ type: 'live', css: Object.keys(liveRules).map(function (k) { return liveRules[k]; }).join('\n') });
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
    post({ type: 'mode', mode: state.mode });
    bootProfiles();
    emit('frame:connected');
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
      // A name or count typed straight into the preview is profile info too.
      if (['username', 'followers', 'memberSince'].indexOf(m.key) !== -1) {
        info.identity[m.key] = m.value;
        saveInfo();
        renderIdentity();
        reapplyCards();
      }
      pushData();
      save();
    } else if (typeof m.type === 'string') {
      // Everything else is the canvas talking: a selection, a drag, a retyped
      // line. js/canvas.js listens for those.
      emit('frame:' + m.type, m);
    }
  });

  // -------------------------------------------------------- stage sizing
  //
  // The iframe is given the real pixel width of the device being simulated and
  // then scaled down to fit the pane. Scaling the frame rather than resizing it
  // is what keeps JanitorAI's own media queries firing at the right widths.

  var stageScale = 1;      // the zoom the canvas is currently drawn at

  function layoutStage() {
    var vp = VIEWPORTS[state.viewport];
    if (state.viewport === 'custom') vp = { w: state.customWidth, h: 1000 };
    var scroll = $('#stage-scroll');
    var sizer = $('#stage-sizer');
    var wrap = $('#stage-frame');
    var avail = scroll.clientWidth - 40;
    // clientWidth can read as 0 mid-relayout (toggling the code dock), which
    // would otherwise flash a nonsense zoom figure.
    var fitScale = Math.max(0.05, Math.min(1, avail / vp.w));
    var scale = state.zoom === 'actual' ? 1
      : state.zoom === 'manual' ? state.zoomScale
      : fitScale;
    stageScale = scale;

    // A desktop window is as tall as it is: let the simulated one use whatever
    // height the pane has rather than stopping at a nominal 900px. Phones and
    // tablets keep their device height, which is part of what is being checked.
    var height = vp.h;
    if (vp.w >= 1000) {
      height = Math.max(vp.h, Math.floor((scroll.clientHeight - 40) / scale));
    }

    frame.style.width = vp.w + 'px';
    frame.style.height = height + 'px';
    wrap.style.width = vp.w + 'px';
    wrap.style.height = height + 'px';
    wrap.style.transform = 'scale(' + scale + ')';
    // A transform does not affect layout size, so the sizer reserves the space
    // the scaled frame actually occupies.
    sizer.style.width = Math.round(vp.w * scale) + 'px';
    sizer.style.height = Math.round(height * scale) + 'px';

    $('#stage-size').textContent = vp.w + ' × ' + height;
    $('#zoom-label').textContent = (state.zoom === 'fit' ? 'Fit · ' : '') + Math.round(scale * 100) + '%';
    $('#zoom-label').classList.toggle('is-on', state.zoom !== 'fit');
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
    highlightStale = false;
  }

  /* Colouring a large document is the slowest thing the studio does, and with
   * the dock closed nobody is looking at it. It is skipped until asked for. */
  var highlightStale = true;

  function refreshHighlight() {
    if (state.dockOpen && state.dockTab === 'code') renderHighlight();
    else highlightStale = true;
  }

  /* The one-line verdict in the status bar: what JanitorAI would strip. */
  function renderStatus() {
    var blocked = lintIssues.filter(function (it) { return it.severity !== 'advisory'; }).length;
    var advisory = lintIssues.length - blocked;
    var button = $('#status-lint');
    var parts = [];
    if (blocked) parts.push(blocked + ' blocked');
    if (advisory) parts.push(advisory + (advisory === 1 ? ' layout warning' : ' layout warnings'));
    button.textContent = parts.length ? '● ' + parts.join(' · ') : '✓ Clean';
    button.className = 'status-lint ' + (blocked ? 'is-blocked' : advisory ? 'is-advisory' : 'is-clean');
    $('#code-stats').textContent = state.code.split('\n').length + ' lines · ' + state.code.length + ' chars';
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
    setDock(true, 'code');
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
   *
   * `opts.now` runs the pass immediately instead: a move or a delete on the
   * canvas has to reach the preview before the selection is put back on it.
   */
  function setCode(code, from, opts) {
    if (code !== state.code) remember(state.code, from);
    state.code = code;

    if (from !== 'editor') {
      syncingEditor = true;
      input.value = code;
      syncingEditor = false;
    }

    clearTimeout(renderTimer);
    if (opts && opts.now) runAnalysis(from, true);
    else renderTimer = setTimeout(function () { runAnalysis(from); }, RENDER_DEBOUNCE_MS);
  }

  function runAnalysis(from, now) {
    try {
      index = buildIndex(window.JaiPayload.allCss(state.code));
      lintIssues = window.JaiLint.analysePayload(state.code);
      refreshHighlight();
      renderLint();
      renderStatus();
      if (from !== 'presets') syncPresets();
      syncTemplates();
      syncCustomPresets();
      renderHardcodeSections();
    } catch (err) {
      // Whatever tripped this, the document itself is intact (state.code and
      // the textarea were already updated above) -- only the derived UI, which
      // this call rebuilds from scratch next time, is out of date.
      console.error('JAI Studio: analysis pass failed, will retry on next edit', err);
    }
    pushPayload(now);
    save();
    emit('change', { from: from });
  }

  // ---------------------------------------------------------------- history
  //
  // Every change to the document can be undone, whichever panel made it. A run
  // of changes from one source in quick succession — typing, or dragging a
  // value — is one step, so undo takes back the gesture and not one keystroke.

  var HISTORY_LIMIT = 150;
  var history = { undo: [], redo: [], from: null, at: 0 };

  function remember(previous, from) {
    if (!appReady || from === 'history') return;
    if (from === 'load' || from === 'profile') {
      // A different document altogether: its history starts here.
      history = { undo: [], redo: [], from: null, at: 0 };
      renderHistory();
      return;
    }
    var now = Date.now();
    // Only typing and scrubbing run together. A drag, a delete, a template:
    // each of those is its own step however quickly the next one follows.
    var continuous = from === 'editor' || from === 'inspector';
    var sameGesture = continuous && from === history.from && now - history.at < 700;
    history.from = from;
    history.at = now;
    history.redo = [];
    if (!sameGesture) {
      history.undo.push(previous);
      if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
    }
    renderHistory();
  }

  function renderHistory() {
    $('#undo').disabled = !history.undo.length;
    $('#redo').disabled = !history.redo.length;
  }

  function undo() {
    if (!history.undo.length) return;
    history.redo.push(state.code);
    history.from = null;
    setCode(history.undo.pop(), 'history', { now: true });
    renderHistory();
  }

  function redo() {
    if (!history.redo.length) return;
    history.undo.push(state.code);
    history.from = null;
    setCode(history.redo.pop(), 'history', { now: true });
    renderHistory();
  }

  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);

  /* Runs an edit against the CSS inside the payload's <style> block, creating
   * one if the About Me box does not have a stylesheet yet. */
  function editCss(fn, from) {
    setCode(window.JaiPayload.editCss(state.code, fn), from);
  }

  function readValue(sel, prop) {
    var bucket = index[window.CssModel.normaliseSelector(sel)];
    return bucket ? bucket[prop.toLowerCase()] : undefined;
  }

  /*
   * Rules between the hardcode markers are regenerated from Profile data, so
   * an edit made inside one would be gone the next time a character's name
   * changed. Visual edits never land there; they go into a rule of the
   * creator's own further down, which wins the tie.
   */
  function generatedCssRanges(css) {
    var markers = window.JaiHardcode.markers;
    var out = [];
    [[markers.cssStart, markers.cssEnd], [markers.styleStart, markers.styleEnd]].forEach(function (pair) {
      var from = css.indexOf(pair[0]);
      var to = css.indexOf(pair[1]);
      if (from !== -1 && to > from) out.push([from, to + pair[1].length]);
    });
    return out;
  }

  /* The rule a visual edit for `selector` belongs in: the last top-level one
   * the creator owns, in the last <style> block that has one. */
  function ownRule(selector, code) {
    var wanted = window.CssModel.normaliseSelector(selector);
    var blocks = window.JaiPayload.styleBlocks(code == null ? state.code : code);
    for (var b = blocks.length - 1; b >= 0; b--) {
      var generated = generatedCssRanges(blocks[b].css);
      var nodes = window.CssModel.parse(blocks[b].css);
      for (var i = nodes.length - 1; i >= 0; i--) {
        var n = nodes[i];
        if (n.type !== 'rule' || n.selector !== wanted || (n.atPath && n.atPath.length) || !n.decls) continue;
        var inside = generated.some(function (range) { return n.start >= range[0] && n.start < range[1]; });
        if (!inside) return { block: blocks[b], rule: n };
      }
    }
    return null;
  }

  /* The declarations of that rule, in the order they were written. */
  function ruleDeclarations(selector) {
    var own = ownRule(selector);
    return own ? own.rule.decls.map(function (d) {
      return { prop: d.prop, value: d.value, important: d.important };
    }) : [];
  }

  function writeValue(sel, prop, value, from) {
    from = from || 'inspector';
    var own = ownRule(sel);
    setLive(sel, prop, value);
    if (own) {
      var next = window.CssModel.setDeclaration(own.block.css, sel, prop, value, { rule: own.rule });
      setCode(state.code.slice(0, own.block.cssStart) + next + state.code.slice(own.block.cssEnd), from);
      return;
    }
    if (value == null || value === '') return;   // nothing of the creator's to remove
    editCss(function (css) {
      return css + (css && !/\n\s*$/.test(css) ? '\n\n' : (css.trim() ? '\n' : '')) +
        sel + ' {\n  ' + prop + ': ' + value + ';\n}\n';
    }, from);
  }

  /* Several properties of one rule as a single change. Sliding an element
   * sets `position`, `left` and `top` together: that is one gesture, so it has
   * to be one Undo. A null value removes the property. */
  function writeValues(sel, values, from) {
    var code = state.code;
    Object.keys(values).forEach(function (prop) {
      var value = values[prop];
      var removing = value == null || value === '';
      setLive(sel, prop, removing ? null : value);
      var own = ownRule(sel, code);
      if (own) {
        var next = window.CssModel.setDeclaration(own.block.css, sel, prop, removing ? null : value, { rule: own.rule });
        code = code.slice(0, own.block.cssStart) + next + code.slice(own.block.cssEnd);
      } else if (!removing) {
        code = window.JaiPayload.editCss(code, function (css) {
          return css + (css && !/\n\s*$/.test(css) ? '\n\n' : (css.trim() ? '\n' : '')) +
            sel + ' {\n  ' + prop + ': ' + value + ';\n}\n';
        });
      }
    });
    // Taking the last property out of a rule leaves `selector { }` behind;
    // a rule this wrote and then emptied should not stay in the document.
    var hollow = new RegExp('(^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{\\s*\\}\\n?', 'g');
    code = window.JaiPayload.editCss(code, function (css) {
      return css.replace(hollow, '$1').replace(/\n{3,}/g, '\n\n');
    });
    if (code !== state.code) setCode(code, from || 'canvas');
  }

  /* Renames one property of the creator's rule in place (the raw declaration
   * list lets a property name be retyped). */
  function renameDeclaration(sel, from, to) {
    var own = ownRule(sel);
    if (!own) return;
    var decl = null;
    own.rule.decls.forEach(function (d) { if (d.prop.toLowerCase() === from.toLowerCase()) decl = d; });
    if (!decl) return;
    var css = own.block.css;
    var next = css.slice(0, decl.start) + to + css.slice(decl.start + decl.prop.length);
    setCode(state.code.slice(0, own.block.cssStart) + next + state.code.slice(own.block.cssEnd), 'inspector');
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

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

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
  // components (see tools/build_template.py). Each renders as a card with one
  // "Add all" button and a closed list of its parts, so a creator can still take
  // the status box without inheriting the bot card redesign — but choosing a
  // template no longer starts with a wall of area filters.

  function templateList() { return window.JaiPresets.templates(); }

  /* Dark Red predates Profile information, so its source has example art,
   * placeholder prose and literal USER / NAME CSS content. Keep Hime's visual
   * design intact, but materialise those content-bearing parts from the
   * creator's Profile data at the moment a part is added. The markers retain
   * the original component ids, so ordinary remove/dependency logic still
   * works exactly as it does for a static community template. */
  function templateHtml(value) {
    return escapeHtml(String(value == null ? '' : value)).replace(/\r?\n/g, '<br>');
  }

  function templateAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function templateCssString(value) {
    return '"' + String(value == null ? '' : value)
      .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, '\\A ') + '"';
  }

  function darkRedIdentity() {
    var identity = (info && info.identity) || {};
    var username = String(identity.username || 'YOUR PROFILE').trim() || 'YOUR PROFILE';
    var words = username.replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean);
    return {
      username: username,
      first: words.shift() || username,
      rest: words.join(' '),
      avatar: String(identity.avatar || '').trim(),
      followers: String(identity.followers || '').trim(),
      memberSince: String(identity.memberSince || '').trim(),
      characterCount: String(identity.characterCount || '').trim()
    };
  }

  function darkRedFacts(identity) {
    var facts = [];
    if (identity.followers) facts.push(identity.followers + ' followers');
    if (identity.characterCount) facts.push(identity.characterCount + ' characters');
    if (identity.memberSince) facts.push('member since ' + identity.memberSince);
    return facts.join(' · ');
  }

  function darkRedCover(part, identity) {
    var html = part.html || '';
    var avatar = identity.avatar;
    // The author-supplied cover remains the decorative backdrop. The profile's
    // avatar replaces the example cut-out, and is omitted cleanly when the
    // creator has not supplied one yet.
    return html.replace(/\s*<img\s+src="[^"]*"\s+class="sona"\s*>/i,
      avatar ? '\n<img src="' + templateAttr(avatar) + '" class="sona" alt="">' : '');
  }

  function darkRedStatus(identity, about) {
    var copy = String(about.notes || about.body || darkRedFacts(identity) ||
      'Add a short introduction in Profile data → About me.').trim();
    return '<div class="status-box">\n<div class="status-head"><span>' +
      templateHtml(about.title || 'PROFILE') + '</span></div>\n<div class="status-body"><p>' +
      templateHtml(copy) + '</p></div>\n</div>\n';
  }

  function darkRedTabs(identity, about, sections) {
    var tabs = [{ title: about.title || 'About', body: about.body || darkRedFacts(identity) }];
    if (about.notes) tabs.push({ title: 'Notes', body: about.notes });
    (sections || []).forEach(function (section) {
      if (section && (section.title || section.body)) {
        tabs.push({ title: section.title || 'More', body: section.body || '' });
      }
    });
    if (!tabs[0].body) tabs[0].body = 'Add your introduction under Profile data → About me.';
    return '<div class="tab-box">\n<div class="tab-nav">\n' + tabs.map(function (tab, index) {
      return '<div class="tab"><details name="darkred-tabs"' + (index === 0 ? ' open' : '') +
        '><summary>' + templateHtml(tab.title) + '</summary><div class="tab-content"><h2>' +
        templateHtml(tab.title).toUpperCase() + '</h2><div class="inside">' + templateHtml(tab.body) +
        '</div></div></details></div>';
    }).join('\n') + '\n</div>\n</div>\n';
  }

  function linkLabel(link, fallback) {
    try {
      var url = new URL(link);
      return url.hostname.replace(/^www\./, '') || fallback;
    } catch { return fallback; }
  }

  function darkRedLinks(socials) {
    var links = (socials || []).filter(function (social) { return social && String(social.link || '').trim(); });
    return '<div class="contact-links">\n' + links.map(function (social) {
      var href = String(social.link).trim();
      var label = String(social.label || linkLabel(href, 'Link')).trim();
      return '<a href="' + templateAttr(href) + '"><span>' + templateHtml(label) +
        '</span><small>' + templateHtml(linkLabel(href, 'contact')) + '</small></a>';
    }).join('\n') + '\n</div>\n';
  }

  function darkRedFriends(friends) {
    var people = (friends || []).filter(function (friend) { return friend && String(friend.name || '').trim(); });
    var cards = people.map(function (friend) {
      var name = String(friend.name).trim();
      var image = String(friend.image || '').trim();
      var note = String(friend.note || '').trim();
      var open = friend.link ? '<a href="' + templateAttr(friend.link) + '" class="creator-card">' : '<div class="creator-card">';
      var close = friend.link ? '</a>' : '</div>';
      return open + (image ? '<img src="' + templateAttr(image) + '" alt="' + templateAttr(name) + '">' : '') +
        '<span>' + templateHtml(name) + (note ? ' · ' + templateHtml(note) : '') + '</span>' + close;
    });
    return '<div class="creators-box">\n<div class="creators-heading">FRIENDS</div>\n<div class="creators-scroll">\n' +
      cards.join('\n') + '\n</div>\n</div>\n';
  }

  /* The markup Profile data would write for a template part, or null when the
   * part is not one it writes. Golden Hour's stats-and-bio and its highlights
   * are (js/photo-feed-profile.js); the generator is handed the template's own
   * markup to fall back on. */
  function generatedPartHtml(part) {
    var feed = window.JaiPhotoFeed;
    if (!feed || !part || part.id.indexOf(feed.template + '-') !== 0) return null;
    var write = feed.parts[part.key];
    if (!write) return null;
    return write(window.JaiHardcode.prepare(info.characters), cardEmitOptions(), part.html) || null;
  }

  /* What Profile data has written into a part, most recent last. Kept so a
   * later change can tell a part that is still as it was written from one the
   * creator has retyped since — and a short history rather than one entry,
   * because Undo puts an earlier writing back and that is not a retyping. */
  function rememberGenerated(id, html) {
    var list = info.layout.generated[id];
    if (!Array.isArray(list)) list = list ? [list] : [];
    html = String(html).replace(/^\n+|\n+$/g, '');
    list = list.filter(function (old) { return old !== html; });
    list.push(html);
    info.layout.generated[id] = list.slice(-12);
    window.JaiProfileInfo.save(info);
  }

  function wasGenerated(id, html) {
    var list = info.layout.generated[id];
    if (!Array.isArray(list)) list = list ? [list] : [];
    return list.indexOf(html) !== -1;
  }

  function materialiseTemplatePart(part) {
    var generated = generatedPartHtml(part);
    if (generated != null) {
      rememberGenerated(part.id, generated);
      return Object.assign({}, part, { html: generated });
    }
    if (!part || part.id.indexOf('hime-darkred-') !== 0) return part;
    var identity = darkRedIdentity();
    var about = (info && info.about) || {};
    var copy = Object.assign({}, part);
    if (part.id === 'hime-darkred-base') {
      copy.css = String(part.css || '')
        .replace("content: 'USER';", 'content: ' + templateCssString(identity.first) + ';')
        .replace("content: 'NAME';", 'content: ' + templateCssString(identity.rest) + ';');
    } else if (part.id === 'hime-darkred-cover') {
      copy.html = darkRedCover(part, identity);
    } else if (part.id === 'hime-darkred-status') {
      copy.html = darkRedStatus(identity, about);
    } else if (part.id === 'hime-darkred-tabs') {
      copy.html = darkRedTabs(identity, about, info && info.sections);
    } else if (part.id === 'hime-darkred-links') {
      copy.html = darkRedLinks(info && info.socials);
    } else if (part.id === 'hime-darkred-creators') {
      copy.html = darkRedFriends(info && info.friends);
    }
    return copy;
  }

  /* A template that is also a profile layout is offered once, as the layout,
   * where it is built from Profile information instead of pasted verbatim. It
   * stays listed while any of its parts are applied, so they can come out. */
  function communityTemplates() {
    return templateList().filter(function (tpl) {
      var isLayout = profileLayouts().some(function (style) { return style.id === tpl.id; });
      return !isLayout || tpl.components.some(function (c) {
        return window.JaiPresets.isPartApplied(state.code, c);
      });
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
    parts.forEach(function (p) { code = window.JaiPresets.applyPart(code, materialiseTemplatePart(p)); });
    setCode(code, 'presets');
    syncTemplates();
  }

  /*
   * A template part dropped onto the canvas: its markup goes where it was
   * dropped (still between its markers, so Remove can find it later), while
   * its stylesheet and anything it depends on go where they always do.
   * Returns the edit for the canvas to commit, or null when the part is
   * already on the page.
   */
  function placePart(code, comp, ref, where) {
    if (window.JaiPresets.isPartApplied(code, comp)) {
      toast('“' + comp.name + '” is already on the page — move it there, or Remove it first.');
      return null;
    }
    var part = materialiseTemplatePart(comp);
    // Markup first: the canvas's element numbers are only good for `code` as
    // it was handed over, before anything else is spliced in.
    var out = part.html
      ? window.JaiMarkup.insert(code, window.JaiPresets.partMarkup(part), ref, where).payload
      : code;
    out = window.JaiPresets.applyPartCss(out, part);
    withDependencies(comp).forEach(function (p) {
      if (p.id === comp.id || window.JaiPresets.isPartApplied(out, p)) return;
      markAuto(p.id, true);
      out = window.JaiPresets.applyPart(out, materialiseTemplatePart(p));
    });
    markAuto(comp.id, false);
    reportToHost('template_part_applied', comp.id);
    var at = out.indexOf(window.JaiPresets.partMarker(part));
    return { payload: out, id: at === -1 ? null : window.JaiMarkup.nodeAfter(out, at) };
  }

  function removeParts(parts) {
    var code = state.code;
    parts.forEach(function (p) { code = window.JaiPresets.removePart(code, p); });
    setCode(code, 'presets');
    syncTemplates();
  }

  function togglePart(comp) {
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
  }

  function renderTemplates() {
    var host = $('#template-list');
    if (!host) return;
    host.innerHTML = '';

    communityTemplates().forEach(function (tpl) {
      var card = el('article', 'template');
      card.dataset.template = tpl.id;
      card.title = tpl.blurb || '';

      var head = el('div', 'template-head',
        '<div class="preset-cat">Community template</div>' +
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
      parts.appendChild(el('summary', null,
        '<span>Choose parts</span><span class="template-parts-count">' + tpl.components.length + '</span>'));

      tpl.components.forEach(function (comp) {
        var row = el('div', 'part');
        row.dataset.part = comp.id;

        var badges = '';
        if (comp.required) badges += '<span class="part-badge">required</span>';
        if (comp.recommended) badges += '<span class="part-badge is-good">please keep</span>';
        if (comp.html) badges += '<span class="part-badge is-html">+ markup</span>';

        row.appendChild(el('div', 'part-main',
          '<div class="part-name">' + escapeHtml(comp.name) + badges + '</div>' +
          (comp.blurb ? '<p class="part-blurb">' + escapeHtml(comp.blurb) + '</p>' : '')));

        var toggle = el('button', 'btn btn-sm', 'Add');
        toggle.type = 'button';
        toggle.addEventListener('click', function () { togglePart(comp); });
        row.appendChild(toggle);
        if (comp.html) {
          // A part with markup can also be dragged to a place on the canvas
          // (js/insert.js); Add puts it in the template's own order instead.
          row.classList.add('is-draggable');
          row.title = 'Drag onto the canvas to place it, or Add to put it in the template’s own order.';
        }
        parts.appendChild(row);
      });

      card.appendChild(parts);
      host.appendChild(card);
    });

    syncTemplates();
  }

  function syncTemplates() {
    $$('.template[data-template]').forEach(function (card) {
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
      advanced.textContent = onParts ? onParts + ' parts on' : communityTemplates().length + profileLayouts().length;
    }
    syncLayouts();
  }

  // --------------------------------------------------------- profile layouts
  //
  // A profile layout is generated from Profile information instead of pasted
  // in, so it grows with the roster and picks up friends and links as soon as
  // they are added. Using one here is the same as choosing it under
  // Profile data → Layout & theme and inserting.

  function profileLayouts() {
    // "None" writes markup for a hand-made stylesheet: a Profile-tab choice,
    // not something to offer as a design.
    return window.JaiHardcodeStyles.list.filter(function (style) { return style.css; });
  }

  function renderLayouts() {
    var host = $('#layout-list');
    if (!host) return;
    host.innerHTML = '';
    profileLayouts().forEach(function (style) {
      var card = el('article', 'template');
      card.dataset.layout = style.id;
      var head = el('div', 'template-head',
        '<div class="preset-cat">Built from Profile data</div>' +
        '<div class="preset-name">' + escapeHtml(style.name) + '</div>' +
        '<div class="template-credit">' + escapeHtml(style.blurb) + '</div>');
      var actions = el('div', 'template-actions');
      var use = el('button', 'btn btn-sm', 'Use');
      use.type = 'button';
      use.addEventListener('click', function () { useLayout(style); });
      actions.appendChild(use);
      head.appendChild(actions);
      card.appendChild(head);
      host.appendChild(card);
    });
    syncLayouts();
  }

  // ------------------------------------------------------------------ designs
  //
  // A design is a whole ready-made profile chosen in one go: one of the
  // layouts generated from Profile data, or a template whose copy Profile data
  // writes (Instagram-style is Golden Hour's nine parts). Whichever it is,
  // choosing one — in Profile data's menu or with Use here — goes through
  // applyDesign, which first takes out what would fight it. Two whole-page
  // designs in one document do not combine; they overwrite each other rule by
  // rule, and the creator is left with neither.

  function isDesign(style) { return !!(style && (style.css || style.template)); }

  function designParts(style) {
    var tpl = style && style.template
      ? templateList().filter(function (t) { return t.id === style.template; })[0] : null;
    return tpl ? tpl.components : [];
  }

  /* The design the document is wearing, which is not always the one last
   * chosen: Golden Hour added part by part from Insert is Instagram-style too. */
  function currentDesign() {
    var chosen = window.JaiHardcodeStyles.get(effectiveStyle());
    var generated = generatedStyleOf(state.code);
    if (generated) return window.JaiHardcodeStyles.get(generated);
    var worn = window.JaiHardcodeStyles.list.filter(function (style) {
      return style.template && designParts(style).some(function (c) {
        return window.JaiPresets.isPartApplied(state.code, c);
      });
    })[0];
    return worn || chosen;
  }

  /* Which generated layout a document holds, read off its markup. The choice
   * saved with Profile data is what was last picked; after an Undo the
   * document can be wearing the one before, and it is the document that the
   * menu shows and that a change in Profile data has to be written into. */
  function generatedStyleOf(code) {
    if (!window.JaiHardcode.isApplied(code)) return '';
    var m = window.JaiHardcode.markers;
    var from = code.indexOf(m.htmlStart);
    var to = code.indexOf(m.htmlEnd);
    var html = to > from ? code.slice(from, to) : '';
    if (html.indexOf('class="sp-') !== -1) return 'steam';
    if (html.indexOf('zz-navigation') !== -1) return 'proxy-terminal';
    return code.indexOf(m.styleStart) !== -1 ? 'contact-select' : 'none';
  }

  /* Emit options for writing one particular design, whatever is chosen. */
  function emitOptionsFor(styleId) {
    var opts = cardEmitOptions();
    opts.style = styleId;
    return opts;
  }

  // The same pattern js/page-layout.js writes its block with.
  var PAGE_LAYOUT_BLOCK = /\s*\/\* @jai:layout:start (\{[^}]*\}) \*\/[\s\S]*?\/\* @jai:layout:end \*\/\n?/;

  function eachStyleBlock(code, fn) {
    var blocks = window.JaiPayload.styleBlocks(code);
    for (var i = blocks.length - 1; i >= 0; i--) {
      var next = fn(blocks[i].css);
      if (next !== blocks[i].css) code = code.slice(0, blocks[i].cssStart) + next + code.slice(blocks[i].cssEnd);
    }
    return code;
  }

  /*
   * Takes out everything that lays claim to the whole page: Styles, template
   * parts (other than `keep`'s own), the other kind of design, and the page
   * layout block, whose rules are all !important. The creator's own elements
   * and hand-written CSS stay. Returns the new document and what went.
   */
  function clearForDesign(code, keep) {
    var gone = { styles: 0, parts: 0, layout: false };
    window.JaiPresets.all.forEach(function (preset) {
      if (!window.JaiPresets.isApplied(window.JaiPayload.allCss(code), preset)) return;
      code = eachStyleBlock(code, function (css) { return window.JaiPresets.remove(css, preset); });
      gone.styles++;
    });
    var kept = {};
    designParts(keep).forEach(function (c) { kept[c.id] = true; });
    window.JaiPresets.allParts().slice().reverse().forEach(function (part) {
      if (kept[part.id] || !window.JaiPresets.isPartApplied(code, part)) return;
      code = window.JaiPresets.removePart(code, part);
      markAuto(part.id, false);
      gone.parts++;
    });
    code = eachStyleBlock(code, function (css) {
      if (!PAGE_LAYOUT_BLOCK.test(css)) return css;
      gone.layout = true;
      return css.replace(PAGE_LAYOUT_BLOCK, '\n');
    });
    if (keep.template && window.JaiHardcode.isApplied(code)) {
      code = window.JaiHardcode.remove(code);
      gone.parts++;
    }
    return { code: code, gone: gone };
  }

  /* A template-backed design's parts, brought in line with Profile data: added
   * if missing, rewritten if they are still as Profile data last wrote them,
   * left alone if the creator has retyped them on the canvas since. */
  function writeDesignParts(code, style, addMissing) {
    designParts(style).forEach(function (part) {
      if (!window.JaiPresets.isPartApplied(code, part)) {
        if (addMissing) code = window.JaiPresets.applyPart(code, materialiseTemplatePart(part));
        return;
      }
      var fresh = generatedPartHtml(part);
      if (fresh == null) return;
      fresh = fresh.replace(/^\n+|\n+$/g, '');
      var now = window.JaiPresets.partInner(code, part);
      if (now == null || now === fresh) return;
      // As Profile data wrote it, or as the template ships it: ours to rewrite.
      var untouched = wasGenerated(part.id, now) ||
        now === String(part.html || '').replace(/^\n+|\n+$/g, '');
      if (!untouched) return;
      code = window.JaiPresets.replacePartMarkup(code, Object.assign({}, part, { html: fresh }));
      rememberGenerated(part.id, fresh);
    });
    return code;
  }

  function applyDesign(style) {
    if (style.css && !info.characters.length) {
      info.layout.style = style.id;
      saveInfo();
      renderCards();
      syncLayouts();
      cardsStatus('“' + style.name + '” is chosen. Import your profile and it is built from your characters.');
      toast('Add your characters first — Profile data → Import profile fills them in.');
      showPanel('info');
      return;
    }
    info.layout.style = style.id;
    saveInfo();
    var cleared = clearForDesign(state.code, style);
    var next = style.template
      ? writeDesignParts(cleared.code, style, true)
      : window.JaiHardcode.apply(cleared.code, info.characters, emitOptionsFor(style.id));
    var changed = next !== state.code;
    if (changed) setCode(next, 'cards');
    reportToHost('layout_applied', style.id);
    renderCards();
    syncTemplates();
    var went = [];
    if (cleared.gone.styles) went.push(plural(cleared.gone.styles, 'style'));
    if (cleared.gone.parts) went.push(plural(cleared.gone.parts, 'other part'));
    if (cleared.gone.layout) went.push('the page layout');
    toast(!changed ? '“' + style.name + '” is already your design.'
      : '“' + style.name + '” is your design now' +
        (went.length ? ' — replaced ' + went.join(', ') + '. Ctrl+Z brings them back.' : '.'));
  }

  function useLayout(style) { applyDesign(style); }

  function syncLayouts() {
    syncDesignPick();
    var applied = window.JaiHardcode.isApplied(state.code);
    var current = effectiveStyle();
    $$('.template[data-layout]').forEach(function (card) {
      var on = applied && card.dataset.layout === current;
      card.classList.toggle('is-on', on);
      $('button', card).textContent = on ? 'In use' : 'Use';
    });
  }

  // ------------------------------------------------------------ profile data

  var PROFILE_FIELDS = [
    // Username, avatar, followers, member-since and background are edited
    // directly in the preview (double-click text to edit; right-click an image
    // to swap it) -- see the 'sim-edit-value' wiring in preview/frame.js.
    { key: 'cardCount', label: 'Bot cards shown', type: 'number', min: 1, max: 250 },
    { key: 'viewMode', label: 'Viewing as', type: 'select',
      values: [['visitor', 'A visitor (Follow + Options)'], ['owner', 'Yourself (Edit profile)']] },
    { key: 'showBadges', label: 'Show event badges', type: 'checkbox' },
    { key: 'janitorPlus', label: 'Show Janitor+ badge', type: 'checkbox' },
    { key: 'userMenu', label: 'Open the user menu', type: 'checkbox',
      hint: 'The popup behind your avatar in the header. Selecting User menu in Layers opens it too.' }
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

  function snapshotRecord(entry) {
    return {
      id: entry.id,
      label: entry.label,
      filename: entry.filename || entry.label + '.mhtml',
      data: copyData(entry.data),
      code: typeof entry.code === 'string' ? entry.code : '',
      sourceCode: typeof entry.sourceCode === 'string' ? entry.sourceCode : '',
      sourceKey: entry.sourceKey || '',
      cssEnabled: entry.cssEnabled !== false,
      createdAt: entry.createdAt || Date.now()
    };
  }

  function profileSourceKey(file) {
    if (!file) return '';
    return [file.name || '', file.size || 0, file.lastModified || 0].join('|');
  }

  function queueSnapshotPersist(entry, now) {
    if (!entry || entry.builtin || !entry.persisted || !window.JaiProfileLibrary) return;
    var write = function () {
      delete profileSaveTimers[entry.id];
      window.JaiProfileLibrary.update(snapshotRecord(entry)).catch(function () {
        // The capture is already on disk. A later editor change can retry this
        // compact metadata write without disrupting the work in progress.
      });
    };
    clearTimeout(profileSaveTimers[entry.id]);
    if (now) write();
    else profileSaveTimers[entry.id] = setTimeout(write, 250);
  }

  function saveActiveSnapshot() {
    var entry = activeSnapshot();
    if (!entry) return;
    entry.code = state.code;
    entry.data = copyData(state.data);
    entry.cssEnabled = state.previewCss;
    queueSnapshotPersist(entry);
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
    $('#profile-css-toggle').disabled = !entry || !entry.profile;
    $('#profile-css-toggle').textContent = state.previewCss ? 'Hide custom CSS' : 'Show custom CSS';
    $('#keep-default-profile').checked = keepDefaultProfile;
  }

  function activateSnapshot(entry, message) {
    if (!entry) return Promise.resolve(false);
    saveActiveSnapshot();
    if (!entry.profile) {
      updateImportStatus('Opening “' + entry.label + '” from local storage…', false);
      renderProfileSwitcher();
      return rehydrateSnapshot(entry).then(function () {
        return activateSnapshot(entry, message);
      }).catch(function (error) {
        var missingLabel = entry.label;
        clearTimeout(profileSaveTimers[entry.id]);
        delete profileSaveTimers[entry.id];
        profileSnapshots = profileSnapshots.filter(function (candidate) { return candidate.id !== entry.id; });
        if (activeProfileId === entry.id) activeProfileId = null;
        var fallback = activeSnapshot() || visibleSnapshots()[0] || ensureDefaultSnapshot();
        if (fallback.builtin) keepDefaultProfile = true;
        saveProfileLibrarySettings();
        renderProfileSwitcher();
        return window.JaiProfileLibrary.remove(entry.id).catch(function () {
          // It has already been removed from this session. Startup repair can
          // retry clearing the broken browser-storage record next time.
        }).then(function () {
          return activateSnapshot(fallback,
            'Removed “' + missingLabel + '” because it could not be reopened (' + error.message + '). Import the MHTML again to restore it.');
        });
      });
    }
    activeProfileId = entry.id;
    state.data = copyData(entry.data);
    state.previewCss = entry.cssEnabled !== false;
    setCode(typeof entry.code === 'string' ? entry.code : (entry.profile.aboutMe || window.JaiPayload.STARTER), 'profile');
    renderProfileFields();
    pushProfile(entry.profile);
    pushData();
    pushPayload();
    renderProfileSwitcher();
    updateImportStatus(message || ('Using ' + entry.label + '. It is saved locally until you remove it.'), true);
    save();
    return Promise.resolve(true);
  }

  function applyImportedProfile(profile, file) {
    importedProfile = true;
    var filename = file.name;
    var baseLabel = filename.replace(/\.(m?html?)$/i, '');
    var username = profile.data && profile.data.username
      ? String(profile.data.username).replace(/^@/, '')
      : '';
    var label = baseLabel;
    if (username && baseLabel.toLowerCase().indexOf('@' + username.toLowerCase()) === -1) {
      label += ' @' + username;
    }
    var sourceKey = profileSourceKey(file);
    var existing = profileSnapshots.filter(function (candidate) {
      if (candidate.builtin) return false;
      if (sourceKey && candidate.sourceKey === sourceKey) return true;
      return !candidate.sourceKey && candidate.filename === filename;
    })[0] || null;
    var entry = existing ? Object.assign({}, existing) : {
      id: 'profile-' + (++profileIdSeq),
      data: copyData(profile.data),
      code: typeof profile.aboutMe === 'string' ? profile.aboutMe : window.JaiPayload.STARTER,
      cssEnabled: true,
      builtin: false,
      createdAt: Date.now(),
      persisted: false
    };
    entry.label = label;
    entry.filename = filename;
    entry.profile = profile;
    entry.sourceKey = sourceKey;
    entry.sourceCode = typeof profile.aboutMe === 'string' ? profile.aboutMe : window.JaiPayload.STARTER;
    if (!existing) profileSnapshots.push(entry);
    updateImportStatus((existing ? 'Refreshing' : 'Saving') + ' “' + filename + '” locally…', false);
    window.JaiProfileLibrary.put(snapshotRecord(entry), file).then(function () {
      if (existing) {
        var previousProfile = existing.profile;
        Object.keys(entry).forEach(function (key) { existing[key] = entry[key]; });
        existing.persisted = true;
        entry = existing;
        if (previousProfile && previousProfile !== profile && previousProfile.release) previousProfile.release();
      } else {
        entry.persisted = true;
      }
      saveProfileLibrarySettings();
      return activateSnapshot(entry, (existing ? 'Refreshed' : 'Using') + ' “' + filename + '”. It will reopen from local storage next time.');
    }).then(function () {
      reportToHost('profile_imported');
      // Importing is the creator saying "this is my profile", so Profile
      // information fills in from the file itself; the preview only catches up
      // once the frame has processed the new snapshot.
      fillInfo(new DOMParser().parseFromString(profile.html, 'text/html'), '“' + filename + '”');
      emit('profile:imported');
      toast(existing ? 'Profile refreshed — your editor changes were kept' : 'Profile saved locally — you can switch between profiles');
    }).catch(function (error) {
      if (!existing) {
        profileSnapshots = profileSnapshots.filter(function (candidate) { return candidate.id !== entry.id; });
      }
      if (profile.release) profile.release();
      updateImportStatus('Could not save this profile locally: ' + error.message, !!activeSnapshot());
      renderProfileSwitcher();
      toast('Could not save that profile locally');
    });
  }

  function handleProfileFileChange() {
    var file = this.files && this.files[0];
    if (!file) return;
    updateImportStatus('Reading “' + file.name + '”…', false);
    window.JaiProfileImport.read(file).then(function (profile) {
      applyImportedProfile(profile, file);
    }).catch(function (error) {
      updateImportStatus('Could not import this file: ' + error.message, importedProfile);
      toast('Could not import that profile file');
    });
    this.value = '';
  }

  /*
   * More pages of a character list. JanitorAI shows a long roster a page at a
   * time and a saved page holds only the cards that were on it, so a creator
   * with 163 bots imports 34 of them. Each further page is saved the same way
   * and read here — for its characters only: no new preview profile, no change
   * of document, nothing that interrupts the work in progress. Characters are
   * matched by link (see JaiProfileInfo.merge), so a page read twice adds
   * nothing the second time.
   */
  function addProfilePages(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    var total = { added: 0, updated: 0, read: 0, skipped: [] };
    cardsStatus('Reading ' + plural(list.length, 'file') + '…');

    list.reduce(function (chain, file) {
      return chain.then(function () {
        return window.JaiProfileImport.read(file).then(function (profile) {
          var doc = new DOMParser().parseFromString(profile.html, 'text/html');
          // Only the text is needed; the pictures it unpacked are not shown.
          if (profile.release) profile.release();
          var found = window.JaiProfileInfo.fromDocument(doc);
          if (!found) { total.skipped.push(file.name + ' has no JanitorAI profile in it'); return; }
          var mine = String(info.identity.username || '').toLowerCase();
          var theirs = String(found.identity.username || '').toLowerCase();
          var foreign = !!mine && !!theirs && mine !== theirs;
          if (foreign && !confirm('“' + file.name + '” is @' + found.identity.username +
              '’s profile, and your Profile data is @' + info.identity.username +
              '’s. Add its characters anyway?')) {
            total.skipped.push(file.name + ' belongs to @' + found.identity.username);
            return;
          }
          var result = window.JaiProfileInfo.merge(info, found, { charactersOnly: foreign });
          total.added += result.added;
          total.updated += result.updated;
          total.read++;
        }).catch(function (error) {
          total.skipped.push(file.name + ' could not be read (' + error.message + ')');
        });
      });
    }, Promise.resolve()).then(function () {
      saveInfo();
      renderInfo();
      reapplyCards(0);
      emit('profile:pages', total);
      reportToHost('profile_pages_added', String(total.added));
      var parts = [];
      if (total.read) {
        parts.push(total.added
          ? 'Added ' + plural(total.added, 'character') + ' from ' + plural(total.read, 'page')
          : 'Nothing new in ' + (total.read === 1 ? 'that page' : 'those pages') + ' — you already have its characters');
        parts.push(rosterProgress());
      }
      if (total.skipped.length) parts.push('Skipped: ' + total.skipped.join('; '));
      cardsStatus(parts.join('. ') + '.');
      toast(total.added ? plural(total.added, 'character') + ' added' : 'No new characters');
    });
  }

  $('#profile-pages-info').addEventListener('change', function () {
    addProfilePages(this.files);
    this.value = '';
  });

  // The same import lives in the Settings and Profile panels; importing from
  // either also fills in Profile information.
  $('#profile-file').addEventListener('change', handleProfileFileChange);
  $('#profile-file-info').addEventListener('change', handleProfileFileChange);

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
    saveProfileLibrarySettings();
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
    window.JaiProfileLibrary.remove(entry.id).catch(function () {
      toast('The profile was removed here, but its local file could not be cleared.');
    });
    var next = visibleSnapshots()[0];
    if (!next) {
      // Never leave the canvas without a source profile. If the user hid the
      // built-in snapshot and then removes their last imported one, restore
      // Sweepercom as the safe fallback so the preview remains useful.
      keepDefaultProfile = true;
      next = visibleSnapshots()[0];
    }
    activeProfileId = null;
    saveProfileLibrarySettings();
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
        parts.appendChild(el('p', 'panel-note', 'No parts yet — open Code, select some of it, and use “Save selection…”.'));
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

  function ensureDefaultSnapshot() {
    var entry = profileSnapshots.filter(function (candidate) { return candidate.builtin; })[0];
    if (!entry) {
      entry = {
        id: 'default',
        label: 'Sweepercom @' + DEFAULT_DATA.username,
        profile: null,
        data: copyData(hadSavedData ? state.data : DEFAULT_DATA),
        code: state.code || window.JaiPayload.STARTER,
        cssEnabled: state.previewCss,
        builtin: true
      };
      profileSnapshots.unshift(entry);
    }
    return entry;
  }

  function loadBundledProfile() {
    var entry = ensureDefaultSnapshot();
    if (entry.profile) return Promise.resolve(entry);
    if (entry.loading) return entry.loading;
    updateImportStatus('Loading ' + DEFAULT_PROFILE_LABEL + '…', false);

    entry.loading = fetch(DEFAULT_PROFILE_URL)
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
        if (entry.profile && entry.profile.release) entry.profile.release();
        // Blob URLs are intentionally used while an imported MHTML snapshot is
        // alive, but they cannot survive a reload. Do not restore a stale
        // imported About Me document into the bundled profile after that URL
        // has expired; the built-in capture is the safe source of truth.
        var savedCode = entry.code || state.code;
        var defaultCode = /\bblob:/i.test(savedCode || '')
          ? (profile.aboutMe || window.JaiPayload.STARTER)
          : (savedCode || window.JaiPayload.STARTER);
        var defaultData = entry.data ? copyData(entry.data) : copyData(profile.data);
        if (/^blob:/i.test(defaultData.avatar || '') && profile.data.avatar) defaultData.avatar = profile.data.avatar;
        if (/^blob:/i.test(defaultData.background || '')) defaultData.background = profile.data.background || '';
        entry.label = 'Sweepercom' + (profile.data.username ? ' @' + profile.data.username : '');
        entry.profile = profile;
        entry.data = defaultData;
        entry.code = defaultCode;
        entry.cssEnabled = entry.cssEnabled !== false;
        delete entry.loading;
        renderProfileSwitcher();
        return entry;
      })
      .catch(function (error) {
        delete entry.loading;
        throw error;
      });
    return entry.loading;
  }

  function rehydrateSnapshot(entry) {
    if (entry.profile) return Promise.resolve(entry);
    if (entry.loading) return entry.loading;
    if (entry.builtin) return loadBundledProfile();

    entry.loading = window.JaiProfileLibrary.file(entry.id)
      .then(function (file) {
        return window.JaiProfileImport.read(new File([file], entry.filename || entry.label + '.mhtml', {
          type: file.type || 'multipart/related'
        }));
      })
      .then(function (profile) {
        entry.profile = profile;
        // MHTML resources are represented by fresh blob URLs each time it is
        // parsed. Translate resource URLs from the original source into this
        // fresh parse before falling back, so a creator's CSS edits survive a
        // reload even when their imported markup references local images.
        var freshSource = profile.aboutMe || window.JaiPayload.STARTER;
        if (/\bblob:/i.test(entry.code || '')) {
          var oldUrls = (entry.sourceCode || '').match(/blob:[^\s"')<>]+/gi) || [];
          var newUrls = freshSource.match(/blob:[^\s"')<>]+/gi) || [];
          if (oldUrls.length && oldUrls.length === newUrls.length) {
            var replacements = {};
            oldUrls.forEach(function (url, index) { replacements[url] = newUrls[index]; });
            entry.code = entry.code.replace(/blob:[^\s"')<>]+/gi, function (url) {
              return replacements[url] || url;
            });
          } else {
            entry.code = freshSource;
          }
        }
        entry.sourceCode = freshSource;
        entry.data = copyData(entry.data);
        if (/^blob:/i.test(entry.data.avatar || '')) entry.data.avatar = profile.data.avatar || '';
        if (/^blob:/i.test(entry.data.background || '')) entry.data.background = profile.data.background || '';
        delete entry.loading;
        return entry;
      })
      .catch(function (error) {
        delete entry.loading;
        throw error;
      });
    return entry.loading;
  }

  function bootProfiles() {
    if (!appReady || !frameReady) return Promise.resolve();
    if (profileBootPromise) return profileBootPromise;
    profileBootPromise = window.JaiProfileLibrary.list()
      .then(function (records) {
        var repaired = records.removedCount || 0;
        ensureDefaultSnapshot();
        records.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }).forEach(function (record) {
          if (!record || !record.id || record.id === 'default' ||
              profileSnapshots.some(function (entry) { return entry.id === record.id; })) return;
          profileSnapshots.push({
            id: record.id,
            label: record.label || 'Saved profile',
            filename: record.filename,
            profile: null,
            data: copyData(record.data),
            code: typeof record.code === 'string' ? record.code : '',
            sourceCode: typeof record.sourceCode === 'string' ? record.sourceCode : '',
            sourceKey: record.sourceKey || '',
            cssEnabled: record.cssEnabled !== false,
            createdAt: record.createdAt,
            builtin: false,
            persisted: true
          });
          var idNumber = /^profile-(\d+)$/.exec(record.id);
          if (idNumber) profileIdSeq = Math.max(profileIdSeq, +idNumber[1]);
        });
        var selected = profileSnapshots.filter(function (entry) { return entry.id === activeProfileId; })[0];
        if (!selected || (selected.builtin && !keepDefaultProfile)) {
          selected = profileSnapshots.filter(function (entry) { return !entry.builtin; })[0] || ensureDefaultSnapshot();
        }
        renderProfileSwitcher();
        var status = selected.builtin
          ? 'Using ' + DEFAULT_PROFILE_LABEL + '.'
          : 'Restored “' + selected.label + '” from local storage.';
        if (repaired) {
          status += ' Removed ' + repaired + ' duplicate or incomplete saved ' +
            (repaired === 1 ? 'entry.' : 'entries.');
        }
        return activateSnapshot(selected, status);
      })
      .catch(function (error) {
        // Saving profiles is a convenience, never a reason to block the
        // studio. Fall back to the bundled capture only if local storage is
        // unavailable.
        var fallback = ensureDefaultSnapshot();
        renderProfileSwitcher();
        return activateSnapshot(fallback, 'Local profile storage is unavailable (' + error.message + ').');
      });
    return profileBootPromise;
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
    setDock(true, 'code');
    input.focus();
    input.setSelectionRange(caret, caret);
    editorScroll.scrollTop = Math.max(0, (window.CssModel.lineOf(state.code, caret) - 5) * 19.2);
  }

  // ------------------------------------------------------------------ shell
  //
  // A rail of panels on the left, the canvas in the middle, properties on the
  // right, and the About Me code in a dock under the canvas.

  var PANEL_TITLES = {
    layers: 'Layers',
    insert: 'Insert',
    info: 'Profile data',
    tutorials: 'Tutorials',
    help: 'Help'
  };

  function applyPanelLayout() {
    var root = document.documentElement;
    var layout = $('.layout');
    if (state.sidebarWidth) root.style.setProperty('--sidebar-w', state.sidebarWidth + 'px');
    if (state.inspectorWidth) root.style.setProperty('--inspector-w', state.inspectorWidth + 'px');
    if (state.dockHeight) root.style.setProperty('--dock-h', state.dockHeight + 'px');
    layout.classList.toggle('sidebar-hidden', state.sidebarHidden);
    layout.classList.toggle('ui-hidden', state.uiHidden);
    $$('.rail button[data-panel]').forEach(function (button) {
      var active = !state.sidebarHidden && button.dataset.panel === state.panel;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function showPanel(name) {
    // Templates and styles used to have a panel of their own; they are part
    // of Insert now, and a saved preference for the old one lands there.
    if (name === 'presets') name = 'insert';
    if (!PANEL_TITLES[name]) name = 'layers';
    state.panel = name;
    state.sidebarHidden = false;
    $$('.sidebar-body > .panel').forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== name;
    });
    $('#sidebar-title').textContent = PANEL_TITLES[name];
    applyPanelLayout();
    layoutStage();
    save();
    emit('panel', name);
  }

  /* Clicking the open panel's icon again folds the sidebar away, the way an
   * editor's activity bar does, so the canvas can have the room. */
  $$('.rail button[data-panel]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!state.sidebarHidden && state.panel === button.dataset.panel) {
        state.sidebarHidden = true;
        applyPanelLayout();
        layoutStage();
        save();
        return;
      }
      showPanel(button.dataset.panel);
    });
  });

  function toggleUi() {
    state.uiHidden = !state.uiHidden;
    applyPanelLayout();
    layoutStage();
  }

  function resizePanel(handle, stateKey, variable, direction, min, max) {
    handle.addEventListener('pointerdown', function (down) {
      if (window.matchMedia('(max-width: 1000px)').matches) return;
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

  resizePanel($('#resize-sidebar'), 'sidebarWidth', '--sidebar-w', 1, 220, 520);
  resizePanel($('#resize-inspector'), 'inspectorWidth', '--inspector-w', -1, 250, 520);

  // ------------------------------------------------------------- code dock

  function setDock(open, tab) {
    state.dockOpen = !!open;
    if (tab) state.dockTab = tab;
    $('#dock').hidden = !state.dockOpen;
    $('#toggle-code').classList.toggle('is-active', state.dockOpen);
    $$('.dock-tabs button').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.dock === state.dockTab);
    });
    $$('.dock-pane').forEach(function (pane) {
      pane.hidden = pane.dataset.dock !== state.dockTab;
    });
    // These act on the code, so they only make sense while it is showing.
    var code = state.dockTab === 'code';
    ['#save-selection', '#format-css', '#clear-css', '#code-stats'].forEach(function (id) {
      $(id).hidden = !code;
    });
    if (state.dockOpen && code && highlightStale) renderHighlight();
    layoutStage();
    save();
  }

  $('#toggle-code').addEventListener('click', function () { setDock(!state.dockOpen); });
  $('#close-dock').addEventListener('click', function () { setDock(false); });
  $('#status-lint').addEventListener('click', function () { setDock(true, 'code'); });
  $$('.dock-tabs button').forEach(function (button) {
    button.addEventListener('click', function () { setDock(true, button.dataset.dock); });
  });

  $('#resize-dock').addEventListener('pointerdown', function (down) {
    down.preventDefault();
    var startY = down.clientY;
    var start = $('#dock').offsetHeight;
    var max = Math.max(160, $('.stage').clientHeight - 140);
    document.body.classList.add('is-resizing-row');

    function move(event) {
      state.dockHeight = Math.max(140, Math.min(max, Math.round(start - (event.clientY - startY))));
      document.documentElement.style.setProperty('--dock-h', state.dockHeight + 'px');
      layoutStage();
    }
    function end() {
      document.body.classList.remove('is-resizing-row');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      if (state.dockTab === 'code') renderHighlight();
      save();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  });

  // ------------------------------------------------------ viewport and zoom

  var customWidth = $('#custom-width');

  $('#viewport-select').addEventListener('change', function () {
    state.viewport = this.value;
    reportToHost('viewport_changed', state.viewport);
    customWidth.hidden = state.viewport !== 'custom';
    layoutStage();
    save();
  });

  customWidth.addEventListener('input', function () {
    var w = parseInt(customWidth.value, 10);
    if (!w || w < 320) return;
    state.customWidth = Math.min(3840, w);
    layoutStage();
    save();
  });

  function setZoom(scale) {
    state.zoom = 'manual';
    state.zoomScale = Math.max(0.25, Math.min(2, Math.round(scale * 20) / 20));
    layoutStage();
    save();
  }

  $('#zoom-label').addEventListener('click', function () {
    state.zoom = state.zoom === 'fit' ? 'actual' : 'fit';
    layoutStage();
    save();
  });
  $('#zoom-in').addEventListener('click', function () { setZoom(stageScale + 0.1); });
  $('#zoom-out').addEventListener('click', function () { setZoom(stageScale - 0.1); });

  /* Keep browser zoom untouched: Ctrl/Cmd + wheel only changes the canvas
   * while the pointer is over it. Ordinary wheel events still scroll the
   * captured profile vertically or pan it horizontally as usual. */
  $('#stage-scroll').addEventListener('wheel', function (event) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(stageScale + (event.deltaY < 0 ? 0.05 : -0.05));
  }, { passive: false });

  // -------------------------------------------------------------- the mode

  /* Design selects and drags; Preview hands the page back to itself, so
   * links, hover states and CSS-only menus can be tried out. */
  function setMode(mode) {
    state.mode = mode === 'preview' ? 'preview' : 'design';
    $$('#mode-switch button').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.mode === state.mode);
    });
    post({ type: 'mode', mode: state.mode });
    emit('mode', state.mode);
  }

  $$('#mode-switch button').forEach(function (button) {
    button.addEventListener('click', function () { setMode(button.dataset.mode); });
  });

  $('#enforce').addEventListener('change', function () {
    state.enforce = this.checked;
    pushPayload();
    save();
  });

  /* Preview-only data (cards shown, visitor or owner view, the open user
   * menu), set from outside the Page panel — e.g. Layers opening the user menu
   * so that its items can be selected. */
  function setData(key, value) {
    if (state.data[key] === value) return;
    state.data[key] = value;
    renderProfileFields();
    pushData();
    save();
  }

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
        ' an extra gap, see the layout warning beside the code';
    } else {
      msg = 'Copied. Paste into JanitorAI → profile settings → About Me.';
    }
    toast(msg);
  });

  $('#clear-css').addEventListener('click', function () {
    if (state.code && !confirm('Delete everything in the About Me box? Undo brings it back.')) return;
    setCode(window.JaiPayload.STARTER, 'clear');
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

  // ------------------------------------------------------------ profile info
  //
  // Profile information is the source a hardcoded profile is generated from:
  // identity, characters, About Me copy, friends and social links. It is
  // deliberately *not* part of the document — the document is the output — so
  // it lives in its own storage key (js/profile-info.js) and survives clearing
  // the editor. js/hardcode.js turns it into markup and the slice of CSS that
  // scales with it; everything else in the stylesheet stays hand-written.

  var FIELDS = [
    { key: 'name', label: 'Name', placeholder: 'Celeste' },
    { key: 'tagline', label: 'Tagline', placeholder: 'The “Bully” · Awkward friendship route' },
    { key: 'quote', label: 'Quote (optional)', placeholder: '“MON DIEU!”' },
    { key: 'description', label: 'Short description', type: 'textarea', placeholder: 'One or two lines.' },
    { key: 'tags', label: 'Tags (comma separated)', placeholder: 'Female, OC, AnyPOV, Fluff' },
    { key: 'link', label: 'Character link', type: 'url', placeholder: 'https://janitorai.com/characters/…' },
    { key: 'portrait', label: 'Portrait override (optional)', type: 'url', placeholder: 'Defaults to the bot image' },
    { key: 'art', label: 'Stage art override (optional)', type: 'url', placeholder: 'Defaults to the bot image; any aspect ratio works' },
    { key: 'hover', label: 'Hover art override (optional)', type: 'url', placeholder: 'Any aspect ratio; centered and clipped' },
    { key: 'chats', label: 'Chats', half: true, placeholder: '752' },
    { key: 'tokens', label: 'Tokens', half: true, placeholder: '1,845' },
    { key: 'featured', label: 'Feature in showcases', type: 'checkbox' }
  ];

  /* The small repeatable lists. The first field names a row in its summary. */
  var INFO_LISTS = {
    badges: {
      noun: 'badge',
      empty: 'No badges. Importing your profile brings in the ones JanitorAI shows.',
      fields: [
        { key: 'name', label: 'Name', placeholder: 'Music Mania 2 Creator' },
        { key: 'image', label: 'Image', type: 'url', placeholder: 'https://ella.janitorai.com/events/…' }
      ]
    },
    sections: {
      noun: 'section',
      empty: 'Headings like “Before you connect” or “Commissions”, each with its own text.',
      fields: [
        { key: 'title', label: 'Heading', placeholder: 'Before you connect' },
        { key: 'body', label: 'Text', type: 'textarea', placeholder: 'Boundaries, content notes, roleplay preferences…' }
      ]
    },
    friends: {
      noun: 'friend',
      empty: 'No friends yet. Each one needs a name; a picture and a link are optional.',
      fields: [
        { key: 'name', label: 'Name', placeholder: 'Mira' },
        { key: 'image', label: 'Picture (optional)', type: 'url', placeholder: 'https://…' },
        { key: 'link', label: 'Link (optional)', type: 'url', placeholder: 'https://janitorai.com/profiles/…' },
        { key: 'note', label: 'Note (optional)', type: 'textarea', placeholder: 'What visitors should know about them.' }
      ]
    },
    inventory: {
      noun: 'item',
      empty: 'No items yet. Each one needs a name; a picture makes it a tile worth looking at.',
      fields: [
        { key: 'name', label: 'Name', placeholder: 'Midnight Emote Pack' },
        { key: 'image', label: 'Picture', type: 'url', placeholder: 'https://… square works best' },
        { key: 'note', label: 'Kind (optional)', placeholder: 'Rare · Emote' },
        { key: 'link', label: 'Link (optional)', type: 'url', placeholder: 'https://…' }
      ]
    },
    workshop: {
      noun: 'workshop item',
      empty: 'Nothing here yet. Lorebooks, prompts, presets, guides — anything you made that is not a bot.',
      fields: [
        { key: 'name', label: 'Title', placeholder: 'Hale University lorebook' },
        { key: 'image', label: 'Picture (optional)', type: 'url', placeholder: 'https://… wide works best' },
        { key: 'note', label: 'What it is (optional)', type: 'textarea', placeholder: 'One or two lines.' },
        { key: 'link', label: 'Link', type: 'url', placeholder: 'https://…' }
      ]
    },
    socials: {
      noun: 'link',
      empty: 'No social links yet. Each one needs an address; the label and icon are optional.',
      fields: [
        { key: 'link', label: 'Link', type: 'url', placeholder: 'https://discord.gg/…' },
        { key: 'label', label: 'Label (optional)', placeholder: 'Discord' },
        { key: 'image', label: 'Icon (optional)', type: 'url', placeholder: 'https://…' }
      ]
    }
  };

  var info = window.JaiProfileInfo.load();
  var cards = { search: '', selected: {} };
  var hardcodeTargets = {};
  var cardIdSeq = 0;

  function saveInfo() {
    window.JaiProfileInfo.save(info);
    emit('info');
  }

  /* For a change made to Profile information from outside this panel (a
   * tutorial doing a step for someone): saved, shown, and written through to
   * the document like one typed here. */
  function touchInfo() {
    saveInfo();
    renderInfo();
    reapplyCards(0);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fieldHtml(f, value) {
    if (f.key === 'tags' && Array.isArray(value)) value = value.join(', ');
    if (f.type === 'checkbox') {
      return '<label class="field field-check"><input type="checkbox" data-field="' + f.key + '"' +
        (value ? ' checked' : '') + '> <span>' + escapeHtml(f.label) + '</span></label>';
    }
    var v = escapeHtml(value == null ? '' : value);
    var placeholder = escapeHtml(f.placeholder || '');
    return '<label class="field">' + escapeHtml(f.label) +
      (f.type === 'textarea'
        ? '<textarea rows="3" data-field="' + f.key + '" placeholder="' + placeholder + '">' + v + '</textarea>'
        : '<input type="' + (f.type === 'url' ? 'url' : 'text') + '" data-field="' + f.key +
          '" placeholder="' + placeholder + '" value="' + v + '">') +
      '</label>';
  }

  /* Short fields marked `half` share a row instead of taking one each. */
  function fieldsHtml(fields, entry) {
    var html = '';
    var grid = [];
    fields.forEach(function (f) {
      if (f.half) grid.push(fieldHtml(f, entry[f.key]));
      else html += fieldHtml(f, entry[f.key]);
    });
    if (grid.length) html += '<div class="info-grid">' + grid.join('') + '</div>';
    return html;
  }

  function rowButtons() {
    return '<div class="card-row-buttons">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-move="-1" title="Move up">↑</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-move="1" title="Move down">↓</button>' +
      '<button type="button" class="btn btn-ghost btn-sm card-remove" data-remove>Remove</button>' +
      '</div>';
  }

  function thumb(src) {
    return window.JaiHardcode.usable(src)
      ? '<img class="info-thumb" src="' + escapeHtml(src) + '" alt="">' : '';
  }

  /* How many characters the profile says it has, when it says. */
  function rosterTotal() {
    var n = parseInt(String(info.identity.characterCount || '').replace(/[^\d]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  /* "34 of 163 here" — or just the count, once the list is complete. */
  function rosterProgress() {
    var have = info.characters.length;
    var total = rosterTotal();
    return total > have
      ? have + ' of ' + total + ' characters are here; save and add the other pages for the rest'
      : plural(have, 'character') + ' in Profile data';
  }

  function updateCounts() {
    $('#info-identity-count').textContent = info.identity.username ? '@' + info.identity.username : '';
    $('#info-characters-count').textContent = !info.characters.length ? ''
      : rosterTotal() > info.characters.length ? info.characters.length + ' of ' + rosterTotal()
      : info.characters.length;
    $('#info-about-count').textContent = info.sections.length ? '+' + plural(info.sections.length, 'section') : '';
    $('#info-friends-count').textContent = info.friends.length || '';
    $('#info-socials-count').textContent = info.socials.length || '';
    $('#info-inventory-count').textContent = info.inventory.length || '';
    $('#info-workshop-count').textContent = info.workshop.length || '';
  }

  /* Leaves the field being typed in alone, so a re-render from elsewhere (an
   * edit made in the preview, say) never yanks the caret. */
  function fillInputs(selector, key, source) {
    $$(selector).forEach(function (input) {
      if (document.activeElement !== input) input.value = source[input.dataset[key]] || '';
    });
  }

  function renderIdentity() {
    fillInputs('[data-identity]', 'identity', info.identity);
    updateCounts();
  }

  function renderAbout() {
    fillInputs('[data-about]', 'about', info.about);
    updateCounts();
  }

  function renderInfo() {
    renderIdentity();
    renderAbout();
    Object.keys(INFO_LISTS).forEach(renderInfoList);
    renderCards();
    syncLayouts();
  }

  function cardsStatus(message) { $('#cards-status').textContent = message || ''; }

  /*
   * Reads a profile page into Profile information: the preview's own document,
   * or a freshly imported file parsed on the spot. Captured facts refresh;
   * anything the creator wrote stays (see JaiProfileInfo.merge).
   */
  function fillInfo(doc, source) {
    var found = window.JaiProfileInfo.fromDocument(doc);
    if (!found) {
      cardsStatus('No JanitorAI profile found in ' + source + '.');
      return;
    }
    var result = window.JaiProfileInfo.merge(info, found);
    saveInfo();
    renderInfo();
    reapplyCards(0);
    reportToHost('profile_info_filled', String(result.added));
    var parts = [];
    if (result.added) parts.push('added ' + plural(result.added, 'character'));
    if (result.updated) parts.push('updated ' + plural(result.updated, 'character'));
    if (found.identity.badges.length) parts.push(plural(found.identity.badges.length, 'badge'));
    var missing = rosterTotal() - info.characters.length;
    cardsStatus('Filled from ' + source + (parts.length ? ': ' + parts.join(', ') : '') + '. ' +
      (missing > 0
        ? 'That page held ' + info.characters.length + ' of your ' + rosterTotal() +
          ' characters — save the other pages of your list the same way and press Add more pages.'
        : 'Friends, social links and About Me sections are yours to add.'));
  }

  $('#info-fill').addEventListener('click', function () {
    fillInfo(frame.contentDocument, 'the preview');
  });

  $$('[data-identity]').forEach(function (input) {
    input.addEventListener('input', function () {
      info.identity[input.dataset.identity] = input.value;
      saveInfo();
      updateCounts();
      reapplyCards();
    });
  });

  $$('[data-about]').forEach(function (input) {
    input.addEventListener('input', function () {
      info.about[input.dataset.about] = input.value;
      saveInfo();
      reapplyCards();
    });
  });

  // ------------------------------------------------ badges, sections, people

  function listItems(name) { return name === 'badges' ? info.identity.badges : info[name]; }

  function listHeading(name, item, index) {
    var spec = INFO_LISTS[name];
    var text = name === 'socials' ? (item.label || item.link) : item[spec.fields[0].key];
    return text || spec.noun.charAt(0).toUpperCase() + spec.noun.slice(1) + ' ' + (index + 1);
  }

  function renderInfoList(name) {
    var host = $('.info-list[data-list="' + name + '"]');
    var spec = INFO_LISTS[name];
    var items = listItems(name);
    host.innerHTML = items.length
      ? items.map(function (item, i) {
        return '<details class="card-row" data-index="' + i + '"><summary>' + thumb(item.image) +
          '<span class="card-row-name">' + escapeHtml(listHeading(name, item, i)) + '</span></summary>' +
          fieldsHtml(spec.fields, item) + rowButtons() + '</details>';
      }).join('')
      : '<p class="cards-empty">' + escapeHtml(spec.empty) + '</p>';
    updateCounts();
  }

  $$('.info-list').forEach(function (host) {
    var name = host.dataset.list;

    host.addEventListener('input', function (e) {
      var row = e.target.closest('.card-row');
      var field = e.target.dataset.field;
      if (!row || !field) return;
      var item = listItems(name)[+row.dataset.index];
      if (!item) return;
      item[field] = e.target.value;
      $('.card-row-name', row).textContent = listHeading(name, item, +row.dataset.index);
      saveInfo();
      reapplyCards();
    });

    host.addEventListener('click', function (e) {
      var row = e.target.closest('.card-row');
      if (!row || (e.target.dataset.move == null && e.target.dataset.remove == null)) return;
      var items = listItems(name);
      var index = +row.dataset.index;
      if (e.target.dataset.remove != null) {
        var item = items[index];
        var written = Object.keys(item).some(function (k) { return String(item[k] || '').trim(); });
        if (written && !confirm('Remove this ' + INFO_LISTS[name].noun + '?')) return;
        items.splice(index, 1);
      } else {
        var to = index + (+e.target.dataset.move);
        if (to < 0 || to >= items.length) return;
        items.splice(to, 0, items.splice(index, 1)[0]);
      }
      saveInfo();
      renderInfoList(name);
      reapplyCards(0);
    });
  });

  $$('[data-add]').forEach(function (button) {
    button.addEventListener('click', function () {
      var name = button.dataset.add;
      var item = {};
      INFO_LISTS[name].fields.forEach(function (f) { item[f.key] = ''; });
      listItems(name).push(item);
      saveInfo();
      renderInfoList(name);
      var rows = $$('.info-list[data-list="' + name + '"] .card-row');
      var last = rows[rows.length - 1];
      if (last) {
        last.open = true;
        var first = $('input, textarea', last);
        if (first) first.focus();
      }
    });
  });

  // ------------------------------------------------------------- characters

  function ensureCardId(entry) {
    if (!entry || entry._studioId) return entry && entry._studioId;
    Object.defineProperty(entry, '_studioId', {
      value: 'card-' + (++cardIdSeq), enumerable: false, configurable: false
    });
    return entry._studioId;
  }

  function ensureCardIds() {
    info.characters.forEach(ensureCardId);
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
    return info.characters.filter(function (entry) {
      return !query || String(entry.name || '').toLowerCase().indexOf(query) !== -1;
    });
  }

  function updateCardSelectionUi() {
    var visible = visibleCardEntries();
    var selected = info.characters.filter(cardIsSelected);
    var visibleSelected = visible.filter(cardIsSelected);
    var selectAll = $('#cards-select-all');
    selectAll.checked = !!visible.length && visibleSelected.length === visible.length;
    selectAll.indeterminate = !!visibleSelected.length && visibleSelected.length < visible.length;
    selectAll.disabled = !visible.length;
    $('#cards-selection-count').textContent = selected.length + ' selected';
    $('#cards-clear-selection').disabled = !selected.length;
    $('#cards-delete-selected').disabled = !selected.length;
    updateHardcodeAddUi();
  }

  function selectedHardcodeTargets() {
    return Object.keys(hardcodeTargets).filter(function (id) { return hardcodeTargets[id]; });
  }

  function updateHardcodeAddUi() {
    var button = $('#hardcode-add-selected');
    if (!button) return;
    var selected = info.characters.filter(cardIsSelected).length;
    var targets = selectedHardcodeTargets().length;
    button.disabled = !selected || !targets;
    $('#hardcode-sections-hint').textContent = !selected
      ? 'Select at least one character above.'
      : !targets ? 'Choose at least one detected section.'
      : selected + ' selected · ' + targets + ' ' + (targets === 1 ? 'section' : 'sections');
  }

  function renderHardcodeSections() {
    var host = $('#hardcode-sections-list');
    if (!host || !window.JaiHardcodeSections) return;
    var sections = window.JaiHardcodeSections.detect(state.code);
    var live = {};
    sections.forEach(function (section) { live[section.id] = true; });
    Object.keys(hardcodeTargets).forEach(function (id) {
      if (!live[id]) delete hardcodeTargets[id];
    });
    $('#hardcode-sections-count').textContent = sections.length || '';
    if (!sections.length) {
      host.innerHTML = '<p class="hardcode-sections-empty">No editable character sections were found. The studio recognises generated <code>@jai:hardcode</code> selectors, <code>.px-roll</code> archives and <code>.px-film-track</code> reels.</p>';
    } else {
      host.innerHTML = sections.map(function (section) {
        return '<label class="hardcode-section-row"><input type="checkbox" data-hardcode-section="' +
          escapeHtml(section.id) + '"' + (hardcodeTargets[section.id] ? ' checked' : '') + '>' +
          '<span class="hardcode-section-copy"><b>' + escapeHtml(section.label) + '</b><small>' +
          escapeHtml(section.detail) + '</small></span><span class="hardcode-section-total">' +
          section.count + '</span></label>';
      }).join('');
    }
    updateHardcodeAddUi();
  }

  /*
   * Which layout stylesheet to write. Left alone, the panel guesses: a document
   * that already styles .cs-shell has a look of its own and should keep it,
   * an empty one would otherwise produce a pile of unstyled divs.
   */
  function effectiveStyle() {
    if (info.layout.style) return info.layout.style;
    // Once a style has been written, its own .cs-shell rules are in the
    // document — so the guess has to stop guessing, or the next write would
    // decide the document is hand-styled and take the stylesheet back out.
    if (state.code.indexOf(window.JaiHardcode.markers.styleStart) !== -1) return 'contact-select';
    return /\.cs-shell\s*[,{]/.test(state.code) ? 'none' : 'contact-select';
  }

  /* Writing is the moment a guess becomes a decision. */
  function commitStyle() {
    if (!info.layout.style) { info.layout.style = effectiveStyle(); saveInfo(); }
  }

  function cardOption(key) {
    var options = info.layout.options;
    return options[key] != null && options[key] !== '' ? options[key] : window.JaiHardcode.defaults[key];
  }

  /* The emitter takes a chip count; the panel spells it as "0 turns it off". */
  function cardEmitOptions() {
    var opts = {};
    Object.keys(window.JaiHardcode.defaults).forEach(function (k) { opts[k] = cardOption(k); });
    opts.style = effectiveStyle();
    var chips = parseInt(info.layout.options.filterChips, 10);
    var listed = String(info.layout.options.filterList || '').trim();
    opts.filters = listed ? listed : (isNaN(chips) ? true : chips > 0);
    opts.filterLimit = isNaN(chips) ? undefined : chips;
    return window.JaiProfileInfo.emitOptions(info, opts);
  }

  function renderCards() {
    var list = $('#cards-list');
    ensureCardIds();
    var query = cards.search.trim().toLowerCase();
    if (!info.characters.length) {
      list.innerHTML = '<p class="cards-empty"><b>Import profile</b> fills this in from your saved page; ' +
        '<b>Add character</b> starts one by hand.</p>';
    } else {
      list.innerHTML = info.characters.map(function (entry, i) {
        var name = entry.name || 'Untitled';
        if (query && name.toLowerCase().indexOf(query) === -1) return '';
        var tagCount = (typeof entry.tags === 'string'
          ? entry.tags.split(',').filter(function (t) { return t.trim(); })
          : (entry.tags || [])).length;
        var meta = [pad2(i + 1)];
        if (entry.featured) meta.push('★ featured');
        if (entry.chats) meta.push(entry.chats + ' chats');
        if (tagCount) meta.push(plural(tagCount, 'tag'));
        if (!entry.art && !entry.portrait) meta.push('no image');
        return '<details class="card-row" data-index="' + i + '">' +
          '<summary><input type="checkbox" class="card-select" data-select aria-label="Select ' + escapeHtml(name) + '"' +
          (cardIsSelected(entry) ? ' checked' : '') + '>' + thumb(entry.portrait || entry.art) +
          '<span class="card-row-name">' + escapeHtml(name) + '</span>' +
          '<span class="card-row-meta">' + escapeHtml(meta.join(' · ')) + '</span></summary>' +
          fieldsHtml(FIELDS, entry) + rowButtons() + '</details>';
      }).join('') || '<p class="cards-empty">No character matches “' + escapeHtml(cards.search) + '”.</p>';
    }
    renderLayoutOptions();
    renderInsert();
    updateCounts();
    updateCardSelectionUi();
    renderHardcodeSections();
  }

  function renderLayoutOptions() {
    var styleSelect = $('#cards-opt-style');
    if (!styleSelect.options.length) {
      styleSelect.innerHTML = window.JaiHardcodeStyles.list.map(function (style) {
        return '<option value="' + style.id + '">' + escapeHtml(style.name) + '</option>';
      }).join('');
    }
    var style = syncDesignPick();

    var options = info.layout.options;
    $('#cards-opt-slots').value = cardOption('slots');
    $('#cards-opt-filters').value = options.filterChips != null ? options.filterChips : 8;
    $('#cards-opt-filterlist').value = options.filterList || '';
    $('#cards-opt-accent').value = cardOption('accent');
    $('#cards-opt-preview').value = cardOption('preview');
    // Empty means "the layout's own wording", which the placeholders show.
    ['title', 'kicker', 'launch', 'profileLabel', 'profileMark', 'friendsTitle', 'footerText',
      'steamBackground', 'steamFrameImage', 'steamLevel', 'steamStatus', 'steamSubtitle',
      'feedName', 'feedCategory'].forEach(function (key) {
      var field = $('#cards-opt-' + key);
      if (document.activeElement !== field) field.value = options[key] || '';
    });
    $('#cards-opt-feedStories').checked = cardOption('feedStories') !== false;
    var themeSelect = $('#cards-opt-steamTheme');
    if (!themeSelect.options.length && window.JaiSteamProfile) {
      themeSelect.innerHTML = Object.keys(window.JaiSteamProfile.themes).map(function (id) {
        return '<option value="' + id + '">' + escapeHtml(window.JaiSteamProfile.themes[id].name) + '</option>';
      }).join('');
      $('#cards-opt-steamFrame').innerHTML = Object.keys(window.JaiSteamProfile.frames).map(function (id) {
        return '<option value="' + id + '">' + escapeHtml(window.JaiSteamProfile.frames[id]) + '</option>';
      }).join('');
    }
    themeSelect.value = cardOption('steamTheme');
    $('#cards-opt-steamFrame').value = cardOption('steamFrame');
    renderBackdrops();
  }

  /* The Steam profile's backgrounds, as tiles painted with the real thing: the
   * same gradient the page will get, in the theme currently chosen. */
  function renderBackdrops() {
    var host = $('#steam-backdrops');
    var steam = window.JaiSteamProfile;
    if (!host || !steam) return;
    var options = cardEmitOptions();
    var current = steam.backdrop(options);
    var palette = steam.theme(options);
    var picture = info.layout.options.steamBackground || '';
    host.innerHTML = '';
    Object.keys(steam.backdrops).forEach(function (id) {
      var tile = el('button', 'swatch' + (id === current ? ' is-on' : ''));
      tile.type = 'button';
      tile.dataset.backdrop = id;
      tile.title = steam.backdrops[id].name;
      tile.setAttribute('role', 'radio');
      tile.setAttribute('aria-checked', String(id === current));
      tile.setAttribute('aria-label', steam.backdrops[id].name);
      if (steam.backdrops[id].draw) {
        tile.style.background = steam.backdrops[id].draw(palette);
      } else {
        tile.classList.add('swatch-picture');
        if (window.JaiHardcode.usable(picture)) {
          tile.style.backgroundImage = 'url("' + String(picture).replace(/["\\]/g, '') + '")';
        } else {
          tile.textContent = '+';
        }
      }
      host.appendChild(tile);
    });
  }

  $('#steam-backdrops').addEventListener('click', function (e) {
    var tile = e.target.closest('[data-backdrop]');
    if (!tile) return;
    if (tile.dataset.backdrop === 'picture' && !window.JaiHardcode.usable(info.layout.options.steamBackground)) {
      // Nothing to show yet: the tile is the way to the field that takes one.
      $('#cards-opt-steamBackground').focus();
      cardsStatus('Paste the address of a wide picture below the tiles, and it becomes your background.');
      return;
    }
    info.layout.options.steamBackdrop = tile.dataset.backdrop;
    saveInfo();
    renderBackdrops();
    reapplyCards(0);
  });

  /* The menu at the top of Profile data, and the panel under it, show the
   * design the document is wearing. Called whenever the document changes, so
   * adding Golden Hour from Insert moves the menu to Instagram-style. */
  function syncDesignPick() {
    var styleSelect = $('#cards-opt-style');
    var style = currentDesign();
    if (!styleSelect || !styleSelect.options.length) return style;
    if (document.activeElement !== styleSelect) styleSelect.value = style.id;
    $('#cards-style-hint').textContent = style.blurb;
    $('#info-layout-name').textContent = isDesign(style) ? style.name : '';
    // Each design uses some of Profile data and has options of its own; the
    // rest would only be fields that do nothing. Anything a hidden section
    // holds is kept, and is back the moment its design is chosen again.
    $$('[data-design]').forEach(function (node) {
      node.hidden = node.dataset.design.split(' ').indexOf(style.id) === -1;
    });
    return style;
  }

  function renderInsert() {
    var worn = currentDesign();
    var applied = window.JaiHardcode.isApplied(state.code) ||
      (!!worn.template && designParts(worn).some(function (c) { return window.JaiPresets.isPartApplied(state.code, c); }));
    $('#cards-insert').textContent = applied ? 'Update About Me' : 'Insert into About Me';
    var needsRoster = !worn.template && !info.characters.length;
    $('#cards-insert').disabled = needsRoster;
    $('#cards-insert-hint').textContent = needsRoster ? 'Add at least one character to build a profile.'
      : applied ? 'Rewrites only the generated block.'
      : 'Adds a generated block; the rest of your code is untouched.';
  }

  /*
   * Once the generated block is in the document, Profile information and the
   * document have to stay in step: typing a new name and watching the old one
   * sit in the preview is just a bug with extra steps. Debounced, because every
   * keystroke would otherwise rebuild the payload and re-render the preview.
   */
  var reapplyTimer = null;
  function reapplyCards(delay) {
    var worn = currentDesign();
    if (worn.template) {
      // A template-backed design: only its parts' copy follows Profile data.
      clearTimeout(reapplyTimer);
      reapplyTimer = setTimeout(function () {
        var written = writeDesignParts(state.code, currentDesign(), false);
        if (written !== state.code) setCode(written, 'cards');
      }, delay == null ? 260 : delay);
      return;
    }
    if (!window.JaiHardcode.isApplied(state.code)) return;
    clearTimeout(reapplyTimer);
    reapplyTimer = setTimeout(function () {
      var generatedRoster = window.JaiHardcodeSections
        ? window.JaiHardcodeSections.rosterForGenerated(state.code, info.characters)
        : info.characters;
      // Into the design that is there, not the one last chosen (see
      // generatedStyleOf): after an Undo those can differ.
      var next = generatedRoster.length
        ? window.JaiHardcode.apply(state.code, generatedRoster, emitOptionsFor(generatedStyleOf(state.code) || effectiveStyle()))
        : window.JaiHardcode.remove(state.code);
      if (next !== state.code) setCode(next, 'cards');
    }, delay == null ? 260 : delay);
  }

  $('#cards-list').addEventListener('input', function (e) {
    var row = e.target.closest('.card-row');
    var field = e.target.dataset.field;
    if (!row || !field) return;
    var entry = info.characters[+row.dataset.index];
    if (!entry) return;
    entry[field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (field === 'name') $('.card-row-name', row).textContent = e.target.value || 'Untitled';
    saveInfo();
    reapplyCards();
  });

  $('#cards-list').addEventListener('change', function (e) {
    if (!e.target.matches('[data-select]')) return;
    var row = e.target.closest('.card-row');
    if (!row) return;
    var entry = info.characters[+row.dataset.index];
    if (!entry) return;
    setCardSelected(entry, e.target.checked);
    updateCardSelectionUi();
  });

  $('#cards-list').addEventListener('click', function (e) {
    var row = e.target.closest('.card-row');
    if (!row) return;
    if (e.target.matches('[data-select]')) {
      // Selecting a card should not also open/close its details row.
      e.stopPropagation();
      return;
    }
    var index = +row.dataset.index;
    if (e.target.dataset.remove != null) {
      if (!confirm('Remove ' + (info.characters[index].name || 'this character') + '?')) return;
      delete cards.selected[ensureCardId(info.characters[index])];
      info.characters.splice(index, 1);
    } else if (e.target.dataset.move) {
      var to = index + (+e.target.dataset.move);
      if (to < 0 || to >= info.characters.length) return;
      info.characters.splice(to, 0, info.characters.splice(index, 1)[0]);
    } else {
      return;
    }
    saveInfo();
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
    var selected = info.characters.filter(cardIsSelected);
    if (!selected.length) return;
    var noun = selected.length === 1 ? 'character' : 'characters';
    if (!confirm('Delete ' + selected.length + ' selected ' + noun + '?')) return;
    info.characters = info.characters.filter(function (entry) { return !cardIsSelected(entry); });
    cards.selected = {};
    saveInfo();
    renderCards();
    reapplyCards(0);
    cardsStatus('Deleted ' + selected.length + ' ' + noun + '.');
  });

  $('#cards-search').addEventListener('input', function () {
    cards.search = this.value;
    renderCards();
  });

  $('#cards-add').addEventListener('click', function () {
    var entry = {};
    FIELDS.forEach(function (f) { entry[f.key] = ''; });
    info.characters.push(entry);
    cards.search = '';
    $('#cards-search').value = '';
    saveInfo();
    renderCards();
    var last = $$('#cards-list .card-row').pop();
    if (last) { last.open = true; last.scrollIntoView({ block: 'nearest' }); }
    cardsStatus('');
  });

  $('#hardcode-sections-list').addEventListener('change', function (e) {
    var id = e.target.dataset.hardcodeSection;
    if (!id) return;
    if (e.target.checked) hardcodeTargets[id] = true;
    else delete hardcodeTargets[id];
    updateHardcodeAddUi();
  });

  $('#hardcode-add-selected').addEventListener('click', function () {
    var selected = info.characters.filter(cardIsSelected);
    var targets = selectedHardcodeTargets();
    if (!selected.length || !targets.length) return;
    var next = state.code;
    var added = 0;
    var errors = [];
    targets.forEach(function (id) {
      var result = window.JaiHardcodeSections.add(next, id, selected, info.characters, cardEmitOptions());
      next = result.payload;
      added += result.added || 0;
      if (result.error) errors.push(result.error);
    });
    if (next !== state.code) setCode(next, 'cards');
    renderHardcodeSections();
    cardsStatus(added
      ? 'Added ' + plural(added, 'character appearance') + ' across the chosen sections.'
      : errors[0] || 'Those characters are already present in the chosen sections.');
  });

  /* Opens Profile data on a fresh character — the way to add one to a layout
   * that is linked to it. */
  function addCharacter() {
    showPanel('info');
    $('#info-characters').open = true;
    $('#cards-add').click();
  }

  /* Choosing a design is asking for it: it is written into About Me there and
   * then, replacing the one before it (one Undo takes it back). Profile data
   * is what both are built from, so nothing typed here is lost in the swap. */
  $('#cards-opt-style').addEventListener('change', function () {
    var style = window.JaiHardcodeStyles.get(this.value);
    this.blur();     // so the menu can show what the document ends up wearing
    if (isDesign(style)) {
      // Its own options are the next thing to look at, so they are opened.
      $('#info-layout').open = true;
      applyDesign(style);
      return;
    }
    // "None": no ready-made design. A template-backed one is taken off; a
    // generated one keeps its markup and loses its stylesheet, which is what
    // "I style it myself" has always meant.
    var worn = currentDesign();
    info.layout.style = this.value;
    saveInfo();
    var next = state.code;
    if (worn.template) {
      designParts(worn).slice().reverse().forEach(function (part) {
        next = window.JaiPresets.removePart(next, part);
        markAuto(part.id, false);
      });
    } else if (window.JaiHardcode.isApplied(next)) {
      next = window.JaiHardcode.apply(next, info.characters, emitOptionsFor(this.value));
    }
    if (next !== state.code) setCode(next, 'cards');
    renderCards();
    syncTemplates();
    if (worn.template) toast('“' + worn.name + '” taken off. Ctrl+Z brings it back.');
  });

  $('#cards-opt-feedStories').addEventListener('change', function () {
    info.layout.options.feedStories = this.checked;
    saveInfo();
    reapplyCards(0);
  });

  $$('#cards-opt-title, #cards-opt-kicker, #cards-opt-launch, #cards-opt-slots, #cards-opt-filters, #cards-opt-filterlist, #cards-opt-accent, #cards-opt-preview, #cards-opt-profileLabel, #cards-opt-profileMark, #cards-opt-friendsTitle, #cards-opt-footerText, #cards-opt-steamTheme, #cards-opt-steamBackground, #cards-opt-steamFrame, #cards-opt-steamFrameImage, #cards-opt-steamLevel, #cards-opt-steamStatus, #cards-opt-steamSubtitle, #cards-opt-feedName, #cards-opt-feedCategory')
    .forEach(function (input) {
      input.addEventListener('input', function () {
        var key = input.id.replace('cards-opt-', '');
        var options = info.layout.options;
        if (key === 'filters') options.filterChips = input.value;
        else if (key === 'filterlist') options.filterList = input.value;
        else if (key === 'slots') options.slots = parseInt(input.value, 10) || 1;
        else options[key] = input.value;
        // A picture pasted in is a picture chosen; emptied, the choice falls
        // back to the drawn backgrounds. A new theme repaints the tiles.
        if (key === 'steamBackground') options.steamBackdrop = input.value.trim() ? 'picture' : '';
        if (key === 'steamBackground' || key === 'steamTheme') renderBackdrops();
        saveInfo();
        reapplyCards();
      });
    });

  $('#cards-insert').addEventListener('click', function () {
    var worn = currentDesign();
    if (worn.template) { applyDesign(worn); return; }
    commitStyle();
    var generatedRoster = window.JaiHardcodeSections
      ? window.JaiHardcodeSections.rosterForGenerated(state.code, info.characters)
      : info.characters;
    var next = window.JaiHardcode.apply(state.code, generatedRoster, cardEmitOptions());
    if (next === state.code) { toast('About Me already matches your Profile information.'); return; }
    setCode(next, 'cards');
    reportToHost('cards_inserted', String(info.characters.length));
    toast(plural(info.characters.length, 'character') + ' written into About Me.');
    renderCards();
    syncLayouts();
  });

  // ---------------------------------------------------------------- the API
  //
  // What the canvas modules (canvas.js, layers.js, insert.js, inspector.js)
  // are allowed to reach for. The document is read and written only through
  // here, so history, the linter and the preview never miss a change.

  window.JaiStudio = {
    on: on,
    emit: emit,
    post: post,
    toast: toast,
    copy: copy,
    el: el,
    escapeHtml: escapeHtml,
    state: state,
    frame: frame,
    code: function () { return state.code; },
    setCode: setCode,
    editCss: editCss,
    markup: function () { return window.JaiMarkup.parse(state.code); },
    readValue: readValue,
    writeValue: writeValue,
    writeValues: writeValues,
    ruleDeclarations: ruleDeclarations,
    renameDeclaration: renameDeclaration,
    issues: function () { return lintIssues; },
    undo: undo,
    redo: redo,
    showPanel: showPanel,
    setDock: setDock,
    setMode: setMode,
    setData: setData,
    placePart: placePart,
    togglePart: togglePart,
    addCharacter: addCharacter,
    toggleUi: toggleUi,
    addRuleStub: addRuleStub,
    scale: function () { return stageScale; },
    info: function () { return info; },
    touchInfo: touchInfo
  };

  // ------------------------------------------------------------------ start

  load();
  renderProfileSwitcher();
  $('#enforce').checked = state.enforce;
  $('#viewport-select').value = state.viewport;
  $('#custom-width').value = state.customWidth;
  $('#custom-width').hidden = state.viewport !== 'custom';

  renderPresets();
  renderTemplates();
  renderLayouts();
  renderCustomPresets();
  renderInfo();
  renderProfileFields();
  renderReference('');
  showPanel(state.panel);
  setDock(state.dockOpen, state.dockTab);
  setCode(state.code || window.JaiPayload.STARTER, 'load');
  renderHistory();
  layoutStage();
  appReady = true;
  bootProfiles();
  reportToHost('studio_ready');
})();
