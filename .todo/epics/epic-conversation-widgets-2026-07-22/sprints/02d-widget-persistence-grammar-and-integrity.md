# Sprint 02D: Widget Persistence Grammar and Integrity

**Status**: Complete — implemented and verified 2026-08-07
**Priority**: High; mandatory before the next persisted widget
**Branch**: `sprint/conversation-widgets-02d-widget-persistence-grammar` -> `epic/conversation-widgets`
**Estimated Effort**: 1-2 days
**Depends on**: Sprint 02B-B, including its [Widget Codec Recovery Mode exit plan](02b-b-widget-codec-recovery-mode.md)
**Blocks**: [Sprint 03 — Prose Controller](03-prose-controller.md) and every later persisted widget
**Review sources**: [PR #110 review F-07 and F-09](../../../../docs/pr-reviews/pr-110-lexical-gravity-interpretive-grammar-dde10a4-review-v2.md)

## Goal

Make the third persisted widget copy a complete, honest family pattern rather
than inheriting two accidents from the first two widgets:

1. widget-internal referential and cross-field rules currently run inside the
   raw structural shape pass; and
2. generic array/null persistence grammar is being reimplemented inside feature
   codecs.

Sprint 02D establishes a closed widget-persistence lifecycle with feature-owned
shape, normalization, and integrity operations, while keeping shared JSON
grammar mechanical and domain-free.

## Decision Map

**Question:** Where do raw shape, compatibility repair, and semantic integrity
belong when many independently evolving widget drafts share one Workshop
checkpoint?

```text
raw checkpoint
    |
    v
widget checkpoint shape       feature codec: keys, JSON types, scalar bounds
    |
    v
defensive clone               codec boundary: never normalize caller-owned JSON
    |
    v
widget recovery/defaults      feature codec: exact known prior shapes only
    |
    v
current widget shape          feature codec: complete current representation
    |
    v
widget integrity              feature codec: references, correlations, contradictions
    |
    v
session integrity             aggregate: ids, counters, turns, config/directive links
    |
    v
hydrate through WorkshopSessionService
```

The existing whole-session mutation boundary remains unchanged:
`WorkshopSessionService` validates and prepares the complete normalized
aggregate before installing any live state.

## F-07 Decision: Every Persisted Widget Gets a Semantic Integrity Pass

Each persisted widget codec must own four distinct operations:

1. **Checkpoint shape** — accept the exact current draft and only specifically
   recognized development-era omissions or prior shapes.
2. **Hydration normalization** — deterministically convert recognized prior
   shapes into the current runtime representation and return named outcomes.
3. **Current shape** — require the complete current representation after
   normalization.
4. **Integrity** — validate meaning across fields or referenced objects.

The boundary is behavioral, not stylistic:

| Structural shape | Semantic integrity |
|---|---|
| Required/exact keys | An id refers to an item declared elsewhere |
| JSON primitive/object/array type | Two fields must be null or present together |
| Enum membership and scalar formats | Values contradict or correlate incorrectly |
| String and collection bounds | Uniqueness across semantic identities |
| Safe prior-shape recognition | Domain renderability or compiled-directive validity |

Lexical Gravity therefore keeps lens/preview relationship rules, but moves
role, axis, dynamic, config-key, and nullity correlations out of
`assertLexicalGravityDraftShape` and into a named integrity validator. Prose
Controller will put chapter contradictions and compiled-directive invariants in
its own integrity validator rather than teaching the shared session codec craft
vocabulary.

### Closed dispatch

Extend the recovery sprint's explicit widget-normalization dispatcher into the
complete persisted-widget lifecycle registry. It may know the closed set of
persisted `widgetId` values and invoke their feature codecs. It must not contain
lens, gesture, chapter, preset, or directive semantics.

The checkpoint boundary may be compatibility-aware; the post-normalization
integrity pass is strict. Unknown, corrupt, or only partially recognizable
legacy data still fails closed and protects `current.json` from overwrite.

## F-09 Decision: Complete the Shared Persistence Vocabulary

Promote the two mechanical primitives into `persistedValidation.ts`:

- `boundedArrayAt(value, path, minimum, maximum, label)` — assert array type and
  inclusive length bounds with the shared path-aware diagnostic style.
- `nullableBoundedStringAt(value, path, maximumCharacters, allowBlank)` — accept
  explicit JSON `null` or enforce the same bounded-string contract used
  elsewhere.

Refactor Lexical Gravity's private versions and Gesture Playground's repeated
array-length guards to use the shared functions without changing accepted data
or error meaning.

### Negative space

`persistedValidation.ts` may know JSON arrays, strings, `null`, lengths, paths,
and diagnostic grammar. It must never know:

- a Lexical Gravity role, axis, dynamic, lens, or Preview;
- a Gesture menu, selection, or dictionary;
- a Prose Controller chapter, lever, preset, or contradiction; or
- a widget migration policy.

This is a small JSON grammar vocabulary, not a schema DSL or widget framework.

## Scope and Deliverables

1. Add the shared bounded-array and nullable-string primitives and refactor the
   two live widget codecs onto them.
2. Extend the closed Gesture/Lexical normalization dispatcher into the full
   persisted-widget lifecycle operations contract.
3. Keep feature-specific checkpoint recognition and normalization inside each
   feature codec; remove widget-specific branching from the central normalizer
   beyond the closed dispatcher.
4. Split current Lexical Gravity draft validation into structural and semantic
   entry points without weakening its v2 relationships.
5. Route widget semantic validation from the post-normalization session
   integrity pass.
6. Add an architecture witness proving every persisted widget union arm has
   checkpoint-shape, normalize, current-shape, and integrity ownership.
7. Update Prose Controller's sprint foundation to copy this lifecycle from its
   first persisted draft.

## Verification

- Boundary tests for `boundedArrayAt` at minimum, maximum, one below, and one
  above; nullable string tests for `null`, blank policy, exact maximum, and
  overflow.
- Existing Gesture and Lexical current snapshots round-trip byte-equivalently
  after the refactor.
- Recognized prior drafts normalize before strict widget integrity.
- A Lexical preview citing an unknown role, axis, or dynamic is rejected by the
  integrity phase, not the raw JSON-shape phase.
- Corrupt or unknown widget drafts still reject the checkpoint before live
  aggregate mutation.
- Architecture test: each persisted `WorkshopWidgetConfigSnapshot` arm appears
  exactly once in the closed lifecycle registry.
- Full Jest, three TypeScript projects, quiet ESLint, production build/bundle
  sentinels, and `git diff --check`.

## Out of Scope

- Implementing Prose Controller.
- A dynamic plugin API, runtime registration, generic schema language, or
  independent widget repository.
- New public session schema versions; the accepted session codec remains the
  public compatibility clock.
- Changing the writer-visible behavior of the Sprint 02B-B recovery routine.
- Moving session persistence I/O or aggregate ownership out of
  `WorkshopSessionService` / `WorkshopSessionPersistenceCoordinator`.

## Reproduction Test

Adding Prose Controller should require:

- its named persisted draft codec and tests;
- its four lifecycle operations;
- one deliberate union arm and closed-registry entry; and
- its own contradiction/integrity rules.

It must not require edits to Gesture Playground or Lexical Gravity feature
files. Shared `persistedValidation.ts` changes only if Prose Controller proves a
new primitive is genuinely mechanical across widget families.

## Implementation Receipt — 2026-08-07

- `WorkshopWidgetPersistenceLifecycle` replaces the three-switch recovery
  dispatcher with one closed, exhaustive registry over
  `WorkshopWidgetConfigSnapshot['widgetId']`. Every persisted union arm owns
  checkpoint shape, hydration normalization, current shape, and integrity.
- Gesture Playground and Lexical Gravity use shared `boundedArrayAt` and
  `nullableBoundedStringAt` grammar. Gesture menu/selection/source-reference
  relationships and Lexical lens/preview relationships now live in named
  integrity passes rather than raw structural recognition.
- Lexical preview role, axis, dynamic, nullity, and six-value config-key
  correlations run only after checkpoint normalization. Lens identity,
  uniqueness, and directive renderability follow the same structural/semantic
  split.
- `WorkshopSessionStateV1Integrity` invokes widget integrity on normalized
  current state. Raw compatibility preflight explicitly skips that phase;
  aggregate hydration validates it before installing any live state.
- The registry's mapped `satisfies WorkshopWidgetPersistenceLifecycleRegistry`
  constraint is the compile-time completeness and feature-draft typing witness.
  Its focused architecture test
  asserts the two earned persisted arms exactly once and proves roadmap widget
  IDs do not masquerade as codecs.
- Regression coverage proves recognized prior drafts normalize first, unknown
  Lexical references fail in integrity rather than shape, and semantic
  corruption cannot partially replace the live aggregate.
- Verification: 191 Jest suites / 1,989 tests / 2 snapshots; all three
  TypeScript projects; quiet ESLint; production extension + webview build;
  bundle sentinels; and `git diff --check` pass. Webpack reports only its known
  webview size advisories.

### PR #111 review remediation — 2026-08-08

- The persisted-widget runtime guard and architecture witness now derive from
  the exhaustive lifecycle registry instead of repeating its two IDs.
- Lifecycle names now describe checkpoint shape, hydration normalization,
  current shape, and integrity consistently; Gesture recovery proves its own
  current-shape postcondition.
- Regression coverage attributes role, axis, axis-nullity, and dynamic
  violations to integrity, splits raw-shape failures from post-normalization
  failures, and proves failed hydration cannot mutate the live aggregate.
- Rolling-checkpoint protection now carries the actual restore diagnostic to
  the Workshop banner. Renderability and bounded-array diagnostics likewise
  retain truthful causes and domain vocabulary.
- F-05 and F-08 remain intentionally deferred under the review ledger's stated
  triggers. The separately reviewed rejected-model-response recovery work was
  left untouched.
- Verification: 192 Jest suites / 2,003 tests / 2 snapshots; all three
  TypeScript projects; ESLint with 0 errors (933 pre-existing warnings);
  production extension + webview build/bundle sentinels; and
  `git diff --check` pass.

## Completion Criteria

- [x] The implemented validation flow matches the decision map.
- [x] F-07 and F-09 are marked addressed in the PR #110 review ledger.
- [x] No feature semantics enter a generic persistence module.
- [x] The Prose Controller sprint depends on this completed foundation.
- [x] The reproduction test passes in code and architecture tests, not only in
  prose.
