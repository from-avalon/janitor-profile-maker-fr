/*
 * Page layout: where the two big blocks of a JanitorAI profile sit.
 *
 * JanitorAI lays its profile page out as one flex row (`.profile-page-flex`)
 * holding two blocks: the profile box — avatar, name, and the About Me text
 * inside it — and the character list. Moving them around means knowing that,
 * plus a handful of `!important` declarations. This file is what spares the
 * creator that: a model of the layout, the CSS it turns into, and every way of
 * changing it (preset tiles, the grip and gutter drawn on the canvas by
 * preview/frame.js, the right-click menu, dragging rows in Layers).
 *
 * The layout is written as one block the studio owns, between two CSS
 * comments — `@jai:layout:start {…}` and `@jai:layout:end` — with the model
 * itself, as JSON, in the opening one and the rules in between.
 *
 * Every change rewrites that block from the model in a single edit, so a
 * preset is one Ctrl+Z, applying the same one twice changes nothing, and
 * going back to the default removes the block altogether. It sits after
 * everything else and is all `!important`, because the templates' own rules
 * for these containers are (`.profile-page-flex { display: block !important }`)
 * and a layout that lost to them would do nothing.
 *
 * "Side by side" is scoped to JanitorAI's own desktop breakpoint (62em), where
 * the site itself switches from stacked to a row. Writing a bare
 * `flex-direction: row` would squeeze phones into two columns.
 */
