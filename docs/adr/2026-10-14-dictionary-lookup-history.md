# ADR 2026-10-14: Dictionary Lookup History

**Status:** Proposed (2026-10-14); amended 2026-10-15 after the [PR #144 review](../pr-reviews/pr-144-dictionary-lookup-history-review.md), and again 2026-10-15 to [raise the cap and offer prior lookups](#amendment-2026-10-15-a-larger-cap-and-the-prior-lookup-offer)
**Date:** 2026-10-14
**Epic:** [Dictionary Lookup History](../../.todo/epics/epic-dictionary-lookup-history-2026-10-14/README.md)
**Extends:** [ADR 2026-06-16 — Monorepo Ports and Adapters](2026-06-16-monorepo-ports-and-adapters.md); [ADR 2026-06-18 — MessageHandler Composition-Root Consolidation](2026-06-18-messagehandler-composition-root-consolidation.md)
**Realizes:** the Dictionary third of [Feature: Request History Buttons](../../.todo/features/feature-request-history-buttons/README.md)

## Context

Writers use the Dictionary tab exploratively. They look up a word, then a
neighbor, then rerun the first with different context. Today every lookup
overwrites the last. Going back means retyping the word and context and paying
for another generation, and the old result is gone unless it was saved.

The writer wants a history they can step through with `‹` `›` buttons beside
the tab title and browse in a popup. Each entry holds everything needed to
reproduce or reread the lookup: the word or phrase, the extra context, the
entry options (Topic & Related Lexicon, Chromatic Palettes), the mode
(standard or ⚡ fast), the model, and the Markdown result.

These facts in the current code shape the design:

1. **Webview state cannot hold the history.** `usePersistence` calls
   `vscode.setState` with the whole composed App state on every render. One
   dictionary entry is roughly 8–25 KB of Markdown, so fifty would be
   re-serialized on every keystroke anywhere in the sidebar.
2. **The host already knows the complete lookup.** `DictionaryHandler` receives
   the request payload, owns the run, and sees the outcome: success,
   cancellation, an unconfigured API key, or a failure. The webview cannot
   always tell these apart. A failed standard lookup arrives as an ordinary
   `DICTIONARY_RESULT` whose text begins with `Error:`.
3. **The webview does not know which model ran.** It knows the *selected*
   dictionary model. The host resolves the scope's model in `AIResourceManager`
   (`getResolvedModel('dictionary')`), and that model can be hot-swapped
   between submit and completion.
4. **Writer data already lives in the project.** Workshop sessions
   (`prose-minion/sessions`), Lexical Gravity lenses (`prose-minion/lenses`),
   recovery files, reports, and exports are all project-owned files reached
   through the `FileSystem` and `Workspace` ports.
5. **Workshop personas also call `DictionaryService`.** Those lookups are part
   of a conversation, not the writer's Dictionary tab.

## Decision

### D1. The history is host-owned and stored in the project

A new `DictionaryHistoryStore` (`packages/core/src/infrastructure/storage/`)
keeps the history in memory and persists it to
**`prose-minion/history/dictionary.json`** in a single-folder workspace. It is
built once at the composition root and carried in `CoreServices`, so every
`MessageHandler` shares one instance. The webview holds only lightweight
summaries and a cursor.

The `history/` folder leaves room for the Assistant and Category Search
histories the parent feature describes. Each tool gets its own file.

Options rejected:

- **Webview `setState`:** see Context 1.
- **`workspaceState` Memento:** it needs a new platform port, and the writer can
  neither see nor back up the data. VS Code also discourages large Memento
  values.
- **One file per entry:** it adds directory churn, and recency and cap still
  need an index.

### D2. The host records at successful completion, and only for the Dictionary tab

`DictionaryHandler` records an entry after a lookup's run finishes and *before*
it completes the stream or posts the result (see the
[amendment](#amendment-2026-10-15-pr-144-review)). The entry is built from:

- the request payload: the word as sent, trimmed context, resolved entry
  options, and the source path;
- the mode, taken from the route (`LOOKUP_DICTIONARY` is `standard`,
  `FAST_GENERATE_DICTIONARY` is `fast`);
- the models that generated it: the model the provider reported for the call
  (`ExecutionResult.modelId`, carried on `DictionaryLookupResult.modelId`),
  or, for a fast lookup, the distinct models its successful blocks reported.
  No selection is read, either before or after the run (amended; see F-03).

| Outcome | Recorded? |
|---|---|
| Standard lookup completed (`finishReason` `stop`, unreported, or `length`/truncated) | Yes |
| Standard lookup cancelled (`signal.aborted`) before the history commit point, including while the entry is staged | No |
| Cancel that reaches the host after the commit point | Refused (no acknowledgment); the lookup stands as recorded |
| API key not configured | No |
| Lookup failed (the service caught an error and returned `Error: …` text) | No |
| Fast lookup with at least one successful block (`metadata.successCount > 0`) | Yes; partial failures included as rendered |
| Fast lookup with no successful block (unconfigured or every block failed) | No |
| Fast lookup aborted or thrown | No |

To make "failed" explicit, `DictionaryService.lookupWordStreaming` (and
`lookupWord`, for symmetry) returns a `DictionaryLookupResult`: an
`AnalysisResult` plus `outcome: 'entry' | 'unconfigured' | 'failed'`. The
handler records only `outcome === 'entry'`. It never sniffs content text.

Workshop persona lookups go straight to `DictionaryService`, never through
`DictionaryHandler`, so they never enter the history. That is intended.

A history write failure never fails the lookup. The store logs the failure,
keeps the entry in session memory, and returns its `historyEntryId`; the popup
reports session-only durability. An unexpected recording failure is logged by
the handler, which posts the result without a `historyEntryId`.

### D3. Every run is an entry, up to five hundred

Rerunning the same word with the same context produces a different result, and
comparing runs is a core use. So entries are **never de-duplicated**. The
history keeps the newest `DICTIONARY_HISTORY_LIMIT = 500` entries and evicts the
oldest. (Fifty when first decided; see the
[second amendment](#amendment-2026-10-15-a-larger-cap-and-the-prior-lookup-offer).)
D9 offers an existing entry before a repeat lookup runs, so keeping every run
does not mean paying for runs the writer did not want.

### D4. The entry and file shape

```ts
type DictionaryLookupMode = 'standard' | 'fast';

interface DictionaryLookupRequest {      // what the writer asked for
  word: string;                          // as submitted (already normalized, ≤ 6 words)
  context: string;                       // '' when none
  includeEncyclopedia: boolean;          // resolved, never undefined
  includePalettes: boolean;              // resolved, never undefined
  mode: DictionaryLookupMode;
  sourceUri?: string;
  relativePath?: string;
}

interface DictionaryHistoryEntry {
  id: string;
  createdAt: string;                     // ISO-8601
  request: DictionaryLookupRequest;
  modelIds: string[];                    // provider-reported, first-use order; [] when unreported
  toolName: string;                      // 'dictionary_lookup' | 'dictionary_fast_generate'
  result: string;                        // the Markdown exactly as the tab rendered it
}

// prose-minion/history/dictionary.json
interface DictionaryHistoryFileV1 {
  formatVersion: 1;
  entries: DictionaryHistoryEntry[];     // newest first
}
```

Loading is defensive. A pure codec validates each entry and drops invalid ones
one at a time, logging the count. If the file cannot be parsed, or it has an
unknown `formatVersion`, the store renames it once to
`dictionary.invalid-<timestamp>.json`, logs the rename, and starts empty. It
never overwrites data the writer might want to repair.

Once released, this file is writer data. A later change to its meaning bumps
`formatVersion` and adds an explicit migration. It is not a Workshop session,
and the [Workshop session codec ADR](2026-07-30-workshop-session-codec-evolution.md)
does not govern it.

### D5. The protocol separates summaries from entries

The list the webview needs is small. Result bodies are large and needed one at
a time.

| Message | Direction | Payload |
|---|---|---|
| `REQUEST_DICTIONARY_HISTORY` | webview → host | `{}` |
| `DICTIONARY_HISTORY` | host → webview | `{ entries: DictionaryHistorySummary[]; durability: DictionaryHistoryDurability; limit: number }` |
| `REQUEST_DICTIONARY_HISTORY_ENTRY` | webview → host | `{ id }` |
| `DICTIONARY_HISTORY_ENTRY` | host → webview | `{ status: 'found'; entry } \| { status: 'missing'; id }` |
| `DELETE_DICTIONARY_HISTORY_ENTRY` | webview → host | `{ id }` |
| `CLEAR_DICTIONARY_HISTORY` | webview → host | `{}` |

```ts
interface DictionaryHistorySummary {
  id: string;
  createdAt: string;
  word: string;
  contextPreview: string;                // whitespace-collapsed, ≤ 140 chars + '…'; '' when none
  includeEncyclopedia: boolean;
  includePalettes: boolean;
  mode: DictionaryLookupMode;
  modelIds: string[];
  relativePath?: string;
}

type DictionaryHistoryDurability =
  | { kind: 'project'; displayPath: string }          // 'prose-minion/history/dictionary.json'
  | { kind: 'session'; reason: 'no-workspace' | 'multi-root' | 'write-failed' };
```

- The store emits a change event after every record, delete, or clear. Each
  `DictionaryHandler` subscribes (disposer released on `MessageHandler`
  dispose, as `DictionaryService.addStatusListener` is) and posts a fresh
  `DICTIONARY_HISTORY`.
- `DictionaryResultPayload` and `FastGenerateDictionaryResultPayload` gain an
  optional `historyEntryId`, so the webview's cursor follows a new lookup
  without guessing. `DictionaryResultPayload` also carries the `requestId` of
  the stream it settles. The webview applies a result only to the lookup it
  is awaiting, so the cached `DICTIONARY_RESULT` the host replays when the
  sidebar reappears never replaces the view (amended; see F-01 and F-02).
- `LookupDictionaryPayload` gains `sourceUri?` and `relativePath?`.
  `FastGenerateDictionaryPayload` already has `sourceUri?` and gains
  `relativePath?`. Restoring an entry can then restore its "Source:" line.

### D6. The buttons step through the history like browser back and forward

- **`‹` goes to the next older entry and `›` to the next newer one.** The list
  is a log. Navigation never truncates it, and a new lookup always becomes the
  newest entry.
- **Restoring an entry changes no settings.** It loads the entry's word,
  context, toggles, source, result, and tool name into the tab. It does not
  rerun the lookup and does not change the dictionary model selection. The
  model is shown as metadata.
- **The cursor** is the id of the entry the result pane shows, or `null`
  ("live"). Submitting a lookup sets it to `null`. A result that carries
  `historyEntryId` sets it to that id. A delete, clear, or eviction that
  removes the cursor's entry sets it to `null`. The cursor id is persisted in
  webview state. Entries are not.
- **Unsaved input is stashed in one draft slot** (in memory only). On
  navigation, if the cursor is live, or the form differs from the request
  behind the displayed result, the current view (form, result, and tool name)
  is stashed. `›` from the newest entry restores the draft and returns to
  live. Submitting a lookup or clearing the history discards the draft.
- **Entry loads are latest-wins.** Navigation posts
  `REQUEST_DICTIONARY_HISTORY_ENTRY` and sets `pendingEntryId`. Button state
  steps from `pendingEntryId ?? cursorId`, so rapid clicks walk correctly. An
  arriving entry is applied only if its id matches `pendingEntryId`. A draft
  is stashed only when no load is pending.
- While a lookup is generating, the `‹` `›` buttons and popup row selection
  are disabled.

The navigation rules live in a pure module
(`presentation/webview/utils/dictionaryHistoryNavigation.ts`, or alongside the
hook) so they can be unit-tested without React.

### D7. Without a single project folder, history lasts only for the session

The history works in memory when the window has no folder or is multi-root
(the same availability rule as `LexicalGravityLensRepository`), and after a
persistence write fails. It just does not survive a restart. The popup states
this, using the `durability` field.

### D8. Copy and Save use the request behind the displayed result

`UtilitiesTab` currently puts the word from a `lastLookupRef` in the Copy and
Save headers. After a restore, that ref would name the wrong word.
`useDictionary` gains `lookupSubject: DictionaryLookupRequest | null`, the
request the displayed result answers, which is persisted. Submission sets it,
and so does restoring an entry or draft. Copy and Save read it. The draft
rule's "form differs" check (D6) also compares against it, so one concept
replaces the ref.

## Consequences

- One more project file appears under `prose-minion/`. Writers already have the
  folder for sessions, lenses, reports, and exports.
- Two windows open on the same folder each keep their own in-memory history,
  and the last writer wins on disk. This is accepted. Merging on write can
  come later if it matters.
- The file holds the writer's context excerpts, so it may hold manuscript
  text. It stays inside the project, under the writer's control, and is
  covered by whatever VCS or backup the project uses.
- `DictionaryService` returns an explicit lookup outcome and the
  provider-reported model. The Workshop callers ignore both fields.

## Amendment 2026-10-15: PR #144 review

Astra's review of PR #144 found four Medium defects, and the re-review found
a fifth (F-05) introduced by the F-01 fix. Each fix below changes a decision
above.

- **F-01: settlement ownership.** The handler completed the stream, then
  awaited the history write, then posted the result. Completion released the
  webview's lock, so a second Run or a history navigation could start inside
  the write, and the first lookup's result then landed on the newer one.
  - The handler now records **before** completing the stream. It then posts
    `STREAM_COMPLETE` and `DICTIONARY_RESULT` back to back.
  - In the webview, a completed stream stays owned (`loading`, which keeps
    Run and `‹` `›` locked) until its own result settles it
    (`useDictionary.isAwaitedResult`).
- **F-02: replay identity.** The webview guarded replays by `historyEntryId`,
  which failed and unconfigured results lack. Their cached replay overwrote a
  restored entry, and Copy and Save then exported an error under the restored
  word.
  - Results now carry their stream's `requestId`. A result applies only if it
    settles the awaited request.
  - Replays of any outcome, superseded results, and cancelled lookups' late
    results are dropped. A fresh failure still shows.
  - This replaces `useDictionaryHistory.hasFollowedEntry`.
- **F-03: model provenance.** A selection snapshot taken at request start is
  not what ran. The manager hot-swaps by mutating the shared engine in place,
  and the provider picks its model when each call is dispatched, so a swap
  during prompt loading ran on model B and recorded model A.
  - Entries now record what the provider reported for the call, as
    `modelIds: string[]`. A fast lookup lists every model its blocks ran on.
  - The format is unreleased, so the shape changed without a migration.
  - `getActiveModelId()` is removed.
- **F-05 (re-reviews): one commit point closes the cancel window.**
  Recording before completion (F-01) left the stream cancellable during the
  write. The host acknowledged a cancel there, but it still completed as a
  success and kept the entry.
  - A first fix rolled the entry back with a compensating write. A failed
    rollback could then leave the cancelled entry on disk, lose the entry the
    insert had evicted, and delete the only complete temporary copy of the
    prior history.
  - The final design has no compensating write.
    `record(input, { beforeCommit })` stages the new ledger in a temporary
    file, then calls `beforeCommit` synchronously, immediately before the
    rename that commits it (or at once when there is no file).
  - Declining leaves the history file and memory untouched. The file
    therefore only ever holds committed history, whatever write fails.
  - The handler's `beforeCommit` withdraws an already-cancelled lookup.
    Otherwise it removes the request from `activeRequests` in the same tick.
    A cancel arriving after the commit point finds nothing to cancel, is
    never acknowledged, and the lookup stands as recorded.
  - A failed write that changes durability is always broadcast.
- **F-04: log privacy.** Invalid-file reasons embedded the JSON parser's
  message, which quotes the surrounding writer text, and an arbitrary
  `formatVersion` value. Both reached the Output log. Reasons are now fixed
  phrases, and only a whole-number version is named.

## Amendment 2026-10-15: a larger cap and the prior-lookup offer

Raised by the writer after PR #144 merged.

- **D3: the cap is 500.** Fifty filled quickly, because repeats are kept.
  - At the Context's 8–25 KB per entry, the file grows to roughly 4–12.5 MB.
    The store still holds it in memory and rewrites it whole on every
    record, delete, and clear. That cost is accepted. If writes become
    noticeable, the remedy is an append-friendly layout, not a smaller cap.
  - The webview is unaffected. It receives summaries only (D5).
  - Raising the cap is safe for existing files. Lowering it is not: on load
    the store keeps only the newest `limit` entries, and the next write
    drops the rest.
- **D9 (new): a phrase already in history is offered before it is rerun.**
  - Every submit path (Run, ⚡ Fast, and the right-click auto-run) first
    looks for recorded lookups of the same phrase. Phrases compare after
    the submit normalization, case-folded (`dictionaryPhraseKey`), as whole
    phrases. Context, options, and mode are not compared. The offer shows
    them so the writer can judge.
  - When there is a match, nothing is posted. A prompt under the Run
    buttons names the newest match (time, mode, context preview, and how
    many lookups of the phrase are in history). It offers **Open existing
    entry**, which restores it through the ordinary history load (D6) and
    generates nothing, and **Look up again**, which submits the form as it
    stands in the mode the writer chose. It can also be dismissed.
  - No offer is made when the result pane already shows one of the
    matches. Rerunning the entry in front of you is a deliberate rerun.
  - The offer holds only the phrase and mode. Matches are derived from the
    current list on each render, so a delete or eviction withdraws a stale
    offer, and editing the word dismisses it.
  - The check is webview-only. The summaries already carry `word`, so no
    message or host change is needed. The rule is pure
    (`findPriorDictionaryLookups` in `dictionaryHistoryNavigation.ts`). The
    state lives in a presentation controller,
    `hooks/domain/dictionary/controllers/useDictionaryPriorLookup.ts`, that
    reaches history and submission only through injected callbacks.
  - Workshop persona lookups never pass through the tab, so they are never
    interrupted (D2).

## Out of scope (follow-ups)

- History for Assistant and Category Search: the rest of the parent feature,
  reusing the `prose-minion/history/` convention.
- A "Clear request history" control in Settings. The popup's Clear covers the
  Dictionary.
- Filtering or searching inside the popup, and keyboard shortcuts
  (`Alt+←`/`Alt+→`).
- Merging history across windows.
- A setting to skip the prior-lookup offer (D9) for writers who rerun
  deliberately, and listing every match in the offer rather than the newest.
