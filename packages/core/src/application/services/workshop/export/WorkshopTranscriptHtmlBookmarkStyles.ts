/**
 * The bookmark mark in the styled-HTML transcript (ADR 2026-11-03 D10).
 *
 * Export-only rules, in the PAGE layer of `WorkshopTranscriptHtmlStyles`:
 * the thread has no bookmark mark of its own to mirror yet (Slice 5 adds the
 * bubble's toggle). When it does, the mark's look moves to the MIRRORED layer
 * and this file keeps only what a static page needs.
 */

export const WORKSHOP_TRANSCRIPT_BOOKMARK_CSS = `
[data-pm-surface="workshop"] .pm-ws-export-bookmark {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #ee7d49;
}
[data-pm-surface="workshop"] .pm-ws-export-bookmark svg {
  fill: currentColor;
}
[data-pm-surface="workshop"] .pm-ws-turn-user .pm-ws-export-bookmark {
  display: flex;
  margin: 0 0 6px;
}
`;
