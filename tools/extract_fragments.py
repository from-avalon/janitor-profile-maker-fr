#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Lifts the page regions the base capture could not contain out of a second,
richer capture.

The base snapshot (tools/extract_snapshot.py) came from the owner's own profile
with the user menu closed and an empty bio, so five regions never rendered:

    the user menu popup        .pp-top-bar-app-menu-list
    the About Me box           .pp-uc-about-me
    follow / options buttons   .pp-uc-follow-button, .pp-uc-options-menu
    the character counter      .pp-pg-total
    the page navigation        .pp-pg-page-button

This reads a fuller capture -- one taken after the page finished loading, with
the user menu open -- and emits those regions verbatim, plus the emotion CSS
they need. frame.js splices them into the base page.

The follow/options buttons are the one region a capture of your *own* profile
cannot provide: JanitorAI does not render them for you. Pass a second capture
of any public profile as a supplement and those two buttons, plus only the
emotion rules they need, are taken from it. That is JanitorAI's own chrome --
nothing about the captured creator (their bots, their name, their theme) comes
across. Without a supplement, frame.js falls back to rebuilding the buttons
from the same class names.

Chrome writes MHTML with each inline <style> hoisted into its own `cid:` part
and referenced by a <link>, so the emotion stylesheets are reassembled here by
following those links in document order.

Run:  python tools/extract_fragments.py [primary.mhtml] [supplement.mhtml]
"""

import email
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# The bundled profile, so this is reproducible from a clean checkout with no
# files from anywhere else on disk.
DEFAULT_SRC = os.path.join(ROOT, "preview", "profiles", "default.mhtml")

OUT_CSS = os.path.join(ROOT, "preview", "vendor", "emotion-extra.css")
OUT_JS = os.path.join(ROOT, "preview", "fragments.js")
BASE_EMOTION = os.path.join(ROOT, "preview", "vendor", "emotion.css")


# --------------------------------------------------------------------------
# mhtml
# --------------------------------------------------------------------------
def load_mhtml(path):
    with open(path, "rb") as fh:
        msg = email.message_from_binary_file(fh)

    page = None
    css = {}
    for part in msg.walk():
        loc = part.get("Content-Location") or ""
        ctype = part.get_content_type()
        if ctype == "text/html" and "janitorai.com/profiles" in loc:
            page = part.get_payload(decode=True).decode("utf-8", "replace")
        elif ctype == "text/css":
            css[loc] = part.get_payload(decode=True).decode("utf-8", "replace")

    if page is None:
        sys.exit("no profile page found in %s" % path)
    return page, css


def emotion_css(page, css_parts):
    """The inline <style> blocks, back in document order."""
    blocks = []
    for cid in re.findall(r'href="(cid:css-[^"]+)"', page):
        block = css_parts.get(cid)
        if block:
            blocks.append(block)
    return blocks


def is_creator_theme(block):
    """
    True if this stylesheet is the captured creator's own profile theme rather
    than JanitorAI's.

    A creator's theme is a <style> inside their About Me box, but that is not
    something position can detect: JanitorAI moves body styles into <head> at
    load, so by capture time it sits among the real emotion sheets.

    What separates them is the selectors. Emotion generates hashed class names
    and only ever targets those; the `.pp-` / `.profile-` label classes exist
    purely so creators have something stable to write CSS against, and nothing
    JanitorAI emits refers to them. So a block that mentions one is, by
    construction, somebody's theme -- and shipping it would restyle our page
    with their design.
    """
    return bool(re.search(r"\.(pp|profile)-[a-z0-9-]+", block))


# --------------------------------------------------------------------------
# a very small HTML element walker
# --------------------------------------------------------------------------
def tag_end(html, start):
    """Index just past the '>' of the tag opening at `start`."""
    quote = None
    for i in range(start, len(html)):
        c = html[i]
        if quote:
            if c == quote:
                quote = None
        elif c in "\"'":
            quote = c
        elif c == ">":
            return i + 1
    return len(html)


def element_span(html, start, tag="div"):
    """(start, inner_start, inner_end, end) for the element opening at `start`."""
    inner_start = tag_end(html, start)
    if html[inner_start - 2] == "/":            # <div ... />
        return start, inner_start, inner_start, inner_start

    open_re = re.compile(r"<%s\b" % tag, re.I)
    close_re = re.compile(r"</%s\s*>" % tag, re.I)
    depth = 1
    pos = inner_start
    while depth:
        nxt_open = open_re.search(html, pos)
        nxt_close = close_re.search(html, pos)
        if not nxt_close:
            return start, inner_start, len(html), len(html)
        if nxt_open and nxt_open.start() < nxt_close.start():
            depth += 1
            pos = tag_end(html, nxt_open.start())
            continue
        depth -= 1
        pos = nxt_close.end()
        if not depth:
            return start, inner_start, nxt_close.start(), nxt_close.end()
    return start, inner_start, pos, pos


def find_tag_start(html, needle_index):
    """Backtrack from somewhere inside a tag to the '<' that opens it."""
    return html.rfind("<", 0, needle_index)


def find_element(html, needle, tag="div"):
    """Locate an element by any substring of its opening tag."""
    i = html.find(needle)
    if i == -1:
        return None
    return element_span(html, find_tag_start(html, i), tag)


def outer(html, span):
    return html[span[0]:span[3]]


def inner(html, span):
    return html[span[1]:span[2]]


def empty_element(html, span):
    """The element's opening and closing tags with nothing between them."""
    return html[span[0]:span[1]] + html[span[2]:span[3]]


