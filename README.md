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

So the studio works on that whole document, not just CSS. Everything you do on
the canvas — restyling an element, dragging one somewhere else, retyping its text —
is an edit to it; **Code** in the top bar shows it, and **Copy for About Me** copies
the lot. The properties panel, the templates and the linter all reach into the
`<style>` blocks inside it.

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

The studio is laid out like a design tool: what the page is made of on the left,
the page itself in the middle, the selected element's properties on the right.

| Where | What it does |
| --- | --- |
| **Canvas** | The real profile page. In **Design** mode a click selects, a double-click retypes text, and anything you added to About Me can be dragged to a new place or resized by its handles. **Preview** mode hands the page back to itself, so links, hover and CSS-only menus behave as they will on JanitorAI. |
| **Layers** | The page as an outline: JanitorAI's own parts by name (Avatar, Follow button, Bot card…), and under **About Me** every element of your own, read straight from the document. Click to select, drag your own rows to reorder them. |
| **Insert** | Everything that can be added, in one panel. **Elements** — headings, text, images, boxes, columns, cards, buttons, tag rows, shapes — are dragged onto the canvas (a line shows where they land) or clicked to add after the selection; each comes with a few starting rules, added to your stylesheet once. **Sections** are the pieces of whole profile designs: drag a piece to where you want it, or add a design whole. **Styles** are colour schemes, backgrounds and accents for the whole profile — click to apply, click again to take off. **Animations** are motions for whatever is selected. **Saved** holds your own pieces: select code in the Code dock and "Save selection…". |
| **Properties** | Layout, text, fill, border and effects for whatever is selected, plus the raw declaration list. Each field reads its value out of the `<style>` block in your About Me and writes back into it, so the code and the panel never disagree; a greyed value is what the browser resolved, a white one is what your CSS says. The menu at the top chooses which selector the rule is written against, and for which state (`:hover`, `::before`…). |
| **Profile data** | Everything a hardcoded profile is generated from, kept apart from your document. **Import profile** fills in your username, avatar, followers, member date, badges and every character (description, tags, image, link, chat and token counts); you add friends, social links and extra About Me sections. Captured facts refresh on the next import; what you wrote is never overwritten. Inserting writes marked blocks and rewrites only those. |
| **Page** | The right-hand panel when nothing is selected. Preview content only — how many bot cards to show, your own profile or a visitor's view, the "Enforce JAI rules" switch — and the saved profile snapshots. Never touches your code. |
| **Import your profile** | In Profile data or the Page panel, choose a browser save of your own JanitorAI profile. Use Chrome/Edge's **Save page as → Webpage, Single File** (`.mhtml`) — it includes the page's images and styles in one private local file. The app reads it only in your browser, loads its profile DOM into the preview, and copies the saved About Me contents into the document. Plain `.html` is also accepted, but browsers cannot access its companion `_files` folder, so MHTML is the reliable option. |
| **Viewport & zoom** | Top bar. 1920 / 1440 / 1200 / tablet / mobile, plus a custom pixel width. Match it to your own monitor — a theme built at 1440 will look cramped on a 1920 screen and vice versa. Ctrl/Cmd + wheel zooms the canvas. |
| **Code** | The About Me document, in a dock under the canvas, with the linter's findings beside it. Its **Selectors** tab is all 418 elements from Puppy's reference guide, searchable; click any selector to start a rule for it. |

The code view underlines, in red, every declaration JanitorAI will throw away; the
list beside it says why and what to use instead, and the status bar keeps the count
in sight while the dock is closed.

### Working on the canvas

- **Click** selects; the breadcrumb above the element's name climbs to its parents.
  **Esc** does the same from the keyboard.
- **Double-click** retypes text — yours in place in the document, JanitorAI's
  username / follower count / join date as preview data only.
- **Drag** one of your own elements to move it. Drop on the top or bottom edge of
  an element to land beside it, in the middle of an empty box to land inside it.
- **Handles** on the selection set `width` and `height`.
- **Right-click** to add something exactly there (**Add here ▸**), and for
  Duplicate, Move up/down, Select parent, Hide and Delete; on the avatar or
  background, to try a different preview image.
