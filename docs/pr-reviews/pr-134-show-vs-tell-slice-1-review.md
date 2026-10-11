# PR Review — Show vs. Tell contracts, budgets, codec, and lifecycle (Slice 1)

**Author:** okeylanders · **PR:** [#134](https://github.com/okeylanders/prose-minion-vscode/pull/134) (open, unmerged at review)
**Branches:** `epic/conversation-widgets-sprint-05-slice-1-contracts` → `epic/conversation-widgets`
**Verified base / merge-base:** `33efaa1b1f244602a50ae2510a3c2fbf4a5284ee`
**Initial reviewed code head:** `c9dbd6dc625bcde2796f0d3bb68324aa0cafd462`
**Final re-review head:** `fdcf45eab489645f235890eab859ff88cedb5360`
**Initial scope:** 27 files · +2,610 / −13 · 7 commits
**Fix-round scope:** 3 files · +74 / −3 · 2 commits after the first report `453999c4`
**Reviewed:** 2026-10-09 · **Reviewer:** Astra · **Mode:** independent code/spec review, two additional focused audits (codec/integrity; contracts/persistence), adversarial runtime probes, and full deterministic verification; fix re-review with an independent codec challenge, original regressions, full-session rejection/acceptance controls, and all gates rerun

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf. This ledger records the independently verified state at `fdcf45ea`; original evidence below remains pinned to `c9dbd6d`.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | Apostrophe-only duplicate prose bypasses the normalized-duplicate gate | All six apostrophe pairs now reject at both integrity gates and full session hydration; the distinct-prose control still round-trips exactly | **Addressed**, independently verified at `fdcf45ea`; fix `166c5efc` |

**Verdict: Approved for merge into `epic/conversation-widgets`.** F-01 is independently verified addressed at `fdcf45ea`. No open Blocking, High, Standard, or Nit finding remains. The reviewed foundation matches the Slice 1 boundary, and all deterministic gates and code-head CI pass. Approval remains subject to required checks on the final report-only branch head. This report does not merge the PR or authorize starting Slice 2 before the writer merges it.

## Final re-review at fdcf45ea

The developer's [fix commit `166c5efc`](https://github.com/okeylanders/prose-minion-vscode/commit/166c5efc9fe355394e2bd3d192a04fdae12d2ca2) folds U+2018, U+2019, and U+02BC to the ASCII apostrophe after NFKC/lowercasing and before tokenization. It stays feature-local and adds no cross-feature runtime import. The following documentation commit aligns the handoff. The [author response](https://github.com/okeylanders/prose-minion-vscode/pull/134#issuecomment-6080624998) was checked against the actual delta and independent execution rather than accepted as verification by itself.

### F-01 is addressed

- The original independent regression now passes without modification.
- The committed matrix exercises all six distinct pairs of the four supported apostrophes at both the persisted-draft integrity gate and the exported workup-integrity gate. It also pins one shared key, composed/decomposed accent rejection, and acceptance of genuinely distinct prose.
- An independent real-session matrix repeated all six pairs through config creation, export, JSON serialization, parsing, and fresh hydration. Every duplicate rejects during integrity validation, and failed hydration installs no config.
- A genuinely distinct funeral/wedding pair using U+02BC survives the complete session round-trip exactly.
- An additional comparison across **65,536 individual BMP codepoint contexts** found no token-key mismatch with the established Creative Variations normalization. This is a bounded comparator check, not a claim of exhaustive Unicode-string or linguistic equivalence.
- The original 1,296 legal cardinality/selection combinations and malformed-field boundary probes still pass. No new finding was established in the fix delta.

### Final re-review verification

All checks below target **`fdcf45eab489645f235890eab859ff88cedb5360`**, before this report update, with the same Node/npm runtime and unchanged lockfile.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **273 suites / 3,635 tests / 2 snapshots passed**, 63.351 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,086 warnings**, unchanged from the initially reviewed head |
| ESLint over the two fix-round TypeScript files | **0 errors / 0 warnings** |
| `npm run build`, including `verify:bundle` | Passed; the same three webpack size/performance warnings |
| `git diff --check 453999c4..fdcf45ea` | Passed |
| Original independent contract/regression suites | **2 suites / 8 tests passed**, 3.547 seconds |
| Independent session/comparator probes | Six duplicate pairs reject through hydration, distinct control round-trips exactly, and all 65,536 BMP contexts match |
| GitHub CI for re-reviewed code head | **Success**, [PR run 37928448574](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37928448574) |
| CI for initial report-only head `453999c4` | **Success**, [PR run 37927365783](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37927365783) |

The new report-only commit and its exact-head CI are verified after publication. The sections below preserve the initial finding and its original evidence; their failure descriptions apply to `c9dbd6d`, not the corrected code.

## Initial finding F-01 — Preserve apostrophe normalization in the duplicate key

**Evidence:** [ShowVsTellDerivations.ts:46–51](https://github.com/okeylanders/prose-minion-vscode/blob/c9dbd6dc625bcde2796f0d3bb68324aa0cafd462/packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations.ts#L46-L51), consumed by [ShowVsTellConfigIntegrity.ts:119–124](https://github.com/okeylanders/prose-minion-vscode/blob/c9dbd6dc625bcde2796f0d3bb68324aa0cafd462/packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellConfigIntegrity.ts#L119-L124). The [Sprint 05 workup contract](https://github.com/okeylanders/prose-minion-vscode/blob/c9dbd6dc625bcde2796f0d3bb68324aa0cafd462/.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md#L171-L184) requires exact normalized duplicate rejection as in Sprint 03. The established [Creative Variations tokenizer](https://github.com/okeylanders/prose-minion-vscode/blob/c9dbd6dc625bcde2796f0d3bb68324aa0cafd462/packages/core/src/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness.ts#L13-L30) explicitly folds U+2018, U+2019, and U+02BC to the ordinary apostrophe before tokenization. **Confidence: High; priority: P2.**

The new comparator performs NFKC normalization, lowercasing, then `[\p{L}\p{N}]+` tokenization. U+02BC MODIFIER LETTER APOSTROPHE is a Unicode letter and survives inside a token. An ordinary apostrophe or U+2019 RIGHT SINGLE QUOTATION MARK instead splits the contraction. Consequently these otherwise identical proposals are accepted together:

```text
She hadn’t trusted him since the funeral.  (U+2019)
She hadnʼt trusted him since the funeral.  (U+02BC)
```

Their Show vs. Tell keys are different:

```text
she hadn t trusted him since the funeral
she hadnʼt trusted him since the funeral
```

Creative Variations produces the same token sequence for both. This is a concrete hole in the claimed parity with its normalized-duplicate rule, not a request for fuzzy similarity detection, textual-overlap scoring, or a dependency on Creative Variations' feature implementation.

### Reproduction and impact

Using the PR's generated draft fixture:

```typescript
const draft = generatedShowVsTellDraft();
const [first, second] = draft.workup!.groups[0].variants;
second.prose = first.prose.replace(/\u2019/g, '\u02bc');
second.direction = 'keep it';

assertShowVsTellDraftShape(draft, 'draft');
assertShowVsTellDraftIntegrity(draft, 'draft'); // currently accepts
```

The independent regression expecting the integrity call to throw fails with **“Received function did not throw.”** The reproduction also passed through the real `WorkshopSessionService` config creation, export, `JSON.stringify` / `JSON.parse`, `parseWorkshopSessionStateV1`, and a fresh service's `hydrateCommittedState`. Both copies survived unchanged. Canonically equivalent composed/decomposed accent controls were correctly rejected, so this is specifically the missing apostrophe folding, not a general normalization failure.

The current Slice 1 persistence gate can therefore accept a workup containing the same proposal twice. Slice 2b is explicitly expected to reuse this same workup gate; leaving the gap here would carry it into generation validation. There is no claim of a currently live widget or a production provider exploit.

### Requested correction

Normalize the supported apostrophe variants before token matching, preserving the existing NFKC/lowercase token policy and feature ownership. Add a regression matrix covering ASCII apostrophe, U+2018, U+2019, and U+02BC, including the persisted draft gate and the exported workup-integrity gate intended for Slice 2b. Keep genuinely distinct prose accepted and retain the canonical-equivalence controls. A feature-local correction is sufficient; no new variation framework is needed.

## What is sound

- **The slice is correctly bounded.** The diff adds contracts, budgets, continuum/readout constants, the feature-local codec/integrity/derivations/ID owner, and explicit persistence registry arms. It adds no prompt, generation route, UI, recommendation, or commit implementation. The existing `show-vs-tell` catalog entry remains `live: false`, and existing unavailable-widget tests remain valid.
- **Shared vocabulary has the intended ownership.** Five local positions map totally onto the three Controller values. Labels and mapping are pinned; feature-specific position copy and tradeoff data remain in `ShowVsTellContinuum`. Prose Controller is not a build dependency and does not need to exist for this slice to pass.
- **The frozen craft contract matches.** All five names/subtitles/tradeoff lines, end labels, seven readout rows, four group labels, channel/length/POV options, and defaults match the current sprint. The Evidence peaks for ambiguity and reader work are preserved; there is no added ranking or model-derived score.
- **Budgets and fit arithmetic are accurate.** All 24 `showVsTell*` values match the frozen table. The artifact-body-only formula is `168 + 51 + 134 + 97 + 131 + 4 = 585 ≤ 600`, using UTF-16 length, the declared keys, and the longest Hinge position line. The 4–8 total follows from exactly four groups containing 1–2 variants each.
- **Shape and semantic checks are otherwise well separated.** The exact-key grammar rejects unknown fields, malformed enums, wrong types, blank required values, oversized strings and arrays, and wrong generation versions. Integrity requires ordered complete groups, UUIDv4 workup IDs, exact derived variant/flag IDs, unique channels, shorter trimmed directions, legal flag targets, and unique in-order kept references. Hard-conflict warnings remain passive when they target a declared must-not-change invariant.
- **Persistence widens coherently.** Snapshot, input, and summary unions, create/revise/clone/summarize operations, and the mapped four-phase lifecycle registry all include the new arm. Exhaustive defaults remain. The session-level pipeline validates integrity after hydration normalization before installing live state. Defensive cloning covers nested provenance, POV, invariants, channel arrays, groups, variants, flags, and kept carry modes.
- **Existing writer data is not rewritten.** No schema bump, placeholder migration, or historical normalization is introduced for this unshipped config arm. Existing widget lifecycles remain unchanged. The writer-data codec ADR controls this decision, rather than the older generic alpha/no-compatibility wording in the agent guide.

## Initial-review verification actually run

All local checks target **`c9dbd6dc625bcde2796f0d3bb68324aa0cafd462`**, before this report-only commit. Runtime: **Node v24.19.0 / npm 11.9.0**, clean lockfile installation. CI separately exercises the repository's configured Node 18 environment.

| Check | Result |
| --- | --- |
| `npm ci --cache <writable temporary cache>` | Passed; lockfile unchanged |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm test -- --runInBand` | **273 suites / 3,626 tests / 2 snapshots passed**, 87.845 seconds |
| Full `npm run lint` | **0 errors / 1,086 warnings** |
| Independent full epic-base lint comparison | **0 errors / 1,085 warnings** at `33efaa1b`; exactly one new warning, the `show-vs-tell` registry key under the existing naming rule |
| ESLint over all 23 changed TypeScript files | **0 errors / 4 warnings**, all four the sibling keys in the lifecycle registry; new files clean |
| `npm run build`, including `verify:bundle` | Passed; three webpack asset-size/performance warnings; bundle sentinel check passed |
| `git diff --check` for reviewed delta | Passed |
| Core `vscode` import scan | No production import; only the two existing test/comment string occurrences |
| Independent contract probe suite | **7 tests passed**, including all **1,296** combinations of legal 1/2-per-group cardinalities and kept subsets, exact clone/JSON round trips, count summaries, all positions retaining one workup, UTF-16/astral-text boundary values, forbidden line separators, unknown/missing keys, JSON nulls, and passive flag combinations |
| Independent F-01 regression | **1 expected regression failure**: apostrophe-only duplicate does not throw |
| Independent real-session F-01 reproduction | Duplicate survives config → export → JSON → parse → fresh hydration |
| GitHub CI for reviewed code head | **Success**, [PR run 37925510238](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37925510238) |

The independent probes are review evidence, not additional committed test files. The seven passing probes supplement the shipped suite; they do not make F-01 pass. The author's per-commit and mutation-test claims were not substituted for these independently run checks.

## Boundaries and follow-up questions

1. **No live acceptance is expected at Slice 1.** No Extension Development Host interaction or paid provider call was performed. This review does not reopen the completed Session Recall live-test/key-setup work.
2. **The fit witness is arithmetic at this stage.** There is no artifact projection yet. Slice 4 must pin the same guarantee against its real projection, including any escaping it chooses, and have the UI meter share that projection. The report does not claim today's arithmetic already verifies a nonexistent serializer.
3. **The author's three contract questions remain explicit questions.** Surrounding-context source persistence, multiline directions/invariants, and POV prefill custody on reopen should be reconciled in their owning slices before those behaviors ship. The current persisted-field list and the multiline example do not justify inventing a Slice 1 requirement here. This review does not resolve them on the writer's behalf or change the frozen budgets.
4. **Sparse in-memory arrays were challenged, not inflated into a data-loss finding.** Shared `arrayOf` skips holes at the isolated shape boundary, but the ledger clone makes channel holes explicit `undefined`, and the actual current-state validation rejects them before persistence. JSON inputs cannot contain holes. No new producer or successful write/reopen bypass was established.
5. **Sequential review gates remain.** The writer merges this slice into the epic after the review finding is resolved. Slice 2 starts from the updated epic. The later Slice 3 catalog flip still must not reach `main` before Slice 4 commit wiring lands.

The original report requested a fresh delta review and updated ledger before closing F-01. That re-review is recorded above; the original issue is now addressed. The slice boundaries and future contract questions remain unchanged.
