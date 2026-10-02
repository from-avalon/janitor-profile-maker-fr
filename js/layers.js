/*
 * The Layers panel: the page as an outline.
 *
 * Two trees in one. JanitorAI's part is the curated outline in js/page-map.js —
 * the real DOM is thousands of anonymous wrappers, and a creator needs "Avatar",
 * not `div.css-79elbk`. The creator's part hangs under About Me and is read
 * straight from the document (js/markup.js), so it is always exactly what the
 * code says.
 *
 * Rows are rebuilt from scratch on every change; nothing here is state except
 * which branches are open.
 */
(function () {
  'use strict';

  var S = window.JaiStudio;
  var M = window.JaiMarkup;
  var C = window.JaiCanvas;
  var host = document.getElementById('layers');

  var ICONS = {
    page: '<rect x="3" y="2" width="10" height="12" rx="1.5"/>',
    frame: '<path d="M5 2v12M11 2v12M2 5h12M2 11h12"/>',
    text: '<path d="M3.5 4h9M8 4v8.5"/>',
    image: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1"/><path d="M2.5 11.5l3.5-3 2.5 2 2-1.5 3 2.5"/>',
    button: '<rect x="1.5" y="4.5" width="13" height="7" rx="3.5"/>',
    fill: '<rect x="3" y="3" width="10" height="10" rx="2"/><path d="M3 9l6-6M7 13l6-6"/>',
    link: '<path d="M6.5 9.5l3-3M5 7L3.5 8.5a2.1 2.1 0 003 3L8 10M11 9l1.5-1.5a2.1 2.1 0 00-3-3L8 6"/>',
    list: '<path d="M6 4h7M6 8h7M6 12h7M3 4h.01M3 8h.01M3 12h.01"/>',
    box: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/>',
    line: '<path d="M2 8h12"/>'
  };

  function icon(name) {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || ICONS.box) + '</svg>';
  }

  var TAG_ICONS = {
    img: 'image', a: 'link', hr: 'line', ul: 'list', ol: 'list',
    h1: 'text', h2: 'text', h3: 'text', h4: 'text', h5: 'text', h6: 'text', p: 'text',
    span: 'text', b: 'text', strong: 'text', i: 'text', em: 'text', small: 'text',
    li: 'text', summary: 'text', blockquote: 'text', figcaption: 'text'
  };

  function iconForNode(node) { return TAG_ICONS[node.tag] || 'box'; }

  // Which branches are open. JanitorAI's are keyed by selector; the creator's
  // by position ("0.2.1"), which survives edits elsewhere in the document.
  var open = { 'n:.pp-uc-background': true, 'n:.pp-uc-about-me': true };
  // The creator's branches start open unless they are long or generated — a
  // hardcoded roster is hundreds of rows nobody asked to see. true/false here
  // is the creator having closed or opened one by hand.
  var closedCustom = {};

  function customOpen(key, node) {
    if (closedCustom[key] != null) return !closedCustom[key];
    return !node.locked && node.children.length <= 12;
  }

  function frameDoc() {
    try { return S.frame.contentDocument; } catch { return null; }
  }

  function exists(selector) {
    var doc = frameDoc();
    if (!doc || !doc.body) return true;
    try { return selector === 'body' || !!doc.querySelector(selector); } catch { return false; }
  }

  /* A text layer is named by what it says, the way a design tool does it. */
  function customLabel(node, code) {
    var kind = M.describe(node, window.JaiBlocks.names);
    var text = node.children.length ? '' : M.text(code, node);
    if (text) return { name: text.length > 30 ? text.slice(0, 29) + '…' : text, meta: kind };
    return { name: kind, meta: node.classes.length ? '.' + node.classes[0] : node.tag };
  }

  function build() {
    var rows = [];
    var parsed = S.markup();
    var code = S.code();

    function custom(ids, depth, path) {
      ids.forEach(function (id, i) {
        var node = parsed.nodes[id];
        var key = path + i;
        var isOpen = customOpen(key, node);
        var label = customLabel(node, code);
        rows.push({
          kind: 'custom', key: key, id: id, node: node, depth: depth,
          name: label.name, meta: label.meta, icon: iconForNode(node),
          branch: node.children.length > 0, open: isOpen
        });
        if (node.children.length && isOpen) custom(node.children, depth + 1, key + '.');
      });
    }

    function native(items, depth) {
      items.forEach(function (item) {
        var key = 'n:' + item.sel;
        var branch = !!(item.children && item.children.length) || !!item.about;
        rows.push({
          kind: 'native', key: key, item: item, depth: depth,
          name: item.name, meta: item.sel, icon: item.icon || 'box',
          branch: branch, open: !!open[key], missing: !exists(item.sel)
        });
        if (!open[key]) return;
        if (item.children) native(item.children, depth + 1);
        if (item.about) {
          if (parsed.roots.length) custom(parsed.roots, depth + 1, '');
          else rows.push({ kind: 'empty', depth: depth + 1 });
        }
      });
    }

    native(window.JaiPageMap.tree, 0);
    return rows;
  }

  /* Whether the creator's CSS hides this row's element outright. */
  function isHidden(row) {
    if (row.kind === 'native') return S.readValue(row.item.sel, 'display') === 'none';
    return row.node.classes.some(function (cls) { return S.readValue('.' + cls, 'display') === 'none'; });
  }

  function isSelected(row, selection) {
    if (!selection) return false;
    if (row.kind === 'custom') return selection.kind === 'custom' && selection.jx === row.id;
    if (row.kind !== 'native' || selection.kind !== 'native') return false;
    if (selection.selector === row.item.sel) return true;
    return (selection.labels || []).some(function (c) { return '.' + c === row.item.sel; });
  }

  var rows = [];

  function render() {
    rows = build();
    var selection = C.selection();
    var anySelected = rows.some(function (row) { return isSelected(row, selection); });
    // Something was clicked that the outline has no row for: light up the
    // nearest thing it does have, so the panel still shows where you are.
    var fallback = null;
    if (selection && !anySelected && selection.kind === 'native') {
      (selection.chain || []).some(function (ancestor) {
        fallback = window.JaiPageMap.find(ancestor.labels);
        return !!fallback;
      });
    }

    host.innerHTML = rows.map(function (row, i) {
      if (row.kind === 'empty') {
        return '<div class="layer-empty" style="--depth:' + row.depth + '">Empty. Drag something in from Insert.</div>';
      }
      var cls = 'layer' +
        (row.kind === 'custom' ? ' is-custom' : '') +
        (isSelected(row, selection) ? ' is-selected' : '') +
        (fallback && row.kind === 'native' && row.item === fallback ? ' is-parent-selected' : '') +
        (isHidden(row) ? ' is-hidden' : '') +
        (row.missing ? ' is-missing' : '');
      var locked = row.kind === 'custom' && row.node.locked;
      return '<div class="' + cls + '" role="treeitem" data-row="' + i + '" style="--depth:' + row.depth + '"' +
        (row.missing ? ' title="Not on this profile right now — a rule for it can still be written."' : '') + '>' +
        '<button type="button" class="layer-caret' + (row.open ? ' is-open' : '') + '"' +
          (row.branch ? '' : ' disabled') + ' tabindex="-1" aria-label="Expand">›</button>' +
        '<span class="layer-icon">' + icon(row.icon) + '</span>' +
        '<span class="layer-name">' + S.escapeHtml(row.name) + '</span>' +
        (locked ? '<span class="layer-lock" title="Linked to Profile data — editing it here unlinks the layout">●</span>' : '') +
        '<span class="layer-meta">' + S.escapeHtml(row.meta) + '</span>' +
        '</div>';
    }).join('');
  }

  /* Opens whatever is in the way of the selected row, then brings it into view. */
  function revealSelection() {
    var selection = C.selection();
    if (!selection) return;
    if (selection.kind === 'custom') {
      open['n:.pp-uc-background'] = true;
      open['n:.pp-uc-about-me'] = true;
      // Walk up the document, re-opening each ancestor by its position.
      var parsed = S.markup();
      var path = [];
      for (var node = parsed.nodes[selection.jx]; node; node = parsed.nodes[node.parent]) {
        var siblings = node.parent === -1 ? parsed.roots : parsed.nodes[node.parent].children;
        path.unshift(siblings.indexOf(node.id));
        if (node.parent === -1) break;
      }
      for (var i = 1; i < path.length; i++) closedCustom[path.slice(0, i).join('.')] = false;
    } else {
      var item = window.JaiPageMap.find(selection.labels) || window.JaiPageMap.get(selection.selector);
      for (var parent = item && item.parent; parent; parent = parent.parent) open['n:' + parent.sel] = true;
    }
    render();
    var row = host.querySelector('.layer.is-selected');
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }

  function rowOf(target) {
    var node = target.closest ? target.closest('.layer') : null;
    return node ? rows[+node.dataset.row] : null;
  }

  function toggle(row) {
    if (row.kind === 'custom') closedCustom[row.key] = row.open;
    else open[row.key] = !row.open;
    render();
  }

  host.addEventListener('click', function (e) {
    var row = rowOf(e.target);
    if (!row) return;
    if (e.target.closest('.layer-caret')) { toggle(row); return; }
    if (suppressClick) { suppressClick = false; return; }
    if (S.state.mode !== 'design') S.setMode('design');
    if (row.kind === 'custom') C.selectCustom(row.id);
    else C.selectSelector(row.item.sel);
  });

  host.addEventListener('dblclick', function (e) {
    var row = rowOf(e.target);
    if (!row || e.target.closest('.layer-caret')) return;
    if (row.kind === 'custom') C.run('editText');
    else if (row.branch) toggle(row);
  });

  host.addEventListener('mouseover', function (e) {
    var row = rowOf(e.target);
    if (!row) return;
    S.post(row.kind === 'custom' ? { type: 'hover', jx: row.id } : { type: 'hover', selector: row.item.sel });
  });
  host.addEventListener('mouseleave', function () { S.post({ type: 'hover' }); });

  // ------------------------------------------------------------- reordering
  //
  // Dragging one of the creator's rows onto another moves the element in the
  // document: the top or bottom third of a row drops beside it, the middle of
  // a container drops into it.

  var suppressClick = false;

  function dropFor(row, e, dragged) {
    if (!row || row.kind === 'empty') return null;
    if (row.kind === 'native') {
      return row.item.about ? { ref: null, where: 'inside' } : null;
    }
    if (row.id === dragged.id) return null;
    var rect = host.querySelector('[data-row="' + rows.indexOf(row) + '"]').getBoundingClientRect();
    var t = (e.clientY - rect.top) / rect.height;
    if (M.canContain(row.node) && t > 0.3 && t < 0.7) return { ref: row.id, where: 'inside' };
    return { ref: row.id, where: t < 0.5 ? 'before' : 'after' };
  }

  host.addEventListener('pointerdown', function (down) {
    var row = rowOf(down.target);
    if (!row || row.kind !== 'custom' || down.button !== 0 || down.target.closest('.layer-caret')) return;
    var active = false;
    var drop = null;
    var marked = null;

    function mark(node, where) {
      if (marked) marked.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-inside');
      marked = node;
      if (node) node.classList.add('is-drop-' + where);
    }

    function move(e) {
      if (!active) {
        if (Math.abs(e.clientY - down.clientY) + Math.abs(e.clientX - down.clientX) < 6) return;
        active = true;
        document.body.classList.add('is-dragging-block');
      }
      var over = document.elementFromPoint(e.clientX, e.clientY);
      var target = over ? rowOf(over) : null;
      drop = dropFor(target, e, row);
      mark(drop ? over.closest('.layer') : null, drop ? drop.where : '');
    }

    function end() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      document.body.classList.remove('is-dragging-block');
      mark(null);
      if (!active) return;
      // The click that follows a drag must not also select the row under it.
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
      if (drop) C.move(row.id, drop.ref, drop.where);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  });

  S.on('selection', revealSelection);
  S.on('selection', function (selection) { if (!selection) render(); });
  S.on('change', render);
  // Which of JanitorAI's elements exist depends on the profile in the preview.
  S.on('pushed', render);
  S.on('panel', function (name) { if (name === 'layers') render(); });

  window.JaiLayers = { render: render, icon: icon, iconForNode: iconForNode };

  render();
})();
