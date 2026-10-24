# Slice 4L: The Lightbox's own model setting

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) D6, and its **addendum of 2026-10-24, the Lightbox's own model**
**Writer decision:** 51 in the [epic table](README.md#writer-decisions-2026-10-19); it amends decision 6
**Status:** Built on `epic/lightbox-model-setting`, from `epic/lightbox` at `cf7f260` (Slice 5A.2, PR #167). PR to come.

## Why

The writer noticed that changing the model in the Lightbox cleared the
Workshop's prompt-cache timer. The Lightbox read with the shared
**assistant** model scope (decision 6), so its header's picker wrote
`proseMinion.assistantModel`: the Workshop's model moved too, and the
composer's "Est. Cache Time Remaining" disappeared, because it shows only
while the cache's request model is the selected assistant model
(`WorkshopApp`, `cacheRequestModelId === modelSelections.assistant`). The
writer approved giving the Lightbox a model setting of its own, so the two
stop crossing.

## 1. A `lightbox` model scope

| | |
|---|---|
| Scope | `ModelScope` gains `'lightbox'`. It is the one `FollowingModelScope`: `MODEL_SCOPE_FOLLOWS = { lightbox: 'assistant' }` |
| Setting | `proseMinion.lightboxModel`, a string, **empty by default**. Its description: "AI model for the Lightbox's analyses. Leave empty to use the same model as the Workshop (`proseMinion.assistantModel`), following it when it changes. Choosing a model here, or in the Lightbox's model picker, gives the Lightbox its own, and never changes the Workshop's." |
| Unset (empty, whitespace, or removed) | The Lightbox **follows the Workshop**: it runs on the assistant model, after that model's own default, and moves when that one does. Nothing changes for anyone who has not chosen one |
| Set | The Lightbox's own. A Workshop pick never changes it |
| One rule | `infrastructure/api/orchestration/ModelScopeSelections.ts` resolves every scope: the five own scopes exactly as before (their setting, or a default when absent; a blank one stays blank, so the hot-swap names it), then the following scopes. `AIResourceManager` and `ConfigurationHandler` both read it, and `MODEL_SCOPE_SETTING_KEYS` names each scope's setting |

**The wording, unset: "Same as Workshop (…)"**, with the Workshop's model
named in the parentheses: on the
Lightbox's header chip, as the first card of its model browser (checked
while it follows, with "The Lightbox reads with the Workshop's model and
follows it when it changes. Pick a model to give the Lightbox its own; the
Workshop keeps its model either way."), and as the first option of the
Settings overlay's Lightbox Model row. "Workshop" rather than "assistant":
the writer thinks of the two tabs side by side, and the header chip there
is the Workshop's. The overlay's row says the bridge plainly: "'Same as
Workshop' uses the Assistant Model above and follows it when it changes".
While it follows, the model it resolves to is not itself checked in the
browser, so the writer can tell "the Workshop's model, whatever it becomes"
from "this model, kept".

## 2. Its own engine and client

- **Built at the composition root, like every scope.** `extension.ts`
  constructs the one `AIResourceManager` and carries it in `CoreServices`;
  the manager builds each scope's `OpenRouterClient` and `AgentRunEngine`,
  now the `lightbox` scope's too (`createResourceBundle(apiKey, 'lightbox',
  …)`), a disposable bundle beside the dictionary's and the widget's. No
  handler constructs one; the architecture witnesses pin it (below).
- **Hot-swapped in place.** `refreshModelSelections` moves only the scopes
  whose model changed: a Lightbox pick moves only the Lightbox engine; a
  Workshop pick moves the assistant engine, and the Lightbox's too only
  while it follows.
- **Without an API key** there is no Lightbox engine, so the host refuses a
  press before reserving anything ("Add an OpenRouter API key in Settings
  to run AI analyses."), where the assistant's offline engine used to take
  it and fail its calls; the webview already disables the press then. Its
  model still resolves, so the estimate shows its price.
- **The runner.** `LightboxReadingRunner` and `LightboxReadingEngines` move
  from `'assistant'` to `'lightbox'`: `modelFacts()` (the estimate's model,
  live window and prices, so the fit check and the costs) and the engine a
  reservation checks and a run uses. Nothing else in the runner changed.
- **Writer-facing copy** that said "the assistant model" in the Lightbox
  says "the Lightbox model": a press for a model not yet in use ("The model
  this press names is not the Lightbox model in use yet…") and a call too
  large for an unnamed model's window.

## 3. Settings sync, both ways

As "Adding New Settings" lays out (AGENTS.md; ADR 2025-11-03):

1. **`package.json`**: `proseMinion.lightboxModel` (above).
2. **`ConfigurationHandler`.** The getter, `getEffectiveModelSelections`,
   includes `lightbox` (its own model, or the assistant's); `MODEL_DATA`
   gains `following: ['lightbox']` while it follows, `[]` once it has its
   own. The update path, `handleSetModelSelection`, writes
   `lightboxModel` for the `lightbox` scope, and takes `modelId: null` for
   a following scope only ("Same as Workshop"): the setting is removed, so
   it reads empty and follows again. `null` for any other scope, or an
   unknown scope, is refused with an error and nothing written.
3. **The domain hook.** `useModelsSettings` gains `followingModelScopes`
   (from `MODEL_DATA`, persisted, following by default) and
   `followModelSelection(scope)`; `setModelSelection('lightbox', …)`
   leaves following at once. Model ids travel by `MODEL_DATA`, as the other
   five scopes' do; `SETTINGS_DATA` carries none of them.
4. **The `MessageHandler` config watcher.** `proseMinion.lightboxModel`
   joins `MODEL_KEYS`, so the existing semantic methods hot-swap it
   (`refreshModelSelections`) and broadcast `MODEL_DATA` to every other
   webview (`shouldBroadcastModelSettings`). One line.
5. **App wiring.** `App.tsx` passes `followingModelScopes` and
   `onFollowModel` to the Settings overlay; `LightboxApp` gives its header
   `modelScope="lightbox"` and `useLightbox` the Lightbox's selection
   (`lightboxModel`), which it waits on before pricing a press, as it
   waited on the assistant's.
6. **Both ways:** Settings overlay → VS Code settings → the Lightbox's
   picker; the Lightbox's picker → VS Code settings → the overlay; and an
   edit in VS Code's Settings UI → both. Emptying it there makes it follow
   again.

## 4. No cross-talk

- **Lightbox → Workshop.** A Lightbox pick writes `lightboxModel` only.
  The assistant engine, the Workshop's model, its context budget and its
  cache estimate do not move.
- **Workshop → Lightbox.** A Workshop pick writes `assistantModel` only. A
  Lightbox model that has been set stays; an unset one follows, as its
  fallback says.
- **What shows the Lightbox's model** reads the lightbox scope: the header
  chip, the estimate and so the run line, every call's and widget's
  Analyze price, the fit check, and the press's model.
- **Saved boards** need no change: each group records the provider-reported
  model, which is the Lightbox engine's.

## Files

| File | Change |
|---|---|
| `shared/types/messages/configuration.ts` | `ModelScope` + `'lightbox'`; `FollowingModelScope`, `MODEL_SCOPE_FOLLOWS`, `isFollowingModelScope`; `SetModelSelectionPayload` takes `modelId: null` for a following scope; `ModelDataPayload.following` |
| `infrastructure/api/orchestration/ModelScopeSelections.ts` (new, 85 lines) | The scope rule, its setting keys, `DEFAULT_WIDGET_MODEL` (moved) |
| `infrastructure/api/orchestration/AIResourceManager.ts` | The `lightbox` bundle; resolution moved out with its dead `modelConfig` and `apiKey` parameters (501 → 462 lines) |
| `application/handlers/domain/ConfigurationHandler.ts` | `lightbox` in the getter, `following` in `MODEL_DATA`, `null` in the update path, the scope table for setting keys (595 → 600 lines) |
| `application/handlers/MessageHandler.ts` | `proseMinion.lightboxModel` in `MODEL_KEYS` (973 → 974 lines) |
| `infrastructure/lightbox/LightboxReadingRunner.ts`, `LightboxReadingRunContracts.ts` | `'assistant'` → `'lightbox'` (498 lines, unchanged count) |
| `LightboxReadingHandler.ts`, `LightboxRunEstimate.ts`, `LightboxPressSnapshot.ts`, `lightboxRunLine.ts`, `lightboxCallControls.ts`, `lightboxEstimate.ts`, `lightboxRuns.ts` | "the Lightbox model" in copy and comments |
| `presentation/webview/hooks/domain/useModelsSettings.ts` | `followingModelScopes`, `followModelSelection` |
| `components/shared/ModelSelector.tsx`, `ModelBrowserModal.tsx`, `modelFollowing.ts` (new) | The follow choice: the chip's words and the browser's first card. The chip's tooltip now names the current model whole, as its accessible name does, since the header chip truncates "Same as Workshop (…)" |
| `components/fulltab/FullTabHeaderStatus.tsx` | `modelScope` (`'assistant'` by default, `'lightbox'` for the Lightbox) |
| `components/SettingsOverlay.tsx`, `App.tsx` | The Lightbox Model row and its wiring (716 → 728 lines) |
| `LightboxApp.tsx`, `hooks/domain/useLightbox.ts` | The Lightbox's scope and selection (`useLightbox` 469 → 470 lines) |
| `index.css` | `.mb-follow`: the follow card above the models |
| `apps/vscode-extension/package.json` | The setting |

## Tests

New and changed (all model ids are placeholders; no provider is called):

- **Scope resolution** (`ModelScopeSelections.test.ts`, 10): set uses the
  Lightbox model; unset, empty or whitespace falls back to the assistant
  model; clearing falls back again; the fallback follows the assistant
  model's own default; the five other scopes resolve exactly as before.
- **The manager's engines** (`AIResourceManager.test.ts`, +5): the Lightbox
  has its own engine, not the assistant's; a Lightbox pick hot-swaps only
  it and never calls the assistant engine's `setModel`; a set Lightbox model
  survives an assistant change; unset it follows, and again once cleared;
  no key, no engine, but a resolved model.
- **Host sync and cross-talk** (`LightboxModelSetting.test.ts`, 8, over
  `modelSettingsHarness`: one settings store, the real manager, a real
  `ConfigurationHandler` per webview and the watcher's hot-swap and
  broadcasts): a Lightbox pick writes `lightboxModel` and never
  `assistantModel`; a Workshop pick never changes a set `lightboxModel`;
  unset, the Lightbox follows a Workshop pick; "Same as Workshop" removes
  the setting; `null` for another scope, or an unknown scope, is refused;
  overlay → settings → Lightbox; Lightbox → settings → overlay; VS Code
  settings → both, set and emptied.
- **The writer's symptom** (`LightboxModelCrossTalk.test.tsx`, 3): the real
  Lightbox root's header picker chooses a model; the real Workshop root,
  replayed everything its own host sent it, keeps "Est. Cache Time
  Remaining: … min", its chip still names its own model, and
  `assistantModel` never moved. And a Workshop pick, seen from the
  Lightbox's picker: "Same as Workshop (the new model)" unset, its own when
  set.
- **The hook** (`useModelsSettings.test.ts`, +6), **the header chip**
  (`FullTabHeaderStatus.test.tsx`, +4), **the overlay row**
  (`SettingsOverlay.test.tsx`, +3).
- **The watcher** (`MessageHandler.test.ts`, +2): the key hot-swaps; an
  external edit broadcasts `MODEL_DATA`, its own write does not.
- **Composition root** (`boundaries.test.ts` +1, `providerAssembly.test.ts`
  +2): only `AIResourceManager` constructs an `AgentRunEngine` or an
  `OpenRouterClient`, and it builds the `lightbox` bundle; core never
  constructs the manager, `extension.ts` constructs it once, puts it in
  `CoreServices` and hands it to the runner; no app module builds an engine
  or client; no Lightbox module asks for the assistant scope's engine or
  model; the setting is declared, empty by default.
- **Moved to the new scope:** `LightboxModelSelection` (the picker is the
  Lightbox model's; its host resolves through the real rule, asks only the
  Lightbox engine, and leaves `assistantModel` alone), the runner's engine
  test, the press-model message, and the Lightbox roots' model
  confirmations (`selections.lightbox`).

### Base failures

The new and changed test files, copied into an export of `cf7f260`:

- **With type checking** (as CI runs them): 18 suites fail, 7 of them
  unable to compile there (`ModelScopeSelections`, the `lightbox` scope,
  `followModelSelection`, `followingModelScopes`, `modelId: null`), and 34
  tests fail in the others.
- **With type checking off** (to see each test): 58 of 226 tests fail, in
  every new and changed suite. Among them:
  - **the writer's symptom**, `LightboxModelCrossTalk`'s "keeps the Workshop
    composer's cache expiry when a model is chosen in the Lightbox": the
    expiry is shown before the pick and gone after it, because `cf7f260`'s
    Lightbox picker posts `scope: 'assistant'`;
  - all 8 of `LightboxModelSetting`, the 5 new `AIResourceManager` cases,
    the 6 new `useModelsSettings` cases, 3 of the 4 new header-chip cases, 2
    of the 3 new overlay cases, both new watcher cases, the new boundary and
    assembly witnesses, the runner's engine case, the press-model message,
    and the Lightbox roots whose confirmations now read
    `selections.lightbox` (`LightboxAppEstimates` 5, `Readings` 5,
    `RunControls` 13, `Opinion` 1).
  - They pass there, as controls: the Workshop's chip keeping the assistant
    scope with no follow choice, and the overlay's other rows offering no
    "Same as" choice.

## Verification

After `npm ci` into a real `node_modules`:

- **Tests:** 508 suites / 7,053 tests / 59 snapshots, all passing under
  Node 22 and Node 18.20.8 (505 / 7,009 / 59 at `cf7f260`: 3 suites and 44
  tests added).
- **Lint:** 0 errors; warnings identical to `cf7f260` per file, rule and
  severity (1,133 each).
- **Typecheck** passes under each Node.
- **Builds:** `npm run build` (with `verify:bundle`) twice under each
  Node, all four with `webview.js`
  `6a08cf5c82fb84691c7daba7dde3cef97fd87066e5bfe7144356a540f2b23f45` and
  `extension.js`
  `ee1ecf3159692348532db00428326439f71cbf6d2c0ada909eefdb215e5dc8c3`.
- The diff's whitespace check is clean.

## Visual evidence

[`docs/pr-reviews/evidence/lightbox-slice-4l-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-4l-visual/README.md),
from real host output at 1440, 1000 and 500 px: the Lightbox's picker unset
("Same as Workshop (Workshop placeholder)", its browser's first card
checked) and set (its own model, the estimate priced on it); the Settings
overlay's Lightbox Model row unset and set; and the Workshop composer's
cache estimate before and after a model is chosen in the Lightbox,
unchanged. `errors.txt` is empty. Against `cf7f260`'s bundle the same
harness writes 36 errors, among them the writer's symptom: after the
Lightbox's pick, the Workshop's chip names the Lightbox's model and its
cache estimate is gone.

## Writer's calls

- **Seeding.** Should the first open of the Lightbox *copy* the current
  assistant model into `lightboxModel`, so it no longer follows? This slice
  does not: unset, it follows, which keeps everyone's behavior the same
  until they choose. Seeding would freeze the Lightbox on whatever the
  Workshop used that day, silently.
- **The wording.** "Same as Workshop (…)". The overlay's other rows call
  the scope "Assistant Model"; if the writer would rather the Lightbox say
  "Same as Assistant Model", it is one constant (`MODEL_FOLLOW_COPY`).
