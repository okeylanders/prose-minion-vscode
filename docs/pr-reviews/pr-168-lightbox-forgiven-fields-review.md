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