- **Images** have to be online — JanitorAI cannot host a file from your disk.
  Drag a picture in from another browser tab, paste its link (Ctrl+V), or add an
  Image and paste the address into the field the caret lands in.
- **Del** removes, **Ctrl+D** duplicates, **Alt+↑/↓** reorders, **Enter** edits
  text, **Ctrl+Z / Ctrl+Shift+Z** undo and redo anything, **V** / **P** switch
  between Design and Preview, **Ctrl+\\** hides the panels.

JanitorAI's own elements can only be restyled: their rules are written against the
element's label class. Your own elements get a class of their own (`jx-k3f9`) the
first time you set a property, so changing one heading never restyles the next;
pick a shared class in the selector menu when restyling all of them is the point.
A duplicate takes a copy of its original's rules under new names.

A layout built from Profile data (see *Hard coding characters*) is **linked** to
it, and shows an amber outline: it is rebuilt whenever Profile data changes,
which is what lets a roster grow without retyping. Restyling it keeps the link —
those rules are written after the generated stylesheet rather than into it. Edit
*inside* it by hand — move, delete, retype, drop something in — and the layout is
**unlinked** first, so your edit is not undone by the next rebuild: the markers
go, every byte of markup and CSS stays, and from then on it is ordinary markup
of yours. A toast says so, and Ctrl+Z links it back. To change a linked layout
and keep the link, right-click it for **Edit in Profile data** or **Add a
character…**. Things added *next to* a linked layout land outside it and leave
it linked.

### Enforce JAI rules

On by default. With it on, blocked CSS is removed before the preview renders, so the
preview is honest. Turn it off to see what your CSS *would* do in a normal browser —
useful for working out whether a rule is broken or merely blocked.

## Analytics

The studio loads Google Analytics. It sees page views and a few named events —
which preset or template was applied, that CSS was copied, that a profile was
imported. It never sees the CSS you write or the profile you import; those
stay in your browser.

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

## Hard coding characters

JanitorAI generates its character grid from its own React app, so its card class
names change without notice and a theme pinned to them breaks. Writing the cards
yourself fixes that. The **Profile data** panel fills the repeated details in for you,
including the bot image used for both portrait and stage by default, then emits
each contact everywhere the selector needs it.

It keeps your Profile information — separate from your document, so clearing the code doesn't
lose it — and emits two things into your About Me, each between markers:

- the **markup**, one line with no whitespace between tags (see *Layout warnings*
  for why that matters), and
- the **wiring CSS**: which file shows by default, what each `:target` swaps, the
  per-tile plates, and the tag filter chips.

…and, if you ask for one, a **style**: a complete layout stylesheet in a third
marked block. *Contact select* is the one that ships — a stage on one side, a
scrolling roster of tiles on the other — and it is a starting point, meant to be
edited once it lands. Choose *None* and only the markup and wiring are written,
for a document that already has its own look; the panel guesses which of the two
you want the first time, from whether your CSS already styles `.cs-shell`.

Everything a style owns — colours, spacing, media queries — stays editable in
your document. Re-inserting rewrites only the marked blocks, so the roster can
grow without touching a line you wrote.

The **Proxy Terminal** layout reads the rest of your Profile information too:
About Me heading, introduction, creator notes and extra sections fill its About
screen; friends (with their pictures and links) replace the open slots on its
Friends screen; and social links, each with an optional icon, fill Links. Its
profile label, watermark and footer text live under **Profile data → Layout & theme**.

Tag chips are linked from JanitorAI's own tag ids (`js/tags.js`); a tag the site
has no number for is linked as a custom tag instead.

## Layout warnings

Not everything the code view underlines is something JanitorAI removes. Writing a row
of tag chips or badges one element per line — the readable way to write markup — can
leave a whitespace-only gap between two tags that both render inline; the newline and
indentation count as a real space once the browser lays them out, on JanitorAI same as
anywhere else. The linter flags this as an amber **layout warning**, separate from a
red **blocked rule**, because nothing here is stripped — the preview already shows the
gap faithfully, the warning just points at where to look. It only fires for elements
that are actually inline-level (`inline`, `inline-block`, `inline-flex`, …) inside a
normal-flow parent; a `flex` or `grid` container already ignores that whitespace, so
rows built that way are never flagged.

