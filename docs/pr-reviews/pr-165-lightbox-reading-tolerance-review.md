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

## Author response (2026-10-23)

**F-01, F-02, F-03 and F-04: fixed.** One commit, `2ebeda4b`, sits on top
of your report's commit `4dcdb2b`, followed by the commit that adds this
response and records the corrections in the slice notes, the ADR's D6/D7
addendum, the agents guide and the epic. Nothing above this section was
edited.

Each reproduction you gave is now a regression test. With the new and
changed test files copied onto an export of your reviewed head `d255b8e`
(type checking off, so each test reports), **29 tests fail there**, and
every control you named passes there:
- `LightboxCheckedWhole` (F-01): your four reproductions, and the
  2,401-character quote (5 of 15);
- `LightboxReadingFrameEnding` (F-02): groups A–G one character short,
  the sweep through the sentinel, and the four fence cases (12 of 25);
- `LightboxReadingRepair` (F-02 through the reply reader, 1 of 18);
- `ModelJsonRepair` (F-03's five curly cases, and five cases of the new
  position helper, which does not exist there; 10 of 49);
- `LightboxSteeringReadings` (the example kept whole, 1 of 72).

F-04 is the Node 18 wording: the corrected suites, and the whole suite,
pass under Node 18.20.8.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | **Fixed** | **Every rule reads the field whole.** `text(value, path)` no longer clips: a quote, a term, a title or name used as a key or counted (a set-aside story, a character's name and aliases), and every field a text rule checks (a spark's question, the Opinion's texts, craft steering's claim, why, nudge and example, a numbers reading's claim, an echo's fields) are read and checked as the model wrote them. Only free prose that no rule reads, fresh, on carry or at Bring (a claim, gist, note, friction, description or reason), goes through the new `prose(value, path, ask)`, which clips at the safety ceiling, after decoding, and counts it.<br>**Quotes are never clipped in the codec.** The verifier holds a quote to the paragraph it names, so its length is bounded by the chapter, and a saved board, a carry and Bring all see the verified text. Bring still clips at the Workshop's bounds, after its anchors are checked whole.<br>**The steering example** is read whole and anchored whole in its note's checked quote; Bring clips the pair to one point afterwards.<br>Clipping was not replaced by verifying a shortened prefix. Your fabricated-tail case stays withheld | `LightboxCheckedWhole.test.ts`:<br>• **Reproduction 1:** a 2,732-character paragraph quoted whole: the headline is drawn with that quote, nothing clipped<br>• **Reproduction 2:** your generator, chapter = `clipLightboxText(rawQuote, 2400)`: the headline is withheld, "No quote it gave was found in the paragraph it named."<br>• **Reproduction 3:** a real narration first part past 576 characters: the example and its note are kept<br>• **Reproduction 4:** a question past 2,400 characters that passes the phrasing rule: drawn whole, still ending in "?"<br>**Your controls:** real quotes of 2,399 and 2,400 characters (and 2,401); first parts of about 575, 576 and 577 characters, cut back to whole words; missing short and long quotes still withheld; a first part not in its quote withheld alone, the note kept; a long non-question still withheld<br>**Added control:** a runaway motif gist is still clipped and counted, and the motif drawn<br>`LightboxSteeringReadings.test.ts`: a second part past eight times its ask is kept whole<br>Bring's own clipping: `LightboxTileHandoff`, `LightboxFieldHandoffClip` and the example-anchor suite, unchanged and passing | `2ebeda4b` |
| F-02 | Medium / P2 | **Fixed** | **The frame owner recognizes a cut ending.** At a length cutoff only (`end: 'ceiling'`), `LightboxReadingFrame` sets aside a last line that is a proper, non-empty start of this group's closing sentinel, or of the closing fence of a fence the reply opened (around the frame, or inside the sentinels), before salvage. The JSON then reads, so every finished block is kept; a reply whose sentinel was written whole reads as complete.<br>A reply that stopped normally gets no such allowance, and any other last line (prose, backticks with no fence opened, another group's sentinel, a sentinel written past its own) is refused as before. The raw reply and its group's recovery contract are saved as they were | `LightboxReadingFrameEnding.test.ts`:<br>• **Your sequence:** groups A–G with the closing sentinel one character short, each reading the same blocks and withheld list as the whole reply<br>• every cut point inside group E's sentinel<br>• **The two fence cases:** a fenced frame cut one and two backticks into its closing fence; JSON fenced inside the sentinels, cut one and two backticks in<br>**Your controls:** no closing sentinel at all for A–G; a partial sentinel and a partial fence on an ordinary stop refused; prose after a finished root refused<br>**Added controls:** backticks with no fence opened, another group's sentinel start, a sentinel with a character past its own, all refused at the ceiling<br>`LightboxReadingRepair.test.ts`: through the reply reader, the sentinel one character short lands every block, logs "cut between blocks", and still saves the raw reply with group E's contract | `2ebeda4b` |
| F-03 | Medium / P2 | **Fixed** | `tokenizeModelJson` passes `partialEnd` to `curlyString`. In a salvage, a curly-quoted token with no closing mark before the end is an incomplete token, like a cut straight string: it runs to the end and holds nothing, so the walk drops the member it stands in and keeps its finished siblings. An incomplete token is never counted as a `curly-quote-delimiters` repair.<br>A completed curly-quoted string is held to the same rule as ever, in a salvage or a parse, and an ordinary parse stays strict: a curly string with no closing mark is still `unsafe-curly-quotes` | `ModelJsonRepair.test.ts`, "a reply cut off inside a curly-quoted token":<br>• **Your reproduction:** `{"version":1,"a":{"x":"complete"},"b":{"y":“unfinish` keeps `version` and `a`, drops `b`, `cutKey: 'b'`<br>• a cut nested key, and a cut next root key (no `cutKey`), each beside its straight-quoted control<br>• a cut curly token holding a straight quote and a line break, which a completed one may not<br>• no content leaks: nothing of the cut token is in the result<br>**Controls:** a completed curly string before the cut still reads and is counted; a completed unsafe one is refused in a salvage and a parse; an unclosed one is refused in a parse | `2ebeda4b` |
| F-04 | Medium / P2 | **Fixed** | Both tests now assert `SyntaxError`, an engine-independent fact; the repaired-value assertions are unchanged.<br>**Production code no longer leans on the wording either.** `parseModelJson` read the position with `/position (\d+)/` anywhere in the message. Newer engines can echo a slice of the reply in their message ("Unexpected token 'x', \"…\" is not valid JSON"), so a number in the reply could have been taken for the position. The new `jsonParseErrorPosition` reads only a position at the message's very end, in Node 18's wording ("… at position 95") and Node 20 and later's ("… at position 95 (line 1 column 96)"), and none otherwise. Only the error's own words use it; no decision depends on it | `ModelJsonRepair.test.ts`: the helper on Node 18's, Node 20+'s, a positionless, an echoing and an empty message; and this engine's position (or none) beside the same refusal<br>`LightboxReadingRepair.test.ts` and `ModelJsonRepair.test.ts` pass under Node 18.20.8, and so does the whole suite | `2ebeda4b` |
| Guard limit | (noted, not promoted) | **Documented** | `modelJsonContentMatches` now says it compares scalar sequences, not structure: regrouping, or an empty object for an empty array, passes it. The deterministic walk never makes such a change; a model-based repair would need a structural check of its own | — | `2ebeda4b` |

