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

  /* global document, window, getComputedStyle, PointerEvent, WheelEvent -- this callback is serialised and run inside the page */
  const counts = await page.evaluate(() => ({
    controls:      document.querySelectorAll("#control-groups *").length,
    presets:       document.getElementById("preset-list").children.length,
    templates:     document.getElementById("template-list").children.length,
    reference:     document.getElementById("reference-list").children.length,
    referenceData: Array.isArray(window.JAI_REFERENCE) ? window.JAI_REFERENCE.length : 0,
    editor:        !!document.getElementById("css-input"),
  }));
  if (counts.controls < 50)      fail(`Design panel looks empty (${counts.controls} elements)`);
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

    // Selection mode turns the preview into a canvas: clicking an element
    // focuses the right inspector and narrows it to relevant visual controls.
    await page.click('#inspect-toggle');
    await preview.click('.pp-uc-title');
    await page.waitForFunction(() =>
      document.querySelector('#inspector-selection')?.classList.contains('has-selection'));
    const selectedInspector = await page.evaluate(() => ({
      label: document.querySelector('.inspector-selection-label')?.textContent || '',
      visibleControls: [...document.querySelectorAll('#control-groups .ctrl')]
        .filter((node) => node.style.display !== 'none').length,
      designVisible: !document.querySelector('section[data-workspace-panel="design"]').hidden,
    }));
    if (!selectedInspector.label.includes('pp-uc-title') || !selectedInspector.visibleControls ||
        !selectedInspector.designVisible) {
      fail(`selection did not focus the inspector (${JSON.stringify(selectedInspector)})`);
    }
    await page.click('#inspector-show-all');
    await page.click('#inspect-toggle');

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
  }

  // Advanced template parts can be narrowed to a specific profile region, and
  // the long-form guidance lives in the top utility bar instead of the left rail.
  await page.click('button[data-panel="presets"]');
  await page.locator('.preset-section').nth(1).locator(':scope > summary').click();
  const filterCount = await page.locator('.template-filter').count();
  if (filterCount < 2) fail(`template element filters missing (${filterCount})`);
  await page.getByRole('button', { name: 'Character cards', exact: true }).click();
  const filtered = await page.evaluate(() => ({
    active: document.querySelector('.template-filter.is-active')?.textContent,
    parts: document.querySelectorAll('.part').length,
    open: document.querySelector('.template-parts')?.open,
  }));
  if (filtered.active !== 'Character cards' || filtered.parts === 0 || !filtered.open) {
    fail(`template filter did not narrow parts (${JSON.stringify(filtered)})`);
  }

  // Template parts add and remove cleanly: a part brings only what it needs,
  // and a dependency it pulled in goes again with it.
  await page.getByRole('button', { name: 'All parts', exact: true }).click();
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
  await page.click('.workspace-tool[data-workspace-panel="help"]');
  const help = await page.evaluate(() => ({
    visible: !document.querySelector('section[data-workspace-panel="help"]').hidden,
    topics: document.querySelectorAll('.help-panel details').length,
  }));
  if (!help.visible || help.topics < 4) fail(`help panel incomplete (${JSON.stringify(help)})`);

  // The Figma-style shell keeps only three content tabs on the left. Design is
  // the permanent right inspector; View, Selectors and Help live in the toolbar.
  const panels = await page.evaluate(() => ({
    left: [...document.querySelectorAll('.sidebar-tabs button')].map((button) => button.textContent.trim()),
    designRight: !!document.querySelector('#inspectorpane #control-groups'),
    utilities: document.querySelectorAll('.workspace-tool[data-workspace-panel]').length,
    codeHidden: document.querySelector('.layout').classList.contains('code-hidden'),
  }));
  if (panels.left.join(',') !== 'Presets,Cards,Settings') fail(`left rail is ${panels.left.join(',')}`);
  if (!panels.designRight) fail('Design controls are not in the right inspector');
  if (panels.utilities !== 3) fail(`top utility menu has ${panels.utilities} items`);
  if (!panels.codeHidden) fail('raw code should be hidden initially');

  // Both rails can get out of the way when someone needs the largest possible
  // live preview, and their desktop widths can be changed by dragging handles.
  await page.click('#toggle-sidebar');
  if (!await page.locator('.layout').evaluate((node) => node.classList.contains('sidebar-hidden'))) {
    fail('library hide button did not collapse the left rail');
  }
  await page.click('#toggle-sidebar');
  await page.click('#toggle-inspector');
  if (!await page.locator('.layout').evaluate((node) => node.classList.contains('inspector-hidden'))) {
    fail('properties hide button did not collapse the right rail');
  }
  await page.click('#toggle-inspector');

  const resizeHandle = await page.locator('#resize-sidebar').boundingBox();
  if (!resizeHandle) fail('library resize handle is missing');
  else {
    const startX = resizeHandle.x + 3;
    await page.locator('#resize-sidebar').dispatchEvent('pointerdown', { clientX: startX });
    await page.evaluate((nextX) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: nextX })), startX + 40);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup')));
    const resizedWidth = await page.evaluate(() => parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')));
    if (resizedWidth < 340) fail(`library did not resize (${resizedWidth}px)`);
  }

  // An actual-size canvas wider than the stage must begin at a reachable left
  // edge and provide a horizontal scroll range.
  await page.click('#stage-zoom');
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
  await page.click('#stage-zoom');

  // The slider provides precise manual zoom, while Ctrl/Cmd-wheel is captured
  // by the canvas instead of changing the browser's page zoom.
  await page.locator('#stage-zoom-slider').evaluate((input) => {
    input.value = '125';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const canvasZoom = await page.evaluate(() => {
    const slider = document.getElementById('stage-zoom-slider');
    const event = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, cancelable: true });
    document.getElementById('stage-scroll').dispatchEvent(event);
    return { value: Number(slider.value), prevented: event.defaultPrevented };
  });
  if (canvasZoom.value !== 130 || !canvasZoom.prevented) {
    fail(`canvas zoom controls failed (${JSON.stringify(canvasZoom)})`);
  }

  await page.click('.workspace-tool[data-workspace-panel="view"]');
  const viewportButtons = await page.locator('.viewport-switch button').count();
  if (viewportButtons < 5) fail(`View utility is missing the viewport switch (${viewportButtons} buttons)`);

  await page.click('#show-code');
  if (await page.locator('.layout').evaluate((node) => node.classList.contains('code-hidden'))) {
    fail('Code toolbar button did not open the editor');
  }
  await page.click('#toggle-code');

  await page.click('button[data-panel="profile"]');
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

  // Cards can be selected as a filtered group and removed in one operation.
  await page.click('button[data-panel="cards"]');
  await page.click('#cards-add');
  await page.click('#cards-add');
  await page.click('#cards-add');
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

  // Link previews: the Open Graph image is served and the tags point at it.
  const og = await page.request.get(`${ORIGIN}/assets/og.png`);
  if (og.status() !== 200 || !(og.headers()["content-type"] || "").includes("image/png")) fail(`assets/og.png: ${og.status()} ${og.headers()["content-type"]}`);
  const ogTags = await page.evaluate(() => ({
    image: document.querySelector('meta[property="og:image"]')?.content || "",
    title: document.querySelector('meta[property="og:title"]')?.content || "",
    card:  document.querySelector('meta[name="twitter:card"]')?.content || "",
  }));
  if (!ogTags.image.endsWith("/assets/og.png")) fail(`og:image is "${ogTags.image}"`);
  if (!ogTags.title)                             fail("og:title missing");
  if (ogTags.card !== "summary_large_image")     fail(`twitter:card is "${ogTags.card}"`);

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

  console.log(`panels: design=${counts.controls} presets=${counts.presets} templates=${counts.templates} selectors=${counts.reference} (data=${counts.referenceData})`);
  console.log(`preview: profile ${profileRes.status()}, mounted=${!failures.some((f) => f.includes("mounted"))}`);
  console.log(`changelog: ${changelogRes.status()}, dialog open=${dialog.open}, entries=${dialog.entries}`);
  console.log(`previews: og.png ${og.status()}, og:title="${ogTags.title}", twitter:card=${ogTags.card}`);
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
