# JanitorAI Profile CSS Studio

A live simulator for JanitorAI profile themes. The preview is the real JanitorAI
profile page (its own DOM and stylesheets, captured), with the user's About Me
HTML injected where JanitorAI injects it. See README.md for what it does.

## This is a static site — keep it that way

- `index.html` + `css/app.css` + the files in `js/`. **No bundler, no framework,
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

## How the canvas is put together

The shell is a design tool: Layers / Insert / Profile data on the
left, the preview as a canvas in the middle, properties on the right, the About
Me code in a dock under the canvas. The document — the About Me text — is still
the only source of truth; every canvas gesture is an edit to that text.

- `js/app.js` is the core (document, undo history, preview bridge, shell, the
  sections/styles lists inside Insert, and the Profile data panel). It exposes `window.JaiStudio`; the canvas
  modules loaded after it (`canvas.js`, `layers.js`, `insert.js`, `inspector.js`)
  use only that and its events (`change`, `selection`, `pushed`, `frame:*`).
  **Write the document only through `JaiStudio.setCode` / `writeValue`**, or
  undo, the linter and the preview will miss the change.
- `js/markup.js` maps the markup to source offsets. Edits (move, insert, remove,
  retype, set attribute) are splices on those offsets, so nothing else in the
  creator's code is reformatted. Its `tagged()` copy puts `data-jx="<id>"` on
  every opening tag **for the preview only** — that is how a click is traced
  back to the text. It must never reach the stored document or the clipboard.
- `preview/frame.js` draws the selection, hover and drop overlays and *reports*
  gestures (`select`, `move`, `textEdit`, `resize`, `insertAt`, `key`…); it never
  edits the page itself. `js/canvas.js` turns each report into a document edit.
  Overlays are `<sim-ui>` elements styled with `!important`, so the creator's
  own `div { … }` rules cannot restyle them.
- Visual edits are written against label classes for JanitorAI's elements, and
  against a per-element class (`jx-` + four characters including a digit) for
  the creator's own. Block base classes (`jx-heading`) are word-like and shared.
- Markup and CSS between the `@jai:hardcode` markers are regenerated from
  Profile data; `markup.js` marks those nodes `locked` ("linked" in the UI).
  Restyling keeps the link (`writeValue` puts the rule *after* the generated
  stylesheet). A structural edit inside one does not get refused: `canvas.js`
  runs it against `JaiMarkup.unlink(code)` — markers removed, content and
  element ids unchanged — so the edit survives, and Undo restores the link.
  Anything placed *beside* a linked block's root goes outside the markers
  (`place()` in markup.js); never write between them by hand.
- Page layout (`js/page-layout.js`) moves the profile box and the character
  list — the two children of `.profile-page-flex`. The layout is a small model
  written as one block between `@jai:layout:start {json}` / `end` comments,
  regenerated whole on every change (one `editCss` call = one Undo step; a
  whitespace-only difference is treated as no change). All `!important`,
  because templates' own rules for these containers are; "side by side" is
  inside `@media screen and (min-width: 62em)`, JanitorAI's own breakpoint, so
  phones keep stacking. A split pins the profile box (`flex: 0 0 auto`) and
  lets the characters take the rest — left at `width: 100%` they shrink against
  each other. The frame draws the grip and the gutter (`#sim-grip`,
  `#sim-split`: the only overlays that take the pointer) and reports `section`
  and `split`; the preset tiles, right-click and Layers rows go through the same
  module. `heldInline` in frame.js is a list: a drag can hold several elements.
- The right-click menu is drawn by the studio (`js/menu.js`), not inside the
  preview: the preview is scaled by the canvas zoom and a menu in it would be
  too. The frame only reports `context` with the point and the drop target.
- Insert holds two kinds of thing. *Things* (elements, template parts) are
  dragged to a place via `JaiCanvas.beginDrag`; *looks* (styles, animations)
  are applied and removed. Keep new library items in one of those two shapes.
- Elements live in `js/blocks.js` and `js/blocks-showcase.js` (added through
  `JaiBlocks.register`). A block is `html` + `css` rules (+ `keyframes`, `parts`
  for Layers names, `hint` for the insert toast). `{u}` is a fresh class per
  occurrence; `{t1}`, `{t2}`… are *tokens* — one fresh instance class shared by
  the markup and rules of that instance (an `id` and its `:target` rule, a
  progress bar and its width). A selector starting with `@` wraps its body in
  that at-rule. Every shared class must be in `parts`/`base` or a first edit
  would restyle all copies. Duplicate renames token ids and hrefs along with
  classes (`duplicateStyled` in canvas.js). JanitorAI's own `a:hover` recolours
  links and beats a plain class, so a link block restates `color` in `:hover`.
  The smoke test lints every block, so a new one is checked for free.
- The theme is the token block at the top of `css/app.css` (red on black); the
  canvas overlay colours in `preview/frame.html` must be kept in step with
  `--sel` by hand, because the frame is a separate document.
- Design mode swallows clicks in the preview (a click is a selection). Anything
  that needs the page to react — tests included — switches to Preview mode.

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

The list of CSS JanitorAI strips (the linter's rules) lives in `js/lint.js`. That
file also has an `analyseSpacing` check for something JanitorAI does *not* strip —
a whitespace-only text node between two inline-level siblings still renders as a
gap — reported as a separate, amber "advisory" severity so it's never confused
with something that gets removed.

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
    npm test        # serves the studio, loads it headless, and drives the canvas with real pointer events

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
