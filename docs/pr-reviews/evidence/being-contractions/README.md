# Being-verb contractions and dialogue as voice: evidence

Epic decision 26 ([Slice 4G](../../../../.todo/epics/epic-lightbox-2026-10-19/slice-4g-being-contractions.md);
ADR 2026-10-19 D7, third addendum). Two changes, shown on the same board:

- **Contractions of be count as being verbs**, through the one shared
  detector (`findBeingVerbs`): I'm, 're, 's read as *is*, isn't, aren't,
  wasn't, weren't and ain't. The numbers row, its standout, the writer's
  average, craft steering's totals and the quote check all move together.
- **Dialogue is voice.** A craft-steering note whose instance stands in
  dialogue keeps its stance, but shows no nudge or example; the host says
  why under "In dialogue".

## What is here

| Path | Contents |
|---|---|
| `lightbox/numbers-before-<w>.png`, `numbers-after-<w>.png` | The numbers tile on the same chapter, measured by `epic/lightbox` at `1cb417c` (Slice 4F and the sentence rule) and by this branch, at 1440 and 500 px |
| `lightbox/steering-before-<w>.png`, `steering-after-<w>.png` | Craft steering on that chapter: the whole tile at 1440 px (three figures side by side), being verbs alone at 500 px |
| `lightbox/inspector-after-<w>.png` | The Hare's note (in dialogue) pinned: the inspector's "In dialogue" line |
| `states/before.json`, `states/after.json` | The host's `lightbox_board` message for each, as replayed |
| `states/figures-before.json`, `states/figures-first.json`, `states/figures-after.json` | The measured figures behind the tables below, with each form found, paragraph by paragraph: at `1cb417c`, at this branch's first head `ab22ebd` (before the writer's three additions), and at its head |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, replays each state, captures one element once two consecutive frames match, and writes `facts.json` and `errors.txt` |
| `facts.json` | What each capture's page showed, read from the DOM: the numbers rows, each steering figure's head and notes (stance, quote, why, nudge, example, "In dialogue" line), withheld notes, the inspector |
| `errors.txt` | Every page error, console error and fault (a note in dialogue showing a nudge or example, the wrong count of notes in dialogue, a missing tile, horizontal overflow); **empty for this run** |
| `tools/build-states.test.ts` | How `states/` was made |

## Source text and how the states were made

The board reads the opening of Chapter VII, "A Mad Tea-Party", of Lewis
Carroll's *Alice's Adventures in Wonderland* (1865, public domain): PR
#161's dialogue-heavy fixture (`teaPartyFixtures.ts`, Project Gutenberg
EBook #11), 19 paragraphs and 435 words, set in curly double quotes with
curly apostrophes (`TEA_PARTY_CURLY`).

