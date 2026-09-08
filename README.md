# JanitorAI Profile CSS Studio

A live simulator for JanitorAI profile themes. The preview is not a mock-up: it is
the real JanitorAI profile page — the site's own stylesheets, the site's own DOM —
with your code injected exactly where JanitorAI injects it. Anything that renders
here renders on your profile, and anything JanitorAI would strip is stripped here
too.

## How a JanitorAI theme actually works

There is no separate "custom CSS" setting. A profile theme is the **contents of
your About Me field**: one blob of HTML holding `<style>…</style>` plus whatever
markup those styles decorate. JanitorAI drops it into `.pp-uc-about-me` in the page
body, and because a `<style>` element works wherever it lands, those rules go on to
restyle the entire page — header, bot cards, footer, all of it.

So the editor on the right holds that whole document, not just CSS. Copy the lot,
paste it into About Me. The Design panel, the presets and the linter all reach into
the `<style>` blocks inside it.

## Running it

Double-click **`run.bat`**, or from a terminal in this folder:

```bash
python tools/serve.py 5173
```

(`tools/serve.py` is a plain static server that sends `Cache-Control: no-store`. Plain
`python -m http.server` sends no cache headers at all, which lets the browser go on
running a stale copy of a file you just edited.)

then open <http://localhost:5173/>.

A local server is required — the app talks to the preview through the iframe's
document, which browsers block for pages opened directly from disk (`file://`).

## What's in the box

| Panel | What it does |
| --- | --- |
| **Design** | ~130 visual controls grouped by page element. Each one reads its value out of the `<style>` block in your About Me and writes back into it, so the code and the sliders never disagree. A `<style>` block is created for you if there isn't one. |
| **Presets** | Two groups. **Basic** are colour schemes and accents — one labelled CSS block each. **Advanced** are complete community templates, split into parts you can apply one at a time. |
| **Profile** | Preview content only — your username, avatar, follower count, how many bot cards to show, and whether you are looking at your own profile or a visitor's view. Never touches your code. Loads your own profile by default (see below); pick a file to design against a different one. |
| **Import your profile** | In the Profile panel, choose a browser save of your own JanitorAI profile. Use Chrome/Edge's **Save page as → Webpage, Single File** (`.mhtml`) — it includes the page's images and styles in one private local file. The app reads it only in your browser, loads its profile DOM into the preview, and copies the saved About Me contents into the editor. Plain `.html` is also accepted, but browsers cannot access its companion `_files` folder, so MHTML is the reliable option. |
| **Selectors** | All 418 elements from Puppy's reference guide, searchable. Click any selector to start a rule for it. |
| **User menu** | The avatar dropdown is included and stylable. Open it from the Profile tab, or click the avatar in the preview. |
| **Widths** | 1920 / 1440 / 1200 / tablet / mobile, plus a custom pixel width. Match it to your own monitor — a theme built at 1440 will look cramped on a 1920 screen and vice versa. |
| **Inspect** | Click anything in the preview to get its selector. |

The editor underlines, in red, every declaration JanitorAI will throw away, and the
panel under it says why and what to use instead.

### Enforce JAI rules

On by default. With it on, blocked CSS is removed before the preview renders, so the
preview is honest. Turn it off to see what your CSS *would* do in a normal browser —
useful for working out whether a rule is broken or merely blocked.

## What JanitorAI blocks

Checked by the linter, per the reference guide:

- `url()`, `attr()`, `var()` and custom properties (`--name`)
- CSS nesting, `@property`, `@container`
- `scrollbar-width/color/gutter`, `overflow-clip-margin`
- `scroll-behavior`, `scroll-margin-*`, `scroll-padding-*`, `scroll-snap-*`
- `place-items`, `column-gap`, `row-gap`
- logical `*-inline-start/end`, `*-block-start/end`
- `offset-path`, `offset-distance`, `offset-rotate`, `offset-anchor`
- `mask-composite` (use the `mask` shorthand), `interpolate-size` (use `calc-size()`)

