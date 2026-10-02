/*
 * The properties panel: whatever is selected on the canvas, as fields.
 *
 * Fields own no state. Each one reads its value out of the stylesheet in the
 * About Me document and writes back into it, so the panel, the canvas and the
 * code view can never disagree — and a value typed by hand in the code shows
 * up here the moment it is typed. What a field shows greyed out is what the
 * browser resolved for the element; what it shows in white is what the
 * creator's own CSS says.
 *
 * The panel is rebuilt when the selection changes and merely refreshed when
 * the document does, which is what lets a field keep focus while it is typed in.
 */
(function () {
  'use strict';

  var S = window.JaiStudio;
  var C = window.JaiCanvas;
  var M = window.JaiMarkup;

  var host = document.getElementById('inspector-selection');
  var page = document.getElementById('inspector-page');

  /* The families preview/frame.html loads — the same set JanitorAI does. */
  var FONTS = [
    'Abril Fatface', 'Aladin', 'Aldrich', 'Alegreya Sans SC', 'Berkshire Swash',
    'Black Ops One', 'Cardo', 'Caveat', 'Caveat Brush', 'Chango',
    'Cherry Bomb One', 'Cinzel', 'Cinzel Decorative', 'Courgette',
    'Courier Prime', 'Crimson Text', 'Cutive Mono', 'DM Sans', 'DM Serif Text',
    'Dancing Script', 'DotGothic16', 'Fascinate', 'Fraunces', 'Graduate',
    'Grenze Gotisch', 'Inter', 'Jacquard 12', 'Jacquard 24', 'Jim Nightshade',
    'Jua', 'Jura', 'Lacquer', 'Lato', 'Lexend', 'Linefont', 'Lobster', 'Mitr',
    'Monoton', 'Montserrat', 'Montserrat Alternates', 'Notable', 'Noto Sans JP',
    'Noto Sans KR', 'Noto Sans SC', 'Oleo Script', 'Orbitron', 'Pacifico',
    'Pangolin', 'Petit Formal Script', 'Pirata One', 'Pixelify Sans',
    'Playpen Sans Hebrew', 'Poppins', 'Press Start 2P', 'Raleway', 'Roboto',
    'Roboto Condensed', 'Rock Salt', 'Rubik Glitch', 'Share Tech', 'Sigmar One',
    'Silkscreen', 'Special Elite', 'Sunshiney', 'Tagesschrift', 'VT323'
  ];

  var OPEN_KEY = 'jai-css-studio:inspector-sections';
  var openSections = { content: true, layout: true, type: true, fill: true, stroke: true, effects: false, css: false };
  try {
    var savedOpen = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null');
    if (savedOpen) Object.keys(savedOpen).forEach(function (k) { openSections[k] = !!savedOpen[k]; });
  } catch { /* a corrupt preference is not worth more than the default */ }

  // ---------------------------------------------------------------- helpers

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function textInput(placeholder) {
    var input = h('input');
    input.type = 'text';
    input.spellcheck = false;
    input.autocomplete = 'off';
    if (placeholder) input.placeholder = placeholder;
    return input;
  }

  function focused(node) { return document.activeElement === node; }

  var probe = h('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);

  /* Any CSS colour as #rrggbb, for the native colour swatch. */
  function toHex(value) {
    if (!value) return null;
    var v = String(value).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    probe.style.color = '';
    probe.style.color = v;
    if (!probe.style.color) return null;
    var rgb = getComputedStyle(probe).color.match(/[\d.]+/g);
    if (!rgb || rgb.length < 3) return null;
    if (rgb.length > 3 && +rgb[3] === 0) return null;      // fully transparent has no swatch
    return '#' + rgb.slice(0, 3).map(function (n) {
      return ('0' + Math.round(+n).toString(16)).slice(-2);
    }).join('');
  }

  function parseNumber(value) {
    var m = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(String(value == null ? '' : value).trim());
    return m ? { n: parseFloat(m[1]), u: m[2] } : null;
  }

  function roundTo(n, step) {
    var decimals = (String(step).split('.')[1] || '').length;
    return +n.toFixed(Math.min(4, decimals));
  }

  /* Splits on top-level occurrences of a separator, leaving rgba(…) and
   * gradient stops in one piece. */
  function splitTop(text, separator) {
    var out = [];
    var depth = 0;
    var start = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && (separator === ' ' ? /\s/.test(c) : c === separator)) {
        if (i > start) out.push(text.slice(start, i));
        start = i + 1;
      }
    }
    if (start < text.length) out.push(text.slice(start));
    return out.map(function (part) { return part.trim(); }).filter(Boolean);
  }

  /* The browser's resolved value, as a placeholder: 31.1875px reads as 31.19px. */
  function resolved(prop) {
    return C.computed(prop).trim().replace(/-?\d+\.\d{3,}/g, function (n) {
      return String(+parseFloat(n).toFixed(2));
    });
  }

  function effective(prop) { return C.readStyle(prop) || C.computed(prop) || ''; }
  function isFlex() { return /flex/.test(effective('display')); }
  function isGrid() { return /grid/.test(effective('display')); }
  function isPositioned() { return !/^(static)?$/.test(effective('position')); }

  // ----------------------------------------------------------------- fields
  //
  // Each builder fills `field` with inputs and returns sync(declared, computed).

  var syncers = [];

  var FIELD = {};

  FIELD.text = function (spec, field) {
    var input = textInput(spec.placeholder);
    input.addEventListener('change', function () {
      C.writeStyle(spec.prop, input.value.trim() || null);
    });
    field.appendChild(input);
    return function (value) {
      if (!focused(input)) input.value = value || '';
    };
  };

  /*
   * A number with a unit. A bare number takes the unit already in use (or the
   * property's usual one); anything else — auto, 50%, calc(…) — goes in as
   * typed. The label scrubs: drag it sideways to change the value.
   */
  FIELD.length = function (spec, field, label, wrap) {
    var input = textInput();
    var step = spec.step || 1;
    var unitless = spec.unit === '';

    function unit() {
      var declared = parseNumber(C.readStyle(spec.prop));
      if (declared && declared.u) return declared.u;
      return spec.unit != null ? spec.unit : 'px';
    }

    function current() {
      var value = parseNumber(input.value) || parseNumber(C.readStyle(spec.prop));
      // The computed value is always in pixels, which is only a fair starting
      // point for a property that is measured in them.
      if (!value && !unitless) value = parseNumber(C.computed(spec.prop));
      return value || { n: spec.base != null ? spec.base : 0, u: '' };
    }

    function clamp(n) {
      if (spec.min != null) n = Math.max(spec.min, n);
      if (spec.max != null) n = Math.min(spec.max, n);
      return roundTo(n, step);
    }

    function set(n, u) {
      var value = clamp(n) + (unitless ? '' : (u || unit()));
      input.value = value;
      C.writeStyle(spec.prop, value);
    }

    input.addEventListener('change', function () {
      var raw = input.value.trim();
      if (!raw) { C.writeStyle(spec.prop, null); return; }
      C.writeStyle(spec.prop, /^-?\d*\.?\d+$/.test(raw) ? raw + (unitless ? '' : unit()) : raw);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      var from = current();
      set(from.n + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1), from.u);
    });

    wrap.classList.add('is-scrub');
    label.addEventListener('pointerdown', function (down) {
      if (down.button !== 0) return;
      down.preventDefault();
      var from = current();
      label.setPointerCapture(down.pointerId);
      function move(e) {
        var delta = Math.round((e.clientX - down.clientX) / 2);
        set(from.n + delta * step * (e.shiftKey ? 10 : 1), from.u);
      }
      function end() {
        label.removeEventListener('pointermove', move);
        label.removeEventListener('pointerup', end);
        label.removeEventListener('pointercancel', end);
      }
      label.addEventListener('pointermove', move);
      label.addEventListener('pointerup', end);
      label.addEventListener('pointercancel', end);
    });

    field.appendChild(input);
    return function (value, computed) {
      if (!focused(input)) input.value = value || '';
      input.placeholder = computed || '';
    };
  };

  FIELD.select = function (spec, field) {
    var select = h('select');
    var blank = h('option', null, '—');
    blank.value = '';
    select.appendChild(blank);
    spec.options.forEach(function (value) {
      var option = h('option', null, value);
      option.value = value;
      select.appendChild(option);
    });
    var extra = null;
    select.addEventListener('change', function () {
      C.writeStyle(spec.prop, select.value || null);
    });
    field.appendChild(select);
    return function (value, computed) {
      // A hand-written value the list does not offer still has to show.
      if (extra) { select.removeChild(extra); extra = null; }
      if (value && spec.options.indexOf(value) === -1) {
        extra = h('option', null, value);
        extra.value = value;
        select.appendChild(extra);
      }
      blank.textContent = computed && computed.length < 24 ? computed : '—';
      select.value = value || '';
    };
  };

  FIELD.seg = function (spec, field) {
    var seg = h('div', 'seg');
    var buttons = spec.options.map(function (option) {
      var button = h('button', null, option[1]);
      button.type = 'button';
      button.title = option[2] || option[0];
      button.addEventListener('click', function () {
        // Clicking the active choice again takes the declaration back out.
        C.writeStyle(spec.prop, button.classList.contains('is-active') ? null : option[0]);
      });
      seg.appendChild(button);
      return [option[0], button];
    });
    field.appendChild(seg);
    return function (value) {
      buttons.forEach(function (pair) { pair[1].classList.toggle('is-active', pair[0] === value); });
    };
  };

  FIELD.color = function (spec, field) {
    var swatch = h('input');
    swatch.type = 'color';
    var input = textInput();
    swatch.addEventListener('input', function () {
      input.value = swatch.value;
      C.writeStyle(spec.prop, swatch.value);
    });
    input.addEventListener('change', function () {
      C.writeStyle(spec.prop, input.value.trim() || null);
    });
    field.appendChild(swatch);
    field.appendChild(input);
    return function (value, computed) {
      if (!focused(input)) input.value = value || '';
      input.placeholder = computed || '';
      var hex = toHex(value || computed);
      if (hex) swatch.value = hex;
    };
  };

  FIELD.font = function (spec, field) {
    var select = h('select');
    var blank = h('option', null, '—');
    blank.value = '';
    select.appendChild(blank);
    FONTS.forEach(function (name) {
      var option = h('option', null, name);
      option.value = '"' + name + '"';
      select.appendChild(option);
    });
    var extra = null;
    select.addEventListener('change', function () {
      C.writeStyle('font-family', select.value || null);
    });
    field.appendChild(select);
    return function (value, computed) {
      if (extra) { select.removeChild(extra); extra = null; }
      var first = value ? value.split(',')[0].trim().replace(/^['"]|['"]$/g, '') : '';
      var known = FONTS.indexOf(first) !== -1 && value.indexOf(',') === -1;
      if (value && !known) {
        extra = h('option', null, value);
        extra.value = value;
        select.appendChild(extra);
      }
      blank.textContent = computed ? computed.split(',')[0].replace(/['"]/g, '') : '—';
      select.value = !value ? '' : known ? '"' + first + '"' : value;
    };
  };

  /* One labelled row for one property. */
  function row(spec) {
    var wrap = h('div', 'prop');
    wrap.dataset.prop = spec.prop;
    var label = h('label', 'prop-label', spec.label);
    label.title = spec.prop;
    var field = h('div', 'prop-field');
    var reset = h('button', 'prop-reset', '×');
    reset.type = 'button';
    reset.title = 'Remove ' + spec.prop;
    reset.addEventListener('click', function () { C.writeStyle(spec.prop, null); });
    wrap.appendChild(label);
    wrap.appendChild(field);
    wrap.appendChild(reset);

    var sync = FIELD[spec.type](spec, field, label, wrap);
    syncers.push(function () {
      if (spec.when) wrap.hidden = !spec.when();
      var value = C.readStyle(spec.prop);
      wrap.classList.toggle('is-set', value !== undefined);
      sync(value, value === undefined ? resolved(spec.prop) : '');
      return value !== undefined;
    });
    return wrap;
  }

  function pair(a, b, when) {
    var wrap = h('div', 'prop-pair');
    wrap.appendChild(row(a));
    wrap.appendChild(row(b));
    if (when) syncers.push(function () { wrap.hidden = !when(); return false; });
    return wrap;
  }

  // ------------------------------------------------------------------- fill
  //
  // A fill is one of three properties depending on what the rule already has,
  // and a gradient is the only "image" JanitorAI lets a stylesheet use, so the
  // two get a small builder instead of a bare text field.

  function parseGradient(value) {
    var m = /^(linear|radial)-gradient\(([\s\S]*)\)$/i.exec(String(value || '').trim());
    if (!m) return null;
    var parts = splitTop(m[2], ',');
    var angle = 180;
    if (m[1].toLowerCase() === 'linear' && /^-?[\d.]+deg$/.test(parts[0] || '')) angle = parseFloat(parts.shift());
    else if (/^(to |circle|ellipse|closest|farthest|at )/i.test(parts[0] || '')) parts.shift();
    if (parts.length < 2) return null;
    function colour(stop) { return splitTop(stop, ' ')[0]; }
    return { kind: m[1].toLowerCase(), angle: angle, from: colour(parts[0]), to: colour(parts[parts.length - 1]) };
  }

  function buildGradient(g) {
    return g.kind === 'radial'
      ? 'radial-gradient(circle at 50% 30%, ' + g.from + ', ' + g.to + ')'
      : 'linear-gradient(' + g.angle + 'deg, ' + g.from + ', ' + g.to + ')';
  }

  function fillBlock() {
    var box = h('div');
    var FILL_PROPS = ['background', 'background-image', 'background-color'];

    function declared() {
      for (var i = 0; i < FILL_PROPS.length; i++) {
        var v = C.readStyle(FILL_PROPS[i]);
        if (v !== undefined) return { prop: FILL_PROPS[i], value: v };
      }
      return null;
    }

    /* Keeps writing to whichever property the rule already uses; a new fill is
     * `background-color` for a colour and `background` for a gradient. */
    function write(value) {
      var has = declared();
      var gradient = /gradient\(/i.test(value || '');
      if (has && (has.prop !== 'background-color' || !gradient)) { C.writeStyle(has.prop, value); return; }
      if (has && gradient) C.writeStyle('background-color', null);
      C.writeStyle(gradient ? 'background' : 'background-color', value);
    }

    var main = h('div', 'prop');
    main.appendChild(h('label', 'prop-label', 'Fill'));
    var field = h('div', 'prop-field');
    var swatch = h('input');
    swatch.type = 'color';
    var input = textInput('colour or gradient');
    field.appendChild(swatch);
    field.appendChild(input);
    main.appendChild(field);
    var reset = h('button', 'prop-reset', '×');
    reset.type = 'button';
    reset.title = 'Remove the fill';
    reset.addEventListener('click', function () {
      FILL_PROPS.forEach(function (prop) {
        if (C.readStyle(prop) !== undefined) C.writeStyle(prop, null);
      });
    });
    main.appendChild(reset);

    var kindRow = h('div', 'prop');
    kindRow.appendChild(h('label', 'prop-label', 'Gradient'));
    var kindField = h('div', 'prop-field');
    var seg = h('div', 'seg');
    var kinds = [['solid', 'Off'], ['linear', 'Linear'], ['radial', 'Radial']].map(function (k) {
      var button = h('button', null, k[1]);
      button.type = 'button';
      button.dataset.kind = k[0];
      seg.appendChild(button);
      return button;
    });
    kindField.appendChild(seg);
    kindRow.appendChild(kindField);
    kindRow.appendChild(h('span'));

    var endRow = h('div', 'prop');
    endRow.appendChild(h('label', 'prop-label', 'To'));
    var endField = h('div', 'prop-field');
    var endSwatch = h('input');
    endSwatch.type = 'color';
    var angle = textInput('180');
    angle.title = 'Angle in degrees';
    endField.appendChild(endSwatch);
    endField.appendChild(angle);
    endRow.appendChild(endField);
    endRow.appendChild(h('span'));

    function state() {
      var has = declared();
      var value = has ? has.value : '';
      var g = parseGradient(value);
      return { value: value, gradient: g, colour: g ? g.from : value };
    }

    swatch.addEventListener('input', function () {
      var now = state();
      if (now.gradient) { now.gradient.from = swatch.value; write(buildGradient(now.gradient)); }
      else write(swatch.value);
    });
    input.addEventListener('change', function () {
      var v = input.value.trim();
      if (v) write(v); else reset.click();
    });
    endSwatch.addEventListener('input', function () {
      var now = state();
      if (!now.gradient) return;
      now.gradient.to = endSwatch.value;
      write(buildGradient(now.gradient));
    });
    angle.addEventListener('change', function () {
      var now = state();
      if (!now.gradient) return;
      now.gradient.angle = parseFloat(angle.value) || 0;
      write(buildGradient(now.gradient));
    });
    kinds.forEach(function (button) {
      button.addEventListener('click', function () {
        var now = state();
        var from = toHex(now.colour) || toHex(C.computed('background-color')) || '#e11d36';
        if (button.dataset.kind === 'solid') { write(from); return; }
        write(buildGradient({
          kind: button.dataset.kind,
          angle: now.gradient ? now.gradient.angle : 135,
          from: now.gradient ? now.gradient.from : from,
          to: now.gradient ? now.gradient.to : '#2a0a12'
        }));
      });
    });

    syncers.push(function () {
      var now = state();
      var set = !!declared();
      main.classList.toggle('is-set', set);
      if (!focused(input)) input.value = now.value;
      input.placeholder = set ? '' : C.computed('background-color');
      var hex = toHex(now.colour || C.computed('background-color'));
      if (hex) swatch.value = hex;
      var kind = now.gradient ? now.gradient.kind : 'solid';
      kinds.forEach(function (button) {
        button.classList.toggle('is-active', set && button.dataset.kind === kind);
      });
      endRow.hidden = !now.gradient;
      if (now.gradient) {
        var end = toHex(now.gradient.to);
        if (end) endSwatch.value = end;
        if (!focused(angle)) angle.value = now.gradient.kind === 'linear' ? String(now.gradient.angle) : '';
        angle.disabled = now.gradient.kind !== 'linear';
      }
      return set;
    });

    box.appendChild(main);
    box.appendChild(kindRow);
    box.appendChild(endRow);
    return box;
  }

  // ----------------------------------------------------------------- shadow

  function parseShadow(value) {
    var v = String(value || '').trim();
    if (!v || v === 'none' || splitTop(v, ',').length > 1) return null;
    var out = { inset: false, lengths: [], colour: '' };
    splitTop(v, ' ').forEach(function (token) {
      if (token === 'inset') out.inset = true;
      else if (parseNumber(token)) out.lengths.push(token);
      else out.colour = token;
    });
    return out.lengths.length >= 2 ? out : null;
  }

  function shadowBlock() {
    var box = h('div');
    var main = h('div', 'prop');
    main.appendChild(h('label', 'prop-label', 'Shadow'));
    var field = h('div', 'prop-field');
    var swatch = h('input');
    swatch.type = 'color';
    var input = textInput('0 8px 24px rgba(0,0,0,.45)');
    field.appendChild(swatch);
    field.appendChild(input);
    main.appendChild(field);
    var reset = h('button', 'prop-reset', '×');
    reset.type = 'button';
    reset.title = 'Remove box-shadow';
    reset.addEventListener('click', function () { C.writeStyle('box-shadow', null); });
    main.appendChild(reset);

    var grid = h('div', 'prop-pair');
    var parts = [['X', 0], ['Y', 8], ['B', 24], ['S', 0]].map(function (def, i) {
      var cell = h('div', 'prop');
      var label = h('label', 'prop-label', def[0]);
      label.title = ['Horizontal offset', 'Vertical offset', 'Blur', 'Spread'][i];
      var cellField = h('div', 'prop-field');
      var number = textInput(String(def[1]));
      cellField.appendChild(number);
      cell.appendChild(label);
      cell.appendChild(cellField);
      cell.appendChild(h('span'));
      grid.appendChild(cell);
      number.addEventListener('change', rebuild);
      return { input: number, fallback: def[1] };
    });

    function rebuild() {
      var now = parseShadow(C.readStyle('box-shadow'));
      var lengths = parts.map(function (part) {
        var raw = part.input.value.trim();
        if (raw === '') raw = String(part.fallback);
        return /^-?\d*\.?\d+$/.test(raw) ? (raw === '0' ? '0' : raw + 'px') : raw;
      });
      var colour = (now && now.colour) || 'rgba(0, 0, 0, 0.45)';
      C.writeStyle('box-shadow', (now && now.inset ? 'inset ' : '') + lengths.join(' ') + ' ' + colour);
    }

    swatch.addEventListener('input', function () {
      var now = parseShadow(C.readStyle('box-shadow')) || { inset: false, lengths: ['0', '8px', '24px', '0'], colour: '' };
      C.writeStyle('box-shadow', (now.inset ? 'inset ' : '') + now.lengths.join(' ') + ' ' + swatch.value);
    });
    input.addEventListener('change', function () {
      C.writeStyle('box-shadow', input.value.trim() || null);
    });

    syncers.push(function () {
      var value = C.readStyle('box-shadow');
      var now = parseShadow(value);
      main.classList.toggle('is-set', value !== undefined);
      if (!focused(input)) input.value = value || '';
      var hex = toHex(now && now.colour);
      if (hex) swatch.value = hex;
      parts.forEach(function (part, i) {
        if (!focused(part.input)) part.input.value = now && now.lengths[i] != null ? String(parseFloat(now.lengths[i])) : '';
      });
      return value !== undefined;
    });

    box.appendChild(main);
    box.appendChild(grid);
    return box;
  }

  // --------------------------------------------------------------- sections

  function section(id, title, build) {
    var details = h('details', 'insp-section');
    details.dataset.section = id;
    details.open = !!openSections[id];
    var summary = h('summary', null, title);
    var dot = h('span', 'insp-count');
    dot.title = 'Has properties set';
    summary.appendChild(dot);
    details.appendChild(summary);
    var body = h('div', 'insp-body');
    details.appendChild(body);
    details.addEventListener('toggle', function () {
      openSections[id] = details.open;
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(openSections)); } catch { /* private mode */ }
    });

    // The dot reports on exactly the fields this section built.
    var from = syncers.length;
    build(body);
    var mine = syncers.slice(from);
    syncers.length = from;
    syncers.push(function () {
      var any = false;
      mine.forEach(function (sync) { if (sync()) any = true; });
      dot.classList.toggle('is-on', any);
      return any;
    });
    return details;
  }

  function layoutSection(selection) {
    return section('layout', 'Layout', function (body) {
      body.appendChild(row({ type: 'select', prop: 'display', label: 'Display',
        options: ['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'none'] }));
      body.appendChild(row({ type: 'seg', prop: 'flex-direction', label: 'Direction', when: isFlex,
        options: [['row', '→', 'Row'], ['column', '↓', 'Column'], ['row-reverse', '←', 'Row, reversed'], ['column-reverse', '↑', 'Column, reversed']] }));
      body.appendChild(row({ type: 'select', prop: 'justify-content', label: 'Justify', when: function () { return isFlex() || isGrid(); },
        options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] }));
      body.appendChild(row({ type: 'select', prop: 'align-items', label: 'Align', when: function () { return isFlex() || isGrid(); },
        options: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'] }));
      body.appendChild(row({ type: 'seg', prop: 'flex-wrap', label: 'Wrap', when: isFlex,
        options: [['nowrap', 'One line'], ['wrap', 'Wrap']] }));
      body.appendChild(row({ type: 'text', prop: 'grid-template-columns', label: 'Columns', when: isGrid,
        placeholder: 'repeat(3, minmax(0, 1fr))' }));
      body.appendChild(row({ type: 'length', prop: 'gap', label: 'Gap', min: 0, when: function () { return isFlex() || isGrid(); } }));
      body.appendChild(pair(
        { type: 'length', prop: 'width', label: 'W', min: 0 },
        { type: 'length', prop: 'height', label: 'H', min: 0 }));
      body.appendChild(row({ type: 'length', prop: 'max-width', label: 'Max width', min: 0 }));
      body.appendChild(row({ type: 'length', prop: 'min-height', label: 'Min height', min: 0 }));
      body.appendChild(row({ type: 'length', prop: 'padding', label: 'Padding', min: 0 }));
      body.appendChild(row({ type: 'length', prop: 'margin', label: 'Margin' }));
      if (selection.tag === 'img') {
        body.appendChild(row({ type: 'select', prop: 'object-fit', label: 'Image fit',
          options: ['cover', 'contain', 'fill', 'none', 'scale-down'] }));
      }
      body.appendChild(row({ type: 'select', prop: 'position', label: 'Position',
        options: ['static', 'relative', 'absolute', 'fixed', 'sticky'] }));
      body.appendChild(pair(
        { type: 'length', prop: 'top', label: 'T' },
        { type: 'length', prop: 'left', label: 'L' }, isPositioned));
      body.appendChild(pair(
        { type: 'length', prop: 'bottom', label: 'B' },
        { type: 'length', prop: 'right', label: 'R' }, isPositioned));
      body.appendChild(row({ type: 'length', prop: 'z-index', label: 'Z-index', unit: '', when: isPositioned }));
      body.appendChild(row({ type: 'select', prop: 'overflow', label: 'Overflow',
        options: ['visible', 'hidden', 'auto', 'scroll'] }));
    });
  }

  function typeSection() {
    return section('type', 'Text', function (body) {
      body.appendChild(row({ type: 'font', prop: 'font-family', label: 'Font' }));
      body.appendChild(row({ type: 'length', prop: 'font-size', label: 'Size', min: 1 }));
      body.appendChild(row({ type: 'select', prop: 'font-weight', label: 'Weight',
        options: ['300', '400', '500', '600', '700', '800', '900'] }));
      body.appendChild(row({ type: 'color', prop: 'color', label: 'Colour' }));
      body.appendChild(row({ type: 'seg', prop: 'text-align', label: 'Align',
        options: [['left', 'Left'], ['center', 'Centre'], ['right', 'Right'], ['justify', 'Fill', 'Justify']] }));
      body.appendChild(row({ type: 'length', prop: 'line-height', label: 'Line height', unit: '', step: 0.05, min: 0, base: 1.5 }));
      body.appendChild(row({ type: 'length', prop: 'letter-spacing', label: 'Spacing', step: 0.5 }));
      body.appendChild(row({ type: 'select', prop: 'text-transform', label: 'Case',
        options: ['none', 'uppercase', 'lowercase', 'capitalize'] }));
      body.appendChild(row({ type: 'select', prop: 'text-decoration', label: 'Decoration',
        options: ['none', 'underline', 'line-through'] }));
      body.appendChild(row({ type: 'text', prop: 'text-shadow', label: 'Glow', placeholder: '0 0 12px #ff5ea8' }));
    });
  }

  function fillSection() {
    return section('fill', 'Fill', function (body) {
      body.appendChild(fillBlock());
      body.appendChild(row({ type: 'length', prop: 'opacity', label: 'Opacity', unit: '', step: 0.05, min: 0, max: 1, base: 1 }));
    });
  }

  function strokeSection() {
    return section('stroke', 'Border', function (body) {
      body.appendChild(row({ type: 'length', prop: 'border-width', label: 'Width', min: 0 }));
      body.appendChild(row({ type: 'select', prop: 'border-style', label: 'Style',
        options: ['solid', 'dashed', 'dotted', 'double', 'none'] }));
      body.appendChild(row({ type: 'color', prop: 'border-color', label: 'Colour' }));
      body.appendChild(row({ type: 'length', prop: 'border-radius', label: 'Radius', min: 0 }));
    });
  }

  function effectsSection() {
    return section('effects', 'Effects', function (body) {
      body.appendChild(shadowBlock());
      body.appendChild(row({ type: 'text', prop: 'filter', label: 'Filter', placeholder: 'blur(2px) brightness(0.8)' }));
      body.appendChild(row({ type: 'text', prop: 'backdrop-filter', label: 'Backdrop', placeholder: 'blur(10px)' }));
      body.appendChild(row({ type: 'text', prop: 'transform', label: 'Transform', placeholder: 'rotate(-2deg) scale(1.05)' }));
      body.appendChild(row({ type: 'text', prop: 'transition', label: 'Transition', placeholder: 'all 0.25s ease' }));
      // Set from Insert → Animations; the speed and repeat are edited here.
      body.appendChild(row({ type: 'text', prop: 'animation', label: 'Animation', placeholder: 'jx-float 3.5s ease-in-out infinite' }));
    });
  }

  // ---------------------------------------------------------------- content
  //
  // The element itself rather than its style: its text, where a link goes,
  // which picture an image shows. These edit the markup, not the stylesheet.

  function attrRow(label, name, placeholder) {
    var wrap = h('div', 'prop');
    wrap.appendChild(h('label', 'prop-label', label));
    var field = h('div', 'prop-field');
    var input = textInput(placeholder);
    input.dataset.attr = name;
    input.addEventListener('change', function () {
      var value = input.value.trim();
      C.editMarkup(function (code, id) {
        return M.setAttr(code, id, name, value === '' && name !== 'alt' ? null : value);
      });
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    field.appendChild(input);
    wrap.appendChild(field);
    wrap.appendChild(h('span'));
    syncers.push(function () {
      var node = C.node();
      if (node && !focused(input)) input.value = M.attrValue(node, name);
      return false;
    });
    return wrap;
  }

  function contentSection(node) {
    return section('content', 'Content', function (body) {
      if (node.locked) {
        // Built from Profile data, and rebuilt whenever that changes. Editing
        // it here is allowed — it just stops being rebuilt.
        var linked = h('div', 'insp-linked');
        linked.appendChild(h('p', null, 'Linked to Profile data. Change its content there to keep it in step, or edit it here — the first hands-on edit unlinks the layout so your changes stay.'));
        var actions = h('div', 'insp-linked-actions');
        var edit = h('button', 'btn btn-sm', 'Edit in Profile data');
        edit.type = 'button';
        edit.addEventListener('click', function () { C.run('profileData'); });
        var unlink = h('button', 'btn btn-ghost btn-sm', 'Unlink');
        unlink.type = 'button';
        unlink.title = 'Keep the markup as it is and stop rebuilding it from Profile data';
        unlink.addEventListener('click', function () { C.run('unlink'); });
        actions.appendChild(edit);
        actions.appendChild(unlink);
        linked.appendChild(actions);
        body.appendChild(linked);
      }
      if (node.tag === 'img') {
        body.appendChild(attrRow('Image', 'src', 'https://…'));
        body.appendChild(attrRow('Alt text', 'alt', 'What the picture shows'));
      }
      if (node.tag === 'a') body.appendChild(attrRow('Link', 'href', 'https://…'));

      if (!node.void && !node.children.length && M.editable(S.code(), node)) {
        var wrap = h('div', 'prop prop-wide');
        var area = h('textarea');
        area.rows = 3;
        area.spellcheck = false;
        area.placeholder = 'Text';
        // Live as it is typed — except in a linked layout, where the first
        // edit unlinks and rebuilds this panel: that waits for the field to
        // be left, so the caret is not pulled out mid-word.
        area.addEventListener(node.locked ? 'change' : 'input', function () {
          var html = M.escapeText(area.value).replace(/\r?\n/g, '<br>');
          C.editMarkup(function (code, id) { return M.setInner(code, id, html); });
        });
        wrap.appendChild(area);
        wrap.appendChild(h('span'));
        body.appendChild(wrap);
        syncers.push(function () {
          var current = C.node();
          if (current && !focused(area)) {
            area.value = M.inner(S.code(), current).replace(/<br\s*\/?>/gi, '\n')
              .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
          }
          return false;
        });
      } else if (!node.void) {
        body.appendChild(h('p', 'insp-hint',
          node.children.length
            ? 'Holds ' + node.children.length + (node.children.length === 1 ? ' element' : ' elements') +
              '. Double-click text on the canvas to retype it.'
            : 'Edit this one in the code view.'));
      }
      body.appendChild(attrRow('Class', 'class', 'none'));
    });
  }

  // -------------------------------------------------------- raw declarations
  //
  // Everything the creator's rule for this selector says, property by
  // property — including whatever the sections above have no field for.

  function cssSection() {
    var list;
    var selectorLine;

    function selector() {
      var selection = C.selection();
      return selection && selection.target !== '@unique' ? selection.target + selection.state : null;
    }

    function blocked(prop, value) {
      return !!prop && window.JaiLint.analyse('x { ' + prop + ': ' + (value || 'initial') + '; }').length > 0;
    }

    function declRow(decl) {
      var wrap = h('div', 'decl');
      var name = textInput('property');
      var value = textInput('value');
      name.value = decl ? decl.prop : '';
      value.value = decl ? decl.value + (decl.important ? ' !important' : '') : '';
      if (decl && blocked(decl.prop, decl.value)) {
        wrap.classList.add('is-blocked');
        wrap.title = 'JanitorAI strips this declaration.';
      }
      var remove = h('button', 'prop-reset', '×');
      remove.type = 'button';
      remove.title = 'Remove this declaration';

      name.addEventListener('change', function () {
        var next = name.value.trim().toLowerCase();
        if (decl && next && next !== decl.prop.toLowerCase()) S.renameDeclaration(selector(), decl.prop, next);
        else if (!decl && next && value.value.trim()) C.writeStyle(next, value.value.trim());
      });
      value.addEventListener('change', function () {
        var prop = (decl ? decl.prop : name.value.trim().toLowerCase());
        if (!prop) return;
        C.writeStyle(prop, value.value.trim().replace(/;$/, '') || null);
      });
      value.addEventListener('keydown', function (e) { if (e.key === 'Enter') value.blur(); });
      remove.addEventListener('click', function () {
        if (decl) C.writeStyle(decl.prop, null);
        else wrap.parentNode.removeChild(wrap);
      });

      wrap.appendChild(name);
      wrap.appendChild(value);
      wrap.appendChild(remove);
      return wrap;
    }

    return section('css', 'CSS', function (body) {
      selectorLine = h('p', 'insp-rule');
      list = h('div');
      var add = h('button', 'btn btn-ghost btn-sm', 'Add property');
      add.type = 'button';
      add.addEventListener('click', function () {
        var fresh = declRow(null);
        list.appendChild(fresh);
        fresh.querySelector('input').focus();
      });
      var open = h('button', 'btn btn-ghost btn-sm', 'Open in code');
      open.type = 'button';
      open.title = 'Jump to this rule in the About Me code';
      open.style.marginLeft = '6px';
      open.addEventListener('click', function () {
        // Deliberately not styleSelector(): looking at the code must not be
        // what gives an element a class.
        var sel = selector();
        if (sel) S.addRuleStub(sel); else S.setDock(true, 'code');
      });
      body.appendChild(selectorLine);
      body.appendChild(list);
      body.appendChild(add);
      body.appendChild(open);

      syncers.push(function () {
        var sel = selector();
        var decls = sel ? S.ruleDeclarations(sel) : [];
        selectorLine.textContent = sel ? sel + ' { … }' : 'No rule yet — set any property to start one.';
        // Leave the list alone while one of its fields is being typed in.
        if (!list.contains(document.activeElement)) {
          list.innerHTML = '';
          decls.forEach(function (decl) { list.appendChild(declRow(decl)); });
        }
        return decls.length > 0;
      });
    });
  }

  // ------------------------------------------------------------------- head

  var ACTION_ICONS = {
    editText: '<path d="M3.5 4h9M8 4v8.5"/>',
    duplicate: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h2"/>',
    moveUp: '<path d="M8 13V3M4 7l4-4 4 4"/>',
    moveDown: '<path d="M8 3v10M4 9l4 4 4-4"/>',
    hide: '<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.8"/>',
    delete: '<path d="M3 4.5h10M6.5 4.5v-2h3v2M4.5 4.5l.5 9h6l.5-9"/>'
  };

  function actionButton(name, title, onClick, extraClass) {
    var button = h('button', 'icon-btn' + (extraClass ? ' ' + extraClass : ''));
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.dataset.action = name;
    button.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" ' +
      'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ACTION_ICONS[name] + '</svg>';
    button.addEventListener('click', onClick);
    return button;
  }

  function head(selection, node) {
    var box = h('div', 'insp-head');

    var ancestors = selection.chain.slice(0, 3).reverse();
    if (ancestors.length) {
      var crumbs = h('div', 'insp-crumbs');
      ancestors.forEach(function (ancestor) {
        var crumb = h('button', null, C.nameOf(ancestor) || ancestor.tag);
        crumb.type = 'button';
        crumb.title = 'Select this parent';
        crumb.addEventListener('click', function () { C.selectAncestor(ancestor); });
        crumbs.appendChild(crumb);
      });
      box.appendChild(crumbs);
    }

    var item = selection.kind === 'native'
      ? (window.JaiPageMap.find(selection.labels) || window.JaiPageMap.get(selection.selector)) : null;
    var title = h('div', 'insp-title-row' + (selection.kind === 'custom' ? ' is-custom' : ''));
    var glyph = h('span', 'layer-icon');
    glyph.innerHTML = window.JaiLayers.icon(node ? window.JaiLayers.iconForNode(node) : (item && item.icon) || 'box');
    title.appendChild(glyph);
    var name = h('strong', 'insp-title', selection.name);
    name.title = selection.name;
    title.appendChild(name);

    var actions = h('div', 'insp-actions');
    if (node) {
      actions.appendChild(actionButton('editText', 'Edit text (Enter)', function () { C.run('editText'); }));
      actions.appendChild(actionButton('moveUp', 'Move up (Alt+↑)', function () { C.run('moveUp'); }));
      actions.appendChild(actionButton('moveDown', 'Move down (Alt+↓)', function () { C.run('moveDown'); }));
      actions.appendChild(actionButton('duplicate', 'Duplicate (Ctrl+D)', function () { C.run('duplicate'); }));
    }
    var hide = actionButton('hide', 'Hide — sets display: none', function () {
      C.writeStyle('display', C.readStyle('display') === 'none' ? null : 'none');
    });
    actions.appendChild(hide);
    syncers.push(function () {
      hide.classList.toggle('is-on', C.readStyle('display') === 'none');
      return false;
    });
    if (node) {
      actions.appendChild(actionButton('delete', 'Delete (Del)', function () { C.run('delete'); }, 'is-danger'));
    }
    title.appendChild(actions);
    box.appendChild(title);

    // What the rule is written against, and for which state of the element.
    var target = h('div', 'insp-target');
    var selector = h('select');
    selector.id = 'insp-selector';
    selector.title = 'The selector these properties are written against';
    C.candidates().forEach(function (candidate) {
      var option = h('option', null, candidate.label);
      option.value = candidate.value;
      selector.appendChild(option);
    });
    selector.value = selection.target;
    selector.addEventListener('change', function () { C.setTarget(selector.value); });
    var state = h('select');
    state.id = 'insp-state';
    state.title = 'Style a state of the element, or one of its pseudo-elements';
    C.states.forEach(function (pair) {
      var option = h('option', null, pair[1]);
      option.value = pair[0];
      state.appendChild(option);
    });
    state.value = selection.state;
    state.addEventListener('change', function () { C.setState(state.value); });
    target.appendChild(selector);
    target.appendChild(state);
    box.appendChild(target);

    var hint = null;
    var shared = C.candidates().filter(function (c) { return c.value === selection.target; })[0];
    if (selection.absent) hint = 'Not on this profile right now, so the canvas cannot show it — but the rule is still written.';
    else if (selection.target === '@unique') hint = 'Gets a class of its own the first time you set a property, so nothing else changes with it.';
    else if (shared && shared.count > 1) hint = 'Shared by ' + shared.count + ' elements: a change here restyles all of them. Pick “This element only” for just this one.';
    else if (item && item.hint) hint = item.hint;
    if (hint) box.appendChild(h('p', 'insp-hint', hint));
    return box;
  }

  // ------------------------------------------------------------------ build

  var builtFor = null;

  function signature(selection) {
    var node = C.node();
    return [
      selection.kind, selection.jx, selection.selector, selection.locked, selection.absent,
      selection.target, selection.state, selection.name,
      selection.chain.length,
      C.candidates().map(function (c) { return c.label; }).join(','),
      node ? node.tag + ':' + node.children.length + ':' + node.void : ''
    ].join('|');
  }

  function sync() {
    syncers.forEach(function (fn) { fn(); });
  }

  function build(selection) {
    var node = C.node();
    var scroll = host.scrollTop;
    syncers = [];
    host.innerHTML = '';
    host.appendChild(head(selection, node));
    // The profile box, the character list and the row holding them: where they
    // sit is the first thing anyone selecting one of them wants to change.
    if (window.JaiPageLayout && window.JaiPageLayout.isTarget(selection)) host.appendChild(window.JaiPageLayout.section());
    if (node) host.appendChild(contentSection(node));
    host.appendChild(layoutSection(selection));
    host.appendChild(typeSection());
    host.appendChild(fillSection());
    host.appendChild(strokeSection());
    host.appendChild(effectsSection());
    host.appendChild(cssSection());
    host.scrollTop = scroll;
  }

  function update() {
    var selection = C.selection();
    page.hidden = !!selection;
    host.hidden = !selection;
    if (!selection) {
      builtFor = null;
      syncers = [];
      host.innerHTML = '';
      return;
    }
    var next = signature(selection);
    if (next !== builtFor) {
      build(selection);
      builtFor = next;
    }
    sync();

    var wanted = C.wantsFocus();
    var field = wanted && host.querySelector('input[data-attr="' + wanted + '"]');
    if (field) {
      C.clearFocus();
      var section = field.closest('details');
      if (section) section.open = true;
      field.focus();
      field.select();
    }
  }

  S.on('selection', update);
  // The document changed: same element, new values. `pushed` follows once the
  // preview has the change too, which is when computed values are current.
  S.on('change', function () { if (builtFor) update(); });
  S.on('pushed', function () {
    if (builtFor) window.setTimeout(function () { if (builtFor) sync(); }, 0);
  });

  update();
})();
