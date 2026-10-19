# Lightbox Slice 3 visual evidence: lexical gravity, palette, stale readings and Build as a lens

Lightbox Slice 3 adds two group A lenses (lexical gravity and palette),
keeps readings across a changed chapter as stale and re-checked (ADR D4),
and hands a borrowed field to the Workshop's Lexical Gravity Build lens (ADR
D11). This folder shows those states from real host output. The harness is
adapted from [`../lightbox-slice-2b-visual/`](../lightbox-slice-2b-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px |
| `workshop/workshop-build-<width>.png` | The Workshop after the handoff, at 1440, 1000 and 500 px |
| `states/chapter.json` | The host's Lightbox messages for Chapter I: `idle`, then what `done` adds; `sent` (the handoff's answer) and `stale` (the re-read of the edited chapter) each follow `done`. `estimates` and `staleEstimates` hold the host's estimate answers for the read board and the rebuilt one; the harness answers the tab's own requests with them, echoing each request's id (PR #149 F-03), as the Slice 2B harness does |
| `states/workshop.json` | What the Workshop panel's own Lexical Gravity handler posted for the handoff (`build`), and its lens library (`lenses`) |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox and the Workshop surfaces behind a stubbed VS Code API, replays each state's messages, screenshots it once two consecutive frames match, and writes `facts.json` |
| `tools/build-gravity.test.ts` | How `states/` was made |

**States:**
- `done`: every group back, the board's **Read** filter, scrolled to the
  lexical gravity tile: the orbit, four borrowed fields (Wind below the
  gravity line), the collision with the one sentence that holds both fields
  (PR #150 F-04) and the three literal set-asides.
- `palette`: the same board, scrolled to the palette: four diction clusters
  and six swatches, every word counted by the host.
- `field` (1440) and `field-inspector`: the Telescope field pinned. The
  inspector shows its evidence, its terms by degree, its counted support,
  its friction and **Build as a lens in Lexical Gravity**.
- `sent` (1440 and 500): Build pressed. The webview posted
  `lightbox_hand_off` naming only the board and the field; the host's answer
  is replayed. Since PR #150 F-03 it says "Opened", because the host answers
  only once the Workshop has opened the field.
- `stale` and `stale-inspector`: the writer revised ¶15 ("shut up like a
  telescope" became "fold up like a paper fan") and re-read the file. Every
  lens is marked stale, Telescope's ¶15 quote is withheld as no longer in
  the chapter, its hits are recounted (9 → 7), and Build is disabled with
  its reason. Since PR #150 F-06 the headline says it is stale, the tension
  caption says its scores stand only on unchanged paragraphs, the tension
  lane carries a **stale** chip, and the changed ¶15 has no tension score.
- `workshop-build`: the Workshop after the handoff. Lexical Gravity is open
  on Build lens (**Create New**) with the subject prefilled and the banner
  from the Lightbox; nothing has been built. Since PR #150 F-01 the sheet
  has no lens until the writer chooses one: it says "No lens chosen yet",
  and Preview and **Install on passage** are disabled.

**How the states were made.** `tools/build-gravity.test.ts` drives the
production `LightboxService`, `LightboxHandler`, `LightboxReadingHandler`,
`LightboxReadingRunner`, prompt builder, codec, quote verifier, term counter
and stale-readings carry, and the Workshop's own
`WorkshopLexicalGravityHandler`, and records every message they posted. The
handoff port does what `extension.ts` and the Workshop panel provider do: it
routes a synthetic `WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD`, with the
provider's delivery id, through the Workshop handler, and settles as opened,
which is what the Workshop webview answers when it opens the sheet (it posts
`workshop_lexical_gravity_build_seed_answer` in the `workshop-build` state).
The press names the estimate it was shown and the model it priced, as the
merged Slice 2B fixes require. Only the provider is played: a stubbed
engine answers each group's call. No provider was called.

- **Groups B and C** answer with the prompt bundle's worked examples,
  verbatim, as in Slice 2B.
- **Group A** answers with its worked example, with Slice 2B's changes (31
  tension columns, a third peak, one motif quote paraphrased on purpose) and
  hand-written gravity and palette blocks for the whole chapter: Telescope,
  Ledger, Candle and Wind as borrowed fields, a Ledger × Telescope collision
  in ¶16, Falling, Doors and keys, and Eating and drinking set aside as
  literal, and four clusters and six swatches. Every term, word and quote is
  the chapter's own; the host counts every term and checks every quote.
- **The model is a stub**, `provider/reader-model`, with a 200,000-token
  window and stub prices of $3 and $15 per million input and output tokens.
- The builder also asserts that the stale Telescope field is refused if the
  webview sends it anyway, and that no log line carries a field, term or
  quote.

**Source text.** Chapter I of Lewis Carroll's "Alice's Adventures in
Wonderland" (1865), public domain, prepared exactly as for Slice 2A (see that
README). Boards use the Middle Grade publishing-standards preset.

**Limitation:** this is headless Chromium, not the VS Code webview host.
Theme variables are stubbed, and fonts come from the system. The harness
confirms the stub model for the assistant and widget scopes, so both pickers
show "Reader model (stub)"; neither is called.

## Results

From `facts.json` of the final run, against the bundle built at the head
that merges the PR #150 review fixes with `epic/lightbox` at `c6d4411`
(`webview.js` SHA-256 `874136650feae93b4875dba5bb1ba9a95535b4b13c0ada27e4140fc50535034c`):

