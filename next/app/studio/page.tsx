import type { Metadata } from 'next';
import StudioFrame from './studio-frame';

export const metadata: Metadata = {
  title: 'Profile CSS Studio',
  description:
    'Design JanitorAI profile CSS against a live, pixel-accurate simulation of the real profile page.',
};

/*
 * The studio is a self-contained static app served from /studio/ in public/, and
 * it is embedded rather than ported for two concrete reasons:
 *
 *   1. Tailwind v4's preflight would reset the studio's own styling out from
 *      under it, and the studio ships a full design of its own. An iframe is a
 *      hard style boundary; scoping rules would be a permanent maintenance tax.
 *   2. The studio *already* nests an iframe — the preview has to be a separate
 *      document so the CSS you are writing cannot leak into the editor UI. That
 *      constraint does not go away no matter which framework wraps it.
 *
 * So the route is a thin shell: full-bleed, no chrome, no layout interference.
 */
export default function StudioPage() {
  return <StudioFrame />;
}
