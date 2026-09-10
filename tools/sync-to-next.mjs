/*
 * Copies the studio into a Next.js project's public/studio/ directory.
 *
 * The studio is deliberately not compiled by Next: it is a static app with its
 * own design, and it runs inside an iframe so Tailwind's preflight cannot reset
 * it. So "integration" is just a file copy, run from the Next project's build.
 *
 * Usage, from the studio repo:
 *   node tools/sync-to-next.mjs ../my-site
 *
 * Or from the Next project, with the studio as a sibling or submodule:
 *   node ../css-studio/tools/sync-to-next.mjs .
 */

import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Everything the browser actually loads. Anything not listed here — the build
// tools, the README, the raw captures — has no business in a public directory.
const INCLUDE = [
  'index.html',
  'CHANGELOG.md',
  'assets',
  'css',
  'js',
  'preview',
];

// Build by-products that live inside those directories.
const EXCLUDE = new Set([
  'preview/snapshot.html',
]);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node tools/sync-to-next.mjs <path-to-next-project>');
    process.exit(1);
  }

  const projectRoot = resolve(process.cwd(), target);
  if (!(await exists(join(projectRoot, 'package.json')))) {
    console.error(`no package.json in ${projectRoot} — is that the Next project?`);
    process.exit(1);
  }

  const destination = join(projectRoot, 'public', 'studio');
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  for (const entry of INCLUDE) {
    const from = join(STUDIO_ROOT, entry);
    if (!(await exists(from))) {
      console.warn(`  ! missing, skipped: ${entry}`);
      continue;
    }
    await cp(from, join(destination, entry), {
      recursive: true,
      filter: (source) => {
        const relative = source.slice(STUDIO_ROOT.length + 1).split('\\').join('/');
        return !EXCLUDE.has(relative);
      },
    });
    console.log(`  copied ${entry}`);
  }

  console.log(`\nstudio -> ${destination}`);
  console.log('route it with next/app/studio/*.tsx, then open /studio');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
