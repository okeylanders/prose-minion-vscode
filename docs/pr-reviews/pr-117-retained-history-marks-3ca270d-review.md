# PR Review — Workshop Rewind and Branch: retained-history marks

**Author:** okeylanders · **PR:** [#117](https://github.com/okeylanders/prose-minion-vscode/pull/117) (Open)
**Branches:** `sprint/workshop-rewind-and-branch-01-marks` → `epic/workshop-rewind-and-branch`
**Base:** `53ebaa63d689b80839c277385fe0bed06acaa181` · **Head:** `3ca270d1684b6bc1bcfa40ce73037d3422186e3b`
**Scope:** 41 files · +3,645 / −109 · 8 commits
**Reviewed:** 2026-09-30 · **Mode:** Codex review with two independent reviewers for completion/lifecycle and persistence/integrity, following the repository's parallel-review guidance. Report format follows the existing reviews in this directory.

## Resolution ledger

Status legend: **Open** = actionable recommendation with its deadline below · **Deferred** = an explicitly accepted follow-up · **Addressed** = fixed · **N/A** = praise or no action. No follow-up has been accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | Persisted marks can omit an intermediate commit or attach a commit to the wrong participant's turn, yet decode/hydration still publish the affected cuts as available | Reproduced through strict validation, decode, import, hydration, and snapshot publication | **Open — fix before Sprint 02 enables cutting** |
| F-02 | 🔵 Nit | The shared scripted oracle uses synthetic provider commits and omits repeated sidecar replacement; broaden it before treating it as the complete rewind equivalence proof | Traced through the script and existing focused tests | **Open — nonblocking Sprint 02 test follow-up** |
| F-03 | 🟢 Praise | Recording after settlement captures the committed room offset, host pin rows, and shipped attachments; failed reads prune the sequence instead of inventing counts | Source tracing and passing completion/scripted/route tests | N/A — preserve |
| F-04 | 🟢 Praise | Whole-key degradation, validated import counts, hydration baselines, and recovery equality have clear ownership and preserve writer content | Source tracing and passing persistence/coordinator tests | N/A — preserve |
| F-05 | 🟢 Praise | The added pruning sites and abandoned-widget manifest cleanup close real lifecycle gaps without removing the visible writer turn | Source tracing and passing lifecycle/widget tests | N/A — preserve |

**Verdict:** Approve this marks-only Sprint 01 with nonblocking findings. F-01 is a required correctness gate before the destructive rewind/branch operations ship. No ordinary live-recording path was found that creates the malformed sequences in F-01, and this PR does not execute a cut.

---

## Verification actually run

Checks performed against the reviewed head, before adding this report:

| Check | Result |
| --- | --- |
| Local checkout equals PR head `3ca270d1684b6bc1bcfa40ce73037d3422186e3b`; working tree initially clean | ✅ |
| `npm ci --ignore-scripts --no-audit --no-fund` | ✅ 979 packages installed |
| `npm test -- --runInBand` | ✅ 219 suites / 2,528 tests / 2 snapshots passed |
| `npm run typecheck` | ✅ Core, webview, and extension projects passed |
| `npm run lint` | ✅ Exit 0; 0 errors / 1,024 warnings. The baseline lint run was not repeated here |
| `git diff --check 53ebaa63d689b80839c277385fe0bed06acaa181...HEAD` | ✅ |
| Independent completion review's focused Jest run | ✅ 5 suites / 53 tests passed |
| F-01 probes using the canonical room, real decoder, real conversation import, and aggregate hydration | ✅ 1 suite / 3 tests passed: an unmodified control and both integrity gaps reproduced; details below |
| Production bundle, live provider calls, VS Code Development Host, visual UI checks | Not run. No rewind UI ships in this PR |

The focused run covered `WorkshopRunCompletion`, `WorkshopAnalysisSidePass`, `WorkshopRoutes.retainedHistoryMarks`, `WorkshopRetainedHistoryMarks.scripted`, and `WorkshopSessionRewindability`.

Governing material reviewed: `AGENTS.md`, session collaborator conventions, the PR description and complete changed-file diff, ADR 2026-09-30, the epic and Sprint 01 plan, the Sprint 02 inputs, and the existing PR-review format.

---

## Executive briefing

The production recording chain is coherent. Counts come from `ConversationManager` in archive units, cross the existing engine/service seam, and enter the aggregate through one completion-boundary recorder. The aggregate supplies the participant's writer-source count and delivery offset after the handler's bookkeeping settles. Host, guest, synthesis, direct-tool, and writer-requested report paths are covered. Cancellation, replacement, dismissal, reinvitation, excerpt retirement, generation loss, reset, and degraded hydration remove the appropriate evidence.

The main weakness is at the persisted-data boundary. Latest-mark/archive equality catches an unmarked tail, but does not prove that the earlier sequence has every commit or that a commit mark belongs to its named turn. The policy assumes both. Two small edits to otherwise valid optional bookkeeping survive every boundary and advertise cuts that would select the wrong history prefix. This is a demonstrated validation gap, rather than evidence that normal completions lose marks. Address it before the next sprint consumes this evidence to delete history.

---

## Findings

### F-01 · 🟡 Standard · Validate commit anchors and sequence coverage before trusting persisted marks

**Files:** `packages/core/src/application/services/workshop/session/WorkshopRetainedHistoryMarks.ts:204-246`, `:258-296`; `packages/core/src/application/services/workshop/session/WorkshopRewindPolicy.ts:201-208`.

**Affected contract:** Exact retained-history prefixes for a cut, including host-computed rewindability after reopening a checkpoint.

`findInconsistentRetainedHistoryMarkKeys` checks that a turn exists and that the supplied marks are ordered and monotonic. It does not require an `origin: 'commit'` mark to name a commit by its own conversation key, and it does not look for an omitted commit between supplied marks. `findUnverifiableRetainedHistoryMarkKeys` checks archive bounds and latest-count equality. Neither catches these cases. `WorkshopRewindPolicy` then treats the first host mark as sufficient evidence for every later host rest point, explicitly relying on complete coverage.

**Probe A — missing middle mark.** In the canonical scripted room, host marks have message counts 6, 8, 10, and 14. Remove only the second mark, for the host synthesis at `turn-8-assistant-1016` (abbreviated `turn-8` below); leave the ledger and archive untouched. The final mark still equals the 14-message archive.

| Boundary or result | Observed |
| --- | --- |
| Strict integrity | Accepted |
| Checkpoint decoding | Accepted; `normalizations: []` |
| Conversation import and aggregate hydration | Retained the incomplete sequence |
| Snapshot verdict for `turn-8` | `{ available: true }` |
| Last host mark selected at or before `turn-8` | First host mark: 6 messages |
| Canonical oracle's host count at `turn-8` | 8 messages |

A transform using the specified last-mark selection would keep the visible synthesis but discard its host-memory exchange. This uses the existing selector to establish the incorrect prefix; the not-yet-implemented transform was not run.

**Probe B — wrong commit anchor.** Keep the second host mark's count of 8, but move its `turnId` from the host synthesis at `turn-8` to the preceding tool report at `turn-7-assistant-1014`. Its existing reader offset is already at that report, so offset validation still passes. Strict validation, decoding, and hydration accept the edit with no normalization, and the tool-report cut remains available. Last-mark selection there now includes 8 host messages where the report rest-point oracle has 6: the later synthesis exchange survives while the cut ledger would exclude the synthesis reply.

**Scope and severity.** These probes edit optional persisted bookkeeping. No present runtime producer of either malformed sequence was identified: recording failures and lifecycle changes prune whole keys, exports copy state, and normal saves write both halves together. The demonstrated behavior today is a false published capability after opening malformed metadata. Destructive consequences depend on Sprint 02 consuming it. That makes this a Standard integrity follow-up for this PR, with a firm gate before cutting ships.

**Recommended fix:** Extend the shared consistency rules, rather than adding a second rule set to the policy:

1. For `origin: 'commit'`, require `workshopRetainedHistoryKeyForCommitTurn(turn)` to equal the mark's `conversationKey`. Baselines remain allowed at a ledger head that is not a commit turn.
2. From each key's first surviving mark onward, require a mark for every commit belonging to that retained membership. Respect membership replacement and the first-mark/baseline floor; earlier discarded memberships must not invalidate the current one.
3. Drop the affected key's entire sequence on either failure, using the existing inconsistent-mark normalization. Successful import can then baseline it at the head as it does for other degraded evidence.

Add the two probes to `WorkshopRetainedHistoryPersistence.test.ts`. Assert whole-key degradation, preservation of unrelated participants and writer content, a head baseline after open, and an unavailable verdict for the earlier host synthesis. These tests should fail if the anchor/coverage checks are removed.

### F-02 · 🔵 Nit · Broaden the canonical oracle before using it as the full rewind proof

**File:** `packages/core/src/__tests__/application/services/workshop/session/ScriptedWorkshopRoom.ts:398-426`, `:512-535`.

The helper constructs provider history with `ConversationManager.addMessages`; it does not execute `AgentRunEngine`. That is appropriate for a deterministic bookkeeping oracle, and the current manager-count/archive comparisons are useful. It proves the aggregate and completion boundary against the history supplied by the script, rather than proving the complete provider commit-to-result seam.

The canonical script also runs the prose sidecar only once, then retires it through an excerpt revision. It does not exercise replacing a still-live sidecar with another report under the same key. This is one of the pruning cases the sprint says the shared oracle covers. Other useful additions for Sprint 02 are a committed one-shot widget and a guest continuation that ships a staged attachment. Separate widget tests currently cover abandonment cleanup; the Sprint 02 plan already calls for a widget and directive change in the shared script.

**Recommendation:** Add repeated sidecar replacement to the canonical room, and extend the same oracle with the planned widget/directive cases. Add one integration case using a real `AgentRunEngine` with scripted transport and the production count reader for a multi-round commit. Keep these as focused contract tests. This is test breadth, not a demonstrated provider or pruning defect.

### F-03 · 🟢 Praise · Settlement is the right recording boundary

The three caller hooks preserve the existing order of room acknowledgement, pending host updates, and attachment shipment while moving them inside completion. The mark follows that bookkeeping. `adoptWriterReport` records only after its sidecar and manifest are adopted. The recorder degrades unreadable/mismatched histories by pruning the key, so a missing record does not silently leave an earlier sequence that claims to cover the new commit. Cancelled and zombie completions skip the reader entirely.

### F-04 · 🟢 Praise · Hydration and recovery keep evidence separate from writer work

Raw checkpoint preflight skips mark integrity only long enough to normalize; strict validation follows. Imported counts are taken only from successful conversation imports. Degraded bindings lose their marks, unmarked valid participants receive head baselines, and rollback retains its existing marks without fabricating imported counts. Recovery equality ignores marks while still comparing substantive workshop state and conversation archives. The coordinator regression test checks the spurious recovery-copy case with the real store.

### F-05 · 🟢 Praise · Pruning follows conversation lifetime

Excerpt revision retires tool conversations and their marks together. Fresh adoption, rebinding, dismissal/reinvitation, generation loss, and reset cannot carry an old membership's sequence into a new one. The widget cleanup removes the provisional manifest row when inference is abandoned, while preserving the visible writer turn and its config linkage. That matches the ledger's existing abandonment semantics and keeps the latest committed mark's manifest count truthful.

---

## Assessment of the PR's plan corrections

| Correction | Assessment |
| --- | --- |
| Record after settlement rather than inside `completeRun` | Sound. Offsets and shipped writer-source rows are updated after adoption; earlier recording would capture the wrong rest point |
| Prune on excerpt retirement and conversation rebinding | Sound. Both invalidate the history addressed by the existing key |
| Remove abandoned widget manifest rows | Sound. Acceptance precedes successful provider delivery; abandonment must remove the provisional row |
| Require latest-mark/archive equality | Necessary and correctly implemented for unmarked tails. F-01 supplies the remaining anchor/coverage checks |
| Ignore marks in recovery-content equality | Sound. Baselines are bookkeeping, while substantive state and archives remain part of comparison |
| Defer context-source supersede to Sprint 02 | Reasonable for collecting counts. Resolve the metadata semantics before declaring rewind equivalence |

`ConversationManager.appendContextSources` still replaces a re-delivered resource's row in place. Count slicing alone cannot restore that row's earlier metadata. This is already recorded in ADR implementation finding 6 and the Sprint 02 inputs, so it is not a new untracked defect in this review. Append-and-stale-chain handling, or an explicitly documented oracle difference, must be decided before the transform's equivalence assertions are finalized.

## Things checked and found fine

- **Provider units:** The count reader excludes the leading system message exactly as archive export does; it counts committed context-source rows. No provider-message parsing was added to the aggregate.
- **Architecture:** The new state owner supports the established export/prepare/install/reset lifecycle, with throwing preparation above the install barrier. The aggregate gains wiring and participant facts; shared consistency and policy decisions stay in focused modules. The existing large facade does not acquire provider access or cutting logic.
- **Codec version:** Optional marks preserve older shapes for this reader. The inability of older exact-key readers to open newly written files is explicitly documented in ADR §9, rather than hidden behind an unnecessary schema bump.
- **Policy/publication:** Writer bubbles map to a cut before the message, replies to a cut after it, and capability cards/dividers/tool requests offer no bubble action. Busy takes precedence, the directive floor holds, and only windowed turn verdicts leave the host. Missing guest/tool evidence does not block a host-exact cut.
- **Persistence identity:** This PR does not weaken named-file authority, optimistic checkpoint identity, or the serialized operation path. No new save scheduling or disk writes were added to mark recording.

---

## Review report card

| Dimension | Grade | Note |
| --- | --- | --- |
| Normal completion and lifecycle correctness | A | No runtime regression identified; the completion and pruning changes match the amended ADR |
| Persisted evidence integrity | B | Strong whole-key degradation and tail checks; F-01 leaves anchors and intermediate coverage unverifiable |
| Architecture and scope | A− | Closed collaborator and application seam; rewind transform/routes/UI remain in later sprints |
| Tests | A− | Full checks pass and the rest-point oracle is useful; broaden the two boundaries in F-01/F-02 before cutting |
| Design/documentation | A− | Corrections and downgrade behavior are explicit; context-source metadata remains an acknowledged Sprint 02 decision |

**Final recommendation:** Approve Sprint 01 as a non-destructive marks collector. Carry F-01 into the next sprint's entry criteria and fix it before exposing rewind or branch. F-02 is a nonblocking improvement to the shared equivalence proof. No production code was changed as part of this review.
