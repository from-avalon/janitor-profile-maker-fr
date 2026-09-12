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
        if (a) e.preventDefault();
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
        '<span class="sim-edit-value" data-key="username" title="Click to edit">' +
        escapeHtml(d.username) + '</span>';
    }

    var avatar = doc.querySelector('.pp-uc-avatar');
    if (avatar && d.avatar) avatar.src = d.avatar;

    var followers = doc.querySelector('.pp-uc-followers-count');
    if (followers && d.followers != null) {
      followers.innerHTML = '<span class="sim-edit-value" data-key="followers" title="Click to edit">' +
        escapeHtml(d.followers) + '</span><span> followers</span>';
    }

    var since = doc.querySelector('.pp-uc-member-since');
    if (since && d.memberSince != null) {
      since.innerHTML = '<span class="sim-edit-label">Member Since </span>' +
        '<span class="sim-edit-value" data-key="memberSince" title="Click to edit">' +
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

  // -------------------------------------------------------------- inspector

  var inspectorOn = false;
  var box = doc.getElementById('sim-inspector-box');
  var tag = doc.getElementById('sim-inspector-tag');

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
      else out.other.push(c);
    });
    return out;
  }

  function describe(node) {
    var c = stableClasses(node);
    var best;
    if (c.label.length) best = '.' + c.label[0];
    else if (c.other.length) best = '.' + c.other[0];
    else if (c.module.length) best = '[class*="' + c.module[0].replace(/_[^_]+_\d+$/, '_') + '"]';
    else if (c.emotion.length) best = '.' + c.emotion[0];
    else best = node.tagName.toLowerCase();
    return {
      tag: node.tagName.toLowerCase(),
      selector: best,
      labels: c.label,
      modules: c.module,
      emotion: c.emotion,
      other: c.other
    };
  }

  function highlight(node) {
    if (!node) { box.style.display = tag.style.display = 'none'; return; }
    var r = node.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    var info = describe(node);
    tag.style.display = 'block';
    tag.textContent = info.selector;
    var top = r.top > 22 ? r.top - 20 : r.bottom + 4;
    tag.style.left = Math.max(2, r.left) + 'px';
    tag.style.top = top + 'px';
  }

  doc.addEventListener('mousemove', function (e) {
    if (!inspectorOn) return;
    highlight(e.target);
  });
  doc.addEventListener('mouseleave', function () { if (inspectorOn) highlight(null); });
  doc.addEventListener('click', function (e) {
    if (!inspectorOn) return;
    e.preventDefault();
    e.stopPropagation();
    var chain = [];
    for (var n = e.target; n && n !== doc.body; n = n.parentElement) chain.push(describe(n));
    send({ type: 'pick', target: describe(e.target), chain: chain.slice(0, 8) });
  }, true);

  // ---------------------------------------------------------- inline editing
  //
  // Username, followers and member-since are edited by clicking the value
  // directly here rather than through a Settings-panel field, so what you see
  // is what you edit. See applyData() above for the '.sim-edit-value' markup.

  var editingValue = null;

  function beginEdit(node) {
    if (inspectorOn || editingValue) return;
    editingValue = { node: node, original: node.textContent };
    node.contentEditable = 'true';
    node.classList.add('sim-editing');
    node.focus();
    var range = doc.createRange();
    range.selectNodeContents(node);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
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

  doc.addEventListener('click', function (e) {
    if (inspectorOn) return;
    var value = e.target.closest && e.target.closest('.sim-edit-value');
    if (value && !editingValue) { e.stopPropagation(); beginEdit(value); }
  }, true);

  doc.addEventListener('keydown', function (e) {
    if (!editingValue) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(true); }
    else if (e.key === 'Escape') { e.preventDefault(); commitEdit(false); }
  });

  doc.addEventListener('focusout', function (e) {
    if (editingValue && e.target === editingValue.node) commitEdit(true);
  });

  // -------------------------------------------------- image swap (right-click)
  //
  // The avatar and background are preview-only images (see applyData /
  // applyDataStyles above); right-clicking either offers a way to swap them
  // without leaving the preview. Reads the file locally and posts a data URL
  // up to the parent, same as any other 'fieldEdit'.

  var contextMenu = doc.getElementById('sim-context-menu');
  var imageInput = doc.getElementById('sim-image-input');
  var contextTarget = null;

  function hideContextMenu() { contextMenu.hidden = true; contextTarget = null; }

  function contextItem(label, onClick) {
    var item = el('button', 'sim-context-item', label);
    item.type = 'button';
    item.addEventListener('click', function () { hideContextMenu(); onClick(); });
    return item;
  }

  function showContextMenu(x, y, target) {
    contextTarget = target;
    contextMenu.innerHTML = '';
    contextMenu.appendChild(contextItem('Change image…', function () { imageInput.click(); }));
    if (target === 'background') {
      contextMenu.appendChild(contextItem('Remove image', function () {
        send({ type: 'fieldEdit', key: 'background', value: '' });
        applyDataStyles(Object.assign({}, lastData || {}, { background: '' }));
      }));
    }
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.hidden = false;
  }

  doc.addEventListener('contextmenu', function (e) {
    var avatarTarget = e.target.closest && e.target.closest('.pp-uc-avatar');
    var backgroundTarget = !avatarTarget && e.target.closest && e.target.closest('.pp-page-background');
    if (!avatarTarget && !backgroundTarget) return;
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, avatarTarget ? 'avatar' : 'background');
  });

  doc.addEventListener('click', function (e) {
    if (!contextMenu.hidden && !contextMenu.contains(e.target)) hideContextMenu();
  });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideContextMenu(); });

  imageInput.addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file || !contextTarget) return;
    var key = contextTarget;
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      if (key === 'avatar') {
        var avatarImg = doc.querySelector('.pp-uc-avatar');
        if (avatarImg) avatarImg.src = dataUrl;
      } else {
        applyDataStyles(Object.assign({}, lastData || {}, { background: dataUrl }));
      }
      send({ type: 'fieldEdit', key: key, value: dataUrl });
    };
    reader.readAsDataURL(file);
  });

  // ------------------------------------------------------------- messaging

  function send(msg) {
    if (window.parent !== window) window.parent.postMessage(msg, '*');
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
        var bio = doc.querySelector('.pp-uc-about-me');
        if (bio && bio.getAttribute('data-sim-html') !== m.html) {
          bio.setAttribute('data-sim-html', m.html);
          bio.innerHTML = m.html || '';
        }
        break;
      case 'data':
        applyData(m.data);
        break;
      case 'profile':
        mount(m.reset ? window.JAI_SNAPSHOT : m.html, m.reset ? '' : m.css);
        applyData(lastData);
        break;
      case 'userMenu':
        setUserMenu(m.open);
        break;
      case 'inspector':
        inspectorOn = !!m.on;
        doc.body.style.cursor = inspectorOn ? 'crosshair' : '';
        if (!inspectorOn) highlight(null);
        break;
      case 'scrollTo':
        var target = m.selector && doc.querySelector(m.selector);
        if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        break;
    }
  });

  mount();
  send({ type: 'ready' });
})();
