# Slice 5: Saved Boards and Draft Compare

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D12 and its addendum of 2026-10-22
**Writer decisions:** 5, 14, 25, and 27–32 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Split into two PRs (2026-10-22). **5A** (saved boards: the format, save, open, delete, reload) is built on `epic/lightbox-slice-5a-saved-boards`, from `epic/lightbox` at `3e6a156`, awaiting review; see [its implementation notes](#implementation-notes-2026-10-22). **5B** (Compare) follows it and needs no format change.

## Before starting

This slice fixes the board as a file format, so it begins only after the
writer has reviewed Slices 2B–4 output on real chapters. Record that review
in the epic's progress notes: what the writer changed, removed or asked to
keep. Then adjust the board contract **before** writing the codec. Fields
that did not earn their place are removed now, while that is still free.

**The writer's checkpoint is passed (2026-10-20).** After real-chapter
passes the writer said the board "is working great", and asked for new
lenses first (Slices 4B–4D, epic decision 14), so this slice starts after
4D and its format holds them. Slices 4E, 4F and 4G landed before it too
(PRs #159–#162), so the format holds the inspector's hapax list, craft
steering and dialogue as voice.

## The split

| | Slice 5A | Slice 5B |
|---|---|---|
| What | The file format, saving, opening, deleting, the Boards rail, reload | Compare two saved boards of one source |
| Branch | `epic/lightbox-slice-5a-saved-boards` | later |
| Routes | `LIGHTBOX_REQUEST_BOARDS` / `LIGHTBOX_BOARDS`, `LIGHTBOX_OPEN_BOARD`, `LIGHTBOX_DELETE_BOARD` | `LIGHTBOX_COMPARE` / `LIGHTBOX_COMPARISON` |
| Format | Defines `formatVersion: 1` | Reads it unchanged |

5A shapes the format so 5B needs nothing more from it: every board records
its sources (a list), their text, and the ids of the rules that measured
it, so a comparison can be labelled when two boards were measured under
different rules or hold different paragraph counts.

## Slice 5A: saved boards

### Decisions

Decision 25 is the writer's. Decisions 27–31 are the coordinator's
defaults, written down for the writer, who may redirect any of them;
decision 32 records what the format holds.

1. **The Opinion's citation basis is data** (decision 25), implemented
   first, in its own commit. A citation's basis hashes the cited item's
   canonical data: its key and kind, its quotes with their ¶ addresses, its
   counts and figures, and the reading's own words (title, claim, its
   kind's fields). Never the digest's wording.
   - Rewording a digest line keeps every Opinion current; changing any
     canonical field makes the Opinions that cite the item stale.
   - The rule is versioned: a saved board records the basis it was cited
     under (`rules.opinionBasis`). A board cited under another rule still
     opens (decision 32's writer-data rule): only its Opinion loses
     standing.
   - The standing rules are unchanged: an Opinion is stale when a cited
     item is gone, not current, or says something else.
   - The [tech debt](../../archive/tech-debt/2026-10-21-lightbox-opinion-basis-is-rendered-text.md)
     closes with it.
2. **Save (decision 27).** A board saves itself:
   - when a reading run ends having landed a group: finished, or stopped
     with groups back (a run that changed readings);
   - when a board with no readings is built for a source and no saved board
     of that source holds the same text.

   One file per save, `prose-minion/boards/<source-slug>-<source-hash>/<timestamp>.board.json`,
   written once and never overwritten. No pruning: the writer deletes from
   the rail.
3. **Availability (decision 28).** The `LexicalGravityLensRepository` rule:
   one workspace folder saves; no folder, or several, keeps boards for the
   session only, and the rail says so plainly. A save that fails is logged,
   the rail says the last save failed, and the board stays on screen.
4. **Open is a snapshot (decision 29).**
   - A saved board opens exactly as saved, against its own saved text,
     measured by the rules it was saved under. Nothing is measured again.
   - When the source file's text now differs (by content hash), a notice
     says so and offers **Read the current text**. That is the existing
     re-read: it builds a board from the file and carries the readings,
     marked stale, with the D4 machinery. It never re-measures silently.
   - Bring from a snapshot whose file changed is refused, with a host reason
     that points to Read the current text.
   - A press on a snapshot reads the board on screen, its own saved text,
     as a press always reads the board it names.
5. **Reload (decision 30).** A window reload, or reopening the tab after
   one, reopens the last board the writer had on screen, from the store,
   instead of losing its readings. Session-only mode keeps today's
   behaviour. The ADR's "readings are lost on reload" consequence is
   amended.
6. **The Boards rail (decision 31).** A Boards section lists the saved
   boards of the open source, newest first: date and time, the lenses read,
   an approximate cost when one was recorded, and which one is on screen.
   Open, and Delete with a confirm step. Keyboard reachable. Its CSS passes
   `webviewCssFloor.test.ts` (Chromium 114) with nothing added to `KNOWN`.
   The host lists every saved board of the source; past twenty, the rail
   shows the newest twenty, says how many there are, and offers **Show
   older** (PR #163 F-04).
7. **What a saved board records (decision 32).** See the format below.
   Not saved: which Opinion view was showing, the filter, the pin, the
   lens toggles, or any other webview preference.
8. **The writer-data rule (decision 32, 2026-10-22): a saved board only
   ever loses standing, never the board.** Saved boards are the writer's
   data; no internal rule change may lock the writer out of one.
   - A file whose `rules.opinionBasis` is not this build's decodes and opens
     whole, as long as the id is well formed.
   - Its Opinion is stale, with the host's reason: "Saved under an earlier
     citation rule; read the Opinion again to bring it current." Its cited
     bases are not compared, since two rules' bases never match.
   - Bring for that Opinion is refused with the same reason. Every other
     kind behaves as it does on any board.
   - The board keeps the id while its readings are kept (a re-read of
     unchanged text, or a carry onto changed text). Reading the Opinion
     again cites it under this build's rule, and the board then says so.

### What the format holds (format 1)

```jsonc
{
  "formatVersion": 1,
  "kind": "lightbox-board",
  "savedAt": "2026-10-22T14:05:09.123Z",
  "board": {
    "boardId": "…",
    "rules": {
      "paragraphs": "…", "sentences": "…", "dialogue": "…",
      "beingVerbs": "…", "opinionBasis": "…"
    },
    "sources": [ { /* LightboxSource */ "text": "the source's own text" } ],
    "paragraphs": [ { "source": 0, "index": 1, "start": 0, "end": 812, /* metrics */ } ],
    "ribbon": [ … ],
    "measured": { … },
    "readings": [ … ]
  }
}
```

- **Readings.** Every tile kind, by the closed union: the measured tiles'
  data, and groups A–G with every reading kind, including steering
  readings and notes with their stance, nudge, example or the reason it was
  withheld, and the voice line. Each tile keeps its host-derived fields
  (counts, column keys, tiers, the Opinion's citations and their bases),
  and each group its withheld claims and blocks, frictions, quote checks
  and stale marks.
- **Measured layers.** The paragraph model with each paragraph's sentence
  lengths, the ribbon, the measured set (the numbers with the writer's
  average as measured and its source counts, `measured.hapax`, style flags
  with their paragraphs and ids), the Sections layer, and craft steering's
  breakdown.
- **Sources.** `sources: LightboxSource[]`, each with its text. Paragraph
  numbers stay the board's own, 1 to N, so no reading changes; each
  paragraph names its source (`source`, an index into `sources`) and its
  offsets into that source's text. That is the offset table: a source's
  paragraphs are the run of board paragraphs that name it, in order. Every
  board 5A writes has exactly one source; a board with more decodes, and
  this build refuses to open it with a reason.
- **The text.** The writer's own text, in their own workspace, so a
  reopened board shows paragraph text, sentence wells, quotes and Bring
  checks, and 5B can compare drafts. The codec checks it against the
  board's content hash. Logs never carry it.
- **Rule ids.** Stable ids defined next to each rule, each pinned by a
  guard test that fails when the rule's output changes without its id
  changing:
  - `paragraphs`, the blank-line splitter (`LightboxParagraphs`);
  - `sentences`, closing marks and speech tags (ADR 2026-10-21,
    `proseSentenceSpans`);
  - `dialogue`, double quotation marks (`findDialogueSpans`);
  - `beingVerbs`, contractions and the next-word rule (decision 26,
    `findBeingVerbs`);
  - `opinionBasis`, the data basis (decision 25).

  A fresh board carries this build's ids; a saved one keeps its own. 5B
  labels a comparison across different ids.
- **`boardVersion`** becomes 1: the board on the wire is the board in the
  file. `formatVersion` versions the file.

### Host

- **`infrastructure/storage/LightboxBoardCodec.ts`** (pure), with its
  decoders split by layer so each module stays under 500 lines:
  - `formatVersion: 1`, `kind`, exact keys everywhere;
  - schema decoders typed against the contracts, so a new field or tile
    kind does not compile until the codec reads it
    (`Record<LightboxReadingTileKind, …>`, plus an architecture guard);
  - invalid tiles and group notes (withheld claims and blocks, frictions,
    quote checks) dropped and counted; the measured layers, the paragraph
    model, a group's own fields and its stale marks must decode whole, or
    the board is invalid (a dropped stale mark would show a stale reading as
    current);
  - reasons are host-owned; an unknown key is counted, never named;
  - no migrations: this is the first shape. A later format follows ADR
    2026-07-30's release rule, with `board-v1.json` as its authentic
    fixture;
  - separate from the Workshop session codec, as transcript export is.
- **`infrastructure/storage/LightboxBoardStore.ts`**:
  - files at `prose-minion/boards/<source-slug>-<source-hash>/<timestamp>.board.json`;
    the slug is `[a-z0-9-]` only, the hash the first eight hex digits of
    the SHA-256 of the source's portable key, so sources whose paths slug
    alike keep folders of their own (PR #163 F-04); every path is checked
    with `isPathWithinRoot`;
  - a source's folder is read whole (`LightboxBoardFiles`): every board
    listed, newest first, and the same-text check reads them all;
  - availability as `LexicalGravityLensRepository`, read live;
  - writes serialized through one queue and atomic: staged in a temporary
    sibling whose name carries a random UUID, so another store on the same
    workspace never writes over it (PR #163 F-03), then a synchronous
    commit point (`beforeCommit`, the `DictionaryHistoryStore` pattern),
    then a rename that never overwrites; a final name another writer took
    first is never reported as this save (the next free name, at most three
    tries, then a failed save);
  - a file it cannot read is never overwritten or deleted, and is counted
    in the rail;
  - a board is checked by decoding what it is about to write; one that
    would not read back whole is not written;
  - the reload pointer is the one new port, `LightboxBoardMemory`,
    satisfied in the app by the workspace's memento;
  - logs carry ids, counts and reasons, never writer text;
  - built in `extension.ts`, carried in `CoreServices`.
- **`application/services/lightbox/LightboxBoardLibrary.ts`**, built once
  in `extension.ts` and carried in `CoreServices`: saves (it hears
  adoptions first, so a measured board's save is queued before any list is
  asked for), opens a snapshot, restores on mount, lists for a board and
  deletes. It orchestrates the service, the store and the runner, so it is
  an application service, beside the Workshop's.
- **`LightboxService`** keeps each board's text and where it came from
  (built, or opened from a file), and adopts a snapshot under a source
  ticket. Its assembly moves to its own module first, so it has room.
- **Routes** (typed contracts in `shared/types/messages/lightboxBoards.ts`,
  through `@messages`), owned by a fourth handler,
  `LightboxBoardsHandler`:
  - `LIGHTBOX_REQUEST_BOARDS { requestId, boardId }` → `LIGHTBOX_BOARDS
    { requestId, boardId, shelf }`: the summaries of the source's saved
    boards, availability, unreadable files, and whether the board on
    screen is a snapshot whose file changed. `boardId: null` is a mount
    with no board, which lets the host restore one;
  - `LIGHTBOX_OPEN_BOARD { requestId, fileId }`, answered with the shelf of
    the board then on screen;
  - `LIGHTBOX_DELETE_BOARD { requestId, boardId, fileId }`;
  - each adoption and each committed save is pushed as `LIGHTBOX_BOARDS`
    with `requestId: null`, which the webview takes only for the board on
    screen;
  - every shelf names its board's `adoption` (PR #163 F-02): a board keeps
    its id across snapshots, so the host never posts a shelf built across a
    newer adoption, and the webview never takes an earlier adoption's shelf
    over a later one's.

  Each answer echoes its request id and names the board it describes, and
  the webview takes only the answer it waits for, about the board on
  screen (the 4E passage pattern). File ids are the host's own; the webview
  never names a path.
- **Ownership.**
  - An open is a source choice. It takes a `beginSourceRequest()` ticket
    when its message arrives, before its first await, and adopts only under
    the newest ticket. A failure after the ticket is a standing refusal,
    published only while the ticket is current.
  - Opening never replaces a board a run is reading: refused at once,
    without a ticket, while a run reads the board it would replace, and
    checked again at adoption, after the file was read.
  - Restore on mount takes a ticket only when no source request has been
    made this session, so any choice the writer makes wins over it.
  - Every adoption has a generation (PR #163 F-02). A press captures it
    with its snapshot and checks it after its prompts load, so a press
    still preparing is refused when another snapshot of its board, or
    another source, is adopted. The estimate key leaves it out: a snapshot
    of the same board prices the same inputs.
  - Every adoption moves the reload pointer (PR #163 F-01), to the file
    that holds the board, without writing a duplicate.
  - Witnesses with held promises, as the `*Ownership*` and
    `LightboxBoardAdoptions` tests do.

### Webview

- `useLightboxBoards` (transport; persists nothing): the shelf for the
  board on screen, by request id; open; delete with a confirm step.
- `LightboxBoardsPanel` in the rail. Its head holds the changed-file
  notice with **Read the current text** (the existing re-read route): the
  notice says where the board came from, which is the rail's to say, and it
  sits at the top of the rail at every width.
- Styles in `styles/lightbox/boards.css`, plain CSS on the Chromium 114
  floor.

### Proof

- **Codec:** a round trip for every tile kind and every measured layer; an
  unknown `formatVersion`; unknown keys; invalid entries dropped and
  counted.
- **Regression fixture:** `…/fixtures/board-v1.json`, a board this build
  wrote from public-domain *Alice*, generated by a builder test, never by
  hand.
- **Store:** the availability modes, an atomic write, an unreadable file
  preserved, delete, newest-first listing; more than two hundred files of
  one source, two sources whose paths slug alike, and two stores saving
  into one folder at once (PR #163).
- **Open:** a snapshot of an unchanged file; a changed file shows the
  notice and refuses Bring; Read the current text carries the readings
  stale.
- **Reload** restores the last board.
- **Opinion basis:** rewording the digest keeps standing; changing each
  canonical field flips it.
- **Ownership** witnesses with held promises.
- **Visual evidence** in `docs/pr-reviews/evidence/lightbox-slice-5a-visual/`
  at 1440, 1000 and 500 px: the Boards rail with several boards, an older
  one opened, the changed-file notice, delete confirm, and session-only
  mode.

### Done when

A board survives a window reload. The rail lists the source's saved boards,
opens any of them as it was saved, says when the file has changed since,
and deletes one after a confirm.

### Implementation notes (2026-10-22)

Thirteen commits on `epic/lightbox-slice-5a-saved-boards`: the plan, the
data basis (decision 25), the rule ids, the board naming its rules, the
codec, the store, the service's room, the host's saving and opening, the
rail, the regression fixture, this evidence and these notes, then the
writer-data rule (decision 8 above) and its evidence. PR #163's review
followed (four P2 findings, two P3): its fixes, their notes below, and
re-rendered evidence with two paging states, are three more commits. What
the writer may want to redirect, beyond decisions 27–31:

- **When a save names the board on screen.** A committed save records the
  file the board was last saved to, by board id; the rail marks that file
  "On screen". A board opened from a file names it until a later save. A
  saved board is adopted only through the store's queue, after every save
  before it has committed, so the latest commit is the latest saved state.
- **A run that ends with a group back saves,** finished or stopped. A
  failed group counts: its note changed the readings. A run stopped before
  any group came back saves nothing.
- **A measured board saves once per text.** When a saved board of the
  source already holds the text, nothing is written, and the reload
  pointer moves to the newest such file while that board is on screen.
- **The pointer follows every adoption** (PR #163 F-01). Coming back to a
  source whose board a file already holds (A, B, then unchanged A) points
  at that file, readings and all, and writes nothing.
- **A spark set aside is saved with the next save,** not by itself
  ([tech debt](../../tech-debt/2026-10-22-lightbox-spark-set-aside-saves-later.md)).
- **An opened board keeps its id.** It is the same board, by D12's
  identity, so it replaces the board kept for its source, as a newer
  source does.
- **Open while a run reads.** Refused at once, with the rail's notice, when
  a run reads the board on screen; checked again, with nothing awaited,
  for the board it would replace. A press still preparing when a board
  opens is refused by its own snapshot check, as for any newer source,
  including a saved snapshot of its own board: the check names the
  adoption, not only the board's id (PR #163 F-02).
- **Bring from a saved board whose file is not in this workspace** (moved,
  or another folder open) is refused as unreadable: it cannot be checked.
- **Any well-formed rule id is read,** the Opinion's basis included (the
  writer-data rule, decision 8 above). A board whose Opinion was cited
  under another basis rule loses only that Opinion's standing; 5B labels
  the measuring rules' ids.
- **A file with several sources** decodes, and opening it is refused with a
  reason.
- **A restore that fails** (its file gone or unreadable) is logged; the
  writer asked for nothing, so nothing is refused.
- **Dates** show in the webview's own zone; tests and the evidence pin UTC.
- **Deleting the file on screen** leaves the board on screen and clears the
  reload pointer.
- **The rail's page is twenty** (PR #163 F-04): enough for a chapter's
  drafts without a long scroll. Show older adds twenty at a time; the page
  always reaches the board on screen. The writer may prefer another size,
  or a search.

Gates at the head: full `npx jest`, `npm run lint` (0 errors, 1,133
warnings, identical per file and rule to the base), `npm run typecheck`,
`npm run build` with `verify:bundle`, and `git diff --check`. Visual
evidence: [`lightbox-slice-5a-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-5a-visual/README.md).

## Slice 5B: draft compare (a later PR)

Unchanged from the original plan, now reading format 1 as it is.
**Compare** picks an earlier board of the same source and shows:

- measured deltas on the stat tiles;
- the earlier tension arc as ticks on the ribbon;
- fields, motifs and lineage items that appeared or vanished;
- a one-line drift summary, as a reading.

When the paragraph count changed between the boards, the paragraph-aligned
views are labeled approximate. When the two boards' rule ids differ, the
measured deltas say which rule changed, so a moved figure is not read as a
change to the text.

- Routes: `LIGHTBOX_COMPARE` / `LIGHTBOX_COMPARISON`.
- The comparison is computed by the host and is deterministic, except for
  the drift line, which comes from one small call that the writer presses
  for.
- Tests: identical boards; paragraph count changed (approximate label);
  fields added and removed; boards under different rule ids.
- Done when two drafts of the same chapter compare, with the deltas and the
  drift shown.
