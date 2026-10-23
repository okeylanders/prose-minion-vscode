# Slice 4H: Reading tolerance

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) D6 and D7, and their **addendum of 2026-10-23, asks versus gates**
**Writer decisions:** 37–40 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Built on `epic/lightbox-reading-tolerance`, from `epic/lightbox` at `a57a5cd` (PR #164 merged). PR to come.

## Why

On long chapters the writer saw blocks withheld often, for two reasons
that had nothing to do with what the readings said:

1. **A field one character over its bound withheld its whole block.** The
   real message: "The template block broke the format:
   template.freshness.note must be a string of at most 120 characters". The
   prompt asked for at most 120 characters and the codec rejected 121, with
   no margin; models cannot count characters precisely.
2. **A small JSON fault failed a whole paid group.** Group E came back with
   `finishReason: "stop"` and well-formed content, except that its last
   block closed with `}}}` where `}}` belonged. `JSON.parse` failed
   ("Unexpected non-whitespace character after JSON") at character 6,417
   of about 6,420, all four lenses failed, and the paid reply went to the
   recovery folder. The writer's reply holds manuscript text, so the case
   is rebuilt here from group E's worked example (Alice, public domain).

## 1. Asks, not gates (decision 37)

**The writer: "If the model returns more then just show it."**

### The asks, raised

| `PROMPT_BUDGETS.lightbox` | Fields | Was | Now |
|---|---|---|---|
| `noteCharacters` | gists, traits, notes, reasons, the headline sentence, the reader promise, a peak's note | 120 | **160** |
| `labelCharacters` | titles, names, genres, archetypes, terms | 60 | **80** |
| `claimCharacters` | claims, descriptions, the synopsis | 320 | **400** |
| `frictionCharacters` | every lens's friction | 280 | **360** |
| `sparkCharacters` | a spark's question | 240 | **300** |
| `quoteCharacters` | every quote | 240 | **300** |
| `synopsisSentences` | the synopsis (its characters are `claimCharacters`) | 4 | **5** |
| `opinionObservationCharacters` | an observation | 200 | **260** |
| `opinionHeadlineCharacters` | a view's headline | 120 | **160** |
| `opinionBodyCharacters` | a view's body | 320 | **400** |
| `opinionWhyCharacters` | a Why point | 120 | **160** |
| `steeringWhyCharacters` | a note's why | 160 | **200** |
| `steeringNudgeCharacters` | a note's nudge | 120 | **160** |
| `steeringExampleCharacters` | each side of the one example | 56 | **72** |

Every prompt states the new numbers, and
`lightboxPromptBudgetsSync.test.ts` still pins each prompt phrase to its
ask; a new case there checks that no prompt states the safety ceiling. The
example's word asks (8 and 6 words) and the item counts (4 motifs, 3 quotes
a claim, and so on) are unchanged as asks: only what happens past them
changed. Inputs the host builds (the Opinion's digest bounds, the ribbon's
columns) are not asks and did not change.

### What still withholds, and every maximum classed

A field longer than its ask, and a list longer than asked, are read and
drawn, in groups A–G: no block, item or field is withheld for a length or a
count. What still withholds is a real fault: a missing required field, a
wrong type, a value outside its vocabulary, fewer items than a stated
minimum, a quote the verifier cannot find, an unknown key (counted, never
named, as before), or a structural rule. Each maximum the codecs held,
decided:

