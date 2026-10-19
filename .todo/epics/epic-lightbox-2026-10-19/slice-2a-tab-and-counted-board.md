# Slice 2A: The Lightbox Tab and the Counted Board

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D1, D3, D4, D5, D8 (ceiling), D10, D12 (ephemeral)
**Status:** Planned
**Prerequisite:** [Dialogue % misses curly quotes](../../tech-debt/2026-10-19-prose-stats-dialogue-curly-quotes.md) is fixed, so the headline figure and the per-paragraph lane agree.

## Outcome

"Prose Minion: Open Lightbox" and "Open Selection in Lightbox" open an editor
tab built on the Slice 1 shell. The writer picks a file or sends a selection,
and the board shows the counted tiles with no model call: headline stats,
the standards comparison, top words, parts of speech, repeated phrases and the
paragraph ribbon (rhythm and dialogue lanes). Hovering a word, phrase or
ribbon column lights the paragraphs it touches. Clicking pins it in the
inspector. The reading tiles render as "not read yet" placeholders, and the
Read button is present but disabled until Slice 2B.

## Host

- **Provider:** `apps/vscode-extension/src/application/providers/LightboxPanelProvider.ts`
  - a `WebviewPanelSerializer`, view type `prose-minion.lightbox`,
    `retainContextWhenHidden`;
  - `attachPanel` mirrors the Workshop's and constructs only
    `new MessageHandler(this.coreServices, …)`;
  - `seedSource({ text?, sourceUri?, relativePath? })` routes a synthetic
    `LIGHTBOX_SET_SOURCE` through its own handler, the `seedExcerpt`
    pattern.
- **Composition root** (`extension.ts`):
  - construct the provider with `CoreServices`;
  - register its serializer (the `providerAssembly.test.ts` count goes from 1
    to 2);
  - add the commands `prose-minion.openLightbox` and
    `prose-minion.lightboxSelection` (editor context menu, `editorHasSelection`);
  - add `uiActions.openLightbox` so the sidebar can open it later.
- **Manifest:** commands, the context-menu entry, and the activation events
  `onWebviewPanel:prose-minion.lightbox`, `onCommand:…`.
- **Contracts:** `shared/types/messages/lightbox.ts`
  - `LightboxBoard`, `LightboxSource`, `LightboxParagraphMetric`,
    `LightboxMeasuredSet`, `LightboxReadingGroup` (status `not-run` only in
    this slice), and the `LightboxTileKind` union (empty for reading kinds
    until 2B);
  - routes `LIGHTBOX_REQUEST_BOARD`, `LIGHTBOX_SET_SOURCE`,
    `LIGHTBOX_PICK_SOURCE_FILE`, `LIGHTBOX_REFRESH_SOURCE`,
    `LIGHTBOX_BOARD`, `LIGHTBOX_SOURCE_REFUSED`, with `MessageType` members
    in `base.ts`.
- **Constants:** `PROMPT_BUDGETS.lightbox = { sourceWords: 50_000, chapterWords: 12_000, ribbonColumns: 96 }`,
  pinned in the prompt-budget test.
- **Paragraph model:** `infrastructure/lightbox/LightboxParagraphs.ts` (pure)
  - `splitLightboxParagraphs(text)` uses the `/\n\s*\n/` rule and returns
    index (from 1), text, offsets and word count;
  - per-paragraph sentences, average sentence length and dialogue share
    (straight and curly quotes);
  - `lightboxContentHash(text)`;
  - `bucketParagraphs(count, columns)` for the ribbon.
- **Service:** `infrastructure/lightbox/LightboxService.ts`
  - builds the measured set from the three measurement services plus
    `StandardsService.enrichWithStandards`;
  - enforces the ceiling (a refusal carries the word count and a
    suggestion);
  - keeps the latest board per source in memory (D12).
  - It is built in `extension.ts` and added to `CoreServices`.
- **Handler:** `application/handlers/domain/LightboxHandler.ts`
  - registers the routes above;
  - resolves sources through `TextSourceResolver`;
  - posts `LIGHTBOX_BOARD`.
  - It is constructed in `MessageHandler` as the thirteenth domain.

## Webview

- `LightboxApp.tsx` on `FullTabShell`:
  - brand: eyebrow "Prose Minion · Inspiration & Mood Board", title
    "Lightbox", and the source as subtitle;
  - the chrome from `useFullTabChrome` with `source: 'webview.lightbox'`.
- `hooks/domain/useLightbox.ts` (tripartite): board, source, refusal, and the
  persisted UI preferences (filter, selected item, lens toggles).
- Presentation controllers under `hooks/domain/lightbox/controllers/`:
  - `useLightboxFocus` (hover and selection, the focused paragraph set);
  - `useLightboxInspector` (the pinned item's view model).
  - Both are free of `useVSCodeApi`, `MessageType` and `postMessage`.
- Components under `components/lightbox/`: `LightboxSourcePanel` (rail),
  `LightboxRibbon`, `LightboxStatRow`, `LightboxTopWords`,
  `LightboxPartsOfSpeech`, `LightboxInspector`, `LightboxReadingPlaceholder`.
  The tile map is an exhaustive `Record<LightboxTileKind, …>`.
- Styles: `styles/lightbox/*.css`, scoped to `[data-pm-surface="lightbox"]`.
  The register tokens are measured (solid, accent), read (dashed, periwinkle)
  and counted-read (neutral), taken from the design. The import list is
  pinned in `workshopStyles.test.ts` (or its renamed successor).

## Tests

- Paragraph model:
  - the split agrees with `PassageProseStats.paragraphCount` on fixtures;
  - dialogue share with straight, curly and mixed quotes;
  - the hash is stable;
  - bucketing at 1, 96, 97 and 1,500 paragraphs.
- Service: ceiling refusal at 50,001 words; measured set shape; board cache
  per source.
- Handler: routes registered; a refused source posts `LIGHTBOX_SOURCE_REFUSED`.
- Provider and assembly: serializer count 2; `new MessageHandler(this.coreServices…`
  only; activation event present.
- Webview:
  - the focus controller lights the right ribbon columns for a word and for a
    bucketed range;
  - the inspector view model for a measured item;
  - the tile map is exhaustive (a type-level test).
- Architecture: Lightbox modules on the boundary lists (ADR D13).

## Done when

- Opening a 3,000-word chapter shows the counted board with no network call.
- A 60,000-word file is refused with its count before anything runs.
- Hover and pin work for words, phrases and ribbon columns.
- The Workshop is untouched apart from the shared shell.
