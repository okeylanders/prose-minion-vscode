# Sprint 02B-B Exit Plan: Widget Codec Recovery Mode

**Date**: 2026-08-07
**Status**: Implemented and verified — F5 recovery acceptance passed 2026-08-07
**Decision owner**: Okey Landers
**Prepared by**: Ada Forge
**Scope**: Development-checkpoint recovery for recognized prior widget drafts;
Gesture Playground and Lexical Gravity both implement the feature-owned seam,
with Lexical Gravity v1 as the first behavioral recovery
**Branch**: `sprint/conversation-widgets-02b-b-lexical-gravity-interpretive-grammar`
**Parent sprint**: [Sprint 02B-B — Lexical Gravity Interpretive Grammar](02b-b-lexical-gravity-interpretive-grammar.md)
**Follow-up foundation**: [Sprint 02D — Widget Persistence Grammar and Integrity](02d-widget-persistence-grammar-and-integrity.md)
**Implementation gate**: Closed; session-embedded recovery is verified and documentation still does not authorize project-resource rewrites

## 0. Change Card — 30 seconds

### Change thesis

> Because a valid development checkpoint containing a Lexical Gravity v1
> configuration now rejects the entire Workshop room, move recognized prior-
> draft recovery into each widget codec while preserving exact writer-authored
> state and strict rejection of unknown corruption, so checkpoint evolution
> salvages the room instead of treating one old widget as fatal.

### Architecture moves

| Move | Before | After | Why now |
|---|---|---|---|
| Feature recovery | Gesture owns two defaults; Lexical rejects v1 | Each codec recognizes and recovers only its own exact prior shapes | A real rolling and named checkpoint reached F-03's predicted failure |
| Gesture parity | The session normalizer interprets Gesture-specific booleans and names its outcomes | Gesture returns the same feature-owned recovery result contract as Lexical Gravity | The seam is not copyable while its first codec still leaks result semantics outward |
| Lexical semantics | v1 checkpoint is rejected or would be falsely upgraded to interpretive grammar | `lexical` becomes a first-class application gear; v1 recovery uses that honest gear and preserves the old standing frame | Surface-only change is useful in its own right, and the original chat used it without Lens Logic |
| Lens evidence | Recompose tends to explain the interpretation because the validated semantic map is easy to narrate | LG gains an orthogonal `tell | blend | show` evidence mode governing how its own influence becomes legible | LG and Prose Controller must be able to apply independent, even competing, prose pressures |
| Recovery evidence | Named normalization tokens reach logs only | Machine codes remain logged/tested; material feature recovery also emits one-shot writer notices | A successful but behavior-relevant repair should not be invisible |
| Presentation | One toast slot replaces concurrent messages | Recovery notices use a bounded, deduplicated queue while ordinary toasts keep current behavior | Several future widgets may recover in one room |

### Highest risks

| Boundary | Failure mode | Risk | Required witness |
|---|---|---:|---|
| Prior-shape recognition | Partially corrupt JSON is mistaken for a known v1 draft | High | Exact legacy fixture plus near-miss rejection tests |
| Lexical standing frame | Recovery silently changes the instructions used in the original chat | High | Old renderer equivalence test against the v1 implementation |
| Evidence-mode ownership | LG's Show/Tell instruction becomes a hidden fourth application gear or silently overrides Prose Controller | High | Config-key, directive, prompt, coexistence, and terminology tests |
| Current/named persistence | Only `current.json` advances, leaving its associated named checkpoint unreadable | High | Integration test proves both ordered writes converge after hydration |
| Notice delivery | Repeated session-state posts spam the same toast, or several notices overwrite each other | Standard | Consume-once and bounded-queue presentation tests |

### Locked decisions

1. Recovery applies to **session-embedded widget snapshots**, not writer-owned
   `prose-minion/lenses/*.json` resources. Project-resource v1 replacement
   remains explicit, model-authored, validated, and writer-confirmed.
2. A codec may recover only an exact prior shape it can name and test. Unknown
   fields, malformed values, and unrecognized versions still fail closed.
3. `lexical` is a first-class application gear, not a hidden compatibility
   flag. It applies only the word field, reach, weight, substitutions, cliché
   contrasts, and metaphor permission. Recovery selects that gear without
   attaching today's Music/Photography/etc. interpretive grammar or claiming
   roles, axes, dynamics, or entailments the writer never used.
