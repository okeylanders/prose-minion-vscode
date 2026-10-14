# Slice 1: Host History Ledger

**Epic:** [Dictionary Lookup History](README.md)
**Decision:** [ADR 2026-10-14](../../../docs/adr/2026-10-14-dictionary-lookup-history.md), D1–D5 and D7
**Status:** Planned

## Outcome

The host records each successful Dictionary-tab lookup and persists it to
`prose-minion/history/dictionary.json`. It answers history list, entry,
delete, and clear requests, and pushes a fresh summary list after every
change. Nothing in the webview uses it yet. The only visible changes are the
optional fields this slice adds to existing payloads.

## Contracts

New file `packages/core/src/shared/types/messages/dictionaryHistory.ts`, exported
from the `@messages` barrel and added to `WebviewToExtensionMessage` or
`ExtensionToWebviewMessage` as appropriate. It contains:

- `DictionaryLookupMode`, `DictionaryLookupRequest`, `DictionaryHistoryEntry`,
  `DictionaryHistorySummary`, `DictionaryHistoryDurability`. Shapes are
  defined in ADR D4 and D5.
- Payload and message interfaces for `REQUEST_DICTIONARY_HISTORY`,
  `DICTIONARY_HISTORY`, `REQUEST_DICTIONARY_HISTORY_ENTRY`,
  `DICTIONARY_HISTORY_ENTRY`, `DELETE_DICTIONARY_HISTORY_ENTRY`, and
  `CLEAR_DICTIONARY_HISTORY`. Add the enum members to `MessageType` in
  `base.ts`, with snake_case values like their neighbors.

New file `packages/core/src/shared/constants/dictionaryHistory.ts`:

- `DICTIONARY_HISTORY_LIMIT = 50`
- `DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS = 140`
- `DICTIONARY_HISTORY_DISPLAY_PATH = 'prose-minion/history/dictionary.json'` (POSIX
  separators for display; build the real path with `path.join`)

Changes to `packages/core/src/shared/types/messages/dictionary.ts`:

- `LookupDictionaryPayload` gains `sourceUri?` and `relativePath?`.
- `FastGenerateDictionaryPayload` gains `relativePath?`. It already has
  `sourceUri?`.
- `DictionaryResultPayload` and `FastGenerateDictionaryResultPayload` gain
  `historyEntryId?: string`.

## Store and codec

`packages/core/src/infrastructure/storage/dictionaryHistoryCodec.ts` (pure, no I/O):

- `decodeDictionaryHistoryFile(text: string)` returns either
  `{ kind: 'ok'; entries; dropped: number }` or
  `{ kind: 'invalid'; reason: string }`. An unparseable file or an unknown
  `formatVersion` is `invalid`. Invalid individual entries are dropped and
  counted. Validate every field's type, and validate `mode` against the
  union.
- `encodeDictionaryHistoryFile(entries)` returns pretty-printed JSON with
  `formatVersion: 1`.
- `toDictionaryHistorySummary(entry)` builds the context preview: collapse
  whitespace, trim, cut at 140 characters, add `…`, or `''` when empty.

`packages/core/src/infrastructure/storage/DictionaryHistoryStore.ts`:

- Constructor: `(fileSystem: FileSystem, workspace: Workspace, log: LogSink,
  options?: { limit?: number; now?: () => Date; createId?: () => string })`.
  The default id is `dict-hist-${Date.now()}-${randomUUID()}`, using
  `node:crypto` as `writeNumberedFile` does.
- API (all async, all serialized through one promise chain so writes never
  interleave):
  - `snapshot(): Promise<{ entries: DictionaryHistorySummary[]; durability; limit }>`
  - `get(id): Promise<DictionaryHistoryEntry | undefined>`
  - `record(input: { request; modelId?; toolName; result }): Promise<DictionaryHistoryEntry>`
    inserts the entry newest first, trims to the limit, persists, and emits.
  - `delete(id): Promise<boolean>` persists and emits only when something was
    removed.
  - `clear(): Promise<void>` persists and emits.
  - `onDidChange(listener: () => void): () => void`. Follow the existing
    `ListenerSet` pattern (see `DictionaryService.addStatusListener`).
- Lazy load on first use. Availability follows `LexicalGravityLensRepository`:
  no folder gives `session/no-workspace`, more than one gives
  `session/multi-root`, and otherwise the file lives at
  `<root>/prose-minion/history/dictionary.json`. A missing file means an empty
  history. An `invalid` decode renames the file to
  `dictionary.invalid-<timestamp>.json` with `rename` (no overwrite), logs it,
  and starts empty. A dropped-entry count above zero is logged.
- Persist by writing a temporary sibling, then `rename` with overwrite.
  `WorkshopSessionStore` and `LexicalGravityLensRepository` already do this,
  so mirror whichever helper exists. A write failure is logged, keeps the
  in-memory state, sets durability to `session/write-failed` until the next
  write succeeds, and **does not throw out of `record`**. The lookup must
  never fail because of history.

