# ADR: Shared Loading Widget with Randomized Animations and Credits

- Status: Accepted
- Date: 2025-10-26
- Epic: .todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md
- Sprint: .todo/epics/epic-search-architecture-2025-10-19/sprints/03-metrics-module-punchlist.md

## Context

Multiple tabs (Analysis, Dictionary, Metrics, Search) duplicated loading UI blocks, making visual updates error‑prone and inconsistent. We also started using animated “assistant‑working” GIFs. Credits should be consistently displayed, and rotating between a small set of animations adds delight during longer runs.

Constraints:
- VS Code webview CSP requires asset URIs to be injected via `webview.asWebviewUri`.
- Credits must be shown below the image, with linkable attribution.
- Alpha posture: prefer a single reusable widget over per‑tab variations.

## Decision

Introduce a reusable `LoadingWidget` React component that:
- Randomly selects a loading GIF from a list provided by the extension via `window.proseMinonAssets.loadingGifs` (falls back to the VHS GIF when list is absent).
- Renders credits below the image using a `loadingGifCredits` map keyed by filename. Supports `{ label, href }` entries to produce an accessible link.
- Leaves the per‑tool “loading message” ownership to each tab. Tabs render their specific message above the widget; the widget only renders the animation and credit.

## Implementation

- Extension side injection (URIs + credits):
  - File: src/application/providers/ProseToolsViewProvider.ts
  - Adds `loadingGifs` array and `loadingGifCredits` map with structured credit entries.
- Webview shared component:
  - File: src/presentation/webview/components/LoadingWidget.tsx
  - Picks a random GIF on mount; renders credit below the image.
- Tabs updated to use the shared widget while keeping their own status text above it:
  - Analysis, Utilities (Dictionary), Search, Metrics.

## Alternatives Considered

- Keep per‑tab bespoke loaders: rejected; inconsistent and harder to maintain.
- Cache rendered HTML for loaders: unnecessary; render cost is trivial and adds complexity.
- Hardcode one animation: less delightful; rotating options improves perceived responsiveness.

## Consequences

- One place to evolve loading visuals/credits.
- Clear contract: tabs own textual status; widget owns image + credit.
- Credits are consistently displayed and linkable under CSP rules.

## Links

- Sprint doc: .todo/epics/epic-search-architecture-2025-10-19/sprints/03-metrics-module-punchlist.md
- PR draft: docs/pr/2025-10-26-sprint-3-metrics-module-punchlist.md

