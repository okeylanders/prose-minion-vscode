# PR #165 review: Lightbox reading tolerance

- **PR:** [#165](https://github.com/okeylanders/prose-minion-vscode/pull/165)
- **Reviewed implementation:** `d255b8e2d4410a7b65d43e0ac08175b812dc9282`
- **Base:** `a57a5cd405bcf643aa41275585056b96ab0b7c42` (`epic/lightbox`, including the reviewed #164 corrections)
- **Review date:** 2026-10-23
- **Disposition:** **Changes requested: four Medium / P2 findings.** This report does not modify implementation.

## Summary

The main tolerance path is substantially implemented: prompt maxima become asks, structural/minimum rules remain, the provider and fit check share the 12,000-token reservation, recovery metadata names the actual group, and completed ordinary-JSON blocks survive a mid-block cutoff. The rebuilt production bundles match the author's hashes. The independent Node 24 full suite passes **488 suites / 6,737 tests / 59 snapshots**, with successful typecheck, lint and build.

However, clipping currently changes evidence before its semantic checks, so it can both discard real evidence and accept an altered quotation. Two truncation boundaries still lose already completed blocks: a partially emitted frame ending, and a partial curly-delimited token. Separately, both exact-head CI events fail because two new assertions require a newer engine's `JSON.parse` error wording than the repository's Node 18 workflow provides.

These are implementation/verification corrections, not objections to the declared “asks, not gates” design. Decisions 37–40 are treated as author-supplied design context, not independently verified writer acceptance. This is not a formal GitHub review, merge instruction, native VS Code verification, live-model evaluation or real-chapter checkpoint.

## Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Safety clipping precedes semantic validation, changing what is verified or withheld | Open |
| F-02 | Medium / P2 | A cutoff inside a closing sentinel or fence discards complete JSON blocks | Open |
| F-03 | Medium / P2 | A partial curly-delimited token prevents salvage of finished siblings | Open |
| F-04 | Medium / P2 | New parser-error assertions fail the configured Node 18 CI | Open |

## F-01 — Validate the original content before making a display-sized version

**Locations:** [`LightboxReadingFields.ts:64–70`](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/packages/core/src/infrastructure/lightbox/LightboxReadingFields.ts#L64-L70), [quote decoding at 97–99](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/packages/core/src/infrastructure/lightbox/LightboxReadingFields.ts#L97-L99), [`LightboxSteeringCodec.ts:219–224`](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/packages/core/src/infrastructure/lightbox/LightboxSteeringCodec.ts#L219-L224), and [`LightboxStoryCodec.ts:148–151`](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/packages/core/src/infrastructure/lightbox/LightboxStoryCodec.ts#L148-L151).

`text` now returns a safety-clipped string with an ellipsis. Quotes and other semantically constrained fields go through it **before** verification, anchoring or phrasing checks. Those checks therefore inspect a different value from the model's original.

Four independent production-code reproductions:

1. **Real quote rejected.** Make a synthetic paragraph longer than 2,400 characters and give a headline that exact paragraph as its only quote. The whole original verifies successfully. The codec counts one clip, inserts an ellipsis, and assembly withholds the headline with `not-in-chapter` / “No quote it gave was found in the paragraph it named.” The safety ceiling has become a rejection gate.
2. **Fabricated tail accepted.** Start with an over-ceiling quote containing a fabricated tail. Let the actual chapter contain only `clipLightboxText(rawQuote, 2400)`, including the ellipsis. The verifier correctly rejects `rawQuote`, but the production codec/assembler accepts the headline because only the altered, clipped version reaches the verifier. The previous hard length gate rejected this input; this is an integrity regression, not merely failure to implement more tolerance.
3. **Real steering example discarded.** A valid narration quote below 2,400 characters holds an otherwise valid `before` phrase longer than 576 characters. The codec clips `before` first. Anchoring then reports that the first part is not a run of whole words of its checked quote, and the example disappears while its note survives.
4. **Valid Spark rejected.** A question longer than 2,400 characters passes `lightboxSparkPhrasingFault` as written. Clipping removes its terminal `?`; the codec then marks it malformed because it does not end as a question.

The unsafe-acceptance case is deliberately synthetic and reproducible without a manuscript. Its exact input generator is:

```ts
const rawQuote = 'A girl was waiting by the window. '
  + 'The wind moved across the silent garden. '.repeat(65)
  + 'Invented ending not in the chapter.';
const paragraph = clipLightboxText(rawQuote, 2400);
```

Use `paragraph` as the sole chapter paragraph and `{ para: 1, quote: rawQuote }` as the headline's evidence. Thus the source really contains the shortened prefix **and its ellipsis**, but does not contain the original long quote. This is not a claim that every fabricated tail is accepted: it isolates the case where the codec's replacement happens to match genuine source text.

**Passing controls:** genuine quotes of 2,399 and 2,400 characters; genuine example prefixes of 575 and 576 characters; missing short and long quotes still withheld; and Bring's separate surface clipping. In the Bring control, a real long quote travels within 240 characters and passes the Workshop attachment codec, but changing its untraveled tail correctly refuses Bring. The Bring implementation already checks its anchors before clipping; the new codec safety clip does not.

**Requested correction:** preserve the original semantic value through quote verification, example anchoring, uniqueness/identity joins and relevant phrasing checks, and only then derive a clipped presentation. Do not repair this by verifying only a shortened prefix: the fabricated-tail control must remain rejected. Keep enough verified anchor information for carry, saved-board reopening and Bring, rather than storing a display ellipsis that later checks mistake for source text. Add the four cases above and retain the threshold and full-anchor controls. The length/count asks should remain asks.

## F-02 — Recognize an interrupted frame ending before passing JSON to salvage

**Location:** [`LightboxReadingFrame.ts:78–91`](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/packages/core/src/infrastructure/lightbox/LightboxReadingFrame.ts#L78-L91), together with its fence handling.

For each public worked example A–G, remove **only the final character of the closing sentinel** and read it with `end: 'ceiling'` (the runner's mapping for `finishReason: 'length'`). Every JSON block has already finished. All seven calls throw `LightboxGroupFrameError` rather than returning the same blocks as the complete response.

The complete closing marker is not found, so the final partial marker remains in `jsonText`. The generic JSON tokenizer correctly refuses its `=` characters, and the entire paid group is quarantined as unreadable. In contrast, removing the closing sentinel **entirely** salvages every block for all seven groups. This makes success depend on the output stopping earlier rather than later.

The same boundary occurs with the newly supported code fences:

- A complete fenced frame followed by only two closing backticks fails the “closing sentinel must be the final line” check.
- Complete JSON inside a fence, followed by two closing backticks and no sentinel yet, reaches the JSON tokenizer with those backticks and fails.

**Passing controls:** wholly absent closing sentinels for A–G; a character-by-character sweep across the remaining group E JSON after its first completed block; ordinary-stop refusal of a partial sentinel; and refusal of arbitrary prose after a completed JSON root.

**Requested correction:** when the provider explicitly reports a length cutoff, separate a recognizable terminal prefix of this group's closing sentinel/fence from the completed JSON before salvage. Keep this frame recognition in the frame owner, retain strict ordinary-stop and arbitrary-suffix rejection, and preserve the raw reply and correct recovery metadata. No unfinished block needs to be trusted to retain the blocks already complete.

## F-03 — Treat an EOF-truncated curly token as incomplete during salvage

**Locations:** [`ModelJsonTokens.ts:96–99`](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/packages/core/src/infrastructure/api/parsers/ModelJsonTokens.ts#L96-L99) and [148–154](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/packages/core/src/infrastructure/api/parsers/ModelJsonTokens.ts#L148-L154).

The tokenizer passes `partialEnd` to `straightString` but not to `curlyString`. The latter always rejects a missing closing curly quote, so tokenization fails before salvage can retain earlier members.

Minimal reproduction:

```text
salvageModelJson('{"version":1,"a":{"x":"complete"},"b":{"y":“unfinish')
```

**Expected:** retain `version` and `a`, drop `b`, report `cutKey: 'b'`. **Actual:** `ModelJsonParseError`, reason `unsafe-curly-quotes` at character 43. Changing only the opening curly quote to a straight quote produces the expected salvage. A cutoff inside a curly-delimited next root key fails the same way; its straight-quoted counterpart succeeds.

The curly token itself does not need to be accepted or completed. The feature already supports complete safe curly-delimited tokens, and the entire cut member is supposed to be withheld. A supported delimiter followed by EOF should not invalidate completed siblings.

**Requested correction:** recognize an incomplete EOF curly token in salvage mode, so the containing member can be dropped. Continue refusing unsafe completed curly strings and keep normal parsing strict. Cover both partial keys and nested values, with straight-string controls and no-content-leak assertions.

## F-04 — Assert the parser failure without pinning a V8-version message

**Locations:** [`LightboxReadingRepair.test.ts:31`](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/packages/core/src/__tests__/infrastructure/lightbox/LightboxReadingRepair.test.ts#L31) and [`ModelJsonRepair.test.ts:40`](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/packages/core/src/__tests__/infrastructure/api/parsers/ModelJsonRepair.test.ts#L40).

Both assertions require `/Unexpected non-whitespace character after JSON/`. The [configured workflow](https://github.com/okeylanders/prose-minion-vscode/blob/d255b8e2d4410a7b65d43e0ac08175b812dc9282/.github/workflows/ci.yml#L18-L32) runs Node 18. The independently inspected job used **Node 18.20.8**, which reports `Unexpected token } in JSON at position 5328` and `... position 95` for these inputs.

Both exact implementation-head events failed: [pull-request run](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39982704774) and [push run](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39982405202). The inspected [test job](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39982704774/job/120513842309) reports **486 suites / 6,735 tests passing, 2 suites / 2 tests failing, 59 snapshots passing**. Typecheck passed; lint and build were skipped after the test failure.

**Requested correction:** assert `SyntaxError` or another engine-independent fact about the unrepaired input, leaving the meaningful repaired-value assertions intact. Do not change the supported runtime just to accommodate an error string. Re-run both CI events on the correction head. The passing independent Node 24 full suite does not make the configured Node 18 gate green, and this wording failure does not itself demonstrate a runtime defect in the repair algorithm.

## Verification and evidence boundaries

| Check | Independent result on `d255b8e` |
| --- | --- |
| Full repository Jest, Node 24.19.0 | **488 suites / 6,737 tests / 59 snapshots pass**, 374.800 s reported by Jest |
| Typecheck | **Pass** |
| Lint | **0 errors / 1,133 warnings**, identical to the retained #164 baseline by relative file, rule and severity |
| Production build and `verify:bundle` | **Pass**, with the existing webpack size warnings |
| Diff whitespace | **Pass** |
| External production-code regressions and host builder | **31 tests: 18 passing controls/builder checks, 13 desired-behavior failures**, 8.193 s; failures are F-01's four cases and F-02's nine frame-ending cases |
| Extra persistence / semantic-shape probes | **6 tests pass**, 2.890 s: both committed fixtures round-trip byte-for-byte; longer nested Opinion/steering fields survive; a suffix-only cited change beyond the former ask changes its basis, makes the Opinion stale and stays stale after save/open; minimum/enum/uniqueness controls pass |
| Direct production-parser curly-cut regressions | **2 passing straight controls / 2 failing curly counterparts**, supporting F-03 |
| Production-host evidence regeneration | **Pass**; log matches exactly, board messages match after normalizing only the recovery filename's random UUID |
| Exact freshly built production webview in JSDOM | **51 checks pass**, including long content, six-quote pinning, extra cards, retained sibling content and the corrected Movements reason |
| Bounded direct-Node parser probes | **12 cases completed**; 11 successful parses/repairs/salvages and one expected refusal witnessing F-03; no stack overflow or runaway observed |
| Exact-head GitHub CI | **Both events fail**, as detailed in F-04 |

The bounded probes use inputs from 24,006 to 380,008 characters, including deep containers, many scalars, a long numeric literal and an escaped string. Individual direct-Node observations ranged from about 1 to 188 ms. They are scoped samples, not a latency guarantee or a replacement for the response-size ceiling. Full Jest and external Jest run in the cloud workspace; their timings are **not direct Node or native VS Code latency**. JSDOM checks exercise the real rebuilt bundle, not browser geometry.

Rebuilt SHA-256 values, both matching the author's evidence:

- `webview.js`: `405f6cd140d856df49e48f46608b20dbe86bbce75c48b84fa3e0db9b327fbf5d`
- `extension.js`: `47c258bb3d9e2b09212a8ccabfff1ac95aedb821eeadfe30a67f6f87d6be8a45`

Heavy test/type/lint/build/performance work was serialized. Dependencies were reused on disk only after verifying the unchanged lockfile hash, with the review worktree's package links corrected. No implementation was edited to make a probe pass. An unavailable timing executable was replaced before running the gates; that setup attempt did not run any checks. The probes are outside the tracked implementation and fail on desired behavior, not compiler/setup errors.

Seven supplied captures were inspected: the five narrow states at 500 px, the template at 1,000 px and salvaged summary at 1,440 px. Longer content and recovery explanations are legible in those samples. These supplied pixels, regenerated host evidence and production DOM checks do **not** establish native VS Code layout, accessibility behavior or a real-chapter checkpoint. No blocked browser route was retried.

Only public-domain *Alice* fixtures and synthetic text were used. No private manuscript, live provider call or paid model call was used. Only this report is intended for publication.

## Contracts retained and scope not promoted into findings

- **Asks versus gates:** extra items and over-ask text are intentionally accepted. Exact collision arity, per-column scores/endings, closed enums, minima, unique lineage/figure/movement identities, three Opinion views, cite-key grammar, and one-example/no-example-on-Earns constraints remain meaningful contracts. F-01 concerns semantic values being changed before those checks, not a request to restore prompt maxima.
- **Parser preservation:** the current repair walk retains scalar content while applying its limited structural edits. Partial Unicode escapes, trailing backslashes, scalar/exponent cutoffs, empty/nested containers and ordinary block boundaries were inspected/probed. Errors retain fixed reasons/positions rather than response prose. Unknown fields still reach the established counted diagnostics and recovery-only details.
- **Guard limit:** the exported `modelJsonContentMatches` compares scalar sequences, not structural isomorphism. It accepts regrouping or an empty-object/empty-array substitution when scalars match. That is its documented contract, and the present repair walk does not perform those changes; it is not reported as a current defect. Any future model-based repair must not mistake this guard alone for proof that grouping is preserved.
- **Duplicate JSON keys:** ordinary `JSON.parse` last-wins behavior remains. Salvaging a later cut duplicate can retain an earlier complete occurrence. The PR does not establish a new duplicate-member rejection policy, so this ambiguity is not promoted to a blocker or described as verified duplicate rejection.
- **Handoffs:** Bring's own clipping happens after whole-anchor checks and retains both example sides; Build clips display fields and still excludes an overlong counted term rather than inventing a shortened term. Those choices are distinct from F-01's earlier codec clipping.
- **Output and cost:** provider output and fit reservation use the same 12,000-token constant; 48,000 response characters is an ask, with refusal beyond 384,000. The estimate still prices typical output rather than the ceiling. Whether to add a ceiling-priced figure, retune typical guesses, restore a generous example-size gate, or improve wording for unreached lenses remains a product choice, not independently accepted writer direction.
- **Persistence and Opinion:** format 1 already accepts longer nested text and list sizes; canonical Opinion bases cover the actual longer content rather than only its rendered digest excerpt. Both original stored fixtures round-trip byte-for-byte in independent probes. Longer nested Opinion/steering fields survive, and a suffix-only changed claim beyond the former 400-character ask changes its basis and keeps the Opinion stale after reopening; the repository's tolerance/freshness guards also pass. The acknowledged #164 N-03 tied-clock recovery debt is not reopened as a new assignment here.

## Correction handoff

Correct F-01 through F-04 without reinstating prompt maximum gates or trusting cut content. Re-run the discriminating boundary/content cases, full repository gates and both configured CI events on the final implementation head. Preserve the existing recovery, quote, steering voice and saved-board contracts. Native/writer validation remains separate.