## The default profile

`preview/profiles/default.mhtml` is a capture of the owner's own JanitorAI
profile, loaded automatically at start-up. The canvas you design against is
therefore your real profile — your bots, your avatar, your follower count — with
no import step, and it works offline because MHTML embeds its own images.

It supplies the canvas only:

- your About Me document is never touched by it;
- profile fields you have already changed by hand are left alone, so renaming
  yourself by double-clicking your @name in the preview survives a reload;
- if the fetch fails (opening `index.html` straight off disk, say), the app falls
  back to the build-time snapshot in `preview/snapshot.js`, which is the same
  profile — so the preview stays correct either way.

To preview another capture, use **Import profile** in Profile data or **Choose profile file** in the Page
panel (the right-hand panel when nothing is selected). Each import becomes a snapshot in the **Preview profile** switcher,
so you can move between it and Sweepercom without losing your document.
The built-in profile can be hidden with **Keep Sweepercom in the switcher**;
the imported snapshot can be removed when you are done. **Hide custom CSS**
temporarily removes the captured About Me/theme CSS while keeping the imported
profile DOM and base JanitorAI styling visible.

## Advanced templates

A community template (under **Insert → Sections**) is a whole profile design by a community creator — HTML *and*
CSS — cut into components. Open one and you get its parts; add the status box
without inheriting the bot card redesign, or take the lot.

Included: **Dark Red** by Hime (`@yourhighness08`), free to use and modify; **Dark Hour Menu** by Sweepercom, a Persona 3 Reload-inspired menu with a hardcoded 25-card gallery; **Signal Select: Celeste**, a ZZZ-inspired single-character selector with empty slots ready for future bots; and **Proxy Terminal**, a complete ZZZ-inspired profile with Agents, About Me, Friends and Links screens. When Dark Red is added, its username treatment, avatar cut-out, About Me panels, social pills and friends row are filled from **Profile** instead of its original example content.

Dark Hour's cards live in About Me markup and link directly to JanitorAI, so their
layout does not depend on Janitor's generated card classes. Replace each card's
text, URL or image directly in `templates/p3-reload-menu/source.txt` when your
catalogue changes.

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

The preview is built entirely from captures of **one profile — your own**, most
recently refreshed on **12 Sep 2026**:

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
   `.profile-…` label classes — the canvas only ever writes those, and they do
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
js/markup.js            source-mapped markup: where each element is in the text, and edits by offset
js/blocks.js            the Insert catalogue: markup + starting rules per block
js/blocks-showcase.js   more of it: tapes, reels, tabs, orbs, flip cards, extra animations
js/page-map.js          the named outline of JanitorAI's page, for Layers
js/templates.js         generated advanced presets, split into components
preview/fragments.js    real markup for the menu, bio, buttons and pagination
preview/profiles/       the bundled default profile, loaded at start-up
js/lint.js              JanitorAI restriction checks + the preview sanitiser
js/presets.js           style packs
js/reference.js         generated selector reference
js/app.js               the document, its history, the preview bridge, the shell, sections/styles and Profile data
js/menu.js              the pop-up menu behind the canvas's right-click
js/page-layout.js       Page layout: where the profile box and the character list sit, and every way to change it
js/canvas.js            selection, and what canvas gestures do to the document
js/layers.js            the Layers panel
js/insert.js            the Insert panel: element tiles, draggable template pieces, animations
js/inspector.js         the properties panel
preview/frame.html      the document your CSS is injected into
preview/frame.js        mounts the snapshot, injects your About Me, and reports canvas gestures
preview/snapshot.js     the captured JanitorAI DOM
preview/vendor/         JanitorAI's stylesheets, verbatim
preview/assets/         images from the captured page
tools/extract_snapshot.py    builds the base page from the first capture
tools/extract_fragments.py   lifts the five extra regions from the second
tools/build_reference.py     turns the guide into the Selectors tab
tools/build_template.py      splits a community template into components
tools/serve.py               the no-cache dev server
```

Credit for the selector reference: **Puppy** (`@permanentsky` on Discord).