(function () {
  'use strict';

  var S = window.JaiStudio;

  var WRAP = '.profile-page-flex';
  var SECTIONS = {
    profile: { selector: '.pp-uc-background', name: 'Profile box' },
    characters: { selector: '.profile-page-container-flex-box', name: 'Characters' }
  };
  var DEFAULT = { direction: 'row', first: 'profile', split: null, gap: null };
  var DESKTOP = '@media screen and (min-width: 62em)';
  var WORDS = { top: 'above', bottom: 'below', left: 'to the left of', right: 'to the right of' };

  var BLOCK = /\s*\/\* @jai:layout:start (\{[^}]*\}) \*\/[\s\S]*?\/\* @jai:layout:end \*\/\n?/;
  var BLOCKS = new RegExp(BLOCK.source, 'g');

  var PRESETS = [
    { id: 'side', label: 'Side by side', direction: 'row', first: 'profile', hint: 'Profile box on the left, characters on the right: how JanitorAI lays it out.' },
    { id: 'side-swap', label: 'Swap sides', direction: 'row', first: 'characters', hint: 'Characters on the left, profile box on the right.' },
    { id: 'stack', label: 'Profile on top', direction: 'column', first: 'profile', hint: 'Both full width, About Me across the whole top and the characters underneath.' },
    { id: 'stack-swap', label: 'Characters on top', direction: 'column', first: 'characters', hint: 'Both full width, the characters first and the profile box underneath.' }
  ];

  // ------------------------------------------------------------------- model

  function other(section) { return section === 'profile' ? 'characters' : 'profile'; }

  function clone(layout) {
    return { direction: layout.direction, first: layout.first, split: layout.split, gap: layout.gap };
  }

  function number(value, min, max) {
    var n = typeof value === 'number' ? value : parseFloat(value);
    if (!isFinite(n)) return null;
    return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
  }

  function normalise(layout) {
    var direction = layout && layout.direction === 'column' ? 'column' : 'row';
    return {
      direction: direction,
      first: layout && layout.first === 'characters' ? 'characters' : 'profile',
      // The split is a share of the row, so it only means something in one.
      split: direction === 'row' ? number(layout && layout.split, 20, 80) : null,
      gap: number(layout && layout.gap, 0, 200)
    };
  }

  function isDefault(layout) {
    return layout.direction === 'row' && layout.first === 'profile' && layout.split == null && layout.gap == null;
  }

  /* The layout the document declares (its own block), or the default. */
  function declared() {
    var match = BLOCK.exec(window.JaiPayload.allCss(S.code()));
    if (!match) return clone(DEFAULT);
    try { return normalise(JSON.parse(match[1])); } catch { return clone(DEFAULT); }
  }

  /* Whether the creator's other CSS already overrides how these two sit — a
   * template's `.profile-page-flex { display: block !important }` — in which
   * case "side by side" has to be said out loud rather than left to JanitorAI. */
  function forcesLayout(css) {
    var model = window.CssModel;
    return model.parse(css).some(function (node) {
      if (node.type !== 'rule' || (node.atPath && node.atPath.length) || !node.decls) return false;
      var ours = node.selectorRaw.split(',').some(function (part) { return model.normaliseSelector(part) === WRAP; });
      if (!ours) return false;
      return node.decls.some(function (d) {
        var prop = d.prop.toLowerCase();
        var value = d.value.toLowerCase();
        return (prop === 'display' && !/flex/.test(value)) || (prop === 'flex-direction' && /^column/.test(value));
      });
    });
  }

  // --------------------------------------------------------------------- css

  function rules(list, indent) {
    return list.filter(function (r) { return r[1].length; }).map(function (r) {
      return indent + r[0] + ' {\n' + r[1].map(function (d) {
        return indent + '  ' + d + ' !important;';
      }).join('\n') + '\n' + indent + '}';
    }).join('\n');
  }

  /* The block of CSS for a layout; '' when the page should be left alone. */
  function generate(layout, forced) {
    var profile = SECTIONS.profile.selector;
    var characters = SECTIONS.characters.selector;
    var swapped = layout.first === 'characters';
    var gap = layout.gap != null ? ['gap: ' + layout.gap + 'px'] : [];
    var body;

    if (layout.direction === 'column') {
      body = rules([
        [WRAP, ['display: flex', 'flex-direction: column'].concat(gap)],
        [profile, ['width: 100%', 'min-width: 0', 'max-width: none']],
        [characters, ['width: 100%'].concat(swapped ? ['order: -1'] : [])]
      ], '');
    } else {
      if (isDefault(layout) && !forced) return '';
      // With a split the profile box is pinned to its share and the characters
      // take whatever is left. Leaving the characters at their own `width: 100%`
      // would have the two shrink against each other and the box would come
      // out narrower than the share it was given.
      var split = layout.split != null;
      body = DESKTOP + ' {\n' + rules([
        [WRAP, ['display: flex', 'flex-direction: row'].concat(gap)],
        [profile, split ? ['width: ' + layout.split + '%', 'min-width: 0', 'max-width: none', 'flex: 0 0 auto'] : []],
        [characters, (split ? ['width: auto', 'min-width: 0', 'flex: 1 1 0%'] : []).concat(swapped ? ['order: -1'] : [])]
      ], '  ') + '\n}';
    }
    return '/* @jai:layout:start ' + JSON.stringify(layout) + ' */\n' +
      '/* Page layout: set from the Page layout controls, which rewrite this block. */\n' +
      body + '\n/* @jai:layout:end */';
  }

  /*
   * Writes a layout into the document as one edit. `from` is the history tag:
   * a click is a step of its own ('layout'), a slider being dragged runs
   * together ('inspector'). Returns whether the document changed.
   */
  function apply(next, from) {
    var layout = normalise(next);
    var others = window.JaiPayload.allCss(S.code()).replace(BLOCKS, '');
    var text = generate(layout, forcesLayout(others));
    var before = S.code();
    S.editCss(function (css) {
      var bare = css.replace(BLOCKS, function (match, json, offset, whole) {
        return /\S/.test(whole.slice(offset + match.length)) ? '\n\n' : '';
      });
      var next = text
        ? bare + (bare && !/\n\s*$/.test(bare) ? '\n\n' : (bare.trim() ? '\n' : '')) + text + '\n'
        : bare;
      // Putting the same layout back would only shuffle blank lines around it,
      // and that must not become a step of its own for Undo to spend itself on.
      return next.replace(/\s+/g, '') === css.replace(/\s+/g, '') ? css : next;
    }, from || 'layout');
    return S.code() !== before;
  }

  // ----------------------------------------------------------------- reading

  function frameDoc() {
    try { return S.frame.contentDocument; } catch { return null; }
  }

  /* How the preview is actually laid out right now, whatever wrote it. */
  function measure() {
    var doc = frameDoc();
    var wrap = doc && doc.querySelector(WRAP);
    if (!wrap) return null;
    var profile = null;
    var characters = null;
    Array.prototype.forEach.call(wrap.children, function (child) {
      if (child.classList.contains('pp-uc-background')) profile = child;
      else if (child.classList.contains('profile-page-container-flex-box')) characters = child;
    });
    if (!profile || !characters) return null;
    var win = doc.defaultView;
    var style = win.getComputedStyle(wrap);
    var row = /flex/.test(style.display) && /^row/.test(style.flexDirection);
    var p = profile.getBoundingClientRect();
    var c = characters.getBoundingClientRect();
    var w = wrap.getBoundingClientRect();
    return {
      direction: row ? 'row' : 'column',
      first: (row ? p.left <= c.left : p.top <= c.top) ? 'profile' : 'characters',
      split: row && w.width ? Math.round(p.width / w.width * 1000) / 10 : null,
      gap: parseFloat(style.rowGap) || 0
    };
  }

  function presetOf(m) {
    if (!m) return null;
    var hit = PRESETS.filter(function (p) { return p.direction === m.direction && p.first === m.first; })[0];
    return hit ? hit.id : null;
  }

  // ----------------------------------------------------------------- changes

  function choose(id) {
    var spec = PRESETS.filter(function (p) { return p.id === id; })[0];
    if (!spec) return;
    var current = declared();
    var changed = apply({
      direction: spec.direction,
      first: spec.first,
      split: spec.direction === 'row' ? current.split : null,
      gap: current.gap
    }, 'layout');
    S.toast(changed ? spec.label + '. Ctrl+Z to undo.' : 'Already ' + spec.label.toLowerCase() + '.');
  }

  function reset() {
    var changed = apply(DEFAULT, 'layout');
    S.toast(changed ? 'Page layout reset to JanitorAI’s own.' : 'The page layout is already JanitorAI’s own.');
  }

  /* One section dropped above, below or beside the other (the canvas grip). */
  function place(section, where) {
    if (!SECTIONS[section] || !WORDS[where]) return;
    var current = declared();
    var vertical = where === 'top' || where === 'bottom';
    var changed = apply({
      direction: vertical ? 'column' : 'row',
      first: where === 'top' || where === 'left' ? section : other(section),
      split: vertical ? null : current.split,
      gap: current.gap
    }, 'layout');
    S.toast(changed
      ? SECTIONS[section].name + ' moved ' + WORDS[where] + ' ' + SECTIONS[other(section)].name + '. Ctrl+Z to undo.'
      : SECTIONS[section].name + ' is already ' + WORDS[where] + ' ' + SECTIONS[other(section)].name + '.');
  }

  /* Swap which comes first, keeping the direction (dragging rows in Layers). */
  function order(section, where) {
    if (!SECTIONS[section]) return;
    var current = declared();
    var seen = measure();
    var direction = seen ? seen.direction : current.direction;
    var changed = apply({
      direction: direction,
      first: where === 'before' ? section : other(section),
      split: direction === 'row' ? current.split : null,
      gap: current.gap
    }, 'layout');
    if (changed) S.toast(SECTIONS[section].name + ' now comes ' + where + ' ' + SECTIONS[other(section)].name + '. Ctrl+Z to undo.');
  }

  /* The profile box's share of the row, 20–80% (the canvas gutter, the slider). */
  function splitTo(percent, from) {
    var current = declared();
    apply({ direction: 'row', first: current.first, split: percent, gap: current.gap }, from || 'layout');
  }

  function gapTo(px, from) {
    var current = declared();
    apply({ direction: current.direction, first: current.first, split: current.split, gap: px }, from || 'layout');
  }

  // ------------------------------------------------------------------- panel

  var panels = [];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /* The little diagram on a preset tile: the profile box (red) and the
   * characters (grey) laid out the way the preset puts them. */
  function mini(preset) {
    var box = el('span', 'pl-mini pl-' + preset.id);
    box.appendChild(el('i', 'pl-p'));
    box.appendChild(el('i', 'pl-c'));
    return box;
  }

  /* The Page layout controls, as a collapsible section for the properties panel. */
  function section() {
    var details = el('details', 'insp-section pl-section');
    details.open = true;
    details.appendChild(el('summary', null, 'Page layout'));
    var body = el('div', 'insp-body');
    details.appendChild(body);

    body.appendChild(el('p', 'insp-hint',
      'Where the profile box (your About Me) and the character list sit. Pick a layout, or drag them by the grip on the canvas.'));

    var tiles = el('div', 'pl-tiles');
    var buttons = PRESETS.map(function (preset) {
      var button = el('button', 'pl-tile');
      button.type = 'button';
      button.dataset.preset = preset.id;
      button.title = preset.hint;
      button.appendChild(mini(preset));
      button.appendChild(el('span', null, preset.label));
      button.addEventListener('click', function () { choose(preset.id); });
      tiles.appendChild(button);
      return button;
    });
    body.appendChild(tiles);

    var splitRow = el('label', 'pl-row');
    splitRow.appendChild(el('span', null, 'Profile width'));
    var slider = el('input');
    slider.type = 'range';
    slider.min = '20';
    slider.max = '80';
    slider.step = '1';
    slider.title = 'How much of the row the profile box takes. You can also drag the gutter between the two on the canvas.';
    var splitValue = el('output', 'pl-value');
    splitRow.appendChild(slider);
    splitRow.appendChild(splitValue);
    slider.addEventListener('input', function () {
      splitValue.textContent = slider.value + '%';
      splitTo(Number(slider.value), 'inspector');
    });
    body.appendChild(splitRow);

    var gapRow = el('label', 'pl-row');
    gapRow.appendChild(el('span', null, 'Space between'));
    var gap = el('input');
    gap.type = 'number';
    gap.min = '0';
    gap.max = '200';
    gap.step = '4';
    var unit = el('output', 'pl-value', 'px');
    gapRow.appendChild(gap);
    gapRow.appendChild(unit);
    gap.addEventListener('change', function () {
      gapTo(gap.value === '' ? null : Number(gap.value), 'layout');
    });
    body.appendChild(gapRow);

    var actions = el('div', 'pl-actions');
    var resetButton = el('button', 'btn btn-ghost btn-sm', 'Reset layout');
    resetButton.type = 'button';
    resetButton.title = 'Back to JanitorAI’s own layout';
    resetButton.addEventListener('click', reset);
    actions.appendChild(resetButton);
    body.appendChild(actions);

    var panel = {
      root: details,
      sync: function () {
        var seen = measure();
        var mine = declared();
        var active = presetOf(seen);
        buttons.forEach(function (button) { button.classList.toggle('is-active', button.dataset.preset === active); });
        var row = seen ? seen.direction === 'row' : mine.direction === 'row';
        splitRow.hidden = !row;
        var share = mine.split != null ? mine.split : (seen && seen.split != null ? seen.split : 44);
        if (document.activeElement !== slider) slider.value = String(Math.round(share));
        splitValue.textContent = Math.round(share) + '%';
        if (document.activeElement !== gap) {
          gap.value = mine.gap != null ? String(mine.gap) : (seen ? String(Math.round(seen.gap)) : '');
        }
        resetButton.disabled = isDefault(mine);
      }
    };
    panels.push(panel);
    panel.sync();
    return details;
  }

  function syncAll() {
    panels = panels.filter(function (panel) { return panel.root.isConnected; });
    panels.forEach(function (panel) { panel.sync(); });
  }

  /* The Page panel (nothing selected) has a spot reserved for it. */
  function mount() {
    var host = document.getElementById('page-layout-panel');
    if (host && !host.firstChild) host.appendChild(section());
  }

  /* Whether a selection is one of the things Page layout is about. */
  function isTarget(selection) {
    if (!selection || selection.kind !== 'native') return false;
    return [WRAP, SECTIONS.profile.selector, SECTIONS.characters.selector].indexOf(selection.selector) !== -1;
  }

  /* "Page layout ▸" for the canvas's right-click menu. */
  function menuItems() {
    var active = presetOf(measure());
    return [{
      label: 'Page layout',
      items: PRESETS.map(function (preset) {
        return { label: (preset.id === active ? '✓ ' : '') + preset.label, action: function () { choose(preset.id); } };
      }).concat([null, { label: 'Reset page layout', action: reset }])
    }];
  }

  // ------------------------------------------------------------------ wiring

  S.on('frame:section', function (m) { place(m.section, m.where); });
  S.on('frame:split', function (m) {
    var percent = number(m.percent, 20, 80);
    if (percent != null) splitTo(percent, 'layout');
  });

  S.on('change', syncAll);
  S.on('selection', syncAll);
  S.on('frame:connected', syncAll);
  // The preview has the change too once `pushed` arrives; that is when its
  // computed layout — which is what the tiles report — is current.
  S.on('pushed', function () { window.setTimeout(syncAll, 0); });

  mount();

  window.JaiPageLayout = {
    wrap: WRAP,
    sections: SECTIONS,
    presets: PRESETS,
    measure: measure,
    declared: declared,
    apply: apply,
    choose: choose,
    reset: reset,
    place: place,
    order: order,
    splitTo: splitTo,
    section: section,
    isTarget: isTarget,
    menuItems: menuItems,
    sectionFor: function (selector) {
      return Object.keys(SECTIONS).filter(function (key) { return SECTIONS[key].selector === selector; })[0] || null;
    }
  };
})();
