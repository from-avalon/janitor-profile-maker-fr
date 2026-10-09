/*
 * The "Instagram-style" design: Golden Hour's words, written from Profile data.
 *
 * Golden Hour is a template (templates/golden-hour): parts with a stylesheet
 * each, and placeholder copy in the two that carry markup worth personalising
 * — the stats-and-bio part and the highlights-and-stories part. This writes
 * the markup of those two from Profile information instead: counts from the
 * roster, the bio from About me, a story for each section, link stickers from
 * the social links, mentions from the friends, and — when the creator has
 * featured some — a story for each featured character.
 *
 * It is not a design of its own. The studio hands these to the template part
 * as it is added (see `materialiseTemplatePart` in js/app.js), so Golden Hour
 * added from Insert and "Instagram-style" chosen in Profile data are the same
 * nine parts, and everything else about them — the look, Remove, the order —
 * is the template's.
 *
 * Whatever Profile data has nothing to say about keeps the template's own
 * placeholder, so a page built from an empty Profile data is the template as
 * it ships, and never a page with pieces missing.
 */
(function (global) {
  'use strict';

  // A story's backdrop and its highlight's symbol, in the order stories come.
  var MOODS = ['dusk', 'night', 'ember', 'tide', 'rose'];
  var MARKS = ['✦', '☾', '✎', '↗', '♡', '✧', '❖'];

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

  function tagLabel(tag) { return global.JaiTags ? global.JaiTags.label(tag) : String(tag); }

  // ------------------------------------------------------------ stats and bio

  function bio(files, o) {
    var identity = o.identity || {};
    var html = [];

    var count = identity.characterCount || (files.length ? String(files.length) : '12');
    var chats = files.reduce(function (sum, f) { return sum + number(f.chats); }, 0);
    html.push('<div class="gh-stat gh-stat-posts"><b>' + esc(count) + '</b><span>bots</span></div>');
    html.push('<div class="gh-stat gh-stat-extra"><b>' + (chats ? compact(chats) : '48.2k') + '</b><span>chats</span></div>');

    var text = written(o, 'aboutBody');
    var link = (o.socials || []).filter(function (s) { return s && usable(s.link); })[0];
    var friends = (o.friends || []).filter(function (f) { return f && f.name; });

    html.push('<div class="gh-bio"><div class="gh-bio-name">' +
      esc(o.feedName || identity.username || 'Your display name') + '</div>');
    if (o.feedCategory) html.push('<div class="gh-bio-cat">' + esc(o.feedCategory) + '</div>');
    html.push('<p>' + (text ? multiline(text)
      : 'slow burns, soft monsters &amp; plots that got out of hand 🌙<br>new bot every other friday · requests open<br>she/they · 21+ · en/es') + '</p>');
    html.push(link
      ? '<a class="gh-bio-link" href="' + attr(link.link) + '"><i>🔗</i>' + esc(link.label || siteName(link.link)) + '</a>'
      : '<a class="gh-bio-link" href="#"><i>🔗</i>your.link/here</a>');
    if (friends.length) {
      var shown = friends.slice(0, 3);
      html.push('<div class="gh-mutuals"><div class="gh-mutual-faces">' + shown.map(function (f) {
        return '<i>' + esc(String(f.name).trim().charAt(0).toUpperCase()) + '</i>';
      }).join('') + '</div><div>Friends with ' + shown.map(function (f) {
        return '<b>' + esc(f.name) + '</b>';
      }).join(', ') + (friends.length > shown.length ? ' + ' + (friends.length - shown.length) + ' more' : '') + '</div></div>');
    } else {
      html.push('<div class="gh-mutuals"><div class="gh-mutual-faces"><i>A</i><i>K</i><i>M</i></div>' +
        '<div>Friends with <b>ashfall</b>, <b>kittenteeth</b> + <b>moth.exe</b></div></div>');
    }
    html.push('</div>');
    return html.join('');
  }

  // ------------------------------------------------------ highlights, stories

  /* What each highlight opens: the featured characters first, as the stories
   * a visitor is most likely to tap, then what the creator has written. */
  function stories(files, o) {
    var out = [];
    if (o.feedStories !== false) {
      files.filter(function (f) { return f.featured; }).forEach(function (f) {
        out.push({ character: f, name: f.name });
      });
    }
    var notes = written(o, 'creatorNotes');
    var heading = written(o, 'aboutTitle');
    if (notes || heading) {
      out.push({ name: 'About', tag: 'About me', title: heading || 'A little about me', text: notes });
    }
    (o.sections || []).forEach(function (s) {
      if (s && (s.title || s.body)) {
        out.push({ name: s.title || 'More', tag: 'Read this', title: s.title || 'More', text: s.body });
      }
    });
    var socials = (o.socials || []).filter(function (s) { return s && usable(s.link); });
    if (socials.length) {
      out.push({ name: 'Links', tag: 'Find me elsewhere', title: 'Tap a sticker.', stickers: socials });
    }
    var friends = (o.friends || []).filter(function (f) { return f && f.name; });
    if (friends.length) {
      out.push({ name: 'Friends', tag: 'Go follow them', title: written(o, 'friendsTitle') || 'People worth following', mentions: friends });
    }
    return out;
  }

  function storyBody(story) {
    var c = story.character;
    if (c) {
      // A character's story is their picture, full height, with the words at
      // the bottom over a shade — the way a photo story reads.
      var line = c.tagline || c.quote || c.description;
      return (usable(c.art) ? '<img class="gh-story-art" src="' + attr(c.art) + '" alt="' + attr(c.name) + '">' : '') +
        '<div class="gh-story-body">' +
        '<h2>' + esc(c.name) + '</h2>' +
        (line ? '<p>' + esc(line) + '</p>' : '') +
        (c.tags.length ? '<div class="gh-story-chips">' + c.tags.slice(0, 4).map(function (tag) {
          return '<span>' + esc(tagLabel(tag)) + '</span>';
        }).join('') + '</div>' : '') +
        (c.link ? '<div class="gh-story-stickers"><a href="' + attr(c.link) + '"><i>🔗</i>CHAT NOW</a></div>' : '') +
        '</div>';
    }
    var html = '<div class="gh-story-body"><div class="gh-story-tag">' + esc(String(story.tag).toUpperCase()) + '</div>' +
      '<h2>' + esc(story.title) + '</h2>';
    if (story.text) html += '<p>' + multiline(story.text) + '</p>';
    if (story.stickers) {
      html += '<div class="gh-story-stickers">' + story.stickers.map(function (s) {
        return '<a href="' + attr(s.link) + '"><i>🔗</i>' + esc(String(s.label || siteName(s.link)).toUpperCase()) + '</a>';
      }).join('') + '</div>';
    }
    if (story.mentions) {
      html += '<div class="gh-story-mentions">' + story.mentions.map(function (f) {
        return '<a' + (usable(f.link) ? ' href="' + attr(f.link) + '"' : '') + '>@' + esc(f.name) + '</a>';
      }).join('') + '</div>';
    }
    return html + '</div>';
  }

  /* `fallback` is the template's own highlights, used as they are while
   * Profile data has no story to tell. */
  function highlights(files, o, fallback) {
    var identity = o.identity || {};
    var username = identity.username || 'yourname';
    var list = stories(files, o);
    if (!list.length) return fallback || '';
    var html = [];

    html.push('<div class="gh-anchor" id="gh-feed"></div><nav class="gh-highlights" aria-label="Highlights">');
    list.forEach(function (story, i) {
      var c = story.character;
      var cover = c && usable(c.portrait)
        ? '<img src="' + attr(c.portrait) + '" alt="">' : MARKS[i % MARKS.length];
      html.push('<a class="gh-hl' + (c ? ' gh-hl-live' : '') + '" href="#gh-s' + (i + 1) + '"><span class="gh-hl-ring"><span class="gh-hl-cover">' +
        cover + '</span></span><span class="gh-hl-name">' + esc(story.name) + '</span></a>');
    });
    html.push('</nav>');

    list.forEach(function (story, i) {
      var c = story.character;
      var step = function (to, glyph, label) {
        return to >= 0 && to < list.length
          ? '<a class="gh-story-step" href="#gh-s' + (to + 1) + '" aria-label="' + label + '">' + glyph + '</a>'
          : '<span class="gh-story-step gh-story-step-off">' + glyph + '</span>';
      };
      var face = c && usable(c.portrait) ? '<img src="' + attr(c.portrait) + '" alt="">' : MARKS[i % MARKS.length];
      html.push('<div class="gh-story gh-story-' + MOODS[i % MOODS.length] + (c ? ' gh-story-char' : '') + '" id="gh-s' + (i + 1) + '">' +
        '<a class="gh-story-shade" href="#gh-feed" aria-label="Close"><span>✕</span></a>' +
        step(i - 1, '‹', 'Previous story') +
        '<div class="gh-story-card"><div class="gh-story-bars">' + list.map(function (unused, j) {
          return j < i ? '<i class="gh-done"></i>' : j === i ? '<i class="gh-now"></i>' : '<i></i>';
        }).join('') + '</div>' +
        '<div class="gh-story-head"><span class="gh-story-face">' + face + '</span><b>' +
        esc(username) + '</b><span>' + esc(c ? (c.chats ? c.chats + ' chats' : 'Featured') : story.name) + '</span></div>' +
        storyBody(story) +
        '<div class="gh-story-reply"><span>Reply to ' + esc(username) + '…</span><i>♡</i><i>➤</i></div></div>' +
        step(i + 1, '›', 'Next story') + '</div>');
    });
    return html.join('');
  }

  global.JaiPhotoFeed = {
    template: 'golden-hour',
    // Which of the template's parts are written here, by the key of each.
    parts: { bio: bio, highlights: highlights },
    stories: stories
  };
})(window);
