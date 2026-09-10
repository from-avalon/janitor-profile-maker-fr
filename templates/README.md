# JanitorAI template package format

Template packages are source-controlled folders that can produce one paste-ready
About Me document. The format is deliberately static: it never permits scripts,
remote code, or runtime dependencies.

## Version 1 layout

```text
templates/<template-id>/
  manifest.json   machine-readable identity, components and affected regions
  source.txt      the complete paste-ready About Me document
```

`source.txt` is both the canonical source and the distributable file. Components
are bounded by inert comments:

```html
<!-- @jai:component hero:start -->
...
<!-- @jai:component hero:end -->
```

The same markers may appear inside `<style>`. Marker keys must match component
keys declared in `manifest.json`. This makes splitting deterministic and avoids
guessing component ownership from CSS selectors.

`python tools/build_template.py` compiles every local package under
`templates/*/manifest.json` into the Advanced Templates registry. The legacy
Dark Red source still uses its selector splitter; package templates use their
declared markers directly.

## Manifest principles

- `schemaVersion` is currently `1`.
- `id` is lowercase kebab-case and globally unique within a workshop.
- `version` uses semantic versioning.
- `license` and `credit` are required for workshop distribution.
- Every component declares `affects`, a list of stable JanitorAI regions.
- `needs` contains component keys, not generated IDs.
- `assets` describes replaceable hosted images without embedding remote code.
- `compatibility` records the tested profile surface and known limitations.

An importer should reject missing or overlapping markers, undeclared components,
dependency cycles, blocked HTML/CSS, duplicate IDs and non-HTTPS asset URLs. It
should compile a fresh paste-ready document from selected components rather than
executing anything supplied by a template author.
