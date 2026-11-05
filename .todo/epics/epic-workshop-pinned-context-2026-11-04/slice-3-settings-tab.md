# Slice 3: Settings Tab

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D6 (refusals), D8 (the tab), D9 (composition)
**Design:** `docs/design/workshop-pinned-context/` (Slice 0d). **The design owns the layout, copy and states;** this doc owns the wiring.
**Branch:** `epic-pinned-context-slice-3-settings-tab`
**Status:** Waits on Slice 2b (the library). The design was approved on
2026-11-05, and Slice 4a's per-tab panels are in the epic since the merge at
`17d52cf`.

## Outcome

Conversation settings gets a **Pinned context** tab. The writer adds files
from the project, pins what's attached now, attaches missing pinned files to
the current room, reorders, unpins and opens the list file. Every change
saves at once.

## Build

### Messages (`core/shared/types/messages/workshop/pinnedContext.ts`)

Each is exported through the Workshop barrel and has a `MessageType`. Every
request carries a webview-minted `requestId` that the answer echoes:

| Message | Payload |
|---|---|
| `WORKSHOP_REQUEST_PINNED_CONTEXT` | `{ requestId }` |
| `WORKSHOP_PINNED_CONTEXT` (answer or push) | `{ requestId: string \| null, availability, file: 'absent' \| 'ok' \| { unreadable: reason }, revision, entries, totals: { words, budgetWords, files, maxFiles }, notice? }` |
| `WORKSHOP_PIN_CONTEXT_RESOURCES` | `{ requestId, revision, items: ConfiguredResourceRef[] }` |
| `WORKSHOP_PIN_CONTEXT_ATTACHMENTS` | `{ requestId, revision, attachmentIds: string[] }` |
| `WORKSHOP_UNPIN_CONTEXT` | `{ requestId, revision, entryPath }` |
| `WORKSHOP_MOVE_PINNED_CONTEXT` | `{ requestId, revision, entryPath, direction: 'up' \| 'down' }` |
| `WORKSHOP_ATTACH_PINNED_CONTEXT` | `{ requestId }` |
| `WORKSHOP_OPEN_PINNED_CONTEXT_FILE` | `{ entryPath?: string }`: an entry, or the list file when absent |

An entry is `{ path, label, group?, words?, state, truncation? }`. Its
`path` is the stored, display-safe workspace-relative path. The host takes
it back only as a key into the list it just read (ADR D8).

### Handler (`handlers/domain/workshop/WorkshopPinnedContextHandler.ts`)

- It is the Workshop's thirteenth route owner, composed in
  `WorkshopSliceComposition`, and it joins the route-owner lists and tests.
  It takes the library, the session (to resolve `ctx-N` ids and for attach
  missing), `ShellService` (to open files), `MessageTransport` and `LogSink`.
- **Pin by catalog key:** each key is checked against a fresh catalog, read
  for its words, then checked against the bounds (ADR D6) before the store's
  `update`. A refusal names the file and the bound, and nothing is written.
- **Pin by attachment id:** each id is resolved in the live room. Its
  `configuredResource`, or a `relativePath` inside the folder, becomes the
  entry. Anything else is refused with "Only files inside this project can
  be pinned." Words come from a fresh read, not the room's snapshot.
- **Unpin and move** by `entryPath`, against the list as read.
- **Attach missing** goes through `registerMutation`, so it is refused while
  a run is going. It reads each missing pinned file through the intake
  service and attaches it through the ordinary path, so its "Added context"
  divider and delta delivery are today's.
- **Open** resolves the stored path, checks it is contained, and opens it
  through `ShellService`. It never opens a path taken from the message.
- After every mutation, and on a `changed` refusal, the handler answers with
  the current list.

### Hook (`hooks/domain/workshop/useWorkshopPinnedContext.ts`)

- Tripartite. Its state is the last answer. Its actions are request, pin by
  keys, pin attachments, unpin, move, attach missing, open, and toggle the
  template well. Its persistence is one UI preference,
  `{ pinnedContextNoteOpen: boolean }`, starting `true`. It never holds the
  list, a path or a word count.
- It takes only the answer for the request it is waiting on. A push
  (`requestId: null`) replaces state only when no request is pending.
- It derives "in this conversation" and the missing count from the session
  snapshot's attachments with `workshopPinnedContextMatches`, so the tab
  updates when the room changes, with nothing posted.
