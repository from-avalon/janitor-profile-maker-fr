/*
 * The "Photo feed" design: Golden Hour, written from Profile data.
 *
 * Golden Hour ships as a template (templates/golden-hour) whose markup is
 * placeholder copy to be retyped on the canvas. This is the same page with the
 * copy filled in from Profile information instead — the counts from the
 * roster, the bio from About me, a story for each section, link stickers from
 * the social links, mentions from the friends — so it can be chosen in Profile
 * data like any other design and kept up to date from there.
 *
 * The look is not repeated here: the stylesheet is the template's own, read
 * out of the built registry (js/templates.js), so the two cannot drift apart.
 * Only the markup is generated.
 */
(function (global) {
  'use strict';

  var TEMPLATE = 'golden-hour';
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

  /* What each highlight opens. A highlight only exists if there is something
   * to put in its story, so an empty Profile data gives a page with none. */
  function stories(o) {
    var defaults = global.JaiHardcode.defaults;
    var out = [];
    var notes = o.creatorNotes && o.creatorNotes !== defaults.creatorNotes ? o.creatorNotes : '';
    var heading = o.aboutTitle && o.aboutTitle !== defaults.aboutTitle ? o.aboutTitle : '';
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
      var friendsTitle = o.friendsTitle && o.friendsTitle !== defaults.friendsTitle ? o.friendsTitle : 'People worth following';
      out.push({ name: 'Friends', tag: 'Go follow them', title: friendsTitle, mentions: friends });
    }
    return out;
  }

  function storyBody(story) {
    var html = '<div class="gh-story-tag">' + esc(String(story.tag).toUpperCase()) + '</div>' +
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
    return html;
  }

  // ----------------------------------------------------------------- markup

  /* One line, as every generated block is: a newline between two inline-level
   * tags renders as a space. */
  function markup(files, o) {
    var identity = o.identity || {};
    var defaults = global.JaiHardcode.defaults;
    var username = identity.username || 'yourname';
    var html = [];

    html.push('<div class="gh-splash" aria-hidden="true"><div class="gh-splash-mark"><i></i></div>' +
      '<div class="gh-splash-from">from<b>GOLDEN HOUR</b></div></div>');

    var chats = files.reduce(function (sum, f) { return sum + number(f.chats); }, 0);
    html.push('<div class="gh-stat gh-stat-posts"><b>' + esc(identity.characterCount || files.length) + '</b><span>bots</span></div>');
    if (chats) html.push('<div class="gh-stat gh-stat-extra"><b>' + compact(chats) + '</b><span>chats</span></div>');

    var bio = o.aboutBody && o.aboutBody !== defaults.aboutBody
      ? o.aboutBody : 'Write a line or two about yourself under Profile data → About me.';
    var link = (o.socials || []).filter(function (s) { return s && usable(s.link); })[0];
    var friends = (o.friends || []).filter(function (f) { return f && f.name; });
    html.push('<div class="gh-bio"><div class="gh-bio-name">' + esc(o.feedName || username) + '</div>');
    if (o.feedCategory) html.push('<div class="gh-bio-cat">' + esc(o.feedCategory) + '</div>');
    html.push('<p>' + multiline(bio) + '</p>');
    if (link) {
      html.push('<a class="gh-bio-link" href="' + attr(link.link) + '"><i>🔗</i>' +
        esc(link.label || siteName(link.link)) + '</a>');
    }
    if (friends.length) {
      var shown = friends.slice(0, 3);
      html.push('<div class="gh-mutuals"><div class="gh-mutual-faces">' + shown.map(function (f) {
        return '<i>' + esc(String(f.name).trim().charAt(0).toUpperCase()) + '</i>';
      }).join('') + '</div><div>Friends with ' + shown.map(function (f) {
        return '<b>' + esc(f.name) + '</b>';
      }).join(', ') + (friends.length > shown.length ? ' + ' + (friends.length - shown.length) + ' more' : '') + '</div></div>');
    }
    html.push('</div>');

    var list = stories(o);
    if (list.length) {
      html.push('<div class="gh-anchor" id="gh-feed"></div><nav class="gh-highlights" aria-label="Highlights">');
      list.forEach(function (story, i) {
        html.push('<a class="gh-hl" href="#gh-s' + (i + 1) + '"><span class="gh-hl-ring"><span class="gh-hl-cover">' +
          MARKS[i % MARKS.length] + '</span></span><span class="gh-hl-name">' + esc(story.name) + '</span></a>');
      });
      html.push('</nav>');
      list.forEach(function (story, i) {
        var step = function (to, glyph, label) {
          return to >= 0 && to < list.length
            ? '<a class="gh-story-step" href="#gh-s' + (to + 1) + '" aria-label="' + label + '">' + glyph + '</a>'
            : '<span class="gh-story-step gh-story-step-off">' + glyph + '</span>';
        };
        html.push('<div class="gh-story gh-story-' + MOODS[i % MOODS.length] + '" id="gh-s' + (i + 1) + '">' +
          '<a class="gh-story-shade" href="#gh-feed" aria-label="Close"><span>✕</span></a>' +
          step(i - 1, '‹', 'Previous story') +
          '<div class="gh-story-card"><div class="gh-story-bars">' + list.map(function (unused, j) {
            return j < i ? '<i class="gh-done"></i>' : j === i ? '<i class="gh-now"></i>' : '<i></i>';
          }).join('') + '</div>' +
          '<div class="gh-story-head"><span class="gh-story-face">' + MARKS[i % MARKS.length] + '</span><b>' +
          esc(username) + '</b><span>' + esc(story.name) + '</span></div>' +
          '<div class="gh-story-body">' + storyBody(story) + '</div>' +
          '<div class="gh-story-reply"><span>Reply to ' + esc(username) + '…</span><i>♡</i><i>➤</i></div></div>' +
          step(i + 1, '›', 'Next story') + '</div>');
      });
    }

    html.push('<div class="gh-credit">GOLDEN HOUR · TEMPLATE BY SWEEPERCOM</div>');
    return html.join('');
  }

  /* Nothing here scales with the roster: the grid is JanitorAI's own list. */
  function css() {
    return '/* Generated from Profile data — edit it there, not here. */\n';
  }

  /* The template's stylesheet, every part of it, in the template's own order. */
  function style() {
    var template = (global.JAI_TEMPLATES || []).filter(function (t) { return t.id === TEMPLATE; })[0];
    if (!template) return '';
    return template.components.map(function (part) {
      return part.css ? '/* ' + part.name + ' */\n' + String(part.css).replace(/\n+$/, '') + '\n' : '';
    }).filter(Boolean).join('\n');
  }

  global.JaiPhotoFeed = { markup: markup, css: css, style: style };
})(window);
