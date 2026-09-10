/*
 * The Changelog dialog. Reads CHANGELOG.md at runtime — the same file people
 * edit — so there is nothing to regenerate. Entries are `## YYYY-MM-DD — Title`
 * headings followed by paragraphs or bullets; the newest is first. A dot on
 * the toolbar button marks entries you have not opened yet; opening the
 * dialog clears it. Nothing here is required for the studio to work: if the
 * file is missing the dialog just says so.
 */
(function () {
  'use strict';

  var SEEN_KEY = 'jai-css-studio:changelog-seen';
  var dlg = document.getElementById('changelog');
  var body = document.getElementById('changelog-body');
  var toggle = document.getElementById('changelog-toggle');
  var closeBtn = document.getElementById('changelog-close');
  var dot = document.getElementById('changelog-dot');
  if (!dlg || !body || !toggle || typeof dlg.showModal !== 'function') return;

  var entries = null;
  var newest = '';

  // ------------------------------------------------------------- markdown
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Inline formatting on already-escaped text: `code`, **bold**, [text](url),
  // and bare URLs. The bare-URL rule requires whitespace or "(" before the URL
  // so it never re-links the href inside an anchor it just made.
  function inline(s) {
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m, pre, url) {
      return pre + '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
    });
    return s;
  }
  function blocks(lines) {
    var out = [], para = [], list = [];
    function flushPara() { if (para.length) { out.push({ t: 'p', text: para.join(' ') }); para = []; } }
    function flushList() { if (list.length) { out.push({ t: 'ul', items: list }); list = []; } }
    lines.forEach(function (l) {
      if (!l.trim()) { flushPara(); flushList(); return; }
      var b = /^\s*[-*]\s+(.*)$/.exec(l);
      if (b) { flushPara(); list.push(b[1]); return; }
      if (list.length) { list[list.length - 1] += ' ' + l.trim(); return; }   // wrapped bullet
      para.push(l.trim());
    });
    flushPara(); flushList();
    return out;
  }
  function parse(md) {
    var lines = md.split(/\r?\n/), out = [], cur = null;
    for (var i = 0; i < lines.length; i++) {
      var m = /^##\s+(.+?)\s*$/.exec(lines[i]);
      if (m) { cur = { heading: m[1], lines: [] }; out.push(cur); continue; }
      if (cur) cur.lines.push(lines[i]);
    }
    return out.map(function (e) {
      var hm = /^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+)$/.exec(e.heading);
      return { raw: e.heading, date: hm ? hm[1] : '', title: hm ? hm[2] : e.heading, blocks: blocks(e.lines) };
    });
  }
  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // --------------------------------------------------------------- render
  function render(list) {
    if (!list.length) { body.innerHTML = '<p class="changelog-sub">Nothing here yet.</p>'; return; }
    body.innerHTML = list.map(function (e) {
      var h = '<h3>' + (e.date ? esc(fmtDate(e.date)) + ' – ' : '') + inline(esc(e.title)) + '</h3>';
      var b = e.blocks.map(function (bl) {
        if (bl.t === 'ul') {
          return '<ul>' + bl.items.map(function (it) { return '<li>' + inline(esc(it)) + '</li>'; }).join('') + '</ul>';
        }
        return '<p>' + inline(esc(bl.text)) + '</p>';
      }).join('');
      return '<section class="changelog-entry">' + h + b + '</section>';
    }).join('');
  }

  // ---------------------------------------------------------------- state
  function seen() { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, newest); } catch { /* private mode; the dot just comes back */ }
    dot.hidden = true;
  }
  function load() {
    if (entries) return Promise.resolve(entries);
    return fetch('CHANGELOG.md', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (md) {
        entries = parse(md);
        newest = entries.length ? entries[0].raw : '';
        render(entries);
        dot.hidden = !newest || seen() === newest;
        return entries;
      })
      .catch(function (err) {
        // Leave `entries` unset so the next click tries again: a failure at
        // start-up (server restarting, a flaky connection) must not stick for
        // the whole session. Say why, so a report can be acted on.
        entries = null;
        body.innerHTML = '<p class="changelog-sub">Couldn’t load the changelog (' +
          esc(String((err && err.message) || err)) + '). Close this and try again.</p>';
        return [];
      });
  }
  function open() { dlg.showModal(); markSeen(); }

  toggle.addEventListener('click', function () { load().then(open); });
  closeBtn.addEventListener('click', function () { dlg.close(); });
  // The dialog element itself only receives clicks on the backdrop; everything
  // inside is covered by .changelog-inner, which carries the padding.
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  load();   // so the dot is right without anyone opening the dialog
})();
