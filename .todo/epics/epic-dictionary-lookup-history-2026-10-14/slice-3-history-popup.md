# Slice 3: History Popup

**Epic:** [Dictionary Lookup History](README.md)
**Decision:** [ADR 2026-10-14](../../../docs/adr/2026-10-14-dictionary-lookup-history.md), D5–D7
**Depends on:** Slice 1 contracts. The component is presentational, so it can be built alongside Slice 2 and mounted once Slice 2's hook exists.
**Status:** Planned

## Outcome

The `🕘 3 / 12` label in the Dictionary header opens a popup listing recent
lookups, newest first. Selecting a row restores that lookup, as `‹` and `›`
do. Each row can be deleted. The whole history can be cleared after a
confirmation. A footer says where the history is kept, or that it lasts only
for this session.

## Component (`components/dictionary/DictionaryHistoryModal.tsx`)

Presentational only: no `useVSCodeApi`, no `MessageType`, no `postMessage`.

```ts
interface DictionaryHistoryModalProps {
  open: boolean;
  entries: DictionaryHistorySummary[];   // newest first
  cursorId: string | null;
  durability: DictionaryHistoryDurability;
  limit: number;
  selectionDisabled: boolean;            // a lookup is generating
  now?: () => Date;                      // test seam for timestamps
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}
```

- **Dialog.** Follow the repo's existing modal conventions (overlay, panel,
  header with title and close button; see `AllToolsModal` and the Workshop
  modals). Use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
  Esc and the overlay close it. Focus moves into the panel on open and back
  to the opener on close.
- **Title.** "Lookup history", with a muted `12 of 50` count.
- **Rows** are newest first. Each row has a main button that selects the
  entry, plus a separate trash icon button (`aria-label="Delete lookup:
  <word>"`). The select button shows:
  - the word (strong) and its time (from the timestamp formatter below);
  - badges for the mode (`Standard` or `⚡ Fast`), `Encyclopedia` and
    `Palettes` when on, and the model id (monospace, ellipsized, with the full
    id in `title`);
  - the context preview on one muted, ellipsized line, when present;
  - `Source: <relativePath>` when present.

  The current row (`id === cursorId`) gets `aria-current="true"` and an
  accent edge. While `selectionDisabled`, the select buttons are disabled and
  a one-line note says history opens after the current lookup finishes.
  Delete stays enabled.
- **Empty state:** "No lookups yet. Each completed lookup is kept here."
- **Footer:**
  - The durability note:
    - `project`: "Saved in `prose-minion/history/dictionary.json`".
    - `session/no-workspace`: "Not saved: open a folder to keep history
      across sessions".
    - `session/multi-root`: "Not saved: history is kept for single-folder
      workspaces".
    - `session/write-failed`: "Couldn't save history; it will last until VS
      Code restarts".
  - A two-step **Clear history** button. The first click shows an inline
    "Clear all 12 lookups?" with Cancel and Clear. Clear calls `onClear`.
    Closing the modal resets the confirmation.

## Timestamp formatter (`presentation/webview/utils/formatDictionaryHistoryTime.ts`)

`formatDictionaryHistoryTime(iso, now)` returns `Today 14:02`,
`Yesterday 09:15`, `Oct 12, 09:15` within the current year, or
`Oct 12 2025, 09:15` otherwise, in local time. An invalid ISO string returns
`''`. Pure and unit-tested. The Slice 2 meta line reuses it.

## Wiring

This step runs after Slice 2 lands.

- `UtilitiesTab` keeps `historyOpen` as local UI state. The `🕘` position label
  becomes a button (`aria-label="Lookup history"`, `aria-haspopup="dialog"`)
  that opens the modal. It stays visible and enabled whenever the history is
  non-empty.
  - `onSelect(id)` calls `dictionaryHistory.openEntry(id)` and closes the
    modal.
  - `onDelete` calls `deleteEntry`. `onClear` calls `clearHistory`.
- CSS goes in a new `/* Dictionary history popup */` section **appended at
  the end of** `index.css`, using existing tokens.

## Docs

- `AGENTS.md`: add `useDictionaryHistory.ts` to the hooks tree and the
  domain-mirroring table (`useDictionaryHistory` ↔ `DictionaryHandler`,
  history). Bump the test inventory line if it is kept current.
- `.todo/features/feature-request-history-buttons/README.md`: mark the
  Dictionary third done, link the epic and ADR, and keep Assistant and
  Category Search as open scope.
- The epic README: the slice table, the status line, and a progress note.
- `.memory-bank/YYYYMMDD-HHMM-dictionary-lookup-history.md`: decisions,
  verification run, and follow-ups.

## Tests

- `__tests__/presentation/webview/components/dictionary/DictionaryHistoryModal.test.tsx`:
  - It renders nothing when closed.
  - Rows are newest first, with every badge, and the model's `title` holds
    the full id.
  - `aria-current` is on the cursor row.
  - Selecting calls `onSelect`. While `selectionDisabled`, select buttons are
    disabled and Delete still works.
  - The Clear confirmation flow works, and Cancel aborts it.
  - The empty state appears.
  - Each durability message appears.
  - Esc and the close button call `onClose`.
- `__tests__/presentation/webview/utils/formatDictionaryHistoryTime.test.ts`
  covers each branch, plus an invalid input.
- `UtilitiesTab.test.tsx` (extend): the history button opens the modal,
  selecting a row calls `openEntry` and closes it, and the button is hidden
  when the history is empty.

## Done when

The full suite, typecheck, and lint pass, and the docs are updated.