### Verification at the correction head

| Check | Result |
| --- | --- |
| Full Jest, Node 22.22.0 | **490 suites / 6,794 tests / 59 snapshots, all passing** (was 488 / 6,737 / 59) |
| Full Jest, Node 18.20.8 (`npx -p node@18`) | **490 suites / 6,794 tests / 59 snapshots, all passing** |
| Lint | **0 errors / 1,133 warnings**, identical per file, rule and severity to a fresh export of `a57a5cd` |
| Typecheck | **Pass** |
| `npm ci` into a real `node_modules`, then `npm run build` with `verify:bundle`, twice | **Pass**, the same hashes both times: `webview.js` `405f6cd140d856df49e48f46608b20dbe86bbce75c48b84fa3e0db9b327fbf5d` (unchanged: no webview code changed), `extension.js` `4730ecf7cc91b6bbd375b1d6daa130274ebf0d01cf8ac169c1209974e5f3638e` |
| `git diff --check` | **Clean** |
| Visual evidence | **Unchanged.** The host builder, rerun at this head, writes the same `log.txt` and the same states but for the recovery file's random id, and the bundle is the one the captures were made from, so nothing was regenerated |

Other sessions' test runs shared this four-core machine (load average up to
about 13). In one Node 22 run and two Node 18 runs under that load, three
wall-clock bounds in suites this slice does not touch ran over (the
passage and being-verb scale cases, the steering-note scale case at 2,021
against 2,000 ms) and one picker suite hit its 5-second test timeouts. Each
passes on its own (the steering case in 253–262 ms under Node 18), and the
full runs in the table, made when the load had dropped, pass whole.

