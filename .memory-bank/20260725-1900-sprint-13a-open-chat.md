# Sprint 13A — Open Chat: implementation record

**Date**: 2026-07-25
**Branch**: `sprint/workshop-editor-tab-13a-open-chat` → PR into `epic/workshop-editor-tab`
**Sprint**: [13A Open Chat](../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/13a-open-chat.md)
**Design source**: [Prose Minion - Assistant Tab](../docs/design/Prose%20Minion%20-%20Assistant%20Tab.html) (synced 2026-07-24)

## What landed

Session scope is now explicit state (`null` | `excerpt` | `open`) that drives
every surface. A writer can hold a real retained conversation with no excerpt,
adopt one later inside the same session, and reverse in both directions with the
passage shelved rather than deleted.

Host side: the aggregate owns scope, the shelf, and reason-tagged pending host
updates; `requireHostSubject` replaces the blanket excerpt gate for host turns
only (tools and guests still require a passage); the capability factory takes an
optional excerpt and gates `analysis.run` at the protocol level; the persona
envelope grows a `<workshop-open-conversation>` honesty frame.

Webview side: a path chooser, scope strip, open-chat start block, one shared
Edit/Preview sheet for all authored text, clickable context pills, and
`NEEDS EXCERPT` tool gating that is focusable, tooltipped, and announced.

## Decisions a future maintainer will want

1. **The comp's in-page editor tab strip is not product surface.** Workshop *is*
   a VS Code editor tab, so that strip is the comp's mock of VS Code's own
   chrome. Okey chose a hybrid: file pills open the in-webview sheet (which
   renders markdown prettified — VS Code needs an extension for that), and the
   sheet offers **Open in editor tab** routed through
   `ShellService.openFileInEditor`. Core never touches `vscode`, so this ports
   to a desktop/Electron app.
2. **Scope is assigned by writer actions, never derived from excerpt presence.**
   An open conversation that adopts an excerpt stays `open`. The single
   exception is a one-time migration when hydrating a pre-13A checkpoint.
3. **The excerpt version stays with a shelved passage.** Widening the V1
   integrity rule to accept the shelf as the version's owner was required; the
   test suite caught the omission.
4. **A retained host must be told about scope changes in the right words.**
   `excerptChange: added` says "FIRST passage you have been given here";
   `revised` supersedes; `repinned` restores; `excerptWithdrawn` tells it to
   stop quoting a passage it no longer holds.
5. **Attachment bodies are fetched per-open, not broadcast.** The shared budget
   is 35,000 words; putting bodies in every snapshot would be a ~200 KB message
   on every state change.

## Behavior change worth calling out in review

`canMessage` is false while scope is `null`, even with a carried-over excerpt.
New Session → message now needs one click on "Continue with current excerpt".
This is the comp's contract; both halves are asserted in `WorkshopHandler.test.ts`.

## Deliberate omissions from the comp

- **"Paste sample passage"** — its sample is the design's demo novel; injecting
  invented prose into a writer's room is worse than no shortcut.
- **Starter chips ship with generic copy** — two of the comp's four name a
  character from its demo project.

## Verification

Typecheck (core/webview/ext) · 126 suites / 1300 tests · lint 0 errors ·
production build + bundle sentinel check · `git diff --check` — all pass.

New suites: `WorkshopSessionScope.test.ts` (30 cases),
`WorkshopTextSheet.test.tsx` (17 cases). Scope/gating cases added to the
handler, hook, composer, excerpt-panel, context-panel, and prompt-frame suites.

`jest.config.js` gained a `marked` → UMD `moduleNameMapper` entry so components
that render Markdown can be tested against the real renderer (the ESM-only
build is unparseable by Jest's CJS runtime).

## Outstanding

Manual Extension Development Host pass: open chat end to end, later excerpt
adoption, both reversals, the sheet's four authoring cases, file-pill read +
editor-tab open, tool-gating announcement, and a restored open-conversation
session.
