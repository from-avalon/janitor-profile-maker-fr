#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Turns a community profile template (one .txt of HTML + <style> blocks, the thing
you paste into About Me) into an *advanced preset*: the same design, but broken
into independently applicable components.

Templates are written as one monolithic block. That is fine to paste and awful to
learn from or partially adopt -- you cannot take the status box without also
taking the bot card redesign. This splits a template along its own seams so each
piece can be toggled on its own, while keeping every rule byte-identical to what
the author wrote.

The split is driven by SPEC below: an ordered list of (component, selector
patterns). Each CSS rule goes to the first component whose pattern matches its
selector; anything unmatched falls to the component marked `catch_all`. Rules
inside @media are split the same way and re-wrapped per component, so a
component's responsive behaviour travels with it.

Run:  python tools/build_template.py [path-to-template.txt]
"""

import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC = os.path.join(
    os.path.expanduser("~"), "Downloads", "Dark Red Template by Hime.txt"
)
OUT = os.path.join(ROOT, "js", "templates.js")


# --------------------------------------------------------------------------
# the template being packaged
# --------------------------------------------------------------------------
TEMPLATE = {
    "id": "hime-darkred",
    "name": "Dark Red",
    "author": "Hime · @yourhighness08",
    "credit": "Template by Hime (@yourhighness08). Free to use and modify.",
    "blurb": "A full profile rebuild: cinematic cover, tabbed panels, custom bot "
             "cards and restyled site chrome. Add the whole thing, or take only "
             "the pieces you want.",
}

# SPEC is the *matching* order: the first component whose pattern matches a
# selector claims it, so narrow patterns must come before broad ones
# (".profile-character-card-stack::before" before "character-card").
#
# EMIT_ORDER is the order components are written out in, which has to follow the
# author's original cascade instead -- the decorative border is layered over the
# card redesign and has to come after it to win.
EMIT_ORDER = [
    "base", "cover", "status", "tabs", "links", "creators", "buttons",
    "usermenu", "notifications", "topbar", "filters", "charheader",
    "botcards", "botborder", "credit",
]

SPEC = [
    {
        "id": "base",
        "name": "Layout & profile box",
        "required": True,
        "catch_all": True,
        "blurb": "The CSS grid every other piece is positioned by, plus the page "
                 "background, the giant username and the hidden avatar. Everything "
                 "else here needs it.",
        "affects": ["Page layout", "Profile identity"],
        "html": [],
        "patterns": [],   # catch_all
    },
    {
        "id": "cover",
        "name": "Cover banner & character art",
        "needs": ["base"],
        "blurb": "The wide header image and the cut-out character standing over it. "
                 "Swap both <img> sources for your own.",
        "affects": ["Hero & cover"],
        "html": ["cover", "sona"],
        "patterns": [r"^\.cover\b", r"^\.sona\b"],
    },
    {
        "id": "status",
        "name": "Status box",
        "needs": ["base"],
        "blurb": "The pill-headed panel with the big ghosted STATUS word behind it.",
        "affects": ["About & status"],
        "html": ["status-box"],
        "patterns": [r"^\.status-"],
    },
    {
        "id": "tabs",
        "name": "Tabbed panels",
        "needs": ["base"],
        "blurb": "About / Disclaimer / Recommended tabs, built from <details> so "
                 "they work without scripts.",
        "affects": ["Content panels"],
        "html": ["tab-box"],
        "patterns": [r"^\.tab\b", r"^\.tab-", r"^\.inside\b",
                     r"::-webkit-scrollbar", r"^@keyframes fade"],
    },
    {
        "id": "links",
        "name": "Contact link pills",
        "needs": ["base"],
        "blurb": "Discord / Ko-fi / Carrd buttons with numbered ghost digits.",
        "affects": ["Links & social"],
        "html": ["contact-links"],
        "patterns": [r"^\.contact-links"],
    },
    {
        "id": "creators",
        "name": "Creators row",
        "needs": ["base"],
        "blurb": "A horizontal scroller of friends or recommended creators.",
        "affects": ["Creator showcase"],
        "html": ["creators-box"],
        "patterns": [r"^\.creators-", r"^\.creator-card"],
    },
    {
        "id": "buttons",
        "name": "Follow & options buttons",
        "needs": ["base"],
        "blurb": "Restyles the Follow and Options buttons to match.",
        "affects": ["Follow & options"],
        "html": [],
        "patterns": [r"^\.Btn\b", r"^\.Btn[,:>]", r"\.pp-uc-options-menu",
                     r"profile-info-stack\s*>\s*div:last-child\s*>\s*div\s*\*"],
    },
    {
        "id": "usermenu",
        "name": "User menu & mobile nav",
        "blurb": "The avatar dropdown and the mobile bottom bar.",
        "affects": ["User menu", "Mobile navigation"],
        "html": [],
        "patterns": [r"\.pp-top-bar-app-menu-list", r"\.pp-mnb-"],
    },
    {
        "id": "notifications",
        "name": "Notifications popover",
        "blurb": "The bell popup: cards, avatars, unread indicators, timestamps.",
        "affects": ["Notifications"],
        "html": [],
        "patterns": [r"notificationsPopover", r"popoverHeader", r"notificationItem",
                     r"contentWrapper", r'\[class\*="subject', r"highlightUsername",
                     r"highlightCharacter", r'\[class\*="body_', r'\[class\*="timestamp',
                     r"notificationsBadge", r"avatarSection", r"avatarContainer",
                     r"userAvatar", r"characterAvatar", r"unreadIndicator",
                     r"announcementIndicator", r'\[class\*="content"\]'],
    },
    {
        "id": "topbar",
        "name": "Header & logo",
        "blurb": "The site header, including renaming the janitor logo to the "
                 "template's own wordmark.",
        "affects": ["Header & search"],
        "html": [],
        "patterns": [r"\.pp-top-bar(?!-app-menu)", r"\.glow-logo",
                     r"\.profile-top-bar-logo-box", r"#search-input",
                     r"\.profile-top-box-search-input-spacer-top",
                     r"\.profile-top-bar-search-wrapper"],
    },
    {
        "id": "filters",
        "name": "Search, filters & sort menu",
        "blurb": "The character search box, the filter modal and the Latest "
                 "dropdown, plus tooltips.",
        "affects": ["Character filters"],
        "html": [],
        "patterns": [r"\.pp-fl-", r"filter-modal", r"react-select", r"css-b62m3t",
                     r"css-jdhqy4", r"chakra-modal", r"close-btn", r"expandButton",
                     r"collapsedContainer", r"motionDiv", r"tagsContainer",
                     r'button\[class\*="tag', r'\[class\*="gradient"\]',
                     r"profile-filters-flex-inner-onorderchanged"],
    },
    {
        "id": "charheader",
        "name": "Characters heading & counter",
        "blurb": "The huge word over the bot grid, the character count and the "
                 "pagination row.",
        "affects": ["Character gallery"],
        "html": [],
        "patterns": [r"#profile-tabs", r"\.pp-tabs-", r"Btn2-purple",
                     r"profile-badge-flex-inner", r"\.pp-pg-",
                     r"character-list-pagination-flex", r"profile-filters-flex",
                     r"profile-pagination"],
    },
    {
        "id": "botborder",
        "name": "Bot card decorative border",
        "needs": ["botcards"],
        "blurb": "The ornamental corner flourish on each card. The author marks "
                 "this one as safe to drop.",
        "affects": ["Character cards"],
        "html": [],
        "patterns": [r"profile-character-card-stack::before",
                     r"profile-character-card-description-box::before"],
    },
    {
        "id": "botcards",
        "name": "Bot card redesign",
        "blurb": "Rebuilds every card as a grid: name banner, tilted portrait, "
                 "description, scrolling tags and a per-series label.",
        "affects": ["Character cards"],
        "html": [],
        "patterns": [r"character-card", r"\.pp-cc-", r"chakra-wrap", r"\.pp-tag-",
                     r"\.css-1henxb"],
    },
    {
        "id": "credit",
        "name": "Credit line",
        "recommended": True,
        "blurb": "The author's credit in the corner. Please keep it.",
        "affects": ["Credits"],
        "html": ["himecss"],
        "patterns": [r"^\.himecss"],
    },
]

# Text substitutions applied to the CSS before splitting. The template ships with
# the author's own placeholder copy; these make the shipped preset neutral
# without touching how any of it works.
SUBSTITUTIONS = [
    ('content: "Whores";', 'content: "CHARACTERS";'),
    (".pp-tag-longercustomtag", ".pp-tag-yourcustomtag"),
    ("content: 'School Wars';", "content: 'Series One';"),
    (".pp-tag-cock", ".pp-tag-anothercustomtag"),
    ("content: 'Valemont Fuckboys';", "content: 'Series Two';"),
]

# Declarations JanitorAI strips. Left in, they would make the preset lint dirty
# for no benefit -- they do nothing on JAI either way.
DROP_DECLARATIONS = [r"scroll-snap-type\s*:[^;]+;"]


# --------------------------------------------------------------------------
# parsing
# --------------------------------------------------------------------------
def split_style_blocks(text):
    """(html_without_styles, concatenated_css)"""
    css = []

    def take(match):
        css.append(match.group(1))
        return "\n"

    html = re.sub(r"<style[^>]*>([\s\S]*?)</style\s*>", take, text, flags=re.I)
    return html, "\n".join(css)


VOID = {"img", "br", "hr", "input", "source", "meta", "link"}


def top_level_elements(html):
    """[(class_attr, source)] for each element at the top level of the markup."""
    out = []
    i = 0
    n = len(html)
    while i < n:
        if html.startswith("<!--", i):
            end = html.find("-->", i)
            i = n if end == -1 else end + 3
            continue
        if html[i] != "<":
            i += 1
            continue

        m = re.match(r"<([a-zA-Z][\w-]*)", html[i:])
        if not m:
            i += 1
            continue
        tag = m.group(1).lower()
        open_end = html.find(">", i)
        if open_end == -1:
            break
        open_end += 1

        if tag in VOID or html[open_end - 2] == "/":
            source = html[i:open_end]
            end = open_end
        else:
            depth = 1
            pos = open_end
            pattern = re.compile(r"<(/?)%s\b" % tag, re.I)
            while depth:
                mm = pattern.search(html, pos)
                if not mm:
                    break
                if mm.group(1):
                    depth -= 1
                    pos = html.find(">", mm.start()) + 1
                    if not depth:
                        end = pos
                        break
                else:
                    depth += 1
                    pos = html.find(">", mm.start()) + 1
            else:
                end = pos
            if depth:
                end = n
            source = html[i:end]

        cls = re.search(r'class="([^"]*)"', source[:html.find(">", i) - i + 1])
        out.append((cls.group(1) if cls else "", source))
        i = end
    return out


def split_css_nodes(css):
    """Top-level CSS nodes, each as raw source text (rules and at-rules)."""
    nodes = []
    i = 0
    n = len(css)
    start = 0
    depth = 0
    quote = None
    while i < n:
        c = css[i]
        if quote:
            if c == quote and css[i - 1] != "\\":
                quote = None
            i += 1
            continue
        if c in "\"'":
            quote = c
            i += 1
            continue
        if c == "/" and i + 1 < n and css[i + 1] == "*":
            close = css.find("*/", i + 2)
            i = n if close == -1 else close + 2
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                nodes.append(css[start:i + 1].strip())
                start = i + 1
        i += 1
    tail = css[start:].strip()
    if tail:
        nodes.append(tail)
    return [x for x in nodes if x]


def prelude_of(node):
    brace = node.find("{")
    return node[:brace].strip() if brace != -1 else node.strip()


def assign(prelude):
    for comp in SPEC:
        for pattern in comp.get("patterns", []):
            if re.search(pattern, prelude):
                return comp["id"]
    for comp in SPEC:
        if comp.get("catch_all"):
            return comp["id"]
    return SPEC[0]["id"]


def split_media(node):
    """(prelude, [inner nodes]) for an @media / @supports block."""
    brace = node.find("{")
    prelude = node[:brace].strip()
    inner = node[brace + 1:node.rfind("}")]
    return prelude, split_css_nodes(inner)


# --------------------------------------------------------------------------
# Package templates
#
# New templates do not need selector heuristics. Their source marks each HTML
# and CSS region explicitly, and the manifest describes dependencies and the
# JanitorAI regions it affects. This is the format that can later be accepted
# from a workshop after validation.

def marker_pattern(key, css=False):
    escaped = re.escape(key)
    if css:
        start = r"/\*\s*@jai:component\s+" + escaped + r":start\s*\*/"
        end = r"/\*\s*@jai:component\s+" + escaped + r":end\s*\*/"
    else:
        start = r"<!--\s*@jai:component\s+" + escaped + r":start\s*-->"
        end = r"<!--\s*@jai:component\s+" + escaped + r":end\s*-->"
    return re.compile(start + r"([\s\S]*?)" + end, re.I)


def marked_block(source, key, css=False):
    """Return the contents between a package component's explicit markers."""
    matches = marker_pattern(key, css).findall(source)
    if len(matches) > 1:
        raise ValueError("component '%s' is marked %d times" % (key, len(matches)))
    return matches[0].strip() + "\n" if matches else ""


