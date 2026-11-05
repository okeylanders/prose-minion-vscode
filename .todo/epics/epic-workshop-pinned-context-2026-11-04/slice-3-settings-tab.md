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

- [ ] The tab matches the approved design in every state.
- [ ] The webview never introduces a path; every add goes by catalog key or
      attachment id.
- [ ] Every mutation goes through the store's revision check.
- [ ] The dialog shell and the new files stay under 500 lines.
- [ ] The epic's verification passes, with counts recorded here.

## Progress

- **2026-11-04.** Slice doc written with the spec.
