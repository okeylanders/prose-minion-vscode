/**
 * "Show earlier turns" (ADR 2026-11-17 D7): the control that leads a long
 * room's thread, its one live region, and the scroll hold that keeps the
 * writer's place when a page lands above it.
 *
 * It posts nothing: the press is the hook's (`useWorkshopEarlierTurns`).
 */

import * as React from 'react';
import type { WorkshopEarlierTurnsThreadView } from '@hooks/domain/workshop/useWorkshopEarlierTurns';
import {
  measureWorkshopThreadPlace,
  restoreWorkshopThreadPlace,
  type WorkshopThreadPlace
} from '@utils/workshopThreadScrollHold';

/** The thread's scrolling element, which this control is drawn inside. */
const THREAD_SCROLLER = '.pm-ws-thread';

interface ScrollHoldProps {
  /** Moves when an older page lands. */
  landSerial: number;
  /** The attribute each bubble carries its turn id on. */
  rowAttribute: string;
}

/**
 * Measures the writer's place before React changes the thread and puts it
 * back after. A class, because only `getSnapshotBeforeUpdate` reads the DOM
 * before a commit's changes land.
 */
class WorkshopThreadScrollHold extends React.Component<ScrollHoldProps, object, WorkshopThreadPlace | null> {
  private readonly marker = React.createRef<HTMLSpanElement>();

  private scroller(): HTMLElement | null {
    const marker = this.marker.current;
    return marker?.closest<HTMLElement>(THREAD_SCROLLER) ?? marker?.parentElement ?? null;
  }

  getSnapshotBeforeUpdate(previous: ScrollHoldProps): WorkshopThreadPlace | null {
    const scroller = this.scroller();
    return previous.landSerial === this.props.landSerial || !scroller
      ? null
      : measureWorkshopThreadPlace(scroller, this.props.rowAttribute);
  }

  componentDidUpdate(_previous: ScrollHoldProps, _state: object, place: WorkshopThreadPlace | null): void {
    const scroller = this.scroller();
    if (place && scroller) {
      restoreWorkshopThreadPlace(scroller, this.props.rowAttribute, place);
    }
  }

  render(): React.ReactNode {
    return <span ref={this.marker} hidden data-pm-earlier-turns-hold="" />;
  }
}

interface WorkshopEarlierTurnsControlProps {
  earlier: WorkshopEarlierTurnsThreadView;
  rowAttribute: string;
}

const ERROR_ID = 'pm-ws-earlier-turns-error';

export const WorkshopEarlierTurnsControl: React.FC<WorkshopEarlierTurnsControlProps> = ({ earlier, rowAttribute }) => {
  const { remaining, pending, error, onShowEarlier } = earlier;
  const press = React.useCallback(() => {
    if (!pending) {
      onShowEarlier();
    }
  }, [pending, onShowEarlier]);
  return (
    <>
      <WorkshopThreadScrollHold landSerial={earlier.landSerial} rowAttribute={rowAttribute} />
      {/* One polite region, present before any page lands, so a page is announced once. */}
      <div className="pm-ws-visually-hidden" role="status" aria-live="polite" data-pm-earlier-turns-announcer="">
        <span key={earlier.announcementSerial}>{earlier.announcement}</span>
      </div>
      {remaining > 0 && (
        <div className="pm-ws-thread-hidden pm-ws-thread-earlier">
          <button
            type="button"
            className="pm-ws-thread-earlier-button"
            // Kept focusable while it waits, so a keyboard press does not lose its place.
            aria-disabled={pending ? 'true' : undefined}
            aria-describedby={error ? ERROR_ID : undefined}
            onClick={press}
          >
            {pending
              ? 'Loading earlier turns…'
              : `Show earlier turns (${remaining.toLocaleString()} not shown)`}
          </button>
          <span className="pm-ws-thread-earlier-note">
            {remaining === 1 ? 'It\'s' : 'They\'re'} kept in full: export, bookmarks and the personas still have{' '}
            {remaining === 1 ? 'it' : 'them'}.
          </span>
          {error && <span id={ERROR_ID} className="pm-ws-thread-earlier-error">{error}</span>}
        </div>
      )}
    </>
  );
};
