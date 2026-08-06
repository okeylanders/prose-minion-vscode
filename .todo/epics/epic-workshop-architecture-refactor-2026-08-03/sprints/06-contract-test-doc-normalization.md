# Sprint 06: Contract, Test, and Documentation Normalization

**Status:** Complete — implemented and verified 2026-08-06; awaiting review/merge

**Branch:** `sprint/workshop-architecture-refactor-06-normalization` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 05

**Evidence:** [Sprint 06 architecture change runway](../../../../docs/architecture/2026-08-06-workshop-sprint-06-contract-test-doc-normalization-runway.md)

## Accepted decisions

| Decision | Accepted direction |
|---|---|
| D1 | Land the inverted non-feature-path vocabulary witness before clearing the migration ledger. |
| D2 | Add `shared/types/messages/workshop/settings.ts` as a documented ADR §7 deviation and keep the runtime setting codecs together. |
| D3 | Leave the `WorkshopHandler` → `WorkshopRoomHandler` naming question and god-files debt open for Phase 7. |

## Goal

Make shared contracts, tests, architecture docs, and active planning mirror the
implemented responsibility tree.

## Scope

- Add the inverted feature-vocabulary witness before removing either Phase-6
  exception.
- Split the Workshop contract into nine subdomain modules behind the existing
  barrel, including the accepted `settings.ts` deviation.
- Delete the retired recommendation-seed alias and normalize every Gesture
  Playground contract name.
- Move Lexical Gravity value grammar and recommendation semantics into named
  feature owners; keep only closed dispatch in generic modules.
- Move the two measured test/source mismatches to their real owners.
- Update `CLAUDE.md` (and its `AGENTS.md` alias), `docs/ARCHITECTURE.md`, ADR
  references, active epics, and debt records.
- Archive or supersede completed extraction debt with closure notes.
- Strengthen import, route-owner, composition, feature-isolation, and aggregate
  encapsulation witnesses against the final tree.

## Implementation record

- **S0:** The inverse witness was proven red against exactly
  `shared/constants/workshopWidgets.ts` and
  `utils/workshopWidgetRecommendation.ts` before either owner moved. Its final
  scan covers title/PascalCase, camelCase, kebab/snake wire ids, uppercase
  constants, and distinctive feature semantics. Every justified family seam
  is scoped to complete extracted tokens, and stale allowlist entries fail the
  witness.
- **S1:** `WorkshopGesture*` contracts now use the exact
  `WorkshopGesturePlayground*` family name; the backward-friendly generic alias
  was deleted.
- **S2:** `workshop.ts` became nine modules under `workshop/`: `session.ts`,
  `context.ts`, `participants.ts`, `widgets.ts`, `standingDirectives.ts`,
  `gesturePlayground.ts`, `lexicalGravity.ts`, `settings.ts`, and `index.ts`.
  The public `@messages` surface is unchanged.
- **S3–S4:** Lexical Gravity owns its numeric grammar and recommendation entry;
  Gesture Playground owns its recommendation entry; the generic parser is an
  exact closed registry; both Phase-6 exceptions are gone and the ledger is
  empty.
- **S5:** The side-pass integration suite now follows
  `RunWorkshopToolSidePass`; thread-artifact-frame and delimiter tests follow
  their actual source owners.
- **S6:** Agent guidance, architecture docs, ADR deviation, active sprint/epic
  state, and debt records now describe the implemented tree. Fitness witness
  #10 checks the final source/test/document agreement.

## Verification

- `npm run typecheck` — passed all three TypeScript projects.
- `npm test -- --runInBand` — passed 189 suites, 1,937 tests, and 1 snapshot.
- `npm run lint` — passed with 0 errors and 923 warnings.
- `npm run build` — production extension and webview bundles compiled; bundle
  verification found all three sentinel utilities.
- `git diff --check` — passed.

## Completion criteria

- [x] Source, test, and documentation trees use the same names and boundaries.
- [x] No active plan points to retired paths or optional seams that are now
      mandatory/completed.
- [x] Generic family mechanics dispatch to feature code only through approved
      closed registries; composition roots and explicit contract unions remain
      the reviewed feature-naming seams.
- [x] P0's migration exception list is empty.
