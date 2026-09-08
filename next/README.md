# Next.js integration

Drop-in files for a **Next 16 (App Router) · React 19 · Tailwind v4 · shadcn/ui**
site, plus a GA4 bridge via `@next/third-parties`.

## Why the studio is embedded, not ported

The studio stays a static app served from `public/studio/` and shown in an iframe.
That is a deliberate choice, not laziness:

- **Tailwind v4's preflight would reset it.** The studio ships a complete design of
  its own — its own reset, tokens and components. Dropping it into a Tailwind page
  means either fighting preflight forever or scoping every rule. An iframe is a
  hard style boundary and costs nothing.
- **It already nests an iframe.** The preview *must* be a separate document, because
  the whole point is that the CSS you are writing takes effect without leaking into
  the editor UI around it. That constraint survives any rewrite.
- **Zero-cost updates.** `npm run studio:sync` re-copies the studio. No porting
  work when the studio changes.

If you later want the chrome in shadcn — the toolbar, panels and tabs — that is a
real project, and the preview stays an iframe inside it regardless.

## Install

**1. Copy the route in.** From this repo:

```bash
cp -r next/app/studio /path/to/your-site/app/studio
```

**2. Wire the sync step** in your site's `package.json`:

```json
{
  "scripts": {
    "studio:sync": "node ../css-studio/tools/sync-to-next.mjs .",
    "predev": "npm run studio:sync",
    "prebuild": "npm run studio:sync"
  }
}
```

Adjust the path to wherever this repo sits — a sibling directory, or a git
submodule under the site. Running it on `predev`/`prebuild` means the copy in
`public/` is never stale, and you can safely `.gitignore` `public/studio/` in the
site repo.

**3. Ignore the copy** in the site's `.gitignore`:

```
public/studio/
```

**4. Open `/studio`.**

## GA4

Analytics are already wired if you have `@next/third-parties` set up in your root
layout:

```tsx
import { GoogleAnalytics } from '@next/third-parties/google';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
      <GoogleAnalytics gaId="G-XXXXXXXXXX" />
    </html>
  );
}
```

The route records page views like any other. Beyond that, the studio posts a small
set of events across the iframe boundary and `studio-frame.tsx` forwards them:

| Event | Label |
| --- | --- |
| `studio_ready` | — |
| `preset_applied` | preset id |
| `template_applied` | template id |
| `template_part_applied` | component id |
| `css_copied` | `clean` / `with-blocked` |
| `profile_imported` | — |
| `viewport_changed` | viewport name |

The bridge is allow-listed on both sides: the studio only ever posts these names,
and the host only forwards names in `ALLOWED_EVENTS`, same-origin only. **The
creator's CSS is never sent** — it is their work, and it is not GA's business.

To add an event, call `reportToHost(name, label)` in `js/app.js` and add the name
to `ALLOWED_EVENTS` in `studio-frame.tsx`. Both are required, so nothing new
starts flowing to analytics by accident.

## Notes

- **Size.** `public/studio/` is ~7.4MB, most of it `preview/profiles/default.mhtml`
  (the bundled profile capture). It is static and cacheable; if that matters, swap
  it for a smaller capture or drop it and let the built-in snapshot render instead.
- **Routing.** The studio uses relative URLs throughout, so it works under any
  prefix. If you serve it somewhere other than `/studio/`, only the `src` in
  `studio-frame.tsx` needs to change.
- **Nothing leaves the browser.** The studio makes no network requests beyond its
  own assets and Google Fonts. Imported profiles are parsed locally and never
  uploaded.
