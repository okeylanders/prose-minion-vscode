# Slice 5: Saved Boards and Draft Compare

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D12 and its addendum of 2026-10-22
**Writer decisions:** 5, 14, 25, 27–36 and 46 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Split into two PRs (2026-10-22). **5A** (saved boards: the format, save, open, delete, reload) merged (PR #163, `epic/lightbox` at `3e5c3a1`); see [its implementation notes](#implementation-notes-2026-10-22). **5A.1** (board names and the writer's four calls on 5A, decisions 33–36) merged (PR #164, `epic/lightbox` at `a57a5cd`); see [its section](#slice-5a1-board-names-and-the-writers-calls). **5A.2** (saved boards in the Workshop's design language, decision 46: one file per board, the Boards menu and a shared browser of every chapter's boards, "Open a board file…") is built on `epic/lightbox-boards-browser`; see [its section](#slice-5a2-saved-boards-in-the-workshops-design-language). **5B** (Compare) follows them and needs no format change.

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
    over a later one's;
  - and its `observation` (PR #163 F-05): readings, saves and deletes keep
    the adoption, so a shelf is numbered, in order, before its first await.
    A handler never sends a shelf of a board observed before one it already
    sent of it (a request's answer is built again), and the webview never
    takes one observed before the one it holds. A newer save's push is
    a newer observation, so it is always taken.

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
  ([tech debt](../../archive/tech-debt/2026-10-22-lightbox-spark-set-aside-saves-later.md);
  superseded by Slice 5A.1, decision 35: it now saves at once, in place).
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
  drafts without a long scroll. Show older adds twenty to the rows shown,
  however they were reached (PR #163 N-03); the page always reaches the
  board on screen. The writer may prefer another size, or a search.
- **Folders written before PR #163** by development builds were named by
  slug alone. They are not listed: format 1 has not shipped, so nothing is
  discovered or migrated from them; a known file id there still reads.
- **Listing cost.** A warm listing still stats every file of the source,
  and summaries are cached without a bound
  ([tech debt](../../tech-debt/2026-10-22-lightbox-board-listing-scale.md)).

Gates at the head: full `npx jest`, `npm run lint` (0 errors, 1,133
warnings, identical per file and rule to the base), `npm run typecheck`,
`npm run build` with `verify:bundle`, and `git diff --check`. Visual
evidence: [`lightbox-slice-5a-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-5a-visual/README.md).

## Slice 5A.1: board names and the writer's calls

**Branch:** `epic/lightbox-slice-5a1-board-names`, from `epic/lightbox` at
`3e5c3a1` (5A merged, PR #163). **Writer decisions:** 33–36 in the
[epic table](README.md#writer-decisions-2026-10-19). The writer made four
calls on 5A; this slice builds them. Format 1 has not shipped, so the name
joins it without a new format number.

### Decisions

1. **Board names (decision 33), the writer's main ask.** A saved board may
   carry a name, to record the model and the chapter version (a name such
   as "3.2.1 - after the cut - model B"). Saves stay automatic and silent;
   a name is optional and can be added or changed at any time.
   - **A name belongs to the board:** its retained board id and that
     board's saves. Naming the board on screen, or the row that holds it,
     names the retained board, so its later automatic saves carry the name.
   - **"Read the current text"** builds a new board (a new id, as any
     changed text does), which starts unnamed. A re-read of unchanged text
     keeps the board, and its name.
   - **Naming a row that is not on screen** changes only that file.
   - **Open and restore** bring the file's name back.
   - **Every row names the models that read it**, from the saved groups'
     provider-reported `model`, once each. A measured-only board has no
     model line.
   - **Session-only** (no folder, or several), the name is the in-memory
     board's, and the rail says it lasts as long as the session.
2. **The changed-file notice above the board (decision 34).** The notice,
   with **Read the current text**, also shows at the top of the board's
   column. Both notices come from the same shelf, through one function, so
   they appear and go together and obey the shelf's ordering guards.
3. **A spark set aside saves at once (decision 35).** "Not for me", and
   its Undo, rewrite the file that holds the board on screen in place,
   through the rename's rewrite: no new timestamped file, so no new row.
   Only the spark acted on changes in the file (PR #164 F-03). A board no
   file holds yet, or one kept for the session only, takes the mark with
   its next save, as before.
4. **Stopped and partial runs keep saving (decision 36).** The writer
   confirmed decision 27's default: a run that ends with a group back
   saves, finished, stopped, or with a group failed. No code change.

### Format 1 with a name

```jsonc
{ "formatVersion": 1, "kind": "lightbox-board", "savedAt": "…",
  "board": { "boardId": "…", "name": "3.2.1 - after the cut - model B",
             "rules": { … }, "sources": [ … ], … } }
```

- **The rule** (`shared/constants/lightboxBoardName.ts`, one for the codec,
  the route and the rail's field): trimmed; one line, with no control
  character (tabs and line breaks among them) and no line or paragraph
  separator; at most **120 characters**, counted as the field's
  `maxLength` counts them (UTF-16 code units); empty means unnamed. A name
  is writer text: never logged, never in the webview's saved state.
- **Written** right after the board's id, and only when the board has one:
  an unnamed board is written exactly as 5A wrote it, so `board-v1.json`
  still reads and writes back byte for byte.
  `__tests__/fixtures/board-v1-named.json` is a named board this build
  wrote (the *Alice* board, measured only), from its builder test.
- **A name in a hand-edited file that does not read** (not a string,
  untrimmed, empty, two lines, a tab, too long) is **left out and counted**,
  as a dropped tile is (`leftOutIfInvalid`): the board opens whole,
  unnamed, and the rail's snapshot note says a part was left out. The
  board is never lost over a name (decision 32's writer-data rule). A
  rename may then rewrite that file; nothing else will (see below).
- **No rule id moves** with a name: a name is not a measurement.

### Host

- **The store's rewrite in place** (`LightboxBoardStore.replace`, through
  its one queue; the mechanics in `LightboxBoardRewrite.ts`). The
  `FileSystem` port's `rename` already allows `overwrite: true`, but a
  plain stage-then-overwrite could bring back a file another window's
  store deleted between the read and the rename. So:
  1. Read the file and check it: it must read whole (a rename may replace
     a name that did not read, and nothing else left out) and hold the
     board expected. A file the store cannot read is never overwritten.
  2. Apply the update to what was read, decode what would be written, and
     stage it under a hidden name private to this write (a random UUID).
  3. **Claim** the file: rename it, never over anything, to a hidden name
     of its own that records when it was taken,
     `.<saved name>.claim-<epoch ms>-<UUID>` (`LightboxBoardClaims.ts`). A
     rename is atomic, so once the claim holds no other writer can delete
     or rewrite the file; a file another writer deleted first cannot be
     claimed, so it stays deleted (`missing`).
  4. The claimed bytes must be the bytes read; if another writer rewrote
     the file in between, the claim is put back and the file read again
     (at most three times), so their change is kept.
  5. The claim must still be there (PR #164 F-01: one held past the lease
     may have been put back by another window, and is not written over).
     Then the commit point, then the staged file takes the saved name,
     never over anything; the claim is dropped. The file id and `savedAt`
     stay.
  - **Concurrency rule: the last rewrite to commit wins**, and each reports
    only bytes it wrote. A rewrite, a delete or a read that finds the file
    under another window's live claim says it is busy, and changes
    nothing; a delete never reports deleting a board that is only
    mid-rewrite.
  - **Claims are live or abandoned by age** (PR #164 F-01, F-02). A claim
    younger than the lease, `LIGHTBOX_BOARD_CLAIM_LEASE_MS` (30 seconds),
    is live: no other window puts it back, removes it, or lists the board
    under it. An older one was abandoned (its window closed mid-write). A
    listing that finds claims, and a read, rewrite or delete that finds its
    file gone, settle them: with the saved name empty and no live claim,
    the newest abandoned claim goes back under it, never over anything;
    beside a standing file, an abandoned claim is a committed rewrite's
    leftover (the bytes before it) and is removed, never put back.
  - **A delete claims the file too** (PR #164 F-01), as a rewrite does, so
    no rewrite claims it meanwhile; it then removes every other claim of
    that saved name, young or old (a committed rewrite's leftover whose
    clean-up failed), looks at the folder again, and only when none is
    left removes its own (the re-review). A leftover that would not go, or
    a folder it could not read, puts the board back as it was, and the
    delete says it failed; one that cannot remove its own claim does the
    same. No earlier version can come back after a delete.
  - **A read classifies every `missing`** (PR #164 F-02 and its
    re-review): it settles the claims, puts back and reads again, three
    times at most. A live claim, or a file that keeps moving, is `busy`; a
    folder that cannot be read is `unreadable`; `missing` is the folder
    read and neither file nor claim there. A folder read error is never
    taken for an empty folder; only a folder that is not there is.
- **`LightboxBoardEdits`** (built by the library, reached only through it)
  names boards and keeps spark marks. The file that holds the board on
  screen, and its name, are found when the rewrite's turn in the queue
  comes, so a save queued just before a rename has committed first and is
  the file the rename names. Its notices are in `LightboxBoardNotices.ts`.
- **The service** keeps a name on each retained board (`nameBoard`);
  `adoptSaved` takes the file's name, an unchanged re-read keeps it, and
  every save writes it.
- **The route** `LIGHTBOX_RENAME_BOARD { requestId, boardId, fileId, name }`
  (`fileId: null` names the board on screen), owned by
  `LightboxBoardsHandler` and answered with `LIGHTBOX_BOARDS` under the
  same adoption and observation guards as every shelf. Naming the board on
  screen also pushes the shelf. The shelf carries the board's `name` and
  each summary its `name` and `models`.
- **Sparks:** `LightboxReadingHandler` asks the library to keep the one
  spark's mark (`keepSpark(boardId, tileId)`) once a set-aside or Undo has
  changed the board. At the rewrite's turn the file takes that spark's
  mark as the board has it, through the Spark lane's own
  `setLightboxSparkDismissed` over the file's readings: a spark set aside
  takes the order after the file's highest, and no other spark in the
  file changes (PR #164 F-03). So a second window, whose board never saw
  the first window's mark on another spark, never takes it back; one
  spark's set-aside and Undo stay last-wins. The file is found at the
  rewrite's turn, so a spark set aside while a run's save is still being
  written marks the file that save writes, even for a board no file held
  before it.
- **The message barrel** was split first, in its own commit:
  `messages/lightboxBarrel.ts` holds the Lightbox re-exports and its parts
  of the two routing unions; `index.ts` re-exports it (496 → 413 lines).

### Webview

- `useLightboxBoards.renameBoard(fileId | null, name)`, correlated like
  every request; a rename makes the held shelf ask again on return, as a
  Delete does. Nothing persists.
- `lightboxBoardsView`: a named row's name first and its date under it;
  `lightboxModelsNote` (below); the head's `board` view; and
  `lightboxChangedFileNotice`, the rail's snapshot note while it offers
  Read the current text, which the app passes to `LightboxBoardMain`.
- `LightboxBoardsPanel`: the head names the board on screen ("Unnamed
  board" otherwise) with **Name** or **Rename**; each row has **Rename**.
  `LightboxBoardNameField` edits in place, with the keyboard of the
  Workshop's session-browser rename: Enter saves, Escape cancels (and goes
  no further), each returning focus to the action that opened the field;
  leaving the field saves. A name the rule refuses says why in the field,
  which stays open with the writer's words, on Enter and on leaving alike
  (PR #164 N-01). Only the writer's own edit is sent: until the writer
  types, the field follows the name the shelf has, so a rename's answer
  that lands while a reopened field is open shows in it, and leaving an
  untouched field sends nothing (PR #164 F-04).
- `lightboxModelsNote` counts models by their whole name without the
  provider, then cuts each for show, so two names that begin alike count
  as two (PR #164 N-02).
- A press's button on a narrow board wraps its cost under its label rather
  than running past the card (`styles/lightbox/board.css`; the review's
  500 px capture; it clipped at `3e5c3a1` too).
- Styles in `styles/lightbox/boards.css`, on the Chromium 114 floor.

### Proof

- **Codec** (`LightboxBoardNames.test.ts`): the rule's limits; named and
  unnamed round trips; the name's place; in-place naming and unnaming;
  `board-v1.json` unchanged and `board-v1-named.json` named; seven
  malformed names, each left out and counted with the board whole.
- **Store** (`LightboxBoardStoreRewrite.test.ts`): the atomic rewrite
  (staged, claimed, committed, nothing overwritten, nothing left over);
  unchanged and withdrawn; never a file it cannot read, one holding another
  board, or one with a part left out; a delete in one store and in another
  window, before and during the claim; two windows renaming one file (one
  after the other, one reading before the other committed, one during the
  other's claim); a spark set aside writes no new file; logs carry no name.
- **Claims** (`LightboxBoardClaims.test.ts`, PR #164 F-01 and F-02): an
  abandoned claim put back by a listing and by a read, the newest of
  several; a live claim never put back or listed, and busy for a read, a
  rewrite and a delete; an abandoned leftover beside its file removed, a
  live one left; the review's two sequences (a listing in another window
  never steals a live claim, so its delete is busy and the rewrite
  commits; a rewrite whose clean-up failed, then a delete in a fresh
  window, young or past the lease, and nothing comes back); and the
  controls (clean-up then delete; a board left mid-rewrite deleted whole; a
  failed commit puts the original back; a claim held past the lease and
  put back blocks the pending commit; one put back while its bytes were
  checked is read again).
- **Library and handler** (`LightboxBoardRenames.test.ts`,
  `LightboxSparkSaves.test.ts`): naming the board on screen, its later
  saves, the row that holds it, unnaming, a save queued before a rename, an
  unchanged re-read and Read the current text, a row not on screen, a gone
  or unreadable file, Open and reload, session-only, a refused name,
  malformed requests, and the rename's answer under both ordering guards;
  a spark set aside and its Undo with no new file and a reload; a
  session-only spark; a spark set aside while a run's save is held at its
  commit; two windows setting different sparks aside, with the controls
  (opened after the first's mark, one spark's Undo last-wins, a spark
  behind a rename and a source switch) (PR #164 F-03); a restore whose
  file is gone.
- **Restore under a claim** (`LightboxBoardRestoreClaims.test.ts`, PR #164
  F-02): an abandoned claim put back and restored, the pointer kept; a live
  claim restores nothing and keeps the pointer and the claim, and a session
  past the lease restores the board; a source chosen while the restore's
  read puts the board back keeps the screen.
- **Hook, view, panel and app** (`useLightboxBoards`, `lightboxBoardsView`,
  `LightboxBoardsPanel`, `LightboxAppSavedBoards`): name and model
  display, the head, the inline rename's keyboard flow, focus after a
  confirmed delete, and the notice above the board in step with the rail's
  under both ordering guards; a rename's answer while an untouched field
  is open, in the head and in a row, and an edited one kept (PR #164
  F-04); a refused name on leaving (N-01); two models whose names begin
  alike (N-02).

### Implementation notes (2026-10-22)

What the writer may want to redirect:

- **The name limit is 120 characters,** room for a chapter version, a note
  and a model's nickname; the field stops there.
- **A name that does not read is left out, not repaired.** A hand-edited
  name with a tab, say, opens unnamed, with "1 part of it could not be
  read and was left out." Repairing it (trimming, cutting) would put words
  in the file the writer did not write.
- **The model line** drops the provider ("provider/model-v1" reads
  "model-v1"), shows each name once, cuts one past 32 characters, and
  names two at most: "Read by model-v1 and model-b", or "Read by
  model-v1, model-b and 2 more". The full ids are the line's tooltip.
- **Naming the board on screen also renames the file that holds it,** so
  the row and the head agree, and a reload brings the name back. A board
  no file holds yet (its text already saved under another board, or its
  save failed) keeps the name in memory until its next save, and the head
  says so: "Not in a saved file yet: the name is saved with this board's
  next save."
- **Renaming an older snapshot of the board on screen** (a row of the same
  board that is not the one marked On screen) changes only that file:
  decision 33's "a row that isn't on screen".
- **A spark's mark goes only to a file that reads whole.** One with a part
  left out is not rewritten for a spark (the part would be lost); the mark
  waits for the board's next save, which writes a new file, as 5A did.
- **Busy.** Two windows on one workspace renaming the same board in the
  same few milliseconds: one commits, and the other says "That saved board
  is being changed in another window. Try again in a moment." A delete, an
  Open and a restore say the same while the file is held.
- **The changed-file notice** sits at the top of the board's column, above
  the file name and headline.
- **Extras (5A tech debt), both done:** a confirmed delete keeps focus on
  its row's Delete until the row goes, then moves it to the next row's
  Delete, or to the head's Name or Rename when none is below; a restore
  whose file is gone forgets the reload pointer. The tech-debt note's
  suggestion of a spoken "Deleted the board saved …" was not taken.

### PR #164 review corrections (2026-10-22)

The review (request changes: four P2, two P3) is
[`pr-164-lightbox-board-names-review.md`](../../../docs/pr-reviews/pr-164-lightbox-board-names-review.md),
with the author's response and ledger below it. Each correction is
described in place above; what the writer may want to know:

- **The lease is 30 seconds** (F-01, F-02). A window that closes mid-rewrite
  leaves its board hidden under a claim until the claim is 30 seconds old;
  then the next listing or read puts it back. A reload within those 30
  seconds does not restore that board, keeps the reload pointer, and logs
  that it is busy; the next session (or the rail, once the claim is old)
  brings it back. Nothing is lost.
- **The one race left** (F-01): a window stalled more than 30 seconds
  between claiming a file and committing (a frozen extension host), while
  another window lists the source (putting the board back), deletes it,
  and all of that lands inside the stalled window's last file operation.
  Then the stalled rename commits after the delete. The stalled window
  checks its claim before it commits, so the delete would have to fall
  inside that one rename. A file system with only rename and delete offers
  no stronger lock.
- **A delete claims the file**, so deleting a board another window is
  renaming says busy rather than deleting it, and a delete removes the
  earlier versions a rewrite left beside the file. When it cannot show
  none is left (a leftover that would not go, a folder it could not read),
  it leaves the board as it was and says "That saved board could not be
  deleted. The output log says why." (the re-review, 2026-10-23).
- **A restore forgets its pointer only when the board is shown gone**: a
  board claimed again between being put back and read is busy, and a
  folder that cannot be read keeps the pointer (the re-review).
- **A spark's file write is the one spark's** (F-03), with its order after
  the file's highest: two windows' marks on different sparks both stand.
- **The name field sends only an edit the writer made** (F-04), and keeps a
  refused name open on leaving (N-01).
- **The model line counts whole names** (N-02).
- **The press's button** wraps its cost at 500 px (the reviewer's capture;
  it clipped at `3e5c3a1` too). The evidence harness now fails on any
  button that runs past the box that clips it.

Gates before the review, at `028138a` (the code and its evidence):
full `npx jest`, 479 suites / 6,617 tests / 59 snapshots (474 / 6,541 / 59
at `3e5c3a1`); `npm run lint`, 0 errors and 1,133 warnings, identical per
file, rule and severity to `3e5c3a1`; `npm run typecheck`; `npm ci` into a
real `node_modules`, then `npm run build` with `verify:bundle` twice,
`webview.js` SHA-256 `427e81f8…ffaa` and `extension.js` `54c130f5…d115`
both times; `git diff --check` clean. No live or billable call.

**Against `3e5c3a1`** (the new tests run on the base's code): the codec's
and the rename's suites cannot load (no name rule); the store's rewrite
fails 15 of 16 (a claim beside a standing file, the control, passes); the
app's notice above the board fails 4 of 4; the rail's model line, 11 new
panel tests, 7 view tests (the no-head control passes) and 3 hook tests
fail; the spark's set-aside, Undo and pointer tests fail (the session-only
control passes), and the queued-save spark test fails there and on this
slice's own early-return version.

Visual evidence:
[`lightbox-slice-5a1-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-5a1-visual/README.md),
six host states at 1440, 1000 and 500 px, 18 captures, `errors.txt` empty;
the harness writes 51 errors and exits 1 against the `3e5c3a1` bundle.

Gates after PR #164's corrections, at `3532f949` (the code; the
evidence and these notes follow it): full `npx jest`, 481 suites / 6,643
tests / 59 snapshots (479 / 6,617 / 59 at `ada5717`); `npm run lint`, 0
errors and 1,133 warnings, identical per file, rule and severity to
`3e5c3a1`; `npm run typecheck`; `npm ci` into a real `node_modules`, then
`npm run build` with `verify:bundle` twice, `webview.js` SHA-256
`66c1f405…cd35` and `extension.js` `b72fa490…0c39` both times; the
whitespace check clean from the review's commit. On an export of
`ada5717` the review's sequences fail (F-01's two, the three restore
tests, the two-window spark, the head's and the row's untouched field,
the refused name on leaving, the model count) and her controls pass; the
[author response](../../../docs/pr-reviews/pr-164-lightbox-board-names-review.md#author-response-2026-10-22)
lists each. The evidence harness, now failing on a clipped button, writes
no error at this head, 2 against `ada5717`'s bundle and 53 against
`3e5c3a1`'s.

Gates after the re-review's corrections, at `bad728eb`: full `npx jest`,
482 suites / 6,653 tests / 59 snapshots (481 / 6,643 / 59 at `17e4cd7`);
lint identical per file, rule and severity to `3e5c3a1`; typecheck; two
builds with `verify:bundle` after `npm ci`, `webview.js` `66c1f405…cd35`
(unchanged) and `extension.js` `e9c04557…dd13` both times; the whitespace
check clean. The re-review's five witnesses fail on `17e4cd7` and her
controls pass there. The host states, rebuilt, are byte-identical, so the
evidence stands as rendered.

## Slice 5A.2: saved boards in the Workshop's design language

**Branch:** `epic/lightbox-boards-browser`, from `epic/lightbox` at
`a57a5cd` (5A.1 merged, PR #164), with `epic/lightbox` at `08b0d22`
(Slice 4H, PR #165) merged in. **Writer decision:** 46 in the
[epic table](README.md#writer-decisions-2026-10-19), which amends decision
27 (one file per board, not per save) and replaces decision 31's rail. It
is numbered after 45: Slice 4I (run controls, PR #166, in review) takes
decisions 41–45.

The writer, on 5A.1's Boards panel (2026-10-23):

> I'm not sure I like this style of opening and saving. We should match the
> user experience in workshop so we speak the same design language across
> tabs. BUT, we don't need a current.json like in workshop that complicates
> the programming. We can just create the date named file (include
> filename) like 'Chapter 6 - 10/23/2026 9:08 AM' it continues auto saving
> like we do now and the user can rename in the modal or drop down like we
> do on workshop. The problem with the side panel is that there will end up
> being a lot of files analyzed and it'll be a poor experience. Try to
> re-use the open file widget if possible. We can keep all project
> locations visible with the manual file selector button as well.

Asked how, the writer chose: a Workshop-style **Boards menu** in the header
(Open prior board…, the recent boards, Rename, Browse all…); the Workshop's
**session browser made shared** for Browse (search, group by date or by
chapter, rename, delete, open, across every chapter); an **"Open a board
file…"** button in that browser for the system picker; and **no Boards side
panel**.

### Decisions

1. **One file per board.** A board's first save writes its file, named by
   default (2, below). Its later saves (a run that landed readings, a spark
   set aside, a rename) rewrite that file in place, atomically, through the
   5A.1 rewrite (claims, the 30-second lease, the commit point, never over
   an unreadable file). **"Read the current text"** builds a new board (a
   new id, as any changed text does), so it writes a new file with a new
   dated name. No `current.json`.
2. **A default name at the first save:** `<source file name without its
   extension> - <M/D/YYYY h:mm AM/PM>`, in the local time of the extension
   host: "Chapter 6 - 10/23/2026 9:08 AM". A selection adds its lines
   ("alice-1 · lines 4–30"). The name is written into the file, so it is
   the board's name like any other: Rename changes it. A file saved before
   names (5A) shows the default its source and saved time give, and is not
   rewritten to say so; opened, the board takes that name, and its next
   save writes it.
3. **When the file cannot be rewritten in place, the board saves to a new
   file** and follows it (the reload pointer, the row on screen), and the
   file stays exactly as it was. That is when: another window changed it
   since this window last read or wrote it (its revision, below, differs);
   another window holds it under a live claim; a part of it was left out on
   reading (never written over, as 5A.1's spark marks); it is gone; or the
   rewrite failed. All in the same queue turn. A save the commit point
   declines (the board is no longer the one on screen) writes nothing
   anywhere, as before.
4. **Every chapter.** The shelf lists the saved boards of every source in
   the boards folder, newest first, summaries only, with each one's source.
   Opening one of another chapter is a source choice like any other, under
   5A's ticket, adoption and observation guards.
5. **"Open a board file…"** opens any `*.board.json` through the system
   picker. One of the store's own opens by its id, as Open does. Any other
   is decoded and opened as a snapshot no file of the store holds: nothing
   ever writes it, and its next save writes a new file in the store,
   keeping its board id and name.
6. **The Boards menu and the browser** (the webview, below) replace the
   rail's Boards section. The changed-file notice and Read the current text
   stay above the board (decision 34). Session-only, the menu and the
   browser say boards last for the session.
7. **Compare (5B)** reads two saved boards. With one file per board, two
   text versions of a chapter are two boards: the board before "Read the
   current text" and the one after.

### Host

- **The default name** (`shared/constants/lightboxBoardName.ts`, beside the
  name rule): `lightboxBoardSourceLabel(source)` (the file's name without
  its last extension, from either separator; a selection's lines; a
  control character becomes a space; "Untitled" when nothing is left) and
  `lightboxDefaultBoardName(source, savedAt, timeZone?)`, from
  `Intl.DateTimeFormat` parts, with plain spaces, the label cut with "…" so
  the whole fits the 120-character rule. The library takes the zone as an
  option (`LightboxBoardLibrary(ports, { timeZone })`); the composition
  root passes none, so it is the extension host's. Tests pin UTC.
- **Revisions.** A read names the bytes it decoded by their SHA-256
  (`LightboxBoardFiles`, `lightboxBoardRevision`), and the rewrite takes the
  revision it expects: a file whose bytes differ is `changed`, and is not
  rewritten. A committed write reports its revision (`onCommitted`), and the
  retained board keeps it (`LightboxRetainedBoards.savedRevision`) with the
  file it saved to. A rewrite of a tile or a name follows the file only
  when the board knew that file (`markSaved`'s `from`), so a rename of an
  older file never moves the board.
- **Saving** (`application/services/lightbox/LightboxBoardSaves.ts`, new,
  built by the library): `saveAfterRun` and `onScreen` capture the board,
  and the store's `save` takes it as a function, read at its turn in the
  queue, with `inPlace` (the file the board holds, its revision, and how to
  write the board as it now stands into that file) and `defaultName`. The
  store (`LightboxBoardStore.save`) rewrites in place when it can, and
  otherwise writes a new file (`LightboxBoardNewFile.ts`, new), logging
  `<file id> could not be saved in place (<why>); the board is saved to a
  new file.` Its contracts moved to `LightboxBoardStoreContracts.ts` to keep
  the store under 500 lines. The save result keeps its shapes
  (`saved`, `replaced`, `withdrawn`, `failed`, `refused`).
- **Every chapter's listing** (`LightboxBoardStore.listAll`,
  `LightboxBoardFiles.listAll`): every folder in the boards folder whose
  name is a slug and hash (`[a-z0-9-]`), each read as a source's listing is
  (claims settled; the summary cache by size and modification time). A
  folder named by slug alone (before PR #163) is not listed, nor a file
  moved into another source's folder. A folder that cannot be read is
  counted (`unreadableFolders`) and the rest are listed; the boards folder
  itself unreadable counts one; not there yet, it is empty. Two chapters
  whose paths slug alike keep their own folders and rows.
- **Opening a picked file** (`LightboxBoardStore.locate`, `readOutside`;
  `LightboxBoardLibrary.openFile`): `locate` turns a path inside the store
  into its file id, and nothing else. `openFile` refuses at once while a
  run reads the board on screen, takes its source ticket before it reads,
  and adopts the read as a snapshot with no file (`snapshot.outside: true`,
  no `fileId`). A malformed file is refused as a source, in the host's
  words, and the board on screen stays. Another workspace's board whose
  chapter is not here opens as saved, and its file state is `unreadable`
  ("Its chapter could not be read to compare it with this board, so Bring
  is held back."); a board whose chapter is gone opens the same way.
  Logs never name the picked path.
- **Routes.** `LIGHTBOX_OPEN_BOARD_FILE` (`{ requestId }`), answered with
  `LIGHTBOX_BOARDS` for the board then on screen; the picker comes from
  `ShellService.pickFile`, passed in by `MessageHandler`, titled "Open a
  saved Lightbox board (*.board.json)" and filtered to `.json` (or all
  files). Dismissed,
  it changes nothing. `LIGHTBOX_DELETE_BOARD` and `LIGHTBOX_RENAME_BOARD`
  take `boardId: null` (the browser works with no board on screen).
- **Contracts.** A saved-board summary always carries a `name` (the file's,
  or the default) and its `source`; a snapshot's `fileId` is optional, with
  `outside` when it came from outside the store; the shelf may count
  `unreadableFolders`.

### Webview

- **Shared with the Workshop, not copied.** The Workshop's sessions menu is
  now the full tabs' `components/fulltab/SavedItemsMenu.tsx` (with `Item`,
  `Recent`, `Heading`, `Rule`, `Empty`); its session browser is
  `SavedItemBrowserModal.tsx`, with `SavedItemRow.tsx` and the date buckets
  in `utils/savedItemGroups.ts`. The Workshop composes its own items, rows,
  current room, excerpt grouping, Duplicate and Reveal on top. Three opt-ins
  only the Lightbox takes: `renameRule` (the one name rule, with its words
  under the field), `sendOnlyEdits` (PR #164 F-04) and `returnFocus` (Enter
  and Escape return focus to Rename; Delete moves it to Keep; a confirmed
  delete moves it to the next row's Delete, or to the search field).
- **The CSS moved verbatim** from `styles/workshop/shell.css` into
  `styles/fulltab/savedItems.css` (the menu and the Save-session sheet's
  frame) and `styles/fulltab/savedBrowser.css` (the browser), in order,
  scoped to `[data-pm-frame="fulltab"]` at the Workshop stamp's
  specificity, as `modal.css` was. Rules only the Workshop uses (the
  degraded-memory banner, the confirm dialog, the save sheet's manifest,
  export) stay in `workshop/shell.css`.
- **Mirrored, not shared: the name sheet.** `LightboxBoardNameModal` uses
  the Save-session sheet's frame and classes, but the Workshop's sheet is a
  checkpoint save with a manifest and "Save as new"; a board's name needs
  one field.
- **The Boards menu** (`LightboxBoardsMenu`), in the header between the
  Workshop tray and the status, where the Workshop puts its sessions menu:
  the trigger names the board on screen (its name, or its file's name before
  a first save) and says "Saved", "Not saved yet", "Save failed" or "This
  session only". Board: Rename board…, Board another chapter… (the project
  picker), Open prior board…; Recent: the five newest boards of every
  chapter, each with its chapter and when, the one on screen disabled;
  Browse all boards…. Session-only, its head says why.
- **The browser** (`LightboxBoardBrowserModal`): each row's name, chapter,
  saved time, lenses read and stale, approximate cost, models, and "On
  screen"; search over names and chapter paths; Date (Today, This week,
  Earlier, the Workshop's buckets) or Chapter (each chapter once, in the
  order of its newest board); Open; inline Rename; Delete with a confirm;
  and in its footer, the folder and "Open a board file…", which closes the
  browser as the project picker's "Explore project folders…" does before
  VS Code's dialog. A row's line wraps between its parts at narrow widths,
  so it still names the chapter.
- **State** (`useLightboxBoardsSurface`, a presentation controller): which
  of the menu, the browser and the name sheet is open, and the browser's
  search. Opening the browser asks for the shelf again
  (`useLightboxBoards.refresh`). Escape closes the open menu before it lets
  go of a pinned item.
- **The notice above the board** (`lightboxSnapshotNotice`, from the shelf,
  through the same guards) keeps decision 34's changed-file notice and Read
  the current text, and also says when the chapter could not be compared,
  when parts were left out, and when the file came from outside the boards
  folder ("Its next save writes it there, as a file of its own.").
- **Gone:** `LightboxBoardsPanel`, `LightboxBoardNameField` and their tests.
- **At 520 px and under** the frame's header wraps its actions to the left;
  the Lightbox's Boards menu hangs from the actions block at the gutter, so
  it stays on screen (`styles/lightbox/boards.css`). The Workshop's menu is
  unchanged.

### Proof

New tests:
- **Host:** `LightboxBoardsBrowser.test.ts` (one file per board through the
  real handlers, the default name in a pinned zone, Read the current text,
  the fallback when another window changed the file, every chapter, opening
  another chapter under the guards, delete and rename with no board on
  screen, files saved before names, and "Open a board file…": the store's
  own, outside, malformed, another workspace's, dismissed, refused while
  reading, no request id); `LightboxBoardStoreInPlace.test.ts` (in place,
  the new file, each fallback, the commit point declining, the board read
  at its turn); `LightboxBoardStoreChapters.test.ts` (listing every chapter,
  a slug collision, an unreadable folder, the boards folder unreadable or
  absent, claims per folder, old folders, session-only, `locate`,
  `readOutside`); `lightboxDefaultBoardName.test.ts` (the writer's example,
  zones, midnight and noon, selections, separators, control characters,
  the limit).
- **Webview:** `SavedItemsMenu.test.tsx` and `SavedItemBrowserModal.test.tsx`
  (each opt-in, and the Workshop's behaviour without them);
  `LightboxBoardsMenu.test.tsx`, `LightboxBoardBrowserModal.test.tsx` and
  `LightboxBoardNameModal.test.tsx` (recent boards, rename from the menu's
  sheet and from a row, delete with a confirm, focus, keyboard, search,
  both groupings, session-only, "Open a board file…").
- **The Workshop's own tests run unchanged.** A markup tool (in the
  evidence's `tools/`) rendered the Workshop's menu and browser in fifteen
  states at the base and at the head: identical, focus included.

Tests whose premise changed, rewritten (5A and 5A.1 behaviour they no
longer describe: one file per save, the rail, unnamed rows):
`LightboxBoardOwnership`, `LightboxBoardAdoptions`, `LightboxSavedBoards`,
`LightboxBoardRenames` and `LightboxSparkSaves` (host; each kept its
sequence and guard, with the files it expects now one per board, and an
earlier snapshot made by `keepEarlierSave` where a test needs two files of
one board); `lightboxBoardsView.test.ts`, `useLightboxBoards.test.ts`
(fixtures: every row has a name and a source) and
`LightboxAppSavedBoards.test.tsx` (the menu and browser instead of the
rail). `LightboxBoardsPanel.test.tsx` went with the panel.

**Against `a57a5cd`** (this slice's 17 new and rewritten suites, with the
boards harness and the memory file system, copied onto an export of the
base): with ts-jest's type checks, none loads; each names a module, route
or field the base lacks. With type checks off, and the harness given the
base handler's signature, 11 suites load and 94 of their 128 tests fail:
one file per board, the default names, every chapter's listing, the
fallback to a new file, "Open a board file…", every row named and carrying
its source, and the app's menu and browser. The 34 that pass are controls
and what 5A and 5A.1 already guaranteed (opening another chapter's board
under its ticket, the refusal while a run reads, session-only, the hook's
correlation, the notice above the board, the spark's controls). The view
suite and the five new component suites cannot load there: their modules
and exports are new.

Visual evidence:
[`lightbox-slice-5a2-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-5a2-visual/README.md):
ten host states at 1440, 1000 and 500 px, 30 captures, `errors.txt` empty
(183 errors and exit 1 against `a57a5cd`'s bundle, and against
`08b0d22`'s); and the Workshop's menu and browser with the base's bundle
and this branch's, five states at three widths, markup, computed styles
and boxes identical, `workshop-errors.txt` empty. Rendered again after
the merge of `08b0d22`, with the same results. Rendering it caught four things, fixed: the
Boards menu running off the window at 500 px, a row glyph's icon pinned
to its corner, a row's chapter cut to one letter at 500 px, and a 0.015 px
shift in the Workshop's browser heading (two text nodes where it had one).

Gates at this slice's code, before the merge: full `npx jest`, 490
suites / 6,720 tests / 59 snapshots (482 / 6,653 / 59 at `a57a5cd`);
`npm run lint`, 0 errors and 1,133 warnings, identical per file, rule and
severity to `a57a5cd`; `npm run typecheck`; `npm ci` into a real
`node_modules`, then `npm run build` with `verify:bundle` twice,
`webview.js` SHA-256 `be9b6a9c…6aaa` and `extension.js` `10d4dd8d…c2b4`
both times; `git diff --check` clean.

Gates after merging `epic/lightbox` at `08b0d22` (Slice 4H, PR #165), on
the code as pushed, under Node 22.22.0 and Node 18.20.8 (CI's): full
`npx jest`, 499 suites / 6,896 tests / 59 snapshots (491 / 6,829 / 59 at
`08b0d22`), all passing under both; `npm run lint`, 0 errors and 1,133
warnings, identical per file, rule and severity to `08b0d22`, under both;
`npm run typecheck` under both; `npm ci`, then two builds with
`verify:bundle` under each, `webview.js` `1f28383f…7a2e` and `extension.js`
`44596e69…3b9b` all four times (the evidence's bundle); `git diff --check`
clean. A first Node 18 run, beside another suite on the same four cores,
missed four timing bounds (the linear-time checks of Slices 4E and 4G,
and a Workshop intake's wait); each passed alone, and the whole suite
passed when run again. No live or billable call.

### Implementation notes (2026-10-23)

What the writer may want to redirect:

- **The time in a default name is the extension host's local time.** In a
  remote window (SSH, a container, Codespaces) that is the remote
  machine's zone, which may not be the writer's.
- **Boarding unchanged text again.** In the same session, choosing the
  chapter again continues the board already on screen, and its file. In a
  new session, the chapter's board starts again: no file is written while
  it is only measured (a saved board already holds that text, decision
  27), and its first reading writes a new file with a new dated name.
- **A board's saved time moves with each save**, since a later save
  rewrites the file; its name keeps the time of its first save. The rows
  sort by saved time, so a board read again today sits under Today.
- **Two windows on one board.** When another window holds or has changed
  the file, this window's save goes to a new file: two files for one board
  rather than one save lost. Rename either.
- **A file with a part left out is never rewritten**, so its board's next
  save writes a new file and the hand-edited one stays as it is.
- **An empty name.** The menu's sheet and the browser refuse an empty name
  ("A board needs a name."), since every board now has one. The host's
  rename route still takes an empty name as 5A.1 did, unnaming the file,
  which then shows its default.
- **The shared browser's opt-ins** (`renameRule`, `sendOnlyEdits`,
  `returnFocus`) are the Lightbox's; the Workshop could take them later
  without a change to the shared component.
- **The listing reads every chapter's folder** each time the shelf is
  asked for (every adoption, save and delete, and as the browser opens).
  Summaries are cached by size and modification time, so a warm listing
  stats each file once
  ([listing-scale tech debt](../../tech-debt/2026-10-22-lightbox-board-listing-scale.md)).
- **"Open a board file…" closes the browser** before the host's picker
  shows, as the project picker does. A dismissed picker leaves the board as
  it was, with the browser closed.

## Slice 5B: draft compare (a later PR)

Unchanged from the original plan, now reading format 1 as it is. From
Slice 5A.2 a board is one file (decision 46), so the two drafts Compare
reads are two boards: one from before "Read the current text", one after.
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
