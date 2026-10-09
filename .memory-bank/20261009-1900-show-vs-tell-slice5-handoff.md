# Show vs. Tell — Slice 5 Review-Gate Handoff (recommendation and prefill)

**Date:** 2026-10-09 19:00 UTC

**Branch:** `epic/conversation-widgets-sprint-05-slice-5-recommend`, cut from
`epic/conversation-widgets` at `4f20c09` (the Slice 4 merge). One PR into the
epic. Not merged.

**Sprint:** [Sprint 05 — Show vs. Tell](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md)

**Previous:** [Slice 4 handoff](20261009-1700-show-vs-tell-slice4-handoff.md)

**Current gate:** Slice 5 is ready for review. Do not start Slice 6 until the
PR merges. A Host or Guest persona can now recommend the widget; the chip opens
a prefilled sheet that never generates until the writer presses Generate.

## What landed

Two commits, each green on its own.

1. **Contract, parser, and host wiring.**
   - `WorkshopWidgetRecommendation` gains a `show-vs-tell` arm. Unlike the older
     arms its `seed` is required: a recommendation without a beat and a declared
     "same" opens nothing. `WorkshopShowVsTellRecommendationSeed` holds
     `beatText`, optional `subject` (chip only), `sourceReferences` (0–1),
     `mustSurvive`, optional `mustNotChange`, and optional `pov`, `position`,
     `channels`, `lengthBudget`. A workup, kept variants, carry, note, and
     provenance are unrepresentable: the persisted shape is an exact-key object.
   - `ShowVsTellRecommendation.ts`: the instruction (frozen Blocks A and B
     verbatim, then the field list and an example frame), the 24 ordered
     markers, the strict parser, and the registry entry (`catalogOrder` and
     `instructionOrder` 3).
   - Host arms: `WorkshopWidgetRecommendationOperations`,
     `cloneWidgetRecommendation` (deep copy of references, POV, channels),
     `unavailableWidgetSourceReference`, `WorkshopSessionStateV1Shape` (through
     `assertShowVsTellRecommendationSeedShape` in the Show vs. Tell codec), and
     the writer-facing rejection notice tables in `WorkshopRunCompletion`.
   - `RESERVED_PERSONA_FRAME` gains the seven new tags in the same commit.
   - **No migration.** The arm is new and unshipped; per the codec-evolution ADR
     there is no released shape to migrate from.
2. **Opening, banner, chip, door.**
   - `WorkshopShowVsTellOpening` gains `{ kind: 'seed'; seed; personaId;
     personaLabel }`. `openWidgetRecommendation` has the `show-vs-tell` case and
     its `never` default still holds. It refuses a prefill while a config request
     is pending, while a Show vs. Tell sheet is open, or with no persona id (the
     Creative Variations rules).
   - `createShowVsTellOpeningDraft` (in `showVsTellAuthoringRules`) is the one
     opening → draft mapping, called from the controller's existing open effect.
   - Seed banner arm in the modal; chip meta `prefilled · {subject}` or
     `prefilled`.
   - `show-vs-tell` builder in `workshopWidgetAskPrefill`. No live widget lacks a
     door now, so the "deferred" assertion became "leaves none".
3. **Guards.** `boundaries` approved-surface tokens extended at exactly the
   generic files touched; `minimumSourceFiles` 27 → 28; no new generic surface
   was approved, so the Prose Controller seam inventory is unchanged. The
   presentation boundaries test now keeps the recommendation parser out of the
   webview, pins the seed as input-only, and pins POV as free of custody.
   `promptBudgets` pins the assembled instruction at 12,523 (was 7,823).

## Tag names chosen

`told-beat` (not `beat`), `chip-subject` (not `subject`), `source-references`
and `must-survive` and `must-not-change` (already reserved), `pov-mode`,
`pov-focal-character`, `handling-position` (not `position`),
`emphasis-channels` (not `channels`), `length-allowance` (not `length-budget`).
Each generic word was avoided so the neutralizer cannot catch ordinary prose
that uses it; a test pins that prose stays untouched.

## Decisions (Ada; the writer may override)

### The three orchestrator readings — all agreed

1. **Frozen copy.** Used verbatim at the top of the instruction. A test holds a
   second copy of each block in the test file and compares, so an accidental edit
   fails. **No conflict found with the mechanics**: Block A's "Prepare inputs
   only" list matches the seed's contents, and Block B's "five distances" matches
   the five positions. One observation, not a conflict: Block B names the slogan
   `"show, don't tell"` inside the prompt, which is the instruction not to use it.
