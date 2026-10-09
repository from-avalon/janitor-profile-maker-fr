// Renders og.html into the link-preview image and the touch icon.
// usage: node og.mjs <repo> <html> <outdir>
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
const [repo, html, outdir] = process.argv.slice(2);
const require = createRequire(repo + '/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 950 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(pathToFileURL(html).href);
  await page.waitForTimeout(800);
  await page.locator('#og').screenshot({ path: outdir + '/og.png' });
  await page.locator('#icon').screenshot({ path: outdir + '/apple-touch-icon.png' });
  console.log('done');
} finally { await browser.close(); }