`build-states.test.ts` builds the board with the production
`LightboxService` (prose stats, word frequency, Style Flags, the numbers
and craft steering's measure) against the test fixture's synthetic writer
average (`WRITER_AVERAGES`: 25 being verbs per 1,000 words over 20,000
words), and reads group G with the production codec, quote verifier and
assembly from one answer written for this evidence. It ran three times,
with the same answer:
- **before**, on an export of `epic/lightbox` at `1cb417c` (Slice 4F and
  the sentence rule, the tree this branch merges), with the node modules of
  this worktree;
- **first**, on an export of this branch's first pushed head `ab22ebd`,
  for the figures only (the writer's three additions came after it);
- **after**, at this branch's head.

It imports only modules both trees have. No provider was called, and no
writer's text is used.

The answer holds four notes: being verbs on ¶1 (narration: "a Dormouse was
sitting between them, fast asleep", leans, with a nudge and an example), ¶7
(the March Hare's line, leans, with a nudge and an example) and ¶12 (Alice's
"I'm glad they've begun asking riddles", compensates, `"nudge": null`), and
an intensifier on ¶6 (Alice's retort, leans, with a nudge).

## Results

Rendered from `webview.js` SHA-256
`20d3aed38676380185d8e6c680c37a75f33e7be6599038838d709bb95a0472aa`, built
from an empty `dist/` after `npm ci` into the worktree's own
`node_modules`. One bundle renders both states: the change is in what the
host measures and holds.

| Capture | Before (`1cb417c`) | After (this branch) |
|---|---|---|
| Numbers row, being verbs | "39.1 per 1,000 words · 1.56× your average of 25", stands out above your average, "Read under Craft steering, below" | "59.8 per 1,000 words · 2.39× your average of 25", the same standout and pointer |
| Numbers, every other row | Sentence length 16.1 words per sentence (the sentence rule's), dialogue 50.8%, passive voice 2.3, adverbs 11.5, intensifiers 18.4 | The same |
| Steering, being verbs head | "17 being verbs · 39.1 per 1,000 words", "11 in narration · 6 in dialogue" | "26 being verbs · 59.8 per 1,000 words", "11 in narration · 15 in dialogue"; there or it + be 3 → 10, be + adjective 0 → 1, other 8 → 9; in runs of short sentences 0 → 0 |
| ¶1, narration (leans) | Worth a look; "a Dormouse was sitting → a Dormouse sat" | The same: narration keeps its nudge and example |
| ¶7, the Hare's line (leans) | Worth a look; "without being invited → uninvited" | **In dialogue**: "Its instance is in dialogue, the character's voice, so no nudge or example the reading gave is shown." Stance kept |
| ¶12, Alice's "I'm glad" (compensates, no nudge) | Withheld: "It leans or compensates, so it names the craft move worth a look, and this one names none." ("I'm" was no instance then either) | Drawn, **In dialogue**: "Its instance is in dialogue, the character's voice: the board reads it there but offers no nudge or example." |
| ¶6, intensifier in Alice's retort (leans) | Worth a look | **In dialogue**, as ¶7: the rule holds for all three figures |
| Inspector, ¶7 pinned | (not captured) | Stance "Leans", "In dialogue" with the same line, Figure "26 · 59.8 per 1,000" |

Every state reads the same at 1440 and 500 px. No document overflows
horizontally, and `errors.txt` is empty.

## Before and after on the *Alice* fixtures

From `states/figures-*.json`, against the same synthetic writer average.
"Before" is `epic/lightbox` at `1cb417c`; "after" is this branch. Rates are
per 1,000 words.

| Fixture | Words | Being verbs | Rate | Narration · dialogue | Constructions that move | Short runs | Standout |
|---|---|---|---|---|---|---|---|
| Ch. I ¶1–¶8 (worked examples D and G) | 508 | 17 → 17 | 33.5 → 33.5 | 15 · 2 → 15 · 2 | none | 0 → 0 | none, 1.34× → 1.34× |
| Ch. I heading + five paragraphs (`lightboxProseFixtures`) | 226 | 7 → 7 | 31.0 → 31.0 | 6 · 1 → 6 · 1 | none | 0 → 0 | none, 1.24× → 1.24× |
| Ch. VII opening, curly (`TEA_PARTY_CURLY`) | 435 | **17 → 26** | **39.1 → 59.8** | 11 · 6 → **11 · 15** | there or it + be 3 → 10, be + adjective 0 → 1, other 8 → 9 | 0 → 0 | above your average, 1.56× → 2.39× (no flip) |
| Ch. VII opening, Gutenberg's single quotes (`TEA_PARTY_PARAGRAPHS`) | 435 | **17 → 26** | **39.1 → 59.8** | 17 · 0 → 26 · 0 | as above | 0 → 0 | above your average, 1.56× → 2.39× (no flip) |

- **Chapter I's opening does not move.** Its eight paragraphs hold no
  contraction of be ("they'll" and "wouldn't" are not forms of be), so
  the worked examples' figures, and groups D and F's examples, stand.
- **Chapter VII gains nine:** five 's read as *is* (it's ×3, there's,
  that's), wasn't ×2, isn't and I'm. With the dialogue set in double
  quotes, all nine stand in dialogue; in Gutenberg's single quotes the
  shared matcher reads all speech as narration, its stated limit.
- **Short runs.** Under the old sentence rule one new instance sat in a
  run of three short sentences; under the merged rule, which keeps closing
  marks and joins lower-case speech tags, none does.
- **Adverbs and intensifiers** keep every count on all four fixtures:
  tagging with curly apostrophes straightened moves no construction here.
- **No standout flips.** Being verbs already stood out above the
  synthetic average on Chapter VII, and stands further out. On a writer's
  real project, their average now counts contractions too, so the ratio
  compares like with like.

## The writer's three additions

Approved after the first push (`ab22ebd`): the next-word rule for `'s`
after a name or noun, *has* before "had", and 'tis, 'twas and 'twere.
**None of the four *Alice* fixtures moves** between `ab22ebd` and the head
(their `forms` are identical): they hold no `'s` the tagger reads as a
possessive before a word that makes it *is*, no "'s had" and no 'tis.
The board states and every capture above are byte-identical across the
additions. The builder also measures four lines written for this
evidence, with made-up names:

> “Nate’s late again,” said Ivy. “Everyone’s here but him, and the kettle’s boiling.”
> Ivy’s sister laughed. The Hatter’s watch had stopped, and Nate’s own excuse was thin.
> “’Tis no matter,” said the cook. “’Twas ever so. It’s had its day, that kettle.”
> “I ain’t had a cup,” said Nate, “and the cat’s asleep in the teapot.”

| Tree | Being verbs | Forms found, paragraph by paragraph | Narration · dialogue |
|---|---|---|---|
| `1cb417c` | 1 | —; was; —; — | 1 · 0 |
| `ab22ebd` (first head) | 3 | —; was; ’s (It’s had, read as *is*); ain’t (before had) | 1 · 2 |
| Head | **7** | ’s ’s ’s (Nate’s late, Everyone’s here, the kettle’s boiling); was; Tis, Twas; ’s (the cat’s asleep) | 1 · 6 |

Ivy’s sister, the Hatter’s watch and Nate’s own stay possessives; "It’s
had" and "ain’t had" are *has* now. The 56 words are under the
standout minimum (300), so nothing stands out at any tree.

## Limitations

- Headless Chromium, not the VS Code webview host; theme variables are
  stubbed and fonts come from the system.
- Group G's answer was written for this evidence, and only the provider is
  played; no other group is read, so the numbers tile shows its measured
  rows and "Not read yet".

## Rerunning it

```sh
npm ci
npm run build
cp apps/vscode-extension/dist/webview.js $DIR/webview.js
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node docs/pr-reviews/evidence/being-contractions/harness.js $DIR/webview.js $DIR/visual
```

Then copy `$DIR/visual/*.png` into `lightbox/`, and `facts.json` and
`errors.txt` here. To rebuild `states/`, copy `tools/build-states.test.ts`
into `packages/core/src/__tests__/`, run it with
`LIGHTBOX_EVIDENCE_DIR=$DIR LIGHTBOX_EVIDENCE_LABEL=after npx jest packages/core/src/__tests__/build-states.test.ts`,
delete the copy, and copy `$DIR/states/after.json` and
`$DIR/figures-after.json` into `states/`. For `before` and `first`, do the
same in an export of `1cb417c` or `ab22ebd` (`git archive`) with
`LIGHTBOX_EVIDENCE_LABEL=before` or `first`.
Keep `$DIR` outside the repository. Playwright resolves from the project,
then `PLAYWRIGHT_MODULE`, then `/opt/node22/lib/node_modules/playwright`;
Chromium from `CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
