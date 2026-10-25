# Slice 1: Shared Full-Tab Shell

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D1 (surface map) and D2
**Status:** In review (branch `epic/lightbox-slice-1-shell`, PR pending)

## Outcome

The Workshop tab renders through a shared `FullTabShell`, with the same
pixels, behavior and tests as before. A third surface value exists, and every
branch on the surface is exhaustive. No Lightbox UI ships yet. The slice is a
refactor: if a Workshop test changes its expectations, the slice has gone
wrong.

## Changes

**Surface map** (D1)

- `shared/types/surface.ts`: `WebviewSurface = 'sidebar' | 'workshop' | 'lightbox'`,
  `SURFACE_LIGHTBOX`, and a `PM_FRAME_ATTR = 'data-pm-frame'` constant with the
  value `'fulltab'`.
- `apps/vscode-extension/src/application/providers/webviewHtml.ts`: replace the
  `<title>` and `#root` ternaries (`:57`, `:62-64`) with a
  `Record<WebviewSurface, …>` map. Full-tab surfaces stamp both
  `data-pm-surface` and `data-pm-frame="fulltab"`.
- `presentation/webview/index.tsx`: replace the root ternary (`:28`) with an
  exhaustive map. `lightbox` renders a placeholder root until Slice 2A.
- `webviewHtml.test.ts`: the "surfaces differ only in title and root"
  assertion (`:73-84`) covers all three; the sidebar snapshot is unchanged.

**Shell components** (`presentation/webview/components/fulltab/`)

- `FullTabShell.tsx`: slots `brand` (eyebrow, title, subtitle node),
  `headerActions`, `banners`, `rail`, `main`, `aside?`. Owns the `pm-ws-split`
  layout. Rail label and error-boundary tab name are props.
- `FullTabHeaderStatus.tsx`: `ModelSelector scope="assistant"`, the processed
  chip and the balance chip. Moved from `WorkshopApp.tsx:1041-1069` with the
  `balanceTitle` derivation (`:934-947`).
- `ProviderPausedBanner.tsx`: from `WorkshopApp.tsx:1073-1085`, copy passed in.

**Chrome hook** (`presentation/webview/hooks/fulltab/useFullTabChrome.ts`)

- Owns `useModelsSettings`, `useTokenTracking`, `useAccountBalance`,
  `hasSavedKey` with `REQUEST_API_KEY`, `requestModelData` on mount, and the
  settings opener. Takes the envelope `source` as a parameter.
- Exports `buildFullTabChromeRoutes(chrome)`. `useWorkshopAppMessageRouter`
  merges it instead of declaring those routes itself (`:158-168`).
- Tripartite interface. `Persistence` covers what the Workshop persists today
  for these hooks, so restored state is unchanged.

**Styles**

- Move frame, token, header, chip, balance, rail-frame and banner selectors
  from `styles/workshop/{tokens,shell}.css` into `styles/fulltab/`, rescoped
  to `[data-pm-frame="fulltab"]`. Workshop-only rules stay under
  `[data-pm-surface="workshop"]`.
- Import `styles/fulltab/*` from `index.tsx`. Update
  `workshopStyles.test.ts`: the Workshop list shrinks by what moved, and a
  new assertion pins the `index.tsx` full-tab imports.
- Visual check: before and after screenshots of the Workshop tab (empty,
  excerpt pinned, provider paused). Attach them to the PR.

**Sources**

- `useStartupNotice` and the settings opener take `source` instead of
  hard-coding `'webview.workshop'`. The Workshop still passes
  `'webview.workshop'`, so the provider witness
  (`providerAssembly.test.ts:78-86`) holds.

## Tests

- Unit tests for `FullTabShell` (slots render, rail label and boundary
  fallback), `FullTabHeaderStatus`, and `useFullTabChrome` (routes, the
  `source` parameter, persistence contract).
- Existing: `WorkshopApp.test.tsx` (heading "Workshop", label "Session rail"),
  `ExcerptPanel.test.tsx`, `ContextPanel.test.tsx`, `workshopStyles.test.ts`,
  `webviewHtml.test.ts`, the architecture suites. All pass with no
  expectation changes beyond the style-list and surface-map updates above.

## Done when

- `WorkshopApp.tsx` no longer contains the header status cluster, the
  provider-paused banner or the generic chrome state, and is shorter by at
  least that much.
- The three surface branches are exhaustive maps.
- The full-tab styles render under either full-tab surface.
- Typecheck, lint (no new warnings) and the full Jest suite pass.

## Implementation notes (2026-10-19)

Built on `epic/lightbox-slice-1-shell` in four commits: the chrome hook, the
shell components, the surface map, then the style move. Where the build
differs from the plan above, or the plan left a choice open:

**Shell API**

- `FullTabShell` regions are objects. `rail` and the optional `aside` are
  `{ label, boundaryName, content }`, and `main` is `{ label, content }`. The
  shell renders `section.pm-ws-main`, so the Workshop's "Session thread" label
  comes from the slot.
- Two props the plan did not list:
  - `children` are overlays (modals, sheets, the toast). They mount inside
    `.pm-ws` after the split, where the Workshop always had them.
  - `onBoundaryError` reports a side region's render failure.
- `FullTabRail` serves both the leading rail and the trailing aside through
  a `placement` prop. Each has its own error boundary and retry.
- `FullTabHeaderStatus` takes the narrow `Pick`s of the chrome hooks it
  reads (`models`, `tokens`, `balance`) instead of loose props.
