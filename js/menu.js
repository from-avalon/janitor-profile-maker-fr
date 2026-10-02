/*
 * A small pop-up menu, used for the canvas's right-click.
 *
 * It lives in the studio rather than in the preview on purpose: the preview is
 * drawn at whatever zoom the canvas is at, and a menu inside it would shrink
 * to a third of its size at 37%. Here it is always full size, and it can be as
 * tall as the window rather than as the frame.
 *
 * JaiMenu.open(x, y, items) — each item is null (a separator) or
 *   { label, hint, action, items: [submenu], danger, disabled }.
 */
(function () {
  'use strict';

  var backdrop = null;
  var stack = [];          // open menus, outermost first

  function close() {
    stack.forEach(function (menu) { menu.remove(); });
    stack = [];
    if (backdrop) { backdrop.remove(); backdrop = null; }
    document.removeEventListener('keydown', onKey, true);
  }

  function closeFrom(depth) {
    while (stack.length > depth) stack.pop().remove();
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }

  function place(menu, x, y, avoid) {
    document.body.appendChild(menu);
    var w = menu.offsetWidth;
    var h = menu.offsetHeight;
    // A submenu that would run off the right edge opens to the left of its parent.
    if (avoid && x + w > window.innerWidth - 6) x = avoid.left - w + 4;
    menu.style.left = Math.max(6, Math.min(x, window.innerWidth - w - 6)) + 'px';
    menu.style.top = Math.max(6, Math.min(y, window.innerHeight - h - 6)) + 'px';
  }

  function build(items, depth) {
    var menu = document.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'menu');

    items.forEach(function (item) {
      if (!item) {
        var sep = document.createElement('div');
        sep.className = 'menu-sep';
        menu.appendChild(sep);
        return;
      }
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'menu-item' + (item.danger ? ' is-danger' : '');
      button.setAttribute('role', 'menuitem');
      button.disabled = !!item.disabled;
      var label = document.createElement('span');
      label.textContent = item.label;
      button.appendChild(label);
      if (item.items) {
        var arrow = document.createElement('span');
        arrow.className = 'menu-arrow';
        arrow.textContent = '›';
        button.appendChild(arrow);
      } else if (item.hint) {
        var hint = document.createElement('kbd');
        hint.textContent = item.hint;
        button.appendChild(hint);
      }

      function openSub() {
        closeFrom(depth + 1);
        Array.prototype.forEach.call(menu.children, function (child) { child.classList.remove('is-open'); });
        if (!item.items) return;
        button.classList.add('is-open');
        var rect = button.getBoundingClientRect();
        var sub = build(item.items, depth + 1);
        stack.push(sub);
        place(sub, rect.right - 4, rect.top - 5, rect);
      }

      button.addEventListener('mouseenter', openSub);
      button.addEventListener('click', function () {
        if (item.items) { openSub(); return; }
        close();
        if (item.action) item.action();
      });
      menu.appendChild(button);
    });
    return menu;
  }

  function open(x, y, items) {
    close();
    if (!items || !items.length) return;
    // Covers everything, the preview included, so a press anywhere else —
    // whichever document it lands in — dismisses the menu.
    backdrop = document.createElement('div');
    backdrop.className = 'menu-backdrop';
    backdrop.addEventListener('pointerdown', close);
    backdrop.addEventListener('contextmenu', function (e) { e.preventDefault(); close(); });
    document.body.appendChild(backdrop);

    var menu = build(items, 0);
    stack.push(menu);
    place(menu, x, y);
    document.addEventListener('keydown', onKey, true);
  }

  window.addEventListener('blur', close);
  window.addEventListener('resize', close);

  window.JaiMenu = { open: open, close: close };
})();