4. `evidenceMode: 'tell' | 'blend' | 'show'` is an orthogonal LG control. It
   determines how **LG's own** lexical or interpretive influence is evidenced:
   direct explanation/compression, a mixed choice, or embodied evidence through
   action, image, behavior, spatial relation, sequence, silence, and consequence.
   It is not a fourth application gear and does not own Prose Controller's
   independent narrative-handling instruction. Prior checkpoints default to
   `blend` because that preserves the previously unconstrained behavior.
5. Gesture Playground participates in the same codec-owned recovery-result
   contract. Its existing dictionary-sharing and source-reference defaults keep
   their current behavior and remain silent unless a future Gesture repair is
   materially writer-visible.
6. Writer notices describe successful in-memory restoration, not guaranteed
   disk persistence. Ordered autosave remains the authority for committing the
   normalized checkpoint.
7. This is development-checkpoint normalization under
   [ADR 2026-07-30](../../../../docs/adr/2026-07-30-workshop-session-codec-evolution.md),
   not an independent widget storage clock or a released-schema migration.

## 1. Architecture Delta — 2 minutes

### Current path

```text
current.json
  -> WorkshopSessionStore.parse
  -> WorkshopSessionStateV1Shape
       -> assertLexicalGravityDraftShape(current v2 only)  X
  -> recovery banner + protected checkpoint
```

### Target path

Legend: `[+]` add · `[~]` modify · `[=]` unchanged boundary

```text
current.json
  -> [=] WorkshopSessionStore: bytes, JSON, depth, size
  -> [~] WorkshopSessionStateV1Shape: admit exact known Lexical v1 draft
  -> [~] WorkshopSessionCheckpointNormalization: delegate to feature codec
       -> [~] GesturePlaygroundConfigCodec
            - apply its existing exact defaults
            - return feature-owned normalization codes
       -> [~] LexicalGravityConfigCodec
            - recognize exact v1
            - produce lexical-only current draft with evidenceMode=blend
            - return normalization code + writer notice
  -> [=] WorkshopSessionService: strict current validation + prepare/install
  -> [~] WorkshopSessionPersistenceCoordinator
       - log normalization codes
       - retain notices until the webview consumes them once
       - ordered autosave current + associated named checkpoint
  -> [+] WORKSHOP_SESSION_RECOVERY_NOTICE
  -> [~] Workshop presentation: bounded sequential recovery toasts
```

### Ownership ledger

| Owner | Current responsibility | Recovery responsibility | Must not own |
|---|---|---|---|
| `GesturePlaygroundConfigCodec` | Gesture shape, clone, summary, two hydration defaults | Return its own recovery codes/notices through the common result contract | Session I/O, Lexical semantics, writer-notice delivery |
| `LexicalGravityConfigCodec` | Lexical persisted shape, clone, summary | Exact v1 recognition, v1-to-current normalization, feature notice copy | Session I/O, toast timing, other widgets |
| `LexicalGravityDirective` | Current standing-frame rendering | Exact lexical-only renderer for recovered configs | Checkpoint reads or migration dispatch |
| `WorkshopSessionCheckpointNormalization` | Named development repairs | Delegate by `widgetId`, collect feature outcomes | Lens/chapter/gesture semantics |
| `WorkshopSessionService` | Whole-session validation and atomic prepare/install | Carry normalization outcomes from successful hydration | Raw file I/O or presentation |
| Persistence coordinator/handler | Restore/open/promote/autosave and IPC | Hold and consume one-shot recovery notices after successful hydration | Invent feature migration messages |
| Webview toast owner | Transient notification presentation | Queue/dedupe recovery notices | Decide migration validity |

## 2. Lexical Gravity v1 Recovery Contract

### Recognized input

The codec recognizes the exact previously implemented v1 draft:

- `lensSlug`, `weight`, `reach`, `metaphorPull`, and a validated v1
  `resolvedLens` word field;
- optional old Preview with `configKey`, `text`, and optional `sourceText`;
- no `applicationMode` and no interpretive `logic`.

Recognition uses the old codec's actual key, bound, bucket, and relationship
rules. `version: 1` alone is never sufficient.

### Current recovered representation

The current Lexical draft gains a first-class third gear:

- `applicationMode: 'lexical'` requests superficial lexical-field influence
  without semantic positioning; it is valid for new/current v2 lenses as well
  as recovered v1 snapshots;
- the exact v1 resolved lens remains embedded so no writer-authored vocabulary,
  substitutions, gradient, cliché contrasts, metaphor, or sample is replaced;
- Lens Logic is explicitly unavailable for the lexical arm rather than padded
  with a fake valid grammar;
- `evidenceMode: 'blend'` records the old renderer's unconstrained realization
  behavior without claiming the prior writer selected Show or Tell;
- a recoverable cached Preview keeps its source and rewritten text, adds empty
  semantic positions, and uses null dynamic/entailment values;
