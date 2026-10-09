# Changelog

Recent updates and changes to the studio, newest first. One entry per change
worth telling people about, written for the people who use the studio rather
than for the commit log — tooling and housekeeping stay out. The studio shows
the newest entry in a **What's new** dialog, so keep each entry self-contained.

Add an entry in the same pull request as the change. A heading is the date and
a short title, `## 2026-09-09 — Title`, followed by one to three short
paragraphs.

## 2026-10-10 — Pick a design in Profile data, and switch whenever you like

**Profile data** now starts with a **Profile design** menu. Choose Steam
profile, Instagram-style, Contact select or Proxy Terminal and it is written into
About Me there and then; choose another and the page is swapped for it. All of
them are built from the same Profile data, so your bio, friends, links and
sections carry over, and one Undo takes a switch back.

The panel narrows to what the chosen design uses — Inventory and Workshop
items only show for Steam, each design's own options sit under **Design
options** — and nothing in a hidden section is lost.

A design replaces what would fight it. Choosing one takes out any Style, any
other template's parts, the other design and a custom page layout first — two
whole-page designs in one document overwrite each other and leave you with
neither. The message says what went, and Ctrl+Z brings it all back. Your own
elements and CSS stay.

**Instagram-style** in that menu is the Golden Hour template itself: the same
nine parts **Insert → Sections** adds, shown there as added, with their copy
written from Profile data — counts from your characters, bio from About me, a
story highlight for each section, links as stickers, friends as mentions. What
Profile data has nothing for keeps the template's placeholder, and a line you
retype on the canvas is yours: Profile data stops rewriting that part.

**Featured characters as stories.** Tick **Feature in showcases** on a
character and, in Instagram-style, it gets a highlight with the story ring and
a story of its own: its picture at full height, name, tags and a Chat now
sticker. It is optional — there is a switch under Design options.

## 2026-10-10 — New layout: Steam profile, built from your own page

A player profile, under **Insert → Sections** with the layouts built from
Profile data. Your avatar, name, badges, follower count and Follow button are
the real ones; a level, a **Favorite Character** showcase, a row of featured
characters, About boxes, friends and links are written from your Profile data;
and JanitorAI's own character list becomes a library underneath, so it keeps
itself up to date.

