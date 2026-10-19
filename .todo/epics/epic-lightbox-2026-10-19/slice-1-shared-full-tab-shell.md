# Slice 1: Shared Full-Tab Shell

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D1 (surface map) and D2
**Status:** Planned

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
