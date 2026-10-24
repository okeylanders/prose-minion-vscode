# ADR 2026-10-19: Lightbox, an Inspiration and Mood Board Tab

**Status:** Proposed (2026-10-19)
**Date:** 2026-10-19
**Epic:** [Lightbox](../../.todo/epics/epic-lightbox-2026-10-19/README.md)
**Design:** [`docs/design/lightbox/`](../design/lightbox/README.md)
**Extends:** [ADR 2026-06-16 — Monorepo Ports and Adapters](2026-06-16-monorepo-ports-and-adapters.md); [ADR 2026-06-18 — MessageHandler Composition-Root Consolidation](2026-06-18-messagehandler-composition-root-consolidation.md); [ADR 2026-07-03 — Assistant Editor Tab](2026-07-03-assistant-editor-tab.md)
**Related:** [ADR 2026-08-01 — Lexical Gravity Interpretive Grammar](2026-08-01-lexical-gravity-interpretive-grammar.md); [ADR 2026-07-30 — Workshop Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md); [ADR 2026-10-03 — Provider Conversation Prompt Caching](2026-10-03-provider-conversation-prompt-caching.md); [Genre Relationship Explorer concept](../../.todo/epics/epic-conversation-widgets-2026-07-22/concepts/genre-relationship-explorer.md)

## Context

The writer wants a tab that holds a chapter up to the light. Instead of a
conversation, it lays the chapter out as a board of tiles: the counted facts
the Metrics tab already produces, and interpretive readings the product has
never offered in one place. Those readings are themes and motifs, a word
palette, the vibes characters give, subtext, genre and why, voice, adjacent
myths and stories, and which borrowed metaphor fields the prose leans on
("lexical gravity"). The board should be interactive, and its results should be
JSON so the renderer stays separate. The writer made seven decisions on
2026-10-19, recorded in the epic.

These facts in the current code shape the design:

1. **One webview bundle serves two roots.** `index.tsx` reads
   `data-pm-surface` and renders `WorkshopApp` or `App`. `WebviewSurface` is
   `'sidebar' | 'workshop'`, and three places branch on it with a binary
   ternary (`surface.ts:18`, `webviewHtml.ts:57/62-64`, `index.tsx:28`).
   ADR 2026-07-03 chose "one bundle, two roots" and deferred split entries
   until they hurt.
2. **The Workshop's header and rail are inline in a 1,822-line
   `WorkshopApp.tsx`.** The header mixes generic pieces (model selector,
   processed and balance chips, the provider-paused banner) with Workshop
   pieces (persona trigger, Sessions menu). About 950 `pm-ws-*` selectors are
   scoped to `[data-pm-surface="workshop"]`. `workshopStyles.test.ts` fixes
   the CSS import list and allows CSS imports only in `WorkshopApp.tsx` and
   `index.tsx`.
3. **The excerpt and context panels are views over the one Workshop
   session.** `ExcerptPanel` and `ContextPanel` are props-only, but every
   action behind them is a `WORKSHOP_*` route that changes
   `CoreServices.workshopSessionService`. Session state is posted only to the
   calling webview, and the mid-run guard is per `MessageHandler`. This is why
   `WorkshopPanelProvider.seedExcerpt` routes a synthetic message through the
   panel's *own* handler rather than writing the session from outside.
4. **Every webview gets a full `MessageHandler`.** Each instance builds all 12
   domains, a `WorkshopRoomHandler` included, over the one shared
   `CoreServices`. There is no per-surface route selection.
5. **The measure tools exist but know nothing about paragraphs.**
   `PassageProseStats`, `StyleFlags` and `WordFrequency` return whole-text
   aggregates with no offsets. Paragraphs are split privately with
   `/\n\s*\n/` to produce a count. Dialogue % matches straight quotes only,
   so curly-quoted dialogue reads as 0% (tracked separately, see
   Consequences).
6. **Structured generation has a proven shape.** Show vs. Tell validates
   before spending, makes one `engine.runInitial` call with the
   `assistantWithoutResources` policy, frames JSON between sentinels, decodes
   with exact-key helpers (`persistedValidation.ts`), parses `rawContent`,
   rejects `finishReason === 'length'`, quarantines undecodable paid bodies in
   the rejected-response recovery store, and cancels through a single active
   `AbortController` per attempt. `DictionaryService.generateParallelDictionary`
   is the precedent for concurrent calls with partial failure and summed
   usage. Its validation is all-or-nothing; no codec has a "withheld" state.
7. **Context-window preflight exists; cost preflight does not.**
   `AgentRunEngine.executeTurn` refuses a call that does not fit the model's
   context window (`RequestContextPreflight`). The context length comes from
   the live model catalog, which is filled when a webview requests model
   data. When the length is unknown, the engine skips the check and lets the
   provider decide. Pricing is in the catalog (`ModelOption.pricing`), but
   nothing estimates a request's cost before sending it.
8. **No quote verifier exists.** No code checks that a model's quotation
   actually appears in the source. The nearest pieces are a normalizing
   tokenizer in Creative Variations and Lexical Gravity's rule that a model
   may only reference ids the host declared.
9. **Precedent ceilings.** `PROMPT_BUDGETS.sourceDocument` and
   `contextFiles` are 50,000 words. The Workshop excerpt is 25,000 words.

## Decision

### D1. Lightbox is its own editor tab and a third surface in the shared bundle

The feature is named **Lightbox**, with "Inspiration & Mood Board" as the
header subtitle. It is a `WebviewPanel` beside the Workshop tab:
`LightboxPanelProvider` in `apps/vscode-extension/src/application/providers/`,
view type `prose-minion.lightbox`, opened by `prose-minion.openLightbox` and
by an editor context-menu command that seeds the selection or the active
file (the `seedExcerpt` pattern). It registers a panel serializer, so a reload
restores the tab.

