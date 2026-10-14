# Slice 2: Webview Navigation

**Epic:** [Dictionary Lookup History](README.md)
**Decision:** [ADR 2026-10-14](../../../docs/adr/2026-10-14-dictionary-lookup-history.md), D5, D6, and D8
**Depends on:** Slice 1 contracts
**Status:** Done (`ca73ac1`, `2e29bee`)

## Outcome

The Dictionary tab header shows `‹` `🕘 3 / 12` `›`. `‹` and `›` restore older
and newer lookups (form, options, source, and result) without rerunning
anything. `›` past the newest entry brings back unsaved input. A "From
history" line shows the date, mode, and model of the entry being viewed. The
`🕘` position label is not clickable yet; Slice 3 turns it into the popup
button.

## `useDictionary` changes (`hooks/domain/useDictionary.ts`)

- `lookupSubject: DictionaryLookupRequest | null` holds the request the
  displayed result answers. It is persisted as `dictionaryLookupSubject` and
  set with `setLookupSubject`.
- `DictionaryView` is exported from the hook module:
  `{ word; context; includeEncyclopedia; includePalettes; sourceUri; relativePath; result; toolName; lookupSubject }`.
- `restoreView(view: DictionaryView)` sets every field. It sets `wordEdited`
  to `true` so a selection auto-fill cannot overwrite a restored word, and
  clears `statusMessage`. It must not touch loading, streaming, or
  fast-generation state.
- Keep the tripartite interfaces (`DictionaryState`, `DictionaryActions`,
  `DictionaryPersistence`) explicit and updated.

## Pure navigation rules (`presentation/webview/utils/dictionaryHistoryNavigation.ts`)

All functions are pure and unit-tested:

- `stepDictionaryHistory({ ids, position, direction, hasDraft })` returns
  `{ kind: 'entry'; id } | { kind: 'draft' } | null`.
  - `ids` is newest first. `position` is `pendingEntryId ?? cursorId` (an id or
    `null` for live).
  - `older` from live goes to `ids[0]`. From index `i` it goes to `ids[i + 1]`,
    or `null` at the end.
  - `newer` from index `i > 0` goes to `ids[i - 1]`. From index `0` it goes to
    `draft` if `hasDraft`, else `null`. From live it is `null`.
  - A position id that is not in `ids` counts as live.
- `isDictionaryFormDirty(form, subject)` is true when `subject` is null and
  the form has a word or context, or when the word, context,
  `includeEncyclopedia`, or `includePalettes` differ from `subject`. Compare
  the word after the same whitespace normalization the tab uses for
  submission, and the context trimmed.
- `dictionaryViewFromEntry(entry)` maps an entry to a `DictionaryView`. The
  `lookupSubject` is the entry's `request`.
- `describeDictionaryHistoryPosition(ids, cursorId)` returns
  `{ index: number | null; total }`. The `3 / 12` label counts from the
  newest entry as 1.

## `useDictionaryHistory` (`hooks/domain/useDictionaryHistory.ts`)

A tripartite domain hook. It takes a narrow
`DictionaryHistoryTarget = Pick<UseDictionaryReturn, …>` covering the view
fields, `lookupSubject`, `restoreView`, and the generating flags (`loading`,
`isFastGenerating`, `isStreaming`).

- **State:** `entries: DictionaryHistorySummary[]`, `durability`, `limit`,
  `cursorId`, `pendingEntryId`, and `draft: DictionaryView | null`, plus the
  derived `canGoOlder`, `canGoNewer`, `position`, `cursorSummary`,
  `olderSummary`, and `newerSummary`. The neighbor summaries feed the
  tooltips, for example "Previous lookup: petrichor".