def check_coverage(html, css, keys, entry_path):
    """Refuse markers for undeclared components and content outside any marker.

    Both would otherwise be dropped silently: the part would come out missing
    rules and nothing would say why."""
    for name, _ in re.findall(r"@jai:component\s+([\w-]+):(start|end)", html + css):
        if name not in keys:
            raise ValueError("undeclared component marker '%s' in %s" % (name, entry_path))
    for text, is_css, comment in ((css, True, r"/\*[\s\S]*?\*/"),
                                  (html, False, r"<!--[\s\S]*?-->")):
        for key in keys:
            text = marker_pattern(key, is_css).sub("", text)
        text = re.sub(comment, "", text).strip()
        if text:
            raise ValueError("%s outside any component marker in %s: %r" %
                             ("CSS" if is_css else "HTML", entry_path, text[:80]))


def package_payload(manifest_path):
    """Compile one manifest/source package into the generated preset shape."""
    with io.open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    if manifest.get("schemaVersion") != 1:
        raise ValueError("unsupported schemaVersion in %s" % manifest_path)

    package_dir = os.path.dirname(manifest_path)
    entry_path = os.path.join(package_dir, manifest.get("entry", "source.txt"))
    if not os.path.exists(entry_path):
        raise ValueError("missing package entry: %s" % entry_path)
    with io.open(entry_path, encoding="utf-8") as fh:
        source = fh.read()
    html, css = split_style_blocks(source)

    template = {
        "id": manifest["id"],
        "name": manifest["name"],
        "author": manifest.get("author", "Unknown"),
        "credit": manifest.get("credit", ""),
        "blurb": manifest.get("description", ""),
        "components": [],
    }
    keys = set(c["key"] for c in manifest.get("components", []))
    check_coverage(html, css, keys, entry_path)
    for comp in manifest.get("components", []):
        key = comp["key"]
        part_css = marked_block(css, key, css=True)
        part_html = marked_block(html, key)
        if not part_css and not part_html:
            raise ValueError("component '%s' has no matching markers in %s" %
                             (key, entry_path))
        unknown = [need for need in comp.get("needs", []) if need not in keys]
        if unknown:
            raise ValueError("component '%s' has unknown needs: %s" %
                             (key, ", ".join(unknown)))
        entry = {
            "id": manifest["id"] + "-" + key,
            "key": key,
            "name": comp["name"],
            "blurb": comp.get("blurb", comp["name"]),
            "css": part_css,
        }
        if part_html:
            entry["html"] = part_html
        if comp.get("needs"):
            entry["needs"] = [manifest["id"] + "-" + need for need in comp["needs"]]
        if comp.get("required"):
            entry["required"] = True
        if comp.get("recommended"):
            entry["recommended"] = True
        if comp.get("affects"):
            entry["affects"] = comp["affects"]
        template["components"].append(entry)
    return template


