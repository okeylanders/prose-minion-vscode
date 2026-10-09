# Show vs. Tell — Slice 1 Review-Gate Handoff

**Date:** 2026-10-09 06:27 CDT

**Branch:** `epic/conversation-widgets-sprint-05-slice-1-contracts`, cut from
`epic/conversation-widgets` at `33efaa1b` (Slice 0). PR into the epic; not merged.

**Sprint:** [Sprint 05 — Show vs. Tell](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md)

**Previous:** [Slice 0 contract freeze](20261008-1900-show-vs-tell-slice0-contract-freeze.md)

**Current gate:** Slice 1 is complete and ready for review. Do not start
Slice 2 until this PR merges; Slice 2 cuts its branch from the epic after that.

## What landed

Six commits beyond `33efaa1b`, each green on its own (typecheck + full suite):

1. `feat(workshop): add shared narrative-handling vocabulary`
2. `feat(workshop): add Show vs. Tell prompt budgets`
3. `feat(workshop): add Show vs. Tell contracts and the persisted widget arm`
4. `test(workshop): cover the Show vs. Tell codec, integrity, and persistence arm`
5. `test(workshop): pin the Show vs. Tell 600-character fit guarantee`
6. `docs(widgets): record Show vs. Tell Slice 1 handoff` (this note and the
   sprint status line)

Commit 3 is deliberately one unit. The contracts name `mustSurvive` and
`must-survive`, which the `boundaries` feature-isolation scan reads as
Creative Variations vocabulary in any module that no feature descriptor
claims. The descriptor, in turn, must match the persisted lifecycle ids. So
the contracts, descriptor, and lifecycle arm can only go green together.

By layer:

- **Shared vocabulary.** `shared/constants/narrativeHandlingVocabulary.ts`
  exports only `NARRATIVE_HANDLING_POSITIONS`,
  `NARRATIVE_HANDLING_SHOW_TELL_VALUES` + `NARRATIVE_HANDLING_SHOW_TELL_LABELS`,
  and the total `NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION`. No feature copy.
  Prose Controller imports these and must not redeclare them.
- **Contracts.** `shared/types/messages/workshop/showVsTell.ts`, exported
  through the workshop barrel: the draft, beat + provenance, POV, invariants,
  channel/length-budget/group-kind unions, variant, group, workup, kept
  variant, carry mode, the flag union, `SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION`
  (1), and `SHOW_VS_TELL_ARTIFACT_LINE_KEYS`. `widgets.ts` gains the snapshot
  and summary arms. No generation, commit, or recommendation message types.
- **Continuum.** `…/widgets/showVsTell/ShowVsTellContinuum.ts`: the five
  positions with names, subtitles, and the frozen tradeoff copy; end labels;
  the readout (`show-vs-tell-readout-v1`, 4 segments, caption, seven rows);
  the four groups with sub-labels; channels; length budgets; POV modes; and
  `SHOW_VS_TELL_DEFAULTS`. Type-level witnesses fail `tsc` if an ordered list
  omits a union member.
- **Budgets.** Every `showVsTell*` row from the sprint table, exact values.
- **Codec / integrity / derivations / workup id.** Exact, fail-closed codec
  with clone, summary, and a no-op hydration normalization
  (`ShowVsTellCheckpointNormalization = never`). No migration, no checkpoint
  normalization.
- **Lifecycle arm.** `show-vs-tell` joins the lifecycle registry, the
  normalization union, the ledger input union, and the create/revise/clone/
  summarize switches. Every switch keeps its `never` default.
- **Guards.** `boundaries` gains a Show vs. Tell feature descriptor and
  approves its tokens only at the seven closed registries that already
  carried Creative Variations. `promptBudgets` and
  `workshopWidgetPersistenceLifecycle` pin the new arm. The workshop message
  trees in `docs/ARCHITECTURE.md` and `.ai/central-agent-setup.md` list
  `showVsTell.ts`.

