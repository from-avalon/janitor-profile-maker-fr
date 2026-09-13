/* global document, window */
// Rebuild Proxy Terminal from its editable layout and the bundled profile's
// actual cards. The public image addresses survive MHTML's offline blob URLs.
// Run against the local studio: node tools/build-proxy-profile.mjs [origin]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = process.argv[2] || 'http://localhost:5173';
const folder = path.join(root, 'templates/proxy-terminal');
const browser = await chromium.launch();
let generated;
try {
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#profile-import-status')?.textContent.startsWith('Using your profile'));
  generated = await page.evaluate(() => {
    const doc = document.querySelector('#preview').contentDocument;
    const unique = new Map();
    window.JaiHardcode.fromDocument(doc).forEach(card => {
      if (card.link && !unique.has(card.link)) unique.set(card.link, card);
    });
    const roster = [...unique.values()].map(card => ({ ...card, hover: card.art }));
    const opts = { style: 'proxy-terminal', title: 'Agent\nSelect', kicker: 'Choose a contact', status: 'Personal collection',
      launch: 'Connect / Open encounter ↗', slots: roster.length, accent: '#d7f22a',
      ink: '#11150d', preview: '#e4ff82', filters: true, filterLimit: 5 };
    const markers = window.JaiHardcode.markers;
    return { roster, opts,
      html: markers.htmlStart + window.JaiHardcode.markup(roster, opts) + markers.htmlEnd,
      css: markers.cssStart + '\n' + window.JaiHardcode.css(roster, opts) + '\n' + markers.cssEnd };
  });
} finally { await browser.close(); }
if (!generated.roster.length || generated.roster.some(card => !card.art)) {
  throw new Error('Every included contact must have a publishable bot image.');
}
const layout = await fs.readFile(path.join(folder, 'layout.html'), 'utf8');
const styleMatch = layout.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('Proxy Terminal layout has no style block.');
const runtimeCss = styleMatch[1]
  .replace(/\/\*\s*@proxy:wiring\s*\*\//g, '')
  .replace('content: "INTER-KNOT  /  CREATOR CHANNEL";', 'content: "__PROFILE_LABEL__";')
  .replace('content: "PROXY";', 'content: "__PROFILE_MARK__";');
const runtimeFile = `/* Generated from templates/proxy-terminal/layout.html. */
(function (global) {
  'use strict';
  function cssText(value) {
    return String(value == null ? '' : value).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
  }
  global.JaiProxyTerminalStyle = function (options) {
    var o = options || {};
    return ${JSON.stringify(runtimeCss)}
      .replace(/#d7f22a/g, o.accent || '#d7f22a')
      .replace(/#11150d/g, o.ink || '#11150d')
      .replace(/#e4ff82/g, o.preview || '#e4ff82')
      .replace(/__PROFILE_LABEL__/g, cssText(o.profileLabel || 'INTER-KNOT / CREATOR CHANNEL'))
      .replace(/__PROFILE_MARK__/g, cssText(o.profileMark || 'PROXY'));
  };
})(window);
`;
await fs.writeFile(path.join(root, 'js/proxy-terminal-style.js'), runtimeFile);
const output = layout.replace('/* @proxy:wiring */', generated.css)
  .replace('<!-- @proxy:roster -->', generated.html);
await fs.writeFile(path.join(folder, 'source.txt'), output);
const artifacts = path.join(root, 'artifacts/proxy-terminal');
await fs.mkdir(artifacts, { recursive: true });
await fs.writeFile(path.join(artifacts, 'proxy-terminal.html'), output);
await fs.writeFile(path.join(artifacts, 'roster.json'), JSON.stringify({ roster: generated.roster, options: generated.opts }, null, 2));

// Use the canonical package compiler. Preserve the other registry entries,
// including work in progress whose source packages may not be available yet.
const compiled = execFileSync('python', ['-c',
  'import json, runpy; m=runpy.run_path("tools/build_template.py"); print(json.dumps(m["package_payload"]("templates/proxy-terminal/manifest.json")))'
], { cwd: root, encoding: 'utf8' });
const registryPath = path.join(root, 'js/templates.js');
const registry = await fs.readFile(registryPath, 'utf8');
const context = { window: {} };
vm.runInNewContext(registry, context);
const entries = context.window.JAI_TEMPLATES;
const template = JSON.parse(compiled);
const at = entries.findIndex(entry => entry.id === template.id);
if (at === -1) entries.push(template); else entries[at] = template;
const preamble = registry.slice(0, registry.indexOf('window.JAI_TEMPLATES'));
await fs.writeFile(registryPath, preamble + 'window.JAI_TEMPLATES = ' + JSON.stringify(entries, null, 1) + ';\n');
console.log(`Proxy Terminal: ${generated.roster.length} contacts, ${output.length} characters; template and paste-ready artifact built.`);