In the markup half of the document, JanitorAI strips `<svg>`, `<button>`, `<label>`,
`<audio>`, `<path>`, `<script>`, `<textpath>`, `<video src>` and every `<input type>`.
Those are flagged too, and the preview removes the element and its contents so you
can see the consequence.

## The default profile

`preview/profiles/default.mhtml` is a capture of the owner's own JanitorAI
profile, loaded automatically at start-up. The canvas you design against is
therefore your real profile — your bots, your avatar, your follower count — with
no import step, and it works offline because MHTML embeds its own images.

It supplies the canvas only:

- the editor's contents are your document and are never touched by it;
- profile fields you have already changed by hand are left alone, so renaming the
  username in the Profile tab survives a reload;
- if the fetch fails (opening `index.html` straight off disk, say), the app falls
  back to the build-time snapshot in `preview/snapshot.js`, which is the same
  profile — so the preview stays correct either way.

To swap it, replace that file with your own *Webpage, Single File* save, or use
**Choose profile file** in the Profile tab for a one-off.

## Advanced templates

An advanced preset is a whole profile design by a community creator — HTML *and*
CSS — cut into components. Open one and you get its parts; add the status box
without inheriting the bot card redesign, or take the lot.

Included: **Dark Red** by Hime (`@yourhighness08`), free to use and modify.

Parts declare dependencies, so adding the decorative card border pulls in the card
redesign it layers over, and the app refuses to remove something another applied
part still needs. Applied parts are kept in the author's original order no matter
which order you switch them on in — otherwise the cascade would silently reverse
and pieces would disappear.

To package another template, drop the `.txt` somewhere and edit `SPEC` in
`tools/build_template.py` — an ordered list of (component, selector patterns).
Every rule goes to the first component whose pattern matches, so narrow patterns
come first; anything unmatched lands in the component marked `catch_all`. Then:

```bash
python tools/build_template.py path/to/template.txt
```

The tool checks nothing is lost: the rules going in and coming out are compared
one for one. Two edits are applied on the way through — the author's placeholder
copy is neutralised, and declarations JanitorAI strips (`scroll-snap-type`) are
dropped so the preset stays lint-clean. Every other byte is the author's.

## Accuracy notes

The preview is built entirely from captures of **one profile — your own**, taken
on **8 Sep 2026**:

- **the page structure** (`preview/snapshot.js`) — the header, footer and bot card
  grid, extracted at build time;
- **five extra regions** (`preview/fragments.js`) — the user menu popup, the About
  Me box, the character counter, the page navigation and the follow/options
  buttons, lifted from fuller captures taken after the page had finished loading;
- **the live canvas** (`preview/profiles/default.mhtml`) — loaded at start-up so
  the preview is your real profile, bots and all.

Everything in the preview is real JanitorAI markup with real classes. Nothing is
approximated.

One region needs a second capture. JanitorAI does not render the Follow and
Options buttons on your own profile, so no capture of it can contain them; those
two come from a supplement capture of any public profile, along with only the
emotion rules they use. That is JanitorAI's own chrome — nothing about the
captured creator travels with it, and `is_creator_theme()` keeps their own theme
out. Rebuild without a supplement and `frame.js` falls back to reconstructing the
buttons from the same class names.

Two things worth knowing:

1. **Mobile chrome is missing.** Below 576px JanitorAI swaps to a different header
   and a bottom nav bar. No capture rendered that markup — its *stylesheets* are
   bundled, but the DOM is not — so the Mobile preview keeps the desktop header.
   Everything from the profile box down is accurate. The app says so when you
   switch to Mobile.
2. **Emotion class names age.** `.css-1abc2de` hashes change on every JanitorAI
   deploy, and some in the reference guide are already stale (the About Me box is
   `.css-p5wazl` now, not `.css-1bn1yyx`). Write your CSS against the `.pp-…` /
   `.profile-…` label classes — the Design panel only ever uses those, and they do
   not change.