Pushing this head starts both CI events again; their results are not in this response.

### What changes in the PR body's claims

- **Safety ceiling:** it clips only free prose no rule reads (claims,
  gists, notes, frictions, descriptions, reasons). Quotes, terms, keys,
  the steering example and every field a text rule checks are read and
  checked whole, never clipped in the codec.
- **Truncation salvage** also covers a reply cut off inside its closing
  sentinel or the closing fence of a fence it opened, and one cut inside a
  curly-quoted token.
- **Parser sizes:** `ModelJsonRepair.ts` 426 lines, `ModelJsonTokens.ts`
  183. The API adds `jsonParseErrorPosition`.
- **Verification:** 490 suites / 6,794 tests / 59 snapshots; the suite also
  passes under Node 18.20.8; `extension.js` `4730ecf7…` (`webview.js`
  unchanged, `405f6cd1…`).

## Independent re-review (2026-10-23)

- **Reviewed correction head:** `467950d8617bb1af65eecb7a2f78519980be1c66`, comprising implementation fix `2ebeda4b7` and its documentation/author response.
- **Base:** unchanged, `a57a5cd405bcf643aa41275585056b96ab0b7c42`.
- **Current disposition:** **F-01 through F-04 are closed. Changes requested for one new Medium / P2 finding, F-05.** The original report and author response above are preserved as history; this section gives the current independent assessment.

The corrections preserve original semantic values rather than checking clipped substitutes. All retained reproductions now pass, including the fabricated-tail rejection. Partial frame endings and curly-token cutoffs salvage completed siblings without weakening ordinary-stop refusal. Both configured Node 18 CI events are green. A separate robustness regression remains: passing whole semantic text to the existing paragraph-address digit predicate exposes quadratic synchronous work on an admitted, synthetic response.

### Resolution ledger

| ID | Independent disposition | Evidence at the correction head |
| --- | --- | --- |
| F-01 | **Closed** | All four original behavior cases and threshold/missing-quote controls pass. Only two old probe telemetry expectations changed from one clip to zero, because quotes/examples now remain whole. Additional tests preserve long quote/example values through assembly, save/open, normalized carry and bounded Bring; changing an untraveled anchor tail still refuses Bring. Safe and forbidden tails beyond former ceilings reach all four steering fields and all four Opinion text positions, and Spark checks; long common-prefix identity joins remain distinct and exact duplicates still fail. The `prose` call sites were traced to ensure no remaining clipped anchor, key or phrasing field. |
| F-02 | **Closed** | Original A–G partial-sentinel cases, both closing-fence cases, absent-marker controls and the character-boundary sweep pass. Additional composed-fence, CRLF/indentation and cut-curly/frame combinations preserve exact completed roots. Normal stops, inline markers, wrong-group markers, arbitrary suffixes and unopened partial fences still refuse. Recovery remains raw-response based. |
| F-03 | **Closed** | The four retained direct-parser cases now all pass. Additional EOF curly/straight escape, exponent, boolean and nested-container cases preserve completed Unicode, negative zero, empty containers and grouping. Cut content and its synthetic canary do not leak; incomplete curly tokens do not count as completed delimiter repairs. Completed unsafe curly strings and normal parsing remain strict. |
| F-04 | **Closed** | Both assertions now require `SyntaxError`, not a V8 message. Independently inspected correction-head Node **18.20.8** CI logs show **490 suites / 6,794 tests / 59 snapshots passing**, plus successful typecheck, lint and build, for both events. Additional position-extraction/privacy controls pass; the helper accepts terminal engine positions, not a number embedded in echoed input. |

### F-05 — Make the whole-text paragraph-address digit check linear

**Severity: Medium / P2. New; not a reopening of F-01.**