def package_manifests():
    """All local template packages, in a stable order for reproducible output."""
    directory = os.path.join(ROOT, "templates")
    if not os.path.isdir(directory):
        return []
    manifests = []
    for name in sorted(os.listdir(directory)):
        path = os.path.join(directory, name, "manifest.json")
        if os.path.isfile(path):
            manifests.append(path)
    return manifests


# --------------------------------------------------------------------------
def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    if not os.path.exists(src):
        sys.exit("template not found: %s" % src)

    print("reading %s" % os.path.basename(src))
    with io.open(src, encoding="utf-8") as fh:
        text = fh.read()

    html, css = split_style_blocks(text)

    for old, new in SUBSTITUTIONS:
        css = css.replace(old, new)
    for pattern in DROP_DECLARATIONS:
        css = re.sub(pattern, "", css)

    buckets = {c["id"]: {"css": [], "html": []} for c in SPEC}

    for node in split_css_nodes(css):
        prelude = prelude_of(node)
        if re.match(r"@(media|supports)\b", prelude, re.I):
            media_prelude, inner = split_media(node)
            grouped = {}
            for rule in inner:
                grouped.setdefault(assign(prelude_of(rule)), []).append(rule)
            for comp_id, rules in grouped.items():
                body = "\n".join("  " + r.replace("\n", "\n  ") for r in rules)
                buckets[comp_id]["css"].append("%s {\n%s\n}" % (media_prelude, body))
            continue
        buckets[assign(prelude)]["css"].append(node)

    # markup, matched to a component by the class on its outermost element
    by_class = {}
    for comp in SPEC:
        for cls in comp.get("html", []):
            by_class[cls] = comp["id"]

    for cls_attr, source in top_level_elements(html):
        classes = cls_attr.split()
        for cls in classes:
            if cls in by_class:
                buckets[by_class[cls]]["html"].append(source.strip())
                break

    by_id = {c["id"]: c for c in SPEC}
    assert sorted(EMIT_ORDER) == sorted(by_id), "EMIT_ORDER must list every component"

    components = []
    for comp in [by_id[i] for i in EMIT_ORDER]:
        bucket = buckets[comp["id"]]
        entry = {
            "id": "%s-%s" % (TEMPLATE["id"], comp["id"]),
            "key": comp["id"],
            "name": comp["name"],
            "blurb": comp["blurb"],
            "css": "\n\n".join(bucket["css"]) + ("\n" if bucket["css"] else ""),
        }
        if bucket["html"]:
            entry["html"] = "\n\n".join(bucket["html"]) + "\n"
        if comp.get("needs"):
            entry["needs"] = ["%s-%s" % (TEMPLATE["id"], n) for n in comp["needs"]]
        if comp.get("required"):
            entry["required"] = True
        if comp.get("recommended"):
            entry["recommended"] = True
        if comp.get("affects"):
            entry["affects"] = comp["affects"]
        components.append(entry)

        print("  %-14s %5d chars css  %s"
              % (comp["id"], len(entry["css"]),
                 "%d html block(s)" % len(bucket["html"]) if bucket["html"] else ""))

    payload = dict(TEMPLATE)
    payload["components"] = components
    payloads = [payload]
    for manifest_path in package_manifests():
        package = package_payload(manifest_path)
        payloads.append(package)
        print("  package %-12s %d components" % (package["id"], len(package["components"])))

    with io.open(OUT, "w", encoding="utf-8") as fh:
        fh.write(
            "/* Generated by tools/build_template.py - do not edit by hand.\n"
            " *\n"
            " * Advanced presets: complete community templates, split into pieces you\n"
            " * can apply one at a time. Every rule is the author's, verbatim.\n"
            " */\n"
            "window.JAI_TEMPLATES = %s;\n"
            % json.dumps(payloads, ensure_ascii=False, indent=1)
        )
    print("-> js/templates.js (%d templates)" % len(payloads))


if __name__ == "__main__":
    main()
