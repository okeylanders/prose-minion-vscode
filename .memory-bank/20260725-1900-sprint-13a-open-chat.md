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

Typecheck (core/webview/ext) · 126 suites / 1313 tests · lint 0 errors ·
production build + bundle sentinel check · `git diff --check` — all pass.

New suites: `WorkshopSessionScope.test.ts` (30 cases),
`WorkshopTextSheet.test.tsx` (17 cases). Scope/gating cases added to the
handler, hook, composer, excerpt-panel, context-panel, and prompt-frame suites.

`jest.config.js` gained a `marked` → UMD `moduleNameMapper` entry so components
that render Markdown can be tested against the real renderer (the ESM-only
build is unparseable by Jest's CJS runtime).

## Bug found during the manual pass — session save was broken (pre-existing)

Symptom, from the output channel on every autosave *and* manual save:

```text
Autosave failed (…, reason=persona turn completed):
  Workshop session state.turns[4].capability.metadata.requestedEndLine
  must be plain object
```

**Cause.** The two halves of the durable boundary disagreed about `undefined`.
`clonePersistedJson` documents its policy explicitly — "`undefined` object
members are omitted exactly as JSON.stringify omits them" — but
`assertJsonValue` in `WorkshopSessionStateV1Shape.ts` had no `undefined` branch,
so an `undefined` member fell through to `objectAt` and was reported as "must be
plain object".

The write path validates the **live in-memory object** (`exportCommittedState()`
→ `validateSessionForWrite` → `parseWorkshopPersistedSession`), where optional
capability-metadata fields the persona omitted really are `undefined` members.
`WorkshopResourceCapability` sets `requestedEndLine: request.endLine`, which is
`undefined` whenever the persona omits `endLine` — the *common* case, as the
sibling `defaultLineWindow: request.endLine === undefined` shows. So **any
session in which a persona read a project resource without an explicit end line
could not be saved at all.**

**Not a Sprint 13A regression.** `git diff epic/workshop-editor-tab...HEAD`
touches neither `WorkshopResourceCapability.ts` nor `persistedJson.ts`, and this
branch's only edits to the shape validator add scope/shelf/revision/artifact
rules. The failure surfaced now because 13A's manual pass exercised persona
resource reads.

**Fix.** `assertJsonValue` now honors the documented policy: an `undefined`
**object member** is an absent member. An `undefined` **array item** stays
refused, because JSON has no hole and `JSON.stringify` writes `null` there —
that would silently change the data rather than omit it.

Four regression cases live in `WorkshopSessionPersistence.test.ts` under
"capability metadata across the durable boundary". Reverting the one-line policy
change fails three of them, so the test genuinely reproduces the bug.

## Follow-up added on request: full reset

Okey asked for a destructive counterpart to the new-session boundary after using
the feature. §3's boundary carries the excerpt and context forward on purpose;
this adds the "empty room" option beside it.

`WORKSHOP_RESET_SESSION` now takes `{ clearWorkingSet?: boolean }`. Surfaces:
the Sessions menu ("New session: full reset", directly under New session, error
accent, subtitle naming the difference) and the path chooser ("Reset excerpt and
context", under the two cards, shown only when something would be discarded and
annotated with what). Both confirm, and the dialog states that saved sessions on
disk are untouched.

**Two things a maintainer must not lose:**

1. `reset({ clearWorkingSet: true })` **must** zero `revisions.excerpt`. The
   counter belongs to a passage; leaving it set with nothing in the pinned or
   shelved slot fails the V1 integrity rule at the next checkpoint. A test
   asserts export + hydrate both stay clean after a full reset.
2. A failed durable promotion rolls the whole reset back. A destructive action
   that could not be written must not have destroyed anything; covered in the
   coordinator suite.

**Answer to "are the excerpt and context stored somewhere else?"** No — memory.
They live in `WorkshopSessionService` (composition-root owned, so it survives
webview reloads) and in `prose-minion/sessions/*.json`, which is written *from*
memory. Deleting `current.json` while the host is running clears the file, but
nothing re-reads it then, so the next autosave rewrites it from the aggregate.
Workshop uses no `globalState`/`workspaceState` at all; only conversation
behavior and the Writer Profile are settings-backed, and both are deliberately
global rather than session state.

## Outstanding

Manual Extension Development Host pass: open chat end to end, later excerpt
adoption, both reversals, the sheet's four authoring cases, file-pill read +
editor-tab open, tool-gating announcement, and a restored open-conversation
session.
