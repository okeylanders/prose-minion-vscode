# Slice 4: Context Sheet Marks

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D4 (derived), D7 (the mark)
**Branch:** `epic-pinned-context-slice-4-sheet-marks`
**Status:** Waits on Slice 3 (the hook). Wayfinding's context sheet is in the
epic since the merge at `17d52cf`. Question 6 is decided: Pin from a pill, as
drawn.

## Outcome

In the Workshop's context sheet, a pinned pill shows a small pin mark. Its
tooltip says the file comes back in every new session, and that removing it
here removes it from this conversation only. A hovered, unpinned file pill
offers a small **Pin** button (question 6, as drawn in `Workshop.dc.html`).
Unpinning stays in the tab.

## Build

- The mark is derived with `workshopPinnedContextMatches` over the hook's
  entries and the pill's attachment (ADR D4). Nothing is stored in the
  session.
- It is drawn in the pill as 0d draws it: a small accent `pin` after the
  word count, with `role="img"` and the name "Pinned". The pill's
  accessible name gains ", pinned".
- **Pin** shows on a file pill that isn't pinned, on hover and focus, as 0d
  draws it. Its name is "Pin *label* for new sessions". It posts Slice 3's
  `WORKSHOP_PIN_CONTEXT_ATTACHMENTS` with the pill's attachment id, and adds
  no route. A text note or a wizard pill never offers it.
- A pinned pill offers no Unpin. The tab owns unpinning.
- The pill's Remove is unchanged.

## Tests

- The mark follows the list: pinning shows it, and unpinning clears it in
  the same room.
- A file attached under a catalog key and pinned under the same path
  matches. So does a workspace file pinned by `relativePath`. Two different
  paths never match.
- The accessible name and tooltip.
- Pin from a pill: it pins, the mark appears, and the button goes. The
  refusal past the budget or the 20-file bound is shown where the pill is.
  Text notes, wizard pills and pinned pills offer no Pin.

## Completion criteria

- [x] The mark and tooltip match the approved design.
- [x] No session-format change (`WorkshopSessionStateV1Shape` untouched).
- [x] The epic's verification passes, with counts recorded here.

## Built

**Commits** (on `fa5aef63`, Slice 3's head).

- `51d0ab3`: the pure view and the presentation controller, with tests.
- `e6e8da5`: the pills (mark, tooltip, Pin, refusal), styles, the wiring in
  `WorkshopApp.tsx`, the integration test and a boundary guard.
- `1312ece`: this doc.
- The context head's "· *N* pinned" (the coordinator's ruling on deviation
  6: the approved board draws it), its tests, and this doc's update.

**Where each piece lives.**

| Piece | Where |
|---|---|
| Each pill in words, pure: pinned (the match rule over the host's last list, with its platform), Pin and its name, its own refusal, a landed pin; the head's count | `hooks/domain/workshop/pinnedContext/workshopPinnedPills.ts` (121 lines; `workshopPinnedPillViews`, `workshopPinnedPillsCountText`, `WORKSHOP_PINNED_PILL_TIP`, `WORKSHOP_PINNED_PILL_CHANGED`) |
| The controller (tripartite, empty persistence): holds which pill last asked, takes Slice 3's `pinAttachments` as a port, posts nothing | `hooks/domain/workshop/controllers/useWorkshopPinnedPills.ts` (82) |
| The pills, presentational: mark, tooltip, Pin, refusal line, the head's count | `components/workshop/ContextPanel.tsx` (275 → 341); an optional `pinned` prop, absent draws none of it |
| Wiring | `WorkshopApp.tsx` (+3: one import, one controller call, one prop) |
| Styles | `styles/workshop/pinnedContext.css` (a "context sheet's pills" section) |

**How it works.**

- **The mark is derived** (D4). A pill is pinned when an entry of the list
  the host last sent matches it by `workshopPinnedContextMatches`, with the
  answer's `platform`. Before an answer, while the list is unavailable, or
  while `pinned-context.json` can't be read (or is `busy`/`io`), nothing is
  marked. Nothing is stored: the session shape is untouched.
- **The mark** is an accent `pin` (11px) after the word count, `role="img"`
  named "Pinned". The label button's name becomes "*label*, pinned", and it
  is described by the tooltip (`role="tooltip"`), shown on the pill's hover
  and focus: "**Pinned:** attached to every new session. Removing it here
  removes it from this conversation only."
- **Pin** shows on an unpinned file pill whose origin isn't `wizard` and that
  the tab could pin (Slice 3's `view.pinAttached.ids`: it has a catalog key
  or relative path, and there is a list to change). It is hidden until the
  pill is hovered or holds the focus, and stays in the tab order, so tabbing
  to it shows it. It's named "Pin *label* for new sessions", posts
  `WORKSHOP_PIN_CONTEXT_ATTACHMENTS` with the pill's id through the hook (no
  new route), and is disabled while any change waits for the host.
- **The answer.** A landed pin brings the list with the file in it, so the
  mark appears and the button goes. If the focus went with the button, it
  returns to the pill's label. A refusal (`ok: false`) to the pill's own
  request shows on its own line under the pill (`role="alert"`, describing
  its Pin button): the host's words for `refused`, or this slice's line for
  `changed`. Any later answer to another request, or the next Pin, clears it.
