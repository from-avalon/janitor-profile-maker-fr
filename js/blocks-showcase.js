/*
 * More for the Insert panel: the effects that make a profile look designed
 * rather than typed — tapes, reels, tabs, glowing orbs, flip cards — each one a
 * block a creator drags in and then restyles in the properties panel.
 *
 * Most of these are the tricks a hand-built profile uses (a scrolling tape, a
 * film reel of chibis, CSS-only tabs on `:target`, social "orbs" with a spinning
 * ring) turned into pieces that need no editing of the code to try.
 *
 * Same rules as js/blocks.js — which this file extends through `register` —
 * and the same limits from JanitorAI (see js/lint.js):
 *   - no `<button>`, `<svg>`, `<label>` or `<input>`, so the things that look
 *     like controls are links, and the ones that react are driven by `:hover`,
 *     `<details>` or `:target`;
 *   - no `url()`, `var()`, `attr()` or custom properties, so every picture is
 *     an `<img>` and every colour is written out;
 *   - `gap`, never `column-gap`; physical properties, never logical ones;
 *   - motion is plain `@keyframes`, each with a `prefers-reduced-motion` rule.
 *
 * Markup is written back to back (no whitespace between sibling tags): a
 * newline between inline siblings renders as a visible gap.
 */
(function (global) {
  'use strict';

  var B = global.JaiBlocks;
  var icon = B.icon;

  var ACCENT = '#e11d36';
  var INK = '#0a0a0d';
  var DISPLAY = '"Arial Black", "Arial Bold", Arial, sans-serif';
  var MONO = 'Consolas, "Courier New", monospace';

  function photo(seed, w, h, query) {
    return 'https://picsum.photos/seed/' + seed + '/' + w + '/' + h + (query || '');
  }

  /* One starting rule: a selector, then its declarations. */
  function rule(selector) {
    return [selector, Array.prototype.slice.call(arguments, 1).join('\n  ')];
  }

  /* A motion rule: wraps rules in prefers-reduced-motion so the page can stand still. */
  function still(rules) {
    return ['@media (prefers-reduced-motion: reduce)', rules];
  }

  function frames(name, body) {
    return [name, '@keyframes ' + name + ' {\n' + body + '\n}'];
  }

  // ------------------------------------------------------------------ pieces

  // One copy has to be wider than the widest About Me column (half the track is
  // one copy), so the phrase runs three times. No min-width: padding the box out
  // instead would leave an uneven gap where the two copies meet.
  var TAPE_PHRASE = 'NEW BOT OUT NOW ★ COME SAY HI ★ STAY A WHILE ★';
  var TAPE_TEXT = [TAPE_PHRASE, TAPE_PHRASE, TAPE_PHRASE].join(' ');

  function reelHalf() {
    var out = '';
    for (var i = 1; i <= 8; i++) {
      out += '<span class="jx-reel-frame"><img class="jx-reel-img" src="' + photo('reel' + i, 256, 216) + '" alt=""></span>';
    }
    return out;
  }

  var BLOCKS = [
    // ------------------------------------------------------------------ Text
    {
      id: 'poster', name: 'Poster title', category: 'Text', base: 'jx-poster',
      icon: icon('<path d="M4 13l4-9 4 9M5.5 10h5"/>'),
      html: '<h2 class="jx-poster {u}">Poster title</h2>',
      css: [rule('.jx-poster',
        'margin: 0 0 14px;',
        'color: #ffffff;',
        'font-family: ' + DISPLAY + ';',
        'font-size: 44px;',
        'font-weight: 900;',
        'font-style: italic;',
        'letter-spacing: -0.045em;',
        'line-height: 0.95;',
        'text-transform: uppercase;',
        'text-shadow: 4px 4px 0 ' + ACCENT + ', 7px 7px 0 ' + INK + ';')]
    },
    {
      id: 'section-head', name: 'Section head', category: 'Text', base: 'jx-head',
      icon: icon('<path d="M2.5 4h4M2.5 8h11M2.5 11.5h8"/>'),
      html: '<div class="jx-head {u}"><span class="jx-head-eyebrow {u}">File 01 / Section</span>' +
        '<h2 class="jx-head-title {u}">Section <em>title.</em></h2></div>',
      parts: [['jx-head-eyebrow', 'Eyebrow'], ['jx-head-title', 'Section title']],
      css: [
        rule('.jx-head', 'margin: 0 0 18px;', 'padding-bottom: 14px;', 'border-bottom: 2px solid rgba(255, 255, 255, 0.14);'),
        rule('.jx-head-eyebrow',
          'display: block;',
          'color: ' + ACCENT + ';',
          'font-family: ' + MONO + ';',
          'font-size: 11px;',
          'font-weight: 700;',
          'letter-spacing: 0.22em;',
          'text-transform: uppercase;'),
        rule('.jx-head-title',
          'margin: 8px 0 0;',
          'font-family: ' + DISPLAY + ';',
          'font-size: 34px;',
          'font-weight: 900;',
          'font-style: italic;',
          'letter-spacing: -0.04em;',
          'line-height: 0.95;',
          'text-transform: uppercase;'),
        rule('.jx-head-title em', 'color: ' + ACCENT + ';', 'font-style: italic;')
      ]
    },
    {
      id: 'bubble', name: 'Speech bubble', category: 'Text', base: 'jx-bubble',
      icon: icon('<path d="M3 3.5h10a1 1 0 011 1v5a1 1 0 01-1 1H8l-3 2.5V10.5H3a1 1 0 01-1-1v-5a1 1 0 011-1z"/>'),
      html: '<p class="jx-bubble {u}">Something they would say, in a speech bubble.</p>',
      css: [
        rule('.jx-bubble',
          'position: relative;',
          'max-width: 380px;',
          'margin: 0 0 24px;',
          'padding: 14px 18px;',
          'border-radius: 16px;',
          'background: #f4f2ea;',
          'color: ' + INK + ';',
          'font-weight: 700;',
          'line-height: 1.4;'),
        // The tail borrows the bubble's own background, so recolouring one recolours both.
        rule('.jx-bubble::after',
          'content: "";',
          'position: absolute;',
          'left: 26px;',
          'bottom: -12px;',
          'width: 22px;',
          'height: 14px;',
          'background: inherit;',
          'clip-path: polygon(0 0, 100% 0, 18% 100%);')
      ]
    },

    // ----------------------------------------------------------------- Media
    {
      id: 'swap', name: 'Hover swap', category: 'Media', base: 'jx-swap',
      icon: icon('<rect x="2" y="3" width="8" height="7" rx="1"/><rect x="6" y="6" width="8" height="7" rx="1"/>'),
      hint: 'Hover it in Preview mode: the second picture fades in over the first.',
      html: '<div class="jx-swap {u}"><img class="jx-swap-a {u}" src="' + photo('avalon', 640, 360, '?grayscale') + '" alt="">' +
        '<img class="jx-swap-b {u}" src="' + photo('avalon', 640, 360) + '" alt=""></div>',
      parts: [['jx-swap-a', 'Picture (resting)'], ['jx-swap-b', 'Picture (hover)']],
      css: [
        rule('.jx-swap',
          'position: relative;',
          'max-width: 480px;',
          'margin: 0 0 12px;',
          'overflow: hidden;',
          'border-radius: 12px;',
          'background: ' + INK + ';',
          'aspect-ratio: 16 / 9;'),
        rule('.jx-swap-a, .jx-swap-b',
          'position: absolute;',
          'top: 0;',
          'left: 0;',
          'width: 100%;',
          'height: 100%;',
          'max-width: none;',
          'object-fit: cover;',
          'transition: opacity 0.45s ease, transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);'),
        rule('.jx-swap-b', 'opacity: 0;'),
        rule('.jx-swap:hover .jx-swap-b', 'opacity: 1;'),
        rule('.jx-swap:hover .jx-swap-a, .jx-swap:hover .jx-swap-b', 'transform: scale(1.05);')
      ]
    },
    {
      id: 'gallery', name: 'Gallery', category: 'Media', base: 'jx-gallery',
      icon: icon('<rect x="2" y="2.5" width="5" height="5" rx="1"/><rect x="9" y="2.5" width="5" height="5" rx="1"/><path d="M2 11h5M9 11h5M2 13.5h3M9 13.5h3"/>'),
      html: '<div class="jx-gallery {u}">' + ['One', 'Two', 'Three'].map(function (word, i) {
        return '<figure class="jx-shot {u}"><img class="jx-shot-img {u}" src="' + photo('shot' + (i + 1), 480, 400) + '" alt="">' +
          '<figcaption class="jx-shot-cap {u}">Caption ' + word.toLowerCase() + '</figcaption></figure>';
      }).join('') + '</div>',
      parts: [['jx-shot', 'Picture'], ['jx-shot-img', 'Picture image'], ['jx-shot-cap', 'Caption']],
      css: [
        rule('.jx-gallery',
          'display: grid;',
          'grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));',
          'gap: 12px;',
          'margin: 0 0 12px;'),
        rule('.jx-shot',
          'position: relative;',
          'height: 200px;',
          'margin: 0;',
          'overflow: hidden;',
          'border: 2px solid rgba(255, 255, 255, 0.14);',
          'border-radius: 8px;',
          'background: #0d0f18;',
          'transition: border-color 0.2s ease, transform 0.25s ease;'),
        rule('.jx-shot-img',
          'position: absolute;',
          'top: 0;',
          'left: 0;',
          'width: 100%;',
          'height: 100%;',
          'max-width: none;',
          'object-fit: cover;',
          'transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);'),
        rule('.jx-shot-cap',
          'position: absolute;',
          'left: 0;',
          'right: 0;',
          'bottom: 0;',
          'padding: 28px 14px 11px;',
          'background: linear-gradient(0deg, ' + INK + ', transparent);',
          'color: #f4f2ea;',
          'font-family: ' + MONO + ';',
          'font-size: 11px;',
          'font-weight: 700;',
          'letter-spacing: 0.14em;',
          'text-transform: uppercase;',
          'transform: translateY(100%);',
          'transition: transform 0.3s ease;'),
        rule('.jx-shot:hover', 'border-color: ' + ACCENT + ';', 'transform: translateY(-4px);'),
        rule('.jx-shot:hover .jx-shot-img', 'transform: scale(1.08);'),
        rule('.jx-shot:hover .jx-shot-cap', 'transform: none;')
      ]
    },
    {
      id: 'avatar', name: 'Avatar ring', category: 'Media', base: 'jx-avatar',
      icon: icon('<circle cx="8" cy="8" r="6"/><circle cx="8" cy="6.5" r="2"/><path d="M4.5 12.5c.8-2 2-2.5 3.5-2.5s2.7.5 3.5 2.5"/>'),
      html: '<div class="jx-avatar {u}"><img class="jx-avatar-img {u}" src="' + photo('avatar', 240, 240) + '" alt=""></div>',
      parts: [['jx-avatar-img', 'Avatar picture']],
      css: [
        rule('.jx-avatar',
          'position: relative;',
          'width: 112px;',
          'height: 112px;',
          'margin: 0 0 14px;',
          'padding: 5px;',
          'border-radius: 50%;',
          'box-sizing: border-box;',
          'box-shadow: 0 0 0 4px ' + INK + ', 0 0 0 6px rgba(255, 255, 255, 0.18);',
          'isolation: isolate;'),
        // The ring is a layer of its own, so it can turn without turning the picture.
        rule('.jx-avatar::before',
          'content: "";',
          'position: absolute;',
          'top: 0;',
          'right: 0;',
          'bottom: 0;',
          'left: 0;',
          'z-index: 0;',
          'border-radius: 50%;',
          'background: conic-gradient(from 210deg, ' + ACCENT + ', #ffffff, ' + ACCENT + ');',
          'animation: jx-avatar-spin 8s linear infinite;'),
        rule('.jx-avatar-img',
          'position: relative;',
          'z-index: 1;',
          'display: block;',
          'width: 100%;',
          'height: 100%;',
          'max-width: none;',
          'border-radius: 50%;',
          'object-fit: cover;'),
        still('.jx-avatar::before { animation: none; }')
      ],
      keyframes: [frames('jx-avatar-spin', '  to { transform: rotate(360deg); }')]
    },
    {
      id: 'hazard', name: 'Hazard stripe', category: 'Media', base: 'jx-hazard',
      icon: icon('<path d="M2 12l4-8M6 12l4-8M10 12l4-8"/>'),
      html: '<div class="jx-hazard {u}"></div>',
      css: [rule('.jx-hazard',
        'height: 12px;',
        'margin: 16px 0;',
        'background: repeating-linear-gradient(-45deg, ' + ACCENT + ' 0 10px, ' + INK + ' 10px 20px);')]
    },
    {
      id: 'polaroid', name: 'Polaroid', category: 'Media', base: 'jx-polaroid',
      icon: icon('<rect x="3" y="2" width="10" height="12" rx="1"/><rect x="4.5" y="3.5" width="7" height="6"/>'),
      html: '<figure class="jx-polaroid {u}"><img class="jx-polaroid-img {u}" src="' + photo('polaroid', 480, 400) + '" alt="">' +
        '<figcaption class="jx-polaroid-cap {u}">A moment, framed</figcaption></figure>',
      parts: [['jx-polaroid-img', 'Photo'], ['jx-polaroid-cap', 'Photo caption']],
      css: [
        rule('.jx-polaroid',
          'width: 220px;',
          'margin: 8px 0 22px;',
          'padding: 12px 12px 14px;',
          'background: #f4f2ea;',
          'color: ' + INK + ';',
          'box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5);',
          'transform: rotate(-3deg);',
          'transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);'),
        rule('.jx-polaroid:hover', 'transform: rotate(0deg) scale(1.04);'),
        rule('.jx-polaroid-img',
          'display: block;',
          'width: 100%;',
          'height: 190px;',
          'max-width: none;',
          'background: #222222;',
          'object-fit: cover;'),
        rule('.jx-polaroid-cap',
          'margin: 10px 0 0;',
          'font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;',
          'font-size: 15px;',
          'font-weight: 700;',
          'text-align: center;')
      ]
    },

    // ---------------------------------------------------------------- Layout
    {
      id: 'tabs', name: 'Tabs', category: 'Layout', base: 'jx-tabs',
      icon: icon('<path d="M2 13V6.5h4V4h5v2.5h3V13z"/>'),
      hint: 'Try it in Preview mode. It runs on the page’s one #anchor, so with two sets, picking a tab in one sends the other back to its first tab.',
      html: '<div class="jx-tabs {u}">' +
        '<span class="jx-tabs-key {u}" id="{t1}"></span><span class="jx-tabs-key {u}" id="{t2}"></span><span class="jx-tabs-key {u}" id="{t3}"></span>' +
        '<div class="jx-tabs-bar {u}">' +
          '<a class="jx-tabs-tab jx-tabs-tab-1 {u}" href="#{t1}">First</a>' +
          '<a class="jx-tabs-tab jx-tabs-tab-2 {u}" href="#{t2}">Second</a>' +
          '<a class="jx-tabs-tab jx-tabs-tab-3 {u}" href="#{t3}">Third</a>' +
        '</div>' +
        '<div class="jx-tabs-pane jx-tabs-pane-1 {u}">The first tab. Double-click to write something here.</div>' +
        '<div class="jx-tabs-pane jx-tabs-pane-2 {u}">The second tab.</div>' +
        '<div class="jx-tabs-pane jx-tabs-pane-3 {u}">The third tab.</div></div>',
      parts: [['jx-tabs-key', 'Tab anchor'], ['jx-tabs-bar', 'Tab bar'], ['jx-tabs-tab', 'Tab'],
        ['jx-tabs-tab-1', 'Tab'], ['jx-tabs-tab-2', 'Tab'], ['jx-tabs-tab-3', 'Tab'],
        ['jx-tabs-pane', 'Tab content'], ['jx-tabs-pane-1', 'Tab content'],
        ['jx-tabs-pane-2', 'Tab content'], ['jx-tabs-pane-3', 'Tab content']],
      css: [
        rule('.jx-tabs', 'margin: 0 0 16px;'),
        // The anchors are fixed so following a link to one never scrolls the page.
        rule('.jx-tabs-key', 'position: fixed;', 'top: 0;', 'left: 0;', 'width: 1px;', 'height: 1px;', 'pointer-events: none;'),
        rule('.jx-tabs-bar', 'display: flex;', 'flex-wrap: wrap;', 'gap: 6px;'),
        rule('.jx-tabs-tab',
          'padding: 9px 20px;',
          'border: 1px solid rgba(255, 255, 255, 0.18);',
          'border-bottom: 0;',
          'border-radius: 8px 8px 0 0;',
          'background: rgba(255, 255, 255, 0.04);',
          'color: inherit;',
          'font-size: 13px;',
          'font-weight: 700;',
          'text-decoration: none;'),
        // JanitorAI turns every link purple on hover with `a:hover`, which outranks a plain
        // class, so the colour is restated here (two classes' worth of weight beats it).
        // Hover feedback is a brightness filter so it works on the open tab too.
        rule('.jx-tabs-tab:hover', 'color: inherit;', 'filter: brightness(1.3);'),
        rule('.jx-tabs-pane',
          'display: none;',
          'padding: 16px 18px;',
          'border: 1px solid rgba(255, 255, 255, 0.18);',
          'border-radius: 0 10px 10px 10px;',
          'background: rgba(255, 255, 255, 0.04);',
          'line-height: 1.6;'),
        // First tab open until another anchor is the target…
        rule('.jx-tabs-pane-1', 'display: block;'),
        rule('.jx-tabs .jx-tabs-tab-1, .jx-tabs:has(#{t2}:target) .jx-tabs-tab-2, .jx-tabs:has(#{t3}:target) .jx-tabs-tab-3',
          'border-color: ' + ACCENT + ';', 'background: ' + ACCENT + ';', 'color: #ffffff;'),
        // …and then the open one swaps.
        rule('.jx-tabs:has(#{t2}:target) .jx-tabs-tab-1, .jx-tabs:has(#{t3}:target) .jx-tabs-tab-1',
          'border-color: rgba(255, 255, 255, 0.18);', 'background: rgba(255, 255, 255, 0.04);', 'color: inherit;'),
        rule('.jx-tabs:has(#{t2}:target) .jx-tabs-pane-1, .jx-tabs:has(#{t3}:target) .jx-tabs-pane-1', 'display: none;'),
        rule('.jx-tabs:has(#{t2}:target) .jx-tabs-pane-2', 'display: block;'),
        rule('.jx-tabs:has(#{t3}:target) .jx-tabs-pane-3', 'display: block;')
      ]
    },
    {
      id: 'bracket', name: 'Corner panel', category: 'Layout', base: 'jx-bracket',
      icon: icon('<path d="M2 5V2.5h2.5M11.5 2.5H14V5M14 11v2.5h-2.5M4.5 13.5H2V11"/>'),
      html: '<div class="jx-bracket {u}"><div class="jx-bracket-title {u}">Panel title</div>' +
        '<p class="jx-bracket-text {u}">A panel with bright corners. Put anything inside it.</p></div>',
      parts: [['jx-bracket-title', 'Panel title'], ['jx-bracket-text', 'Panel text']],
      css: [
        rule('.jx-bracket',
          'position: relative;',
          'margin: 0 0 14px;',
          'padding: 20px 22px;',
          'border: 2px solid rgba(255, 255, 255, 0.14);',
          'background: radial-gradient(ellipse at 100% 0%, rgba(255, 255, 255, 0.07), transparent 55%), rgba(255, 255, 255, 0.03);'),
        rule('.jx-bracket::before',
          'content: "";',
          'position: absolute;',
          'top: -2px;',
          'right: -2px;',
          'width: 22px;',
          'height: 22px;',
          'border-top: 4px solid ' + ACCENT + ';',
          'border-right: 4px solid ' + ACCENT + ';'),
        rule('.jx-bracket::after',
          'content: "";',
          'position: absolute;',
          'bottom: -2px;',
          'left: -2px;',
          'width: 22px;',
          'height: 22px;',
          'border-bottom: 4px solid ' + ACCENT + ';',
          'border-left: 4px solid ' + ACCENT + ';'),
        rule('.jx-bracket-title',
          'margin: 0 0 8px;',
          'color: ' + ACCENT + ';',
          'font-family: ' + MONO + ';',
          'font-size: 11px;',
          'font-weight: 700;',
          'letter-spacing: 0.2em;',
          'text-transform: uppercase;'),
        rule('.jx-bracket-text', 'margin: 0;', 'line-height: 1.6;')
      ]
    },
    {
      id: 'stats', name: 'Stat sheet', category: 'Layout', base: 'jx-stats',
      icon: icon('<path d="M2.5 4.5h4M9 4.5h4.5M2.5 8h4M9 8h4.5M2.5 11.5h4M9 11.5h4.5"/>'),
      html: '<div class="jx-stats {u}">' + [['Role', 'Bot creator'], ['Writes', 'Fantasy · Angst · Comedy'], ['Worlds', 'Two so far'], ['Updates', 'Whenever it is ready']].map(function (row) {
        return '<div class="jx-stat {u}"><b class="jx-stat-label {u}">' + row[0] + '</b><span class="jx-stat-value {u}">' + row[1] + '</span></div>';
      }).join('') + '</div>',
      parts: [['jx-stat', 'Stat row'], ['jx-stat-label', 'Stat label'], ['jx-stat-value', 'Stat value']],
      css: [
        rule('.jx-stats',
          'max-width: 420px;',
          'margin: 0 0 14px;',
          'border: 2px solid rgba(255, 255, 255, 0.14);',
          'border-radius: 6px;',
          'background: rgba(0, 0, 0, 0.25);'),
        rule('.jx-stat',
          'display: flex;',
          'align-items: center;',
          'justify-content: space-between;',
          'gap: 12px;',
          'padding: 12px 16px;',
          'border-bottom: 1px dashed rgba(255, 255, 255, 0.16);'),
        rule('.jx-stat:last-child', 'border-bottom: 0;'),
        rule('.jx-stat-label',
          'font-family: ' + MONO + ';',
          'font-size: 11px;',
          'font-weight: 700;',
          'letter-spacing: 0.14em;',
          'text-transform: uppercase;',
          'opacity: 0.6;'),
        rule('.jx-stat-value', 'font-size: 14px;', 'font-weight: 800;', 'text-align: right;')
      ]
    },
    {
      id: 'people', name: 'Profile cards', category: 'Layout', base: 'jx-people',
      icon: icon('<circle cx="5.5" cy="6" r="2"/><circle cx="11" cy="6.5" r="1.6"/><path d="M2 13c.4-2.5 1.8-3.5 3.5-3.5S8.6 10.5 9 13M9.5 12.5c.3-1.6 1.1-2.3 2-2.3 1.2 0 2 .8 2.5 2.3"/>'),
      html: '<div class="jx-people {u}">' + [['Friend one', 'JanitorAI creator'], ['Friend two', 'JanitorAI creator'], ['Friend three', 'JanitorAI creator']].map(function (who, i) {
        return '<a class="jx-person {u}" href="https://janitorai.com/"><span class="jx-person-orb {u}"><img class="jx-person-img {u}" src="' +
          photo('person' + (i + 1), 144, 144) + '" alt=""></span><b class="jx-person-name {u}">' + who[0] + '</b>' +
          '<small class="jx-person-note {u}">' + who[1] + '</small></a>';
      }).join('') + '</div>',
      parts: [['jx-person', 'Profile card'], ['jx-person-orb', 'Card avatar'], ['jx-person-img', 'Card avatar image'],
        ['jx-person-name', 'Card name'], ['jx-person-note', 'Card note']],
      css: [
        rule('.jx-people',
          'display: grid;',
          'grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));',
          'gap: 12px;',
          'margin: 0 0 14px;'),
        rule('.jx-person',
          'display: flex;',
          'flex-direction: column;',
          'align-items: center;',
          'gap: 8px;',
          'padding: 20px 14px;',
          'border: 2px solid rgba(255, 255, 255, 0.14);',
          'border-radius: 8px;',
          'background: rgba(255, 255, 255, 0.04);',
          'color: inherit;',
          'text-align: center;',
          'text-decoration: none;',
          'transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;'),
        rule('.jx-person:hover', 'border-color: ' + ACCENT + ';', 'background: rgba(255, 255, 255, 0.08);', 'color: inherit;', 'transform: translateY(-4px);'),
        rule('.jx-person-orb',
          'display: block;',
          'width: 72px;',
          'height: 72px;',
          'overflow: hidden;',
          'border: 3px solid rgba(255, 255, 255, 0.85);',
          'border-radius: 50%;'),
        rule('.jx-person-img', 'display: block;', 'width: 100%;', 'height: 100%;', 'max-width: none;', 'object-fit: cover;'),
        rule('.jx-person-name', 'font-size: 15px;', 'font-weight: 900;', 'font-style: italic;', 'text-transform: uppercase;'),
        rule('.jx-person-note', 'font-size: 12px;', 'opacity: 0.6;')
      ]
    },
    {
      id: 'faq', name: 'Accordion', category: 'Layout', base: 'jx-faq',
      icon: icon('<rect x="2" y="3" width="12" height="3" rx="1"/><rect x="2" y="7.5" width="12" height="3" rx="1"/><path d="M2.5 13h11"/>'),
      html: '<div class="jx-faq {u}">' + [['A question people ask', 'The answer, hidden until they open it.'], ['Another one', 'Another answer.'], ['One more', 'And its answer.']].map(function (qa) {
        return '<details class="jx-faq-item {u}"><summary class="jx-faq-q {u}">' + qa[0] + '</summary><div class="jx-faq-a {u}">' + qa[1] + '</div></details>';
      }).join('') + '</div>',
      parts: [['jx-faq-item', 'Accordion item'], ['jx-faq-q', 'Question'], ['jx-faq-a', 'Answer']],
      css: [
        rule('.jx-faq', 'margin: 0 0 14px;'),
        rule('.jx-faq-item',
          'margin: 0 0 6px;',
          'border: 1px solid rgba(255, 255, 255, 0.14);',
          'border-radius: 8px;',
          'background: rgba(255, 255, 255, 0.04);'),
        rule('.jx-faq-q',
          'display: block;',
          'padding: 12px 16px;',
          'font-weight: 700;',
          'cursor: pointer;',
          'list-style: none;'),
        rule('.jx-faq-q::-webkit-details-marker', 'display: none;'),
        rule('.jx-faq-q::after', 'content: "+";', 'float: right;', 'color: ' + ACCENT + ';', 'font-weight: 900;'),
        rule('.jx-faq-item[open] .jx-faq-q::after', 'content: "–";'),
        rule('.jx-faq-a', 'padding: 0 16px 14px;', 'line-height: 1.6;', 'opacity: 0.85;')
      ]
    },
    {
      id: 'timeline', name: 'Timeline', category: 'Layout', base: 'jx-timeline',
      icon: icon('<path d="M5 2v12"/><circle cx="5" cy="4.5" r="1.3"/><circle cx="5" cy="10" r="1.3"/><path d="M8 4.5h5M8 10h5"/>'),
      html: '<div class="jx-timeline {u}">' + [['2024', 'Wrote the first bot.'], ['2025', 'Found the voice.'], ['Now', 'Still writing.']].map(function (row) {
        return '<div class="jx-event {u}"><b class="jx-event-date {u}">' + row[0] + '</b><span class="jx-event-text {u}">' + row[1] + '</span></div>';
      }).join('') + '</div>',
      parts: [['jx-event', 'Timeline event'], ['jx-event-date', 'Event date'], ['jx-event-text', 'Event text']],
      css: [
        rule('.jx-timeline',
          'margin: 0 0 14px;',
          'padding-left: 22px;',
          'border-left: 2px solid rgba(255, 255, 255, 0.18);'),
        rule('.jx-event', 'position: relative;', 'margin: 0 0 16px;'),
        rule('.jx-event::before',
          'content: "";',
          'position: absolute;',
          'top: 3px;',
          'left: -30px;',
          'width: 10px;',
          'height: 10px;',
          'border: 2px solid ' + ACCENT + ';',
          'border-radius: 50%;',
          'background: ' + INK + ';'),
        rule('.jx-event-date',
          'display: block;',
          'margin: 0 0 2px;',
          'color: ' + ACCENT + ';',
          'font-family: ' + MONO + ';',
          'font-size: 11px;',
          'letter-spacing: 0.18em;',
          'text-transform: uppercase;'),
        rule('.jx-event-text', 'display: block;', 'line-height: 1.5;')
      ]
    },
    {
      id: 'bars', name: 'Progress bars', category: 'Layout', base: 'jx-bars',
      icon: icon('<rect x="2" y="3" width="12" height="2.6" rx="1.3"/><rect x="2" y="6.7" width="12" height="2.6" rx="1.3"/><rect x="2" y="10.4" width="12" height="2.6" rx="1.3"/><path d="M3 4.3h7M3 8h4.5M3 11.7h8.5"/>'),
      hint: 'Each bar’s length is its fill’s width: select the fill and change it on the right.',
      html: '<div class="jx-bars {u}">' + [['Angst', '90%'], ['Comedy', '65%'], ['Romance', '40%']].map(function (row, i) {
        var t = '{t' + (i + 1) + '}';
        return '<div class="jx-bar {u}"><div class="jx-bar-head {u}"><span class="jx-bar-name {u}">' + row[0] + '</span>' +
          '<span class="jx-bar-pct {u}">' + row[1] + '</span></div>' +
          '<div class="jx-bar-track {u}"><div class="jx-bar-fill ' + t + '"></div></div></div>';
      }).join('') + '</div>',
      parts: [['jx-bar', 'Bar'], ['jx-bar-head', 'Bar label row'], ['jx-bar-name', 'Bar name'],
        ['jx-bar-pct', 'Bar value'], ['jx-bar-track', 'Bar track'], ['jx-bar-fill', 'Bar fill']],
      css: [
        rule('.jx-bars', 'max-width: 420px;', 'margin: 0 0 14px;'),
        rule('.jx-bar', 'margin: 0 0 12px;'),
        rule('.jx-bar-head',
          'display: flex;',
          'justify-content: space-between;',
          'margin: 0 0 5px;',
          'font-family: ' + MONO + ';',
          'font-size: 11px;',
          'font-weight: 700;',
          'letter-spacing: 0.14em;',
          'text-transform: uppercase;'),
        rule('.jx-bar-pct', 'color: ' + ACCENT + ';'),
        rule('.jx-bar-track', 'height: 10px;', 'overflow: hidden;', 'border-radius: 999px;', 'background: rgba(255, 255, 255, 0.1);'),
        // 22.63px is the horizontal period of these 45° stripes, so the slide loops without a jump.
        rule('.jx-bar-fill',
          'height: 100%;',
          'border-radius: 999px;',
          'background: repeating-linear-gradient(45deg, ' + ACCENT + ' 0 8px, #ff4d63 8px 16px);',
          'background-size: 22.63px 22.63px;',
          'animation: jx-bar-run 1.2s linear infinite;'),
        rule('.{t1}', 'width: 90%;'),
        rule('.{t2}', 'width: 65%;'),
        rule('.{t3}', 'width: 40%;'),
        still('.jx-bar-fill { animation: none; }')
      ],
      keyframes: [frames('jx-bar-run', '  to { background-position: 22.63px 0; }')]
    },

    // ----------------------------------------------------------------- Links
    {
      id: 'cta', name: 'Skew button', category: 'Links', base: 'jx-cta',
      icon: icon('<path d="M3.5 4.5h10l-1.5 7h-10z"/><path d="M7 6.5l2.5 1.5L7 9.5z"/>'),
      html: '<a class="jx-cta {u}" href="https://janitorai.com/">Start chat ▶</a>',
      css: [
        rule('.jx-cta',
          'position: relative;',
          'display: inline-block;',
          'overflow: hidden;',
          'margin: 0 12px 14px 0;',
          'padding: 14px 30px;',
          'border: 3px solid ' + INK + ';',
          'border-radius: 3px;',
          'background: ' + ACCENT + ';',
          'color: #ffffff;',
          'font-family: ' + DISPLAY + ';',
          'font-size: 16px;',
          'font-weight: 900;',
          'font-style: italic;',
          'text-decoration: none;',
          'text-transform: uppercase;',
          'box-shadow: 6px 6px 0 #ffffff;',
          'transform: skewX(-10deg);',
          'transition: transform 0.15s ease, box-shadow 0.15s ease;'),
        rule('.jx-cta::after',
          'content: "";',
          'position: absolute;',
          'top: 0;',
          'bottom: 0;',
          'left: -40%;',
          'width: 30%;',
          'background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);',
          'transform: skewX(-20deg);',
          'animation: jx-cta-shine 3.2s ease-in-out infinite;'),
        rule('.jx-cta:hover', 'color: #ffffff;', 'transform: skewX(-10deg) translate(-3px, -3px);', 'box-shadow: 9px 9px 0 #ffffff;'),
        still('.jx-cta::after { animation: none; }')
      ],
      keyframes: [frames('jx-cta-shine', '  0%, 55% { left: -40%; }\n  100% { left: 130%; }')]
    },
    {
      id: 'orbs', name: 'Social orbs', category: 'Links', base: 'jx-orbs',
      icon: icon('<circle cx="4.5" cy="8" r="2.5"/><circle cx="11.5" cy="8" r="2.5" stroke-dasharray="1.6 1.6"/>'),
      html: '<div class="jx-orbs {u}">' + [['DC', 'Discord'], ['X', 'Twitter'], ['KO', 'Ko-fi']].map(function (site) {
        return '<a class="jx-orb {u}" href="https://janitorai.com/"><span class="jx-orb-ring {u}">' + site[0] + '</span>' +
          '<b class="jx-orb-name {u}">' + site[1] + '</b></a>';
      }).join('') + '</div>',
      parts: [['jx-orb', 'Social orb'], ['jx-orb-ring', 'Orb'], ['jx-orb-name', 'Orb name']],
      css: [
        rule('.jx-orbs', 'display: flex;', 'flex-wrap: wrap;', 'gap: 24px;', 'margin: 0 0 14px;', 'padding: 8px 0 0;'),
        rule('.jx-orb',
          'display: flex;',
          'flex-direction: column;',
          'align-items: center;',
          'gap: 10px;',
          'color: inherit;',
          'text-decoration: none;'),
        rule('.jx-orb-ring',
          'position: relative;',
          'display: flex;',
          'align-items: center;',
          'justify-content: center;',
          'width: 64px;',
          'height: 64px;',
          'border: 3px solid rgba(255, 255, 255, 0.85);',
          'border-radius: 50%;',
          'background: rgba(255, 255, 255, 0.05);',
          'font-family: ' + DISPLAY + ';',
          'font-size: 18px;',
          'font-weight: 900;',
          'font-style: italic;',
          'transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.2s ease, color 0.2s ease, border-color 0.2s ease;'),
        // The dashed ring only shows, and only turns, while the orb is hovered.
        rule('.jx-orb-ring::after',
          'content: "";',
          'position: absolute;',
          'top: -9px;',
          'right: -9px;',
          'bottom: -9px;',
          'left: -9px;',
          'border: 2px dashed ' + ACCENT + ';',
          'border-radius: 50%;',
          'opacity: 0;',
          'transition: opacity 0.2s ease;',
          'animation: jx-orb-spin 6s linear infinite;'),
        rule('.jx-orb:hover', 'color: inherit;'),
        rule('.jx-orb:hover .jx-orb-ring',
          'border-color: ' + ACCENT + ';',
          'background: ' + ACCENT + ';',
          'color: #ffffff;',
          'transform: translateY(-5px) rotate(-8deg);'),
        rule('.jx-orb:hover .jx-orb-ring::after', 'opacity: 1;'),
        rule('.jx-orb-name', 'font-size: 12px;', 'font-weight: 900;', 'letter-spacing: 0.04em;', 'text-transform: uppercase;'),
        still('.jx-orb-ring::after { animation: none; }')
      ],
      keyframes: [frames('jx-orb-spin', '  to { transform: rotate(360deg); }')]
    },
    {
      id: 'status', name: 'Status chip', category: 'Links', base: 'jx-status',
      icon: icon('<rect x="1.5" y="4.5" width="13" height="7" rx="3.5"/><circle cx="5.5" cy="8" r="1.1"/>'),
      html: '<span class="jx-status {u}"><i class="jx-status-dot {u}"></i><span class="jx-status-text {u}">Online</span></span>',
      parts: [['jx-status-dot', 'Status dot'], ['jx-status-text', 'Status text']],
      css: [
        rule('.jx-status',
          'display: inline-flex;',
          'align-items: center;',
          'gap: 8px;',
          'margin: 0 8px 12px 0;',
          'padding: 6px 12px;',
          'border: 1px solid rgba(109, 255, 158, 0.4);',
          'border-radius: 999px;',
          'background: rgba(109, 255, 158, 0.08);',
          'color: #6dff9e;',
          'font-family: ' + MONO + ';',
          'font-size: 11px;',
          'font-weight: 700;',
          'letter-spacing: 0.14em;',
          'text-transform: uppercase;'),
        rule('.jx-status-dot',
          'display: block;',
          'width: 8px;',
          'height: 8px;',
          'border-radius: 50%;',
          'background: #6dff9e;',
          'box-shadow: 0 0 10px #6dff9e;',
          'animation: jx-status-blink 1.8s ease-in-out infinite;'),
        still('.jx-status-dot { animation: none; }')
      ],
      keyframes: [frames('jx-status-blink', '  0%, 100% { opacity: 1; }\n  50% { opacity: 0.25; }')]
    },
    {
      id: 'ribbon', name: 'Ribbon tag', category: 'Links', base: 'jx-ribbon',
      icon: icon('<path d="M2 4h12l-2.5 4L14 12H2z"/>'),
      html: '<span class="jx-ribbon {u}">New</span>',
      css: [rule('.jx-ribbon',
        'display: inline-block;',
        'margin: 0 8px 12px 0;',
        'padding: 6px 24px 6px 16px;',
        'background: ' + ACCENT + ';',
        'color: #ffffff;',
        'font-size: 12px;',
        'font-weight: 900;',
        'letter-spacing: 0.1em;',
        'text-transform: uppercase;',
        'clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 50%, 100% 100%, 0 100%);')]
    },

    // ---------------------------------------------------------------- Motion
    {
      id: 'tape', name: 'Marquee tape', category: 'Motion', base: 'jx-tape',
      icon: icon('<rect x="1.5" y="5.5" width="13" height="5" rx="1"/><path d="M4 8h2M8 8h4"/>'),
      hint: 'The text is written twice so the loop has no seam: edit both copies.',
      html: '<div class="jx-tape {u}"><div class="jx-tape-track {u}"><span class="jx-tape-text {u}">' + TAPE_TEXT +
        '</span><span class="jx-tape-text {u}">' + TAPE_TEXT + '</span></div></div>',
      parts: [['jx-tape-track', 'Tape track'], ['jx-tape-text', 'Tape text']],
      css: [
        rule('.jx-tape',
          'overflow: hidden;',
          'margin: 0 0 14px;',
          'border-top: 2px solid ' + INK + ';',
          'border-bottom: 2px solid ' + INK + ';',
          'background: ' + ACCENT + ';'),
        // Half the track is one copy of the text, so sliding by -50% lands on the same picture.
        rule('.jx-tape-track', 'display: flex;', 'width: max-content;', 'animation: jx-tape-run 30s linear infinite;'),
        rule('.jx-tape-text',
          'flex: 0 0 auto;',
          'padding: 8px 4px;',
          'color: #ffffff;',
          'font-family: ' + DISPLAY + ';',
          'font-size: 12px;',
          'font-weight: 900;',
          'font-style: italic;',
          'letter-spacing: 0.12em;',
          'white-space: nowrap;'),
        still('.jx-tape-track { animation: none; }')
      ],
      keyframes: [frames('jx-tape-run', '  from { transform: translateX(0); }\n  to { transform: translateX(-50%); }')]
    },
    {
      id: 'reel', name: 'Film reel', category: 'Motion', base: 'jx-reel',
      icon: icon('<rect x="1.5" y="3.5" width="13" height="9" rx="1"/><path d="M5.5 3.5v9M10.5 3.5v9M3.5 5.5v.1M3.5 8v.1M3.5 10.5v.1M12.5 5.5v.1M12.5 8v.1M12.5 10.5v.1"/>'),
      hint: 'Eight frames, listed twice for a seamless loop: swap the same picture in both halves. Hover to pause.',
      html: '<div class="jx-reel {u}"><div class="jx-reel-film {u}"><div class="jx-reel-track {u}">' + reelHalf() + reelHalf() + '</div></div></div>',
      parts: [['jx-reel-film', 'Film strip'], ['jx-reel-track', 'Film track'], ['jx-reel-frame', 'Film frame'], ['jx-reel-img', 'Film picture']],
      css: [
        rule('.jx-reel', 'position: relative;', 'overflow: hidden;', 'margin: 0 0 14px;', 'padding: 28px 0 34px;'),
        rule('.jx-reel-film',
          'position: relative;',
          'width: 108%;',
          'margin-left: -4%;',
          'border-top: 2px solid #26262f;',
          'border-bottom: 2px solid #26262f;',
          'background: #060608;',
          'box-shadow: 0 18px 34px rgba(0, 0, 0, 0.7);',
          'transform: rotate(-2.5deg);'),
        // The sprocket holes are painted on the moving track. A frame is 140px, five 28px
        // hole periods, so the loop at -50% lands on the same pattern and never jumps.
        rule('.jx-reel-track',
          'display: flex;',
          'width: max-content;',
          'padding: 24px 0;',
          'background: repeating-linear-gradient(90deg, #d8d5cb 0 12px, transparent 12px 28px) 0 7px / 100% 9px no-repeat, repeating-linear-gradient(90deg, #d8d5cb 0 12px, transparent 12px 28px) 0 calc(100% - 7px) / 100% 9px no-repeat;',
          'animation: jx-reel-run 40s linear infinite;'),
        rule('.jx-reel:hover .jx-reel-track', 'animation-play-state: paused;'),
        rule('.jx-reel-frame', 'flex: 0 0 140px;', 'padding: 0 6px;'),
        rule('.jx-reel-img',
          'display: block;',
          'width: 100%;',
          'height: 108px;',
          'max-width: none;',
          'border-radius: 3px;',
          'background: #e9e6dc;',
          'object-fit: cover;'),
        still('.jx-reel-track { animation: none; }')
      ],
      keyframes: [frames('jx-reel-run', '  from { transform: translateX(0); }\n  to { transform: translateX(-50%); }')]
    },
    {
      id: 'typewriter', name: 'Typewriter', category: 'Motion', base: 'jx-type',
      icon: icon('<path d="M2 5h8M2 9h5"/><path d="M12 4v8"/>'),
      hint: 'It is sized for 40 characters. If you retype it, set the width (in ch) to the new length.',
      html: '<p class="jx-type {u}">Typed out, one letter at a time, always.</p>',
      css: [
        rule('.jx-type',
          'display: block;',
          'width: 40ch;',
          'max-width: 100%;',
          'margin: 0 0 14px;',
          'overflow: hidden;',
          'border-right: 3px solid ' + ACCENT + ';',
          'font-family: ' + MONO + ';',
          'font-size: 16px;',
          'white-space: nowrap;',
          'animation: jx-type-write 6s steps(40, end) infinite, jx-type-caret 0.8s step-end infinite;'),
        still('.jx-type { width: auto; animation: none; }')
      ],
      keyframes: [
        frames('jx-type-write', '  0% { width: 0; }\n  55%, 100% { width: 40ch; }'),
        frames('jx-type-caret', '  50% { border-color: transparent; }')
      ]
    },
    {
      id: 'glitch', name: 'Glitch title', category: 'Motion', base: 'jx-glitch',
      icon: icon('<path d="M3 5h8M5 8h8M3 11h7"/>'),
      html: '<h2 class="jx-glitch {u}">Glitch title</h2>',
      css: [
        rule('.jx-glitch',
          'margin: 0 0 14px;',
          'color: #ffffff;',
          'font-family: ' + DISPLAY + ';',
          'font-size: 40px;',
          'font-weight: 900;',
          'letter-spacing: -0.03em;',
          'text-transform: uppercase;',
          'text-shadow: 2px 0 #ff2a4d, -2px 0 #2ad4ff;',
          'animation: jx-glitch-shake 3s steps(1, end) infinite;'),
        still('.jx-glitch { animation: none; }')
      ],
      keyframes: [frames('jx-glitch-shake',
        '  0%, 86%, 100% { text-shadow: 2px 0 #ff2a4d, -2px 0 #2ad4ff; transform: none; }\n' +
        '  88% { text-shadow: -5px 0 #ff2a4d, 5px 0 #2ad4ff; transform: translateX(-2px) skewX(6deg); }\n' +
        '  90% { text-shadow: 6px 2px #ff2a4d, -6px -2px #2ad4ff; transform: translateX(3px); }\n' +
        '  92% { text-shadow: -3px -1px #ff2a4d, 3px 1px #2ad4ff; transform: skewX(-8deg); }\n' +
        '  94% { text-shadow: 4px 0 #ff2a4d, -4px 0 #2ad4ff; transform: translateX(-1px); }')]
    },
    {
      id: 'shimmer', name: 'Shimmer title', category: 'Motion', base: 'jx-shimmer',
      icon: icon('<path d="M8 2l1.2 4.8L14 8l-4.8 1.2L8 14l-1.2-4.8L2 8l4.8-1.2z"/>'),
      html: '<h2 class="jx-shimmer {u}">Shimmer title</h2>',
      css: [
        // The gradient starts and ends on the same colour and is twice the text's width,
        // so sliding it by one tile (200%) is invisible at the loop point.
        rule('.jx-shimmer',
          'margin: 0 0 14px;',
          'color: transparent;',
          'font-size: 40px;',
          'font-weight: 900;',
          'letter-spacing: -0.02em;',
          'background: linear-gradient(90deg, ' + ACCENT + ' 0%, #ff9aa8 25%, #ffffff 50%, #ff9aa8 75%, ' + ACCENT + ' 100%);',
          'background-size: 200% 100%;',
          '-webkit-background-clip: text;',
          'background-clip: text;',
          '-webkit-text-fill-color: transparent;',
          'animation: jx-shimmer-run 3s linear infinite;'),
        still('.jx-shimmer { animation: none; }')
      ],
      keyframes: [frames('jx-shimmer-run', '  from { background-position: 0% 0; }\n  to { background-position: 200% 0; }')]
    },
    {
      id: 'neon', name: 'Neon sign', category: 'Motion', base: 'jx-neon',
      icon: icon('<path d="M8 2.5a4 4 0 00-2.2 7.3c.4.4.7.8.7 1.4V12h3v-.8c0-.6.3-1 .7-1.4A4 4 0 008 2.5zM6.5 14h3"/>'),
      html: '<h2 class="jx-neon {u}">Neon sign</h2>',
      css: [
        rule('.jx-neon',
          'margin: 0 0 14px;',
          'color: #ffe9ec;',
          'font-size: 42px;',
          'font-weight: 800;',
          'letter-spacing: 0.06em;',
          'text-transform: uppercase;',
          'text-shadow: 0 0 4px #ffffff, 0 0 12px #ff2a4d, 0 0 26px #ff2a4d, 0 0 48px ' + ACCENT + ';',
          'animation: jx-neon-flicker 4s linear infinite;'),
        still('.jx-neon { animation: none; }')
      ],
      keyframes: [frames('jx-neon-flicker',
        '  0%, 18%, 22%, 25%, 53%, 57%, 100% { opacity: 1; text-shadow: 0 0 4px #ffffff, 0 0 12px #ff2a4d, 0 0 26px #ff2a4d, 0 0 48px #e11d36; }\n' +
        '  20%, 24%, 55% { opacity: 0.55; text-shadow: 0 0 2px #ffffff, 0 0 6px #ff2a4d; }')]
    },
    {
      id: 'flip', name: 'Flip card', category: 'Motion', base: 'jx-flip',
      icon: icon('<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M8 3v10" stroke-dasharray="1.5 1.5"/>'),
      hint: 'Hover it in Preview mode to turn it over.',
      html: '<div class="jx-flip {u}"><div class="jx-flip-inner {u}"><div class="jx-flip-front {u}">' +
        '<h3 class="jx-flip-title {u}">Hover me</h3></div><div class="jx-flip-back {u}">' +
        '<p class="jx-flip-text {u}">The other side of the card.</p></div></div></div>',
      parts: [['jx-flip-inner', 'Flip card turner'], ['jx-flip-front', 'Card front'], ['jx-flip-back', 'Card back'],
        ['jx-flip-title', 'Card title'], ['jx-flip-text', 'Card text']],
      css: [
        rule('.jx-flip', 'width: 240px;', 'height: 150px;', 'margin: 0 0 14px;', 'perspective: 800px;'),
        rule('.jx-flip-inner',
          'position: relative;',
          'width: 100%;',
          'height: 100%;',
          'transform-style: preserve-3d;',
          'transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);'),
        rule('.jx-flip:hover .jx-flip-inner', 'transform: rotateY(180deg);'),
        rule('.jx-flip-front, .jx-flip-back',
          'position: absolute;',
          'top: 0;',
          'left: 0;',
          'display: flex;',
          'align-items: center;',
          'justify-content: center;',
          'width: 100%;',
          'height: 100%;',
          'padding: 16px;',
          'border: 2px solid rgba(255, 255, 255, 0.18);',
          'border-radius: 12px;',
          'box-sizing: border-box;',
          'text-align: center;',
          '-webkit-backface-visibility: hidden;',
          'backface-visibility: hidden;'),
        rule('.jx-flip-front', 'background: rgba(255, 255, 255, 0.06);'),
        rule('.jx-flip-back', 'background: ' + ACCENT + ';', 'color: #ffffff;', 'transform: rotateY(180deg);'),
        rule('.jx-flip-title, .jx-flip-text', 'margin: 0;', 'font-weight: 800;')
      ]
    }
  ];

  B.register(BLOCKS);

  // -------------------------------------------------------------- animations
  //
  // More motions to give to whatever is selected. Same shape as js/blocks.js:
  // one `animation` value, and the @keyframes it names added on first use.

  B.animations.push(
    { id: 'bounce', name: 'Bounce', key: 'jx-bounce', value: 'jx-bounce 1.4s ease-in-out infinite',
      keyframes: '@keyframes jx-bounce {\n  0%, 100% { transform: translateY(0); }\n  40% { transform: translateY(-14px); }\n  60% { transform: translateY(-5px); }\n}',
      icon: icon('<circle cx="8" cy="5" r="2.5"/><path d="M4 13.5h8"/>') },
    { id: 'shake', name: 'Shake', key: 'jx-shake', value: 'jx-shake 2.4s linear infinite',
      keyframes: '@keyframes jx-shake {\n  0%, 60%, 100% { transform: translateX(0); }\n  10%, 30%, 50% { transform: translateX(-4px); }\n  20%, 40% { transform: translateX(4px); }\n}',
      icon: icon('<path d="M3 4.5v7M6 3v10M10 3v10M13 4.5v7"/>') },
    { id: 'heartbeat', name: 'Heartbeat', key: 'jx-heartbeat', value: 'jx-heartbeat 1.6s ease-in-out infinite',
      keyframes: '@keyframes jx-heartbeat {\n  0%, 40%, 100% { transform: scale(1); }\n  15% { transform: scale(1.14); }\n  30% { transform: scale(1.06); }\n}',
      icon: icon('<path d="M2 8h3l1.5-3.5 3 7L11 8h3"/>') },
    { id: 'flicker', name: 'Flicker', key: 'jx-flicker', value: 'jx-flicker 3s linear infinite',
      keyframes: '@keyframes jx-flicker {\n  0%, 19%, 21%, 62%, 64%, 100% { opacity: 1; }\n  20%, 63% { opacity: 0.35; }\n  22% { opacity: 0.8; }\n}',
      icon: icon('<path d="M9 2L4.5 9H8l-1 5 4.5-7H8z"/>') },
    { id: 'rainbow', name: 'Rainbow', key: 'jx-rainbow', value: 'jx-rainbow 8s linear infinite',
      keyframes: '@keyframes jx-rainbow {\n  to { filter: hue-rotate(360deg); }\n}',
      icon: icon('<path d="M2.5 12a5.5 5.5 0 0111 0M5 12a3 3 0 016 0"/>') },
    { id: 'sway', name: 'Sway', key: 'jx-sway', value: 'jx-sway 3s ease-in-out infinite',
      keyframes: '@keyframes jx-sway {\n  0%, 100% { transform-origin: top center; transform: rotate(-5deg); }\n  50% { transform-origin: top center; transform: rotate(5deg); }\n}',
      icon: icon('<path d="M8 2v3M4 13a4 4 0 018 0z"/>') },
    { id: 'zoom-in', name: 'Zoom in', key: 'jx-zoom-in', value: 'jx-zoom-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      keyframes: '@keyframes jx-zoom-in {\n  from { opacity: 0; transform: scale(0.7); }\n  to { opacity: 1; transform: scale(1); }\n}',
      icon: icon('<rect x="5" y="5" width="6" height="6" rx="1"/><path d="M2 2h3M2 2v3M14 2h-3M14 2v3M2 14h3M2 14v-3M14 14h-3M14 14v-3"/>') },
    { id: 'flip-in', name: 'Flip in', key: 'jx-flip-in', value: 'jx-flip-in 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      keyframes: '@keyframes jx-flip-in {\n  from { opacity: 0; transform: perspective(600px) rotateX(-80deg); }\n  to { opacity: 1; transform: perspective(600px) rotateX(0deg); }\n}',
      icon: icon('<path d="M3 5l10 0M4.5 5l-1.5 8h10L11.5 5"/>') }
  );
})(window);
