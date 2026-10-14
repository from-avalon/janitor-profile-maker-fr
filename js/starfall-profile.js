/*
 * The "Gacha" design: Starfall's words and pictures, written from Profile data.
 *
 * Starfall is a template (templates/starfall): a wish screen whose banner,
 * wish results and three tabbed screens ship with placeholder copy. This
 * writes those parts from Profile information instead: the banner's title,
 * lines and featured names, a wish result for each featured character (the
 * picture in the frame, the name, a line, Chat now), the ten-card spread from
 * the roster, the Traveler screen from About me and the social links, the
 * Details screen from the creator notes and extra sections, and the Party
 * screen from the friends.
 *
 * Like js/photo-feed-profile.js it is not a design of its own: the studio
 * hands these to the template part as it is added (`materialiseTemplatePart`
 * in js/app.js). Whatever Profile data has nothing to say about keeps the
 * template's own placeholder.
 *
 * The banner part and the wish-results part have to agree: Wish ×1 holds one
 * link per result (`sf-cycle-N`, links to #sf-pull-1…N) and the results part
 * holds the N screens they open. Both read `pulls()` so they always do. The
 * template's stylesheet goes up to five.
 */
(function (global) {
  'use strict';

  var MAX_PULLS = 5;
  var SIGILS = ['✦', '☾', '❖', '✿', '❄', '✧', '♆'];

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function attr(value) { return esc(value).replace(/"/g, '&quot;'); }

  function multiline(value) { return esc(value).replace(/\r?\n/g, '<br>'); }

  function usable(src) { return global.JaiHardcode.usable(src); }

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

  function username(o) {
    return String((o.identity && o.identity.username) || '').trim().replace(/^@/, '');
  }

  /* One line about a character, whichever the creator has filled in. */
  function lineOf(c) { return c.tagline || c.quote || c.description || ''; }

  /* What Wish ×1 can land on: the featured characters, or the first few of
   * the roster when none is featured. */
  function pulls(files) {
    var featured = files.filter(function (f) { return f.featured; });
    return (featured.length ? featured : files).slice(0, MAX_PULLS);
  }

  function frame(src, alt, sigil) {
    return usable(src) ? '<img src="' + attr(src) + '" alt="' + attr(alt) + '">'
      : '<span class="sf-art-sigil">' + sigil + '</span>';
  }

  // ------------------------------------------------- banner and Wish buttons

  function banner(files, o, fallback) {
    var stars = pulls(files);
    var title = written(o, 'gachaTitle');
    var text = written(o, 'aboutBody');
    var picture = usable(o.gachaArt) ? o.gachaArt : (stars[0] && usable(stars[0].art) ? stars[0].art : '');
    if (!stars.length && !title && !text && !picture) return fallback || '';
    var name = username(o);

    var html = '<section class="sf-banner"><div class="sf-banner-copy">' +
      '<div class="sf-kicker"><i></i>Character Event · Limited</div>' +
      '<h2 class="sf-title">' + (title ? multiline(title) : name ? esc(name) + '’s<br>Falling Stars' : 'Ballad of the<br>Falling Stars') + '</h2>' +
      '<p class="sf-lede">' + (text ? multiline(text)
        : 'Two or three lines about what you write. Slow burns, soft monsters and plots that got out of hand; a new bot every other Friday.') + '</p>';
    if (stars.length) {
      html += '<div class="sf-rateup"><div class="sf-rate-label">Probability increased</div><div class="sf-rate-list">' +
        stars.map(function (c, i) {
          return '<span class="sf-rate' + (i === 0 ? ' sf-rate-5' : '') + '"><b>' + (i === 0 ? '★★★★★' : '★★★★') + '</b>' + esc(c.name) + '</span>';
        }).join('') + '</div></div>';
    }
    html += '<div class="sf-timer"><i></i>This banner never ends' +
      (files.length ? ' · ' + files.length + ' characters in the archive' : '') + '</div></div>' +
      '<div class="sf-banner-art"><i class="sf-art-glow"></i><i class="sf-art-ring"></i><i class="sf-art-ring sf-art-ring-b"></i>' +
      '<div class="sf-art-frame">' + frame(picture, '', '✦') + '</div>' +
      '<i class="sf-art-spark sf-art-spark-a"></i><i class="sf-art-spark sf-art-spark-b"></i><i class="sf-art-spark sf-art-spark-c"></i></div></section>';

    // With no character to land on, the buttons keep the template's three.
    var count = stars.length || 3;
    var links = '';
    for (var i = 1; i <= count; i++) links += '<a href="#sf-pull-' + i + '" aria-label="Wish once"></a>';
    html += '<div class="sf-wishbar"><div class="sf-fate"><i></i><span>Star tickets</span><b>∞</b></div>' +
      '<span class="sf-wish sf-wish-1 sf-cycle-' + count + '">' + links +
      '<span class="sf-wish-label">Wish ×1</span><span class="sf-wish-cost"><i></i>×160</span></span>' +
      '<span class="sf-wish sf-wish-10"><a href="#sf-pull-10" aria-label="Wish ten times"></a>' +
      '<span class="sf-wish-label">Wish ×10</span><span class="sf-wish-cost"><i></i>×1600</span></span></div>';
    return html;
  }

  // ------------------------------------------------------------ wish results

  function results(files, o, fallback) {
    var stars = pulls(files);
    if (!stars.length) return fallback || '';
    var html = '';
    for (var k = 1; k <= stars.length; k++) html += '<span class="sf-key sf-key-pull" id="sf-pull-' + k + '"></span>';
    html += '<span class="sf-key sf-key-pull" id="sf-pull-10"></span>';

    stars.forEach(function (c, i) {
      var line = lineOf(c);
      html += '<div class="sf-pull sf-pull-' + (i + 1) + '"><i class="sf-pull-sky"></i><i class="sf-meteor"></i><i class="sf-flash"></i>' +
        '<a class="sf-pull-close" href="#sf-home">Close ✕</a><div class="sf-result"><i class="sf-result-rays"></i>' +
        '<div class="sf-result-art">' + frame(c.art, c.name, SIGILS[i % SIGILS.length]) + '</div>' +
        '<div class="sf-result-info"><div class="sf-result-tag">' + (c.chats ? esc(c.chats) + ' chats · ' : 'New · ') + '5-star character</div>' +
        '<h3>' + esc(c.name) + '</h3>' +
        '<div class="sf-result-stars"><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i></div>' +
        (line ? '<p>' + esc(line) + '</p>' : '') +
        '<div class="sf-result-actions">' +
        (usable(c.link) ? '<a class="sf-btn sf-btn-gold" href="' + attr(c.link) + '">Chat now</a>' : '') +
        '<a class="sf-btn" href="#sf-home">Wish again</a></div></div></div></div>';
    });

    // The spread: the roster's first ten, the featured ones leading.
    var spread = files.filter(function (f) { return f.featured; })
      .concat(files.filter(function (f) { return !f.featured; })).slice(0, 10);
    html += '<div class="sf-pull sf-pull-10"><i class="sf-pull-sky"></i><i class="sf-meteor"></i><i class="sf-meteor sf-meteor-b"></i>' +
      '<i class="sf-meteor sf-meteor-c"></i><i class="sf-flash"></i><a class="sf-pull-close" href="#sf-home">Close ✕</a>' +
      '<div class="sf-ten"><div class="sf-ten-head">Wish results</div><div class="sf-ten-grid">' +
      spread.map(function (c, i) {
        // Gold on every third card, as the stylesheet paints them.
        return '<a class="sf-ten-card"' + (usable(c.link) ? ' href="' + attr(c.link) + '"' : '') + '>' +
          (usable(c.portrait) ? '<img src="' + attr(c.portrait) + '" alt="">' : '<span class="sf-ten-art">' + SIGILS[i % SIGILS.length] + '</span>') +
          '<b>' + (i % 3 === 0 ? '★★★★★' : '★★★★') + '</b><span class="sf-ten-name">' + esc(c.name) + '</span></a>';
      }).join('') + '</div></div></div>';
    return html;
  }

  // ---------------------------------------------------------------- screens

  function head(title, note) {
    return '<div class="sf-panel-head"><i></i><h3>' + title + '</h3><span>' + note + '</span></div>';
  }

  function traveler(files, o, fallback) {
    var text = written(o, 'aboutBody');
    var signature = written(o, 'aboutTitle');
    var links = (o.socials || []).filter(function (s) { return s && usable(s.link); });
    if (!text && !signature && !links.length && !files.length) return fallback || '';

    var count = (o.identity && o.identity.characterCount) || (files.length ? String(files.length) : '12');
    var chats = files.reduce(function (sum, f) { return sum + number(f.chats); }, 0);
    var featured = files.filter(function (f) { return f.featured; }).length;

    return '<section class="sf-panel sf-panel-traveler">' + head('Traveler Profile', 'Signature &amp; waypoints') +
      '<div class="sf-traveler-grid"><div class="sf-card sf-about"><div class="sf-card-label">About</div><p>' +
      (text ? multiline(text) : 'A few sentences about you. What you write, how often you post, and what a visitor should expect from your bots.') + '</p>' +
      (signature ? '<div class="sf-signature">“' + esc(signature) + '”</div>' : '') + '</div>' +
      '<div class="sf-stats"><div class="sf-stat"><b>' + esc(count) + '</b><span>Characters</span></div>' +
      '<div class="sf-stat"><b>' + (chats ? compact(chats) : '✦') + '</b><span>' + (chats ? 'Chats' : 'New here') + '</span></div>' +
      '<div class="sf-stat"><b>' + (featured || '✦') + '</b><span>' + (featured ? 'Five-stars' : 'Requests open') + '</span></div></div>' +
      '<div class="sf-card sf-waypoints"><div class="sf-card-label">Waypoints</div><div class="sf-way-list">' +
      (links.length ? links.map(function (s) {
        return '<a href="' + attr(s.link) + '"><i></i>' + esc(s.label || siteName(s.link)) + '</a>';
      }).join('') : '<a href="#"><i></i>Discord</a><a href="#"><i></i>Ko-fi</a><a href="#"><i></i>Carrd</a>') +
      '</div></div></div></section>';
  }

  function details(files, o, fallback) {
    var list = [];
    var notes = written(o, 'creatorNotes');
    if (notes) list.push({ title: 'Creator notes', body: notes });
    (o.sections || []).forEach(function (s) {
      if (s && (s.title || s.body)) list.push({ title: s.title || 'More', body: s.body });
    });
    if (!list.length) return fallback || '';
    return '<section class="sf-panel sf-panel-details">' + head('Wish Details', 'The fine print') +
      '<div class="sf-detail-list">' + list.map(function (item, i) {
        return '<details class="sf-detail"' + (i === 0 ? ' open' : '') + '><summary><b>' + (i === 0 ? '★★★★★' : '★★★★') + '</b>' +
          esc(item.title) + '</summary>' + (item.body ? '<p>' + multiline(item.body) + '</p>' : '') + '</details>';
      }).join('') + '</div></section>';
  }

  function party(files, o, fallback) {
    var people = (o.friends || []).filter(function (f) { return f && String(f.name || '').trim(); });
    if (!people.length) return fallback || '';
    return '<section class="sf-panel sf-panel-party">' + head(esc(written(o, 'friendsTitle') || 'Party Setup'), 'Creators worth following') +
      '<div class="sf-party">' + people.map(function (f) {
        var name = String(f.name).trim().replace(/^@/, '');
        var note = String(f.note || '').trim();
        return '<a class="sf-mate"' + (usable(f.link) ? ' href="' + attr(f.link) + '"' : '') + '><span class="sf-mate-face">' +
          (usable(f.image) ? '<img src="' + attr(f.image) + '" alt="">' : initial(name)) + '</span><b>' + esc(name) + '</b>' +
          (note ? '<span class="sf-mate-note">' + esc(note) + '</span>' : '') + '</a>';
      }).join('') + '</div></section>';
  }

  global.JaiStarfall = {
    template: 'starfall',
    // Which of the template's parts are written here, by the key of each.
    parts: { banner: banner, pulls: results, traveler: traveler, details: details, party: party },
    pulls: pulls
  };
})(window);
