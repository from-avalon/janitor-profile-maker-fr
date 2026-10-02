/*
 * The parts of a JanitorAI profile page worth naming.
 *
 * The page's real DOM is a few thousand anonymous wrappers deep; the Layers
 * panel shows this outline instead, and the properties panel uses the same
 * names for whatever gets clicked on the canvas. Anything not listed here can
 * still be selected — it just falls back to the wording of Puppy's reference
 * guide (js/reference.js), then to its selector.
 *
 * Every selector is a *label* class (`.pp-…` / `.profile-…`), never an emotion
 * class (`.css-1abc2de`): emotion hashes are regenerated on every JanitorAI
 * deploy and would break the profiles written against them.
 *
 * `hint` is shown under the element's name when it is selected: the things a
 * creator needs to know that the page itself will not tell them.
 */
(function (global) {
  'use strict';

  function node(name, sel, extra, children) {
    var out = { name: name, sel: sel };
    if (Array.isArray(extra)) { children = extra; extra = null; }
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    if (children) out.children = children;
    return out;
  }

  var TREE = [
    node('Page', 'body', { icon: 'page', hint: 'The page behind everything. Its colour shows wherever the background image does not reach.' }),
    node('Background image', '.pp-page-background', {
      icon: 'image',
      hint: 'The image itself is set in JanitorAI profile settings — CSS can only tint, blur and fade it, or replace it with a gradient. url() is stripped.'
    }),
    node('Header', '.pp-top-bar-outer', { icon: 'frame', hint: 'Site chrome. Restyling it is allowed, but keep it usable — see the JanitorAI CSS policy.' }, [
      node('Logo', '.pp-top-bar-logo', { icon: 'image' }),
      node('Navigation', '.pp-top-bar-tabs', { icon: 'text' }),
      node('Search bar', '.pp-top-bar-search-box'),
      node('Create character', '.pp-top-bar-create-char', { icon: 'button' }),
      node('Notifications bell', '.pp-top-bar-notifications-button', { icon: 'button' }),
      node('Notifications panel', '.pp-top-bar-notifications-popover', { reveal: 'notifications' }, [
        node('Notification', '.pp-top-bar-notifications-item', { reveal: 'notifications' })
      ]),
      node('Avatar button', '.pp-top-bar-app-menu', { icon: 'button' }),
      node('User menu', '.pp-top-bar-app-menu-list', {
        reveal: 'userMenu',
        hint: 'The panel behind your avatar. Single entries are addressable by link, e.g. .pp-top-bar-app-menu-list-item[href$="/my_characters"].'
      }, [
        node('Menu item', '.pp-top-bar-app-menu-list-item', { reveal: 'userMenu', icon: 'text' })
      ])
    ]),
    node('Page layout', '.profile-page-flex', {
      icon: 'frame',
      hint: 'Holds the profile box and the character list side by side. Pick a layout below, or drag either one by the grip on its top edge.'
    }, [
    node('Profile box', '.pp-uc-background', { icon: 'frame', hint: 'The panel holding your avatar, name, badges and bio. Drag its grip to put it above, below or beside the characters.' }, [
      node('Gradient layer 1', '.profile-background-box-1', { icon: 'fill' }),
      node('Gradient layer 2', '.profile-background-box-2', { icon: 'fill' }),
      node('Gradient layer 3', '.profile-background-box-3', { icon: 'fill' }),
      node('Inner padding', '.profile-info-wrapper-box'),
      node('Avatar', '.pp-uc-avatar', { icon: 'image', hint: 'Right-click it on the canvas to try a different picture. Preview only — your real avatar is set on JanitorAI.' }),
      node('Username', '.pp-uc-title', { icon: 'text', hint: 'Double-click to retype it in the preview.' }),
      node('Followers', '.pp-uc-followers-count', { icon: 'text' }),
      node('Badges', '.profile-badges', [
        node('Badge', '.profile-badge-img', { icon: 'image' })
      ]),
      node('Member since', '.pp-uc-member-since', { icon: 'text' }),
      node('About Me', '.pp-uc-about-me', {
        about: true, icon: 'frame',
        hint: 'The box your whole theme lives in. Everything you add from Insert renders inside it.'
      }),
      node('Follow button', '.pp-uc-follow-button', {
        icon: 'button',
        hint: 'Only visitors see this. Once followed it carries [data-following="true"], so the two states can be styled apart. Its dark inner plate is the ::before.'
      }, [
        node('Follow label', '.pp-uc-follow-text', { icon: 'text' })
      ]),
      node('Options button', '.pp-uc-options-menu', { icon: 'button', hint: 'Only visitors see this.' })
    ]),
    node('Characters', '.profile-page-container-flex-box', { icon: 'frame' }, [
      node('Tabs', '.pp-tabs-wrapper', [
        node('Tab', '.pp-tabs-button', { icon: 'text' }),
        node('Active tab bar', '.pp-tabs-indicator', { icon: 'fill' })
      ]),
      node('Character counter', '.pp-pg-total', { icon: 'text' }),
      node('Character search', '.pp-fl-search-input'),
      node('Filter button', '.pp-fl-filter-button', { icon: 'button' }),
      node('Card grid', '.pp-cc-list-container', [
        node('Bot card', '.pp-cc-wrapper', { icon: 'frame', hint: 'Every card in your grid shares this rule.' }, [
          node('Card border gradient', '.pp-cc-gradient-1', { icon: 'fill' }),
          node('Card gradient 2', '.pp-cc-gradient-2', { icon: 'fill' }),
          node('Card gradient 3', '.pp-cc-gradient-3', { icon: 'fill' }),
          node('Bot name', '.pp-cc-name', { icon: 'text' }),
          node('Chat ribbon', '.pp-cc-ribbon-wrap', { icon: 'fill' }),
          node('Chat count', '.pp-cc-chats-count', { icon: 'text' }),
          node('Bot image', '.pp-cc-avatar', { icon: 'image' }),
          node('Creator name', '.pp-cc-creator-name', { icon: 'text' }),
          node('Description', '.pp-cc-description', { icon: 'text', hint: 'Descriptions often embed banner images; hide img in here if they spill past a fixed-height card.' }),
          node('Star divider', '.pp-cc-star-line'),
          node('Tags', '.pp-cc-tags', [
            node('Tag', '.pp-cc-tags-item', { icon: 'text', hint: 'One tag can be targeted with .pp-tag-<name>, e.g. .pp-tag-female. Custom tags lowercase and lose their spaces.' }),
            node('Limitless tag', '.pp-tag-limitless', { icon: 'text' }),
            node('Custom tag', '.pp-cc-tags-custom', { icon: 'text' })
          ]),
          node('Token count', '.pp-cc-tokens-count', { icon: 'text' })
        ])
      ]),
      node('Pagination', '.profile-pagination-prev-hstack', [
        node('Page number', '.pp-pg-page-button', { icon: 'button' }),
        node('Active page', '.pp-pg-page-button-active', { icon: 'button' })
      ])
    ])
    ]),
    node('Footer', '.pp-footer', { icon: 'frame' })
  ];

  var bySelector = {};
  (function index(list, parent) {
    list.forEach(function (item) {
      item.parent = parent || null;
      bySelector[item.sel] = item;
      if (item.children) index(item.children, item);
    });
  })(TREE);

  /* Reference-guide wording, for elements the outline above does not name. */
  var referenceNames = null;
  function fromReference(selector) {
    if (!referenceNames) {
      referenceNames = {};
      (global.JAI_REFERENCE || []).forEach(function (row) {
        // Event cards reuse the default card's labels; the default wording is
        // listed first and is the one to keep.
        row.labels.forEach(function (label) {
          if (!referenceNames[label]) {
            referenceNames[label] = row.element.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
          }
        });
      });
    }
    return referenceNames[selector] || null;
  }

  /* The outline entry for an element, tried against each of its label classes. */
  function find(labels) {
    for (var i = 0; i < (labels || []).length; i++) {
      var hit = bySelector['.' + labels[i]];
      if (hit) return hit;
    }
    return null;
  }

  function nameFor(labels, fallback) {
    var hit = find(labels);
    if (hit) return hit.name;
    for (var i = 0; i < (labels || []).length; i++) {
      var name = fromReference('.' + labels[i]);
      if (name) return name;
    }
    return fallback || '';
  }

  global.JaiPageMap = {
    tree: TREE,
    get: function (selector) { return bySelector[selector] || null; },
    find: find,
    nameFor: nameFor
  };
})(window);