**Locations:** the now-whole steering claim at [`LightboxSteeringCodec.ts:121`](https://github.com/okeylanders/prose-minion-vscode/blob/467950d8617bb1af65eecb7a2f78519980be1c66/packages/core/src/infrastructure/lightbox/LightboxSteeringCodec.ts#L121) reaches the check at [137](https://github.com/okeylanders/prose-minion-vscode/blob/467950d8617bb1af65eecb7a2f78519980be1c66/packages/core/src/infrastructure/lightbox/LightboxSteeringCodec.ts#L137), through [`LightboxSteeringPhrasing.ts:83`](https://github.com/okeylanders/prose-minion-vscode/blob/467950d8617bb1af65eecb7a2f78519980be1c66/packages/core/src/infrastructure/lightbox/LightboxSteeringPhrasing.ts#L83). The shared predicate is [`LightboxReadingFields.ts:42`](https://github.com/okeylanders/prose-minion-vscode/blob/467950d8617bb1af65eecb7a2f78519980be1c66/packages/core/src/infrastructure/lightbox/LightboxReadingFields.ts#L42):

```ts
/(?<!¶\s?\d*)\d/u
```

For `¶` followed by a long digit run, every candidate digit rescans the preceding run to find the paragraph mark, fails the negative lookbehind, and advances only one character. The total work grows quadratically. The regex is not new, but removing the former semantic-field clip newly exposes it to the whole accepted response. Spark and numbers readings share this predicate too.

**Independent reproduction:** frame the following object with the real group G sentinels and call `decodeLightboxGroup(content, { group: 'G', lenses: ['steering'], columnCount: 1, end: 'stop' })`:

```ts
{
  version: 1,
  steering: {
    figures: [{
      stat: 'being-verbs',
      claim: 'A state holds at ¶' + '1'.repeat(n) + '.',
      evidence: [{ para: 1, quote: 'She was waiting.' }],
      notes: []
    }],
    friction: 'One line is thin ground.'
  }
}
```

This is valid framed JSON and a supported decoder shape, not an invalid-input exception or a copied-regex microbenchmark. The source fixture can be the synthetic sentence `She was waiting.`. Completed runs retain the claim, with no malformed item, withheld block or JSON repair. Every complete response below is under the **384,000-character hard acceptance bound**.

**Direct cloud Node 24.19.0 observations, not Jest or native VS Code timings:** each isolated child loads the production modules, warms once with a tiny safe input, then times only the synchronous full-group decoder. The original-head control loads `d255b8e` source without changing the checkout. The ordinary control replaces the paragraph mark/digits with an equal-length letter run.

| Digits `n` | Complete response characters | Original-head digit case | Corrected-head digit case | Corrected-head ordinary control |
| --- | --- | --- | --- | --- |
| 12,000 | 12,247 | 11.08 ms | 48.26 ms | 0.41 ms |
| 24,000 | 24,247 | 11.10 ms | 210.80 ms | 0.25 ms |
| 48,000 | 48,247 | 10.11 ms | 831.04 ms | 0.31 ms |
| 96,000 | 96,247 | 9.88 ms | 3,429.97 ms | 0.45 ms |
| 192,000 | 192,247 | 10.29 ms | Child watchdog stopped the run | 1.00 ms |

The last child synchronously emitted its `decode-start` marker after module loading and warmup, then did not return before the **10-second subprocess watchdog**. That watchdog includes startup, so it is **not** an exact ten-second decoder measurement. The finite 24k/48k/96k observations show approximately four times the work per doubling. There was no concurrent heavy local job.

**Reachability and impact limits:** these are deliberately synthetic runaway paragraph-address strings, not ordinary manuscript paragraph numbers. The provider's actual output ceiling is **12,000 tokens** and the prompt asks for **48,000 characters**; 48,247 characters is just beyond that character ask, and 96,247/192,247 are further beyond it while still inside the hard acceptance envelope. This review does not claim a provider commonly emits these inputs, that every tested string fits the token ceiling, or that native VS Code takes the measured cloud times. It establishes a newly expensive synchronous path for responses the application boundary admits. During that decode the host cannot yield or service cancellation.

**Requested correction:** replace the variable-length lookbehind with a bounded, linear scan over digit runs/paragraph-address spans, preserving the existing rule and checking the complete original text. Do **not** restore semantic clipping or verify only a shortened prefix; F-01's protections must stay. Add long paragraph-address and ordinary/bare-digit controls through the real decoder, with deterministic work accounting where practical and a generous isolated performance bound rather than a fragile CI wall-clock assertion.

### Fresh verification at `467950d86`

| Check | Independent result |
| --- | --- |
| Full repository Jest, cloud Node 24.19.0 | **490 suites / 6,794 tests / 59 snapshots pass**, Jest 309.845 s |
| Typecheck | **Pass**, shell 24.066 s |
| Lint | **0 errors / 1,133 warnings**; exact per-file/rule/severity counts unchanged from the retained review baseline, no additions/removals |
| Build including `verify:bundle` | **Pass**, shell 50.055 s; existing webpack size warnings |
| Retained external regressions, persistence controls and host builder | **37 tests pass**, Jest 7.290 s |
| Additional independent semantic and parser/frame boundary controls | **48 tests pass**, Jest 4.873 s |
| Retained direct curly regressions | **4 pass**, including both formerly failing curly cases |
| Bounded direct-Node parser samples | **12/12 succeed**, including the former curly-EOF refusal; 24,006–380,008 characters, approximately 0.8–227 ms in these samples |
| Regenerated host evidence | Log byte-identical; states identical after normalizing only recovery UUIDs |
| Exact rebuilt production webview in JSDOM | **51 checks pass** against freshly regenerated host states |
| Whitespace and scope | `git diff --check` passes; no implementation edits |
| Correction-head configured CI | Both events **success**, including tests, typecheck, lint and build |

Correction-head CI: [pull-request run 39994420926](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39994420926), [push run 39994414532](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39994414532). Their independently inspected Node 18.20.8 test logs report 189.273 s and 242.748 s respectively. These CI/Jest durations are separate execution contexts from F-05's direct-Node measurements.

Rebuilt SHA-256 values match the author's correction evidence:

- `webview.js`: `405f6cd140d856df49e48f46608b20dbe86bbce75c48b84fa3e0db9b327fbf5d` (unchanged).
- `extension.js`: `4730ecf7cc91b6bbd375b1d6daa130274ebf0d01cf8ac169c1209974e5f3638e`.

All heavy work was serialized. The lockfile is unchanged and disk-backed dependencies retain this worktree's package links. Only public/synthetic fixtures were used; no live or paid provider call, private manuscript, implementation change, formal GitHub review, merge or publication of the extension occurred. The unchanged production webview and regenerated host evidence support the prior scoped pixel inspection, not a new native layout/accessibility checkpoint. Decisions 37–40 remain author design context, not independently verified writer acceptance. The existing #164 tied-clock debt, typical-output price estimate and future structural requirements for any model-based repair remain separate from this correction review.

The remaining correction is **F-05 only**. Keep the now-passing F-01–F-04 contracts and rerun full gates and both exact-head CI events after changing the digit predicate.

## Author response to the re-review (2026-10-23)

**F-05: fixed.** One commit, `decd276d`, sits on top of your re-review's
commit `711aa7f`, followed by the commit that adds this response and
records the fix in the slice notes, the agents guide and the epic. F-01
to F-04 are untouched. Nothing above this section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-05 | Medium / P2 | **Fixed** | **One pass, the rule kept exactly.** `LIGHTBOX_BARE_DIGIT` (`/(?<!¶\s?\d*)\d/u`) is gone. `lightboxHasBareDigit(text)` walks the whole original text once. Every digit of a run shares the run's start, so the run is judged once, at its start: it is an address when the character before it is `¶`, or is one whitespace character (tested with `/^\s$/u`, the pattern's own `\s`) with `¶` before that. Any other ASCII digit is bare, and the scan stops at the first one. Non-ASCII digits are not digits to the rule, as they were not to `\d`. Each character is read at most once.<br>**Nothing is clipped or checked by prefix.** The steering claim, why, nudge and example, a spark's question and a numbers reading's claim reach it whole, as F-01 requires.<br>**Callers:** `LightboxSteeringPhrasing`, `LightboxSparkPhrasing` and the numbers reading in `LightboxCraftCodec` | `LightboxBareDigitScan.test.ts`:<br>• **Your reproduction:** your group G object with a 200,000-digit paragraph address, through `decodeLightboxGroup` with `end: 'stop'`: the claim is kept whole, with no malformed item, withheld block or repair, in a 200,247-character response. It takes about 10 ms here; at `467950d` the same test took **15.4 s**<br>• **Linearity, counted, not timed:** the scan's own step count is at most the text's length, and 8× the digits is under 8.1× the steps (24,000 against 192,000); it stops at the first bare digit<br>• **The rule pinned to the old pattern:** 19 edge cases (no digit, a bare digit, an opening digit, `¶12`, `¶ 12`, a no-break space, an em space and a line break after `¶`, two spaces, a letter between, a second run, a second address, a range, a comma, an Arabic-Indic digit, a trailing `¶`, an empty text, a 50,000-digit address, a bare digit after it), and 20,000 seeded random texts, all agreeing with `/(?<!¶\s?\d*)\d/u`<br>**Controls:** a claim stating a bare number is still withheld with steering's figure reason, and `¶ 1` is kept | `decd276d` |

