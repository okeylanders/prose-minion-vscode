# PR Review — Lightbox Forgiven Fields, Slice 4K

**Author:** okeylanders · **PR:** [#168](https://github.com/okeylanders/prose-minion-vscode/pull/168) (open, unmerged at review)  
**Branches:** `epic/lightbox-forgive-fields` → `epic/lightbox`  
**Reviewed implementation head:** `8f50a2aa86e88bc67a3710b995d70cf40a0510f1`  
**Base and verified merge-base:** `cf7f2607aceeb0fa107306870d35fb4066035b9b`  
**Scope:** 36 files · +1,596 / −262  
**Reviewed:** 2026-10-24 · **Reviewer:** Astra  
**Mode:** independent source/contracts review; deterministic production codec/frame/reply probes; base/head mutation differential; persisted-data controls; fresh full gates

## Summary

**Request changes for one narrow P2 repair-contract gap:** truncation can erase the evidence of a duplicated root key before the new re-nesting safeguard runs. A P3 defensive follow-up concerns a deeply nested ignored value turning an optional repair into a whole-group failure.

The ordinary tolerance paths are sound in the exercised cases. Unknown fields, including prototype-related names, are omitted and counted across A–G/Opinion; the required-field, type, enum, minimum and semantic checks remain. Saved boards and Workshop persistence remain strict. All legal suffix placements exercised preserve decoded content and the scalar guard. The change is host-only; no webview or prompt source changed.

Decision 50 and the reported writer experience are design context, not independently observed native acceptance. This review does not clear the separate Slice 4J integration, authorize a merge or extension publication, or constitute a formal GitHub review.

## Findings and disposition

| ID | Priority | Status | Finding |
| --- | --- | --- | --- |
| F-01 | P2 | Open, blocking | Salvage hides an unfinished duplicate root key from the re-nesting barrier |
| N-01 | P3 | Open, nonblocking | The repair's serialization guard can fail the whole group on a deeply nested ignored field |

## F-01 — Keep the unfinished key's duplicate evidence when deciding whether to re-nest

**Location:** [`LightboxReadingFrame.ts:128–137`](https://github.com/okeylanders/prose-minion-vscode/blob/8f50a2aa86e88bc67a3710b995d70cf40a0510f1/packages/core/src/infrastructure/lightbox/LightboxReadingFrame.ts#L128-L137), calling the duplicate barrier in [`LightboxBlockFormat.ts:96–101`](https://github.com/okeylanders/prose-minion-vscode/blob/8f50a2aa86e88bc67a3710b995d70cf40a0510f1/packages/core/src/infrastructure/lightbox/LightboxBlockFormat.ts#L96-L101).

The contract says a root key written twice disables all movement. `salvageModelJson(..., { rootKeys: true })` intentionally reports **only kept members**. The key of the unfinished member is separately available as `cutKey`, but `salvaged()` passes only the kept keys to `renested()`. If that unfinished key repeats a kept key, the new safeguard sees a unique list and repairs anyway.

Independent production-frame/reply witness, derived from the public-domain group E worked example, with no provider call:

1. Close `summary` before its `friction`, leaving the complete friction immediately after the summary at the root.
2. Append another root `summary`, then cut its value mid-string and mark the response as ending at the output ceiling.
3. The parser reports kept keys `version, template, pressure, artifacts, summary, friction` and `cutKey: summary`.
4. The frame nevertheless logs `misnested-member`, moves the earlier friction, and the decoder accepts **all four blocks with no withheld block**. The reply log says **“cut between blocks”**, even though the parser identified the unfinished summary. Recovery captures the body, but there is no withheld-block recovery notice.

The complete witness is only **5,398 characters**. An escaped second key (`summ\u0061ry`) and an unfinished duplicate `friction` reproduce the movement. Completing the duplicate key's value instead correctly disables movement; an unrelated unfinished root key correctly allows the safe repair. Thus truncation, not legitimate adjacency, bypasses the explicit barrier.

**Scope qualification:** retaining an earlier completed duplicate block when a later copy is truncated is older parser/decoder behavior. This finding is not a claim that every duplicate-salvage behavior was introduced here. The new defect is applying the schema-aware repair despite the raw-text duplicate that explicitly forbids it, thereby reviving this otherwise missing-friction block.

**Requested correction:** account for a complete unfinished `cutKey` when checking duplicates, before any movement. If it duplicates a kept root key, leave the salvaged root un-re-nested. Preserve movement for a distinct unfinished key. Retain plain, escaped, duplicate-loose-field and completed-duplicate controls; keep the correction focused rather than introducing fuzzy matching or speculative regrouping.

## N-01 — Let a failed optional guard leave the root unchanged, not fail the whole reply

**Location:** [`LightboxBlockFormat.ts:121–123`](https://github.com/okeylanders/prose-minion-vscode/blob/8f50a2aa86e88bc67a3710b995d70cf40a0510f1/packages/core/src/infrastructure/lightbox/LightboxBlockFormat.ts#L121-L123).

The new guard calls `JSON.stringify(root)` before entering `modelJsonContentMatches`. A valid but deeply nested value under an otherwise ignored key can exceed the serializer's stack. The exception escapes the repair, so the production reply reader quarantines and fails the **entire group**, including its otherwise valid sibling blocks.

A synthetic unknown array nested 5,000 levels deep, beside the ordinary group E summary/friction slip, produces a **15,396-character** framed reply, well below the unchanged **384,000-character** safety ceiling. `JSON.parse` and the shared tokenizer both succeed; the new guard throws `RangeError`, and the real reply reader returns `failed` with zero tiles. Controls:

- The same unknown subtree with friction already inside its block yields all four blocks and one ignored field.
- On the **identical input**, replacing only re-nesting with a no-op in an isolated in-memory probe preserves template, pressure and artifacts; only the missing-friction summary is withheld. No implementation source was edited.

In this direct cloud Node 24.19.0 process, the observed threshold was depth 4,468 and 14,343 framed characters. That boundary depends on the runtime and call stack; it is **not** a VS Code/native threshold or a latency prediction. The contrived depth makes this a nonblocking robustness issue, not evidence that ordinary model replies fail.

**Suggested correction:** use a stack-safe comparison or treat an unperformable serialization/content check as “do not move,” returning the original root. Never approve a move without its guard, but do not sacrifice unrelated valid blocks because an optional repair cannot be checked. Keep the bounded-size deep-field witness and no-move controls.

## Independent verification

### Decoding and source-order boundaries

- **3,237 base/head differential mutations** across the public-domain worked examples: 1,606 required-field deletion/wrong-type cases and 1,631 same-type enum, blank, minimum, duplicate and range cases. Normalized outcomes match after excluding the intentionally extended decode report. This is exercised coverage, not a proof over every possible semantic input.
- **Every-object unknown fields:** six key variants across the 270 objects in the A–G examples, including `__proto__`, `constructor`, `prototype`, `toString` and `hasOwnProperty`. Each variant is counted once per object, omitted, preserves the clean decoded blocks and causes no prototype pollution.
- **Required presence:** own `undefined`, missing, inherited required fields, custom prototypes and null-prototype objects remain rejected; optional inherited fields are not copied. Nested tally scopes and exception restoration pass.
- **69 legal suffix placements / 184 moved fields** across every lens: clean decoded equality, no source-object mutation and identical scalar sequences. Includes moving an entire block's defined contents from immediately following root members.
- **Conservative controls:** ordinary and escaped complete duplicates, unknown/index-like intervening keys, `version`, arrays instead of blocks, already-held fields including `null`/`false`, special-key gaps, and mismatched key lists cause no unsafe movement. Index-like keys before or after an otherwise valid adjacent pair do not prevent the legitimate repair.
- Production reply probes verify repair-kind/count-only logs and recovery behavior. No paid provider call or private manuscript was used.

### Persisted compatibility

The production `board-v1.json` fixture decodes with zero drops and a byte-identical write roundtrip. Unknown fields at the file, board, source, paragraph, measured headline/sections and group levels still refuse with the host-owned `unknown-field` reason; an unknown tile field drops and counts only that tile, as before. Workshop `exactObject` remains strict for extras and special keys. These controls have the same results on base and head. No persisted schema/version, runner, save-owner or Workshop implementation changed in this PR.

### Full gates and limitations

Fresh local gates ran serially on the exact implementation head, in a cloud workspace under **Node 24.19.0 / npm 11.9.0**. Dependencies were reused only after matching the lockfile byte-for-byte and verifying both workspace links resolve into this checkout.

| Check | Independent result |
| --- | --- |
| `npm run lint` | Pass: 0 errors, 1,133 warnings |
| `npm run typecheck` | Pass: core host, core webview and extension |
| Full Jest, one worker with a disk-backed cache | Pass: **507 suites / 7,074 tests / 59 snapshots**, 375.193 seconds |
| `npm run build` including `verify:bundle` | Pass |
| `git diff --check` | Clean |
| Exact response-size boundary | 384,000 characters repairs/decodes; 384,001 refuses before parsing |

The rebuilt webview SHA-256 is `1fe072462cbcf8f410b8232ec2535a1f166d10cf9fd559e437445da914e6fe15`, identical to the retained prior-base build. The host bundle is `26138b1b547038b89aa3875086b8eb893f4f7069ca1e7ff9dc0bac0fdf3894fc`. Neither paid-call/output-token budgets nor prompt asks changed. This is no native-rendering or responsiveness claim; no new visual behavior was introduced or exercised.

The reviewed implementation head also has green GitHub CI under its Node 18 workflow: [push 40133628306](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40133628306) and [pull_request 40133708085](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40133708085), independently checked before report publication.

Independent regression assertions for the two findings are held outside the implementation checkout; they are not silently added to the PR's passing suite. The focused typed Jest suite has **4 passing controls / 4 failing desired assertions**: three truncated-duplicate variants expose F-01, and the guard-no-throw assertion exposes N-01. These are additional review probes, not failures in the 507-suite repository gate. Direct Node scalar/depth probes and Jest VM assertions are reported separately; neither predicts native extension timing.

Only this review report is authorized for publication. No implementation change, merge, formal review, PR comment, deployment, native VS Code interaction or real provider run was performed. The report commit's exact-head push and pull-request CI are checked separately after publication; a later author change or the actual Slice 4J merge requires review at that new head.

## Author response (2026-10-24)

**F-01 and N-01: fixed**, in the commit after your report's `6f1a52b`,
followed by the commit that adds this response and records the
corrections in the slice notes, the ADR's 2026-10-24 addendum, the agents
guide, the tech debt and the epic. Nothing above this section was edited.

With the new and changed test files copied onto an export of your reviewed
head `8f50a2a`, both suites fail as CI types them (they read the new
`cutInsideKey` and `cutWithin`); with type checking off, **14 of their 70
tests fail there**, each an F-01 or N-01 case, and every control passes
there: the completed duplicate, the cut before the next key began, the
witness's own validity check, the deep field with the friction in its
block, and the parser's cut-inside-a-block cases.

### Resolution ledger

| ID | Priority | Disposition | Fix | Regression tests |
| --- | --- | --- | --- | --- |
| F-01 | P2 | **Fixed** | **The cut member counts against the barrier.** `salvaged()` hands the re-nest the parser's `cutKey` beside the kept keys, and `renestLightboxMembers` checks the two together before any movement: a cut member repeating a kept key moves nothing. **A cut inside a root key** moves nothing either: the parser's salvage now says so (`ModelJsonSalvaged.cutInsideKey`, a structural fact with none of the key's text), since that key is not known and could be a repeat (your witness, cut a few characters earlier). A distinct cut member still allows the repair, and so does a cut before the next key began.<br>**The cut block is withheld as cut.** `decodeBlocks` withholds the lens the parser names as cut with decision 40's reason even when an earlier copy of it stands in the root, so your witness's summary is withheld with "The reply reached the output ceiling before this block finished." and the recovery file's place, as any ceiling cut. A cut member that stood just after a block defining it and lacking it (a friction closed out of the summary, cut mid-string) was that block's last member: the block is withheld as cut too (`cutOff.cutBlock`).<br>**The log says where it stopped:** "cut inside summary"; "cut inside a root member that is not a block" (a loose field: never its key, which may be the model's text); "cut inside a block the call did not ask for"; or "cut between blocks" (`LightboxDecodeReport.cutWithin`). No fuzzy matching, no regrouping beyond the rule. | `LightboxMisnestedMemberEdges.test.ts`:<br>• **Your witness**, a second `summary` cut mid-string, and the same under `summary`: nothing moves, three blocks read, the summary withheld as cut with its recovery notice, one capture, the log "3 blocks finished, cut inside summary", no `misnested-member`<br>• a second loose `friction` cut mid-string: nothing moves, the summary withheld for no friction, the log "cut inside a root member that is not a block"<br>• a cut inside a root key (`,"summ`): nothing moves<br>**Your controls:** a completed duplicate `summary` with the cut later moves nothing; a distinct cut member (`"note"`) and a cut just after a comma still repair, every block read<br>**Added:** a friction closed out of the summary and cut, alone and after a moved run, withholds the summary as cut, logged "cut inside summary"; its control (the summary holding its own friction) reads every block; a cut inside a block the call did not ask for is reported as such<br>`ModelJsonRepair.test.ts`: `cutInsideKey` on the three cuts inside a root key, and none for a cut before a key began or inside a block |
| N-01 | P3 | **Fixed** | **A guard that cannot be checked moves nothing.** The guard (`sameScalars`) catches a failure to write the root out and answers no, so `renestLightboxMembers` returns the root as it came. A move is never made without the guard passing, and no sibling block is lost: your witness now reads template, pressure and artifacts and withholds only the summary that lacks its friction. | `LightboxMisnestedMemberEdges.test.ts`:<br>• **Your deep-field witness** (an ignored array in the template beside the summary/friction slip): the group lands, three blocks read, the summary withheld for no friction, `ignored` 2, nothing captured<br>• **Your no-move control:** the same field with the friction in its block reads all four blocks<br>• the witness's validity: under the 384,000-character ceiling, `JSON.parse` reads it, and writing it out throws<br>• the unit case: the root returned unchanged, `moved` 0 |

**One change to your witness's depth.** At 5,000 levels it is not a
witness under Node 18, which CI runs: measured at the top of a process,
`JSON.stringify` first overflows at 4,174 levels under Node 22.22.0 and at
6,978 under Node 18.20.8. The test nests 20,000 deep (about 45,000
characters framed), which overflows under both and is still far under the
response ceiling; `JSON.parse` reads 60,000 under both.

**On the scope qualification.** Reading an earlier, complete copy of a
block when a later copy was cut was older behavior, as you say. It now
withholds that block as cut, so that the log, the notice and the board
agree on what the parser found. The slice notes put the choice to the
writer: keeping a whole earlier copy is a one-line change.

### Verification at the correction head

| Check | Result |
| --- | --- |
| Full Jest, Node 22.22.0 | **508 suites / 7,090 tests / 59 snapshots, all passing** (was 507 / 7,074 / 59) |
| Full Jest, Node 18.20.8 (`npx -p node@18`, two workers) | **508 / 7,090 / 59, all passing** |
| Lint | **0 errors / 1,133 warnings**, identical per file, rule and severity to `cf7f260` |
| Typecheck | **Pass** |
| `npm ci` into a real `node_modules`, then `npm run build` with `verify:bundle`, twice | **Pass**, the same hashes both times: `webview.js` `1fe072462cbcf8f410b8232ec2535a1f166d10cf9fd559e437445da914e6fe15` (unchanged), `extension.js` `de712cc6a2eb37e8d3b446957005c351b3c3eb7bbdbaebe1857b99aa7ee471d6` |
| `git diff --check` | **Clean** |
| Visual evidence | **Not rerun**: no harness reply is cut off beside a duplicate or holds a deep field, and the webview bundle is unchanged |

Module sizes: `ModelJsonRepair.ts` 480 lines, `LightboxBlockFormat.ts` 171,
`LightboxReadingFrame.ts` 238, `LightboxReadingCodec.ts` 389. No live or
billable call; *Alice* fixtures only.

## Independent re-review — 2026-10-24, Astra

**Reviewed correction head:** `6a8abb4fe7bd41d5b71745a0c495487b4de2137e` (implementation correction `ef65b95a601b982f7497a422c4135b62a22fd9b2`, followed by the author response/docs). Base remains `cf7f2607aceeb0fa107306870d35fb4066035b9b`. The correction delta is 14 files, +504 / −48. The initial review and the author's 51-line response above are preserved verbatim.

**Disposition: F-01 and N-01 independently verified fixed. No open blocking finding remains from this review, and no new required change was identified.** This supersedes the initial request-changes disposition for this exact implementation head. It is not a formal GitHub approval, merge instruction, writer acceptance or combined clearance for the separate Slice 4J / PR #170 branch.

### Finding closure

| ID | Independent disposition | Verified result |
| --- | --- | --- |
| F-01 | **Closed** | The complete unfinished `cutKey` joins the duplicate check, and a cut inside an unknown root key disables movement. Plain and escaped duplicate-block witnesses now keep the three valid siblings, withhold summary as cut, attach its recovery location, capture once and log `cut inside summary`. A duplicate loose friction also prevents movement. Completed-duplicate, distinct-key and before-next-key controls keep their intended behavior. |
| N-01 | **Closed** | A serialization failure is caught inside the scalar guard. Re-nesting returns the original root with `moved: 0`, without mutation. The exact original 5,000-level witness now lands its three valid sibling blocks, withholds only the missing-friction summary and does not quarantine. An independently exercised 20,000-level / 45,396-character witness proves `JSON.stringify` fails while parsing succeeds, yet frozen original root/block identities and sibling readings are preserved. The no-move control retains all four blocks. |

The extra choice to withhold a cut block even when an earlier complete copy exists is conservative and matches the documented “cut block is never trusted” rule. It is a real behavior change beyond the original movement bug, not proof that the writer personally chose between retaining an earlier copy and withholding it. The generic parser remains schema-free; Lightbox owns the block attribution.

### Added cutoff behavior and retained boundaries

- **3,308 independent direct-Node assertions** across duplicate-cut blocks, partial root keys including escapes, member runs, asked/unasked lenses, unknown/index-like gaps, duplicate barriers and distinct-key controls pass. These inspect the production parser, frame and decoder rather than trusting the author's new tests.
- A cut root member is attributed back only to the adjacent block/run that defines and lacks it. Intervening unknown keys and index-like keys remain barriers; already-held fields and unasked-block controls do not falsely withhold requested complete blocks. Direct cut blocks cannot be revived by an earlier copy. Logs classify known cuts in host-owned words and do not expose model-defined keys.
- **Conservative combined fallback:** if a deep ignored value makes a proposed regrouping uncheckable, neither that regrouping nor its inferred `cutBlock` is retained. The affected incomplete summary is still withheld for missing friction, but does not receive the more specific cut-block recovery notice. This is not unsafe acceptance or another whole-group failure; the review does not claim every combined malformed/truncated response gets that notice.
- The **69 legal suffix placements / 184 moved fields**, exact **384,000 / 384,001-character** boundary, all special-key sweeps, and **3,237 base/head mutation comparisons** were rerun successfully. Prototype/own-property controls, tally isolation, byte-identical board-v1 roundtrip and strict saved-board/Workshop unknown-field behavior remain intact.
- The prior eight independent typed regression assertions **all pass unchanged (8/8)**, including the four desired assertions that failed on the initial head. Their witnesses remain outside the implementation checkout. Deep-stack observations are explicitly runtime-dependent: the earlier 5,000-level result was for cloud Node 24, not a Node 18 or native VS Code claim. The larger witness and CI provide separate coverage, not a shared stack-limit estimate.

### Fresh gates at the correction head

All gates ran freshly and serially under **cloud Node 24.19.0 / npm 11.9.0**, after re-verifying the identical lockfile and checkout-local workspace links:

| Check | Independent result |
| --- | --- |
| `npm run lint` | Pass: 0 errors, 1,133 warnings |
| `npm run typecheck` | Pass: host, webview and extension |
| Full Jest, one worker and disk-backed cache | **508 suites / 7,090 tests / 59 snapshots**, all pass; 371.518 seconds |
| `npm run build`, including `verify:bundle` | Pass |
| Retained independent typed regression suite | **8/8 pass** |
| `git diff --check` | Clean |

The host bundle SHA-256 is `de712cc6a2eb37e8d3b446957005c351b3c3eb7bbdbaebe1857b99aa7ee471d6`; the webview remains `1fe072462cbcf8f410b8232ec2535a1f166d10cf9fd559e437445da914e6fe15`, byte-identical to the earlier verified build. The exact correction head also has green Node 18 GitHub [push CI 40138284172](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40138284172) and [pull-request CI 40138287542](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40138287542), independently checked before publication.

No UI, prompt, price/output-token budget, saved-board format or Workshop implementation changed. No visual/native acceptance or real provider call was exercised. Only this append-only re-review is published; no implementation fix, merge, formal review, PR comment or deployment was performed. The report commit's own push and pull-request CI are tracked after publication. Any later source/base change, including actual integration with Slice 4J, remains a separate verification boundary.
