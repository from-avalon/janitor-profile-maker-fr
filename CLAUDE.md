# JanitorAI Profile CSS Studio

A live simulator for JanitorAI profile themes. The preview is the real JanitorAI
profile page (its own DOM and stylesheets, captured), with the user's About Me
HTML injected where JanitorAI injects it. See README.md for what it does.

## This is a static site — keep it that way

- `index.html` + `css/app.css` + nine files in `js/`. **No bundler, no framework,
  no runtime npm dependencies.** `package.json` holds scripts and lint/test
  tooling under `devDependencies` only.
- Each `js/*.js` file is an IIFE (`(function(){ 'use strict'; … })()`). Files share
  state through globals set on `window` (`window.JAI_TEMPLATES`, `window.JAI_REFERENCE`,
  `window.JaiProfileImport`, …). **The `<script>` order at the bottom of
  `index.html` is load-bearing** — a file can only use globals defined by files
  above it.
- Do not introduce ES modules, a build step, TypeScript, or a framework. The
  `next/` directory is an *optional iframe embed* for a Next.js site, and its
  README explains why the studio stays static even there. Don't port it.

## Running it

A local server is required — the preview iframe must be same-origin, so
`file://` will not work.

    python tools/serve.py 5173      # or double-click run.bat on Windows
    → http://localhost:5173/

`tools/serve.py` sends `Cache-Control: no-store` for code on purpose; plain
`python -m http.server` lets the browser keep running stale JS you just edited.

## `preview/` is captured data, not source

- `preview/profiles/default.mhtml` — a real JanitorAI profile capture (4.7 MB).
  Private; do not replace it with anyone else's profile without asking.
- `preview/vendor/*.css` — JanitorAI's own stylesheets.
- `preview/snapshot.js`, `preview/fragments.js` — **generated** by `tools/*.py`
  (`npm run build:snapshot`, `build:fragments`, `build:reference`, `build:template`).
  Regenerate them; don't hand-edit.
- `preview/snapshot.html` is a build by-product and is gitignored.

The list of CSS JanitorAI strips (the linter's rules) lives in `js/lint.js`.

## Analytics

GA4, measurement ID `G-JEZXRSPHC3` — the shared *Avalon Tools* property; this
tool tags itself `content_group: janitor-profile-maker` (one web stream per
domain, tools told apart by content group). The snippet is in `index.html`;
`reportToHost()` in `js/app.js` sends the studio's named events to it when
standalone, or to the embedding page when in an iframe. **Never send the
creator's CSS** — names and coarse labels only.

## Deployment — automatic

Every push to `main` deploys to **https://tools.from-avalon.com/janitor-profile-maker/** (public)
via `.github/workflows/deploy.yml`. It takes about 30 seconds and
there is nothing to build: the workflow rsyncs `index.html .htaccess CHANGELOG.md assets css js preview`
to the VPS docroot with `--delete`, so the server always mirrors `main` exactly.

- `.htaccess` (in this repo) holds the cache policy, compression, and a fix for
  Apache's `mod_mime_magic` labelling the `.mhtml` with `Content-Encoding: 7bit`
  (browsers reject it and the profile silently fails to load). **The CI smoke
  test cannot see Apache-level problems** — it serves via `tools/serve.py` —
  so check the live headers after touching `.htaccess`. There is no auth; the
  studio is public.
- Never commit the deploy key; it is a GitHub Actions secret.
- `assets/` holds the link-preview image (`og.png`, 1200×630) and the touch icon.
  The Open Graph tags in `index.html` use absolute URLs of the deployed address.
- Manual re-deploy: Actions → "Deploy studio" → *Run workflow*.
- Anything not in the rsync list above is never published — build tools, raw
  captures and this file stay in the repo only.

## Checks

    npm run lint    # eslint, recommended rules; unused-variable findings are warnings
    npm test        # serves the studio, loads it headless, fails on JS errors or empty panels

`npm test` needs `npx playwright install chromium` once. CI runs both on every
pull request and on `main` (`.github/workflows/ci.yml`). The repo is private on
a free org, so a red check **cannot block a merge** — treat it as a signal.

## Conventions

- `.gitattributes` normalises line endings; `*.mhtml` is binary. Leave it.
- Comments in this codebase explain *why*. Match that.
- `CHANGELOG.md`: add a dated entry (`## YYYY-MM-DD — Title` + short prose)
  for anything a user of the studio would notice, in the same pull request as
  the change. Tooling and housekeeping stay out. `js/changelog.js` fetches this
  file at runtime and renders it in the Changelog dialog, so the heading format
  is load-bearing; the file ships with the site (it is in the deploy and
  `sync-to-next` lists).
