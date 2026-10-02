/*
 * The Insert panel's catalogue: ready-made elements a creator can drag onto
 * the canvas instead of typing the markup.
 *
 * Each block is markup plus the few rules that give it a sensible starting
 * look. Two classes go on every element it creates:
 *
 *   - a shared one (`jx-heading`), which the block's own rules are written
 *     against and which is only added to the stylesheet once, and
 *   - a unique one (`jx-k3f9`), which is what the properties panel styles by
 *     default — so restyling one heading does not restyle every heading.
 *
 * Everything here has to survive JanitorAI: no `<button>`, `<svg>`, `<label>`
 * or `<input>`, no `url()`, no custom properties, `gap` rather than
 * `column-gap` (see js/lint.js). Multi-element blocks are written back to
 * back, because a newline between inline siblings renders as a visible gap.
 */
(function (global) {
  'use strict';

  /* Icons for the studio's own UI. 16×16, stroked with currentColor. */
  function icon(paths) {
    return '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" ' +
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  var PLACEHOLDER_IMAGE = 'https://picsum.photos/seed/janitor/640/360';

  var BLOCKS = [
    {
      id: 'heading', name: 'Heading', category: 'Text', base: 'jx-heading',
      icon: icon('<path d="M3 3v10M10 3v10M3 8h7M13 6.5V13"/>'),
      html: '<h2 class="jx-heading {u}">Heading</h2>',
      css: [['.jx-heading', 'margin: 0 0 8px;\n  font-size: 26px;\n  font-weight: 700;\n  line-height: 1.2;']]
    },
    {
      id: 'text', name: 'Text', category: 'Text', base: 'jx-text',
      icon: icon('<path d="M3 4h10M3 8h10M3 12h6"/>'),
      html: '<p class="jx-text {u}">Write something about yourself here. Double-click to edit.</p>',
      css: [['.jx-text', 'margin: 0 0 12px;\n  line-height: 1.6;']]
    },
    {
      id: 'label', name: 'Small label', category: 'Text', base: 'jx-label',
      icon: icon('<path d="M2.5 6h11M2.5 10h7"/>'),
      html: '<div class="jx-label {u}">Small label</div>',
      css: [['.jx-label', 'margin: 0 0 6px;\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  opacity: 0.7;']]
    },
    {
      id: 'quote', name: 'Quote', category: 'Text', base: 'jx-quote',
      icon: icon('<path d="M3 5.5h3v3H3zM3 8.5c0 2 1 3 2.5 3M9 5.5h3v3H9zM9 8.5c0 2 1 3 2.5 3"/>'),
      html: '<blockquote class="jx-quote {u}">“A line worth remembering.”</blockquote>',
      css: [['.jx-quote', 'margin: 0 0 12px;\n  padding: 8px 14px;\n  border-left: 3px solid rgba(255, 255, 255, 0.35);\n  font-style: italic;\n  line-height: 1.6;']]
    },
    {
      id: 'list', name: 'List', category: 'Text', base: 'jx-list',
      icon: icon('<path d="M6 4h7M6 8h7M6 12h7"/><circle cx="3" cy="4" r=".6"/><circle cx="3" cy="8" r=".6"/><circle cx="3" cy="12" r=".6"/>'),
      html: '<ul class="jx-list {u}"><li>First thing</li><li>Second thing</li><li>Third thing</li></ul>',
      css: [['.jx-list', 'margin: 0 0 12px;\n  padding-left: 20px;\n  line-height: 1.7;']]
    },
    {
      id: 'image', name: 'Image', category: 'Media', base: 'jx-image',
      icon: icon('<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1"/><path d="M2.5 11.5l3.5-3 2.5 2 2-1.5 3 2.5"/>'),
      html: '<img class="jx-image {u}" src="' + PLACEHOLDER_IMAGE + '" alt="">',
      css: [['.jx-image', 'display: block;\n  max-width: 100%;\n  height: auto;\n  margin: 0 0 12px;\n  border-radius: 10px;']]
    },
    {
      id: 'divider', name: 'Divider', category: 'Media', base: 'jx-divider',
      icon: icon('<path d="M2 8h12"/>'),
      html: '<hr class="jx-divider {u}">',
      css: [['.jx-divider', 'height: 1px;\n  margin: 16px 0;\n  border: 0;\n  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);']]
    },
    {
      id: 'spacer', name: 'Spacer', category: 'Media', base: 'jx-spacer',
      icon: icon('<path d="M3 3h10M3 13h10M8 5.5v5M6.5 7L8 5.5 9.5 7M6.5 9L8 10.5 9.5 9"/>'),
      html: '<div class="jx-spacer {u}"></div>',
      css: [['.jx-spacer', 'height: 24px;']]
    },
    {
      id: 'box', name: 'Box', category: 'Layout', base: 'jx-box',
      icon: icon('<rect x="2.5" y="2.5" width="11" height="11" rx="2"/>'),
      html: '<div class="jx-box {u}"></div>',
      css: [['.jx-box', 'min-height: 48px;\n  margin: 0 0 12px;\n  padding: 16px;\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  border-radius: 12px;\n  background: rgba(255, 255, 255, 0.04);']]
    },
    {
      id: 'row', name: 'Two columns', category: 'Layout', base: 'jx-row',
      icon: icon('<rect x="2" y="3" width="5" height="10" rx="1.2"/><rect x="9" y="3" width="5" height="10" rx="1.2"/>'),
      html: '<div class="jx-row {u}"><div class="jx-col {u}"></div><div class="jx-col {u}"></div></div>',
      css: [
        ['.jx-row', 'display: flex;\n  gap: 12px;\n  margin: 0 0 12px;'],
        ['.jx-col', 'flex: 1 1 0;\n  min-width: 0;\n  min-height: 48px;']
      ]
    },
    {
      id: 'grid', name: 'Grid', category: 'Layout', base: 'jx-grid',
      icon: icon('<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>'),
      html: '<div class="jx-grid {u}"><div class="jx-cell {u}"></div><div class="jx-cell {u}"></div><div class="jx-cell {u}"></div></div>',
      css: [
        ['.jx-grid', 'display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 12px;\n  margin: 0 0 12px;'],
        ['.jx-cell', 'min-height: 64px;\n  padding: 12px;\n  border-radius: 10px;\n  background: rgba(255, 255, 255, 0.05);']
      ]
    },
    {
      id: 'card', name: 'Card', category: 'Layout', base: 'jx-card',
      icon: icon('<rect x="2.5" y="2" width="11" height="12" rx="1.8"/><path d="M2.5 8h11M5 10.5h6"/>'),
      html: '<div class="jx-card {u}"><img class="jx-card-image {u}" src="' + PLACEHOLDER_IMAGE + '" alt="">' +
        '<div class="jx-card-body {u}"><h3 class="jx-card-title {u}">Card title</h3>' +
        '<p class="jx-card-text {u}">A short description goes here.</p></div></div>',
      css: [
        ['.jx-card', 'overflow: hidden;\n  max-width: 320px;\n  margin: 0 0 12px;\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  border-radius: 14px;\n  background: rgba(255, 255, 255, 0.04);'],
        ['.jx-card-image', 'display: block;\n  width: 100%;\n  height: 160px;\n  object-fit: cover;'],
        ['.jx-card-body', 'padding: 14px 16px 16px;'],
        ['.jx-card-title', 'margin: 0 0 6px;\n  font-size: 18px;\n  font-weight: 700;'],
        ['.jx-card-text', 'margin: 0;\n  line-height: 1.55;\n  opacity: 0.8;']
      ]
    },
    {
      id: 'collapsible', name: 'Collapsible', category: 'Layout', base: 'jx-details',
      icon: icon('<path d="M3 4.5h10M3 8h10M5.5 11l2.5 2 2.5-2"/>'),
      html: '<details class="jx-details {u}"><summary class="jx-summary {u}">Click to open</summary>' +
        '<div class="jx-details-body {u}">Hidden until someone opens it.</div></details>',
      css: [
        ['.jx-details', 'margin: 0 0 12px;\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  border-radius: 10px;\n  background: rgba(255, 255, 255, 0.04);'],
        ['.jx-summary', 'padding: 10px 14px;\n  font-weight: 600;\n  cursor: pointer;'],
        ['.jx-details-body', 'padding: 0 14px 12px;\n  line-height: 1.6;']
      ]
    },
    {
      id: 'button', name: 'Button', category: 'Links', base: 'jx-button',
      icon: icon('<rect x="1.5" y="4.5" width="13" height="7" rx="3.5"/><path d="M5.5 8h5"/>'),
      html: '<a class="jx-button {u}" href="https://janitorai.com/">Button</a>',
      css: [
        ['.jx-button', 'display: inline-block;\n  padding: 9px 18px;\n  border-radius: 999px;\n  background: #e11d36;\n  color: #ffffff;\n  font-weight: 600;\n  text-decoration: none;\n  transition: filter 0.2s ease;'],
        // `a:hover` on JanitorAI recolours every link, and outranks a plain class.
        ['.jx-button:hover', 'color: #ffffff;\n  filter: brightness(1.15);']
      ]
    },
    {
      id: 'links', name: 'Link row', category: 'Links', base: 'jx-links',
      icon: icon('<rect x="1.5" y="5.5" width="5.5" height="5" rx="2.5"/><rect x="9" y="5.5" width="5.5" height="5" rx="2.5"/>'),
      html: '<div class="jx-links {u}"><a class="jx-chip {u}" href="https://discord.gg/">Discord</a>' +
        '<a class="jx-chip {u}" href="https://x.com/">Twitter</a>' +
        '<a class="jx-chip {u}" href="https://ko-fi.com/">Ko-fi</a></div>',
      css: [
        ['.jx-links', 'display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  margin: 0 0 12px;'],
        ['.jx-chip', 'padding: 6px 14px;\n  border: 1px solid rgba(255, 255, 255, 0.22);\n  border-radius: 999px;\n  color: inherit;\n  font-size: 13px;\n  text-decoration: none;'],
        ['.jx-chip:hover', 'background: rgba(255, 255, 255, 0.1);\n  color: inherit;']
      ]
    },
    {
      id: 'tags', name: 'Tags', category: 'Links', base: 'jx-tags',
      icon: icon('<path d="M2 8.5V3h5.5l6 6-5.5 5.5z"/><circle cx="5" cy="6" r=".8"/>'),
      html: '<div class="jx-tags {u}"><span class="jx-tag {u}">Fluff</span>' +
        '<span class="jx-tag {u}">Angst</span><span class="jx-tag {u}">Slow burn</span></div>',
      css: [
        ['.jx-tags', 'display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  margin: 0 0 12px;'],
        ['.jx-tag', 'padding: 3px 10px;\n  border-radius: 6px;\n  background: rgba(255, 255, 255, 0.1);\n  font-size: 12px;']
      ]
    }
  ];

  /* Shapes: empty boxes given a form by CSS alone — `<svg>` is stripped, so
   * anything that is not a rectangle comes from border-radius or clip-path.
   * They share `jx-shape` (size, fill) and add their own form on top. */
  var SHAPE_BASE = ['.jx-shape', 'width: 96px;\n  height: 96px;\n  margin: 0 0 12px;\n  background: #e5364a;'];

  function shape(id, name, glyph, cls, rules) {
    return {
      id: id, name: name, category: 'Shapes', base: cls,
      icon: icon(glyph),
      html: '<div class="' + cls + ' jx-shape {u}"></div>',
      css: [SHAPE_BASE, ['.' + cls, rules]]
    };
  }

  BLOCKS.push(
    shape('rectangle', 'Rectangle', '<rect x="2" y="4" width="12" height="8" rx="1"/>', 'jx-rect',
      'width: 160px;\n  border-radius: 8px;'),
    shape('circle', 'Circle', '<circle cx="8" cy="8" r="5.5"/>', 'jx-circle',
      'border-radius: 50%;'),
    shape('pill', 'Pill', '<rect x="1.5" y="5" width="13" height="6" rx="3"/>', 'jx-pill',
      'width: 160px;\n  height: 44px;\n  border-radius: 999px;'),
    shape('triangle', 'Triangle', '<path d="M8 3l5.5 10h-11z"/>', 'jx-triangle',
      'clip-path: polygon(50% 0, 100% 100%, 0 100%);'),
    shape('diamond', 'Diamond', '<path d="M8 2l6 6-6 6-6-6z"/>', 'jx-diamond',
      'clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);'),
    shape('star', 'Star', '<path d="M8 2l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.4 4.3 13.5l.8-4.2L2 6.4l4.2-.5z"/>', 'jx-star',
      'clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);')
  );

  /*
   * Animations are not things to drag in but motions to give to whatever is
   * selected: one `animation` declaration on the element's rule, plus the
   * @keyframes it names, added to the stylesheet the first time it is used.
   */
  var ANIMATIONS = [
    { id: 'fade-in', name: 'Fade in', key: 'jx-fade-in', value: 'jx-fade-in 0.8s ease both',
      keyframes: '@keyframes jx-fade-in {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}',
      icon: icon('<circle cx="8" cy="8" r="5.5" stroke-dasharray="2 2.4"/>') },
    { id: 'slide-up', name: 'Slide up', key: 'jx-slide-up', value: 'jx-slide-up 0.7s ease both',
      keyframes: '@keyframes jx-slide-up {\n  from { opacity: 0; transform: translateY(18px); }\n  to { opacity: 1; transform: translateY(0); }\n}',
      icon: icon('<path d="M8 13V4M4.5 7.5L8 4l3.5 3.5"/>') },
    { id: 'float', name: 'Float', key: 'jx-float', value: 'jx-float 3.5s ease-in-out infinite',
      keyframes: '@keyframes jx-float {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(-8px); }\n}',
      icon: icon('<path d="M2 10c2-3 4-3 6 0s4 3 6 0M2 6c2-3 4-3 6 0s4 3 6 0"/>') },
    { id: 'pulse', name: 'Pulse', key: 'jx-pulse', value: 'jx-pulse 2s ease-in-out infinite',
      keyframes: '@keyframes jx-pulse {\n  0%, 100% { transform: scale(1); }\n  50% { transform: scale(1.05); }\n}',
      icon: icon('<circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r="5.5"/>') },
    { id: 'glow', name: 'Glow', key: 'jx-glow', value: 'jx-glow 2.4s ease-in-out infinite',
      keyframes: '@keyframes jx-glow {\n  0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 255, 255, 0)); }\n  50% { filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.75)); }\n}',
      icon: icon('<circle cx="8" cy="8" r="3"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/>') },
    { id: 'spin', name: 'Spin', key: 'jx-spin', value: 'jx-spin 6s linear infinite',
      keyframes: '@keyframes jx-spin {\n  to { transform: rotate(360deg); }\n}',
      icon: icon('<path d="M13 8a5 5 0 11-1.5-3.5M13 3v2.5h-2.5"/>') },
    { id: 'wiggle', name: 'Wiggle', key: 'jx-wiggle', value: 'jx-wiggle 1.6s ease-in-out infinite',
      keyframes: '@keyframes jx-wiggle {\n  0%, 100% { transform: rotate(-2deg); }\n  50% { transform: rotate(2deg); }\n}',
      icon: icon('<path d="M2 8c1.5-4 3-4 4.5 0s3 4 4.5 0 2-3 3-1"/>') },
    { id: 'blink', name: 'Blink', key: 'jx-blink', value: 'jx-blink 1.2s steps(2, jump-none) infinite',
      keyframes: '@keyframes jx-blink {\n  from { opacity: 1; }\n  to { opacity: 0.25; }\n}',
      icon: icon('<path d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4z"/><circle cx="8" cy="8" r="1.5"/>') }
  ];

  var byId = {};
  var names = {};
  names['jx-shape'] = 'Shape';

  function nameBlock(block) {
    byId[block.id] = block;
    names[block.base] = block.name;
    // The pieces inside a multi-part block get names too, for the Layers panel
    // — and a named class is a shared one, so a first edit is written against
    // the element's own class instead (see defaultTarget in js/canvas.js).
    (block.parts || []).forEach(function (pair) { names[pair[0]] = pair[1]; });
  }
  BLOCKS.forEach(nameBlock);
  [['jx-col', 'Column'], ['jx-cell', 'Cell'], ['jx-card-image', 'Card image'],
   ['jx-card-body', 'Card body'], ['jx-card-title', 'Card title'], ['jx-card-text', 'Card text'],
   ['jx-summary', 'Summary'], ['jx-details-body', 'Collapsible body'], ['jx-chip', 'Link chip'],
   ['jx-tag', 'Tag']].forEach(function (pair) { names[pair[0]] = pair[1]; });

  /* More catalogue entries, added by the files that load after this one. */
  function register(blocks) {
    blocks.forEach(function (block) {
      BLOCKS.push(block);
      nameBlock(block);
    });
  }

  /*
   * Tokens are `{t1}`, `{t2}`… in a block's markup and rules. Each one becomes
   * one fresh instance class (`jx-k3f9`) shared by every place it appears in
   * that instance — which is how an `id` and the `:target` rule that reads it,
   * or a progress bar and its width, stay paired. Being an instance class, it
   * is also what the properties panel treats as "this element's own rules".
   */
  function tokens(block, payload) {
    var found = (block.html + JSON.stringify(block.css || [])).match(/\{t\d+\}/g) || [];
    var out = {};
    var taken = payload;
    found.forEach(function (token) {
      if (out[token]) return;
      out[token] = global.JaiMarkup.uniqueClass(taken);
      taken += ' ' + out[token];
    });
    return out;
  }

  function fill(text, given) {
    return text.replace(/\{t\d+\}/g, function (token) { return (given && given[token]) || token; });
  }

  /* Markup for one new instance, with a fresh unique class on every element. */
  function instantiate(block, payload, given) {
    var taken = payload + ' ' + Object.keys(given || {}).map(function (k) { return given[k]; }).join(' ');
    return fill(block.html, given).replace(/\{u\}/g, function () {
      var cls = global.JaiMarkup.uniqueClass(taken);
      taken += ' ' + cls;
      return cls;
    });
  }

  function separator(css) {
    return css && !/\n\s*$/.test(css) ? '\n\n' : (css.trim() ? '\n' : '');
  }

  /*
   * Adds the block's starting rules to a stylesheet, skipping any selector
   * that already has a rule — including one the creator has since edited.
   * A rule whose selector starts with `@` wraps its body (whole rules) in that
   * at-rule, and `keyframes` are added once under their own names.
   */
  function addCss(css, block, given) {
    var out = css;
    (block.css || []).forEach(function (rule) {
      var selector = fill(rule[0], given);
      var body = fill(rule[1], given);
      if (selector.charAt(0) === '@') {
        var wrapped = selector + ' {\n  ' + body + '\n}\n';
        if (out.indexOf(wrapped.slice(0, -2)) !== -1) return;
        out += separator(out) + wrapped;
        return;
      }
      if (global.CssModel.findRule(out, selector)) return;
      out += separator(out) + selector + ' {\n  ' + body + '\n}\n';
    });
    (block.keyframes || []).forEach(function (frames) {
      if (out.indexOf('@keyframes ' + frames[0] + ' ') !== -1) return;
      out += separator(out) + frames[1] + '\n';
    });
    return out;
  }

  global.JaiBlocks = {
    list: BLOCKS,
    get: function (id) { return byId[id] || null; },
    names: names,
    animations: ANIMATIONS,
    placeholderImage: PLACEHOLDER_IMAGE,
    register: register,
    tokens: tokens,
    instantiate: instantiate,
    addCss: addCss,
    icon: icon
  };
})(window);
