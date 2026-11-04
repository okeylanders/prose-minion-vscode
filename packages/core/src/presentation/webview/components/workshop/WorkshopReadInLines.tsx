/**
 * The reader's numbered lines for a ranged read (ADR 2026-11-03 D4; design:
 * `docs/design/workshop-wayfinding/Reader.dc.html`).
 *
 * The lines a participant read carry a left accent bar, and a marker follows
 * the last of them: "End of Jill's read · line 64". It scrolls to the first
 * line read the first time its pane is visible: an element in a `hidden`
 * pane has no scroll position, and the host's reply can land before the
 * sheet switches to the Source tab (PR #187 N-01). The text is the file as it is now: when the file has
 * changed, the band marks line numbers, which is all the record holds, and
 * the sheet's banner says so. A marker for a line the text no longer reaches
 * (the file shrank, or the view stopped at its byte ceiling) is left out
 * rather than placed somewhere it doesn't belong.
 *
 * Lines are split as `resource.read` numbers them: on `\n`, `\r\n` counted once.
 */

import * as React from 'react';

export interface WorkshopReadInLinesProps {
  text: string;
  lineRange: { start: number; end: number };
  participantLabel: string;
  /** Names the region: the file's path. */
  label: string;
  /** True while the pane holding the lines is shown. */
  visible: boolean;
}

/** The ref is the scrolling region, so a tab switch can move focus to it. */
export const WorkshopReadInLines = React.forwardRef<HTMLDivElement, WorkshopReadInLinesProps>(({
  text,
  lineRange,
  participantLabel,
  label,
  visible
}, ref) => {
  const lines = React.useMemo(() => text.split(/\r?\n/), [text]);
  const startRef = React.useRef<HTMLLIElement>(null);
  // The range start already scrolled to, so returning to the tab keeps the
  // writer's own scroll position.
  const scrolledTo = React.useRef<number | null>(null);

  const scrollToRangeStartWhenVisible = React.useCallback(() => {
    if (!visible || scrolledTo.current === lineRange.start) {
      return;
    }
    scrolledTo.current = lineRange.start;
    startRef.current?.scrollIntoView?.({ block: 'start' });
  }, [lineRange.start, visible]);

  React.useEffect(() => {
    scrollToRangeStartWhenVisible();
  }, [scrollToRangeStartWhenVisible]);

  const marker = `End of ${participantLabel}'s read · line ${lineRange.end}`;
  return (
    <div
      ref={ref}
      className="pm-ws-readin-lines"
      role="region"
      tabIndex={0}
      aria-label={`${label}, lines ${lineRange.start}–${lineRange.end} read by ${participantLabel}`}
    >
      <ol className="pm-ws-readin-lines-list">
        {lines.map((line, index) => {
          const number = index + 1;
          const read = number >= lineRange.start && number <= lineRange.end;
          return (
            <React.Fragment key={number}>
              <li
                ref={number === lineRange.start ? startRef : undefined}
                className={`pm-ws-readin-line${read ? ' pm-ws-readin-line-read' : ''}`}
                data-line={number}
              >
                <span className="pm-ws-readin-line-number" aria-hidden="true">{number}</span>
                <span className="pm-ws-readin-line-text">{line.length > 0 ? line : ' '}</span>
              </li>
              {number === lineRange.end ? (
                // A list item like the lines, so the list keeps its semantics
                // and a screen reader reads the marker where it stands.
                <li className="pm-ws-readin-line-marker">{marker}</li>
              ) : null}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
});
WorkshopReadInLines.displayName = 'WorkshopReadInLines';
