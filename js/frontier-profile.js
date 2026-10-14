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
 *   the backdrop (fpBackground), an emblem (fpEmblem) and the creator's own
 *   chibi (fpMascot); per character the stage art (art), the roster tile
 *   (portrait), a scene for the file screen (hover) and a chibi (chibi).
 *
 * Every character has a rank from 3 to 6 stars (`ranks`): by default from
 * where it stands among the others by chats, or whatever the creator sets.
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
  var MAX_TAG_POOLS = 6;
  var MAX_MEMBERS = 6;
  // How long each character holds the Recruit button before the next takes it.
  var CYCLE_SECONDS = 0.15;

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

  /*
   * The Overview's slides in a shuffled order, so the profile does not open on
   * the same character for ever. A profile runs no script, so the order cannot
   * change per visit: it is drawn when the design is written. It is drawn
   * from the Profile data itself (names, counts, and fpShuffle, which the
   * panel's "Shuffle the Overview" button turns over), so the same data always
   * gives the same order: reopening the studio does not rewrite the document,
   * and any change to the data, a fresh import's new chat counts included,
   * deals a new one. With nothing featured, the five are drawn from everyone.
   */
  function slides(files, o) {
    var list = roster(files);
    var featured = list.filter(function (f) { return f.featured; });
    var pool = (featured.length ? featured : list).slice();
    var seed = [String((o && o.fpShuffle) || 0)].concat(list.map(function (f) {
      return f.name + '|' + f.chats + '|' + f.tokens;
    })).join('\n');
    var random = prng(seed);
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var held = pool[i]; pool[i] = pool[j]; pool[j] = held;
    }
    return pool.slice(0, MAX_SLIDES);
  }

  /* A small seeded random number source (a string hash into mulberry32):
   * the same text gives the same sequence on every machine. */
  function prng(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h = (h + 0x6D2B79F5) | 0;
      var t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* The colour each rank wears, whatever the theme and the accent: a rank
   * has to read the same on every profile. */
  var RANK_COLOURS = { 6: '#ff8a1e', 5: '#ffd21f', 4: '#b98cff', 3: '#5cc8ff' };

  /*
   * A rank from 3 to 6 for each character of the roster, in order. Set by
   * hand in Profile data, it is what the creator says. Left on Auto it comes
   * from where the character stands among the others by chats: the top tenth
   * are 6, down to the top third 5, down to three quarters 4, the rest 3.
   * Standing, not the count itself, because 5,000 chats is a hit on one
   * profile and a slow week on another.
   */
  function ranks(list) {
    var counts = list.map(function (f) { return number(f.chats); });
    var sorted = counts.slice().sort(function (a, b) { return b - a; });
    var any = sorted.length && sorted[0] > 0;
    return list.map(function (f, i) {
      var chosen = parseInt(f.rarity, 10);
      if (chosen >= 3 && chosen <= 6) return chosen;
      if (!any) return 4;
      var standing = sorted.indexOf(counts[i]) / list.length;
      return standing < 0.1 ? 6 : standing < 0.34 ? 5 : standing < 0.75 ? 4 : 3;
    });
  }

  function stars(rank) { return new Array(rank + 1).join('★'); }

  /* A character's chibi as a field tag: a white card with a punched corner.
   * White on purpose, so a chibi drawn on a white background belongs to it. */
  function tag(f, n, cls) {
    return usable(f.chibi) ? '<span class="fp-tag ' + cls + '"><img src="' + attr(f.chibi) + '" alt=""><b>Field ID ' + pad(n) + '</b><i class="fp-barcode"></i></span>' : '';
  }

  /* A tag as it can be written into an id and a class name. */
  function slugOf(tag) {
    return String(global.JaiTags.slug(tag) || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /*
   * The pools a visitor can recruit from: everyone, the featured ones, and a
   * handful of tags. A pool is the positions (1-based) of its characters in
   * the roster. The tags are the creator's list (fpPools) or, left empty, the
   * ones most characters share, since a pool of one is not a draw.
   */
  function pools(files, o) {
    var list = roster(files);
    if (list.length < 2) return [];
    var everyone = list.map(function (f, i) { return i + 1; });
    var out = [{ key: 'all', label: 'All operators', members: everyone }];

    var featured = everyone.filter(function (n) { return list[n - 1].featured; });
    if (featured.length > 1 && featured.length < list.length) {
      out.push({ key: 'featured', label: 'Featured', members: featured });
    }

    var rank = ranks(list);
    var elite = everyone.filter(function (n) { return rank[n - 1] >= 5; });
    if (elite.length > 1 && elite.length < list.length) {
      out.push({ key: 'elite', label: 'Elite · 5★ and up', members: elite });
    }

    var byTag = {}, labels = {}, order = [];
    list.forEach(function (f, i) {
      var seen = {};
      f.tags.forEach(function (tag) {
        if (!global.JaiTags.isLinkable(tag)) return;
        var key = slugOf(tag);
        if (!key || seen[key]) return;
        seen[key] = true;
        if (!byTag[key]) { byTag[key] = []; labels[key] = global.JaiTags.label(tag); order.push(key); }
        byTag[key].push(i + 1);
      });
    });
    var chosen = String(o.fpPools || '').split(',').map(slugOf).filter(function (key) { return byTag[key]; });
    var tags = chosen.length ? chosen : order.filter(function (key) {
      return byTag[key].length > 1 && byTag[key].length < list.length;
    }).sort(function (a, b) { return byTag[b].length - byTag[a].length; }).slice(0, MAX_TAG_POOLS);
    tags.forEach(function (key) {
      // The prefix keeps a tag called "all" or "featured" from colliding.
      out.push({ key: 't-' + key, label: labels[key], members: byTag[key] });
    });
    return out;
  }

  /* The characters of a bot that is more than one: a party, a pair, a trio.
   * They stand side by side on the bot's file. One member is not a squad. */
  function squad(f) {
    var list = (f.members || []).filter(function (m) { return m && String(m.name || '').trim(); });
    return list.length > 1 ? list.slice(0, MAX_MEMBERS) : [];
  }

  /*
   * What the roster can be narrowed by: JanitorAI's own tags (the numbered
   * ones every creator shares), most used first. A creator's custom tags are
   * left out, since there is no end to them, and so is a tag every character
   * has, which would narrow nothing. `members` are positions in the roster.
   */
  function filters(files) {
    var list = roster(files);
    if (list.length < 2) return [];
    var found = {}, out = [];
    list.forEach(function (f, i) {
      var seen = {};
      f.tags.forEach(function (tag) {
        if (global.JaiTags.idOf(tag) == null) return;
        var label = global.JaiTags.label(tag);
        if (seen[label]) return;
        seen[label] = true;
        if (!found[label]) { found[label] = { label: label, members: [] }; out.push(found[label]); }
        found[label].members.push(i + 1);
      });
    });
    out = out.filter(function (t) { return t.members.length < list.length; });
    out.sort(function (a, b) { return b.members.length - a.members.length || (a.label < b.label ? -1 : 1); });
    out.forEach(function (t, i) { t.n = i + 1; });
    return out;
  }

  /*
   * The stickers on a briefing: the bot's chibi, or for a squad one sticker a
   * member — their chibi, or failing that the top of their picture, which is
   * where the face is. The bot's own chibi stands for the first member, who
   * is usually who it was drawn of. Each is [address, is it a chibi].
   */
  function stickers(f) {
    var party = squad(f);
    if (!party.length) return usable(f.chibi) ? [[f.chibi, true]] : [];
    return party.map(function (m, k) {
      if (usable(m.chibi)) return [m.chibi, true];
      if (!k && usable(f.chibi)) return [f.chibi, true];
      return usable(m.art) ? [m.art, false] : null;
    }).filter(Boolean);
  }

  /* What a tile says about its bot when it is pointed at. */
  function summaryOf(f) { return f.summary || f.tagline || f.description || ''; }

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
    var show = slides(files, o);
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
    // fp-k-N on a key says "this one opens file N", whichever way it was reached.
    list.forEach(function (f, i) { html.push('<span class="fp-key fp-key-op fp-k-' + (i + 1) + '" id="fp-op-' + (i + 1) + '"></span>'); });
    // A key per tag the roster can be narrowed by.
    var sieve = filters(files);
    sieve.forEach(function (t) { html.push('<span class="fp-key fp-key-tag" id="fp-tag-' + t.n + '"></span>'); });
    // Recruitment: a key per pool (which pool is chosen), and a key per pool
    // and character (the draw: that character, reached from that pool).
    var draws = pools(files, o);
    var rank = ranks(list);
    draws.forEach(function (p) {
      html.push('<span class="fp-key fp-key-pool" id="fp-pool-' + p.key + '"></span>');
      p.members.forEach(function (n) {
        // fp-kr-N: the rank about to be drawn, which the sequence dresses for.
        html.push('<span class="fp-key fp-key-pull fp-kp-' + p.key + ' fp-k-' + n + ' fp-kr-' + rank[n - 1] + '" id="fp-pull-' + p.key + '-' + n + '"></span>');
      });
    });

    html.push('<div class="fp-boot" aria-hidden="true"><div class="fp-boot-box"><b>' + esc(brand) + '</b>' +
      '<span>Establishing link</span><i></i><em>Operator files ' + pad(list.length) + ' · signal nominal</em></div></div>');

    // ---- the rail
    html.push('<div class="fp-brand">' +
      (usable(o.fpEmblem) ? '<img class="fp-emblem" src="' + attr(o.fpEmblem) + '" alt="">' : '<span class="fp-emblem fp-emblem-mark"><i></i></span>') +
      '<div class="fp-brand-text"><b>' + esc(brand) + '</b><span>Terminal · online</span></div></div>');

    // Numbered as they come: a screen with nothing in it is left out.
    var at = 0;
    var no = { home: ++at, roster: ++at };
    if (draws.length) no.recruit = ++at;
    no.dossier = ++at;
    if (links.length || allies.length) no.network = ++at;
    if (entries.length) no.log = ++at;
    html.push('<nav class="fp-nav" aria-label="Screens">' +
      navItem('home', no.home, 'Overview', 'Featured operators') +
      navItem('roster', no.roster, 'Operators', pad(list.length) + ' files on record') +
      (no.recruit ? navItem('recruit', no.recruit, 'Recruit', pad(draws.length) + (draws.length === 1 ? ' pool open' : ' pools open'), 'fp-pool-all') : '') +
      navItem('dossier', no.dossier, 'Dossier', 'About the creator') +
      (no.network ? navItem('network', no.network, 'Network', 'Links &amp; allies') : '') +
      (no.log ? navItem('log', no.log, 'Log', pad(entries.length) + (entries.length === 1 ? ' entry' : ' entries')) : '') +
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
        '<div class="fp-stars fp-r' + rank[at - 1] + '">' + stars(rank[at - 1]) + '</div>' +
        '<h2 class="fp-slide-name">' + esc(f.name) + '</h2>' +
        (line ? '<p class="fp-slide-line">' + esc(line) + '</p>' : '') +
        (f.tags.length ? '<div class="fp-chips">' + f.tags.slice(0, 5).map(tagChip).join('') + '</div>' : '') +
        '<div class="fp-actions"><a class="fp-btn fp-btn-main" href="#fp-op-' + at + '">Open file<i></i></a>' +
        (usable(f.link) ? '<a class="fp-btn" href="' + attr(f.link) + '">Initiate chat</a>' : '') + '</div></div></div>');
    });
    if (show.length > 1) {
      html.push('<div class="fp-picks">' + show.map(function (f, i) {
        var at = list.indexOf(f) + 1;
        // Its own two buttons sit just above it, and are part of it: the
        // pointer goes straight up into them without leaving the thumbnail,
        // so no other thumbnail is crossed on the way (each would take the
        // slide over).
        return '<span class="fp-pick fp-pick-' + (i + 1) + '"><a class="fp-pick-face" href="#fp-op-' + at + '" aria-label="' + attr(f.name) + '">' +
          picture(f.portrait, 'fp-pick-img', '') + '<span>' + pad(i + 1) + '</span></a>' +
          '<span class="fp-pick-go"><a class="fp-pick-open" href="#fp-op-' + at + '">Open file</a>' +
          (usable(f.link) ? '<a class="fp-pick-chat" href="' + attr(f.link) + '">Initiate chat</a>' : '') + '</span></span>';
      }).join('') + '</div><div class="fp-progress">' + show.map(function (f, i) {
        return '<i class="fp-progress-' + (i + 1) + '"></i>';
      }).join('') + '</div>');
    }
    html.push('</section>');

    // Operators
    html.push('<section class="fp-screen fp-screen-roster"><i class="fp-wipe"></i>' +
      head(no.roster, 'Operator roster', '<b>' + pad(list.length) + '</b> files on record') +
      // The tags: each narrows the tiles to the characters that carry it.
      (sieve.length ? '<div class="fp-filters"><a class="fp-filter fp-f0" href="#fp-roster">All<span>' + pad(list.length) + '</span></a>' +
        sieve.map(function (t) {
          return '<a class="fp-filter fp-f' + t.n + '" href="#fp-tag-' + t.n + '">' + esc(t.label) + '<span>' + pad(t.members.length) + '</span></a>';
        }).join('') + '</div>' : '') +
      '<div class="fp-roster-wrap"><div class="fp-roster">' + list.map(function (f, i) {
        // fp-gN: this character carries tag N.
        var mine = sieve.filter(function (t) { return t.members.indexOf(i + 1) !== -1; })
          .map(function (t) { return ' fp-g' + t.n; }).join('');
        var party = squad(f).length;
        return '<a class="fp-card fp-r' + rank[i] + mine + '" href="#fp-op-' + (i + 1) + '"><span class="fp-card-art">' + picture(f.portrait, 'fp-card-img', '') +
          (usable(f.chibi) ? '<img class="fp-card-chibi" src="' + attr(f.chibi) + '" alt="">' : '') + '</span>' +
          '<span class="fp-card-no">' + pad(i + 1) + '</span><span class="fp-card-stars">' + stars(rank[i]) + '</span>' +
          (party ? '<span class="fp-card-squad">Squad ×' + party + '</span>' : '') +
          '<span class="fp-card-name">' + esc(f.name) + '</span>' +
          '<span class="fp-card-meta">' + (f.chats ? esc(f.chats) + ' chats' : 'New file') + '</span></a>';
      }).join('') + '</div>' +
      // The briefing beside the tiles: one per character, in the tiles' order,
      // and the one whose tile is pointed at is shown.
      '<div class="fp-intel"><div class="fp-brief fp-brief-idle"><div class="fp-label"><i></i>Briefing</div><b>Point at an operator</b>' +
      '<p>Their file summary reads out here. Click to open the file.</p></div>' + list.map(function (f, i) {
        var scene = usable(f.hover) ? f.hover : f.art;
        var about = summaryOf(f);
        var stuck = stickers(f).map(function (p) {
          return '<img class="fp-sticker' + (p[1] ? '' : ' fp-sticker-face') + '" src="' + attr(p[0]) + '" alt="">';
        }).join('');
        return '<div class="fp-brief fp-r' + rank[i] + '">' + picture(scene, 'fp-brief-img', '') +
          (stuck ? '<span class="fp-stickers">' + stuck + '</span>' : '') +
          '<div class="fp-label"><i></i>File <b>' + pad(i + 1) + '</b></div><b>' + esc(f.name) + '</b>' +
          '<span class="fp-stars">' + stars(rank[i]) + '</span>' +
          (about ? '<p>' + multiline(about) + '</p>' : '') +
          // Words only: the panel is gone the moment the pointer leaves the tile.
          (f.tags.length ? '<span class="fp-brief-tags">' + f.tags.slice(0, 9).map(function (tag) {
            return '<i>' + esc(global.JaiTags.label(tag)) + '</i>';
          }).join('') + '</span>' : '') +
          '<em>' + (f.chats ? esc(f.chats) + ' chats' : 'New file') + (f.tokens ? ' · ' + esc(f.tokens) + ' tokens' : '') + '</em></div>';
      }).join('') + '</div></div></section>');

    // Recruit: choose a pool, press the button, and a character is drawn.
    if (draws.length) {
      html.push('<section class="fp-screen fp-screen-recruit"><i class="fp-wipe"></i>' +
        head(no.recruit, 'Recruitment', 'Choose a pool, then draw') +
        '<div class="fp-recruit"><div class="fp-recruit-side"><div class="fp-sub">Signal filter</div><div class="fp-pools">' +
        draws.map(function (p) {
          return '<a class="fp-pool fp-pool-' + p.key + '" href="#fp-pool-' + p.key + '"><b>' + esc(p.label) + '</b><span>' + pad(p.members.length) + '</span></a>';
        }).join('') + '</div><div class="fp-sub">Candidates in range</div><div class="fp-cands">' +
        list.map(function (f, i) {
          var mine = draws.filter(function (p) { return p.members.indexOf(i + 1) !== -1; })
            .map(function (p) { return ' fp-in-' + p.key; }).join('');
          return '<span class="fp-cand' + mine + '">' + picture(f.portrait, 'fp-cand-img', '') + '</span>';
        }).join('') + '</div></div>' +
        // The gate: one per pool, only the chosen pool's is shown. Its button
        // holds a link per character in the pool, stacked; they take turns a
        // few times a second, so the draw depends on when the button is pressed.
        '<div class="fp-gates"><i class="fp-gate-ring"></i><i class="fp-gate-ring fp-gate-ring-b"></i><i class="fp-gate-ring fp-gate-ring-c"></i>' +
        draws.map(function (p) {
          return '<div class="fp-gate fp-gate-' + p.key + '"><div class="fp-label"><i></i>Pool locked</div>' +
            '<div class="fp-gate-name">' + esc(p.label) + '</div>' +
            '<div class="fp-gate-count"><b>' + pad(p.members.length) + '</b>candidates</div>' +
            '<span class="fp-draw fp-draw-' + p.members.length + '">' + p.members.map(function (n) {
              return '<a href="#fp-pull-' + p.key + '-' + n + '" aria-label="Recruit"></a>';
            }).join('') + '<span>Initiate recruitment</span><i></i></span></div>';
        }).join('') + '</div></div></section>');
    }

    // One file per character
    list.forEach(function (f, i) {
      var prev = i === 0 ? list.length : i;
      var next = i === list.length - 1 ? 1 : i + 2;
      // A scene of its own if the creator gave one; otherwise the art, blurred.
      var own = usable(f.hover) && f.hover !== f.art;
      // A bot of several characters shows all of them, side by side on the
      // slant, where a single character's art would stand. The file is laid
      // out wider for it: fp-sq-N says how many there are to fit.
      var party = squad(f);
      html.push('<section class="fp-screen fp-file fp-file-' + (i + 1) + ' fp-r' + rank[i] + (party.length ? ' fp-file-squad fp-sq-' + party.length : '') + '"><i class="fp-wipe"></i>' +
        (usable(own ? f.hover : f.art) ? '<img class="fp-file-scene' + (own ? '' : ' fp-file-scene-soft') + '" src="' + attr(own ? f.hover : f.art) + '" alt="">' : '') +
        '<i class="fp-file-shade"></i><i class="fp-file-plate"></i>' +
        (party.length ? '<div class="fp-squad">' + party.map(function (m, k) {
          return '<div class="fp-mem">' + picture(m.art, 'fp-mem-img', m.name) +
            '<span class="fp-mem-cap"><i>' + pad(k + 1) + '</i><b>' + esc(m.name) + '</b>' +
            (m.title ? '<em>' + esc(m.title) + '</em>' : '') + (m.line ? '<span>' + esc(m.line) + '</span>' : '') + '</span></div>';
        }).join('') + '</div>' : '<div class="fp-file-art">' + picture(f.art, 'fp-file-img', f.name) + '</div>') +
        '<div class="fp-file-no">' + pad(i + 1) + '</div>' +
        '<div class="fp-file-info"><div class="fp-file-top"><a class="fp-back" href="#fp-roster">Roster</a>' +
        '<span>File <b>' + pad(i + 1) + '</b> / ' + pad(list.length) + '</span></div>' +
        '<div class="fp-stars fp-file-stars">' + stars(rank[i]).split('').map(function (s) { return '<i>' + s + '</i>'; }).join('') + '</div>' +
        '<h2 class="fp-file-name">' + esc(f.name) + '</h2>' +
        (f.tagline ? '<p class="fp-file-line">' + esc(f.tagline) + '</p>' : '') +
        (f.quote ? '<div class="fp-quote">' + esc(f.quote) + '</div>' : '') +
        (f.summary ? '<p class="fp-file-desc fp-file-sum">' + multiline(f.summary) + '</p>' : '') +
        (f.description ? '<p class="fp-file-desc">' + esc(f.description) + '</p>' : '') +
        (f.tags.length ? '<div class="fp-chips">' + f.tags.slice(0, 10).map(tagChip).join('') + '</div>' : '') +
        '<div class="fp-stats">' + (f.chats ? '<span><b>' + esc(f.chats) + '</b>Chats</span>' : '') +
        (f.tokens ? '<span><b>' + esc(f.tokens) + '</b>Tokens</span>' : '') +
        '<span class="fp-stat-rank"><b>' + rank[i] + '★</b>Rarity</span></div>' +
        '<div class="fp-actions">' +
        (usable(f.link) ? '<a class="fp-btn fp-btn-main" href="' + attr(f.link) + '">Initiate chat<i></i></a>' : '') +
        (list.length > 1 ? '<a class="fp-btn fp-btn-step" href="#fp-op-' + prev + '">Prev</a><a class="fp-btn fp-btn-step" href="#fp-op-' + next + '">Next</a>' : '') +
        '</div></div>' + tag(f, i + 1, 'fp-file-tag') + '</section>');
    });

    // Dossier
    var about = written(o, 'aboutBody');
    var heading = written(o, 'aboutTitle');
    html.push('<section class="fp-screen fp-screen-dossier"><i class="fp-wipe"></i>' + head(no.dossier, 'Creator dossier', 'Clearance: public') +
      '<div class="fp-dossier"><div class="fp-idcard"><div class="fp-idcard-photo">' +
      (usable(identity.avatar) ? '<img src="' + attr(identity.avatar) + '" alt="">' : '<b>' + initial(name) + '</b>') + '</div>' +
      '<div class="fp-idcard-rows"><span>Callsign</span><b>' + esc(name ? '@' + name : 'Unregistered') + '</b>' +
      (identity.memberSince ? '<span>Active since</span><b>' + esc(identity.memberSince) + '</b>' : '') +
      '<span>Files</span><b>' + esc(total) + '</b>' +
      (chats ? '<span>Chats on record</span><b>' + compact(chats) + '</b>' : '') +
      (identity.followers ? '<span>Followers</span><b>' + esc(identity.followers) + '</b>' : '') +
      '</div><i class="fp-barcode"></i></div>' +
      '<div class="fp-about"><h3>' + esc(heading || 'About the creator') + '</h3><p>' +
      (about ? multiline(about) : 'Write your introduction under Profile data → About me and it appears here.') + '</p>' +
      (usable(o.fpMascot) ? '<span class="fp-tag fp-mascot"><img src="' + attr(o.fpMascot) + '" alt=""><b>' + esc(name ? '@' + name : 'Creator') + '</b><i class="fp-barcode"></i></span>' : '') +
      '</div></div>' + gallery(list, o) + '</section>');

    // Network
    if (links.length || allies.length) {
      html.push('<section class="fp-screen fp-screen-network"><i class="fp-wipe"></i>' + head(no.network, 'Network', 'Outbound links &amp; allied creators'));
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
      html.push('<section class="fp-screen fp-screen-log"><i class="fp-wipe"></i>' + head(no.log, 'Log', pad(entries.length) + ' on record') +
        '<div class="fp-log">' + entries.map(function (e, i) {
          return '<details class="fp-entry"' + (i === 0 ? ' open' : '') + '><summary><i>' + pad(i + 1) + '</i>' + esc(e.title) + '</summary>' +
            (e.body ? '<p>' + multiline(e.body) + '</p>' : '') + '</details>';
        }).join('') + '</div></section>');
    }

    var ticker = written(o, 'fpTicker') || (brand + ' · ' + pad(list.length) + ' operator files · ' + (name ? '@' + name + ' · ' : '') + 'Requests open');
    var run = '<span>' + esc(ticker) + '</span>';
    html.push('<div class="fp-ticker" aria-hidden="true"><div class="fp-ticker-run">' + run + run + run + run + '</div></div>');
    html.push('</div>');

    // The draw itself. It is one sequence laid over the whole interface, the
    // same whoever is drawn: the drawn character's own file opens under it,
    // and is what the sequence clears to show.
    if (draws.length) {
      html.push('<div class="fp-fx" aria-hidden="true"><i class="fp-fx-back"></i><i class="fp-fx-floor"></i>' +
        '<i class="fp-fx-shut fp-fx-shut-a"></i><i class="fp-fx-shut fp-fx-shut-b"></i>' +
        '<i class="fp-fx-ring fp-fx-ring-a"></i><i class="fp-fx-ring fp-fx-ring-b"></i><i class="fp-fx-ring fp-fx-ring-c"></i>' +
        '<i class="fp-fx-cross"></i><i class="fp-fx-beam"></i>' +
        '<div class="fp-fx-read"><b>Signal acquired</b><span class="fp-fx-rolls">' +
        '<span class="fp-fx-roll"><i>07<br>31<br>94<br>58<br>12<br>66<br>20<br>83</i></span>' +
        '<span class="fp-fx-roll fp-fx-roll-b"><i>A4<br>9F<br>C2<br>0E<br>7B<br>D1<br>55<br>3C</i></span>' +
        '<span class="fp-fx-roll fp-fx-roll-c"><i>610<br>284<br>907<br>133<br>752<br>046<br>398<br>871</i></span></span>' +
        '<em></em><span class="fp-fx-status">Decrypting operator file</span></div>' +
        '<i class="fp-fx-burst"></i><i class="fp-fx-slab"></i><i class="fp-fx-slab fp-fx-slab-b"></i>' +
        '<div class="fp-fx-stamp"><b>Recruited</b><span class="fp-fx-stars"><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i></span></div></div>');
      html.push('<div class="fp-pullbar">' + draws.map(function (p) {
        return '<a class="fp-again fp-again-' + p.key + '" href="#fp-pool-' + p.key + '"><i></i>Draw again<span>' + esc(p.label) + '</span></a>';
      }).join('') + '</div>');
    }
    return html.join('');
  }

  /*
   * The asset archive on the dossier: every picture the profile holds, by
   * character, for whoever wants to look one up. A character is a <details>,
   * so it opens on a click with no key and no rule of its own, and a picture
   * is a link to itself: the thumbnail shows what it is, the click opens the
   * file at full size. A squad lists its members' pictures after the bot's.
   */
  function gallery(list, o) {
    if (o.fpGallery === false || o.fpGallery === 'false') return '';
    function shelf(no, name, items) {
      var seen = {};
      items = items.filter(function (it) {
        if (!usable(it[1]) || seen[it[1]]) return false;
        seen[it[1]] = true;
        return true;
      });
      if (!items.length) return '';
      return '<details class="fp-entry fp-shelf"><summary><i>' + no + '</i><b>' + esc(name) + '</b><em>' + pad(items.length) +
        (items.length === 1 ? ' file' : ' files') + '</em></summary><div class="fp-assets">' + items.map(function (it) {
          return '<a class="fp-asset' + (it[2] ? ' fp-asset-fit' : '') + '" href="' + attr(it[1]) + '"><img src="' + attr(it[1]) + '" alt=""><span>' + esc(it[0]) + '</span></a>';
        }).join('') + '</div></details>';
    }
    // [label, address, shown whole rather than cropped]
    var shelves = [shelf('--', 'Profile', [['Backdrop', o.fpBackground], ['Emblem', o.fpEmblem, true], ['Mascot', o.fpMascot, true]])];
    list.forEach(function (f, i) {
      var items = [['Stage', f.art], ['Portrait', f.portrait], ['Scene', f.hover], ['Chibi', f.chibi, true]];
      squad(f).forEach(function (m) {
        // By first name: the label is one short line under a small picture.
        var who = String(m.name).trim().split(' ')[0];
        items.push([who + ' · stage', m.art], [who + ' · chibi', m.chibi, true]);
      });
      shelves.push(shelf(pad(i + 1), f.name, items));
    });
    var html = shelves.join('');
    return html ? '<div class="fp-sub">Asset archive</div><div class="fp-gallery">' + html + '</div>' : '';
  }

  function navItem(key, n, label, note, target) {
    return '<a class="fp-nav-item fp-nav-' + key + '" href="#' + (target || 'fp-' + key) + '"><i>' + pad(n) + '</i><b>' + label + '</b><span>' + note + '</span></a>';
  }

  function head(n, title, note) {
    return '<div class="fp-head"><div class="fp-label"><i></i>Section ' + pad(n) + '</div><h2>' + title + '</h2><span>' + note + '</span></div>';
  }

  // ----------------------------------------------------------------- wiring

  /* What depends on the roster: which file each key opens, and the timing of
   * a slideshow with this many slides. */
  function css(files, o) {
    var list = roster(files);
    var show = slides(files, o);
    var n = show.length;
    var out = ['/* Generated from Profile data — edit it there, not here. */'];

    // A file opens for its own key and for every draw that lands on it.
    out.push(list.map(function (f, i) {
      return '.profile-info-stack:has(.fp-k-' + (i + 1) + ':target) .fp-file-' + (i + 1);
    }).join(',\n') + ' { display: block; }');

    // The briefing of the tile that is pointed at. The first child of the
    // panel is its idle card, so character N is child N + 1.
    out.push(list.map(function (f, i) {
      return '.fp-roster:has(.fp-card:nth-child(' + (i + 1) + '):hover) + .fp-intel > .fp-brief:nth-child(' + (i + 2) + ')';
    }).join(',\n') + ' { display: block; }');

    // A tag narrows the roster: its chip is lit, and the tiles without it go.
    var sieve = filters(files);
    if (sieve.length) {
      var T = '.profile-info-stack:has(#fp-tag-';
      out.push(sieve.map(function (t) { return T + t.n + ':target) .fp-f' + t.n; }).join(',\n') +
        ' { border-color: ' + theme(o).ink + '; background: ' + theme(o).ink + '; color: ' + theme(o).bg + '; }');
      out.push(sieve.map(function (t) { return T + t.n + ':target) .fp-card:not(.fp-g' + t.n + ')'; }).join(',\n') + ' { display: none; }');
    }

    var draws = pools(files, o);
    if (draws.length) {
      var S ='.profile-info-stack:has(#fp-pool-';
      // The chosen pool: its chip lit, its gate shown, the rest of the
      // candidates dimmed.
      out.push(draws.map(function (p) { return S + p.key + ':target) .fp-pool-' + p.key; }).join(',\n') +
        ' { border-color: ' + theme(o).ink + '; background: ' + theme(o).ink + '; color: ' + theme(o).bg + '; }');
      out.push(draws.map(function (p) { return S + p.key + ':target) .fp-gate-' + p.key; }).join(',\n') + ' { position: relative; visibility: visible; pointer-events: auto; }');
      out.push(draws.map(function (p) { return S + p.key + ':target) .fp-cand:not(.fp-in-' + p.key + ')'; }).join(',\n') +
        ' { opacity: .16; filter: grayscale(1); transform: scale(.9); }');
      // After a draw, the way back to the pool it came from.
      out.push(draws.map(function (p) { return '.profile-info-stack:has(.fp-kp-' + p.key + ':target) .fp-again-' + p.key; }).join(',\n') + ' { display: flex; }');

      // The turn-taking on the button: with N links each is there for one
      // Nth of the loop, and each starts one step after the one before.
      var sizes = {}, longest = 0;
      draws.forEach(function (p) { sizes[p.members.length] = true; longest = Math.max(longest, p.members.length); });
      Object.keys(sizes).forEach(function (size) {
        var count = Number(size);
        if (count < 2) return;
        var share = Math.round(10000 / count) / 100;
        out.push('@keyframes fp-turn-' + count + ' { 0% { visibility: visible; } ' + share + '%, 100% { visibility: hidden; } }');
        out.push('.fp-draw-' + count + ' a { animation: fp-turn-' + count + ' ' + (Math.round(count * CYCLE_SECONDS * 100) / 100) + 's steps(1) infinite; }');
      });
      for (var k = 2; k <= longest; k++) {
        out.push('.fp-draw a:nth-of-type(' + k + ') { animation-delay: -' + (Math.round((k - 1) * CYCLE_SECONDS * 100) / 100) + 's; }');
      }
      out.push('@media (prefers-reduced-motion: reduce) { .fp-draw a { animation: none; } }');
    }

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
      // Pointing at a thumbnail (or its own buttons) brings its slide up, and
      // pointing at a slide's words keeps that slide up. The slides are
      // shown and hidden over their running animations with !important,
      // which beats an animation, rather than by stopping them: the show
      // carries on underneath, in step with its progress bars, and picks up
      // where the bars say once the pointer goes.
      function held(i) {
        return '.fp-screen-home:has(.fp-pick-' + (i + 1) + ':hover, .fp-slide-' + (i + 1) + ' .fp-slide-info:hover)';
      }
      out.push(show.map(function (f, i) { return held(i) + ' .fp-slide'; }).join(',\n') +
        ' { opacity: 0 !important; visibility: hidden !important; }');
      out.push(show.map(function (f, i) { return held(i) + ' .fp-slide-' + (i + 1); }).join(',\n') +
        ' { opacity: 1 !important; visibility: visible !important; }');
      // The bars: every fill put out, and the held slide's whole bar inked.
      // Not by overriding the fills' transform: the browser runs that
      // animation on its own and keeps drawing it past an override.
      out.push(show.map(function (f, i) { return held(i) + ' .fp-progress i::after'; }).join(',\n') +
        ' { opacity: 0 !important; }');
      out.push(show.map(function (f, i) { return held(i) + ' .fp-progress i.fp-progress-' + (i + 1); }).join(',\n') +
        ' { background: ' + theme(o).ink + ' !important; }');
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
'  /* As tall as its width asks for, but never taller than the window under',
'   * JanitorAI\'s header: the page then has nothing to scroll, and what is',
'   * pinned inside a screen stays in view. */',
'  height: clamp(600px, min(56vw, calc(100vh - 44px)), 900px);',
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
'.profile-info-stack:has(#fp-roster:target, .fp-key-op:target, .fp-key-tag:target) .fp-nav-roster,',
'.profile-info-stack:has(.fp-key-pool:target, .fp-key-pull:target) .fp-nav-recruit,',
'.profile-info-stack:has(#fp-dossier:target) .fp-nav-dossier,',
'.profile-info-stack:has(#fp-network:target) .fp-nav-network,',
'.profile-info-stack:has(#fp-log:target) .fp-nav-log { background: @railInk@12; }',
'.fp-nav-home b,',
'.profile-info-stack:has(#fp-roster:target, .fp-key-op:target, .fp-key-tag:target) .fp-nav-roster b,',
'.profile-info-stack:has(.fp-key-pool:target, .fp-key-pull:target) .fp-nav-recruit b,',
'.profile-info-stack:has(#fp-dossier:target) .fp-nav-dossier b,',
'.profile-info-stack:has(#fp-network:target) .fp-nav-network b,',
'.profile-info-stack:has(#fp-log:target) .fp-nav-log b { color: @a@; }',
'.fp-nav-home::before,',
'.profile-info-stack:has(#fp-roster:target, .fp-key-op:target, .fp-key-tag:target) .fp-nav-roster::before,',
'.profile-info-stack:has(.fp-key-pool:target, .fp-key-pull:target) .fp-nav-recruit::before,',
'.profile-info-stack:has(#fp-dossier:target) .fp-nav-dossier::before,',
'.profile-info-stack:has(#fp-network:target) .fp-nav-network::before,',
'.profile-info-stack:has(#fp-log:target) .fp-nav-log::before { transform: scaleY(1); }',
'.fp-nav-home::after,',
'.profile-info-stack:has(#fp-roster:target, .fp-key-op:target, .fp-key-tag:target) .fp-nav-roster::after,',
'.profile-info-stack:has(.fp-key-pool:target, .fp-key-pull:target) .fp-nav-recruit::after,',
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
'.profile-info-stack:has(#fp-roster:target, .fp-key-tag:target) .fp-screen-roster,',
'.profile-info-stack:has(.fp-key-pool:target) .fp-screen-recruit,',
'.profile-info-stack:has(#fp-dossier:target) .fp-screen-dossier,',
'.profile-info-stack:has(#fp-network:target) .fp-screen-network,',
'.profile-info-stack:has(#fp-log:target) .fp-screen-log { display: block; }',
'.fp-screen-roster, .fp-screen-recruit, .fp-screen-dossier, .fp-screen-network, .fp-screen-log { padding: 38px 44px 40px; overflow-y: auto; }',
'/* The backdrop is the Overview\'s. The other screens lay their own ground over',
' * it, nearly solid, so their small print on the right is not lost in a picture. */',
'.fp-screen-roster, .fp-screen-recruit, .fp-screen-dossier, .fp-screen-network, .fp-screen-log { background: @bg@f0; }',
'/* Recruit is never taken out of the layout, so the draw buttons inside it',
' * keep turning from the moment the page loads (see .fp-gate). Unchosen, it',
' * is invisible and takes no pointer; its wipe and its entrances, which',
' * would otherwise have played once, unseen, at load, start when it opens. */',
'.fp-screen-recruit { display: block; visibility: hidden; pointer-events: none; }',
'.profile-info-stack:has(.fp-key-pool:target) .fp-screen-recruit { visibility: visible; pointer-events: auto; }',
'.fp-screen-recruit .fp-wipe { display: none; }',
'.profile-info-stack:has(.fp-key-pool:target) .fp-screen-recruit .fp-wipe { display: block; }',
'.fp-screen-recruit .fp-head, .fp-screen-recruit .fp-recruit-side, .fp-screen-recruit .fp-gates { animation-name: none; }',
'.profile-info-stack:has(.fp-key-pool:target) .fp-screen-recruit .fp-head, .profile-info-stack:has(.fp-key-pool:target) .fp-screen-recruit .fp-recruit-side, .profile-info-stack:has(.fp-key-pool:target) .fp-screen-recruit .fp-gates { animation-name: fp-rise; }',
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
'.fp-hud { position: absolute; top: 24px; right: 30px; z-index: 4; display: flex; gap: 22px; padding: 6px 12px; background: @bg@e6; box-shadow: 4px 4px 0 @a@; color: @mute@; font-family: @MONO@; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; animation: fp-rise .6s ease .5s both; }',
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
'.fp-pick { position: relative; width: 44px; height: 44px; }',
'.fp-pick-face { position: relative; display: block; width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; border: 1px solid @ink@66; background: @panel@; transition: transform .18s ease, border-color .18s ease; }',
'.fp-pick-img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; filter: grayscale(1); transition: filter .18s ease; }',
'.fp-pick-face span { position: absolute; right: 0; bottom: 0; padding: 1px 3px; background: @ink@; color: @bg@; font-family: @MONO@; font-size: 8px; }',
'.fp-pick:hover .fp-pick-face { border-color: @a@; transform: translateY(-4px); }',
'.fp-pick:hover .fp-pick-img { filter: none; }',
'/* The thumbnail\'s own buttons, stacked just above it. The padding under them',
' * is part of the thumbnail too, so there is no gap to fall through. */',
'.fp-pick-go { position: absolute; bottom: 100%; left: -6px; z-index: 5; display: none; flex-direction: column; gap: 4px; width: max-content; padding-bottom: 10px; }',
'.fp-pick:hover .fp-pick-go { display: flex; animation: fp-rise .2s ease both; }',
'.fp-pick-go a { display: block; padding: 7px 12px; border: 1px solid @ink@; background: @bg@; color: @ink@; font-family: @MONO@; font-size: 10px; letter-spacing: .14em; line-height: 1; text-decoration: none; text-transform: uppercase; white-space: nowrap; transition: background .15s ease, color .15s ease; }',
'.fp-pick-go a:hover { background: @ink@; color: @bg@; }',
'.fp-pick-go .fp-pick-open { border-color: @a@; background: @a@; color: @onA@; }',
'.fp-pick-go .fp-pick-open:hover { background: @a@; color: @onA@; filter: brightness(1.08); }',
'/* While a thumbnail\'s own buttons are out, the slide\'s pair just above them steps aside. */',
'.fp-screen-home:has(.fp-pick:hover) .fp-slide-info .fp-actions { visibility: hidden !important; }',
'/* One bar per slide, filling while its slide is up. */',
'.fp-progress { position: absolute; bottom: 14px; left: 44px; z-index: 4; display: flex; gap: 6px; }',
'.fp-progress i { position: relative; display: block; width: 44px; height: 3px; overflow: hidden; background: @ink@33; }',
'.fp-progress i::after { content: ""; position: absolute; inset: 0; background: @ink@; transform: scaleX(0); transform-origin: 0 50%; }',
'/* Reading stops the clock: the pointer on a slide\'s words, not anywhere on the',
' * screen. A pointer that is simply resting there when the page loads, or when',
' * a thumbnail is let go of, would hold the show at its first instant, which',
' * is before anything has faded in. Words can only be pointed at once shown. */',
'.fp-screen-home:has(.fp-slide-info:hover) .fp-slide, .fp-screen-home:has(.fp-slide-info:hover) .fp-slide-art, .fp-screen-home:has(.fp-slide-info:hover) .fp-plate, .fp-screen-home:has(.fp-slide-info:hover) .fp-progress i::after { animation-play-state: paused; }',
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
'/* A bot of several characters says so on its tile. */',
'.fp-card-squad { position: absolute; top: 22px; left: 0; padding: 2px 6px; background: @a@; color: @onA@; font-family: @MONO@; font-size: 8px; letter-spacing: .1em; text-transform: uppercase; }',
'/* The tags the roster can be narrowed by. A flex row, so the whitespace',
' * between chips is not a gap. All is lit until a tag is chosen. */',
'.fp-filters { display: flex; flex-wrap: wrap; gap: 5px; margin: -8px 0 20px; animation: fp-rise .6s ease .3s both; }',
'.fp-filter { display: flex; align-items: center; gap: 7px; padding: 4px 5px 4px 9px; border: 1px solid @ink@66; color: @ink@; font-family: @MONO@; font-size: 10px; letter-spacing: .08em; line-height: 1.3; text-decoration: none; text-transform: uppercase; transition: background .15s ease, color .15s ease, border-color .15s ease; }',
'.fp-filter span { padding: 1px 4px; background: @a@; color: @onA@; font-size: 9px; letter-spacing: 0; }',
'.fp-filter:hover { border-color: @ink@; color: @ink@; }',
'.fp-f0, .fp-f0:hover { border-color: @ink@; background: @ink@; color: @bg@; }',
'.profile-info-stack:has(.fp-key-tag:target) .fp-f0 { border-color: @ink@66; background: transparent; color: @ink@; }',
'/* The tiles, and beside them the briefing: what the bot under the pointer',
' * is about. It stays in view while the tiles scroll. */',
'.fp-roster-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 24px; align-items: start; }',
'.fp-intel { position: sticky; top: 0; animation: fp-rise .6s ease .4s both; }',
'.fp-brief { display: none; padding: 0 14px 14px; border: 1px solid @ink@; background: @panel@; box-shadow: 6px 6px 0 @a@; }',
'.fp-brief.fp-r6 { box-shadow: 6px 6px 0 @rank6@; } .fp-brief.fp-r5 { box-shadow: 6px 6px 0 @rank5@; } .fp-brief.fp-r4 { box-shadow: 6px 6px 0 @rank4@; } .fp-brief.fp-r3 { box-shadow: 6px 6px 0 @rank3@; }',
'.fp-brief-idle { display: block; padding-top: 14px; border-style: dashed; box-shadow: none; }',
'.fp-roster:has(.fp-card:hover) + .fp-intel > .fp-brief-idle { display: none; }',
'.fp-brief-img { display: block; width: calc(100% + 28px); max-width: none; aspect-ratio: 16 / 9; margin: 0 -14px 12px; object-fit: cover; object-position: center 22%; }',
'.fp-brief > b { display: -webkit-box; margin-top: 8px; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; color: @ink@; font-family: @HEAD@; font-size: 22px; font-stretch: 75%; font-weight: 700; letter-spacing: .03em; line-height: 1.05; text-transform: uppercase; }',
'.fp-brief .fp-stars { display: block; margin-top: 7px; font-size: 12px; }',
'.fp-brief p { display: -webkit-box; margin: 10px 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 10; color: @ink@; font-size: 13px; line-height: 1.5; }',
'/* Stuck on over the foot of the picture, each a little askew. */',
'.fp-stickers { position: relative; display: flex; margin: -42px 0 4px 2px; }',
'.fp-sticker { display: block; width: 50px; height: 50px; margin-right: -7px; border: 3px solid #ffffff; border-radius: 9px; background: #ffffff; box-shadow: 0 0 0 1px #14151a40, 2px 4px 7px #00000066; object-fit: contain; transform: rotate(-7deg); }',
'.fp-sticker:nth-child(even) { transform: rotate(5deg) translateY(5px); }',
'.fp-sticker:nth-child(3n) { transform: rotate(-2deg) translateY(-3px); }',
'.fp-sticker-face { object-fit: cover; object-position: center 4%; }',
'.fp-brief-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }',
'.fp-brief-tags i { padding: 2px 6px; border: 1px solid @ink@66; color: @ink@; font-family: @MONO@; font-size: 9px; font-style: normal; letter-spacing: .06em; line-height: 1.3; text-transform: uppercase; }',
'.fp-brief p { -webkit-line-clamp: 7; }',
'.fp-brief em { display: block; margin-top: 12px; padding-top: 8px; border-top: 1px solid @line@; color: @mute@; font-family: @MONO@; font-size: 9px; font-style: normal; letter-spacing: .12em; text-transform: uppercase; }',
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
'/* ---- a squad: a bot of several characters, all of them on its file ---- */',
'/* They stand side by side as strips on the slant, in place of the one',
' * picture, and the file gives them more of its width the more there are.',
' * The first strip runs on past the left edge, so its slant never shows a',
' * gap, and is given that much more to stand on, so it shows as much as',
' * the others. The strip under the pointer widens. */',
'.fp-squad { position: absolute; top: 0; bottom: 0; left: 0; display: flex; gap: 7px; animation: fp-slide-in .7s cubic-bezier(.2, .8, .2, 1) .25s both; }',
'.fp-sq-2 .fp-squad { width: calc(48% - 62px); } .fp-sq-3 .fp-squad { width: calc(54% - 62px); } .fp-sq-4 .fp-squad { width: calc(58% - 62px); } .fp-sq-5 .fp-squad { width: calc(62% - 62px); } .fp-sq-6 .fp-squad { width: calc(66% - 62px); }',
'/* The plate behind them is what shows between the strips: the separators',
' * are the file\'s rank colour. */',
'.fp-file-squad .fp-file-plate { left: -130px; clip-path: none; transform: skewX(-9deg); animation-name: fp-squad-in; }',
'.fp-sq-2 .fp-file-plate { width: calc(48% + 84px); } .fp-sq-3 .fp-file-plate { width: calc(54% + 84px); } .fp-sq-4 .fp-file-plate { width: calc(58% + 84px); } .fp-sq-5 .fp-file-plate { width: calc(62% + 84px); } .fp-sq-6 .fp-file-plate { width: calc(66% + 84px); }',
'.fp-sq-2 .fp-file-info { left: 51%; } .fp-sq-3 .fp-file-info { left: 57%; } .fp-sq-4 .fp-file-info { left: 61%; } .fp-sq-5 .fp-file-info { left: 65%; } .fp-sq-6 .fp-file-info { left: 69%; }',
'.fp-file-squad .fp-file-name { font-size: clamp(28px, 3.3vw, 50px); }',
'.fp-mem { position: relative; flex: 1 1 0; min-width: 0; overflow: hidden; background: @panel@; transform: skewX(-9deg); transition: flex-grow .45s cubic-bezier(.2, .8, .2, 1), filter .3s ease; }',
'/* The picture leans back the other way, so it stands upright in a leaning frame. */',
'.fp-mem-img { position: absolute; top: 0; left: -80px; display: block; width: calc(100% + 160px); max-width: none; height: 100%; object-fit: cover; object-position: center top; transform: skewX(9deg); }',
'.fp-mem::after { content: ""; position: absolute; right: 0; bottom: 0; left: 0; height: 46%; background: linear-gradient(180deg, #05060800, #050608e6 62%); pointer-events: none; }',
'.fp-mem-cap { position: absolute; right: 0; bottom: 0; left: 0; z-index: 1; display: block; padding: 0 8px 20px 22px; color: #ffffff; transform: skewX(9deg); transform-origin: 50% 100%; }',
'.fp-mem-cap i { display: block; color: @a@; font-family: @MONO@; font-size: 9px; font-style: normal; letter-spacing: .14em; }',
'.fp-mem-cap b { display: block; margin-top: 3px; font-family: @HEAD@; font-size: 16px; font-stretch: 75%; font-weight: 700; letter-spacing: .03em; line-height: 1.05; text-transform: uppercase; }',
'/* Who they are: folded away until their strip is pointed at. */',
'.fp-mem-cap em, .fp-mem-cap span { display: block; max-height: 0; overflow: hidden; opacity: 0; transition: max-height .45s ease, opacity .3s ease, margin .3s ease; }',
'.fp-mem-cap em { color: @a@; font-family: @MONO@; font-size: 9px; font-style: normal; letter-spacing: .1em; line-height: 1.4; text-transform: uppercase; }',
'.fp-mem-cap span { color: #ffffffd9; font-size: 12px; line-height: 1.45; }',
'.fp-mem:first-child { flex-basis: 106px; margin-left: -76px; }',
'.fp-mem:first-child .fp-mem-img { left: -42px; }',
'.fp-mem:first-child .fp-mem-cap { padding-left: 160px; }',
'/* The bot\'s chibi keeps its corner; the buttons make room for it. */',
'.fp-file-squad .fp-file-tag { width: 104px; }',
'.fp-file-squad .fp-file-info .fp-actions { padding-right: 116px; }',
'.fp-mem:hover { flex-grow: 2.2; }',
'.fp-sq-2 .fp-mem:hover { flex-grow: 1.5; }',
'.fp-mem:hover .fp-mem-cap em, .fp-mem:hover .fp-mem-cap span { max-height: 160px; margin-top: 6px; opacity: 1; }',
'.fp-squad:hover .fp-mem:not(:hover) { filter: brightness(.5) saturate(.7); }',
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
'/* The asset archive: a shelf per character, two abreast, opened on a click. */',
'.fp-gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: start; animation: fp-rise .6s ease .5s both; }',
'.fp-entry.fp-shelf summary { gap: 10px; padding: 9px 14px; font-size: 15px; }',
'.fp-entry.fp-shelf summary b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
'.fp-entry.fp-shelf summary em { flex: 0 0 auto; margin-left: auto; color: @mute@; font-family: @MONO@; font-size: 9px; font-style: normal; font-weight: 400; letter-spacing: .12em; }',
'.fp-entry.fp-shelf summary::after { margin-left: 0; }',
'.fp-assets { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; padding: 12px 14px 14px; }',
'.fp-asset { display: block; border: 1px solid @line@; background: @bg@; color: @ink@; text-decoration: none; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }',
'.fp-asset img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; object-position: center top; }',
'/* A chibi or an emblem is shown whole, on the white it was drawn on. */',
'.fp-asset-fit img { background: #ffffff; object-fit: contain; }',
'.fp-asset span { display: block; padding: 4px 6px 5px; overflow: hidden; border-top: 1px solid @line@; font-family: @MONO@; font-size: 8px; letter-spacing: .08em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }',
'.fp-asset:hover { z-index: 1; border-color: @ink@; box-shadow: 5px 5px 0 @a@; color: @ink@; transform: translate(-3px, -3px); }',
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
'/* ---- recruit: choose a pool, press, and a character is drawn ---- */',
'.fp-recruit { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 40%); gap: 34px; align-items: start; }',
'.fp-recruit .fp-sub { margin: 0 0 12px; }',
'.fp-recruit-side { animation: fp-rise .6s ease .36s both; }',
'/* The pools. A flex row, so the whitespace between chips is not a gap. */',
'.fp-pools { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 28px; }',
'.fp-pool { display: flex; align-items: center; gap: 10px; padding: 9px 10px 9px 14px; border: 1px solid @ink@66; color: @ink@; font-family: @HEAD@; font-size: 16px; font-stretch: 75%; letter-spacing: .08em; line-height: 1; text-decoration: none; text-transform: uppercase; transition: background .15s ease, color .15s ease, border-color .15s ease, transform .15s ease; }',
'.fp-pool b { font-weight: 700; }',
'.fp-pool span { padding: 2px 5px; background: @a@; color: @onA@; font-family: @MONO@; font-size: 10px; letter-spacing: 0; }',
'.fp-pool:hover { border-color: @ink@; color: @ink@; transform: translateY(-2px); }',
'/* Everyone on file. The ones outside the chosen pool fall back and fade. */',
'.fp-cands { display: grid; grid-template-columns: repeat(auto-fill, minmax(54px, 1fr)); gap: 6px; }',
'.fp-cand { position: relative; display: block; aspect-ratio: 1; overflow: hidden; border: 1px solid @line@; background: @panel@; transition: opacity .3s ease, filter .3s ease, transform .3s ease; }',
'.fp-cand-img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; }',
'.fp-cand .fp-noimg b { display: none; }',
'/* The gate: the chosen pool\'s name and count over turning rings, and the button. */',
'.fp-gates { position: relative; display: flex; align-items: center; justify-content: center; min-height: 380px; overflow: hidden; border: 1px solid @ink@; background: @panel@; animation: fp-rise .6s ease .44s both; }',
'.fp-gates > i { position: absolute; top: 50%; left: 50%; display: block; pointer-events: none; }',
'.fp-gate-ring { width: 300px; height: 300px; margin: -150px 0 0 -150px; border: 1px dashed @ink@40; border-radius: 50%; animation: fp-spin 40s linear infinite; }',
'.fp-gate-ring-b { width: 230px; height: 230px; margin: -115px 0 0 -115px; border: 2px solid transparent; border-top-color: @a@; border-bottom-color: @a@; animation-duration: 9s; animation-direction: reverse; }',
'.fp-gate-ring-c { width: 420px; height: 420px; margin: -210px 0 0 -210px; border: 1px solid @ink@1f; border-radius: 0; animation-duration: 70s; }',
'/* Every pool\'s gate is laid out all the time, one over another, and the',
' * chosen one is the one made visible: an element taken out of the layout',
' * (display: none) stops its animations and starts them again from nothing',
' * when it comes back, and the draw would then always begin with the same',
' * character. Laid out, the turn-taking runs from the moment the page loads,',
' * so when the button is pressed has nothing to do with when Recruit was',
' * opened. The links of a hidden gate become visible as they take their',
' * turns; nothing can press them, since the gate takes no pointer. */',
'.fp-gate { position: absolute; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 30px 24px; text-align: center; visibility: hidden; pointer-events: none; }',
'.fp-gate-name { margin-top: 12px; color: @ink@; font-family: @HEAD@; font-size: clamp(30px, 3.6vw, 50px); font-stretch: 75%; font-weight: 700; letter-spacing: .03em; line-height: 1; text-transform: uppercase; }',
'.fp-gate-count { display: flex; align-items: baseline; gap: 8px; margin-top: 10px; color: @mute@; font-family: @MONO@; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; }',
'.fp-gate-count b { color: @ink@; font-family: @HEAD@; font-size: 30px; font-stretch: 75%; letter-spacing: .02em; }',
'/* The button is a plate with its links laid over the whole of it. */',
'.fp-draw { position: relative; display: flex; align-items: center; gap: 14px; margin-top: 26px; padding: 18px 30px; overflow: hidden; background: @a@; color: @onA@; font-family: @HEAD@; font-size: 19px; font-stretch: 75%; font-weight: 700; letter-spacing: .14em; line-height: 1; text-transform: uppercase; clip-path: polygon(0 0, 100% 0, 100% 64%, 94% 100%, 0 100%); transition: filter .18s ease, transform .18s ease; }',
'.fp-draw::before { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, #ffffff99 50%, transparent 65%); background-size: 300% 100%; animation: fp-gleam 3.2s ease-in-out infinite; }',
'.fp-draw > span, .fp-draw > i { position: relative; }',
'.fp-draw > i { width: 24px; height: 9px; background: @onA@; clip-path: polygon(0 38%, 72% 38%, 72% 0, 100% 50%, 72% 100%, 72% 62%, 0 62%); transition: transform .18s ease; }',
'.fp-draw:hover { filter: brightness(1.08); transform: translateY(-3px); }',
'.fp-draw:hover > i { transform: translateX(6px); }',
'.fp-draw a { position: absolute; inset: 0; z-index: 2; visibility: hidden; }',
'.fp-draw a:first-of-type { visibility: visible; }',
'',
'/* ---- the draw: one sequence over the whole interface ---- */',
'.fp-fx { position: absolute; inset: 0; z-index: 25; display: none; overflow: hidden; pointer-events: none; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-fx { display: block; }',
'.fp-fx > i { position: absolute; display: block; }',
'/* Dark falls, and lifts once the file underneath is ready to be seen. */',
'.fp-fx-back { inset: 0; background: radial-gradient(circle at 50% 46%, @fxMid@ 0%, @fxEdge@ 70%); animation: fp-fx-back 3s linear both; }',
'/* A floor of lines rushing toward the viewer. */',
'.fp-fx-floor { right: -50%; bottom: -10%; left: -50%; height: 62%; background-image: linear-gradient(@a@66 1px, transparent 1px), linear-gradient(90deg, @a@66 1px, transparent 1px); background-size: 70px 70px; transform: perspective(520px) rotateX(64deg); transform-origin: 50% 100%; animation: fp-fx-floor 3s linear both; }',
'/* Shutters close from the top and the bottom, and part again at the end. */',
'.fp-fx-shut { right: 0; left: 0; height: 50%; background: #050608; }',
'.fp-fx-shut-a { top: 0; border-bottom: 2px solid @a@; transform-origin: 50% 0; animation: fp-fx-shut 3s cubic-bezier(.7, 0, .2, 1) both; }',
'.fp-fx-shut-b { bottom: 0; border-top: 2px solid @a@; transform-origin: 50% 100%; animation: fp-fx-shut 3s cubic-bezier(.7, 0, .2, 1) both; }',
'/* Three frames closing on the middle, each turning the other way. */',
'.fp-fx-ring { top: 50%; left: 50%; width: 340px; height: 340px; margin: -170px 0 0 -170px; border: 2px solid @a@; opacity: 0; animation: fp-fx-ring 2.2s cubic-bezier(.2, .8, .2, 1) .25s both; }',
'.fp-fx-ring-b { width: 230px; height: 230px; margin: -115px 0 0 -115px; border-color: #ffffff; animation-name: fp-fx-ring-b; animation-delay: .4s; }',
'.fp-fx-ring-c { width: 460px; height: 460px; margin: -230px 0 0 -230px; border-style: dashed; border-radius: 50%; animation-delay: .1s; }',
'.fp-fx-cross { top: 50%; left: 50%; width: 520px; height: 520px; margin: -260px 0 0 -260px; background: linear-gradient(@a@, @a@) center / 100% 1px no-repeat, linear-gradient(@a@, @a@) center / 1px 100% no-repeat; opacity: 0; animation: fp-fx-cross 2s ease .3s both; }',
'/* The line of light that sweeps down while the file is read. */',
'.fp-fx-beam { right: 0; left: 0; top: 0; height: 22%; background: linear-gradient(180deg, transparent, @a@40 80%, @a@); opacity: 0; animation: fp-fx-beam 1.5s linear .5s both; }',
'.fp-fx-read { position: absolute; top: 50%; left: 50%; width: 300px; margin: -62px 0 0 -150px; text-align: center; animation: fp-fx-read 2.2s linear both; }',
'.fp-fx-read b { display: block; color: #ffffff; font-family: @HEAD@; font-size: 30px; font-stretch: 75%; letter-spacing: .12em; text-transform: uppercase; }',
'/* Three columns of figures spinning like a lock being tried. */',
'.fp-fx-rolls { display: flex; justify-content: center; gap: 10px; margin-top: 10px; }',
'.fp-fx-roll { display: block; height: 22px; overflow: hidden; padding: 0 8px; border: 1px solid @a@; color: @a@; font-family: @MONO@; font-size: 14px; line-height: 22px; }',
'.fp-fx-roll i { display: block; font-style: normal; animation: fp-fx-roll .5s steps(8) infinite; }',
'.fp-fx-roll-b i { animation-duration: .36s; }',
'.fp-fx-roll-c i { animation-duration: .64s; }',
'.fp-fx-read em { display: block; height: 4px; margin-top: 14px; background: @a@; transform-origin: 0 50%; animation: fp-fx-bar 1.6s steps(12) .3s both; }',
'.fp-fx-status { display: block; margin-top: 8px; color: #ffffffb3; font-family: @MONO@; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; animation: fp-blink .4s steps(2) infinite; }',
'/* Two slabs of the accent cross on the slant, and the file is there. */',
'.fp-fx-slab { top: -20%; bottom: -20%; left: 0; width: 46%; background: @a@; transform: translateX(-140%) skewX(-18deg); animation: fp-fx-slab .8s cubic-bezier(.7, 0, .2, 1) 1.95s both; }',
'/* The second is a sliver, so it has further to go in its own widths. */',
'.fp-fx-slab-b { width: 14%; background: #ffffff; transform: translateX(-500%) skewX(-18deg); animation-name: fp-fx-slab-b; animation-delay: 2.08s; }',
'/* The stamp that lands on the art, and stays. */',
'.fp-fx-stamp { position: absolute; bottom: 74px; left: 284px; padding: 10px 18px 9px; border: 3px solid @a@; background: @fxEdge@e6; color: @a@; transform: rotate(-7deg); animation: fp-fx-stamp .5s cubic-bezier(.2, 1.5, .4, 1) 3s both; }',
'.fp-fx-stamp b { display: block; font-family: @HEAD@; font-size: 34px; font-stretch: 75%; letter-spacing: .14em; line-height: 1; text-transform: uppercase; }',
'.fp-fx-stamp span { display: block; margin-top: 4px; color: #ffffffcc; font-family: @MONO@; font-size: 9px; letter-spacing: .22em; text-transform: uppercase; }',
'',
'/* The draw is the colour of the rank that is coming: the slab, the frames,',
' * the figures and the stamp. Whoever knows the colours knows before the art. */',
'.profile-info-stack:has(.fp-kr-6:target) .fp-fx-slab:not(.fp-fx-slab-b), .profile-info-stack:has(.fp-kr-6:target) .fp-fx-read em { background: @rank6@; }',
'.profile-info-stack:has(.fp-kr-5:target) .fp-fx-slab:not(.fp-fx-slab-b), .profile-info-stack:has(.fp-kr-5:target) .fp-fx-read em { background: @rank5@; }',
'.profile-info-stack:has(.fp-kr-4:target) .fp-fx-slab:not(.fp-fx-slab-b), .profile-info-stack:has(.fp-kr-4:target) .fp-fx-read em { background: @rank4@; }',
'.profile-info-stack:has(.fp-kr-3:target) .fp-fx-slab:not(.fp-fx-slab-b), .profile-info-stack:has(.fp-kr-3:target) .fp-fx-read em { background: @rank3@; }',
'.profile-info-stack:has(.fp-kr-6:target) .fp-fx-ring, .profile-info-stack:has(.fp-kr-6:target) .fp-fx-roll, .profile-info-stack:has(.fp-kr-6:target) .fp-fx-stamp { border-color: @rank6@; color: @rank6@; }',
'.profile-info-stack:has(.fp-kr-5:target) .fp-fx-ring, .profile-info-stack:has(.fp-kr-5:target) .fp-fx-roll, .profile-info-stack:has(.fp-kr-5:target) .fp-fx-stamp { border-color: @rank5@; color: @rank5@; }',
'.profile-info-stack:has(.fp-kr-4:target) .fp-fx-ring, .profile-info-stack:has(.fp-kr-4:target) .fp-fx-roll, .profile-info-stack:has(.fp-kr-4:target) .fp-fx-stamp { border-color: @rank4@; color: @rank4@; }',
'.profile-info-stack:has(.fp-kr-3:target) .fp-fx-ring, .profile-info-stack:has(.fp-kr-3:target) .fp-fx-roll, .profile-info-stack:has(.fp-kr-3:target) .fp-fx-stamp { border-color: @rank3@; color: @rank3@; }',
'/* The stamp carries the stars; the ones past the rank are not there. */',
'.fp-fx-stars { display: flex; gap: 3px; margin-top: 6px; font-size: 20px; line-height: 1; }',
'.fp-fx-stars i { font-style: normal; animation: fp-star .4s cubic-bezier(.2, 1.6, .4, 1) both; }',
'.fp-fx-stars i:nth-child(1) { animation-delay: 3.3s; } .fp-fx-stars i:nth-child(2) { animation-delay: 3.38s; } .fp-fx-stars i:nth-child(3) { animation-delay: 3.46s; } .fp-fx-stars i:nth-child(4) { animation-delay: 3.54s; } .fp-fx-stars i:nth-child(5) { animation-delay: 3.62s; } .fp-fx-stars i:nth-child(6) { animation-delay: 3.7s; }',
'.profile-info-stack:has(.fp-kr-3:target) .fp-fx-stars i:nth-child(n + 4), .profile-info-stack:has(.fp-kr-4:target) .fp-fx-stars i:nth-child(n + 5), .profile-info-stack:has(.fp-kr-5:target) .fp-fx-stars i:nth-child(n + 6) { display: none; }',
'/* The top rank alone: the screen whites out and rays turn behind the art. */',
'.fp-fx-burst { top: 50%; left: 50%; display: none !important; width: 240vmax; height: 240vmax; margin: -120vmax 0 0 -120vmax; background: repeating-conic-gradient(@rank6@59 0deg 5deg, transparent 5deg 14deg); }',
'.profile-info-stack:has(.fp-kr-6:target) .fp-fx-burst { display: block !important; animation: fp-fx-burst 2.6s ease-out 2.2s both; }',
'.profile-info-stack:has(.fp-kr-6:target) .fp-fx-slab-b { background: #ffffff; box-shadow: 0 0 80px 40px #ffffff; }',
'.profile-info-stack:has(.fp-kr-6:target) .fp-fx-status { color: @rank6@; }',
'',
'/* A drawn file: it waits for the sequence, its art comes up out of shadow,',
' * and the way back to the pool is offered where "Roster" was. */',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file .fp-wipe { display: none; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-plate { animation-delay: 2.3s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-art { animation-delay: 2.3s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-squad { animation-delay: 2.3s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-img { animation: fp-unveil 1.5s ease-out 2.4s both; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-top { animation-delay: 2.7s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-name { animation: fp-stamp-in .6s cubic-bezier(.2, .9, .2, 1) 2.8s both; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-stars i { animation-delay: 2.9s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-tag { animation-delay: 4s, 3.5s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-line { animation-delay: 3s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-quote { animation-delay: 3.08s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-desc { animation-delay: 3.16s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-info .fp-chips { animation-delay: 3.24s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-stats { animation-delay: 3.32s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-file-info .fp-actions { animation-delay: 3.4s; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-back { display: none; }',
'.fp-pullbar { position: absolute; top: 30px; right: 168px; z-index: 26; display: none; }',
'.profile-info-stack:has(.fp-key-pull:target) .fp-pullbar { display: block; animation: fp-rise .5s ease 3.4s both; }',
'.fp-again { display: none; align-items: center; gap: 9px; padding: 6px 12px 6px 10px; border: 1px solid @ink@; background: @bg@; color: @ink@; font-family: @MONO@; font-size: 10px; letter-spacing: .14em; text-decoration: none; text-transform: uppercase; transition: background .15s ease, color .15s ease; }',
'.fp-again i { width: 9px; height: 9px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; }',
'.fp-again span { padding: 1px 5px; background: @a@; color: @onA@; }',
'.fp-again:hover { background: @ink@; color: @bg@; }',
'.fp-again:hover i { animation: fp-spin .6s linear infinite; }',
'',
'/* ---- rarity: stars, and one colour per rank that no theme changes ---- */',
'.fp-stars { color: @ink@; font-size: 15px; letter-spacing: .14em; line-height: 1; }',
'.fp-slide-info .fp-stars { margin-top: 12px; }',
'.fp-r6 .fp-stars, .fp-stars.fp-r6, .fp-r6 .fp-card-stars { color: @rank6@; }',
'.fp-r5 .fp-stars, .fp-stars.fp-r5, .fp-r5 .fp-card-stars { color: @rank5@; }',
'.fp-r4 .fp-stars, .fp-stars.fp-r4, .fp-r4 .fp-card-stars { color: @rank4@; }',
'.fp-r3 .fp-stars, .fp-stars.fp-r3, .fp-r3 .fp-card-stars { color: @rank3@; }',
'/* Stars are dark-edged so yellow ones still read on the light theme. */',
'.fp-stars, .fp-card-stars { text-shadow: 0 0 1px @ink@, 0 1px 0 @ink@66; }',
'.fp-card-stars { position: absolute; top: 3px; right: 6px; font-size: 10px; letter-spacing: .06em; }',
'/* A tile wears its rank along its foot, and lifts onto it. */',
'.fp-card.fp-r6 { border-bottom: 3px solid @rank6@; } .fp-card.fp-r5 { border-bottom: 3px solid @rank5@; } .fp-card.fp-r4 { border-bottom: 3px solid @rank4@; } .fp-card.fp-r3 { border-bottom: 3px solid @rank3@; }',
'.fp-card.fp-r6:hover { box-shadow: 8px 8px 0 @rank6@; } .fp-card.fp-r5:hover { box-shadow: 8px 8px 0 @rank5@; } .fp-card.fp-r4:hover { box-shadow: 8px 8px 0 @rank4@; } .fp-card.fp-r3:hover { box-shadow: 8px 8px 0 @rank3@; }',
'/* The top rank gleams without being asked. */',
'.fp-card.fp-r6 .fp-card-art::before { content: ""; position: absolute; inset: 0; z-index: 1; background: linear-gradient(115deg, transparent 38%, #ffffff73 50%, transparent 62%); background-size: 300% 100%; animation: fp-gleam 3.6s ease-in-out infinite; }',
'/* The rank among the figures of a file: the number in ink, a bar of its colour under it. */',
'.fp-stat-rank b { display: table !important; box-shadow: inset 0 -6px 0 @rank4@; }',
'.fp-r6 .fp-stat-rank b { box-shadow: inset 0 -6px 0 @rank6@; } .fp-r5 .fp-stat-rank b { box-shadow: inset 0 -6px 0 @rank5@; } .fp-r3 .fp-stat-rank b { box-shadow: inset 0 -6px 0 @rank3@; }',
'.fp-file-stars { display: flex; gap: 3px; margin-top: 22px; font-size: 22px; letter-spacing: 0; }',
'.fp-file-stars i { font-style: normal; animation: fp-star .45s cubic-bezier(.2, 1.6, .4, 1) both; }',
'.fp-file-stars i:nth-child(1) { animation-delay: .5s; } .fp-file-stars i:nth-child(2) { animation-delay: .57s; } .fp-file-stars i:nth-child(3) { animation-delay: .64s; } .fp-file-stars i:nth-child(4) { animation-delay: .71s; } .fp-file-stars i:nth-child(5) { animation-delay: .78s; } .fp-file-stars i:nth-child(6) { animation-delay: .85s; }',
'.fp-file-stars + .fp-file-name { margin-top: 8px; }',
'/* A file\'s plate and its rule are its rank\'s colour. */',
'.fp-file.fp-r6 .fp-file-plate { background: @rank6@; } .fp-file.fp-r5 .fp-file-plate { background: @rank5@; } .fp-file.fp-r4 .fp-file-plate { background: @rank4@; } .fp-file.fp-r3 .fp-file-plate { background: @rank3@; }',
'',
'/* ---- chibis: a field tag, white on purpose ---- */',
'.fp-tag { display: block; box-sizing: border-box; padding: 6px 6px 7px; border: 1px solid #14151a; background: #ffffff; color: #14151a; box-shadow: 5px 5px 0 @a@; clip-path: polygon(0 0, 100% 0, 100% 100%, 16% 100%, 0 88%); }',
'.fp-tag img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; }',
'.fp-tag b { display: block; margin: 4px 0 3px; overflow: hidden; font-family: @MONO@; font-size: 8px; font-weight: 400; letter-spacing: .12em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }',
'.fp-tag .fp-barcode { height: 8px; color: #14151a; }',
'/* Pinned to the corner of the file, swinging a little on its pin. */',
'.fp-file-tag { position: absolute; right: 34px; bottom: 26px; z-index: 3; width: 132px; transform: rotate(4deg); transform-origin: 50% 0; animation: fp-swing 5s ease-in-out 1s infinite, fp-rise .6s ease .84s backwards; }',
'/* On a roster tile it waits out of sight and hops up when the tile is pointed at. */',
'.fp-card-chibi { position: absolute; right: 6px; bottom: 6px; z-index: 2; width: 46%; aspect-ratio: 1; border: 1px solid #14151a; background: #ffffff; object-fit: contain; opacity: 0; transform: translateY(40%) rotate(8deg); transition: opacity .2s ease, transform .3s cubic-bezier(.2, 1.5, .4, 1); }',
'.fp-card:hover .fp-card-chibi { opacity: 1; transform: translateY(0) rotate(4deg); }',
'.fp-mascot { width: 150px; margin-top: 26px; transform: rotate(-3deg); animation: fp-swing 6s ease-in-out infinite; }',
'',
'/* ---- the ticker along the foot of the main area ---- */',
'.fp-ticker { position: absolute; right: 0; bottom: 0; left: 0; z-index: 5; height: 28px; overflow: hidden; background: @rail@; }',
'.fp-ticker-run { display: flex; width: max-content; animation: fp-ticker 36s linear infinite; }',
'.fp-ticker-run span { padding: 0 26px; color: @a@; font-family: @MONO@; font-size: 10px; letter-spacing: .2em; line-height: 28px; text-transform: uppercase; white-space: nowrap; }',
'.fp-ticker-run span::after { content: "///"; margin-left: 52px; color: @railMute@; }',
'',
'/* ---- JanitorAI\'s header, as the application\'s title bar ---- */',
'/* On a phone it stays JanitorAI\'s bar in the rail\'s colours. On a wider',
' * screen it is rebuilt below as the top edge of the interface. */',
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
'/* Wider than a phone, the bar stops being a site header laid over the page',
' * and becomes the top edge of the interface: the rail runs up through its',
' * first 256px, and the rest is a thin strip of the main area with a query',
' * line and small square controls. Nothing in it is louder than the screens. */',
'@media screen and (min-width: 901px) {',
'  .pp-top-bar-outer { height: auto !important; min-height: 0 !important; }',
'  .pp-top-bar { position: relative; grid-template-columns: 256px minmax(0, 1fr) auto !important; gap: 0 !important; height: 44px !important; min-height: 0 !important; padding: 0 !important; border-bottom: 0; background: linear-gradient(90deg, @rail@ 0 256px, @bg@ 256px) !important; backdrop-filter: none !important; }',
'  /* The rule under the strip stops at the rail, which has its own. */',
'  .pp-top-bar::after { content: ""; position: absolute; right: 0; bottom: 0; left: 256px; height: 1px; background: @ink@; pointer-events: none; }',
'  .pp-top-bar::before { content: ""; position: absolute; bottom: 0; left: 0; width: 256px; height: 1px; background: @railLine@; pointer-events: none; }',
'  /* The rail\'s share: the way back to JanitorAI, said quietly. */',
'  .pp-top-bar-left { box-sizing: border-box; width: 256px; gap: 10px !important; padding: 0 20px; }',
'  .profile-top-bar-logo-box, .pp-top-bar-logo { width: 22px !important; height: 22px !important; min-width: 0 !important; }',
'  .pp-top-bar-logo img { width: 22px !important; height: 22px !important; filter: grayscale(1) brightness(1.5); opacity: .7; transition: filter .2s ease, opacity .2s ease; }',
'  .pp-top-bar-logo:hover img { filter: none; opacity: 1; }',
'  .pp-top-bar-tabs a { height: auto !important; padding: 0 !important; color: @railMute@; font-size: 10px; letter-spacing: .18em; }',
'  .pp-top-bar-tabs a::before { content: "//"; margin-right: 8px; color: @railLine@; }',
'  .pp-top-bar-tabs a:hover { color: @a@; }',
'  /* The query line: a label, a rule to type on, the shortcut as a stamp. */',
'  .profile-top-bar-search-wrapper { justify-self: start; width: min(420px, 100%) !important; margin-left: 44px; }',
'  .profile-top-bar-search-wrapper::before { content: "Query"; flex: 0 0 auto; margin-right: 12px; color: @mute@; font-family: @MONO@; font-size: 9px; letter-spacing: .18em; text-transform: uppercase; }',
'  .pp-top-bar-search-box { flex: 1 1 auto; min-width: 0; width: auto !important; }',
'  .pp-top-bar-search-input { height: 28px !important; border: 0 !important; border-bottom: 1px solid @ink@66 !important; background: transparent !important; color: @ink@ !important; transition: border-color .2s ease; }',
'  .pp-top-bar-search-input:hover, .pp-top-bar-search-input:focus-within { border-color: @ink@ !important; box-shadow: inset 0 -2px 0 @a@ !important; }',
'  .pp-top-bar-search-input-group, .pp-top-bar-search-icon, .pp-top-bar-search-right { height: 28px !important; }',
'  .pp-top-bar-search-icon { width: 24px !important; color: @ink@ !important; }',
'  .pp-top-bar-search-icon svg { width: 14px !important; height: 14px !important; color: @ink@ !important; }',
'  .pp-top-bar-search-input { padding-left: 26px !important; }',
'  #search-input { height: 26px !important; color: @ink@ !important; font-size: 11px !important; letter-spacing: .08em; text-transform: uppercase; }',
'  #search-input::placeholder { color: @mute@ !important; }',
'  .pp-top-bar-search-shortcut { height: 16px !important; background: @ink@ !important; color: @bg@ !important; font-family: @MONO@; font-size: 8px !important; letter-spacing: .08em; text-transform: uppercase; }',
'  /* The controls: an outline, ink on hover. The yellow is kept for the screens. */',
'  .pp-top-bar-right { height: 44px !important; padding-right: 30px; }',
'  .pp-top-bar-right > div { gap: 6px !important; }',
'  .pp-top-bar-create-char { height: 26px !important; padding: 0 12px !important; border: 1px solid @ink@ !important; background: transparent !important; color: @ink@ !important; font-size: 10px !important; font-weight: 400; letter-spacing: .16em; transition: background .18s ease, color .18s ease; }',
'  .pp-top-bar-create-char span { color: inherit !important; font-family: @MONO@ !important; font-size: 10px !important; line-height: 1 !important; }',
'  .pp-top-bar-create-char span::before { content: "+ "; }',
'  .pp-top-bar-create-char:hover { background: @ink@ !important; color: @bg@ !important; filter: none; }',
'  .pp-top-bar-notifications { display: flex !important; align-items: center; width: 26px !important; height: 26px !important; }',
'  .pp-top-bar-notifications-button { box-sizing: border-box; width: 26px !important; height: 26px !important; min-width: 0 !important; min-height: 0 !important; max-height: 26px !important; padding: 4px !important; border: 1px solid @ink@ !important; border-radius: 0 !important; background: transparent !important; color: @ink@ !important; transition: background .18s ease, color .18s ease; }',
'  .pp-top-bar-notifications-button svg { width: 14px !important; height: 14px !important; color: inherit !important; }',
'  .pp-top-bar-notifications-button:hover { background: @ink@ !important; color: @bg@ !important; }',
'  .pp-top-bar-app-menu { width: 26px !important; height: 26px !important; min-width: 0 !important; overflow: hidden; border-radius: 0 !important; outline: 1px solid @ink@; clip-path: polygon(0 0, 100% 0, 100% 72%, 72% 100%, 0 100%); }',
'  .pp-top-bar-app-menu span, .pp-top-bar-app-menu div, .pp-top-bar-app-menu img { width: 26px !important; height: 26px !important; border-radius: 0 !important; }',
'}',
'.pp-top-bar-app-menu-list, .pp-top-bar-notifications-popover { overflow: hidden; border: 1px solid @railLine@ !important; border-radius: 0 !important; background: @rail@ !important; box-shadow: 8px 8px 0 @a@ !important; color: @railInk@ !important; }',
'.pp-top-bar-app-menu-list-item { background: transparent !important; color: @railInk@ !important; }',
'.pp-top-bar-app-menu-list-item:hover { background: @railInk@1a !important; }',
'.pp-mnb-wrapper { border-top: 2px solid @a@; border-radius: 0; background: @rail@ !important; box-shadow: none !important; }',
'.pp-mnb-container svg { color: @railInk@ !important; }',
'',
'@keyframes fp-gleam { 0%, 55% { background-position: 130% 0; } 100% { background-position: -40% 0; } }',
'@keyframes fp-fx-back { 0% { opacity: 0; } 8% { opacity: 1; } 72% { opacity: 1; } 86%, 100% { opacity: 0; visibility: hidden; } }',
'@keyframes fp-fx-floor { 0% { opacity: 0; background-position: 0 0; } 12% { opacity: 1; } 66% { opacity: 1; } 76%, 100% { opacity: 0; background-position: 0 700px; visibility: hidden; } }',
'@keyframes fp-fx-shut { 0% { transform: scaleY(0); } 9% { transform: scaleY(1); } 16% { transform: scaleY(.34); } 68% { transform: scaleY(.34); } 80%, 100% { transform: scaleY(0); visibility: hidden; } }',
'@keyframes fp-fx-ring { 0% { opacity: 0; transform: scale(3) rotate(0); } 30% { opacity: 1; transform: scale(1) rotate(90deg); } 78% { opacity: 1; transform: scale(.9) rotate(225deg); } 100% { opacity: 0; transform: scale(0) rotate(360deg); } }',
'@keyframes fp-fx-ring-b { 0% { opacity: 0; transform: scale(3) rotate(45deg); } 30% { opacity: 1; transform: scale(1) rotate(-45deg); } 78% { opacity: 1; transform: scale(.9) rotate(-180deg); } 100% { opacity: 0; transform: scale(0) rotate(-315deg); } }',
'@keyframes fp-fx-cross { 0% { opacity: 0; transform: scale(.2) rotate(-45deg); } 30% { opacity: .9; transform: scale(1) rotate(0); } 80% { opacity: .9; transform: scale(1) rotate(0); } 100% { opacity: 0; transform: scale(1.6) rotate(45deg); } }',
'@keyframes fp-fx-beam { 0% { opacity: 0; transform: translateY(-100%); } 15% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(460%); } }',
'@keyframes fp-fx-read { 0%, 10% { opacity: 0; transform: scale(.9); } 20% { opacity: 1; transform: scale(1); } 86% { opacity: 1; transform: scale(1); } 94%, 100% { opacity: 0; transform: scale(1.3); visibility: hidden; } }',
'@keyframes fp-fx-roll { from { transform: translateY(0); } to { transform: translateY(-176px); } }',
'@keyframes fp-fx-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }',
'@keyframes fp-fx-slab { 0% { transform: translateX(-140%) skewX(-18deg); } 100% { transform: translateX(340%) skewX(-18deg); } }',
'@keyframes fp-fx-slab-b { 0% { transform: translateX(-500%) skewX(-18deg); } 100% { transform: translateX(1100%) skewX(-18deg); } }',
'@keyframes fp-fx-burst { 0% { opacity: 0; transform: rotate(0) scale(.2); } 18% { opacity: 1; transform: rotate(20deg) scale(1); } 100% { opacity: 0; transform: rotate(70deg) scale(1); visibility: hidden; } }',
'@keyframes fp-star { from { opacity: 0; transform: scale(0) rotate(-90deg); } to { opacity: 1; transform: scale(1) rotate(0); } }',
'@keyframes fp-swing { 0%, 100% { transform: rotate(4deg); } 50% { transform: rotate(-2deg); } }',
'@keyframes fp-fx-stamp { 0% { opacity: 0; transform: rotate(-7deg) scale(3); } 100% { opacity: 1; transform: rotate(-7deg) scale(1); } }',
'@keyframes fp-unveil { 0% { filter: brightness(0) contrast(1.4); transform: scale(1.14); } 45% { filter: brightness(0) contrast(1.4); } 100% { filter: brightness(1) contrast(1); transform: scale(1); } }',
'@keyframes fp-stamp-in { 0% { opacity: 0; letter-spacing: .4em; transform: translateX(40px); } 100% { opacity: 1; letter-spacing: .01em; transform: translateX(0); } }',
'@keyframes fp-spin { to { transform: rotate(360deg); } }',
'@keyframes fp-blink { 0% { opacity: 1; } 100% { opacity: .2; } }',
'@keyframes fp-ping { 0% { box-shadow: 0 0 0 0 @a@cc; } 80%, 100% { box-shadow: 0 0 0 9px @a@00; } }',
'@keyframes fp-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }',
'@keyframes fp-wipe { 0% { transform: scaleX(0); transform-origin: 0 50%; } 45% { transform: scaleX(1); transform-origin: 0 50%; } 55% { transform: scaleX(1); transform-origin: 100% 50%; } 100% { transform: scaleX(0); transform-origin: 100% 50%; } }',
'@keyframes fp-slide-in { from { opacity: 0; transform: translateX(-12%); } to { opacity: 1; transform: translateX(0); } }',
'@keyframes fp-squad-in { from { opacity: 0; transform: translateX(-12%) skewX(-9deg); } to { opacity: 1; transform: translateX(0) skewX(-9deg); } }',
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
'  .profile-info-stack:has(#fp-roster:target, .fp-key-op:target, .fp-key-tag:target) .fp-nav-roster::before,',
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
'  .fp-screen-roster, .fp-screen-recruit, .fp-screen-dossier, .fp-screen-network, .fp-screen-log { padding: 24px 16px 52px; overflow: visible; }',
'  .profile-info-stack .fp-screen-recruit { position: absolute; inset: 0 0 auto 0; height: 0; padding: 0; overflow: hidden; }',
'  .profile-info-stack:has(.fp-key-pool:target) .fp-screen-recruit { position: relative; height: auto; padding: 24px 16px 52px; overflow: visible; }',
'  .fp-recruit { grid-template-columns: minmax(0, 1fr); gap: 24px; }',
'  .fp-gates { grid-row: 1; min-height: 320px; }',
'  /* On a phone the interface is taller than the screen, so the draw is',
'   * pinned to the screen rather than laid over the interface. */',
'  .fp-fx { position: fixed; z-index: 99999; }',
'  .fp-fx-ring { width: 240px; height: 240px; margin: -120px 0 0 -120px; }',
'  .fp-fx-ring-b { width: 170px; height: 170px; margin: -85px 0 0 -85px; }',
'  .fp-fx-ring-c { width: 320px; height: 320px; margin: -160px 0 0 -160px; }',
'  .fp-fx-cross { width: 360px; height: 360px; margin: -180px 0 0 -180px; }',
'  .fp-fx-slab { left: -90%; width: 70%; }',
'  .fp-fx-stamp { display: none; }',
'  .fp-pullbar { position: fixed; top: auto; right: 12px; bottom: 76px; left: auto; z-index: 99998; }',
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
'  /* Nothing is pointed at on a phone: the briefing is left out. */',
'  .fp-roster-wrap { display: block; }',
'  .fp-intel { display: none; }',
'  .fp-filters { margin: 0 0 16px; }',
'  .fp-file-plate { right: 0; bottom: auto; width: auto; height: 348px; clip-path: polygon(0 0, 100% 0, 100% 86%, 0 100%); }',
'  .fp-file-art { position: relative; width: auto; height: 330px; clip-path: polygon(0 0, 100% 0, 100% 86%, 0 100%); }',
'  .fp-file-squad .fp-squad { position: relative; width: 100%; height: 330px; gap: 4px; }',
'  .fp-mem:first-child { flex-basis: 46px; margin-left: -30px; }',
'  .fp-mem:first-child .fp-mem-img { left: -25px; }',
'  .fp-mem:first-child .fp-mem-cap { padding-left: 70px; }',
'  .fp-file-squad .fp-file-info .fp-actions { padding-right: 0; }',
'  .fp-file-squad .fp-file-plate { left: 0; width: auto; clip-path: polygon(0 0, 100% 0, 100% 86%, 0 100%); transform: none; animation-name: fp-slide-in; }',
'  .fp-file-squad .fp-file-info { left: auto; }',
'  .fp-mem-img { left: -40px; width: calc(100% + 80px); }',
'  .fp-mem-cap { padding: 0 6px 12px 14px; }',
'  .fp-mem-cap b { font-size: 12px; }',
'  .fp-mem-cap span { display: none; }',
'  .fp-file-info { position: relative; left: auto; padding: 18px 16px 30px; overflow: visible; }',
'  .fp-file-shade { background: linear-gradient(180deg, @bg@66 0%, @bg@f2 46%, @bg@ 100%); }',
'  .fp-file-no { display: none; }',
'  .fp-file-tag { position: relative; right: auto; bottom: auto; width: 120px; margin: 0 0 30px 16px; }',
'  .fp-card-chibi { display: none; }',
'  .fp-dossier { grid-template-columns: minmax(0, 1fr); gap: 26px; }',
'  .fp-idcard { max-width: 300px; }',
'  .fp-gallery { grid-template-columns: minmax(0, 1fr); }',
'  .fp-link { grid-template-columns: 30px minmax(0, 1fr) 26px; }',
'  .fp-link span { display: none; }',
'  .fp-link b { font-size: 21px; }',
'}',
'',
'/* Nothing hovers on a touch screen: no tile is left lifted under a finger. */',
'@media (hover: none) {',
'  .fp-card:hover, .fp-ally:hover, .fp-asset:hover { box-shadow: none; transform: none; }',
'  .fp-pick-go { display: none !important; }',
'  /* A member\'s title is always out where nothing can be pointed at. */',
'  .fp-mem-cap em { max-height: none; margin-top: 4px; opacity: 1; }',
'}',
'',
'@media (prefers-reduced-motion: reduce) {',
'  .fp-boot, .fp-wipe { display: none !important; }',
'  .profile-info-stack .fp-screen-recruit .fp-head, .profile-info-stack .fp-screen-recruit .fp-recruit-side, .profile-info-stack .fp-screen-recruit .fp-gates { animation: none !important; }',
'  .fp-fx > i, .fp-fx-read { display: none !important; }',
'  .fp-fx-stamp, .fp-fx-stars i, .fp-file-stars i, .fp-file-tag, .fp-mascot, .fp-card.fp-r6 .fp-card-art::before, .fp-draw::before, .fp-gate-ring, .fp-gates, .fp-recruit-side, .fp-pullbar { animation: none !important; }',
'  .profile-info-stack:has(.fp-key-pull:target) .fp-file *, .profile-info-stack:has(.fp-key-pull:target) .fp-file-img, .profile-info-stack:has(.fp-key-pull:target) .fp-file-name { animation: none !important; }',
'  .fp-emblem-mark i, .pp-uc-followers-count::before, .fp-hud, .fp-hud-live i, .fp-head, .fp-card, .fp-card:hover .fp-card-art::after, .fp-file-scene, .fp-file-plate, .fp-file-art, .fp-file-top, .fp-file-name, .fp-file-line, .fp-quote, .fp-file-desc, .fp-file-info .fp-chips, .fp-stats, .fp-file-info .fp-actions, .fp-idcard, .fp-about, .fp-links, .fp-allies, .fp-log, .fp-ticker-run, .fp-filters, .fp-intel, .fp-squad, .fp-gallery { animation: none; }',
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
      a: a, onA: onAccent(a), fxMid: '#1b1d24', fxEdge: '#050608', HEAD: HEAD, MONO: MONO, BODY: BODY,
      rank6: RANK_COLOURS[6], rank5: RANK_COLOURS[5], rank4: RANK_COLOURS[4], rank3: RANK_COLOURS[3]
    };
    var lines = SHEET.concat(o.fpNative === true || o.fpNative === 'true' ? NATIVE_ON : NATIVE_OFF);
    return lines.join('\n').replace(/@([A-Za-z0-9]+)@/g, function (all, key) {
      return tokens[key] != null ? tokens[key] : all;
    }).trim() + '\n';
  }

  global.JaiFrontier = {
    themes: THEMES,
    theme: theme,
    roster: roster,
    slides: slides,
    pools: pools,
    ranks: ranks,
    squad: squad,
    filters: filters,
    markup: markup,
    css: css,
    style: style
  };
})(window);