2. **Pronoun-free banner.** `Recommended and prefilled by {persona}. {persona}
   spotted a told beat worth testing — proposing and prefilling is as far as a
   persona goes; you decide what commits.` A test asserts the rendered banner
   contains none of `she/he/her/his/they/them/their`. No pronoun field was added.
3. **Chip subject.** Chip-only, ≤ 60 characters, single line, falls back to
   `prefilled`. A test proves it never enters the draft or the generate payload.

### Q3

Agreed and followed. POV is plain writer input after prefill. `WorkshopShowVsTellPov`
is unchanged (`mode`, `focalCharacter`), the draft gained no field, and the
beat keeps `persona-prefill { personaId, editedByWriter }` exactly as before.

### Other decisions

- **Seed required on the arm.** The older arms keep `seed?`. A Show vs. Tell
  recommendation with no seed has nothing to open, so the arm requires it and the
  session shape validator rejects a missing one.
- **POV tags.** Two tags, `pov-mode` and `pov-focal-character`, rather than one
  `pov` field, so the strict parser can name which half is wrong. A blank mode
  and `unspecified` both mean "no POV suggestion" and omit `pov` from the seed. A
  focal character under either is rejected (`invalid_focal_character`).
- **Channels.** One id per line, canonicalized to the fixed channel order,
  repeated or unknown ids reject the whole frame. Empty means no suggestion.
- **Example frame.** It parses with the real parser: `none` sources, `unspecified`
  POV, and empty optional fields. That teaches "leave it empty" by example.
- **Frame ceiling.** Beat + subject + one source reference + both invariants +
  focal character + the frozen 1,200 allowance. A test builds the fullest legal
  frame and checks it fits, and checks one character over the ceiling rejects.
- **Prompt growth.** The assembled contract grew 4,700 characters (the two frozen
  blocks are about 1,800 of that). The pin was updated, reviewed explicitly.
- **Lint.** +7 warnings (1,112 vs 1,105 at the Slice 4 tip): five snake_case
  rejection-reason keys in `INVALID_WIDGET_FIELD_COPY`, and one hyphenated
  `show-vs-tell` key in each of the closed recommendation registry and the ask
  prefill registry. Each is the same naming-convention warning its siblings carry.

## Verification

- `npm run typecheck`: core, webview, ext clean.
- `npm run lint`: 0 errors, 1,112 warnings (baseline 1,105; see above).
- `npm test`: **292 suites / 4,160 tests / 2 snapshots, all passing** (Slice 4 tip:
  288 / 4,062 / 2).
- `npm run build`: compiled; `verify-bundle` OK.
- `git diff --check`: clean.
- `grep -rn "from 'vscode'" packages/core/src`: no source hits.
- Commit 1 was verified in isolation (stash of the rest) before committing.

## What Slice 6 needs

- **Production-policy route matrix.** Add `show-vs-tell` recommendation entries
  to the route matrix beside Creative Variations: Host turn and invited-Guest turn
  both carry the frame under the production catalog policy (the parser and
  `WorkshopRunCompletion` tests prove it at the unit level; the route-level matrix
  is Slice 6). Direct tool turns stay persona-only (tested).
- **Witnesses to add.** (a) Show vs. Tell stays independent of Lexical Gravity's
  application gear and evidence mode: a persona turn carrying both a Lexical
  Gravity and a Show vs. Tell recommendation in one session must open each without
  changing the other's state. (b) The shared five-position → Controller mapping
  constant is imported by both surfaces. (c) Prose Controller's narrative-handling
  chapter is complemented without shared state.
- **Docs to refresh.** `AGENTS.md` test inventory (292 / 4,160 / 2) and the
  Workshop domain list if it names the recommendation registry members;
  `docs/ARCHITECTURE.md` recommendation-registry section; the sprint doc's
  Completion criteria checklist.
- **Independence check from Lexical Gravity.** Nothing in this slice touches the
  standing-directive family, the gear, or the evidence mode. The seed has no field
  that could address them, and the boundaries test lists no new generic surface.
- **Open follow-up, not blocking.** A persona pronoun field in the catalog would
  let the banner use the design's "she proposes and prefills". It is a separate
  writer decision.
