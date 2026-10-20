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
  scope), processed chip, OpenRouter balance chip.
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
  boardVersion: 0;                    // draft until Slice 5 (see D12)
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
`lineage`, `subtext`, `spark` (4). The renderer has one component per kind
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
is sent. The readings run as up to three calls, grouped so a failure in one
cannot sink the others:

| Group | Lenses (by slice) |
|---|---|
| A | headline, motifs, tension arc (2B); palette, lexical gravity (3) |
| B | characters, voice (2B); subtext (4) |
| C | genre neighborhood (2B); lineage, Spark (4) |

A lens the writer turns off is left out of its group's prompt. A group with no
lenses on is not called.

- **Model:** the existing **assistant** model scope (writer decision 6), through
  `aiResourceManager.getEngine('assistant')`, with the
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
  assistant model's cached context length. If a group cannot fit, the button
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
  `<source-slug>/<timestamp>.board.json`, with `formatVersion: 1` and a codec
  of their own. Like transcript export, they are not part of the Workshop
  session codec. Availability follows `LexicalGravityLensRepository`: no
  folder or several folders means session-only, stated in the UI. The Boards
  rail lists saved boards for the open source. **Compare** reads two boards of
  the same source and shows measured deltas, paragraph-aligned tension, and
  the fields and motifs that appeared or vanished. When the paragraph count
  changed, the comparison is labeled approximate.

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
  of reviewing the shape before fixing the format.

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
  assistant model proves the wrong default.