- an old Preview without enough source identity is discarded as derived cache,
  while the config, directive, transcript, and conversation archive survive.

The current serializer writes the recovered arm, including the `lexical`
discriminant and evidence mode, so subsequent reads do not repeat the raw-v1
normalization.

### Standing behavior

`buildLexicalGravityDirectiveFrame` dispatches by the application gear:

- `lexical` renders the prior v1-shaped frame: lens vocabulary, weight, reach,
  metaphor pull, degree buckets, gradient, substitutions, and cliché contrasts.
  When a v2 lens is selected, its Lens Logic remains inspectable in the UI but
  does not ride the standing directive in this gear;
- `interpret` and `recompose` retain the strict v2 semantic-first frame.

Every gear then renders the independent evidence instruction:

- `tell` permits direct naming, explanation, and compression when that is the
  clearest way to make the lens reading legible;
- `blend` lets the prose choose a proportionate mixture of direct statement and
  embodied evidence; and
- `show` enacts the lens through observable action, image, behavior, spatial
  relation, sequence, silence, and consequence without adding interpretive
  commentary merely to prove the mapping occurred.

The evidence mode applies only to Lexical Gravity's contribution. A future
Prose Controller directive may pull narrative handling in another direction;
the standing-frame aggregator preserves both instructions and their existing
coexistence/precedence contract rather than collapsing either config.

The recovery test compares the lexical-only frame to the implementation at the
Sprint 02B-B base, with dynamic directive id/revision normalized. This is the
proof that restoration preserves what the chat was actually using.

### Writer-facing behavior

Recovered configs remain visible and reopenable. Lens Logic renders an honest
unavailable state only when the embedded v1 lens genuinely has none. `lexical`
is also offered for current v2 lenses as an intentional surface-only choice.
Moving a recovered v1 config to `interpret` or `recompose` requires an explicit
current v2 lens selection/rebuild; hydration never performs that semantic
upgrade.

Current and recovered configs expose Tell / Blend / Show as a separate control.
Changing it invalidates Preview and participates in `configKey`; it does not
change the selected application gear.

The codec supplies this display-safe notice:

> Restored an older Lexical Gravity configuration in lexical-only mode. Its
> vocabulary, weight, reach, metaphor behavior, and saved preview were
> preserved. Lens Logic becomes available when you update the lens.

## 3. Recovery Results and Toast Delivery

Keep machine and writer concerns separate:

```typescript
interface WorkshopWidgetRecoveryNotice {
  code: string;
  widgetId: WorkshopWidgetId;
  configId: string;
  message: string;
}
```

- **Normalization codes** remain stable internal evidence for logs and tests.
- **Recovery notices** exist only for material writer-visible changes. Routine
  invisible defaults need not toast.
- The coordinator stores notices only after the complete aggregate hydrates
  successfully. Failed hydration emits none.
- Startup session request and named-session Open drain notices through a
  dedicated `WORKSHOP_SESSION_RECOVERY_NOTICE` message after posting current
  session state.
- Draining is consume-once. Repeated `WORKSHOP_REQUEST_SESSION` and ordinary
  mutation snapshots cannot replay the notice.
- Presentation deduplicates identical codes and enqueues at most a small bounded
  number. Existing non-recovery toasts may continue replacing one another; the
  recovery queue must not silently discard the first of several widget notices.

## 4. Contracts and Invariants

| Invariant | Owner | Failure response | Witness |
|---|---|---|---|
| Only exact known prior drafts recover | Feature codec | Throw; protect checkpoint | Valid v1 plus unknown-field/type/version near misses |
| Recovery never invents interpretive meaning | Lexical codec/directive | Lexical-only arm; no Lens Logic | Frame equivalence and unavailable-state tests |
| Transcript and conversation archive survive | Session service/coordinator | Transaction rollback on failure | Full restore integration fixture |
| Config/directive/turn linkage remains coherent | Session integrity | Reject before install | Realistic `wc-N` / `pd-N` / turn linkage fixture |
| Current and associated named checkpoint converge | Persistence coordinator/store | Existing error status and atomic-file guarantees | Ordered dual-write integration test |
| Project lens resource bytes are untouched | Lens repository boundary | No repository call during hydration | Negative call/byte-identity test |
| Notice is visible once | Handler + webview queue | Log remains secondary evidence | Startup, Open, repeated-request, multi-notice tests |

## 5. Alternatives

