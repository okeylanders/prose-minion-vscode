# Epic: Lightbox

**Status:** In progress. Slice 0 (spec) is on `epic/lightbox`; the writer approved the plan on 2026-10-19. The dialogue-quote prerequisite merged (PR #146), Slice 1 merged (PR #147), Slice 2A merged (PR #148), Slice 2B merged (PR #149), Slice 3 merged (PR #150), Slice 4 merged (PR #151), and the launch entry points and shared project picker merged (PRs #152–#154). The writer's real-chapter checkpoint passed on 2026-10-20; Slices 4B–4D (new lenses) come before Slice 5: 4B merged (PR #155), 4C merged (PR #156) and 4D merged (PR #157). Slices 4E (PR #159), 4F (PR #160), the sentence rule (PR #161) and 4G (PR #162) merged, with PR #158's VS Code 1.82 floor; Slice 5 is split: 5A (saved boards) merged (PR #163; `epic/lightbox` at `3e5c3a1`). The writer then made four calls on it (decisions 33–36): **5A.1** (board names, the changed-file notice above the board, a spark set aside saved at once) merged (PR #164; `epic/lightbox` at `a57a5cd`). **4H** (reading tolerance: asks, not gates; the output ceiling; JSON repair; truncation salvage; decisions 37–40) merged (PR #165; `epic/lightbox` at `08b0d22`). **4I** (run controls: "Run AI analyses", a widget's Analyze, each call's Run; decisions 41–45, 47 and 48) merged (PR #166; `epic/lightbox` at `fcf86ff`). The writer then asked for saved boards in the Workshop's design language (decision 46): **5A.2** (one file per board, a Boards menu and a shared browser of every chapter's boards, "Open a board file…") is built on `epic/lightbox-boards-browser`, with 4H and 4I merged in; PR #167 is open, and its review's seven findings (F-01 to F-03, N-01 to N-04) are corrected. 5B (Compare) follows it.
**Priority:** Medium
**Created:** 2026-10-19
**Integration branch:** `epic/lightbox` once the writer approves it. Slice 0 was written on `claude/friendly-volta-g1gmgc` (from `main` at `d1f25db`, v2.11.0).
**Decision:** [ADR 2026-10-19: Lightbox](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) (Proposed)
**Design:** [`docs/design/lightbox/`](../../../docs/design/lightbox/README.md), a snapshot of the Claude Design canvas (interactive prototype)

## Goal

A writer opens a chapter in a **Lightbox** editor tab and sees it laid out as
an inspiration and mood board. Counted facts appear at once and cost nothing:
headline stats, top words, parts of speech, repeated phrases, and a
paragraph-by-paragraph ribbon. One explicit press adds **readings**: genre
neighborhood, motifs, characters, voice, palette, lexical gravity, lineage,
subtext, and a Spark lane of open questions. Every reading quotes the chapter
with a paragraph address that code has checked, and names where it strains.
Hovering anything lights the paragraphs it touches. Any tile can be pinned and
carried into the Workshop.

```
┌ Prose Minion · Inspiration & Mood Board ─────────────────────────────────┐
│ Lightbox   Drafts/chapter-6.12.md · v4 · 3,087 words                     │
├──────────┬───────────────────────────────────────────────┬───────────────┤
│ Excerpt  │ A basement, a voice, and three boys…  [reading]│ Inspector     │
│ Context  │ [All|Measured|Read]  legend   3 calls · $0.04 ▶│ READ · Motif  │
│ Lenses   │ ▁▃▅▂▇▁▃  rhythm   ░▒ ░ dialogue  ┆┆┇ tension │ Walking beside│
│ Boards   │ [stats ×6]                                     │ ¶14 ¶29 ¶47   │
│          │ [top words] [palette] [lexical gravity]        │ “…walked      │
│          │ [motifs] [characters] [lineage] [genre] …      │  beside him” ✓│
│          │ [Spark · open doors]                           │ [Bring ▸]     │
└──────────┴───────────────────────────────────────────────┴───────────────┘
```

## Writer decisions (2026-10-19)

| # | Question | Decision |
|---|---|---|
| 1 | Name | **Lightbox**, with "Inspiration & Mood Board" as the header subtitle |
| 2 | Surface | **Its own editor tab**, a sibling of the Workshop tab |
| 3 | Shell | **Extract** the Workshop header and rail into a shared full-tab shell first |
| 4 | Order | Counted board and first readings, then lexical gravity and palette, then the rest and Bring to Workshop |
| 5 | Saved boards | **Yes, but as the last slice**, so the output can be reviewed before the file format is fixed |
| 6 | Model | The **existing assistant model** setting |
| 7 | Input | **One file or excerpt per board** for now, with a word ceiling (ADR D8) |
| 8 | Launch entry points (2026-10-20) | **All three**: a Lightbox button beside Workshop in the sidebar, **Open File in Lightbox** in the Explorer and editor context menus, and an editor-title icon, each for **Markdown and plain text** |
| 9 | Choosing a source and context (2026-10-20) | **The Workshop's "Choose from project" modal**, shared: the source panel opens it to pick one file, and the Context list opens it in attach mode, as the Workshop does |
| 10 | Freshness (2026-10-20) | Shown as **a reading with its counted basis**, never a number: a three-step scale, Familiar · Mixed · Fresh, labelled "a reading, not a grade", over a host-counted basis line (Slice 4C) |
| 11 | Engagement (2026-10-20) | **Kept separate from tension**: a read Low/Medium/High per movement, because pull and tension can disagree (Slice 4C) |
| 12 | Echoes (2026-10-20) | **"Echoes" replaces provenance**: aphoristic lines that "sound reminiscent of …", always with an accuracy callout (the quote is checked, the resemblance is not), never a percentage (Slice 4B) |
| 13 | Number standouts (2026-10-20) | A **measured standout plus "how it's used"**: code flags a figure outside its range or far from the writer's own average, a reading says how it works here, and nothing says "fix" or "cut" (Slice 4B). *Amended 2026-10-21 (decision 23), for Craft steering's nudges only:* a steering nudge may name a craft move as worth a look. Nothing on the board says fix or cut, nudges included |
| 14 | Order (2026-10-20) | **The new lenses land before Slice 5** (saved boards), so the saved format holds them |
| 15 | Opinion views (2026-10-20) | **Neutral is the default view**; **Blunt is diagnosis only**, of the work, never the writer, with no rewrites (Slice 4D) |
| 16 | Opinion's place (2026-10-20) | The Opinion is an explicit, fenced **exception to "describe, never grade"**, recorded with the freshness label in a dated ADR addendum to D7 |
| 17 | Paragraph text (2026-10-21) | **Clicking a paragraph shows its whole text** in the inspector, fetched from the host when pinned and never persisted; reached from a counted item, that item's instances are lit (Slice 4E) |
| 18 | Sentences for an item (2026-10-21) | **Clicking a word in the word panels lists the sentences it appears in**, in a scrollable well at the bottom of the inspector, each instance found by the rule that made its count (Slice 4E) |
| 19 | Hapax list (2026-10-21) | **The Top Words panel lists the hapax words** below the cloud, exactly as many as the stats row counts (Slice 4E). Slice 4F (craft steering) takes the decisions after this one |
| 20 | Craft steering (2026-10-21) | **A lens of its own, Craft steering, in its own call (group G)**, read beside groups A–E; the Opinion waits for it like the others; it can be turned off. It **owns being verbs, adverbs (-ly) and intensifiers and fillers**: the numbers tile keeps their bars, ranges and standout flags and stops reading them; passive voice stays with the numbers (Slice 4F) |
| 21 | Steering is measured first (2026-10-21) | Each steering figure is **measured by the host**: its total and rate (the numbers bar's own detector, so they are equal), narration and dialogue, a breakdown by construction, and instances in runs of short sentences. Every list and threshold is named, with its false positives (Slice 4F) |
| 22 | Steering readings (2026-10-21) | Per figure, **one reading of how it works here and up to four instance notes**. A note is one checked quote holding an instance, a stance (**Earns · Leans · Compensates**), a why, and a nudge only when it leans or compensates (Slice 4F) |
| 23 | Nudges (2026-10-21) | **A nudge names the craft move, framed as worth a look**: no quotation marks, never cut, delete, remove, fix, wrong, bad, should or must. **The writer chose one illustrative example** ("feel free to give one example so the user understands"): a note that leans or compensates may show at most one, a phrase from its checked quote (checked by code to hold the instance) and a few words showing one way the move could go, labelled "One way it could go", never styled as a quote. This supersedes "never supply the writer's words" for that one example only; real rewriting happens in the Workshop. The **second fenced exception** to "describe, never grade", in a dated ADR addendum to D7; decision 13 amended for steering nudges only (Slice 4F) |
| 24 | Steering in the Opinion (2026-10-21) | The Opinion's digest holds each steering figure's **measured counts and its notes' stances, never a nudge** (Slice 4F) |
| 25 | The Opinion's citation basis for saved boards (2026-10-21) | **The writer chose a data basis**: a citation's basis becomes a hash of the cited item's canonical data (its key, kind, quotes with their ¶ addresses, counts and figures), not of the digest's rendered wording, and saved boards carry an explicit basis/format version. **Slice 5 implements it as its first step**, after 4E and 4F merge; until then bases are computed as today ([tech debt](../../archive/tech-debt/2026-10-21-lightbox-opinion-basis-is-rendered-text.md)) |
| 26 | Being-verb contractions, and dialogue as voice (2026-10-21) | **"Yes, count them."** A contraction of be is a being verb: I'm, 're (you're, we're, they're), 's read as *is* (the tagger reads a verb, and it is not *has* before been, got, gotten or had), isn't, aren't, wasn't, weren't and ain't (not before been, got, gotten or had). Never 's as a possessive or *has*, let's, 'd, 'll or 've. **The writer then added three rules:** after a name or noun the tagger reads as a possessive, the next word decides ("Tobin's late", "everyone's here" are *is*; "the Rabbit's watch", "Alice's sister" stay possessive; "the dog's barking" is read as *is*); "had" makes 's *has* ("it's had"), and ain't too; 'tis, 'twas and 'twere count as one being verb each. One shared detector (`findBeingVerbs`) feeds the rate, the numbers row, standouts, the writer's average, steering totals and the quote check, so they agree. "He's gone" counts as *is*: the stated limit. **Dialogue is voice, for all three steering figures** (the coordinator's default; the writer may narrow it to being verbs only): a note whose instance stands in dialogue may be drawn, with its stance, and may name a pattern, but carries no nudge and no example, by a host rule applied fresh, on carry and at Bring. Dialogue is steering's own split, double quotation marks only (Slice 4G) |
| 27 | Saving (2026-10-22) | *The coordinator's default; the writer confirmed it for stopped and partial runs (decision 36).* **A board saves itself** when a reading run ends having landed a group (finished, or stopped with groups back), and when a board with no readings is built for a source no saved board of which holds that text. One file per save, `prose-minion/boards/<source-slug>-<source-hash>/<timestamp>.board.json`, never overwritten; no pruning; the writer deletes from the rail (Slice 5A; the folder's hash from PR #163 F-04). *Amended 2026-10-23 (decision 46): **one file per board**, not per save. A board's first save writes its file; its later saves rewrite that file in place; a new file is written only for a new board, or when the board's file cannot be rewritten. The writer deletes from the browser* |
| 28 | Where boards save (2026-10-22) | *Default.* **The Lexical Gravity library's rule**: a single-folder workspace saves; no folder, or several, keeps boards for the session only, said plainly in the rail (Slice 5A) |
| 29 | Opening a saved board (2026-10-22) | *Default; the notice also shows above the board (decision 34).* **A snapshot**: it shows exactly as saved, against its own saved text and rules; nothing is measured again. When the file's text now differs (content hash), a notice offers **Read the current text**, which builds a board from the file and carries the readings, marked stale. Bring from such a snapshot is refused with a reason that points there (Slice 5A) |
| 30 | Reload (2026-10-22) | *Default.* **The last board on screen comes back**: a window reload, or reopening the tab after one, reopens it from the store instead of losing its readings. Session-only mode keeps the old behaviour; the ADR's "readings are lost on reload" consequence is amended (Slice 5A) |
| 31 | The Boards rail (2026-10-22) | *Default; names and models added by decision 33. **Replaced by decision 46 (2026-10-23)**: the rail section is gone; its rows, Open and Delete live in the Boards menu and the shared browser.* The open source's saved boards, newest first: when, the lenses read, an approximate cost when recorded, and which is on screen. **Open**, and **Delete** with a confirm step; keyboard reachable; plain CSS on the Chromium 114 floor (Slice 5A). Every board is listed; past twenty the rail says how many and offers **Show older** (PR #163 F-04) |
| 32 | What a saved board records (2026-10-22) | The board whole (every tile kind, every measured layer, readings with what was withheld and their stale marks), its **sources as a list, each with its text**, and **the ids of the rules that measured it**: paragraphs, sentences (ADR 2026-10-21), dialogue, being verbs (decision 26) and the Opinion's citation basis (decision 25). Not saved: the Opinion view showing, or any other webview preference. Compare is **Slice 5B**, a later PR, and needs no format change (ADR D12 addendum, 2026-10-22). **The writer-data rule (2026-10-22): a saved board only ever loses standing, never the board.** A file whose Opinion was cited under another basis rule opens whole: its Opinion is stale with the host's reason ("Saved under an earlier citation rule; read the Opinion again to bring it current."), its Bring is refused with it, and every other kind is as saved. Reading the Opinion again cites it under this build's rule. |
| 33 | Board names (2026-10-22) | **The writer's call: name saved boards**, to record the model and the chapter version (a name such as "3.2.1 - after the cut - model B"). Saves stay automatic and silent; a name is optional, and can be added or changed at any time. **A name belongs to the board**: its retained id and that board's saves. Naming the board on screen, or the row that holds it, names the retained board, so its later automatic saves carry the name; "Read the current text" builds a new board, which starts unnamed; naming a row that is not on screen changes only that file; Open and restore bring a name back. **A rename rewrites that file in place**, atomically, and never a file the store cannot read; the last rename wins. Format 1 gains an optional `board.name` (still `formatVersion: 1`: format 1 has not shipped): trimmed, one line, at most 120 characters, empty for unnamed; a name in a hand-edited file that does not read is left out and counted, and the board opens whole (decision 32's writer-data rule). Every row also names the models that read it, from the groups' provider-reported model. Session-only, the name lasts as long as the session, and the rail says so. A name is writer text: never logged (Slice 5A.1) |
| 34 | The changed-file notice above the board (2026-10-22) | **Writer: yes.** The notice that a snapshot's file now holds another text, with **Read the current text**, also shows above the board itself, not only at the top of the Boards rail. One source of truth: both come from the same shelf, so they appear and go together, under the same ordering guards (PR #163 F-02, F-05) (Slice 5A.1) |
| 35 | A spark set aside saves at once (2026-10-22) | **Writer: yes.** "Not for me", and its Undo, update the file that holds the board on screen in place, through the rename's rewrite: no new timestamped file, so no new row. A board no file holds yet, or one kept for the session only, takes the mark with its next save, as before (Slice 5A.1; the 5A tech debt closes) |
| 36 | Stopped and partial runs keep saving (2026-10-22) | **Writer: yes**, confirming decision 27's default: a run that ends with at least one group back saves, whether it finished, was stopped, or had a group fail. No code change (Slice 5A.1) |
| 37 | Asks, not gates (2026-10-23) | **The writer: "If the model returns more then just show it."** Every length and count a Lightbox prompt states is an **ask**, raised by about a quarter to a third (notes 120 → 160, labels 60 → 80, claims 320 → 400, friction 280 → 360, sparks and quotes 240 → 300, the synopsis 320 characters and 4 sentences → 400 and 5, the Opinion's and steering's fields alike). A field longer than asked, or more quotes, beats, threads, motifs, items or sentences than asked, is **shown**, never withheld: no block, no item, no field, in groups A–G. What still withholds is a real fault: a missing field, a wrong type, a value outside its vocabulary, fewer items than a stated minimum, a quote the verifier cannot find, an unknown key, or a structural rule (one score per ribbon column, movements tiling the chapter, one example per note, a figure read once). **One safety ceiling**, never in a prompt, for free prose only: a claim, gist, note or friction past eight times its ask is clipped with an ellipsis, counted and logged, never withheld; a quote, a term, a key, an example and every field a text rule checks are read and checked whole, never clipped (PR #165 F-01). **A surface with real bounds clips there**: Bring to Workshop clips a title, claim, point, quote or steering example to the Workshop's own bounds with an ellipsis, and the Build lens seed its field and metaphor. Saved boards (format 1) already read any length (Slice 4H) |
| 38 | The output ceiling (2026-10-23) | **12,000 output tokens a group** (was 8,000), and the whole response the prompt asks for **48,000 characters** (was 32,000), keeping the ratio, for every group, F and G included. The fit check reserves 12,000 for the reply. The estimate's price is unchanged: it prices what a reply typically runs to, not the ceiling (Slice 4H) |
| 39 | Repair before rejecting (2026-10-23) | A group's JSON that `JSON.parse` refuses is first given a **deterministic, structure-only repair**, no model call: stray closing brackets after the root (the writer's real case, group E closing with `}}}`), trailing commas, a code fence, missing closing brackets when the reply stopped with its frame closed, and curly quotation marks used as a string's delimiters, only where safe. **The content guard:** both texts are tokenized and their strings and other scalars must be identical, or the repair is refused and the reply rejected and saved as before. A reply with no closing sentinel whose JSON is complete is accepted. Each repair is logged by its kind, never with text. **The writer's addendum:** the repair is a **reusable, feature-agnostic parser** (`@parsers/ModelJsonRepair`), wired into the Lightbox only for now; the four Workshop widget call sites adopt it later ([tech debt](../../tech-debt/2026-10-23-widget-model-json-repair-adoption.md)). A small model asked to repair syntax ("Tier 2") is a follow-up, built only if the logs show rejections this pass cannot read (Slice 4H) |
| 40 | A reply cut off at the output ceiling (2026-10-23) | **Salvaged, no longer failed.** The blocks it finished are read; the block it was cut inside is withheld with the host's reason ("The reply reached the output ceiling before this block finished.") and where the paid reply was saved; lenses it never reached are reported as any missing lens is. The repair may only close brackets, and the cut block is dropped, never trusted. The paid body is still saved for recovery, with its group's own contract (Slice 4H) |
| 41 | The run vocabulary (2026-10-23) | **The writer: "Can we change the wording of 'Read The Chapter' > 'Run AI Analyses' and keep the orange blaring color when it switches to 're-analyze' or 'finish'"**. The run line says **Run AI analyses** before any run, **Finish** while a call with a lens on is not back (stopped, failed or never run) and **Re-analyze** once every one landed, each in the primary (orange) style with the sparkle and its cost; "Analyzing… 2 of 7 calls back" while one runs. A widget says **Analyze**, **Re-analyze** or **Analyzing…**; a call in the Lenses panel **Run A** or **Rerun A** (the writer's word there). A placeholder says "Not analyzed yet." and its shimmer "Analyzing…". Copy that named the old buttons names the new ones ("Press Finish or Analyze to try again"); "reading" stays where it means the register, a reading versus a count (Slice 4I) |
| 42 | One call, run on its own (2026-10-23) | A run scope of its own, `{ mode: 'group', group, lens? }`: **the host resolves what it reads**, the call's lenses that are on plus the lens named even when it is off; the webview never names a list of lenses. A lens of another call, a group that is no model call (Measure) or an unknown mode is refused before anything is reserved. **A re-run replaces the call**, cleared first, as a full run does (the Opinion keeps its old one until the new one lands: decision 47); the per-lens re-read is unchanged. Group G alone needs nothing read first. Each call's price is the estimate's own entry for its group. The press, adoption and observation guards and one run at a time hold (ADR D6 addendum, 2026-10-23; Slice 4I) |
| 43 | A widget's Analyze (2026-10-23) | **The writer: "On the individual widgets switch to 'Analyze' and make it a button that kicks off the call(s) associated with that widget… make the widget allow for a re-run of that call."** Every AI-read widget's header carries a button that runs **its call**: the call's checked lenses plus the widget's own lens even if unchecked (the writer's call); unchecked lenses in the call stay skipped. It replaces the bare "READ" badge; a "COUNTED · READ" widget keeps a "COUNTED" chip beside it; a measured one has none. Disabled with its reason while another run is going; focusable, its accessible name starting with its visible label, then the call, its lenses and its price ("Analyze, call B: Characters, Voice, Subtext · ≈ $0.04"; PR #166 N-01), its cost small beside the label (Slice 4I) |
| 44 | The Opinion's Analyze (2026-10-23) | **The writer's call: it runs only the Opinion call (F) over whatever is on the board now.** While nothing on the board is read and current, the button is disabled and says so in the Opinion's existing words, and the host refuses the same press with them; priced "≈" like every call, an approximate total and never a cap, its name and tooltip adding "input at digest limit" (PR #166 F-01). It replaces the tile's own "Re-read the Opinion" (Slice 4I) |
| 45 | The Lenses panel's Run buttons (2026-10-23) | **The writer: "The lenses 'Call A,B' should be buttons that can Run, ReRun that call."** One button per call, in a small header above the call's lenses ("CALL A … Run A ≈ $0.07"), not one per lens; **Run A** before the call holds a reading, **Rerun A** after; it reads the call's checked lenses. Tooltip and accessible name: "Run A, call A: Headline, Theme & motif, … · ≈ $0.07", the visible label first (Slice 4I; PR #166 N-01) |
| 46 | Saved boards in the Workshop's design language (2026-10-23) | **The writer: "match the user experience in workshop so we speak the same design language across tabs", without a `current.json`, and not a side panel that grows with every file analyzed.** **One file per board:** its first save names it `<source file name> - <M/D/YYYY h:mm AM/PM>` (local time, "Chapter 6 - 10/23/2026 9:08 AM") and its later saves (readings, a spark set aside, a rename) rewrite that file in place, atomically, and only at the revision the window last read or wrote; "Read the current text" starts a new board, file and dated name. A file that cannot be rewritten (changed or held by another window, a part left out, gone, or a failed write) is left as it is, and the board saves to a new file and follows it. A file saved before names shows the default its source and time give, unrewritten. **The Boards side panel is gone.** A **Boards menu** in the header, the Workshop's sessions menu made shared: Rename board…, Board another chapter…, Open prior board…, the five newest boards of every chapter, Browse all boards…. The Workshop's session browser, made shared, lists **every chapter's** boards (name, chapter, saved time, lenses, cost, models, On screen), searched by name and chapter path and grouped by date or by chapter, with inline rename and delete with a confirm. **Open a board file…** opens any `*.board.json` through the system picker: the store's own by its id; any other as a snapshot that is never written, whose next save writes a new file in the store, keeping its id and name. The changed-file notice stays above the board; session-only is said in the menu and the browser. Two text versions of a chapter are two boards, which Compare (5B) reads (Slice 5A.2) |
| 47 | The Opinion keeps its reading until a new one lands (2026-10-23) | **The writer: keep the old Opinion until the new one lands.** When the Opinion's call runs on its own (its Analyze or Re-analyze, Run F or Rerun F), the old Opinion is not cleared when it starts: it stays in view, said to be the earlier one ("Analyzing… This is the earlier Opinion until the new one lands."), until the new one replaces it whole. If the call fails or is stopped, the old Opinion stays exactly as it was, standing and stale marks included, with the reason beside it, and the board saved after a failure still holds it. The host takes the per-lens re-read's path (`lightboxPressKeptLens`). Only the Opinion: every other call run on its own is still cleared first, and a run of several calls still clears the Opinion with the rest (Slice 4I; PR #166) |
| 48 | One verb for an AI run (2026-10-23) | **The writer: rename "Re-read this tile" to "Re-analyze this tile".** The inspector's button, its disabled reasons and the copy that sends the writer to it say "re-analyze", so the verb for an AI run is the same everywhere. "Re-read file" keeps its words: it reads the chapter file, not the model (Slice 4I; PR #166) |

## Slices

| # | Slice | Outcome | Status |
|---|---|---|---|
| 0 | Spec | ADR, this epic, design snapshot | In review |
| 1 | [Shared full-tab shell](slice-1-shared-full-tab-shell.md) | Workshop header, banner and rail frame extracted into a shared shell with slots, a full-tab style scope, and an exhaustive surface map; the Workshop renders through it with no behavior change | Merged (PR #147) |
| 2A | [Lightbox tab and the counted board](slice-2a-tab-and-counted-board.md) | Panel and serializer, command, `lightbox` surface in the shared bundle, `lightbox` message domain, source panel, paragraph model, measured tiles, ribbon, inspector, word ceiling | Merged (PR #148) |
| 2B | [First readings](slice-2b-first-readings.md) | Prompt bundle, reading codec, quote verifier, press with preflight and cost, streaming groups, cancellation; genre, motifs, characters, voice | Merged (PR #149) |
| 3 | [Lexical gravity and palette](slice-3-lexical-gravity-and-palette.md) | Borrowed-field detection with counted hits, degrees, collisions and literal set-asides; palette clusters and swatches; **Build as a lens** handoff to Lexical Gravity | Merged (PR #150) |
| 4 | [Lineage, subtext, Spark, Bring to Workshop](slice-4-lineage-subtext-spark-bring.md) | The remaining readings, the Spark lane, and the host-mediated handoff that stages tiles in the Workshop composer | Merged (PR #151) |
| 4B | [Craft lenses (Group D)](slice-4b-craft-lenses.md) | Stock & signature (tiers counted from classified beats, familiar phrasing counted, air-locks, echoes), Rhythm & handoffs (measured sentence lengths, read endings, adjacent-sentence handoffs), What stands out in the numbers (measured standouts against ranges and the writer's own average, with how each is used) | Merged (PR #155) |
| 4C | [Story lenses (Group E)](slice-4c-story-lenses.md) | Template & freshness (with engagement per movement and a counted basis), Pressure, Artifacts, Summary & movements, and a measured Sections lane | Merged (PR #156) |
| 4D | [Opinion (Group F)](slice-4d-opinion.md) | The one evaluative tile: three views over one set of observations that cite the board, run last on the verified digest | Merged (PR #157) |
| 4E | [Reading aids in the inspector](slice-4e-inspector-aids.md) | Measured only: a pinned paragraph's text, the sentences a counted item stands in, and the hapax list, with counts that agree by construction; plural count strings | Merged (PR #159) |
| 4F | [Craft steering (Group G)](slice-4f-craft-steering.md) | Being verbs, adverbs and intensifiers measured by construction, then read per figure with instance notes (Earns · Leans · Compensates) and nudges that name the craft move; the numbers lens stops reading those three | Merged (PR #160) |
| 4G | [Being-verb contractions and dialogue as voice](slice-4g-being-contractions.md) | Contractions of be counted by the one shared detector (decision 26); craft steering's notes on dialogue keep their stance but carry no nudge or example, by a host rule fresh, on carry and at Bring | Merged (PR #162, at `3e6a156`) |
| 5A | [Saved boards](slice-5-saved-boards-and-compare.md#slice-5a-saved-boards) | The Opinion's data basis first (decision 25); `prose-minion/boards/` files in format 1 with their sources, text and rule ids; saved after a run and on a source's first measured board; the Boards rail (open, delete); open as a snapshot with the changed-file notice; the last board back after a reload (decisions 27–32) | Merged (PR #163, at `3e5c3a1`) |
| 5A.1 | [Board names and the writer's calls](slice-5-saved-boards-and-compare.md#slice-5a1-board-names-and-the-writers-calls) | Optional board names in format 1, renamed in place from the rail; the models that read each board; the changed-file notice above the board; a spark set aside saved at once; stopped and partial runs keep saving (decisions 33–36) | Merged (PR #164, at `a57a5cd`) |
| 4H | [Reading tolerance](slice-4h-reading-tolerance.md) | Asks raised and overruns shown, not withheld (one safety ceiling; Bring clips at the Workshop's bounds); a 12,000-token output ceiling; a structure-only JSON repair with a content guard, in a shared parser; a reply cut off at the ceiling salvaged; the recovery file names its group's own contract (decisions 37–40) | Merged (PR #165, at `08b0d22`) |
| 4I | [Run controls](slice-4i-run-controls.md) | The run line's "Run AI analyses", "Finish" and "Re-analyze", all orange; a `group` run scope the host resolves (a call's checked lenses plus the widget's own); every AI-read widget's Analyze / Re-analyze / Analyzing…; the Opinion's Analyze, disabled with its own reason until a call has landed; one Run / Rerun per call in the Lenses panel (decisions 41–45) | Merged (PR #166, at `fcf86ff`) |
| 5A.2 | [Saved boards in the Workshop's design language](slice-5-saved-boards-and-compare.md#slice-5a2-saved-boards-in-the-workshops-design-language) | One file per board, named by date at its first save and rewritten in place; the Boards menu and the Workshop's session browser, made shared, over every chapter's boards; "Open a board file…"; the Boards panel removed (decision 46) | Built on `epic/lightbox-boards-browser`, with 4H and 4I merged in; PR #167 open, its review's seven findings corrected |
| 5B | [Draft compare](slice-5-saved-boards-and-compare.md#slice-5b-draft-compare-a-later-pr) | Compare two saved boards of one source (two boards are two text versions, decision 46): measured deltas, tension ticks, what appeared or vanished, a drift line; labelled approximate across paragraph counts and rule ids. No format change | Planned (after 5A.2) |
| 6 | Verify live | Extension Development Host pass on real chapters; ADR → Accepted | Pending (needs a human with VS Code) |

Slice 1 must land first: Slice 2A renders inside the shell. Slice 2A defines
the board contract and paragraph model that every later slice extends. Slices
3 and 4 are independent of each other once 2B exists. Slice 5 goes last on
purpose, so the board's shape has been reviewed on real chapters before it
becomes a file format.
Slices 4B, 4C and 4D are stacked in that order (4C joins 4B's tier counts
for the freshness basis; 4D reads every other group's tiles), and all three
land before Slice 5 (decision 14). Slice 4F (Craft steering) starts from the
merged 4D; it reads its own figures, takes three of them from 4B's numbers
lens, and adds its items to 4D's digest.

## Verification (every slice)

- `npm run typecheck`, `npm run lint` (no new warnings), `npx jest` (full suite)
- `packages/core/src` has no `from 'vscode'` (the architecture tests guard this)
- New modules stay under 500 lines, and new Lightbox modules join the
  boundary lists in `boundaries.test.ts` (ADR D13)
- Slices 2B–4: prompt and codec tests run against public-domain fixture prose.
  No manuscript text is committed.

## Completion criteria

- Opening a chapter shows the counted board without a model call or a cost.
- One press, with its call count and estimated cost stated first, adds the
  readings in three groups. Cancelling keeps the groups already back.
- Every reading claim shows at least one quote with a paragraph address, and
  code has verified each quote against that paragraph. A claim whose quote
  fails is withheld, by name. Every lens shows where it strains.
- Text over the word ceiling, or too large for the model's context window, is
  refused with a reason before anything is sent. Nothing is silently
  truncated or chunked.
- Hovering any tile lights the paragraphs it touches on the ribbon.
- Bring to Workshop and Build as a lens open the Workshop with the item
  staged, through the Workshop's own message path.
- Boards save to and reopen from `prose-minion/boards/`, and Compare shows
  what moved between two boards of the same file.
- Each behavior above has a focused test.

## Progress notes

- **2026-10-19. Slice 0.** Brainstorm, then an interactive design on a Claude
  Design canvas (copied to `docs/design/lightbox/`). The writer made the
  decisions in the table above and asked for a word ceiling ("something like
  50K words"); see ADR D8. Lexical gravity was added to the design at the
  writer's request and lands in Slice 3 with the handoff to the existing
  Lexical Gravity widget.
  - **Research findings that changed the plan:**
    - **No new entry bundle.** The Lightbox is a third surface in the shared
      bundle (ADR 2026-07-03), and the binary surface branches become
      exhaustive maps (D1).
    - **Own routes for excerpt and context.** The Workshop's excerpt and
      context panels are views over the one Workshop session, so the Lightbox
      gets its own `LIGHTBOX_*` routes (D10).
    - **Handoffs reuse `seedExcerpt`.** Both handoffs follow its pattern:
      through the Workshop panel's own handler (D11).
    - **Dialogue % ignores curly quotes.** It is now a prerequisite of Slice
      2A ([tech debt](../../tech-debt/2026-10-19-prose-stats-dialogue-curly-quotes.md)).
    - **Tracked as tech debt:** every webview builds every domain
      ([tech debt](../../tech-debt/2026-10-19-per-surface-message-handler-routes.md)).
  - **Word ceiling:** 50,000 words. It matches the existing
    `sourceDocument` and `contextFiles` budgets. There is a 12,000-word
    "book-sized" cost warning, a context-window fit check before the press,
    and no silent truncation (D8).
- **2026-10-19. Prerequisite: dialogue % and curly quotes.** Fixed on
  `epic/lightbox-prereq-dialogue-quotes`. Astra approved it with no
  findings, and it merged as PR #146
  ([tech debt](../../tech-debt/2026-10-19-prose-stats-dialogue-curly-quotes.md)).
  - **One matcher:** `@/utils/dialogueSpans` (`findDialogueSpans`,
    `countDialogueWords`) matches straight `"…"` and curly `“…”` double
    quotes, mixed freely. No span crosses a paragraph break, so a stray quote
    mislabels at most the rest of its paragraph, and per-paragraph counts sum
    to the whole-text count. `PassageProseStats` now uses it. Slice 2A's
    per-paragraph dialogue share must call the same functions.
  - **Not matched:** single-quoted dialogue (`‘…’`) collides with apostrophes
    and elisions, so it is split into
    [its own tech debt](../../tech-debt/2026-10-19-dialogue-single-quote-convention.md).
  - **Effect:** a curly-quoted test scene went from 0% to 59.1% dialogue.
    Straight-quoted text whose quotes balance within each paragraph reports
    exactly what it did before; tests check this against the old regex.
  - **Verification:** `npm run typecheck` clean; `npx jest` 316 suites /
    4,742 tests / 2 snapshots (baseline 315 / 4,702 / 2); `npm run lint`
    0 errors / 1,140 warnings (unchanged); `npm run build` OK.

- **2026-10-19. Slice 1 (shared full-tab shell).** Built on
  `epic/lightbox-slice-1-shell` in four commits:
  1. **`useFullTabChrome`** (`hooks/fulltab/`). The generic frame state
     moves here: models, tokens, balance, API-key status, the two mount
     requests and the settings opener. It comes with
     `buildFullTabChromeRoutes`, which the Workshop router now merges.
     The envelope source is a parameter, and so is `useStartupNotice`'s.
  2. **The shell components** (`components/fulltab/`): `FullTabShell`,
     `FullTabRail`, `FullTabHeaderStatus` and `ProviderPausedBanner`. The
     Workshop renders through them with an identical DOM.
  3. **An exhaustive surface map.** `WebviewSurface` gains `lightbox`, and
     `Record<WebviewSurface, …>` maps replace the branches in
     `webviewHtml.ts` and `index.tsx`. Full tabs also stamp
     `data-pm-frame="fulltab"`. A placeholder `LightboxApp` renders on the
     shell.
  4. **The frame styles move** to `styles/fulltab/`, rescoped to
     `[data-pm-frame="fulltab"]`. `index.tsx` imports them ahead of every
     root.
  - **Verification.** Before → after:

    | Check | Before | After |
    |---|---|---|
    | Jest | 315 suites, 4,702 tests, 2 snapshots | 320 suites, 4,736 tests, 2 snapshots |
    | Lint | 0 errors, 1,140 warnings | 0 errors, 1,140 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - The lint warnings match per file and per rule. New React components
      carry the existing "React components are PascalCase" disable.
    - `WorkshopApp.tsx` went from 1,822 to 1,736 lines.
    - Headless Chromium against the built bundles, with the loading, empty,
      excerpt-pinned and provider-paused states at 1440, 1000 and 500 px:
      - The Workshop DOM is identical to the pre-slice bundle, apart from the
        frame stamp on #root.
      - The screenshots match within run-to-run raster noise.
      - At runtime the frame sheets load before the Workshop's, and
        `index.css` stays last.
  - **Beyond or unlike the plan** (details in the
    [slice doc](slice-1-shared-full-tab-shell.md#implementation-notes-2026-10-19)):
    - **Transcript export.** The HTML export mirrors thread CSS verbatim
      (ADR 2026-10-05), so its mirror was regenerated with two frame layers,
      and its `<body>` now also stamps `data-pm-frame="fulltab"`. Two export
      tests and the mirror's layer-order test changed their expectations to
      match.
    - **Balance title.** The derivation lives in `FullTabHeaderStatus`
      (`fullTabBalanceTitle`), as the slice says, rather than in the hook,
      as D2 lists.
    - **Shell props.** The shell also takes overlays as `children` and an
      `onBoundaryError`.
    - **Tokens.** The Workshop's participant identity tokens stay
      Workshop-scoped.
    - **New aside CSS.** An optional aside column was added and is unused
      until Slice 2A.
  - **Follow-ups:**
    - **Slice 2A rail cards.** The rail section cards (`.pm-ws-block*`) are
      still Workshop-scoped. Move them to the frame when the Lightbox rail
      needs them.
    - **Slice 2A aside.** Tune the aside column for the inspector.
    - **`AGENTS.md`.** Done in this PR: the presentation tree lists
      `hooks/fulltab/`, and a convention note covers the shell, the
      `data-pm-frame` scope and the surface map.
    - **Slice 6.** Recheck the Workshop header, banners, Sessions menu and
      model browser in the Extension Development Host.
    - **Tech debt:**
      - [the transcript export mirror's cascade order](../../tech-debt/2026-10-19-transcript-export-mirror-cascade-order.md);
      - [the frame classes' `pm-ws-` prefix](../../tech-debt/2026-10-19-fulltab-frame-class-prefix.md).

- **2026-10-19. Slice 2A (the Lightbox tab and the counted board).** Built
  on `epic/lightbox-slice-2a-board` from the approved Slice 1 head:
  1. **Contracts and the paragraph model.** `messages/lightbox.ts`, six
     `LIGHTBOX_*` routes, `PROMPT_BUDGETS.lightbox` (50,000 / 12,000 / 96),
     and the pure splitter, per-paragraph metrics, content hash and ribbon
     buckets in `infrastructure/lightbox/`.
  2. **`LightboxService`.** The counted board from the three measurement
     services and the standards enrichment, the ceiling refusal, and boards
     kept in memory per source.
  3. **The domain and the tab.** `LightboxHandler` as the thirteenth domain,
     `LightboxPanelProvider` with its serializer, the two commands, the
     context-menu entry, activation events and `uiActions.openLightbox`.
  4. **The frame.** The rail cards move to the frame scope, and the aside is
     tuned for the inspector, including narrow widths.
  5. **The webview.** `LightboxApp` on the shell, `useLightbox`, the focus
     and inspector controllers, the tiles behind an exhaustive renderer map,
     the ribbon, the inspector, and reading placeholders with the Read button
     disabled.
  - **Verification.** Before → after:

    | Check | Before | After |
    |---|---|---|
    | Jest | 321 suites, 4,776 tests, 2 snapshots | 329 suites, 4,881 tests, 2 snapshots |
    | Lint | 0 errors, 1,140 warnings | 0 errors, 1,140 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file and per rule.
    - Visual evidence from real host output in headless Chromium:
      [`lightbox-slice-2a-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-2a-visual/README.md).
      The Workshop's DOM is identical to the Slice 1 bundle, and every
      Workshop shot has a pixel-identical pair across the two bundles.
  - **Beyond or unlike the plan** (details in the
    [slice doc](slice-2a-tab-and-counted-board.md#implementation-notes-2026-10-19)):
    - The board also carries host-bucketed `ribbon` columns, the source's
      kind, lines and preview, and per-paragraph dialogue words.
    - `LightboxTileKind` includes the measured kinds; the reading kinds are
      `never` until 2B.
    - Every refusal (not only the ceiling) goes through
      `LIGHTBOX_SOURCE_REFUSED`.
    - A Lenses rail card holds the persisted lens toggles.
    - The picker reuses `ShellService.pickFile`, which gained an optional
      `openLabel`.
    - Files resolve by absolute path only, to avoid the resolver's
      active-editor fallback.
    - The frame root gains `.pm-ws-with-aside`; the Workshop has no aside and
      is unchanged.
  - **Follow-ups:** 2B (reading kinds, lens toggles to the host, the Read
    button), Slice 6 (commands, context menu, restore and narrow layouts in
    the Extension Development Host), and two tech-debt items:
    [the resolver's active-editor fallback](../../tech-debt/2026-10-19-text-source-active-editor-fallback.md)
    and [contraction fragments in part-of-speech lists](../../tech-debt/2026-10-19-pos-tagger-token-fragments.md).

- **2026-10-19. Slice 2A review fixes (PR #148).** Astra's
  [review](../../../docs/pr-reviews/pr-148-lightbox-counted-board-review.md)
  requested changes for four medium findings; each is fixed in its own
  commit on `epic/lightbox-slice-2a-board`, with regressions, and the author
  response at the end of the review maps them. Ledger statuses stay with
  Astra.
  1. **F-01, source ownership.** The shared `LightboxService` owns source
     intent: a ticket per request, minted before any await (a picked file
     when the picker returns it), and only the newest ticket adopts or
     refuses. Handlers subscribe to the service's outcomes on their
     webview's first `LIGHTBOX_*` message and post only what it publishes,
     so a pending request lands in a replacement panel and a closed panel's
     older request cannot win.
  2. **F-02, refusal replay.** The service keeps the current outcome (the
     board and any undismissed refusal); `LIGHTBOX_BOARD` carries both, and
     `LIGHTBOX_DISMISS_REFUSAL` (by host-minted id) stops a refusal
     returning.
  3. **F-03, POS provenance.** The word-frequency tool exposes its tagged
     occurrence stream with offsets; the board counts and places parts of
     speech from it, keyed by word and part of speech. Metrics' output is
     byte-identical; on all twelve Alice chapters the board's POS lists
     equal Metrics' and every count equals its placed occurrences.
     Per-paragraph tagging was rejected: it changes tags where a heading
     runs into the next paragraph.
  4. **F-04, inspector addresses.** 48 chips per page behind a keyboard
     pager with a jump to a paragraph number; paging never changes the pin.
  - **Nonblocking:** retained boards are keyed by the document URI.
  - **Verification.** Review head (`23c3f47`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 329 suites, 4,881 tests, 2 snapshots | 333 suites, 4,921 tests, 2 snapshots |
    | Lint | 0 errors, 1,140 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint: no new warning in any file; `curly` falls by five where the
      word-frequency tool's inline POS block was replaced.
    - Visual evidence: a `paged` state (a 347-paragraph pin, jumped to its
      last address) at 1440, 1000 and 500 px in
      [`lightbox-slice-2a-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-2a-visual/README.md#pr-148-review-fixes-2026-10-19);
      the earlier Lightbox shots re-render unchanged.

- **2026-10-19. Slice 2B (first readings).** Built on
  `epic/lightbox-slice-2b-readings` from the Slice 2A branch; the PR #148
  review fixes and then `epic/lightbox` were merged in, conflicts resolved in
  favor of the fixed 2A behavior.
  1. **Contracts.** `messages/lightboxReadings.ts` (reading tiles, groups,
     withheld quotes, claims and blocks, the estimate, runs, context files),
     nine `LIGHTBOX_*` message types, and the remaining `PROMPT_BUDGETS.lightbox`
     numbers.
  2. **Prompts, codec, verifier.** The `lightbox/` prompt bundle (shared
     rules, six lens files, a worked example per group), a per-block codec,
     the quote verifier and the host term counter.
  3. **Runs.** `LightboxReadingRunner` (three groups in parallel on the
     assistant model, a timeout per group, quarantine), the fit and cost
     estimate, the context shelf, and `LightboxReadingHandler` beside
     `LightboxHandler`. Results attach to the service's board id and reach
     webviews only as the service's `readings` outcomes for the current
     board.
  4. **The webview.** The run line, the reading tiles, the tension lane,
     skeletons, the inspector's evidence with "Re-read this tile", the rail's
     context list, and lens toggles that drive the estimate.
  5. **PR #148 review F-05 (Low, nonblocking): addressed.** Every explicit
     "Go to ¶" jump focuses its landing chip, a repeated jump to the same
     chip included; a board update moves no focus. Both repeat cases are
     tests.
  - **Verification.** `epic/lightbox` (`3e6eba3`) → this branch:

    | Check | Before | After |
    |---|---|---|
    | Jest | 333 suites, 4,921 tests, 2 snapshots | 344 suites, 5,058 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file and per rule.
    - No live or billable call was made: every reading test plays the
      provider with the worked examples.
    - Visual evidence from real host output in headless Chromium:
      [`lightbox-slice-2b-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-2b-visual/README.md)
      (idle with the estimate, running with group A back, done with a pinned
      motif's verified and withheld quotes and friction, and too large, at
      1440, 1000 and 500 px). No page errors and no horizontal overflow.
  - **Decisions** (details in the
    [slice doc](slice-2b-first-readings.md#implementation-notes-2026-10-19)):
    - Open question 3: tension is scored per ribbon column. The whole Alice
      book would need 815 scores per paragraph against 96 per column.
    - Open question 1: not measured (no live calls); the groups run in
      parallel, and the measurement moves to Slice 6.
  - **Beyond or unlike the plan:**
    - A seventh reading kind, `reader-promise`, holds the genre lens's
      promise with its own evidence.
    - Groups also carry withheld claims and each lens's friction, so an
      empty lens still says where it strains.
    - Context has its own add, remove and list routes; the estimate carries
      the board's active run.
    - The estimate against the processed chip ("Done when") is not recorded,
      for the same reason as open question 1.
    - Progress now carries the streamed characters through each group and
      the finish, and a rejected frame's logged reason names unknown fields
      briefly.
- **2026-10-19. Slice 2B: PR #149 review fixes.** All eight findings of the
  [review](../../../docs/pr-reviews/pr-149-lightbox-first-readings-review.md)
  are fixed on `epic/lightbox-slice-2b-readings`, one commit each; the
  author response at the end of the review maps commits to tests.
  1. **F-02, a press owns what was priced.** The estimate carries a key
     naming every input it priced (board and content hash, lenses on,
     context shelf revision, model, window, prices); the press names it.
     The runner reserves the board under a minted token before the prompt
     files load; closing the tab releases it, and the engine starts only if
     the reservation holds and the live key is unchanged. Otherwise nothing
     is sent and the webview re-estimates.
  2. **F-03, correlation.** Estimates answer webview-minted request ids;
     only the latest reply for the board asked about is usable, and the
     host never posts one unasked. Runs and progress are kept per board and
     token, and Stop names the board's own run.
  3. **F-01, quote spans.** The fold maps every UTF-16 code unit, units
     follow whole-string NFKC, and a match must land on unit boundaries and
     fold back to what matched.
  4. **F-04, withheld headline.** Shown under the plain heading with its
     reason, as are a withheld headline block and a failed call.
  5. **F-05, diagnostics.** Output and the board carry host-owned words
     only: call failures are closed categories, undefined fields are
     counted; field names reach only the recovery store, beside the body.
  6. **Nonblocking F-06–F-08.** A near miss needs its explanation; the
     tally counts every quote checked, per lens; a tile's re-read is
     disabled with its reason when it cannot run.
  - **Verification.** Review head (`9ad4e34`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 344 suites, 5,058 tests, 2 snapshots | 349 suites, 5,115 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file, rule and message.
    - No live or billable call: every test plays the provider.
    - Visual evidence: `headline-withheld` and `reread-off` at 1440, 1000
      and 500 px in
      [`lightbox-slice-2b-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-2b-visual/README.md#pr-149-review-fixes-2026-10-19);
      the earlier shots re-render unchanged (anti-aliasing only).
  - **Unchanged on purpose:** D4 stale readings and the live-provider pass
    stay deferred as recorded; the Slice 2B scope is otherwise unchanged.
  - **Follow-ups:** Slice 6's live pass (cache reads, the estimate ratio,
    contract adherence) and stale readings on a changed chapter (D4), in
    [the live-provider pass](../../tech-debt/2026-10-19-lightbox-live-provider-pass.md)
    and [stale readings](../../archive/tech-debt/2026-10-19-lightbox-stale-readings.md) (resolved in Slice 3).

- **2026-10-19. Slice 2B: PR #149 re-review fixes.** The
  [re-review](../../../docs/pr-reviews/pr-149-lightbox-first-readings-review.md)
  kept F-03 open for the model selection and added F-09; both are fixed on
  `epic/lightbox-slice-2b-readings`, and the author response to the
  re-review maps them to commits and tests.
  1. **F-03, the selected and confirmed model.** An estimate is usable
     only when it priced the model the writer selected and the host has
     confirmed that selection (`MODEL_DATA`); Read waits while it saves.
     A reply that priced another model is refused even when it answers the
     latest request, every confirmation asks again (price-only refreshes
     included), and a press names its model, which the host checks.
  2. **F-09, whole-string NFKC.** Quote units are built within runs cut
     before code points below U+0300; a run whose pairwise units disagree
     with its own NFKC is kept whole.
  3. **Recorded, not changed:** the engine's verbatim provider
     `error_type` log after an interrupted stream, in
     [tech debt](../../tech-debt/2026-10-19-agent-run-engine-provider-error-log.md).
  - **Verification.** Re-review head (`b5350a1`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 349 suites, 5,115 tests, 2 snapshots | 350 suites, 5,123 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file, rule and message.
    - No live or billable call: every test plays the provider.
    - Visual evidence: the recorded states rebuild byte-identical and all
      twenty shots re-render pixel-identical, so none changed.
- **2026-10-19. Slice 2B: PR #149 second re-review fix.** The
  [second re-review](../../../docs/pr-reviews/pr-149-lightbox-first-readings-review.md)
  found F-01 to F-09 addressed and one new blocking finding, F-10, from the
  F-09 repair; it is fixed on `epic/lightbox-slice-2b-readings`, and the
  author response to the second re-review maps it to commits and tests.
  1. **F-10, long runs.** Quote units are appended one by one, never
     spread into a call, so a long CJK paragraph no longer throws while
     the verifier is built.
  2. **F-10, every started run finishes.** A setup failure fails every
     group with nothing sent, a reply check that throws fails its group
     alone, a throwing listener is logged; the run is released and
     finished, and `done` never rejects.
  3. **Recorded, not changed:** word frequency's part-of-speech tokenizer
     is quadratic on a long unbroken run of ASCII word characters, in
     [tech debt](../../tech-debt/2026-10-19-pos-tagger-long-token-backtracking.md).
  - **Verification.** Second re-review head (`b1200f0`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 350 suites, 5,123 tests, 2 snapshots | 352 suites, 5,135 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file, rule and message.
    - No live or billable call: every test plays the provider.
    - Visual evidence: `webview.js` is byte-identical and the recorded
      states rebuild byte-identical, so no shot changed.

- **2026-10-19. Slice 3 (lexical gravity and palette).** Built on
  `epic/lightbox-slice-3-gravity` from the Slice 2B branch; the PR #149
  review fixes and then `epic/lightbox` were merged in, conflicts resolved in
  favor of the fixed 2B behavior.
  1. **Stale readings first (D4).** A board rebuilt from changed text keeps
     its readings, each lens marked stale with the hash it was read against;
     every quote is checked again (kept, moved with its paragraph, or
     withheld as no longer in the chapter), every count recounted, and the
     tally counts each quote now gone as withheld. Re-reading a lens clears
     its mark. The
     [tech debt](../../archive/tech-debt/2026-10-19-lightbox-stale-readings.md)
     is archived as resolved.
  2. **Two group A lenses.** `13-lexical-gravity.md` and `14-palette.md`,
     group A's worked example extended to both, five new tile kinds through
     `LIGHTBOX_TILE_REGISTER`, their bounds pinned to the prompts. The host
     counts every term, hit, degree split and drift; the model gives none.
     A field under three hits is drawn below the gravity line, not dropped.
  3. **Build as a lens (D11).** `LIGHTBOX_HAND_OFF` names a board item; the
     host checks the board and the file's hash, refuses a stale, re-reading
     or withheld field, re-checks its quotes, recounts its terms and hands a
     bounded seed to `uiActions.handOffToWorkshop`. `extension.ts` routes it
     through the Workshop panel's own `MessageHandler` as a synthetic
     `WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD`, a direct route of the Lexical
     Gravity handler; the Workshop opens Build lens prefilled and builds
     nothing until the writer presses Build.
  4. **The webview.** The gravity tile (orbit, field rows, degree bars,
     collisions, set-asides), the palette tile, the inspector's "By degree"
     rows and Build as a lens, lens toggles in the rail.
  - **Verification.** Slice 2B with its PR #149 fixes (`bf8f1ca`) → this
    branch:

    | Check | Before | After |
    |---|---|---|
    | Jest | 349 suites, 5,115 tests, 2 snapshots | 357 suites, 5,175 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file and per rule.
    - No live or billable call: every reading test, and the evidence, plays
      the provider with worked examples.
    - Visual evidence from real host output in headless Chromium:
      [`lightbox-slice-3-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-3-visual/README.md)
      (gravity, palette, a pinned field, the handoff's answer and a stale
      board at 1440, 1000 and 500 px, and the Workshop with Build lens
      prefilled). No page errors and no horizontal overflow.
  - **Beyond or unlike the plan** (details in the
    [slice doc](slice-3-lexical-gravity-and-palette.md#implementation-notes-2026-10-19)):
    - The handoff names only `{ boardId, fieldId }`; the host resolves the
      field, metaphor and terms.
    - Build lens takes one subject, so the counted terms ride in it, and a
      banner shows the full seed. The build contract is unchanged.
    - The new Workshop route is direct: opening the sheet changes no
      session state.
  - **Follow-ups:**
    [a reading in flight when the chapter changes](../../tech-debt/2026-10-19-lightbox-forward-in-flight-readings.md)
    and [one home for the codec's field decoders](../../archive/tech-debt/2026-10-19-lightbox-codec-shared-field-decoders.md),
    both Low; the two lenses join Slice 6's live pass.

- **2026-10-19. Slice 3: PR #150 review fixes.** Astra's
  [review](../../../docs/pr-reviews/pr-150-lightbox-lexical-gravity-review.md)
  requested changes with six Medium/P2 findings; all six are fixed on
  `epic/lightbox-slice-3-gravity`, one commit each, and the author response
  maps them to commits and tests. Every new test fails on the reviewed head.
  1. **F-01, no implicit lens.** A Build opening handed over from the
     Lightbox has no lens until the writer adds a built take or picks a
     library lens; Preview and Install wait for that choice, and the banner
     says what building, saving and installing each take. A production-root
     test drives Apply through the real standing-directive handler, service
     and session.
  2. **F-02, never over an open sheet.** Workshop overlays form one stack:
     Escape closes only the top one, and a seed that arrives while any is
     open is refused and dropped, never covering Add text, the editors or
     the browsers.
  3. **F-03, seeds bound to their panel.** The provider delivers a seed
     once, to the panel that accepted it, listening and visible; a newer
     seed replaces it and closing cancels it. The Workshop answers opened
     or busy, and the Lightbox says "Opened" only on that answer, with a
     20-second timeout.
  4. **F-04, the shared sentence.** A collision is drawn only when one
     sentence of a found quote (the prose-stats sentence rule) holds a term
     of each field, and the card shows that sentence.
  5. **F-05, one set of gates.** Fresh assembly and stale carry share
     `LightboxTileGates`, with host-owned reasons, so a carried collision
     without a witness and palette tiles whose words are gone are withheld
     as a fresh reading would withhold them.
  6. **F-06, tension by paragraph.** Tension scores are keyed by each
     column's text as read; a carried score stays on unchanged paragraphs
     only, and the headline, tension caption and lane say they are stale.
  - **Merged:** `epic/lightbox` at `c6d4411` (PR #149), with Slice 3's
    column keys re-applied in 2B's split runner.
  - **Verification.** Reviewed head (`4150c8c`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 357 suites, 5,175 tests, 2 snapshots | 367 suites, 5,237 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match `c6d4411` per file and per rule.
    - No live or billable call: every test, and the evidence, plays the
      provider.
    - Visual evidence regenerated at the merged head:
      [`lightbox-slice-3-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-3-visual/README.md).
  - **Follow-up:** [Lightbox run accounting on its exceptional paths](../../tech-debt/2026-10-19-lightbox-exceptional-path-accounting.md)
    (Low), from PR #149's third re-review.

- **2026-10-20. Launch entry points.** On
  `epic/lightbox-launch-entry-points`, from `epic/lightbox` at `9e5363c`. The
  writer chose all three entry points, and the editor-title icon, for both
  Markdown and plain-text files (decision 8); see ADR D1.
  1. **Sidebar.** A **Lightbox** button beside **Workshop** in the Analysis
     tab posts `OPEN_LIGHTBOX`. `UIHandler` calls `uiActions.openLightbox`,
     or reports a `ui.lightbox` error on a surface without it.
  2. **Open File in Lightbox.** `prose-minion.openFileInLightbox` boards a
     menu's URI, or the active editor's file, as the selection command's
     payload without text, through the same `seedSource`. It appears in the
     Explorer and editor context menus and, as a `$(layout)` icon, in the
     editor title, for saved Markdown and plain-text files. The selection
     command with nothing selected takes the same path.
  3. **Edge cases.** An untitled document is refused, pointing to Open
     Selection in Lightbox. A dirty file boards its saved copy, which is what
     Re-read file and the D4 hash read, and the writer is told. Non-disk,
     non-text, and other-language sources are refused before anything is
     sent. A file over the ceiling gets the Lightbox's existing refusal.
  4. **Copy.** The empty source card and the board's welcome name the new
     entry points.
  - **Verification.** Base `9e5363c` → head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 370 suites, 5,257 tests, 2 snapshots | 373 suites, 5,284 tests, 2 snapshots |
    | Lint | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match `9e5363c` per file and per rule.
    - Evidence:
      [`lightbox-launch-entry-points/`](../../../docs/pr-reviews/evidence/lightbox-launch-entry-points/README.md).
      Native VS Code menus cannot be captured; manifest witnesses pin them.
  - **Follow-up:** the Marketplace README describes neither the Workshop's nor
    the Lightbox's launch commands. The Lightbox's release notes should name
    these entry points.
  - **PR #152 F-01 fix.** The
    [review](../../../docs/pr-reviews/pr-152-lightbox-launch-entry-points-review.md)
    found that a file launch took its source-request ticket only after VS Code
    loaded the document, so an older, slower launch could replace a newer
    source. The launch now takes the ticket before the load and boards under
    it, and a seed whose ticket was overtaken opens nothing. The report's
    author response lists the tests and verification.

- **2026-10-20. Slice 3: PR #150 re-review fixes.** The
  [re-review](../../../docs/pr-reviews/pr-150-lightbox-lexical-gravity-review.md)
  found F-01, F-02, F-04, F-05 and F-06 addressed, kept an F-03 residual
  open and added F-07 (nonblocking); both are fixed, and the author
  response to the re-review maps them to commits and tests.
  1. **F-03, claim before opening.** The Workshop webview holds an arriving
     seed and claims it; the panel provider grants the claim only while
     that delivery is still the one it waits on, so a seed whose message
     was already sent when it timed out, was replaced or lost its panel
     never opens. A grant cannot be revoked, so a newer seed waits for the
     granted one's answer. The protocol is generic over the seed kind
     (`WorkshopSeedDelivery`, `useWorkshopSeedClaim`) for Slice 4's Bring
     to Workshop.
  2. **F-07, the Model Browser in the overlay stack.** It registers with
     `useOverlayDismiss`, so a seed never opens over it and Escape closes
     only the top surface; focus returns to its opener, nested or not.
  - **Verification.** Re-reviewed head (`524a961`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 367 suites, 5,237 tests, 2 snapshots | 370 suites, 5,257 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file and per rule, except two fewer `curly`
      warnings in `ModelBrowserModal.tsx`, whose own Escape listener is gone.
    - No live or billable call; the evidence follows the claim protocol and
      no shot changed.

- **2026-10-20. Slice 4 (lineage, subtext, Spark, Bring to Workshop).** On
  `epic/lightbox-slice-4-lineage`, merged with `epic/lightbox` at `9e5363c`;
  see the [slice notes](slice-4-lineage-subtext-spark-bring.md#implementation-notes-2026-10-20).
  1. **Readings.** Subtext (group B), lineage and Spark (group C), with the
     B and C worked examples extended, their bounds pinned, and every gate
     shared by fresh assembly and stale carry. A said line must sit inside
     dialogue; a spark must be a question.
  2. **The Spark lane.** Its own lane under the grid; "Not for me" and Undo
     are host-owned marks on the board's own spark.
  3. **Bring to Workshop.** The webview names a tile by id; the host checks
     it and offers it through Slice 3's claim-before-open delivery as a
     second seed kind, `lightbox-tile`. The Workshop stages it as a pending
     attachment above the composer (a `lightbox-tile` thread-artifact frame,
     persisted, removable, sent only with the writer's message). The
     Lightbox shows **Bound** only while the Workshop holds it, and the
     header tray counts confirmed stages.
  4. **PR #150 F-08.** Each Workshop mount announces a receiver id; a
     reloaded webview releases what was granted to the old one as `reset`,
     and the queue moves on.
  - **Verification.** Base `9e5363c` → head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 370 suites, 5,257 tests, 2 snapshots | 383 suites, 5,412 tests, 2 snapshots |
    | Lint | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match `0b03f1e` per file and per rule.
    - No live or billable call; the evidence plays the provider:
      [`lightbox-slice-4-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-4-visual/README.md).
  - **Follow-ups:** [Workshop narrow-width reflow](../../tech-debt/2026-10-19-workshop-narrow-width-reflow.md)
    and [a refused seed offer only times out](../../tech-debt/2026-10-19-workshop-refused-seed-offer-times-out.md)
    (both Low); the [single-quote dialogue](../../tech-debt/2026-10-19-dialogue-single-quote-convention.md)
    item now covers subtext too.

- **2026-10-20. Source and context from the shared project picker.** On
  `epic/lightbox-source-picker`, from `epic/lightbox` at `59b57b6`. The writer
  asked: "Can you make the open excerpt trigger the same modal we use in the
  workshop." The scope later widened to the Context list. See ADR D1, D9 and
  D10.
  1. **One picker.** The Workshop's "Choose from project" modal is now
     `components/fulltab/ProjectResourcePickerModal`, with
     `ProjectResourceAttachFooter` for attach mode.
     - `WorkshopContextSelectorModal` wraps it for the attach, excerpt and
       message modes.
     - Its catalog contracts are neutral (`messages/configuredResources.ts`),
       and its rules and the modal chrome's moved to `styles/fulltab/modal.css`.
     - The content search moved, unchanged, to `ConfiguredResourceContentSearch`.
     - The Workshop is unchanged: parity witnesses were recorded against the
       original modal first (57 snapshots of markup, focus, callbacks and
       posted messages), and the evidence's before and after shots differ by
       0 pixels.
  2. **Source.** The source panel's and the welcome's **Choose from project…**
     open the picker in single selection.
     - `LIGHTBOX_REQUEST_PROJECT_CATALOG` and `LIGHTBOX_SEARCH_PROJECT_CATALOG`
       answer from the same catalog and search, Markdown and plain text only.
       Anything else is left out, not shown disabled.
     - `LIGHTBOX_CHOOSE_PROJECT_SOURCE` names a catalog key. The host takes the
       ticket on arrival, before the catalog opens, then resolves the key
       inside the workspace and boards it as a file source.
     - "Explore project folders…" is the old system picker.
     - A file chosen either way is one board: `lightboxSourceKey` compares
       file URIs by their decoded path.
  3. **Context.** The Context list's **Add from project…** opens the picker in
     attach mode, as the Workshop does: the shelf's files show as attached,
     with the running ~estimate.
     - `LIGHTBOX_ADD_PROJECT_CONTEXT` goes through `LightboxContextIntake`
       under the shelf's own rules. A file is refused if it is the board's own
       source, unreadable, empty, a duplicate by absolute path, or over
       `PROMPT_BUDGETS.contextFiles.words` counted in order. The rail names
       every refusal.
     - An add moves the shelf's revision, so a stale press is refused and the
       webview re-estimates.
     - A test pins that a quote from a context file is withheld.
  4. **Copy.** The empty source card and the welcome name the project route
     first, then the right-click and selection routes.
  - **Verification.** Base `59b57b6` → head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 389 suites, 5,516 tests, 2 snapshots | 395 suites, 5,587 tests, 59 snapshots |
    | Lint | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes |

    - Lint warnings match `59b57b6` per file and per rule.
    - No live or billable call; the evidence plays the host with a stub model:
      [`lightbox-source-picker/`](../../../docs/pr-reviews/evidence/lightbox-source-picker/README.md).
      Its first run found the source panel's two buttons overflowing the
      rail. `f959b29` wraps them.
  - **Follow-up:** [the shared picker still leans on Workshop-named seams](../../tech-debt/2026-10-20-shared-picker-workshop-named-seams.md)
    (Low): the modal shell's folder and the catalog service's name.

- **2026-10-20. Shared project picker: PR #154 review fixes.** Astra's
  [review](../../../docs/pr-reviews/pr-154-lightbox-shared-project-picker-review.md)
  of `2cf1f97` requested changes for two Medium findings and one Low note;
  the author response at its end maps each to commits and tests.
  1. **F-01, answers correlated.** Catalog and search requests carry a
     webview-minted `requestId` (per webview, opening and operation) that
     the host echoes. `useLightboxProjectFiles` takes only the answer still
     pending; opening, closing and clearing drop pending answers, and a new
     query takes down the old query's answer and bound note at once.
  2. **F-02, host file identity.** Catalog rows and shelf files carry
     `fileKey`, a session-keyed HMAC of the absolute path the shelf dedupes
     by (`LightboxFileKey`). The Context picker compares keys, so a second
     workspace folder's same-named file no longer disables the first's row.
     The resolver's older cross-folder collapse is
     [recorded](../../tech-debt/2026-10-20-context-catalog-cross-root-collapse.md)
     (Low).
  3. **N-01, backdrop evidence.** The harness now takes the Workshop at
     500 px and records, per shot, that the backdrop is the top element
     outside the dialog and spans the window: true in all 24 dialog shots.
  - **Verification.** Reviewed head `2cf1f97` → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 395 suites, 5,587 tests, 59 snapshots | 397 suites, 5,597 tests, 59 snapshots |
    | Lint | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes |

    - The ten new tests failed against `2cf1f97`'s sources, each at its
      behavioral assertion.
    - The Workshop parity snapshots are unchanged; lint warnings match
      `59b57b6` per file and per rule.
    - No live or billable call.

- **2026-10-20. The writer's real-chapter checkpoint is passed.** The
  checkpoint Slice 5 waits on (its "Before starting" section, and every
  review since PR #149) is the writer's review of Slices 2B–4 on real
  chapters. The writer ran real-chapter passes and said the board "is
  working great", then asked for new sections instead of changes to the
  existing ones. The new sections come first (decision 14), so the saved
  format holds them.
  - **The new sections** (writer, 2026-10-20), drawn as a draft on the
    design canvas ([`NewLenses.dc.html`](../../../docs/design/lightbox/NewLenses.dc.html)):
    Template & freshness, Stock & signature, Rhythm & handoffs, Pressure,
    Artifacts, What stands out in the numbers, Summary & movements, and the
    Opinion. Each draws on a Writing Tools focus prompt's concepts (Fresh,
    Stock & Signature, Craft Steering, Cliché), adapted into the board's
    quoted, checked JSON rather than copied.
  - **Plan.** Three stacked slices: [4B](slice-4b-craft-lenses.md) (Group D,
    craft), [4C](slice-4c-story-lenses.md) (Group E, story, with the
    Sections lane) and [4D](slice-4d-opinion.md) (Group F, the Opinion, run
    last). Decisions 10–16 above; the ADR's D7 has a dated addendum for the
    Opinion and the freshness label; Slice 5's format now holds every tile
    kind, the Sections layer and a list of sources.
  - **Left out on purpose:** the two-level ribbon above 96 paragraphs,
    multi-file boards and movements as a ribbon overlay, in a
    [feature note](../../features/feature-lightbox-ribbon-structure/README.md).

- **2026-10-20. Slice 4B (Group D, craft) is implemented** on
  `epic/lightbox-slice-4b-craft`. A press now reads four groups; group D
  reads stock and signature, rhythm and handoffs, and the numbers, from one
  call with a worked example (*Alice* ch. I, ¶1–¶8) that decodes through the
  production codec and verifier with every quote exact.
  - **Host.** Eight tile kinds, all through `LightboxTileGates`, fresh and
    carried. A handoff's quotes must be adjacent sentences of one paragraph
    (`LightboxSentencePairs`, through the verifier's span filter). A numbers
    reading names a figure the board measured as standing out, and each of
    its quotes holds an instance by the detector that counted it
    (`LightboxNumberInstances`). The tier mix and familiar phrases are
    counted by the host. Endings follow their column's text on a stale
    carry.
  - **Measured.** Per-paragraph sentence lengths, and six figures against
    the preset's ranges and the writer's own average
    (`LightboxWriterBaseline`: the configured chapters, else manuscript,
    files, the board's own left out; bounded, cached, no model; absent with
    a host note). Style Flags' detectors are exported unchanged; being verbs
    is a new detector.
  - **Webview.** Stock, rhythm and numbers tiles with register chips, the
    Endings lane on the ribbon, inspector details and Bring for every kind.
  - **Deviations and limits** are in the slice's
    [implementation notes](slice-4b-craft-lenses.md#implementation-notes-2026-10-20);
    one item went to [tech debt](../../archive/tech-debt/2026-10-20-lightbox-group-d-response-ceiling.md).
  - **Verification.**

    | Check | `eca952a` | Slice 4B head |
    |---|---|---|
    | `npx jest` | 397 suites / 5,597 tests / 59 snapshots | 407 suites / 5,693 tests / 59 snapshots |
    | `npm run lint` | 0 errors / 1,133 warnings | Identical per file and rule |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes |

    - Visual evidence at 1440, 1000 and 500 px from real host output with a
      stub model: [`lightbox-slice-4b-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4b-visual/README.md).
    - No live or billable call.
  - **PR #155 review (2026-10-20).** Astra requested changes (F-01 to F-04,
    N-01). Fixed in `fc4c564`: number usages belong to the measurement they
    were read against and are withheld when it changes, on a same-text
    rebuild and on landing; Bring keeps both sentences of a handoff; a
    familiar phrase is witnessed by a whole occurrence in a quote's span;
    standouts are decided from counts and rounded only for display; a
    relocated pair reads "no longer adjacent". The three nonblocking notes
    were taken. After the fixes: 411 suites / 5,712 tests / 59 snapshots;
    lint identical. See the review's
    [author response](../../../docs/pr-reviews/pr-155-lightbox-craft-lenses-review.md#author-response-2026-10-20).

- **2026-10-20. Slice 4C (Group E, story) is implemented** on
  `epic/lightbox-slice-4c-story`, stacked on 4B with its PR #155 fixes
  (`16e85b1`) merged in. A press now reads five groups; group E reads
  template and freshness, pressure, artifacts, and summary and movements,
  from one call with a worked example (*Alice* ch. I, ¶1–¶8) whose request is
  the builder's byte for byte and which decodes through the production codec
  and verifier with every quote exact.
  - **Host.** Six tile kinds (template, template beat, pressure thread,
    artifact, synopsis, movement), all through `LightboxTileGates`, fresh and
    carried. Movements are gated as a set (boundaries in their first
    paragraphs, contiguous, covering) and withheld whole when they do not
    tile the chapter; carried, each starts where its boundary quote now
    stands. Engagement sits on the template tile, keyed by movement tile id,
    one level per movement or none. Threads keep paragraph order and get
    host spans; artifacts get host mentions and first paragraphs, and
    "planted, unused" only where code bears it out. Template and summary
    are read together on a re-read.
  - **Measured.** The Sections lane (`LightboxSections`): headings, then
    scene breaks, then chapter lines, recomputed with every board.
  - **Joined.** The freshness basis, D's signature share and E's subverted
    beats, a shared pure join shown only while both halves are current,
    never sent to a model.
  - **Webview.** Template & freshness, Pressure, Artifacts and Summary &
    movements tiles with register chips; Sections, Movements, Pressure and
    Engagement lanes on the ribbon; inspector details and Bring by id for
    every kind.
  - **Deviations and limits** are in the slice's
    [implementation notes](slice-4c-story-lenses.md#implementation-notes-2026-10-20);
    one item went to [tech debt](../../archive/tech-debt/2026-10-20-lightbox-group-e-response-ceiling.md).
  - **Verification.**

    | Check | `8b930fb` (4B) | `16e85b1` (4B, PR #155 fixes) | Slice 4C head |
    |---|---|---|---|
    | `npx jest` | 407 suites / 5,693 tests / 59 snapshots | 411 / 5,712 / 59 | 419 suites / 5,802 tests / 59 snapshots |
    | `npm run lint` | 0 errors / 1,133 warnings | Identical | Identical per file and rule |
    | `npm run typecheck` | Passes | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes | Passes |

    - Visual evidence at 1440, 1000 and 500 px from real host output with a
      stub model: [`lightbox-slice-4c-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4c-visual/README.md).
    - No live or billable call.
  - **PR #156 review (2026-10-21).** Astra requested changes (F-01 to F-03,
    N-01). Each is fixed in its own commit:
    - F-01 `30047f0`: a thread planted and resolved in one paragraph no
      longer counts as open in a bucketed ribbon column.
    - F-02 `1a82d29`: front matter split by a blank line is no longer
      measured as a section. `# # #` is now a scene break.
    - F-03 `3caadaa`: the ribbon's paragraph and story lanes share one
      grid. The harness now measures and commits their edges: 0 px apart
      at every width, fresh and stale.
    - N-01 `3f9126c`: a fresh arc step withheld for its order is counted.

    After the fixes: 420 suites / 5,815 tests / 59 snapshots; lint
    identical. The evidence was rebuilt from a clean install, and its
    bundle hash is recorded with the reason the first one differed. See the
    review's
    [author response](../../../docs/pr-reviews/pr-156-lightbox-story-lenses-review.md#author-response-2026-10-21).
  - **PR #156 re-review (2026-10-21).** F-01 to F-03 and N-01 were
    confirmed. F-04 is new: the F-03 grid used `subgrid`, which VS Code
    1.75's Chromium 102 does not have, so labels would stack above their
    charts there.
    - Fixed in `9fadf6d`: the ribbon is one plain grid.
    - A new floor guard keeps webview CSS within Chromium 102.
    - The harness checks that each label is beside its track, including in
      states that simulate the floor.
    - Older above-floor CSS, mainly `color-mix()` in the theme tokens, went
      to
      [tech debt](../../archive/tech-debt/2026-10-21-webview-css-above-chromium-102.md)
      (resolved 2026-10-21 by raising the floor to VS Code 1.82).

    After F-04: 421 suites / 5,821 tests / 59 snapshots; lint identical.

- **2026-10-21. Slice 4D (Group F, the Opinion) is implemented** on
  `epic/lightbox-slice-4d-opinion`, stacked on 4C (`797e166`). A press now
  reads the chapter groups and then the Opinion: one call over the board's
  checked digest, never the chapter.
  - **The Opinion** returns a shared list of observations, each citing
    board items by host key (tile ids, a tile's quote by number, measured
    figures). It also returns three views of them, Enthusiastic, Neutral
    and Blunt, each with a headline, a body and weighted Why points.
  - **The worked example** (*Alice* ch. I, ¶1–¶8, read with groups A–E's
    own examples) is the builder's request byte for byte. Its reply is drawn
    whole through the production codec and gates.
  - **Host.**
    - F runs only after the press's chapter groups settle, while the run
      still owns its board, and a stopped run never starts it.
    - Its digest is built through the press owner's port by board id. It is
      bounded in estimated tokens, priced "up to" that bound, and keyed over
      the board's measurement context and every item's content.
    - Code checks every citation against the digest. A view that weighs an
      undrawn observation is withheld whole, and the tile only when no view
      stands.
    - The text rules apply to every observation and view: no quotation
      marks, no writer words, no rewrite or instruction words, no
      percentages, and no figure the cited items do not show.
    - The Opinion joins `LightboxTileGates` and the carry, re-gated against
      the carried board.
  - **Standing.** It is derived, never stored, by one shared function. The
    Opinion is stale when anything it cites is gone, not current or changed.
    An uncited lens read again leaves it current, and a late F lands stale,
    never current.
  - **Bring.** The view on show travels by name, ids only, and the host
    refuses a withheld view or a stale Opinion.
  - **Webview.** The tile is last and full width, labelled "The one
    evaluative tile". It has three `aria-pressed` view tabs, Neutral by
    default, with the choice kept per board in webview state, and its
    observations light their paragraphs. It shows stale and withheld notes,
    and its own re-read is priced "up to its digest bound".
  - **Deviations and limits** are in the slice's
    [implementation notes](slice-4d-opinion.md#implementation-notes-2026-10-21).
    Two items went to tech debt: the
    [citation basis](../../archive/tech-debt/2026-10-21-lightbox-opinion-basis-is-rendered-text.md)
    (decide before Slice 5) and the
    [digest's board-order cut](../../tech-debt/2026-10-21-lightbox-opinion-digest-board-order-cut.md).
  - **Verification.**

    | Check | `797e166` (4C) | Slice 4D head |
    |---|---|---|
    | `npx jest` | 419 suites / 5,802 tests / 59 snapshots | 426 suites / 5,874 tests / 59 snapshots |
    | `npm run lint` | 0 errors / 1,133 warnings | Identical per file and rule |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes |

    - Visual evidence at 1440, 1000 and 500 px from real host output with a
      stub model: [`lightbox-slice-4d-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4d-visual/README.md).
    - No live or billable call.
  - **PR #157 review fixes (2026-10-21).** Astra requested changes for one
    finding (F-01) and one nonblocking note (N-01); both are fixed.
    - **F-01.** Digits inside a host-minted tile id, or a quote's
      q-number, no longer count as figures an Opinion may state. An item's
      figures now come only from its label, lines and quotes. The witness
      and its id-only control are covered fresh, on carry, through Bring
      and through a real-handler run under UUID-shaped tokens.
    - **N-01.** The no-quotation rule shares the quote verifier's
      double-quote set, so fullwidth and CJK marks are withheld too.
    - **Evidence.** It was re-rendered from the fixed bundle, with
      `facts.json` and `errors.txt` now committed. The slice notes record a
      saturated-digest result.
    - **Verification.** 427 suites / 5,887 tests / 59 snapshots (from 426 /
      5,874 / 59); lint identical per file and rule; typecheck and build
      with `verify:bundle` pass.
    - See the review's
      [author response](../../../docs/pr-reviews/pr-157-lightbox-opinion-review.md#author-response-2026-10-21).
  - **PR #157 re-review and the 4C merge (2026-10-21).**
    - **Slice 4C's PR #156 fixes** (`e7e1536`) are merged in (`9585609`).
      The digest's sections follow 4C's front-matter fix, and the 4D
      evidence measures 4C's ribbon grid.
    - **F-01 residual.** Astra's re-review found host routing inside a
      line still lending figures: Subtext's "the said line is q0" lent a
      0. The audit added a gravity field's degree labels. `57ebfd7` keeps
      such lines as shown, so the digest does not move, and feeds only
      their evidence part to an item's figures. Witnesses and controls run
      fresh, carried, through Bring and through the real handler.
    - **Verification.** 429 suites / 5,910 tests / 59 snapshots; lint
      identical per file and rule; typecheck and build with
      `verify:bundle` pass. The bundle was built after `npm ci` into a
      real `node_modules`, SHA-256 `55276cad…`.
  - **The second 4C merge (F-04, 2026-10-21).** 4C's plain ribbon grid
    and floor guard are merged in (`7125c48`). The guard passes with the
    Opinion's stylesheets. The 4D evidence checks each label beside its
    track, including in three simulated-floor states.
    - **Verification.** 430 suites / 5,916 tests / 59 snapshots; lint
      identical; typecheck and build with `verify:bundle` pass; bundle
      SHA-256 `0f6624f4…`.

- **2026-10-21. Slice 4E (reading aids in the inspector) is planned** on
  `epic/lightbox-slice-4e-inspector`, from `epic/lightbox` at `20775cf`
  (PR #157 merged). The writer ran a real chapter through the board and
  asked for three things (decisions 17–19): a pinned paragraph's whole
  text, the sentences a clicked word stands in, and the hapax list under
  the cloud. All three are measured by code, with no model call.
  - **The plan:** [slice-4e-inspector-aids.md](slice-4e-inspector-aids.md).
    The board holds no paragraph text, so one correlated route pair
    (`LIGHTBOX_REQUEST_PASSAGE`, `LIGHTBOX_PASSAGE`) fetches it by board id
    and content hash; nothing of it is persisted. Each well finds instances
    with the rule that made the figure it shows, so the lit instances equal
    the displayed count; a test pins that over every listed entry.
  - **Also:** the inspector's count strings agree in number ("1 word per
    sentence").
  - **Base measured** at `20775cf`: 430 suites / 5,916 tests / 59
    snapshots; lint 0 errors / 1,133 warnings; typecheck and build with
    `verify:bundle` pass; `webview.js` SHA-256 `0f6624f4…`, as 4D recorded.
  - Slice 4F (craft steering) is built beside it and takes the decisions
    after 19.

- **2026-10-21. Slice 4E (reading aids in the inspector) is implemented,
  awaiting review,** on `epic/lightbox-slice-4e-inspector`.
  - **Paragraph text.** Pinning a paragraph shows its whole text in a
    scrollable, labelled, focusable well. Reached from a ¶ address in a
    sentences well, the term's instances there are lit, with a way back.
  - **Sentences for an item.** Pinning a top word, a part-of-speech entry,
    a repeated phrase, a hapax word, or one of four style flags (Weak
    Verbs, Filler Words, Adverbs, Passive Voice) lists its sentences at the
    bottom of the inspector: "27 instances in 26 sentences", each row with
    its ¶ address, every instance lit. Up to 50 rows, with a note counting
    the rest.
  - **The hapax list.** Under the cloud, in order of first appearance,
    exactly as many words as the stats row's hapax count, paged at 300.
  - **Plurals.** Eight count strings in the inspector and word panels now
    agree with their numbers.
  - **Contracts.** One correlated route pair, `LIGHTBOX_REQUEST_PASSAGE`
    (owned by the new `LightboxPassageHandler`) and `LIGHTBOX_PASSAGE`,
    by board id and content hash. The host refuses a changed board or an
    item not on it. Nothing of a passage is persisted.
  - **Counts agree.** Each well finds instances with the rule that made the
    figure it shows. A test checks every listed entry on six public-domain
    fixtures, with literal counts checked by grep; mutating either
    tokenizer fails it.
  - **Deviations and limits** are in the slice's
    [implementation notes](slice-4e-inspector-aids.md#implementation-notes-2026-10-21).
    One item went to tech debt: the board's
    [sentence rule](../../archive/tech-debt/2026-10-21-prose-sentences-closing-quote.md)
    gives a closing quotation mark to the next sentence (since resolved:
    see the next entry).
  - **Verification.**

    | Check | `20775cf` (base) | Slice 4E head |
    |---|---|---|
    | `npx jest` | 430 suites / 5,916 tests / 59 snapshots | 440 suites / 6,012 tests / 59 snapshots |
    | `npm run lint` | 0 errors / 1,133 warnings | Identical per file and rule |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes |

    - Bundle SHA-256 `8d0545de…`, built after `npm ci` into a real
      `node_modules` and reproduced by a second build.
    - Visual evidence at 1440, 1000 and 500 px from real host output:
      [`lightbox-slice-4e-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4e-visual/README.md).
    - No live or billable call.
  - **PR #159 review fixes (2026-10-21).** Astra requested changes for one
    finding (F-01) and noted one nonblocking optimization (N-01). Both are
    fixed.
    - **F-01** (`86d269a`). Going back to a held passage no longer leaves
      another pin's request pending. Before, its late answer replaced the
      held one and stranded the well at "Finding the sentences…".
      - Four regressions fail on `058feb5`: the held ¶2 → Back sequence
        through `LightboxApp`, and three hook cases.
      - A tenth evidence state, `back-late`, shows the fix in Chromium.
    - **N-01** (`31a4550`). A passage is cut in time linear in what it
      sends, by one walk and one open/close sweep, with nothing dropped.
      - Before the change was kept, it matched `058feb5`'s cutting on
        7,077 passages.
      - The new long-row tests take about a tenth of their 1 s ceiling.
        On `058feb5` they take 2 to 4 s.
    - **Merged with PR #158** (`6d63a6e`): the Chromium 114 floor. The 4E
      stylesheets pass its guard as they are.
    - **Verification.** 440 suites / 6,019 tests / 59 snapshots; lint
      identical per file and rule (0 errors / 1,133 warnings); typecheck
      and build with `verify:bundle` pass; bundle SHA-256 `2f86917e…`,
      reproduced.
    - See the review's
      [author response](../../../docs/pr-reviews/pr-159-lightbox-inspector-reading-aids-review.md#author-response-2026-10-21).

- **2026-10-21. Slice 4F (Group G, Craft steering) is planned** on
  `epic/lightbox-slice-4f-steering`, from `epic/lightbox` at `20775cf`, at
  the writer's request: "Think steering the craft." See the
  [slice spec](slice-4f-craft-steering.md).
  - **The writer's pass that prompted it.** Passive voice stood out and read
    as deliberate. Being verbs stood out at 1.53× the writer's average, but
    the reading was withheld: one quote was not in the chapter, two held no
    instance of the figure. Adverbs and intensifiers were below average, so
    no reading was asked for.
  - **Decisions 20–24** (defaults the coordinator chose; the writer can
    redirect): a lens and call of its own, group G, owning being verbs,
    adverbs and intensifiers; the host measures each by construction first;
    one reading and up to four instance notes per figure; nudges that name
    the craft move, the second fenced exception to "describe, never grade"
    (ADR D7 addendum, 2026-10-21); the Opinion's digest holds the counts and
    stances, never a nudge. Decisions 17–19 are left for Slice 4E.
  - **The writer changed decision 23 the same day:** a nudge may carry one
    example so the writer sees what the move looks like, anchored to the
    checked quote and labelled as an illustration. Folded into the plan
    before it was committed.
  - **Decision 25, recorded here, built in Slice 5:** the writer chose a
    canonical data basis for the Opinion's citations, with a basis/format
    version on saved boards. 4F does not change how bases are computed; its
    digest items keep label, lines, quotes, counts and figures as separate
    fields, so the data basis can be derived without parsing rendered
    text.

- **2026-10-21. Slice 4F (Group G, Craft steering) is built** on
  `epic/lightbox-slice-4f-steering`. See the slice's
  [implementation notes](slice-4f-craft-steering.md#implementation-notes-2026-10-21).
  - **What a press does now.** Seven calls at most: groups A–E and G read
    the chapter together, and the Opinion waits for all of them. Craft
    steering shows each figure's counts before any press (Alice: 17 being
    verbs, 7 -ly words, 11 intensifiers, each split by construction), then
    one reading and its instance notes per figure, every quote holding an
    instance by the figure's own detector.
  - **The writer's withheld being verbs were withheld correctly.** The rate
    and the quote check run one detector and agree line for line;
    contractions and linking verbs were never counted. The task now says
    what an instance is.
  - **Ownership.** The numbers lens reads only sentence length, dialogue and
    passive voice; its codec and gate refuse the other three, and its tile
    points to craft steering under their standouts.
  - **Verification.** 439 suites / 6,047 tests / 59 snapshots (base 430 /
    5,916 / 59); lint identical per file and rule (0 errors, 1,133
    warnings); typecheck and build with `verify:bundle` pass; bundle
    SHA-256 `6c296309…`; visual evidence with no errors.
  - **Next.** Merge `epic/lightbox` after 4E (PR #159) and the shared
    sentence-rule fix land, regenerate the worked examples' requests where
    sentence figures move, re-verify and rerender the evidence.

- **2026-10-21. PR #160 (Slice 4F) review fixes, and `epic/lightbox`
  merged in.** Astra found two P2 defects and one P3. All three are fixed,
  each with tests that fail on the reviewed head. See the
  [review and author response](../../../docs/pr-reviews/pr-160-lightbox-craft-steering-review.md)
  and the slice's notes.
  - **F-01.** The steering measure was quadratic on one large paragraph,
    and it runs with every board. It is now linear in tokens, with
    binary-search lookups, and the counts are unchanged. A 49,998-word
    paragraph's board builds in under a second, down from about 80 s
    under Jest.
  - **F-02.** An example's first part, as the chapter has it, could pass
    its bounds, and Bring clipped it. The anchored pair is now held to the
    contract again, fresh, on carry and at Bring, and nothing is clipped.
  - **N-01.** The numbers card's empty text names craft steering when only
    its figures stand out.
  - **The merge.** `1fe931a` (PR #158's 1.82 floor, PR #159's Slice 4E).
    Both sides were kept in every conflict.
  - **Verification.** 451 suites / 6,167 tests / 59 snapshots; lint 0 errors / 1,133 warnings, identical per file and rule; typecheck and build with
    `verify:bundle` pass; bundle SHA-256 `24658aba…`; evidence
    re-rendered, with no errors.
  - **Next.** Merge the sentence-rule fix (PR #161) when it lands, and
    regenerate the worked examples and evidence whose sentence figures
    move.

- **2026-10-21. The sentence rule keeps closing marks and joins speech
  tags,** on `epic/lightbox-sentence-rule`, stacked on Slice 4E (PR #159)
  at `058feb5` and merged with its review fixes at `2e62aa7`. It resolves
  the
  [sentence-rule debt](../../archive/tech-debt/2026-10-21-prose-sentences-closing-quote.md),
  recorded in
  [ADR 2026-10-21](../../../docs/adr/2026-10-21-sentence-closing-marks.md).
  Slice 4F (craft steering) reads sentence spans and merges this later.
  - **Closing marks.** `proseSentenceSpans` keeps the run of `”`, `’`,
    `"`, `'`, `)` and `]` written directly after a sentence's `.`, `!` or
    `?`. A stretch of only space and closing marks is no sentence.
    - `“Oh dear!”` is 2 words in 1 sentence.
    - An elision's apostrophe never moves.
  - **Speech tags** (the coordinator's default, by standard punctuation).
    A sentence goes on across ender, closing quotation mark, space and a
    lower-case letter.
    - `“Wait!” she cried.` and `“Who are you?” said the Caterpillar.` are
      each one sentence; `“Wait.” She turned.` stays two.
    - A bare `!`, a bracket, an elision or a paragraph break never joins.
    - The known limit: a capitalised tag (`“Wait!” Alice said.`) stays a
      sentence of its own.
  - **Figures move on purpose.** Literal figures on the *Alice* fixtures,
    at the original rule, after closing marks, and after speech tags, are
    in the [evidence](../../../docs/pr-reviews/evidence/sentence-rule/README.md),
    with inspector captures at each.
    - Closing marks move whole-text counts by at most one in ordinary
      prose, and per-paragraph counts wherever a paragraph ends with a
      closing mark (2,028 → 1,702 over the whole book).
    - Speech tags move both. The whole book goes 1,628 → 1,388 sentences
      and 16.2 → 19.1 words per sentence; the Tea-Party goes 13.6 → 16.1.
      Its 240 joins were audited, and none is false.
    - The audit found an interleaved end (`!"?”`, Chapter VIII), now read
      as one end.
    - Count agreement holds, now also on the dialogue-heavy Tea-Party.
    - Group F's worked example was regenerated from its builder after
      each change.
  - **Verification.**

    | Check | `058feb5` (base) | `2e62aa7` (4E with its fixes) | Head |
    |---|---|---|---|
    | `npx jest` | 440 suites / 6,012 tests / 59 snapshots | 440 suites / 6,019 tests / 59 snapshots | 444 suites / 6,102 tests / 59 snapshots |
    | `npm run lint` | 0 errors / 1,133 warnings | Identical per file and rule | Identical per file and rule |
    | `npm run typecheck` | Passes | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes | Passes |

    - Built after `npm ci` into a real `node_modules`. `webview.js`
      SHA-256 is `2f86917e…`, 4E's own after its fixes: the rule runs
      host-side, and the webview only shows what the host measured.
    - `extension.js` is `865b2c9f…` (`b8cb056a…` at `058feb5`). Both
      bundles were reproduced by a second build.
    - No live or billable call.

- **2026-10-21. PR #161's N-01 fixed, and Slice 4F merged into the
  sentence rule.** Astra found no blocking defect in PR #161 and one P3,
  fixed before merge. See the
  [review and author response](../../../docs/pr-reviews/pr-161-sentence-boundary-review.md).
  - **N-01.** A counted token can stand in no sentence: a lone `'` is a
    hapax word, and a stretch of only space and closing marks is no
    longer a sentence. Its well claimed a sentence it could not light,
    or lit an unrelated paragraph.
    - Such an instance now gets a row of its own stretch, lit, marked
      "outside any sentence".
    - It is counted apart (`outside`), never as a sentence, and never
      put in the nearest one.
    - Whether such a token is vocabulary at all is inherited, and now
      [Low tech debt](../../tech-debt/2026-10-21-prose-stats-punctuation-only-words.md).
  - **The merge.** `epic/lightbox` at `2f040ab` (PR #160, Slice 4F,
    group G). PR #161 merges second, so it carries the integration.
    - Conflicts were in group F's worked example, the tech-debt index,
      the agents guide's inventory and this file.
    - Both sides were kept in each.
  - **What moved on the combined tree**, against `2f040ab`:
    - **Group F's worked example.** The request is its builder's byte for
      byte: 15 sentences, 33.9 words per sentence, pacing Very slow,
      ×2.37. The response keeps 4F's tile ids and states 33.9; Blunt's
      "about twice" reads "more than twice".
    - **`LightboxCraftHandoff.test.ts`.** The number reading's Figure
      point is "Sentence length: 33.9 words per sentence", not 29.9.
    - **Nothing else moved.**
      - Groups A–E's and G's requests still match their builders.
      - Craft steering's counts are unchanged: 4F's suites pass as
        written, and the rebuilt evidence's steering measure is identical.
        The rule can move a short run in general: a closing mark no longer
        adds a word to the next sentence, and a speech tag lengthens its
        speech's sentence. The excerpt has no run under either rule.
      - The measure's header comment now names the merged rule.
    - **4F's committed evidence is left as recorded at its head.**
      Rebuilt on the combined tree, its `chapter.json` moves only in the
      sentence figures, the group F estimate (+3 tokens) and group F's
      reading. Its `workshop.json` is byte-identical. The fields are
      listed in the
      [sentence-rule evidence](../../../docs/pr-reviews/evidence/sentence-rule/README.md).
  - **Verification**, at the merge, after `npm ci`:
    - 456 suites / 6,259 tests / 59 snapshots;
    - lint 0 errors / 1,133 warnings, identical per file and rule to the
      N-01 head;
    - typecheck and build with `verify:bundle` pass.
    - `webview.js` SHA-256 is `cb08d7b9…`, and `extension.js` is
      `a548648c…`. Both were reproduced by a second build.
    - No live or billable call.

- **2026-10-21. Being-verb contractions and dialogue as voice (Slice 4G,
  decision 26)**, on `epic/lightbox-being-contractions`, stacked on Slice
  4F at `27b646a` and merged with `epic/lightbox` at `2f040ab` (PR #160)
  and `1cb417c` (PR #161). See [the slice](slice-4g-being-contractions.md)
  and its
  [evidence](../../../docs/pr-reviews/evidence/being-contractions/README.md).
  - **Counted.** I'm, 're, 's read as *is* (by the tagger, not before
    been, got or gotten), isn't, aren't, wasn't, weren't and ain't, through
    `findBeingVerbs`, so the numbers, the writer's average, steering and the
    quote check agree. The negated forms were never counted before.
  - **Dialogue is voice**, for all three steering figures: a note in
    dialogue keeps its stance, with no nudge or example, by a host rule
    fresh, on carry and at Bring.
  - **Figures.** Chapter I's opening is unchanged (17 being verbs). The
    dialogue-heavy Chapter VII opening (`TEA_PARTY_CURLY`) goes 17 → 26
    being verbs, 39.1 → 59.8 per 1,000 words, dialogue 6 → 15; no standout
    flips, and no short run moves under the merged sentence rule.
  - **Worked examples.** Group G's request was regenerated by its builder.
    After the sentence-rule merge every request, group F's digest included,
    still matches its builder; no response figure needed fixing.
  - **Verification**, at the merge with `1cb417c`, after `npm ci`: 458
    suites / 6,312 tests / 59 snapshots (456 / 6,259 / 59 at `1cb417c`);
    lint 0 errors / 1,133 warnings, identical per file and rule; typecheck
    and build with `verify:bundle` pass; `webview.js` SHA-256
    `20d3aed3…`, reproduced; evidence with no errors. No live or billable
    call.
  - **The writer's three additions** (after the first push, `ab22ebd`):
    - **The next-word rule for `'s`** where the tagger reads a possessive:
      *is* before an adjective, an -ing word, an adverb or not, a
      preposition or a determiner ("Tobin's late", "everyone's here"); a
      possessive before a noun, a name or a pronoun ("the Rabbit's watch",
      "Alice's sister"). The has rule runs first. "The dog's barking" is
      pinned as *is*, the chosen reading of the ambiguity.
    - **had** joins been, got and gotten: "it's had" and "ain't had" are
      *has*, not counted.
    - **'tis, 'twas and 'twere** count once each, straight or curly; the
      word-joining rule leaves them whole.
    - **Figures.** None of the *Alice* fixtures moves (both Tea-Party
      settings and Chapter I); no standout flips; no worked example moves
      beyond group G's task line, regenerated by its builder. Four lines
      written for the evidence with made-up names go 1 → 3 → 7 being verbs
      across `1cb417c`, `ab22ebd` and the head.
    - **Verification**, after `npm ci`: 458 suites / 6,329 tests / 59
      snapshots; 12 tests in four files fail at `ab22ebd` and pass here;
      lint identical per file and rule; typecheck and build with
      `verify:bundle` pass; `webview.js` unchanged at `20d3aed3…`; the
      evidence re-renders byte for byte. No live or billable call.
  - **Review fixes** ([PR #162 review](../../../docs/pr-reviews/pr-162-lightbox-being-contractions-review.md),
    Astra at `2295f9d`: request changes), in `2a1ac93`:
    - **F-01.** `LightboxSpanIndex` finds each paragraph's instances and
      dialogue spans once per text and answers by binary search; the quote
      check, voice and example anchor share it. Four notes on one
      paragraph: 13 detections → 1; dialogue-span reads at 250 spans
      376,500 → 748, growing linearly.
    - **F-02.** An example takes in no speech: one crossing into a
      character's words, either way, is withheld alone with a host reason,
      fresh, on carry and at Bring; a mixed note keeps its nudge.
    - **N-01.** Every note in dialogue, Earns included, carries a voice
      line, so the digest, board, inspector and Bring mark it.
    - **Verification**, after `npm ci`: 461 suites / 6,354 tests / 59
      snapshots; 19 tests in five files fail at `2295f9d` (two more files
      do not compile there); lint identical per file and rule; typecheck
      and build with `verify:bundle` pass; `webview.js` unchanged at
      `20d3aed3…`, `extension.js` `6fffedac…`; evidence unchanged. No live
      or billable call.

- **2026-10-22. Slice 5 is split, and Slice 5A (saved boards) is planned**
  on `epic/lightbox-slice-5a-saved-boards`, from `epic/lightbox` at
  `3e6a156` (every slice through 4G, the sentence rule and the 1.82 floor).
  See the [slice plan](slice-5-saved-boards-and-compare.md) and the ADR's
  D12 addendum of 2026-10-22.
  - **5A:** the Opinion's data basis first (decision 25, its own commit);
    the file format with sources, text and rule ids; saving after a run and
    on a source's first measured board; the Boards rail; open as a
    snapshot, with the changed-file notice and Read the current text; the
    last board back after a reload. Decisions 27–31 are the coordinator's
    defaults for the writer to confirm or redirect; 32 records the format.
  - **5B (Compare)** is a later PR and needs no format change.
  - **Base measured** at `3e6a156`, after `npm ci` into a real
    `node_modules`: 461 suites / 6,354 tests / 59 snapshots; lint 0 errors /
    1,133 warnings; typecheck and build with `verify:bundle` pass;
    `webview.js` SHA-256 `20d3aed3…` and `extension.js` `6fffedac…`, the
    hashes PR #162 recorded.

- **2026-10-22. Slice 5A (saved boards) is built** on
  `epic/lightbox-slice-5a-saved-boards`, awaiting review. See the slice's
  [implementation notes](slice-5-saved-boards-and-compare.md#implementation-notes-2026-10-22)
  for what the writer may want to redirect.
  - **The Opinion's basis is data** (decision 25): rewording the digest
    moves no basis; each canonical field moves its own. The tech debt is
    archived.
  - **Rule ids** beside the paragraph, sentence, dialogue and being-verb
    rules and the Opinion's basis, each pinned by a fingerprint guard; a
    board names the rules that measured it (`boardVersion: 1`).
  - **Format 1:** `LightboxBoardCodec`, typed against the contracts and
    split by layer; `board-v1.json` from the every-kind *Alice* board,
    written by its builder.
  - **The store and the library:** one file per save in
    `prose-minion/boards/`, atomic, never over a file it cannot read;
    saves after a run that landed a group and on a source's first measured
    board; open as a snapshot; the last board back after a reload; both
    built only in `extension.ts`.
  - **Ownership:** open and restore take the source ticket first and never
    replace a board a run is reading; six witnesses with held promises.
  - **The rail's Boards section**, with the changed-file note, Read the
    current text, and an in-row delete confirm.
  - **The writer-data rule** (the coordinator's change before the PR,
    decision 32): a saved board only ever loses standing, never the board.
    A file whose Opinion was cited under another basis rule opens whole;
    its Opinion is stale with the host's reason and its Bring refused,
    until the Opinion is read again. The `basis` file-rejection reason is
    gone; `board-v1.json` is unchanged.
  - **Verification**, after `npm ci` into a real `node_modules`:
    472 suites / 6,512 tests / 59 snapshots; lint 0 errors / 1,133
    warnings, identical per file and rule; typecheck and build with
    `verify:bundle` pass; `webview.js` SHA-256 `c7e47504…` (twice),
    `extension.js` `bfc03e8e…`; visual evidence in
    `docs/pr-reviews/evidence/lightbox-slice-5a-visual/`, 21 captures,
    `errors.txt` empty; 129 errors against the base bundle, 3 (all
    `earlier-rule`) against `dc9280c`'s. No live or billable call.
  - **Tech debt:** a spark set aside saves with the next save; a reopened
    board's passages use today's rules; focus after a confirmed delete; the
    size note reviewed.
  - **PR #163's review** (request changes: four P2, two P3), all six
    fixed, each with a regression test that fails on `bc1fdda`; see the
    review's author response.
    - **F-01:** every adoption moves the reload pointer to the file that
      holds the board, without a duplicate save (A, B, then unchanged A
      reloads to A).
    - **F-02:** the service numbers each adoption; a press checks it after
      its prompts load, and a shelf built across a newer adoption is never
      posted or taken. Board ids still persist.
    - **F-03:** staging names carry a random UUID; a taken final name is
      never reported as this save.
    - **F-04:** folders are `<source-slug>-<source-hash>/`, listings and the
      same-text check read every file, and the rail shows the newest twenty
      with "Showing the newest 20 of N" and Show older.
    - **N-01:** a Delete makes the rail ask again on return. **N-02:** the
      earlier-rule reason comes first at Bring.
    - **Verification:** 474 suites / 6,533 tests / 59
      snapshots; lint identical per file and rule; typecheck and build pass;
      `webview.js` `59b1f612…`, `extension.js` `edf2ea48…`; evidence 27
      captures, `errors.txt` empty, 9 errors against `bc1fdda`'s bundle (all
      `history`).
  - **PR #163's re-review** (request changes: all six resolved, one new P2
    and one P3), both fixed, each with a regression test that fails on
    `f3808b4`:
    - **F-05:** a shelf names its observation, taken before its first
      await; a handler never sends, and the webview never takes, a shelf
      observed before one of the same board it already has. A newer save
      at the same adoption is still taken.
    - **N-03:** Show older goes on from the rows shown, so a page widened to
      reach a restored board deep in the history grows at every press.
    - **Not changed:** slug-only development folders are not discovered or
      migrated (format 1 has not shipped); listing cost is Low tech debt.
    - **Verification:** 474 suites / 6,541 tests / 59
      snapshots; lint identical per file and rule; typecheck and build pass;
      `webview.js` `acfc8891…`, `extension.js` `2738d16b…`;
      evidence states rebuilt, 27 captures, `errors.txt` empty.

- **2026-10-22. Slice 5A.1 (board names and the writer's calls) is built**
  on `epic/lightbox-slice-5a1-board-names`, from `epic/lightbox` at
  `3e5c3a1` (5A merged, PR #163), awaiting review. The writer made four
  calls on 5A (decisions 33–36); see the slice's
  [section](slice-5-saved-boards-and-compare.md#slice-5a1-board-names-and-the-writers-calls)
  for what the writer may want to redirect.
  - **The barrel first,** in its own commit with no behaviour change:
    `messages/lightboxBarrel.ts` holds the Lightbox re-exports and its parts
    of the routing unions; `index.ts` went from 496 lines to 413.
  - **Names (decision 33):** an optional `board.name` in format 1 (still
    format 1), one rule for the codec, the route and the rail (trimmed, one
    line, at most 120 characters); a name that does not read is left out
    and counted, never the board; `board-v1.json` unchanged beside
    `board-v1-named.json`. `LIGHTBOX_RENAME_BOARD` names the board on screen
    and the file that holds it, or one other file; each row names the models
    that read it; the head names the board on screen, with Name or Rename,
    edited in place.
  - **Rewrites in place:** the store claims a file (an atomic rename that
    never overwrites) before it replaces it, so a rewrite never brings back
    a board another window deleted; the last rewrite to commit wins; a
    claimed file is busy; a claim left behind is put back.
  - **The notice above the board (decision 34):** the rail's own, from the
    same shelf, so the two come and go together.
  - **A spark set aside saves at once (decision 35),** in place, with no
    new file. **Stopped and partial runs keep saving (decision 36):** no
    change.
  - **Extras from 5A's tech debt, both done:** focus after a confirmed
    delete, and a missing restore's pointer; both notes archived.
  - **Verification**, after `npm ci` into a real `node_modules`: 479
    suites / 6,617 tests / 59 snapshots (474 / 6,541 / 59 at `3e5c3a1`);
    lint 0 errors / 1,133 warnings, identical per file and rule; typecheck
    and build with `verify:bundle` pass; `webview.js` SHA-256 `427e81f8…`
    and `extension.js` `54c130f5…`, the same on a second build; visual
    evidence in `docs/pr-reviews/evidence/lightbox-slice-5a1-visual/`, 18
    captures, `errors.txt` empty, 51 errors against the base bundle. No
    live or billable call.
  - **PR #164's review** (request changes: four P2, two P3), all six
    fixed. Each of the review's sequences fails on `ada5717`, and each of
    its controls passes there; see the
    [author response](../../../docs/pr-reviews/pr-164-lightbox-board-names-review.md#author-response-2026-10-22).
    - **F-01:** claims are live or abandoned by age. A claim's name records
      when it was taken; younger than the 30-second lease, no other window
      touches it, and the file is busy. Abandoned claims are put back when
      the saved name is empty and removed beside a standing file. A delete
      claims the file and retires every earlier version, so a delete is
      never undone. A rewrite checks its claim before committing. The one
      race left (a stall past the lease, with another window's put-back
      and delete inside its last rename) is recorded in the slice notes.
    - **F-02:** the store's read settles a gone file's claims; a restore
      keeps its pointer while another window holds the file, and restores
      a board left mid-rewrite.
    - **F-03:** a spark's file write is that spark's alone (the order after
      the file's highest), so two windows' marks on different sparks stand.
    - **F-04:** the name field sends only an edit the writer made; an
      answer that lands while it is open shows in it. **N-01:** a refused
      name on leaving keeps the field open with its reason. **N-02:** the
      model line counts whole names.
    - **The 500 px clipping** the review noted predates this slice (it
      clipped at `3e5c3a1`); a press's button now wraps its cost, and the
      evidence harness fails on any clipped button.
    - **Verification:** 481 suites / 6,643 tests / 59 snapshots; lint
      identical per file and rule; typecheck and build with
      `verify:bundle` pass, twice; `webview.js` `66c1f405…`,
      `extension.js` `b72fa490…`; evidence re-rendered, 18 captures,
      `errors.txt` empty, states byte-identical. No live or billable call.
  - **PR #164's re-review** (2026-10-23: F-03, F-04, N-01 and N-02
    resolved; F-01 and F-02 open on narrower paths), both fixed in
    `bad728eb`. Each of the five witnesses fails on `17e4cd7`, and the
    controls pass there.
    - **F-01:** a delete is acknowledged only once a second look at the
      folder finds no earlier version left. A leftover that would not go,
      or a folder it could not read, puts the board back as it was and
      the delete says it failed. A folder read error is never an empty
      folder.
    - **F-02:** every `missing` a read returns is classified. A board put
      back and claimed again before the reread is busy, an unreadable
      folder is unreadable, and a restore forgets its pointer only on
      established absence.
    - **Verification:** 482 suites / 6,653 tests / 59 snapshots; lint
      identical per file and rule; typecheck and build with
      `verify:bundle` pass, twice; `webview.js` `66c1f405…` (unchanged),
      `extension.js` `e9c04557…`; the evidence states, rebuilt, are
      byte-identical. No live or billable call.
- **2026-10-23. Slice 4H (reading tolerance) is built** on
  `epic/lightbox-reading-tolerance`, from `epic/lightbox` at `a57a5cd`
  (PR #164 merged), awaiting its PR. The writer saw blocks withheld on long
  chapters for a field one character over its bound, and a whole paid
  group fail on one stray closing brace. See the
  [slice notes](slice-4h-reading-tolerance.md), with every maximum the
  codecs held classed as an ask or a structural rule, and what the writer
  may want to redirect.
  - **Asks, not gates (decision 37):** the asks raised by a quarter to a
    third; overruns shown in groups A–G; one safety ceiling (eight times
    each ask, never in a prompt) clips runaway free prose with an ellipsis
    and counts it, and every field a rule reads is checked whole (PR #165
    F-01); Bring and the Build lens seed clip at their own bounds.
  - **The output ceiling (decision 38):** 12,000 tokens and 48,000
    characters a group; the estimate still prices typical output.
  - **Repair before rejecting (decision 39), in a shared parser:**
    `@parsers/ModelJsonRepair` (with `ModelJsonTokens`), feature-agnostic
    and guarded so; structure-only repairs under a content guard, errors
    with no text; wired into the Lightbox only, the four widget call sites
    recorded as tech debt.
  - **Truncation salvage (decision 40):** the finished blocks read, the cut
    one withheld with the host's reason and the recovery file's place; the
    ribbon's Movements lane no longer blames tiling for it.
  - **Verification**, after `npm ci` into a real `node_modules`: 488
    suites / 6,737 tests / 59 snapshots (482 / 6,653 / 59 at `a57a5cd`);
    lint 0 errors / 1,133 warnings, identical per file and rule; typecheck
    and build with `verify:bundle` pass, twice; `webview.js` `405f6cd1…`,
    `extension.js` `47c258bb…`; visual evidence in
    `docs/pr-reviews/evidence/lightbox-slice-4h-visual/`, 15 captures,
    `errors.txt` empty, 3 errors against the base bundle. No live or
    billable call.
  - **PR #165's review** (four Medium / P2), all fixed in `2ebeda4b`; see
    the [author response](../../../docs/pr-reviews/pr-165-lightbox-reading-tolerance-review.md#author-response-2026-10-23).
    F-01: every rule reads a field whole; only free prose is clipped at
    the safety ceiling. F-02: a reply cut off inside its closing sentinel
    or fence keeps its finished blocks. F-03: a cut curly-quoted token
    drops only its member. F-04: no test pins the engine's `JSON.parse`
    wording, and the parser reads a position only from a message's end.
    490 suites / 6,794 tests / 59 snapshots under Node 22, and the same
    under Node 18.20.8, all passing. Lint identical; typecheck and both
    builds pass; `webview.js` `405f6cd1…` (unchanged), `extension.js`
    `4730ecf7…`.
  - **PR #165's re-review** (F-01 to F-04 closed; one new Medium / P2,
    F-05), fixed in `decd276d`; see the
    [author response](../../../docs/pr-reviews/pr-165-lightbox-reading-tolerance-review.md#author-response-to-the-re-review-2026-10-23).
    F-05: the bare-digit rule's lookbehind re-read a long digit run for
    every digit, now that F-01 hands it whole fields; `lightboxHasBareDigit`
    reads the text once and keeps the rule exactly. The same audit fixed a
    spark's closing-mark strip and a chapter line's trailing-space trim.
    491 suites / 6,829 tests / 59 snapshots under Node 22 and Node 18.20.8,
    all passing; lint identical; typecheck and both builds pass;
    `webview.js` `405f6cd1…` (unchanged), `extension.js` `1da47dcf…`.
- **2026-10-23. Slice 4I (run controls) is built** on
  `epic/lightbox-run-controls`, stacked on 4H (from
  `epic/lightbox-reading-tolerance` at `4dcdb2b`, with its PR #165
  corrections and its re-review's merged in, at `467950d` and `bdec17f`),
  awaiting its PR. The writer asked,
  after using the board on real chapters, for "Run AI Analyses" that stays
  orange as "Finish" and "Re-analyze", an Analyze on every widget that runs
  and reruns its call, and the Lenses panel's "call A" as a button. See the
  [slice notes](slice-4i-run-controls.md), with every copy change and what
  the writer may want to redirect.
  - **The run vocabulary (decision 41):** the run line's three presses, all
    orange with the sparkle; Analyze / Re-analyze / Analyzing… on widgets;
    Run / Rerun on calls; "Not analyzed yet."; the words that named the
    old buttons name the new ones.
  - **One call, run on its own (decision 42):** a `group` run scope the
    host resolves (the call's lenses that are on, plus the widget's own),
    checked in `LightboxPressScope` before anything is reserved; a re-run
    replaces the call, cleared first; G needs nothing read first; the
    estimate's `groups` prices each call; every press guard holds.
  - **A widget's Analyze (decision 43):** in place of the bare "read" badge
    on every AI-read widget (COUNTED kept beside it on a counted-read one),
    from one pure view model (`lightboxCallControls`) through a provider
    around the board; focusable while disabled, its reason described.
  - **The Opinion's Analyze (decision 44):** F alone, disabled with the
    Opinion's own reason while nothing is read and current, the rule shared
    with the host's refusal; it replaces "Re-read the Opinion".
  - **One Run per call in the Lenses panel (decision 45):** a small header
    per call.
  - **Verification**, after `npm ci` into a real `node_modules`: 494
    suites / 6,886 tests / 59 snapshots (491 / 6,829 / 59 at `bdec17f`;
    488 / 6,737 / 59 at `d255b8e`), the same under Node 22 and Node
    18.20.8; lint 0 errors / 1,133 warnings, identical per file, rule and
    severity to `d255b8e`; typecheck and build with `verify:bundle` pass,
    twice; `webview.js` `478dbd9b…`, `extension.js` `0b1af8b7…`, the same
    both times; visual evidence in
    `docs/pr-reviews/evidence/lightbox-slice-4i-visual/`, 27 captures,
    `errors.txt` empty, 186 errors against the base bundle. 23 of the 24
    new and changed suites fail on `d255b8e`. No live or billable call.
  - **PR #166's review corrections (2026-10-23).** Astra's review asked
    for one correction and two follow-ups; all three are made. **F-01:** the
    Opinion's "up to $0.05" priced its input at the digest's bound but its
    output at the typical reply, so it was no cap; it now reads "≈ $0.05",
    like every call's, on its Analyze and Run F, its name and tooltip
    adding "input at digest limit". **N-01:** every call button's name
    starts with its visible label ("Run A, call A: …"). **N-02:** the
    headline's Re-analyze stays mounted, as "Analyzing…", while call A reads
    it, so its focus holds through the start, the landing, a failure and a
    stop. The evidence gains four host moments (the headline rerun, landed
    and failed) and the headline-rerun captures. `epic/lightbox` (PR #165
    merged, `08b0d22`) is merged in.
  - **The writer's answers (decisions 47 and 48), in the same PR.** The
    Opinion run on its own keeps its old reading until the new one lands:
    shown as the earlier one while it is weighed, replaced when it lands,
    kept as it was, with the reason, after a failure or a Stop, and held by
    the board saved after a failure. The inspector's "Re-read this tile" is
    **Re-analyze this tile**, and the copy that sends the writer to it says
    "re-analyze". The evidence gains two host moments (the Opinion's
    Analyze held, then failed) and their captures.
  - **Verification** on the head with the writer's decisions, after
    `npm ci` into a real `node_modules`: 495 suites / 6,905 tests / 59
    snapshots, the same under Node 22 and Node 18.20.8; lint 0 errors /
    1,133 warnings, identical per file, rule and severity to `d255b8e`;
    typecheck and build with `verify:bundle` pass, twice; `webview.js`
    `4297b760…`, `extension.js` `ad1aaf12…`, the same both times.
    Evidence: 45 captures, `errors.txt` empty; 303 errors against the
    reviewed head's bundle (F-01 39, N-01 210, N-02 42, decision 47 12)
    and 207 against the base. Five of the six decision-47 host tests
    fail with the press back on clear-first. No live or billable call.
    See the
    [author response](../../../docs/pr-reviews/pr-166-lightbox-run-controls-review.md).
    33 of the new and changed tests fail on the reviewed head's source.
- **2026-10-23. Slice 5A.2 (saved boards in the Workshop's design language)
  is built** on `epic/lightbox-boards-browser`, from `epic/lightbox` at
  `a57a5cd`, for the writer's decision 46. See the
  [slice notes](slice-5-saved-boards-and-compare.md#slice-5a2-saved-boards-in-the-workshops-design-language).
  - **One file per board.** The first save names the file by default
    ("alice-1 - 10/23/2026 9:08 AM", the host's local time); later saves
    rewrite it in place at the revision the window last read or wrote;
    "Read the current text" starts a new board and file. A file another
    window changed or holds, one with a part left out, one that is gone, or
    a failed rewrite is left as it is, and the board saves to a new file
    and follows it.
  - **The Boards panel is gone.** The Workshop's sessions menu and session
    browser are now the full tabs' shared `SavedItemsMenu` and
    `SavedItemBrowserModal`; the Lightbox's Boards menu and browser compose
    them over every chapter's boards, with search, date or chapter groups,
    inline rename and delete. "Open a board file…" opens any
    `*.board.json` through the host's picker; one outside the store is a
    snapshot never written, and its next save writes a new file in the
    store. The Workshop's markup, computed styles and boxes are identical
    before and after, and its tests run unchanged.
  - **Verification:** 490 suites / 6,720 tests / 59 snapshots
    (482 / 6,653 / 59 at `a57a5cd`); lint identical per file, rule and
    severity to `a57a5cd`; typecheck; two builds with `verify:bundle` after
    `npm ci`, `webview.js` `be9b6a9c…`, `extension.js` `10d4dd8d…`; the
    evidence, 30 Lightbox captures and 30 Workshop before-and-after
    captures, with `errors.txt` and `workshop-errors.txt` empty. No live or
    billable call.
  - **Decision 46**, numbered after 45: Slice 4I (run controls, PR #166, in
    review) takes 41–45.
  - **`epic/lightbox` at `08b0d22` (Slice 4H, PR #165) merged in**, keeping
    both sides of the three conflicts (the boards harness's options, this
    README, the test inventory). After it: 499 suites / 6,896 tests / 59
    snapshots (491 / 6,829 / 59 at `08b0d22`) under Node 22 and Node 18.20.8
    (a first Node 18 run beside another suite missed four timing bounds;
    they passed alone and on the rerun); lint identical
    to `08b0d22`, typecheck and two builds under Node 22 and Node 18.20.8,
    `webview.js` `1f28383f…` and `extension.js` `44596e69…` each time;
    the evidence rendered again, with the same results.
  - **PR #167's review corrections (2026-10-23).** Astra's review asked
    for changes: three P2 findings and four P3 findings, all now made.
    - **F-01:** a finished run's save, waiting in the store's queue while
      another run starts on the same board, writes the settled board it
      was owed, not the running one.
    - **F-02:** the name sheet is bound to the board and adoption it was
      opened for. It closes when either changes, Rename is held back
      while a board opens, and the host refuses a rename for an earlier
      adoption.
    - **F-03:** the answers to opening, deleting and renaming show in a
      banner under the header that outlives the sheet and the browser,
      and a name its file does not hold shows "Name not saved".
    - **N-01:** "Save failed" clears on the next commit.
    - **N-02:** a board from outside says it is saved here once it is.
    - **N-03:** a picked file's read error is logged by its code only.
    - **N-04:** deleting the last board leaves focus on Close.

    21 of the new and changed tests fail on the reviewed code's sources.
    Every control the review named passes there, except the same-board
    rename, whose expected message now carries the adoption. The evidence gains `kept`,
    the banner state. See the
    [author response](../../../docs/pr-reviews/pr-167-lightbox-boards-browser-review.md).
  - **`epic/lightbox` at `fcf86ff` (Slice 4I, PR #166) merged in.** The
    conflicts were this README (4I's decisions 41–45, 47 and 48 around
    this slice's 46), the Lightbox module list and the test inventory.
    4I's decision-47 host test counted a new file for the save after a
    failed Opinion call. It now checks that the board's one file is
    rewritten in place, still holding the old Opinion. A new test pins
    decision 47 through an owed save: the failed call's save, held while
    the Opinion runs again, writes the failed call with the old Opinion.
    After it: 504 suites / 7,000 tests / 59 snapshots (495 / 6,905 / 59
    at `fcf86ff`), all passing under Node 22 and Node 18.20.8. Lint is
    identical to `fcf86ff`. Typecheck and two builds pass under each Node,
    with `webview.js` `1fe07246…` and `extension.js` `805bd134…` all four
    times. The evidence was rendered again on that bundle: 33 captures,
    `errors.txt` empty, and 204 errors against `fcf86ff`'s bundle.
  - **PR #167's re-review (2026-10-23).** Astra closed F-02, F-03 and
    N-01 to N-04, and confirmed the 4I integration. F-01 was open in one
    order:
    1. B landed, and its save waited in the queue.
    2. B ran again on its own (cleared on screen, decision 42) and was
       stopped with nothing back, before the save's turn.
    3. The save wrote the stopped B.

    Fixed in `85c547c5`: `owedBoard` writes the readings and rules its
    own run settled, exactly as captured, carrying only the file,
    revision, name and spark marks from the board at its turn. A later
    run that lands saves itself. Both orders are now tested, beside a pure
    test of the general shape. After it: 505 suites / 7,009 tests / 59
    snapshots, all passing under Node 22 and Node 18.20.8. Lint is
    identical to `fcf86ff`. Typecheck and two builds pass under each
    Node, with `webview.js` `1fe07246…` (unchanged) and `extension.js`
    `d3c51bdb…` all four times. The evidence's states rebuild byte for
    byte.
