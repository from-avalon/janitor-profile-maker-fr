/* global document, window, localStorage, getComputedStyle */
// Behavioral and layout checks for the complete profile in the real captured
// Janitor DOM, with the same sanitizer the studio uses for pasted profiles.
// Requires the local studio server. node tests/proxy-terminal.mjs [origin]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] || 'http://localhost:5173';
const payload = await fs.readFile('templates/proxy-terminal/source.txt', 'utf8');
const assetNames = await fs.readdir('preview/assets');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
try {
  // Use the saved copies during QA, so network availability cannot conceal a
  // layout failure. Exported HTML still contains the original public URLs.
  await context.route('https://ella.janitorai.com/**', async route => {
    const base = new URL(route.request().url()).pathname.split('/').pop();
    const stem = base.replace(/\.[^.]+$/, '');
    const local = assetNames.find(name => name === base || name.startsWith(stem + '-'));
    if (local) await route.fulfill({ path: 'preview/assets/' + local });
    else await route.continue();
  });
  const studio = await context.newPage();
  await studio.goto(origin);
  await studio.waitForFunction(() => document.querySelector('#profile-import-status')?.textContent.startsWith('Using your profile'));
  const hardcode = await studio.evaluate(() => {
    const styleIds = window.JaiHardcodeStyles.list.map(style => style.id);
    const markup = window.JaiHardcode.markup([
      { name: 'Editable contact', portrait: 'https://ella.janitorai.com/bot-avatars/test.webp' }
    ], {
      style: 'proxy-terminal', profileLabel: 'MY CHANNEL', profileMark: 'EDITABLE',
      aboutTitle: 'My about screen', aboutBody: 'My creator copy', creatorNotes: 'My notes',
      friendsTitle: 'My friends', discord: 'https://example.com/social', footerText: 'My footer'
    });
    const css = window.JaiHardcodeStyles.css('proxy-terminal', {
      accent: '#d7f22a', ink: '#11150d', preview: '#e4ff82', profileLabel: 'MY CHANNEL', profileMark: 'EDITABLE'
    });
    return { styleIds, markup, css };
  });
  assert(hardcode.styleIds.includes('proxy-terminal'), 'Proxy Terminal appears in Cards styles');
  for (const text of ['content: "MY CHANNEL";', 'content: "EDITABLE";']) {
    assert(hardcode.css.includes(text), `Editable field reaches generated style: ${text}`);
  }
  for (const text of ['My about screen', 'My creator copy', 'My notes', 'My friends', 'example.com/social', 'My footer']) {
    assert(hardcode.markup.includes(text), `Editable field reaches generated output: ${text}`);
  }
  assert(hardcode.markup.includes('zz-navigation') && hardcode.markup.includes('zz-agents'), 'Hardcoding emits the game menu shell');
  await studio.locator('button[data-panel="info"]').click();
  assert(await studio.locator('#cards-opt-style option[value="proxy-terminal"]').count(), 'Profile information lists Proxy Terminal');
  await studio.locator('#info-layout > summary').click();
  await studio.locator('#cards-opt-style').selectOption('proxy-terminal');
  await studio.locator('#info-about > summary').click();
  await studio.locator('[data-about="title"]').fill('Edited from Profile information');
  const savedInfo = await studio.evaluate(() => JSON.parse(localStorage.getItem('jai-css-studio:profile-info')));
  assert.equal(savedInfo.layout.style, 'proxy-terminal');
  assert.equal(savedInfo.about.title, 'Edited from Profile information');
  const people = await studio.evaluate(() => window.JaiHardcode.markup(
    [{ name: 'Contact', portrait: 'https://ella.janitorai.com/bot-avatars/test.webp' }],
    { style: 'proxy-terminal', username: 'Tester',
      friends: [{ name: 'Mira', image: 'https://example.com/mira.webp', link: 'https://janitorai.com/profiles/mira', note: 'Writes dragons' },
        { name: 'No link' }],
      socials: [{ label: 'Ko-fi', link: 'https://ko-fi.com/tester' }, { link: 'https://bsky.app/profile/tester' }],
      sections: [{ title: 'Boundaries', body: 'Line one\nLine two' }] }));
  for (const text of ['zz-friend-link" href="https://janitorai.com/profiles/mira"', 'src="https://example.com/mira.webp"',
    '<article class="zz-friend">', '>Ko-fi <b>', '>bsky.app <b>', '<summary>Boundaries</summary><p>Line one<br>Line two</p>',
    'PROXY TERMINAL / TESTER']) {
    assert(people.includes(text), `Profile information reaches Proxy Terminal: ${text}`);
  }
  assert(!people.includes('Open channel / 01'), 'Real friends replace the open slots');
  const snapshot = await studio.evaluate(code => {
    const doc = document.querySelector('#preview').contentDocument;
    const css = [...code.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
    const html = code.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    const roster = window.JaiHardcode.fromDocument(doc).map(card => ({ ...card, hover: card.art }));
    const opts = { style: 'proxy-terminal', slots: roster.length, accent: '#d7f22a', ink: '#11150d', preview: '#e4ff82' };
    const root = doc.querySelector('#root').cloneNode(true);
    const bio = root.querySelector('.pp-uc-about-me');
    if (bio) bio.innerHTML = '';
    return { root: root.outerHTML, importedCss: doc.querySelector('#jai-imported-css').textContent,
      css: window.JaiLint.sanitise(window.JaiHardcodeStyles.css('proxy-terminal', opts) + '\n' + window.JaiHardcode.css(roster, opts)),
      html: window.JaiLint.sanitisePayload(window.JaiHardcode.markup(roster, opts)),
      issues: window.JaiLint.analyse(css).concat(window.JaiLint.analyseHtml(html)) };
  }, payload);
  assert.equal(snapshot.issues.length, 0, JSON.stringify(snapshot.issues));
  const page = await context.newPage();
  await page.goto(origin + '/preview/frame.html');
  await page.locator('#root').waitFor();
  await page.evaluate(data => {
    window.postMessage({ type: 'profile', html: data.root, css: data.importedCss }, '*');
    window.postMessage({ type: 'data', data: { viewMode: 'visitor' } }, '*');
    window.postMessage({ type: 'payload', css: data.css, html: data.html }, '*');
  }, snapshot);
  await page.locator('.zz-agents').first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.cs-scene-art')].every(img => img.complete && img.naturalWidth));
  assert.equal(await page.locator('.cs-slot-live').count(), 25);
  const rect = locator => locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  async function assertControls() {
    for (const selector of ['.pp-top-bar-app-menu', '.pp-uc-follow-button', '.pp-uc-options-menu']) {
      assert(await page.locator(selector).first().isVisible(), `${selector} must remain visible`);
    }
    assert(await page.locator('.pp-top-bar-search-input, #search-input').first().isVisible(), 'Native search visible');
    const follows = await rect(page.locator('.pp-uc-follow-button'));
    const options = await rect(page.locator('.pp-uc-options-menu'));
    assert(follows.y < 340 && options.y < 340, 'Profile actions stay beside the header');
    assert(await page.locator('.pp-uc-options-menu').evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), 'Options receives pointer hits');
  }
  await assertControls();
  await fs.mkdir('artifacts/proxy-terminal', { recursive: true });
  await page.screenshot({ path: 'artifacts/proxy-terminal/desktop.png', fullPage: true });

  for (const [tab, screen] of [['about', 'about'], ['friends', 'friends'], ['links', 'links']]) {
    await page.locator('.zz-tab-' + tab).click();
    assert(await page.locator('.zz-' + screen + '-screen').isVisible(), tab + ' opens');
    assert(!(await page.locator('.zz-agents').isVisible()), 'Agents hidden on personal screens');
    await page.screenshot({ path: 'artifacts/proxy-terminal/' + tab + '.png', fullPage: true });
  }
  await page.locator('.zz-tab-agents').click();
  const tile = page.locator('.cs-slot-live').nth(1);
  const target = await tile.getAttribute('href');
  await tile.click();
  await page.mouse.move(5, 5);
  assert.equal(new URL(page.url()).hash, target, 'Tile persists selection');
  const selectedId = target.slice(5);
  assert.equal(await page.locator('.cs-art-' + selectedId).evaluate(el => getComputedStyle(el).opacity), '1');
  const firstId = (await page.locator('.cs-slot-live').first().getAttribute('href')).slice(5);
  assert.equal(await page.locator('.cs-art-' + firstId).evaluate(el => getComputedStyle(el).opacity), '0');
  assert.equal(await page.locator('.cs-identity').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').length), 1, 'Only the selected identity is visible');
  await page.screenshot({ path: 'artifacts/proxy-terminal/selected.png', fullPage: true });
  await page.locator('.cs-filter').nth(1).click();
  const visibleFiltered = await page.locator('.cs-slot-live:visible').count();
  assert(visibleFiltered > 0 && visibleFiltered <= 25, 'Tag filtering keeps matching contacts');
  await page.locator('.cs-filter-all').click();
  assert.equal(await page.locator('.cs-slot-live:visible').count(), 25);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await assertControls();
  const before = await rect(page.locator('.cs-shell'));
  const imageChecks = await page.locator('.cs-slot-thumb, .cs-scene-art').evaluateAll(images => images.map(img => ({
    fit: getComputedStyle(img).objectFit, position: getComputedStyle(img).objectPosition,
    width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height
  })));
  assert(imageChecks.every(img => img.fit === 'cover' && img.position === '50% 50%' && img.width > 0 && img.height > 0));
  // Extreme aspect ratio regression: a 1000 x 3000 source must not change layout.
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 3000;
    canvas.getContext('2d').fillRect(0, 0, 1000, 3000);
    const image = document.querySelector('.cs-scene-art');
    image.src = canvas.toDataURL(); await image.decode();
  });
  assert.deepEqual(await rect(page.locator('.cs-shell')), before, 'Tall image cannot resize stage');
  await page.locator('.cs-slot-live').nth(1).click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!overflow, 'Mobile has no horizontal page overflow');
  await page.screenshot({ path: 'artifacts/proxy-terminal/mobile.png', fullPage: true });
  await page.locator('.zz-tab-about').click();
  assert(await page.locator('.zz-about-screen').isVisible());
  await page.screenshot({ path: 'artifacts/proxy-terminal/mobile-about.png', fullPage: true });
  console.log('Proxy Terminal passed: sanitizer, 25 images, native controls, all screens, selection, filters, mobile and tall-image bounds.');
} finally { await browser.close(); }
