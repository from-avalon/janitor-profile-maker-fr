/*
 * The "Reddit-style" design: Front Page's words, written from Profile data.
 *
 * Front Page is a template (templates/front-page). Three of its parts carry
 * placeholder copy: the handle, bio and link pills in the profile card, the
 * communities card, and the rules card. This writes the markup of those three
 * from Profile information instead: the handle from the username, the bio from
 * About me, the pills and the communities from the social links, friends as a
 * second list in the same card, and a rule for each extra section.
 *
 * Like js/photo-feed-profile.js it is not a design of its own. The studio
 * hands these to the template part as it is added (`materialiseTemplatePart`
 * in js/app.js), so Front Page added from Insert and "Reddit-style" chosen in
 * Profile data are the same eight parts.
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
    if (!username && !tagline && !text && !links.length) return fallback || '';

    return '<div class="rd-handle">u/' + esc(username || 'yourname') +
      (tagline ? ' · ' + esc(tagline) : username ? '' : ' · they/them · bot maker') + '</div>' +
      '<p class="rd-bio">' + (text ? multiline(text)
        : 'A couple of sentences about you. What you write, how often you post, and what a visitor should expect from your bots.') + '</p>' +
      '<div class="rd-links">' + (links.length ? links.map(function (s) {
        return '<a href="' + attr(s.link) + '">' + esc(s.label || siteName(s.link)) + '</a>';
      }).join('') : '<a href="#">Discord</a><a href="#">Ko-fi</a><a href="#">Carrd</a><a href="#">Tumblr</a>') + '</div>';
  }

  // -------------------------------------------------------- communities card

  function row(icon, tone, name, link, meta, action) {
    return '<div class="rd-comm"><span class="rd-comm-icon' + tone + '">' + icon + '</span>' +
      '<div class="rd-comm-text"><a class="rd-comm-name"' + (link ? ' href="' + attr(link) + '"' : '') + '>' + esc(name) + '</a>' +
      (meta ? '<span class="rd-comm-meta">' + esc(meta) + '</span>' : '') + '</div>' +
      (link ? '<a class="rd-join" href="' + attr(link) + '">' + action + '</a>' : '') + '</div>';
  }

  function communities(files, o, fallback) {
    var links = socials(o);
    var people = friends(o);
    if (!links.length && !people.length) return fallback || '';
    var html = '<section class="rd-box rd-communities">';

    if (links.length) {
      html += '<h3 class="rd-box-title">Find me in these communities</h3>' + links.map(function (s, i) {
        var name = s.label || siteName(s.link);
        return row(initial(name), ICONS[i % ICONS.length], name, s.link, siteName(s.link), 'Join');
      }).join('');
    }
    if (people.length) {
      html += '<h3 class="rd-box-title">' + esc(written(o, 'friendsTitle') || 'Friends') + '</h3>' + people.map(function (f, i) {
        var name = String(f.name).trim().replace(/^@/, '');
        var icon = usable(f.image) ? '<img src="' + attr(f.image) + '" alt="">' : initial(name);
        return row(icon, ICONS[(i + 1) % ICONS.length], 'u/' + name, usable(f.link) ? f.link : '', String(f.note || '').trim(), 'Follow');
      }).join('');
    }
    return html + '</section>';
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

  global.JaiFrontPage = {
    template: 'front-page',
    // Which of the template's parts are written here, by the key of each.
    parts: { about: about, communities: communities, rules: rules }
  };
})(window);