### The other patterns checked

I measured every regular expression the Lightbox codecs, frame, parser
and text rules run on model text: adversarial inputs at 24,000 and 96,000
characters, in Node 22.

**Super-linear on model text, fixed in the same commit:**
- **A spark's closing marks**, `/[\s"'“”‘’)\]}*_]+$/u` in
  `LightboxSparkPhrasing`. An engine tries this from every start in a long
  run of marks before the end: 757 ms at 24,000 and 12.8 s at 96,000. They
  are now read back from the end one character at a time. Tests pin the
  result to the old pattern on eight edge cases and 20,000 seeded endings.
  A spark question with 200,000 spaces inside reads as a question in about
  5 ms; at `467950d` it took **35.9 s**.

**Super-linear on the chapter, not model text, fixed as well:**
- **A chapter line's trailing spaces**, `line.replace(/\s+$/, '')` in
  `LightboxSections` (6.7 s on a 96,000-space run inside a line). It is
  now `line.trimEnd()`, which removes exactly the same characters; a test
  checks every whitespace character. The Sections lane's output is
  unchanged, so no rule id moves.

**Linear, unchanged (the ratio from 24k to 96k in brackets):**
- the steering rules' `WORD`, `/[\p{L}]+(?:'[\p{L}]+)*/gu`: its repetition
  needs an apostrophe each time (2.2);
- spark and Opinion `CLAUSE_BREAK`, `/[.!?;:]+|\s[-–—]+\s|[–—]+/u`, on a
  space then a dash run and on spaced dashes (2.5, 1.5);
- `LEADING_MARKS`, anchored at the start (1.8), and `split(/\s+/u)` (1.4);
- `LIKELIHOOD` and the Opinion's `PERCENT`, `/%|\bper\s?cent\b/i` (1.8);
- the numbers `DIRECTIVE` word alternation, and the Opinion's
  `OBSERVATION_IDS`, `/\b(?:O[1-9]\d?)\b/gu` (2.2);
- the Opinion's figures, `/\d+(?:,\d{3})*(?:\.\d+)?/g`: its repetition
  needs a comma each time (1.8 to 6.1 across three inputs, 5.4 ms at most
  at 96,000);
- the quote verifier's `SEGMENT`, `/\P{M}\p{M}*|\p{M}+/gu` (2.7), and its
  `indexOf` search: a 96,000-character quote of repeated letters against a
  paragraph twice as long, growing linearly to 192,000 (1.0, 1.6 ms);
- the frame's and parser's `OPENING_FENCE` (anchored, 1.6), and the
  parser's `PARTIAL_SCALAR`, which is sticky, so it is tried at one
  position only;
- the clip's word boundary, `/\s\S*$/u`: each start reads only up to the
  next space (2.6);
- the word scans (`holdsPhrase`, `holdsWord`), which step from one
  `indexOf` hit to the next: `"cut'a "` repeated (2.3).

No other lookbehind runs on model text. The only others in the measured
code are `beingVerbs`' fixed-width ones, which run on the chapter.

Outside the Lightbox, `workshopTranscriptExport`'s stem, `/^-+|-+$/g`,
has the unanchored-end shape, but it runs on a session title already cut
to the stem's length bound, with every run of other characters collapsed
to one hyphen first, so it is bounded; left alone.

### Verification at the F-05 head

| Check | Result |
| --- | --- |
| Full Jest, Node 22.22.0 | **491 suites / 6,829 tests / 59 snapshots, all passing** (was 490 / 6,794 / 59) |
| Full Jest, Node 18.20.8 | **491 suites / 6,829 tests / 59 snapshots, all passing** |
| `LightboxBareDigitScan` on an export of `467950d` | **22 of 35 fail.** The scan's 22 cases need the new function. The decoder and spark cases pass there, but take 15.4 s and 35.9 s; here they take about 10 ms and 5 ms. Per your request, those are not wall-clock assertions |
| Lint | **0 errors / 1,133 warnings**, identical per file, rule and severity to a fresh export of `a57a5cd` |
| Typecheck | **Pass** |
| `npm ci` into a real `node_modules`, then `npm run build` with `verify:bundle`, twice | **Pass**, the same hashes both times: `webview.js` `405f6cd140d856df49e48f46608b20dbe86bbce75c48b84fa3e0db9b327fbf5d` (unchanged), `extension.js` `1da47dcf24fb145d4773d4b8428eac235ec35cee7369951edf8cdfe32a0fd402` |
| `git diff --check` | **Clean** |
| Visual evidence | **Unchanged.** Rerun at this head, the host builder writes the same `log.txt` and the same states but for the recovery file's random id, and `webview.js` is the bundle the captures were made from |
