/**
 * LightboxApp — the `lightbox` surface's React root (ADR 2026-10-19 D1).
 *
 * A placeholder until Slice 2A. No host opens this surface yet (the
 * LightboxPanelProvider arrives with 2A), but the surface exists so every
 * branch on `WebviewSurface` is exhaustive, and rendering it on the shared
 * FullTabShell proves the frame is not Workshop-shaped. Slice 2A replaces the
 * body with the board, the chrome from `useFullTabChrome` and the source rail.
 */
import * as React from 'react';
import { FullTabShell } from '@components/fulltab/FullTabShell';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxApp: React.FC = () => (
  <FullTabShell
    brand={{
      eyebrow: 'Prose Minion · Inspiration & Mood Board',
      title: 'Lightbox',
      subtitle: 'Not available yet'
    }}
    rail={{ label: 'Board rail', boundaryName: 'Lightbox rail', content: null }}
    main={{
      label: 'Board',
      content: <p role="status">The Lightbox board arrives in a later update.</p>
    }}
  />
);