| State | What the page shows (1440, 1000 and 500 alike) |
|---|---|
| `done` | Run line "50 quotes checked · 1 withheld · 3 calls", "Re-read · 3 calls · est. $0.16". Orbit: Telescope (pull 0.46, 9 hits), Ledger (0.28, 9), Candle (0.22, 6), Wind (0.12, 1 hit, below the gravity line, hollow). Field rows: "Enters at ¶15, last at ¶27; densest at ¶15–¶16 (4 of 9 hits)", "Only in ¶23, 6 hits", Wind's "Below the gravity line: 1 hit, fewer than 3." Collision ¶16 shows its witness sentence, "There seemed to be no use in waiting by the little door, … a book of rules for shutting people up like telescopes", and "Ledger and Telescope share this sentence." Set aside as literal: Falling (34 hits), Doors and keys (17), Eating and drinking (17) |
| `palette` | Clusters: The way down (down ×23, well ×7, rabbit-hole ×3, fell ×4, fall ×4), Little things (little ×15, small ×3, size ×2, inches ×2), Thinking it over (think ×9, thought ×8, wonder ×6, considering ×2), The hall and the garden (door ×7, key ×6, garden ×4, hall ×4, table ×5). Swatches: white ×2, pink ×1, orange ×1, dark ×3, golden ×3, red-hot ×1 |
| `field`, `field-inspector` | Telescope pinned: both quotes found verbatim (¶15, ¶22); by degree "1° latent size ×2, shrink ×1 · 3 hits", "2° felt shut up ×1, shutting ×2 · 3 hits", "3° overt telescope ×2, telescopes ×1 · 3 hits"; **Build as a lens in Lexical Gravity** enabled, `aria-describedby="pm-lb-build-lens-note"`, note "Opens Lexical Gravity in the Workshop with this field as the subject. Nothing is built until you press Build there." |
| `sent` | The tab posted `lightbox_hand_off {"kind":"lexical-gravity-seed","boardId":"board-alice-1","fieldId":"lbt-run-1-ev-A-6"}` and nothing else about the field; the host's answer shows as a status: "Opened “Telescope” in Build lens in the Workshop’s Lexical Gravity. Nothing is built until you press Build there." |
| `stale`, `stale-inspector` | Run line "50 quotes checked · 2 withheld · 3 calls · 8 lenses stale"; six reading tiles and the headline carry the **Stale** note. Tension caption "Tension, as read on an earlier version (scores stand only on unchanged paragraphs): …", a **stale** chip on the lane, whose note reads "Tension was read against an earlier version of this chapter. Scores stand only on paragraphs unchanged since; re-read to score the rest."; one column (the changed ¶15) unscored. Telescope: 7 hits ("Enters at ¶16 …"), the ¶15 quote withheld as "No longer in the chapter: the text changed after this was read, and these words are gone.", "shut up · not in the chapter" in its counted support; Build disabled with "Read against an earlier version of the chapter. Read the lens again before building it." |
| `workshop-build` | Lexical Gravity open on **Create New** (Build lens); subject "Telescope: shutting, size, telescopes, shut up, shrink"; banner "From the Lightbox: the borrowed field “Telescope” in Drafts/alice-chapter-1.md. Its governing metaphor: … Counted there: telescope ×2, shutting ×2, size ×2, telescopes ×1, shut up ×1, shrink ×1. … Nothing is built until you press Build lens, nothing is saved until you add a take, and nothing is installed until you choose a lens and press Install on passage." "No lens chosen yet. Build lenses from the subject and add the take you want, or choose one from the Library. Preview and Install wait for that choice."; no library lens selected; **Preview the Effect** and **Install on passage** disabled. The page posted `workshop_lexical_gravity_build_seed_answer` and no `workshop_build_lexical_gravity_lens` |
| Horizontal overflow | none, in any state or width |

- No page errors in any state or width.
- The estimate (all lenses on) is A 9,639, B 6,947 and C 6,555 input tokens,
  each reserving 8,000 for its reply: group A grows by the two lenses and
  the counted-words line.
- `states/log.txt` names paths, counts and refusal reasons only; the builder
  asserts that no field, term or quote appears in it.
- Two runs of the harness against the same bundle: 16 of 21 shots
  pixel-identical; the other five differ in at most 116 pixels by at most
  2/255 (anti-aliasing).
- Against the shots of the reviewed head (`4150c8c`): `field-inspector-500`,
  `palette-1000` and `palette-500` are pixel-identical and `palette-1440`
  differs only by anti-aliasing. `done`, `field` and `field-inspector` change
  in the collision note (F-04), `sent` in its answer (F-03), the `stale`
  shots in the headline, tension caption, lane and ¶15 column (F-06), and
  `workshop-build` in the banner, the no-lens note and the disabled Preview
  and Install (F-01).

## Rerunning it

Build the bundle and copy it out:

```sh
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js /tmp/lightbox-3/webview.js
```

Render the states, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js /tmp/lightbox-3/webview.js /tmp/lightbox-3/visual
```

To rebuild `states/`: make `$DIR/fixtures/alice-chapter-1.md` with
`../lightbox-slice-2a-visual/tools/alice_chapter.py` as that README
describes, copy `tools/build-gravity.test.ts` into
`packages/core/src/__tests__/`, run it with
`LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-gravity.test.ts`,
delete the copy, and copy `$DIR/states/*` here. `$DIR` defaults to
`/tmp/lightbox-3`; keep it outside the repository.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then
from `/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
