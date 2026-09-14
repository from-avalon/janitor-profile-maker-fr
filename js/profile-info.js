/*
 * Profile Information: the facts a hardcoded profile is generated from.
 *
 * A hardcoded profile is the creator's own markup, so everything JanitorAI
 * would otherwise render for them — the username, the badges, every
 * character's card — has to be written out by hand. This keeps those facts as
 * data, separate from the About Me document they end up in: the document is
 * the output, this is the source, and clearing the editor must never lose it.
 *
 * Two kinds of field live here, and an import treats them differently:
 *
 *   - facts the captured page knows (followers, badges, chat and token
 *     counts), which a fresh import refreshes; and
 *   - things only the creator can write (friends, social links, About Me
 *     sections, taglines, art overrides), which an import never touches.
 */
(function (global) {
  'use strict';

  var KEY = 'jai-css-studio:profile-info';
  // The Cards panel kept its roster here before Profile Information existed.
  var LEGACY_CARDS_KEY = 'jai-css-studio:cards';

  function blank() {
    return {
      identity: {
        username: '', avatar: '', followers: '', memberSince: '', characterCount: '',
        verified: false, janitorPlus: false, badges: []
      },
      characters: [],
      about: { title: '', body: '', notes: '' },
      sections: [],
      friends: [],
      socials: [],
      layout: { style: '', options: {} }
    };
  }

  /* Fills in whatever a saved copy is missing, so a save from an older version
   * of the studio still loads into the current shape. */
  function normalise(saved) {
    var info = blank();
    if (!saved || typeof saved !== 'object') return info;
    Object.keys(info.identity).forEach(function (k) {
      if (saved.identity && saved.identity[k] != null) info.identity[k] = saved.identity[k];
    });
    if (!Array.isArray(info.identity.badges)) info.identity.badges = [];
    ['characters', 'sections', 'friends', 'socials'].forEach(function (k) {
      if (Array.isArray(saved[k])) info[k] = saved[k];
    });
    if (saved.about) {
      ['title', 'body', 'notes'].forEach(function (k) {
        if (saved.about[k] != null) info.about[k] = saved.about[k];
      });
    }
    if (saved.layout) {
      info.layout.style = saved.layout.style || '';
      info.layout.options = saved.layout.options || {};
    }
    return info;
  }

  /* The Cards panel mixed personal copy into its layout options; it belongs
   * with the profile now, and the single Discord field becomes a social link. */
  function fromLegacyCards(legacy) {
    var info = blank();
    var o = Object.assign({}, legacy.options || {});
    info.characters = legacy.roster;
    info.about = { title: o.aboutTitle || '', body: o.aboutBody || '', notes: o.creatorNotes || '' };
    if (o.discord) info.socials.push({ label: 'Discord', link: o.discord, image: '' });
    info.layout.style = o.style || '';
    ['aboutTitle', 'aboutBody', 'creatorNotes', 'discord', 'style'].forEach(function (k) { delete o[k]; });
    info.layout.options = o;
    return info;
  }

  function load() {
    try {
      var saved = JSON.parse(global.localStorage.getItem(KEY) || 'null');
      if (saved) return normalise(saved);
      var legacy = JSON.parse(global.localStorage.getItem(LEGACY_CARDS_KEY) || 'null');
      if (legacy && Array.isArray(legacy.roster)) return fromLegacyCards(legacy);
    } catch (e) { /* corrupt or private mode: start empty */ }
    return blank();
  }

  function save(info) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(info));
    } catch (e) { /* quota or private mode — not worth interrupting the user */ }
  }

  // ------------------------------------------------------------- extraction

  function text(node) { return node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

  /* A capture rewrites images to blob: URLs that die with the tab. The import
   * keeps the original address beside it; only that one is worth storing. */
  function publicSrc(img) {
    if (!img) return '';
    var src = img.getAttribute('data-jai-source-src') || img.getAttribute('src') || '';
    return global.JaiHardcode.usable(src) ? src : '';
  }

  /*
   * Reads a JanitorAI profile page: the preview's live document, or a freshly
   * parsed import. Works on either because both are the site's own DOM, so the
   * site's own label classes (see the reference guide) are the source.
   */
  function fromDocument(doc) {
    if (!doc || !doc.querySelector('.pp-uc-title, .pp-cc-wrapper')) return null;
    var followers = doc.querySelector('.pp-uc-followers-count');
    var total = doc.querySelector('.pp-pg-total-count, .profile-badge-total-count');
    var badges = [];
    Array.prototype.forEach.call(doc.querySelectorAll('.profile-badges img'), function (img) {
      var badge = {
        name: String(img.getAttribute('alt') || '').replace(/\s*badge\s*$/i, '').trim(),
        image: publicSrc(img)
      };
      if (!badge.name && !badge.image) return;
      var seen = badges.some(function (b) { return b.name === badge.name && b.image === badge.image; });
      if (!seen) badges.push(badge);
    });
    return {
      identity: {
        username: text(doc.querySelector('.pp-uc-title')).replace(/^@/, ''),
        avatar: publicSrc(doc.querySelector('.pp-uc-avatar')),
        // The count is its own span; the word "followers" is a second one.
        followers: followers
          ? text(followers.querySelector('span')) || text(followers).replace(/followers/i, '').trim()
          : '',
        memberSince: text(doc.querySelector('.pp-uc-member-since')).replace(/^member\s+since\s*/i, ''),
        characterCount: total ? text(total).replace(/[^\d.,kKmM]/g, '') : '',
        verified: !!doc.querySelector('.profile-verified-mark'),
        janitorPlus: !!doc.querySelector('[aria-label="janitor+ Subscriber"]'),
        badges: badges
      },
      characters: global.JaiHardcode.fromDocument(doc)
    };
  }

  function isEmpty(value) {
    return Array.isArray(value) ? !value.length : !String(value == null ? '' : value).trim();
  }

  /*
   * Folds a fresh extraction into what the creator already has. Characters are
   * matched by link, then by name, so renaming one in the panel does not turn
   * the next import into a duplicate. Returns how many were added or changed.
   */
  function merge(info, found) {
    var result = { added: 0, updated: 0 };
    if (!found) return result;

    var identity = info.identity;
    ['username', 'avatar', 'followers', 'memberSince', 'characterCount'].forEach(function (k) {
      if (found.identity[k]) identity[k] = found.identity[k];
    });
    identity.verified = found.identity.verified;
    identity.janitorPlus = found.identity.janitorPlus;
    if (found.identity.badges.length) identity.badges = found.identity.badges;

    var byLink = {}, byName = {};
    function remember(c) {
      if (c.link) byLink[c.link] = c;
      if (c.name) byName[String(c.name).toLowerCase()] = c;
    }
    info.characters.forEach(remember);

    found.characters.forEach(function (c) {
      var existing = (c.link && byLink[c.link]) || byName[String(c.name).toLowerCase()];
      if (!existing) {
        // The panel edits tags as one comma-separated field.
        c.tags = c.tags.join(', ');
        info.characters.push(c);
        remember(c);
        result.added++;
        return;
      }
      var changed = false;
      ['chats', 'publicChats', 'tokens'].forEach(function (k) {
        if (c[k] && existing[k] !== c[k]) { existing[k] = c[k]; changed = true; }
      });
      ['description', 'link', 'portrait', 'art', 'tags'].forEach(function (k) {
        if (isEmpty(existing[k]) && !isEmpty(c[k])) {
          existing[k] = Array.isArray(c[k]) ? c[k].join(', ') : c[k];
          changed = true;
        }
      });
      if (changed) result.updated++;
    });
    return result;
  }

  /* Layout options plus everything the profile contributes to the emitters. */
  function emitOptions(info, base) {
    var out = Object.assign({}, base);
    out.aboutTitle = info.about.title;
    out.aboutBody = info.about.body;
    out.creatorNotes = info.about.notes;
    out.username = info.identity.username;
    out.sections = info.sections;
    out.friends = info.friends;
    out.socials = info.socials;
    return out;
  }

  global.JaiProfileInfo = {
    key: KEY,
    blank: blank,
    normalise: normalise,
    load: load,
    save: save,
    fromDocument: fromDocument,
    merge: merge,
    emitOptions: emitOptions
  };
})(window);
