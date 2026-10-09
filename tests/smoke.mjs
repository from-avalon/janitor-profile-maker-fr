// Smoke test: serve the studio the way tools/serve.py does, open it in a
// headless browser, and check that it actually came up — no JavaScript errors,
// every panel populated, the bundled profile fetched and mounted in the preview.
//
// Run with `npm test`. Needs `npx playwright install chromium` once.
import { spawn } from "node:child_process";
import net from "node:net";
import { chromium } from "playwright";

const PORT = 5199;                     // not 5173, so a running dev server isn't disturbed
const ORIGIN = `http://localhost:${PORT}`;
const THIRD_PARTY = ["fonts.googleapis.com", "fonts.gstatic.com", "picsum.photos", "file.garden",
                     "googletagmanager.com", "google-analytics.com", "analytics.google.com", "doubleclick.net"];

const python = process.platform === "win32" ? "python" : "python3";
const server = spawn(python, ["tools/serve.py", String(PORT)], { stdio: ["ignore", "ignore", "pipe"] });
let serverErr = "";
server.stderr.on("data", (d) => { serverErr += d; });

const failures = [];
const fail = (msg) => failures.push(msg);

try {
  await waitForPort(PORT, 15_000);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pageErrors = [], consoleErrors = [], badResponses = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.origin === ORIGIN && r.status() >= 400) badResponses.push(`${r.status()} ${u.pathname}`);
  });
  page.on("requestfailed", (r) => {
    const u = new URL(r.url());
    if (u.origin === ORIGIN) badResponses.push(`FAILED ${u.pathname} (${r.failure()?.errorText})`);
  });

  // The bundled profile is fetched after the preview iframe finishes loading;
  // its arrival is the last step of start-up.
  const profile = page.waitForResponse(
    (r) => r.url().endsWith("/preview/profiles/default.mhtml"), { timeout: 30_000 });
  const changelog = page.waitForResponse((r) => r.url().endsWith("/CHANGELOG.md"), { timeout: 30_000 });

  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  const profileRes = await profile;
  if (profileRes.status() !== 200) fail(`default.mhtml returned ${profileRes.status()}`);
  const changelogRes = await changelog;
  if (changelogRes.status() !== 200) fail(`CHANGELOG.md returned ${changelogRes.status()}`);

  const preview = page.frames().find((f) => f.url().endsWith("/preview/frame.html"));
  if (!preview) fail("preview iframe (preview/frame.html) did not load");
  else {
    // The captured JanitorAI page has a #root; it appears once mount() has run.
    await preview.waitForSelector("#root", { timeout: 30_000 })
      .catch(() => fail("captured profile was never mounted in the preview (#root missing)"));
  }

  /* global document, window, DOMParser, getComputedStyle, PointerEvent, WheelEvent -- callbacks are serialised and run inside the page */
  const counts = await page.evaluate(() => ({
    layers:        document.querySelectorAll("#layers .layer").length,
    blocks:        document.querySelectorAll("#insert-list .insert-tile").length,
    presets:       document.getElementById("preset-list").children.length,
    templates:     document.getElementById("template-list").children.length,
    reference:     document.getElementById("reference-list").children.length,
    referenceData: Array.isArray(window.JAI_REFERENCE) ? window.JAI_REFERENCE.length : 0,
    editor:        !!document.getElementById("css-input"),
  }));
  if (counts.layers < 10)        fail(`Layers panel looks empty (${counts.layers} rows)`);
  if (counts.blocks < 10)        fail(`Insert panel looks empty (${counts.blocks} blocks)`);
  if (counts.presets === 0)      fail("Presets panel is empty");
  if (counts.templates === 0)    fail("Templates panel is empty");
  if (counts.reference === 0)    fail("Selectors panel is empty");
  if (counts.referenceData < 300) fail(`reference data has only ${counts.referenceData} entries`);
  if (!counts.editor)            fail("editor textarea (#css-input) missing");

  // The saved profile's character-total badge, not a hard-coded sample size,
  // determines the initial number of cards in the preview.
  await page.waitForFunction(() =>
    document.getElementById('profile-import-status')?.textContent.startsWith('Using your profile'),
    { timeout: 30_000 }
  ).catch(() => fail('bundled profile did not finish importing'));
  if (preview) {
    const importedCount = await page.evaluate(() => Number(
      document.querySelector('#profile-fields input[type="number"]')?.value || 0
    ));
    const previewCount = await preview.evaluate(() =>
      document.querySelectorAll('.pp-cc-wrapper').length
    );
    if (!importedCount || importedCount !== previewCount) {
      fail(`profile card total mismatch (field=${importedCount}, preview=${previewCount})`);
    }

    // Design mode swallows clicks (a click is a selection), so the page's own
    // controls are exercised in Preview mode, where it behaves like the page.
    const modeIs = (mode) => preview.waitForFunction(
      (wanted) => document.documentElement.getAttribute('data-sim-mode') === wanted, mode);
    await page.click('#mode-switch button[data-mode="preview"]');
    await modeIs('preview');
    const notifications = await preview.evaluate(() => {
      const panel = document.querySelector('.pp-top-bar-notifications-popover');
      const bell = document.querySelector('.pp-top-bar-notifications-button');
      const close = document.querySelector('.pp-top-bar-notifications-close');
      if (!panel || !bell || !close) return null;
      const startsClosed = panel.hidden && bell.getAttribute('aria-expanded') === 'false';
      bell.click();
      const opens = !panel.hidden && bell.getAttribute('aria-expanded') === 'true';
      close.click();
      const closes = panel.hidden && bell.getAttribute('aria-expanded') === 'false';
      return { startsClosed, opens, closes };
    });
    if (!notifications || !notifications.startsClosed || !notifications.opens || !notifications.closes) {
      fail(`notification popover controls failed (${JSON.stringify(notifications)})`);
    }

    await preview.click('.pp-uc-followers-count');
    if (await page.evaluate(() => !!window.JaiCanvas.selection())) {
      fail('Preview mode still selected an element on click');
    }
    await page.click('#mode-switch button[data-mode="design"]');
    await modeIs('design');

    await canvasChecks(page, preview);

    // MHTML images render from temporary blob URLs in the preview, but Cards
    // must retain their original public address for paste-ready hardcoding.
    const hardcodeImages = await page.evaluate(() => {
      const frame = document.querySelector('#preview');
      const found = window.JaiHardcode.fromDocument(frame && frame.contentDocument);
      const first = found[0] || {};
      const sample = 'https://ella.janitorai.com/bot-avatars/tall.webp';
      const generated = window.JaiHardcode.markup([{ name: 'Tall test', portrait: sample }]);
      return {
        detected: found.length,
        portrait: first.portrait || '',
        art: first.art || '',
        fallbackPortraits: (generated.match(/cs-slot-thumb/g) || []).length,
        fallbackStages: (generated.match(/cs-scene-art/g) || []).length,
        sameFallback: generated.split(sample).length - 1,
      };
    });
    if (!hardcodeImages.detected || !/^https?:\/\//.test(hardcodeImages.portrait) ||
        hardcodeImages.art !== hardcodeImages.portrait) {
      fail(`hardcode detector did not preserve the bot image (${JSON.stringify(hardcodeImages)})`);
    }
    if (hardcodeImages.fallbackPortraits !== 1 || hardcodeImages.fallbackStages !== 1 ||
        hardcodeImages.sameFallback !== 2) {
      fail(`one-image contact fallback failed (${JSON.stringify(hardcodeImages)})`);
    }

    // Pasted hardcoded layouts expose each supported character section and can
    // add a new profile entry without rebuilding unrelated hand-written HTML.
    const hardcodeSections = await page.evaluate(() => {
      const alpha = { name: 'Alpha', link: 'https://janitorai.com/characters/alpha',
        portrait: 'https://example.com/alpha.webp', tags: 'Female, OC', chats: '10' };
      const beta = { name: 'Beta', link: 'https://janitorai.com/characters/beta',
        portrait: 'https://example.com/beta.webp', tags: 'Male, OC', chats: '20' };
      const gamma = { name: 'Gamma', link: 'https://janitorai.com/characters/gamma',
        portrait: 'https://example.com/gamma.webp', tags: 'Female, Angst', chats: '1' };
      let source = window.JaiHardcode.apply('<style>\n</style>', [alpha], { style: 'none' });
      source += '<section class="handwritten"><span>keep me</span>' +
        '<div class="px-film-track">' +
        '<div class="px-frame"><span class="px-frame-name"><b>01</b>Alpha</span></div>' +
        '<div class="px-frame"><span class="px-frame-name"><b>02</b>Beta</span></div>' +
        '<div class="px-frame"><span class="px-frame-name"><b>01</b>Alpha</span></div>' +
        '<div class="px-frame"><span class="px-frame-name"><b>02</b>Beta</span></div></div>' +
        '<span class="px-pane-meta">1 public</span><div class="px-roll">' +
        '<a class="px-roll-row" href="https://janitorai.com/characters/alpha">' +
        '<span class="px-roll-text"><b>Alpha</b></span></a></div></section>';
      const before = window.JaiHardcodeSections.detect(source);
      source = window.JaiHardcodeSections.add(source, 'px-roll:0', [gamma], [alpha, beta, gamma], {}).payload;
      source = window.JaiHardcodeSections.add(source, 'px-film-track:0', [gamma], [alpha, beta, gamma], {}).payload;
      const importedAlpha = { ...alpha, portrait: 'https://example.com/imported-alpha.webp',
        art: 'https://example.com/imported-alpha.webp' };
      source = window.JaiHardcodeSections.add(source, 'generated-selector', [gamma], [importedAlpha, beta, gamma], { style: 'none' }).payload;
      const doc = new DOMParser().parseFromString(source, 'text/html');
      return {
        kinds: before.map((section) => section.kind).sort().join(','),
        selector: doc.querySelectorAll('.cs-slot-live').length,
        archive: doc.querySelectorAll('.px-roll-row').length,
        reel: doc.querySelectorAll('.px-frame').length,
        reelGamma: [...doc.querySelectorAll('.px-frame-name')]
          .filter((node) => node.textContent.includes('Gamma')).length,
        selectorAlpha: doc.querySelector('.cs-slot-alpha .cs-slot-thumb')?.getAttribute('src') || '',
        meta: doc.querySelector('.px-pane-meta')?.textContent || '',
        preserved: doc.querySelector('.handwritten > span')?.textContent || '',
      };
    });
    if (hardcodeSections.kinds !== 'archive,generated,reel' || hardcodeSections.selector !== 2 ||
        hardcodeSections.archive !== 2 || hardcodeSections.reel !== 6 ||
        hardcodeSections.reelGamma !== 2 || hardcodeSections.selectorAlpha !== 'https://example.com/alpha.webp' ||
        hardcodeSections.meta !== '2 public' ||
        hardcodeSections.preserved !== 'keep me') {
      fail(`hardcoded section editing failed (${JSON.stringify(hardcodeSections)})`);
    }
  }

  // Insert is the one library: elements open, everything else collapsed so the
  // panel reads as a short menu. Sections offers the Profile-data layouts ahead
  // of community templates.
  await page.click('button[data-panel="insert"]');
  const presetSections = await page.evaluate(() => ({
    open: [...document.querySelectorAll('.preset-section')].filter((d) => d.open).map((d) => d.id).join(','),
    names: [...document.querySelectorAll('.preset-section-name')].map((n) => n.textContent.trim()),
    layouts: document.querySelectorAll('#layout-list .template').length,
    filters: document.querySelectorAll('.template-filter').length,
    draggable: document.querySelectorAll('#template-list .part.is-draggable').length,
    shapes: document.querySelectorAll('#insert-list .insert-tile[data-block="star"]').length,
    animations: document.querySelectorAll('#animation-list .insert-tile').length,
  }));
  if (presetSections.open !== 'insert-elements') fail(`only Elements should start open (${presetSections.open})`);
  if (presetSections.names.join(',') !== 'Elements,Sections,Styles,Animations,Saved') {
    fail(`insert sections are ${presetSections.names.join(',')}`);
  }
  if (!presetSections.draggable) fail('no template piece can be dragged onto the canvas');
  if (!presetSections.shapes || presetSections.animations < 6) {
    fail(`shapes or animations missing (${JSON.stringify(presetSections)})`);
  }
  if (presetSections.layouts < 2) fail(`profile layouts missing (${presetSections.layouts})`);
  if (presetSections.filters) fail(`template part filters should be gone (${presetSections.filters})`);

  // Template parts add and remove cleanly: a part brings only what it needs,
  // and a dependency it pulled in goes again with it.
  const partsOn = () => page.evaluate(() =>
    [...document.querySelectorAll('.part.is-on')].map((r) => r.dataset.part).sort().join(','));
  const togglePart = (id) => page.evaluate((pid) =>
    document.querySelector(`.part[data-part="${pid}"] button`).click(), id);
  const startParts = await partsOn();
  const withParts = (...ids) => [...(startParts ? startParts.split(',') : []), ...ids].sort().join(',');
  await togglePart('velvet-nocturne-characters');
  if (await partsOn() !== withParts('velvet-nocturne-characters')) {
    fail(`adding Velvet's gallery pulled in other parts (${await partsOn()})`);
  }
  await togglePart('velvet-nocturne-hero');
  if (await partsOn() !== withParts('velvet-nocturne-characters', 'velvet-nocturne-hero', 'velvet-nocturne-layout')) {
    fail(`adding Velvet's hero did not add exactly its layout (${await partsOn()})`);
  }
  await togglePart('velvet-nocturne-hero');
  await togglePart('velvet-nocturne-characters');
  if (await partsOn() !== startParts) fail(`removing Velvet parts left some behind (${await partsOn()})`);
  await page.click('.rail button[data-panel="help"]');
  const help = await page.evaluate(() => ({
    visible: !document.querySelector('section[data-panel="help"]').hidden,
    topics: document.querySelectorAll('.help-panel details').length,
  }));
  if (!help.visible || help.topics < 4) fail(`help panel incomplete (${JSON.stringify(help)})`);

  // The shell: a rail of panels on the left, properties on the right,
  // and the About Me code tucked away in a dock until asked for.
  const panels = await page.evaluate(() => ({
    rail: [...document.querySelectorAll('.rail button[data-panel]')].map((button) => button.dataset.panel),
    inspector: !!document.querySelector('#inspector #inspector-page'),
    topbarButtons: document.querySelectorAll('.topbar button').length,
    codeHidden: document.getElementById('dock').hidden,
  }));
  if (panels.rail.join(',') !== 'layers,insert,info,tutorials,help') fail(`left rail is ${panels.rail.join(',')}`);
  if (!panels.inspector) fail('the properties panel is missing');
  if (panels.topbarButtons > 10) fail(`top bar has grown to ${panels.topbarButtons} buttons`);
  if (!panels.codeHidden) fail('raw code should be hidden initially');

  // Clicking the open panel's icon folds the sidebar away for the largest
  // possible canvas, and its width can be changed by dragging the handle.
  await page.click('.rail button[data-panel="help"]');
  if (!await page.locator('.layout').evaluate((node) => node.classList.contains('sidebar-hidden'))) {
    fail('clicking the open panel did not collapse the sidebar');
  }
  await page.click('.rail button[data-panel="layers"]');
  if (await page.locator('.layout').evaluate((node) => node.classList.contains('sidebar-hidden'))) {
    fail('choosing a panel did not reopen the sidebar');
  }

  const resizeHandle = await page.locator('#resize-sidebar').boundingBox();
  if (!resizeHandle) fail('sidebar resize handle is missing');
  else {
    const startX = resizeHandle.x + 3;
    const startWidth = await page.evaluate(() => document.getElementById('sidebar').offsetWidth);
    await page.locator('#resize-sidebar').dispatchEvent('pointerdown', { clientX: startX });
    await page.evaluate((nextX) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: nextX })), startX + 40);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup')));
    const resizedWidth = await page.evaluate(() => parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')));
    if (resizedWidth < startWidth + 30) fail(`sidebar did not resize (${startWidth}px -> ${resizedWidth}px)`);
  }

  // An actual-size canvas wider than the stage must begin at a reachable left
  // edge and provide a horizontal scroll range.
  await page.click('#zoom-label');
  const canvasPan = await page.evaluate(() => {
    const scroll = document.getElementById('stage-scroll');
    const frame = document.getElementById('stage-frame');
    scroll.scrollLeft = 0;
    const leftAtStart = frame.getBoundingClientRect().left - scroll.getBoundingClientRect().left;
    scroll.scrollLeft = scroll.scrollWidth;
    return { leftAtStart, scrollLeft: scroll.scrollLeft, scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth };
  });
  if (canvasPan.leftAtStart < 10 || canvasPan.scrollWidth <= canvasPan.clientWidth || !canvasPan.scrollLeft) {
    fail(`wide preview cannot pan horizontally (${JSON.stringify(canvasPan)})`);
  }
  // Still at 100%: the + button steps the zoom, and Ctrl/Cmd-wheel is captured
  // by the canvas instead of changing the browser's page zoom.
  await page.click('#zoom-in');
  const canvasZoom = await page.evaluate(() => {
    const stepped = window.JaiStudio.scale();
    const event = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, cancelable: true });
    document.getElementById('stage-scroll').dispatchEvent(event);
    return { stepped, wheeled: window.JaiStudio.scale(), prevented: event.defaultPrevented };
  });
  if (canvasZoom.stepped !== 1.1 || canvasZoom.wheeled !== 1.15 || !canvasZoom.prevented) {
    fail(`canvas zoom controls failed (${JSON.stringify(canvasZoom)})`);
  }
  await page.click('#zoom-label');
  if (await page.evaluate(() => window.JaiStudio.state.zoom) !== 'fit') fail('zoom label did not return to fit');

  // The viewport menu resizes the simulated window, never the code.
  if (await page.locator('#viewport-select option').count() < 5) fail('viewport menu is missing sizes');
  await page.selectOption('#viewport-select', 'mobile');
  const mobile = await page.evaluate(() => ({
    width: document.getElementById('preview').style.width,
    notice: !document.getElementById('stage-notice').hidden,
  }));
  if (mobile.width !== '390px' || !mobile.notice) fail(`mobile viewport failed (${JSON.stringify(mobile)})`);
  await page.selectOption('#viewport-select', 'desktop');

  await page.click('#toggle-code');
  if (await page.evaluate(() => document.getElementById('dock').hidden)) {
    fail('Code button did not open the code dock');
  }
  const highlighted = await page.evaluate(() => document.getElementById('highlight').textContent.length);
  if (!highlighted) fail('the code dock opened without its code');
  await page.click('.dock-tabs button[data-dock="reference"]');
  if (await page.evaluate(() => document.querySelector('.dock-pane[data-dock="reference"]').hidden)) {
    fail('Selectors tab did not open in the dock');
  }
  await page.click('.dock-tabs button[data-dock="code"]');
  await page.click('#close-dock');
  if (!await page.evaluate(() => document.getElementById('dock').hidden)) fail('code dock did not close');

  // With nothing selected the right panel is the Page panel: preview-only
  // settings and the profile snapshots.
  await page.evaluate(() => window.JaiCanvas.clear());
  if (await page.evaluate(() => document.getElementById('inspector-page').hidden)) {
    fail('Page panel is not shown when nothing is selected');
  }
  const settings = await page.evaluate(() => ({
    enforce: !!document.getElementById('enforce'),
    import: !!document.getElementById('profile-file'),
    switcher: document.getElementById('profile-switcher'),
    snapshotCount: document.getElementById('profile-switcher')?.options.length || 0,
    cssToggle: document.getElementById('profile-css-toggle')?.textContent || '',
    removeHidden: !!document.getElementById('remove-profile')?.hidden,
  }));
  if (!settings.enforce || !settings.import) fail(`Settings tab incomplete (${JSON.stringify(settings)})`);
  if (!settings.switcher || settings.snapshotCount < 1 || settings.cssToggle !== 'Hide custom CSS' || !settings.removeHidden) {
    fail(`Profile snapshot controls incomplete (${JSON.stringify({
      count: settings.snapshotCount, cssToggle: settings.cssToggle, removeHidden: settings.removeHidden,
    })})`);
  }

  // Profile information opens as a closed table of contents; its characters
  // can be selected as a filtered group and removed in one operation.
  await page.click('button[data-panel="info"]');
  const infoSections = await page.evaluate(() =>
    [...document.querySelectorAll('.info-section')].map((d) => d.id + (d.open ? ':open' : '')));
  if (infoSections.join(',') !== 'info-identity,info-characters,info-about,info-friends,info-socials,info-inventory,info-workshop,info-layout') {
    fail(`Profile information sections are ${infoSections.join(',')}`);
  }
  await page.click('#info-characters > summary');
  await page.click('#cards-add');
  await page.click('#cards-add');
  await page.click('#cards-add');
  await page.click('.card-select');
  const singleSelectedCard = await page.evaluate(() => ({
    count: document.querySelectorAll('.card-select:checked').length,
    label: document.querySelector('#cards-selection-count')?.textContent || '',
    rowOpen: document.querySelector('.card-row')?.open || false,
  }));
  if (singleSelectedCard.count !== 1 || singleSelectedCard.label !== '1 selected' || singleSelectedCard.rowOpen) {
    fail(`single card checkbox could not be selected (${JSON.stringify(singleSelectedCard)})`);
  }
  await page.click('.card-select');
  if (await page.locator('.card-select:checked').count()) {
    fail('single card checkbox could not be deselected');
  }
  await page.click('#cards-select-all');
  const selectedCards = await page.evaluate(() => ({
    count: document.querySelectorAll('.card-select:checked').length,
    label: document.querySelector('#cards-selection-count')?.textContent || '',
    enabled: !document.querySelector('#cards-delete-selected')?.disabled,
  }));
  if (selectedCards.count !== 3 || selectedCards.label !== '3 selected' || !selectedCards.enabled) {
    fail(`card selection controls failed (${JSON.stringify(selectedCards)})`);
  }
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('#cards-delete-selected');
  const cardsAfterDelete = await page.evaluate(() => ({
    rows: document.querySelectorAll('.card-row').length,
    selected: document.querySelectorAll('.card-select:checked').length,
    disabled: document.querySelector('#cards-delete-selected')?.disabled,
  }));
  if (cardsAfterDelete.rows !== 0 || cardsAfterDelete.selected !== 0 || !cardsAfterDelete.disabled) {
    fail(`bulk card deletion failed (${JSON.stringify(cardsAfterDelete)})`);
  }

  // Profile information reads everything the page knows, keeping public image
  // addresses rather than the preview's temporary blob: URLs.
  const infoFound = await page.evaluate(() => {
    const found = window.JaiProfileInfo.fromDocument(document.querySelector('#preview').contentDocument);
    if (!found) return null;
    const first = found.characters[0] || {};
    const links = found.characters.map((c) => c.link);
    return {
      username: found.identity.username, followers: found.identity.followers,
      badges: found.identity.badges.length, badgeImage: (found.identity.badges[0] || {}).image || '',
      characters: found.characters.length, unique: new Set(links).size,
      chats: first.chats, tokens: first.tokens,
    };
  });
  if (!infoFound || !infoFound.username || !infoFound.followers || !infoFound.characters ||
      !infoFound.chats || !infoFound.tokens) {
    fail(`profile information import is incomplete (${JSON.stringify(infoFound)})`);
  } else {
    if (infoFound.badges && !/^https?:\/\//.test(infoFound.badgeImage)) {
      fail(`badge images must keep their public address (${infoFound.badgeImage})`);
    }
    if (infoFound.unique !== infoFound.characters) {
      fail(`preview filler cards were read as characters (${JSON.stringify(infoFound)})`);
    }
  }

  // Dark Red is materialised from Profile information on use, rather than
  // retaining Hime's example name, prose, contact links, friend cards or art.
  await page.click('#info-identity > summary');
  await page.locator('[data-identity="username"]').fill('Nyx Vale');
  await page.locator('[data-identity="avatar"]').fill('https://example.com/nyx.png');
  await page.locator('[data-identity="followers"]').fill('321');
  await page.locator('[data-identity="characterCount"]').fill('8');
  await page.locator('[data-identity="memberSince"]').fill('Oct 2025');
  await page.click('#info-about > summary');
  await page.locator('[data-about="title"]').fill('After dark');
  await page.locator('[data-about="body"]').fill('Midnight stories and dangerous choices.');
  await page.locator('[data-about="notes"]').fill('Read the content notes first.');
  await page.click('#info-friends > summary');
  await page.click('[data-add="friends"]');
  await page.locator('.info-list[data-list="friends"] [data-field="name"]').fill('Mira');
  await page.locator('.info-list[data-list="friends"] [data-field="link"]').fill('https://janitorai.com/profiles/mira');
  await page.click('#info-socials > summary');
  await page.click('[data-add="socials"]');
  await page.locator('.info-list[data-list="socials"] [data-field="label"]').fill('Discord');
  await page.locator('.info-list[data-list="socials"] [data-field="link"]').fill('https://discord.gg/nyx');
  await page.click('button[data-panel="insert"]');
  await page.click('#presets-layouts > summary');
  await page.locator('.template[data-template="hime-darkred"] .template-actions button').click();
  const darkRed = await page.evaluate(() => {
    const code = document.getElementById('css-input').value;
    return {
      firstName: code.includes('content: "Nyx";'),
      lastName: code.includes('content: "Vale";'),
      avatar: code.includes('src="https://example.com/nyx.png" class="sona"'),
      about: code.includes('Midnight stories and dangerous choices.'),
      notes: code.includes('Read the content notes first.'),
      social: code.includes('href="https://discord.gg/nyx"'),
      friend: code.includes('Mira'),
      placeholder: code.includes("content: 'USER';") || code.includes("content: 'NAME';"),
    };
  });
  if (!darkRed.firstName || !darkRed.lastName || !darkRed.avatar || !darkRed.about ||
      !darkRed.notes || !darkRed.social || !darkRed.friend || darkRed.placeholder) {
    fail(`Dark Red did not use Profile information (${JSON.stringify(darkRed)})`);
  }

  // Imported MHTML captures are stored in IndexedDB alongside their editor
  // state. Returning to the studio restores only the last selected capture,
  // so it must not also fetch/mount the bundled Sweepercom capture.
  await page.setInputFiles('#profile-file-info', 'preview/profiles/default.mhtml');
  await page.waitForFunction(() =>
    document.getElementById('profile-import-status')?.textContent.includes('will reopen from local storage'),
    { timeout: 30_000 }
  ).catch(() => fail('imported profile was not saved locally'));
  const activeImportedId = await page.locator('#profile-switcher').inputValue();
  if (!activeImportedId.startsWith('profile-')) fail(`import did not become active (${activeImportedId})`);
  await page.evaluate(() => {
    const editor = document.getElementById('css-input');
    editor.value += '\n/* local-profile-sentinel */';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // Metadata writes are intentionally batched while typing.
  await page.waitForTimeout(350);

  let bundledRequestsOnRestore = 0;
  const countBundledRestoreRequest = (request) => {
    if (request.url().endsWith('/preview/profiles/default.mhtml')) bundledRequestsOnRestore++;
  };
  page.on('request', countBundledRestoreRequest);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() =>
    document.getElementById('profile-import-status')?.textContent.includes('Restored') &&
    document.getElementById('profile-switcher')?.value.startsWith('profile-'),
    { timeout: 30_000 }
  ).catch(() => fail('last imported profile was not restored after reload'));
  page.off('request', countBundledRestoreRequest);
  const restoredImportedId = await page.locator('#profile-switcher').inputValue();
  if (restoredImportedId !== activeImportedId) {
    fail(`reload selected ${restoredImportedId}, expected ${activeImportedId}`);
  }
  if (!await page.locator('#css-input').inputValue().then((value) => value.includes('local-profile-sentinel'))) {
    fail('editor changes to the saved profile did not survive reload');
  }
  if (bundledRequestsOnRestore) {
    fail(`bundled default profile was fetched ${bundledRequestsOnRestore} time(s) while restoring an import`);
  }

  // Importing the same capture again refreshes the saved snapshot instead of
  // filling the switcher with duplicate entries. Existing editor work stays
  // attached to that profile.
  await page.setInputFiles('#profile-file-info', 'preview/profiles/default.mhtml');
  await page.waitForFunction(() =>
    document.getElementById('profile-import-status')?.textContent.includes('Refreshed'),
    { timeout: 30_000 }
  ).catch(() => fail('re-importing the same profile did not refresh its snapshot'));
  const refreshedSnapshot = await page.evaluate(() => ({
    active: document.getElementById('profile-switcher')?.value || '',
    imported: Array.from(document.querySelectorAll('#profile-switcher option'))
      .filter((option) => option.value.startsWith('profile-'))
      .map((option) => option.value),
    keptCss: document.getElementById('css-input')?.value.includes('local-profile-sentinel') || false,
  }));
  if (refreshedSnapshot.active !== activeImportedId ||
      refreshedSnapshot.imported.length !== 1 ||
      refreshedSnapshot.imported[0] !== activeImportedId) {
    fail(`same-file re-import created a duplicate (${JSON.stringify(refreshedSnapshot)})`);
  }
  if (!refreshedSnapshot.keptCss) fail('refreshing a saved profile discarded its editor changes');

  // Browser storage is repaired as one logical metadata+file collection. An
  // orphaned switcher record and the older of two matching captures disappear
  // before app startup can offer either one.
  const libraryRepair = await page.evaluate(async () => {
    const capture = new File(['repair capture'], 'repair.mhtml', {
      type: 'multipart/related',
      lastModified: 123,
    });
    const base = {
      label: 'Repair profile @repair',
      filename: 'repair.mhtml',
      data: {},
      code: '',
      sourceCode: '',
      sourceKey: 'repair.mhtml|14|123',
      cssEnabled: true,
    };
    await window.JaiProfileLibrary.put({ ...base, id: 'repair-old', createdAt: 1 }, capture);
    await window.JaiProfileLibrary.put({ ...base, id: 'repair-new', createdAt: 2 }, capture);
    await window.JaiProfileLibrary.update({ ...base, id: 'repair-orphan', sourceKey: 'orphan', createdAt: 3 });
    const records = await window.JaiProfileLibrary.list();
    const result = { ids: records.map((record) => record.id), removed: records.removedCount || 0 };
    await Promise.all(['repair-old', 'repair-new', 'repair-orphan'].map((id) =>
      window.JaiProfileLibrary.remove(id)));
    return result;
  });
  if (!libraryRepair.ids.includes('repair-new') || libraryRepair.ids.includes('repair-old') ||
      libraryRepair.ids.includes('repair-orphan') || libraryRepair.removed !== 2) {
    fail(`saved-profile repair left duplicate or incomplete records (${JSON.stringify(libraryRepair)})`);
  }

  // Link previews: the Open Graph image is served and the tags point at it.
  const og = await page.request.get(`${ORIGIN}/assets/link-preview.png`);
  if (og.status() !== 200 || !(og.headers()["content-type"] || "").includes("image/png")) fail(`assets/link-preview.png: ${og.status()} ${og.headers()["content-type"]}`);
  const ogTags = await page.evaluate(() => ({
    image: document.querySelector('meta[property="og:image"]')?.content || "",
    title: document.querySelector('meta[property="og:title"]')?.content || "",
    card:  document.querySelector('meta[name="twitter:card"]')?.content || "",
  }));
  if (!ogTags.image.endsWith("/assets/link-preview.png")) fail(`og:image is "${ogTags.image}"`);
  if (!ogTags.title)                             fail("og:title missing");
  if (ogTags.card !== "summary_large_image")     fail(`twitter:card is "${ogTags.card}"`);

  // The default view is a stranger's: nothing only the owner would see.
  const visitor = await page.evaluate(() => {
    // Through the element, not a frame handle: the page has reloaded since.
    const doc = document.getElementById('preview').contentDocument;
    return {
      owner: [...doc.querySelectorAll('.sim-owner-only')].map((node) => doc.defaultView.getComputedStyle(node).display),
      follow: !!doc.querySelector('.pp-uc-follow-button')?.getClientRects().length,
    };
  });
  if (visitor.owner.length < 2 || visitor.owner.some((d) => d !== 'none') || !visitor.follow) {
    fail(`the default preview is not a visitor's view (${JSON.stringify(visitor)})`);
  }

  // Tutorials: starting one puts its step over the canvas, a step ticks itself
  // off when the document says it is done, and leaving takes the card away.
  await page.evaluate(() => window.JaiStudio.setCode('', 'load', { now: true }));
  await page.click('.rail button[data-panel="tutorials"]');
  await page.click('#tutorial-list .tutorial[data-tutorial="golden-hour"] button');
  await page.waitForTimeout(250);
  const lesson = () => page.evaluate(() => window.JaiTutorials.state()?.step ?? null);
  const firstStep = await lesson();
  await page.click('#coach button:has-text("Show me")');
  await page.waitForTimeout(300);
  const pointedAt = await page.evaluate(() => document.querySelector('.tut-pulse')?.dataset.part || null);
  await page.click('#coach button:has-text("Do it for me")');
  await page.waitForTimeout(450);
  if (firstStep !== 1 || pointedAt !== 'golden-hour-backdrop' || (await lesson()) !== 2) {
    fail(`the tutorial did not walk its first steps (start ${firstStep}, pointed at ${pointedAt}, then ${await lesson()})`);
  }
  await page.click('#coach button[aria-label="Leave the tutorial"]');
  if (!(await page.locator('#coach').isHidden())) fail('leaving a tutorial left its card on the canvas');

  // The Steam profile: a layout with markup of its own, built from Profile
  // data. Characters come from the preview, the showcases from the roster, and
  // a choice in the panel reaches the document.
  await page.evaluate(() => window.JaiStudio.setCode('', 'load', { now: true }));
  await page.click('.rail button[data-panel="info"]');
  await page.click('#info-fill');
  await page.evaluate(() => { document.getElementById('info-layout').open = true; });
  await page.selectOption('#cards-opt-style', 'steam');
  await page.click('#cards-insert');
  await page.waitForTimeout(450);
  await page.selectOption('#cards-opt-steamFrame', 'gold');
  await page.waitForTimeout(600);
  const steam = await page.evaluate(() => {
    const doc = document.getElementById('preview').contentDocument;
    const code = window.JaiStudio.code();
    return {
      favourite: !!doc.querySelector('.sp-fav-name')?.textContent.trim(),
      tiles: doc.querySelectorAll('.sp-tile').length,
      optionsShown: !document.getElementById('steam-options').hidden,
      frame: /\.pp-uc-avatar-container::before \{/.test(code),
      blob: /blob:/.test(code),
      issues: window.JaiStudio.issues().length,
    };
  });
  if (!steam.favourite || steam.tiles < 1 || !steam.optionsShown || !steam.frame || steam.blob || steam.issues) {
    fail(`the Steam profile layout did not build cleanly (${JSON.stringify(steam)})`);
  }
  // Choosing another design replaces the one before. Instagram-style is the
  // Golden Hour template's own parts, so Insert → Sections shows them added.
  await page.selectOption('#cards-opt-style', 'photo-feed');
  await page.waitForTimeout(700);
  const swapped = await page.evaluate(() => {
    const code = window.JaiStudio.code();
    const parts = window.JaiPresets.allParts().filter((part) => part.id.startsWith('golden-hour-'));
    return {
      parts: parts.filter((part) => window.JaiPresets.isPartApplied(code, part)).length,
      of: parts.length,
      generated: window.JaiHardcode.isApplied(code),
      card: document.querySelector('.template[data-template="golden-hour"]')?.classList.contains('is-on'),
      pick: document.getElementById('cards-opt-style').value,
      issues: window.JaiStudio.issues().length,
    };
  });
  if (swapped.parts !== swapped.of || swapped.generated || !swapped.card || swapped.pick !== 'photo-feed' || swapped.issues) {
    fail(`switching designs did not replace one with the other (${JSON.stringify(swapped)})`);
  }
  await page.evaluate(() => window.JaiStudio.setCode('', 'load', { now: true }));

  // The changelog dialog: opens from the toolbar and renders at least one entry.
  await page.click("#changelog-toggle");
  const dialog = await page.evaluate(() => {
    const d = document.getElementById("changelog");
    return { open: !!(d && d.open), entries: d ? d.querySelectorAll(".changelog-entry").length : 0 };
  });
  if (!dialog.open)        fail("changelog dialog did not open");
  if (dialog.entries < 1)  fail("changelog dialog rendered no entries");
  await page.keyboard.press("Escape");

  const ownConsoleErrors = consoleErrors.filter((t) => !THIRD_PARTY.some((h) => t.includes(h)));
  if (pageErrors.length)       fail(`JavaScript errors: ${pageErrors.join(" | ")}`);
  if (ownConsoleErrors.length) fail(`console errors: ${ownConsoleErrors.join(" | ")}`);
  if (badResponses.length)     fail(`same-origin request failures: ${badResponses.join(", ")}`);

  console.log(`panels: layers=${counts.layers} blocks=${counts.blocks} presets=${counts.presets} templates=${counts.templates} selectors=${counts.reference} (data=${counts.referenceData})`);
  console.log(`preview: profile ${profileRes.status()}, mounted=${!failures.some((f) => f.includes("mounted"))}`);
  console.log(`changelog: ${changelogRes.status()}, dialog open=${dialog.open}, entries=${dialog.entries}`);
  console.log(`previews: link-preview.png ${og.status()}, og:title="${ogTags.title}", twitter:card=${ogTags.card}`);
  console.log(`errors: page=${pageErrors.length} console=${ownConsoleErrors.length}${consoleErrors.length !== ownConsoleErrors.length ? ` (+${consoleErrors.length - ownConsoleErrors.length} third-party, ignored)` : ""} requests=${badResponses.length}`);

  await browser.close();
} catch (e) {
  fail(`test crashed: ${e.message}`);
} finally {
  server.kill();
}

if (serverErr.trim()) console.log(`serve.py stderr:\n${serverErr.trim()}`);
if (failures.length) { console.error("\nSMOKE TEST FAILED"); for (const f of failures) console.error(` - ${f}`); process.exit(1); }
console.log("\nsmoke test passed");

/*
 * The canvas, driven the way a person drives it: real pointer presses in the
 * preview, real keys. Each step checks the About Me document afterwards,
 * because that — not the preview — is what gets pasted into JanitorAI.
 */
async function canvasChecks(page, preview) {
  const code = () => page.evaluate(() => window.JaiStudio.code());
  const markup = async () => (await code()).split('</style>').pop();
  const selection = () => page.evaluate(() => {
    const s = window.JaiCanvas.selection();
    return s ? { kind: s.kind, jx: s.jx, name: s.name, target: s.target } : null;
  });
  const settle = (ms = 250) => page.waitForTimeout(ms);
  const original = await code();
  await page.evaluate(() => window.JaiStudio.setCode(window.JaiPayload.STARTER, 'test', { now: true }));

  // Clicking a piece of JanitorAI's page selects it and fills the properties
  // panel; setting a property writes a rule against its label class.
  await preview.click('.pp-uc-title');
  await page.waitForSelector('#inspector-selection:not([hidden])');
  const picked = await page.evaluate(() => ({
    title: document.querySelector('#inspector-selection .insp-title')?.textContent || '',
    selector: document.getElementById('insp-selector')?.value || '',
    layer: document.querySelector('#layers .layer.is-selected .layer-name')?.textContent || '',
    placeholder: document.querySelector('#inspector-selection [data-prop="font-size"] input')?.placeholder || '',
    pageHidden: document.getElementById('inspector-page').hidden,
  }));
  if (picked.title !== 'Username' || picked.selector !== '.pp-uc-title' || picked.layer !== 'Username' ||
      !/px$/.test(picked.placeholder) || !picked.pageHidden) {
    fail(`clicking the username did not select it (${JSON.stringify(picked)})`);
  }
  await page.fill('#inspector-selection [data-prop="font-size"] input', '41');
  await page.keyboard.press('Enter');
  await settle(450);
  const styled = {
    rule: /\.pp-uc-title \{\s*font-size: 41px;\s*\}/.test(await code()),
    computed: await preview.evaluate(() => getComputedStyle(document.querySelector('.pp-uc-title')).fontSize),
  };
  if (!styled.rule || styled.computed !== '41px') fail(`a property did not reach the document and the preview (${JSON.stringify(styled)})`);

  // Blocks go in by click (after the selection, or at the end of About Me)…
  await page.click('.rail button[data-panel="insert"]');
  await page.click('.insert-tile[data-block="heading"]');
  await settle();
  await page.click('.insert-tile[data-block="text"]');
  await settle();
  await page.click('.insert-tile[data-block="box"]');
  await settle();
  const inserted = await markup();
  const order = (text) => ['jx-heading', 'jx-text', 'jx-box', 'jx-button']
    .filter((cls) => text.includes(cls)).sort((a, b) => text.indexOf(a) - text.indexOf(b)).join(',');
  if (order(inserted) !== 'jx-heading,jx-text,jx-box') fail(`click-to-insert order is ${order(inserted)}`);
  if ((await selection())?.name !== 'Box') fail('the inserted block was not selected');
  if (await page.evaluate(() => window.JaiStudio.issues().length)) fail('inserted blocks are not lint-clean');

  // …or by dragging a tile onto the canvas: here, into the empty Box.
  const tile = await page.locator('.insert-tile[data-block="button"]').boundingBox();
  const box = await preview.locator('.jx-box').boundingBox();
  await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await page.mouse.down();
  await page.mouse.move(tile.x + 60, tile.y + 30, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  await settle(120);
  const dropShown = await preview.evaluate(() => document.getElementById('sim-drop').style.display === 'block');
  await page.mouse.up();
  await settle();
  if (!dropShown) fail('no drop indicator while dragging a block over the canvas');
  if (!/<div class="jx-box jx-\w+"><a class="jx-button jx-\w+"[^>]*>Button<\/a><\/div>/.test(await markup())) {
    fail(`dragging a block into a container did not nest it (${await markup()})`);
  }

  // Dragging an element on the canvas moves it in the document.
  const heading = await preview.locator('.jx-heading').boundingBox();
  const text = await preview.locator('.jx-text').boundingBox();
  await page.mouse.move(heading.x + 30, heading.y + heading.height / 2);
  await page.mouse.down();
  await page.mouse.move(heading.x + 40, heading.y + heading.height / 2 + 10, { steps: 3 });
  await page.mouse.move(text.x + 40, text.y + text.height - 3, { steps: 8 });
  await page.mouse.up();
  await settle();
  if (order(await markup()) !== 'jx-text,jx-heading,jx-box,jx-button') {
    fail(`dragging the heading below the text gave ${order(await markup())}`);
  }
  if ((await selection())?.name !== 'Heading') fail('the moved element lost the selection');

  // Double-click retypes text in place, and the result is escaped markup.
  const moved = await preview.locator('.jx-heading').boundingBox();
  await page.mouse.dblclick(moved.x + 40, moved.y + moved.height / 2);
  await settle(150);
  await page.keyboard.type('Rock & roll <3');
  await page.keyboard.press('Enter');
  await settle();
  if (!(await markup()).includes('>Rock &amp; roll &lt;3</h2>')) fail(`retyped text was not written back (${await markup()})`);

  // The corner handle resizes; the size lands on the element's own class.
  await preview.click('.jx-box', { position: { x: 5, y: 5 } });
  await settle(150);
  const handle = await preview.locator('sim-handle[data-handle="se"]').boundingBox();
  await page.mouse.move(handle.x + 2, handle.y + 2);
  await page.mouse.down();
  await page.mouse.move(handle.x - 60, handle.y + 40, { steps: 6 });
  await page.mouse.up();
  await settle(450);
  const sized = /\.(jx-\w+) \{\s*width: \d+px;\s*height: \d+px;\s*\}/.exec(await code());
  if (!sized || !isInstanceClass(sized[1])) fail('resizing did not write width and height to the element\'s own class');

  // Duplicate keeps the look but not the identity; Delete and Undo do what
  // they say, one step at a time.
  await page.keyboard.press('Control+d');
  await settle();
  const boxes = await page.evaluate(() => {
    const classes = [...document.getElementById('preview').contentDocument.querySelectorAll('.jx-box')]
      .map((node) => [...node.classList].filter((c) => c !== 'jx-box').join(' '));
    return { count: classes.length, distinct: new Set(classes).size };
  });
  if (boxes.count !== 2 || boxes.distinct !== 2) fail(`duplicate did not make an independent copy (${JSON.stringify(boxes)})`);
  const widths = await preview.evaluate(() =>
    [...document.querySelectorAll('.jx-box')].map((node) => Math.round(node.getBoundingClientRect().width)));
  if (widths[0] !== widths[1]) fail(`the duplicate lost its styling (${widths.join(' vs ')})`);
  await page.keyboard.press('Delete');
  await settle();
  if (await preview.locator('.jx-box').count() !== 1) fail('Delete did not remove the selected element');
  await page.keyboard.press('Control+z');
  await settle();
  if (await preview.locator('.jx-box').count() !== 2) fail('Undo did not bring the deleted element back');

  // Dragging one of JanitorAI's own elements slides it instead: the press
  // lands on the word "Follow", the button's wrapper is what moves, and the
  // whole gesture is one rule and one Undo.
  const beforeSlide = await code();
  const follow = await preview.locator('.pp-uc-follow-button').boundingBox();
  await page.mouse.move(follow.x + follow.width / 2, follow.y + follow.height / 2);
  await page.mouse.down();
  await page.mouse.move(follow.x + follow.width / 2 + 20, follow.y + follow.height / 2 + 8, { steps: 4 });
  await page.mouse.move(follow.x + follow.width / 2 + 44, follow.y + follow.height / 2 + 18, { steps: 4 });
  await page.mouse.up();
  await settle(450);
  const slid = /\.pp-uc-follow-flex \{\s*position: relative;\s*left: (\d+)px;\s*top: (\d+)px;\s*\}/.exec(await code());
  const followAfter = await preview.locator('.pp-uc-follow-button').boundingBox();
  if (!slid || +slid[1] < 20 || +slid[2] < 8) fail(`sliding the Follow button did not write its offset (${(await code()).slice(-200)})`);
  if (Math.abs(followAfter.x - follow.x - 44) > 2 || Math.abs(followAfter.y - follow.y - 18) > 2) {
    fail(`the Follow button did not follow the pointer (${followAfter.x - follow.x}, ${followAfter.y - follow.y})`);
  }
  await page.keyboard.press('Control+z');
  await settle();
  if ((await code()) !== beforeSlide) fail('one Undo did not take back a slide');

  // Layers lists the creator's elements under About Me and selects from there.
  await page.click('.rail button[data-panel="layers"]');
  const customRows = await page.locator('#layers .layer.is-custom').count();
  if (customRows < 5) fail(`Layers shows ${customRows} of the creator's elements`);
  await page.locator('#layers .layer.is-custom', { hasText: 'Rock & roll' }).click();
  await settle();
  if ((await selection())?.name !== 'Heading') fail('selecting from Layers did not select the element');

  // Right-click offers to add something exactly there. The menu is the
  // studio's own, drawn outside the (scaled) preview.
  const rock = await preview.locator('.jx-heading').boundingBox();
  await page.mouse.click(rock.x + 30, rock.y + rock.height - 3, { button: 'right' });
  await page.waitForSelector('.menu');
  await page.locator('.menu .menu-item', { hasText: 'Add here' }).hover();
  await page.locator('.menu').nth(1).locator('.menu-item', { hasText: 'Small label' }).waitFor({ state: 'attached', timeout: 2000 })
    .catch(() => {});
  await page.locator('.menu').nth(1).locator('.menu-item', { hasText: /^Text$/ }).first().click();
  await settle();
  if (await page.locator('.menu').count()) fail('the right-click menu stayed open after choosing');
  const afterMenu = await markup();
  if (!/<\/h2>\s*<p class="jx-text jx-\w+">/.test(afterMenu)) {
    fail(`"Add here → Text" did not add a text block after the heading (${afterMenu})`);
  }

  // A shape, and an animation applied to it: one declaration on its own class,
  // plus the keyframes it names, once.
  await page.click('.rail button[data-panel="insert"]');
  await page.click('.insert-tile[data-block="circle"]');
  await settle();
  await page.click('#presets-animations > summary');
  await page.click('#animation-list [data-animation="pulse"]');
  await settle(450);
  const animated = await page.evaluate(() => {
    const text = window.JaiStudio.code();
    return {
      keyframes: (text.match(/@keyframes jx-pulse/g) || []).length,
      rule: /\.jx-\w+ \{\s*animation: jx-pulse[^}]*\}/.test(text),
      on: document.querySelector('#animation-list [data-animation="pulse"]').classList.contains('is-on'),
      clean: window.JaiStudio.issues().length === 0,
    };
  });
  const animationName = await preview.evaluate(() => getComputedStyle(document.querySelector('.jx-circle')).animationName);
  if (animated.keyframes !== 1 || !animated.rule || !animated.on || !animated.clean || animationName !== 'jx-pulse') {
    fail(`animation was not applied to the selection (${JSON.stringify(animated)}, computed ${animationName})`);
  }
  await page.click('#animation-list [data-animation="pulse"]');
  await settle(450);
  if (/animation: jx-pulse/.test(await code())) fail('clicking an applied animation did not take it off');
  await page.click('#presets-animations > summary');

  // Every element in the library survives JanitorAI: put each into a fresh
  // document the way inserting does, and the linter must have nothing to say.
  // Also: tokens all resolved, ids unique, and every shared class named (an
  // unnamed one would be styled in place of the element's own class) and styled.
  const library = await page.evaluate(() => {
    const B = window.JaiBlocks, L = window.JaiLint, P = window.JaiPayload, M = window.JaiMarkup;
    const problems = [];
    for (const block of B.list) {
      const given = B.tokens(block, P.STARTER);
      const html = B.instantiate(block, P.STARTER, given);
      const doc = P.editCss(P.STARTER + html + '\n', (css) => B.addCss(css, block, given));
      const parsed = M.parse(doc);
      const ids = parsed.nodes.map((n) => M.attrValue(n, 'id')).filter(Boolean);
      const shared = new Set();
      parsed.nodes.forEach((n) => n.classes.forEach((c) => { if (!M.isInstanceClass(c)) shared.add(c); }));
      const css = P.allCss(doc);
      const found = [
        ...L.analysePayload(doc).map((i) => i.title),
        ...(doc.match(/\{[tu]\d*\}/g) || []).map((t) => 'unresolved ' + t),
        ...(ids.length === new Set(ids).size ? [] : ['duplicate ids']),
        ...[...shared].filter((c) => !B.names[c]).map((c) => 'unnamed class ' + c),
        ...[...shared].filter((c) => !css.includes('.' + c) && !/-(name|text)$/.test(c)).map((c) => 'unstyled class ' + c),
      ];
      if (found.length) problems.push(block.id + ': ' + found.join('; '));
    }
    return { count: B.list.length, problems, animations: B.animations.map((a) => a.id) };
  });
  if (library.problems.length) fail(`library elements are not JanitorAI-safe:\n    ${library.problems.join('\n    ')}`);
  if (library.count < 40) fail(`the element library shrank to ${library.count}`);
  const motionTile = await page.evaluate(() => !!document.querySelector('#insert-list .insert-tile[data-block="tabs"]') &&
    !!document.querySelector('#animation-list [data-animation="bounce"]'));
  if (!motionTile) fail('the showcase elements and animations are not in the Insert panel');

  // A template piece dragged onto the canvas lands where it was dropped, and
  // brings the stylesheet it depends on.
  await page.click('#presets-layouts > summary');
  await page.locator('.template[data-template="hime-darkred"] .template-parts > summary').click();
  const piece = page.locator('.part.is-draggable[data-part="hime-darkred-status"]');
  await piece.scrollIntoViewIfNeeded();
  const pieceBox = await piece.boundingBox();
  const target = await preview.locator('.jx-heading').boundingBox();
  await page.mouse.move(pieceBox.x + 40, pieceBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(pieceBox.x + 90, pieceBox.y + 30, { steps: 4 });
  await page.mouse.move(target.x + 40, target.y + 3, { steps: 10 });
  await settle(120);
  await page.mouse.up();
  await settle(500);
  const placed = await page.evaluate(() => {
    const text = window.JaiStudio.code();
    return {
      before: text.indexOf('status-box') !== -1 && text.indexOf('class="status-box"') < text.indexOf('class="jx-heading'),
      css: window.JaiPayload.allCss(text).includes('.status-box'),
      on: document.querySelector('.part[data-part="hime-darkred-status"]').classList.contains('is-on'),
    };
  });
  if (!placed.before || !placed.css || !placed.on) fail(`dragging a template piece failed (${JSON.stringify(placed)})`);
  await page.locator('.template[data-template="hime-darkred"] .template-parts > summary').click();
  await page.click('#presets-layouts > summary');

  await linkedLayoutChecks(page, preview, settle);
  await pageLayoutChecks(page, preview, settle);

  await page.evaluate((text) => {
    window.JaiCanvas.clear();
    window.JaiStudio.setCode(text, 'test', { now: true });
  }, original);
}

/*
 * A layout generated from Profile data is linked to it: rebuilt whenever that
 * changes. The canvas does not refuse edits inside one — it unlinks the layout
 * first so the edit stays, says so, and Undo links it back.
 */
async function linkedLayoutChecks(page, preview, settle) {
  const linked = await page.evaluate(() => {
    const M = window.JaiMarkup;
    const source = window.JaiHardcode.apply('<style>\n</style>\n<p>mine</p>',
      [{ name: 'Alpha', link: 'https://janitorai.com/characters/alpha' }], { style: 'none' });
    const parsed = M.parse(source);
    const root = parsed.nodes.find((n) => n.locked);
    const beside = M.insert(source, '<img src="https://example.com/x.png">', root.id, 'after');
    const added = M.parse(beside.payload).nodes[beside.id];
    const free = M.unlink(source);
    window.JaiStudio.setCode(source, 'test', { now: true });
    return {
      own: parsed.nodes.filter((n) => !n.locked).map((n) => n.tag).join(','),
      generated: parsed.nodes.filter((n) => n.locked).length,
      marked: (M.tagged(source).match(/data-jx-lock/g) || []).length,
      besideStaysOutside: added.tag === 'img' && !added.locked && M.isLinked(beside.payload),
      insideNeedsUnlink: M.landsInLock(parsed, root.id, 'inside') && !M.landsInLock(parsed, root.id, 'after'),
      unlinked: !free.includes('@jai:hardcode') && free.includes('cs-shell') &&
        M.parse(free).nodes.length === parsed.nodes.length && !M.parse(free).nodes.some((n) => n.locked),
    };
  });
  if (linked.own !== 'p' || !linked.generated || linked.marked !== linked.generated) {
    fail(`generated markup is not marked as linked (${JSON.stringify(linked)})`);
  }
  if (!linked.besideStaysOutside || !linked.insideNeedsUnlink || !linked.unlinked) {
    fail(`linked-layout placement or unlinking is wrong (${JSON.stringify(linked)})`);
  }

  // Deleting something inside the linked layout: it goes, the layout unlinks.
  await settle(300);
  await preview.click('.cs-slot-live');
  await settle();
  const picked = await page.evaluate(() => {
    const s = window.JaiCanvas.selection();
    return s && { locked: s.locked, jx: s.jx };
  });
  if (!picked || !picked.locked) fail(`a linked element was not selected as linked (${JSON.stringify(picked)})`);
  // Whatever part of the tile was under the pointer is what goes; count elements.
  const slots = () => page.evaluate(() => window.JaiStudio.markup().nodes.length);
  const slotsBefore = await slots();
  await page.keyboard.press('Delete');
  await settle();
  const after = await page.evaluate(() => ({
    linked: window.JaiMarkup.isLinked(window.JaiStudio.code()),
    toast: document.getElementById('toast').textContent,
  }));
  if (after.linked || await slots() >= slotsBefore || !/Unlinked/.test(after.toast)) {
    fail(`deleting inside a linked layout did not unlink it (${JSON.stringify(after)}, ${await slots()} of ${slotsBefore} elements left)`);
  }
  await page.keyboard.press('Control+z');
  await settle();
  const relinked = await page.evaluate(() => window.JaiMarkup.isLinked(window.JaiStudio.code()));
  if (!relinked || await slots() !== slotsBefore) fail('Undo did not link the layout back');

  // Duplicating Tabs: the copy has to answer to its own anchors. If the ids were
  // left alone, both sets would share `#id`s and switch together (or not at all).
  await page.evaluate(() => {
    window.JaiStudio.setCode(window.JaiPayload.STARTER, 'test', { now: true });
    window.JaiCanvas.insertBlock(window.JaiBlocks.get('tabs'), null, 'inside');
  });
  await settle(500);
  await page.evaluate(() => {
    const tabs = window.JaiMarkup.parse(window.JaiStudio.code()).nodes.find((n) => n.classes.includes('jx-tabs'));
    window.JaiCanvas.selectCustom(tabs.id);
  });
  await settle(500);
  await page.evaluate(() => window.JaiCanvas.run('duplicate'));
  await settle(600);
  const copied = await page.evaluate(() => {
    const M = window.JaiMarkup, code = window.JaiStudio.code(), parsed = M.parse(code);
    const sets = parsed.nodes.filter((n) => n.classes.includes('jx-tabs'));
    const ids = parsed.nodes.map((n) => M.attrValue(n, 'id')).filter(Boolean);
    const own = sets.map((set) => parsed.nodes.filter((n) => n.parent === set.id && n.classes.includes('jx-tabs-key')).map((n) => M.attrValue(n, 'id')));
    const css = window.JaiPayload.allCss(code);
    return {
      sets: sets.length,
      unique: ids.length === new Set(ids).size,
      disjoint: own.length === 2 && !own[0].some((id) => own[1].includes(id)),
      ruled: own.every((keys) => keys.slice(1).every((id) => css.includes('#' + id + ':target'))),
    };
  });
  if (copied.sets !== 2 || !copied.unique || !copied.disjoint || !copied.ruled) {
    fail(`a duplicated Tabs set does not have anchors and rules of its own (${JSON.stringify(copied)})`);
  }
  await page.click('button[title^="Preview"]');
  await settle(400);
  const pickTab = async (set, n) => {
    await preview.locator('.jx-tabs').nth(set).locator('.jx-tabs-tab-' + n).click();
    await settle(250);
    return preview.evaluate(() => [...document.querySelectorAll('.jx-tabs')].map((t) =>
      [...t.querySelectorAll('.jx-tabs-pane')].map((p) => (getComputedStyle(p).display === 'block' ? 1 : 0)).join('')).join(' '));
  };
  // Each set answers to its own anchors. A page has one :target at a time, so
  // opening a tab in one set sends the other back to its first tab — that is the
  // technique's limit, and what the Tabs hint tells the creator.
  const second = await pickTab(1, 3);
  const first = await pickTab(0, 2);
  if (second !== '100 001' || first !== '010 100') {
    fail(`a duplicated Tabs set does not follow its own links (after set 2 → tab 3: "${second}", then set 1 → tab 2: "${first}")`);
  }
}

/*
 * Page layout: the profile box and the character list. Everything is driven the
 * way a person would drive it — a preset tile, the grip on a section, the
 * gutter between them, rows in Layers, the right-click menu — and judged by
 * where the two actually end up in the preview.
 */
async function pageLayoutChecks(page, preview, settle) {
  const seen = () => page.evaluate(() => window.JaiPageLayout.measure());
  const declared = () => page.evaluate(() => window.JaiPageLayout.declared());
  const blocks = () => page.evaluate(() => (window.JaiStudio.code().match(/@jai:layout:start/g) || []).length);
  const fresh = async () => {
    await page.evaluate(() => {
      window.JaiCanvas.clear();
      window.JaiStudio.setCode(window.JaiPayload.STARTER, 'test', { now: true });
    });
    await settle(900);
  };
  const brief = (m) => m && `${m.direction}/${m.first}`;

  await page.click('#mode-switch button[data-mode="design"]');
  await fresh();
  if (brief(await seen()) !== 'row/profile' || await blocks()) fail(`the page does not start in JanitorAI's own layout (${brief(await seen())})`);

  // A preset tile is one edit: it applies, undoes in one step, and applying it
  // twice leaves one block, not two.
  await page.click('.pl-tile[data-preset="stack"]:visible');
  await settle(900);
  const stacked = { seen: brief(await seen()), blocks: await blocks() };
  await page.click('.pl-tile[data-preset="stack"]:visible');
  await settle(500);
  if (stacked.seen !== 'column/profile' || stacked.blocks !== 1 || await blocks() !== 1) {
    fail(`"Profile on top" did not stack the profile box over the characters (${JSON.stringify(stacked)})`);
  }
  await page.click('#undo');
  await settle(800);
  if (brief(await seen()) !== 'row/profile' || await blocks()) fail('Undo did not take a whole layout preset back in one step');
  await page.click('#redo');
  await settle(500);
  await page.click('.pl-tile[data-preset="side"]:visible');
  await settle(900);
  if (await blocks() || brief(await seen()) !== 'row/profile') fail('going back to "Side by side" did not remove the layout block');

  // The grip: pick up the profile box, put it on the bottom of the characters.
  const profile = await preview.locator('.pp-uc-background').boundingBox();
  await page.mouse.move(profile.x + profile.width / 2, profile.y + profile.height / 2);
  await settle(300);
  const grip = await preview.locator('#sim-grip').boundingBox();
  if (!grip) fail('hovering the profile box did not show its grip');
  else {
    const characters = await preview.locator('.profile-page-container-flex-box').boundingBox();
    const stage = await page.locator('#preview').boundingBox();
    const aim = { x: characters.x + characters.width / 2, y: Math.min(characters.y + characters.height, stage.y + stage.height) - 8 };
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + 40, grip.y + 40, { steps: 4 });
    await page.mouse.move(aim.x, aim.y, { steps: 10 });
    const zone = await preview.evaluate(() => ({
      kind: document.getElementById('sim-drop').getAttribute('data-kind'),
      shown: document.getElementById('sim-drop').style.display,
      label: document.getElementById('sim-ghost').textContent,
    }));
    await page.mouse.up();
    await settle(1000);
    if (zone.kind !== 'zone' || zone.shown !== 'block' || !/below Characters/.test(zone.label)) {
      fail(`dragging the grip did not show where it would land (${JSON.stringify(zone)})`);
    }
    if (brief(await seen()) !== 'column/characters') fail(`dropping the profile box below the characters gave ${brief(await seen())}`);
  }
  await page.click('.pl-actions button:visible');
  await settle(800);
  if (await blocks() || brief(await seen()) !== 'row/profile') fail('"Reset layout" did not put the page back');

  // The gutter between them: dragging it sets the profile box's share of the row.
  const again = await preview.locator('.pp-uc-background').boundingBox();
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
  await settle(300);
  const gutter = await preview.locator('#sim-split').boundingBox();
  if (!gutter) fail('hovering the profile box beside the characters did not show the gutter handle');
  else {
    await page.mouse.move(gutter.x + gutter.width / 2, gutter.y + 20);
    await page.mouse.down();
    await page.mouse.move(gutter.x + gutter.width / 2 + 40, gutter.y + 20, { steps: 8 });
    await page.mouse.up();
    await settle(1000);
    const mine = await declared();
    const real = await seen();
    if (mine.split == null || Math.abs(real.split - mine.split) > 1.5) {
      fail(`dragging the gutter did not give the profile box the share it was dragged to (declared ${mine.split}%, measured ${real.split}%)`);
    }
    if (real.first !== 'profile' || real.direction !== 'row') fail('dragging the gutter changed the arrangement');
  }
  await fresh();

  // Rows in Layers swap the two: the characters dragged above the profile box.
  await page.evaluate(() => window.JaiStudio.showPanel('layers'));
  await settle(400);
  const row = (name) => page.locator('#layers .layer', { hasText: name }).first().boundingBox();
  const from = await row('Characters');
  const to = await row('Profile box');
  if (!from || !to) fail('Layers does not list the profile box and the characters');
  else {
    await page.mouse.move(from.x + 60, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y - 12, { steps: 5 });
    await page.mouse.move(to.x + 60, to.y + 3, { steps: 6 });
    await page.mouse.up();
    await settle(1000);
    if (brief(await seen()) !== 'row/characters') fail(`dragging Characters above Profile box in Layers gave ${brief(await seen())}`);
  }
  await fresh();

  // A template that forces the two to stack must not leave "Side by side" doing
  // nothing; and the row is for desktop widths only, so a phone keeps stacking.
  await page.evaluate(() => window.JaiStudio.setCode('<style>\n.profile-page-flex { display: block !important; }\n</style>\n<div>x</div>', 'test', { now: true }));
  await settle(1000);
  const forced = brief(await seen());
  await page.evaluate(() => window.JaiPageLayout.choose('side'));
  await settle(1000);
  const asked = brief(await seen());
  const text = await page.evaluate(() => window.JaiStudio.code());
  if (forced !== 'column/profile' || asked !== 'row/profile' || !/@media screen and \(min-width: 62em\)/.test(text)) {
    fail(`"Side by side" did not override a template that stacks the page (${forced} -> ${asked})`);
  }
  await page.selectOption('#viewport-select', 'mobile');
  await settle(1200);
  const phone = brief(await seen());
  await page.selectOption('#viewport-select', 'desktop');
  await settle(800);
  if (phone !== 'column/profile') fail(`the side-by-side row also applied at a phone width (${phone})`);

  // Right-click offers it too, from anywhere on the page.
  await fresh();
  await preview.locator('.pp-uc-title').click({ button: 'right' });
  await settle(400);
  const menu = await page.evaluate(() => [...document.querySelectorAll('.menu .menu-item')].map((b) => b.textContent.trim()));
  // (Escape would go to the preview's document, where the right-click landed.)
  await page.evaluate(() => window.JaiMenu.close());
  if (!menu.some((label) => /^Page layout/.test(label))) fail(`the right-click menu has no Page layout (${menu.join(' | ')})`);
}

/* The studio's own per-element classes carry a digit; a block's shared class
 * (jx-text) never does. Mirrors JaiMarkup.isInstanceClass. */
function isInstanceClass(cls) { return /^jx-(?=[a-z0-9]*\d)[a-z0-9]{4}$/.test(cls); }

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function attempt() {
      const s = net.createConnection({ port, host: "127.0.0.1" });
      s.once("connect", () => { s.destroy(); resolve(); });
      s.once("error", () => { s.destroy(); Date.now() > deadline ? reject(new Error(`server not listening on ${port}`)) : setTimeout(attempt, 250); });
    })();
  });
}
