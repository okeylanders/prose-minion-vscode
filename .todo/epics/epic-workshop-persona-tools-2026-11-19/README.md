# Epic: Workshop Persona Tools

**Status:** Slice 0 (the spec) in review (PR #286); revised after Astra's review and re-review (ADR D6a–D6e, D8a, D8b, D13a, D22a). Nothing built yet. Nothing has gone to `main`.
**Priority:** Medium
**Opened:** 2026-11-19
**Branch:** `epic/workshop-persona-tools`, cut from `main` at `478157d`.
**ADR:** [2026-11-19: Workshop Persona Tools](../../../docs/adr/2026-11-19-workshop-persona-tools.md)
(items A, B and C; C amends [ADR 2026-11-05](../../../docs/adr/2026-11-05-helper-agent.md) D6).

## Goal

Three medium features, each giving the Workshop's personas a new way to act
for the writer:

| Item | What the writer gets | Okey's # | Source note | Okey's decisions |
|---|---|---|---|---|
| A | A persona marks to-dos done or dismissed, in the open room and in saved sessions, with a receipt and Undo | 30 | [Personas Close To-dos](../../features/feature-workshop-recall-todo-closeout/README.md) | T1 |
| B | A persona reads a file's git history: its commits, and a prose-aware diff between two | 28 | [Personas Read a File's Git History](../../features/feature-workshop-file-git-history/README.md) | G1–G3 |
| C | The project's context paths, suggested from its folders in Settings or worked out with a persona, applied by the writer | 26 | [Set Up the Project's Context Paths](../../features/feature-helper-project-locations/README.md) | L1–L3 |

**The three source notes are never edited on this branch.** Status and
decisions live in this README and the ADR.

## Slices