| Alternative | Benefit | Cost | Verdict |
|---|---|---|---|
| Hand-edit or delete the v1 widget | Tiny patch | Loses a valid room or requires private JSON surgery | Rejected |
| Replace v1 with today's built-in v2 lens | Produces a current strict lens | Silently changes what the original chat was instructed to do | Rejected |
| Fill v2 grammar with anonymous empty strings/arrays | Avoids a type union | Makes malformed v2 indistinguishable from intentional absence and weakens generated-lens validation | Rejected in favor of an explicit lexical gear and unavailable-logic state |
| Feature-owned exact recovery plus first-class lexical gear | Preserves truth, adds useful surface-only control, and scales by widget | Adds a third gear and bounded legacy lens arm | Accepted |
| Make Show/Tell a fourth LG gear | One control instead of two | Conflates semantic/compositional permission with evidence style and cannot express Recompose+Show | Rejected |
| Leave Show/Tell entirely to Prose Controller | Avoids another LG field | Recompose keeps tending toward explanatory interpretation; LG cannot state how its own IR should land | Rejected |
| Independent LG evidence mode | Expresses Lexical+Show, Interpret+Tell, Recompose+Show, and intentional tension with Prose Controller | Adds one required persisted control and checkpoint default | Accepted |
| Generic migration/schema DSL | Centralizes mechanics | Premature framework that would absorb feature meaning | Rejected; reconsider only after several distinct migrations prove common machinery |

## 6. Implementation Slices

| Slice | Purpose | Primary owners | Verification | Rollback seam |
|---|---|---|---|---|
| 0 | Characterize the failure without private prose | Minimal synthetic v1 session fixture; store/coordinator/session tests | Current failure reproduced; fixture contains no manuscript content | Test-only |
| 1 | Establish feature-owned recovery results | Gesture and Lexical codecs, widget recovery dispatcher, session normalizer | Existing Gesture defaults unchanged; both codecs return named outcomes; unknown widget fails closed | Dispatcher can revert without changing stored bytes |
| 2 | Admit and normalize exact Lexical v1 | Lexical types/codec, session shape, checkpoint normalizer | Current/v1/near-miss codec tests; idempotent second normalization | Remove compatibility arm; original file remains protected until this slice is complete |
| 3 | Preserve original behavior and add explicit controls | Lexical directive, model contract, summary, modal logic state | Prior-frame equivalence under Blend; application × evidence contract tests; reopen/UI tests | Feature-local renderer and control branches |
| 4 | Deliver recovery evidence once | Hydration result, coordinator, session message contract/handler, toast queue | Startup/Open/consume-once/dedupe tests | Message and presentation slice removable without changing recovery correctness |
| 5 | Prove persistence and align decisions | Current+named integration, PR review, ADR §6, Sprint 02B-B | Dual-write convergence; full verification | Atomic file writes and Git history |

## 7. Fitness Witnesses

1. A minimal session carrying the old Lexical v1 config and standing directive
   hydrates with its transcript, config id, directive id, and conversation
   archive intact.
2. The recovered directive is semantically equivalent to the old v1 renderer.
3. Existing Gesture checkpoints still receive the same two defaults, now from
   the Gesture codec's own result.
4. Lexical/Interpret/Recompose and Tell/Blend/Show form independent axes;
   Recompose+Show embodies the interpretation and Lexical+Tell remains
   surface-only without semantic artifacts.
5. Changing evidence mode invalidates Preview through `configKey`.
6. The normalized snapshot round-trips without reporting recovery again.
7. An extra key, invalid bucket, malformed preview, unrecognized lens version,
   or incoherent standing linkage still rejects the entire checkpoint.
8. Hydration never reads, writes, rebuilds, or deletes a project lens resource.
9. One material recovery yields one visible toast; two widget recovery messages
   are both observable in order; repeated session-state requests yield none.
10. Successful resume autosave writes both `current.json` and its associated
   named checkpoint in the current accepted form.
11. Full Jest, three TypeScript projects, quiet ESLint, production build/bundle
   sentinels, and `git diff --check` pass.

Do not copy the discovered 527 KB writer checkpoint into the repository. Build
the regression fixture from the historical v1 contract with synthetic prose and
only the minimum coherent session/config/directive linkage.

## 8. Ranked Findings and Gate