- **Actions:**
  - `requestHistory()` is called once on mount through a named `useCallback`
    plus an effect, per the useEffect extraction pattern. It posts
    `REQUEST_DICTIONARY_HISTORY`.
  - `handleHistory(msg)` replaces the entries. If `cursorId` is gone it
    becomes `null`. If `pendingEntryId` is gone it becomes `null`. If the
    list is empty, `draft` becomes `null`.
  - `handleHistoryEntry(msg)` applies a `found` entry only when
    `id === pendingEntryId`: it calls `restoreView(dictionaryViewFromEntry(entry))`,
    sets `cursorId = id`, and sets `pendingEntryId = null`. A `missing` reply
    sets `pendingEntryId = null` and requests the list again.
  - `goOlder()` and `goNewer()` do nothing while generating. When no load is
    pending and the current view is live or dirty, they first stash the
    current view as `draft`. Then they apply the step: an entry posts
    `REQUEST_DICTIONARY_HISTORY_ENTRY` and sets `pendingEntryId`; `draft`
    restores the draft, sets `cursorId = null`, and clears `draft`.
  - `openEntry(id)` follows the same stash-then-load rule for a specific id.
    Slice 3's popup uses it.
  - `deleteEntry(id)` and `clearHistory()` post the delete and clear
    messages. The host's broadcast updates the state. `clearHistory` also
    clears `draft` immediately.
  - `followRecordedEntry(id?: string)` sets `cursorId = id ?? null` and
    `pendingEntryId = null` when a lookup result arrives.
  - `beginNewLookup()` sets `cursorId`, `pendingEntryId`, and `draft` to null.
    It is called on every submit path.
- **Persistence:** `{ dictionaryHistoryCursorId: string | null }`. Entries come
  from the host on mount. The draft lives in memory only.

## Wiring

- `App.tsx` adds `const dictionaryHistory = useDictionaryHistory(dictionary)`,
  spreads its `persistedState`, and passes it to `useAppMessageRouter` and
  `UtilitiesTab`.
- `useAppMessageRouter` routes `DICTIONARY_HISTORY` to `handleHistory` and
  `DICTIONARY_HISTORY_ENTRY` to `handleHistoryEntry`. `DICTIONARY_RESULT` and
  `FAST_GENERATE_DICTIONARY_RESULT` also call
  `dictionaryHistory.followRecordedEntry(msg.payload.historyEntryId)`.
- `UtilitiesTab`:
  - Every submit path (Run, ⚡ Fast, and the right-click auto-run) calls
    `dictionary.setLookupSubject({...request, mode})` and
    `dictionaryHistory.beginNewLookup()`, and sends `sourceUri` and
    `relativePath` in the payload.
  - Remove `lastLookupRef`. Copy and Save read `dictionary.lookupSubject`,
    falling back to the normalized form word as they do today.
  - Header: wrap the `h2` in a flex header row (`pm-dictionary-header`). On
    the right, a nav cluster (`pm-dictionary-history-nav`) holds the `‹` icon
    button, the `🕘` position label (`history` icon plus `3 / 12`, or `— / 12`
    when live, hidden when the history is empty), and the `›` icon button.
    Each button has an `aria-label` ("Previous lookup", "Next lookup") and a
    `title` that names the target word when one is known. Buttons are disabled
    per `canGoOlder` and `canGoNewer`, and while generating.
  - Under the header, when `cursorSummary` is set, a muted meta line reads
    `From history · <local date/time> · Standard|⚡ Fast · <modelId>`. Omit the
    model when it is unknown.
- `iconPaths.ts` adds `chevLeft` (the mirror of `chevRight`).
- `index.css` adds header, nav, and meta rules **directly after the
  `.pm-dictionary-option` block**, using existing tokens and `.icon-button`
  styling. Slice 3 appends its own section at the end of the file.

## Tests

- `__tests__/presentation/webview/utils/dictionaryHistoryNavigation.test.ts`:
  every step case above, the dirty rules, the position label, and the
  entry-to-view mapping.
- `__tests__/presentation/webview/hooks/domain/useDictionaryHistory.test.ts`
  (follow the `useDictionary.test.ts` harness):
  - The mount request is posted.
  - Older from live stashes the draft and requests `ids[0]`.
  - A clean entry does not stash.
  - Latest-wins: a stale entry reply is ignored.
  - A `missing` reply clears the pending load and re-requests the list.
  - Newer from the newest entry restores the draft.
  - `beginNewLookup` clears everything.
  - A list without the cursor resets it.
  - Navigation is ignored while generating.
  - The cursor id is persisted.
- `useDictionary.test.ts` (extend): `restoreView` sets every field and leaves
  loading untouched, and `lookupSubject` persists.
