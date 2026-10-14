/*
 * The "Reddit-style" design: Front Page's words, written from Profile data.
 *
 * Front Page is a template (templates/front-page). Four of its parts carry
 * placeholder copy: the banner, handle, bio and link pills in the profile
 * card, the communities card, the friends card, and the rules card. This
 * writes the markup of those four from Profile information instead: the
 * handle from the username, the bio from About me, the pills and the
 * communities from the social links, a card of friends, and a rule for each
 * extra section. The banner is the one thing that is a look rather than
 * words: its picture goes in the markup (JanitorAI strips url()), its colour
 * in the part's stylesheet (`css` below).
 *
 * Like js/photo-feed-profile.js it is not a design of its own. The studio
 * hands these to the template part as it is added (`materialiseTemplatePart`
 * in js/app.js), so Front Page added from Insert and "Reddit-style" chosen in
 * Profile data are the same nine parts.
 *
 * Whatever Profile data has nothing to say about keeps the template's own
 * placeholder, so a page built from an empty Profile data is the template as
 * it ships.
 */
(function (global) {
  'use strict';

  // The round icons' colours, in the order rows come: orange, blue, green.
  var ICONS = ['', ' rd-comm-icon-b', ' rd-comm-icon-c'];

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

  function siteName(link) {
    return String(link || '').replace(/^https?:\/\/(www\.)?/i, '').split(/[/?#]/)[0];
  }

  function initial(text) { return esc(String(text || '?').trim().charAt(0).toUpperCase() || '?'); }

  function socials(o) {
    return (o.socials || []).filter(function (s) { return s && usable(s.link); });
  }

  function friends(o) {
    return (o.friends || []).filter(function (f) { return f && String(f.name || '').trim(); });
  }

  // ------------------------------------------------------- handle, bio, links

  function about(files, o, fallback) {
    var identity = o.identity || {};
    var username = String(identity.username || '').trim().replace(/^@/, '');
    var tagline = written(o, 'redditTagline');
    var text = written(o, 'aboutBody');
    var links = socials(o);
    var picture = usable(o.redditBannerImage) ? o.redditBannerImage : '';
    if (!username && !tagline && !text && !links.length && !picture) return fallback || '';

    return '<div class="rd-banner">' + (picture ? '<img src="' + attr(picture) + '" alt="">' : '') + '</div>' +
      '<div class="rd-handle">u/' + esc(username || 'yourname') +
      (tagline ? ' · ' + esc(tagline) : username ? '' : ' · they/them · bot maker') + '</div>' +
      '<p class="rd-bio">' + (text ? multiline(text)
        : 'A couple of sentences about you. What you write, how often you post, and what a visitor should expect from your bots.') + '</p>' +
      '<div class="rd-links">' + (links.length ? links.map(function (s) {
        return '<a href="' + attr(s.link) + '">' + esc(s.label || siteName(s.link)) + '</a>';
      }).join('') : '<a href="#">Discord</a><a href="#">Ko-fi</a><a href="#">Carrd</a><a href="#">Tumblr</a>') + '</div>';
  }

  // -------------------------------------------------------- communities card

  function communities(files, o, fallback) {
    var links = socials(o);
    if (!links.length) return fallback || '';
    return '<section class="rd-box rd-communities"><h3 class="rd-box-title">Find me in these communities</h3>' +
      links.map(function (s, i) {
        var name = s.label || siteName(s.link);
        return '<div class="rd-comm"><span class="rd-comm-icon' + ICONS[i % ICONS.length] + '">' + initial(name) + '</span>' +
          '<div class="rd-comm-text"><a class="rd-comm-name" href="' + attr(s.link) + '">' + esc(name) + '</a>' +
          '<span class="rd-comm-meta">' + esc(siteName(s.link)) + '</span></div>' +
          '<a class="rd-join" href="' + attr(s.link) + '">Join</a></div>';
      }).join('') + '</section>';
  }

  // ------------------------------------------------------------ friends card

  function friendsCard(files, o, fallback) {
    var people = friends(o);
    if (!people.length) return fallback || '';
    return '<section class="rd-box rd-friends"><h3 class="rd-box-title">' + esc(written(o, 'friendsTitle') || 'Friends') + '</h3>' +
      people.map(function (f) {
        var name = String(f.name).trim().replace(/^@/, '');
        var link = usable(f.link) ? f.link : '';
        var note = String(f.note || '').trim();
        return '<div class="rd-friend"><span class="rd-friend-icon">' +
          (usable(f.image) ? '<img src="' + attr(f.image) + '" alt="">' : initial(name)) + '</span>' +
          '<div class="rd-friend-text"><a class="rd-friend-name"' + (link ? ' href="' + attr(link) + '"' : '') + '>u/' + esc(name) + '</a>' +
          (note ? '<span class="rd-friend-meta">' + esc(note) + '</span>' : '') + '</div>' +
          (link ? '<a class="rd-follow" href="' + attr(link) + '">Follow</a>' : '') + '</div>';
      }).join('') + '</section>';
  }

  // --------------------------------------------------------------- rules card

  function rules(files, o, fallback) {
    var identity = o.identity || {};
    var username = String(identity.username || '').trim().replace(/^@/, '');
    var list = [];
    var notes = written(o, 'creatorNotes');
    if (notes) list.push({ title: written(o, 'aboutTitle') || 'Creator notes', body: notes });
    (o.sections || []).forEach(function (s) {
      if (s && (s.title || s.body)) list.push({ title: s.title || 'More', body: s.body });
    });
    if (!list.length) return fallback || '';

    return '<section class="rd-box rd-rules"><h3 class="rd-box-title">u/' + esc(username || 'yourname') + ' rules</h3>' +
      list.map(function (rule, i) {
        return '<details class="rd-rule"><summary>' + (i + 1) + '. ' + esc(rule.title) + '</summary>' +
          (rule.body ? '<p>' + multiline(rule.body) + '</p>' : '') + '</details>';
      }).join('') + '</section>';
  }

  // ------------------------------------------------------------------ banner

  var BANNER = '#0079d3';
  var BANNER_RULE = /(\.rd-banner\s*\{[^}]*?background:\s*)[^;}]+/;

  /* A colour mixed towards white, for the light end of the banner. */
  function lighter(hex, by) {
    var n = parseInt(hex.slice(1), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(function (c) {
      var v = Math.round(c + (255 - c) * by).toString(16);
      return v.length < 2 ? '0' + v : v;
    }).join('');
  }

  /* The profile-card part's stylesheet with the banner in the chosen colour.
   * Only that one declaration is touched, so whatever else the creator has
   * changed in the part stays as they left it. */
  function aboutCss(o, css) {
    var colour = String(o.redditBanner || '').trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(colour)) colour = BANNER;
    // The default is the template's own two blues, exactly as it ships.
    var paint = 'linear-gradient(135deg, ' + (colour === BANNER ? '#33a8ff' : lighter(colour, 0.3)) + ', ' + colour + ')';
    return String(css || '').replace(BANNER_RULE, function (all, head) { return head + paint; });
  }

  global.JaiFrontPage = {
    template: 'front-page',
    // Which of the template's parts are written here, by the key of each.
    parts: { about: about, communities: communities, friends: friendsCard, rules: rules },
    // And which have a stylesheet that follows Profile data: given the
    // options and the part's CSS as it is now, the CSS as it should be.
    css: { about: aboutCss }
  };
})(window);
