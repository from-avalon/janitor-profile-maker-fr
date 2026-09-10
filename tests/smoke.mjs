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
const THIRD_PARTY = ["fonts.googleapis.com", "fonts.gstatic.com", "picsum.photos", "file.garden"];

const server = spawn("python3", ["tools/serve.py", String(PORT)], { stdio: ["ignore", "ignore", "pipe"] });
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

  /* global document, window -- this callback is serialised and run inside the page */
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