It is yours to dress: six themes, a **background** picked from a row of tiles
(eight drawn ones — starfield, aurora, grid, sunset and more, each in your
theme's colours — or your own wide picture), and an **avatar frame** — four drawn ones, or your own
transparent picture laid over the avatar. Who appears in the showcases is up to
you: open a character under Profile data and tick **Feature in showcases**.

A long character list comes in a page at a time: a saved page only holds the
characters that were on it. Save page 2, 3… the same way and press **Add more
pages** under Profile data — several files at once is fine, nothing is added
twice, and your page in the preview is left alone. The panel shows how far
along you are ("34 of 163").

Profile data has two new lists for it. **Inventory** is for things to show off
(emotes, badges, art — a name and a picture each) and becomes an Item Showcase;
**Workshop items** is for what you have made besides bots (lorebooks, prompts,
presets) and becomes a Workshop Showcase. Both appear with a count in the
right-hand column under Characters, next to your friends.

Two new tutorials go with it. **Bring in your own profile** shows how to save
your JanitorAI page as a file and open it here, and **A Steam-style profile**
carries on from there to the finished page, friends, inventory and workshop
included. If your profile is already in, the first step offers to skip the
saving and importing.

## 2026-10-09 — Drag anything, tutorials, and a visitor's view

**Drag to move.** JanitorAI's own pieces — the avatar, the Follow and Options
buttons, badges, your follower count — can now be dragged to a new spot on the
canvas, not only resized. Hold Alt to do the same to an element of your own,
Shift to keep the move straight, Esc to cancel. Right-click → **Reset
position** puts it back, and each drag is one Undo.

If something ends up under something else, it is not lost: it is brought to
the front when you let go, and failing that, click the thing on top and then
click the same spot again (or double-click) to select what is underneath —
it drags out from there. Right-click → **Select** lists everything under the
pointer by name.

**Tutorials.** A new panel on the left, under Profile data. The first one
builds the Golden Hour profile in eleven short steps using the studio's own
tools. Each step can point at what it means (**Show me**), do itself (**Do it
for me**), and ticks itself off when the page shows it is done.

**The preview is a visitor's.** The default view now really is what a stranger
sees: no Edit profile button, no avatar pencil, no Customize button, and
somebody else's picture in the header. Switch to "Yourself" in the Page panel
to see your own view.

## 2026-10-09 — New template: Golden Hour

An Instagram-style profile, in **Insert** with the other templates. Your real avatar sits in a
gradient story ring, your real follower count sits in a row of stats, and a
line of highlight circles opens full story cards — about, rules, requests,
links and friends — each with a progress bar and arrows to the next one.

The character grid is JanitorAI's own list turned into three-across picture
tiles, so it updates itself when you publish a bot. Pointing at a tile shows
its name, tags and chat count.

On a computer the notification bell leaves the header and floats in the bottom
corner as a pill, like a message inbox; its panel opens upward.

## 2026-10-02 — Move the big blocks of your profile

The profile box (with your About Me in it) and the character list can now be
rearranged without writing any CSS. **Page layout** has four tiles — side by
side, swap sides, profile on top, characters on top — in the Page panel, and
whenever you select either block. On the canvas, point at either one and a
**grip** appears on its top edge: drag it over the other and a band shows where
it will land (above, below, left or right). While they sit side by side, drag
the **gutter** between them to decide how much room each gets. You can also
drag their rows in Layers, or right-click anywhere on the page for **Page
layout**.

It is all one block in your CSS, one Ctrl+Z, and **Reset layout** removes it.
Side by side only applies at desktop widths, so phones keep JanitorAI's own
stacking, and it also works on top of a template that stacks the page. The Film
reel and Marquee tape are longer now, so they keep running across a full-width
About Me.

## 2026-10-02 — 26 new elements and 8 new animations

**Insert** has a batch of ready-made pieces borrowed from what hand-built
profiles do best. **Motion**: a scrolling *Marquee tape*, a *Film reel* of
pictures that runs across the page, a *Typewriter*, *Glitch*, *Shimmer* and
*Neon* titles, and a *Flip card*. **Layout**: CSS-only *Tabs*, a *Corner panel*,
a *Stat sheet*, *Profile cards*, an *Accordion*, a *Timeline* and *Progress
bars*. **Links**: a *Skew button* with a sweeping shine, *Social orbs* with a
spinning ring, a live *Status chip* and a *Ribbon tag*. **Text and Media**:
*Poster title*, *Section head*, *Speech bubble*, *Hover swap*, *Gallery*,
*Avatar ring*, *Hazard stripe* and *Polaroid*. Drag one in, then restyle each
part from the properties panel like anything else.

Everything is plain HTML and CSS that stays inside JanitorAI's limits — no
scripts, buttons, SVG, `url()` or variables — so what you see is what the
profile will show. Hover effects and Tabs need **Preview** mode to try. Tabs run
on the page's single `#anchor`, so with two sets, picking a tab in one sends the
other back to its first tab.

**Animations** gained Bounce, Shake, Heartbeat, Flicker, Rainbow, Sway, Zoom in
and Flip in. And links in the older Button and Link row elements no longer turn
purple on hover, which JanitorAI does to every link unless told otherwise.

## 2026-10-02 — The studio is a canvas now

The whole studio has been rebuilt around the preview. **Click** anything on the
page to select it and its properties appear on the right — layout, text, fill,
border, effects, and the raw CSS — each one reading from and writing to your
About Me code. **Double-click** to retype text where it sits. Elements you add
can be **dragged** to a new place (a line shows where they will land),
resized by their handles, duplicated with Ctrl+D and removed with Delete, and
every change can be undone with Ctrl+Z.

The left side is now **Layers** (the page as an outline, with your own elements
under About Me), **Insert** and **Profile data**. Insert is the whole library:
elements and shapes to drag onto the page, **Sections** (the pieces of the
community templates — drag one to where you want it instead of taking the whole
design), **Styles** for the whole profile, and **Animations** you can give to
whatever is selected. **Right-click** the canvas to add something exactly
there. Images can be dragged in from another tab or pasted as a link.

Layouts built from your Profile data are no longer hands-off. They show an
amber outline while they are linked to Profile data; edit one by hand and it is
unlinked so your change stays, with Ctrl+Z to link it back. Right-click one for
**Add a character…** to grow it the linked way.

The old Design, Settings, View, Selectors, Templates and Hard coding buttons
are gone: the viewport and zoom live in the top bar, preview settings appear on
the right when nothing is selected, and **Code** opens your About Me in a dock
under the canvas with the Selectors reference beside it. Clicks in **Design**
mode select instead of activating links, so switch to **Preview** in the top
bar to try hover effects and CSS-only menus. And the studio is red and black
now.

## 2026-09-15 — Add characters wherever they appear

The Profile panel now recognises character appearances in pasted and imported
hardcoded layouts. Select one or more characters, choose a detected featured
selector, character archive or duplicated film reel, and add them to all of
those sections together. Existing entries and unrelated hand-written markup
are left alone, and archive counts plus new name-index letters stay in sync.

Profile snapshots now repair themselves on startup: entries whose saved MHTML
is missing are removed, repeated copies are collapsed, and importing the same
capture again refreshes its existing snapshot instead of adding another item.
Your CSS and Profile edits are kept when a snapshot is refreshed, and filenames
that already contain the creator handle no longer repeat it in the switcher.

Character checkboxes now stay selected when clicked, without opening their
details row, so chosen characters can be added to detected code sections.

## 2026-09-14 — Profile information replaces Cards

The **Cards** tab is now **Profile**: everything a hardcoded profile is built
from, in one place. Importing your `.mhtml` fills in your username, avatar,
followers, member date, badges and every character, with its description,
tags, image, link, chat count and token count. On top of that you can add
friends (a name, plus an optional picture and link), social links with
optional icons, and extra About Me sections. Proxy Terminal shows them on its
About, Friends and Links screens.

**Presets** start collapsed and are easier to find your way around.
**Layouts** lists the profile layouts built from your Profile information
ahead of the community templates, whose parts now sit in one closed list
instead of behind a row of filters, and the colour presets are called
**Styles**.

## 2026-09-13 — Proxy Terminal profile template

**Proxy Terminal** is a complete ZZZ-inspired profile surface: the real Janitor
header stays at the top, the creator identity becomes a player card, and a
CSS-only menu switches between Agents, About Me, Friends and Links. The Agents
screen uses the Cards roster for a large centered stage, clipped portraits and
contact links, with room for personal copy and social channels around it.

Proxy Terminal is also available directly from **Cards → Layout & theme**. Its
profile label, watermark, About Me copy, creator notes, Friends heading, social
URL and footer text can be edited there and are written into the generated
hardcoded profile.

## 2026-09-13 — Contact images fill themselves in

**Detect from profile** now carries each bot's normal image into the hardcoded
contact automatically. It fills both the roster portrait and the stage art,
while either field can still be overridden. Portraits and stage images are
centered and clipped with `object-fit: cover`, so extremely tall source art
cannot stretch or break the selector.

## 2026-09-12 — Cards can bring their own stylesheet

**Layout & theme** gains a **Style** picker. *Contact select* writes a complete
layout — the page breakout, the stage, the roster, the tiles — so inserting
cards into an empty About Me now produces something that looks like a profile
instead of a stack of bare divs. *None* writes markup and wiring only, for a
document that already has its own CSS, and switching to it takes the stylesheet
back out again. The panel picks for you the first time: a document already
styling `.cs-shell` keeps its own look, an empty one gets the shipped style.

A roster is no longer allowed to stretch the page. However many characters are
in it, tiles wrap by width and the grid scrolls inside the panel, so the layout
keeps the height it was designed at. That rule travels with the generated block,
so it applies to a hand-written stylesheet too.

## 2026-09-12 — Cards update live, and the editor reaches the end of a long line

Editing a card now rewrites the generated block as you type, so the preview
stops showing the name you just changed. Reordering, removing, detecting and the
Layout & theme options do the same.

The editor no longer stops at the width of its pane. Hardcoded markup is one
long line on purpose, and the text area used to end where the pane ended —
everything you scrolled right to was impossible to click, select or type into.
It is now as wide as the longest line.

Two fixes for rosters bigger than a handful: the generated block is rewritten
where it already sits rather than appended to the last stylesheet, and a roster
that outgrows the panel now scrolls inside it instead of stretching the page.

## 2026-09-12 — Cards: write characters into About Me without typing them five times

A new **Cards** tab (and the **Hard coding** button, no longer greyed out) keeps
a roster of characters — name, tagline, quote, description, tags, link and the
images — and writes them into your About Me as your own markup. **Detect from
profile** reads the characters already in your preview and fills in everything a
card can know: name, description, tags and the link. Tagline, quote and the wide
art are yours to add, as is any image URL — a captured profile carries its
pictures as local copies that mean nothing once published.

Inserting writes two marked blocks, one in your stylesheet and one below it, and
only ever rewrites those: the rest of your code is left exactly as you wrote it,
so you can regenerate after every roster change. The generated CSS is the part
that scales with the roster — which file is the default, what each `:target`
shows, the tag filter chips — themed by the accent and hover colours in **Layout
& theme**. Tag chips are linked for you from JanitorAI's own tag ids, and
anything the site doesn't have a number for is linked as a custom tag.

A layout warning in the editor now also comes with a **Remove** button, which
deletes the whitespace that was going to show up as a gap.

## 2026-09-12 — The linter now catches invisible whitespace gaps

Two inline elements written one per line — a common, readable way to write a
row of tag chips or badges — can end up with an unwanted gap between them: the
newline and indentation count as a real space once both elements render
inline. The editor now flags this as a **layout warning**, separate from the
existing "blocked" issues, since nothing here is stripped by JanitorAI — it's
a plain HTML/CSS quirk the preview already renders faithfully, just easy to
miss reading the code. Layout warnings get their own amber underline and
gutter marker instead of the red "blocked" one, and the copy-button toast and
issue count call them out separately so a warning is never mistaken for
something JanitorAI will delete.

## 2026-09-12 — Celeste enters Signal Select

**Signal Select: Celeste** is a new hardcoded character-selector template with a
cinematic 16:9 stage, a selected portrait tile, six empty roster slots and a
direct launch link. Its desktop, tablet and mobile layouts are all purpose-built,
and visitors who prefer reduced motion get a still version automatically. The
selector now also carries Celeste's captured profile tags as linked chips.

## 2026-09-12 — Field Notes joins Advanced Templates

**Field Notes** is a new light-mode template: a naturalist's expedition
journal in warm parchment tones, with a page-turn loading sequence, a
compass-rose hero, stamped and taped paper panels, and specimen-tag character
cards. Add the complete profile or choose its individual backdrop, layout,
loading sequence, hero, content panels, site chrome, character gallery, or
credit — the same part-by-part pattern as Velvet Nocturne and Dark Hour Menu.

## 2026-09-12 — Sidebar reorganized, edit the preview directly

The sidebar is reorganized around what people actually reach for. **View** is a
new tab holding the preview-width switcher, out of the top bar. **Profile** is
now **Settings** — its username/avatar/followers/member-since fields are gone,
because you can now click that text directly in the preview to edit it, or
right-click the avatar or background to swap the image; Settings keeps the
profile import, "Enforce JAI rules", and the remaining preview-only toggles.
The **Updates** and **Migrate** tabs are removed.

**Presets** gains a third section, **My presets**: select any block of code in
the editor, use "Save selection…" to store it as a named part, and group your
own parts into presets you name and manage yourself — the same apply/remove
toggle an advanced template part gets.

The code pane's buttons moved to match how they're used: Copy and Delete now
live in a footer bar under the editor, and the show/hide toggle lives with Tidy
at the top, with a small "Show code" pill in the preview bar when it's hidden.
A disabled **Hard coding** button in the top bar marks where bio-authoring
tools (hardcoding bot cards directly into About Me, immune to JanitorAI's own
card-class churn) are headed next.

The Advanced Templates gallery now includes **Dark Hour Menu**, a Persona 3
Reload-inspired profile with 25 hardcoded, directly linked character cards. The
cards are ordinary About Me markup, so JanitorAI's generated card-class changes
cannot rearrange or restyle them.

The templates were checked against the 12 Sep capture. Dark Red now uses the
semantic `react-select__*` and `[role="tooltip"]` hooks instead of old Emotion
hashes. Velvet Nocturne is now 0.2.1 and uses the current
`react-select__control` hook; Dark Hour Menu was already current.

## 2026-09-11 — A Discord invite in Help

The **Need help?** topic in the Help tab now links to the Avalon Discord, for
feedback or just to hang around, alongside the existing eslezer contact for
bug reports.

## 2026-09-11 — A plain background to start from

The built-in profile no longer comes with its owner's background photo, so
you design on JanitorAI's plain page. Set your own in **Profile → Background
image URL**; a profile you import still shows its own background.

## 2026-09-11 — Velvet Nocturne joins Advanced Templates

**Velvet Nocturne** is now available alongside Dark Red. Add the complete
gothic-purple profile or choose its individual backdrop, layout, loading veil,
hero, content panels, site chrome, character gallery, or credit. Each part
carries its own mobile rules and brings only what it needs — adding the
character gallery no longer repaints the page background or fonts.

A part that was added only because another one needed it is now removed again
along with that part, for every template.

Its package metadata also feeds the part filters, so the relevant pieces appear
when browsing areas such as character cards, the header, or motion.

## 2026-09-11 — Easier profile imports

The Profile tab now gives the import button a clearer visual priority, and Help
shows the exact save flow: open your JanitorAI profile, press **Ctrl + S**, then
choose **Webpage, Single File** (`.mhtml`). Help and bug reports can go to
**eslezer** on Discord.

The preview now starts with the character total recorded in your saved profile,
rather than an arbitrary 12 cards. When a saved page contains only its first
page of cards, visual copies fill the remaining preview slots; your profile file
and copied CSS are never changed.

## 2026-09-10 — Faster browsing, less clutter

Advanced templates can now be filtered by the part of the profile they affect,
such as character cards, the header, notifications, or social links. Choosing a
filter opens the matching parts so they are ready to add.

The main workspace is also quieter. Short labels replace repeated explanations,
while the new **Help** tab holds the practical guide for About Me, templates,
preview rules, and importing a saved profile.

## 2026-09-10 — Loads properly, and much faster

The bundled profile was failing to load in every browser — the server was
labelling the file with an encoding browsers don't understand — so the preview
was quietly falling back to a plainer built-in copy without the real avatar.
Fixed. The studio's files are also compressed on the way to you now: the
profile capture is half the size on the wire and the code files a fraction of
theirs, which makes a real difference on a slow connection.

## 2026-09-10 — Open to everyone, and links show a preview

The studio no longer asks for a password — share the link freely. Pasting it
into Discord, Slack or Twitter now shows a proper preview card with the
studio's name, a line about what it does, and an image, instead of a bare URL.

## 2026-09-09 — A changelog inside the studio

There is now a **Changelog** button in the top bar. It shows recent updates
and changes to the studio, newest first, and a dot appears on the button when
there is something you haven't seen yet.

## 2026-09-09 — The studio is online

The studio now lives at https://tools.from-avalon.com/janitor-profile-maker/
— ask in the server for the password. It updates itself whenever a change
lands, usually within a minute, so there is nothing to download and nothing to
keep up to date.

## 2026-09-08 — The first working studio

A live simulator for JanitorAI profile themes. The preview is a capture of the
real profile page with your About Me HTML injected where JanitorAI injects it,
so what renders here renders on your profile — and what JanitorAI would strip
is stripped here too.

Around it: a Design panel of about 130 visual controls that read from and
write back to your `<style>` block, Basic and Advanced presets, a searchable
reference of all 418 selectors, an inspector, and viewport widths from 1920
down to mobile. The linter underlines every declaration JanitorAI throws away
and says what to use instead; **Enforce JAI rules** removes them before the
preview renders, so the preview is honest.

You can import your own profile from a browser save (`.mhtml`). It is parsed
in the browser and never uploaded. The avatar user menu is captured and
stylable as well — two fixes made it usable, one for a capture that had frozen
it closed and one for it slamming shut while the bundled profile was still
loading.
