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
    node.classList.remove('tut-pulse');
    void node.offsetWidth;                 // restart the animation if it is mid-run
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
    id: GH,
    name: 'A photo-feed profile',
    blurb: 'Build Golden Hour — the profile that looks like a photo app — one piece at a time: story-ring avatar, stats, highlights that open stories, and your characters as a grid.',
    meta: '11 short steps · about 5 minutes',
    steps: [
      {
        title: 'Start with a blank page',
        body: 'This design replaces the whole page, so it is best built on an empty About Me. Clearing can be undone with <kbd>Ctrl</kbd>+<kbd>Z</kbd>.',
        choices: [
          { label: 'Clear my page', primary: true, run: function (flags) { if (!blank()) S.setCode('', 'tutorial', { now: true }); flags.started = true; } },
          { label: 'Keep what I have', run: function (flags) { flags.started = true; } }
        ],
        enter: function (flags) { if (blank()) flags.started = true; },
        done: function (flags) { return !!flags.started; }
      },
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
      coach.appendChild(el('h3', 'coach-title', 'That is the whole profile.'));
      coach.appendChild(el('div', 'coach-body',
        'Everything you added is ordinary About Me code now: restyle any of it on the right, drag things around, or take parts back out under Insert → Sections.'));
      var end = el('div', 'coach-actions');
      end.appendChild(button('Done', 'btn-primary', stop));
      end.appendChild(el('span', 'coach-spacer'));
      end.appendChild(button('Back', 'btn-ghost', function () { run.hold = true; go(steps.length - 1); save(); renderCoach(); }));
      coach.appendChild(end);
      return;
    }

    var isDone = step.done(run.flags);
    coach.appendChild(el('h3', 'coach-title', (isDone ? '<span class="coach-tick">✓</span>' : '') + S.escapeHtml(step.title)));
    coach.appendChild(el('div', 'coach-body', step.body));

    var actions = el('div', 'coach-actions');
    if (isDone) {
      // Only reached by going Back: a finished step waits to be left again.
      actions.appendChild(button('Next', 'btn-primary', function () { run.hold = false; go(run.step + 1); check(); }));
    } else {
      (step.choices || []).forEach(function (choice) {
        actions.appendChild(button(choice.label, choice.primary ? 'btn-primary' : '', function () {
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
      // Only the last step is about copying; an earlier copy is not it.
      var steps = tutorial(run.id).steps;
      if (!run.finished && run.step === steps.length - 1) run.flags.copied = true;
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
