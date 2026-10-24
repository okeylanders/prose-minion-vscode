# Slice 4K: Forgive extra fields, and repair a misplaced brace

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) D6 and D7, their **second addendum of 2026-10-24** (unknown fields forgiven, a member closed out of its block moved back), amending the 2026-10-23 addendum, asks versus gates
**Writer decision:** 50 in the [epic table](README.md#writer-decisions-2026-10-19) (49 is Slice 4J's, keep readings until replaced, on its own branch)
**Status:** Built on `epic/lightbox-forgive-fields`, from `epic/lightbox` at `cf7f260` (PR #167 merged). No PR yet.

## Why

On long chapters, mostly with Anthropic Opus models, the writer kept seeing
whole reading groups rejected for one structural slip. The writer's reply
holds manuscript text, so the case is rebuilt here from group E's worked
example (Alice, public domain):

- group E came back with `finishReason: stop`, otherwise well formed;
- near its end the model closed the `summary` block one brace early, before
  that block's `friction`: `…"movements":[…]},"friction":"…"}}`;
- so `friction` landed in the **root**, after `summary`, and the summary had
  no friction;
- one closing brace was stray at the very end, which Slice 4H's
  `stray-closing-bracket` repair already removed;
- the root's member the format does not define then failed the **whole
  group**: "The group E response has 1 field the format does not define".
  All four blocks were lost, though template, pressure and artifacts were
  complete.

Two changes, either of which would have kept three of the four blocks, and
together keep all four.

## 1. Fields the format does not define are ignored (decision 50)

**At every level of a model's reply:** the frame root, a block, an item, and
any object inside one (a quote pair, a gravity term, a template's freshness,
an Opinion cite or view), in groups A–G and the Opinion (F).

- **Counted, never named.** A field's name can be the model's text, copied
  from the chapter or the context, so the rule of PR #149 F-05 holds: the
  count is logged, nothing names it. One line a group, after the repairs:
  `[LightboxReadingRunner] Group E ignored 1 field the format does not
  define` ("fields" past one). The decode report carries it
  (`LightboxDecodeReport.ignored`).
- **Never withheld for.** The decoder never sees an ignored field:
  `replyObject` returns an object holding only the format's fields.
- **What still withholds** is everything else that did:
  - a **missing required field**, by the format's own name, so a misspelled
    field is withheld for the one it stands in for (`"titel"` withholds the
    motif as "motifs.items[0] is missing required field title.");
  - wrong types and values outside a vocabulary;
  - fewer items than a stated minimum;
  - quote verification;
  - the structural rules, among them an Opinion cite being one of its two
    shapes (a tile, with or without one of its quotes, or a measured
    figure; a cite naming both is withheld), and the three views as a
    closed set (a fourth view key is ignored; a missing one still withholds
    the block);
  - a wrong or missing `version`, which still fails the group.
- **Friction first, as before (D7).** A block with no friction is withheld
  before its fields are read, so a misspelled `"frction"` is not counted
  as ignored: nothing in that block was read.

### Where the tolerant mode lives, and who stays strict

| Reader | Mode |
|---|---|
| `LightboxReadingFields.replyObject(value, path, required, optional?)`: every object of a model's reply, in the seven reading codecs (`LightboxReadingCodec`, `LightboxGravityCodec`, `LightboxStoryCodec`, `LightboxCraftCodec`, `LightboxPlotCodec`, `LightboxOpinionCodec`, `LightboxSteeringCodec`) | **Tolerant**: unknown fields ignored and counted |
| The root, in `decodeLightboxGroup` | **Tolerant**, counted with the rest |
| `LightboxBoardSchema` / `LightboxBoardCodec` (saved boards, format 1) | **Strict**, unchanged: our own format, refused as `unknown-field` |
| `persistedValidation.exactObject` (the Workshop's session and widget codecs) | **Strict**, unchanged |

`strictObject` was used only by the reading codecs, so it was replaced, not
loosened in place: it is gone, and its name would now lie. The new
`boundaries.test.ts` case pins it: only those seven codecs read through
`replyObject`; only they and the frame read `LightboxBlockFormat`; the
board schema still refuses `unknown-field`; `exactObject` still refuses an
unknown field.

## 2. A member closed out of its block is moved back (decision 50)

`misnested-member`, in the Lightbox's frame (`LightboxReadingFrame`, through
the new `LightboxBlockFormat`), not in the generic parser: only the Lightbox
knows its blocks.

### The rule

A root member `K` moves into the root member just before it, **where the
text puts it**, only when:
- the format does not define `K` at the root;
- that member is a block (an object under a lens's key) whose format
  defines `K`;
- that block does not hold `K` already.

A run of such members right after one block moves together, in the text's
order: one misplaced brace (a summary closed before both `movements` and
`friction` gets both back). Nothing guesses past a gap: a member after
`version`, after a member the format does not define, or after a block that
holds `K` already or does not define it, stays where it is and is ignored
by part 1. When two blocks could claim `K`, only the one just before it
does: a friction after the palette goes to the palette, never past it to a
gravity block that lacks one too.

### How it is detected: the text's order, not the object's

`JSON.parse` does not keep the text's order in two cases: it lists keys
that look like array indexes first (`"7"`), and it keeps a key written
twice at its first place with its last value. Either could put a block
"just before" a member it never stood beside. So the shared parser now
reports, when asked, the root object's member keys in the order the text
gives them, a repeated key listed each time
(`parseModelJson(text, { rootKeys: true }).rootKeys`, and the same for
`salvageModelJson`, the kept members only). It is a structural fact, with no
schema in it, read from the tokens of the text that parsed (the repaired
text after a repair). The Lightbox walks that order; with a root key
written twice it moves nothing, since where its members stood is not known.
Both cases are tests.

### The content guard, applied

Moving members that stood just after their block to that block's end moves
one closing brace past them: the strings and other scalars, and their
order, are exactly as before. The repair checks it: the root before and
after, written out, must hold the same scalars in the same order
(`modelJsonContentMatches`), or nothing moves. The real case is checked the
same way on the texts: the slipped reply and the clean worked example hold
the same scalars in the same order. The guard compares scalars, not
grouping (PR #165's note), so what may move is held by the rule above and
its tests. **A guard that cannot be checked moves nothing** (PR #168 N-01):
a root holding a value nested too deep to write out makes the guard fail,
not throw, so the frame reads as it came and only a block left without its
member is withheld; the siblings stand.

### One table for the blocks

`LIGHTBOX_BLOCK_FIELDS` names each lens's block fields, friction last, and
every block decoder reads its block through it, so the repair's idea of a
block and the decoder's are one list. A test checks it against every
worked example's blocks, exactly.

### In a reply cut off at the output ceiling

The salvage's finished root members go through the same rule: a headline
closed before its friction is mended while the block the reply was cut
inside is still withheld with `LIGHTBOX_CUT_OFF_REASON`. Since PR #168's
F-01:
- **the member it was cut inside counts against the duplicate barrier.** A
  salvage keeps only finished members, so a cut member repeating a kept
  key (a second `summary`, even under an escaped key, or a second loose
  `friction`) was hidden from the barrier, and the repair moved a member
  anyway. The parser's `cutKey` now joins the kept keys in the check, and
  nothing moves. When the cut fell inside a root key
  (`ModelJsonSalvaged.cutInsideKey`, new), that key is not known, so
  nothing moves either. A distinct cut member still allows the repair;
- **the block it was cut inside is withheld as cut**, with where the paid
  reply was saved, even when an earlier copy of it stands in the root:
  that copy is not the reply's last word on the block;
- **a block whose member the reply was cut inside** (a friction closed out
  of the summary and cut mid-string, standing just after the summary,
  which lacks it) did not finish, and is withheld as cut too
  (`cutOff.cutBlock`);
- **the log says where it stopped**: "cut inside summary"; "cut inside a
  root member that is not a block" (never its key, which may be the
  model's text); "cut inside a block the call did not ask for"; or "cut
  between blocks" (`LightboxDecodeReport.cutWithin`).

### The Opinion's frame

Group F reads through the same frame, so its one block gets the same
repair: an Opinion closed before its friction is read whole.

### A block-to-item equivalent: not built

Moving a member back into an object *inside* a block (a synopsis closed
before its evidence, the Opinion's `blunt` view closed out of `views`)
would need each nested object's source order from the parser and a schema
table for every nested object (today some forty inline key lists), and the
risk of a wrong regroup grows with depth while the guard stays scalar-only.
It is not worth it yet:
- with part 1, such a slip costs at most its part, not the group: items,
  the synopsis, engagement and each Opinion view decode on their own, and
  only a required part (the Opinion's three views, a template's freshness)
  takes its block with it;
- a slip that closes an inner object early *and* keeps the later braces
  pushes the block's remaining members into the root, where this repair
  moves them back; only the inner object's own member is lost.
Build it only if the logs show a group's "ignored" count beside a part
withheld for a missing field of the same object.

## 3. Small things

- **`LightboxReadingCodec`'s recovery diagnostic for root names is gone.**
  The root's unknown fields used to fail the group with their names in the
  recovery file's rejection; nothing fails for them now, so nothing records
  them. `LightboxGroupFrameError`'s comment no longer cites them.
- **Doc comments.** Every codec's header says fields the format does not
  define are ignored, counted and never named; steering's "each exactly
  `{…}`" reads "each holding".
- **Tech debt recorded:** [offer the misnested-member repair to the Workshop
  widgets](../../tech-debt/2026-10-24-widget-misnested-member-repair.md)
  (Low), once each adopts the shared parser ([Medium, from
  4H](../../tech-debt/2026-10-23-widget-model-json-repair-adoption.md), now
  linking to it).

## Implementation notes

- **Modules.** New: `infrastructure/lightbox/LightboxBlockFormat.ts` (the
  block table and `renestLightboxMembers`, 171 lines after PR #168's
  corrections; it joins `LIGHTBOX_MODULES`). Changed: `ModelJsonRepair.ts`
  (480 lines: the `rootKeys` option, and `cutInsideKey` from PR #168) and
  `ModelJsonTokens.ts` (208: `modelJsonRootKeys`),
  still importing nothing outside `@parsers/*`; `LightboxReadingFields`
  (`replyObject`, `tallyLightboxDecode` in place of `countLightboxClips`;
  `strictObject` and `lightboxFieldCount` removed), `LightboxReadingFrame`,
  `LightboxReadingCodec`, `LightboxReadingWire` (`'misnested-member'`,
  `LightboxDecodeReport.ignored`), the six block codecs, and
  `LightboxGroupReply` (the one new log line). Every module stays under 500
  lines; `ModelJsonRepair.ts` is the closest.
- **Not touched**, for Slice 4J's sake: the runner, reading state, saves and
  the webview. The only change outside the decoding layer and the shared
  parser is the log line in `decodeLightboxReply`, beside the clip line.
- **Prompts unchanged.** They still ask for exactly their keys: an ask, not
  a gate. No prompt-budget number moved.
- **No host state changes**, so the visual evidence harnesses were not
  rerun: a reply that decoded before decodes to the same board, and the
  webview bundle is unchanged.

## Tests

New suites:
- `LightboxForgivenFields.test.ts` (26): for each worked example A–G, a
  field the format does not define on **every** object, root to the deepest
  quote, decodes exactly as the clean reply, counted once each (and A–E and
  G draw the same tiles, quotes checked as before); one at the root, in a
  block, in an item and in two kinds of nested object; misspelled required
  fields withheld for the field they stand in for (a friction, a block
  field, an item field, a lens key), the version still failing the group;
  the log line's count, singular and plural, with no name and nothing saved
  for recovery.
- `LightboxMisnestedMember.test.ts` (32): the real case (the shape the
  writer saw, `JSON.parse` refusing it, the stray brace's repair alone
  leaving `friction` in the root; all four E blocks decoding, the summary
  with its friction, through the reply reader with both repairs logged; the
  content guard on the texts and on the root); the same slip in every
  group's last block, A–G, and a brace moved before any block's friction in
  every group; a run of members; nothing moving after a block that already
  holds the field, after one that does not define it, after `version`,
  past a gap, past an index-like key, with a key written twice, or after a
  block that is not an object; two blocks that could claim it; a salvage;
  the block table against every worked example.

After PR #168's review, `LightboxMisnestedMemberEdges.test.ts` (15): the
reviewer's truncated-duplicate witness, plain and under an escaped key, a
cut duplicate friction and a cut inside a root key, each moving nothing,
with the summary withheld as cut and the log saying where; the controls (a
completed duplicate, a distinct cut member, a cut before the next key);
a block whose closed-out member was cut, alone and after a run, and its
control; a cut inside a block the call did not ask for; and the deep-field
guard witness, its no-move control and the unit case.

Changed: `ModelJsonRepair.test.ts` (5 cases for `rootKeys`; after PR #168,
`cutInsideKey` on the three cuts inside a root key and a control), the codec,
repair, frame-ending, runner, craft, story, plot, steering and Opinion
reading suites (each "has 1 field the format does not define" case now
reads the field as ignored, with its count; the runner's quarantined-root
case lands the group instead; plot and Opinion add the misspelled-field and
cite-shape controls), and `boundaries.test.ts` (the module list, and the
strict callers).

## Verification

After `npm ci` into a real `node_modules`:
- **jest:** 507 suites / 7,074 tests / 59 snapshots, all passing (505 /
  7,009 / 59 at `cf7f260`), under Node 22.22.0 and under Node 18.20.8, which
  CI runs. The first Node 18 run shared the machine with other sessions
  (load average about 14) and three tests in suites this slice does not
  touch hit their timeouts (`WorkshopApp.showVsTellPassageIntake`,
  `LightboxModelSelection`, `LightboxOwedBoard`); they passed alone, and a
  full rerun with two workers passed whole. No test asserts the engine's
  wording.
- **lint:** 0 errors / 1,133 warnings, identical per file, rule and severity
  to `cf7f260`. **typecheck** passes.
- **build**, with `verify:bundle`, twice: `webview.js` SHA-256
  `1fe072462cbcf8f410b8232ec2535a1f166d10cf9fd559e437445da914e6fe15`
  (unchanged: no webview code changed) and `extension.js`
  `26138b1b547038b89aa3875086b8eb893f4f7069ca1e7ff9dc0bac0fdf3894fc`, the
  same both times. `git diff --check` is clean.
- **Visual evidence:** not rerun. No harness's host state changes: a reply
  that decoded before decodes to the same board, and none of the evidence
  replies holds a field the format does not define or a misplaced brace.
- No live or billable provider call; public-domain *Alice* fixtures only;
  model ids are placeholders.

**Which tests fail on `cf7f260`.** The 13 new and changed test files (and
the new reply fixture), copied onto an export of `cf7f260`:
- **Typed, as CI runs them:** all 13 suites fail. Nine do not compile,
  since they read `LightboxDecodeReport.ignored`, the parser's `rootKeys`
  or `LightboxBlockFormat`: the forgiven-fields, misnested-member, parser,
  codec, craft, story, plot, steering and Opinion suites. Four fail by
  test: boundaries (3: the strict-callers case, the module list, and the
  Workshop-route guard, which reads the listed new module), the runner (1:
  the reply with prose in its root keys, quarantined there), repair (2) and
  frame ending (2), each for the report's new `ignored`.
- **With type checking off:** 51 of the 380 tests in the 12 suites that
  load fail, among them 24 of the 26 forgiven-fields cases (every group's
  every-object case, the levels, the misspelled fields, the log line; the
  version control and the "nothing to log" control pass there), every
  `rootKeys` case, and each reading suite's rewritten unknown-field case;
  `LightboxMisnestedMember` (32) cannot load, its module being new. Every
  other test in those suites passes there.

**After PR #168's corrections** (F-01 and N-01; see the [author
response](../../../docs/pr-reviews/pr-168-lightbox-forgiven-fields-review.md#author-response-2026-10-24)):
508 suites / 7,090 tests / 59 snapshots, all passing under Node 22.22.0
and Node 18.20.8 (two workers); lint identical to `cf7f260`; typecheck
passes; after `npm ci`, two builds give `webview.js` `1fe07246…`
(unchanged) and `extension.js`
`de712cc6a2eb37e8d3b446957005c351b3c3eb7bbdbaebe1857b99aa7ee471d6` both
times. On an export of the reviewed head `8f50a2a`, the two new and
changed suites fail as CI types them, and untyped 14 of their 70 tests
fail, each an F-01 or N-01 case; every control passes there.

## For the writer to decide

- **Show the count on the board?** An ignored field is only in Output now.
  A group could say "1 field ignored" in its footer, as it says how many
  quotes were checked.
- **The block-to-item repair** (above): not built; the "ignored" count in
  Output will show whether it is needed.
- **A block cut inside, beside an earlier copy of it**, is now withheld as
  cut (PR #168 F-01), not read from the earlier copy, which a reply that
  went on to write the block again had not meant as its last word. If the
  earlier copy should be kept when it is whole, that is a one-line change
  in `decodeBlocks`, at the cost of reading what the reply was replacing.
- **No fuzzy matching.** A misspelled field is withheld for the field it
  stands in for, never guessed (`"frction"` is not taken for `friction`):
  a guess would put the model's text where the format expects something
  else.