**Launch entry points (2026-10-20, the writer's choice).** These are the
ways in beyond the Command Palette:
- The sidebar's Analysis tab has a **Lightbox** button beside **Workshop**. It
  posts `OPEN_LIGHTBOX`, which `UIHandler` routes to `uiActions.openLightbox`.
- `prose-minion.openFileInLightbox` ("Open File in Lightbox") boards a whole
  saved Markdown or plain-text file. It appears in the Explorer context menu,
  as a `$(layout)` icon in the editor title, and in the editor context menu
  when nothing is selected. From the Command Palette it boards the active
  editor's file.
- It sends the selection command's payload without text, through the same
  `seedSource`. "Open Selection in Lightbox" with nothing selected takes this
  path too.
- Untitled, non-disk and non-text sources are refused with a message before
  anything is sent. The word ceiling stays the Lightbox's own refusal.
- A dirty file boards its saved copy, the one "Re-read file" and D4's hash
  read, and the writer is told that unsaved changes are not on the board.
- The launch owns its source request from the moment its file is chosen. It
  takes the Lightbox's ticket before VS Code loads the document and boards
  under it, so a slow load never replaces a newer file, selection, picked
  file or re-read (PR #152 F-01). A refusal made without loading takes no
  ticket.

**Choose from project (2026-10-20, the writer's request).** The source
panel's button, and the board welcome's, is **Choose from project…**. It
opens the Workshop's "Choose from project" picker, which became a shared
full-tab component (`components/fulltab/ProjectResourcePickerModal`), in
single selection:
- It browses and searches the configured context-path catalog the Workshop's
  context selector reads, through the Lightbox's own routes (D10).
- One click boards the file, as "Choose file" did, through the same file
  source, so Re-read file and the D4 hash check read it like any other.
- Its "Explore project folders…" is the system picker, the old Choose file.
- The ticket is taken when the picked row reaches the host, before the
  catalog is opened.
- The Context list's **Add from project…** opens the same picker in attach
  mode (D9), as the Workshop's context panel does.

The Workshop's picker is unchanged: parity witnesses recorded against its
original modal, and the evidence's before and after shots, match.

The tab does **not** get its own webpack entry. It is a third
`WebviewSurface`, `'lightbox'`, rendered by a new `LightboxApp` root in the
existing bundle, per ADR 2026-07-03. The three binary branches on the surface
become exhaustive `Record<WebviewSurface, …>` maps, so a future fourth surface
cannot silently fall through to the sidebar.

The provider follows the existing guards. It constructs only
`new MessageHandler(this.coreServices, …)`, receives `CoreServices` from
`extension.ts`, adds `onWebviewPanel:prose-minion.lightbox` to activation
events, and raises the serializer count that `providerAssembly.test.ts`
asserts from one to two.

Options rejected:

- **A mode inside the Workshop tab.** The board's durable truth is a board,
  not a conversation, and a mode flag would add more branches to a
  1,822-line component.
- **A separate webpack entry.** It would conflict with ADR 2026-07-03 for no
  measured benefit.

### D2. A shared full-tab shell is extracted first, with no behavior change

Slice 1 extracts the frame both tabs share:

- **`FullTabShell`**, with slots for the brand (eyebrow, title, subtitle),
  header actions, banners, the rail, the main area, and an optional right
  aside.
- **`FullTabHeaderStatus`**, the generic cluster: model selector (assistant
  scope; from Slice 4L, the tab's own: the Lightbox's is `lightbox`), processed
  chip, OpenRouter balance chip.
- **`ProviderPausedBanner`**, with its copy passed in.
- **`FullTabRail`**, the `aside` with its error boundary, label passed in.
- **`useFullTabChrome`**, a hook that owns the generic state the Workshop
  computes inline today: models settings, token tracking, account balance,
  API key status, and the balance title. It comes with a route-table
  fragment, `buildFullTabChromeRoutes`, for the generic messages (`MODEL_DATA`,
  `SETTINGS_DATA`, `TOKEN_USAGE_UPDATE`, `ACCOUNT_BALANCE_DATA`,
  `API_KEY_STATUS`, `CLEAR_TRANSIENT_API_KEY_WARNING`). Both roots merge it
  into their own routers.

The Workshop's own blocks stay the Workshop's: the persona trigger, Sessions
menu, excerpt and context panels, tools block, to-do list and session
banners. They move into the shell's slots unchanged. `WorkshopApp.test.tsx`
must still find the heading "Workshop" and the label "Session rail".

**Styles.** Both full-tab roots stamp a second attribute,
`data-pm-frame="fulltab"`. Selectors for the shell's frame, tokens, header,
chips and rail move under that scope into `styles/fulltab/`. Workshop-only
selectors stay under `[data-pm-surface="workshop"]`. The shared stylesheets
are imported once from `index.tsx`, which the style test already allows. The
test gains a fixed list for `LightboxApp.tsx` alongside the Workshop's.

**Envelope sources.** The `source: 'webview.workshop'` literals in the generic
hooks (`useStartupNotice`, the settings opener) become a parameter, so the
Lightbox posts as `webview.lightbox`.

Option rejected: **copying the shell into the Lightbox.** It is cheaper today,
but the two copies would drift, and the Workshop's header has already changed
in most recent epics.

### D3. The board is a closed, ordered JSON document

The renderer sees only a `LightboxBoard`, defined in a new message module
`shared/types/messages/lightbox.ts` and exported from `@messages`:

```ts
interface LightboxBoard {
  boardVersion: 0;                    // draft until Slice 5 (see D12); 1 from Slice 5A
  boardId: string;                    // host-minted
  source: LightboxSource;             // displayPath, sourceUri?, contentHash,
                                      // wordCount, paragraphCount, capturedAt
  paragraphs: LightboxParagraphMetric[]; // one per ¶: index, words, sentences,
                                      // avgWordsPerSentence, dialogueShare
  measured: LightboxMeasuredSet;      // headline stats, standards comparison,
                                      // top words, POS lists, n-grams, hapax
  readings: LightboxReadingGroup[];   // three groups, each with a status
}
interface LightboxReadingGroup {
  group: 'A' | 'B' | 'C';
  status: 'not-run' | 'running' | 'ok' | 'failed' | 'cancelled';
  model?: string;                     // provider-reported, not the selection
  usage?: TokenUsage;
  tiles: LightboxTile[];              // ordered; closed `kind` union
  withheldBlocks: { kind: LightboxTileKind; reason: string }[];
}
```

`LightboxTileKind` is a closed union that grows by slice: `headline`, `motif`,
`tension-arc`, `character`, `voice`, `genre-neighbor` (2B); `palette-cluster`,
`swatch`, `gravity-field`, `gravity-collision`, `gravity-literal` (3);
`lineage`, `subtext`, `spark` (4); `stock-tiers`, `signature`, `familiar-phrase`,
`air-lock`, `echo`, `rhythm-endings`, `handoff`, `number-usage` (4B, 2026-10-20);
the story and Opinion kinds of Slices 4C and 4D as their specs fix them;
`steering-reading` and `steering-note` (4F, 2026-10-21). The
renderer has one component per kind
behind an exhaustive map. A kind with no component is a compile error, not a
runtime guess.

**The register is derived, never supplied.** A host table,
`LIGHTBOX_TILE_REGISTER: Record<LightboxTileKind, 'measured' | 'read' | 'counted-read'>`,
decides whether a tile is drawn solid, dashed, or neutral. No model output can
make a reading look like a count.

### D4. One paragraph model addresses everything

A single pure splitter, `splitLightboxParagraphs(text)`, produces the
paragraphs. It uses the same `/\n\s*\n/` rule `PassageProseStats` counts with,
so "48 paragraphs" means the same thing everywhere. Paragraphs are numbered
from 1 and carry their character offsets. A heading line between blank lines
is a paragraph. `contentHash` (SHA-256 over the normalized text) marks a board
stale when the file changes: stale readings stay visible but are labeled stale,
and their quotes are re-verified before anything is brought to the Workshop.

Per-paragraph metrics (words, sentences, average sentence length, dialogue
share) are new, deterministic, and computed in the same module. Per-paragraph
dialogue uses a quote matcher that handles both straight and curly quotes.

**The ribbon** draws one column per paragraph up to 96 paragraphs. Above that,
each column covers a contiguous range of paragraphs (rhythm averaged, tension
maximized, focus lit if any paragraph in the range is touched). The inspector
always shows exact paragraph numbers.

### D5. Measured tiles are free, automatic and host-computed

When a board opens or its source changes, the host runs the existing
`ProseStatsService`, `WordFrequencyService` and `StyleFlagsService`, enriches
with `StandardsService.enrichWithStandards`, adds the per-paragraph metrics
from D4, and posts the board. No model call is made and no cost is shown.
`LightboxService` calls the services directly rather than going through
`MetricsHandler`, and resolves text through the shared `TextSourceResolver`.

### D6. Readings run only on an explicit press, as three grouped calls

The **Read** button states the call count and estimated cost before anything
is sent. The readings run as grouped calls (three through Slice 4, one more per
story and craft group from Slice 4B), grouped so a failure in one cannot
sink the others:

| Group | Lenses (by slice) |
|---|---|
| A | headline, motifs, tension arc (2B); palette, lexical gravity (3) |
| B | characters, voice (2B); subtext (4) |
| C | genre neighborhood (2B); lineage, Spark (4) |
| D | Stock & signature, Rhythm & handoffs, What stands out in the numbers (4B, 2026-10-20) |
| E | Template & freshness, Pressure, Artifacts, Summary & movements (4C, 2026-10-20) |
| G | Craft steering: being verbs, adverbs (-ly), intensifiers and fillers, measured by construction and read per instance (4F, 2026-10-21). Read beside A–E; board order is A–E, G, F |
| F | Opinion, run after the other groups of a press settle (G included), on the board's verified digest (4D, 2026-10-21) |

A lens the writer turns off is left out of its group's prompt. A group with no
lenses on is not called.

- **Model:** the existing **assistant** model scope (writer decision 6), through
  `aiResourceManager.getEngine('assistant')` (*superseded by the addendum of
  2026-10-24 below: the Lightbox's own `lightbox` scope*), with the
  `assistantWithoutResources` policy. Token usage flows through the existing
  fan-out to the processed chip. Each group records the provider-reported
  model.
- **Execution:** the `generateParallelDictionary` pattern. Bounded
  concurrency, a timeout per call, partial failure allowed, usage summed.
- **Lifecycle:** the Show vs. Tell handler pattern. One active board run with a
  host-minted token and an `AbortController`, a cancel route, stale results
  dropped, and throttled progress messages. Cancelling keeps the groups
  already back.
- **Input framing:** the chapter goes to the model with host-numbered
  paragraph markers (`⟦¶12⟧`). Context files (D9) follow it in a separate,
  labeled section. The chapter is placed as the stable leading content of the
  user message, so the three calls share a prefix.
- **Output framing:** each group's response is one sentinel-framed JSON body
  (`===LIGHTBOX_GROUP_A_V1===` …). `rawContent` is parsed.
  `finishReason === 'length'` is a failed group. An undecodable body is
  quarantined through `persistRejectedWidgetResponse`, and the writer is told
  where it went.

**Addendum to D6 (2026-10-23): a call can run on its own** (Slice 4I; epic
decisions 41–45). After using the board on real chapters, the writer asked
for every AI-read widget to "kick off the call(s) associated with that
widget" and allow a re-run, and for the Lenses panel's "call A" to run or
rerun that call. The press model becomes:

- **Four scopes.** `LightboxRunScope` was `all | rest | lens`. It gains
  `{ mode: 'group', group, lens? }`: one call, by its group. "Run AI
  analyses" and "Re-analyze" send `all`, "Finish" sends `rest` (the calls
  with a lens on that are not back), a widget's Analyze sends `group` with
  its own lens, a call's Run in the Lenses panel sends `group` alone, and a
  tile's "Re-read" still sends `lens`.
- **The host resolves what a call reads.** The webview names a group and
  at most the lens pressed, never a list of lenses. The call reads its
  lenses that are on, with the lens named even when it is off; its other
  lenses that are off stay out (`lightboxGroupCallLenses`, through the one
  planner). A lens of another call, an unknown lens, a group that is no
  model call (counting, Measure, is free and makes none) and an unknown
  mode are refused before anything is reserved (`LightboxPressScope`).
- **A call run on its own is a full run of its group**: cleared first and
  replaced whole when it lands, as in a full run, so a re-run never mixes
  two calls' readings; the other calls keep theirs. Only a tile's re-read
  keeps its group's other lenses' tiles.
- **The Opinion keeps its reading until a new one lands** (epic decision
  47, the writer's). Group F run on its own (its Analyze, Run F) takes the
  tile re-read's path (`lightboxPressKeptLens`): its old tiles stay on the
  board, the group `running` with the Opinion pending, and the webview
  shows the old Opinion as the earlier one. The new one replaces it whole;
  a failure or a Stop leaves it exactly as it was, standing and stale marks
  included, with the reason. A failed call still lands its group, so the
  board saved after it holds the old Opinion; a Stop lands nothing and
  saves nothing. The digest leaves group F out, so the old Opinion is never
  weighed by the new one. Every other call run on its own, and a run of
  several calls, still clears first.
- **Group F alone reads the board as it stands.** It is refused, with
  nothing reserved or sent, while nothing on the board is read and current,
  in the Opinion's own words; the rule (`lightboxOpinionNothingToWeigh`,
  over `lightboxOpinionItems`) is shared with the webview, which disables
  the Opinion's Analyze with the same reason, and F's own check when its
  call opens on the digest stays the last word. Group G alone needs nothing
  read first: its task carries the board's measured counts, which every
  board has.
- **Everything else a press owns is unchanged.** The estimate's key, the
  model it priced, the board's adoption and the shelf's observation are
  checked as for any press, before and after its prompts load; one run of a
  board at a time, so a call pressed while another run is going is
  refused, and every control in the webview says why until Stop or the end.
  Each call's price is the estimate's own entry for that group (`groups`,
  one per group with a lens on), and the host fit-checks the exact call at
  the press.
- **A price is an approximate total, never a cap** (PR #166 F-01). Every
  call's estimate prices its input as sent and its output at what such a
  reply typically runs to, not at the output it may use; a control shows it
  as "≈ $…". Group F's input is priced at its digest's whole bound, and its
  control says so apart from the price ("· input at digest limit"), not by
  calling the total a bound. No budget is enforced.

**Addendum to D6 (2026-10-24): the Lightbox's own model** (Slice 4L; epic
decision 51, which amends decision 6). The model above was "the existing
**assistant** model scope". The writer found what that cost: choosing a
model in the Lightbox's header wrote `proseMinion.assistantModel`, so the
Workshop's model moved too, and its composer's cache estimate disappeared
(it shows only while the cache's request model is the selected assistant
model). The writer asked for a setting of the Lightbox's own.

- **A `lightbox` model scope** and a setting, `proseMinion.lightboxModel`,
  empty by default. It is a *following* scope (`FollowingModelScope`,
  `MODEL_SCOPE_FOLLOWS = { lightbox: 'assistant' }`): while its setting is
  empty it runs on the assistant model, after that model's own default, and
  moves when that one does, so nothing changes for a writer who never picks
  one. Picked, it is the Lightbox's own, and no Workshop pick changes it.
  One pure rule resolves every scope (`ModelScopeSelections`); the other
  five resolve exactly as before.
- **Its own engine and client**, built like every scope's by the one
  `AIResourceManager` the composition root constructs and carries in
  `CoreServices`, and hot-swapped in place. The runner reads
  `getEngine('lightbox')` and `getResolvedModel('lightbox')`, so the
  estimate's model, its live window and prices, the fit check and the
  press's model all follow the Lightbox's scope. No Lightbox module names
  the assistant scope; the architecture witnesses pin both.
- **A retired engine starts nothing new** (PR #169 F-01). A run keeps the
  engine it started on for every call, the Opinion last. When the key is
  removed or replaced, the manager detaches the provider of every
  disposable engine it retires, so one a run still holds refuses its next
  call as missing credentials, nothing sent; a request already sent
  settles. Rebuilds that overlap (each webview refreshes on a key change)
  are ordered: one overtaken while it read the key builds nothing, so an
  old key's transports never replace the new ones.
- **"Same as Workshop (…)"**, naming the Workshop's model, is how the
  Lightbox's picker, its model browser's first card and the Settings
  overlay's row show the unset state. Choosing it sends
  `SET_MODEL_SELECTION` with `modelId: null`, which only a following scope
  accepts: the setting is removed and the scope follows again. `MODEL_DATA`
  says which scopes follow (`following`).
- **Unchanged:** the `assistantWithoutResources` policy, the token fan-out
  to the processed chip, and saved boards, which record the
  provider-reported model per group.

### D7. Every reading is anchored, verified and allowed to strain

This is the honesty design of the board.

- **Quotes are checked in code.** A read claim carries one or more
  `{ para, quote }` pairs. The host verifies each quote against that one
  paragraph. It tries an exact match first, then a normalized match (NFKC,
  curly and straight quotes and apostrophes folded, dashes folded, whitespace
  collapsed; case is preserved). A paragraph number the host did not declare
  fails, after the Lexical Gravity referential-integrity rule. The match kind
  is recorded.
- **Claims are withheld, not hidden.** A quote that fails is shown as
  withheld with its reason. A claim with no verified quote is withheld
  entirely, by title. A block that fails structural validation is withheld by
  kind (`withheldBlocks`). Its group's other blocks survive. Validation is
  per block, not all-or-nothing per response.
- **The model never supplies counts.** Counted support (for example "presence
  walked beside ×3", or a gravity field's 31 hits) is computed by the host
  from terms the model names. A reading may name a field's terms; code counts
  them and finds their paragraphs.
- **Every lens names where it strains.** Each lens block must carry a
  `friction` note, and a block without one fails validation. Empty results
  are valid: "no strong mythic echo" is an honest lineage tile.
- **Readings describe, never grade.** Prompts and copy follow the Genre
  Relationship Explorer's boundary: resemblance is not quality, and no surface
  tells the writer to write toward a genre, myth or field. Spark tiles are
  offers phrased as questions.
- **Lexical gravity sets literal fields aside.** A field counts as gravity
  only when the prose borrows it. A field that is literal in the scene is
  shown as set aside, with the reason.

**Addendum to D7 (2026-10-20): one fenced exception to "describe, never
grade".** The writer's new sections (epic decisions 10–16) add two things
that come close to grading, and this addendum fences both:

- **The Opinion tile (Slice 4D) is the one evaluative tile.** It is the only
  place on the board allowed to weigh the work. The fence:
  - it is one tile, labelled "the one evaluative tile", and nothing else on
    the board reads it, so ignoring it changes nothing;
  - it runs last, on the board's verified digest (current tiles, their found
    quotes and host counts), never on a fresh read of the chapter, so it
    cannot invent a quote: it cites board items by host id;
  - one call returns a shared list of observations and three views of them
    (Enthusiastic, Neutral, Blunt): "same facts, three temperaments". A view
    may weigh only those observations, and code withholds a view that cites
    anything else;
  - Neutral is the default view; Blunt diagnoses the work, never the writer,
    and gives no rewrites, held by a stated word-list check;
  - it goes stale when any tile it cites changes.
  Every other lens keeps the rule above unchanged: describe, never grade.
- **The freshness reading (Slice 4C) is labelled "a reading, not a grade".**
  It is a three-step reading (Familiar · Mixed · Fresh), never a number, and
  it is always shown over a counted basis line the host joins from Group D's
  tier counts and Group E's subversion count, never restated by a model.
  Familiar is not a fault: the scale describes where a chapter sits, as
  genre affinity does.
- **Number standouts (Slice 4B) are not grades either.** Code flags a figure
  outside its range or far from the writer's own average; the reading says
  how it is used ("reads as deliberate", "mixed", "habit"), each quote
  holding an instance of the pattern, and never says fix or cut.
- **Echoes (Slice 4B) replace provenance.** A line that "sounds reminiscent
  of" something is shown with an accuracy callout: the quote is checked
  against the chapter, the resemblance is not, and a model's memory of
  sources is often wrong. No percentages; never a finding.

**Second addendum to D7 (2026-10-21): craft steering's nudges, a second
fenced exception.** The writer asked for analysis of being verbs, adverbs
and intensifiers that "steers the craft" (epic decisions 20–24, Slice 4F).
A steering note may say that an instance **leans** on its figure or
**compensates** for something thin, and may carry a **nudge**. That comes
close to advice, so it is fenced as the Opinion is:

- **One lens, three figures.** Only Craft steering (group G) may nudge, and
  only about being verbs, adverbs (-ly) and intensifiers and fillers, which
  it owns: the numbers lens no longer reads them. Every other lens keeps
  "describe, never grade" unchanged.
- **Measured first.** The host counts each figure, by the detector behind
  the numbers bar, and breaks it down by construction (the word-frequency
  tool's tagger), narration and dialogue, and runs of short sentences. A
  reading stands beside those counts and never supplies one.
- **Anchored to an instance.** A note is one quote the verifier found, and
  the figure's own detector finds an instance inside it; otherwise it is
  withheld by its host title. Its stance is a closed vocabulary (Earns ·
  Leans · Compensates), and a note that earns has no nudge.
- **A nudge names the craft move, framed as worth a look.** It never says
  cut, delete, remove, fix, wrong, bad, should or must, holds no quotation
  marks and no figure, and opens no clause with an instruction: a stated
  word-list check, not a parse. Decision 13 is amended for steering nudges
  only; nothing on the board says fix or cut.
- **One example, by the writer's choice.** The writer asked that a nudge
  may show "one example so the user understands". This supersedes "never
  supply the writer's words" for that one illustration and nothing else:
  - at most one per note that leans or compensates, never on one that earns;
  - its `before` is a run of whole words of the note's checked quote that
    holds the instance, checked by code where the quote is checked (fresh,
    on carry, at Bring); its `after` is a few words, different from the
    `before`, held to the nudge's word and quotation rules;
  - it is an illustration, labelled "One way it could go", never drawn or
    brought as a quote; the verifier never searches it and the Opinion
    never reads it;
  - a fault withholds the example alone, with the host's reason.
  The Workshop is where the real rewriting happens.
- **Out of the Opinion.** The Opinion's digest holds the measured counts and
  each note's stance, never a nudge or an example.

**Third addendum to D7 (2026-10-21): dialogue is voice** (epic decision 26,
Slice 4G). Being verbs, adverbs and intensifiers are a craft signal in
narration; inside dialogue they are the character's voice, so the fence
around nudges closes there for all three figures. A steering note whose
instance stands in dialogue (every instance its checked quote holds lies
inside a double-quoted span of `findDialogueSpans`, the split the steering
measure counts; single-quoted speech reads as narration) may still be
drawn, keep its stance and name a pattern ("every answer a character gives
is *I'm* and an adjective"), but it carries no nudge and no example. This is
a host rule, not only a prompt instruction (`LightboxSteeringVoice`): a
nudge or example the reading gives there is withheld with the host's
reason, fresh, on carry when the text moves an instance into or out of
dialogue, and at Bring; a note that leans or compensates with no nudge
stands only in dialogue; an example anchors only on an instance in
narration, on a span that takes in no speech at all, so a mixed note keeps
its nudge but never an example crossing into a character's words (PR #162
F-02); and every note in dialogue, whatever its stance, carries the host's
voice line, which the Opinion's digest, the board, the inspector and Bring
read as the mark of the character's voice (PR #162 N-01). Each paragraph's
instances and dialogue spans are found once per text and answered by
binary search (`LightboxSpanIndex`, PR #162 F-01), so these checks grow
with the text. The same decision counts contractions of be as being verbs,
through the one shared detector, so the rate, the quote check and the
steering totals still agree.

**Addendum to D6 and D7 (2026-10-23): asks versus gates** (Slice 4H; epic
decisions 37–40). On the writer's long chapters, whole blocks were withheld
for a note one character over its bound ("template.freshness.note must be a
string of at most 120 characters"), and a paid group failed because its
reply closed one brace too many. The writer: "If the model returns more
then just show it." The validation policy becomes:

- **A number a prompt states is an ask, not a gate.** The asks rose by
  about a quarter to a third (`PROMPT_BUDGETS.lightbox`; the prompt/budget
  sync test pins the prompts to them). A field longer than asked, and more
  quotes, items or sentences than asked, are read and shown, in every group.
  The codec withholds only a **real fault**: a missing field, a wrong type,
  a value outside its vocabulary, fewer items than a stated minimum, an
  unknown key, a quote the verifier cannot find, or a **structural rule**
  (one score or ending per ribbon column, the two fields of a collision,
  each lineage stance and each steering figure at most once, movements
  tiling the chapter, a host key's shape). The fences around the two
  evaluative exceptions stay gates: the Opinion's and steering's text rules,
  one example per note, none on a note that earns, dialogue as voice.
- **One safety ceiling, never in a prompt, for free prose only.** A
  claim, gist, note, friction, description or reason past
  `safetyMultiple` (8) times its ask is clipped with an ellipsis, counted
  and logged; nothing is withheld for it. **Every field a rule reads is
  read whole and never clipped** (PR #165 F-01): a quote (the verifier
  holds it to its paragraph), a term, a title or name used as a key or
  counted, a steering example (anchored in its quote), and every field a
  text rule checks, fresh, on carry or at Bring. So a clip can neither
  reject real evidence nor let an altered quote pass, and its ellipsis is
  never taken for the chapter's text. A whole response is refused only
  past eight times the characters the prompt asks for. The ceiling's only
  job is to keep runaway prose from breaking the layout or a saved board's
  size.
- **A surface with real bounds clips at that surface.** Bring to Workshop
  holds a tile to `WORKSHOP_LIGHTBOX_TILE_LIMITS`, which do not change: a
  title, claim, point, quote or steering example longer than its bound
  travels clipped with an ellipsis, after every anchor (a said line, a
  thread's plant, a handoff's two sentences, an example in its quote) is
  checked whole. A quote's start is still the chapter's own words. The
  Build lens seed clips a field's name and metaphor the same way, and still
  leaves out a counted term too long for it, since a cut term is not the
  chapter's word.
- **The output ceiling is 12,000 tokens a group** (D6 and D8's
  reservation), and the response asked for 48,000 characters.
- **A frame is repaired before it is rejected** (D6's "an undecodable body
  is quarantined", now only after this). The repair is deterministic and
  structure-only: stray or missing closing brackets, trailing commas, a
  code fence, curly quotation marks as a string's delimiters. A content
  guard tokenizes both texts and refuses any repair that would change, add
  or drop a string or other scalar. It lives in a feature-agnostic parser,
  `infrastructure/api/parsers/ModelJsonRepair.ts`, which imports nothing
  (a boundary test holds it to that) and throws an error carrying only
  positions and a closed reason; sentinels stay each caller's, so the
  Lightbox's frame alone accepts a reply with no closing sentinel whose JSON
  is complete. Each repair is logged by its kind.
- **A reply cut off at the output ceiling is salvaged** (D6's
  "`finishReason === 'length'` is a failed group", superseded). The blocks
  it finished are read; the block it was cut inside is withheld with the
  host's reason and where the paid reply was saved; lenses it never reached
  are reported as missing. The repair only closes the root, and the cut
  block is dropped, never trusted. The paid body is still saved for
  recovery, and every Lightbox recovery file now names its own group's
  sentinels and blocks.

**Second addendum to D6 and D7 (2026-10-24): unknown fields are forgiven,
and a member closed out of its block is moved back** (Slice 4K; epic
decision 50). On long chapters, mostly with Anthropic Opus models, the
writer kept losing whole groups to one structural slip. The real case:
group E stopped normally and was well formed, except that the model closed
its summary block one brace early, before that block's friction
(`…"movements":[…]},"friction":"…"}}`, the last brace stray). The stray
brace was already repaired, but `friction` then stood in the root, where
the format does not define it, and the root's unknown key failed the
group: "The group E response has 1 field the format does not define". All
four blocks were lost, three of them complete. This amends the addendum
above:

- **A field the format does not define is ignored, at every level** of a
  model's reply: the frame root, a block, an item, an object inside one,
  in groups A–G and the Opinion (F). It is counted, never named (a field's
  name is the model's text, PR #149 F-05), and logged as a count:
  `[LightboxReadingRunner] Group E ignored 1 field the format does not
  define`. It withholds nothing, and the decoders never see it
  (`LightboxReadingFields.replyObject` leaves it out of the object it
  returns). "An unknown key" leaves the addendum's list of real faults.
- **Everything else still withholds**: a missing required field (so a
  misspelled one is withheld for the field it stands in for, by the
  format's own name), a wrong type or a value outside its vocabulary, fewer
  items than a stated minimum, a quote the verifier cannot find, and the
  structural rules. A wrong or missing `version` still fails the group. An
  Opinion cite is still exactly one of its two shapes: a tile (with or
  without one of its quotes) or a measured figure, never both.
- **Ours stays strict.** The tolerance is the model replies' alone. A saved
  board is our own format, and its codec still refuses a field it does not
  read (`unknown-field`, D12); the Workshop's codecs keep
  `persistedValidation.exactObject`. A boundary test pins which modules read
  through `replyObject`.
- **A member closed out of its block is moved back** (`misnested-member`,
  `LightboxBlockFormat`), in the Lightbox's frame, not the shared parser,
  since only the Lightbox knows its blocks. A root member moves into the
  root member just before it, where the text puts it, only when that member
  is a block whose format defines the field and lacks it; a run of such
  members moves together (one misplaced brace). It never guesses past a
  gap: a member after `version`, after a member the format does not define,
  or after a block that holds the field already or does not define it,
  stays put and is ignored. Where a member stood is the text's order, which
  the shared parser reports (`rootKeys`), never the parsed object's
  (`JSON.parse` lists index-like keys first, and keeps a repeated key at its
  first place): with a root key written twice, nothing moves. Each block's
  fields are one table (`LIGHTBOX_BLOCK_FIELDS`), which every block decoder
  reads its block through.
- **A reply cut off at the output ceiling** (PR #168 F-01). The salvage
  keeps only finished members, so the member it was cut inside counts
  against the duplicate barrier too: a cut member repeating a kept key
  moves nothing, and a cut inside a root key, whose key is not known,
  moves nothing. A block the reply was cut inside is withheld as cut
  (decision 40's reason, with where the paid reply was saved) even beside
  an earlier copy of it, and so is a block whose closed-out member the
  reply was cut inside. The log says where the reply stopped, naming a
  block, or saying "a root member that is not a block", never a key of
  the model's.
- **A guard that cannot be checked moves nothing** (PR #168 N-01): a root
  too deeply nested to write out fails the guard, and the frame reads as
  it came. An optional repair never costs a sibling block.
- **The content guard, applied.** Moving members that stood just after
  their block to its end moves one brace past them: the strings and other
  scalars, and their order, are exactly as before. The repair checks the
  root before and after with `modelJsonContentMatches` and moves nothing if
  they differ. The guard compares scalars, not grouping (see the addendum
  above), so what may move is held by the rules here and by tests.
- **Only the root is re-nested.** The same slip inside a block (the
  Opinion's `blunt` view closed out of `views`, say) is not moved: with
  unknown fields forgiven the block is read, and withheld only if a
  required field is then missing. A block-to-item equivalent would need
  each nested object's source order and schema; it is not built (Slice 4K
  says when it would be worth it).

### D8. Input limits: a 50,000-word ceiling, a fit check, no silent shortcuts

New `PROMPT_BUDGETS.lightbox` constants, pinned by the prompt-budget tests:

- **`sourceWords: 50_000`. A hard ceiling (the writer's figure).** It matches
  the existing `sourceDocument` and `contextFiles` ceilings. A source over it
  is refused before anything runs, with the count and a suggestion to choose
  a chapter or a selection. The measured board runs up to the ceiling.
- **`chapterWords: 12_000`. A soft threshold.** Above it, the Read button's
  cost line says the text is book-sized and states the estimate, but still
  allows the press.
- **Context-window fit, checked once per board.** Before the press is
  enabled, the host estimates each group's request with the engine's own
  estimator (`estimateTextTokens`, `measureContextWindow`) against the
  Lightbox model's cached context length (the assistant model's until Slice
  4L). If a group cannot fit, the button
  is disabled with the reason and the largest size that would fit. If the
  context length is unknown, the press is allowed and the cost line says so,
  matching the engine's own rule. The engine's per-call preflight still
  applies.
- **Cost estimate (new code).** Estimated input and output tokens × the
  catalog's prompt and completion prices. Shown as "est. $0.04", or as "cost
  unavailable" when the catalog has no live pricing. The processed chip shows
  the real cost afterward.
- **No silent truncation or chunking.** Map-reduce over sections changes what
  a motif or a tension arc means. It belongs to the later manuscript work,
  with comparisons against a whole-book baseline.

At 50,000 words, each group sends roughly 75,000 estimated tokens. That fits
current 200K-window models with room for the output reserve. The cost line
makes that spend visible before the press.

### D9. Context informs readings but is never evidence

The rail's Context section attaches project files (no pasted text and no
wizard in this epic) through Lightbox's own routes. Context reaches the
readings as a labeled section after the chapter. Quotes must come from the
chapter: the verifier only searches the chapter's paragraphs, so a quote from
a context file fails like any other. Context counts toward the D8 fit check
under the existing `contextFiles` ceiling.

Since 2026-10-20 there are two ways to add context: **Add from project…**
(the shared picker in attach mode, several files at once) and its "Explore
project folders…" (the system picker). Both go through
`LightboxContextIntake` and meet the same rules:
- a file is not the board's own source;
- it is readable and not empty;
- it is not already on the shelf (the same absolute path, whichever way it
  came);
- it fits within `PROMPT_BUDGETS.contextFiles.words`, counted after the files
  added before it.

Every refusal is named in the rail with its reason. An add moves the shelf's
revision, so a press priced before it is refused and the webview estimates
again. A test pins that a quote from a file added this way is withheld.

### D10. Lightbox has its own message domain and host routes

A `LightboxHandler` (`application/handlers/domain/LightboxHandler.ts`) owns
the `LIGHTBOX_*` routes: open or refresh a board from a source, set the
source, add or remove context files, set lens toggles, run, cancel, and
re-read one tile. It never sends `WORKSHOP_*` messages. Lightbox's excerpt
and context are not the Workshop's (Context 3). A new `LightboxSourcePanel`
and a small context list render them. They are props-only views, like their
Workshop counterparts, with Lightbox's own copy and budgets.

The handler is the thirteenth domain in every `MessageHandler`, consistent
with how the other domains are registered today (Context 4). `LightboxService`
(board assembly, measured set, paragraph model, verifier, group runs, cost and
fit estimates) is built once in `extension.ts` and carried in `CoreServices`.
Its modules stay under 500 lines each. The webview mirrors the domain with a
`useLightbox` hook (tripartite interface) and presentation controllers for
the ribbon focus and the inspector.

**Project files (2026-10-20).** The shared project picker (D1) uses only
Lightbox routes:
- `LIGHTBOX_REQUEST_PROJECT_CATALOG` and `LIGHTBOX_SEARCH_PROJECT_CATALOG`
  (in `LightboxHandler`) answer from the Workshop's configured catalog
  (`WorkshopContextIntakeService` in `CoreServices`) and its content search
  (`ConfiguredResourceContentSearch`). They answer with Markdown and
  plain-text files only; anything else is left out, not shown disabled.
- `LIGHTBOX_CHOOSE_PROJECT_SOURCE` (in `LightboxHandler`) boards a file.
- `LIGHTBOX_ADD_PROJECT_CONTEXT` (in `LightboxReadingHandler`) adds context
  files under the shelf's rules (D9).

The webview names files by catalog key only, `{ group, path }`. The host
(`LightboxProjectFiles`) finds the key in a fresh catalog and checks that the
file is text and inside an open workspace folder. Every route is in the
Lightbox route ledger in `boundaries.test.ts`, and no Lightbox module names a
`WORKSHOP_*` route.

Two rules came from the PR #154 review:
- **Answers name their request (F-01).** Each catalog and search request
  carries a `requestId` the webview mints for that opening and that
  operation; the host echoes it and ignores a request without one. The
  webview takes only the answer it is still waiting for. Opening or closing
  a picker drops every pending answer, and clearing the search drops the
  pending search, so an answer to a closed opening, an older query or a
  cleared search never replaces what is on screen.
- **Identity is the host's (F-02).** Catalog rows and the shelf's files
  carry `fileKey`, an HMAC of the file's absolute path under a secret drawn
  once per extension session (`LightboxFileKey`), computed from the same
  path the shelf dedupes by. The Context picker marks a row attached only
  when its key is a shelf file's, never by display path, which two workspace
  folders can share. No absolute path crosses, and choices still name
  catalog keys only.

**Passages (2026-10-21, Slice 4E).** The board still carries no paragraph
text, only its source's preview. The inspector asks for the text a pinned
paragraph or counted item stands in:
- `LIGHTBOX_REQUEST_PASSAGE`, in `LightboxPassageHandler`, the third
  Lightbox handler. It names the board by id and content hash, under a
  webview-minted request id.
- The host answers `LIGHTBOX_PASSAGE` from the text that board was measured
  from, kept beside it in `LightboxService`. It never reads the file as it
  is now.
- It refuses a board no longer held, or held over other text, as `changed`.
  It refuses an item the board does not list as `not-on-board`.
- Each instance is found by the rule that made the figure it shows
  (`LightboxInstances`). So the instances lit equal the board's count.
- The webview takes only the answer it still waits for, about the board on
  screen. It keeps that answer in memory while it is pinned and persists
  none of it (D12).

### D11. Handoffs to the Workshop go through the Workshop's own message path

**Bring to Workshop** (Slice 4) and **Build as a lens** (Slice 3) cross tabs.
Neither lets Lightbox change Workshop state directly:

- Lightbox posts `LIGHTBOX_HAND_OFF` with a closed payload: a tile reference
  with its verified quotes, or a gravity field's name, governing metaphor and
  counted terms. `LightboxHandler` re-verifies the quotes against the current
  source, then calls a new `uiActions.handOffToWorkshop(handoff)`.
- The composition root implements that action. It calls a method on
  `WorkshopPanelProvider`, which reveals the Workshop and routes a synthetic
  `WORKSHOP_*` message through the panel's own `MessageHandler`, exactly as
  `seedExcerpt` does. The mid-run guard, provenance and session broadcast
  apply unchanged.
- A handoff that is not session state (a gravity seed) belongs to the panel
  that accepted it. The provider delivers it once, only when that panel's
  webview is listening and its tab is visible; a newer handoff replaces it,
  and closing the panel cancels it. The webview never opens a seed on
  arrival: it claims it, and the provider grants the claim only while that
  delivery is still the one it waits on for that panel, so a seed that timed
  out, was replaced or lost its panel never opens, even when its message was
  already sent. The grant is the commit point and cannot be revoked, so a
  newer handoff waits for the granted one's answer. The Workshop webview
  answers whether it opened the seed, and the Lightbox says the field was
  sent only on that answer (PR #150 F-03). The 20-second deadline covers
  unclaimed offers only; a granted seed waits for its answer, its panel
  closing, or its receiver resetting. Each webview realm announces itself
  with a receiver id once it is listening, and names it in every claim and
  answer; a seed is sent only after an announcement, and a new receiver on
  the same panel (a reloaded webview) settles what was granted to the old
  one as `reset`, sends again what was sent to it unclaimed, and ignores its
  late replies (PR #150 F-08). Readiness is checked when a seed is sent, so
  the guarantee is *visible at dispatch*: a tab the writer hides before the
  claim still runs, may open the seed and answer, and the writer finds it
  there; nothing reaches a model or is saved without their action. Every
  seed kind uses this protocol (`WorkshopSeedDelivery`, `seedDelivery.ts`);
  Slice 4's tiles join it as a new kind.
- The Workshop decides what arrives. A tile is staged above the composer, as
  an attachment the writer sends or removes. A gravity seed opens Lexical
  Gravity's **Build lens** with the subject filled in. Nothing is sent or
  installed without the writer's action in the Workshop.

The two new Workshop routes join the route ledger in `boundaries.test.ts`,
and any Lightbox file that names Lexical Gravity joins the approved
feature-surface list.

### D12. Boards are ephemeral until the last slice, then become a file format

By writer decision 5, saving comes last, so the board's shape can be reviewed
on real chapters before it becomes a contract.

- **Slices 2A–4.** The host keeps the latest board for each source in memory
  for the extension session. A hidden tab, or a restored one after a webview
  reload, gets it back. A window reload loses the readings, and the board
  says so in its run line. Webview `setState` holds only UI preferences
  (filter, selected tile, lens toggles), never the board.
  `boardVersion` stays `0`.
- **Slice 5.** Boards save to `prose-minion/boards/` as
  `<source-slug>-<source-hash>/<timestamp>.board.json` (the folder name as
  amended by the addendum below, PR #163 F-04), with `formatVersion: 1` and a codec
  of their own. Like transcript export, they are not part of the Workshop
  session codec. Availability follows `LexicalGravityLensRepository`: no
  folder or several folders means session-only, stated in the UI. The Boards
  rail lists saved boards for the open source. **Compare** reads two boards of
  the same source and shows measured deltas, paragraph-aligned tension, and
  the fields and motifs that appeared or vanished. When the paragraph count
  changed, the comparison is labeled approximate.

**Addendum to D12 (2026-10-22): saved boards, format 1** (Slice 5A; epic
decisions 25 and 27–32; amended for Slice 5A.1, decisions 33–36, and for
Slice 5A.2, decision 46 (2026-10-23), where marked). Slice 5 is split. 5A
saves, opens, deletes and restores boards; 5A.1 names them and builds the
writer's other calls on 5A; 5A.2 keeps one file per board and moves the
boards into the Workshop's design language; 5B, a later PR, compares two
of them. The format is fixed so that 5B needs no change to it.

- **The file.** One file per save, written once and never overwritten
  (5A; *from Slice 5A.2, one file per board, rewritten in place by the
  board's later saves: see below*):
  `prose-minion/boards/<source-slug>-<source-hash>/<timestamp>.board.json`.
  The slug is the source's path in `[a-z0-9-]` only, for the writer to
  read; the hash is the first eight hex digits of the SHA-256 of the
  source's portable key (`file:<path>`, or `selection:<path>:<lines>`), so
  two sources whose paths slug alike never share a folder (PR #163 F-04).
  Every path is checked for containment. Its shape:

  ```jsonc
  { "formatVersion": 1, "kind": "lightbox-board", "savedAt": "<ISO>",
    "board": { "boardId", "name"?, "rules", "sources": [ { …LightboxSource, "text" } ],
               "paragraphs": [ { "source": 0, "index", "start", "end", … } ],
               "ribbon", "measured", "readings" } }
  ```

  The board is the board on the wire: every tile kind with its host-derived
  fields, every group with its withheld claims and blocks, frictions, quote
  checks and stale marks, and every measured layer (the paragraph model with
  sentence lengths, the ribbon, the numbers with the writer's average as
  measured, `measured.hapax`, style flags with their paragraphs and ids, the
  Sections layer, craft steering's breakdown). `boardVersion` becomes 1.
  Webview preferences are not saved: the Opinion view showing, the filter,
  the pin, the lens toggles.
- **The name (Slice 5A.1, decision 33).** `board.name` is optional: the
  writer's own words for the board, to record the chapter version and the
  model (a name such as "3.2.1 - after the cut - model B"). Still
  `formatVersion: 1`, since format 1 has not shipped; an unnamed board is
  written exactly as before, so `board-v1.json` still reads and writes back
  byte for byte, and `board-v1-named.json` is its named companion. One rule
  (`lightboxBoardName`) serves the codec, the route and the rail: trimmed,
  one line (no control character, line or paragraph separator), at most
  120 characters; empty means unnamed. A name in a hand-edited file that
  does not read is left out and counted, as a dropped tile is, and the
  board opens whole, unnamed: a board is never lost over its name (the
  writer-data rule below). No rule id moves with a name. A name is writer
  text: logs never carry it, and the webview never persists it.
  - *A name belongs to the board*: its retained id and that board's saves.
    Naming the board on screen, or the file that holds it, names the
    retained board, so its later automatic saves carry the name; a re-read
    of unchanged text keeps it; "Read the current text" builds a new board,
    unnamed; naming any other saved file changes only that file; open and
    restore bring the file's name back. Session-only, the name is the
    in-memory board's.
- **One file per board (Slice 5A.2, decision 46).** The writer asked for
  the Workshop's design language without a `current.json`: a board's
  first save writes its file and names it by default,
  `<source file name> - <M/D/YYYY h:mm AM/PM>` in the extension host's
  local time ("Chapter 6 - 10/23/2026 9:08 AM"; a selection adds its
  lines), within the name rule. Its later saves (a run that landed
  readings, a spark set aside, a rename) rewrite that file in place
  through the rewrite below. "Read the current text" builds a new board,
  so it writes a new file with a new dated name. A file saved before names
  is listed under the default its source and saved time give and is not
  rewritten for it; opened, the board takes that name, and its next save
  writes it.
  - *Revisions.* A read names the bytes it decoded by their SHA-256, and a
    committed write reports its own; the retained board keeps the
    revision of the file it holds. A save in place rewrites only at that
    revision. A file another window changed since, or holds under a live
    claim, one with a part left out on reading, one that is gone, or a
    rewrite that fails is left exactly as it is, and the board saves to a
    new file in the same queue turn and follows it (the reload pointer,
    the row on screen). Two windows on one board can so leave two files;
    no save is lost and nothing is overwritten. A save the commit point
    declines writes nothing.
  - *A rename or spark mark of a file follows it* only when the board knew
    that file, so renaming an older file never moves the board to it.
  - *The board a save is owed (PR #167 F-01 and its re-review).* A save
    waits its turn in the store's queue, and another run may start on the
    board meanwhile: still reading (a group `running`, a lens `pending`,
    which the codec refuses to save), or cleared (decision 42) and stopped
    with nothing back. Either way the save writes the readings and rules
    its own run settled, exactly as captured. From the board at its turn it
    takes only the file, revision and name the board holds, and each spark's
    set-aside mark. A later run that lands saves itself. A board that was
    replaced is written as captured and never pointed at. With
    decision 47, the board saved after a failed Opinion call holds the old
    Opinion even when the Opinion runs again before the save's turn. The
    store's save status ("Save failed") clears on the next commit, by
    either path, before the commit is announced (N-01).
  - *A name given for the board on screen names the board it was typed
    for (PR #167 F-02).* The name sheet is opened for a board and its
    adoption, and closes when either changes; the rename carries the
    adoption, and the host refuses, with nothing written, a rename of the
    board on screen whose adoption has changed.
- **Sources are a list.** `sources` holds every source with its own text.
  Paragraph numbers stay the board's, 1 to N, so no reading changes shape;
  each paragraph names its source and its offsets into that source's text.
  A source's paragraphs are the run of board paragraphs that name it. Every
  board 5A writes has one source; one with more decodes, and this build
  says it cannot open it yet.
- **The text is saved,** so a reopened board shows paragraphs, wells,
  quotes and Bring checks against what was measured, and 5B can compare
  drafts. It is the writer's own text in the writer's own workspace. The
  codec checks it against the board's content hash. Logs never carry it.
- **Rule ids.** The board records which rules measured it, by stable ids
  defined beside each rule: `paragraphs` (the blank-line splitter),
  `sentences` (closing marks and speech tags, ADR 2026-10-21), `dialogue`
  (double quotation marks), `beingVerbs` (contractions and the next-word
  rule, decision 26) and `opinionBasis` (decision 25). A guard test pins
  each id to its rule's output on a fixed corpus and fails when the output
  changes and the id does not. A fresh board carries this build's ids; a
  saved board keeps its own, so 5B can label a comparison across rules.
- **The Opinion's basis is data** (decision 25). A citation's basis hashes
  the cited item's canonical data (its key and kind, quotes with ¶
  addresses, counts and figures, the reading's own words), never the
  digest's wording. Rewording the digest leaves every Opinion current.
- **A saved board only ever loses standing, never the board** (the
  writer-data rule, decision 32, 2026-10-22). Saved boards are the writer's
  data, and no change to an internal rule may make one unopenable. A file
  whose Opinion was cited under another basis rule (`rules.opinionBasis`)
  decodes and opens whole, as long as the id is well formed. Its Opinion is
  stale with the host's reason, "Saved under an earlier citation rule; read
  the Opinion again to bring it current.", its cited bases are not
  compared, and its Bring is refused with the same reason. Every other kind
  behaves as on any board. The board keeps that id while its readings are
  kept; reading the Opinion again cites it under this build's rule, and the
  board records that.
- **The codec** (`LightboxBoardCodec`, pure) is separate from the Workshop
  session codec, as transcript export is. Its keys are exact. Its decoders
  are typed against the contracts, so a new tile kind or field does not
  compile until the codec reads it. Invalid tiles and group notes are
  dropped and counted. The measured layers, the paragraph model, a group's
  own fields and its stale marks decode whole or the board is invalid: a
  dropped stale mark would show a stale reading as current. Any well-formed
  rule id is read and kept. Reasons are host-owned, and an unknown key is
  counted, never named. There are no
  migrations; a later format follows ADR 2026-07-30's release rule, with
  `board-v1.json`, written by this build from public-domain *Alice*, as its
  authentic fixture.
- **The store** (`LightboxBoardStore`) follows `LexicalGravityLensRepository`
  for availability (one folder saves; none, or several, is session-only,
  said in the rail) and `DictionaryHistoryStore` for writes: one queue, a
  staged temporary file, a synchronous commit point, then a rename that
  never overwrites. A file it cannot read is never overwritten or deleted.
  - *Private staging (PR #163 F-03).* The queue is one store's; another
    window on the same workspace has its own. Each write stages under a
    name with a random UUID in it, so no other writer writes over its
    bytes. A final name another writer took between the look and the
    rename is never reported as this save: the store takes the next free
    name and runs the commit point again, at most three times, then fails
    the save.
  - *Rewrites in place (Slice 5A.1, decisions 33 and 35).* A rename, and
    a spark set aside, rewrite the file that holds the board instead of
    saving a new one: the one exception to "written once". Through the same
    queue, a rewrite reads the file and checks it (it reads whole, a name
    that did not read aside, and holds the board expected), stages the new
    bytes privately, then *claims* the file: renames it, never over
    anything, to a name private to the write. A rename is atomic, so a file
    another window's store deleted first cannot be claimed and stays
    deleted, and once the claim holds no other writer can delete or rewrite
    it. The claimed bytes must be the bytes read, or the claim is put back
    and the file read again. Then the commit point, and the staged file
    takes the saved name, never over anything. The `FileSystem` port's
    `rename` allows `overwrite: true`, but a plain overwrite could bring a
    deleted board back; the claim cannot. The last rewrite to commit wins,
    each reports only bytes it wrote, and a rewrite, delete or read that
    finds the file claimed by another window says it is busy.
  - *Claims and deletes (PR #164 F-01, F-02).* A claim's name records when
    it was taken. Younger than a lease of 30 seconds, it is live and no
    other window touches it; older, it was abandoned. A listing that finds
    claims, and a read, rewrite or delete that finds its file gone, settle
    them: an abandoned claim with its saved name empty goes back under it
    (the newest, never over anything); one beside a standing file is a
    committed rewrite's leftover and is removed, never put back. A rewrite
    checks its claim is still there before its commit point. A delete
    claims the file as a rewrite does, removes every other claim of that
    name, young or old, and looks again; only when none is left does it
    remove its own, so no earlier version comes back after it. Otherwise
    it puts the board back as it was and fails (PR #164 re-review). A
    folder that cannot be read is never taken for an empty one: a read
    reports it `unreadable`, and `missing` means the folder was read and
    neither file nor claim was there; a read classifies every `missing`,
    and a board claimed again before it is read is `busy`. The one race left needs a writer stalled past the lease and
    another window's put-back and delete inside its final rename; a file
    system with only rename and delete offers no stronger lock.
  - *Complete listings (PR #163 F-04).* A source's folder is read whole:
    every board of the source is listed, newest first, and the same-text
    check reads them all. The rail shows the newest twenty and says how
    many there are ("Showing the newest 20 of 23", **Show older**). Each
    file's summary is cached by its size and modification time, so a
    listing decodes only the files that changed.
- **When a board saves** (decision 27): when a run ends having landed a
  group, and when a board with no readings is built for a source no saved
  board of which holds that text. From Slice 5A.2 the first save writes the
  board's file and the rest rewrite it (decision 46, above). No pruning.
  The writer confirmed that a stopped or partial run saves (decision 36,
  2026-10-22). A spark set aside,
  or brought back, saves at once (decision 35): the file that holds the
  board on screen takes that spark's mark in place, and no other (PR #164
  F-03), and no new file is written; a board no file holds yet takes its
  marks with its next save.
- **Open is a snapshot** (decision 29). An opened board shows exactly as
  saved, against its saved text, under its saved rules; nothing is measured
  again. When the file's text differs now, a notice at the head of the
  rail's Boards section offers **Read the current text**, the existing
  re-read, which carries the readings onto a board built from the file,
  marked stale (D4). The same notice also shows above the board itself
  (decision 34, Slice 5A.1), from the same shelf through one function, so
  the two appear and go together under the shelf's ordering guards. Bring
  from such a snapshot is refused with a reason that points there.
- **Who decides.** `LightboxBoardLibrary`, an application service built
  once at the composition root over the service, the store and the runner,
  decides when a board saves (through `LightboxBoardSaves` from Slice
  5A.2), opens and restores one, and lists and deletes them. A fourth
  handler, `LightboxBoardsHandler`, owns the saved boards' routes
  (`LIGHTBOX_REQUEST_BOARDS`, `LIGHTBOX_OPEN_BOARD`,
  `LIGHTBOX_DELETE_BOARD`, from Slice 5A.1 `LIGHTBOX_RENAME_BOARD`, and
  from Slice 5A.2 `LIGHTBOX_OPEN_BOARD_FILE`, which shows the host's
  file picker) and answers each with `LIGHTBOX_BOARDS` under its request
  id; each adoption,
  each committed save and each name given to the board on screen is pushed
  with `requestId: null`. A shelf names the adoption it was built for.
  The library's `LightboxBoardEdits` names boards and keeps spark marks,
  finding the file that holds the board at the rewrite's turn in the queue,
  so a save queued before a rename is the file the rename names.
- **The rail (Slice 5A.1, decisions 31 and 33).** A named row shows its
  name first and its date and time under it; every row names the models
  that read it, from the groups' provider-reported `model`, shortened and
  once each; the section's head names the board on screen ("Unnamed board"
  otherwise) with Name or Rename. A name is edited in place: Enter saves,
  Escape cancels, focus returns to the action; only an edit the writer made
  is sent (PR #164 F-04). *Replaced in Slice 5A.2 (decision 46) by the
  Boards menu and browser, below.*
- **The Boards menu and browser (Slice 5A.2, decision 46).** The rail's
  Boards section is gone: a side panel grows with every chapter analyzed.
  The Workshop's sessions menu and session browser became the full tabs'
  shared `SavedItemsMenu` and `SavedItemBrowserModal` (their CSS moved to
  `styles/fulltab/`, scoped to the frame at the same specificity; the
  Workshop's markup and computed styles are unchanged). The Lightbox's
  header carries a Boards menu (Rename board…, Board another chapter…, Open
  prior board…, the five newest boards of every chapter, Browse all
  boards…), and the browser lists **every chapter's** boards (name,
  chapter, saved time, lenses, cost, models, On screen), searched by name
  and chapter path and grouped by date or by chapter, with inline rename
  by the one name rule and delete with a confirm. The shelf lists every
  folder of the boards folder, summaries only, counting a folder it cannot
  read; opening another chapter's board is a source choice under the same
  ticket, adoption and observation guards. **"Open a board file…"** opens
  any `*.board.json` through the host's picker: one of the store's own by
  its id; any other decoded and opened as a snapshot no file of the store
  holds, never written, whose next save writes a new file in the store,
  keeping its board id and name; a malformed one is refused as a source,
  in the host's words. The changed-file notice stays above the board.
  **Compare (5B)** reads two boards, and with one file per board two text
  versions of a chapter are two boards.
  - *What an open, delete or rename left to say (PR #167 F-03).* The
    host's notice from an answer to any of the three is shown in a
    dismissible banner under the header (`role="alert"`), even when a
    newer request has taken the shelf. It outlives the name sheet and the
    browser. A board whose name its file does not hold says "Name not
    saved" in the menu, not "Saved". A refused source (malformed, missing)
    is still said on the board. A board from outside that has since saved
    here says so, and no longer that its next save writes it there (N-02).
    A picked file's read error is logged by its code, never its message
    (N-03).
- **Ownership.** An open is a source choice (PR #148 F-01, PR #152 F-01): it
  takes a ticket before its first await and adopts only under the newest.
  It never replaces a board a run is reading. Restoring on mount takes a
  ticket only when no source request has been made this session.
  - *Adoptions (PR #163 F-02).* A board keeps its id across saves and
    snapshots, so an id does not say which snapshot is on screen. The
    service numbers every adoption (built, opened or restored; readings
    landing keep it). Work that awaits captures the adoption first and
    checks it after: a press captures it with its snapshot and checks it
    once its prompts load, so a press still preparing when another snapshot
    of its board is opened is refused with nothing sent (the estimate key
    leaves it out: a snapshot of the same board has the same text and
    figures, so the estimate shown stays good for a press made after the
    open); a shelf built across a newer adoption is never posted (a
    push is dropped, a request's answer is built again); the webview never
    takes an earlier adoption's shelf over a later one's for the same
    board.
  - *Observations (PR #163 F-05).* Readings, saves and deletes keep the
    adoption, so shelves are also ordered within one: each takes an
    observation number, in order, before its first await. A handler never
    sends a webview a shelf of a board observed before one it already sent
    of that board (a push is dropped, a request's answer is built again),
    and the webview never takes one observed before the one it holds.
    Every change the rail must hear starts a newer observation (an
    adoption's push, a committed save's push, a delete's answer), so a
    dropped shelf has nothing newer to say.
- **Reload** (decision 30). A window reload, or reopening the tab after one,
  reopens the last board the writer had on screen from the store. The
  pointer is a workspace memento, the one new port (`LightboxBoardMemory`).
  It follows every adoption (PR #163 F-01): coming back to a board a file
  already holds points at that file and writes nothing; a board no file
  holds yet points at the file its save commits, or the newest file
  holding its text. A restore forgets the pointer only when neither its
  file nor a claim on it is there; a board left under an abandoned claim
  is put back and restored, and one another window holds now keeps the
  pointer for a later session (Slice 5A.1; PR #164 F-02).
  This amends the consequence below: in a single-folder workspace readings
  come back after a reload; session-only mode keeps the old behaviour.

### D13. Boundaries

- `packages/core` gains no `vscode` imports. The provider and commands are
  adapter code.
- Lightbox modules join explicit lists in `boundaries.test.ts`: services
  constructed only at the composition root, the handler constructed only in
  `MessageHandler`, Lightbox presentation controllers free of `useVSCodeApi`,
  `MessageType` and `postMessage`, and the feature-surface entries D11
  requires.
- The prompt bundle lives in `resources/system-prompts/lightbox/`. Its worked
  examples decode through the production codec in a test, as Show vs. Tell's
  do. Fixtures are public-domain prose. No manuscript text is committed.

## Consequences

**Positive**

- The writer gets the counted board instantly and for free, and readings only
  when they choose to pay for them.
- Every interpretive claim carries quotes that code has checked, which
  answers the main risk of a vibes board: a model confidently over-reading.
- The shell extraction shrinks `WorkshopApp.tsx` and gives future full-tab
  surfaces (Branch Board, the desktop shell) a frame to reuse.
- The handoffs make Lightbox a launchpad into widgets that already exist
  (Lexical Gravity now; the Topic and Genre Relationship Explorers once
  built), not a second chat.

**Costs and risks**

- **Slice 1 touches the Workshop before any Lightbox feature exists.** It is
  a pure refactor guarded by the existing Workshop tests, but it moves about
  950 selectors' scopes and the header's state.
- **A third full `MessageHandler`.** The Lightbox webview gets every domain,
  a third `WorkshopRoomHandler` and another secret-change refresh, as the
  sidebar already does. Per-surface route tables are tracked as tech debt
  ([2026-10-19](../../.todo/tech-debt/2026-10-19-per-surface-message-handler-routes.md)).
- **Spend at the ceiling.** Three calls over a 50,000-word source send about
  225,000 estimated input tokens. The cost line, the soft threshold and the
  fit check are the mitigation.
- **The counted tiles inherit the measure tools' heuristics.** Readability is
  `100 − 2 × words/sentence`, not Flesch, and whole-text dialogue % misses
  curly quotes
  ([tech debt](../../.todo/tech-debt/2026-10-19-prose-stats-dialogue-curly-quotes.md)).
  The board's per-paragraph dialogue lane would disagree with the headline
  figure until that is fixed, so the fix is a prerequisite of Slice 2A.
- **Readings are lost on a window reload until Slice 5.** That is the price
  of reviewing the shape before fixing the format. *Amended 2026-10-22
  (Slice 5A, D12 addendum):* in a single-folder workspace the last board on
  screen comes back from `prose-minion/boards/` after a reload, readings
  and all. With no folder, or several, boards are session-only and a reload
  still loses them, as the rail says.

## Open questions

1. **Prime then fan out?** Anthropic prompt caching cannot serve three
   parallel calls a prefix that none has written yet. Slice 2B measures
   whether starting groups B and C after group A's first token produces cache
   reads, and whether a board run should supply a caching intent. That
   would extend ADR 2026-10-03, which today gives one-off runs none. Until
   measured, the groups run in parallel.
   - *2026-10-19, Slice 2B:* not measured; the slice made no live calls.
     The groups run in parallel with no caching intent, and the measurement
     moves to Slice 6's live-provider pass. Each group's system prompt
     carries its own lens files, so the three calls share no leading prefix
     today. See the
     [slice notes](../../.todo/epics/epic-lightbox-2026-10-19/slice-2b-first-readings.md#implementation-notes-2026-10-19).
2. **Pull baselines.** Lexical gravity's pull means more against the rest of
   the manuscript. That needs the multi-chapter work, out of scope here.
3. **Tension scale at book length.** Above 96 paragraphs, is tension scored
   per ribbon column (fewer output tokens) or per paragraph and then
   aggregated? Slice 2B decides on fixture evidence.
   - *2026-10-19, Slice 2B:* per ribbon column, one score per paragraph up
     to 96 paragraphs and one per column above, a column taking its tensest
     paragraph. On the Alice fixtures the whole book would need 815 scores
     per paragraph against 96 per column (about 8.5 times the output), and
     one miscount withholds the whole block. See the
     [slice notes](../../.todo/epics/epic-lightbox-2026-10-19/slice-2b-first-readings.md#implementation-notes-2026-10-19).

## Out of scope

- Multi-chapter and manuscript boards, and whole-book baselines.
- Chunking or summarizing sources over the ceiling.
- Writing toward any genre, myth or field. This is deferred permanently, as
  in the Genre Relationship Explorer.
- Image generation for the mood board. Swatches and type carry the mood.
- A dedicated `lightboxModel` setting (writer decision 6). Revisit if the
  assistant model proves the wrong default. *Revisited 2026-10-24: it did
  (epic decision 51; the addendum to D6 of that date).*
