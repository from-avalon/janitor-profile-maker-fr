'use client';

import { useEffect, useRef, useState } from 'react';
import { sendGAEvent } from '@next/third-parties/google';

/*
 * Hosts the studio and bridges the few things that have to cross the iframe
 * boundary: analytics, and the browser tab title.
 *
 * The studio posts a small set of events (see reportToHost in js/app.js). Only
 * the ones listed here are forwarded, and only their names plus a coarse label —
 * never the creator's CSS, which is their work and none of GA's business.
 */

const ALLOWED_EVENTS = new Set([
  'studio_ready',
  'preset_applied',
  'template_part_applied',
  'template_applied',
  'css_copied',
  'profile_imported',
  'viewport_changed',
]);

type StudioMessage = {
  source?: string;
  type?: string;
  name?: string;
  label?: string;
};

export default function StudioFrame() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent<StudioMessage>) {
      // Same-origin only: the studio is served from our own /studio/ path.
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (!data || data.source !== 'jai-studio' || data.type !== 'analytics') return;
      if (!data.name || !ALLOWED_EVENTS.has(data.name)) return;

      sendGAEvent('event', data.name, data.label ? { label: data.label } : {});
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0e0f13]">
      {failed ? (
        <div className="flex h-full items-center justify-center p-8 text-center text-sm text-neutral-400">
          <p>
            The studio failed to load. Check that <code>public/studio/</code> exists —
            run <code>npm run studio:sync</code> to copy it in.
          </p>
        </div>
      ) : null}
      <iframe
        ref={frameRef}
        src="/studio/index.html"
        title="JanitorAI Profile CSS Studio"
        className="h-full w-full border-0"
        // The studio reads no cookies and makes no cross-origin requests, but it
        // does need same-origin scripting to drive its own preview iframe.
        sandbox="allow-scripts allow-same-origin allow-downloads allow-popups"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
