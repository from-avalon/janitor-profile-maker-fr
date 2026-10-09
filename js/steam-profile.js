/*
 * The "Steam profile" layout: a player-profile page built from Profile
 * information.
 *
 * Like the other profile layouts it has two halves — markup that is generated
 * from the roster, and a stylesheet that makes it look like something — and
 * js/hardcode.js splices both between its markers. It lives in a file of its
 * own because none of the markup is shared with the contact-select layouts.
 *
 * What is generated and what is live:
 *   - the avatar, username, follower count, badges and Follow button are
 *     JanitorAI's own elements, placed on the header grid and restyled, so
 *     they are always current;
 *   - the showcases (a favourite character, a row of featured ones, About
 *     boxes), the level, the friends and the links are written from Profile
 *     information — an import is what fills the characters in;
 *   - the full character list underneath is JanitorAI's own list, restyled as
 *     a library, so it needs no edits when a bot is published.
 *
 * A profile background and an avatar frame can each be a picture of the
 * creator's (an <img>, since JanitorAI strips url() from stylesheets) or one
 * of the built-in themes and frames, which are drawn with gradients.
 */
(function (global) {
  'use strict';

  /* page: behind everything · deep: bars and wells · accent: links, online. */
  var THEMES = {
    'default': { name: 'Default blue', page: '#1b2838', deep: '#171a21', accent: '#66c0f4', glow: '#2e4a66' },
    midnight: { name: 'Midnight', page: '#0e1524', deep: '#0a0f1a', accent: '#6f9bff', glow: '#23365f' },
    cosmic: { name: 'Cosmic', page: '#1c1230', deep: '#140c24', accent: '#b78cff', glow: '#4a2d7a' },
    summer: { name: 'Summer', page: '#2a2212', deep: '#1c160b', accent: '#ffc83d', glow: '#6b4f15' },
    steel: { name: 'Steel', page: '#22262b', deep: '#181b1f', accent: '#b8c7d6', glow: '#46505b' },
    dark: { name: 'Dark mode', page: '#0f0f11', deep: '#08080a', accent: '#d6d6d6', glow: '#2b2b30' }
  };

  /*
   * Backgrounds that need no picture: each is one `background` value, drawn
   * with gradients in the chosen theme's colours, so every one of them comes
   * in every theme. `picture` is the creator's own image instead (an <img>
   * behind the page; see .sp-bg).
   */
  var BACKDROPS = {
    theme: {
      name: 'Theme glow',
      draw: function (t) { return 'radial-gradient(ellipse at 50% 0, ' + t.glow + ' 0, ' + t.page + ' 620px)'; }
    },
    dusk: {
      name: 'Dusk',
      draw: function (t) { return 'linear-gradient(180deg, ' + t.glow + ' 0, ' + t.page + ' 45%, ' + t.deep + ' 100%)'; }
    },
    aurora: {
      name: 'Aurora',
      draw: function (t) {
        return 'radial-gradient(ellipse at 18% 0, ' + t.accent + '55 0, transparent 46%), ' +
          'radial-gradient(ellipse at 82% 12%, #7c4dff40 0, transparent 50%), ' +
          'radial-gradient(ellipse at 50% 100%, ' + t.glow + ' 0, transparent 62%), ' + t.page;
      }
    },
    nebula: {
      name: 'Nebula',
      draw: function (t) {
        return 'radial-gradient(circle at 14% 22%, #ff3df238 0, transparent 36%), ' +
          'radial-gradient(circle at 86% 30%, #00e5ff30 0, transparent 40%), ' +
          'radial-gradient(circle at 50% 92%, ' + t.accent + '44 0, transparent 46%), ' + t.deep;
      }
    },
    stars: {
      name: 'Starfield',
      draw: function (t) {
        // Three sparse layers on periods that share no factor, so the eye
        // finds no grid in them.
        return 'radial-gradient(#ffffffb3 .8px, transparent 1.5px) 0 0 / 137px 149px, ' +
          'radial-gradient(#ffffff80 .8px, transparent 1.5px) 53px 81px / 191px 173px, ' +
          'radial-gradient(#ffffff59 .6px, transparent 1.3px) 20px 110px / 89px 211px, ' +
          'radial-gradient(' + t.accent + 'b3 1px, transparent 2px) 97px 31px / 263px 239px, ' +
          'radial-gradient(ellipse at 50% 0, ' + t.glow + ' 0, ' + t.deep + ' 70%)';
      }
    },
    grid: {
      name: 'Grid',
      draw: function (t) {
        return 'linear-gradient(' + t.accent + '1f 1px, transparent 1px) 0 0 / 48px 48px, ' +
          'linear-gradient(90deg, ' + t.accent + '1f 1px, transparent 1px) 0 0 / 48px 48px, ' +
          'radial-gradient(ellipse at 50% 0, ' + t.glow + ' 0, ' + t.page + ' 70%)';
      }
    },
    carbon: {
      name: 'Carbon',
      draw: function (t) {
        return 'repeating-linear-gradient(45deg, #ffffff0a 0 2px, transparent 2px 8px), ' +
          'repeating-linear-gradient(-45deg, #00000040 0 2px, transparent 2px 8px), ' + t.deep;
      }
    },
    sunset: {
      name: 'Sunset',
      draw: function (t) {
        return 'linear-gradient(180deg, ' + t.deep + ' 0, #4a2358 34%, #b5475a 62%, #f0a35e 100%)';
      }
    },
    picture: { name: 'Your picture', draw: null }
  };

  /* Which backdrop a set of options means. Unset is "the picture if there is
   * one": a profile saved before there was a choice keeps its picture. */
  function backdrop(o) {
    var id = o.steamBackdrop && BACKDROPS[o.steamBackdrop] ? o.steamBackdrop
      : (usable(o.steamBackground) ? 'picture' : 'theme');
    if (id === 'picture' && !usable(o.steamBackground)) id = 'theme';
    return id;
  }

  var FRAMES = {
    none: 'No frame',
    gold: 'Gold trim',
    neon: 'Neon pulse',
    holo: 'Holographic',
    ember: 'Ember'
  };

  function theme(o) { return THEMES[o.steamTheme] || THEMES['default']; }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function attr(value) { return esc(value).replace(/"/g, '&quot;'); }

  function multiline(value) { return esc(value).replace(/\r?\n/g, '<br>'); }

  function usable(src) { return global.JaiHardcode.usable(src); }

  function number(text) {
    var n = parseFloat(String(text || '').replace(/,/g, ''));
    if (isNaN(n)) return 0;
    if (/k\s*$/i.test(text)) n *= 1000;
    if (/m\s*$/i.test(text)) n *= 1000000;
    return n;
  }

  /* A level nobody typed is worked out from what the profile has to show: a
   * character is worth more than a follower, as a game is worth more than a
   * friend. */
  function level(files, o) {
    var typed = parseInt(o.steamLevel, 10);
    if (!isNaN(typed) && typed > 0) return typed;
    var identity = o.identity || {};
    var count = number(identity.characterCount) || files.length;
    return Math.max(1, Math.min(999, Math.round(count * 2 + number(identity.followers) / 40)));
  }

  /* Steam colours the ring round a level by its tens. */
  function levelColour(n) {
    var ring = ['#9b9b9b', '#c02942', '#d95b43', '#fecc23', '#467a3c', '#4e8ddb', '#7652c9', '#c252c9', '#542437', '#997c52'];
    return ring[Math.floor(n / 10) % 10];
  }

  /* The characters the showcases are built round: the ones marked Featured,
   * or failing that the first few, so an import alone already fills them. */
  function featured(files) {
    var chosen = files.filter(function (f) { return f.featured; });
    if (!chosen.length) chosen = files.slice(0, 5);
    var fav = chosen[0] || null;
    var row = chosen.slice(1, 5);
    files.forEach(function (f) {
      if (row.length < 4 && f !== fav && row.indexOf(f) === -1) row.push(f);
    });
    return { favourite: fav, row: row };
  }

  function tagChip(tag) {
    var label = esc(global.JaiTags.label(tag));
    if (!global.JaiTags.isLinkable(tag)) return '<span>' + label + '</span>';
    return '<a href="' + attr(global.JaiTags.url(tag)) + '">' + label + '</a>';
  }

  function stat(value, label) {
    return '<div class="sp-stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
  }

  function linked(tag, cls, href, inner) {
    return href
      ? '<a class="' + cls + '" href="' + attr(href) + '">' + inner + '</a>'
      : '<' + tag + ' class="' + cls + '">' + inner + '</' + tag + '>';
  }

  // ----------------------------------------------------------------- markup

  /* One line, as every generated block is: a newline between two inline-level
   * tags renders as a space. */
  function markup(files, o) {
    var identity = o.identity || {};
    var pick = featured(files);
    var fav = pick.favourite;
    var lvl = level(files, o);
    var html = [];

    if (backdrop(o) === 'picture') {
      html.push('<img class="sp-bg" src="' + attr(o.steamBackground) + '" alt="">');
    }
    html.push('<div class="sp-head-bg"></div>');
    if (usable(o.steamFrameImage)) {
      html.push('<img class="sp-frame-img" src="' + attr(o.steamFrameImage) + '" alt="">');
    }
    // The other layouts' placeholder copy talks about terminals; an empty
    // summary here says what an empty one says on the real thing.
    var defaults = global.JaiHardcode.defaults;
    var summary = o.aboutBody && o.aboutBody !== defaults.aboutBody ? o.aboutBody : 'No information given.';
    html.push('<div class="sp-persona">' +
      (o.steamSubtitle ? '<div class="sp-sub">' + esc(o.steamSubtitle) + '</div>' : '') +
      '<div class="sp-summary">' + multiline(summary) + '</div></div>');
    html.push('<div class="sp-level"><span>Level</span><b class="sp-level-num">' + lvl + '</b></div>');

    html.push('<div class="sp-main">');
    if (fav) {
      html.push('<section class="sp-showcase sp-fav"><h2 class="sp-showcase-title">Favorite Character</h2><div class="sp-fav-body">');
      html.push(linked('div', 'sp-fav-art', fav.link,
        usable(fav.art) ? '<img src="' + attr(fav.art) + '" alt="' + attr(fav.name) + '">' : ''));
      html.push('<div class="sp-fav-info">' + linked('div', 'sp-fav-name', fav.link, esc(fav.name)));
      if (fav.tagline) html.push('<div class="sp-fav-tagline">' + esc(fav.tagline) + '</div>');
      if (fav.description) html.push('<p class="sp-fav-desc">' + esc(fav.description) + '</p>');
      if (fav.tags.length) html.push('<div class="sp-tags">' + fav.tags.slice(0, 8).map(tagChip).join('') + '</div>');
      html.push('</div><div class="sp-stats">');
      if (fav.chats) html.push(stat(fav.chats, 'Chats on record'));
      if (fav.tokens) html.push(stat(fav.tokens, 'Tokens'));
      if (fav.link) html.push('<a class="sp-play" href="' + attr(fav.link) + '">Chat now</a>');
      html.push('</div></div></section>');
    }

    if (pick.row.length) {
      html.push('<section class="sp-showcase sp-collect"><h2 class="sp-showcase-title">Featured Characters</h2><div class="sp-collect-grid">');
      pick.row.forEach(function (f) {
        html.push(linked('div', 'sp-tile', f.link,
          '<span class="sp-tile-art">' + (usable(f.portrait) ? '<img src="' + attr(f.portrait) + '" alt="">' : '') + '</span>' +
          '<span class="sp-tile-name">' + esc(f.name) + '</span>' +
          (f.chats ? '<span class="sp-tile-hours">' + esc(f.chats) + ' chats</span>' : '')));
      });
      html.push('</div><div class="sp-stats-row">');
      html.push(stat(identity.characterCount || files.length, 'Characters'));
      if (identity.followers) html.push(stat(identity.followers, 'Followers'));
      if (identity.memberSince) html.push(stat(identity.memberSince, 'Member since'));
      html.push('</div></section>');
    }

    var boxes = [];
    if (o.creatorNotes && o.creatorNotes !== defaults.creatorNotes) {
      boxes.push({ title: o.aboutTitle !== defaults.aboutTitle ? o.aboutTitle : 'About', body: o.creatorNotes });
    }
    (o.sections || []).forEach(function (s) { if (s && (s.title || s.body)) boxes.push(s); });
    var items = (o.inventory || []).filter(function (i) { return i && (i.name || usable(i.image)); });
    var works = (o.workshop || []).filter(function (w) { return w && (w.name || usable(w.image)); });

    if (items.length) {
      html.push('<section class="sp-showcase sp-items" id="sp-inventory"><h2 class="sp-showcase-title">Item Showcase</h2><div class="sp-item-grid">');
      items.forEach(function (i) {
        html.push(linked('div', 'sp-item', usable(i.link) ? i.link : '',
          '<span class="sp-item-art">' + (usable(i.image)
            ? '<img src="' + attr(i.image) + '" alt="">' : esc(String(i.name || '?').trim().charAt(0).toUpperCase())) + '</span>' +
          '<span class="sp-item-name">' + esc(i.name) + '</span>' +
          (i.note ? '<span class="sp-item-note">' + esc(i.note) + '</span>' : '')));
      });
      html.push('</div></section>');
    }

    if (works.length) {
      html.push('<section class="sp-showcase sp-works" id="sp-workshop"><h2 class="sp-showcase-title">Workshop Showcase</h2><div class="sp-work-grid">');
      works.forEach(function (w) {
        html.push(linked('div', 'sp-work', usable(w.link) ? w.link : '',
          '<span class="sp-work-art">' + (usable(w.image)
            ? '<img src="' + attr(w.image) + '" alt="">' : esc(String(w.name || '?').trim().charAt(0).toUpperCase())) + '</span>' +
          '<span class="sp-work-name">' + esc(w.name) + '</span>' +
          (w.note ? '<span class="sp-work-note">' + esc(w.note) + '</span>' : '')));
      });
      html.push('</div></section>');
    }

    boxes.forEach(function (box) {
      html.push('<section class="sp-showcase sp-info"><h2 class="sp-showcase-title">' +
        esc(box.title || 'About') + '</h2><div class="sp-info-body">' + multiline(box.body) + '</div></section>');
    });
    html.push('</div>');

    html.push('<aside class="sp-side"><div class="sp-status">' + esc(o.steamStatus) + '</div>');
    html.push('<div class="sp-side-head">Characters <span>' + esc(identity.characterCount || files.length) + '</span></div>');
    // The counts under Characters are the way to their showcases, as the
    // links down a player profile's right-hand side are.
    if (items.length) {
      html.push('<a class="sp-side-head" href="#sp-inventory">Inventory <span>' + items.length + '</span></a>');
    }
    if (works.length) {
      html.push('<a class="sp-side-head" href="#sp-workshop">Workshop Items <span>' + works.length + '</span></a>');
    }
    var friends = (o.friends || []).filter(function (f) { return f && f.name; });
    if (friends.length) {
      html.push('<div class="sp-side-head">Friends <span>' + friends.length + '</span></div><div class="sp-friends">');
      friends.forEach(function (f) {
        html.push(linked('div', 'sp-friend', usable(f.link) ? f.link : '',
          '<span class="sp-friend-face">' + (usable(f.image)
            ? '<img src="' + attr(f.image) + '" alt="">' : esc(String(f.name).trim().charAt(0).toUpperCase())) + '</span>' +
          '<span class="sp-friend-text"><b>' + esc(f.name) + '</b><small>' + esc(f.note || 'Online') + '</small></span>'));
      });
      html.push('</div>');
    }
    var socials = (o.socials || []).filter(function (s) { return s && usable(s.link); });
    if (socials.length) {
      html.push('<div class="sp-side-head">Links <span>' + socials.length + '</span></div><div class="sp-links">');
      socials.forEach(function (s) {
        var name = s.label || String(s.link).replace(/^https?:\/\/(www\.)?/i, '').split(/[/?#]/)[0];
        html.push('<a class="sp-link" href="' + attr(s.link) + '">' +
          (usable(s.image) ? '<img src="' + attr(s.image) + '" alt="">' : '<i>' + esc(name.charAt(0).toUpperCase()) + '</i>') +
          '<span>' + esc(name) + '</span></a>');
      });
      html.push('</div>');
    }
    html.push('</aside>');
    return html.join('');
  }

  /* Nothing in this layout scales with the roster the way a :target roster
   * does, so the wiring half is one line: the colour of the level's ring. */
  function css(files, o) {
    var lvl = level(files, o);
    return '/* Generated from Profile data — edit it there, not here. */\n' +
      '.sp-level-num { border-color: ' + levelColour(lvl) + '; }\n';
  }

  // ------------------------------------------------------------- stylesheet

  function frameCss(o, t) {
    var img = usable(o.steamFrameImage);
    var out = [];
    if (img) {
      out.push(
'/* Your own frame: a transparent picture laid over the avatar, a fifth larger',
' * than it on every side, the way a store frame is drawn. */',
'.sp-frame-img {',
'  grid-column: 1;',
'  grid-row: 1 / span 4;',
'  align-self: start;',
'  justify-self: center;',
'  z-index: 4;',
'  width: 200px;',
'  max-width: none;',
'  height: 200px;',
'  margin: -18px;',
'  object-fit: contain;',
'  pointer-events: none;',
'}',
'@media screen and (max-width: 735px) {',
'  .sp-frame-img { grid-row: 1 / span 2; justify-self: start; width: 108px; height: 108px; margin: -10px; }',
'}');
      return out;
    }
    var ring = {
      gold: 'linear-gradient(135deg, #7a5a14, #f6d77a 30%, #b8860b 50%, #fff1b8 70%, #7a5a14)',
      neon: 'linear-gradient(135deg, #00e5ff, #7c4dff 50%, #ff3df2)',
      holo: 'conic-gradient(from 0deg, #ff5f6d, #ffc371, #c3f584, #6be3ff, #a78bfa, #ff5f6d)',
      ember: 'linear-gradient(0deg, #ff3d00, #ffb300 55%, #fff3b0)'
    }[o.steamFrame];
    if (!ring) return out;
    out.push(
'/* The avatar frame: a ring drawn behind the picture and a little larger. */',
'.pp-uc-avatar-container::before {',
'  content: "";',
'  position: absolute;',
'  inset: -7px;',
'  z-index: 0;',
'  border-radius: 6px;',
'  background: ' + ring + ';',
'  box-shadow: 0 0 18px ' + (o.steamFrame === 'gold' ? '#f6d77a55' : o.steamFrame === 'ember' ? '#ff6a0088' : t.accent + '77') + ';',
(o.steamFrame === 'holo' ? '  animation: sp-frame-turn 6s linear infinite;'
  : o.steamFrame === 'gold' ? '  animation: none;'
  : '  animation: sp-frame-pulse 2.4s ease-in-out infinite;'),
'}',
'.pp-uc-avatar-container::after {',
'  content: "";',
'  position: absolute;',
'  inset: -2px;',
'  z-index: 0;',
'  border-radius: 4px;',
'  background: ' + t.deep + ';',
'}',
'@keyframes sp-frame-pulse { 0%, 100% { opacity: .7; filter: saturate(.9); } 50% { opacity: 1; filter: saturate(1.3) brightness(1.15); } }',
'@keyframes sp-frame-turn { to { filter: hue-rotate(360deg); } }',
'@media (prefers-reduced-motion: reduce) { .pp-uc-avatar-container::before { animation: none; } }');
    return out;
  }

  function style(o) {
    var t = theme(o);
    var a = t.accent;
    var drawn = backdrop(o);
    var hasBg = drawn === 'picture';
    var wall = (BACKDROPS[drawn].draw || BACKDROPS.theme.draw)(t);
    var font = '"Motiva Sans", "Segoe UI", Arial, Helvetica, sans-serif';
    var lines = [
'/* ---- page ---- */',
'html, body { background: ' + t.page + '; }',
'body { color: #c6d4df; }',
'.profile-background-effect-image { display: none; }',
'.pp-page-background { background: ' + wall + ' !important; background-attachment: fixed !important; }',
'.profile-page-flex, .profile-page-flex :is(h2, p, a, span, strong, b, button, input) { font-family: ' + font + '; }',
'',
'/* Your profile background: a picture behind the whole page, dimmed toward the',
' * bottom so the list under it stays readable. It is an <img> because',
' * JanitorAI strips url() from stylesheets. The page column is given a layer',
' * of its own (below) and the picture sits at the back of that layer: over',
' * the backdrop JanitorAI draws, under everything in the profile. */',
'.sp-bg {',
'  position: fixed;',
'  top: 0;',
'  left: 0;',
'  z-index: -1;',
'  width: 100%;',
'  max-width: none;',
'  height: 100%;',
'  object-fit: cover;',
'  object-position: center top;',
'  pointer-events: none;',
'}',
'',
'/* ---- one centred column, the width a profile is ---- */',
'.profile-page-flex {',
'  display: flex !important;',
'  flex-direction: column !important;',
'  align-items: center;',
'  gap: 0 !important;',
'  width: 100% !important;',
'  max-width: 986px !important;',
'  position: relative;',
'  z-index: 1;',
'  margin: 0 auto;',
'  padding: 18px 12px 60px;',
'}',
'.pp-uc-background {',
'  flex: 0 0 auto;',
'  width: 100% !important;',
'  min-width: 0 !important;',
'  max-width: 962px !important;',
'  padding: 0;',
'  border-radius: 0;',
'  background: transparent !important;',
'  box-shadow: none !important;',
'}',
'.profile-background-box-1, .profile-background-box-2, .profile-background-box-3 { display: none; }',
'.profile-info-wrapper-box { width: 100%; padding: 0; background: transparent !important; }',
'',
'/* The avatar, name and counts are nested three deep, and About Me sits beside',
' * them. Flattening the wrappers puts every piece on one grid: a header row of',
' * avatar / persona / level, then the showcases with a sidebar beside them. */',
'.profile-info-hstack, .profile-info-stack-inner, .pp-uc-about-me { display: contents; }',
'.profile-info-stack {',
'  display: grid;',
'  grid-template-columns: 164px minmax(0, 1fr) 268px;',
'  grid-template-rows: auto auto auto auto 24px auto;',
'  gap: 0 24px;',
'  align-items: start;',
'  position: relative;',
'  padding: 24px;',
'  background: ' + t.deep + (hasBg ? 'cc' : 'b3') + ';',
'  box-shadow: 0 0 40px #00000066;',
'}',
'.sp-head-bg {',
'  grid-column: 1 / -1;',
'  grid-row: 1 / 6;',
'  align-self: stretch;',
'  margin: -24px -24px 0;',
'  background: linear-gradient(180deg, ' + t.glow + 'cc 0, ' + t.page + '99 100%);',
'}',
'',
'/* ---- header ---- */',
'.pp-uc-avatar-container {',
'  grid-column: 1;',
'  grid-row: 1 / span 4;',
'  position: relative;',
'  z-index: 2;',
'  width: 164px;',
'  height: 164px;',
'  margin: 0;',
'  border-radius: 3px;',
'}',
'.pp-uc-avatar {',
'  position: relative;',
'  z-index: 1;',
'  box-sizing: border-box;',
'  width: 100% !important;',
'  height: 100% !important;',
'  border: 2px solid ' + a + ';',
'  border-radius: 3px !important;',
'  object-fit: cover;',
'}',
'.profile-info-stack-inner-flex {',
'  grid-column: 2;',
'  grid-row: 1;',
'  z-index: 2;',
'  align-items: center;',
'  min-width: 0;',
'  margin: 0;',
'}',
'.pp-uc-title {',
'  margin: 0;',
'  overflow: hidden;',
'  color: #fff;',
'  font-size: 24px;',
'  font-weight: 400;',
'  line-height: 30px;',
'  letter-spacing: 0;',
'  text-overflow: ellipsis;',
'  white-space: nowrap;',
'}',
'.sp-persona { grid-column: 2; grid-row: 2 / span 2; z-index: 2; min-width: 0; }',
'.sp-sub { margin-top: 4px; color: #898989; font-size: 13px; line-height: 18px; }',
'.sp-summary {',
'  max-height: 96px;',
'  margin-top: 12px;',
'  overflow-y: auto;',
'  color: #acb2b8;',
'  font-size: 13px;',
'  line-height: 19px;',
'}',
'.pp-uc-member-since { grid-column: 2; grid-row: 4; z-index: 2; margin: 12px 0 0; color: #8f98a0; font-size: 12px; font-weight: 400; }',
'',
'.sp-level { grid-column: 3; grid-row: 1; z-index: 2; display: flex; align-items: center; gap: 10px; color: #fff; font-size: 24px; line-height: 30px; }',
'.sp-level-num {',
'  display: flex;',
'  width: 32px;',
'  height: 32px;',
'  align-items: center;',
'  justify-content: center;',
'  border: 2px solid #9b9b9b;',
'  border-radius: 50%;',
'  font-size: 16px;',
'  font-weight: 400;',
'}',
'/* The badges take the place of a featured badge, under the level. */',
'.profile-badges {',
'  grid-column: 3;',
'  grid-row: 2;',
'  z-index: 2;',
'  flex-wrap: wrap;',
'  gap: 6px;',
'  margin: 10px 0 0;',
'  padding: 8px;',
'  border-radius: 3px;',
'  background: #00000040;',
'}',
'.profile-badge { width: 34px; height: 34px; }',
'.profile-badge-img { width: 100%; height: 100%; }',
'.pp-uc-followers-count { grid-column: 3; grid-row: 3; z-index: 2; margin: 12px 0 0; color: #c6d4df; font-size: 14px; font-weight: 400; }',
'.pp-uc-followers-count > :first-child { color: #fff; font-size: 18px; }',
'.profile-info-stack > div:last-child { grid-column: 3; grid-row: 4; z-index: 2; margin: 12px 0 0; padding: 0; }',
'.profile-info-stack > div:last-child > div { justify-content: flex-start; gap: 6px; }',
'.profile-info-stack-inner > button { grid-column: 3; grid-row: 4; z-index: 2; margin-top: 12px; }',
'.pp-uc-follow-flex { flex: 1 1 0; }',
'.Btn.pp-uc-follow-button, .pp-uc-options-menu, .profile-info-stack-inner > button {',
'  box-sizing: border-box;',
'  width: 100%;',
'  height: 30px;',
'  min-height: 0;',
'  padding: 0 14px;',
'  border: 0 !important;',
'  border-radius: 2px !important;',
'  background: ' + a + '33 !important;',
'  box-shadow: none !important;',
'  color: ' + a + ' !important;',
'  font-size: 13px;',
'  font-weight: 400;',
'  transition: background .15s ease, color .15s ease;',
'}',
'.Btn.pp-uc-follow-button::before { background: transparent !important; }',
'.pp-uc-follow-text { color: inherit; font-size: 13px; font-weight: 400; }',
'.pp-uc-options-menu { display: flex; flex: 1 1 0; align-items: center; justify-content: center; gap: 6px; }',
'.pp-uc-options-menu > span { display: flex; align-items: center; margin: 0; }',
'.Btn.pp-uc-follow-button:hover, .pp-uc-options-menu:hover, .profile-info-stack-inner > button:hover {',
'  background: linear-gradient(-60deg, ' + t.glow + ' 5%, ' + a + ' 95%) !important;',
'  color: #fff !important;',
'}',
'',
'/* ---- showcases ---- */',
'.sp-main { grid-column: 1 / 3; grid-row: 6; min-width: 0; }',
'.sp-showcase { margin: 0 0 12px; padding: 0 0 12px; border-radius: 3px; background: #0000004d; }',
'.sp-showcase-title { margin: 0 0 10px; padding: 8px 12px; border-radius: 3px 3px 0 0; background: #00000033; color: #fff; font-size: 16px; font-weight: 300; line-height: 22px; letter-spacing: 0; }',
'',
'.sp-fav-body { display: flex; align-items: stretch; gap: 14px; padding: 0 12px; }',
'.sp-fav-art { display: block; flex: 0 0 184px; width: 184px; height: 230px; overflow: hidden; border-radius: 2px; background: ' + t.deep + '; }',
'.sp-fav-art img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; transition: transform .35s ease; }',
'.sp-fav-art:hover img { transform: scale(1.04); }',
'.sp-fav-info { flex: 1 1 0; min-width: 0; }',
'.sp-fav-name { display: block; color: #fff; font-size: 20px; line-height: 26px; text-decoration: none; }',
'a.sp-fav-name:hover { color: ' + a + '; }',
'.sp-fav-tagline { margin-top: 2px; color: ' + a + '; font-size: 12px; }',
'.sp-fav-desc { max-height: 114px; margin: 8px 0 0; overflow: hidden; color: #8f98a0; font-size: 13px; line-height: 19px; }',
'.sp-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }',
'.sp-tags :is(a, span) { padding: 2px 8px; border-radius: 2px; background: ' + a + '33; color: ' + a + '; font-size: 11px; line-height: 18px; text-decoration: none; }',
'.sp-tags a:hover { background: ' + a + '; color: #fff; }',
'.sp-stats { display: flex; flex: 0 0 150px; flex-direction: column; gap: 6px; }',
'.sp-stat { padding: 8px 10px; border-radius: 3px; background: #00000059; }',
'.sp-stat b { display: block; color: #fff; font-size: 22px; font-weight: 300; line-height: 26px; }',
'.sp-stat span { display: block; color: #9b9b9b; font-size: 12px; line-height: 16px; }',
'.sp-play {',
'  display: block;',
'  margin-top: auto;',
'  padding: 9px 10px;',
'  border-radius: 2px;',
'  background: linear-gradient(90deg, #75b022 5%, #588a1b 95%);',
'  color: #d2efa9;',
'  font-size: 14px;',
'  text-align: center;',
'  text-decoration: none;',
'  transition: filter .15s ease;',
'}',
'.sp-play:hover { color: #fff; filter: brightness(1.15); }',
'',
'.sp-collect-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 0 12px; }',
'.sp-tile { display: block; min-width: 0; color: #c6d4df; text-decoration: none; }',
'.sp-tile:hover { color: #c6d4df; }',
'.sp-tile-art { display: block; aspect-ratio: 3 / 4; overflow: hidden; border-radius: 2px; background: ' + t.deep + '; box-shadow: 0 0 0 1px #00000080; transition: box-shadow .2s ease, transform .2s ease; }',
'.sp-tile-art img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; }',
'a.sp-tile:hover .sp-tile-art { box-shadow: 0 0 0 2px ' + a + ', 0 8px 18px #00000080; transform: translateY(-3px); }',
'.sp-tile-name { display: block; margin-top: 6px; overflow: hidden; color: #fff; font-size: 13px; line-height: 17px; text-overflow: ellipsis; white-space: nowrap; }',
'.sp-tile-hours { display: block; color: #8f98a0; font-size: 11px; line-height: 15px; }',
'.sp-stats-row { display: flex; gap: 8px; margin: 12px 12px 0; }',
'.sp-stats-row .sp-stat { flex: 1 1 0; min-width: 0; }',
'',
'/* Items: square tiles, as an inventory is. */',
'.sp-item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; padding: 0 12px; }',
'.sp-item { display: block; min-width: 0; color: #c6d4df; text-align: center; text-decoration: none; }',
'.sp-item:hover { color: #c6d4df; }',
'.sp-item-art {',
'  display: flex;',
'  aspect-ratio: 1;',
'  align-items: center;',
'  justify-content: center;',
'  overflow: hidden;',
'  border: 1px solid ' + a + '66;',
'  border-radius: 3px;',
'  background: linear-gradient(160deg, ' + t.glow + ', ' + t.deep + ');',
'  color: ' + a + ';',
'  font-size: 30px;',
'  font-weight: 300;',
'  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;',
'}',
'.sp-item-art img { display: block; width: 100%; height: 100%; object-fit: cover; }',
'a.sp-item:hover .sp-item-art { border-color: ' + a + '; box-shadow: 0 0 14px ' + a + '66; transform: translateY(-2px); }',
'.sp-item-name { display: block; margin-top: 6px; overflow: hidden; color: #ebebeb; font-size: 12px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }',
'.sp-item-note { display: block; overflow: hidden; color: ' + a + '; font-size: 11px; line-height: 15px; text-overflow: ellipsis; white-space: nowrap; }',
'',
'/* Workshop: wide cards with a title and a line about what it is. */',
'.sp-work-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 0 12px; }',
'.sp-work { display: block; min-width: 0; padding-bottom: 8px; border-radius: 3px; background: #00000040; color: #c6d4df; text-decoration: none; transition: background .15s ease; }',
'a.sp-work:hover { background: ' + a + '33; color: #c6d4df; }',
'.sp-work-art { display: flex; aspect-ratio: 16 / 9; align-items: center; justify-content: center; overflow: hidden; border-radius: 3px 3px 0 0; background: linear-gradient(160deg, ' + t.glow + ', ' + t.deep + '); color: ' + a + '; font-size: 30px; font-weight: 300; }',
'.sp-work-art img { display: block; width: 100%; height: 100%; object-fit: cover; }',
'.sp-work-name { display: block; margin: 8px 10px 0; overflow: hidden; color: #fff; font-size: 13px; line-height: 17px; text-overflow: ellipsis; white-space: nowrap; }',
'.sp-work-note { display: block; max-height: 32px; margin: 2px 10px 0; overflow: hidden; color: #8f98a0; font-size: 11px; line-height: 16px; }',
'',
'.sp-info-body { padding: 0 12px; color: #acb2b8; font-size: 13px; line-height: 19px; overflow-wrap: break-word; }',
'',
'/* ---- sidebar ---- */',
'.sp-side { grid-column: 3; grid-row: 6; min-width: 0; }',
'.sp-status { margin-bottom: 14px; color: ' + a + '; font-size: 22px; font-weight: 300; line-height: 26px; }',
'.sp-side-head { display: flex; align-items: baseline; gap: 8px; margin: 0 0 8px; padding-top: 10px; border-top: 1px solid #ffffff14; color: #ebebeb; font-size: 14px; }',
'.sp-side-head span { color: #9b9b9b; font-size: 24px; font-weight: 300; line-height: 26px; }',
'a.sp-side-head { text-decoration: none; transition: color .15s ease; }',
'a.sp-side-head:hover { color: ' + a + '; }',
'.sp-friends { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }',
'.sp-friend { display: flex; align-items: center; padding: 4px; border-radius: 2px; color: ' + a + '; text-decoration: none; transition: background .15s ease; }',
'a.sp-friend:hover { background: #ffffff14; color: ' + a + '; }',
'.sp-friend-face { display: flex; flex: 0 0 auto; width: 36px; height: 36px; margin-right: 10px; align-items: center; justify-content: center; overflow: hidden; border: 1px solid ' + a + '; border-radius: 2px; background: ' + t.glow + '; color: #fff; font-size: 15px; }',
'.sp-friend-face img { display: block; width: 100%; height: 100%; object-fit: cover; }',
'.sp-friend-text { min-width: 0; }',
'.sp-friend-text b { display: block; overflow: hidden; font-size: 13px; font-weight: 400; line-height: 17px; text-overflow: ellipsis; white-space: nowrap; }',
'.sp-friend-text small { display: block; overflow: hidden; color: #8f98a0; font-size: 11px; line-height: 15px; text-overflow: ellipsis; white-space: nowrap; }',
'.sp-links { display: flex; flex-direction: column; gap: 4px; }',
'.sp-link { display: flex; align-items: center; padding: 4px; border-radius: 2px; color: #ebebeb; font-size: 13px; text-decoration: none; transition: background .15s ease; }',
'.sp-link:hover { background: #ffffff14; color: #fff; }',
'.sp-link :is(img, i) { display: flex; flex: 0 0 auto; width: 32px; height: 32px; margin-right: 10px; align-items: center; justify-content: center; border-radius: 2px; background: ' + a + '33; color: ' + a + '; font-style: normal; object-fit: cover; }',
'',
'/* ---- the character list, as a library ---- */',
'.profile-page-container-flex-box {',
'  flex: 0 0 auto;',
'  box-sizing: border-box;',
'  width: 100% !important;',
'  max-width: 962px;',
'  margin: 0 auto;',
'  padding: 0 24px 24px;',
'  background: ' + t.deep + (hasBg ? 'cc' : 'b3') + ';',
'}',
'.pp-tabs-wrapper { width: 100%; gap: 0 22px; border: 0; border-bottom: 1px solid #ffffff14; border-radius: 0; background: transparent !important; }',
'.pp-tabs-indicator { display: none; }',
'.pp-tabs-button {',
'  flex: 0 0 auto;',
'  width: auto;',
'  height: 40px;',
'  padding: 0;',
'  border: 0;',
'  border-bottom: 3px solid transparent;',
'  border-radius: 0;',
'  background: transparent !important;',
'  color: #8f98a0 !important;',
'  font-size: 14px;',
'  font-weight: 400;',
'  letter-spacing: 0;',
'}',
'.pp-tabs-button[aria-selected="true"] { border-bottom-color: ' + a + '; color: #fff !important; }',
'.pp-tabs-panels { margin-top: 12px; }',
'.characters-list-container-flex { gap: 12px; }',
'.character-list-pagination-flex { align-items: center; gap: 8px; padding: 0; }',
'.pp-pg-total { border: 0 !important; background: transparent !important; box-shadow: none !important; color: #8f98a0 !important; font-size: 13px; }',
'.pp-pg-total::before, .pp-pg-total::after { display: none; }',
'.pp-pg-total-count { color: #fff; font-weight: 400; }',
'.pp-fl-search-input, .profile-character-search-input-group, .pp-fl-filter-button, .react-select__control {',
'  border: 0 !important;',
'  border-radius: 3px !important;',
'  background: ' + a + '26 !important;',
'  box-shadow: none !important;',
'  color: #fff !important;',
'  font-size: 13px;',
'}',
'.react-select__single-value { color: #fff !important; }',
'',
'.pp-cc-list-container { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; gap: 6px !important; padding: 0; }',
'.pp-cc-wrapper {',
'  width: 100%;',
'  min-width: 0;',
'  max-width: none;',
'  margin: 0;',
'  padding: 0;',
'  border: 0;',
'  border-radius: 3px;',
'  background: #00000033 !important;',
'  box-shadow: none !important;',
'  transition: background .15s ease;',
'}',
'.pp-cc-wrapper:hover { background: ' + a + '33 !important; }',
'.pp-cc-wrapper > div:not(.profile-character-card-stack),',
'.profile-character-card-creator-name-link,',
'.pp-cc-star-line { display: none !important; }',
'/* A row: capsule on the left, name / description / tags in the middle, the',
' * counts on the right. The card\'s link is flattened so the name and the',
' * picture can sit in different columns and both still open the bot. */',
'.profile-character-card-stack {',
'  display: grid !important;',
'  grid-template-columns: 150px minmax(0, 1fr) max-content;',
'  grid-template-rows: auto auto 1fr;',
'  gap: 4px 14px;',
'  align-items: start;',
'  position: relative;',
'  width: 100%;',
'  margin: 0;',
'  padding: 10px;',
'  border: 0;',
'  border-radius: 0;',
'  background: transparent !important;',
'}',
'.profile-character-card-stack-link-component { display: contents; }',
'.profile-character-card-avatar-aspect-ratio {',
'  grid-column: 1;',
'  grid-row: 1 / span 3;',
'  position: relative !important;',
'  width: 150px;',
'  height: 112px;',
'  margin: 0;',
'  overflow: hidden;',
'  border-radius: 2px;',
'}',
'.profile-character-card-avatar-aspect-ratio::before { display: none; }',
'.pp-cc-avatar { width: 100% !important; height: 100% !important; border-radius: 0 !important; object-fit: cover; object-position: center top; }',
'.profile-character-card-stack-link-component-box { grid-column: 2; grid-row: 1; position: static; width: auto; height: auto; min-width: 0; margin: 0; padding: 0; background: transparent; }',
'.pp-cc-name { width: 100%; padding: 0; overflow: hidden; color: #ebebeb !important; font-family: ' + font + ' !important; font-size: 16px !important; font-weight: 400 !important; line-height: 22px; text-align: left; text-overflow: ellipsis; white-space: nowrap; }',
'.pp-cc-wrapper:hover .pp-cc-name { color: #fff !important; }',
'.profile-character-card-description-box { grid-column: 2; grid-row: 2; width: auto; height: auto; max-height: 38px; min-width: 0; margin: 0; padding: 0; overflow: hidden; }',
'.pp-cc-description { padding: 0; color: #8f98a0 !important; font-size: 12px !important; line-height: 19px !important; text-align: left; }',
'.pp-cc-description :is(p, em, span) { display: inline; margin: 0; color: inherit; font-size: inherit; }',
'.pp-cc-description img { display: none; }',
'.pp-cc-tags { grid-column: 2; grid-row: 3; align-self: end; max-height: 24px; min-width: 0; margin: 0; padding: 0; overflow: hidden; }',
'.pp-cc-tags ul { align-items: center; gap: 4px; margin: 0; padding: 0; }',
'.pp-cc-tags-wrap { margin: 0 !important; padding: 0 !important; }',
'.pp-cc-tags-item {',
'  height: 20px;',
'  min-height: 0;',
'  margin: 0 !important;',
'  padding: 0 7px !important;',
'  border: 0 !important;',
'  border-radius: 2px !important;',
'  background: ' + a + '26 !important;',
'  box-shadow: none !important;',
'  color: ' + a + ' !important;',
'  font-size: 11px !important;',
'  font-weight: 400;',
'  line-height: 20px;',
'  white-space: nowrap;',
'}',
'.profile-character-card-stats-box {',
'  grid-column: 3;',
'  grid-row: 1;',
'  justify-self: end;',
'  position: static !important;',
'  width: auto !important;',
'  height: auto !important;',
'  color: #c6d4df !important;',
'}',
'.profile-character-card-stats-box .pp-cc-ribbon { position: static !important; width: auto; height: auto; background: transparent !important; }',
'.profile-character-card-stats-box .pp-cc-ribbon-wrap { padding: 0 !important; background: transparent !important; clip-path: none !important; color: #c6d4df !important; font-size: 13px; font-weight: 400; }',
'.profile-character-card-stats-box svg { display: none; }',
'.profile-character-card-stats-box * { font-family: ' + font + ' !important; font-weight: 400 !important; text-shadow: none !important; }',
'.pp-cc-chats-count { color: #c6d4df; }',
'.pp-cc-chats-count::after { content: " chats on record"; color: #8f98a0; }',
'.pp-cc-chats-count ~ * { display: none !important; }',
'.profile-character-card-box { grid-column: 3; grid-row: 2; justify-self: end; position: static !important; width: auto; margin: 0; padding: 0; }',
'.pp-cc-tokens-count { color: #8f98a0 !important; font-size: 12px !important; }',
'.pp-pg-page-button, .pp-pg-prev-button, .pp-pg-next-button { border: 0 !important; border-radius: 2px !important; background: transparent !important; box-shadow: none !important; color: #8f98a0 !important; }',
'.pp-pg-page-button-active { background: ' + a + '33 !important; color: #fff !important; }',
'',
'/* ---- site header ---- */',
'.pp-top-bar { border-bottom: 0; background: ' + t.deep + ' !important; box-shadow: 0 2px 10px #00000066 !important; }',
'.pp-top-bar-search-input { border: 0 !important; border-radius: 3px !important; background: ' + a + '26 !important; box-shadow: none !important; color: #fff !important; }',
'#search-input, #search-input::placeholder { color: #8f98a0 !important; font-family: ' + font + '; }',
'.pp-top-bar-create-char { padding: 6px 12px !important; border: 0 !important; border-radius: 2px !important; background: linear-gradient(90deg, #75b022 5%, #588a1b 95%) !important; box-shadow: none !important; color: #d2efa9 !important; }',
'.pp-top-bar-app-menu-list, .pp-top-bar-notifications-popover { overflow: hidden; border: 0 !important; border-radius: 3px !important; background: #3d4450 !important; box-shadow: 0 0 12px #000000 !important; }',
'.pp-top-bar-app-menu-list-item, .pp-top-bar-notifications-item { background: transparent !important; color: #dcdedf !important; }',
'.pp-top-bar-app-menu-list-item:hover, .pp-top-bar-notifications-item:hover { background: #dcdedf !important; color: #171a21 !important; }',
'.pp-mnb-wrapper { border-radius: 0; background: ' + t.deep + ' !important; box-shadow: 0 -2px 10px #00000066; }',
'.pp-mnb-container svg { color: #c6d4df !important; }',
'',
'/* ---- phone: the header stacks, the sidebar goes under the showcases ---- */',
'@media screen and (max-width: 735px) {',
'  .profile-page-flex { padding: 0 0 40px; }',
'  .profile-info-stack { grid-template-columns: 88px minmax(0, 1fr); grid-template-rows: none; gap: 0 14px; padding: 16px; }',
'  .sp-head-bg { grid-row: 1 / 7; margin: -16px -16px 0; }',
'  .pp-uc-avatar-container { grid-row: 1 / span 2; width: 88px; height: 88px; }',
'  .profile-info-stack-inner-flex { grid-column: 2; grid-row: 1; }',
'  .pp-uc-title { font-size: 20px; line-height: 26px; }',
'  .sp-level { grid-column: 2; grid-row: 2; margin-top: 6px; font-size: 16px; }',
'  .sp-level-num { width: 26px; height: 26px; font-size: 13px; }',
'  .sp-persona { grid-column: 1 / -1; grid-row: 3 / span 2; margin-top: 8px; }',
'  .sp-summary { max-height: none; }',
'  .profile-badges { grid-column: 1 / -1; grid-row: 5; }',
'  .pp-uc-followers-count { grid-column: 1; grid-row: 6; white-space: nowrap; }',
'  .pp-uc-member-since { grid-column: 2; grid-row: 6; justify-self: end; }',
'  .profile-info-stack > div:last-child, .profile-info-stack-inner > button { grid-column: 1 / -1; grid-row: 7; margin-bottom: 16px; }',
'  .sp-main { grid-column: 1 / -1; grid-row: 8; margin-top: 16px; }',
'  .sp-side { grid-column: 1 / -1; grid-row: 9; }',
'  .sp-fav-body { flex-wrap: wrap; }',
'  .sp-fav-art { flex: 0 0 112px; width: 112px; height: 150px; }',
'  .sp-stats { flex: 1 1 100%; flex-direction: row; flex-wrap: wrap; }',
'  .sp-stats .sp-stat { flex: 1 1 0; }',
'  .sp-play { flex: 1 1 100%; }',
'  .sp-collect-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
'  .sp-work-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
'  .sp-stats-row { flex-wrap: wrap; }',
'  .profile-page-container-flex-box { padding: 0 12px 16px; }',
'  .profile-character-card-stack { grid-template-columns: 96px minmax(0, 1fr); padding: 8px; gap: 2px 10px; }',
'  .profile-character-card-avatar-aspect-ratio { grid-row: 1 / span 4; width: 96px; height: 120px; }',
'  .profile-character-card-stats-box { grid-column: 2; grid-row: 4; justify-self: start; }',
'  .profile-character-card-box { display: none; }',
'}'
    ];
    return lines.concat([''], frameCss(o, t)).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  global.JaiSteamProfile = {
    themes: THEMES,
    frames: FRAMES,
    backdrops: BACKDROPS,
    backdrop: backdrop,
    theme: theme,
    markup: markup,
    css: css,
    style: style
  };
})(window);