| # | Item | Decisions | Branch | PR | Status |
|---|---|---|---|---|---|
| 0 | Spec | (this README and the ADR) | `epic/workshop-persona-tools-spec` | #286 | In review |
| B | B: `history.log`, `history.diff`, the `FileHistory` port and its Git adapter | ADR D11–D17, D13a | `…-file-git-history` | | Waiting on 0 |
| A | A: the to-do status trailer, the open room's changes, the saved-session write port, the receipt and Undo | ADR D1–D10, D6a–D6e, D8a, D8b | `…-todo-closeout` | | Waiting on 0 |
| C1 | C: the scan, the checker (the resolver's `matchPatterns` seam), the write, `levelOf`, the helper task and the Settings sheet | ADR D18–D25, D22a, D28 | `…-context-paths-settings` | | Waiting on 0 |
| C2 | C: the persona `locations.*` family, the proposal trailer, its card and its outcome kind | ADR D26–D28 | `…-context-paths-persona` | | Waiting on B, A and C1 |
| Close | Closing pass: live pass, `AGENTS.md`, memory bank, tech debt | | `…-close` | | |

Slice branches are `epic/workshop-persona-tools-<slug>`. A slice running
under another slug keeps its own; this table then records the name it used.

## Order

1. **Slice 0.**
2. **After Slice 0 is approved, B and A in parallel.** They share only
   `promptBudgets.ts`, `boundaries.test.ts`, the help files and
   `WorkshopPersonaCapability.ts`; the second to merge takes the other's
   lines.
3. **C1** after either. It touches the Settings overlay, the resolver and
   the helper, none of which B or A touches.
4. **C2** last: it adds a capability family on B's grammar work and a
   trailer and outcome kind on A's.
5. **The closing pass:** a live-pass checklist, `AGENTS.md`, a memory-bank
   entry.

## Shared seams

- **`extractWorkshopReplyControls`** (`core/utils/workshopReplyControls.ts`):
  A's `<prose-minion-todo-status>`, then C2's
  `<prose-minion-locations-proposal>`. Each joins `TRAILER_TAGS`,
  `REDACTIONS` and `RESERVED_PERSONA_FRAME`.
- **Trailer outcomes:** A's `todos` side, then C2's `locations` side, in
  `WorkshopTrailerOutcomes`, `workshopTrailerDropReason`,
  `buildWorkshopTrailerOutcomes`, the frame and
  `workshopTrailerOutcomeWords.ts`.
- **The capability grammar:** B's `history` family, then C2's `locations`
  family. Each edits `WORKSHOP_CAPABILITY_OPERATIONS`, the request union,
  every family switch, `WORKSHOP_CAPABILITY_FIELD_POLICY`,
  `WORKSHOP_NATIVE_CALL_FIELDS`, and a grammar prompt with its sync test.
- **`PROMPT_BUDGETS`:** `workshopTodoStatus` (A), `workshopHistory` (B),
  `contextPaths` and `helper['project-locations']` (C).
- **The help reference** (`packages/core/resources/help/`): A and B in
  `workshop.md`, C in `overview.md`.
- **The session shape** (`WorkshopSessionStateV1Shape.ts`): A's `closedBy`
  and `todoStatusChanges`, B's card kinds and manifest kind, C2's
  `locationsProposal`. Each in a decoder module of its own.
- **The Settings overlay and `apps/vscode-extension/package.json`:** C only.
  No slice adds a command or a setting.
- **`Platform`:** B's `FileHistory` port; C1's `SettingsStore.levelOf`.

## Rules binding every slice

**Branches and review**
- Slice PRs go into `epic/workshop-persona-tools`.
- **Astra** (Okey's review agent) reviews each. A slice is merged with a
  merge commit, and only after Astra approves. Findings are fixed on the
  slice branch, answered in the PR and re-reviewed.
- Merge between branches; never rebase a shared branch.
- **Nothing targets `main` without Okey.** Never commit to `main` or
  `claude/idea-inbox`.
- Commit messages end with the session's two trailer lines. A model
  identifier appears nowhere else in a commit, code or doc.

**Verification**
- `npm run typecheck`.
- `npm run lint`: no new errors.
- The full `npx jest`, with its counts in the PR.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines. A file already over 500 lines gains only the
  call into a new module. `promptBudgets.ts` is the one table every bound
  lives in, and takes its keys there.
- No live, billable model calls in tests.

**Writer data**
- Logs never carry writer text, to-do text, notes, session titles, commit
  ids, commit subjects, authors, paths, folder names or patterns. Counts,
  host ids and fault kinds only.
- Fixtures use *Alice*, or made-up names, folders and history.
- A session-codec change is optional and additive (ADR 2026-07-30), with an
  authentic fixture from before the slice that must keep reading.

**Contracts**
- **Help.** An item's feature is complete only with its section in
  `packages/core/resources/help/`, and any command or setting mapped in
  `help/index.json`. Run
  `node apps/vscode-extension/scripts/generate-help-tables.js` when the
  manifest changes. `helpReferenceSync.test.ts` must pass.
- **Context tally.** Every new frame the host writes is added to the run's
  `WorkshopContextTallyRecorder` where it is placed, under a piece in
  `WORKSHOP_CONTEXT_TALLY_PIECES`. New tool-use prompt sections join
  `WORKSHOP_TOOL_USE_PROMPT_PATHS`.
- **Trailer outcomes.** A new trailer kind gets typed verdicts, a mapping in
  `trailerOutcomes/WorkshopTrailerDropReasons.ts`, and words in
  `workshopTrailerOutcomeWords.ts`. The conservation test must hold.
- **Capability grammar.** `history.*` and `locations.*` each join
  `WORKSHOP_CAPABILITY_OPERATIONS`, every family switch and
  `WORKSHOP_NATIVE_CALL_FIELDS`, with grammar prompts pinned by sync tests,
  and every hint decodes as written.
- Webview hooks are tripartite, with webview-minted request ids.
- Recall's ports and their boundary witnesses stay read-only.

**At the end**
- A live-pass checklist (`live-pass.md`).
- `AGENTS.md` updated where a rule changed.
- A memory-bank entry.

## Defaults taken

Okey's decisions are marked. The rest were taken for him by the
orchestrator, from the brief or his notes' leanings, and refined where the
code showed otherwise. **None of those is an owner decision,** and each is
his to overturn. The ADR's open questions are rows 9 (Q1), 10 (Q2), 22 (Q3)
and 38 (Q4).

| # | Item | Question | Taken | Why |
|---|---|---|---|---|
| 1 | A | Confirm, or apply at once | Apply at once, with Undo per change (T1). | **Okey's decision** |
| 2 | A | Which statuses a persona sets | `completed` or `dismissed`, on an `open` to-do only. Only the writer reopens. | Brief default |
| 3 | A | Bounds per reply | 20 changes, touching at most 10 saved sessions; `PROMPT_BUDGETS.workshopTodoStatus`, held to the prompt by a sync test. | Brief default |
| 4 | A | What the persona hears back | A `todos` side in trailer outcomes, on the one `<workshop-trailer-outcomes>` frame. No new channel. | Brief default |
| 5 | A | A saved session open in another window | **Refined three times.** The compare alone is not atomic (PR #286 F-01), and the shared `StoredFileClaims` path does not fence a writer stalled past its lease (re-review, finding 1). Every named-session writer (Save, autosave, rename, delete, the persona's write and Undo) takes `WorkshopNamedSessionLock`: a lock directory per file, the staged checkpoint inside it under the owner's token, so a takeover removes it and a stale publish finds no source; every owner artifact sits under its own token's subdirectory, destructive steps act only on what the owner detached (second re-review). There is no automatic takeover: a lock past its lease reads "recovery required", `missing` is decided only while holding the lock, and release deletes only the owner's token-named paths (third re-review). Of two overlapping writers exactly one commits; the other is refused as `busy`. The shared `StoredFileRewrite` is unchanged. An uncoordinated external sync stays covered only by the compare. | Code: `updateNamed`, `writeJsonAtomically`, `StoredFileRewrite`; precedent `WorkshopPinnedContextLock`, PR #204 F-01 (ADR D6a, D6b, D6d, D6e) |
| 6 | A | Refuse sessions another window has open | Not built. | The store has no cross-window registry; row 5's claim covers it |
| 7 | A | How recall sees the change | The write moves `updatedAt`, as rename does. | **Code:** recall's cache is keyed by `updatedAt` (`WorkshopRecallDocumentCache.get`) |
| 8 | A | "Lands in the reply's own commit" for a saved session | **Refined.** The open room's change does. A saved session's row commits `saving` and is written just after, then settles `applied` or `refused`. A reply that never commits writes nothing. Across a restart the row is settled read-only from the file: the write stamps an `operationId` into `closedBy`, so the row reads `applied` if the stamp is there, `interrupted` if the file was read without it, and `unverified` (checked again later, never replayed) if it could not be read (PR #286 F-02, re-review finding 3). | File I/O cannot sit in the synchronous commit; the compare copy is memory-only (ADR D8a, D8b) |
| 9 | A | A row still `saving` when the next message is built | Told as "being saved". (Q1) | No wait on the next send |
| 10 | A | Rewind past a receipt | The to-dos stay closed; the receipt and its Undo go with the reply. (Q2) | **Code:** `rewindWorkshopSession` never changes a kept to-do's status, the writer's tick included |
| 11 | A | The open room's own id named as a saved session | It names the open room. | **Code:** recall never lists the live room; rename routes it the same way |
| 12 | A | Who sees open-room ids | The host's snapshot only, as now (12 open current-excerpt to-dos at most). A guest closes saved sessions' to-dos by `transcript.todos` ids. | **Code:** the snapshot is host-only (`buildTodoEvidence`) |
| 13 | A | Undo in a branch | Open-room rows undo there; saved rows offer none. | A branch is not the room that made the change |
| 14 | A | Undo's route | `WORKSHOP_UNDO_TODO_STATUS`, owned by `WorkshopTodoHandler`. No new route owner. | It already owns the writer's to-do actions |
| 15 | A | `closedBy`'s fields | Persona id and label, the room's session id and title then, the turn, the time, the note. The writer's own change clears it. | "Done · by Jill in *Polish 6.11*" needs the title as it was |
| 16 | A | A setting | None; the trailer is always read. | T1, and the brief names none |
| 17 | B | A setting | None; available whenever the project is a git repository (G1). | **Okey's decision** |
| 18 | B | The diff library | `diff` (jsdiff), a deliberate new runtime dependency of core (G2). | **Okey's decision.** It is not installed today, even transitively; Jest's `diff-sequences` is dev-only |
| 19 | B | Authors in the log | Shown to the persona; never logged (G3). | **Okey's decision** |
| 20 | B | The port's shape | **Refined.** `log(fsPath, limit)` and `show(fsPath, commit)`; core pages. | The Git extension's `LogOptions.skip` may not exist at the 1.82 floor; `maxEntries` and `path` do |
| 21 | B | The Git typings | Not in the repository; the adapter copies the few types it uses, with their source named. | ADR D12 lists exactly what is relied on |
| 22 | B | Renames | Not followed; stated as the limit. (Q3) | The API's `log` has no `--follow` |
| 23 | B | "Text conversions never run" | **Refined:** diff drivers and external tools never run; a repository's `textconv` may run inside `show`. Workspace trust covers it. | `show` reads blobs through `git show`; slice B confirms |
| 24 | B | Untrusted workspaces | Keep declaring no support; a test pins it, with the reason. | `apps/vscode-extension/package.json` has no `capabilities` block, read as `supported: false` |
| 25 | B | `extensionDependencies` on `vscode.git` | Not declared; each call checks. | Declaring it would block activation where Git is disabled |
| 26 | B | How the excerpt is named | `<group>excerpt</group>` alone; a configured file by `<group>` and `<path>`. | `resource.read`'s naming, and the capability codec's text fields |
| 27 | B | A diff's continuation | By change number (`<startChange>`), with `<current>` (a fingerprint) when `<to>` is `current`. | A continuation must make progress and never misnumber a changed file |
| 28 | B | Which calls publish | `history.diff` only, with a manifest row of kind `history`. | Reads publish; discovery stays private |
| 29 | B | `history.read` | Out of v1; stays in the note. | Brief default |
| 30 | C | Where Apply writes | User level (L1). | **Okey's decision** |
| 31 | C | A persona path | Yes, through `locations.*` and a proposal trailer (L2). | **Okey's decision** |
| 32 | C | `locations.suggest` | None (L3). | **Okey's decision** |
| 33 | C | How it starts in Settings | A button, "Suggest from my folders"; one pointing line when every group matches nothing. | Brief default; it is a paid call |
| 34 | C | What the helper sees | Folders with `.md`/`.txt` counts and 3 sample names; bounds in `PROMPT_BUDGETS.helper['project-locations']`. | Brief default |
| 35 | C | What the scan skips | Hidden names, `node_modules`, `dist`, `out`, `build`, VCS folders, `prose-minion/`, links. | The resolver's own exclusions, plus Prose Minion's storage |
| 36 | C | How proposed patterns are checked | **Refined:** a new resolver seam, `matchPatterns`, runs given patterns through the same search; unsafe forms are refused before normalization; a comma is refused. | **Code:** the resolver reads settings only, strips a leading `/` and `workspace:` silently, and splits on commas |
| 37 | C | Files in two groups | Counted per group, flagged on both. | **Code:** the catalog keeps a file in its first group only |
| 38 | C | A group the workspace sets | **Refined:** shown, not offered; `SettingsStore` gains `levelOf`. (Q4) | **Code:** the settings are window-scoped, so a user-level write would change nothing here and every other project |
| 39 | C | A group changed since the proposal | Left as it is, with words. | Brief default |
| 40 | C | The Settings route | `ContextPathsSuggestionRoute`, registered by `ConfigurationHandler`. | That handler is past 500 lines; the dictionary search route is the precedent |
| 41 | C | The room card's route owner | `WorkshopLocationsProposalHandler`, the 25th composed owner. | Apply is a host action keyed by a stored proposal |
| 42 | C | What the persona hears back | A `locations` side in trailer outcomes, with pattern counts. | Brief default |
| 43 | C | Do `locations.*` results publish | No. | Folder names reach the room's model only through a persona's own call |
| 44 | All | New context-tally pieces | None: the snapshot rides `todos.snapshot`, the outcomes ride `room.trailer-outcomes`; `READ_IN_NAMES` names `history`. | **Code:** both frames are tallied where they already are |
| 45 | All | Help sections | `workshop#to-dos-a-persona-closes`, `workshop#a-files-git-history`, `overview#suggest-context-paths`. `help/index.json` unchanged. | No command or setting is added |
| 47 | B | A diff whose paragraph alignment would be costly | Refused in words past `alignParagraphs` or `paragraphEditLength`; the change list is cached per window so a continuation never realigns (PR #286 F-03). | The word stage's bound does not cover the outer alignment (ADR D13a) |
| 48 | C | A pattern whose search fails | Its group is left unchanged at review and Apply; only a completed zero-match search drops a pattern (PR #286 F-04). | **Code:** `browse-counts` skips failures as if they matched nothing (ADR D22a) |
| 49 | A | Where a refused room's work is kept | At once in a new named session, "<title> (local recovery)", by a non-overwriting create; one per refusal episode. Not `current.json`. | **Code:** `current.json` is the workspace's, not the window's (`WorkshopSessionStore.availability`); PR #286 re-review, finding 2 (ADR D6c) |
| 50 | A | The shared stored-file rewrite's own exposure | Not changed here; filed as tech debt for boards and memory. | Changing it would move Lightbox and memory behavior outside this epic |
| 51 | A | A session left locked by a window that died mid-save | No automatic recovery. It reads "Recovery required" until the writer presses **Recover…** (on the save-failed or open-refused notice, or the session browser row) and confirms other windows are closed; recovery restores the pre-image if the name is empty and keeps every differing copy as "(local recovery)". | Unattended recovery traded for the writer's data: each automatic takeover opened a new race (PR #286 third re-review; ADR D6e) |
| 46 | All | Files past 500 lines | Each gains only the call into a new module; `promptBudgets.ts` takes its keys. | The rule, and every earlier epic's budget table |
