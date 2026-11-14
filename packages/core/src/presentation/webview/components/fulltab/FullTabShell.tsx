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
  FullTabRail,
  FullTabRailCollapse
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
  /**
   * Marks the header and the split `inert` while a modal overlay is open, so
   * the browser keeps focus, Tab and pointer input in the overlay natively
   * (PR #186 N-03). Banners belong to the tab, which inerts its own (a
   * wrapper toggled here would remount them). Opt-in; without it the markup
   * is exactly as before.
   */
  inertBehindOverlay?: boolean;
  /**
   * Lets the leading rail collapse to a strip the tab supplies (Everyday
   * Conveniences, item D). The state and its callbacks come from
   * `useFullTabRailCollapse`; the shell knows nothing of what the strip
   * holds. Opt-in; without it the markup is exactly as before. Not combined
   * with an `aside`: the three-column split keeps its own narrow rules.
   */
  railCollapse?: FullTabRailCollapse;
}

function splitClassName(hasAside: boolean, railCollapse: FullTabRailCollapse | undefined): string {
  if (hasAside) {
    return 'pm-ws-split pm-ws-split-with-aside';
  }
  if (!railCollapse) {
    return 'pm-ws-split';
  }
  const state = railCollapse.collapsed
    ? ' pm-ws-split-rail-collapsed'
    : railCollapse.overlay ? ' pm-ws-split-rail-overlay' : '';
  return `pm-ws-split pm-ws-split-collapsible${state}`;
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
  children,
  inertBehindOverlay = false,
  railCollapse
}) => {
  // `inert` is spread so React 18 passes it through as a plain attribute
  // (its typings don't list it), as WorkshopApp's loading state does.
  const behind = inertBehindOverlay ? { inert: '' } : {};
  return (
  // The root's aside modifier lets the frame scroll as one page at narrow
  // widths (styles/fulltab/shell.css); tabs without an aside are unchanged.
  <div className={aside ? 'pm-ws pm-ws-with-aside' : 'pm-ws'}>
    <header className="pm-ws-header" {...behind}>
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

    <div className={splitClassName(aside !== undefined, aside ? undefined : railCollapse)} {...behind}>
      <FullTabRail
        label={rail.label}
        boundaryName={rail.boundaryName}
        onBoundaryError={onBoundaryError}
        {...(railCollapse && !aside ? { collapse: railCollapse } : {})}
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
};