| Maximum | Where | Class | Why |
|---|---|---|---|
| Every character bound above, every label, term, quote | all codecs | **Overrun: shown** | an ask; one safety ceiling clips runaway free prose only, never a quote, term, key, example or field a text rule reads (PR #165 F-01) |
| Quotes per claim (3), terms per claim (5) | `LightboxReadingFields` | **Overrun** | minimums stay (1 quote; 2 for a motif; 2 for a synopsis) |
| Motifs (4), characters (6), aliases (3), genre neighbours (5), peaks (3) | `LightboxReadingCodec` | **Overrun** | minimums stay (2 neighbours with a near miss; 1 peak) |
| Gravity fields (5), terms a field (8), collisions (3), literal set-asides (4), clusters (4), cluster words (6), swatches (6), swatch words (3) | `LightboxGravityCodec` | **Overrun** | minimums stay (1 set-aside, 1 term, 2 cluster words, 1 swatch word) |
| A collision's two fields | `LightboxGravityCodec` | **Structural** | two fields meet; exactly two |
| Lineage stories (4), set-asides (3), subtext pairs (4), context quotes (2), sparks (4) | `LightboxStoryCodec` | **Overrun** | |
| A story's stances (1–3) | `LightboxStoryCodec` | **Structural** | each of three stances at most once; a fourth can only repeat one |
| Beats (40), signature (4), familiar (6), air-locks (3), echoes (3), handoffs (3) | `LightboxCraftCodec` | **Overrun** | |
| Numbers readings (3) | `LightboxCraftCodec` | **Structural, by figure** | at most one per figure the lens reads, so a repeat is withheld by its title; the list's length no longer withholds the block |
| Tension scores, rhythm endings | codec | **Structural** | exactly one per ribbon column |
| Template beats (6), threads (6), escalations (3), objects (8), arc steps (5), movements (8), engagement entries | `LightboxPlotCodec` | **Overrun** | movements still tile the chapter (a set rule in `LightboxPlotGates`); engagement still gives one entry per drawn movement |
| Synopsis sentences (4 → 5), synopsis quotes (3) | `LightboxPlotCodec` | **Overrun** | at least two quotes, found |
| A movement id (1–12 characters) | `LightboxPlotCodec` | **Structural** | a key's grammar |
| Observations (6), cites (3), Why points (4), observation ids in a point (3) | `LightboxOpinionCodec` | **Overrun** | at least two observations, one cite, one point; the id grammar widened from `O1`–`O6` to `O1`–`O99` (`LIGHTBOX_OPINION_OBSERVATION_ID`, shared with the text rules and the webview) |
| The three views | `LightboxOpinionCodec` | **Structural** | a closed set |
| A cite's key (120 characters, no space) | `LightboxOpinionCodec` | **Structural** | the host never mints a longer key |
| Steering figures (3) | `LightboxSteeringCodec` | **Structural, by figure** | each figure at most once, a repeat withheld by its label; the list's length no longer withholds the block |
| Steering notes (4) | `LightboxSteeringCodec` | **Overrun** | |
| The example's words (8, 6) and characters (56 → 72), as written and as the chapter has it | codec and `LightboxSteeringTiles` | **Overrun** | shown on the board; Bring clips the pair to one Workshop point. The faults `beforeLong`, `afterLong`, `anchoredLong` and `anchoredFit` are gone |
| One example per note; none on a note that earns | `LightboxSteeringCodec` | **Structural (the writer's fence, decision 23)** | the one place the model supplies the writer's words; more than one stays withheld |
| An example that shows no change; an anchor outside the quote; one in dialogue or taking in speech | codec and tiles | **Structural** | content rules, unchanged |
| The whole response (32,000 → 48,000) | `LightboxReadingFrame` | **Overrun** | refused only past the safety ceiling |

**Text rules are not lengths:** the Opinion's and steering's word lists, a
spark's question mark, a numbers reading's digits, an echo's percentage,
all still withhold, unchanged.

### The safety ceiling

**Chosen: eight times each field's ask** (`safetyMultiple: 8` in
`PROMPT_BUDGETS.lightbox`, never stated in a prompt), **for free prose
only**. A claim, gist, note, friction, description or reason past it is
clipped there with an ellipsis (`clipLightboxText`, at a word boundary when
one is near), counted while the group decodes, and logged as
`[LightboxReadingRunner] Group E clipped 1 field at the safety ceiling`;
nothing is withheld.

**Every field a rule reads is read whole** (PR #165 F-01). The codec reads
those with `text`, and only free prose with `prose`, which clips: a quote
(the verifier holds it to the paragraph it names, so it needs no
ceiling), a term the counter counts, a title or name used as a key or
counted (a set-aside story, a character's name and aliases), a steering
example (anchored whole in its note's quote), and every field a text rule
checks: a spark's question, the Opinion's texts, craft steering's claim,
why, nudge and example, a numbers reading's claim, an echo's fields. The
review showed what clipping first did: a real quote past the ceiling was
withheld; a quote with an invented tail passed when the chapter held its
clipped start, ellipsis and all; a real long example was discarded; and a
long spark lost its question mark and was withheld. Each is now a test
(`LightboxCheckedWhole.test.ts`), with the threshold controls. A whole response is refused only past eight times the
characters its prompt asks for (384,000), which the 12,000-token output
ceiling cannot reach in practice. A list has no ceiling of its own: the
output ceiling bounds how many items a reply can hold. One mechanism, one
number, for layout and file size and nothing else.

### Surfaces with real limits clip there

`WORKSHOP_LIGHTBOX_TILE_LIMITS` (title 120, claim 320, point 120, quote
240, 3 points, 4 quotes) are the Workshop's own and do not change. Bring now
clips to them with an ellipsis instead of withholding:
- a title, a claim and every point (`LightboxTileHandoff`,
  `LightboxOpinionHandoff`);
- **quotes**, as the last step: every anchor is checked whole first (a
  pair's said line leads, a thread's plant and resolution, a synopsis's two
  quotes, a movement's boundary, a handoff's two sentences, a steering
  example in its note's quote), then each quote longer than 240 characters
  travels as the chapter's own start and an ellipsis. The refusals that said
  "Nothing was cut" for a said line or a handoff sentence too long to travel
  are gone, since both now travel;
- **the steering example**: a pair longer than one point is clipped side by
  side, the first part to half the room and the second to the rest, so both
  sides of the arrow show (`lightboxSteeringExamplePoint`);
- **the Build lens seed** clips a field's name and metaphor; a counted term
  too long for the seed is still left out, since a cut term is not the
  chapter's word.

### Saved boards and the webview

The saved-board codec (format 1, not yet shipped) bounds no reading's text
and no list's length, so it already reads the longer fields and the extra
items: `LightboxBoardTolerance.test.ts` saves a board whose every tile runs
to the safety ceiling and whose groups hold twice the tiles, and reads it
back whole, byte for byte; `board-v1.json` and `board-v1-named.json` still
read and write back byte for byte. The webview needed no change for the
longer text: the visual evidence below found no horizontal overflow, no
clipped button and no reading text cut by its box, at 1440, 1000 and 500 px.

## 2. The output ceiling (decision 38)

`groupOutputTokens` 8,000 → **12,000**, and `groupResponseCharacters`
32,000 → **48,000**, keeping four characters a token (a test pins the
ratio). Groups F and G share these ceilings: there are no others. The fit
check reserves 12,000 for each reply, so the "too large" reason says
"reserve 12,000 for the reply", and a model with a small window fits about
4,000 fewer tokens of chapter. **The price does not move:** the estimate
prices what a reply typically runs to (`LIGHTBOX_TYPICAL_OUTPUT_TOKENS`,
guesses until Slice 6 measures them), not the ceiling, so there is no
ceiling-priced "up to" figure for it to follow; the only "up to" in the
estimate is the Opinion's digest bound, which is unchanged.

## 3. A deterministic JSON repair before rejecting (decision 39)

### Where it lives: a shared parser (the writer's addendum)

The repair is not Lightbox code. It is
`packages/core/src/infrastructure/api/parsers/ModelJsonRepair.ts` (the
`@parsers/*` alias), with its tokenizer and the guard's comparison in
`ModelJsonTokens.ts` beside it. Neither imports anything outside
`@parsers/*`: a new `boundaries.test.ts` case fails if a module there
imports anything else or runs past 500 lines, and checks the Lightbox's
frame reads through it.

- `parseModelJson(jsonText, { closeMissingBrackets? })` is `JSON.parse`
  first; when that refuses, the structure-only repair. It returns
  `{ value, repairs }`, `repairs` empty when the text parsed as it stood.
- `salvageModelJson(jsonText)` reads a reply cut off at its ceiling (§4).
- Both throw `ModelJsonParseError`, which carries only `JSON.parse`'s
  position and a closed `refusal` (`{ reason, at? }`, in host words through
  `describeModelJsonRefusal`): never a slice of the reply.
- `modelJsonContentMatches(original, repaired)` is the content guard, on
  its own.

**Sentinels stay with each caller**, whose protocols differ: the
Lightbox's frame (`LightboxReadingFrame`, split from the codec) keeps its
sentinels, a fence around the whole frame, and the missing closing
sentinel. This slice wires only the Lightbox: groups A–E and G, and the
Opinion's reply, which reads through the same frame. The four Workshop
widget call sites (Gesture Playground's menu, Lexical Gravity's preview and
lens, Creative Variations, Show vs. Tell) adopt it later
([tech debt](../../tech-debt/2026-10-23-widget-model-json-repair-adoption.md)).

### What it repairs

| Kind | Fault | Note |
|---|---|---|
| `stray-closing-bracket` | brackets after a complete top-level value | **the real case**, rebuilt from group E's worked example |
| `trailing-comma` | a comma before `}` or `]` | |
| `code-fence` | ` ```json ` … ` ``` ` around the JSON (the parser), or around the whole frame (the Lightbox's frame) | |
| `missing-closing-bracket` | brackets missing at the end | only when the caller says the reply stopped with its frame closed (the Lightbox: its closing sentinel is there); a reply ending inside a member is refused, since closing it would orphan a key |
| `curly-quote-delimiters` | `“…”` used as a string's delimiters | only where a token starts, and only when nothing between is a quotation mark (straight or curly), a backslash or a line break; a curly quote inside a string is the chapter's punctuation and is never touched |
| `missing-closing-sentinel` | the Lightbox's closing sentinel absent | accepted when the reply stopped normally and its JSON is complete as it stands; no bracket is added then |

Refused, as before: a mismatched bracket, more JSON after the root, a doubled
comma, a bare word, an unterminated string, a stray straight quote inside a
string, and anything the guard catches.

### The content guard

Both texts are tokenized on their own, and the sequence of string literals
and other scalars (numbers, `true`, `false`, `null`) must be identical, kind
and value. Brackets, commas, whitespace, fences and string delimiters may
differ; a changed, added, dropped, retyped or reordered value refuses the
repair, and the reply is rejected and saved to recovery as today. The walk
only ever drops a stray closer or a trailing comma, appends closers, or
rewrites a curly string's delimiters, so the guard is a second, independent
check of that.

### Library or in-house: in-house

`jsonrepair` (MIT, actively kept) covers far more than we need, and much of
it changes content: it quotes unquoted keys, turns single quotes and Python
constants into JSON, concatenates strings, and comments out text. The guard
would refuse those anyway, so most of the library would be dead weight in
the bundle, a new dependency to audit and pin, and a second grammar to
reason about beside the guard. The five repairs we need are a tokenizer and
a bracket walk, about 300 lines with the guard and the salvage, all tested
here. AGENTS.md asks for a clear payoff before a new dependency; there was
none.

### Logging

Each repair is logged by its kind, once a group:
`[LightboxReadingRunner] Group E repaired: stray-closing-bracket`. No text.
Why a repair was refused goes only into the recovery file's rejection, as
`A structural repair was refused: <reason> at character <n>.`

### Tier 2: a follow-up, not built

A small model asked to repair the syntax is not in this slice. Build it only
if the logs show rejections this deterministic pass cannot read, and keep
the content guard over whatever it returns.

## 4. A reply cut off at the output ceiling (decision 40)

`finishReason === 'length'` no longer fails the group:
- the frame is read without its closing sentinel, and `salvageModelJson`
  keeps the root's members that finished, drops the one it was cut inside
  (however much of it arrived: never trusted) and closes the root;
- **the cut block** is withheld with the host's reason, "The reply reached
  the output ceiling before this block finished.", followed by where the
  paid reply was saved;
- **lenses it never reached** are reported as any missing lens is ("The
  reading returned no spark block."); a reply cut inside the next key, before
  it arrived whole, names no cut block;
- **the content guard** holds: the repaired text's scalars must be exactly
  the original's up to the cut member; only `}` is added;
- **the paid body is still saved** for recovery, with the group's own
  contract, but without the "could not use" warning, since the reply was
  read. The log says which block it was cut inside:
  `[LightboxReadingRunner] Group C reached the output ceiling: 1 blocks
  finished, cut inside lineage`;
- **group F** reads the same way: its one block cut withholds the Opinion;
- **the ribbon's Movements lane** said "The movements were withheld: they
  did not tile the chapter." whenever no movements were drawn. With the
  summary block withheld, by a cut-off or a format fault, that named the
  wrong cause: it now says "The movements were withheld: Summary &
  movements says why." (`lightboxPlot.ts`), and keeps the tiling words for
  a tiling fault. This is the slice's one webview change;
- a reply that cannot be salvaged (prose where JSON belongs, no root object)
  fails as before, its message naming the ceiling: "the reply reached the
  12,000-token output ceiling, and what came back could not be read".

## 5. Small fixes

- **Recovery metadata.** Every Lightbox recovery file's `contract.protocol`
  now names its own group's sentinels and block keys
  (`lightboxRecoveryContract`), where it used to say
  `===LIGHTBOX_GROUP_<A|B|C>_V1===` and group A's lenses for every group. A
  capture may name its own contract
  (`RejectedModelResponse.contract`); the tool's default is now generic.
- **Tech debt recorded:** PR #164's
  [N-03](../../tech-debt/2026-10-23-lightbox-board-claims-equal-millisecond.md)
  (equal-millisecond claims, Low); [repairing and reading a reply already in
  the recovery folder](../../tech-debt/2026-10-23-lightbox-repair-from-recovery.md)
  (Low); [the widgets' adoption of the shared parser](../../tech-debt/2026-10-23-widget-model-json-repair-adoption.md)
  (Medium).
- **Tech debt resolved and archived:** [one home for the codec's field
  decoders](../../archive/tech-debt/2026-10-19-lightbox-codec-shared-field-decoders.md)
  (`LightboxReadingFields` is now the only one), and the group
  [D](../../archive/tech-debt/2026-10-20-lightbox-group-d-response-ceiling.md)
  and [E](../../archive/tech-debt/2026-10-20-lightbox-group-e-response-ceiling.md)
  response-ceiling items, superseded by decisions 38 and 40.

## 6. PR #165's corrections

[The review](../../../docs/pr-reviews/pr-165-lightbox-reading-tolerance-review.md)
found four faults (Medium / P2), all fixed; see its author response.
- **F-01: every rule reads the field whole.** The codec clipped at the
  safety ceiling before the checks, so a check saw a different value from
  the model's. Now `text(value, path)` reads a field whole for every rule (a
  quote, a term, a key, a steering example, every field a text rule checks),
  and only free prose no rule reads goes through `prose(value, path, ask)`,
  which clips (§1, the safety ceiling). A quote needs no ceiling: the
  verifier holds it to the paragraph it names. The reviewer's four cases
  (a real long quote withheld; a quote with an invented tail passing when
  the chapter held its clipped start; a real long example discarded; a long
  spark losing its question mark) are tests, with her threshold and
  full-anchor controls (`LightboxCheckedWhole.test.ts`).
- **F-02: a reply cut off inside its frame's ending.** At a length cutoff
  only, the frame sets aside a last line that is a start of this group's
  closing sentinel, or of the closing fence of a fence the reply opened
  (around the frame, or inside the sentinels), before salvage; every
  finished block is read. A normal stop gets no such allowance, and any
  other last line is refused as before; the raw reply and its group's
  contract are still saved (`LightboxReadingFrameEnding.test.ts`: groups
  A–G one character short, every cut point inside the sentinel, both fence
  cases, and the controls).
- **F-03: a reply cut off inside a curly-quoted token.** In a salvage, a
  curly-quoted token the reply never closed is incomplete, like a cut
  straight string: its member is dropped and its finished siblings are
  kept. A completed curly-quoted string is held to the same rule as ever,
  and an ordinary parse stays strict (`ModelJsonRepair.test.ts`: a partial
  key and a nested value, each beside its straight-quoted control, with no
  content leaking).
- **F-04: no test pins the engine's wording.** CI and VS Code 1.82's
  extension host run Node 18, whose `JSON.parse` words its errors
  differently from Node 22's. The two tests now assert a `SyntaxError`. The
  parser read a position from the message with `/position (\d+)/`, which
  could take a number from a slice of the reply that newer engines echo;
  `jsonParseErrorPosition` now reads only a position at the message's end,
  in both engines' wordings, and none otherwise. Only the error's own words
  use it. The full suite was run under Node 18.20.8 as well.
- **F-05 (the re-review): whole fields, read in linear time.** F-01 hands
  the text rules whole fields, and the bare-digit rule was the lookbehind
  `/(?<!¶\s?\d*)\d/u`, which re-read a run of digits for every digit in
  it: the reviewer's group G claim with a paragraph address of 96,000
  digits took about 3.4 seconds to decode in the review's measurement,
  and 200,000 took 15.4 seconds in a test run here at `467950d`
  (about 10 ms now). `lightboxHasBareDigit` reads the text once and keeps the rule
  exactly: a run of ASCII digits is an address when the character before
  it is `¶`, or one whitespace character (as `\s` reads it) after `¶`. It
  is pinned to the old pattern on every edge case and on 20,000 seeded
  random texts, and its work is counted. Auditing every regular expression
  the codecs and text rules run on model text found one more: a spark's
  closing marks were stripped with `/[…]+$/u`, tried from every start in
  a long run (a question with 200,000 spaces inside took 35.9 seconds);
  they are read back from the end now. A chapter line's trailing spaces
  had the same shape and use `trimEnd`, which removes the same characters
  (`LightboxBareDigitScan.test.ts`).
- **The guard's limit, written down.** `modelJsonContentMatches` compares
  scalar sequences, not structure; its comment says so, so a future
  model-based repair does not take it for proof that grouping survived.

## Implementation notes

- **Modules.** New: `infrastructure/api/parsers/ModelJsonRepair.ts` (426
  lines: the API, the walk, the rebuild) and `ModelJsonTokens.ts` (183: the
  tokenizer and the guard's comparison),
  `infrastructure/lightbox/LightboxReadingFrame.ts` (the frame,
  out of the codec), `shared/constants/lightboxClip.ts`. Changed: every
  block codec, `LightboxReadingFields` (the one home of the field rules:
  `text(value, path)` whole for every rule, `prose(value, path, ask)` for
  free prose that may be clipped, and `listAt(value, path, minimum, noun)`),
  `LightboxReadingWire` (`LightboxReplyEnd`, `LightboxFrameRepair`,
  `LIGHTBOX_CUT_OFF_REASON`, the decode report), `LightboxGroupReply`
  (`decodeLightboxReply`, shared with `LightboxOpinionReply`), the handoffs,
  `LightboxSteeringTiles`, `RejectedModelResponseRecoveryStore` and its
  contracts. `LightboxReadingRunner` (498 lines) and `LightboxService`
  (491) are untouched; every module stays under 500 lines.
- **The decode report** (`LightboxDecodedGroup.report`) carries the repairs,
  the clips and whether the reply was cut off; the reply reader logs it.
- **The webview:** only the Movements lane's note (`lightboxPlot.ts`). The
  test harness `lightboxBoardsHarness` may take a recovery store, so the
  visual evidence saves its salvaged reply through the real one.

## Tests

New suites: `ModelJsonRepair.test.ts` (the shared parser: each repair kind,
the guard refusing any change to a scalar, the salvage, errors with no
text), `LightboxReadingRepair.test.ts` (the Lightbox through it: the real
case from group E, each fault on a worked example, refusals, the salvage of
groups E and F, the log lines), `LightboxReadingTolerance.test.ts`
(groups A–E: overruns shown, real faults withheld, the safety ceiling),
`LightboxFieldHandoffClip.test.ts`, `LightboxBoardTolerance.test.ts`,
`lightboxClip.test.ts`; after PR #165's review, `LightboxCheckedWhole.test.ts`
(F-01) and `LightboxReadingFrameEnding.test.ts` (F-02). Changed: the codec, runner (group C cut inside
lineage through a whole run, and a cut reply that cannot be salvaged),
Opinion, plot, steering, anchor, handoff, recovery-store, budget, sync and
boundary tests, and the webview's `lightboxPlot.test.ts` (the Movements
lane's note).

## Verification

After `npm ci` into a real `node_modules`:
- **jest:** 488 suites / 6,737 tests / 59 snapshots, all passing (482 /
  6,653 / 59 at `a57a5cd`).
- **lint:** 0 errors and 1,133 warnings, identical per file, rule and
  severity to `a57a5cd`. **typecheck** passes.
- **build**, with `verify:bundle`, twice: `webview.js` SHA-256
  `405f6cd140d856df49e48f46608b20dbe86bbce75c48b84fa3e0db9b327fbf5d` and
  `extension.js`
  `47c258bb3d9e2b09212a8ccabfff1ac95aedb821eeadfe30a67f6f87d6be8a45`, the
  same both times. `git diff --check` is clean.
- **Visual evidence** in
  [`docs/pr-reviews/evidence/lightbox-slice-4h-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-4h-visual/README.md):
  15 captures at 1440, 1000 and 500 px, from that `webview.js`; every
  overrun shown whole, nothing cut or past its box, no overflow, no clipped
  button; `errors.txt` empty. Against the base bundle it writes 3 errors
  (the Movements lane's note) and exits 1. The same replies read through
  `a57a5cd`'s codec withhold ten blocks across groups A–E, and fail the cut
  group E whole (`states/before-a57a5cd.txt`).
- No live or billable provider call.

**After PR #165's corrections** (`2ebeda4b`): 490 suites / 6,794 tests /
59 snapshots, all passing under Node 22.22.0; under Node 18.20.8, which CI
and VS Code 1.82's extension host run, the same 490 / 6,794 / 59, all passing. Lint
identical per file, rule and severity to a fresh export of `a57a5cd`;
typecheck passes; after `npm ci`, two builds give `webview.js` `405f6cd1…`
(unchanged) and `extension.js`
`4730ecf7cc91b6bbd375b1d6daa130274ebf0d01cf8ac169c1209974e5f3638e`. The
evidence host builder, rerun, writes the same log and states but for the
recovery file's random id, so the captures stand. On an export of
`d255b8e`, 29 of the new and changed tests fail and every control passes.

**After the re-review's F-05** (`decd276d`): 491 suites / 6,829 tests /
59 snapshots, all passing under Node 22.22.0 and under Node 18.20.8; lint
identical; typecheck passes; two builds give `webview.js` `405f6cd1…`
(unchanged) and `extension.js`
`1da47dcf24fb145d4773d4b8428eac235ec35cee7369951edf8cdfe32a0fd402`. On an
export of `467950d`, 22 of the 35 new tests fail (the scan's), and the
decoder and spark cases there take 15.4 s and 35.9 s against about 10 ms
and 5 ms here.

**Which tests fail on `a57a5cd`.** The new and changed test files, copied
onto an export of `a57a5cd`:
- **Typed, as CI runs them:** 21 of the 26 suites fail. Fourteen do not
  compile there, since they import a module or a field this slice adds
  (`ModelJsonRepair`, `lightboxClip`, `LIGHTBOX_CUT_OFF_REASON`,
  `safetyMultiple`, a capture's `contract`, `lightboxSteeringExampleShowsNoChange`):
  the parser, repair, tolerance, field-handoff-clip, clip, tile-, craft- and
  Opinion-handoff, steering, example-anchor, codec, board-tolerance,
  recovery-store and sync suites. Seven fail by test: boundaries (3: the
  parser guard, the module list, the Workshop-route guard over the new
  modules), prompt budgets (1: the new numbers), Opinion readings (4: a
  seventh observation and the widened ids), plot readings (1: a synopsis
  past its asks), the runner (2: salvage, and an unsalvageable cut reply)
  and the estimate (1: the 12,000 reservation), and the webview's plot
  lane (1: the Movements note). Five pass there: the two sentence-rule
  suites (comments only) and three webview suites whose fixtures moved to
  12,000.
- **With type checking off** (to see each test): 40 tests fail in the
  suites that load, among them 16 of the 17 in `LightboxReadingRepair`
  (all but the one that only shows `JSON.parse` failing on the real case),
  6 of the 9 in the example-anchor suite, the codec's two frame cases, and
  the recovery store's contract case; eight suites cannot load at all.
  `LightboxBoardTolerance`'s round-trip fails there only at its own setup
  (`safetyMultiple` is new): given the multiple, all three of its tests
  pass on `a57a5cd`, since format 1 never bounded a reading's text or a
  list's length.

## For the writer to decide

- **The example's length.** Decision 23 described the one example as "a
  phrase … and a few words". Its length is now an ask like any other, so a
  longer example is shown on the board (Bring clips it to one point). If the
  phrase-not-passage fence should hold, it could return as a gate at a
  generous multiple, such as twice the ask.
- **An "at most" price.** The estimate prices typical output; with a
  12,000-token ceiling the most a group can cost is higher. A ceiling-priced
  "at most" beside "est." is possible if wanted.
- **Unreached lenses** read "The reading returned no … block.", as any
  missing lens does; they could say the reply reached the ceiling first.
