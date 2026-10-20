# Slice 4: Lineage, Subtext, Spark, and Bring to Workshop

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D3 (kinds), D7, D11
**Status:** In review. Built on `epic/lightbox-slice-4-lineage`, now based on `epic/lightbox` at `9e5363c` (PR #150 merged); see [Implementation notes](#implementation-notes-2026-10-20). It also fixes PR #150's F-08, and the PR #151 review's F-01 to F-06 ([Review fixes](#pr-151-review-fixes-2026-10-20)).

## Outcome

Three lenses join the board, and any tile can be carried into the Workshop.

- **Lineage:** adjacent myths and stories, each marked matches, departs or
  subverts against quoted evidence. It includes a "checked and set aside"
  line, and an empty result is allowed.
- **Subtext:** said and meant pairs anchored on dialogue lines.
- **Spark:** a separate lane of offers phrased as questions. Each has
  counted support and paragraph addresses. "Not for me" dismisses it, with
  undo.

**Bring to Workshop** stages any pinned tile above the Workshop composer. A
header tray counts the tiles bound for the Workshop and opens it.

## Host

- Prompts: `22-subtext.md`, `31-lineage.md`, `32-spark.md`; updated worked
  examples for groups B and C. Spark rules: questions or offers only, never
  instructions, and no claim without a paragraph address.
- Codec kinds: `lineage` (stance enum `matches | departs | subverts`),
  `subtext`, `spark`.
- **Handoff (ADR D11):**
  - `LIGHTBOX_HAND_OFF` with `{ kind: 'tile', tileKind, title, claim, quotes, friction }`;
  - quotes are re-verified against the current source before the handoff;
  - `WorkshopPanelProvider.stageLightboxTile(item)` routes a synthetic
    `WORKSHOP_STAGE_LIGHTBOX_TILE` through the Workshop panel's own handler;
  - the Workshop renders it as a pending message attachment (the thread
    artifact frame), which the writer sends or removes;
  - the attachment carries the claim and the verified quotes only, never the
    whole board;
  - it is bounded by `PROMPT_BUDGETS.workshopThreadArtifacts`.
- Architecture: the new Workshop route joins the ledger, and the attachment
  kind registers with the frame neutralizer in the same change.

## Webview

- `LightboxLineage`, `LightboxSubtext`, `LightboxSparkLane`.
- Header tray (`n tiles bound for Workshop · Open Workshop →`) and the
  inspector's Bring and Bound states.

## Tests

- Codec: a stance outside the enum; a spark phrased as an instruction is
  rejected by a validator rule (imperative opener list, tuned on fixtures);
  an empty lineage block is valid.
- Handoff:
  - staging reaches the Workshop only through its handler;
  - a stale tile is refused;
  - the attachment payload stays within its budget;
  - the Workshop shows the staged item, and removing it sends nothing.

## Done when

A pinned motif, lineage item or spark appears above the Workshop composer
with its quotes, and nothing is sent until the writer sends it.

## Implementation notes (2026-10-20)

Commits on `epic/lightbox-slice-4-lineage`, in order:

| Commit | What |
|---|---|
| `7240e8b` | The three readings and the Spark lane |
| `268166e` | Merge of Slice 3 at `0b03f1e` (the claim-before-open seed delivery) |
| `5c362f0` | Bring to Workshop, host half: the tile handoff, the second seed kind, the tray port |
| `27baa75` | Merge of `epic/lightbox` at `9e5363c` (PR #150 merged) |
| `a7a368b` | PR #150 F-08: a seed granted to a reloaded webview is released |
| `54f4c19` | Bring to Workshop, Workshop half: staging above the composer |
| `c3f0b7f` | Bring to Workshop, Lightbox half: Bring, Bound and the header tray |
| (docs) | Visual evidence, this note, the epic note, agent docs, tech debt, the PR #150 F-08 note |

### Readings

- **Prompts.** `22-subtext.md` (group B), `31-lineage.md` and `32-spark.md`
  (group C). The B and C worked examples (Alice ch. I) gain three subtext
  pairs, two lineage stories with two set-asides, and three sparks; both
  decode through the production codec and verifier with every quote exact.
  New bounds in `PROMPT_BUDGETS.lightbox` (`lineageStories` 4,
  `lineageStances` 3, `lineageSetAsides` 3, `subtextPairs` 4,
  `subtextContextQuotes` 2, `sparks` 4, `sparkCharacters` 240), pinned by
  the sync test. Typical output tokens per lens (subtext 640, lineage 900,
  spark 620) are guesses until Slice 6.
- **Lineage.** One to three stances per story, each `matches`, `departs` or
  `subverts` and each at most once; anything else withholds the story. The
  "checked and set aside" list is required (possibly empty) and rides on the
  lens's friction (`LightboxLensFriction.setAside`), so it follows the lens
  through stale carry and re-reads. A story also set aside, or named twice,
  is withheld. An empty lineage is valid; its friction says why.
- **Subtext.** The said line must be found in its paragraph by the existing
  verifier and lie inside a dialogue span there (`findDialogueSpans`). The
  verifier takes a span filter, and `LightboxDialogueAnchor` finds the said
  line with a dialogue filter, so of every span the verifier accepts (exact
  before folded) the first inside dialogue is chosen, with no second matcher
  (PR #151 F-04). The meant side is the tile's claim, labeled a reading. The
  said line leads the evidence.
- **Spark.** A question, never an instruction: it must end with "?", no
  clause may open with an imperative from `LIGHTBOX_SPARK_IMPERATIVE_OPENERS`
  (tuned on fixtures), no directive phrase, and no number outside a ¶
  address (`LightboxSparkPhrasing`). Softening words ("Please", "Now", "So",
  "Then", "Maybe"…) are skipped before the check, and a clause that does not
  open as a question is checked again after each comma (PR #151 F-03). Each
  spark needs host-counted support and found quotes.
  **The limit:** this is a word-list heuristic, not a parse. An unlisted
  verb passes ("Sprinkle in a storm. What changes?"), as does a command
  inside a clause that opens as a question ("What if you add a storm?",
  "Does she fall, and add a line?"); a listed word opening a comma segment
  of a set-up clause ("She could stop, look and listen: …") is withheld, the
  safe failure. A test pins each of these.
- **Shared.** `strictObject` on every block, host-owned reasons, undefined
  fields counted and never named, friction required, quotes verified, and
  the model never supplies counts. The gates live in `LightboxTileGates`,
  so fresh assembly and stale carry apply the same rules; the parity sweep
  and the every-kind test cover the new kinds.

### The Spark lane

- **Dismissal is host-owned.** `LIGHTBOX_SET_SPARK_DISMISSED` marks the
  board's own spark (`dismissedOrder`) through `updateReadings`, so "Not for
  me" survives a reload and a source switch, and the lane draws only what
  the board says. Undo brings back the latest set aside.
- **On a stale board.** The route answers only for the board on screen; a
  request naming another board changes nothing. A spark carried onto a
  changed chapter keeps its mark, and can be set aside or brought back
  there; a re-read of the spark lens draws new sparks, none set aside. A
  stale spark cannot be brought to the Workshop until it is read again.

### Bring to Workshop

- **Request.** The webview sends ids only:
  `LIGHTBOX_HAND_OFF { kind: 'tile', boardId, tileId }`.
  `LightboxHandoffRoute` (split out of `LightboxHandler`) checks the board is
  on screen and the file unchanged; `prepareLightboxTileHandoff` resolves the
  tile, refuses a stale, re-reading or set-aside one, re-verifies the said
  line first and then the evidence, drops a quote longer than its bound
  rather than cutting it (a said line that is too long refuses the pair
  instead, PR #151 F-02), and builds the item: kind and lens labels, title,
  claim, labeled points (a story's stances, a pair's speaker), at most four
  quotes and the source label, within `WORKSHOP_LIGHTBOX_TILE_LIMITS`.
- **Delivery reuses Slice 3's helper.** `WorkshopSeedKind` gains
  `lightbox-tile`; `WorkshopPanelProvider.stageLightboxTile` offers it through
  its own `WorkshopSeedDelivery` and returns `Promise<WorkshopSeedOutcome>`.
  The synthetic `WORKSHOP_STAGE_LIGHTBOX_TILE` reaches the new
  `WorkshopLightboxTileHandler`, which checks the tile again, holds it and
  posts `WORKSHOP_LIGHTBOX_TILE_OFFERED`. `useWorkshopLightboxTiles` claims it;
  after the grant it sends `WORKSHOP_ACCEPT_LIGHTBOX_TILE`, the handler stages
  it or refuses it (`busy`, `full`, `duplicate`) and always answers, and the
  webview answers the provider with that word. The app router sends each
  kind's claim result to its own receiver only.
- **Bound only on confirmation.** Lightbox shows **Bound for Workshop** only
  while the Workshop's tray holds the tile, and a refusal's reason otherwise.
  When the Workshop's answer is lost after it staged the tile (a reload or a
  close crossing the answer, F-08), the host counts the session holding the
  tile as the confirmation.
- **Seed state.** A staged tile is session state: a pending message
  attachment carrying `lightboxTile` meta (ids, kind label, quote count,
  source label), sent with the writer's next message in a thread-artifact
  frame of kind `lightbox-tile`. The kind joins one closed registry
  (`workshopThreadArtifactKinds.ts`) read by the frame builder, the session
  codec and the session's commit check; the frame adds a trust line and
  neutralizes the body. The new fields are optional and additive, so no
  schema bump (ADR 2026-07-30); the codec round-trip test refuses a wrong
  kind or stray meta.
- **Routes.** `WORKSHOP_STAGE_LIGHTBOX_TILE` is direct (holding an offer
  changes nothing); `WORKSHOP_ACCEPT_LIGHTBOX_TILE` is a mutation behind the
  session-operation gate, refused as `busy` while one is pending. Both are in
  the `boundaries.test.ts` ledger.
- **Overlays.** Staging opens no sheet and never touches the composer's
  draft, so it is not refused while a Workshop overlay is open: the pill
  appears behind it. It is refused as `busy` while a response runs.
- **Transcript and recall.** `projectWorkshopTranscript` exports a sent
  tile as its pill label only (kind and title); the claim, points and
  quotes never leave the session. Recall reads the same projection.
- **Tray.** "n tiles bound for Workshop · Open Workshop →" counts the
  Workshop session's pending Lightbox tiles, from any board: confirmed
  stages only. Sending or removing a tile in the Workshop drops it; closing
  the Workshop tab keeps it (session state); replacing the room (new, open,
  rewind, branch) follows the room. The session tells listeners on a
  microtask after each change.

### PR #150 F-08 (fixed here, `a7a368b`)

Each Workshop mount announces a receiver id once listening
(`WORKSHOP_SEED_RECEIVER`), and every claim and answer names it. A seed is
sent only after an announcement; a new receiver on the same panel settles a
seed granted to the old one as `reset`, sends again a seed sent to it but
never claimed, and ignores the old receiver's late replies. A grant to the
current receiver is never touched. Recorded in the
[PR #150 review](../../../docs/pr-reviews/pr-150-lightbox-lexical-gravity-review.md)
as a dated author note. The ADR's D11 now states the
commit-point contract (the deadline covers unclaimed offers; the post-grant
wait ends on an answer, a close or a reset) and that visibility is checked
at dispatch.

### PR #151 review fixes (2026-10-20)

Astra's review
([PR #151](../../../docs/pr-reviews/pr-151-lightbox-lineage-subtext-spark-review.md))
found five P2 issues and one P3; each reproduction is a regression test that
fails at `132aabb`. The author response at the end of the review has the
detail and SHAs.

- **F-01, tile identity across Rewind.** `WorkshopMessageAttachmentIdentity`
  is the one rule for "the same source": a tile by its board and tile ids, a
  configured resource by its path, any other file by its host source key.
  Staging, Rewind's restage and hydration use it; a restaged tile gets its
  key back; two logged normalizations repair development checkpoints an
  earlier rewind left with a duplicate or unkeyed tile.
- **F-02, the said anchor on Bring.** Checked after every bound; a said line
  longer than a Workshop quote refuses the pair (`saidTooLong`). The
  Workshop's validator requires a said/meant tile to lead with its said line.
- **F-03, Spark phrasing.** Softening words and comma-led commands, above.
- **F-04, said lines among equivalent spans.** The verifier's span filter,
  above, used by fresh assembly and stale carry alike.
- **F-05, artifact provenance.** One owner per committed artifact; a
  widget's kind is checked whatever else references it.
- **F-06, accepts held to their grant.** The accept names its receiver; the
  provider forwards it only while `WorkshopSeedDelivery.isGranted` holds.
- Also: the harness's lineage selector, and the session's own copy of a
  tile's attachment meta.
- **F-07 (re-review, P3), on `epic/lightbox-slice-4-followups` (`218656b`).**
  A carried pair's evidence now leads with the said line it found, through
  the helper fresh assembly uses (`lightboxSaidLedEvidence`), so the card
  and inspector never show the narration's copy as "found verbatim".

### Deviations

- **The request carries ids, not the tile.** This doc's
  `{ kind: 'tile', tileKind, title, claim, quotes, friction }` became
  `{ kind: 'tile', boardId, tileId }`, as the brief required; the host builds
  the item, and it carries no friction (claim, points and quotes only).
- **Undo brings back the latest** set aside, one at a time, rather than all.
- **Every reading can be brought**, gravity fields included (they keep
  "Build as a lens" beside it); a tile with no quote is disabled.
- **A spark travels as a question**: its button reads "Bring as a question".
- **The evidence turns group A's lenses off**, so its board shows B and C
  only; Slice 3's evidence covers group A.

### Verification

| Check | Base `9e5363c` | Head |
|---|---|---|
| Jest | 370 suites, 5,257 tests, 2 snapshots | 383 suites, 5,412 tests, 2 snapshots; 385 suites, 5,457 tests, 2 snapshots after the PR #151 fixes |
| Lint | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings, identical per file and rule |
| `npm run typecheck` | Passes | Passes |
| `npm run build` (with `verify:bundle`) | Passes | Passes |
| `git diff --check` | Passes | Passes |

- No live or billable call: every test and the evidence play the provider.
- Visual evidence:
  [`lightbox-slice-4-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-4-visual/README.md).

### Follow-ups

- [The Workshop does not reflow at narrow widths](../../tech-debt/2026-10-19-workshop-narrow-width-reflow.md) (Low)
- [A seed offer the Workshop refuses only times out](../../tech-debt/2026-10-19-workshop-refused-seed-offer-times-out.md) (Low)
- [Dialogue % ignores single-quoted dialogue](../../tech-debt/2026-10-19-dialogue-single-quote-convention.md):
  now also withholds every subtext pair in single-quoted text (Low).
- [A carried said line does not follow speech that moved past narration](../../tech-debt/2026-10-20-lightbox-carried-said-line-moved-speech.md)
  (Low; pre-existing, noted in the PR #151 re-review).