- A pinned pill offers no Unpin; Remove is unchanged on every pill.
- **The head's count** (`Workshop.dc.html`'s `block-meta`, "10 attached ·
  8 pinned · …", as today's panel draws it): `pm-ws-ctx-count` reads "10
  attachments · 8 pinned". *N* is the pills that show the mark, from the same
  `workshopPinnedPillViews` result, not the list's length: a file pinned but
  not in the room isn't counted. At 0, and before the host's first answer,
  it reads exactly as before ("10 attachments"). The words stay in the meter
  under the pills, so the head leaves them out, and keeps today's word
  "attachments".

**Tests.**

- `workshopPinnedPills.test.ts` (16): the match rules (a catalog key; a
  workspace file by relative path; two different paths never; case under
  Windows and not POSIX; `σ`/`ς` one file under Windows and two under
  POSIX; a text note never); nothing marked before an answer, unavailable or
  unreadable; Pin's name and pending; no Pin on a pinned pill, a text note,
  a wizard pill, or with no list to change; a refusal on its own pill only,
  `changed`, cleared by another answer and never on a landed pin; `landed`;
  the head's count at 0, 1 ("1 pinned") and 2.
- `ContextPanel.pinned.test.tsx` (8), through the real
  `useWorkshopPinnedContext`, the controller and `ContextPanel`, the host
  played by hand: the mark follows the list in the same room (pinning shows
  it, unpinning clears it, the attachments unchanged); the accessible name,
  the mark's place after the word count and the tooltip; Pin posts by id and
  revision, then the mark appears, the button goes and the focus returns; a
  refusal at the pill, cleared by the next Pin; only the writer's unpinned
  file pill offers Pin, and nothing offers Unpin; Remove unchanged; no list,
  no mark and no Pin; the head reads "4 attachments" before the answer and
  at 0, then "· 1 pinned", then "· 2 pinned" with three files pinned and two
  of them in the room.
- `boundaries.test.ts` (+1): `ContextPanel.tsx` posts nothing, and
  `WorkshopSessionStateV1.ts` names no pinned mark. The existing guard keeps
  the new controller off the transport.
- **Existing tests unchanged:** `ContextPanel.test.tsx`, every
  `WorkshopApp*.test.tsx` (the context-selector parity included) and the
  context-sheet controller's tests pass with no diff. The `pinned` prop is
  optional, so a panel without it draws exactly what it drew.

## Verification

| Check | Before (`fa5aef63`, after `npm ci`) | After (the head's count) |
|---|---|---|
| `npm run typecheck` | pass | pass |
| `npx jest -w 2` | 705 suites / 9,966 tests / 59 snapshots, all passing | 707 suites / 9,991 tests / 59 snapshots, all passing (9,989 at `e6e8da5`) |
| `npm run lint` | 0 errors / 1,165 warnings | 0 errors / 1,165 warnings (none new) |
| `from 'vscode'` in `packages/core/src` | none | none |
| New files over 500 lines | — | none (largest: the integration test, 217) |
| Files already over 500 | — | wiring only: `WorkshopApp.tsx` 1,814 → 1,817 |
| Fixtures and tests | — | *Alice*-style made-up names and paths only |

The baseline equals Slice 3's measurement on the same commit. Its jest run
overlapped this slice's first, additive edits (new files, an optional prop);
its counts match Slice 3's exactly.

The styles were checked by eye in Chromium against `Workshop.dc.html`, with
the real stylesheets on static pill markup: the accent mark, the tooltip on
hover, the hovered Pin with the accent border, and the refusal line.

## Deviations

1. **The refusal of a stale revision** (`notice: changed`, which carries no
   words) reads, in the design's voice: "Pinned context changed in another
   window, so nothing was pinned. Try Pin again." Every other refusal is the
   host's words.
2. **The refusal sits on its own line under the pill,** full width, in the
   amber treatment of the tab's problem line. 0d draws no pill refusal; the
   spec says only "where the pill is".
3. **A wizard pill that is pinned shows the mark** (the match rule doesn't
   look at origin), though it never offers Pin. The slice says only that
   wizard pills never offer Pin.
4. **Pin follows Slice 3's view of what can be pinned,** so no Pin shows
   before the host's first answer, without a project folder, in a
   multi-root window, or while the list file can't be read.
5. **Focus returns to the pill's label** when its own Pin lands and the
   focus went with the button. The design doesn't draw focus.
6. **The head's count is built** from the approved board's `block-meta`
   (the coordinator's ruling, 2026-11-05: the approved design owns the copy).
   It appends "· *N* pinned" to today's count and keeps the word
   "attachments"; the words stay in the meter. See How it works.
7. **A file pill's glyphs are blue** (`context.css`), so the pin mark and the
   Pin button's glyph set `color: inherit` to keep the accent and text
   colors the board draws.

## Progress

- **2026-11-04.** Slice doc written with the spec.
- **2026-11-05.** Built on `epic-pinned-context-slice-4-sheet-marks`; see
  Built, Verification and Deviations above.
