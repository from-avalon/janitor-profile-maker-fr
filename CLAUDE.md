# JanitorAI Profile CSS Studio

A live simulator for JanitorAI profile themes. The preview is the real JanitorAI
profile page (its own DOM and stylesheets, captured), with the user's About Me
HTML injected where JanitorAI injects it. See README.md for what it does.

## This is a static site — keep it that way

- `index.html` + `css/app.css` + nine files in `js/`. **No bundler, no framework,
  no npm dependencies.** `package.json` exists only for its scripts.
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

## Deployment — automatic

Every push to `main` deploys to **https://studio.from-avalon.com** (password-
protected) via `.github/workflows/deploy.yml`. It takes about 30 seconds and
there is nothing to build: the workflow rsyncs `index.html .htaccess css js preview`
to the VPS docroot with `--delete`, so the server always mirrors `main` exactly.

- `.htaccess` (in this repo) holds the auth rule and the cache policy.
- `.htpasswd` lives **on the server**, outside the docroot. Never commit passwords
  or the deploy key; they are GitHub Actions secrets.
- Manual re-deploy: Actions → "Deploy studio" → *Run workflow*.
- Anything not in the rsync list above is never published — build tools, raw
  captures and this file stay in the repo only.

## Conventions

- `.gitattributes` normalises line endings; `*.mhtml` is binary. Leave it.
- Comments in this codebase explain *why*. Match that.
