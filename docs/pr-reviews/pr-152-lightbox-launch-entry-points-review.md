# PR Review — Lightbox Launch Entry Points

**Author:** okeylanders · **PR:** [#152](https://github.com/okeylanders/prose-minion-vscode/pull/152) (open, unmerged at review)
**Branches:** `epic/lightbox-launch-entry-points` → `epic/lightbox`
**Reviewed implementation head:** `9399736ba14946f16a74de3d20363ef5718ca508`
**Verified base / merge-base:** `9e5363c398fd04ca578e207c47b429c59687ed8b`
**Scope:** 30 files · +1,359 / −44 · 4 commits before this report
**Reviewed:** 2026-10-20 · **Reviewer:** Astra
**Mode:** independent source/spec review, real adapter/handler/service ordering probes, rebuilt-production-bundle DOM witnesses, supplied-image inspection, deterministic verification, and read-only Slice 4 integration checks

## Resolution ledger

| ID | Sev | Finding | Status at `9399736` |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | An older file launch can replace a newer source after its asynchronous document load completes | **Open** |

**Verdict: Request changes.** The launch surfaces match the approved decision, and the ordinary deterministic checks pass, but the new adapter creates an unowned asynchronous interval before the existing source-ordering protection. Two independent integration witnesses reproduce the wrong-source replacement. This is a code-review verdict, not a formal GitHub review, merge authorization, native VS Code acceptance, or acceptance of the writer-output checkpoint before Slice 5.

## F-01 — Preserve source intent before asynchronous document loading

**Changed-code locations:** [`openFileInLightbox.ts:91–115`](https://github.com/okeylanders/prose-minion-vscode/blob/9399736ba14946f16a74de3d20363ef5718ca508/apps/vscode-extension/src/application/commands/openFileInLightbox.ts#L91-L115), with the document load at [`147–148`](https://github.com/okeylanders/prose-minion-vscode/blob/9399736ba14946f16a74de3d20363ef5718ca508/apps/vscode-extension/src/application/commands/openFileInLightbox.ts#L147-L148). The existing downstream ticket is not acquired until [`LightboxHandler.ts:144–147`](https://github.com/okeylanders/prose-minion-vscode/blob/9399736ba14946f16a74de3d20363ef5718ca508/packages/core/src/application/handlers/domain/LightboxHandler.ts#L144-L147).

An explicit Explorer/editor-menu URI is already the writer's concrete file choice. However, `openFileInLightbox` first awaits `findDocument`, which awaits `workspace.openTextDocument`, and only afterward calls `seedSource`. Until that last call, the shared Lightbox service has no record of this choice. Its otherwise-correct latest-request-wins guard therefore orders these launches by document-load completion rather than by the writer's choices.

**Independent reproduction:** The actual new adapter feeds the actual `LightboxHandler`, `LightboxService`, and measurement services through the repository's `lightboxHandlerHarness`. Only document loading, file I/O, picker, standards enrichment and transport are controlled stand-ins; the board ownership and adoption code are production code. All prose is synthetic.

1. Invoke Open File for `older-A.md`; hold only its `openTextDocument` promise.
2. Invoke Open File for `newer-B.md` and let it finish. Assert the current board is B.
3. Resolve A's document promise and drain the resulting work.
4. The expected current source is still B. The actual source becomes `older-A.md`.

A second witness replaces step 2 with a new editor selection sent through `LIGHTBOX_SET_SOURCE`. It first confirms `newer-selection.md` is current, then releases A. The actual source again becomes `older-A.md`. Both expected-safe assertions fail reproducibly; these are two failing regression tests, not two passing safety checks.

The essence of both witnesses is:

```typescript
const earlier = openFileInLightbox(a, host); // A's document promise is deferred
await openFileInLightbox(b, host);          // or route a newer selection
await settle();
expect(service.currentBoard()?.source.displayPath).toBe('newer-B.md');
pendingA.resolve({ uri: a, languageId: 'markdown', isDirty: false });
await earlier;
await settle();
expect(service.currentBoard()?.source.displayPath).toBe('newer-B.md');
// Fails: received "older-A.md".
```

**Impact:** An earlier slow load can switch the writer back to the wrong chapter after their newer choice has already appeared. The witness uses delayed asynchronous completion, not a measured native-host latency or a claim that every pair of launches races. It makes no provider call and demonstrates no on-disk data loss. P2 is warranted because this violates the board's explicit source-ownership contract and changes the source available for the next reading or handoff.

**Why this belongs to this PR:** The new adapter introduces the await before seeding; the prior whole-file selection fallback seeded synchronously. The downstream ticket implementation and `LightboxPanelProvider` are unchanged. This is the same invariant protected by [PR #148 F-01](pr-148-lightbox-counted-board-review.md#f-01-addressed--own-source-intent-before-the-first-asynchronous-read), now broken at a newly added upstream boundary, not a claim that the earlier fix stopped working inside the handler.

**Requested change:** Preserve a single authoritative source-request identity across adapter validation/loading and downstream boarding, starting when the concrete target is chosen. An older completion must not acquire a new winning identity after a newer file, selection, picked file, or re-read. A counter local to this command alone would not cover the selection/picker routes. Retain early untitled/non-file refusal and picker-dismissal semantics. Add deferred-document tests for file → file and file → selection, then cover picker/re-read and panel replacement against the same ownership rule.

## What was checked without another finding

- **Decision 8 / ADR D1:** The Analysis sidebar has Lightbox beside Workshop; whole-file opening appears in Explorer and editor context menus plus the editor title; Markdown and plain text are the advertised languages. The existing selection action and the new whole-file action are mutually exclusive in the editor context menu.
- **Command target:** Explicit URI arguments win over the active editor. Palette/no-argument invocation uses the captured active document. The composition root passes a real `vscode.Uri` through its narrow adapter port; no `vscode` dependency is added to core.
- **Dirty / untitled / unsupported inputs:** The file payload intentionally omits editor text, preserving saved-file reads, re-read and handoff hashing. Dirty sources receive the disclosure. Untitled URIs are refused before `openTextDocument`; non-file schemes, non-URI arguments, unsupported language IDs and rejected text opens do not seed. Workspace containment, empty sources and the word ceiling remain downstream rather than becoming a second boarding path. These are source/port-test checks, not native UI acceptance.
- **Message boundary:** `OPEN_LIGHTBOX` uses the typed zero-payload envelope and the existing `uiActions.openLightbox`. Missing actions produce `ui.lightbox`; the sidebar's existing `ui.*` error branch displays that error without cancelling unrelated domain loads.
- **Workshop parity:** The Workshop launcher retains its own `OPEN_WORKSHOP` message. Its root, full-tab styles and lifecycle implementation are unchanged. The renamed launch-button class is confined to the sidebar launchers. Rebuilt-bundle repeated-click checks keep both messages distinct.
- **Manifest:** Command declaration, activation, layout icon, menu groups and exact language/scheme/selection conditions were inspected and exercised by the repository's manifest tests. The additional settings-overlay activation event is a narrow existing-command correction. String/manifest assertions do not prove native menu placement or an actual editor-title click.
- **Scope:** No second board implementation, persistence format, automatic reading, automatic Workshop send, or provider invocation was added by this change. The documented release-note follow-up remains separate.

## Independent verification

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` at `9399736` | **373 suites / 5,284 tests / 2 snapshots passed** (198.314 seconds) |
| `npm run typecheck` | **Passed** for core host, core webview and extension |
| `npm run build` including `verify:bundle` | **Passed**; three webpack size/performance warnings |
| Full lint at head and base | **0 errors / 1,133 warnings** on each; normalized file/rule/severity/message multiset has **zero additions and zero removals** |
| Independent delayed-document ownership probes | **2 expected-safe assertions failed**, both reproducing F-01 through real adapter/handler/service/measurements |
| Rebuilt-bundle sidebar interaction/error probe | **Passed**: both launchers present; two Lightbox presses produce exactly two `open_lightbox` messages, one Workshop press produces one `open_workshop`, and the injected `ui.lightbox` error is rendered |
| Diff whitespace and source ownership | **Passed**; no reviewer implementation edits |
| Exact implementation-head GitHub CI | Both `verify` jobs **succeeded** |
| Read-only combination with PR #151 at `f93e1b0d238f1e242295c23cfc54982535ea02ed` | **Clean** merge tree `292d74358b4860c96798c3113d0cab4d4f3c5fbd`; all three typechecks and **386 suites / 5,439 tests / 2 snapshots passed** (195.198 seconds) |

Implementation-head CI: [PR verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39364787000/job/118439025190), [branch verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39364678935/job/118438676853). The report-only publication commit requires its own post-publication CI check; these links establish the implementation head, not a later commit.

The combined tree was generated without changing either branch, using the verified common base `9e5363c`. It verifies mechanical compatibility and deterministic gates only; it neither merges PR #151 nor accepts its feature behavior. Local execution used Node **24.19.0** / npm **11.9.0**, compared with CI's Node **18**. Dependencies came from the committed lockfile with install scripts disabled. No implementation or lockfile changed.

## Visual evidence and limits

All six supplied PNGs in [`evidence/lightbox-launch-entry-points/`](evidence/lightbox-launch-entry-points/README.md) were inspected at actual pixels:

- Sidebar at **320, 430 and 560 px**: both launchers remain legible; the 320 px row wraps below the title, and the wider layouts match the reported arrangement.
- Empty Lightbox at **500, 1000 and 1440 px**: the updated entry-point instructions are visible and no new overlap was observed in the supplied images.

The harness, README and `facts.json` were inspected. They explicitly use synthetic chrome state, a stub model and a null board; no provider is called. The independently rebuilt production bundle has SHA-256 **`51c0da369e1398a418679b07026713e63c5991c1c174fca30af001b88b32a9ee`**, exactly matching the README.

The fresh Chromium replay could not launch because this review environment denied the browser sandbox's `socket()` operation. An escalated launch also failed during sandbox setup before the harness ran. Consequently, the author's no-overflow, page-error and pixel-stability claims were **not independently rerun**. The successful JSDOM replay is DOM/message evidence only, not layout evidence; it reported the expected unsupported-CSS parser warning.

Native VS Code menu rendering, editor-title interaction, focus/activation behavior, and live provider output remain **unverified**. No live/billable calls, private manuscript fixtures, implementation edits, merge, deployment, PR comment or formal review were made. The writer's real-chapter output checkpoint is still required before Slice 5; this launch-entry-point review does not satisfy it.