## Service

`DictionaryService`:

- `getActiveModelId(): string | undefined` returns
  `this.aiResourceManager.getResolvedModel('dictionary')`.
- `lookupWordStreaming` and `lookupWord` return `DictionaryLookupResult`
  (`AnalysisResult & { readonly outcome: 'entry' | 'unconfigured' | 'failed' }`).
  Set the outcome in the three existing branches. Callers that ignore it,
  such as `WorkshopPersonaCapability`, keep compiling unchanged.

## Handler

`DictionaryHandler` constructor becomes
`(dictionaryService, history: DictionaryHistoryStore, postMessage, outputChannel: LogSink)`.
AGENTS.md requires siblings to take a non-optional `LogSink`.

- `handleLookupDictionary`: capture `modelId` before the run. After the run,
  if the lookup was not cancelled and `result.outcome === 'entry'`, call
  `record(...)` with mode `standard`. The request is built from the payload:
  `word`, `contextText?.trim() ?? ''`, the resolved options, `sourceUri`, and
  `relativePath`. Wrap the call in try/catch and log failures. Then post
  `DICTIONARY_RESULT` with `historyEntryId` when recording succeeded. Keep the
  existing ordering of `STREAM_COMPLETE` before `DICTIONARY_RESULT`.
- `handleFastGenerate`: the same, with mode `fast`, recording when
  `result.metadata.successCount > 0`, and `historyEntryId` on
  `FAST_GENERATE_DICTIONARY_RESULT`.
- New routes:
  - `REQUEST_DICTIONARY_HISTORY` posts `DICTIONARY_HISTORY`.
  - `REQUEST_DICTIONARY_HISTORY_ENTRY` posts `DICTIONARY_HISTORY_ENTRY`
    (`found` or `missing`).
  - `DELETE_DICTIONARY_HISTORY_ENTRY` and `CLEAR_DICTIONARY_HISTORY` mutate
    the store. The broadcast comes through the change listener.
- Subscribe to `history.onDidChange` in the constructor. On change, post
  `DICTIONARY_HISTORY` from `snapshot()`. Expose `dispose()`, and have
  `MessageHandler.dispose()` call it next to
  `disposeDictionaryStatusListener`.
- Message `source` is `'extension.dictionary'`, as for its siblings.

## Composition root

- `CoreServices` gains `dictionaryHistoryStore: DictionaryHistoryStore` with a
  one-line doc comment.
- `apps/vscode-extension/src/extension.ts` constructs it from
  `platform.fileSystem`, `platform.workspace`, and `outputChannel`. Export the
  class through the `@prose-minion/core` barrel (`packages/core/src/index.ts`).
- `MessageHandler` passes it, plus `this.outputChannel`, to `DictionaryHandler`.
  It constructs nothing new (ADR 2026-06-18).
- Update every test fixture that builds `CoreServices`.

## Tests

- `__tests__/infrastructure/storage/dictionaryHistoryCodec.test.ts`: round
  trip; an unknown `formatVersion` is invalid; bad JSON is invalid; a malformed
  entry is dropped and counted while valid neighbors survive; preview
  collapsing and truncation, and `''` for no context.
- `__tests__/infrastructure/storage/DictionaryHistoryStore.test.ts` (in-memory
  `FileSystem` and `Workspace` fakes):
  - Newest first, with the limit evicting the oldest. A store with
    `limit: 3` is enough.
  - The file persists and reloads in a new store instance.
  - An invalid file is renamed, never overwritten, and the store starts empty.
  - A missing file starts empty.
  - No folder and multi-root give `session` durability, with `record` still
    working in memory.
  - A write failure gives `session/write-failed` without `record` rejecting.
  - Change events fire on record, delete (only when something was removed),
    and clear.
  - Concurrent `record` calls both land.
- `DictionaryHandler.test.ts` (extend):
  - A successful standard lookup records once, with mode `standard`, the
    captured model, and resolved options. The result carries
    `historyEntryId`.
  - Cancelled, `unconfigured`, and `failed` outcomes are not recorded.
  - Fast with `successCount > 0` records with mode `fast`. Fast with
    `successCount === 0` does not.
  - A throwing `record` still posts the result, without `historyEntryId`.
  - The model is captured before the run (changing the stub's model during
    the run does not change the entry).
  - The new routes are registered and answer.
  - A store change triggers a `DICTIONARY_HISTORY` post, and `dispose()`
    stops it.
- `DictionaryService.test.ts` (extend): each branch's `outcome`, and
  `getActiveModelId` delegation.
- Update any route-inventory or architecture test that counts routes or
  lists storage modules.

## Done when

The full suite, typecheck, and lint pass. There is no `vscode` import in core.
The diff touches only the files above and their tests.
