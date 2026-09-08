#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Extracts a pixel-accurate snapshot of a JanitorAI profile page from a
browser-saved page ("Webpage, Complete" + the .mhtml sibling) and turns it into
the static assets the simulator's preview iframe consumes.

Outputs (relative to the repo root):
    preview/vendor/janitor.css   concatenated JanitorAI stylesheets (chunk CSS)
    preview/vendor/emotion.css   every <style data-emotion> rule, in DOM order
    preview/assets/*             images referenced by the page, de-queried
    preview/snapshot.html        the fully-hydrated page body (suspense resolved)

Run:  python tools/extract_snapshot.py
"""

import email
import hashlib
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop")

SRC_HTML = os.path.join(DESKTOP, "Profile of @Sweepercom.html")
SRC_MHTML = os.path.join(DESKTOP, "Profile of @Sweepercom.mhtml")
SRC_FILES = os.path.join(DESKTOP, "Profile of @Sweepercom_files")

OUT_VENDOR = os.path.join(ROOT, "preview", "vendor")
OUT_ASSETS = os.path.join(ROOT, "preview", "assets")
OUT_SNAPSHOT = os.path.join(ROOT, "preview", "snapshot.html")

# Chunk stylesheets are concatenated in the order the app loads them: the main
# bundle first (it owns the design tokens), then per-route chunks.
CSS_ORDER = [
    "index-Cv_bE-se.css",
    "index-BFhIpKYa.css",
    "feed-tokens-BVIZePEv.css",
    "BadgeCounter-Cn70rfy3.css",
    "CharacterCard-BlG8jEV9.css",
    "CharacterListSuspense-BMLHGrYw.css",
    "Pagination-ByqwXPfu.css",
    "Tabs-CGtSBZrN.css",
    "Tags-DLHaFPWp.css",
    "Tooltip-Dmski4rJ.css",
    "SelectInput-C1MWJkC6.css",
    "SettingsButton-DyTSTZ0j.css",
    "ExternalAwareLink-0nURv2lJ.css",
    "select-has-plusbadge-D379Bulp.css",
    "review-emoji-DxuJ2ZJv.css",
    "Search-BYJSHL4L.css",
    "PublicChatCard-B5DuAff_.css",
    "FeedTimeline-VwuEEMm4.css",
    "MediaLibrary-DPqD8FhV.css",
    "MediaLibraryInput-BB3Ud09K.css",
    "CustomSlider-Chr-6Rtg.css",
    "CustomizationPanel-D2HOwjad.css",
    "ImageInput-B9FIpmx1.css",
    "TextareaInput-BHgNMWgV.css",
    "RichTextEditor-CcsSmtHV.css",
    "PostComposer-CXQv50Al.css",
    "Home-page-root-BCudiOsr.css",
]

STYLE_RE = re.compile(r'<style[^>]*data-emotion="([^"]*)"[^>]*>(.*?)</style>', re.S)
SCRIPT_RE = re.compile(r"<script[^>]*>.*?</script>", re.S)
TEMPLATE_RE = re.compile(r'<!--\$\?--><template id="(B:\d+)"></template>')


def read(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.read()


def js_string(text):
    """A JS string literal that survives being parsed inside a <script> tag."""
    out = (
        text.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "")
        .replace("</", "<\\/")
    )
    return '"%s"' % out


# --------------------------------------------------------------------------
# 1. images, pulled from the .mhtml because it carries exact URL -> bytes pairs
# --------------------------------------------------------------------------
def extract_images():
    """Returns {original_url: local_filename} and writes the files."""
    with open(SRC_MHTML, "rb") as fh:
        msg = email.message_from_binary_file(fh)

    mapping = {}
    for part in msg.walk():
        ctype = part.get_content_type()
        if not ctype.startswith("image/"):
            continue
        url = part.get("Content-Location")
        if not url:
            continue
        payload = part.get_payload(decode=True)
        if not payload:
            continue

        # ".webp?width=400" and ".webp?width=200" are distinct resources, so the
        # filename has to encode the query too.
        base = url.split("?")[0].rsplit("/", 1)[-1]
        stem, _, ext = base.rpartition(".")
        if "?" in url:
            digest = hashlib.sha1(url.encode()).hexdigest()[:6]
            name = "%s-%s.%s" % (stem, digest, ext)
        else:
            name = base
        name = re.sub(r"[^A-Za-z0-9._-]", "_", name)

        with open(os.path.join(OUT_ASSETS, name), "wb") as out:
            out.write(payload)
        mapping[url] = name

    return mapping


def localise(html, images, prefix="assets/"):
    """Rewrites remote image URLs to preview/assets paths.

    `prefix` differs between the markup (served from preview/) and the vendor
    stylesheets (served from preview/vendor/), which resolve URLs against their
    own location.
    """
    # Longest URLs first so "...webp?width=400" wins over "...webp".
    for url in sorted(images, key=len, reverse=True):
        html = html.replace(url, prefix + images[url])

    def fallback(match):
        url = match.group(0)
        base = url.split("?")[0].rsplit("/", 1)[-1]
        candidate = os.path.join(OUT_ASSETS, base)
        return prefix + base if os.path.exists(candidate) else url

    return re.sub(r"https://ella\.janitorai\.com/[^\s\"')]+", fallback, html)


# --------------------------------------------------------------------------
# 2. stylesheets
# --------------------------------------------------------------------------
def build_vendor_css(images):
    chunks = []
    for name in CSS_ORDER:
        path = os.path.join(SRC_FILES, name)
        if not os.path.exists(path):
            print("  ! missing chunk stylesheet: %s" % name)
            continue
        chunks.append("/* ==== %s ==== */\n%s" % (name, read(path)))
    css = localise("\n\n".join(chunks), images, "../assets/")
    with open(os.path.join(OUT_VENDOR, "janitor.css"), "w", encoding="utf-8") as fh:
        fh.write(css)
    return len(chunks)