Untouched, as scoped: prompts, service, response codec, routes, UI, hooks,
commit, recommendation, the catalog entry (`live: false`), Creative
Variations code, and the four tests that use `show-vs-tell` as their
unavailable-widget example.

## Decisions made in Slice 1 (Ada; the writer may override)

1. **Single-line fields.** The beat, the POV focal character, and the note
   reject `\r`, `\n`, U+2028, and U+2029. The sprint calls the beat and note
   single-line fields, and the artifact is line-keyed, so a line break in the
   note could forge a keyed line. Invariants stay multi-line-tolerant (the
   sprint's artifact example wraps *must survive*); see Contract question 2.
2. **Must survive is required** at the persisted boundary. Persisted drafts
   are commit-time drafts, and a commit needs a workup, which needs it.
3. **POV.** `unspecified` requires a blank focal character, since the prompt
   names none for that mode.
4. **Canonical order.** Draft channels are a set stored in the fixed channel
   order. A variant's own channels keep their order (the fixture's
   `summary + action` order carries meaning) but must be unique. Kept
   variants are stored once each, in workup order, so the artifact's "one line
   per kept variant, in workup order" needs no sorting.
5. **Ids.** Workup `svtw-<UUIDv4>`; variant `${workupId}:variant-N`, with N
   one-based across the whole workup in group order; flag
   `${variantId}:flag-N`. Integrity requires the exact derived values.
6. **Duplicates.** Integrity rejects exact normalized duplicate prose
   (`showVsTellProseComparisonKey`: NFKC, lowercase, `[\p{L}\p{N}]+` tokens).
   This is parity with Creative Variations, whose integrity rejects duplicates
   through its overlap recomputation.
7. **Shorter-than-prose** compares trimmed UTF-16 `.length`, the artifact's
   measure.
8. **Totals 4–8** follow from four always-present groups × 1–2. A budget test
   pins that implication instead of unreachable integrity code. If the
   per-group budget ever loosens, that test fails and an explicit total check
   must be added.
9. **Channels per variant.** The minimum of 1 is a structural literal; the
   budget table names only the maximum key.
10. **Summary** (chip input): `beatPreview` (the whole beat), `keptCount`,
    `directionCount`.
11. **Flags.** The union makes `hard-conflict` against must survive
    unrepresentable in TypeScript; integrity still checks persisted JSON.
12. **Continuum extras.** The end labels and readout caption are frozen copy
    from Locked decisions, so they live with the continuum.
13. **Boundary tokens.** Show vs. Tell's semantic tokens exclude the shared
    position and lever ids. The vocabulary module stays generic, so its doc
    comment avoids naming the widget.
14. **One gate for 2b.** `assertShowVsTellWorkupShape` and
    `assertShowVsTellWorkupIntegrity(workup, invariants, path)` are exported so
    the response codec and persistence enforce one rule set.

## What Slice 2 needs to know

**The workup the response codec must settle** (then run
`assertShowVsTellWorkupShape` and `assertShowVsTellWorkupIntegrity` on it):

```text
{ workupId: 'svtw-<UUIDv4>',            // host-minted, fresh per attempt
  generationProtocolVersion: 1,
  groups: [                             // exactly these four, in this order
    { kind: 'told-cleanly',      variants: [1–2] },
    { kind: 'shown-as-evidence', variants: [1–2] },
    { kind: 'shown-from-inside', variants: [1–2] },
    { kind: 'mixed',             variants: [1–2] } ] }
variant = { id: showVsTellVariantId(workupId, N),   // N one-based across groups
            prose (≤1,200, nonblank, may span lines),
            channels (1–2 of the five ids, unique, model's order),
            gains (≤160), costs (≤160),             // plain text, nonblank
            direction (≤120, nonblank, strictly shorter than prose),
            invariantFlags: [0–4 × { id: showVsTellFlagId(variantId, M),
              invariantField, kind, note (≤160) }] }
```

- The model supplies no ids. Derive them after validation with
  `showVsTellVariantId` / `showVsTellFlagId`.