- It requests the list when the Workshop mounts, not only when the tab
  opens. `WorkshopApp` passes its entry count to `WorkshopSessionsMenu`'s
  `pinnedFileCount`, replacing Slice 2a's `0` and its comment.
- **The full reset's confirmation** (`workshopSessionConfirmCopy.ts`) still
  says it "starts an empty room". Once the count is real and above 0, it
  says the room starts with the pinned files. Slice 2a added the
  empty-context start's own confirmation (`new-empty`), which stays as it
  is. A test at each count.
- **Every write passes 2b's live-room check** as the store's `beforeCommit`.

### Panel (`components/workshop/settings/WorkshopPinnedContextSettingsPanel.tsx`)

- Presentational: it takes the hook's state and callbacks.
- **Joins Slice 4a's list:** `pinned-context` in the tab union, one entry in
  `WORKSHOP_CONVERSATION_SETTINGS_TABS` (between `profile` and `memory`, per
  question 1), and one record entry. Update the four-tab key-navigation test
  to the five-tab order.
- **Add from project…** composes `ProjectResourcePickerModal` with a pin
  footer (`ProjectResourceAttachFooter`'s estimate against the words left
  under the budget, with the label "Pin N files"). The shared picker's
  Workshop markup stays identical: `WorkshopContextSelectorParity` and
  `WorkshopApp.contextSelectorParity` run unchanged.
- Header and footer copy as approved in 0d.

## Tests

- **Handler,** through the real library and store on a temporary folder:
  - pin by key and by id;
  - refusals: over words, over files, outside the folder, a stale revision,
    an unreadable file, unavailable;
  - unpin, move, attach missing (and its refusal while running), open
    (contained only).
- **Forged input:** an `entryPath` not in the list, a catalog key not in the
  catalog, and a `ctx-N` not in the room are each refused without a read.
- **Hook:** request correlation ignores a stale answer, and the derived
  "in this conversation" follows the snapshot.
- **Panel:**
  - every 0d state renders, and the tab strip's arrow keys and Home/End
    cover five tabs;
  - the template well toggles, with `aria-expanded` and `aria-controls`
    true to its state, and its preference survives a reload of the webview
    state;
  - the list well's height stays the same from 6 rows to 20;
  - a row moved past the fold is scrolled into view, with focus kept on its
    Move button.
- **Parity:** the shared picker's Workshop tests run unchanged.
- **Settings round trip:** not applicable. This is not a VS Code setting;
  say so in the PR.

## Completion criteria

- [x] The tab matches the approved design in every state.
- [x] The webview never introduces a path; every add goes by catalog key or
      attachment id.
- [x] Every mutation goes through the store's revision check.
- [x] The dialog shell and the new files stay under 500 lines.
- [x] The epic's verification passes, with counts recorded here.

## Built

**Commits** (on `51b4988b`).

- `cd35a0ca`: the host side. Messages, `WorkshopPinnedContextHandler`, the
  library's writes, the ports a handler may name, `CoreServices`, the
  route ledger and guards, and the handler's tests.
- The webview side: `useWorkshopPinnedContext`, the tab's view, the panel,
  the picker in pin mode, the fifth tab, the menu's real count, the full
  reset's confirmation, styles, and their tests.
- This doc.
- `fa5b7997`: merge of Slice 2b's branch at `b0429082` (no conflicts).
- The coordinator's three follow-ups: `0b4e6bd7` (`\` only on Windows in pin
  by id), the host-picker route for Explore project folders…, and an
  end-to-end test of the menu's count.
