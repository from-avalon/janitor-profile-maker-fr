/*
 * The canvas: what is selected, and what the gestures made on the preview do
 * to the document.
 *
 * The preview frame (preview/frame.js) only reports — "this was clicked",
 * "this was dropped there", "this now reads…". Everything it reports ends up
 * here, is turned into an edit of the About Me text through js/markup.js, and
 * goes back out through JaiStudio.setCode like any other change, which is what
 * makes a drag undoable and keeps the linter and the code view in step.
 *
 * Two kinds of thing can be selected:
 *   custom — an element the creator wrote, addressed by its number in the
 *            document (`jx`). It can be moved, retyped, duplicated, deleted.
 *   native — a piece of JanitorAI's own page, addressed by a label selector.
 *            It can only be restyled: the page's markup is not ours to edit.
 *
 * A layout generated from Profile data is custom markup like any other. It is
 * *linked* — rebuilt whenever Profile data changes — until the first hands-on
 * edit inside it, which unlinks it (see `unlink` in js/markup.js) rather than
 * being refused: the creator asked for the change, and Undo links it back.
 */
(function () {
  'use strict';

  var S = window.JaiStudio;
  var M = window.JaiMarkup;

  var selection = null;     // see describe() in preview/frame.js, plus name/chain/target/state
  var pendingSelect;        // id to select once the edit in flight has reached the preview
  var STATES = [
    ['', 'Default'], [':hover', 'Hover'], [':active', 'Pressed'], [':focus', 'Focused'],
    ['::before', '::before'], ['::after', '::after']
  ];

  var UNLINKED = 'Unlinked from Profile data — this layout is yours to edit by hand now. Ctrl+Z links it back.';

  function frameApi() {
    try { return S.frame.contentWindow.JaiFrame || null; } catch { return null; }
  }

  // --------------------------------------------------------------- naming

  function nodeOf(target) {
    return target && target.kind === 'custom' ? S.markup().nodes[target.jx] || null : null;
  }

  function nameOf(target) {
    if (!target) return '';
    if (target.kind === 'custom') {
      var node = nodeOf(target);
      return node ? M.describe(node, window.JaiBlocks.names) : 'Element';
    }
    if (target.selector === 'body') return 'Page';
    return window.JaiPageMap.nameFor(target.labels, target.selector || target.tag);
  }

  // ------------------------------------------------------------- selection

  function sameTarget(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    return a.kind === 'custom' ? a.jx === b.jx : a.selector === b.selector;
  }

  /*
   * The selectors a rule for this element could be written against.
   *
   * For JanitorAI's elements those are its label classes. For the creator's
   * own, each class it carries — with a count, because a class shared by seven
   * tiles restyles all seven — plus "this element only", which gives it a
   * class of its own the first time a property is set.
   */
  function candidates(target) {
    target = target || selection;
    if (!target) return [];
    var out = [];
    var seen = {};
    function add(value, label, count) {
      if (seen[value]) return;
      seen[value] = true;
      out.push({ value: value, label: label || value, count: count || 0 });
    }
    if (target.kind === 'custom') {
      var node = nodeOf(target);
      var parsed = S.markup();
      var hasOwn = false;
      (node ? node.classes : []).forEach(function (cls) {
        var count = M.classCount(parsed, cls);
        if (count === 1) hasOwn = true;
        add('.' + cls, '.' + cls + (count > 1 ? '  ·  all ' + count : ''), count);
      });
      // A generated element cannot keep a class of its own: the next rebuild
      // from Profile data would drop it.
      if (!hasOwn && !(node && node.locked)) add('@unique', 'This element only');
      // With no class at all there is still its place in the markup: the tag,
      // inside the nearest ancestor that does have a class.
      if (node && !node.classes.length) {
        var scope = '.pp-uc-about-me';
        for (var up = parsed.nodes[node.parent]; up; up = parsed.nodes[up.parent]) {
          if (up.classes.length) { scope = '.' + up.classes[0]; break; }
        }
        var structural = scope + ' ' + node.tag;
        var matches = 0;
        try { matches = S.frame.contentDocument.querySelectorAll(structural).length; } catch { /* preview not ready */ }
        add(structural, structural + (matches > 1 ? '  ·  all ' + matches : ''), matches);
      }
      return out;
    }
    if (target.selector) add(target.selector);
    (target.labels || []).forEach(function (c) { add('.' + c); });
    (target.others || []).forEach(function (c) { add('.' + c); });
    return out;
  }

  /*
   * What a first edit is written against. For the creator's own elements that
   * is a class belonging to this element alone — one it already has, or one it
   * will be given — so changing one thing never quietly restyles its siblings;
   * the shared classes stay a choice in the list. A block's base class
   * (`jx-heading`) is passed over even while only one heading exists: the
   * second would silently inherit everything set on it.
   */
  function defaultTarget(target) {
    var list = candidates(target);
    if (target.kind !== 'custom') return list.length ? list[0].value : target.selector;
    var own = list.filter(function (c) {
      return c.count === 1 && /^\.[\w-]+$/.test(c.value) && !window.JaiBlocks.names[c.value.slice(1)];
    })[0];
    if (own) return own.value;
    var unique = list.filter(function (c) { return c.value === '@unique'; })[0];
    return unique || !list.length ? '@unique' : list[0].value;
  }

  function setSelection(target, chain) {
    var previous = selection;
    if (!target) {
      selection = null;
    } else {
      selection = target;
      // JanitorAI wraps everything in several labelled containers. Only the
      // ancestors with a name of their own are worth showing or climbing to;
      // `depth` remembers where each one sits in the frame's full list.
      // The nearest few as the frame gave them, named or not: where a slide's
      // offset is looked for (see moved()).
      selection.near = (chain || []).slice(0, 3);
      selection.chain = (chain || []).map(function (ancestor, depth) {
        ancestor.depth = depth;
        return ancestor;
      }).filter(function (ancestor) {
        return ancestor.kind === 'custom' || ancestor.selector === 'body' ||
          !!window.JaiPageMap.find(ancestor.labels);
      });
      selection.name = nameOf(target);
      var keep = sameTarget(previous, target);
      selection.state = keep ? previous.state : '';
      selection.target = keep && candidates(target).some(function (c) { return c.value === previous.target; })
        ? previous.target : defaultTarget(target);
      S.post({ type: 'label', text: selection.name + (selection.locked ? ' · from Profile data' : '') });
    }
    document.querySelector('.layout').classList.toggle('has-selection', !!selection);
    renderPath();
    S.emit('selection', selection);
  }

  function renderPath() {
    var path = document.getElementById('status-path');
    if (!selection) { path.textContent = ''; return; }
    var names = selection.chain.slice(0, 4).reverse().map(nameOf).filter(Boolean);
    names.push(selection.name);
    path.textContent = names.join(' › ');
  }

  function clear() {
    if (selection) S.post({ type: 'select', silent: true });
    setSelection(null);
  }

  /* Asks the preview to select; its answer (with the element's ancestors) is
   * what actually sets the selection, so there is one path for it. */
  function selectCustom(id) {
    S.post({ type: 'select', jx: id, reveal: true });
  }

  function selectSelector(selector, labels) {
    var api = frameApi();
    if (api && api.resolve({ selector: selector })) {
      S.post({ type: 'select', selector: selector, reveal: true });
      return;
    }
    // Not on the page right now (a badge this profile does not have, say), but
    // a rule for it can still be written.
    S.post({ type: 'select', silent: true });
    setSelection({
      kind: 'native', jx: null, locked: false, tag: '', selector: selector,
      labels: labels || (selector[0] === '.' ? [selector.slice(1)] : []), others: [], modules: [],
      absent: true
    }, []);
  }

  S.on('frame:select', function (m) {
    setSelection(m.target, m.chain);
  });

  // The preview was rebuilt from a different profile: nothing in it is the
  // element that was selected.
  S.on('frame:connected', function () { setSelection(null); });

  S.on('change', function () {
    if (pendingSelect !== undefined) {
      var id = pendingSelect;
      pendingSelect = undefined;
      if (id == null) clear(); else selectCustom(id);
      return;
    }
    if (!selection || selection.kind !== 'custom') return;
    // The document changed under the selection (typing in the code view, a
    // template being added). Keep it if the element is still there.
    var node = nodeOf(selection);
    if (!node || node.tag !== selection.tag) { clear(); return; }
    S.post({ type: 'select', jx: selection.jx, silent: true });
    S.post({ type: 'label', text: selection.name });
  });

  // ------------------------------------------------------------------ edits

  /* Applies an edit from js/markup.js and moves the selection to wherever the
   * element ended up (or clears it, if the edit removed the element). */
  function commit(result) {
    if (!result || result.payload === S.code()) return false;
    pendingSelect = result.id;
    S.setCode(result.payload, 'canvas', { now: true });
    return true;
  }

  /*
   * The document an edit should be made against: the current one, or — when
   * the edit reaches into a layout linked to Profile data — the same one with
   * that layout unlinked. Element ids are the same in both, so whatever the
   * canvas reported still points at the right things.
   */
  var unlinkedForEdit = false;

  function documentFor(touchesLinked) {
    var code = S.code();
    unlinkedForEdit = !!touchesLinked && M.isLinked(code);
    return unlinkedForEdit ? M.unlink(code) : code;
  }

  /* Call after the edit has been committed; says so once if it unlinked. */
  function announceUnlink() {
    if (unlinkedForEdit) S.toast(UNLINKED);
    var did = unlinkedForEdit;
    unlinkedForEdit = false;
    return did;
  }

  function customNode() {
    return selection && selection.kind === 'custom' ? nodeOf(selection) : null;
  }

  /* An explicit "make this mine": the same unlink, without waiting for an edit. */
  function unlinkNow() {
    var code = S.code();
    if (!M.isLinked(code)) return;
    pendingSelect = selection && selection.kind === 'custom' ? selection.jx : undefined;
    S.setCode(M.unlink(code), 'canvas', { now: true });
    S.toast(UNLINKED);
  }

  /*
   * A copy that looks like the original and is then free of it. The classes
   * the studio gave single elements (which is where per-element styling lives)
   * are renamed in the copy, and their rules copied under the new names — so
   * the duplicate starts identical, and restyling it leaves the original alone.
   * Classes the creator named themselves are shared on purpose and stay shared.
   */
  function duplicateStyled(code, id) {
    var parsed = M.parse(code);
    var node = parsed.nodes[id];
    var renames = {};
    var taken = code;

    function rename(cls) {
      if (!cls || renames[cls] || !M.isInstanceClass(cls)) return;
      renames[cls] = M.uniqueClass(taken);
      taken += ' ' + renames[cls];
    }

    // An element's `id` can be one of those names too (Tabs pair an id with the
    // `:target` rule that reads it). Two copies sharing an id would answer to
    // the same link, so the id is renamed along with the rules and the hrefs.
    (function collect(n) {
      n.classes.forEach(rename);
      rename(M.attrValue(n, 'id'));
      n.children.forEach(function (child) { collect(parsed.nodes[child]); });
    })(node);

    var html = code.slice(node.start, node.end)
      .replace(/(\bclass\s*=\s*")([^"]*)(")/gi, function (all, open, value, close) {
        return open + value.split(/(\s+)/).map(function (token) { return renames[token] || token; }).join('') + close;
      })
      .replace(/(\b(?:id|href)\s*=\s*")(#?)([^"]*)(")/gi, function (all, open, hash, value, close) {
        return renames[value] ? open + hash + renames[value] + close : all;
      });
    var result = M.insert(code, html, node.id, 'after');

    var copies = [];
    var names = Object.keys(renames);
    if (names.length) {
      var matcher = new RegExp('([.#])(' + names.join('|') + ')(?![\\w-])', 'g');
      window.CssModel.parse(window.JaiPayload.allCss(code)).forEach(function (rule) {
        if (rule.type !== 'rule' || (rule.atPath && rule.atPath.length) || rule.body == null) return;
        matcher.lastIndex = 0;
        if (!matcher.test(rule.selectorRaw)) return;
        var selector = rule.selectorRaw.replace(matcher, function (all, mark, cls) { return mark + renames[cls]; });
        copies.push(selector + ' {' + rule.body.replace(/\s+$/, '') + '\n}\n');
      });
    }
    if (copies.length) {
      result.payload = window.JaiPayload.editCss(result.payload, function (css) {
        return css + (css && !/\n\s*$/.test(css) ? '\n\n' : (css.trim() ? '\n' : '')) + copies.join('\n');
      });
    }
    return result;
  }

  function requestEdit(id) {
    var code = S.code();
    var node = M.parse(code).nodes[id];
    if (!node) return;
    if (node.void) { S.toast('Nothing to type in a <' + node.tag + '> — set it up in the properties panel.'); return; }
    if (!M.editable(code, node)) {
      S.toast('This element holds a stylesheet or a marker comment; edit its text in the code view.');
      S.setDock(true, 'code');
      return;
    }
    if (node.locked) {
      // Typing into a linked layout: unlink it first, so what is typed stays.
      pendingSelect = id;
      S.setCode(M.unlink(code), 'canvas', { now: true });
      S.toast(UNLINKED);
    }
    S.post({ type: 'editText', jx: id });
  }

  function move(id, ref, where) {
    var parsed = S.markup();
    var node = parsed.nodes[id];
    if (!node) return false;
    var code = documentFor(node.locked || M.landsInLock(parsed, ref, where));
    var done = commit(M.move(code, id, ref, where));
    if (done) announceUnlink();
    return done;
  }

  /* An edit to the selected element's markup made from the properties panel
   * (its text, a link, an image address). Debounced like typing, unless it had
   * to unlink the layout first. */
  function editMarkup(fn) {
    var node = customNode();
    if (!node) return;
    var code = documentFor(node.locked);
    var result = fn(code, node.id);
    if (!result || result.payload === S.code()) return;
    if (unlinkedForEdit) {
      pendingSelect = node.id;
      S.setCode(result.payload, 'inspector', { now: true });
      announceUnlink();
    } else {
      S.setCode(result.payload, 'inspector');
    }
  }

  var commands = {
    delete: function () {
      var node = customNode();
      if (node && commit(M.remove(documentFor(node.locked), node.id))) announceUnlink();
    },
    duplicate: function () {
      var node = customNode();
      if (node && commit(duplicateStyled(documentFor(node.locked), node.id))) announceUnlink();
    },
    moveUp: function () {
      var node = customNode();
      if (node && commit(M.nudge(documentFor(node.locked), node.id, -1))) announceUnlink();
    },
    moveDown: function () {
      var node = customNode();
      if (node && commit(M.nudge(documentFor(node.locked), node.id, 1))) announceUnlink();
    },
    editText: function () {
      if (!selection) return;
      if (selection.kind === 'custom') requestEdit(selection.jx);
      else S.post({ type: 'editValue' });
    },
    changeImage: function () {
      // The address field in the properties panel is where an image is set.
      focusRequest = 'src';
      S.emit('selection', selection);
    },
    selectParent: function () {
      if (!selection) return;
      if (selection.chain.length) S.post({ type: 'select', depth: selection.chain[0].depth });
      else clear();
    },
    hide: function () { writeStyle('display', 'none'); },
    resetPosition: function () {
      var sel = moved();
      if (!sel) return;
      // Only what a slide writes: an offset the creator typed for an element
      // that was already positioned some other way is theirs to keep.
      var values = { left: null, top: null };
      if (S.readValue(sel, 'position') === 'relative') values.position = null;
      if (S.readValue(sel, 'right') === 'auto') values.right = null;
      if (S.readValue(sel, 'bottom') === 'auto') values.bottom = null;
      if (S.readValue(sel, 'z-index') === '5') values['z-index'] = null;
      S.writeValues(sel, values);
    },
    unlink: unlinkNow,
    profileData: function () { S.showPanel('info'); },
    addCharacter: function () { S.addCharacter(); },
    deselect: clear
  };

  function run(name) {
    if (commands[name]) commands[name]();
  }

  S.on('frame:command', function (m) { run(m.name); });
  S.on('frame:requestEdit', function (m) { requestEdit(m.jx); });
  S.on('frame:move', function (m) { move(m.jx, m.ref, m.where); });

  S.on('frame:textEdit', function (m) {
    var node = S.markup().nodes[m.jx];
    if (!node || !M.editable(S.code(), node)) return;
    commit(M.setInner(S.code(), m.jx, m.html));
  });

  S.on('frame:resize', function (m) {
    if (!selection) return;
    if (m.width) writeStyle('width', m.width);
    if (m.height) writeStyle('height', m.height);
  });

  /* The selector carrying a slide's offset, if the selection has been slid
   * from where the page put it. A press lands on a button's label and the
   * slide moves the button's wrapper, so the offset may sit a step or two up
   * from what is selected; Reset position has to find it there. */
  function moved() {
    if (!selection) return null;
    function has(sel) {
      return !!sel && sel !== '@unique' && (S.readValue(sel, 'left') != null || S.readValue(sel, 'top') != null);
    }
    if (has(selection.target + selection.state)) return selection.target + selection.state;
    var near = selection.near || [];
    for (var i = 0; i < near.length; i++) {
      if (near[i].kind !== 'custom' && has(near[i].selector)) return near[i].selector;
    }
    return null;
  }

  var slideHintShown = false;

  /* An element dragged to a new spot on the canvas (see "sliding" in
   * preview/frame.js). Written as one change, so Undo puts it straight back. */
  S.on('frame:slide', function (m) {
    if (!selection) return;
    var values = {};
    if (m.position) values.position = m.position;
    if (m.out) { values.right = 'auto'; values.bottom = 'auto'; }
    values.left = m.left;
    values.top = m.top;
    // Dropped beneath something else: lift it, so it can be seen and picked up
    // again. (Where the page's own stacking keeps it under regardless, it is
    // still selected, still draggable, and listed under right-click → Select.)
    var lifted = m.covered && readStyle('z-index') == null;
    if (lifted) values['z-index'] = '5';
    S.writeValues(styleSelector(), values);
    if (m.covered) {
      S.toast('That landed under something else' + (lifted ? ', so it was brought to the front' : '') +
        '. Click the same spot again to reach what is underneath.');
    } else if (!slideHintShown) {
      slideHintShown = true;
      S.toast('Moved. Right-click it and choose Reset position to put it back.');
    }
  });

  /* "Select ▸": everything under the right-click, topmost first, by name. */
  function stackMenu(stack) {
    return (stack || []).map(function (entry, i) {
      return {
        label: (entry.current ? '● ' : '') + nameOf(entry),
        disabled: !!entry.current,
        action: function () { S.post({ type: 'select', stack: i }); }
      };
    });
  }

  // ------------------------------------------------------------ right-click
  //
  // The preview says what was right-clicked and where "here" is; the menu is
  // drawn in the studio (js/menu.js), full size whatever the canvas zoom.

  var QUICK_BLOCKS = ['text', 'heading', 'image', 'box', 'button'];

  /* "Add here ▸": the everyday blocks first, the rest by category. */
  function addMenu(drop) {
    var B = window.JaiBlocks;
    function entry(block) {
      return { label: block.name, action: function () { insertBlock(block, drop ? drop.ref : null, drop ? drop.where : 'inside'); } };
    }
    var items = QUICK_BLOCKS.map(function (id) { return entry(B.get(id)); });
    items.push(null);
    var categories = [];
    B.list.forEach(function (block) {
      if (categories.indexOf(block.category) === -1) categories.push(block.category);
    });
    categories.forEach(function (category) {
      items.push({
        label: category === 'Shapes' ? 'Shapes' : 'All ' + category.toLowerCase(),
        items: B.list.filter(function (block) { return block.category === category; }).map(entry)
      });
    });
    items.push(null);
    items.push({ label: 'Everything in Insert…', action: function () { S.showPanel('insert'); } });
    return items;
  }

  var previewImageInput = document.getElementById('preview-image-input');
  var previewImageKey = null;

  /* The avatar and the page background are preview data, not part of the
   * document: a picture picked for either is read locally and never leaves
   * the browser. */
  previewImageInput.addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file || !previewImageKey) return;
    var key = previewImageKey;
    var reader = new FileReader();
    reader.onload = function () { S.setData(key, reader.result); };
    reader.readAsDataURL(file);
  });

  S.on('frame:context', function (m) {
    var items = [];
    var node = customNode();
    var design = S.state.mode === 'design';

    if (design && node) {
      if (!node.void) items.push({ label: 'Edit text', hint: 'Enter', action: function () { run('editText'); } });
      if (node.tag === 'img') items.push({ label: 'Change image…', action: function () { run('changeImage'); } });
      items.push({ label: 'Add here', items: addMenu(m.drop) });
      items.push(null);
      items.push({ label: 'Duplicate', hint: 'Ctrl D', action: function () { run('duplicate'); } });
      items.push({ label: 'Move up', hint: 'Alt ↑', action: function () { run('moveUp'); } });
      items.push({ label: 'Move down', hint: 'Alt ↓', action: function () { run('moveDown'); } });
      items.push(null);
      if (node.locked) {
        items.push({ label: 'Add a character…', action: function () { run('addCharacter'); } });
        items.push({ label: 'Edit in Profile data', action: function () { run('profileData'); } });
        items.push({ label: 'Unlink from Profile data', action: function () { run('unlink'); } });
        items.push(null);
      }
      items.push({ label: 'Select parent', hint: 'Esc', action: function () { run('selectParent'); } });
      if (m.stack && m.stack.length > 1) items.push({ label: 'Select', items: stackMenu(m.stack) });
      if (moved()) items.push({ label: 'Reset position', action: function () { run('resetPosition'); } });
      items.push({ label: 'Hide', action: function () { run('hide'); } });
      items.push({ label: 'Delete', hint: 'Del', danger: true, action: function () { run('delete'); } });
    } else if (design) {
      items.push({ label: 'Add to About Me', items: addMenu(m.drop) });
      if (selection) {
        items.push(null);
        items.push({ label: 'Select parent', hint: 'Esc', action: function () { run('selectParent'); } });
        if (m.stack && m.stack.length > 1) items.push({ label: 'Select', items: stackMenu(m.stack) });
        if (moved()) items.push({ label: 'Reset position', action: function () { run('resetPosition'); } });
        items.push({ label: 'Hide element', action: function () { run('hide'); } });
      }
    }

    // Where the profile box and the character list sit is one click from
    // anywhere on the page, not something to hunt for in a panel.
    if (design && window.JaiPageLayout) {
      if (items.length) items.push(null);
      window.JaiPageLayout.menuItems().forEach(function (item) { items.push(item); });
    }

    if (m.image) {
      if (items.length) items.push(null);
      items.push({
        label: 'Change preview ' + (m.image === 'avatar' ? 'avatar…' : 'background…'),
        action: function () { previewImageKey = m.image; previewImageInput.click(); }
      });
      if (m.image === 'background' && S.state.data.background) {
        items.push({ label: 'Remove preview background', action: function () { S.setData('background', ''); } });
      }
    }

    var rect = S.frame.getBoundingClientRect();
    var scale = S.scale();
    window.JaiMenu.open(rect.left + m.x * scale, rect.top + m.y * scale, items);
  });

  // ----------------------------------------------------------------- styles

  /* The selector a property set now would be written against. Giving the
   * element a class of its own is deferred to this moment, so merely clicking
   * through elements never changes the document. */
  function styleSelector() {
    if (!selection) return null;
    if (selection.target === '@unique') {
      var cls = M.uniqueClass(S.code());
      pendingSelect = selection.jx;
      selection.target = '.' + cls;
      S.setCode(M.addClass(S.code(), selection.jx, cls).payload, 'inspector', { now: true });
    }
    return selection.target + selection.state;
  }

  function readStyle(prop) {
    if (!selection || selection.target === '@unique') return undefined;
    return S.readValue(selection.target + selection.state, prop);
  }

  function writeStyle(prop, value) {
    if (!selection) return;
    var removing = value == null || value === '';
    if (removing && selection.target === '@unique') return;
    S.writeValue(styleSelector(), prop, removing ? null : value);
  }

  /* What the browser actually resolved for the selected element — shown as
   * the greyed placeholder behind a property nobody has set. */
  function computed(prop) {
    var api = frameApi();
    var node = api && api.selected();
    if (!node || !selection) return '';
    var pseudo = /^::/.test(selection.state) ? selection.state : null;
    if (selection.state && !pseudo) return '';
    try {
      return S.frame.contentWindow.getComputedStyle(node, pseudo).getPropertyValue(prop) || '';
    } catch { return ''; }
  }

  function setTarget(value) {
    if (!selection) return;
    selection.target = value;
    S.emit('selection', selection);
  }

  function setState(value) {
    if (!selection) return;
    selection.state = value || '';
    S.emit('selection', selection);
  }

  // -------------------------------------------------------------- inserting

  var focusRequest = null;    // a properties field to put the caret in once the selection arrives

  /* Where something added with no drop point goes: after the selected element,
   * into it when that is an empty container, otherwise the end of About Me. */
  function defaultSpot() {
    var node = customNode();
    if (!node) return { ref: null, where: 'inside' };
    var empty = M.canContain(node) && !node.children.length && !M.text(S.code(), node);
    return { ref: node.id, where: empty ? 'inside' : 'after' };
  }

  /*
   * Adds a block from the Insert panel: its markup at the drop point, and its
   * starting rules to the stylesheet the first time that kind of block is used.
   * `opts.src` fills in an image's address.
   */
  function insertBlock(block, ref, where, opts) {
    if (ref === undefined) {
      var spot = defaultSpot();
      ref = spot.ref;
      where = spot.where;
    }
    var code = documentFor(M.landsInLock(S.markup(), ref, where));
    var given = window.JaiBlocks.tokens(block, code);
    var html = window.JaiBlocks.instantiate(block, code, given);
    if (opts && opts.src) html = html.split(window.JaiBlocks.placeholderImage).join(M.escapeAttr(opts.src));
    var result = M.insert(code, html, ref, where);
    result.payload = window.JaiPayload.editCss(result.payload, function (css) {
      return window.JaiBlocks.addCss(css, block, given);
    });
    if (!commit(result)) return;
    // An image is no use until it points at the creator's own picture, so the
    // caret goes straight to its address field.
    var needsAddress = block.id === 'image' && !(opts && opts.src);
    if (needsAddress) focusRequest = 'src';
    if (announceUnlink()) return;
    S.toast(needsAddress
      ? 'Image added — paste its address on the right. It has to be a picture that is online.'
      : block.name + ' added.' + (block.hint ? ' ' + block.hint : ''));
  }

  /* A piece of a template (js/templates.js): its markup where it was dropped,
   * its stylesheet and whatever it depends on alongside. */
  function insertPart(comp, ref, where) {
    if (ref === undefined) {
      var spot = defaultSpot();
      ref = spot.ref;
      where = spot.where;
    }
    var code = documentFor(M.landsInLock(S.markup(), ref, where));
    if (commit(S.placePart(code, comp, ref, where))) {
      if (!announceUnlink()) S.toast(comp.name + ' added.');
    }
  }

  /* A link dropped or pasted onto the canvas. If it loads as a picture it
   * becomes an Image element; nothing else is guessed at. */
  function addImageLink(url, ref, where) {
    var probe = new Image();
    probe.onload = function () { insertBlock(window.JaiBlocks.get('image'), ref, where, { src: url }); };
    probe.onerror = function () { S.toast('That link did not load as an image, so nothing was added.'); };
    probe.src = url;
  }

  var NEEDS_HOSTING = 'JanitorAI can only show pictures that are online. Upload it somewhere first ' +
    '(your JanitorAI media library, Catbox, Imgur…), then drop or paste its link.';

  S.on('frame:dropLink', function (m) {
    if (/^https?:\/\//i.test(m.url || '')) addImageLink(m.url, m.ref, m.where);
    else S.toast(m.files ? NEEDS_HOSTING : 'Nothing to add from that.');
  });

  S.on('frame:pasteLink', function (m) { addImageLink(m.url); });

  document.addEventListener('paste', function (e) {
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var text = (e.clipboardData ? e.clipboardData.getData('text/plain') : '').trim();
    if (!/^https?:\/\/\S+$/i.test(text)) return;
    e.preventDefault();
    addImageLink(text);
  });

  var dragged = null;

  /*
   * Starts a drag out of the Insert panel. `item` is { name, drop(ref, where),
   * click }: a press that never moves is a click (and calls drop() with no
   * position, unless `click` is false); one that moves becomes a drag onto the
   * canvas, with the preview showing where the thing would land.
   */
  function beginDrag(item, down, source) {
    var ghost = document.getElementById('drag-ghost');
    var active = false;
    var raf = null;
    var last = null;

    function framePoint(event) {
      var rect = S.frame.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) return null;
      var scale = S.scale();
      return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
    }

    function move(event) {
      if (!active) {
        if (Math.abs(event.clientX - down.clientX) + Math.abs(event.clientY - down.clientY) < 6) return;
        active = true;
        dragged = item;
        document.body.classList.add('is-dragging-block');
        ghost.textContent = item.name;
        ghost.hidden = false;
        if (S.state.mode !== 'design') S.setMode('design');
      }
      ghost.style.transform = 'translate(' + (event.clientX + 12) + 'px, ' + (event.clientY + 14) + 'px)';
      last = framePoint(event);
      if (raf) return;
      raf = window.requestAnimationFrame(function () {
        raf = null;
        S.post(last ? { type: 'probe', x: last.x, y: last.y } : { type: 'probe', x: null });
      });
    }

    function stop() {
      source.removeEventListener('pointermove', move);
      source.removeEventListener('pointerup', end);
      source.removeEventListener('pointercancel', cancel);
      document.body.classList.remove('is-dragging-block');
      ghost.hidden = true;
      if (raf) { window.cancelAnimationFrame(raf); raf = null; }
    }

    function end(event) {
      stop();
      if (!active) {
        if (item.click !== false) item.drop();
        return;
      }
      var point = framePoint(event);
      // The frame answers a committed probe with 'insertAt'.
      if (point) S.post({ type: 'probe', x: point.x, y: point.y });
      S.post({ type: 'probeEnd', commit: !!point });
      if (!point) dragged = null;
    }

    function cancel() {
      stop();
      dragged = null;
      S.post({ type: 'probeEnd', commit: false });
    }

    try { source.setPointerCapture(down.pointerId); } catch { /* synthetic events have no pointer to capture */ }
    source.addEventListener('pointermove', move);
    source.addEventListener('pointerup', end);
    source.addEventListener('pointercancel', cancel);
  }

  S.on('frame:insertAt', function (m) {
    var item = dragged;
    dragged = null;
    if (item) item.drop(m.ref, m.where);
  });

  // --------------------------------------------------------------- keyboard

  function handleKey(key, mods) {
    var k = key.length === 1 ? key.toLowerCase() : key;
    if (mods.ctrl) {
      if (k === 'z') { if (mods.shift) S.redo(); else S.undo(); return true; }
      if (k === 'y') { S.redo(); return true; }
      if (k === 'd') { run('duplicate'); return true; }
      if (k === '\\') { S.toggleUi(); return true; }
      return false;
    }
    if (mods.alt) {
      if (k === 'ArrowUp') { run('moveUp'); return true; }
      if (k === 'ArrowDown') { run('moveDown'); return true; }
      return false;
    }
    if (k === 'v') { S.setMode('design'); return true; }
    if (k === 'p') { S.setMode('preview'); return true; }
    if (S.state.mode !== 'design') {
      if (k === 'Escape') { S.setMode('design'); return true; }
      return false;
    }
    if (k === 'Delete' || k === 'Backspace') { run('delete'); return true; }
    if (k === 'Escape') { run('selectParent'); return true; }
    if (k === 'Enter') { run('editText'); return true; }
    return false;
  }

  S.on('frame:key', function (m) {
    handleKey(m.key, { ctrl: m.ctrl, shift: m.shift, alt: m.alt });
  });

  /* The same shortcuts when focus is in the studio rather than the preview —
   * but never while typing in a field, where these keys mean something else. */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (typing || document.querySelector('dialog[open]')) return;
    if (handleKey(e.key, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey })) {
      e.preventDefault();
    }
  });

  window.JaiCanvas = {
    selection: function () { return selection; },
    node: function () { return nodeOf(selection); },
    nameOf: nameOf,
    states: STATES,
    candidates: candidates,
    selectCustom: selectCustom,
    selectSelector: selectSelector,
    selectAncestor: function (ancestor) { S.post({ type: 'select', depth: ancestor.depth }); },
    clear: clear,
    run: run,
    commit: commit,
    move: move,
    editMarkup: editMarkup,
    unlink: unlinkNow,
    wantsFocus: function () { return focusRequest; },
    clearFocus: function () { focusRequest = null; },
    readStyle: readStyle,
    writeStyle: writeStyle,
    computed: computed,
    setTarget: setTarget,
    setState: setState,
    insertBlock: insertBlock,
    insertPart: insertPart,
    beginDrag: beginDrag
  };
})();