- `UtilitiesTab.test.tsx` (extend):
  - The nav cluster renders, with disabled states at each end and while
    generating.
  - Clicking `‹` calls `goOlder`.
  - The submit payload includes `sourceUri` and `relativePath`, and submit
    calls `setLookupSubject` and `beginNewLookup`.
  - The Copy header uses `lookupSubject.word` after a restore.
  - The meta line renders for a cursor entry.
- `useAppMessageRouter.test.ts` (extend): the new routes, and that result
  routes call `followRecordedEntry`.

## Done when

The full suite, typecheck, and lint pass. `UtilitiesTab.tsx` stays under 500
lines; if it would not, extract the header cluster into
`components/dictionary/DictionaryHistoryNav.tsx`.

## Implementation notes

Additions and choices the spec left open. One addition (the replay guard)
goes beyond the spec, and the reason is given.

- **A replayed result is not applied again.** `MessageHandler` replays its
  cached `DICTIONARY_RESULT` each time the sidebar becomes visible. Without a
  guard, hiding and showing the sidebar after stepping back to an older entry
  would put the newest standard result under the older entry's form, and
  Copy would name the wrong word: the bug D8 exists to prevent. The same
  replay already put an older standard result over a newer ⚡ fast one.
  `useDictionaryHistory` remembers the ids it followed, and
  `hasFollowedEntry(id)` lets the `DICTIONARY_RESULT` route skip a result it
  has already shown. A result without a `historyEntryId` is applied as before.
- **Decisions read a ref, not a render's closure.** `useMessageRouter`
  refreshes its handlers after each commit, so `DICTIONARY_RESULT` and the
  `DICTIONARY_HISTORY` broadcast that follows can both run on one render's
  closures. Every navigation change writes `navigationRef` synchronously.
  `handleHistory` therefore sees the cursor that `followRecordedEntry` just
  set and keeps it. A test runs both calls inside one `act`, and it fails
  when `handleHistory` reads the render's state instead.
- **`navigationLocked`** (true while generating) is exposed, and `canGoOlder`
  and `canGoNewer` already include it. The Slice 3 popup can lock its rows
  with the same flag.
- **Position follows the navigation position.** `position`, `olderSummary`,
  and `newerSummary` use `pendingEntryId ?? cursorId`, the same position the
  buttons step from, so the label and tooltips keep up with rapid clicks.
  `cursorSummary`, which drives the meta line, names the entry the pane
  actually shows.
- **The step is chosen before the stash.** That keeps the result equal to the
  enabled state of the buttons. A `draft` step restores whatever the slot
  holds after the stash. So `›` from an edited newest entry keeps those edits
  (they replace an older draft, because the slot holds the newest unsaved
  input), rather than discarding them. A draft step also clears
  `pendingEntryId`, so a late entry load cannot overwrite the restored draft.
- **A `missing` reply clears only its own load.** It clears `pendingEntryId`
  only when the ids match, so a stale reply cannot cancel a newer load. It
  always asks for the list again.
- **One normalization.** `normalizeDictionaryPhrase` and
  `DICTIONARY_PHRASE_WORDS` moved from `UtilitiesTab` into
  `dictionaryHistoryNavigation.ts`, so submit and the dirty check share them.
  The dirty check normalizes the subject's word too, so a restored entry is
  never dirty because of whitespace.
- **`durability` is `null`** until the host's first list arrives.
- **Header split.** `components/dictionary/DictionaryHistoryNav.tsx` exports
  `DictionaryHistoryNav` (the cluster) and `DictionaryHistoryMeta` (the meta
  line), which keeps `UtilitiesTab.tsx` at 479 lines. The meta line's date
  uses a local `formatHistoryMetaTime` until Slice 3's shared formatter lands.

### Follow-up

- **Right-click lookups record no source.** The host sends `sourceUri` and
  `relativePath` with the editor's "Look Up Word" selection, but
  `useSelection.handleSelectionUpdated` drops them for dictionary injections,
  and the form clears its "Source:" line. The auto-run path sends the
  injection's (empty) source, which matches the form. Carrying the source
  through would record it in history and show the Source line after a
  right-click lookup. That is a small UX change, left out of this slice.