- The balance-title derivation is in `FullTabHeaderStatus` as the exported
  pure `fullTabBalanceTitle()`, as this slice says. ADR D2 lists it under
  `useFullTabChrome`; the hook supplies its inputs.
- `ProviderPausedBanner` keeps the shared headline and button. Each tab
  passes its own `availabilityNote` sentence.

**Chrome hook**

- `useFullTabChrome` adds a derived `providerPaused` beside `hasSavedKey`, so
  each root does not repeat `hasSavedKey === false`.
- Its persistence type is models plus tokens. The balance hook's persistence
  is deliberately empty, and intersecting its `Record<string, never>` would
  erase the other keys' types. The persisted keys are exactly the Workshop's
  old ones: `modelsSettings`, `modelSelections` and `tokenTracking`.
- On mount, `REQUEST_API_KEY` now posts before `REQUEST_STARTUP_NOTICE`, since
  the chrome hook's effect runs earlier in hook order. The set of mount
  messages is the same.
- `useStartupNotice(source)` takes a required source.

**Surface map**

- `resolveWebviewSurface()` in `surface.ts` reads the #root stamp back. A
  missing or unknown stamp still means the sidebar.
- The Lightbox document is titled "Prose Minion Lightbox" and boots with
  "Loading the Lightbox…".
- `LightboxApp` is the placeholder root. It renders `FullTabShell` with the
  2A brand (eyebrow "Prose Minion · Inspiration & Mood Board", title
  "Lightbox"), an empty "Board rail" and one status line, with no chrome and
  no CSS of its own. No host opens it yet.

**Styles**

What moved to `styles/fulltab/`:

- the frame tokens;
- `.pm-ws`;
- the surface-wide disabled-cursor and focus-ring element rules;
- the header, brand, logo, title and subtitle;
- the header actions row, the model-selector chip reskin and the balance
  chips;
- `.pm-ws-eyebrow` and `.pm-ws-header-eyebrow`;
- the split, the rail and the rail scrollbar;
- `.pm-ws-main`;
- the 1100 px and 520 px header rules;
- the provider-paused banner.

What stayed under `[data-pm-surface="workshop"]`:

- the participant identity palette (`--pm-identity-*`);
- the persona trigger and the Sessions trigger (`.pm-ws-reset`);
- the rail section cards (`.pm-ws-block*`);
- everything else.

Notes on the move:

- Declarations are unchanged. The one exception is the banner, whose shared
  base and override fold into one rule with the same computed values.
- The frame sheets are imported from `index.tsx` *before* any root, so they
  precede the Workshop's sheets. This was checked at runtime through
  `document.styleSheets`. Equal-specificity order is therefore preserved.
- The plan said the Workshop import list would shrink. No Workshop stylesheet
  moved whole, so `WORKSHOP_STYLE_IMPORTS` is unchanged.
  `workshopStyles.test.ts` instead gains:
  - the entry's frame imports and their position before every root;
  - an empty pinned `LightboxApp.tsx` list;
  - a check that frame rules use only the frame scope.
- New rules for the optional aside: `.pm-ws-split-with-aside` and
  `.pm-ws-aside`, a 340 px third column. They are unused until the Slice 2A
  inspector, which may retune them.

**Transcript export (expectation changes beyond the plan)**

The HTML export mirrors thread CSS verbatim and pins each rule to its source
(ADR 2026-10-05). Moving the tokens, `.pm-ws` and `.pm-ws-eyebrow` therefore
required these changes:

- regenerating the mirror, with two new frame layers;
- stamping `data-pm-frame="fulltab"` on the export page's `<body>`, beside
  `data-pm-surface="workshop"`;
- updating the mirror test's layer list;
- updating the `<body …>` expectation in two export tests
  (`WorkshopTranscriptRenderers.test.ts`, `WorkshopRoutes.export.test.ts`).

The exported page looks the same.

**Other test changes**

- `useWorkshopAppMessageRouter.test.ts` passes the generic handlers as a
  `chrome` bundle and asserts `deps.chrome.handleApiKeyConfigured`.
- `useStartupNotice.test.ts` passes the source explicitly.
- No expectation in `WorkshopApp.test.tsx`, `ExcerptPanel.test.tsx` or
  `ContextPanel.test.tsx` changed.

**Visual check**

The check ran in headless Chromium against the built bundles, not in the
VS Code host:

- Each bundle was loaded into a page that mimics `webviewHtml.ts`, with a
  stubbed VS Code API. Host messages drove four states: loading, empty,
  excerpt pinned and provider paused.
- Each state was captured at 1440, 1000 and 500 px.
- In every state the Workshop DOM is identical to the pre-slice bundle, apart
  from the new frame stamp on #root.
- Every screenshot matches to the pixel, within run-to-run raster noise. The
  baseline bundle against itself shows the same 6–32 px, 1/255 flicker in the
  header.
- The Lightbox placeholder renders the frame under `data-pm-surface="lightbox"`.
- The scripts and screenshots are outside the repository, and no PR exists
  yet to attach them to.

**Size**

`WorkshopApp.tsx` went from 1,822 to 1,736 lines. Ignoring whitespace, the
diff is −146/+60. The removed generic code (the chrome state, the balance
title, the header chips and the banner) is about 100 lines. The slot
variables that hand the Workshop's own blocks to the shell add about 25
lines, so the net cut is a little under the "at least that much" target.