- Reuse `isShowVsTellDirectionShorterThanProse` and
  `showVsTellProseComparisonKey`; do not restate either rule.
- A flag may only target a nonblank invariant; `hard-conflict` only
  must-not-change.
- `RECOVERABLE_WIDGET_RESPONSE_CONTRACTS` in `messages/workshop/recovery.ts`
  has no Show vs. Tell arm yet. It describes the response protocol, so 2b adds
  it, plus the matching approved token in `boundaries`.
- Message types (generate, cancel, progress, result), `MessageType` entries,
  `streamingCancelMessages`, and the handler all belong to 2b.

**Artifact line keys and the fit guarantee (for Slice 4).**
`SHOW_VS_TELL_ARTIFACT_LINE_KEYS` = `beat:`, `position:`, `must survive:`,
`must not change:`, `keep:`, `direction:`, `note:`. The fit test assumes each
line is `${key} ${value}`, values trimmed, the beat wrapped in one pair of
quote characters with no escaping, and lines joined by `\n`.
`showVsTellPositionArtifactValue` builds the `position:` value. Worst case:
168 + 51 + 134 + 97 + 131 + 4 = **585 ≤ 600**. If Slice 4 escapes quotes or
adds characters, redo the arithmetic. Slice 4 should rebuild the fit test on
its real projection of a worst-case draft and keep the 585 pin.

**Webview imports.** The webview may import `ShowVsTellContinuum` and
`ShowVsTellDerivations` (and, later, the artifact projection). It must not
import `ShowVsTellConfigCodec`, `ShowVsTellConfigIntegrity`, or
`ShowVsTellWorkupId`: the id module imports `node:crypto`. This matches
Creative Variations.

**Shape changes are free until Slice 4 lands.** No writer can hold a persisted
Show vs. Tell config until commit works, so the draft can change through
Slice 4 without a normalization or migration.

## Contract questions (also in the PR)

1. **Surrounding-context source is not persisted.** The frozen persisted-field
   list omits the surrounding passage, and Slice 1 follows it. But the Slice 5
   seed carries an "optional surrounding context source", and nothing records
   which source grounded a workup. Proposal: before Slice 4 lands, add
   `surroundingContext: { sourceReferences: WorkshopWidgetSourceReference[] }`
   (Creative Variations' shape, without writer text).
2. **Line breaks in directions and invariants.** A multi-line direction or
   invariant spills an unkeyed line into the line-keyed artifact. Proposal: 2b's
   response codec rejects line breaks in `direction`, `gains`, `costs`, and flag
   notes, and the persisted codec tightens in the same change. Also decide
   whether the sprint example's two-line *must survive* is a real multi-line
   value or just doc wrapping.
3. **POV custody.** "Persona-prepared until the writer edits it" has no
   persisted slot, so a reopened prefilled draft loses the marker. Decide in
   Slice 5 whether it must survive reopen.

## Verification

At the slice tip:

- `npm run typecheck`: core, webview, ext all clean.
- `npm run lint`: 0 errors. The one added warning is the `'show-vs-tell'`
  registry key, matching its three sibling arms; the new files lint clean.
- `npm test` at the tip: **273 suites / 3,626 tests / 2 snapshots, all
  passing** (baseline 267 / 3,535 / 2). Jest's known worker-exit warning
  predates this sprint.
- Per commit: typecheck clean and the full suite passing at every one of the
  five code commits (3,540 → 3,540 → 3,548 → 3,621 → 3,626 tests).
- `npm run build`: compiled, with the three existing webpack asset-size
  recommendations.
- `git diff --check`: clean.
- `grep -rn "from 'vscode'" packages/core/src`: no source hits. The two hits
  are pre-existing `__tests__` string literals, identical on the epic base.
- Mutation pass: loosening the beat budget, flattening the ambiguity peak,
  remapping Hinge, leaking `observable-action` into a generic module, and
  disabling the shorter-than-prose rule each turned a test red.