If you ever package a capture of someone else's profile, note that their own theme
lives in a `<style>` inside their About Me and would otherwise restyle your page;
`is_creator_theme()` in `tools/extract_fragments.py` filters it out.

To refresh either capture against a newer JanitorAI, see below.

## Refreshing the snapshot

1. Open a JanitorAI profile in Chrome — a **public** profile you do not own fixes the
   reconstructed regions, since it renders the bio and the follow/options buttons.
2. Save it twice into the same folder, with the same filename:
   *Ctrl+S → "Webpage, Complete"* and *Ctrl+S → "Webpage, Single File (mhtml)"*.
   The complete save gives the stylesheets; the mhtml gives exact image bytes.
3. Point `SRC_HTML` / `SRC_MHTML` / `SRC_FILES` in `tools/extract_snapshot.py` at them.
4. Run:

```bash
python tools/extract_snapshot.py     # base page structure
python tools/extract_fragments.py    # menu, About Me, counter, pager
# optionally, for the visitor-view buttons your own profile cannot show:
python tools/extract_fragments.py preview/profiles/default.mhtml other-profile.mhtml
python tools/build_reference.py path/to/janitorai-css-reference.md
```

That regenerates `preview/vendor/*.css`, `preview/assets/*`, `preview/snapshot.js`,
`preview/fragments.js` and `js/reference.js`.

`extract_fragments.py` reads `preview/profiles/default.mhtml`, so a clean checkout
rebuilds without needing any file from elsewhere on disk. To refresh it, open your
profile, wait for it to finish loading, click your avatar to open the user menu,
then Ctrl+S → "Webpage, Single File" over that path.

## Putting it on a website

The studio is a static app and stays one. `next/` holds a drop-in route for a
**Next 16 (App Router) · React 19 · Tailwind v4 · shadcn/ui** site, plus a GA4
bridge via `@next/third-parties`:

```bash
cp -r next/app/studio /path/to/your-site/app/studio
node tools/sync-to-next.mjs /path/to/your-site      # -> public/studio/
```

Wire `studio:sync` into the site's `predev`/`prebuild` so the copy is never stale,
and `.gitignore` `public/studio/` there. Full instructions, including the GA4
event list and why the studio is embedded rather than ported, are in
[next/README.md](next/README.md).

Short version of the why: Tailwind v4's preflight would reset the studio's own
design, and the preview has to be a separate document anyway so that the CSS you
are writing cannot leak into the editor around it. An iframe is a hard style
boundary and costs nothing.

## Layout

```
index.html              app shell
css/app.css             app UI
js/css-model.js         tolerant CSS parser; reads and writes single declarations
js/payload.js           finds the <style> blocks inside the About Me document
js/templates.js         generated advanced presets, split into components
preview/fragments.js    real markup for the menu, bio, buttons and pagination
preview/profiles/       the bundled default profile, loaded at start-up
js/lint.js              JanitorAI restriction checks + the preview sanitiser
js/controls.js          the Design panel catalogue
js/presets.js           style packs
js/reference.js         generated selector reference
js/app.js               glue
preview/frame.html      the document your CSS is injected into
preview/frame.js        mounts the snapshot, injects your About Me, inspector
preview/snapshot.js     the captured JanitorAI DOM
preview/vendor/         JanitorAI's stylesheets, verbatim
preview/assets/         images from the captured page
tools/extract_snapshot.py    builds the base page from the first capture
tools/extract_fragments.py   lifts the five extra regions from the second
tools/build_reference.py     turns the guide into the Selectors panel
tools/build_template.py      splits a community template into components
tools/serve.py               the no-cache dev server
```

Credit for the selector reference: **Puppy** (`@permanentsky` on Discord).
