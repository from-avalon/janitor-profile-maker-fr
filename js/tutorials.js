/*
 * Tutorials: a whole profile built one step at a time, with the studio's own
 * tools rather than a wall of instructions.
 *
 * The Tutorials panel only lists them. A tutorial that is running shows its
 * current step in the coach card over the canvas (#coach), because nearly
 * every step sends the creator to another panel and the instructions have to
 * still be there when they arrive.
 *
 * A step never does the work itself unless asked ("Do it for me"). It says
 * what to do, "Show me" opens the right panel and points at the thing, and
 * the step ticks itself off by looking at the document — so doing a step some
 * other way (dragging a part instead of pressing Add, say) counts just the
 * same, and Undo simply walks the tutorial back.
 */
(function () {
  'use strict';

  var S = window.JaiStudio;
  var el = S.el;
  var STORE_KEY = 'jai-css-studio:tutorial';

  // ----------------------------------------------------------------- helpers

  function $(selector, root) { return (root || document).querySelector(selector); }

  function part(id) {
    return window.JaiPresets.allParts().filter(function (p) { return p.id === id; })[0] || null;
  }

  function hasPart(id) {
    var p = part(id);
    return !!p && window.JaiPresets.isPartApplied(S.code(), p);
  }

  function addPart(id) {
    var p = part(id);
    if (p && !window.JaiPresets.isPartApplied(S.code(), p)) S.togglePart(p);
  }

  /* Draws the eye to something in the studio's own interface. */
  function pulse(node) {
    if (!node) return;
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // One thing lit at a time: the last step's target stops when this starts.
    Array.prototype.forEach.call(document.querySelectorAll('.tut-pulse'), function (other) {
      other.classList.remove('tut-pulse');
    });
    void node.offsetWidth;                // restart the animation if it is mid-run
    node.classList.add('tut-pulse');
    setTimeout(function () { node.classList.remove('tut-pulse'); }, 3200);
  }

  /* Opens Insert → Sections → the template's parts, and points at one row (or
   * at the card's own button when no part is named). */
  function showPart(templateId, partId) {
    S.showPanel('insert');
    var section = $('#presets-layouts');
    if (section) section.open = true;
    var card = $('.template[data-template="' + templateId + '"]');
    if (!card) return;
    var parts = $('.template-parts', card);
    if (parts && partId) parts.open = true;
    pulse(partId ? $('.part[data-part="' + partId + '"]', card) : $('.template-actions button', card));
  }

  /* Selects something on the canvas: one of the creator's elements by its
   * class, or one of JanitorAI's by its selector. */
  function showOnCanvas(target) {
    if (S.state.mode !== 'design') S.setMode('design');
    if (target.cls) {
      var node = S.markup().nodes.filter(function (n) { return n.classes.indexOf(target.cls) !== -1; })[0];
      if (node) S.post({ type: 'select', jx: node.id, reveal: true });
    } else {
      S.post({ type: 'select', selector: target.selector, reveal: true });
    }
  }

  /* The text inside the first element carrying `cls`, as written in the code. */
  function textOf(cls) {
    var match = new RegExp('class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>([^<]*)<').exec(S.code());
    return match ? match[1].trim() : null;
  }

  function blank() {
    var code = S.code().trim();
    return !code || code === String(window.JaiPayload.STARTER || '').trim();
  }

  // ------------------------------------------------------------- the lessons

  var GH = 'golden-hour';

  // ------------------------------------------------------------ shared steps

  function blankStep() {
    return {
      title: 'Start with a blank page',
      body: 'This design replaces the whole page, so it is best built on an empty About Me. Clearing can be undone with <kbd>Ctrl</kbd>+<kbd>Z</kbd>.',
      choices: [
        { label: 'Clear my page', primary: true, run: function (flags) { if (!blank()) S.setCode('', 'tutorial', { now: true }); flags.started = true; } },
        { label: 'Keep what I have', run: function (flags) { flags.started = true; } }
      ],
      enter: function (flags) { if (blank()) flags.started = true; },
      done: function (flags) { return !!flags.started; }
    };
  }

  /*
   * Getting your own profile into the studio. The file is the page JanitorAI
   * served you, saved by your browser: nothing is uploaded, and the studio
   * reads your name, avatar, badges and every character card out of it.
   *
   * `shots` are optional pictures for a step, shown under its text. They live
   * in assets/tutorials/ and are listed in SHOTS below; a step with none
   * listed simply has none.
   */
  var SHOTS = {
    save: [{ src: 'assets/tutorials/profile-menu.webp', alt: 'JanitorAI with the menu under your picture open, Profile at the top of it' }],
    saveAs: [{ src: 'assets/tutorials/save-as.png', alt: 'The Save As window, with Save as type set to Webpage, Single File (*.mhtml)' }],
    importFile: [{ src: 'assets/tutorials/import-profile.png', alt: 'The Import profile button in Profile data, and the saved file being picked' }]
  };

  function saveSteps() {
    return [
      {
        title: 'Open your profile on JanitorAI',
        body: 'This part happens outside the studio, on a computer, in <b>Chrome, Edge, Brave or Opera</b> (Firefox and phones cannot save this kind of file).' +
          '<ol><li>Go to <b>janitorai.com</b> and sign in.</li>' +
          '<li>Click your picture in the top right, then <b>Profile</b>.</li>' +
          '<li>Scroll down until every character you want has appeared — only the cards on the page are saved.</li></ol>',
        shots: SHOTS.save,
        choices: [
          { label: 'I am on my profile', primary: true, run: function (flags) { flags.onProfile = true; } },
          // Someone who has already brought their profile in does not do it
          // again for every design: one press passes all of these steps. It
          // names whose profile is here, because Profile data may be holding
          // the sample one.
          {
            label: function () {
              return 'Skip — @' + (S.info().identity.username || 'my profile') + ' is already in';
            },
            when: profileIsIn,
            run: function (flags) { flags.haveProfile = true; }
          }
        ],
        done: function (flags) { return !!flags.onProfile || !!flags.imported || !!flags.haveProfile; }
      },
      {
        title: 'Save the page as one file',
        body: '<ol><li>Press <kbd>Ctrl</kbd>+<kbd>S</kbd> (<kbd>⌘</kbd>+<kbd>S</kbd> on a Mac).</li>' +
          '<li>Where it says <b>Save as type</b>, choose <b>Webpage, Single File (*.mhtml)</b>.</li>' +
          '<li>Save it somewhere you will find it again, like the Desktop.</li></ol>' +
          'The file stays on your computer; the studio only reads it in this browser.',
        shots: SHOTS.saveAs,
        choices: [{ label: 'I have the file', primary: true, run: function (flags) { flags.saved = true; } }],
        done: function (flags) { return !!flags.saved || !!flags.imported || !!flags.haveProfile; }
      },
      {
        title: 'Bring it into the studio',
        body: 'Open <b>Profile data</b> and press <b>Import profile</b>, then pick the file you just saved. The preview becomes your own page, and your characters are listed under <b>Characters</b>.',
        shots: SHOTS.importFile,
        show: function () {
          S.showPanel('info');
          pulse($('.info-import .profile-import-button'));
        },
        choices: [{
          label: 'Use the sample profile',
          run: function (flags) {
            S.showPanel('info');
            var fill = $('#info-fill');
            if (fill) fill.click();
            flags.imported = true;
          }
        }],
        done: function (flags) { return !!flags.imported || !!flags.haveProfile; }
      },
      {
        title: 'More than one page of characters?',
        body: function () {
          var have = info().characters.length;
          var total = rosterTotal();
          return (total > have
            ? 'Your profile lists <b>' + total + '</b> characters and <b>' + have + '</b> came in: a saved page only holds the cards that were on it. '
            : 'A saved page only holds the characters that were on it, so a long list comes in a page at a time. ') +
            'Only the ones here can be featured in a showcase; your full list still shows on JanitorAI either way.' +
            '<ol><li>On JanitorAI, go to <b>page 2</b> at the bottom of your character list.</li>' +
            '<li>Save it the same way: <kbd>Ctrl</kbd>+<kbd>S</kbd>, <b>Webpage, Single File</b>. Do the same for each further page.</li>' +
            '<li>Back here, press <b>Add more pages</b> in <b>Profile data</b> and pick all of those files at once.</li></ol>' +
            'Characters you already have are not added twice, and your page in the preview is left alone.';
        },
        show: function () {
          S.showPanel('info');
          pulse($('.profile-pages-button'));
        },
        choices: [{ label: 'These are all I need', run: function (flags) { flags.pages = true; } }],
        enter: function (flags) { if (rosterComplete()) flags.pages = true; },
        done: function (flags) { return !!flags.pages || !!flags.haveProfile || rosterComplete(); }
      }
    ];
  }

  /* Profile data already holds somebody's page: a name and their characters. */
  function profileIsIn() {
    var held = S.info();
    return !!held.identity.username && held.characters.length > 0;
  }

  /* How many characters the profile says it has, when it says. */
  function rosterTotal() {
    var n = parseInt(String(S.info().identity.characterCount || '').replace(/[^\d]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  /* Every character the profile lists is in Profile data. */
  function rosterComplete() {
    var total = rosterTotal();
    return total > 0 && S.info().characters.length >= total;
  }

  // -------------------------------------------------------- the Steam lesson

  function info() { return S.info(); }

  function layoutOption(key) { return (info().layout.options || {})[key] || ''; }

  function setLayoutOption(key, value) {
    info().layout.options[key] = value;
    S.touchInfo();
  }

  function showInfoSection(id, target) {
    S.showPanel('info');
    var section = $('#' + id);
    if (section) section.open = true;
    pulse(target ? $(target) : section);
  }

  /* A step that is done when one of Profile data's lists has an entry with a
   * name. Nobody can be made up on someone's behalf, so there is no "Do it for
   * me": the step is optional, and Skip is right there. */
  function listStep(list, sectionId, title, body) {
    return {
      title: title,
      body: body,
      optional: true,
      show: function () { showInfoSection(sectionId, '#' + sectionId + ' [data-add="' + list + '"]'); },
      done: function () {
        return (info()[list] || []).some(function (entry) { return String(entry.name || '').trim(); });
      }
    };
  }

  function steamSteps() {
    return saveSteps().concat([
      blankStep(),
      {
        title: 'Build the Steam profile',
        body: 'At the top of <b>Profile data</b> is <b>Profile design</b>. Choose <b>Steam profile</b>: the page is written from what Profile data holds, and you can switch to another design there at any time without losing any of it.',
        show: function () {
          S.showPanel('info');
          pulse($('.design-pick'));
        },
        auto: function () {
          var pick = $('#cards-opt-style');
          if (!pick) return;
          pick.value = 'steam';
          pick.dispatchEvent(new Event('change', { bubbles: true }));
        },
        done: function () {
          return window.JaiHardcode.isApplied(S.code()) && info().layout.style === 'steam';
        }
      },
      {
        title: 'Choose who goes in the showcases',
        body: 'The <b>Favorite Character</b> box and the row under it show the characters you feature. In <b>Profile data → Characters</b>, open a character and tick <b>Feature in showcases</b>. The first one you feature is the favourite; the next four fill the row.',
        show: function () { showInfoSection('info-characters', '#cards-list'); },
        auto: function () {
          // The most-chatted few: the ones a visitor is most likely to know.
          var ranked = info().characters.slice().sort(function (a, b) {
            return (parseFloat(b.chats) || 0) * (/k/i.test(b.chats) ? 1000 : 1) -
                   (parseFloat(a.chats) || 0) * (/k/i.test(a.chats) ? 1000 : 1);
          });
          ranked.slice(0, 5).forEach(function (c) { c.featured = true; });
          S.touchInfo();
        },
        done: function () { return info().characters.some(function (c) { return c.featured; }); }
      },
      {
        title: 'Pick a theme or a background',
        body: 'Open <b>Profile data → Design options</b>. Pick one of the <b>Background</b> tiles, or choose a <b>Theme</b> — or paste the address of a wide picture into <b>Profile background</b> to put your own art behind the page.',
        show: function () { showInfoSection('info-layout', '#steam-options'); },
        auto: function () { setLayoutOption('steamTheme', 'cosmic'); },
        done: function () {
          var chosen = layoutOption('steamTheme');
          var wall = layoutOption('steamBackdrop');
          return (chosen && chosen !== 'default') || (wall && wall !== 'theme') || !!layoutOption('steamBackground');
        }
      },
      {
        title: 'Frame your avatar',
        body: 'In the same place, choose an <b>Avatar frame</b>. The built-in ones are drawn for you; <b>your own frame picture</b> takes a transparent PNG and lays it over your avatar.',
        show: function () { showInfoSection('info-layout', '#cards-opt-steamFrame'); },
        auto: function () { setLayoutOption('steamFrame', 'holo'); },
        done: function () {
          var chosen = layoutOption('steamFrame');
          return (chosen && chosen !== 'none') || !!layoutOption('steamFrameImage');
        }
      },
      {
        title: 'Write your summary',
        body: 'The text beside your avatar is your <b>Introduction</b>. Open <b>Profile data → About me</b> and write a line or two. <b>Creator notes</b> and any extra sections become boxes of their own under the showcases.',
        show: function () {
          showInfoSection('info-about', '[data-about="body"]');
          var field = $('[data-about="body"]');
          if (field) field.focus();
        },
        optional: true,
        done: function () { return !!String(info().about.body || '').trim(); }
      },
      listStep('friends', 'info-friends', 'Add your friends',
        'The right-hand column lists your friends under <b>Characters</b>. Open <b>Profile data → Friends</b>, press <b>Add friend</b> and type a name. A picture and a link to their profile are optional; the note is the grey line under the name ("Online", "Writes the best villains").'),
      listStep('inventory', 'info-inventory', 'Fill your inventory',
        'An inventory is for showing things off: emotes, badges, art, cards — anything with a picture. Open <b>Profile data → Inventory</b>, press <b>Add item</b>, name it and paste the address of its picture. Your items become an <b>Item Showcase</b>, and <b>Inventory</b> appears in the right-hand column with a count.'),
      listStep('workshop', 'info-workshop', 'Stock your workshop',
        'The workshop is for what you have made besides bots: lorebooks, prompts, presets, guides. Open <b>Profile data → Workshop items</b>, press <b>Add workshop item</b>, give it a title and the link people should follow. A wide picture and a line about it are optional.'),
      {
        title: 'Take it to JanitorAI',
        body: 'Press <b>Copy for About Me</b> in the top bar. On JanitorAI, open <b>Edit profile</b>, paste into the <b>About Me</b> box and save. When you publish a new bot, the list updates itself; import again whenever you want the showcases refreshed.',
        show: function () { pulse($('#copy-css')); },
        done: function (flags) { return !!flags.copied; }
      }
    ]);
  }

  function partStep(key, title, body) {
    var id = GH + '-' + key;
    return {
      title: title,
      body: body,
      show: function () { showPart(GH, id); },
      auto: function () { addPart(id); },
      done: function () { return hasPart(id); }
    };
  }

  var TUTORIALS = [{
    id: 'own-profile',
    name: 'Bring in your own profile',
    blurb: 'Save your JanitorAI profile page as a file and open it here, so the preview is your page and the studio knows your characters. Nothing is uploaded.',
    meta: '4 steps · about 3 minutes',
    steps: saveSteps(),
    finish: {
      title: 'Your profile is in.',
      body: 'The preview is your own page now, and your characters are under <b>Profile data</b>. Any layout or tutorial you start from here uses them.'
    }
  }, {
    id: 'steam',
    name: 'A Steam-style profile',
    blurb: 'A player profile built from your own page: level, a favourite-character showcase, featured characters, your own background and avatar frame. Starts by bringing your profile in.',
    meta: '14 short steps · about 10 minutes — fewer if your profile is already in',
    steps: steamSteps(),
    finish: {
      title: 'That is the whole profile.',
      body: 'It stays linked to <b>Profile data</b>: change a character, a friend or the theme there and the page follows. Import your profile again whenever you want the showcases brought up to date.'
    }
  }, {
    id: GH,
    name: 'A photo-feed profile',
    blurb: 'Build Golden Hour — the profile that looks like a photo app — one piece at a time: story-ring avatar, stats, highlights that open stories, and your characters as a grid.',
    meta: '11 short steps · about 5 minutes',
    steps: [
      blankStep(),
      partStep('backdrop', 'Paint the page black',
        'Every piece of this design is under <b>Insert → Sections → Golden Hour → Choose parts</b>. Press <b>Add</b> beside <b>Black backdrop &amp; system type</b>.'),
      partStep('layout', 'Build the header',
        'Now <b>Add</b> the part called <b>Profile header</b>. Your avatar gets its ring, and your name, followers and the Follow button line up beside it. Those are JanitorAI’s real ones — nothing to type.'),
      partStep('bio', 'Add your stats and bio',
        '<b>Add</b> the part called <b>Stats &amp; bio</b> — or drag its row onto the canvas. It puts two counts beside your followers and a bio underneath.'),
      {
        title: 'Make it yours',
        body: 'On the canvas, <b>double-click</b> the line that says <b>Your display name</b>, type your own, and press <kbd>Enter</kbd>. The counts, the bio and the link are changed the same way.',
        show: function () { showOnCanvas({ cls: 'gh-bio-name' }); },
        done: function () {
          var text = textOf('gh-bio-name');
          return text != null && text !== 'Your display name';
        }
      },
      partStep('highlights', 'Add the highlights',
        '<b>Add</b> the part called <b>Highlights &amp; stories</b>. A row of circles appears under the bio; each one opens a story card.'),
      {
        title: 'Open a story',
        body: 'Nothing on the canvas can be clicked while you are designing. Switch to <b>Preview</b> in the top bar, click a highlight, and step through with the arrows. Then come back to <b>Design</b>.',
        show: function () { pulse($('#mode-switch')); },
        enter: function (flags) { flags.previewed = S.state.mode === 'preview'; },
        done: function (flags) { return !!flags.previewed && S.state.mode === 'design'; }
      },
      partStep('grid', 'Turn your characters into a grid',
        '<b>Add</b> the part called <b>Character grid</b>. This restyles JanitorAI’s own list, so it keeps itself up to date when you publish a bot. Point at a tile in Preview to see its name and tags.'),
      {
        title: 'Slide something into place',
        body: 'Things do not have to stay where a design put them. On the canvas, <b>drag</b> the <b>Follow</b> button or your avatar a little way. Right-click → <b>Reset position</b> puts it back.',
        show: function () { showOnCanvas({ selector: '.pp-uc-follow-flex' }); },
        optional: true,
        done: function (flags) { return !!flags.slid; }
      },
      {
        title: 'Finish the set',
        body: 'Four parts are left: the launch splash, the header and menus, the floating notifications pill and the credit line. On the <b>Golden Hour</b> card, press <b>Add all</b>.',
        show: function () { showPart(GH, null); },
        auto: function () {
          window.JaiPresets.allParts().forEach(function (p) {
            if (p.id.indexOf(GH + '-') === 0) addPart(p.id);
          });
        },
        done: function () {
          return window.JaiPresets.allParts().every(function (p) {
            return p.id.indexOf(GH + '-') !== 0 || window.JaiPresets.isPartApplied(S.code(), p);
          });
        }
      },
      {
        title: 'Take it to JanitorAI',
        body: 'Press <b>Copy for About Me</b> in the top bar. On JanitorAI, open <b>Edit profile</b>, paste into the <b>About Me</b> box and save.',
        show: function () { pulse($('#copy-css')); },
        done: function (flags) { return !!flags.copied; }
      }
    ]
  }];

  function tutorial(id) {
    return TUTORIALS.filter(function (t) { return t.id === id; })[0] || null;
  }

  // ------------------------------------------------------------------- state

  var run = null;         // { id, step, flags, hold, finished, small }
  var finishedIds = {};

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!saved) return;
      finishedIds = saved.finished || {};
      if (saved.run && tutorial(saved.run.id)) {
        run = saved.run;
        run.flags = run.flags || {};
      }
    } catch { /* a corrupt or unavailable store just means starting fresh */ }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ run: run, finished: finishedIds }));
    } catch { /* storage full or blocked: the tutorial still runs for this visit */ }
  }

  function start(id) {
    run = { id: id, step: 0, flags: {}, hold: false, finished: false, small: false };
    enter();
    check();
    renderList();
  }

  function stop() {
    run = null;
    save();
    renderCoach();
    renderList();
  }

  function enter() {
    var step = tutorial(run.id).steps[run.step];
    if (step && step.enter) step.enter(run.flags);
  }

  function go(index) {
    var steps = tutorial(run.id).steps;
    if (index >= steps.length) {
      run.finished = true;
      finishedIds[run.id] = true;
    } else {
      run.step = Math.max(0, index);
      run.finished = false;
      enter();
    }
  }

  /* Ticks off the current step if the document says it is done, and keeps
   * going while the steps after it are already done too — someone who pressed
   * Add all early is not made to press Next four times. */
  function check() {
    if (!run) return;
    var steps = tutorial(run.id).steps;
    var advanced = null;
    while (!run.finished && !run.hold && steps[run.step].done(run.flags)) {
      advanced = steps[run.step];
      go(run.step + 1);
    }
    if (advanced && !run.finished) S.toast('✓ ' + advanced.title);
    save();
    renderCoach();
    if (advanced) renderList();
  }

  // -------------------------------------------------------------- the coach

  var coach = $('#coach');

  function button(label, cls, fn) {
    var b = el('button', 'btn btn-sm' + (cls ? ' ' + cls : ''), S.escapeHtml(label));
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  /* A step's picture is a screenshot of a whole window squeezed into a card;
   * a click shows it at a size where it can be read. Any click or key closes. */
  function zoom(shot) {
    var veil = el('div', 'coach-zoom');
    var big = el('img');
    big.src = shot.src;
    big.alt = shot.alt || '';
    veil.appendChild(big);
    function close() {
      veil.remove();
      document.removeEventListener('keydown', close, true);
    }
    veil.addEventListener('click', close);
    document.addEventListener('keydown', close, true);
    document.body.appendChild(veil);
  }

  function renderCoach() {
    if (!coach) return;
    if (!run) { coach.hidden = true; coach.innerHTML = ''; return; }
    var tut = tutorial(run.id);
    var steps = tut.steps;
    var step = steps[run.step];
    coach.hidden = false;
    coach.innerHTML = '';
    coach.classList.toggle('is-small', !!run.small);

    var head = el('div', 'coach-head');
    head.appendChild(el('span', 'coach-kicker', S.escapeHtml(run.finished
      ? tut.name + ' · finished'
      : tut.name + ' · step ' + (run.step + 1) + ' of ' + steps.length)));
    var fold = el('button', 'icon-btn', run.small ? '+' : '–');
    fold.type = 'button';
    fold.title = run.small ? 'Show the step' : 'Fold away';
    fold.setAttribute('aria-label', fold.title);
    fold.addEventListener('click', function () { run.small = !run.small; save(); renderCoach(); });
    head.appendChild(fold);
    var close = el('button', 'icon-btn', '×');
    close.type = 'button';
    close.title = 'Leave the tutorial — your page stays as it is';
    close.setAttribute('aria-label', 'Leave the tutorial');
    close.addEventListener('click', stop);
    head.appendChild(close);
    coach.appendChild(head);

    var bar = el('div', 'coach-bar');
    var fill = el('i');
    fill.style.width = Math.round((run.finished ? 1 : run.step / steps.length) * 100) + '%';
    bar.appendChild(fill);
    coach.appendChild(bar);

    if (run.small) return;

    if (run.finished) {
      var finish = tut.finish || {
        title: 'That is the whole profile.',
        body: 'Everything you added is ordinary About Me code now: restyle any of it on the right, drag things around, or take parts back out under Insert → Sections.'
      };
      coach.appendChild(el('h3', 'coach-title', S.escapeHtml(finish.title)));
      coach.appendChild(el('div', 'coach-body', finish.body));
      var end = el('div', 'coach-actions');
      end.appendChild(button('Done', 'btn-primary', stop));
      end.appendChild(el('span', 'coach-spacer'));
      end.appendChild(button('Back', 'btn-ghost', function () { run.hold = true; go(steps.length - 1); save(); renderCoach(); }));
      coach.appendChild(end);
      return;
    }

    var isDone = step.done(run.flags);
    coach.appendChild(el('h3', 'coach-title', (isDone ? '<span class="coach-tick">✓</span>' : '') + S.escapeHtml(step.title)));
    coach.appendChild(el('div', 'coach-body', typeof step.body === 'function' ? step.body() : step.body));
    (step.shots || []).forEach(function (shot) {
      var picture = el('img', 'coach-shot');
      picture.alt = shot.alt || '';
      picture.loading = 'lazy';
      // A picture that is missing leaves no hole in the step.
      picture.addEventListener('error', function () { picture.remove(); });
      picture.title = 'Click to enlarge';
      picture.addEventListener('click', function () { zoom(shot); });
      picture.src = shot.src;
      coach.appendChild(picture);
    });

    var actions = el('div', 'coach-actions');
    if (isDone) {
      // Only reached by going Back: a finished step waits to be left again.
      actions.appendChild(button('Next', 'btn-primary', function () { run.hold = false; go(run.step + 1); check(); }));
    } else {
      (step.choices || []).forEach(function (choice) {
        if (choice.when && !choice.when()) return;
        var label = typeof choice.label === 'function' ? choice.label() : choice.label;
        actions.appendChild(button(label, choice.primary ? 'btn-primary' : '', function () {
          choice.run(run.flags);
          check();
        }));
      });
      if (step.show) actions.appendChild(button('Show me', 'btn-primary', step.show));
      if (step.auto) actions.appendChild(button('Do it for me', '', function () { step.auto(); }));
    }
    actions.appendChild(el('span', 'coach-spacer'));
    if (run.step > 0) {
      actions.appendChild(button('Back', 'btn-ghost', function () { run.hold = true; go(run.step - 1); save(); renderCoach(); }));
    }
    if (!isDone && !step.choices) {
      actions.appendChild(button('Skip', 'btn-ghost', function () { run.hold = false; go(run.step + 1); check(); }));
    }
    coach.appendChild(actions);
  }

  // ---------------------------------------------------------------- the list

  function renderList() {
    var host = $('#tutorial-list');
    if (!host) return;
    host.innerHTML = '';
    TUTORIALS.forEach(function (tut) {
      var running = run && run.id === tut.id;
      var card = el('article', 'tutorial' + (running ? ' is-on' : ''));
      card.dataset.tutorial = tut.id;
      card.appendChild(el('div', 'preset-cat', finishedIds[tut.id] && !running ? 'Finished' : 'Tutorial'));
      card.appendChild(el('div', 'preset-name', S.escapeHtml(tut.name)));
      card.appendChild(el('p', 'tutorial-blurb', S.escapeHtml(tut.blurb)));
      card.appendChild(el('div', 'tutorial-meta', S.escapeHtml(running && !run.finished
        ? 'Step ' + (run.step + 1) + ' of ' + tut.steps.length
        : tut.meta)));
      var actions = el('div', 'tutorial-actions');
      if (running) {
        actions.appendChild(button('Start over', '', function () { start(tut.id); }));
        actions.appendChild(button('Leave', 'btn-ghost', stop));
      } else {
        actions.appendChild(button(finishedIds[tut.id] ? 'Do it again' : 'Start', 'btn-primary', function () { start(tut.id); }));
      }
      card.appendChild(actions);
      host.appendChild(card);
    });
  }

  // ------------------------------------------------------------------ wiring

  S.on('change', check);
  S.on('profile:imported', function () {
    if (run) run.flags.imported = true;
    check();
  });
  S.on('info', check);
  S.on('mode', function (mode) {
    if (run && mode === 'preview') run.flags.previewed = true;
    check();
  });
  S.on('frame:slide', function () {
    if (run) run.flags.slid = true;
    check();
  });
  var copyButton = $('#copy-css');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      if (!run) return;
      // Only a step about copying counts; an earlier copy is not it.
      var steps = tutorial(run.id).steps;
      if (!run.finished && /JanitorAI$/.test(steps[run.step].title)) run.flags.copied = true;
      check();
    });
  }

  load();
  renderList();
  renderCoach();

  window.JaiTutorials = {
    list: TUTORIALS,
    start: start,
    stop: stop,
    state: function () { return run; }
  };
})();