- A follow-up: pin by id converts `\` only on Windows, with a test per
  platform (25 handler tests).

**Where each piece lives.**

| Piece | Where |
|---|---|
| Messages (8 `MessageType`s, through the Workshop barrel) | `shared/types/messages/workshop/pinnedContext.ts` |
| The route owner (the thirteenth), composed in `WorkshopSliceComposition` | `handlers/domain/workshop/WorkshopPinnedContextHandler.ts` (422 lines) |
| The library's writes: pin by key, pin by path, unpin, move, Open's target | `pinnedContext/WorkshopPinnedContextWrites.ts` (325); the library delegates (`WorkshopPinnedContextLibrary.ts`, 272) |
| The shapes a handler may name; `CoreServices.workshopPinnedContext` | `pinnedContext/WorkshopPinnedContextPorts.ts` (101) |
| The tab's host words (refusals, `busy`, `io`) | `pinnedContext/WorkshopPinnedContextWords.ts` (`WORKSHOP_PINNED_WORDS`) |
| Wiring | `extension.ts` (`{ library, takeFirstRoomReport }`), `MessageHandler`, `WorkshopRoomHandler` (one parameter), `WorkshopRouteContracts` |
| The hook (tripartite; persists `pinnedContextNoteOpen` only) | `hooks/domain/workshop/useWorkshopPinnedContext.ts` |
| The tab in words, pure (every 0d state) | `hooks/domain/workshop/pinnedContext/workshopPinnedContextTabView.ts` |
| The panel, presentational | `components/workshop/settings/WorkshopPinnedContextSettingsPanel.tsx` |
| The picker in pin mode | `components/workshop/settings/WorkshopPinnedContextPicker.tsx` |
| The fifth tab | `workshopConversationSettingsTabs.ts` (`pinned-context`, between `profile` and `memory`); the modal's record entry, header and footer copy |
| The menu's count and the full reset's confirmation | `WorkshopApp.tsx`; `workshopSessionConfirmCopy.ts` (`pinnedFileCount`) |
| Styles | `styles/workshop/pinnedContext.css` (reuses the Memory tab's well, notice, chips and meter) |

**How it works.**

- **Every write passes 2b's live-room check.** Each library write calls
  `askLiveRoom()` synchronously, before anything awaits, and hands its
  `still` to `store.update` as `beforeCommit`. It reads the list first: a
  revision other than the tab's answers `changed` without a write, and the
  store checks the revision again at its turn.
- **Pin by catalog key:** a fresh catalog; each key must name an entry in
  it (group and path), whose absolute path must be inside the folder. The
  stored path is its path relative to the folder.
- **Pin by attachment id:** the handler resolves each `ctx-N` in the live
  room. A file's `configuredResource.path`, or else its `relativePath`,
  becomes the entry; anything else is refused before any read. A `\` is
  read as a separator only on Windows; on POSIX it stays a filename
  character, which the path rule refuses in its own words (the coordinator's call, after
  #208 F02). The library
  checks the path rule and reads the file through the intake doors. A
  `refused` read (outside the folder, or through a link) says "Only files
  inside this project can be pinned."
- **Bounds:** at most 20 files, and the words of every pinned file read now
  (existing and new) within the context budget, before the write.
- **Unpin, move, open** name an entry by its stored path. The library uses
  it only as a key (Slice 1's path key) into the list it has just read.
  Open joins the stored path to the folder and checks it is contained.
- **Attach missing** goes through `registerMutation`, and is refused while
  a reply or the Context wizard runs (checked before and after the read).
  It reads with `readForSeed()`, skips files the room holds (the match
  rule), and attaches the rest through `addContextAttachment`, posting each
  divider turn. A file that doesn't fit is left out, and the next is tried.
- **The first room's report:** the first `WORKSHOP_REQUEST_PINNED_CONTEXT`
  waits for the coordinator's `initialize()`, then posts
  `workshopSessionStartResult('carry', takeFirstRoomReport())` with
  `sendStatus`, once.
- **The host's platform** rides on every answer (`platform`), and the hook's
  view reads the match rule with it.
- **The hook** asks for the list when the Workshop mounts, and again each
  time the tab shows. It takes only the answer to the request waiting,
  takes a push only while none waits, and derives "In this conversation",
  the missing count and the pinnable attachments from the snapshot.

**Tests.**

- `WorkshopPinnedContextHandler.test.ts` (29), through the real library,
  store and intake on a memory folder, with a real session aggregate:
  - the list, absent and unavailable, unreadable;
  - the first room's report, once;
  - pin by key and by id;
  - refusals: a text note, outside the folder, over words, over files, an
    unreadable file, several folders, a stale revision, and the live room
    moving before the commit;
  - Explore project folders…: inside (the picker opens in the project
    folder), outside (nothing read), dismissed (no answer), a stale
    revision;
  - `\` in an attachment's path, one test per platform;
  - forged input: a catalog key not in the catalog, a `ctx-N` not in the
    room or malformed (no file read), and an `entryPath` not in the list
    (no unpin, no move, nothing opened);
  - unpin, move (and at an end), open (contained), open before the file
    exists;
  - attach missing: order and catalog key, over budget, refused while
    running and while a session operation is pending, nothing missing.
- `useWorkshopPinnedContext.test.ts` (6): the host-picker pick doesn't hold
  the tab, and its answer is taken; the mount request and the menu's
  count; a stale answer and a push while waiting are ignored; every change
  names the revision; "In this conversation" follows the snapshot with
  nothing posted; the preference persists and is restored.
- `WorkshopPinnedContextSettingsPanel.test.tsx` (21):
  - every 0d state: Listed, Empty, Problems, Over budget, Head-sliced,
    Changed, Running, Unreadable, both Unavailable, and `busy` and `io`;
  - the template well's toggle, `aria-expanded` and `aria-controls`, under
    any notice;
  - the list well (capped at 340px, scrolling) at 6 and 20 rows;
  - a moved row scrolled into view with the focus on its Move button;
  - the picker: pinned rows disabled and marked "Pinned", no Explore, the
    estimate, a refusal above its footer, closed when the pin lands.
- `WorkshopApp.pinnedContext.test.tsx` (1), through the real app: an answer
  with entries shows "New session: full reset, empty context" and the new
  full-reset subtitle, and the confirmation names the pinned files; an empty
  list brings back today's menu.
- `workshopSessionConfirmCopy.test.ts`: the full reset at 0, 1 and 10
  pinned files; the empty-context confirmation unchanged at every count.
- Updated, deliberately: the tab list's tests (five tabs, the arrows, Home
  and End through `pinned-context`), the modal's key-navigation test, the
  Memory tab's order assertions and its footer line, the app router test,
  the route ledger (81 routes, 46 mutation, 35 direct), the room handler's
  route count, and `workshopStyles.test.ts`'s cascade list.
- `boundaries.test.ts`: the panel and the picker post nothing; one
  construction of the handler, in `WorkshopSliceComposition`; `CoreServices`
  names pinned context through its ports, type only.

## Verification

| Check | Before (`51b4988b`, after `npm ci`) | After |
|---|---|---|
| `npm run typecheck` | pass | pass |
| `npx jest -w 2` | 702 suites / 9,902 tests / 59 snapshots, all passing | 705 suites / 9,966 tests / 59 snapshots, all passing |
| `npm run lint` | 0 errors / 1,165 warnings | 0 errors / 1,165 warnings (none new) |
| `from 'vscode'` in `packages/core/src` | none | none |
| New files over 500 lines | — | none (largest: the handler test, 433) |
| Files already over 500 | — | wiring only: `WorkshopApp.tsx` +6, `WorkshopRoomHandler.ts` +3, `MessageHandler.ts` +2 |
| The settings modal | 273 lines | 281 lines |
| Picker parity (`WorkshopContextSelectorParity`, `WorkshopApp.contextSelectorParity`) and the session browser tests | pass | pass, unchanged (no diff) |
| Fixtures and tests | — | *Alice*-style made-up paths and text only |
| Logs | — | actions, counts and categories; the handler test checks for no path or name |

The baseline was measured in a clean worktree at `51b4988b`; Slice 2b's
counts (702 / 9,902 / 59; 0 / 1,165) hold. "After" is measured at `fa5b7997`,
after merging Slice 2b's branch at `b0429082` (its kept fix `54e7db78` and
Slice 1's #204 re-review fixes), as the coordinator asked. That merge brings
11 of the new tests (2b measured 9,913); the rest of the 64 are this slice's.

## Deviations

1. **`CoreServices.workshopPinnedContext` is a bundle,**
   `{ library, takeFirstRoomReport }`, typed by
   `WorkshopPinnedContextServices` in the new `WorkshopPinnedContextPorts.ts`.
   Slice 2b's guard forbids a handler importing the library or the seed, so
   the handler needed shapes it could name. The description, seed-read and
   ask shapes moved there from the library, which re-exports them. 2b's
   guard now pins `CoreServices`' one type-only import to the ports module.
2. **The answer is close to the spec's table, with additions:**
   - `platform`;
   - `file` carries the host's words: `{ state: 'unreadable' | 'busy' | 'io',
     words }`;
   - `availability` carries its reason and words;
   - `revision` is `null` when there is no list to change;
   - `action` and `ok` say what the answer settles;
   - `notice` is `changed`, `refused` with the host's words, or `done`
     (Attach missing's result).

   `WORKSHOP_OPEN_PINNED_CONTEXT_FILE` carries a `requestId` too, so its
   refusal can be answered.
3. **Describe's `listed` gains `absent`,** so the tab can tell "no file yet"
   (Open file disabled, "The file is made…") from an empty list on disk.
4. **"Explore project folders…" pins through a ninth message,**
   `WORKSHOP_PIN_CONTEXT_PICK_FILE` (`{ requestId, revision }`), which the
   spec's table didn't list (the coordinator's call, restoring 0d's design).
   - The host opens its own picker in the project folder; `ShellService.pickFile`
     gains an optional `defaultPath`.
   - The library captures the live room before the pick is awaited and
     refuses a file outside that room's folder ("Only files inside this
     project can be pinned."). It turns the file into the entry path (`\` a
     separator only on Windows) and pins it with the same bounds, revision
     and `beforeCommit`.
   - A dismissed picker answers nothing, so the hook keeps the pick off the
     tab's pending state and takes its answer when one comes.
   - The webview never sends a path.

   The shared picker gains one opt-in, `attachedLabel` ("Pinned"), and
   `onExplore` became optional. With the defaults, the Workshop's and the
   Lightbox's markup is unchanged.
5. **The picker stays open until the host answers**, so a refusal shows in
   it, above its footer, as 0d's PickerRefused board draws. Its own footer
   (`PinFooter`) reads the shared estimate
   (`estimateProjectResourceWords`, newly exported) rather than wrapping
   `ProjectResourceAttachFooter`, whose button closes the picker at once.
6. **Jest maps `styles/workshop/pinnedContext.css` to a stub**
   (`jest.config.js`, `__tests__/mocks/styleStub.ts`). The app's tests mock
   each stylesheet by path; the mapping keeps the parity tests and every
   other app test unchanged.
7. **Two architecture docs list the new message module**
   (`.ai/central-agent-setup.md`, `docs/ARCHITECTURE.md`), because
   `boundaries.test.ts` checks their trees. `AGENTS.md` and the epic README
   are untouched.
8. **Route tests that don't exercise pinned context** pass
   `emptyPinnedContextServices()` (a test helper) to `WorkshopRoomHandler`.

**Copy added to the approved design** (in its voice):

- the list `busy` or `io`: Slice 2b's words as the notice ("Pinned context
  is being changed in another window. Try again in a moment." / "pinned-
  context.json couldn't be read. Try again, or check the project folder."),
  with the summary "The list couldn't be shown just now" and "Nothing was
  changed. Close Conversation settings and open it again in a moment.";
- before the first answer: "Reading pinned context…" and "The list is read
  from this project as the tab opens.";
- refusals 0d doesn't draw: "That file isn't in your project's context
  folders any more. Nothing was pinned.", "That file isn't pinned any more.
  This is the current list.", "Can't pin *x*: it isn't there.", "Can't pin
  *x*: " + 0d's "Can't read" reason, "Wait for the room to finish loading,
  then try again.", "The workspace changed, so pinned context wasn't
  changed.", and "There's no pinned-context.json yet. The file is made when
  you pin the first file.";
- a file inside the project whose name holds a backslash (POSIX): "Can't
  pin *alice\notes.md*: pinned context can't store a file name with a
  backslash in it." ("Only files inside this project can be pinned." stays
  for files that really are outside it);
- 0d's file bound line gains "Unpin a file to make room.";
- several files at once over budget: "Can't pin these *N* files: … or pin
  fewer of these.";
- a change refused in the picker because the list changed: "Pinned context
  changed in another window. This is the current list; choose again.";
- Attach missing's result: "Attached *N* pinned files to this
  conversation.", with "Not attached: *x* (doesn't fit in the 100,000-word
  context limit)." and "Every pinned file is already in this
  conversation.";
- the amber line above the well generalizes 0d's Problems line by count
  ("1 pinned file won't attach: it isn't there. …");
- the full reset's confirmation above 0: "This starts a new room with your
  pinned context: the excerpt, anything on the shelf, every context
  attachment, the thread, tasks, guests, and conversation memory are all
  cleared, then the *N* pinned files are attached. Saved sessions on disk
  are not touched."

**Not applicable:** the settings round trip (pinned context is a project
file, not a VS Code setting); say so in the PR.

## Progress

- **2026-11-04.** Slice doc written with the spec.
- **2026-11-05.** Built on `epic-pinned-context-slice-3-settings-tab`; see
  Built, Verification and Deviations above.
