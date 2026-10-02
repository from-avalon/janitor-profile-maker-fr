/*
 * Runs inside the preview iframe.
 *
 * Mounts the captured JanitorAI profile markup, fills in the few pieces the
 * capture could not include, and exposes a postMessage API the editor uses to
 * push CSS and profile data in real time.
 */
(function () {
  'use strict';

  var doc = document;
  var userStyle = doc.getElementById('jai-user-css');
  var dataStyle = doc.getElementById('sim-data');
  var importedStyle = doc.getElementById('jai-imported-css');
  var root;
  var lastData;

  // ---------------------------------------------------------------- mounting

  function mount(snapshot, css) {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    importedStyle.textContent = css || '';
    var host = doc.createElement('div');
    host.innerHTML = snapshot || window.JAI_SNAPSHOT || '';
    while (host.firstChild) doc.body.appendChild(host.firstChild);
    root = doc.getElementById('root');
    allCards = null;
    neutralise();
    fillGaps();
    wireTabs();
  }

  /* The snapshot is static; nothing in it should navigate or submit.
   * Handled in the capture phase, and for auxclick too, so a middle- or
   * ctrl-click cannot open a dead janitorai.com URL either. The href attributes
   * stay on the anchors, because the reference guide has selectors that match
   * on them (e.g. `a[href="/plus"]`). */
  function neutralise() {
    ['click', 'auxclick'].forEach(function (type) {
      doc.addEventListener(type, function (e) {
        var a = e.target.closest && e.target.closest('a');
        if (!a) return;
        // Creator menus use local hash targets for persistent CSS-only state.
        // Keep those working inside About Me, while captured site links remain inert.
        var href = a.getAttribute('href') || '';
        if (a.closest('.pp-uc-about-me') && /^#[^#]+$/.test(href) &&
            doc.getElementById(href.slice(1))) return;
        e.preventDefault();
      }, true);
    });
    doc.addEventListener('submit', function (e) { e.preventDefault(); }, true);
    Array.prototype.forEach.call(doc.querySelectorAll('input'), function (i) {
      i.readOnly = true;
    });
  }

  // ---------------------------------------------------------- spliced regions
  //
  // Five regions never rendered in the base capture (owner's own profile, user
  // menu closed, empty bio, pagination still loading). They come from a second
  // capture of a public profile taken with the menu open, and are real
  // JanitorAI markup with real classes -- see tools/extract_fragments.py.

  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function fragment(name) {
    return (window.JAI_FRAGMENTS || {})[name] || '';
  }

  var FALLBACK_ACTIONS =
    '<div class="pp-uc-follow-flex profile-uc-follow-flex css-1vakbk4">' +
      '<button class="Btn pp-uc-follow-button profile-uc-follow-button" ' +
              'data-following="false" type="button">' +
        '<span class="chakra-text pp-uc-follow-text profile-uc-follow-text">Follow</span>' +
      '</button>' +
    '</div>' +
    '<button type="button" class="chakra-button chakra-menu__menu-button ' +
            'pp-uc-options-menu profile-uc-options-menu css-15w88gn" ' +
            'aria-expanded="false" aria-haspopup="menu">' +
      '<span class="css-xl71ch">Options</span>' +
      '<span class="chakra-button__icon css-1hzyiq5">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">' +
          '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/>' +
          '<circle cx="19" cy="12" r="2"/>' +
        '</svg>' +
      '</span>' +
    '</button>';

  function fillGaps() {
    var stack = doc.querySelector('.profile-info-stack');

    /* About Me -- sits between the user info row and the button row. Its
     * contents are whatever the creator writes, so only the wrapper is used. */
    if (stack && !doc.querySelector('.pp-uc-about-me') && fragment('aboutMe')) {
      var holder = el('div', null, fragment('aboutMe'));
      var buttonRow = stack.querySelector('.css-3nlpdq');
      stack.insertBefore(holder.firstChild, buttonRow || null);
    }

    /* Follow + Options, i.e. what everybody except you sees. */
    var actions = doc.querySelector('.css-1aq5geu');
    if (actions && !actions.querySelector('.pp-uc-follow-button')) {
      // A capture of your own profile never contains these: JanitorAI does not
      // render them for you. They normally come from a supplement capture (see
      // tools/extract_fragments.py); the fallback below is only reached when
      // fragments.js was built without one, and is unstyled beyond `.Btn`.
      actions.innerHTML = fragment('actions') || FALLBACK_ACTIONS;
      // The capture was of a profile the viewer already follows. Reset it to
      // what a first-time visitor sees; both states stay stylable through
      // [data-following].
      var follow = actions.querySelector('.pp-uc-follow-button');
      if (follow) {
        follow.setAttribute('data-following', 'false');
        var label = follow.querySelector('.pp-uc-follow-text');
        if (label) label.textContent = 'Follow';
      }
    }

    /* Owner-only controls, so the visitor view can hide them. */
    var editProfile = doc.querySelector('._btnPrimary_1fl1d_80');
    if (editProfile) editProfile.classList.add('sim-owner-only');
    var editAvatar = doc.querySelector('.pp-uc-avatar-container .chakra-button');
    if (editAvatar) editAvatar.classList.add('sim-owner-only');

    /* Character counter -- replaces the loading skeleton. */
    var counterBox = doc.querySelector('.character-list-pagination-box');
    if (counterBox && fragment('paginationBadge')) {
      counterBox.innerHTML = fragment('paginationBadge');
    }

    /* Prev / page numbers / next, under the card grid. */
    var listFlex = doc.querySelector('.characters-list-container-flex');
    if (listFlex && !doc.querySelector('.pp-pg-page-button') && fragment('pager')) {
      var pagerHolder = el('div', null, fragment('pager'));
      while (pagerHolder.firstChild) listFlex.appendChild(pagerHolder.firstChild);
    }

    /* The user menu popup. It lives in a portal at the end of <body> on the
     * real site, and its inline popper styles anchor it under the avatar, so
     * both are kept as-is. Hidden until asked for. */
    if (!doc.querySelector('.pp-top-bar-app-menu-list') && fragment('userMenu')) {
      var portal = el('div', 'chakra-portal sim-user-menu', fragment('userMenu'));
      portal.hidden = true;
      doc.body.appendChild(portal);
      openMenuInlineStyles(portal);
    }

    /* Clicking the avatar opens it, exactly like the real header. */
    var avatarButton = doc.querySelector('.pp-top-bar-app-menu');
    if (avatarButton) {
      avatarButton.addEventListener('click', function (e) {
        e.preventDefault();
        setUserMenu(doc.querySelector('.sim-user-menu').hidden);
      });
    }

    /* The refreshed capture contains JanitorAI's new notifications popover.
     * It happened to be open when the page was saved; start closed like the
     * live site normally does, then make the captured bell and close button
     * interactive so notification styling can still be previewed. */
    var notifications = doc.querySelector('.pp-top-bar-notifications-popover');
    var notificationsButton = doc.querySelector('.pp-top-bar-notifications-button');
    if (notifications && notificationsButton) {
      setNotifications(false);
      notificationsButton.addEventListener('click', function (e) {
        e.preventDefault();
        setNotifications(notifications.hidden);
      });
      var notificationsClose = notifications.querySelector('.pp-top-bar-notifications-close');
      if (notificationsClose) {
        notificationsClose.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          setNotifications(false);
        });
      }
    }
  }

  /*
   * Chakra writes the menu's popper coordinates and its open/closed transition
   * state into inline styles, so a capture freezes whichever state the menu was
   * in. Ours was captured closed: the panel carries opacity:0 / visibility:hidden
   * and the wrapper had never been positioned, which parks it at the top-left
   * corner invisibly.
   *
   * These are runtime artifacts rather than styling, so they are rewritten to the
   * values JanitorAI itself produces with the menu open — anchored under the
   * avatar, top right. Keeping them inline is faithful: the real site sets them
   * inline too, so CSS you write against the menu behaves the same either way.
   */
  function openMenuInlineStyles(portal) {
    var wrapper = portal.querySelector('[data-popper-placement], .css-mzi0gq') ||
                  portal.firstElementChild;
    if (wrapper) {
      wrapper.setAttribute('data-popper-placement', 'bottom-end');
      wrapper.style.cssText =
        'visibility: visible; position: absolute; min-width: max-content; ' +
        'inset: 0px 0px auto auto; margin: 0px; ' +
        'transform: translate3d(-48px, 53.3333px, 0px);';
    }
    var panel = portal.querySelector('.pp-top-bar-app-menu-list');
    if (panel) {
      panel.style.cssText =
        'transform-origin: var(--popper-transform-origin); ' +
        'opacity: 1; visibility: visible; transform: none;';
    }
  }

  function setUserMenu(open) {
    var portal = doc.querySelector('.sim-user-menu');
    if (!portal) return;
    portal.hidden = !open;
    // The bundled profile can finish loading after you have already opened the
    // menu, and that re-mount replays the last data it was given. Record the
    // state here so the replay preserves it instead of closing the menu.
    if (lastData) lastData.userMenu = !!open;
    var button = doc.querySelector('.pp-top-bar-app-menu');
    if (button) button.setAttribute('aria-expanded', String(!!open));
    send({ type: 'userMenu', open: !!open });
  }

  function setNotifications(open) {
    var popover = doc.querySelector('.pp-top-bar-notifications-popover');
    var button = doc.querySelector('.pp-top-bar-notifications-button');
    if (!popover || !button) return;
    popover.hidden = !open;
    button.setAttribute('aria-expanded', String(!!open));
  }

  /* The tab strip is inert in the capture; make it feel live. */
  function wireTabs() {
    var tabs = doc.querySelectorAll('.pp-tabs-button');
    var indicator = doc.querySelector('.pp-tabs-indicator');
    function select(tab) {
      Array.prototype.forEach.call(tabs, function (t) {
        t.setAttribute('aria-selected', String(t === tab));
        t.setAttribute('data-selected', t === tab ? '' : null);
        if (t === tab) t.setAttribute('data-selected', '');
        else t.removeAttribute('data-selected');
      });
      if (indicator) {
        indicator.style.left = tab.offsetLeft + 'px';
        indicator.style.width = tab.offsetWidth + 'px';
        indicator.style.transitionDuration = '200ms';
      }
    }
    Array.prototype.forEach.call(tabs, function (t) {
      t.addEventListener('click', function () { select(t); });
    });
    if (tabs.length) select(tabs[0]);
  }

  // ------------------------------------------------------------------- data

  var CARD_SELECTOR = '.pp-cc-wrapper';
  var allCards = null;

  function applyData(d) {
    if (!d) return;
    lastData = d;

    var name = doc.querySelector('.pp-uc-title');
    if (name && d.username != null) {
      name.innerHTML = '<span class="sim-edit-label">@</span>' +
        '<span class="sim-edit-value" data-key="username" title="Double-click to edit">' +
        escapeHtml(d.username) + '</span>';
    }

    var avatar = doc.querySelector('.pp-uc-avatar');
    if (avatar && d.avatar) avatar.src = d.avatar;

    var followers = doc.querySelector('.pp-uc-followers-count');
    if (followers && d.followers != null) {
      followers.innerHTML = '<span class="sim-edit-value" data-key="followers" title="Double-click to edit">' +
        escapeHtml(d.followers) + '</span><span> followers</span>';
    }

    var since = doc.querySelector('.pp-uc-member-since');
    if (since && d.memberSince != null) {
      since.innerHTML = '<span class="sim-edit-label">Member Since </span>' +
        '<span class="sim-edit-value" data-key="memberSince" title="Double-click to edit">' +
        escapeHtml(d.memberSince) + '</span>';
    }

    var plus = doc.querySelector('.profile-janitor-plus-box');
    if (plus && d.janitorPlus !== undefined) {
      plus.innerHTML = d.janitorPlus ? plusBadge() : '';
    }

    if (d.cardCount != null) setCardCount(d.cardCount);
    if (d.userMenu !== undefined) setUserMenu(d.userMenu);

    applyDataStyles(d);

    var counter = doc.querySelector('.pp-pg-total-count');
    if (counter) counter.textContent = String(doc.querySelectorAll(CARD_SELECTOR).length);
  }

  /*
   * Anything the preview needs to force goes into its own stylesheet rather
   * than inline styles. Inline styles beat stylesheet rules, which would let
   * the simulator win arguments against the creator's CSS that JanitorAI would
   * not — e.g. `.profile-badges { display: flex }` has to keep working.
   * This sheet sits immediately before #jai-user-css, so user CSS still wins.
   */
  function applyDataStyles(d) {
    var rules = [];

    if (d.background) {
      rules.push(".pp-page-background { background-image: url('" +
        String(d.background).replace(/['\\]/g, '') + "'); }");
    }
    if (d.showBadges === false) rules.push('.profile-badges { display: none; }');
    if (d.viewMode === 'visitor') rules.push('.sim-owner-only { display: none; }');
    else if (d.viewMode === 'owner') rules.push('.css-1aq5geu { display: none; }');

    dataStyle.textContent = rules.join('\n');
  }

  function plusBadge() {
    return '<span class="_root_l8p4e_1"><span class="_wrapperPaired_1tafp_3" aria-label="janitor+ Subscriber">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">' +
      '<path d="M12 2l2.4 6.4L21 9.6l-4.8 4.3 1.4 6.5L12 17l-5.6 3.4 1.4-6.5L3 9.6l6.6-1.2z"/></svg>' +
      '</span></span>';
  }

  function setCardCount(n) {
    var list = doc.querySelector('.pp-cc-list-container');
    if (!list) return;
    if (!allCards) {
      allCards = Array.prototype.slice.call(list.querySelectorAll(CARD_SELECTOR));
    }
    n = Math.max(1, n | 0);
    // Saved profiles contain only the cards rendered in that capture (usually
    // the first page), while their counter records the creator's real total.
    // Duplicate cards only fill the preview grid; they do not affect the
    // imported profile, generated CSS, or the code copied to JanitorAI.
    var originals = allCards.length;
    while (allCards.length < n && originals) {
      var copy = allCards[allCards.length % originals].cloneNode(true);
      copy.setAttribute('data-sim-card-copy', 'true');
      allCards.push(copy);
    }
    allCards.forEach(function (card, i) {
      var wanted = i < n;
      if (wanted && !card.parentNode) list.appendChild(card);
      else if (!wanted && card.parentNode) card.parentNode.removeChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ------------------------------------------------------------------ canvas
  //
  // In Design mode the page is a canvas: hovering outlines an element, a click
  // selects it, a double-click retypes its text, and anything the creator wrote
  // into About Me can be dragged to a new place. None of that changes the page
  // here — each gesture is reported to the studio, which edits the document and
  // sends the result back. In Preview mode all of it stands down and the page
  // behaves like the page.
  //
  // Elements from the creator's own markup arrive carrying `data-jx`, their
  // address in the document (see js/markup.js). Everything else is JanitorAI's,
  // and is identified by its label class.

  var mode = 'design';
  var ui = {
    hover: doc.getElementById('sim-hover'),
    sel: doc.getElementById('sim-sel'),
    tag: doc.getElementById('sim-sel-tag'),
    drop: doc.getElementById('sim-drop'),
    ghost: doc.getElementById('sim-ghost')
  };

  var selected = null;      // the element the selection box is drawn round
  var selectedLabel = '';   // its name, as the studio calls it
  var chainNodes = [];      // its selectable ancestors, nearest first
  var hovered = null;
  var drag = null;          // a reorder in progress
  var resizing = null;
  var probeTarget = null;   // where a block dragged in from the studio would land
  var textEdit = null;      // a creator's element being retyped in place
  var heldInline = null;    // inline size left on an element until its rule lands

  /* Class names that survive a JanitorAI deploy, in order of preference. */
  function stableClasses(node) {
    var out = { label: [], module: [], emotion: [], other: [] };
    (node.className && node.className.baseVal !== undefined
      ? node.className.baseVal
      : node.className || ''
    ).split(/\s+/).forEach(function (c) {
      if (!c || c.indexOf('sim-') === 0) return;
      if (/^(pp|profile|characters|character)-/.test(c)) out.label.push(c);
      else if (/^_[A-Za-z]/.test(c)) out.module.push(c);
      else if (/^css-/.test(c)) out.emotion.push(c);
      // Chakra's own class names sit on hundreds of unrelated elements; a rule
      // written against one would restyle half the page.
      else if (!/^chakra-/.test(c)) out.other.push(c);
    });
    return out;
  }

  function bestSelector(node) {
    if (node === doc.body) return 'body';
    var c = stableClasses(node);
    if (c.label.length) return '.' + c.label[0];
    if (c.other.length) return '.' + c.other[0];
    if (c.module.length) return '[class*="' + c.module[0].replace(/_[^_]+_\d+$/, '_') + '"]';
    return null;
  }

  function isUi(node) {
    return !!(node && node.closest && node.closest('sim-ui'));
  }

  function aboutBox() { return doc.querySelector('.pp-uc-about-me'); }

  /* The creator's own element under `node`, if it is one. */
  function customOf(node) {
    var about = aboutBox();
    var hit = node && node.closest ? node.closest('[data-jx]') : null;
    return hit && about && about !== hit && about.contains(hit) ? hit : null;
  }

  function isCustom(node) { return !!node && customOf(node) === node; }

  /* What a click on `node` selects: the creator's element, or failing that the
   * nearest piece of JanitorAI's page that has a name worth writing CSS for. */
  function selectable(node) {
    if (!node || node.nodeType !== 1 || isUi(node)) return null;
    var custom = customOf(node);
    if (custom) return custom;
    for (var n = node; n && n !== doc.documentElement && n !== doc.body; n = n.parentElement) {
      if (bestSelector(n)) return n;
    }
    return null;
  }

  function describe(node) {
    var c = stableClasses(node);
    var custom = isCustom(node);
    return {
      kind: custom ? 'custom' : 'native',
      jx: custom ? +node.getAttribute('data-jx') : null,
      locked: custom && node.hasAttribute('data-jx-lock'),
      tag: node.tagName.toLowerCase(),
      selector: custom ? null : bestSelector(node),
      labels: c.label,
      others: c.other,
      modules: c.module
    };
  }

  function show(box, rect) {
    box.style.display = 'block';
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
  }

  function hide(box) { box.style.display = 'none'; }

  function setSelected(node, notify) {
    selected = node || null;
    chainNodes = [];
    selectedLabel = '';
    if (selected) {
      for (var n = selected.parentElement; n && n !== doc.documentElement; n = n.parentElement) {
        if (n === doc.body || isCustom(n) || (!customOf(n) && bestSelector(n))) chainNodes.push(n);
      }
    }
    if (hovered === selected) hovered = null;
    paint();
    if (notify) {
      send({
        type: 'select',
        target: selected ? describe(selected) : null,
        chain: chainNodes.slice(0, 10).map(describe)
      });
    }
  }

  /* An element can be on the page and still not be showing: the user menu and
   * the notifications panel are closed until asked for. */
  function reveal(node) {
    if (node.closest('.sim-user-menu')) setUserMenu(true);
    if (node.closest('.pp-top-bar-notifications-popover')) setNotifications(true);
    var rect = node.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }

  function resolve(m) {
    if (m.jx != null) {
      var about = aboutBox();
      return about ? about.querySelector('[data-jx="' + m.jx + '"]') : null;
    }
    if (!m.selector) return null;
    if (m.selector === 'body') return doc.body;
    var all;
    try { all = doc.querySelectorAll(m.selector); } catch { return null; }
    // Prefer one that is actually showing: the first card, not a hidden twin.
    for (var i = 0; i < all.length; i++) {
      if (!isUi(all[i]) && all[i].getClientRects().length) return all[i];
    }
    return all[0] || null;
  }

  function toggleAttr(node, name, on) {
    if (on) node.setAttribute(name, '');
    else node.removeAttribute(name);
  }

  /* Overlays follow their elements every frame: the layout under them moves
   * with every edit, scroll, animation and late image, and chasing each of
   * those separately would always miss one. paint() is also called directly
   * whenever the selection changes, because a browser pauses animation frames
   * for a page it is not showing and the overlays must not go stale meanwhile. */
  function tick() {
    paint();
    window.requestAnimationFrame(tick);
  }

  function paint() {
    if (selected && !selected.isConnected) selected = null;
    if (hovered && !hovered.isConnected) hovered = null;

    // An element hidden with display: none has no box to draw round; it stays
    // selected (the properties panel is how it gets shown again).
    var drawable = selected && (selected === doc.body || selected.getClientRects().length > 0);

    if (drawable && mode === 'design') {
      var r = selected === doc.body
        ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight,
            width: window.innerWidth, height: window.innerHeight }
        : selected.getBoundingClientRect();
      show(ui.sel, r);
      var inline = getComputedStyle(selected).display === 'inline';
      toggleAttr(ui.sel, 'data-no-resize', inline || selected === doc.body || !!textEdit);
      toggleAttr(ui.sel, 'data-editing', !!textEdit || !!editingValue);
      toggleAttr(ui.sel, 'data-locked', selected.hasAttribute('data-jx-lock'));
      ui.tag.textContent = resizing
        ? Math.round(r.width) + ' × ' + Math.round(r.height)
        : (selectedLabel || bestSelector(selected) || selected.tagName.toLowerCase());
      ui.tag.style.display = 'block';
      ui.tag.style.left = Math.max(2, r.left) + 'px';
      ui.tag.style.top = (r.top > 24 ? r.top - 21 : Math.min(window.innerHeight - 22, r.bottom + 3)) + 'px';
    } else {
      hide(ui.sel);
      hide(ui.tag);
    }

    if (hovered && hovered !== selected && mode === 'design' && !drag && !resizing) {
      show(ui.hover, hovered.getBoundingClientRect());
    } else {
      hide(ui.hover);
    }
  }

  function setMode(next) {
    mode = next === 'preview' ? 'preview' : 'design';
    doc.documentElement.setAttribute('data-sim-mode', mode);
    if (mode === 'preview') {
      if (textEdit) commitText(true);
      if (editingValue) commitEdit(true);
      cancelDrag();
      hovered = null;
    }
    paint();
  }

  // ---------------------------------------------------------------- pointer

  doc.addEventListener('mousemove', function (e) {
    if (mode !== 'design' || drag || resizing) return;
    hovered = isUi(e.target) ? hovered : selectable(e.target);
  });
  doc.addEventListener('mouseleave', function () { hovered = null; });

  function insideEditing(node) {
    return !!((textEdit && textEdit.node.contains(node)) ||
              (editingValue && editingValue.node.contains(node)));
  }

  /* mousedown, not just pointerdown: this is the event whose default starts a
   * text selection or moves focus into a captured input. */
  doc.addEventListener('mousedown', function (e) {
    if (mode !== 'design' || isUi(e.target) || insideEditing(e.target)) return;
    e.preventDefault();
  }, true);

  doc.addEventListener('pointerdown', function (e) {
    if (mode !== 'design' || isUi(e.target)) return;
    if (insideEditing(e.target)) return;
    if (textEdit) commitText(true);
    if (editingValue) commitEdit(true);
    if (e.button !== 0) return;
    // Take keyboard focus, so Delete acts on the selection and not on whatever
    // field in the studio was last typed in.
    window.focus();
    var node = selectable(e.target);
    if (node !== selected) setSelected(node, true);
    if (node && isCustom(node)) {
      drag = { node: node, x: e.clientX, y: e.clientY, active: false, pointer: e.pointerId };
    }
  }, true);

  doc.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
      drag.active = true;
      doc.documentElement.setAttribute('data-sim-dragging', '');
      try { doc.documentElement.setPointerCapture(drag.pointer); } catch { /* pointer already gone */ }
    }
    // Set on every move: the element's name arrives from the studio a moment
    // after the press that started the drag.
    ui.ghost.textContent = selectedLabel || drag.node.tagName.toLowerCase();
    ui.ghost.style.display = 'block';
    ui.ghost.style.left = (e.clientX + 12) + 'px';
    ui.ghost.style.top = (e.clientY + 14) + 'px';
    edgeScroll(e.clientY);
    drag.target = dropAt(e.clientX, e.clientY, drag.node);
    showDrop(drag.target);
  }, true);

  doc.addEventListener('pointerup', function () {
    if (!drag) return;
    var done = drag;
    cancelDrag();
    if (done.active && done.target) {
      send({
        type: 'move',
        jx: +done.node.getAttribute('data-jx'),
        ref: done.target.ref,
        where: done.target.where
      });
    }
  }, true);

  doc.addEventListener('pointercancel', cancelDrag, true);

  function cancelDrag() {
    drag = null;
    doc.documentElement.removeAttribute('data-sim-dragging');
    hide(ui.ghost);
    hide(ui.drop);
  }

  function edgeScroll(y) {
    if (y < 48) window.scrollBy(0, -14);
    else if (y > window.innerHeight - 48) window.scrollBy(0, 14);
  }

  /* Nothing in Design mode navigates, toggles or submits: a click is a
   * selection. Runs in the capture phase so the page's own handlers (the
   * avatar menu, the tab strip) never see it. */
  doc.addEventListener('click', function (e) {
    if (mode !== 'design' || isUi(e.target) || insideEditing(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  doc.addEventListener('dblclick', function (e) {
    if (mode !== 'design' || isUi(e.target) || insideEditing(e.target)) return;
    e.preventDefault();
    var custom = customOf(e.target);
    if (custom) {
      // The studio owns the document, so it decides whether this element's
      // contents can be retyped, and answers with 'editText'.
      send({ type: 'requestEdit', jx: +custom.getAttribute('data-jx') });
      return;
    }
    var holder = selectable(e.target);
    var value = (e.target.closest && e.target.closest('.sim-edit-value')) ||
                (holder && holder.querySelector('.sim-edit-value'));
    if (value) beginEdit(value);
  }, true);

  // ------------------------------------------------------------ drop targets

  var HOLDS_CHILDREN = /^(div|section|article|aside|header|footer|main|nav|ul|ol|li|details|figure|blockquote|td|th|center|a)$/;

  function customChildren(parent, except) {
    return Array.prototype.filter.call(parent.children, function (child) {
      return child !== except && child.hasAttribute('data-jx');
    });
  }

  function nearest(nodes, x, y) {
    var best = null;
    var bestDistance = Infinity;
    nodes.forEach(function (node) {
      var r = node.getBoundingClientRect();
      var dx = Math.max(r.left - x, 0, x - r.right);
      var dy = Math.max(r.top - y, 0, y - r.bottom);
      var d = dx * dx + dy * dy;
      if (d < bestDistance) { bestDistance = d; best = node; }
    });
    return best;
  }

  /* Whether siblings of `node` run across (x) or down (y). */
  function flowAxis(node) {
    var parent = getComputedStyle(node.parentElement);
    if (/flex/.test(parent.display)) return /^row/.test(parent.flexDirection) ? 'x' : 'y';
    if (/grid/.test(parent.display)) return 'x';
    return /^inline/.test(getComputedStyle(node).display) ? 'x' : 'y';
  }

  function beside(node, x, y) {
    var r = node.getBoundingClientRect();
    var axis = flowAxis(node);
    var before = axis === 'x' ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
    var line = axis === 'x'
      ? { left: (before ? r.left : r.right) - 1.5, top: r.top, width: 3, height: r.height }
      : { left: r.left, top: (before ? r.top : r.bottom) - 1.5, width: r.width, height: 3 };
    return { ref: +node.getAttribute('data-jx'), where: before ? 'before' : 'after', kind: 'line', rect: line };
  }

  function into(node, ref) {
    var rect = node.getBoundingClientRect();
    // An empty About Me box has no height to outline, so outline the profile
    // box it lives in: that is where the drop will show up.
    if (rect.height < 4 && node === aboutBox()) {
      var panel = node.closest('.pp-uc-background') || node.parentElement;
      rect = panel.getBoundingClientRect();
    }
    return { ref: ref, where: 'inside', kind: 'box', rect: rect };
  }

  /*
   * Where something released at (x, y) would go: next to a sibling, or inside
   * an empty container. Anywhere off the About Me box means "at the end of it",
   * so a block dropped on the wrong part of the page still lands somewhere.
   */
  function dropAt(x, y, dragged) {
    var about = aboutBox();
    if (!about) return null;
    var hit = doc.elementFromPoint(x, y);
    if (!hit) return null;

    if (!about.contains(hit)) {
      return dragged ? null : into(about, null);
    }

    var target = hit === about ? null : hit.closest('[data-jx]');
    if (target && !about.contains(target)) target = null;

    if (dragged && target && (target === dragged || dragged.contains(target))) return null;

    if (!target) {
      var top = customChildren(about, dragged);
      return top.length ? beside(nearest(top, x, y), x, y) : into(about, null);
    }

    if (HOLDS_CHILDREN.test(target.tagName.toLowerCase())) {
      var r = target.getBoundingClientRect();
      var axis = flowAxis(target);
      var edge = Math.min(10, (axis === 'x' ? r.width : r.height) / 4);
      var nearEdge = axis === 'x'
        ? (x < r.left + edge || x > r.right - edge)
        : (y < r.top + edge || y > r.bottom - edge);
      var kids = customChildren(target, dragged);
      if (!kids.length) {
        // An element holding only text is something you drop next to; an empty
        // one is something you drop into.
        if (!nearEdge && !target.textContent.trim()) return into(target, +target.getAttribute('data-jx'));
      } else if (hit === target && !nearEdge) {
        return beside(nearest(kids, x, y), x, y);
      }
    }
    return beside(target, x, y);
  }

  function showDrop(target) {
    if (!target) { hide(ui.drop); return; }
    ui.drop.setAttribute('data-kind', target.kind);
    show(ui.drop, target.rect);
  }

  // ----------------------------------------------------------------- resize

  function px(value) { return parseFloat(value) || 0; }

  function releaseInline() {
    if (!heldInline) return;
    if (heldInline.style == null) heldInline.node.removeAttribute('style');
    else heldInline.node.setAttribute('style', heldInline.style);
    heldInline = null;
  }

  Array.prototype.forEach.call(ui.sel.querySelectorAll('sim-handle'), function (handle) {
    handle.addEventListener('pointerdown', function (e) {
      if (!selected || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      window.focus();
      releaseInline();
      var cs = getComputedStyle(selected);
      var rect = selected.getBoundingClientRect();
      // The rule sets the content box unless the element opts into border-box.
      var borderBox = cs.boxSizing === 'border-box';
      resizing = {
        edge: handle.getAttribute('data-handle'),
        x: e.clientX, y: e.clientY,
        width: rect.width, height: rect.height,
        extraX: borderBox ? 0 : px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth),
        extraY: borderBox ? 0 : px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth),
        style: selected.getAttribute('style')
      };
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', function (e) {
      if (!resizing || !selected) return;
      if (resizing.edge !== 's') {
        resizing.w = Math.max(4, Math.round(resizing.width + (e.clientX - resizing.x) - resizing.extraX));
        selected.style.width = resizing.w + 'px';
      }
      if (resizing.edge !== 'e') {
        resizing.h = Math.max(4, Math.round(resizing.height + (e.clientY - resizing.y) - resizing.extraY));
        selected.style.height = resizing.h + 'px';
      }
    });

    function end() {
      if (!resizing) return;
      var done = resizing;
      resizing = null;
      if (done.w == null && done.h == null) return;
      // The size stays inline until the studio's rule for it arrives, so the
      // element does not jump back for a frame in between.
      heldInline = { node: selected, style: done.style };
      send({
        type: 'resize',
        width: done.w != null ? done.w + 'px' : null,
        height: done.h != null ? done.h + 'px' : null
      });
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });

  // ----------------------------------------------------------- text editing
  //
  // Two kinds. JanitorAI's own username, follower count and join date are
  // preview data: retyping one changes what the preview shows, nothing more.
  // Text inside the creator's own markup is the document: retyping it rewrites
  // that element's contents in the About Me code.

  var editingValue = null;

  function selectContents(node) {
    var range = doc.createRange();
    range.selectNodeContents(node);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function beginEdit(node) {
    if (editingValue) return;
    editingValue = { node: node, original: node.textContent };
    node.contentEditable = 'true';
    node.classList.add('sim-editing');
    window.focus();
    node.focus();
    selectContents(node);
  }

  function commitEdit(save) {
    if (!editingValue) return;
    var node = editingValue.node, original = editingValue.original;
    node.contentEditable = 'false';
    node.classList.remove('sim-editing');
    var value = save ? node.textContent.trim() : '';
    if (!value) { node.textContent = original; editingValue = null; return; }
    editingValue = null;
    if (value !== original) send({ type: 'fieldEdit', key: node.dataset.key, value: value });
  }

  function beginText(node) {
    if (textEdit) commitText(true);
    if (node !== selected) setSelected(node, true);
    textEdit = { node: node, jx: +node.getAttribute('data-jx'), original: node.innerHTML };
    node.setAttribute('contenteditable', 'true');
    node.setAttribute('data-sim-editing', '');
    window.focus();
    node.focus();
    selectContents(node);
  }

  /* The element's contents as they should be written back: without the
   * addresses and editing state the preview added. */
  function sourceHtml(node) {
    var copy = node.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll('*'), function (child) {
      ['data-jx', 'data-jx-lock', 'data-sim-editing', 'contenteditable'].forEach(function (name) {
        child.removeAttribute(name);
      });
    });
    var html = copy.innerHTML;
    // An emptied editable element is left holding a placeholder line break.
    return html === '<br>' ? '' : html;
  }

  function commitText(save) {
    if (!textEdit) return;
    var edit = textEdit;
    textEdit = null;
    edit.node.removeAttribute('contenteditable');
    edit.node.removeAttribute('data-sim-editing');
    var selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    if (!save) { edit.node.innerHTML = edit.original; return; }
    if (edit.node.innerHTML !== edit.original) {
      send({ type: 'textEdit', jx: edit.jx, html: sourceHtml(edit.node) });
    }
  }

  /* Pasted text arrives as text: a paste from a web page would otherwise bring
   * its fonts, colours and wrapper elements into the document with it. */
  doc.addEventListener('paste', function (e) {
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!textEdit && !editingValue) {
      // Not typing anywhere: a pasted address is something to put on the page.
      if (mode === 'design' && /^https?:\/\/\S+$/i.test(text.trim())) {
        e.preventDefault();
        send({ type: 'pasteLink', url: text.trim() });
      }
      return;
    }
    e.preventDefault();
    doc.execCommand('insertText', false, text);
  });

  doc.addEventListener('focusout', function (e) {
    if (editingValue && e.target === editingValue.node) commitEdit(true);
    if (textEdit && e.target === textEdit.node) commitText(true);
  });

  // --------------------------------------------------------------- keyboard

  doc.addEventListener('keydown', function (e) {
    if (editingValue || textEdit) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (editingValue) commitEdit(true); else commitText(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (editingValue) commitEdit(false); else commitText(false);
      }
      return;
    }
    // The studio owns undo, delete, duplicate and the rest; pass them up. Plain
    // arrow keys are left alone so they still scroll the page.
    var modifier = e.ctrlKey || e.metaKey;
    var wanted;
    if (modifier) wanted = /^[zyd\\]$/i.test(e.key);
    else if (e.altKey) wanted = /^Arrow(Up|Down)$/.test(e.key);
    else if (mode === 'design') wanted = /^(Delete|Backspace|Escape|Enter|v|p)$/i.test(e.key);
    else wanted = /^(Escape|v)$/i.test(e.key);
    if (!wanted) return;
    e.preventDefault();
    send({ type: 'key', key: e.key, ctrl: modifier, shift: e.shiftKey, alt: e.altKey });
  });

  // ------------------------------------------------------------ context menu
  //
  // The menu itself is drawn by the studio, at full size whatever the canvas
  // zoom. This only says what was right-clicked and where something added
  // "here" would go.

  doc.addEventListener('contextmenu', function (e) {
    if (insideEditing(e.target) || isUi(e.target)) return;
    var image = null;
    if (e.target.closest) {
      if (e.target.closest('.pp-uc-avatar')) image = 'avatar';
      else if (e.target.closest('.pp-page-background')) image = 'background';
    }
    if (mode !== 'design' && !image) return;      // Preview: the browser's own menu
    e.preventDefault();
    if (textEdit) commitText(true);
    if (editingValue) commitEdit(true);

    var drop = null;
    if (mode === 'design') {
      window.focus();
      var node = selectable(e.target);
      if (node !== selected) setSelected(node, true);
      drop = dropAt(e.clientX, e.clientY, null);
    }
    send({
      type: 'context',
      x: e.clientX, y: e.clientY,
      image: image,
      drop: drop ? { ref: drop.ref, where: drop.where } : null
    });
  });

  // ---------------------------------------------------- links dropped or pasted
  //
  // An image dragged over from another tab, or its address pasted, becomes an
  // Image element where it lands. The studio decides whether the link is one;
  // a file from disk cannot be used at all, because JanitorAI needs an address.

  function carriesLink(transfer) {
    var types = Array.prototype.slice.call((transfer && transfer.types) || []);
    return types.indexOf('text/uri-list') !== -1 || types.indexOf('text/html') !== -1 ||
           types.indexOf('Files') !== -1;
  }

  function linkFrom(transfer) {
    var html = transfer.getData('text/html');
    var img = html && /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(html);
    if (img) return img[1];
    var list = transfer.getData('text/uri-list') || transfer.getData('text/plain') || '';
    return list.split(/\r?\n/).filter(function (line) { return line && line[0] !== '#'; })[0] || '';
  }

  doc.addEventListener('dragover', function (e) {
    if (mode !== 'design' || !carriesLink(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    probeTarget = dropAt(e.clientX, e.clientY, null);
    showDrop(probeTarget);
  });

  doc.addEventListener('dragleave', function (e) {
    if (!e.relatedTarget) { probeTarget = null; hide(ui.drop); }
  });

  doc.addEventListener('drop', function (e) {
    if (mode !== 'design' || !carriesLink(e.dataTransfer)) return;
    e.preventDefault();
    var landed = dropAt(e.clientX, e.clientY, null);
    probeTarget = null;
    hide(ui.drop);
    send({
      type: 'dropLink',
      url: linkFrom(e.dataTransfer),
      files: e.dataTransfer.files ? e.dataTransfer.files.length : 0,
      ref: landed ? landed.ref : null,
      where: landed ? landed.where : 'inside'
    });
  });

  // ------------------------------------------------------------- messaging

  var liveStyle = doc.getElementById('sim-live');

  function send(msg) {
    if (window.parent !== window) window.parent.postMessage(msg, '*');
  }

  /* Replaces the About Me markup. Elements are rebuilt, so anything the page
   * was holding open — a <details> the creator is working inside — is put back
   * the way it was. */
  function setBio(html) {
    var bio = aboutBox();
    if (!bio || bio.getAttribute('data-sim-html') === html) return;
    if (textEdit) commitText(false);
    var open = Array.prototype.map.call(bio.querySelectorAll('details'), function (d) { return d.open; });
    bio.setAttribute('data-sim-html', html);
    bio.innerHTML = html || '';
    Array.prototype.forEach.call(bio.querySelectorAll('details'), function (d, i) {
      if (open[i]) d.open = true;
    });
    // The studio re-sends the selection once it knows where the element went.
    if (selected && !selected.isConnected) setSelected(null, false);
    hovered = null;
  }

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || typeof m !== 'object') return;
    switch (m.type) {
      case 'payload':
        // Two halves of one About Me field: its <style> contents, and the
        // markup around them. The markup is only re-inserted when it actually
        // changes, so typing CSS does not restart animations or reload images.
        userStyle.textContent = m.css || '';
        liveStyle.textContent = '';
        releaseInline();
        setBio(m.html);
        break;
      case 'live':
        liveStyle.textContent = m.css || '';
        releaseInline();
        break;
      case 'data':
        applyData(m.data);
        break;
      case 'profile':
        setSelected(null, true);
        mount(m.reset ? window.JAI_SNAPSHOT : m.html, m.reset ? '' : m.css);
        applyData(lastData);
        break;
      case 'userMenu':
        setUserMenu(m.open);
        break;
      case 'mode':
        setMode(m.mode);
        break;
      case 'select':
        var node = m.depth != null ? chainNodes[m.depth] : resolve(m);
        if (node && m.reveal) reveal(node);
        // `silent` is the studio restoring a selection it already knows about.
        setSelected(node || null, !m.silent);
        break;
      case 'label':
        selectedLabel = m.text || '';
        paint();
        break;
      case 'hover':
        hovered = m.jx != null || m.selector ? resolve(m) : null;
        paint();
        break;
      case 'editText':
        var target = resolve(m);
        if (target) beginText(target);
        break;
      case 'editValue':
        var holder = selected && selected.querySelector('.sim-edit-value');
        if (holder) beginEdit(holder);
        break;
      case 'probe':
        // A block being dragged in from the studio's Insert panel.
        probeTarget = m.x == null ? null : dropAt(m.x, m.y, null);
        if (m.x != null) edgeScroll(m.y);
        showDrop(probeTarget);
        break;
      case 'probeEnd':
        var landed = probeTarget;
        probeTarget = null;
        hide(ui.drop);
        if (m.commit && landed) send({ type: 'insertAt', ref: landed.ref, where: landed.where });
        break;
      case 'scrollTo':
        var scrollTarget = m.selector && doc.querySelector(m.selector);
        if (scrollTarget) scrollTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
        break;
    }
  });

  /* The studio reads computed styles and geometry straight off the selected
   * element (the two documents are same-origin), rather than round-tripping
   * every property through a message. */
  window.JaiFrame = {
    selected: function () { return selected; },
    resolve: resolve
  };

  // Opened on its own (no studio around it) there is nobody to report a
  // selection to, so the page simply behaves like the page.
  setMode(window.parent === window ? 'preview' : 'design');
  mount();
  window.requestAnimationFrame(tick);
  send({ type: 'ready' });
})();
