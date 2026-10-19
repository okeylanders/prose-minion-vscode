/**
 * FullTabShell — the frame every full editor tab shares (ADR 2026-10-19 D2).
 *
 * Owns the layout and nothing else: the branded header with a slot for the
 * tab's actions, a slot for banners under it, and the split below — a
 * leading rail, the main column and an optional trailing aside. What fills
 * each slot belongs to the tab (the Workshop's persona trigger, Sessions
 * menu, panels and thread stay the Workshop's). Overlays such as modals,
 * sheets and toasts are passed as children and mount inside the frame, after
 * the split, so they sit under the same style scope.
 *
 * Styles live in `styles/fulltab/`, scoped to `[data-pm-frame="fulltab"]`,
 * which the host stamps on every full-tab surface's #root.
 */
import * as React from 'react';
import { PmLogo } from '@components/shared/PmLogo';
import {
  FullTabBoundaryErrorHandler,
  FullTabRail
} from '@components/fulltab/FullTabRail';

export interface FullTabBrand {
  /** Small caps line above the title, e.g. "Prose Minion · Assistant". */
  eyebrow: string;
  /** The tab's name; renders as the page heading. */
  title: string;
  /** One line of mono meta under the title (an icon may lead it). */
  subtitle: React.ReactNode;
}

export interface FullTabRegion {
  /** Accessible name of the region. */
  label: string;
  content: React.ReactNode;
}

export interface FullTabSideRegion extends FullTabRegion {
  /** Names the region in its error fallback. */
  boundaryName: string;
}

export interface FullTabShellProps {
  brand: FullTabBrand;
  headerActions?: React.ReactNode;
  banners?: React.ReactNode;
  rail: FullTabSideRegion;
  main: FullTabRegion;
  aside?: FullTabSideRegion;
  /** Reports a side region's render failure (the main column brings its own boundaries). */
  onBoundaryError?: FullTabBoundaryErrorHandler;
  /** Overlays mounted inside the frame after the split. */
  children?: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const FullTabShell: React.FC<FullTabShellProps> = ({
  brand,
  headerActions,
  banners,
  rail,
  main,
  aside,
  onBoundaryError,
  children
}) => (
  // The root's aside modifier lets the frame scroll as one page at narrow
  // widths (styles/fulltab/shell.css); tabs without an aside are unchanged.
  <div className={aside ? 'pm-ws pm-ws-with-aside' : 'pm-ws'}>
    <header className="pm-ws-header">
      <div className="pm-ws-brand">
        <div className="pm-ws-logo">
          <PmLogo />
        </div>
        <div>
          <div className="pm-ws-eyebrow pm-ws-header-eyebrow">{brand.eyebrow}</div>
          <h1 className="pm-ws-title">{brand.title}</h1>
          <p className="pm-ws-subtitle">{brand.subtitle}</p>
        </div>
      </div>
      <div className="pm-ws-header-actions">{headerActions}</div>
    </header>

    {banners}

    <div className={aside ? 'pm-ws-split pm-ws-split-with-aside' : 'pm-ws-split'}>
      <FullTabRail
        label={rail.label}
        boundaryName={rail.boundaryName}
        onBoundaryError={onBoundaryError}
      >
        {rail.content}
      </FullTabRail>

      <section className="pm-ws-main" aria-label={main.label}>
        {main.content}
      </section>

      {aside && (
        <FullTabRail
          placement="aside"
          label={aside.label}
          boundaryName={aside.boundaryName}
          onBoundaryError={onBoundaryError}
        >
          {aside.content}
        </FullTabRail>
      )}
    </div>

    {children}
  </div>
);
