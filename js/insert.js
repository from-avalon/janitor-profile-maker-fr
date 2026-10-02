/*
 * The Insert panel: everything that can be added to a profile.
 *
 * Two kinds of thing live here, and they behave differently on purpose:
 *
 *   things — elements (js/blocks.js) and the pieces of community templates.
 *            They have a place on the page, so they are dragged to one; the
 *            preview shows a line for where they would land.
 *   looks  — styles (whole-profile CSS) and animations (a motion for whatever
 *            is selected). They have no place, so they are applied and taken
 *            off again.
 *
 * The lists of sections and styles are drawn by js/app.js, which owns the
 * template machinery; this file draws the element tiles and the animations,
 * and makes the draggable ones drag. The dropping is JaiCanvas's job.
 */
(function () {
  'use strict';

  var S = window.JaiStudio;
  var C = window.JaiCanvas;
  var B = window.JaiBlocks;

  // --------------------------------------------------------------- elements

  var host = document.getElementById('insert-list');
  var categories = [];
  B.list.forEach(function (block) {
    if (categories.indexOf(block.category) === -1) categories.push(block.category);
  });

  host.innerHTML = categories.map(function (category) {
    return '<h4 class="insert-cat">' + S.escapeHtml(category) + '</h4><div class="insert-grid">' +
      B.list.filter(function (block) { return block.category === category; }).map(function (block) {
        return '<button type="button" class="insert-tile" data-block="' + block.id + '" title="' +
          S.escapeHtml(block.name) + ' — drag onto the canvas, or click to add">' +
          block.icon + '<span>' + S.escapeHtml(block.name) + '</span></button>';
      }).join('') + '</div>';
  }).join('');

  function blockItem(block) {
    return { name: block.name, drop: function (ref, where) { C.insertBlock(block, ref, where); } };
  }

  host.addEventListener('pointerdown', function (e) {
    var tile = e.target.closest('.insert-tile');
    if (!tile || e.button !== 0) return;
    var block = B.get(tile.dataset.block);
    if (block) C.beginDrag(blockItem(block), e, tile);
  });

  /* Pointer presses do the inserting; this is the keyboard's way in. A click
   * with no pointer behind it has detail 0. */
  host.addEventListener('click', function (e) {
    var tile = e.target.closest('.insert-tile');
    if (!tile || e.detail !== 0) return;
    var block = B.get(tile.dataset.block);
    if (block) C.insertBlock(block);
  });

  // ------------------------------------------------------- template pieces
  //
  // A part with markup of its own can be dragged to a place on the canvas.
  // Its Add button still works, and puts it in the template's own order.

  document.getElementById('template-list').addEventListener('pointerdown', function (e) {
    var row = e.target.closest('.part.is-draggable');
    if (!row || e.button !== 0 || e.target.closest('button')) return;
    var part = window.JaiPresets.allParts().filter(function (p) { return p.id === row.dataset.part; })[0];
    if (!part) return;
    e.preventDefault();
    C.beginDrag({
      name: part.name,
      click: false,
      drop: function (ref, where) { C.insertPart(part, ref, where); }
    }, e, row);
  });

  // -------------------------------------------------------------- animations

  var animations = document.getElementById('animation-list');

  animations.innerHTML = B.animations.map(function (animation) {
    return '<button type="button" class="insert-tile insert-tile-toggle" data-animation="' + animation.id + '" title="' +
      S.escapeHtml(animation.name) + ' — give the selected element this motion">' +
      animation.icon + '<span>' + S.escapeHtml(animation.name) + '</span></button>';
  }).join('');
  document.getElementById('animation-count').textContent = B.animations.length;

  function current() {
    return C.selection() ? (C.readStyle('animation') || '') : '';
  }

  function syncAnimations() {
    var value = current();
    Array.prototype.forEach.call(animations.children, function (tile) {
      var animation = B.animations.filter(function (a) { return a.id === tile.dataset.animation; })[0];
      tile.classList.toggle('is-on', !!animation && value.indexOf(animation.key) !== -1);
    });
  }

  animations.addEventListener('click', function (e) {
    var tile = e.target.closest('.insert-tile');
    if (!tile) return;
    var animation = B.animations.filter(function (a) { return a.id === tile.dataset.animation; })[0];
    if (!animation) return;
    if (!C.selection()) {
      S.toast('Select something on the canvas first — the animation goes on that.');
      return;
    }
    if (current().indexOf(animation.key) !== -1) {
      // The @keyframes stay: another element may be using them.
      C.writeStyle('animation', null);
      S.toast(animation.name + ' removed.');
      return;
    }
    S.editCss(function (css) {
      if (css.indexOf('@keyframes ' + animation.key + ' ') !== -1) return css;
      return css + (css && !/\n\s*$/.test(css) ? '\n\n' : (css.trim() ? '\n' : '')) + animation.keyframes + '\n';
    }, 'inspector');
    C.writeStyle('animation', animation.value);
    S.toast(animation.name + ' on ' + C.selection().name + '. Tune its speed under Effects, or in the CSS list.');
  });

  S.on('selection', syncAnimations);
  S.on('change', syncAnimations);
})();