| ID | Severity | Finding | Smallest fix | Blocks |
|---|---:|---|---|---|
| R-01 | High | One recognized prior widget currently bricks an otherwise valid room | Exact feature-owned recovery before raw shape rejection | Sprint 02B-B exit |
| R-02 | High | Naive v2 defaulting would change the standing instruction used by the saved chat | Explicit lexical-only arm plus prior-frame renderer | Sprint 02B-B exit |
| R-03 | Standard | Existing normalization signals terminate in logs, so the writer cannot tell recovery occurred | Consume-once recovery notice message and queue | Sprint 02B-B exit |
| R-04 | Standard | Current/named twins can drift if recovery persistence is tested through only one door | Ordered dual-write integration witness | Sprint 02B-B exit |
| R-05 | Standard | Show/Tell is currently an unstated model choice, and Recompose tends to prove interpretation through explanation | Independent required `evidenceMode`, defaulted to Blend for prior checkpoints | Sprint 02B-B exit |

**Implementation gate:** `CLOSED` — the decision owner verified F5 recovery on
2026-08-07. Salvage is the shipped policy; the exact UI control for deliberately
upgrading a lexical-only config may follow, but automatic hydration must not
perform that semantic upgrade.

## 9. Self-Review and Re-plan Verdict

**Verdict:** `REFINED`

**Initial plan:** codec-local defaults plus a feature-supplied toast; Lexical
gear as the only new authored control.

**Final plan:** both live codecs return feature-owned checkpoint-recovery
results; Lexical adds exact v1 recovery, a first-class Lexical gear, and an
independent Tell/Blend/Show evidence mode; machine/writer outcomes remain
separate and notices are consume-once queued.

**What changed:** anonymous empty Lens Logic values were replaced by an explicit
lexical gear plus an unavailable-logic legacy state. Gesture was pulled through
the same result boundary so the central normalizer no longer names its feature
semantics. Show/Tell moved from an acceptance-only concern into a required,
orthogonal LG evidence mode because application gear and evidence style must be
independently composable. Empty collections remain appropriate for genuinely
empty derived Preview semantics, but must not masquerade as a validated
interpretive grammar.

**Why:** the old renderer proves v1 behavior is complete without Lens Logic,
while the current v2 renderer dereferences required roles, axes, dynamics, and
guardrails. The current Recompose prompt also makes explanatory interpretation
the easiest proof of compliance. Independent application/evidence axes preserve
strict v2 validation, the truth of the restored chat, and deliberate tension
between LG and future Prose Controller directives.

**Reproduction test:** a future Prose Controller prior-draft recovery adds its
own exact recognizer, normalizer, and notice; it does not edit Lexical Gravity
or Gesture feature files. Sprint 02D supplies the closed lifecycle dispatcher
before that third persisted widget begins.

## 10. ADR Seed

**Context:** A pre-release widget draft evolved incompatibly while valid local
Workshop checkpoints already contained the earlier shape.

**Decision:** Development checkpoints recover exact recognized prior widget
shapes through feature-owned codecs. Recovery preserves prior behavior or uses
conservative neutral defaults, returns named internal outcomes, and may return
display-safe writer notices. Lexical Gravity independently records application
gear and evidence mode; prior configs default evidence mode to Blend. Unknown
shapes remain fatal. Released Workshop session contract changes still use the
top-level ordered schema migration policy.

**Consequences:** Local rooms survive widget evolution; each feature carries its
own compatibility knowledge; shared hydration coordinates outcomes without
absorbing semantics; current serialization converges after successful restore.

**Required amendment:** Update ADR 2026-08-01 §6 during implementation to
distinguish session-embedded v1 recovery from writer-authorized project-resource
replacement.

## 11. Reader Terms Appendix

| Term | Local meaning | Status |
|---|---|---|
| **Recovery mode** | Hydration-time handling of an exact recognized prior widget draft; not a writer toggle or permissive parser | Proposed; this plan |
| **Checkpoint normalization** | Deterministic pre-release repair that produces the current in-memory session shape before strict validation/install | Current; ADR 2026-07-30 |
| **Lexical gear** | Surface-only Lexical Gravity: weighted vocabulary, reach, substitutions, cliché contrasts, and metaphor pull without applying interpretive roles/axes/dynamics | Proposed first-class current mode; recovered v1 selects it honestly |
| **Evidence mode** | LG-local Tell/Blend/Show instruction for how the lens's own influence becomes legible in prose; independent from application gear and Prose Controller state | Proposed required current control; prior configs default to Blend |
| **Lens Logic** | Lexical Gravity v2's interpretive premise, attention, axes, roles, dynamics, and guardrails | Current for v2; deliberately unavailable for recovered v1 |
| **Writer notice** | Display-safe, consume-once recovery explanation supplied by the feature codec and rendered by Workshop presentation | Proposed; distinct from internal normalization logs |
| **Project resource** | A reusable `prose-minion/lenses/*.json` file selected for future configs; not the immutable resolved-lens snapshot inside a saved session | Current; automatic recovery deliberately does not rewrite it |
