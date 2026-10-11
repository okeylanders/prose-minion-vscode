# Show vs. Tell — Slice 6a (witnesses and route matrix)

**Date:** 2026-10-09 18:30 UTC

**Branch:** `epic/conversation-widgets-sprint-05-slice-6-witnesses`, cut from
`epic/conversation-widgets` at `9ce728f` (the Slice 5 merge, confirmed present).
One PR into the epic. Not merged. Docs follow in 6b on this branch.

**Sprint:** [Sprint 05 — Show vs. Tell](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md)

**Previous:** [Slice 5 handoff](20261009-1900-show-vs-tell-slice5-handoff.md)

**Split:** 6a (this note) is mechanics, witnesses, the route matrix, and full
verification on Sonnet. 6b (Haiku, same branch) owns current-state docs,
inventory counts, and the verification summary. 6a wrote none of them.

## What landed

Three commits, each green on its own. No product behavior changed except the
one hardening fix.

1. `test(workshop): add Show vs. Tell production-policy route matrix`
2. `test(workshop): add Show vs. Tell closing witnesses for shared vocabulary and independence`
3. `fix(workshop): reject non-canonical channel order in a persisted Show vs. Tell seed`

## Route matrix rows

All in `WorkshopRoomHandler.showVsTellMatrix.test.ts` (new file; `seams` is
already 973 lines). Real router, real `WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY`,
real closed adapters; only the provider and disk are faked.

| Row | Test name |
| --- | --- |
| Generation (Slice 3, kept in `seams`) | `routes Show vs. Tell generation through the real production catalog policy with exact correlation` |
| Live in policy | `is live in the production catalog policy` |
| One-shot commit | `commits the kept variants as a fresh config, turn, and artifact without generating` |
| Clone-and-recommit | `clone-recommits through fresh linked records without regeneration` |
| Over-600 refusal | `refuses a crafted over-600 payload on the host and leaves state unchanged and exportable` |
| Unknown clone provenance | `rejects unknown clone provenance before mutation and exports valid state` |
| Host-turn adoption | `adopts a recommendation on a Host turn, input-only` |
| Guest-turn adoption | `adopts a recommendation on the exact invited-Guest turn` |
| Direct tool turn | `never turns a direct tool turn into a recommendation` |

Generation needed no extension: no gap showed.

## Witnesses (deliverable 7)

- **(a) One shared mapping** — `architecture/showVsTellWitnesses.test.ts`:
  the readout imports `NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION` and
  `_LABELS` from the module and restates neither; every source naming a shared
  identifier imports the module; no file outside the module carries a lever
  value literal or a position→lever association (the scan has a negative
  control); Sprint 04's doc names the module path and says it must not
  redeclare the values or the mapping (a doc assertion, since Prose Controller
  is not built and Sprint 04 names a path).
- **(b) Independence from Lexical Gravity's gear and evidence mode.**
  - Static (same file): no Show vs. Tell module imports or names the
    standing-directive family, `applicationMode`, `evidenceMode`, or any Lexical
    Gravity identifier; the reverse scan holds for the Lexical Gravity and
    standing-directive modules. `boundaries.test.ts` already guards sibling
    feature imports and was left alone.
  - Behavioral, host (`WorkshopRoomHandler.showVsTellIndependence.test.ts`): in
    one session a Host turn carries a Lexical Gravity recommendation and a Guest
    turn a Show vs. Tell one; adopting both and committing Show vs. Tell leaves
    the installed directive, its config, gear (`interpret`) and evidence mode
    (`blend`) untouched. Shifting the directive to `recompose`/`show`, then
    removing it, leaves the committed Show vs. Tell config and artifact
    identical.
  - Behavioral, webview (`useWorkshopWidgetOpening.showVsTellIndependence.test.ts`):
    opening, closing, and launching each widget never writes the other's
    opening, never requests the other's config, and never touches the standing
    directives.
- **(c) Complements Prose Controller without shared state** (same architecture
  file): the module exports exactly its four tables, all deeply frozen, no
  function, no import, no `let`/`class`/`function`/`=>`; no Show vs. Tell source
  mentions Prose Controller; any future Prose Controller module may not import
  Show vs. Tell.

## Hardening decision

`assertShowVsTellRecommendationSeedShape` now rejects channels that are not
distinct and in the fixed channel order, with the message `distinct channels in
the fixed channel order`. **No real producer of the non-canonical order exists**:
the recommendation parser canonicalizes, `cloneWidgetRecommendation` and
`createShowVsTellOpeningDraft` copy verbatim, and the channel toggle stores the
fixed order. So the change only closes the hand-edited-session boundary; it
turns a late generation refusal into a hydration failure, like every other shape
violation. Tests: a non-canonical row in the existing rejection table, a named
fail-closed test, and a test that every canonical subset still round-trips. The
two rejection tests fail without the fix (checked).

## Architecture inventory — confirmed, nothing changed

- Show vs. Tell `boundaries` descriptor `minimumSourceFiles`: **28**; real count
  of non-test source files whose path matches `ShowVsTell`: **28**. Equal.
- Persisted lifecycle ids: `gesture-playground`, `lexical-gravity`,
  `creative-variations`, `show-vs-tell`.
- `promptBudgets`: `WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.length` pinned at
  **12,523**; `WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS` **51,500**.
- `workshopStyles` cascade entry: `./components/workshop/widgets/showVsTell/showVsTell.css`.
- Route registry `handlerCount`: 56 (unchanged).

## Verification (head `a5f3118`)

| Check | Result |
| --- | --- |
| `npm ci` | installed |
| `npm run typecheck` | core, webview, ext clean |
| `npm run lint` | 0 errors, **1,112** warnings (baseline 1,112; no delta) |
| `npm test` | **296 suites / 4,190 tests / 2 snapshots** pass (Slice 5 tip 292 / 4,160 / 2: +4 suites, +30 tests) |
| `npm run build` | compiled; `verify-bundle` OK |
| `git diff --check 9ce728f HEAD` | clean |
| `grep -rn "from 'vscode'" packages/core/src` | no source hits |
| Files touched > 500 lines | none (largest: `ShowVsTellConfigCodec.ts` 434) |

New tests by file: matrix 8, host independence 2, opening-hook independence 4,
architecture witnesses 13, persistence +3 (one table row, two named tests).

## For 6b — doc locations whose counts or trees need refreshing

- `AGENTS.md` line ~715 and `.ai/central-agent-setup.md` line ~715: test
  inventory still reads `189 suites / 1,937 tests / 1 snapshot` (measured
  2026-08-06). New figures: **296 / 4,190 / 2**.
- `AGENTS.md` and `.ai/central-agent-setup.md`: the `__tests__/architecture/`
  tree (add `showVsTellWitnesses.test.ts`) and the `application/handlers/`
  test listing if it names route test files (new:
  `WorkshopRoomHandler.showVsTellMatrix.test.ts`,
  `WorkshopRoomHandler.showVsTellIndependence.test.ts`).
- `docs/ARCHITECTURE.md`: recommendation-registry section (Show vs. Tell is the
  fourth arm; seed shape now rejects non-canonical channel order) and the
  messages tree near line 302.
- Sprint doc `05-show-vs-tell.md`: Status line (Slice 6a landed, 6b pending) and
  the Completion criteria checklist (the shared-mapping and witness items now
  have tests; names above).
- Lint figure for the sprint record: **1,112** (unchanged from Slice 5).

## Not done, by instruction

Persona pronoun metadata (open writer decision, out of scope); Prose Controller;
anything on `main`.
