# ADR 2026-11-05: Personas Propose Edits to Project Files

**Status:** Proposed (2026-11-05), revised the same day after the PR #226
review ([how each finding is settled](#pr-226-review-how-each-finding-is-settled)).
- **Scope (Okey's choice):** project notes **and** chapter drafts
  ("option B"). Autonomous editing is out of scope; D12 keeps a seam for it.
- **Q1–Q5:** Okey handed the implementation to the coordinator, who took the
  recommended defaults ([below](#defaults-taken-2026-11-05)). Okey may
  override any of them before the live pass.
**Date:** 2026-11-05
**Epic:** [Workshop Persona File Edits](../../.todo/epics/epic-workshop-persona-file-edits-2026-11-05/README.md)
**Extends:**
- [ADR 2026-10-21: Draft Edit](2026-10-21-draft-edit-engine-and-document-write-back.md):
  its applier becomes the document write path for persona edits too, with
  a structure mode and a check on every attempt (D7).
- [ADR 2026-11-04: Workshop Project Memory](2026-11-04-workshop-project-memory.md),
  addendum of 2026-11-05 (Slice 6c): its edit grammar and exactly-once
  anchoring move to a shared planner. Memory's own persistence is unchanged.

**Supersedes in part:** [Workshop Apply to Draft](../../.todo/features/feature-workshop-apply-to-draft/README.md)
(a feature note, never an ADR). Its target rules become D5's prose policy.
Its Apply Variation becomes a later use of the gateway (D7).

## Context

What already exists:
- **Personas read project files.** `resource.catalog`, `resource.search` and
  `resource.read` address a file by `<group>` and `<path>`: a
  `ConfiguredResourceRef` in one of `CONTEXT_PATH_GROUPS` (`characters`,
  `locations`, `themes`, `things`, `chapters`, `manuscript`, `projectBrief`,
  `general`).
  - That address is a display key, not an identity.
  - `ContextResourceResolver` walks the groups in order and every workspace
    folder within each. It keeps the first match of a relative path,
    case-folded, so a file has one group and one root even when it matches
    several.
- **Personas propose memory edits.** Since Project Memory Slice 6c, a
  persona's trailer can rewrite a field, replace quoted text, or append or
  prepend.
  - The host anchors each quote exactly once (`WorkshopMemoryEditAnchor`).
  - An edit token covers every field the edit overwrites, so a note changed
    meanwhile refuses the edit.
  - An edit always waits for the writer.
- **Draft Edit writes the writer's documents.** `DraftEditApplier` →
  `DocumentEditor.applyEdits`:
  - one change, as one undo step;
  - checked against the version it was placed in;
  - never saved;
  - read back from a watch, never trusted.

  It works only on an open document. Its Markdown check
  (`editsChangingStructure`) keeps paragraph boundaries too, which is right
  for Proofread.
- **The excerpt records its source.** `WorkshopExcerptSource.file` and
  `editor-selection` keep a host-authorized `sourceUri` and a display
  `relativePath`, and the excerpt keeps a SHA-256 `sourceFingerprint`.
- **Apply to Draft** (parked) designed edits to the excerpt's document. It
  was never built.

What Okey asked for:
1. Personas can change a character file or a chapter draft.
2. One gateway for editing, rather than one per feature (his question during
   Slice 6c).
3. Room to add autonomous editing later without rework.

## Decision

### D1. A persona proposes; the writer accepts

Nothing in a file changes until the writer presses Apply. This is the
memory's "Ask first", and in v1 it is the only approval (D12).

### D2. The proposal: a trailer addressed like `resource.read`, bounded

- **One frame per edited file.** A reply may end with up to
  `proposalsPerReply` frames, each `<prose-minion-file-edit>`.
- **The target.**
  - `<group>` and `<path>`, exactly as `resource.read` takes them;
  - or `<excerpt/>`, for the document the room's excerpt came from.

  Either way the host stages it to an identity (D4).
- **The operations** are the memory grammar's, minus its field names:
  - `<rewrite>` replaces the file's content (everything after its front
    matter);
  - `<find>` followed at once by `<replace-with>`, at most `editReplaces`
    pairs;
  - `<append>` or `<prepend>`, each at most once.
- **`<why>`**: one line saying what the edit is for, shown on the card.
- **Quotes, never offsets or line numbers** (Draft Edit's rule). A file
  rewritten whole takes no other operation.
- **Bounds.** All live in `PROMPT_BUDGETS.workshopFileEdits`, and a sync
  test pins the prompt's numbers to them:

  | Bound | Value |
  |---|---|
  | `proposalsPerReply` | 5 |
  | `frameCharacters` | 24,000 (a longer frame is dropped whole, unread past its bound) |
  | `whyCharacters` | 200 |
  | `editReplaces` | 8 |
  | `findCharacters` | 2,000 |
  | `replaceWithCharacters` | 4,000 |
  | `insertWords` / `insertCharacters` | 400 / 4,000, for each append and prepend |
  | `rewriteCharacters` | 16,000 |
  | `fileBytes` | 2 MiB (any target) |
  | `rewriteFileBytes` | 32 KiB (the content a rewrite replaces) |

  Frames past the cap, malformed frames and frames while the setting is off
  are dropped and counted, and never reach the reply's text.

### D3. One pure edit planner, shared vocabulary

`utils/textEdits/` holds the operations and the anchoring (built in Slice 1):
- **Input:** a text, an ordered list of operations, and its rules: a leading
  region to skip (front matter) and whether `rewrite` is allowed.
- **Output:** non-overlapping edits, each naming its operations and keeping
  each operation's own range. Or a fault per operation: `not-found`,
  `ambiguous`, `overlapping`, `conflicting-operations`, `not-allowed`.
- **Anchoring:** exactly once (`findExactlyOnce`).

What is shared, and what isn't:
- **The vocabulary is shared.** Memory edits plan through it with no
  behavior change.
- **Memory's persistence is not.** It stays `ProjectMemoryWrites` and its
  claimed storage, never a dirty buffer.
- **The document write path is shared only by Draft Edit and persona file
  edits.** Both go through `DraftEditApplier` (PR #226 N-03).
- Draft Edit's own passes keep `anchorEdits.ts`, which anchors a model's
  quote by its context.

### D4. Staging: an identity, a class and a baseline, taken once

When a reply is read, each frame is **staged** through a `FileEditStaging`
port. The reply reader calls it, and the gateway's target module implements
it. Staging is host-only and needs no writer action.

1. **Every candidate, not the first.** The resolver gains a read that keeps
   every match: each workspace folder, relative path and group that matches,
   with its absolute path. Its existing catalog is unchanged. The containment
   and symlink checks (`safeWorkspaceResourceSize`) apply to every candidate.
2. **One physical file or a refusal.** `{group, path}` (case-insensitive, as
   `resource.read` matches it) must name exactly one physical file. Two roots
   holding the same relative path, or two spellings on a case-sensitive
   disk, are refused as `ambiguous-target`, never given to the first root.
   The same file reached through nested roots is one file.
3. **The identity** is the file's host-authorized `documentUri` plus its
   display `relativePath`, as the excerpt's `sourceUri` is (`WorkshopExcerptSource.file`):
   - written by the host only;
   - never authorized again without current containment, symlink and
     catalog checks (D7);
   - never sent to the webview, which sees the display path and an opaque
     card key.
4. **`<excerpt/>`** is staged to the excerpt the room holds at that moment.
   - Its source must be `file` or `editor-selection`, with a `sourceUri`
     inside a workspace folder. A `manual` excerpt is refused as
     `excerpt-not-a-file`.
   - The identity is that document, kept as staged. A later excerpt never
     retargets the card.
5. **The class** (D5) is computed from the identity.
6. **The baseline** (D6) is read.

A staging refusal becomes a card in `refused`, with the host's reason. The
writer sees what the persona tried, and nothing can be applied.

### D5. Policies by class, decided by identity

**The class is decided by identity, never by the trailer's group.** A file is
**prose** when any of these holds:
- any of its memberships is `chapters` or `manuscript`, counted over every
  group whose patterns match it, through every root containing it (nested
  roots included);
- it was staged from `<excerpt/>`;
- it is the room's excerpt document at staging or at Apply.

Every other file is **notes**. The class is computed again at Apply (D7), and
a file that turned prose since staging gets prose rules.

| | Prose | Notes |
|---|---|---|
| `rewrite` | Refused | Allowed, after front matter, within `rewriteFileBytes`. Refused when the content holds protected syntax (links, images, code, HTML), with a reason that asks for replace edits instead (N-02) |
| `find` / `replace-with` | Allowed | Allowed |
| `append` / `prepend` | Allowed, each within `insertWords` and `insertCharacters`, and a plain paragraph | Allowed |
| Line breaks | Allowed | Allowed |
| Structure mode (D7) | `prose-paragraphs` | `free` |
| Protected regions | Never touched | Never touched |
| Rewrite ceiling | Yes (below) | None |

**Structure modes.** The applier's policy gains `structure`, replacing
`preservesMarkdownStructure` (F-05):
- **`strict`:** today's `editsChangingStructure`, unchanged. Proofread and
  Craft Flags keep it, and their tests keep their expectations.
- **`prose-paragraphs`:** plain paragraphs may split, merge, appear or go,
  meaning blank-line boundaries between plain paragraphs are free. Everything
  else compares as in `strict`:
  - headings, lists, block quotes, code blocks, tables, thematic breaks and
    HTML blocks (kind, order, nesting);
  - inline links and images (destination and title), code spans, autolinks
    and inline HTML.

  An added paragraph that is a heading, a list or any other non-paragraph
  block is refused.
- **`free`:** no structure comparison. Protected regions still hold.

**The rewrite ceiling** (prose only; F-06). It is measured on the live text
at every attempt:
- `replaced` is the characters (UTF-16) that replace edits remove;
- `touched` is the total characters of the distinct blank-line paragraphs
  (`splitBlankLineParagraphs`) that any replace range overlaps;
- the apply is refused as `rewrite-ceiling` when
  `replaced > rewriteFloorCharacters` (300) and
  `replaced > rewriteCeilingShare × touched` (0.6);
- insertions are not counted toward it; `insertWords` bounds them, words
  being `/\S+/gu` matches.

**`FILE_EDIT_TARGET_POLICIES`** is data keyed by class, the way
`DRAFT_EDIT_PASS_POLICIES` is.

### D6. Baseline and freshness

At staging the host reads the target as it stands: the live buffer when the
document is open, else the file. It records `baseline`, the SHA-256 and
length of the **content** (the planner's content: after front matter,
surrounding whitespace trimmed). The rules at Apply, checked on every
attempt:

| Operation | Fresh when |
|---|---|
| `rewrite` | The live content's SHA-256 equals the baseline. Otherwise the card is `stale`. |
| `replace` | Each quote is found exactly once in the live text. Otherwise `stale`. Edits elsewhere in the file don't stale it (product rule). |
| `append` / `prepend` | Always: they overwrite nothing. D8's claim prevents a second landing. |

A frame's operations must all be fresh.

**The card's before and after for a rewrite** come from the host on request
(D9). The host returns them only while the baseline holds; otherwise the card
turns `stale`. The writer always reviews the text actually being replaced.

**The baseline is the host's, not the persona's.** A persona may propose a
rewrite without having read the file. The baseline and the card's
before/after make that visible.

**After a reopen.** The baseline persists (D10), so Apply after reopening a
saved or imported session checks the live text again.

### D7. The gateway's apply

`ProjectFileEditGateway` (built only in `extension.ts`, reached through
`CoreServices`) applies a staged proposal. The handler's claim (D8) is
already held when it runs.

1. **Re-authorize the recorded identity:**
   - it lies inside a current workspace folder, with no symlink segment
     (the resolver's checks);
   - it is still a member of the catalog, read fresh with every candidate.

   If not, it is refused as `no-longer-configured` or `outside-workspace`.
2. **Recompute the class** (D5).
3. **Open the document** (`DocumentEditor.open`: in VS Code,
   `openTextDocument`, not shown) and read the live snapshot. Its URI must
   equal the identity.
4. **Plan** with D3's planner, then check freshness (D6) and the policy
   (D5).
5. **The last dispatch boundary** (D8): the handler's `stillCurrent()` and
   the identity checks, with nothing awaited between them and the applier's
   call.
6. **Apply through `DraftEditApplier`**, with the class's `allowsNewlineChanges`
   and `structure`, and a `revalidate(snapshot, edits)` callback.
   - The applier runs `revalidate` on **every attempt**, its internal retry
     included.
   - `revalidate` re-checks freshness, the ceiling, the insertion bounds and
     the structure mode on the live text and the moved edits.
   - A refusal on a retry writes nothing (F-06).
7. **Report what landed, by operation**, from the applier's result:
   - applied ids landed;
   - `notApplied` didn't;
   - `unknown` is unknown;
   - refusals carry their reasons.
8. **Show the document.** When something landed and the document isn't
   visible, it is shown in a preview tab, so the writer sees the dirty buffer
   and saves or undoes it.

The gateway and Draft Edit's runs are the only callers of the applier, and
only the applier calls `applyEdits`. No Workshop module reaches
`DocumentEditor`. `boundaries.test.ts` pins all three.

### D8. The claim, duplicates and outcomes

- **The claim.** On an Apply, Review in editor… or Decline message, before
  anything is awaited, the handler takes a claim keyed by
  `(liveSessionId, turnId, index)` in a host map it owns.
- **Duplicates join.** A second Apply or Review while claimed, with the same
  or a different request id, joins the claim, and each request gets the one
  outcome.
- **Decline while claimed** is answered `applying`, and nothing changes.
- **A terminal card replays its state.** Apply or Decline on one writes
  nothing. Operations always come from the host's stored proposal, never
  from the request.
- **`applying` is persisted before the write.**
  1. At the last dispatch boundary, the card's state becomes `applying`, and
     the session is flushed (awaited).
  2. The boundary checks then run again, with nothing awaited before the
     applier's call. A failed check here returns the card to `pending`, with
     nothing written.
  3. The checks: the claim is held; the live room is the same session and
     its ledger still holds the turn; the setting is still `ask`; the
     identity checks pass.
- **A room replaced after dispatch.** Its outcome is logged (counts) and
  dropped. The saved session holds `applying`, which reads as `unknown` when
  reopened.
- **States.**
  - `pending`: may be applied or declined.
  - `applying`: transient; persisted only around a dispatched write.
  - `applied`: every operation landed.
  - `partial`: some operations landed and the rest didn't, by operation. For
    example, entries left unticked in Refactor Preview.
  - `declined`: the writer declined the card.
  - `stale`: D6.
  - `refused`: staging or policy refused it, with the host's reason, and
    nothing was written.
  - `unknown`: the applier reported `unknown`, a preview's document closed or
    changed language during review (VS Code's accepted limit, ADR
    2026-10-21), or the card was found in `applying` on reopen.
- **No blind retry.** `unknown`, `partial`, `stale` and `refused` offer no
  Apply; the writer asks the persona again. A discarded Refactor Preview
  (`declined` from the host) wrote nothing, so the card returns to `pending`.
- **Preview.** No command is ever sent to Refactor Preview: no discard.
- **Shutdown.** Claims are not awaited at deactivation, since a preview may
  wait on the writer indefinitely. The flushed `applying` reads as `unknown`
  after a reload.

### D9. Cards in the thread

Each proposal is a card under its bubble:
- **What it shows.** The file's display path and class ("chapter" or "note"),
  the `<why>`, and each operation:
  - replace: its find and replace-with, as a word-level diff;
  - append or prepend: the added text;
  - rewrite: before and after, from the host's preview route
    (`WORKSHOP_FILE_EDIT_PREVIEW`), which answers `stale` when the baseline
    no longer holds.
- **Actions,** offered only while `pending`:
  - **Apply** applies directly (`review: 'direct'`); the card was the review.
  - **Review in editor…** goes through Refactor Preview (`review: 'preview'`).
  - **Decline.**
- **Correlation.** Every route carries a webview-minted request id, and an
  answer to an earlier room is ignored (the #221 receipt pattern). This
  correlates answers only. D8's claim is what serializes writes.

### D10. Session state

A turn carries `fileEditProposals`, a list. The types live in
`shared/types/messages/workshop/fileEdits.ts`. Each entry holds:
- **`target`:** `{ kind: 'file' | 'excerpt', documentUri, relativePath }`,
  host-written. The webview's view omits `documentUri`.
- **`class`:** `'prose' | 'notes'`, as staged.
- **`operations`** and **`why`**.
- **`baseline?`:** `{ sha256, length }`. Absent on a card refused at staging.
- **`state`**, with an optional `reason`, and per-operation `outcomes` once
  settled.
- **`landed?`:** one record per landed operation (N-01):
  - `{ operation, before, after, contextBefore, contextAfter, versionAfter }`;
  - `before` and `after` are each at most `revertCharacters` (4,000);
  - the context is up to 80 characters on each side, which anchors a
    deletion;
  - an operation over the bound records only `{ operation, beforeSha256,
    afterSha256 }`, and is not revertible.

Codec rules:
- **Development shapes** go through `WorkshopSessionCheckpointNormalization`,
  logged and tested.
- **Release:** the schema decision is ADR 2026-07-30's, at the epic's end.
- **Transcript export** (one projection) shows a card's display path, `why`
  and state, never its operations' text or `documentUri`.

### D11. One setting

`proseMinion.workshop.fileEdits`: `off` | `ask`, default `ask`.
- **`off`** teaches nothing and stages nothing; a stray frame is dropped and
  counted.
- **When it's read:**
  - when the reply is read, deciding whether its frames are staged;
  - at the last dispatch boundary (D8): with `off`, nothing is written.
- **No other value.** v1's type has no `auto`, and no model or webview input
  can name one.

### D12. The seam for autonomous editing (not built)

Approval is a policy, not a code path.
- **Later, `auto`** would apply a staged proposal at once. It uses the same
  staging (D4), freshness (D6), gateway (D7) and claim (D8).
- **A mid-turn `file.edit` capability** would stage through the same port,
  with `source: { kind: 'capability', … }`. It would join
  `WORKSHOP_CAPABILITY_OPERATIONS` in a new `file` family.
- **Revert** would be an inverse request through the same gateway, using
  D10's `landed` records. Only operations within `revertCharacters` are
  revertible. Revert would refuse when a recorded `after` and its context no
  longer stand exactly once, or when protected regions or policy now forbid
  it. A partial landing is reverted operation by operation.
- **Its own authorization.** That feature chooses its authorization policy
  on its own. Nothing in v1 accepts `auto` from any input.

What keeps these additive:
- staging and apply don't care where a request came from;
- Apply is a host action keyed by a stored proposal, never a webview write;
- what landed is recorded.

### D13. Guards that never depend on the model

These are code, tested without a model:
- the bounds (D2);
- identities that are catalog-only, ambiguity-refusing and contained (D4);
- the class by identity (D5);
- the baseline (D6);
- the version guard, protected regions, structure modes and the ceiling on
  every attempt (D7);
- the claim (D8);
- the read-back.

Logs carry ids, counts and fault kinds, never the writer's text, a quote, a
path or a URI. Sentinel tests prove it for malformed, oversized and disabled
frames, for staging refusals, and for apply failures.

## PR #226 review: how each finding is settled

| Finding | Settled in |
|---|---|
| F-01 (P1) Rewrite baseline | D6. A hash of the content is staged and checked on every attempt; the rewrite's before/after comes from the host while the baseline holds; append and prepend are fresh by rule, guarded by D8's claim. |
| F-02 (P1) Target identity | D4. Every candidate is resolved; ambiguity is refused; the identity is a host-written `documentUri`, re-authorized at Apply (D7.1, D7.5); an excerpt is bound to the document it was staged from. |
| F-03 (P1) Prose by identity | D5. The class comes from every membership through every root, plus excerpt documents; it is recomputed at Apply. |
| F-04 (P2) Claim and outcomes | D8. The claim is taken before any await; duplicates join; Decline and terminal states replay; `applying` is flushed before dispatch; `partial` and `unknown` exist, with no blind retry. |
| F-05 (P2) Markdown structure | D5's structure modes. `strict` is unchanged for Proofread and Craft Flags; `prose-paragraphs` frees plain-paragraph boundaries only. Built and tested in Slice 2. |
| F-06 (P2) Ceiling on retry | D5's exact ceiling, and D7.6's `revalidate` on every attempt. |
| N-01 Revert record | D10's `landed` records, and D12's narrowed Revert. |
| N-02 Rewrite and protected syntax | D5. A notes rewrite over protected syntax is refused, with a reason; protection is never weakened. |
| N-03 Shared write path wording | D3 and Consequences: shared vocabulary, memory's persistence separate. |
| Preview is not Apply | D8, `partial` and `unknown`, with no discard command. |
| `auto` unavailable | D11 and D12. |
| Bounded input and logging | D2's bounds table and D13's sentinel tests. |

## Defaults taken (2026-11-05)

Okey delegated these. Each is the recommendation below, taken as the default
until he says otherwise.

1. **Default.** File edits are on ("Ask first"). Nothing changes without
   Apply, and a card is cheap to decline.
2. **New prose in a chapter.** Append and prepend are allowed, up to 400
   words each, and the ceiling is 60%.
   - **Added after the review:** the ceiling applies only above 300 replaced
     characters (`rewriteFloorCharacters`), so a short paragraph can still be
     replaced whole.
3. **Apply on chapters.** Apply is direct everywhere, with "Review in
   editor…" beside it.
4. **Cap per reply.** 5 files.
5. **Apply to Draft's "Apply Recommendations"** is dropped. Apply Variation
   (no model) is a later gateway use.

## Consequences

- **Shared vocabulary.** Persona edits and memory edits share one operation
  vocabulary and planner. Memory keeps its own persistence.
- **Shared document write path.** Persona edits and Draft Edit share one
  document write path. It gains a structure mode and a check on every
  attempt, with no change to Proofread's behavior.
- **Apply to Draft** needs no engine of its own.
- **The writer's draft is protected** by:
  - an identity that never drifts;
  - a class that follows the file;
  - a baseline;
  - a claim;
  - the version guard and protected regions;
  - read-back;
  - never saving.
- **Prompt cost.** A persona's reply can carry more output, so prompt budgets
  grow by the frame's teaching. That cost is paid only while the setting is
  on.
- **New seams.** `DocumentEditor` gains `open`, and the resolver gains an
  every-candidate read. A desktop host implements both.

## Alternatives considered

- **Write files directly through the `FileSystem` port.** Rejected: no undo,
  no live-buffer awareness, and it would overwrite unsaved edits.
- **Line-number or offset edits.** Rejected: models miscount, and a moved
  line silently retargets the edit (Draft Edit's rule).
- **A gateway per feature.** Rejected: several anchoring rules and write
  paths to review.
- **`{group, path}` as the identity.** Rejected (F-02): the resolver keeps
  the first root and folds case, so a root change can retarget a card.
- **A rewrite's whole before-text in the session.** Rejected for the
  baseline: a hash is enough to refuse, and the host shows the live text
  while it matches. Bounded before-text is recorded only for landed
  operations, for a future Revert (D10).
- **Turning a rewrite into minimal edits** so it can pass protected syntax.
  Deferred: v1 refuses it (N-02).
- **Autonomous editing first.** Deferred by Okey's choice. D12 keeps it
  additive.
