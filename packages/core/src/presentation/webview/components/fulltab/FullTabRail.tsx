/**
 * FullTabRail — a side region of a full editor tab (ADR 2026-10-19 D2).
 *
 * An `aside` with its own error boundary, so dynamic panel data that throws
 * mid-render takes down only this column, with a retry, never the tab. The
 * label names the region for assistive tech; the boundary name is what the
 * fallback says broke. The leading rail and the optional trailing aside
 * share this component and differ only in their frame class.
 */
import * as React from 'react';
import { ErrorBoundary } from '@components/shared/ErrorBoundary';
import { TabErrorFallback } from '@components/shared/TabErrorFallback';

export type FullTabBoundaryErrorHandler = (error: Error, errorInfo: React.ErrorInfo) => void;

export type FullTabRailPlacement = 'rail' | 'aside';

const PLACEMENT_CLASS: Record<FullTabRailPlacement, string> = {
  rail: 'pm-ws-rail',
  aside: 'pm-ws-aside'
};

export interface FullTabRailProps {
  /** Accessible name of the region, e.g. "Session rail". */
  label: string;
  /** Names the region in the error fallback, e.g. "Workshop rail". */
  boundaryName: string;
  onBoundaryError?: FullTabBoundaryErrorHandler;
  /** `rail` is the leading column (default); `aside` the optional trailing one. */
  placement?: FullTabRailPlacement;
  children: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const FullTabRail: React.FC<FullTabRailProps> = ({
  label,
  boundaryName,
  onBoundaryError,
  placement = 'rail',
  children
}) => {
  const boundaryRef = React.useRef<ErrorBoundary>(null);

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
