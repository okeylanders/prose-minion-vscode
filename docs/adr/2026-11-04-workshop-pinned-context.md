# ADR 2026-11-04: Workshop Pinned Context

**Status:** Proposed (2026-11-04). Six questions are open for Okey ([Open questions](#open-questions)). Accepted after the live pass (Slice 5).
**Date:** 2026-11-04
**Epic:** [Workshop Pinned Context](../../.todo/epics/epic-workshop-pinned-context-2026-11-04/README.md)
**Design:** `docs/design/workshop-pinned-context/` (Slice 0d, not yet drawn). It follows Project Memory's approved settings design (PR #196, `docs/design/workshop-project-memory/` on `epic/workshop-project-memory-slice-0-design`).
**Extends:** [ADR 2026-07-30: Workshop Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md) (no codec change, D4); [ADR 2026-10-19: Lightbox](2026-10-19-lightbox-inspiration-board.md) (D12: the saved-board write discipline, through Project Memory's shared `StoredFileClaims` / `StoredFileRewrite`)
**Related:** [ADR 2026-11-04: Workshop Project Memory](2026-11-04-workshop-project-memory.md) (on `epic/workshop-project-memory`: D8 unavailable workspaces, D10 storage, and the "Memory isn't context" well of its Slice 0d design); [ADR 2025-11-03: Unified Settings Architecture](2025-11-03-unified-settings-architecture.md); [ADR 2026-10-03: Acknowledged Workshop Context Deltas](2026-10-03-workshop-context-delta-delivery.md); [ADR 2026-10-03: Provider Conversation Prompt Caching](2026-10-03-provider-conversation-prompt-caching.md)

Paths below that start `core/` are under `packages/core/src/`. Line
references are to `main` at `24d9d6e`.

## Context

Okey attaches the same ten or so project files (character sheets, the
project brief, a style note) to nearly every Workshop conversation. Each
time, that is the same walk through "Choose from project". He wants to name
those files once, in Conversation settings, and have every new conversation
start with them.

The code shapes the answer in eight places:

1. **An ordinary New session already carries context.** Only the full reset
   empties it. The sessions menu offers **New session** and **New session:
   full reset** ("also clears the excerpt and context";
   `core/presentation/webview/components/workshop/WorkshopSessionsMenu.tsx:82-98`).
   `WorkshopResetSessionPayload.clearWorkingSet`
   (`core/shared/types/messages/workshop/session.ts:631`) says why: the
   ordinary boundary keeps the working set so the writer can keep working
   the same passage in a fresh room. `WorkshopSessionService.reset` clears
   attachments only when asked to (`WorkshopSessionService.ts:1897-1904`).
   So the pain shows up in three places: a full reset, the first room in a
   project, and any room where the writer removed a file and wants it back.
   Pinned context has to be defined against all three, not only "new".
2. **Context is an ordered list of attachments in the room.** Each file
   attachment holds a snapshot of the file's text, a word count, an optional
   truncation and its source (`sourceUri`, `relativePath`, and
   `configuredResource` when it came from the catalog)
   (`core/shared/types/messages/workshop/context.ts:61-100`). The aggregate
   owns two guards. Duplicates are matched on `sourceUri` or the catalog key,
   and all attachments share one budget
   (`WorkshopSessionService.ts:522-552`).
3. **The budget is words:** `CONTEXT_ATTACHMENTS = { words: 100_000,
   characters: 840_000, fileBytes: 5 MiB }`
   (`core/shared/constants/promptBudgets.ts:453`). An attach that would pass
   it is refused, never truncated to fit (`WorkshopContextHandler.ts:853-874`).
4. **Context reaches personas through the user turn, never the system
   prompt.** `WorkshopContextDelivery.prepare`
   (`core/application/services/workshop/WorkshopContextDelivery.ts:27-43`)
   sends a full `replace` the first time and deltas after that, through the
   room's pending host updates
   ([ADR 2026-10-03](2026-10-03-workshop-context-delta-delivery.md)). Project Memory's lesson (its ADR, fact 1)
   is that every Conversation settings change rebuilds the system prompt, so
   anything placed there would break the prompt cache. Attachments already
   avoid that.
5. **A change before the first message is silent.** `recordContextChange`
   mints its "Added context: …" divider only once the room has a host
   conversation (`WorkshopSessionService.ts:1077-1084`). Files attached to a
   fresh room show as pills and leave no turns in the thread.
6. **An attachment's origin is a closed, persisted enum,** `'writer' |
   'wizard'` (`context.ts:66`), and the session shape checks it exactly
   (`WorkshopSessionStateV1Shape.ts:318`). A new `'pinned'` value would be a
   session-format change, and older builds would refuse those sessions.
7. **Settings write only the global level.** `SettingsStore.update` has no
   target (`core/platform/SettingsStore.ts:21`), and `VsCodeSettingsStore`
   writes `ConfigurationTarget.Global`
   (`apps/vscode-extension/src/platform/vscode/VsCodeSettingsStore.ts:26`).
   No setting is workspace-scoped today (Project Memory ADR, fact 7). A list
   of project-relative paths stored globally would follow the writer into
   every other project.
8. **The two owners a seed must go through are already large.**
   `WorkshopSessionPersistenceCoordinator.ts` is 1,797 lines and
   `WorkshopSessionService.ts` is 2,555. Every room replacement (New, full
   reset, Open, Rewind, Branch) goes through the coordinator's
   `replaceLiveRoom` transaction. `resetSession` captures the first
   checkpoint inside it (`WorkshopSessionPersistenceCoordinator.ts:885-921`).
   A room with no checkpoint starts in `initializeOnce`'s no-current branch
   (`:435-437`). Pinned context must arrive as a new collaborator behind a
   narrow port, not as more lines in either file.

Two more facts come from work that is not on `main` yet:

- **The settings dialog is split per tab** on `epic/workshop-project-memory`
  (Slice 4a, PR #193). There, `WORKSHOP_CONVERSATION_SETTINGS_TABS` drives
  the strip and its keys, and each panel is an entry in an exhaustive record.
  On `main` the dialog is still one 587-line component.
- **The approved Memory design** (PR #196, decisions 15 and 16) adds a
  "Memory isn't context" well that defines context as what is *attached to*
  a conversation. It also renames memory's "pin" in the UI to "Always load
  in full", so that the word "pin" is free for this feature.

## Decision

### D1. What pinned context is

Pinned context is **an ordered list of this project's files that every new
Workshop room starts with, as ordinary context attachments.**

- **Per project.** The list belongs to the open folder and lives in it (D5).
- **Files only.** No text notes and no excerpt. About you already covers
  standing writer text, and the excerpt is a passage, not a resource.
- **Workshop only.** The Lightbox's context shelf is out of scope.
- **The name is "Pinned context".** It follows the Memory design's decision
  16, which keeps the word "pin" for this feature. In Conversation settings,
  "pinned" means one thing: attached automatically to every new
  conversation.
- **"Pin" is already used elsewhere in the Workshop, and this feature
  doesn't change that.** The excerpt's controls read "Re-pin *chapter* v2"
  and "Continue with current excerpt", both with the `pin` glyph
  (`ExcerptPanel.tsx:182`, `:209`; `WorkshopPathChooser.tsx:99`). The
  same glyph marks a Lightbox tile among a message's attachments
  (`WorkshopComposer.tsx:227`, `WorkshopTurnBubble.tsx:486`).
  - Those are different nouns from "pinned context". Context pills
    (`ContextPanel.tsx`) use `doc`, `pen` and `sparkle` today, so a pin mark
    there is new to that surface.
  - Slice 0d draws the mark as a small accent `pin` after the word count.
    Okey decides whether that reads clearly beside the other uses, or
    whether the mark takes another glyph.

### D2. When it applies: room starts, and only room starts

| Room event | Pinned context |
|---|---|
| **First room** in a project (no `current.json`) | Attached in pinned order |
| **New session: full reset** | The working set is cleared, then pinned files are attached in pinned order |
| **New session** | The carried working set stays. Pinned files already carried are re-read in place (D3). Any that are missing are appended in pinned order |
| Open, Duplicate, Branch, Rewind, reload of `current.json` | **Never.** These are existing rooms |
| A run in progress | New is already refused while running (`WorkshopSessionMessageHandler.ts:121`) |
| No folder open, or several | Never. The tab says why (D8) |

- **Changing the list never touches the open room.** Pinning or unpinning
  saves the list (D5) and nothing else. To bring a newly pinned file into
  the current room, the writer uses the tab's **Attach missing to this
  conversation**. That goes through the ordinary attach path, so the room's
  "Added context: …" divider and delta delivery work as they do today.
- **No update note.** Project Memory's D14 appends a note because memory has
  no other way into an open conversation. Context already has a visible,
  delivered change path, and it is the writer's own action.
- **Removing a pinned file from one room is allowed** and lasts for that
  room. The next New session brings it back. The pill's tooltip says so
  (D7).

### D3. Pinned files are ordinary attachments, read through the existing doors

- **Same reader.** A pinned path in the catalog is read through
  `WorkshopContextIntakeCatalog.load` and keeps its `configuredResource`
  (`WorkshopContextHandler.ts:536-577`). A pinned path outside the catalog
  but inside the folder is read through the intake service's contained
  workspace read, with the same refusals as a refresh
  (`WorkshopContextIntakeService.ts:384`). There is no new file reader, and
  no read outside the folder.
- **Same bounds.** Each file uses `fileBytes` and the per-attachment head
  slice, exactly as Choose from project does. Truncation shows the way it
  does on any pill.
- **Same guards.** Every pinned file goes through
  `WorkshopSessionService.addContextAttachment`, so duplicates and the shared
  budget stay the aggregate's rules. A pinned file that is already carried
  is re-read and replaced in its slot, through the same aggregate operation
  that refresh uses (`refreshContextFileAttachments`). It never becomes a
  second attachment.
- **A new room reads every pinned file as it is now.** That is the promise
  the writer can rely on. Carried attachments that aren't pinned stay as
  they are, which is today's behavior.
- **Same delivery.** The room's first delivery sends attachments as a
  `replace` (fact 4). There is no new prompt frame. Personas are not told
  which files are pinned, and nothing in the system prompt changes.

### D4. "Pinned" is derived, never stored in a session

An attachment counts as pinned when it matches an entry in the current list,
by one shared pure rule, `workshopPinnedContextMatches(entry, attachment)`
(in `core/shared/constants/workshopPinnedContext.ts`, beside the Lightbox's
pure cross-side helpers such as `lightboxPlot.ts`). The rule matches when
the catalog key's path equals the entry's path. Otherwise it matches when
`relativePath` does, compared after normalization.

- No `origin: 'pinned'`, so no session-format change (fact 6). Sessions saved
  by this build open in older builds, and the reverse also holds.
- Unpinning a file in settings clears its mark on every open room's pill at
  once. A stored mark would go stale.
- The webview and the host both call the same rule. The webview uses it for
  the pill's mark and the "N missing" count, and the host uses it for the
  top-up.

### D5. Storage: `<workspace>/prose-minion/pinned-context.json`, format 1

```json
{
  "format": 1,
  "files": [
    { "path": "Project/brief.md" },
    { "path": "Characters/alice.md" },
    { "path": "Characters/the-hatter.md" }
  ]
}
```

- **Where.** The file sits beside `prose-minion/sessions/`
  (`WorkshopSessionStore.ts:199`). It is one file, because the list is one
  ordered value.
- **Why not a VS Code setting.** Settings write globally (fact 7). A
  workspace target would need a `SettingsStore` port change. It would also
  have no precedent, and "workspace or folder level?" has no clear answer
  in a multi-root window. A project file travels with the project, and with
  its git history if the writer keeps one. It also matches Project Memory's
  split: global switches go in settings, and per-project data goes under
  `prose-minion/`.
- **Why not workspace state** (a memento). It is invisible, can't be edited,
  and doesn't travel with the project.
- **The codec is strict and pure** (`WorkshopPinnedContextCodec`, beside the
  store). This is writer data, so ADR 2026-07-30's release rule applies, with
  a `board-v1.json`-style fixture.
  - Keys are exact. `format` must be `1`.
  - A `path` is workspace-relative and `/`-separated, with no `..`, no
    absolute path and no drive letter. It is normalized, and each path
    appears once (compared case-folded on Windows).
  - There are at most `files` entries (D6).
  - A file that breaks any rule is **unreadable as a whole**. The tab shows
    the reason and offers **Open file**. The store never rewrites it, and
    seeding attaches nothing from it.
- **The group isn't stored.** A catalog group is derived from the context
  paths settings at read time, so changing those settings can't strand an
  entry. A path that has left the catalog is still pinned, and reads as a
  workspace file (D3).
- **One store, one library, built only in `extension.ts`.**
  `WorkshopPinnedContextStore` lives in `infrastructure/storage/`, and
  `WorkshopPinnedContextLibrary` in
  `application/services/workshop/pinnedContext/`. No handler constructs
  either, and `boundaries.test.ts` pins both.
- **Writes follow the board store's discipline,** through Project Memory's
  shared primitive:
  - one queue per store;
  - the first write is staged under a private random name, then renamed in
    place, never overwriting. A file that appears meanwhile is read, and the
    change is applied to it;
  - every later write is a claimed rewrite in place (`StoredFileRewrite`):
    read whole, staged privately, the file claimed by an atomic rename that
    never overwrites, then committed;
  - claims follow `StoredFileClaims`' lease rules;
  - a file it can't read is never written.
- **Every mutation names the revision the tab read** (a hash of the file's
  bytes). If the file changed in between, the write is refused, nothing is
  written, and the answer carries the current list with "Pinned context
  changed in another window. This is the current list."
- **Availability is read live on every operation,** as the board store's
  `location()` does (`LightboxBoardStore.ts:419-428`). One folder means
  available. None, or several, means unavailable, with that reason. There is
  no session-only list.
- **Logs carry counts and categories, never paths, names or text.** This
  follows Project Memory's PR #194 F-04.

### D6. Bounds and the budget

- **Pinned files share the context budget.** They are attachments, so they
  count against `CONTEXT_ATTACHMENTS.words` (100,000) alongside everything
  else in the room. There is no separate pinned budget.
- **Pinning is refused past the budget.** "Can't pin this one: pinned
  context would come to about 104,000 of 100,000 words. Unpin another file,
  or shorten this one." Words come from reading the file at pin time, with
  the same bounds as an attach.
- **Pinning is refused past `files`.** The bound lives in
  `PROMPT_BUDGETS.workshopPinnedContext = { files: 20 }`. That is a starting
  value, twice Okey's current set, and the live pass tunes it. It also caps
  the reads a New session makes (20 × 5 MiB at worst).
- **Over budget anyway** (a file grew, a hand edit, or the carried working
  set is large): seeding goes in pinned order and attaches **each file that
  fits in what remains**. A large file that doesn't fit doesn't block the
  smaller files after it. Every file left out is named in the report (D7).
  **Nothing is ever unpinned for the writer.**
- **Missing or unreadable pinned files never fail a room.** They are left
  out, named in the report, and shown in the tab as "Not found" or "Can't
  read".

### D7. What the writer sees

- **The New result says what happened.** It extends `postActionResult('new',
  …)` (`WorkshopSessionMessageHandler.ts:138-144`):
  - "Started a new Workshop session with your pinned context: 10 files,
    about 23,400 words."
  - "Started a new Workshop session. 9 of 10 pinned files attached; not
    attached: *alice-old.md* (not found)."
  - "… *manuscript.md* (doesn't fit in the 100,000-word context budget)."
- **No thread turns at room start** (fact 5). The pills are the record.
- **The full reset's subtitle** becomes "clears the excerpt and context, then
  attaches pinned context" while the list holds anything. Its tooltip
  changes to match. With an empty list, today's copy stays.
- **A pinned pill gets a pin mark** (Slice 4), derived per D4. Its tooltip
  reads "Pinned: attached to every new session. Removing it here removes it
  from this conversation only." The pill's own Remove is unchanged.

### D8. The Pinned context tab

The tab joins Conversation settings, through Slice 4a's ordered tab list.
**Slice 0d's design owns the layout, the copy and the states.** This ADR
fixes what the tab does:

- **Position (proposed):** Behavior · About you · **Pinned context** ·
  Memory · Advanced. About you is "what you explicitly share", and pinned
  context is what you share with every conversation, so they sit together.
  The "Memory isn't context" well then points straight to the tab beside it.
- **Header copy gains it:** "… what you explicitly share and attach to every
  new conversation, what they remember about this project, …".
- **Changes save right away,** like the memory manager's actions, not on
  Apply. The list is project data in a file, not a draft setting. The footer
  says so: "Pinned context saves as you change it and applies to new
  conversations."
- **What it shows:**
  - a meter: "10 files · about 23,400 of 100,000 words";
  - one row per entry, in order: name, path in mono, the catalog group as a
    chip when there is one, words, the state ("Not found", "Can't read: …",
    or "Attached as its first N of M words"), and "In this conversation"
    when D4 matches;
  - the row's actions: Move up, Move down, Open file, **Unpin**.
- **What it can do:**
  - **Add from project…** opens the shared `ProjectResourcePickerModal` over
    the settings dialog, with a pin footer ("Pin 3 files"). The webview names
    the files by catalog key only;
  - **Pin what's attached now (N)** pins this room's file attachments that
    aren't pinned, by attachment id (`ctx-N`). This is the one-click way to
    move Okey's current ten files across;
  - **Attach missing to this conversation (N)** goes through the ordinary
    attach path, behind the session-mutation gate;
  - **Open pinned-context.json** opens the file in the editor.
- **States:** empty; listed; over budget (the meter turns amber and full,
  and a line names what won't attach); missing or unreadable entries; the
  file itself unreadable (an amber notice with its reason, every action but
  Open file disabled); and unavailable, with no folder or with several (an
  amber notice, as on the Memory tab, and every action disabled).
- **The webview never introduces a path.**
  - Adds go by catalog key, checked against a fresh catalog, or by
    attachment id, checked against the live room. The host refuses any
    source outside the folder: "Only files inside this project can be
    pinned."
  - Unpin, move and open name an entry by its stored path. The host uses it
    only as a key into the list it just read. It is never a path to read
    from the message.
  - Requests carry a webview-minted `requestId`, which the host echoes, as
    the Lightbox's catalog routes do. The hook takes only the answer it is
    still waiting for.

### D9. Composition

- **`CoreServices`** gains the store and the library, built in
  `extension.ts`.
- **A room seed port** joins the coordinator:

  ```ts
  interface WorkshopRoomSeed {
    /** Read the pinned files. Async, outside the room transaction. */
    prepare(kind: 'first' | 'new' | 'full-reset'): Promise<WorkshopRoomSeedPlan>;
    /** Install into the fresh room. Synchronous; returns the report. */
    install(plan: WorkshopRoomSeedPlan, room: WorkshopRoomSeedTarget): WorkshopRoomSeedReport;
  }
  ```

  - `resetSession` calls `prepare` before `replaceLiveRoom`, and `install`
    inside it, after `session.reset` and before `recordStartMarker` and
    `capture`. The first checkpoint therefore holds the pinned files, and a
    failed reset discards the plan with the room it was meant for.
  - `initializeOnce`'s no-current branch does the same.
  - `WorkshopRoomSeedTarget` is the narrow slice of the session service that
    seeding needs: list attachments, add, and replace in a slot. The
    coordinator imports only the port's type.
- **`WorkshopPinnedContextHandler`** is the Workshop's thirteenth route
  owner, composed in `WorkshopSliceComposition`. Its routes are request,
  pin by catalog keys, pin by attachment ids, unpin, move, attach missing
  (through `registerMutation`), and open file.
- **Messages** live in `core/shared/types/messages/workshop/pinnedContext.ts`
  and are exported through the Workshop barrel.
- **`useWorkshopPinnedContext`** follows the tripartite interface. Its
  persistence is empty, because the host owns the truth.
- **The tab** is `settings/WorkshopPinnedContextSettingsPanel.tsx`. It is
  presentational: it takes state and callbacks, and posts nothing itself.

## Consequences

- **The pain goes away in all three places** (fact 1): the first room in a
  project, a full reset, and a file removed from one room.
- **No session-format change, no prompt change, no settings port change.**
  The feature adds one small project file, a host-side seed, and a tab.
- **A New session does more I/O.** It reads up to 20 files before the room
  replaces. That is bounded, and a slow disk shows as a slower New. The live
  pass measures it.
- **The full reset no longer means "empty"** while the list holds anything.
  Its copy says so. A truly empty room means unpinning, or removing pills
  after the reset. A third menu item ("start without pinned context") is
  left out of v1 on purpose (open question 5).
- **Builds on Project Memory's shared code.** The store uses
  `StoredFileClaims` / `StoredFileRewrite`, and the tab sits in 4a's panel
  list. Neither is on `main` yet. See the epic's order.

## Out of scope

- The Lightbox's context shelf.
- Pinned text notes, a pinned excerpt, and pinned Lightbox tiles.
- A global pinned list across projects.
- Watching `pinned-context.json` for changes. It is read when the tab opens,
  before every mutation, and at every seed.
- Refreshing pinned attachments in an open room on their own. The existing
  refresh is the writer's action.
- Telling personas which files are pinned.

## Open questions

Recommendations are first in each list. Okey decides.

1. **Tab position.** After About you (recommended), or after Memory.
2. **Does an ordinary New session top up?** Yes: it re-reads carried pinned
   files and appends missing ones (recommended). The alternative is to seed
   only first rooms and full resets.
3. **Over budget.** Attach each file that fits, in order (recommended), or
   stop at the first that doesn't fit.
4. **The bound.** 20 files (recommended), or another number.
5. **A third New item,** "start without pinned context". Not in v1
   (recommended), or yes.
6. **Pin from a pill.** Add Pin and Unpin to a context pill's menu in
   Slice 4 (recommended), or keep the tab as the only place to change the
   list.
