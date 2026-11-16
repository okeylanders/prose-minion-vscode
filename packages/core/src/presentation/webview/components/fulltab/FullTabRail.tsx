/**
 * FullTabRail — a side region of a full editor tab (ADR 2026-10-19 D2).
 *
 * An `aside` with its own error boundary, so dynamic panel data that throws
 * mid-render takes down only this column, with a retry, never the tab. The
 * label names the region for assistive tech; the boundary name is what the
 * fallback says broke. The leading rail and the optional trailing aside
 * share this component and differ only in their frame class.
 *
 * A rail may opt in to collapsing (`collapse`): a control at its top edge,
 * the tab's own strip while collapsed, and the content kept mounted but
 * hidden, so a draft a panel holds survives. The rail owns the control, the
 * focus rule (collapsing never drops focus: it lands on the control) and
 * Escape on an overlaid rail; what the strip shows is the tab's. Without the
 * opt-in the markup is exactly as before.
 */
import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { ErrorBoundary } from '@components/shared/ErrorBoundary';
import { TabErrorFallback } from '@components/shared/TabErrorFallback';

export type FullTabBoundaryErrorHandler = (error: Error, errorInfo: React.ErrorInfo) => void;

export type FullTabRailPlacement = 'rail' | 'aside';

const PLACEMENT_CLASS: Record<FullTabRailPlacement, string> = {
  rail: 'pm-ws-rail',
  aside: 'pm-ws-aside'
};

/** The id the collapse control's `aria-controls` names: the rail's content. */
export const FULL_TAB_RAIL_BODY_ID = 'pm-ws-rail-body';

export interface FullTabRailCollapse {
  collapsed: boolean;
  /** A narrow tab: the open rail lays over the main column instead of squeezing it. */
  overlay: boolean;
  onToggle: () => void;
  /** What the collapsed rail shows in place of its content; the tab's own. */
  strip: React.ReactNode;
}

const TEXT_ENTRY = 'input, textarea, select, [contenteditable]';

export interface FullTabRailProps {
  /** Accessible name of the region, e.g. "Session rail". */
  label: string;
  /** Names the region in the error fallback, e.g. "Workshop rail". */
  boundaryName: string;
  onBoundaryError?: FullTabBoundaryErrorHandler;
  /** `rail` is the leading column (default); `aside` the optional trailing one. */
  placement?: FullTabRailPlacement;
  /** Opt-in: the rail collapses to the tab's strip. */
  collapse?: FullTabRailCollapse;
  children: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const FullTabRail: React.FC<FullTabRailProps> = ({
  label,
  boundaryName,
  onBoundaryError,
  placement = 'rail',
  collapse,
  children
}) => {
  const boundaryRef = React.useRef<ErrorBoundary>(null);
  const controlRef = React.useRef<HTMLButtonElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const collapsed = collapse?.collapsed ?? false;
  const overlay = collapse?.overlay ?? false;
  const onToggle = collapse?.onToggle;

  // The content is hidden once collapsed; focus left inside it would drop.
  const moveFocusToControlWhenCollapsed = React.useCallback(() => {
    if (collapsed && bodyRef.current?.contains(document.activeElement)) {
      controlRef.current?.focus();
    }
  }, [collapsed]);

  React.useLayoutEffect(() => {
    moveFocusToControlWhenCollapsed();
  }, [moveFocusToControlWhenCollapsed]);

  // Escape closes a rail laid over the thread, unless a field inside it is
  // using the key (an inline edit's cancel).
  const closeOverlayOnEscape = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!overlay || event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }
      if (event.target instanceof Element && event.target.closest(TEXT_ENTRY)) {
        return;
      }
      controlRef.current?.focus();
      onToggle?.();
    },
    [onToggle, overlay]
  );

  if (collapse) {
    const stateClass = collapsed ? ' pm-ws-rail-collapsed' : overlay ? ' pm-ws-rail-overlay' : '';
    return (
      <aside
        className={`${PLACEMENT_CLASS[placement]} pm-ws-rail-collapsible${stateClass}`}
        aria-label={label}
        onKeyDown={closeOverlayOnEscape}
      >
        <button
          ref={controlRef}
          className="pm-ws-rail-toggle"
          type="button"
          aria-label="Side pane"
          aria-expanded={!collapsed}
          aria-controls={FULL_TAB_RAIL_BODY_ID}
          title={collapsed ? 'Expand side pane' : 'Collapse side pane'}
          onClick={onToggle}
        >
          <Icon name={collapsed ? 'chevRight' : 'chevLeft'} size={14} />
        </button>
        <ErrorBoundary
          ref={boundaryRef}
          fallback={
            <TabErrorFallback
              tabName={boundaryName}
              onRetry={() => boundaryRef.current?.reset()}
            />
          }
          onError={onBoundaryError}
        >
          {collapsed ? collapse.strip : null}
          <div ref={bodyRef} id={FULL_TAB_RAIL_BODY_ID} className="pm-ws-rail-body" hidden={collapsed}>
            {children}
          </div>
        </ErrorBoundary>
      </aside>
    );
  }

  return (
    <aside className={PLACEMENT_CLASS[placement]} aria-label={label}>
      <ErrorBoundary
        ref={boundaryRef}
        fallback={
          <TabErrorFallback
            tabName={boundaryName}
            onRetry={() => boundaryRef.current?.reset()}
          />
        }
        onError={onBoundaryError}
      >
        {children}
      </ErrorBoundary>
    </aside>
  );
};