def build_emotion_css(html, images):
    """Every emotion rule on the page, deduped by its data-emotion key."""
    seen, blocks = set(), []
    for key, body in STYLE_RE.findall(html):
        if key in seen:
            continue
        seen.add(key)
        blocks.append(body)
    css = localise("\n".join(blocks), images, "../assets/")
    with open(os.path.join(OUT_VENDOR, "emotion.css"), "w", encoding="utf-8") as fh:
        fh.write(css)
    return len(blocks)


# --------------------------------------------------------------------------
# 3. the page body, with React's streamed suspense chunks spliced back in
# --------------------------------------------------------------------------
def hydrate(html):
    """
    The saved page holds a loading skeleton inside <main> and the real content in
    trailing `<div hidden id="S:n">` templates, which React would have swapped in
    at runtime. This performs that swap statically.
    """
    chunks = {}
    for match in re.finditer(r'<div hidden id="(S:\d+)">', html):
        sid = match.group(1)
        start = match.end()
        depth, pos = 1, start
        tag = re.compile(r"<(/?)div\b[^>]*?(/?)>")
        while depth:
            m = tag.search(html, pos)
            if not m:
                raise RuntimeError("unbalanced markup for " + sid)
            pos = m.end()
            if m.group(1):
                depth -= 1
            elif not m.group(2):
                depth += 1
        chunks[sid] = html[start : pos - len("</div>")]

    body = html[html.index("<body"): html.index("</body>")]
    body = body[body.index(">") + 1:]

    # Each `<!--$?--><template id="B:n"></template>…<!--/$-->` pair is a pending
    # boundary; replace the whole span with the matching S:n payload.
    for bid, sid in (("B:0", "S:0"), ("B:1", "S:1")):
        marker = '<!--$?--><template id="%s"></template>' % bid
        idx = body.find(marker)
        if idx == -1:
            continue
        end = body.find("<!--/$-->", idx)
        if end == -1:
            end = len(body)
        body = body[:idx] + chunks.get(sid, "") + body[end + len("<!--/$-->"):]

    # A nested boundary can arrive inside a chunk we just spliced in.
    for bid, sid in (("B:1", "S:1"),):
        marker = '<!--$?--><template id="%s"></template>' % bid
        idx = body.find(marker)
        if idx != -1:
            end = body.find("<!--/$-->", idx)
            end = len(body) if end == -1 else end + len("<!--/$-->")
            body = body[:idx] + chunks.get(sid, "") + body[end:]

    body = SCRIPT_RE.sub("", body)
    body = STYLE_RE.sub("", body)
    body = re.sub(r"<template[^>]*></template>", "", body)
    body = re.sub(r"<!--/?\$\??-->", "", body)
    return body


def main():
    for path in (SRC_HTML, SRC_MHTML, SRC_FILES):
        if not os.path.exists(path):
            sys.exit("missing source: %s" % path)

    for d in (OUT_VENDOR, OUT_ASSETS):
        os.makedirs(d, exist_ok=True)

    print("reading %s" % os.path.basename(SRC_HTML))
    html = read(SRC_HTML)

    print("extracting images from mhtml ...")
    images = extract_images()
    print("  %d images -> preview/assets" % len(images))

    print("building vendor css ...")
    print("  %d chunk stylesheets -> preview/vendor/janitor.css" % build_vendor_css(images))
    print("  %d emotion blocks    -> preview/vendor/emotion.css" % build_emotion_css(html, images))

    print("hydrating page body ...")
    body = localise(hydrate(html), images)
    with open(OUT_SNAPSHOT, "w", encoding="utf-8") as fh:
        fh.write(body)
    # Also emitted as a script so the preview works from file://, where fetch()
    # of a sibling document is blocked.
    with open(os.path.join(ROOT, "preview", "snapshot.js"), "w", encoding="utf-8") as fh:
        fh.write("window.JAI_SNAPSHOT = %s;\n" % js_string(body))
    print("  %d KB -> preview/snapshot.html + snapshot.js" % (len(body) // 1024))

    # star-card.svg is referenced by the card markup and lives outside the mhtml
    # image parts on some saves.
    star = os.path.join(SRC_FILES, "star-card.svg")
    if os.path.exists(star):
        shutil.copy(star, os.path.join(OUT_ASSETS, "star-card.svg"))

    print("done.")


if __name__ == "__main__":
    main()
