# Changelog

Recent updates and changes to the studio, newest first. One entry per change
worth telling people about, written for the people who use the studio rather
than for the commit log — tooling and housekeeping stay out. The studio shows
the newest entry in a **What's new** dialog, so keep each entry self-contained.

Add an entry in the same pull request as the change. A heading is the date and
a short title, `## 2026-09-09 — Title`, followed by one to three short
paragraphs.

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
