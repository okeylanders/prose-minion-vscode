# ADR 2026-11-17: Everyday Conveniences, Round Two: Earlier Turns, the Memory Index, Trailer Outcomes, Lenses and Help

**Status:** Proposed (Slice 0). Revised 2026-11-17 after PR #269's review (D5, D10, D13–D15, D17, D20–D22; see "Review record"). The product defaults are Okey's where the epic README says so. Every other default, Q1–Q7 included, was taken by the orchestrator and waits for Okey; none is an owner decision, and each is his to overturn.
**Date:** 2026-11-17
**Epic:** [Everyday Conveniences, Round Two](../../.todo/epics/epic-everyday-conveniences-round-two-2026-11-17/README.md)
(its "Defaults taken" table is binding here)
**Ideas as filed:**
[Show a Long Room's Earlier Turns](../../.todo/features/feature-workshop-thread-earlier-turns/README.md) (item A),
[Show Personas Every Memory's Title](../../.todo/features/feature-workshop-memory-title-index/README.md) (item C),
[Tell the Persona What Became of Its Notes](../../.todo/features/feature-workshop-memory-proposal-outcomes/README.md) (item D),
[Personas Can See the Writer's Lexical Gravity Lenses](../../.todo/features/feature-workshop-persona-reads-lenses/README.md) (item F),
[A Complete Prose Minion Reference](../../.todo/features/feature-prose-minion-help-reference/README.md) (item H)
**Amends:**
- [ADR 2026-11-04: Workshop Project Memory](2026-11-04-workshop-project-memory.md)
  **D1** (`memory.catalog` gains `<page>`), **D5** (the frame gains a titles
  tier, `<more>` changes meaning, and the list's size becomes a setting) and
  **D11** (its bounds). Item C, decisions D8–D12 below. That ADR's text is
  not edited; this ADR is the amendment.
**Extends:**
- [ADR 2026-11-14: Everyday Conveniences](2026-11-14-everyday-conveniences.md)
  D1, D2 and D2a: the shared window fit and "every hint makes progress",
  which items F and H use.
- [ADR 2026-10-05: Session Recall](2026-10-05-workshop-session-transcript-recall.md):
  exhaustive families, and hints that decode as written.
- [ADR 2026-11-07: Message Reactions](2026-11-07-workshop-message-reactions.md)
  D6: a fact a persona is owed rides the reply turn. Item D follows it.
- [ADR 2026-07-30: Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md):
  every session field here is optional and additive, with no
  `schemaVersion` bump.
- [ADR 2026-09-30: Rewind and Branch](2026-09-30-workshop-rewind-and-branch.md):
  `turnRewindability` stays host-private and is never re-derived (item A).
**Does not amend** [ADR 2026-08-01: Lexical Gravity Interpretive Grammar](2026-08-01-lexical-gravity-interpretive-grammar.md).
That ADR says nothing of who may read a lens; the "starters only" rule is
code (`LexicalGravityRecommendation.ts`), and item F leaves it as it is.

Paths below that start `core/` are under `packages/core/src/`.

## Context

The epic has eight items. **B, E and G need no ADR; they are settled in the
epic README,** as is A's part 1 (moving the hidden-turns notice). This ADR
decides A's part 2, C, D, F and H.

**A, as the code stands:**
- `WorkshopSessionService.getSnapshot()` sends the newest
  `WORKSHOP_SNAPSHOT_TURN_WINDOW` (200) turns (`turnLedger.window(200)`),
  with `totalTurns` and `truncatedTurns`. Beside them it sends what a bubble
  needs: `turnRewindability` (from `WorkshopRewindPolicy.bubbleRewindability`),
  `reactions`, `widgetConfigs` and `modelsBeforeWindow`, each computed for the
  window's turns.
- `WorkshopRoomHandler.postSessionState` is the one constructor of
  `WORKSHOP_SESSION_STATE`. It passes each turn through
  `workshopTurnForWebview` (which removes host-only fields and derives an
  edit offer's status) and posts the whole snapshot on every state change.
  `useWorkshopRoom` replaces its `turns` with each one.
- A single turn outside the window can already be read:
  `WORKSHOP_REQUEST_TURN_PREVIEW` names `requestId`, `turnId` and
  `roomRevision`, and `WorkshopBookmarkHandler` refuses it once
  `readRoomRevision()` differs.

**C, as the code stands:**
- `renderProjectMemoryFrame` (`core/application/services/workshop/memory/ProjectMemoryCatalogFrame.ts`)
  writes pinned bodies within `pinnedTokens` (5,000), then entries within
  `catalogTokens` (2,000) **and** `catalogEntries` (40), then one `<more>`
  that counts every memory not shown, live ones included.
- `renderWorkshopProjectMemoryCatalog` shows the first `catalogEntries`
  notes in effect and says "use memory.search to find them" for the rest.
  `memory.catalog` takes only `<kind>`.
- **Nothing bounds how many notes a project holds.**
  `readProjectMemoryFolder` (`core/infrastructure/storage/ProjectMemoryFiles.ts`)
  reads every memory file in the folder, and the catalog renderer filters
  and orders that whole set. No decision here adds a cap.
- The Memory tab's meters read `ProjectMemoryFrameEstimate`, which this
  renderer returns.

**D, as the code stands:**
- A reply's trailers are judged once, in `completeWorkshopRun`
  (`WorkshopRunCompletion.ts`): `extractWorkshopReplyControls`, then
  `settleWorkshopMemoryProposals` and `resolveWorkshopReplyFileEdits`.
- A frame the **extractor** drops has a closed reason
  (`WorkshopReplyMemoryRejection`, `WorkshopReplyFileEditRejection`).
- A frame that decodes can still end with no card, at **settlement**, and
  there the reason is only a log string:
  - **a memory edit** (`settleWorkshopMemoryEdit`,
    `core/application/services/workshop/memory/WorkshopReplyMemoryEdit.ts`)
    returns `{ proposal?, log }`. With no proposal the reason is one of
    `listing-unread`, `unknown-target`, `archived-target`,
    `superseded-target`, `busy-target`, `pinned-budget`, or a
    `WorkshopMemoryEditAnchorFault` (`find-missing`, `find-ambiguous`,
    `replaces-overlap`, `conflicting-operations`, `summary-emptied`,
    `unchanged`, and the six `WorkshopMemoryFieldFault`s), typed `string`
    and written into the log line alone. `settleWorkshopMemoryProposals`
    keeps the line and adds no card;
  - **a new note** always becomes a card (`settleOne`);
  - **a file edit** staged to the same document as an earlier one in the
    reply is dropped in `resolveWorkshopReplyFileEdits` with the literal
    log line `reason=duplicate-identity`;
  - **a file-edit context resolved for another reply** makes
    `completeWorkshopRun` log every frame as `reason=not-staged`.
- A file edit **refused at staging** is not a drop: it becomes a `refused`
  card the writer sees (`settle` in `WorkshopReplyFileEditProposals.ts`).
  An edit-offer answer can refuse two more ways, also as cards
  (`not-the-offered-file`, `more-than-a-fix`, in
  `workshopEditOfferAnswerCards`).
- Every one of these goes to the log and nowhere else. The turn keeps only
  the cards (`memoryProposals`, `fileEditProposals`).
- **Two paths commit a reply that can hold trailers:** `completeWorkshopRun`
  and, for a pressed edit offer's answer, `completeWorkshopEditOfferRun`
  (`WorkshopEditOfferAnswerCompletion.ts`).

**F, as the code stands:**
- Project lenses are read by `LexicalGravityLensRepository.list()`
  (`prose-minion/lenses/*.json`, at most 200 files of 256 KiB). Built-in
  lenses come from `builtInLexicalGravityLenses()`
  (`widgets/lexicalGravity/LexicalGravityLenses.ts`).
- No capability family reads either.

**H, as the code stands:**
- The manifest (`apps/vscode-extension/package.json`, version 2.14.0)
  contributes 15 commands and 58 settings. Nothing a model can read
  describes the product.
- `packages/core/resources/` is copied whole into the VSIX by
  `apps/vscode-extension/scripts/copy-resources.js` and read at run time
  through the `FileSystem` port.

**The capability grammar, which C, F and H all touch:**
- `WORKSHOP_CAPABILITY_OPERATIONS` (`core/shared/types/workshopCapabilities.ts`)
  is a closed list of 14 operations in five families. Every family switch is
  exhaustive.
- `WORKSHOP_NATIVE_CALL_FIELDS` (`WorkshopNativeToolCallTranslator.ts`,
  PR #267) is keyed by that list, so a new operation does not compile until
  its fields are listed there.

## Where the code differs from the notes and the brief

Checked before deciding; each is settled below.

1. **The snapshot is bounded by turns only.** The note says pages are
   bounded "by turns and by bytes, like the snapshot". Nothing bounds the
   snapshot's bytes. Pages get a byte bound (D3); the snapshot is left as it
   is.
2. **A page cannot be read once and trusted.** The snapshot is posted whole
   on every state change, and the window slides as turns arrive, so a turn
   leaves the window for the hidden range. A held page also goes stale:
   its reactions, card states and Rewind verdicts change in the same room.
   D5 makes the held range a read the webview repeats.
3. **A bookmark already knows whether its bubble is in the window**
   (`WorkshopBookmarkSummary.inWindow`). It stays "in the snapshot window".
   A bookmark on a loaded page still opens its preview (D6).
4. **The list is capped by entries as well as tokens.** `catalogEntries`
   (40) stops the list before 5,000 or 10,000 tokens could fill. Each size
   therefore carries its own entry cap (D9). **This goes past T1 as Okey
   wrote it.**
5. **The update note reads the frame's budgets**
   (`ProjectMemoryUpdateNote.ts`, `PROJECT_MEMORY_FRAME_BUDGETS`). It keeps
   today's numbers at every size (D9).
6. **Drop counts are not stored, and not every drop is typed.** The note
   says the source is "the reply's settled proposals and the log reasons".
   Log lines are not state, and a settlement drop's reason exists only
   inside one. D13 adds a turn field, and makes each settlement step return
   a typed verdict that the log line and the field both read (PR #269
   F-01).
7. **No delivery record is needed.** The brief names the reactions' records
   as the pattern. The line is about the persona's *latest* reply, so it is
   derived from the ledger with no record of having been told (D15).
8. **A file-edit card can be refused at staging** (`settle` in
   `WorkshopReplyFileEditProposals.ts`). That is news for the persona too,
   and is counted apart from a drop (D13).
9. **Built-in lenses are not in the repository.** "Reads go through
   `LexicalGravityLensRepository` alone" holds for project lenses. Built-ins
   come from `builtInLexicalGravityLenses()`, and a built-in wins its slug
   (`WorkshopLexicalGravityHandler.handleRequestLenses`). D17 keeps both.
10. **Without `lens.search`, a catalog must page.** The library holds up to
    206 lenses (200 project files, `LEXICAL_GRAVITY_LIBRARY_LIMITS.maximumFiles`,
    and the built-ins). A capped catalog would hide the rest, which is the fault
    item C fixes for memory. `lens.catalog` takes C's `<page>` (D17).
11. **A published read needs more than an operation.** `memory.read` joined
    `CONTEXT_SOURCE_KINDS`, the manifest, Read in and
    `PUBLISHABLE_CAPABILITY_OPERATIONS`. Lens and help results stay private
    to the persona that asked, so none of those widen (D16).
12. **Core cannot read the manifest at run time.** The help tables are
    committed files, held to the manifest by a test (D24).
13. **Three files are already past 500 lines:** `WorkshopPersonaCapability.ts`
    (981), `WorkshopSessionStateV1Shape.ts` (1,116) and
    `WorkshopSessionService.ts` (2,916). Each new family and field brings its
    own module; these files gain only the call into it.

## Item A: decisions

### D1. A page is the turns before a turn

Two messages, in `core/shared/types/messages/workshop/session.ts`:

```ts
// webview → host
WORKSHOP_REQUEST_EARLIER_TURNS: { requestId: string; roomRevision: number; beforeTurnId: string }

// host → webview
WORKSHOP_EARLIER_TURNS: {
  requestId: string; roomRevision: number; beforeTurnId: string;
  page?: {
    turns: WorkshopTurn[];                       // oldest first, ending just before `beforeTurnId`
    turnRewindability: Record<string, WorkshopTurnRewindability>;
    reactions: WorkshopTurnReactionSummary[];
    widgetConfigs: WorkshopWidgetConfigSummary[];
    modelsBefore?: Partial<Record<ModelScope, string>>;
    remainingBefore: number;                     // turns older than the page's first
  };
  error?: string;                                // host words, naming no content
}
```

- **The webview names a turn, never a position.** `beforeTurnId` is the
  oldest turn it holds. The host answers with the turns directly before it.
- **`remainingBefore` is zero at the room's first turn.** "Show earlier
  turns" is offered only while it is above zero.
- **A refusal** is `room-changed` (the revision differs), `unknown-turn`
  (the room holds no such turn) or `malformed`. Each answers with `error`
  and no page.

### D2. One projection

- `WorkshopSessionService` gains `readEarlierTurns(beforeTurnId, bounds)`.
  It and `getSnapshot()` build their per-turn parts through **one private
  function** over a list of turns: the turns, `bubbleRewindability`, the
  reaction summaries and the widget-config summaries. Neither computes them
  another way.
- The handler passes a page's turns through `workshopTurnForWebview`, with
  the same edit-offer room view `postSessionState` uses.
- So an earlier bubble shows exactly what it would have shown in the
  window. A test renders one turn both ways and compares.
- `modelsBefore` is `workshopModelsBeforeWindow` for the turns before the
  page, so the page's first reply still draws its model slice.
- **`turnRewindability` never leaves the host's rule.** The page carries the
  verdicts; the webview merges two maps and derives nothing.

### D3. Bounds

New in `PROMPT_BUDGETS`, as `workshopThread`:

| Key | Value | What |
|---|---|---|
| `pageTurns` | 100 | turns one page holds |
| `pageBytes` | 1 MiB | the UTF-8 size of a page's turns as sent |

- A page stops at whichever bound comes first, counting from the newest
  turn back.
- **A page always holds at least one turn,** so a turn larger than
  `pageBytes` is sent alone and paging always makes progress.
- `WORKSHOP_SNAPSHOT_TURN_WINDOW` stays 200. The snapshot gains no byte
  bound here.
- A very long room pages; it never loads whole in one answer.

### D4. Correlated, room-bound, read-only

- The webview mints `requestId`. The host echoes it with `roomRevision` and
  `beforeTurnId`.
- **The host answers only from the room named.** It compares
  `roomRevision` with `readRoomRevision()` before it reads the ledger, as
  the turn preview does (PR #189 F-02).
- **The hook takes only the answer it still waits for.** A room change
  (New, Open, Rewind, Branch, restore) drops every held turn and any
  pending request before anything new is asked.
- **Reading a page writes nothing.** It joins no mutation gate, never
  dirties the session and never saves it.
- **Route owner:** a new composed handler, `WorkshopEarlierTurnsHandler`,
  beside `WorkshopBookmarkHandler`. It joins
  `WORKSHOP_COMPOSED_SLICE_HANDLER_NAMES` (the 24th).
- **Logs** carry the request's outcome and counts (turns, bytes), never a
  turn's text.

### D5. What the webview holds

`useWorkshopEarlierTurns` (`core/presentation/webview/hooks/domain/workshop/`),
tripartite, with an empty persistence contract.

- **One contiguous run.** The hook holds the earlier turns as one run that
  ends directly before the window's first turn. The thread draws the run,
  then the window.
- **Never persisted.** Nothing loaded enters `vscode.setState`. A reload
  shows the window again.
- **The run is re-read, not trusted.** When a `WORKSHOP_SESSION_STATE`
  arrives for the same room and the hook holds a run:
  - the run stays on screen;
  - the hook asks again, page by page, from the window's first turn back to
    the oldest turn it holds, one request in flight at a time;
  - each answer replaces the turns it covers, and fills any gap the sliding
    window left;
  - a newer session state restarts the walk, and an answer to a walk that
    was restarted is dropped (it is no longer the pending request);
  - a turn the hook holds that the answer covering its place does not
    return is removed, so a walk never leaves a stale turn inside a range
    it has re-read.
- **Why this is safe while a page is stale.** Every action re-checks on the
  host: Rewind and Branch re-evaluate the cut, Apply claims its card, a
  reaction goes through the ledger. A stale page can show an old state for
  a moment; it can never act on one.
- **A turn that left the room** (a rolled-back send) is gone from the next
  answer, and so from the run.

### D6. An earlier bubble is a full bubble

- **Rewind and Branch** use the page's verdicts.
- **Reactions, memory cards, file-edit cards and edit-offer chips** draw
  from the page's turns and summaries, and act through their existing
  routes, which name a turn by id.
- **Copy, Bookmark and Save to memory** work as they do now.
- **The slice proves each route on a turn outside the window.** A route
  found to read the window instead of the ledger is fixed in the slice.
- **A bookmark's or a to-do source's jump is unchanged.** `inWindow` still
  means the snapshot window, so a bookmark on a loaded page opens its
  preview.

### D7. The control

- **"Show earlier turns"** sits at the top of the thread, with the count
  from part 1's notice: "Show earlier turns (73 not shown)".
- **Pressed,** it asks for the page before the oldest turn held. While the
  answer is pending it is `aria-disabled` and reads "Loading earlier
  turns…".
- **The scroll position holds.** The bubble at the top of the view before
  the page lands is at the same place after.
- **One live-region announcement** per page: "100 earlier turns shown."
- **A refusal** shows the host's words beside the control and keeps what
  was held.
- **At the room's first turn** the control and the notice go.

### Item A: out of scope

- Jumping to a bookmark's or a to-do source's page in the thread.
- Growing or shrinking the 200-turn window.
- A byte bound on the snapshot.
- Search inside the thread.

## Item C: decisions

These amend ADR 2026-11-04 D1, D5 and D11.

### D8. A titles tier, and what `<more>` means

The frame gains a third tier after the entries:

```xml
<project-memory note="…" built="2026-11-17">
  <pinned id="mem-1a9e04" kind="preference" updated="2026-10-28" title="…">…whole body…</pinned>
  <entry id="mem-7f3c2a" kind="canon" updated="2026-11-03">The Rabbit's watch runs backward: From chapter 3 on, …</entry>
  <title-only id="mem-52c0de" kind="idea">The Hatter might know the Rabbit</title-only>
  <unlisted count="12">More notes in effect, older: memory.catalog pages through them.</unlisted>
  <more count="5">Superseded or archived notes, not in effect: memory.search with status all.</more>
</project-memory>
```

- **`<title-only>` lists every other note in effect:** its id, kind and
  title, newest `updated` first (ties by id, as the entries). It carries no
  date and no summary.
- **Its budget is `titleTokens`.** The tier stops at the first line that
  does not fit. It has no entry cap.
- **A pinned note whose body did not load and whose entry did not fit**
  leads the tier, marked `pinned="not-loaded"`.
- **`<unlisted>`** counts the notes in effect that no tier shows. It is
  written only when that count is above zero.
- **`<more>` now counts only superseded and archived notes,** and says so.
  ADR 2026-11-04 D5 had it count everything left out.
- **On by default.** There is no switch for the tier. It appears only once
  the list overflows.
- **Deterministic, as before.** The same folder, date and size give the
  same bytes. A folder whose list does not overflow and that holds no
  superseded or archived note renders byte for byte as it does today
  (test).
- **Reserved names.** `title-only` and `unlisted` join
  `RESERVED_PERSONA_FRAME` (`core/utils/workshopPromptFrames.ts`), and
  titles are escaped as entries are.
- **Built once per conversation, still.** A conversation that began before
  this slice keeps the frame it was given.

`ProjectMemoryFrameEstimate` gains `titleTokens`, `titleEntries`,
`unlisted` and `retired`. `ProjectMemoryRenderedFrame` gains `titles` (the
ids, in order). `projectMemorySnapshot` is unchanged: it already records
every note in effect.

### D9. One size setting, in tokens

`proseMinion.workshop.memory.listSize`: `standard` (default), `larger`,
`largest`. Application scope, as the memory mode.

| Size | Titles and summaries | Entry cap | Titles only | Loaded in full |
|---|---|---|---|---|
| `standard` | 2,000 tokens | 40 | up to 2,000 tokens | 5,000 tokens |
| `larger` | 5,000 | 100 | up to 3,000 | 5,000 |
| `largest` | 10,000 | 200 | up to 4,000 | 5,000 |

- **A closed table.** `WORKSHOP_PROJECT_MEMORY_LIST_SIZES`
  (`core/shared/constants/`), keyed by the size, each row a
  `ProjectMemoryFrameBudgets` (which gains `titleTokens`). The numbers live
  in `PROMPT_BUDGETS.workshopProjectMemory.listSizes`. Today's
  `catalogTokens` and `catalogEntries` are Standard's row.
- **The entry cap grows with the size** (item 4 above). Without it, Larger
  and Largest would stop at 40 entries.
- **`pinnedTokens` does not move.** The pin refusal in the manager compares
  against one number at every size.
- **Tokens, never characters.** The tab's meters already speak tokens.
- **Read where the frame is built.** `ProjectMemoryLibrary.frame()` and the
  manager's estimate read the size through one reader, injected at the
  composition root. No handler reads the setting to size a frame.
- **A change applies from the next conversation.** The frame is built once,
  so nothing is rebuilt and no prompt cache is broken mid-room. The tab says
  so (D12).
- **The update note keeps today's bound** (`PROJECT_MEMORY_FRAME_BUDGETS`,
  Standard's numbers) at every size. It is a delta, not the list.
- **`memory.catalog`'s page size keeps `catalogEntries` (40)** at every
  size (D10).

### D10. `memory.catalog` gains `<page>`

```xml
<prose-minion-tool-call name="memory.catalog">
  <kind>decision</kind>
  <page>2</page>
</prose-minion-tool-call>
```

**There is no page ceiling.** The library has no note ceiling (see
Context), so a fixed highest page would either end the walk early or make
the renderer name a call the codec refuses (PR #269 F-02). The page's
domain is syntactic, and wide enough that the renderer can never leave it.

- **`<page>` is optional.** Absent means 1. Written, it is a whole number
  in plain decimal digits with no sign, space, point or leading zero, from
  1 to 999,999,999: `^[1-9][0-9]{0,8}$`, at most `pageDigits` (9) digits.
  Anything else (`0`, `01`, `-1`, `1.5`, `two`, ten digits) is refused as
  `invalid-page`, a new `WorkshopCapabilityRejectionReason`.
- **One parser,** `workshopCapabilityPage`, in a neutral module beside
  `WorkshopCapabilityXmlCodec.ts` that imports nothing of `memory/`,
  `recall/` or `lens/`. `memory.catalog` and `lens.catalog` (D17) both read
  `<page>` through it. Its bound is
  `PROMPT_BUDGETS.workshopCapabilityPaging.pageDigits`.
- **Why nine digits.** The last page of any listing the host can hold is
  `ceil(count / pageSize)`. A JavaScript array holds at most 2^32 - 1
  items, and the smallest page size is 40, so the last page is at most
  107,374,183: nine digits. A test holds that inequality for every page
  size that uses the field, so a smaller page size added later fails the
  build instead of producing a hint that does not decode.
- **The request type** becomes
  `{ capability: 'memory.catalog'; kind?: ProjectMemoryKind; page?: number }`.
  No new operation.
- **A page** is `catalogEntries` (40) notes in today's order (pinned first,
  then newest; `compareProjectMemoryCatalogOrder`), of the kind asked. With
  `count` matching notes, `pages = ceil(count / 40)`, and page `p` holds
  notes `40(p-1)+1` to `min(40p, count)`. Its header names the range:
  "Notes 41–80 of 93 in effect".
- **The continuation line is written exactly when `p < pages`,** and names
  `p + 1`. It is the exact next call, complete, on one line, keeping
  `<kind>` when the request had one:
  `<prose-minion-tool-call name="memory.catalog"><kind>decision</kind><page>3</page></prose-minion-tool-call>`
  The last page writes none. Today's "use memory.search to find them" line
  goes.
- **Every hint decodes as written and makes progress.** `p + 1` is at most
  `pages`, which is inside the codec's domain by the bound above, and it is
  greater than `p`. There is no count of notes at which the renderer names
  a page the codec refuses.
- **Complete, for a folder that holds still.** From page 1, following each
  hint visits pages 1 to `pages` once each, and every matching note in
  effect appears on exactly one of them (test, including 2,001 notes of one
  kind).
- **A page past the end** is not a refusal. It answers in words, with the
  last valid page and no hint: "Page 9 is past the end: 93 notes in effect,
  3 pages." With no matching note, page 1 says so as today, and a later
  page says "Page 2 is past the end: no note in effect."
- **The catalog is live.** Notes can move between two calls, so a walk
  across a changing folder can show a note twice or miss one, and a hint
  can lead past the end; that page then answers in words. The first line
  already says the catalog can differ from the conversation's list.
- **`WorkshopProjectMemoryRenderedCatalog`** gains `page` and `pages`
  beside `shown` and `notShown`, for the card's metadata and the log
  (counts only).
- **The native map.** `WORKSHOP_NATIVE_CALL_FIELDS['memory.catalog']` gains
  `page`. A native call's number or text becomes the same XML text and is
  read by the same parser. The translator's field-policy test holds it to
  the codec.
- **No storage cap is added.** Nothing here limits, refuses or removes a
  note.

### D11. The prompt

`packages/core/resources/system-prompts/workshop-personas/project-memory-capability.md`
changes in four places:

- "What the start of the conversation shows" describes `<title-only>`,
  `<unlisted>` and the new `<more>`.
- "When to look" gains one sentence: **a title that bears on what the
  writer raised is a reason to read that note.** "Do not look routinely"
  stays.
- "The calls" teaches `<page>` and the continuation line.
- It names no token number: the size is the writer's setting.

`projectMemoryPromptSync.test.ts` holds the prompt to the renderer: the
element names, `catalogEntries`, and every taught form and every hint
decoding through `WorkshopProjectMemoryXmlCodec`, as written. The prompt
names no highest page: there is none.

### D12. The Memory tab

- **A row, "List at the start of each conversation":** Standard, Larger,
  Largest, each with its token sizes in its description.
- **One line under it:** "Applies from the next conversation."
- **A third meter, "Titles only",** beside "Loaded in full" and the list's.
- **The meters and the frame agree at every size.** The host's estimate
  answer carries the budgets it used; `workshopMemoryTabView.ts` reads
  those, never a constant of its own. A test renders the frame and the
  view at each size.
- **The "searchable only" line** now counts `unlisted`: notes in effect
  that no tier shows.
- The setting follows the unified settings path (manifest,
  `ConfigurationHandler`, the tab's hook, the watcher), as
  `WORKSHOP_MEMORY_HELPER_DRAFTS_SETTING` does.

### Item C: out of scope

- A warning when the chosen size is a large share of the model's window.
  The preflight guards the request.
- Grouping the titles tier by kind.
- Fitting `memory.read` to the window (still open in
  [Reads That Fit the Window](../../.todo/features/feature-workshop-reads-fit-the-window/README.md)).
- Any change to format 1, to pins or to the update note's content.

## Item D: decisions

### D13. The record: `trailerOutcomes` on the reply turn

A new optional field on a persona's reply turn:

```ts
interface WorkshopTrailerOutcomes {
  memory?: { cards: number; dropped: WorkshopTrailerDrop<WorkshopMemoryTrailerDropReason>[] };
  fileEdits?: { cards: number; refused: number; dropped: WorkshopTrailerDrop<WorkshopFileEditTrailerDropReason>[] };
}
interface WorkshopTrailerDrop<Reason> { reason: Reason; count: number }

/** Dropped when the reply was read (the extractor), either kind. */
type WorkshopTrailerParseDropReason = 'malformed' | 'misplaced' | 'duplicate' | 'over-cap' | 'off';

/** A memory edit that decoded, dropped when it was settled against the notes. */
type WorkshopMemoryEditTrailerDropReason =
  | 'notes-unreadable' | 'target-not-found' | 'target-not-in-effect' | 'target-busy'
  | 'find-not-found' | 'find-ambiguous' | 'edits-conflict' | 'result-invalid' | 'no-change'
  | 'pinned-budget';

type WorkshopMemoryTrailerDropReason = WorkshopTrailerParseDropReason | WorkshopMemoryEditTrailerDropReason;
type WorkshopFileEditTrailerDropReason = WorkshopTrailerParseDropReason | 'oversized' | 'not-staged';
type WorkshopTrailerDropReason = WorkshopMemoryTrailerDropReason | WorkshopFileEditTrailerDropReason;
```

**The rule the record keeps: every frame the persona wrote is counted
once.** For each kind, `cards` (and `refused`), plus every drop's `count`,
equals the number of frames of that kind the extractor found in the reply.
A frame that ends with no card is always a drop with a reason, whichever
step dropped it (PR #269 F-01).

**Settlement returns typed verdicts.** Today a settlement drop's reason is
a `string` inside a log line. The slice changes the three places a decoded
frame can end with no card, so that each returns its reason as a closed
type, and the log line and the record are both written from that value.
Nothing parses a log string.

- **`settleWorkshopMemoryEdit`** returns a discriminated verdict in place
  of `{ proposal?, log }`:
  ```ts
  type WorkshopMemoryEditDropReason =
    | 'listing-unread' | 'unknown-target' | 'archived-target' | 'superseded-target' | 'busy-target'
    | 'pinned-budget' | WorkshopMemoryEditAnchorFault;
  type WorkshopSettledMemoryEdit =
    | { kind: 'card'; proposal: WorkshopMemoryEditProposal; log: string }
    | { kind: 'dropped'; reason: WorkshopMemoryEditDropReason; log: string };
  ```
  Its `dropped` helper takes that type, so a new early return does not
  compile without a reason. The log line keeps today's words
  (`Memory edit dropped (target=…; reason=…)`).
- **`settleWorkshopMemoryProposals`** returns, beside `proposals`, `logs`
  and `autoSave`, a `drops` list: one entry per frame with no card, either
  `{ at: 'read'; reason: WorkshopReplyMemoryRejection }` or
  `{ at: 'settlement'; reason: WorkshopMemoryEditDropReason }`. A new note
  that decodes always becomes a card (`settleOne`), so it adds none.
- **`resolveWorkshopReplyFileEdits`** returns `drops` on its context the
  same way: each `WorkshopReplyFileEditRejection`, and
  `'duplicate-identity'` for a frame staged to a document an earlier frame
  of the reply already took. A run aborted before staging reports each
  decoded frame as `'not-staged'`, where today it reports nothing for them.
- **`completeWorkshopRun`'s fallback** (a context resolved for another
  reply) gives every frame the typed `'not-staged'`, as its log does now.

**The mapping is one pure function with a `never` default,** over those
four verdict types. A new rejection, anchor fault or settlement reason does
not compile until it is mapped.

| Step | Verdict (code) | Recorded as |
|---|---|---|
| Read, either kind | `malformed:*` | `malformed` |
| Read, either kind | `misplaced` | `misplaced` |
| Read, either kind | `duplicate` | `duplicate` |
| Read, either kind | `over-cap` | `over-cap` |
| Read | `memory-off`, `file-edits-off` | `off` |
| Read, file edit | `oversized` | `oversized` |
| Memory edit | `listing-unread` | `notes-unreadable` |
| Memory edit | `unknown-target` | `target-not-found` |
| Memory edit | `archived-target`, `superseded-target` | `target-not-in-effect` |
| Memory edit | `busy-target` | `target-busy` |
| Memory edit | `find-missing` | `find-not-found` |
| Memory edit | `find-ambiguous` | `find-ambiguous` |
| Memory edit | `replaces-overlap`, `conflicting-operations` | `edits-conflict` |
| Memory edit | `summary-emptied`, and each `WorkshopMemoryFieldFault` (`invalid-kind`, `title-not-one-line`, `summary-not-one-line`, `title-too-long`, `summary-too-long`, `body-too-long`) | `result-invalid` |
| Memory edit | `unchanged` | `no-change` |
| Memory edit | `pinned-budget` | `pinned-budget` |
| File edit, staging | `duplicate-identity` | `duplicate` |
| File edit, completion | `not-staged` | `not-staged` |

- **`off` also covers a memory context that could not be resolved.**
  `resolveWorkshopReplyMemory` reads a failed or cancelled port as closed,
  and the extractor then reports `memory-off`. The line's words for `off`
  are true of both (D14).
- **`cards`** counts what reached the writer as a card, in any state it
  settled to at commit: waiting, held or saving. It equals the length of
  the turn's `memoryProposals`, or the number of its `fileEditProposals`
  that are not `refused`.
- **`refused`** counts the turn's file-edit cards in state `refused`. That
  covers every refusal that leaves a card: staging's own reasons,
  `identity-unpersistable`, `rewrite-on-prose`, and an edit-offer answer's
  `not-the-offered-file` and `more-than-a-fix`. The writer sees each as a
  card; the persona is told the count and no reason (Q5).
- **So the file-edit side is complete too.** A file-edit frame ends as a
  card, a refused card, or one of the drops in the table. There is no
  fourth way, and the conservation test holds it.
- **Both commit paths write it, through one builder.** `completeWorkshopRun`
  and `completeWorkshopEditOfferRun` each call the same pure function,
  from the verdicts and the cards they hand to `completeRun`. Written once,
  in the reply's own commit; never updated after.
- **A side is present only when the reply carried that kind of trailer.**
  A reply with neither has no field.
- **`dropped` is canonical:** at most one entry per reason, in the reason
  list's order above, each `count` at least 1.
- **Counts and closed reasons only.** Never a title, a quote, a path, a
  note's id, a model's text or the word the phrasing fence matched. A
  memory edit's target id stays in the log line, where it already is, and
  never enters the record.
- **It never records the writer's answers.** A save, a dismissal, an Apply
  or a decline changes a card, never this field.
- **Host-only.** `workshopTurnForWebview` removes it, as it removes
  `reactionDelivery`.
- **Only a host or guest reply holds it.** `completeRun` keeps proposals
  only on those turns, and the field follows them.
- **Codec.** Optional and additive, exact inside: each side's reasons are
  checked against that side's own list (a `pinned-budget` under `fileEdits`
  is refused), entries are canonical as above, and each count is bounded.
  Refused on any turn but a host or guest reply. Its own module beside
  `WorkshopReactionDeliveryRecords.ts`, called from the shape file. No
  `schemaVersion` bump and no normalization (ADR 2026-07-30). Forward
  only: an older build's strict reader rejects a session that holds the
  key.

### D14. The line

One host frame in the persona's next user message:

```xml
<workshop-trailer-outcomes note="From the host: what became of the trailers in your last reply. Counts only.">
Your last reply's notes: 2 shown as cards, 1 dropped (the note it named is archived or replaced), 1 dropped (malformed).
Your last reply's file edits: 1 shown as a card, 1 refused before the writer could apply it.
</workshop-trailer-outcomes>
```

- **One renderer,** pure, from a `WorkshopTrailerOutcomes`.
- **Each reason has one phrase,** in a closed table in
  `core/shared/constants/`, typed
  `Record<WorkshopTrailerDropReason, string>`, so a reason with no phrase
  does not compile:

  | Reason | Phrase |
  |---|---|
  | `malformed` | malformed |
  | `misplaced` | not at the end of the reply |
  | `duplicate` | a repeat of another in the same reply |
  | `over-cap` | past the number one reply may carry |
  | `off` | not open in this conversation just then |
  | `oversized` | too long |
  | `not-staged` | the host could not prepare it |
  | `notes-unreadable` | the notes could not be read just then |
  | `target-not-found` | no readable note has the id it named |
  | `target-not-in-effect` | the note it named is archived or replaced |
  | `target-busy` | the note it named was being saved |
  | `find-not-found` | its find text is not in the note |
  | `find-ambiguous` | its find text is in the note more than once |
  | `edits-conflict` | its changes overlap or contradict each other |
  | `result-invalid` | the note it would leave breaks the note format |
  | `no-change` | it would change nothing |
  | `pinned-budget` | the note is loaded in full, and the change would pass that budget |

  The slice may tune a phrase. It may not add a reason outside D13's list
  or put anything but fixed words in one.
- **A side with nothing to say is left out;** a field with no line to write
  writes no frame.
- **It names no one by pronoun** but the persona it addresses, and no note,
  file or writer decision.
- **`workshop-trailer-outcomes` joins `RESERVED_PERSONA_FRAME`,** so quoted
  text cannot forge one.
- **No prompt file changes.** The frame's `note` says what it is.

### D15. Derived from the ledger; nothing earlier changes

- **The line is about the participant's latest reply.** When a writer
  message goes to a host or guest, the builder finds that participant's
  most recent reply turn in the ledger. If it holds `trailerOutcomes`, the
  frame is added to this message. Otherwise nothing is.
- **No delivery record.** Once the persona replies again, its latest reply
  is the new one, so the line is not repeated.
- **A Rewind or a rollback needs nothing of its own.** A cut that removes
  the reply removes the field with it. A cut that removes the message that
  carried the line makes the same reply the latest again, so the line goes
  out again.
- **Earlier retained messages stay byte for byte** (test, as ADR
  2026-11-07 D4's).
- **Each participant hears only of its own reply.** A guest's outcomes
  never reach the host, or another guest.
- **A pressed edit offer's request carries no line.** Its answer is a
  reply, written by `completeWorkshopEditOfferRun`, and leaves outcomes of
  its own through D13's builder; the persona hears of them with its next
  writer message.
- **Tool sidecars** propose nothing and are told nothing.

### Item D: out of scope

- The writer's answers to cards. "Saved to project memory: …" covers them.
- Why a file-edit card was refused at staging. The count is given; the
  reason is a follow-up (Q5). A *dropped* frame's reason is given, for both
  kinds.
- Reaction trailers and edit offers. Their drops stay in the log.

## The capability grammar: decisions for C, F and H

### D16. What every new operation joins

C adds a field. F and H add two operations each: `lens.catalog`,
`lens.read`, `help.search`, `help.read`, in two new families, `lens` and
`help`. ADR 2026-11-04 D12 is the list of what widens; each slice walks it
again against the code.

| List | Where | F | H |
|---|---|---|---|
| Operations and family | `WORKSHOP_CAPABILITY_OPERATIONS`, `WorkshopCapabilityFamily`, `workshopCapabilityFamily` | `lens` | `help` |
| Family switches | `workshopCapabilityFamilyLabel`, `capabilityTruncationNote` (`WorkshopTurnBubble.tsx`), `WorkshopCapabilityResultLog.ts`, `rejectedAttemptCopy` and `evidenceFraming` (`WorkshopPersonaCapability.ts`) | a case each | a case each |
| Codec | `WorkshopCapabilityXmlCodec.inspect`, by hand, through the family's own codec module | `WorkshopLensXmlCodec.ts` | `WorkshopHelpXmlCodec.ts` |
| Native map | `WORKSHOP_NATIVE_CALL_FIELDS` | both operations | both operations |
| Turn artifacts | `WORKSHOP_TURN_ARTIFACTS`, checked by `WorkshopSessionStateV1Shape.ts` | `lens_catalog`, `lens_read` | `help_search`, `help_read` |
| Module boundary | `boundaries.test.ts`, joining `WORKSHOP_CAPABILITY_BOUNDARY` | `WORKSHOP_LENS_MODULES` | `WORKSHOP_HELP_MODULES` |
| Grammar prompt | a Markdown file in the persona chain (`workshopPersonaSystemPromptPaths`), host and guest | `lens-capability.md` | `help-capability.md` |
| Sync test | hints and taught forms decode as written; numbers from `PROMPT_BUDGETS` | `lensCapabilityPromptSync.test.ts` | `helpCapabilityPromptSync.test.ts` |

- **Private in v1.** No lens or help operation joins
  `PUBLISHABLE_CAPABILITY_OPERATIONS`. So `CONTEXT_SOURCE_KINDS`, the
  manifest and Read in do not widen. The card shows in the thread as any
  private capability card does.
- **Personas only.** The families live in `WorkshopPersonaCapability`, for
  host and guest. `WorkshopToolContextCapability` (tool sidecars) is not
  touched, and a test shows a sidecar's call to either family is unknown.
- **Each family is a per-turn sub-adapter** in its own folder
  (`application/services/workshop/lens/`, `…/help/`), composed inside
  `WorkshopPersonaCapability` beside resource, recall and memory. Each
  module stays under 500 lines and imports nothing of `recall/` or
  `memory/`.
- **Session files are forward-only** for the new artifacts, as
  `transcript_bookmarks` was: an older build rejects a session that holds
  one. No `schemaVersion` bump. A test saves **and reopens** a session
  holding every new value.
- **The slices are sequenced:** C, then F, then H. Each rebases its grammar
  work on the one before, since all three edit the same lists.
- **The reserved-name tests flip deliberately,** each keeping an
  unknown-operation case under another name (ADR 2026-11-04 D12).

### D17. `lens.catalog`

```xml
<prose-minion-tool-call name="lens.catalog">
  <page>2</page>
</prose-minion-tool-call>
```

- **It lists the library:** project lenses first, by name (ties by slug),
  then the built-ins. Each line has the slug, name, variant, description,
  the subject it came from (`originQuery`) and its source.
- **One merge rule.** A built-in wins its slug, as the Lexical Gravity
  modal already has it. The handler's inline merge moves to a pure function
  in `LexicalGravityLenses.ts`, and both callers use it.
- **Project lenses come only through `LexicalGravityLensRepository.list()`;**
  built-ins only through `builtInLexicalGravityLenses()`. The family reads
  no file itself and writes nothing.
- **The installed lens is marked.** The room's Lexical Gravity standing
  directive names its lens; the family learns the slug through a narrow
  port, never the directive's body.
- **Files that don't read are counted,** never shown: "2 lens files
  couldn't be read."
- **`<page>` is C's** (D10), read by the same parser
  (`workshopCapabilityPage`) with the same domain: no page ceiling, 1 to
  999,999,999. A page is `catalogItems` (50) lenses, with the range in the
  header. The exact next call is written on one line exactly when a later
  page exists, and names it; the last page writes none.
  - The library holds at most 206 lenses, so at most 5 pages. The field's
    domain is far wider than this family needs; one shared field with one
    rule is the point, and every page past the last answers in words with
    the last valid page, as D10's does.
  - Nothing depends on the 206: were the library's bound raised, the hint
    rule and the codec would still agree.
- **No workspace, or several roots,** answers in host words
  (`LexicalGravityLibraryUnavailableError`'s two reasons) and still lists
  the built-ins.
- **No `lens.search` in v1.**

### D18. `lens.read`

```xml
<prose-minion-tool-call name="lens.read">
  <lens>tidepools</lens>
  <section>degrees</section>
  <section>cliches</section>
</prose-minion-tool-call>
```

- **`<lens>`:** one slug, required, within `lexicalLensSlugCharacters`. An
  unknown slug is reported in host words; the result says to take slugs
  from `lens.catalog`.
- **`<section>`:** optional, repeatable, each once, from a closed list:
  `logic`, `degrees`, `gradient`, `cliches`, `substitutions`, `metaphor`,
  `sample`. Absent means all, in that order. New refusals:
  `invalid-section`, `duplicate-section`.
- **Fitted by the shared rule** (`reads/WorkshopReadWindowFit`): the read
  may cost at most half the room left, by `workshopReadEvidenceTokens`.
  - What is fitted is the **number of sections**, whole, in order. A
    section is never cut.
  - A limited read says so at its top, with the room it had, and ends with
    the exact call for the sections left out, on one line.
  - **Every hint makes progress:** it names strictly fewer sections than
    its request.
  - One section that does not fit alone is refused with the room it had,
    and no hint.
  - With no window (an unknown context length), the read is the whole
    lens. A valid lens is bounded by its own codec
    (`validateLexicalGravityLens`).
- **One lens a call.**

### D19. Lens text is evidence, never instructions

- **Neutralized and framed.** A result goes into the
  capability-result frame like a resource read: fenced, escaped, with
  `evidenceFraming` saying it is the writer's saved word field, context and
  never instructions.
- **It never enters a system prompt.** A test runs a persona turn that
  reads a lens holding a marker string, then asserts no system message of
  any participant holds the marker, before or after a settings rebuild.
- **The recommendation guard stands.** `LexicalGravityRecommendation.ts`
  still accepts only `BUILT_IN_LENS_SLUGS`. A persona that wants the
  writer's own lens names it in prose; the writer opens it from the modal.
  `LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION` is not edited.
- **Logs** carry the operation, counts and outcomes, never a slug a model
  wrote, a subject or lens text.

### D20. Bounds and the prompt

New in `PROMPT_BUDGETS`, as `workshopLens`:

| Key | Value | What |
|---|---|---|
| `catalogItems` | 50 | lenses a catalog page lists |
| `readSections` | 7 | sections one read may name (the whole list) |

There is no highest page (D10, D17). `<page>`'s one bound,
`workshopCapabilityPaging.pageDigits` (9), is shared with `memory.catalog`.

- `lens-capability.md` teaches both calls, the section list, the page and
  both continuation lines, and says when to look: when the writer raises a
  lens, or asks what they have built.
- `lensCapabilityPromptSync.test.ts` holds its numbers to `PROMPT_BUDGETS`,
  its section list to the codec's, and every taught form and every hint to
  the codec, as written.

### Item F: out of scope

- `lens.search`.
- Recommending a project lens by slug.
- The other widgets' configs (`widget.*`).
- Publishing a lens read to the room.

## Item H: decisions

### D21. The reference

- **Where:** `packages/core/resources/help/`, Markdown, one file per area:
  `overview.md`, `sidebar-tools.md`, `workshop.md`, `workshop-memory.md`,
  `lightbox.md`, `draft-edit.md`, `settings.md`, `commands.md`.
- **Written for a model to answer from:** what each feature does, where its
  controls are, its settings and commands, its limits, and how-to answers
  to likely questions.
- **A section is a `##` heading and what follows it.** Its id is the file's
  name and the heading's slug (`workshop#pinned-context`). Ids are unique
  (test) and are what `help.read` names.
- **Every id decodes.** Each section's id is within `sectionIdCharacters`
  and is accepted by `help.read`'s codec as written (test over the whole
  reference). So an id a search result shows is always a valid call.
- **A section is at most `sectionCharacters`** (test), so one always fits a
  read that fits at all.
- **It ships with no build change:** `copy-resources.js` copies the tree.
- **The writer-facing docs** (`apps/vscode-extension/README.md`,
  `docs/TOOLS.md`, `docs/CONFIGURATION.md`) are not edited and not
  generated from it.

### D22. `help.search` and `help.read`

```xml
<prose-minion-tool-call name="help.search">
  <query>pin a file</query>
</prose-minion-tool-call>

<prose-minion-tool-call name="help.read">
  <section>workshop#pinned-context</section>
</prose-minion-tool-call>
```

- **Search** is deterministic and lexical, over headings and bodies: the
  term rules `memory.search` uses. It returns up to `searchHits` sections,
  each with its id, heading and a snippet, and the line "Read a section
  whole with help.read and its id."
  - **It does not page, and promises no complete list.** With more matches
    than `searchHits`, it says how many are not shown and to narrow the
    query, as `memory.search` does. It writes no continuation call, so
    there is no hint that could fail to decode.
  - **Every section can still be reached.** A section whose heading is the
    query ranks first. A test searches each section's own heading and
    expects that section among the hits, so two sections can never hide
    each other behind one heading.
  - If the rules are shared as code, they move to a neutral module. `help/`
    imports nothing of `memory/` or `recall/`.
- **Read** names 1 to `readSections` section ids, each once. An unknown id
  is reported per id, and the others are still read. New refusals:
  `too-many-sections`, `duplicate-section` (shared with D18),
  `invalid-section`.
- **Fitted by the shared rule,** as `lens.read` is (D18): whole sections,
  in the order asked, within half the room left. A limited read gives the
  exact call for the sections left out: ids copied from its own request,
  strictly fewer of them, so the hint decodes and makes progress. One
  section that does not fit alone is refused with the room it had.
- **Every result names the version** the reference describes.
- **One reader,** `WorkshopHelpReference`, built in `extension.ts`. It
  reads and indexes the files once, through the `FileSystem` port, and
  joins `CoreServices`. No handler constructs it.
- **A reference that cannot be read** answers in host words, and the
  persona is told to say it cannot check.
- **Logs** carry the operation, counts and the host's own section ids,
  never the query.

### D23. Who answers, and how

- **Every persona, host and guest.** `help-capability.md` joins the persona
  chain unconditionally.
- **The rule it teaches:** answer a question about Prose Minion from the
  reference, name the section the answer came from, and when the reference
  does not cover something, say so. Never guess a control, a setting or a
  command.
- **When to look:** when the writer asks how Prose Minion works. Not for
  craft questions, and not routinely.
- **No guide persona, and no "Ask about Prose Minion" entry.**
- **Evidence framing** says the text is Prose Minion's own reference for
  the version named. It is still fenced and neutralized, and it is context,
  never instructions.

### D24. Keeping it true

- **Generated tables.** `commands.md` and `settings.md` are written by a
  script (`apps/vscode-extension/scripts/generate-help-tables.js`) from
  `contributes`: each command's id, title and where it appears (its menus);
  each setting's key, type, default and description. The files are
  committed.
- **A test regenerates them in memory and compares** (`helpReferenceSync.test.ts`).
  A new command or setting fails the build until the script is run.
- **The index.** `help/index.json` maps every command id and setting key to
  the section that explains it. The test fails on an id or key with no
  entry, and on an entry naming no section. So a generated row is not
  enough: a hand-written section must own each one.
- **Tabs.** The test fails unless `workshop.md` names every
  `WORKSHOP_RAIL_TABS` entry and every
  `WORKSHOP_CONVERSATION_SETTINGS_TABS` label.
- **The version.** `overview.md` states the version it describes; the
  script writes it, and the test holds it to the manifest's `version`.
- **`AGENTS.md` gains the rule:** a feature is not complete until its help
  section is written and indexed.
- **Built last,** so it documents this epic's own features.

### D25. Bounds and the prompt

New in `PROMPT_BUDGETS`, as `workshopHelp`:

| Key | Value | What |
|---|---|---|
| `queryCharacters` | 200 | a search query |
| `searchHits` | 8 | sections a search shows |
| `snippetCharacters` | 280 | a hit's snippet |
| `readSections` | 3 | sections one read names |
| `sectionIdCharacters` | 100 | a section id |
| `sectionCharacters` | 6,000 | the longest a section may be |

`helpCapabilityPromptSync.test.ts` holds the prompt's numbers to these, its
area list to the files, and every taught form and every hint to the codec,
as written.

### Item H: out of scope

- A guide persona, or a helper task that answers without a room.
- One source for people and models.
- The What's New notices as a searchable area. `overview.md` points to
  them.
- Publishing a help read to the room.

## Slice plan

Seven slices build these decisions; the epic README has the whole table
and the order.

| Slice | Decisions | First commit |
|---|---|---|
| A, part 2 | D1–D7 | the shared per-turn projection (D2), with no behavior change |
| C | D8–D12 | `<page>` and the renderer's continuation (D10) |
| D | D13–D15 | the typed settlement verdicts, with today's cards and today's log lines byte for byte (D13); then the field, its codec and the before-fixture |
| F | D16–D20 | the family's lists (D16), compiling, with every call refused as not built |
| H | D16, D21–D25 | the generated tables and their test (D24) |

**Shared files; the second to merge takes the other's lines:**
`shared/constants/promptBudgets.ts` (A, C, F, H),
`shared/types/workshopCapabilities.ts`, `WorkshopCapabilityXmlCodec.ts`,
`WorkshopNativeToolCallTranslator.ts` and `WorkshopPersonaCapability.ts`
(C, F, H), `utils/workshopPromptFrames.ts` (C, D),
`WorkshopSessionStateV1Shape.ts` (D, F, H),
`__tests__/architecture/boundaries.test.ts` (A, F, H),
`apps/vscode-extension/package.json` (B, C), the Memory settings tab (B, C),
`presentation/webview/WorkshopApp.tsx` (A, G), `AGENTS.md` (the closing
pass, and H's rule).

## Test plan

**A**
- One turn renders the same through the snapshot and through a page (D2).
- A page stops at `pageTurns`, and at `pageBytes`; a turn over `pageBytes`
  is sent alone.
- Pressing until the first turn: every turn appears once, in order, and
  `remainingBefore` reaches zero.
- **Room replacement:** New, Open, Rewind and Branch each land before a
  held answer. The answer is dropped, and the run is empty.
- The host refuses a request naming another room, and an unknown turn.
- A session state in the same room re-reads the run; a turn that slid out
  of the window appears in it; a rolled-back turn leaves it.
- A second session state lands while a walk is in flight: the first walk's
  held answer is dropped, and the run ends as the second walk read it.
- Rewind, Branch, a reaction, Apply and a memory card's save each work on a
  turn outside the window.
- Nothing loaded is in the hook's `persistedState`.
- `turnRewindability` is never computed in the webview (a boundary test on
  the hook's imports).
- The handler's log lines hold no fixture text.

**C**
- The three tiers, in order, each within its budget; a not-loaded pinned
  note leading the titles tier.
- `<unlisted>` and `<more>` count what they say.
- Byte identity: the same folder twice; and today's frame for a folder
  that does not overflow.
- Each size: the frame and the tab's view agree.
- Codec: `<page>` 1, 51 and 999999999 read; 0, 01, -1, 1.5, `two`, an
  empty field and 1000000000 are `invalid-page`; `<page>` beside `<kind>`;
  a native call's number and its text read alike.
- **The page boundary,** each with all notes of one kind:
  - 0 notes: page 1 says none is in effect, with no hint;
  - 40 and 80 notes (exactly `catalogEntries` × k): page k is full and
    writes no hint;
  - 41 and 81 notes: page k writes a hint to k + 1, which decodes and holds
    one note; page k + 1 writes none;
  - **2,001 notes** (PR #269 F-02): page 50 writes a hint to page 51; page
    51 decodes, holds the one note left and writes no hint.
- **The walk,** for each of those counts and for a mixed-kind folder with
  and without `<kind>`: starting at page 1 and following every hint, each
  hint decodes through `WorkshopProjectMemoryXmlCodec` exactly as written,
  the pages strictly increase, the walk ends, and the ids seen are every
  matching note in effect, each once.
- A page past the end (`pages + 1`, and 999999999) answers in words with
  the count and the last page, and no hint; the same with no note in
  effect.
- The bound: `ceil((2^32 - 1) / pageSize)` has at most `pageDigits` digits
  for `catalogEntries` and for `workshopLens.catalogItems`.
- `projectMemoryPromptSync.test.ts` (D11); the translator's policy test.
- A size change leaves an open conversation's first message byte for byte.

**D**
- A reply with two cards and a malformed frame: the field, then the line
  in the next message.
- **One case per reason, end to end:** for each
  `WorkshopTrailerDropReason`, a reply that produces it, then one drop of
  that reason in the field, no card for that frame, and that reason's
  phrase in the next message's line. The settlement cases (PR #269 F-01),
  each a memory edit that decodes:
  - the listing unread (`notes-unreadable`);
  - an id no readable note holds (`target-not-found`);
  - an archived target, and a superseded one (`target-not-in-effect`);
  - a busy target (`target-busy`);
  - a find the note does not hold (`find-not-found`), and one it holds
    twice (`find-ambiguous`);
  - overlapping replaces (`edits-conflict`);
  - a result whose summary is emptied, and one past a field bound
    (`result-invalid`);
  - an edit that changes nothing (`no-change`);
  - a pinned note whose edit passes the pinned budget (`pinned-budget`).

  The file-edit cases: two frames staged to one document (`duplicate`),
  and a context resolved for another reply (`not-staged`).
- **Exhaustive, by the compiler and by a table:** the mapper's `never`
  default; a table test that walks every member of
  `WorkshopReplyMemoryRejection`, `WorkshopReplyFileEditRejection`,
  `WorkshopMemoryEditDropReason` and the file-edit settlement drops and
  expects a recorded reason; the phrase table is a
  `Record<WorkshopTrailerDropReason, string>` with no empty phrase.
- **Conservation:** for a reply mixing cards, refused cards and drops of
  both steps, each side's `cards` (+ `refused`) + every drop's `count`
  equals the frames of that kind the extractor found; `memory.cards` and
  `fileEdits.cards + refused` equal the turn's card arrays' lengths.
- **The verdict is the log's source:** each settlement drop's log line is
  today's line byte for byte, built from the typed reason.
- A reply with no trailer: no field, no frame.
- Memory off, file edits off, and a memory context that failed to resolve:
  `off`.
- A card refused at staging is counted as refused, with no reason; so is
  an edit-offer answer's `not-the-offered-file` card, written by
  `completeWorkshopEditOfferRun`.
- A staging run aborted before it staged reports each decoded frame as
  `not-staged`.
- The field and the line hold no fixture title, quote, path, find text or
  note id, in every case above; a saved or dismissed card changes neither.
- Earlier retained messages are byte for byte after the line goes out.
- Rewind past the reply: no line. Rewind past the message that carried it:
  the line again.
- A guest's outcomes reach only the guest.
- Codec: round trip with every reason; the field on a writer turn, a
  memory-only reason under `fileEdits`, a repeated reason, a zero count and
  an unknown reason are each refused; an authentic session from before the
  slice still reads.
- `workshopTurnForWebview` removes the field.

**F and H**
- Every list in D16, with a session saved and reopened holding each new
  artifact.
- A tool sidecar's call to either family is unknown.
- Codec: each field, each refusal.
- Catalog paging to the end, by D10's walk: 50 and 51 lenses, and the
  full 206 (5 pages); every hint decodes as written; a page past the end
  answers in words. A built-in winning its slug; unreadable files counted;
  no workspace; several roots.
- The fit: a read limited to fewer sections, its hint decoding and making
  progress; one section that does not fit, refused; no window.
- **The witness (F):** lens text never reaches a system prompt.
- H: the generated tables, the index, the tabs and the version each fail
  when stale; every section under `sectionCharacters`; unique ids; every
  id decodes through `help.read` as written; each section's own heading as
  a query returns that section; a query with more than `searchHits`
  matches says how many are not shown and writes no call.
- H: a fixture conversation answers "how do I pin a file?" from
  `workshop#pinned-context`, with a mocked model.
- Logs: a test greps each family's lines for the fixture's query, subject
  and text.

## Open questions for Okey (work proceeds on the default)

**Q1–Q7 are open.** Each default below was taken by the orchestrator so
work could proceed. None is Okey's decision, and PR #269's review did not
accept any of them on his behalf. A slice that builds on one says so in its
PR, so the default is easy to find if Okey overturns it.

- **Q1. The entry cap at each size** (D9). Default: 40, 100, 200, so Larger
  and Largest can use their tokens. The stricter reading of T1 keeps 40
  everywhere, which would leave most of the larger budgets unused.
- **Q2. Largest costs up to 19,000 tokens** at the start of each
  conversation (5,000 + 10,000 + 4,000). Default: offered as decided, with
  no warning. A warning beside the choice is the alternative.
- **Q3. `lens.read` by section** (D18). Default: an optional `<section>`,
  so a limited read has a next call. The simpler choice reads a lens whole
  or refuses it.
- **Q4. Lens and help reads stay private** (D16). Default: yes in v1.
  Publishing one to the room needs a context-source kind and Read in.
- **Q5. A refused file-edit card's reason** (D13). Default: the count only.
  A dropped frame's reason is given, for both kinds; this question is only
  about a card the writer was shown as refused.
- **Q6. The help index** (D24). Default: every command and setting must be
  owned by a hand-written section, not only listed in a generated table.
- **Q7. Earlier turns are re-read after each room change of state** (D5).
  Default: yes, so a loaded bubble is never left stale. The lighter choice
  loads a page once and marks it "as of when loaded".

## Consequences and risks

- **A long room's whole thread is reachable,** with Rewind and Branch on
  every bubble.
- **A deep run costs requests.** A writer who has loaded 500 earlier turns
  causes five page reads after each state change. The pages are read-only
  and bounded; if it proves heavy, a stamp on the snapshot can skip
  unchanged pages. Not built here.
- **The persona sees every note's title,** and can walk the whole catalog,
  however many notes there are.
  A room's first message grows by up to `titleTokens`; it is prompt-cached
  where the model supports it.
- **`<more>` changes meaning** for new conversations. Open ones keep their
  frame, and the rebuilt system prompt describes both ("may carry").
- **A persona stops guessing what became of its notes.** One more frame
  rides some messages. It is short, and absent when there is no news.
- **Settlement's return types change** (`settleWorkshopMemoryEdit`,
  `settleWorkshopMemoryProposals`, `resolveWorkshopReplyFileEdits`). No
  behavior and no log line changes with them, but for an aborted staging
  run's frames, which gain a log line; slice D's first commit is that
  change alone.
- **Three settings and four operations are added.** The persona prompt
  grows by two grammar files for every conversation. Both are short, and
  both are pinned.
- **Older builds cannot open a session** that holds `trailerOutcomes` or a
  lens or help card. That is the forward-only rule already in force.
- **The help reference is a document someone must keep.** The tests catch a
  missing command, setting or tab. They cannot catch a wrong sentence. The
  `AGENTS.md` rule and the live pass are what hold the prose.
- **`AGENTS.md`'s counts change at the epic's close:** one more composed
  route owner, two more families, one more `CoreServices` field.

## Review record

**PR #269** ([the review](../pr-reviews/pr-269-everyday-conveniences-round-two-spec-review.md)),
reviewed at `dab5760f`. Two P2 findings, both accepted; no other finding.

| Finding | What was wrong | Resolved in |
|---|---|---|
| F-01 | D13 mapped only the extractor's rejections. A memory edit that decodes can be dropped at settlement (target unknown, archived, superseded or busy; the listing unread; anchoring refused; the pinned budget), with its reason only in a log string, so the outcome line would have said nothing of it. | **D13:** every settlement step returns a typed verdict; the reason list covers both steps; every frame is counted once. **D14:** a phrase per reason. **D15:** the edit-offer answer's commit path writes the record too. Test plan D. |
| F-02 | D10 allowed pages 1–50 of 40 notes and promised the walk reaches every note, but nothing bounds the library. At 2,001 notes of one kind, page 51 was either an invalid hint or an unreachable note. | **D10:** no page ceiling; `<page>` is 1 to 999,999,999, a bound no listing can reach; the hint is written exactly when a later page exists. **D17, D20:** `lens.catalog` shares the field and the rule. No storage cap is added. Test plan C. |

Checked in the same pass, at the review's prompting:

- **The file-edit side of F-01.** `duplicate-identity` and `not-staged`
  were log literals outside `WorkshopReplyFileEditRejection`, though D13
  named one of them. Both are typed now, and a staging run aborted before
  it staged reports its frames (D13).
- **The same class as F-02 in item H.** `help.search` writes no
  continuation and promises no complete list; every section id decodes;
  each section is reachable by its own heading (D21, D22).
- **The review's implementation note on item A.** A restarted walk drops
  the earlier walk's answers, and a re-read range evicts turns the host no
  longer returns (D5, test plan A).
- **Q1–Q7** stay open, marked as the orchestrator's defaults.
