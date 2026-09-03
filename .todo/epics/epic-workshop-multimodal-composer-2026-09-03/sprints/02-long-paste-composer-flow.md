# Sprint 02: Long-Paste Composer Flow

**Status:** Planned

**Proposed branch:** `sprint/workshop-multimodal-composer-02-long-paste`

**Depends on:** Sprint 01 typed artifacts

**Blocks:** Epic closure; this slice is independently reviewable

## Goal

Turn a long plain-text paste into a compact, inspectable one-shot attachment
without disturbing ordinary typing, short paste, or surrounding draft text.

## Deliverables

1. Add a correlated `WORKSHOP_STAGE_MESSAGE_TEXT` intent/result route. The host
   validates, bounds, labels, mints `ta-N`, marks dirty, and posts authoritative
   session state.
2. Intercept only `text/plain` paste events meeting the accepted threshold.
   Prevent native insertion, leave the existing draft/selection unchanged, and
   show an accessible pending state until the host acknowledges it.
3. Reuse the attachment tray. A pasted-text pill shows label, word count, and
   head-slice status; activation opens an editable text sheet through a
   display-safe on-demand body route.
4. Support remove and edit with stale-result correlation and aggregate-owned
   validation. Editing cannot change the stable `ta-N` id.
5. Enable send when either trimmed draft text or a staged attachment exists.
   For attachment-only sends, persist honest display copy such as
   `Shared 1 attachment` while the model receives only the attachment content.
6. Preserve commit-on-success and rollback behavior. Host rejection leaves the
   clipboard untouched and explains why no pill was staged.
7. Finish the long-paste pill's narrow-sidebar layout, keyboard removal, focus
   behavior, and screen-reader copy in this slice rather than deferring its UX
   debt to release qualification.

## Boundary cases

- Exactly threshold minus one and exactly threshold characters.
- Empty/whitespace-only, CRLF, Unicode, rich-text clipboard with plain fallback,
  and a paste while the attachment list is full.
- Repeated identical paste: accepted as distinct writer actions unless Gate 00 locks
  content-digest deduplication.
- Paste while a run is active or before session hydration: refused without local
  ghost state.
- Edit while an earlier preview response is in flight: stale response ignored.
- Send before staging acknowledgement: disabled until the host snapshot lands.

## Completion criteria

- [ ] Short paste is byte-for-byte native textarea behavior.
- [ ] Long paste produces one host-owned pill and does not enter the textarea.
- [ ] The writer can inspect, edit, remove, reload, send, cancel, fail, and retry
      the pasted artifact without losing it.
- [ ] Quick actions do not consume the pill.
- [ ] Component, hook, route, aggregate, persistence, and accessibility tests pass.

## Rollback seam

Disable the paste interception and text-staging route. Typed text-file behavior
and schema v3 remain valid.