# --------------------------------------------------------------------------
def supplement_actions(path, fragments, known):
    """
    Takes the follow/options buttons, and only the emotion rules those buttons
    actually use, from a second capture. Everything else in that capture -- the
    creator's bots, their name, their own theme -- is left behind.
    """
    print("supplement %s" % os.path.basename(path))
    page, css_parts = load_mhtml(path)

    span = find_element(page, 'class="chakra-stack css-1aq5geu"')
    if not span:
        print("  ! no follow/options buttons in this capture")
        return ""

    markup = inner(page, span)
    if not markup.strip():
        print("  ! follow/options buttons were empty here too")
        return ""

    fragments["actions"] = markup
    print("  %-16s %6d chars" % ("actions", len(markup)))

    wanted = set(re.findall(r"css-[a-z0-9]+", markup)) - known
    if not wanted:
        return ""

    kept = []
    for block in emotion_css(page, css_parts):
        if is_creator_theme(block):
            continue
        if set(re.findall(r"\.(css-[a-z0-9]+)", block)) & wanted:
            kept.append(block)

    print("  %d css block(s) covering %d class(es)" % (len(kept), len(wanted)))
    return "\n".join(kept)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    if not os.path.exists(src):
        sys.exit("capture not found: %s" % src)

    print("reading %s" % os.path.basename(src))
    page, css_parts = load_mhtml(src)

    # ---- fragments --------------------------------------------------------
    fragments = {}

    # The user menu lives in a chakra portal at the end of <body>. Its inline
    # popper styles are kept: they anchor it under the avatar, which is where
    # it belongs.
    menu = find_element(page, 'class="pp-top-bar-app-menu-list')
    if menu:
        portal_start = page.rfind('<div class="chakra-portal"', 0, menu[0])
        portal = element_span(page, portal_start)
        fragments["userMenu"] = inner(page, portal)

    # About Me: the wrapper only. Whatever the creator types replaces its
    # contents, so the captured profile's own theme is deliberately dropped.
    bio = find_element(page, 'class="pp-uc-about-me')
    if bio:
        fragments["aboutMe"] = empty_element(page, bio)

    # Follow + Options, including the (closed) block/report popup.
    actions = find_element(page, 'class="chakra-stack css-1aq5geu"')
    if actions:
        fragments["actions"] = inner(page, actions)

    # "26 characters" badge.
    counter = find_element(page, 'class="character-list-pagination-box')
    if counter:
        fragments["paginationBadge"] = inner(page, counter)

    # Prev / page numbers / next, which sits below the card grid.
    pager = find_element(page, "_pagesContainer_1jhaa")
    if pager:
        # Walk out to the _outer_ wrapper that owns the whole row.
        outer_start = page.rfind('<div class="_outer_1jhaa', 0, pager[0])
        if outer_start != -1:
            fragments["pager"] = outer(page, element_span(page, outer_start))

    for name in ("userMenu", "aboutMe", "actions", "paginationBadge", "pager"):
        state = "%6d chars" % len(fragments[name]) if name in fragments else "MISSING"
        print("  %-16s %s" % (name, state))

    # ---- supplemental emotion css ----------------------------------------
    with io.open(BASE_EMOTION, encoding="utf-8") as fh:
        base = fh.read()
    known = set(re.findall(r"\.(css-[a-z0-9]+)", base))

    available = emotion_css(page, css_parts)

    kept = []
    dropped_theme = 0
    for block in available:
        if is_creator_theme(block):
            dropped_theme += 1
            continue
        classes = set(re.findall(r"\.(css-[a-z0-9]+)", block))
        # No emotion class means the global chakra reset, which the base sheet
        # already carries.
        if not classes:
            continue
        # Skip anything the base sheet already defines, so this profile's own
        # background and tag colours can't override the base page either.
        if classes <= known:
            continue
        kept.append(block)

    if len(sys.argv) > 2:
        if os.path.exists(sys.argv[2]):
            kept.append(supplement_actions(sys.argv[2], fragments, known))
        else:
            print("  ! supplement not found: %s" % sys.argv[2])

    extra = "\n".join(block for block in kept if block)
    # These rules belong to components our DOM never mounts, but a stray remote
    # background would mean hotlinking the captured profile's own artwork. Drop
    # the references rather than ship them.
    extra = re.sub(r"url\((['\"]?)https?://[^)'\"]+\1\)", "none", extra)

    with io.open(OUT_CSS, "w", encoding="utf-8") as fh:
        fh.write(
            "/* Generated by tools/extract_fragments.py - do not edit by hand.\n"
            " * Emotion rules used by the spliced-in fragments, taken verbatim from\n"
            " * janitorai.com. Rules the base sheet already defines are skipped. */\n"
            + extra
        )

    with io.open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write(
            "/* Generated by tools/extract_fragments.py - do not edit by hand.\n"
            " * Real markup for the regions the base capture could not include. */\n"
            "window.JAI_FRAGMENTS = %s;\n" % json.dumps(fragments, ensure_ascii=False, indent=1)
        )

    print("  %d emotion block(s) -> preview/vendor/emotion-extra.css (%d KB)"
          % (len(kept), len(extra) // 1024))
    if dropped_theme:
        print("  %d block(s) left behind as the captured creator's own theme" % dropped_theme)

    remote = re.findall(r"url\((['\"]?)(https?://[^)'\"]+)", extra)
    if remote:
        print("  ! %d remote url() refs remain in the extra CSS" % len(remote))


if __name__ == "__main__":
    main()
