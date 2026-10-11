/*
 * The "Operator terminal" layout (Frontier Protocol): a whole interface built
 * from Profile information, in the manner of an industrial sci-fi game's
 * menus — flat panels, one loud accent, slanted art, small technical print.
 *
 * Where the other designs dress JanitorAI's page, this one replaces it. The
 * profile box becomes an application the width of the window: a rail down the
 * left (the screens, and JanitorAI's own avatar, name, counts and Follow
 * button, which stay live), and a main area that is one screen at a time:
 *
 *   Overview   a slideshow of the featured characters over the creator's
 *              backdrop, each with its art on a slanted plate
 *   Operators  every character as a roster tile
 *   File       one screen per character: scene, art, name, lines, tags,
 *              counts and the way in to the chat
 *   Dossier    the creator: an ID card and About me
 *   Network    social links and friends
 *   Log        creator notes and the extra sections
 *
 * Nothing here is JanitorAI's character list: the characters are written into
 * the markup, which is what lets each have a screen and pictures of its own.
 * The price is that a new bot needs Profile data updating; the option to show
 * JanitorAI's live list underneath is there for that.
 *
 * No script runs on JanitorAI, so a screen is a `:target`: every link points
 * at a fixed one-pixel key (.fp-key) and the stylesheet shows the screen whose
 * key was clicked last. `markup` writes the screens, `css` the rules that
 * depend on how many characters there are (which file a key opens, the
 * slideshow's timing), and `style` the look.
 *
 * Pictures it can use, all optional, all <img> (JanitorAI strips url()):
 *   the backdrop (fpBackground) and an emblem (fpEmblem); per character the
 *   stage art (art), the roster tile (portrait) and a scene for the file
 *   screen (hover).
 */
