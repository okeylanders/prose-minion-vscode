# Epic: Workshop Wayfinding

**Status:** Slice 0 (spec) on `epic/workshop-wayfinding`, from `main` at `cfac12b` (v2.12.0). Okey approved starting on 2026-11-03 and confirmed D9 the same day. Slice 1 merged (PR #184, `d45d57c`). Slice 6 merged (PR #185, `07d24e7`). Slice 2 merged (PR #186, `d59b651`). Slice 3 merged (PR #187, `89d6f26`). Slice 4 merged (PR #188, `356c751`). Slice 5 is in progress.
**Priority:** Medium
**Created:** 2026-11-03
**Integration branch:** `epic/workshop-wayfinding`. Each slice is built on its own branch, `epic/workshop-wayfinding-slice-<N>-<slug>`, and merges into the epic through a reviewed PR.
**Decision:** [ADR 2026-11-03: Workshop Wayfinding](../../../docs/adr/2026-11-03-workshop-wayfinding.md) (Proposed)
**Design:** [`docs/design/workshop-wayfinding/`](../../../docs/design/workshop-wayfinding/README.md), a snapshot of the planning canvas
**Realizes:** [Two-Tab Rail](../../features/feature-workshop-rail-tabs/README.md), [Read-In Material](../../features/feature-workshop-rail-read-in/README.md), [Thread Bookmarks](../../features/feature-workshop-thread-bookmarks/README.md), [Model Slices](../../features/feature-workshop-model-slices/README.md)

## Goal

In a long Workshop session, the writer can find their way around:

- what the room is working on,
- what each persona read on its own,
- which replies they meant to come back to,
- and where the model changed.

```
┌ Material · 10 ┬ Notes  2 new ┐ │ ── SESSION RESUMED TUESDAY … AFTER 49H 6M ──
│ Excerpt  v3 · session live    │ You: Can you look at the lantern beat again?
│ Context  3 attachments        │ Jill: Right now her reaction lands…  [Bookmarked]
│ Read in  by Jill              │ ── MODEL · CLAUDE SONNET 5 → GPT-5 ──
│  ▸ notes/lantern-symbolism.md │ You: Try the beat from her father's side.
│    lines 1–64 · changed since │ Jill: From his side the lantern is an interruption…
│  ▸ Dialogue & Beats report    │
└───────────────────────────────┘ │ [Context] [Tools] [Widgets] … [Send]
```

## Decisions Taken From the Brainstorm

These were settled with Okey on 2026-10-27 and 2026-10-28, and are recorded in
the ADR:

- **Names:** Bookmarks (not pins), and the tabs Material and Notes.
- **Rail:** retire the Tools block. The composer's tool button covers it.
- **Badges:** an inactive tab badges whatever lands in it while it's hidden,
  whoever added it. There's no toast (ADR D1, amended 2026-11-03 to match the
  canvas, because every to-do today comes from a writer's click).
- **Reader:** the text sheet plus "Open beside" first. A docked reader is a
  follow-up.
- **Compatibility:** option A, forward-only (ADR D9). Okey confirmed it on
  2026-11-03.

## Slices

| # | Slice | Outcome | Decisions | Status |
|---|---|---|---|---|
| 0 | Spec | ADR, this epic, slice docs, design snapshot, feature notes linked | All | Done |
| 1 | [Rail tabs](slice-1-rail-tabs.md) | `WorkshopRail` with Material and Notes tabs, the Tools block retired, a Notes badge for to-dos added while it's hidden | D1 | Done: PR #184, merged at `d45d57c` |
| 2 | [Read in and the reader](slice-2-read-in-and-reader.md) | The Read in block, badging Material while it's hidden; resource rows open in the reader sheet and beside the Workshop | D1, D2, D3, D4 (access) | Done: PR #186, merged at `d59b651` |
| 3 | [Read-in provenance](slice-3-read-in-provenance.md) | Rows record their card, line range, and fingerprint; jump to the card; "changed since" | D3, D4, D9 | Done: PR #187, merged at `89d6f26` |
| 4 | [Bookmarks on the host](slice-4-bookmarks-host.md) | Bookmark ledger, routes, persistence, whole-room operations, export | D5, D6, D9, D10 | Done: PR #188, merged at `356c751` |
| 5 | [Bookmarks in the rail and thread](slice-5-bookmarks-ui.md) | Bubble toggle, Notes list, rename, jump, out-of-window reader | D5, D6 | In progress |
| 6 | [Model stamps](slice-6-model-stamps.md) | Every reply records requested and served models | D7, D9 | Done: PR #185, merged at `07d24e7` |
| 7 | [Model slices](slice-7-model-slices.md) | Derived slices in the thread and in export; served-by note | D8, D10 | Planned |
| 8 | Verify live | Extension Development Host pass; ADR → Accepted; feature notes archived; memory bank | — | Pending (needs a human with VS Code) |

**Order.** Two chains run side by side:

- **The rail chain, 1 → 2 → 3 → 4 → 5.** Slice 1 has no contract change, and
  every later rail slice renders inside its tabs. Slices 2 and 3 come before
  bookmarks because Slice 5's out-of-window reader reuses Slice 2's sheet mode.
- **The model chain, 6 → 7.** It doesn't depend on the rail, so Slice 6 starts
  while Slice 1 is in review. Slice 7 lands after Slice 5, because both change
  the bubble and the export.

## How the Slices Are Built

- **One implementation thread per slice.** It works on that slice's branch,
  `epic/workshop-wayfinding-slice-<N>-<slug>`, cut from the epic branch. It
  reads this README, the ADR, `AGENTS.md`, and its slice doc, then builds,
  verifies, commits, and pushes. When the slice is done, it updates the slice
  doc's status and the progress notes below, then stops.
- **The coordinating thread opens the PR** into `epic/workshop-wayfinding` and
  watches it. Astra reviews each PR automatically.
- **Findings are fixed on the slice branch**, as follow-up commits, and answered
  on their threads.
- **Merging:** once a PR is green and Astra's findings are settled, the
  coordinator merges it into the epic and starts the next slice in that chain.
- **To `main`:** the epic merges to `main` through one PR at the end, which
  carries the release review.

## Verification (every slice)

- `npm run typecheck`
- `npm run lint`: no new errors. The repo already carries PascalCase
  `naming-convention` warnings, so only new warnings count.
- `npx jest`: the full suite passes. Record the suite and test counts in the
  progress notes.
- `packages/core/src` has no `from 'vscode'` (the architecture tests guard
  this).
- No new file over 500 lines, and the files a slice touches don't grow past
  500 lines.
- The slice doc's completion criteria are checked off, each one backed by a test
  or stated as covered by the Slice 8 live pass.

## Completion Criteria

- The rail has Material and Notes tabs; the Tools block is gone; host-added
  to-dos badge the Notes tab; no tab switches by itself.
- The Read in block lists the chat target's fetched material. Each row opens in
  the reader, jumps to its card, or offers nothing, by an exhaustive switch.
- The reader marks the lines read and says when the file has changed. Open
  beside opens the configured file and nothing else.
- Bookmarks persist with the session, follow New, Open, Rewind, and Branch, list
  in thread order, rename, jump, and open in the reader when out of the window.
- Every reply records its requested and served models. Slices appear only for a
  same-scope change, in the thread and in export alike.
- Sessions without the new fields load and render unchanged (fixture tests).
- Nothing new reaches a persona's prompt.

## Progress Notes

- **2026-11-03. Slice 0.** Spec written from the four feature notes (captured
  2026-10-27) and the planning canvas. Findings that reshaped the notes:
  - The rail is now the shared `FullTabRail` (Lightbox epic), so the tabs live
    inside the Workshop's rail content and the shell doesn't change.
  - A manifest row's `artifactId` names message attachments, not capability
    cards. Jump-to-card needs a new `turnId` on the row (Slice 3).
  - The webview can read only attached files. Read-in resources need two new
    messages (Slice 2).
  - Dictionary history already records served models as `modelIds`; the model
    stamp follows that naming.
  - Baseline on `main` at `cfac12b`: typecheck clean; 591 suites / 8,398 tests
    / 59 snapshots, all passing.
- **2026-11-03. Flow change.** Okey asked for a PR per slice into the epic,
  reviewed by Astra, and confirmed D9. Slice 1 had been built straight onto the
  epic (`da7f28f`, `4a25d5c`, `bf0e0e6`). Those commits are reverted here
  (`6716f37`) and come back through Slice 1's PR. D1 is amended:
  - Every to-do today comes from the writer adding a finding
    (`addTodoFromFinding`), so "badge only what the host added" would badge
    nothing.
  - The canvas Okey approved badges whatever lands in a hidden tab, so that is
    the rule now, with no toast.
- **2026-11-03. Slice 1 (rail tabs).** Landed in `94d6b86` (the
  `useWorkshopRailTabs` controller) and `e188ea9` (`WorkshopRail`, the
  `WorkshopApp` rewire, the Tools block and its styles deleted). These are
  cherry-picks of `da7f28f` and `4a25d5c` on the PR branch.
  - **Counts.** Before, at `1f8becb8`: 591 suites / 8,398 tests / 59
    snapshots. After: 594 / 8,422 / 59, all passing. `npm run typecheck`
    clean. `npm run lint`: 0 errors; warnings 1,130 → 1,133, all three the
    PascalCase `naming-convention` kind (`WorkshopRail`, the test's
    `StatefulRail` and `PmLogo` mock). No `from 'vscode'` in core.
  - **Sizes.** `WorkshopApp.tsx` 1,743 → 1,671 (it was already over 500;
    [tech debt](../../tech-debt/2026-11-03-workshop-app-root-size.md)).
    `WorkshopRail.tsx` 158, `useWorkshopRailTabs.ts` 159. `styles/workshop/shell.css`
    is already 2,600+ lines; the slice doc put the tab rules there, so it grew
    by 23 net lines (tools rules out, tab rules in).
  - **Deviations.**
    - *Restoring the tab.* No sibling Workshop hook restores webview state, and
      a controller may not call `useVSCodeApi`. `WorkshopApp` reads the stored
      value with `usePersistedState` and passes it in as `initialTab`; the
      controller parses it (`parseWorkshopRailTab`).
    - *When a reload counts as seen.* The doc says "on mount", but the
      to-dos arrive with the first session snapshot, after mount. The
      controller takes a `roomKey` (`pending` until the session is ready,
      then `room:<roomRevision>`) and marks everything seen whenever it
      changes. That also keeps New, Open, Rewind and Branch from badging the
      room they bring in.
    - *Badge eligibility.* Built as open, not stale, and host-sourced
      (`isHostSourcedTodo`); the review fix drops the host-sourced check, per
      amended D1. Stale is excluded so the badge is never larger than the
      tab's open count.
    - *Accessible names.* Material is "Material, N items"; Notes is "Notes,
      N open" plus ", N new" (the doc's example omitted the open count).
    - *Copy.* The empty thread said "run a tool from the left"; it now says
      "run a tool below".
    - *No rail entry points yet.* D1's "select the tab first" rule has no
      caller today (nothing targets a rail panel); `selectTab` is the seam
      for Slices 2 and 5.
  - **PR #184 review (Astra, 2026-11-03).** Changes requested on one P2:
    switching tabs unmounted Notes and lost an unsaved to-do edit. The slice
    doc had asked for that unmounting. Two P3 accessibility notes came with
    it. All three are fixed: both panels stay mounted and the inactive one is
    `hidden`; the list is keyed by room, so a draft never crosses rooms; a
    draft whose task is gone is dropped; each panel is a tab stop. The ledger
    is in [the review](../../../docs/pr-reviews/pr-184-workshop-wayfinding-rail-tabs-review.md).
  - **Coordinator's answers (2026-11-03).**
    - *Badge vs. toast:* D1 is amended to the canvas's rule. An inactive tab
      badges whatever lands in it while hidden, whoever added it, and nothing
      toasts. `isHostSourcedTodo` goes, and any open, current to-do that
      arrives while Notes is hidden badges.
    - *`.pm-ws-block-grow`:* deleted. Nothing uses it, and the Read in block
      doesn't need to grow.
- **2026-11-03. Slice 6 (model stamps).** Built on
  `epic/workshop-wayfinding-slice-6-model-stamps`:
  - **Commits.**
    - `7e38081`: `AgentRunEngine` returns `ExecutionResult.models`. It captures
      the requested model before the run's first request and collects the
      distinct served ids from each request's observation, in order.
    - `9d86713`: `WorkshopTurn.model` (`WorkshopTurnModel`), its strict codec
      (`WorkshopTurnModel.ts`, called from `assertTurn`), `MODEL_SCOPES` /
      `isModelScope`, and `AnalysisResult.model`.
    - `584a529`: `AssistantToolService` scopes each run's models as
      `assistant`, and every provider-made commit path stamps its turn.
  - **Stamped paths.** The [slice doc](slice-6-model-stamps.md#built) has the
    table:
    - host replies, guest first replies and guest replies, tool-sidecar
      replies, and host syntheses, all through `completeWorkshopRun`;
    - the writer's tool reports, through `adoptWriterReport`;
    - persona-run analyses, through `adoptPersonaReport`.

    Failed, cancelled, refused and zombie runs commit nothing, so they carry no
    stamp. An integration test drives the real handler and checks that no
    request sent to the engine (prompts, room catch-ups, room frames) contains
    a stamp.
  - **Counts.**
    - Before, on a clean worktree at `fddc484`: 591 suites / 8,398 tests / 59
      snapshots, all passing.
    - After: 595 / 8,432 / 59, all passing.
    - `npm run typecheck` is clean.
    - `npm run lint` has 0 errors and 1,133 warnings, unchanged from the
      baseline.
    - `packages/core/src` has no `from 'vscode'`.
  - **Files over 500 lines that grew.** Each grew only by the stamp's
    parameter, field or call:
    - `WorkshopSessionService` 2,555 → 2,562;
    - `WorkshopSessionStateV1Shape` 1,028 → 1,037 (its assertion lives in the
      new 64-line `WorkshopTurnModel.ts`);
    - `AgentRunEngine` 1,139 → 1,152;
    - `AssistantToolService` 1,078 → 1,100;
    - `WorkshopPersonaCapability` 833 → 846;
    - `session.ts` 925 → 942.

    All were already tracked as oversized.
  - **Deviations.**
    - The codec refuses a stamp on a non-assistant turn.
    - A failed persona-run analysis records no stamp.
    - Dictionary capability turns stayed unstamped, because D7 didn't list
      them. The review fixes below settle that.
  - **Not done here.** The JSON export doesn't carry `model` yet. Transcript
    projection picks fields explicitly, so the stamp stays out of export and
    recall until Slice 7 (D10).
- **2026-11-03. Slice 6 review fixes (PR #185).** Astra
  ([review](../../../docs/pr-reviews/workshop-wayfinding-slice-6-model-stamps-review.md))
  found two P2 provenance faults and one scope decision:
  - **`623a4be`, F-01 and F-02.**
    - **F-01.** Served ids are only models a response named. The client
      reports `servedModelId` without the requested-model fallback, on content
      chunks too, so a reported model survives missing usage and a broken-off
      stream.
    - **F-02.** `ExecutionResult` and `AnalysisResult` carry `replySource`. A
      reply the engine wrote itself (empty or null, exhausted corrections, an
      exhausted capability limit) is `host-fallback` and commits unstamped.
  - **`7e0b534`, F-02's completion-stage note.** When a persona's reply is
    only a widget setup, completion writes the shown note itself. That turn now
    commits unstamped.
  - **`174012c`, N-01.** The coordinator decided that a persona's dictionary
    lookups are stamped, with scope `dictionary`. D7 gained that one bullet,
    and the tech-debt item is gone.
  - **Counts.** Before (`0c987cf`): 595 suites / 8,432 tests / 59 snapshots.
    After: 598 / 8,472 / 59, all passing. Typecheck is clean, and lint stays
    at 0 errors and 1,133 warnings.
  - **Files over 500 lines that grew.**
    - `DictionaryService` 771 → 800. Its aggregation lives in the new 58-line
      `DictionaryRunModel.ts`.
    - `WorkshopPersonaCapability` 846 → 855.
    - `AgentRunEngine` 1,152 → 1,172.
    - `OpenRouterClient` 604 → 627.

    Each grew only by the new field and its reads.
- **2026-11-03. Slice 6 re-review fixes (PR #185).** Astra re-reviewed
  `edf98ce`
  ([notes](../../../docs/pr-reviews/workshop-wayfinding-slice-6-model-stamps-review.md#re-review-findings-at-edf98ce-2026-11-03)).
  The earlier fixes held. She found two more P2s and asked for one decision:
  - **`09ea77f`, F-03.** A stream's model named in a frame with no content now
    reaches the engine at once. An interrupted stream (EOF without a terminal
    frame, or a provider error) keeps it.
  - **`247c87a`, F-04 and N-02.**
    - **F-04.** A dictionary block whose text normalization removes no longer
      counts toward the entry's stamp.
    - **N-02.** The coordinator decided that a full entry is read in request
      order, as D7 says. Each block is numbered when its request is sent. The
      ADR is unchanged.
  - **Counts.** 598 suites / 8,480 tests / 59 snapshots, all passing.
    Typecheck is clean, and lint has 0 errors and 1,133 warnings.
- **2026-11-03. Slice 2 (Read in and the reader).** Landed in `a88ef63` (host
  routes) and `e1111b2` (webview), on PR #186.
  - **What landed.**
    - `WORKSHOP_REQUEST_READ_IN_RESOURCE` → `WORKSHOP_READ_IN_RESOURCE_CONTENT`
      and `WORKSHOP_OPEN_READ_IN_RESOURCE`, registered as reads by
      `WorkshopContextHandler` beside the attachment content and open-file
      routes, served by `WorkshopReadInRoutes`.
    - Resolution is `resource.read`'s, now one module
      (`WorkshopConfiguredResourceLookup`: the safe-path rule the codec used,
      exact-then-unique-case-folded matching, UTF-8 slicing), over the intake
      catalog, which is built on the same `ContextResourceResolver` instance
      as the persona capability. Refused by reason, with no content echoed
      and no path or content logged: an unknown group, an unlisted file
      (including a known group with nothing configured at that path), an
      absolute POSIX or Windows path, a URI, `..`, a file over
      `readSourceBytes`. Content stops at `readBytes` and says `truncated`.
    - `partitionContextSources` and `readInOpenAction`
      (`utils/workshop/contextSources.ts`); `WorkshopReadInPanel` in the
      Material panel; the per-tab badge in `useWorkshopRailTabs`; the
      `read-in` sheet mode; `useWorkshopReadIn` for transport.
  - **Counts.** Before, at `2108bdc`: 594 suites / 8,425 tests / 59
    snapshots. After: 599 / 8,499 / 59, all passing. `npm run typecheck`
    clean. `npm run lint`: 0 errors, 1,133 → 1,133 warnings: three new
    PascalCase `naming-convention` warnings (`WorkshopReadInPanel`,
    `RowBody`, the new App test's `PmLogo` mock) and three `curly` warnings
    gone with the safe-path rule's move out of the codec. No `from 'vscode'`
    in core.
  - **Sizes.** New files are all under 500 lines. Files already over 500
    that grew: `WorkshopApp.tsx` 1,673 → 1,699 (the read-in wiring; the
    sheet-body derivation moved out to the controller;
    [tech debt](../../tech-debt/2026-11-03-workshop-app-root-size.md));
    `WorkshopContextHandler.ts` 977 → 993 (two registrations and the
    collaborator; the route bodies live in `WorkshopReadInRoutes`);
    `WorkshopContextIntakeService.ts` 590 → 595 (`readText`, which `load`
    now uses too); `styles/workshop/context.css` 782 → 892 (the Read in
    rules; Jest maps no CSS, so a new stylesheet would need a mock in every
    `WorkshopApp` test).
  - **Deviations.**
    - *Reply shape.* `WORKSHOP_READ_IN_RESOURCE_CONTENT` echoes `group` and
      `path` as plain strings, exactly as sent, so the sheet matches its
      reply even when the host refuses a malformed pair. The requests use
      `ConfiguredResourceRef`.
    - *Material's count* now includes read-in rows ("Material, N items").
    - *Badge identity* is `kind`, `origin`, `label`, `deliveredAt`; `stale`
      is left out, so a row being superseded never badges, and a stale row
      drops its badge (as a stale to-do does).
    - *Accessible description.* A reader row's `aria-label` names the action;
      its kind and time are its `aria-describedby`.
    - *Sheet body.* `useWorkshopContextSheet` returns one `sheetBody`
      (value, loading, error, truncated, canOpenInEditor) for every mode, so
      `WorkshopApp` no longer works out attachment loading itself.
    - *Refusal copy* comes from `workshopReadInRefusalMessage`, a switch with
      a `never` default; opening a refused pair reports on the existing error
      path, as its neighbors do.
  - **Follow-ups.** None new. The live check that Open beside lands in the
    column beside the Workshop is Slice 8's.
  - **PR #186 review (Astra, 2026-11-03).** Changes requested on one P2
    (F-01). Replies were matched by `{ group, path }`, which names a file,
    not a request, so after Close → reopen a late reply to the first opening
    seeded the reopened sheet. Fixed in `7a153fd` and `1687b0a`, after the
    coordinator's merge of the epic (`8d27899`, Slice 6). The content request
    now carries a webview-minted `requestId` that the host echoes, and only
    the pending request's first reply is taken. A room replacement or a
    chat-target change closes an open reader and drops its request.
    - *Contract change.* The request payload gains `requestId` beyond the
      slice doc's `{ group, path }`. It is a message field, not a persisted
      one.
    - *Counts.* At `1687b0a`: 606 suites / 8,601 tests / 59 snapshots, all
      passing. Typecheck clean. Lint 0 errors, 1,136 warnings, unchanged
      from the merged head. The ledger is in
      [the review](../../../docs/pr-reviews/pr-186-workshop-wayfinding-read-in-review.md).
  - **PR #186 re-review (Astra, 2026-11-03).** F-01 confirmed fixed. A new
    P2, F-02, had been there since the slice was first built: activating
    another row behind an open reader showed B's heading over A's body,
    because the sheet seeds once per mount. Keyboard users could reach that
    row because nothing kept Tab inside the dialog. Fixed in `3c184c2`.
    - Each reader request keys its own sheet (`sheetKey`), and authoring
      modes keep one shared key.
    - `WorkshopModalShell` gains an opt-in `trapFocus`, which only the text
      sheet turns on.
    - The shared modal gap is
      [tech debt](../../tech-debt/2026-11-03-workshop-modal-focus-containment.md).
    - *Counts.* At `3c184c2`: 606 suites / 8,608 tests / 59 snapshots, all
      passing. Typecheck clean. Lint 0 errors, 1,136 warnings, unchanged.
  - **PR #186 second re-review (Astra, 2026-11-04).** F-01 and F-02
    resolved. One P3, N-01: the new focus trap ordered stops by document
    position, so a positive `tabindex` in rendered Markdown escaped the
    wrap. Fixed in `fe0d47d` by ordering stops as the browser does.
    Stripping positive `tabindex` from rendered content is
    [tech debt](../../tech-debt/2026-11-04-markdown-positive-tabindex.md).
    - *Counts.* At `fe0d47d`: 606 suites / 8,609 tests / 59 snapshots, all
      passing. Typecheck clean. Lint 0 errors, 1,136 warnings, unchanged.
  - **PR #186 third re-review (Astra, 2026-11-04).** N-01 confirmed. One P3,
    N-02: the trap stepped in only at its own first and last stops, so a
    positive `tabindex` behind the sheet could interleave with the page-wide
    order. Fixed at the root in `cf1b8c4`: with the trap on, the dialog
    handles every Tab itself, in its own browser-ordered stops.
    - *Counts.* At `cf1b8c4`: 606 suites / 8,611 tests / 59 snapshots, all
      passing. Typecheck clean. Lint 0 errors, 1,136 warnings, unchanged.
  - **PR #186 fourth re-review (Astra, 2026-11-04).** N-02 confirmed. N-03
    (P3): the manual traversal missed `<summary>` and stuck on buttons inside
    `<fieldset disabled>`. The coordinator decided to change approach, and
    `e69125b` deletes the trap (superseding the N-01 and N-02 traversal
    code). While any text sheet is open, `FullTabShell`'s new opt-in
    `inertBehindOverlay` marks the header and split `inert`, and the
    Workshop's banners carry `inert` in an always-present `display: contents`
    wrapper. The browser handles tab order inside the sheet.
    - Tab past the last stop may reach VS Code's chrome, as a native modal's
      does. Native traversal is Slice 8's live check.
    - *Counts.* At `e69125b`: 606 suites / 8,610 tests / 59 snapshots, all
      passing. Typecheck clean. Lint 0 errors, 1,136 warnings, unchanged.
- **2026-11-04. Slice 3 (read-in provenance).** Built on
  `epic/workshop-wayfinding-slice-3-read-in-provenance`, PR #187. The
  [slice doc](slice-3-read-in-provenance.md#built) has the full map.
  - **Commits.**
    - `e36e4af`: rows record their provenance.
      - `ContextSourceEntry` gains `turnId` and `lineRange`.
      - The host-only `StoredContextSourceEntry` adds `sourceFingerprint`,
        which `getContextSources` projects away.
      - Every persona capability family names its card. `resource.read`
        records its range and a SHA-256 of the whole file.
      - The codec and the archive validator accept the new fields and refuse
        malformed ones.
      - A pre-provenance fixture reads and saves byte for byte.
    - `3b23a92`: the reader's request names its row by `deliveredAt`. The
      host looks that row up in the chat target's conversation, compares
      fingerprints, and answers `lineRange` and `changedSinceRead`. The
      fingerprint never leaves the host.
    - `2163cb9`: the webview side.
      - `jump` for card-backed rows.
      - The numbered-lines view, with the band, the end-of-read marker and
        the scroll to the range.
      - The amber banner.
      - "Show where it was read", which closes the sheet before it jumps.
      - `useWorkshopTurnJump`, now shared with to-do "show source".
  - **Paths that mint no card carry no `turnId`, each with a test:**
    - a call the session refused;
    - a tool side-pass (`WorkshopToolContextCapability`).
  - **Counts.**
    - Before, on a clean worktree at `0839502`: 606 suites / 8,610 tests / 59
      snapshots. One wall-clock test failed under load and passed alone. It
      is already tracked:
      [tech debt](../../tech-debt/2026-11-03-lightbox-passages-wall-clock-test.md).
    - After, at `2163cb9`: 611 / 8,683 / 59, all passing.
    - `npm run typecheck` is clean.
    - `npm run lint` has 0 errors. Warnings went 1,136 → 1,138, both new
      ones the PascalCase `naming-convention` kind (`WorkshopReadInLines`,
      the new App test's `PmLogo` mock).
    - `packages/core/src` has no `from 'vscode'`.
  - **Files over 500 lines that grew.** Each grew only by the new seam:
    - `WorkshopApp.tsx` 1,709 → 1,714. The jump moved out to
      `useWorkshopTurnJump`.
    - `WorkshopRoomHandler` 1,583 → 1,593. `chatTargetConversation` was
      extracted from `activeContextBudget`, and the effect added.
    - `AgentRunEngine` 1,172 → 1,188.
    - `AssistantToolService` 1,106 → 1,118.
    - `WorkshopSessionStateV1Shape` 1,037 → 1,052.
    - `WorkshopPersonaCapability` 855 → 872.
    - `ConversationManager` 672 → 698. Its row logic lives in the new
      `ContextSourceRecord.ts`, at 111 lines.
    - `WorkshopContextHandler` 993 → 996.
    - `styles/workshop/context.css` 892 → 960. These are the reader's rules;
      a new sheet would need a Jest mock in every `WorkshopApp` test.

    All of them were already over 500.
  - **Deviations.**
    - The fingerprint rides beside the capability result's `metadata`, not in
      it. `metadata` is persisted on the card, shown in the thread, and
      printed into the persona's evidence.
    - A row is named by `deliveredAt` plus its file. Rows have no id.
    - `changedSinceRead` is absent, not `false`, when the row has no
      fingerprint.
    - The band is drawn on the Source tab's numbered lines, and a ranged
      read opens there.
    - Jump rows are named "Show the card for {label} in the thread".
    - The optional rail "changed since" tag is not built.
  - **Follow-ups.**
    - [Read-in row identity](../../tech-debt/2026-11-04-read-in-row-identity.md):
      rows that share a delivery time share provenance in the reader.
    - Slice 8's live pass should check two things: the reader's scroll to the
      range, and the jump's focus in a real webview.
  - **PR #187 review (Astra, 2026-11-04).** Two P2s and one P3, all fixed.
    The ledger is in
    [the review](../../../docs/pr-reviews/pr-187-workshop-wayfinding-read-in-provenance-review.md).
    - **`6575bbb`, F-02.** A writer-source row validated with a
      `sourceFingerprint` would have reached `WORKSHOP_SESSION_STATE`.
      - The codec now refuses the key on writer rows.
      - `activeContextBudget` projects every row it sends.
      - A route regression covers host, guest and tool writer rows.
    - **`16aa38c`, F-01.** The overlay's queued opener restore took focus back
      from the card after "Show where it was read".
      - `useOverlayDismiss.focusAfterOverlaysClose` runs a deliberate
        destination in place of the opener restore, and falls back to the
        opener when the destination takes no focus.
      - The jump registers there before it closes the sheet.
    - **`9801e01`, N-01.** The range scroll ran while the Source pane was
      still hidden. It now runs the first time the pane is visible, once per
      range.
    - **Counts.** At `9801e01`: 613 suites / 8,695 tests / 59 snapshots, all
      passing. Typecheck is clean. Lint has 0 errors and 1,138 warnings,
      unchanged.
    - **Sizes.** `WorkshopRoomHandler` 1,593 → 1,597 (the projection) and
      `WorkshopSessionStateV1Shape` 1,052 → 1,055 (the comment).
      `WorkshopApp.tsx` went 1,714 → 1,713.
  - **Merged.** Astra's re-review at `119a0ce` resolved all three findings.
    CI was green on `bcf6c1d`, and the coordinator merged PR #187 into the
    epic at `89d6f26`.
- **2026-11-04. Slice 4 (bookmarks on the host).** Started on
  `epic/workshop-wayfinding-slice-4-bookmarks-host`, cut from the epic at
  `89d6f26`. The slice doc's [Since Slice 3](slice-4-bookmarks-host.md#since-slice-3)
  section lists what the earlier slices settled for it.
- **2026-11-04. Slice 4 built.** The
  [slice doc](slice-4-bookmarks-host.md#built) has the full map.
  - **Commits.**
    - `1ed59f5`: contracts, the shared label rule, the ledger.
    - `9f3b261`: the aggregate seam, the optional `bookmarks` key and its
      codec (`session/WorkshopBookmarkRecords.ts`), the
      `dropped-dangling-bookmarks` normalization, a pre-bookmark fixture
      recorded by the real aggregate.
    - `b476e99`: `WorkshopBookmarkHandler`, both routes behind the mutation
      gate.
    - `c72906d`: Rewind's prune in `rewindWorkshopSession`; New, Open, Rewind
      and Branch tested through the real coordinator.
    - `c813fb4`: export marks bookmarked turns; recall and prompt witnesses.
    - `852e023`, `87c089a`: lint and the seam witness's route count.
  - **Counts.**
    - Before, at `89d6f26` (as recorded at `9801e01`; `dc5ed54` is docs
      only): 613 suites / 8,695 tests / 59 snapshots.
    - After, at `87c089a` on a clean tree: 620 / 8,796 / 59, all passing.
    - `npm run typecheck` is clean.
    - `npm run lint` has 0 errors. Warnings went 1,138 → 1,140, both new ones
      the `naming-convention` kind of the `MessageType` enum's own members
      (`WORKSHOP_SET_TURN_BOOKMARK`, `WORKSHOP_RENAME_BOOKMARK`).
    - `packages/core/src` has no `from 'vscode'` outside test string literals.
  - **Files over 500 lines that grew.** Each grew only by the calls into the
    new modules:
    - `WorkshopSessionService` 2,562 → 2,595;
    - `WorkshopSessionStateV1Shape` 1,055 → 1,061;
    - `WorkshopSessionStateV1Integrity` 651 → 657;
    - `WorkshopSessionRewind` 555 → 558;
    - `WorkshopTranscriptHtmlStyles` 637 → 640 (the mark's rules live in the
      new `WorkshopTranscriptHtmlBookmarkStyles.ts`);
    - `shared/types/messages/workshop/session.ts` 942 → 948.

    `WorkshopRoomHandler` didn't change. New files are all under 500 lines.
  - **Deviations.** Listed in the slice doc. The ones a reviewer should know:
    - Ids carry their number, and no counter is persisted.
    - The writer's tool-run request isn't bookmarkable.
    - Default labels read through the transcript projection, so a capability
      card is named by its request, never its evidence.
    - A rolled-back provisional turn takes its bookmark with it.
  - **PR #188 review (Astra, 2026-11-04).** One P2, F-01, fixed in `5d0b5fc`.
    The ledger is in
    [the review](../../../docs/pr-reviews/pr-188-workshop-wayfinding-bookmarks-host-review.md).
    - The id grammar accepted a counter of any length. Hydration turned an
      oversized one into `Infinity` or an exponent, the next set minted an id
      the codec refuses, and every later save failed.
    - Both id parts are now canonical safe integers of at least 1. Hydration
      installs only a safe counter. A set past the maximum is refused with no
      change.
    - Regressions run through the real parser, decode, hydration, set and
      strict save, plus a real-coordinator recovery control.
    - *Counts.* At `5d0b5fc`: 621 suites / 8,814 tests / 59 snapshots, all
      passing. Typecheck clean. Lint 0 errors, 1,140 warnings, unchanged.
    - *Sizes.* `WorkshopBookmarkLedger.ts` 279 → 324; no over-500 file
      changed.
  - **Merged.** Astra's re-review at `c42abe1` resolved F-01. CI was green on
    `59e145c`, and the coordinator merged PR #188 into the epic at `356c751`.
  - **Coordinator calls.** Tool-run requests stay ineligible; the tool report
    that answers one is bookmarkable. Whether Rewind's summary names the
    bookmarks it removes is left to Slice 5.
- **2026-11-04. Slice 5 (bookmarks in the rail and thread).** Started on
  `epic/workshop-wayfinding-slice-5-bookmarks-ui`, cut from the epic at
  `356c751`. The slice doc's [Since Slice 4](slice-5-bookmarks-ui.md#since-slice-4)
  section lists what the earlier slices settled for it.
- **2026-11-04. Slice 5 built.** The
  [slice doc](slice-5-bookmarks-ui.md#built) has the full map.
  - **Commits.**
    - `d295bcd`: `isWorkshopBookmarkableTurn` moves to
      `shared/constants/workshopBookmarks.ts`; the ledger, the codec and the
      bubble read the one rule.
    - `bba9a43`: `WORKSHOP_REQUEST_TURN_PREVIEW` → `WORKSHOP_TURN_PREVIEW`,
      correlated by a webview-minted `requestId`. `WorkshopBookmarkHandler`
      serves it as a direct read: it waits out a room replacement, reads
      `readRoomLedger()`, and sends the turn only through
      `projectWorkshopTranscriptTurn` (`WorkshopTurnPreview`).
      `useWorkshopBookmarks` is the transport.
    - `3823135`: `WorkshopBookmarkToggle` in the bubble; the Notes badge
      counts bookmarks by id.
    - `5a59a0c`: `WorkshopBookmarkList` under To-dos, rename through
      `useWorkshopBookmarkRename`, remove, the Notes count. A writer message
      now carries its turn id, so a jump to one lands.
    - `47326e1`: the `turn-preview` sheet mode; `useWorkshopTurnJump` opens
      it for any unrendered turn (bookmarks, to-do sources, read-in card
      rows), and the out-of-window toast is gone.
    - `9b2a605`: why the export's bookmark mark stays export-only.
    - The docs commit with this note also splits the App tests into
      `WorkshopApp.bookmarks` and `WorkshopApp.turnPreview`, so neither
      passes 500 lines.
  - **Counts.**
    - Before, at `356c751`: 621 suites / 8,814 tests / 59 snapshots.
    - After, at `9b2a605` on a clean tree: 625 / 8,891 / 59, all passing.
      With the test split: 626 / 8,891 / 59.
    - `npm run typecheck` is clean.
    - `npm run lint` has 0 errors. Warnings went 1,140 → 1,146, all
      `naming-convention`: `WorkshopBookmarkList`, `WorkshopBookmarkToggle`,
      the two new `MessageType` members, and the two new App tests' `PmLogo`
      mocks.
    - `packages/core/src` has no `from 'vscode'`.
  - **Files over 500 lines that grew.** Each grew only by the seam:
    - `WorkshopApp.tsx` 1,713 → 1,737: the hook, the sheet's three preview
      options, `openBookmark`, the rail's `bookmarks` props and the thread's
      three toggle props.
    - `WorkshopTurnBubble.tsx` 754 → 779: three props, the toggle, its two
      placements, and the writer bubble's turn id.
    - `styles/workshop/shell.css` 2,673 → 2,792: the toggle and list rules.
      A new stylesheet would need a Jest mock in every `WorkshopApp` test.

    New files are all under 500 lines.
  - **Decisions recorded in the slice doc.** Rewind names no removed
    bookmarks, because its confirmation and result name no removed to-dos.
    No export rule moved to the mirrored layer, because the thread's mark is
    an action-row control that export never renders.
  - **PR #189 review (Astra, 2026-11-04).** Two P2s, both fixed in
    `e944375`, and one P3, N-01, fixed in `c97d947`. The ledger is in
    [the review](../../../docs/pr-reviews/pr-189-workshop-wayfinding-bookmarks-ui-review.md#author-response).
    - **F-01.** A rename refused under the session-operation gate lost the
      writer's draft, because the field closed as soon as it posted. A
      rename now names its request. `WORKSHOP_RENAME_BOOKMARK_RESULT`
      answers it, and the field keeps the draft until then.
    - **F-02.** During an Open whose rooms shared a turn id, a preview asked
      for in the old room could be answered from the new one. The request
      now names its `roomRevision`. The host waits out every pending
      replacement and refuses once the room is another, and the webview
      drops a reply from another room.
    - **N-01 (P3).** The preview now names who heard a private exchange,
      in the bubble's wording.
    - *Counts.* At `e944375`: 628 suites / 8,910 tests / 59 snapshots, all
      passing. At `c97d947`: 628 / 8,913 / 59; one Lightbox passages
      wall-clock test failed under load in the full run and passed alone
      ([tech debt](../../tech-debt/2026-11-03-lightbox-passages-wall-clock-test.md)).
      With the N-01 App witness: 628 / 8,914 / 59, all passing. Typecheck clean. Lint 0 errors, 1,146 → 1,150 warnings, all
      `naming-convention`: one enum member, one `PmLogo` mock, and the jsdom
      text-encoding shim's two names.
    - *Sizes.* `WorkshopSessionService` 2,595 → 2,600 (`readRoomRevision`);
      `WorkshopApp.tsx` 1,737 → 1,738; `shell.css` 2,792 → 2,797. New and
      touched files otherwise stay under 500.
  - **PR #189 re-review (Astra, 2026-11-04).** F-01's gate refusal, F-02's
    successful-Open binding and N-01 confirmed. Two new P2s, both from those
    fixes, both fixed.
    - **`0659956`, F-03.** A second row's rename could take over the first
      one's pending answer. The pending rename now records its owner, one
      rename runs at a time (other rows' Rename is disabled), and Escape
      while pending abandons the request.
    - **`905f43b`, F-04.** A failed Open restored the room under a new
      revision but posted no snapshot, so every later preview was refused.
      Its failure path now posts the restored room, as New, Rewind and
      Branch's did.
    - *Counts.* At `905f43b`: 629 suites / 8,924 tests / 59 snapshots, all
      passing. Typecheck clean. Lint 0 errors, 1,150 warnings, unchanged.
    - *Sizes.* `WorkshopSessionMessageHandler` grew by 4 lines (the post and
      its comment). New and touched files otherwise stay under 500.