(function (global) {
  'use strict';

  /* bg: the main area · panel: cards · ink: text · rail: the left column. */
  var THEMES = {
    day: {
      name: 'Daylight',
      bg: '#e8e7e2', panel: '#f6f5f1', ink: '#14151a', mute: '#6c6d73', line: '#c2c1bb',
      rail: '#14151a', railInk: '#f1f0ea', railMute: '#8b8c92', railLine: '#2e2f36'
    },
    night: {
      name: 'Night shift',
      bg: '#0f1013', panel: '#1a1b20', ink: '#f1f0ea', mute: '#8e8f96', line: '#30313a',
      rail: '#08090b', railInk: '#f1f0ea', railMute: '#7d7e85', railLine: '#25262c'
    }
  };

  var MAX_FILES = 36;
  var MAX_SLIDES = 5;
  var SLIDE_SECONDS = 7;

  function theme(o) { return THEMES[o.fpTheme] || THEMES.day; }

  function accent(o) {
    var c = String(o.fpAccent || '').trim();
    return /^#[0-9a-f]{6}$/i.test(c) ? c : '#ffd60a';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function attr(value) { return esc(value).replace(/"/g, '&quot;'); }

  function multiline(value) { return esc(value).replace(/\r?\n/g, '<br>'); }

  function usable(src) { return global.JaiHardcode.usable(src); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* Typed by the creator, as opposed to another design's stand-in wording. */
  function written(o, key) {
    var value = String(o[key] == null ? '' : o[key]).trim();
    return value && value !== global.JaiHardcode.defaults[key] ? value : '';
  }

  function number(text) {
    var n = parseFloat(String(text || '').replace(/,/g, ''));
    if (isNaN(n)) return 0;
    if (/k\s*$/i.test(text)) n *= 1000;
    if (/m\s*$/i.test(text)) n *= 1000000;
    return n;
  }

  /* 48213 -> "48.2k", the way the site writes a count. */
  function compact(n) {
    function trim(x) { return String(Math.round(x * 10) / 10).replace(/\.0$/, ''); }
    if (n >= 1000000) return trim(n / 1000000) + 'm';
    if (n >= 1000) return trim(n / 1000) + 'k';
    return String(Math.round(n));
  }

  function siteName(link) {
    return String(link || '').replace(/^https?:\/\/(www\.)?/i, '').split(/[/?#]/)[0];
  }

  function initial(text) { return esc(String(text || '?').trim().charAt(0).toUpperCase() || '?'); }

  function tagChip(tag) {
    var label = esc(global.JaiTags.label(tag));
    if (!global.JaiTags.isLinkable(tag)) return '<span>' + label + '</span>';
    return '<a href="' + attr(global.JaiTags.url(tag)) + '">' + label + '</a>';
  }

  /* The characters that get a screen, and the ones the overview cycles. */
  function roster(files) { return files.slice(0, MAX_FILES); }

  function slides(files) {
    var list = roster(files);
    var featured = list.filter(function (f) { return f.featured; });
    return (featured.length ? featured : list).slice(0, MAX_SLIDES);
  }

  function socials(o) { return (o.socials || []).filter(function (s) { return s && usable(s.link); }); }

  function friends(o) { return (o.friends || []).filter(function (f) { return f && String(f.name || '').trim(); }); }

  function logEntries(o) {
    var list = [];
    var notes = written(o, 'creatorNotes');
    if (notes) list.push({ title: 'Creator notes', body: notes });
    (o.sections || []).forEach(function (s) {
      if (s && (s.title || s.body)) list.push({ title: s.title || 'Entry', body: s.body });
    });
    return list;
  }

  /* A picture, or the hatched plate that stands where one is missing. */
  function picture(src, cls, alt) {
    return usable(src) ? '<img class="' + cls + '" src="' + attr(src) + '" alt="' + attr(alt || '') + '">'
      : '<span class="' + cls + ' fp-noimg"><b>No image</b></span>';
  }

  // ----------------------------------------------------------------- markup

  /* One line, as every generated block is: a newline between two inline-level
   * tags renders as a space. */
  function markup(files, o) {
    var list = roster(files);
    var show = slides(files);
    var identity = o.identity || {};
    var name = String(identity.username || '').trim().replace(/^@/, '');
    var brand = written(o, 'fpCallsign') || 'Frontier Protocol';
    var links = socials(o);
    var allies = friends(o);
    var entries = logEntries(o);
    var chats = list.reduce(function (sum, f) { return sum + number(f.chats); }, 0);
    var total = identity.characterCount || String(files.length);
    var html = [];

    // The keys: what every link in the interface points at.
    html.push('<span class="fp-key" id="fp-home"></span><span class="fp-key" id="fp-roster"></span>' +
      '<span class="fp-key" id="fp-dossier"></span><span class="fp-key" id="fp-network"></span><span class="fp-key" id="fp-log"></span>');
    list.forEach(function (f, i) { html.push('<span class="fp-key fp-key-op" id="fp-op-' + (i + 1) + '"></span>'); });

    html.push('<div class="fp-boot" aria-hidden="true"><div class="fp-boot-box"><b>' + esc(brand) + '</b>' +
      '<span>Establishing link</span><i></i><em>Operator files ' + pad(list.length) + ' · signal nominal</em></div></div>');

    // ---- the rail
    html.push('<div class="fp-brand">' +
      (usable(o.fpEmblem) ? '<img class="fp-emblem" src="' + attr(o.fpEmblem) + '" alt="">' : '<span class="fp-emblem fp-emblem-mark"><i></i></span>') +
      '<div class="fp-brand-text"><b>' + esc(brand) + '</b><span>Terminal · online</span></div></div>');

    html.push('<nav class="fp-nav" aria-label="Screens">' +
      navItem('home', 1, 'Overview', 'Featured operators') +
      navItem('roster', 2, 'Operators', pad(list.length) + ' files on record') +
      navItem('dossier', 3, 'Dossier', 'About the creator') +
      (links.length || allies.length ? navItem('network', 4, 'Network', 'Links &amp; allies') : '') +
      (entries.length ? navItem('log', 5, 'Log', pad(entries.length) + (entries.length === 1 ? ' entry' : ' entries')) : '') +
      '</nav>');
    html.push('<div class="fp-railfoot"><i class="fp-barcode"></i><span>ID ' + esc((name || 'unknown').toUpperCase()) + ' // ' + pad(list.length) + '-' + esc(compact(chats).toUpperCase()) + '</span></div>');

    // ---- the main area
    html.push('<div class="fp-main">');
    if (usable(o.fpBackground)) html.push('<img class="fp-bg" src="' + attr(o.fpBackground) + '" alt="">');
    html.push('<i class="fp-veil"></i><i class="fp-dots"></i>');

    // Overview
    html.push('<section class="fp-screen fp-screen-home"><i class="fp-wipe"></i>' +
      '<div class="fp-hud"><span><b>' + esc(total) + '</b>Operators</span>' +
      (chats ? '<span><b>' + compact(chats) + '</b>Chats on record</span>' : '') +
      '<span class="fp-hud-live"><i></i>System online</span></div>');
    show.forEach(function (f, i) {
      var at = list.indexOf(f) + 1;
      var line = f.tagline || f.quote || f.description;
      html.push('<div class="fp-slide fp-slide-' + (i + 1) + '"><div class="fp-ghost">' + esc(f.name) + '</div>' +
        '<i class="fp-plate"></i>' + picture(f.art, 'fp-slide-art', f.name) +
        '<div class="fp-slide-info"><div class="fp-label"><i></i>Featured operator <b>' + pad(i + 1) + '</b> / ' + pad(show.length) + '</div>' +
        '<h2 class="fp-slide-name">' + esc(f.name) + '</h2>' +
        (line ? '<p class="fp-slide-line">' + esc(line) + '</p>' : '') +
        (f.tags.length ? '<div class="fp-chips">' + f.tags.slice(0, 5).map(tagChip).join('') + '</div>' : '') +
        '<div class="fp-actions"><a class="fp-btn fp-btn-main" href="#fp-op-' + at + '">Open file<i></i></a>' +
        (usable(f.link) ? '<a class="fp-btn" href="' + attr(f.link) + '">Initiate chat</a>' : '') + '</div></div></div>');
    });
    if (show.length > 1) {
      html.push('<div class="fp-picks">' + show.map(function (f, i) {
        return '<a class="fp-pick fp-pick-' + (i + 1) + '" href="#fp-op-' + (list.indexOf(f) + 1) + '" aria-label="' + attr(f.name) + '">' +
          picture(f.portrait, 'fp-pick-img', '') + '<span>' + pad(i + 1) + '</span></a>';
      }).join('') + '</div><div class="fp-progress">' + show.map(function (f, i) {
        return '<i class="fp-progress-' + (i + 1) + '"></i>';
      }).join('') + '</div>');
    }
    html.push('</section>');

    // Operators
    html.push('<section class="fp-screen fp-screen-roster"><i class="fp-wipe"></i>' +
      head(2, 'Operator roster', '<b>' + pad(list.length) + '</b> files on record') +
      '<div class="fp-roster">' + list.map(function (f, i) {
        return '<a class="fp-card" href="#fp-op-' + (i + 1) + '"><span class="fp-card-art">' + picture(f.portrait, 'fp-card-img', '') + '</span>' +
          '<span class="fp-card-no">' + pad(i + 1) + '</span><span class="fp-card-name">' + esc(f.name) + '</span>' +
          '<span class="fp-card-meta">' + (f.chats ? esc(f.chats) + ' chats' : 'New file') + '</span></a>';
      }).join('') + '</div></section>');

    // One file per character
    list.forEach(function (f, i) {
      var prev = i === 0 ? list.length : i;
      var next = i === list.length - 1 ? 1 : i + 2;
      // A scene of its own if the creator gave one; otherwise the art, blurred.
      var own = usable(f.hover) && f.hover !== f.art;
      html.push('<section class="fp-screen fp-file fp-file-' + (i + 1) + '"><i class="fp-wipe"></i>' +
        (usable(own ? f.hover : f.art) ? '<img class="fp-file-scene' + (own ? '' : ' fp-file-scene-soft') + '" src="' + attr(own ? f.hover : f.art) + '" alt="">' : '') +
        '<i class="fp-file-shade"></i><i class="fp-file-plate"></i>' +
        '<div class="fp-file-art">' + picture(f.art, 'fp-file-img', f.name) + '</div>' +
        '<div class="fp-file-no">' + pad(i + 1) + '</div>' +
        '<div class="fp-file-info"><div class="fp-file-top"><a class="fp-back" href="#fp-roster">Roster</a>' +
        '<span>File <b>' + pad(i + 1) + '</b> / ' + pad(list.length) + '</span></div>' +
        '<h2 class="fp-file-name">' + esc(f.name) + '</h2>' +
        (f.tagline ? '<p class="fp-file-line">' + esc(f.tagline) + '</p>' : '') +
        (f.quote ? '<div class="fp-quote">' + esc(f.quote) + '</div>' : '') +
        (f.description ? '<p class="fp-file-desc">' + esc(f.description) + '</p>' : '') +
        (f.tags.length ? '<div class="fp-chips">' + f.tags.slice(0, 10).map(tagChip).join('') + '</div>' : '') +
        '<div class="fp-stats">' + (f.chats ? '<span><b>' + esc(f.chats) + '</b>Chats</span>' : '') +
        (f.tokens ? '<span><b>' + esc(f.tokens) + '</b>Tokens</span>' : '') +
        '<span><b>' + pad(i + 1) + '</b>File no.</span></div>' +
        '<div class="fp-actions">' +
        (usable(f.link) ? '<a class="fp-btn fp-btn-main" href="' + attr(f.link) + '">Initiate chat<i></i></a>' : '') +
        (list.length > 1 ? '<a class="fp-btn fp-btn-step" href="#fp-op-' + prev + '">Prev</a><a class="fp-btn fp-btn-step" href="#fp-op-' + next + '">Next</a>' : '') +
        '</div></div></section>');
    });

    // Dossier
    var about = written(o, 'aboutBody');
    var heading = written(o, 'aboutTitle');
    html.push('<section class="fp-screen fp-screen-dossier"><i class="fp-wipe"></i>' + head(3, 'Creator dossier', 'Clearance: public') +
      '<div class="fp-dossier"><div class="fp-idcard"><div class="fp-idcard-photo">' +
      (usable(identity.avatar) ? '<img src="' + attr(identity.avatar) + '" alt="">' : '<b>' + initial(name) + '</b>') + '</div>' +
      '<div class="fp-idcard-rows"><span>Callsign</span><b>' + esc(name ? '@' + name : 'Unregistered') + '</b>' +
      (identity.memberSince ? '<span>Active since</span><b>' + esc(identity.memberSince) + '</b>' : '') +
      '<span>Files</span><b>' + esc(total) + '</b>' +
      (chats ? '<span>Chats on record</span><b>' + compact(chats) + '</b>' : '') +
      (identity.followers ? '<span>Followers</span><b>' + esc(identity.followers) + '</b>' : '') +
      '</div><i class="fp-barcode"></i></div>' +
      '<div class="fp-about"><h3>' + esc(heading || 'About the creator') + '</h3><p>' +
      (about ? multiline(about) : 'Write your introduction under Profile data → About me and it appears here.') + '</p></div></div></section>');

    // Network
    if (links.length || allies.length) {
      html.push('<section class="fp-screen fp-screen-network"><i class="fp-wipe"></i>' + head(4, 'Network', 'Outbound links &amp; allied creators'));
      if (links.length) {
        html.push('<div class="fp-links">' + links.map(function (s, i) {
          return '<a class="fp-link" href="' + attr(s.link) + '"><i>' + pad(i + 1) + '</i><b>' + esc(s.label || siteName(s.link)) + '</b>' +
            '<span>' + esc(siteName(s.link)) + '</span><em></em></a>';
        }).join('') + '</div>');
      }
      if (allies.length) {
        html.push('<div class="fp-sub">' + esc(written(o, 'friendsTitle') || 'Allied operators') + '</div><div class="fp-allies">' + allies.map(function (f) {
          var ally = String(f.name).trim().replace(/^@/, '');
          var note = String(f.note || '').trim();
          return '<a class="fp-ally"' + (usable(f.link) ? ' href="' + attr(f.link) + '"' : '') + '><span class="fp-ally-face">' +
            (usable(f.image) ? '<img src="' + attr(f.image) + '" alt="">' : '<b>' + initial(ally) + '</b>') + '</span>' +
            '<span class="fp-ally-text"><b>' + esc(ally) + '</b>' + (note ? '<span>' + esc(note) + '</span>' : '') + '</span></a>';
        }).join('') + '</div>');
      }
      html.push('</section>');
    }

    // Log
    if (entries.length) {
      html.push('<section class="fp-screen fp-screen-log"><i class="fp-wipe"></i>' + head(5, 'Log', pad(entries.length) + ' on record') +
        '<div class="fp-log">' + entries.map(function (e, i) {
          return '<details class="fp-entry"' + (i === 0 ? ' open' : '') + '><summary><i>' + pad(i + 1) + '</i>' + esc(e.title) + '</summary>' +
            (e.body ? '<p>' + multiline(e.body) + '</p>' : '') + '</details>';
        }).join('') + '</div></section>');
    }

    var ticker = written(o, 'fpTicker') || (brand + ' · ' + pad(list.length) + ' operator files · ' + (name ? '@' + name + ' · ' : '') + 'Requests open');
    var run = '<span>' + esc(ticker) + '</span>';
    html.push('<div class="fp-ticker" aria-hidden="true"><div class="fp-ticker-run">' + run + run + run + run + '</div></div>');
    html.push('</div>');
    return html.join('');
  }

  function navItem(key, n, label, note) {
    return '<a class="fp-nav-item fp-nav-' + key + '" href="#fp-' + key + '"><i>' + pad(n) + '</i><b>' + label + '</b><span>' + note + '</span></a>';
  }

  function head(n, title, note) {
    return '<div class="fp-head"><div class="fp-label"><i></i>Section ' + pad(n) + '</div><h2>' + title + '</h2><span>' + note + '</span></div>';
  }

  // ----------------------------------------------------------------- wiring

  /* What depends on the roster: which file each key opens, and the timing of
   * a slideshow with this many slides. */
  function css(files, o) {
    var list = roster(files);
    var show = slides(files);
    var n = show.length;
    var out = ['/* Generated from Profile data — edit it there, not here. */'];

    out.push(list.map(function (f, i) {
      return '.profile-info-stack:has(#fp-op-' + (i + 1) + ':target) .fp-file-' + (i + 1);
    }).join(',\n') + ' { display: block; }');

    if (n > 1) {
      var slot = 100 / n;
      var fade = Math.min(4, slot * 0.14);
      var cycle = n * SLIDE_SECONDS;
      function pct(x) { return (Math.round(x * 100) / 100) + '%'; }
      out.push('@keyframes fp-show { 0% { opacity: 0; visibility: hidden; } ' + pct(fade) + ' { opacity: 1; visibility: visible; } ' +
        pct(slot) + ' { opacity: 1; visibility: visible; } ' + pct(slot + fade) + ' { opacity: 0; visibility: hidden; } 100% { opacity: 0; visibility: hidden; } }');
      out.push('@keyframes fp-art { 0% { transform: translateX(46px); } ' + pct(fade * 2.2) + ' { transform: translateX(0); } 100% { transform: translateX(0); } }');
      out.push('@keyframes fp-fill { 0% { transform: scaleX(0); } ' + pct(slot) + ' { transform: scaleX(1); } ' +
        pct(slot + 0.01) + ' { transform: scaleX(0); } 100% { transform: scaleX(0); } }');
      out.push('.fp-slide { animation: fp-show ' + cycle + 's linear infinite backwards; }');
      out.push('.fp-slide .fp-slide-art, .fp-slide .fp-plate { animation: fp-art ' + cycle + 's cubic-bezier(.2, .8, .2, 1) infinite backwards; }');
      out.push('.fp-progress i::after { animation: fp-fill ' + cycle + 's linear infinite backwards; }');
      show.forEach(function (f, i) {
        if (!i) return;
        var delay = (i * SLIDE_SECONDS) + 's';
        out.push('.fp-slide-' + (i + 1) + ', .fp-slide-' + (i + 1) + ' .fp-slide-art, .fp-slide-' + (i + 1) + ' .fp-plate, .fp-progress i.fp-progress-' + (i + 1) + '::after { animation-delay: ' + delay + '; }');
      });
      // Pointing at a thumbnail holds its slide.
      out.push(show.map(function (f, i) { return '.fp-screen-home:has(.fp-pick-' + (i + 1) + ':hover) .fp-slide'; }).join(',\n') +
        ' { animation: none; opacity: 0; visibility: hidden; }');
      out.push(show.map(function (f, i) { return '.fp-screen-home:has(.fp-pick-' + (i + 1) + ':hover) .fp-slide-' + (i + 1); }).join(',\n') +
        ' { opacity: 1; visibility: visible; }');
      out.push('@media (prefers-reduced-motion: reduce) { .fp-slide, .fp-slide .fp-slide-art, .fp-slide .fp-plate, .fp-progress i::after { animation: none; } ' +
        '.fp-slide { opacity: 0; visibility: hidden; } .fp-slide-1 { opacity: 1; visibility: visible; } }');
    }
    return out.join('\n') + '\n';
  }

  // ------------------------------------------------------------- stylesheet

  var HEAD = '"Bahnschrift", "DIN Alternate", "Barlow Condensed", "Oswald", "Arial Narrow", "Segoe UI", sans-serif';
  var MONO = '"JetBrains Mono", "Cascadia Mono", "SF Mono", Consolas, Menlo, monospace';
  var BODY = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif';

  /* Written with @tokens@ and filled in at the end: JanitorAI strips custom
   * properties, so a theme is a search and replace. */
  var SHEET = [
'/* ---- page: the window is the application ---- */',
'html, body { background: @bg@; }',
'body { color: @ink@; font-family: @BODY@; }',
'.profile-background-effect-image { display: none; }',
'.pp-page-background { background: @bg@ !important; }',
'',
'/* Every wrapper between the window and the profile box is unclamped, so the',
' * interface runs edge to edge. */',
'.profile-page-container, .profile-page-flex, .pp-uc-background, .profile-info-wrapper-box {',
'  width: 100% !important;',
'  min-width: 0 !important;',
'  max-width: none !important;',
'  margin: 0 !important;',
'  padding: 0 !important;',
'  border: 0 !important;',
'  border-radius: 0 !important;',
'  background: transparent !important;',
'  box-shadow: none !important;',
'}',
'.profile-page-flex { display: block !important; }',
'/* JanitorAI pads the page 48px a side. */',
'main:has(> .profile-page-container) { padding: 0 !important; }',
'.profile-background-box-1, .profile-background-box-2, .profile-background-box-3 { display: none; }',
'',
'/* The avatar, name and counts are nested three deep and About Me sits beside',
' * them. Flattening the wrappers puts every piece, JanitorAI\'s and this',
' * layout\'s, on one grid: the rail in the first two columns, the main area in',
' * the third. */',
'.profile-info-hstack, .profile-info-stack-inner, .pp-uc-about-me { display: contents; }',
'.profile-info-stack {',
'  display: grid !important;',
'  grid-template-columns: 76px 180px minmax(0, 1fr);',
'  grid-template-rows: auto minmax(0, 1fr) auto auto auto auto auto auto;',
'  gap: 0 !important;',
'  align-items: start;',
'  position: relative;',
'  height: clamp(660px, 56vw, 900px);',
'  margin: 0 !important;',
'  padding: 0 !important;',
'  overflow: hidden;',
'  color: @ink@;',
'}',
'',
'/* The rail\'s own colour, painted behind its two columns. */',
'.profile-info-stack::before {',
'  content: "";',
'  position: absolute;',
'  top: 0;',
'  bottom: 0;',
'  left: 0;',
'  z-index: 0;',
'  width: 256px;',
'  border-right: 1px solid @railLine@;',
'  background: @rail@;',
'}',
'',
'/* The keys: fixed and already on screen, so a click never scrolls the page. */',
'.fp-key { position: fixed; top: 0; left: 0; width: 1px; height: 1px; pointer-events: none; }',
'',
'/* ---- rail ---- */',
'.fp-brand {',
'  grid-column: 1 / 3;',
'  grid-row: 1;',
'  z-index: 2;',
'  display: flex;',
'  align-items: center;',
'  gap: 12px;',
'  padding: 22px 20px 18px;',
'  border-bottom: 1px solid @railLine@;',
'}',
'.fp-emblem { flex: 0 0 38px; width: 38px; height: 38px; object-fit: cover; }',
'/* With no emblem of your own: a hazard-yellow block with a notch turning in it. */',
'.fp-emblem-mark { display: flex; align-items: center; justify-content: center; background: @a@; clip-path: polygon(0 0, 100% 0, 100% 72%, 72% 100%, 0 100%); }',
'.fp-emblem-mark i { width: 16px; height: 16px; border: 3px solid @onA@; border-right-color: transparent; border-radius: 50%; animation: fp-spin 5s linear infinite; }',
'.fp-brand-text { min-width: 0; }',
'.fp-brand-text b { display: block; overflow: hidden; color: @railInk@; font-family: @HEAD@; font-size: 17px; font-stretch: 75%; font-weight: 700; letter-spacing: .06em; line-height: 1.1; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }',
'.fp-brand-text span { display: block; margin-top: 3px; color: @a@; font-family: @MONO@; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }',
'',
'.fp-nav { grid-column: 1 / 3; grid-row: 2; z-index: 2; align-self: start; display: flex; flex-direction: column; padding: 10px 0; }',
'.fp-nav-item {',
'  position: relative;',
'  display: grid;',
'  grid-template-columns: 30px minmax(0, 1fr);',
'  gap: 0 6px;',
'  align-items: baseline;',
'  padding: 11px 20px 11px 20px;',
'  color: @railMute@;',
'  text-decoration: none;',
'  transition: color .2s ease, background .2s ease, padding .2s ease;',
'}',
'.fp-nav-item i { grid-row: 1 / 3; align-self: center; color: @railMute@; font-family: @MONO@; font-size: 10px; font-style: normal; }',
'.fp-nav-item b { color: @railInk@; font-family: @HEAD@; font-size: 19px; font-stretch: 75%; font-weight: 600; letter-spacing: .06em; line-height: 1.1; text-transform: uppercase; transition: color .2s ease; }',
'.fp-nav-item span { overflow: hidden; font-family: @MONO@; font-size: 9px; letter-spacing: .08em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }',
'/* The marker that slides in beside the open screen. */',
'.fp-nav-item::before { content: ""; position: absolute; top: 8px; bottom: 8px; left: 0; width: 4px; background: @a@; transform: scaleY(0); transition: transform .25s cubic-bezier(.2, .8, .2, 1); }',
'.fp-nav-item::after { content: ""; position: absolute; top: 50%; right: 18px; width: 6px; height: 6px; border-top: 2px solid @a@; border-right: 2px solid @a@; opacity: 0; transform: translate(-8px, -50%) rotate(45deg); transition: opacity .2s ease, transform .2s ease; }',
'/* The colour is said again on hover: JanitorAI turns hovered links purple. */',
'.fp-nav-item:hover { padding-left: 26px; background: @railInk@0d; color: @railMute@; }',
'.fp-nav-home,',
'.profile-info-stack:has(#fp-roster:target, .fp-key-op:target) .fp-nav-roster,',
'.profile-info-stack:has(#fp-dossier:target) .fp-nav-dossier,',
'.profile-info-stack:has(#fp-network:target) .fp-nav-network,',
'.profile-info-stack:has(#fp-log:target) .fp-nav-log { background: @railInk@12; }',
'.fp-nav-home b,',
'.profile-info-stack:has(#fp-roster:target, .fp-key-op:target) .fp-nav-roster b,',
'.profile-info-stack:has(#fp-dossier:target) .fp-nav-dossier b,',
'.profile-info-stack:has(#fp-network:target) .fp-nav-network b,',
'.profile-info-stack:has(#fp-log:target) .fp-nav-log b { color: @a@; }',
'.fp-nav-home::before,',
'.profile-info-stack:has(#fp-roster:target, .fp-key-op:target) .fp-nav-roster::before,',
'.profile-info-stack:has(#fp-dossier:target) .fp-nav-dossier::before,',
'.profile-info-stack:has(#fp-network:target) .fp-nav-network::before,',
'.profile-info-stack:has(#fp-log:target) .fp-nav-log::before { transform: scaleY(1); }',
'.fp-nav-home::after,',
'.profile-info-stack:has(#fp-roster:target, .fp-key-op:target) .fp-nav-roster::after,',
'.profile-info-stack:has(#fp-dossier:target) .fp-nav-dossier::after,',
'.profile-info-stack:has(#fp-network:target) .fp-nav-network::after,',
'.profile-info-stack:has(#fp-log:target) .fp-nav-log::after { opacity: 1; transform: translate(0, -50%) rotate(45deg); }',
'/* Overview is lit until another screen\'s key is the target. */',
'.profile-info-stack:has(.fp-key:not(#fp-home):target) .fp-nav-home { background: transparent; }',
'.profile-info-stack:has(.fp-key:not(#fp-home):target) .fp-nav-home b { color: @railInk@; }',
'.profile-info-stack:has(.fp-key:not(#fp-home):target) .fp-nav-home::before { transform: scaleY(0); }',
'.profile-info-stack:has(.fp-key:not(#fp-home):target) .fp-nav-home::after { opacity: 0; }',
'',
'/* JanitorAI\'s own identity, set into the foot of the rail: live, restyled. */',
'.pp-uc-avatar-container { grid-column: 1; grid-row: 3 / 5; z-index: 2; width: 46px; height: 46px; margin: 16px 0 0 20px; }',
'.pp-uc-avatar { width: 100% !important; height: 100% !important; border-radius: 0 !important; object-fit: cover; clip-path: polygon(0 0, 100% 0, 100% 76%, 76% 100%, 0 100%); }',
'.profile-info-stack-inner-flex { grid-column: 2; grid-row: 3; z-index: 2; align-self: end; min-width: 0; margin: 16px 16px 0 0; }',
'.pp-uc-title { margin: 0; overflow: hidden; color: @railInk@; font-family: @HEAD@; font-size: 18px; font-stretch: 75%; font-weight: 700; letter-spacing: .04em; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }',
'.pp-uc-member-since { grid-column: 2; grid-row: 4; z-index: 2; margin: 2px 16px 0 0; overflow: hidden; color: @railMute@; font-family: @MONO@ !important; font-size: 9px; letter-spacing: .06em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }',
'.pp-uc-followers-count { grid-column: 1 / 3; grid-row: 5; z-index: 2; display: flex; align-items: center; gap: 8px; margin: 12px 20px 0; color: @railInk@; font-family: @MONO@ !important; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }',
'.pp-uc-followers-count::before { content: ""; flex: 0 0 auto; width: 8px; height: 8px; background: @a@; animation: fp-blink 1.6s steps(2) infinite; }',
'.profile-badges { grid-column: 1 / 3; grid-row: 6; z-index: 2; display: flex !important; flex-wrap: wrap; gap: 6px !important; margin: 10px 20px 0 !important; }',
'.profile-badge { margin: 0 !important; }',
'.profile-badge-img { width: 22px !important; height: 22px !important; }',
'/* Follow and Options: only visitors have them. */',
'.profile-info-stack > div:last-child:not(.pp-uc-about-me) { grid-column: 1 / 3; grid-row: 7; z-index: 2; box-sizing: border-box; width: auto !important; height: auto !important; margin: 12px 20px 0 !important; padding: 0 !important; }',
'.profile-info-stack > div:last-child:not(.pp-uc-about-me) > div { display: flex; gap: 6px; width: 100%; margin: 0 !important; }',
'.pp-uc-follow-flex { flex: 1 1 auto; }',
'.pp-uc-follow-button { width: 100% !important; height: 36px !important; min-height: 36px !important; border: 0 !important; border-radius: 0 !important; background: @a@ !important; box-shadow: none !important; clip-path: polygon(0 0, 100% 0, 100% 68%, 92% 100%, 0 100%); transition: filter .2s ease; }',
'.pp-uc-follow-button::before, .pp-uc-follow-button::after { display: none !important; }',
'.pp-uc-follow-button:hover { filter: brightness(1.1); }',
'.pp-uc-follow-text { color: @onA@ !important; font-family: @HEAD@; font-size: 15px; font-stretch: 75%; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }',
'.pp-uc-options-menu { flex: 0 0 auto; display: flex !important; flex-direction: row; align-items: center; gap: 4px; height: 36px !important; min-height: 36px !important; padding: 0 10px !important; border: 1px solid @railLine@ !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; color: @railInk@ !important; font-family: @MONO@; font-size: 10px; text-transform: uppercase; }',
'.pp-uc-options-menu:hover { border-color: @a@ !important; }',
'/* Edit profile: only the owner has it. It takes Follow\'s place. */',
'.profile-info-stack-inner > button { grid-column: 1 / 3; grid-row: 7; z-index: 2; justify-self: stretch; height: 36px; margin: 12px 20px 0 !important; border: 1px solid @a@ !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; color: @a@ !important; font-family: @MONO@; font-size: 11px; text-transform: uppercase; }',
'/* Customize: only the owner has it. Absolutely placed already; this puts it',
' * in the main area\'s top right corner. */',
'.profile-info-stack > div:first-child:not(.profile-info-hstack) { z-index: 8; top: 14px !important; right: 14px !important; bottom: auto !important; left: auto !important; }',
'.fp-railfoot { grid-column: 1 / 3; grid-row: 8; z-index: 2; margin: 14px 20px 16px; }',
'.fp-railfoot span { display: block; margin-top: 6px; overflow: hidden; color: @railMute@; font-family: @MONO@; font-size: 8px; letter-spacing: .12em; text-overflow: ellipsis; white-space: nowrap; }',
'/* A barcode: stripes of uneven width. */',
'.fp-barcode { display: block; height: 18px; background: repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px, currentColor 5px 6px, transparent 6px 10px, currentColor 10px 14px, transparent 14px 16px); }',
'.fp-railfoot .fp-barcode { color: @railMute@; }',
'',
'/* ---- the start-up screen: over the interface for two seconds ---- */',
'.fp-boot { position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: @rail@; pointer-events: none; animation: fp-boot-out 2.1s cubic-bezier(.7, 0, .2, 1) forwards; }',
'.fp-boot-box { width: min(420px, 76%); }',
'.fp-boot-box b { display: block; color: @railInk@; font-family: @HEAD@; font-size: 34px; font-stretch: 75%; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }',
'.fp-boot-box span { display: block; margin-top: 6px; color: @a@; font-family: @MONO@; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; }',
'.fp-boot-box i { display: block; height: 4px; margin-top: 18px; background: @a@; transform-origin: 0 50%; animation: fp-boot-bar 1.4s cubic-bezier(.3, 0, .2, 1) both; }',
'.fp-boot-box em { display: block; margin-top: 10px; color: @railMute@; font-family: @MONO@; font-size: 9px; font-style: normal; letter-spacing: .14em; text-transform: uppercase; }',
'',
'/* ---- main area ---- */',
'.fp-main { grid-column: 3; grid-row: 1 / -1; z-index: 1; align-self: stretch; position: relative; min-width: 0; height: 100%; overflow: hidden; background: @bg@; }',
'/* Your backdrop: an <img>, because JanitorAI strips url() from stylesheets. */',
'.fp-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }',
'/* The veil keeps print readable over any picture: solid at the left, where',
' * the words are, thinning to the right, where the art is. */',
'.fp-main > i { position: absolute; inset: 0; display: block; pointer-events: none; }',
'.fp-veil { background: linear-gradient(90deg, @bg@f5 0%, @bg@d9 38%, @bg@8c 70%, @bg@59 100%); }',
'.fp-dots { background-image: radial-gradient(@ink@1f 1px, transparent 1px); background-size: 22px 22px; }',
'',
'/* A screen: hidden until its key is the target. Overview is the exception,',
' * shown until some other key is. */',
'.fp-screen { position: absolute; inset: 0 0 28px 0; display: none; overflow: hidden; }',
'.fp-screen-home { display: block; }',
'.profile-info-stack:has(.fp-key:not(#fp-home):target) .fp-screen-home { display: none; }',
'.profile-info-stack:has(#fp-roster:target) .fp-screen-roster,',
'.profile-info-stack:has(#fp-dossier:target) .fp-screen-dossier,',
'.profile-info-stack:has(#fp-network:target) .fp-screen-network,',
'.profile-info-stack:has(#fp-log:target) .fp-screen-log { display: block; }',
'.fp-screen-roster, .fp-screen-dossier, .fp-screen-network, .fp-screen-log { padding: 38px 44px 40px; overflow-y: auto; }',
'/* Changing screens: a slab of the accent crosses, and the screen is there. */',
'.fp-wipe { position: absolute; inset: 0; z-index: 9; display: block; background: @a@; pointer-events: none; animation: fp-wipe .75s cubic-bezier(.7, 0, .2, 1) both; }',
'',
'/* Small technical print, used all over. */',
'.fp-label { display: flex; align-items: center; gap: 8px; color: @mute@; font-family: @MONO@; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; }',
'.fp-label i { width: 18px; height: 8px; background: repeating-linear-gradient(135deg, @a@ 0 3px, @ink@ 3px 6px); }',
'.fp-label b { color: @ink@; }',
'.fp-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 20px; align-items: end; margin-bottom: 26px; padding-bottom: 16px; border-bottom: 2px solid @ink@; animation: fp-rise .6s ease .3s both; }',
'.fp-head .fp-label { grid-column: 1 / -1; }',
'.fp-head h2 { margin: 0; color: @ink@; font-family: @HEAD@; font-size: clamp(34px, 4.4vw, 62px); font-stretch: 75%; font-weight: 700; letter-spacing: .02em; line-height: .95; text-transform: uppercase; }',
'.fp-head > span { color: @mute@; font-family: @MONO@; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }',
'.fp-head > span b { color: @ink@; }',
'',
'/* Tags. A flex row, so the whitespace between chips is not a gap. */',
'.fp-chips { display: flex; flex-wrap: wrap; gap: 5px; }',
'.fp-chips a, .fp-chips span { padding: 4px 9px; border: 1px solid @ink@66; color: @ink@; font-family: @MONO@; font-size: 10px; letter-spacing: .06em; line-height: 1.3; text-decoration: none; text-transform: uppercase; transition: background .15s ease, color .15s ease, border-color .15s ease; }',
'.fp-chips a:hover { border-color: @ink@; background: @ink@; color: @bg@; }',
'.fp-chips span { border-style: dashed; color: @mute@; }',
'',
'/* Buttons: a block with one corner cut. */',
'.fp-actions { display: flex; flex-wrap: wrap; gap: 8px; }',
'.fp-btn { display: flex; align-items: center; gap: 12px; padding: 13px 22px; border: 1px solid @ink@; background: transparent; color: @ink@; font-family: @HEAD@; font-size: 16px; font-stretch: 75%; font-weight: 700; letter-spacing: .12em; line-height: 1; text-decoration: none; text-transform: uppercase; transition: background .18s ease, color .18s ease, transform .18s ease; }',
'.fp-btn:hover { background: @ink@; color: @bg@; transform: translateY(-2px); }',
'.fp-btn-main { border-color: @a@; background: @a@; color: @onA@; clip-path: polygon(0 0, 100% 0, 100% 62%, 94% 100%, 0 100%); }',
'.fp-btn-main:hover { background: @a@; color: @onA@; filter: brightness(1.08); }',
'/* The arrow on the main button, which nudges forward when pointed at. */',
'.fp-btn-main i { width: 22px; height: 8px; background: linear-gradient(@onA@, @onA@) left center / 100% 2px no-repeat; clip-path: polygon(0 38%, 72% 38%, 72% 0, 100% 50%, 72% 100%, 72% 62%, 0 62%); transition: transform .18s ease; }',
'.fp-btn-main:hover i { transform: translateX(5px); }',
'',
'/* A plate where a picture is missing: hazard hatching and a note. */',
'.fp-noimg { display: flex !important; align-items: center; justify-content: center; background: repeating-linear-gradient(135deg, @ink@14 0 10px, transparent 10px 20px), @panel@; }',
'.fp-noimg b { padding: 3px 8px; background: @ink@; color: @bg@; font-family: @MONO@; font-size: 9px; font-weight: 400; letter-spacing: .14em; text-transform: uppercase; }',
'',
'/* ---- overview ---- */',
'.fp-hud { position: absolute; top: 24px; right: 30px; z-index: 4; display: flex; gap: 22px; color: @mute@; font-family: @MONO@; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; animation: fp-rise .6s ease .5s both; }',
'.fp-hud span { display: flex; align-items: baseline; gap: 7px; }',
'.fp-hud b { color: @ink@; font-family: @HEAD@; font-size: 22px; font-stretch: 75%; letter-spacing: .02em; }',
'.fp-hud-live { align-items: center !important; }',
'.fp-hud-live i { width: 7px; height: 7px; border-radius: 50%; background: @a@; box-shadow: 0 0 0 0 @a@; animation: fp-ping 1.8s ease-out infinite; }',
'.fp-slide { position: absolute; inset: 0; }',
'/* The name again, enormous and faint, behind everything. */',
'.fp-ghost { position: absolute; top: 9%; right: 0; left: 36px; overflow: hidden; color: @ink@12; font-family: @HEAD@; font-size: clamp(96px, 15vw, 230px); font-stretch: 75%; font-weight: 700; letter-spacing: -.01em; line-height: .86; text-transform: uppercase; white-space: nowrap; }',
'/* The art, cut to a slant, with a plate of the accent a step behind it. */',
'.fp-slide-art { position: absolute; right: 5%; bottom: 0; width: 42%; height: 94%; object-fit: cover; object-position: center top; clip-path: polygon(16% 0, 100% 0, 84% 100%, 0 100%); }',
'.fp-plate { position: absolute; right: calc(5% + 26px); bottom: 0; width: 42%; height: 94%; background: @a@; clip-path: polygon(16% 0, 100% 0, 84% 100%, 0 100%); }',
'.fp-slide-info { position: absolute; bottom: 92px; left: 44px; z-index: 3; width: min(46%, 520px); }',
'.fp-slide-name { margin: 12px 0 0; color: @ink@; font-family: @HEAD@; font-size: clamp(34px, 4.6vw, 68px); font-stretch: 75%; font-weight: 700; letter-spacing: .01em; line-height: .96; text-transform: uppercase; overflow-wrap: break-word; }',
'.fp-slide-line { display: -webkit-box; margin: 14px 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; padding-left: 12px; border-left: 3px solid @a@; color: @ink@; font-size: 15px; line-height: 1.5; }',
'.fp-slide-info .fp-chips { margin-top: 16px; }',
'.fp-slide-info .fp-actions { margin-top: 22px; }',
'/* The thumbnails: point at one to hold its slide, click to open the file. */',
'.fp-picks { position: absolute; bottom: 30px; left: 44px; z-index: 4; display: flex; gap: 6px; }',
'.fp-pick { position: relative; width: 44px; height: 44px; overflow: hidden; border: 1px solid @ink@66; background: @panel@; transition: transform .18s ease, border-color .18s ease; }',
'.fp-pick-img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; filter: grayscale(1); transition: filter .18s ease; }',
'.fp-pick span { position: absolute; right: 0; bottom: 0; padding: 1px 3px; background: @ink@; color: @bg@; font-family: @MONO@; font-size: 8px; }',
'.fp-pick:hover { border-color: @a@; transform: translateY(-4px); }',
'.fp-pick:hover .fp-pick-img { filter: none; }',
'/* One bar per slide, filling while its slide is up. */',
'.fp-progress { position: absolute; bottom: 14px; left: 44px; z-index: 4; display: flex; gap: 6px; }',
'.fp-progress i { position: relative; display: block; width: 44px; height: 3px; overflow: hidden; background: @ink@33; }',
'.fp-progress i::after { content: ""; position: absolute; inset: 0; background: @ink@; transform: scaleX(0); transform-origin: 0 50%; }',
'/* Reading stops the clock. */',
'.fp-screen-home:hover .fp-slide, .fp-screen-home:hover .fp-slide-art, .fp-screen-home:hover .fp-plate, .fp-screen-home:hover .fp-progress i::after { animation-play-state: paused; }',
'',
'/* ---- operators ---- */',
'.fp-roster { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 12px; }',
'.fp-card { position: relative; display: block; overflow: hidden; border: 1px solid @line@; background: @panel@; color: @ink@; text-decoration: none; animation: fp-rise .5s ease both; transition: transform .22s cubic-bezier(.2, .8, .2, 1), border-color .22s ease, box-shadow .22s ease; }',
'.fp-card:nth-child(1) { animation-delay: .3s; } .fp-card:nth-child(2) { animation-delay: .34s; } .fp-card:nth-child(3) { animation-delay: .38s; } .fp-card:nth-child(4) { animation-delay: .42s; } .fp-card:nth-child(5) { animation-delay: .46s; } .fp-card:nth-child(6) { animation-delay: .5s; } .fp-card:nth-child(n + 7) { animation-delay: .54s; }',
'.fp-card-art { position: relative; display: block; aspect-ratio: 3 / 3.7; overflow: hidden; background: @line@; }',
'.fp-card-img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; transition: transform .5s cubic-bezier(.2, .8, .2, 1); }',
'/* A line of light that runs down the tile when it is pointed at. */',
'.fp-card-art::after { content: ""; position: absolute; right: 0; left: 0; top: -30%; height: 30%; background: linear-gradient(180deg, transparent, @a@99); opacity: 0; }',
'.fp-card-no { position: absolute; top: 0; left: 0; padding: 3px 7px; background: @ink@; color: @bg@; font-family: @MONO@; font-size: 10px; }',
'.fp-card-name { display: block; margin: 9px 10px 0; overflow: hidden; font-family: @HEAD@; font-size: 16px; font-stretch: 75%; font-weight: 700; letter-spacing: .03em; line-height: 1.15; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }',
'.fp-card-meta { display: block; margin: 3px 10px 10px; color: @mute@; font-family: @MONO@; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }',
'.fp-card::after { content: ""; position: absolute; right: 0; bottom: 0; width: 0; height: 4px; background: @a@; transition: width .25s cubic-bezier(.2, .8, .2, 1); }',
'.fp-card:hover { z-index: 2; border-color: @ink@; box-shadow: 8px 8px 0 @a@; color: @ink@; transform: translate(-4px, -4px); }',
'.fp-card:hover::after { width: 100%; }',
'.fp-card:hover .fp-card-img { transform: scale(1.07); }',
'.fp-card:hover .fp-card-art::after { opacity: 1; animation: fp-scan .9s linear infinite; }',
'',
'/* ---- a character\'s file ---- */',
'.fp-file { background: @bg@; }',
'.fp-file > i { position: absolute; display: block; }',
'/* The scene behind the file: your own if the character has one, otherwise',
' * its art out of focus. */',
'.fp-file-scene { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; animation: fp-zoom 14s ease-out both; }',
'.fp-file-scene-soft { filter: blur(26px) saturate(1.2); transform: scale(1.2); animation: none; }',
'.fp-file-shade { inset: 0; background: linear-gradient(90deg, @bg@26 0%, @bg@a6 38%, @bg@d9 56%, @bg@e0 100%); }',
'.fp-file-plate { top: 0; bottom: 0; left: 0; width: calc(44% + 22px); background: @a@; clip-path: polygon(0 0, 100% 0, 80% 100%, 0 100%); animation: fp-slide-in .7s cubic-bezier(.2, .8, .2, 1) .15s both; }',
'.fp-file-art { position: absolute; top: 0; bottom: 0; left: 0; width: 44%; clip-path: polygon(0 0, 100% 0, 80% 100%, 0 100%); animation: fp-slide-in .7s cubic-bezier(.2, .8, .2, 1) .25s both; }',
'.fp-file-img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; }',
'.fp-file-no { position: absolute; right: 26px; bottom: -4%; color: @ink@0f; font-family: @HEAD@; font-size: clamp(160px, 26vw, 380px); font-stretch: 75%; font-weight: 700; line-height: .8; pointer-events: none; }',
'.fp-file-info { position: absolute; top: 0; right: 0; bottom: 0; left: 46%; z-index: 2; padding: 30px 44px 30px 20px; overflow-y: auto; }',
'.fp-file-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; color: @mute@; font-family: @MONO@; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; animation: fp-rise .5s ease .35s both; }',
'.fp-file-top b { color: @ink@; }',
'.fp-back { display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 10px; border: 1px solid @ink@; color: @ink@; text-decoration: none; transition: background .15s ease, color .15s ease; }',
'.fp-back::before { content: ""; width: 5px; height: 5px; border-bottom: 2px solid currentColor; border-left: 2px solid currentColor; transform: rotate(45deg); }',
'.fp-back:hover { background: @ink@; color: @bg@; }',
'.fp-file-name { margin: 26px 0 0; color: @ink@; font-family: @HEAD@; font-size: clamp(38px, 5vw, 76px); font-stretch: 75%; font-weight: 700; letter-spacing: .01em; line-height: .94; text-transform: uppercase; overflow-wrap: break-word; animation: fp-rise .6s ease .42s both; }',
'.fp-file-line { margin: 12px 0 0; color: @mute@; font-family: @MONO@; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; animation: fp-rise .6s ease .48s both; }',
'.fp-quote { position: relative; margin: 20px 0 0; padding: 14px 16px 14px 20px; border-left: 4px solid @a@; background: @ink@0d; color: @ink@; font-size: 16px; font-style: italic; line-height: 1.5; animation: fp-rise .6s ease .54s both; }',
'.fp-file-desc { margin: 18px 0 0; color: @ink@; font-size: 15px; line-height: 1.65; animation: fp-rise .6s ease .6s both; }',
'.fp-file-info .fp-chips { margin-top: 18px; animation: fp-rise .6s ease .66s both; }',
'.fp-stats { display: flex; flex-wrap: wrap; gap: 0; margin-top: 22px; border-top: 1px solid @ink@; border-bottom: 1px solid @ink@; animation: fp-rise .6s ease .72s both; }',
'.fp-stats span { flex: 1 1 0; padding: 10px 14px 10px 0; color: @mute@; font-family: @MONO@; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }',
'.fp-stats span + span { padding-left: 14px; border-left: 1px solid @ink@33; }',
'.fp-stats b { display: block; margin-bottom: 2px; color: @ink@; font-family: @HEAD@; font-size: 28px; font-stretch: 75%; letter-spacing: .02em; line-height: 1; }',
'.fp-file-info .fp-actions { margin-top: 22px; animation: fp-rise .6s ease .78s both; }',
'.fp-btn-step { padding: 13px 16px; font-size: 13px; }',
'',
'/* ---- dossier ---- */',
'.fp-dossier { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 34px; align-items: start; }',
'/* The ID card: a photo, a table of facts, a barcode. */',
'.fp-idcard { position: relative; padding: 16px; border: 1px solid @ink@; background: @panel@; box-shadow: 8px 8px 0 @a@; animation: fp-rise .6s ease .36s both; }',
'.fp-idcard::before { content: "ID"; position: absolute; top: 0; right: 0; padding: 4px 9px; background: @ink@; color: @bg@; font-family: @MONO@; font-size: 10px; letter-spacing: .14em; }',
'.fp-idcard-photo { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; overflow: hidden; background: repeating-linear-gradient(135deg, @ink@14 0 10px, transparent 10px 20px), @line@; }',
'.fp-idcard-photo img { width: 100%; height: 100%; object-fit: cover; }',
'.fp-idcard-photo b { color: @ink@; font-family: @HEAD@; font-size: 110px; font-stretch: 75%; line-height: 1; }',
'.fp-idcard-rows { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 7px 12px; margin: 14px 0; }',
'.fp-idcard-rows span { color: @mute@; font-family: @MONO@; font-size: 9px; letter-spacing: .12em; line-height: 18px; text-transform: uppercase; }',
'.fp-idcard-rows b { overflow: hidden; color: @ink@; font-family: @HEAD@; font-size: 16px; font-stretch: 75%; letter-spacing: .04em; line-height: 18px; text-align: right; text-overflow: ellipsis; white-space: nowrap; }',
'.fp-idcard .fp-barcode { color: @ink@; }',
'.fp-about { animation: fp-rise .6s ease .44s both; }',
'.fp-about h3 { margin: 0; color: @ink@; font-family: @HEAD@; font-size: clamp(24px, 2.6vw, 36px); font-stretch: 75%; font-weight: 700; letter-spacing: .03em; line-height: 1.05; text-transform: uppercase; }',
'.fp-about p { max-width: 640px; margin: 16px 0 0; color: @ink@; font-size: 16px; line-height: 1.7; }',
'',
'/* ---- network ---- */',
'.fp-links { display: grid; gap: 0; border-top: 1px solid @ink@; animation: fp-rise .6s ease .36s both; }',
'.fp-link { position: relative; display: grid; grid-template-columns: 44px minmax(0, 1fr) auto 30px; gap: 0 14px; align-items: center; padding: 16px 14px; overflow: hidden; border-bottom: 1px solid @ink@; color: @ink@; text-decoration: none; transition: color .2s ease, padding .2s ease; }',
'/* The row fills with the accent from the left when it is pointed at. */',
'.fp-link::before { content: ""; position: absolute; inset: 0; background: @a@; transform: scaleX(0); transform-origin: 0 50%; transition: transform .28s cubic-bezier(.2, .8, .2, 1); }',
'.fp-link > * { position: relative; }',
'.fp-link i { color: @mute@; font-family: @MONO@; font-size: 11px; font-style: normal; }',
'.fp-link b { overflow: hidden; font-family: @HEAD@; font-size: 26px; font-stretch: 75%; font-weight: 700; letter-spacing: .04em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }',
'.fp-link span { color: @mute@; font-family: @MONO@; font-size: 10px; letter-spacing: .08em; }',
'.fp-link em { width: 22px; height: 10px; background: currentColor; clip-path: polygon(0 40%, 72% 40%, 72% 0, 100% 50%, 72% 100%, 72% 60%, 0 60%); transition: transform .2s ease; }',
'.fp-link:hover { padding-left: 24px; color: @onA@; }',
'.fp-link:hover::before { transform: scaleX(1); }',
'.fp-link:hover i, .fp-link:hover span { color: @onA@; }',
'.fp-link:hover em { transform: translateX(6px); }',
'.fp-sub { margin: 34px 0 14px; color: @mute@; font-family: @MONO@; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; }',
'.fp-allies { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; animation: fp-rise .6s ease .44s both; }',
'.fp-ally { display: flex; align-items: center; gap: 12px; padding: 10px; border: 1px solid @line@; background: @panel@; color: @ink@; text-decoration: none; transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }',
'.fp-ally:hover { border-color: @ink@; box-shadow: 6px 6px 0 @a@; color: @ink@; transform: translate(-3px, -3px); }',
'.fp-ally-face { flex: 0 0 52px; display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; overflow: hidden; background: @ink@; clip-path: polygon(0 0, 100% 0, 100% 76%, 76% 100%, 0 100%); }',
'.fp-ally-face img { width: 100%; height: 100%; object-fit: cover; }',
'.fp-ally-face b { color: @a@; font-family: @HEAD@; font-size: 26px; }',
'.fp-ally-text { min-width: 0; }',
'.fp-ally-text b { display: block; overflow: hidden; font-family: @HEAD@; font-size: 18px; font-stretch: 75%; letter-spacing: .04em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }',
'.fp-ally-text span { display: block; overflow: hidden; color: @mute@; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }',
'',
'/* ---- log ---- */',
'.fp-log { display: grid; gap: 10px; max-width: 860px; animation: fp-rise .6s ease .36s both; }',
'/* Each entry opens on a click, with no script: it is a <details>. */',
'.fp-entry { border: 1px solid @line@; background: @panel@; transition: border-color .2s ease; }',
'.fp-entry[open], .fp-entry:hover { border-color: @ink@; }',
'.fp-entry summary { display: flex; align-items: center; gap: 14px; padding: 15px 18px; color: @ink@; font-family: @HEAD@; font-size: 20px; font-stretch: 75%; font-weight: 700; letter-spacing: .04em; list-style: none; text-transform: uppercase; cursor: pointer; }',
'.fp-entry summary::-webkit-details-marker { display: none; }',
'.fp-entry summary i { padding: 2px 7px; background: @ink@; color: @bg@; font-family: @MONO@; font-size: 10px; font-style: normal; font-weight: 400; letter-spacing: .06em; }',
'.fp-entry summary::after { content: ""; width: 8px; height: 8px; margin-left: auto; border-right: 2px solid @ink@; border-bottom: 2px solid @ink@; transform: rotate(45deg); transition: transform .2s ease; }',
'.fp-entry[open] summary::after { transform: rotate(-135deg); }',
'.fp-entry[open] summary { border-bottom: 1px solid @line@; background: linear-gradient(90deg, @a@ 0 6px, transparent 6px); }',
'.fp-entry p { margin: 0; padding: 16px 18px 18px; color: @ink@; font-size: 15px; line-height: 1.7; }',
'',
'/* ---- the ticker along the foot of the main area ---- */',
'.fp-ticker { position: absolute; right: 0; bottom: 0; left: 0; z-index: 5; height: 28px; overflow: hidden; background: @rail@; }',
'.fp-ticker-run { display: flex; width: max-content; animation: fp-ticker 36s linear infinite; }',
'.fp-ticker-run span { padding: 0 26px; color: @a@; font-family: @MONO@; font-size: 10px; letter-spacing: .2em; line-height: 28px; text-transform: uppercase; white-space: nowrap; }',
'.fp-ticker-run span::after { content: "///"; margin-left: 52px; color: @railMute@; }',
'',
'/* ---- JanitorAI\'s header, as the application\'s title bar ---- */',
'.pp-top-bar { border-bottom: 2px solid @a@; background: @rail@ !important; box-shadow: none !important; }',
'.pp-top-bar-tabs a { color: @railInk@; font-family: @MONO@; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }',
'.pp-top-bar-tabs a:hover { color: @a@; }',
'.pp-top-bar-search-input { border: 1px solid @railLine@ !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; color: @railInk@ !important; }',
'.pp-top-bar-search-input:hover { border-color: @a@ !important; }',
'#search-input, #search-input::placeholder { color: @railMute@ !important; font-family: @MONO@; }',
'.pp-top-bar-search-shortcut { border: 0 !important; border-radius: 0 !important; background: @railLine@ !important; color: @railMute@ !important; }',
'.pp-top-bar-create-char { border: 0 !important; border-radius: 0 !important; background: @a@ !important; box-shadow: none !important; color: @onA@ !important; font-family: @MONO@; font-weight: 700; text-transform: uppercase; }',
'.pp-top-bar-create-char:hover { color: @onA@ !important; filter: brightness(1.08); }',
'.pp-top-bar-create-char::before, .pp-top-bar-create-char::after { display: none !important; }',
'.pp-top-bar-app-menu-list, .pp-top-bar-notifications-popover { overflow: hidden; border: 1px solid @railLine@ !important; border-radius: 0 !important; background: @rail@ !important; box-shadow: 8px 8px 0 @a@ !important; color: @railInk@ !important; }',
'.pp-top-bar-app-menu-list-item { background: transparent !important; color: @railInk@ !important; }',
'.pp-top-bar-app-menu-list-item:hover { background: @railInk@1a !important; }',
'.pp-mnb-wrapper { border-top: 2px solid @a@; border-radius: 0; background: @rail@ !important; box-shadow: none !important; }',
'.pp-mnb-container svg { color: @railInk@ !important; }',
'',
'@keyframes fp-spin { to { transform: rotate(360deg); } }',
'@keyframes fp-blink { 0% { opacity: 1; } 100% { opacity: .2; } }',
'@keyframes fp-ping { 0% { box-shadow: 0 0 0 0 @a@cc; } 80%, 100% { box-shadow: 0 0 0 9px @a@00; } }',
'@keyframes fp-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }',
'@keyframes fp-wipe { 0% { transform: scaleX(0); transform-origin: 0 50%; } 45% { transform: scaleX(1); transform-origin: 0 50%; } 55% { transform: scaleX(1); transform-origin: 100% 50%; } 100% { transform: scaleX(0); transform-origin: 100% 50%; } }',
'@keyframes fp-slide-in { from { opacity: 0; transform: translateX(-12%); } to { opacity: 1; transform: translateX(0); } }',
'@keyframes fp-zoom { from { transform: scale(1.12); } to { transform: scale(1); } }',
'@keyframes fp-scan { from { top: -30%; } to { top: 100%; } }',
'@keyframes fp-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }',
'@keyframes fp-boot-bar { 0% { transform: scaleX(0); } 60% { transform: scaleX(.7); } 100% { transform: scaleX(1); } }',
'@keyframes fp-boot-out { 0%, 74% { clip-path: inset(0 0 0 0); visibility: visible; } 100% { clip-path: inset(0 0 100% 0); visibility: hidden; } }',
'',
'/* ---- phones: the rail lies across the top, a screen is as tall as it needs ---- */',
'@media screen and (max-width: 900px) {',
'  .profile-info-stack { grid-template-columns: 62px minmax(0, 1fr); grid-template-rows: auto auto auto auto auto auto auto auto; height: auto; }',
'  .profile-info-stack::before { width: 100%; border-right: 0; }',
'  .fp-brand { grid-column: 1 / -1; padding: 14px 14px 12px; }',
'  .fp-nav { grid-column: 1 / -1; flex-direction: row; padding: 0; overflow-x: auto; border-bottom: 1px solid @railLine@; }',
'  .fp-nav-item { flex: 0 0 auto; display: block; padding: 10px 14px; }',
'  .fp-nav-item i, .fp-nav-item span { display: none; }',
'  .fp-nav-item b { font-size: 16px; }',
'  .fp-nav-item:hover { padding-left: 14px; }',
'  .fp-nav-item::before { top: auto; right: 0; bottom: 0; left: 0; width: auto; height: 3px; transform: scaleX(0); }',
'  .fp-nav-item::after { display: none; }',
'  .fp-nav-home::before,',
'  .profile-info-stack:has(#fp-roster:target, .fp-key-op:target) .fp-nav-roster::before,',
'  .profile-info-stack:has(#fp-dossier:target) .fp-nav-dossier::before,',
'  .profile-info-stack:has(#fp-network:target) .fp-nav-network::before,',
'  .profile-info-stack:has(#fp-log:target) .fp-nav-log::before { transform: scaleX(1); }',
'  .profile-info-stack:has(.fp-key:not(#fp-home):target) .fp-nav-home::before { transform: scaleX(0); }',
'  .pp-uc-avatar-container { margin: 12px 0 0 14px; width: 40px; height: 40px; }',
'  .profile-info-stack-inner-flex { margin: 12px 14px 0 0; }',
'  .pp-uc-followers-count, .profile-badges { grid-column: 1 / -1; margin-right: 14px !important; margin-left: 14px !important; }',
'  .profile-info-stack > div:last-child:not(.pp-uc-about-me), .profile-info-stack-inner > button { grid-column: 1 / -1; margin: 10px 14px 14px !important; }',
'  .fp-railfoot { display: none; }',
'  .fp-main { grid-column: 1 / -1; grid-row: 8; height: auto; }',
'  .fp-screen { position: relative; inset: auto; padding-bottom: 28px; }',
'  .fp-screen-roster, .fp-screen-dossier, .fp-screen-network, .fp-screen-log { padding: 24px 16px 52px; overflow: visible; }',
'  .fp-screen-home { height: 800px; }',
'  .fp-hud { top: 14px; right: 14px; gap: 14px; }',
'  .fp-hud-live { display: none !important; }',
'  .fp-ghost { top: 44px; left: 12px; font-size: 92px; }',
'  .fp-slide-art, .fp-plate { top: 60px; right: 4%; bottom: auto; width: 62%; height: 300px; }',
'  .fp-plate { right: calc(4% + 16px); }',
'  /* The words start under the art and run down, so a long name never climbs over it. */',
'  .fp-slide-info { top: 384px; right: 16px; bottom: auto; left: 16px; width: auto; }',
'  .fp-slide-name { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; font-size: 34px; }',
'  .fp-slide-info .fp-chips { max-height: 54px; overflow: hidden; }',
'  .fp-slide-line { -webkit-line-clamp: 2; font-size: 14px; }',
'  .fp-picks { bottom: 44px; left: 16px; }',
'  .fp-progress { bottom: 34px; left: 16px; }',
'  .fp-roster { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }',
'  .fp-file-plate { right: 0; bottom: auto; width: auto; height: 348px; clip-path: polygon(0 0, 100% 0, 100% 86%, 0 100%); }',
'  .fp-file-art { position: relative; width: auto; height: 330px; clip-path: polygon(0 0, 100% 0, 100% 86%, 0 100%); }',
'  .fp-file-info { position: relative; left: auto; padding: 18px 16px 30px; overflow: visible; }',
'  .fp-file-shade { background: linear-gradient(180deg, @bg@66 0%, @bg@f2 46%, @bg@ 100%); }',
'  .fp-file-no { display: none; }',
'  .fp-dossier { grid-template-columns: minmax(0, 1fr); gap: 26px; }',
'  .fp-idcard { max-width: 300px; }',
'  .fp-link { grid-template-columns: 30px minmax(0, 1fr) 26px; }',
'  .fp-link span { display: none; }',
'  .fp-link b { font-size: 21px; }',
'}',
'',
'/* Nothing hovers on a touch screen: no tile is left lifted under a finger. */',
'@media (hover: none) {',
'  .fp-card:hover, .fp-ally:hover { box-shadow: none; transform: none; }',
'}',
'',
'@media (prefers-reduced-motion: reduce) {',
'  .fp-boot, .fp-wipe { display: none !important; }',
'  .fp-emblem-mark i, .pp-uc-followers-count::before, .fp-hud, .fp-hud-live i, .fp-head, .fp-card, .fp-card:hover .fp-card-art::after, .fp-file-scene, .fp-file-plate, .fp-file-art, .fp-file-top, .fp-file-name, .fp-file-line, .fp-quote, .fp-file-desc, .fp-file-info .fp-chips, .fp-stats, .fp-file-info .fp-actions, .fp-idcard, .fp-about, .fp-links, .fp-allies, .fp-log, .fp-ticker-run { animation: none; }',
'}'
  ];

  /* JanitorAI's own character list: out of the way by default (the roster
   * above is the list), or kept underneath, plainly, for a roster that is
   * always current. */
  var NATIVE_OFF = [
'',
'/* JanitorAI\'s own character list is hidden: the Operators screen is the list.',
' * Turn "Show JanitorAI\'s live list underneath" on in Profile data to keep it. */',
'.profile-page-container-flex-box { display: none !important; }'
  ];

  var NATIVE_ON = [
'',
'/* ---- JanitorAI\'s own character list, underneath: always current ---- */',
'.profile-page-container-flex-box { box-sizing: border-box; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 34px 44px 60px !important; border-top: 2px solid @a@; background: @bg@; }',
'.pp-tabs-wrapper { border: 0 !important; border-bottom: 2px solid @ink@ !important; margin-bottom: 18px !important; }',
'.pp-tabs-indicator { display: none !important; }',
'.pp-tabs-button { color: @mute@ !important; font-family: @HEAD@ !important; font-size: 24px !important; font-stretch: 75%; font-weight: 700 !important; letter-spacing: .04em; text-transform: uppercase; }',
'.pp-tabs-button[aria-selected="true"] { background: @ink@ !important; color: @bg@ !important; }',
'.pp-tabs-panels, .profile-tab-panel { padding: 0 !important; }',
'.characters-list-container-flex { gap: 18px !important; }',
'.pp-pg-total { border: 1px solid @ink@ !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; }',
'.pp-pg-total::before, .pp-pg-total::after { display: none !important; }',
'.pp-pg-total .profile-badge-flex-inner { background: transparent !important; }',
'.pp-pg-total-count, .pp-pg-total-text { color: @ink@ !important; font-family: @MONO@ !important; font-size: 12px; text-transform: uppercase; }',
'.profile-character-search-input, .profile-filter-button, .react-select__control { border: 1px solid @ink@ !important; border-radius: 0 !important; background: @panel@ !important; box-shadow: none !important; color: @ink@ !important; font-family: @MONO@ !important; font-size: 12px !important; }',
'.react-select__single-value { color: @ink@ !important; font-family: @MONO@ !important; }',
'.pp-cc-list-container { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)) !important; gap: 12px !important; }',
'.pp-cc-wrapper { width: 100% !important; max-width: none !important; margin: 0 !important; border: 1px solid @line@ !important; border-radius: 0 !important; background: @panel@ !important; box-shadow: none !important; transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }',
'.pp-cc-wrapper:hover { border-color: @ink@ !important; box-shadow: 8px 8px 0 @a@ !important; transform: translate(-4px, -4px); }',
'.pp-cc-wrapper > div:not(.profile-character-card-stack), .pp-cc-star-line { display: none !important; }',
'.profile-character-card-stack { border-radius: 0 !important; background: transparent !important; }',
'.pp-cc-avatar, .profile-character-card-avatar-aspect-ratio { border-radius: 0 !important; }',
'.pp-cc-name { color: @ink@ !important; font-family: @HEAD@ !important; font-size: 17px !important; font-stretch: 75%; font-weight: 700 !important; letter-spacing: .03em; text-transform: uppercase; }',
'.pp-cc-creator-name, .pp-cc-tokens-count { color: @mute@ !important; font-family: @MONO@ !important; font-size: 10px !important; }',
'.pp-cc-description, .pp-cc-description * { color: @ink@ !important; }',
'.pp-cc-description img { display: none !important; }',
'.pp-cc-tags-item { border: 1px solid @ink@66 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; color: @ink@ !important; font-family: @MONO@ !important; font-size: 10px !important; }',
'.pp-pg-page-button, .pp-pg-prev-button, .pp-pg-next-button { border: 1px solid @ink@ !important; border-radius: 0 !important; background: transparent !important; color: @ink@ !important; font-family: @MONO@; }',
'.pp-pg-page-button-active { background: @a@ !important; color: @onA@ !important; }',
'@media screen and (max-width: 900px) { .profile-page-container-flex-box { padding: 24px 12px 40px !important; } .pp-cc-list-container { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }'
  ];

  /* Black or white, whichever reads on the accent. */
  function onAccent(hex) {
    var n = parseInt(hex.slice(1), 16);
    var lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.55 ? '#111216' : '#ffffff';
  }

  function style(o) {
    var t = theme(o);
    var a = accent(o);
    var tokens = {
      bg: t.bg, panel: t.panel, ink: t.ink, mute: t.mute, line: t.line,
      rail: t.rail, railInk: t.railInk, railMute: t.railMute, railLine: t.railLine,
      a: a, onA: onAccent(a), HEAD: HEAD, MONO: MONO, BODY: BODY
    };
    var lines = SHEET.concat(o.fpNative === true || o.fpNative === 'true' ? NATIVE_ON : NATIVE_OFF);
    return lines.join('\n').replace(/@([A-Za-z]+)@/g, function (all, key) {
      return tokens[key] != null ? tokens[key] : all;
    }).trim() + '\n';
  }

  global.JaiFrontier = {
    themes: THEMES,
    theme: theme,
    roster: roster,
    slides: slides,
    markup: markup,
    css: css,
    style: style
  };
})(window);
