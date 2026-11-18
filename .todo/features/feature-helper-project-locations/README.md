# Feature: Set Up the Project's Context Paths, From Settings or With a Persona

**Date Identified:** 2026-11-05 (decided as D6 of [ADR 2026-11-05](../../../docs/adr/2026-11-05-helper-agent.md)); filed as its own note 2026-11-18
**Status:** Idea. Two ways in, one proposal: the helper drafts from a Settings button (the ADR's D6, "not built in v1", never tracked until now), and a persona works it out with the writer in the room (Okey, 2026-11-18). An amendment to ADR 2026-11-05 for the button; the persona path adds a capability family and a reply trailer, so it needs an ADR section of its own.
**Priority:** Medium
**Origin:** Okey, during the helper-agent design (2026-11-05); asked about again 2026-11-18

## Problem

Personas (`resource.read`), the project picker, and soon `@` in the
composer all find the writer's files through eight context-path groups
(`CONTEXT_PATH_GROUPS`: characters, locations, themes, things, chapters,
manuscript, project brief, general).

- **Each group is a setting of comma-separated globs**
  (`proseMinion.contextPaths.<group>`). The defaults assume conventional
  folder names: `characters/**/*`, `Drafts/**/*`, `research/**/*`, and so on.
- **A project laid out another way finds nothing** until the writer types
  globs by hand. `Cast/`, `People/`, `World/`, `Book 1/Chapters/` and
  `Notes/Lore/` all miss.
- **Writing globs is a programmer's chore,** in a settings overlay of eight
  text fields.
- **The cost of getting it wrong is silent.** A persona asked to read a
  character file reports it isn't configured, and the writer doesn't know
  why.

## The design already decided (ADR 2026-11-05 D6)

- **Code scans the workspace.** It reads folder and file names only, never
  contents, bounded by count and depth, and skips hidden folders, the build
  output folder and `node_modules`.
- **The helper maps the names** to the groups' patterns.
- **Settings shows the proposal.** Each group shows the files the real
  context-path resolver matches, counted. The writer applies all of it, part
  of it, or none. **The helper never writes a setting.**

## What's left to decide, with recommended defaults

1. **How it starts: a button, not automatic.** "Suggest from my folders" in
   the Settings overlay's context-paths section. It is a paid call, and
   unlike the memory draft there's no moment that calls for it on its own.
   - Offer it once where it obviously helps: when every group matches
     nothing in this workspace.
2. **What the helper sees: folders, with a few names each.** The scan sends
   each folder's path, how many `.md` and `.txt` files it holds, and a few
   sample file names. That's cheaper than every file name and enough to
   tell `Cast/` from `Drafts/`. Bounds in `PROMPT_BUDGETS.helper['project-locations']`:
   - entries scanned, depth, folders sent;
   - sample names per folder;
   - input characters and output tokens.
3. **What it answers: globs per group, checked by code.**
   - Each pattern must be relative, `/`-separated, and hold no `..`, no
     drive and no absolute path.
   - Each is run through the real resolver (`ContextResourceResolver`), and
     a pattern that matches nothing is dropped.
   - A file matched by two groups is flagged on both.
   - A group the helper leaves out keeps its current patterns.
4. **The review sheet.** Per group:
   - the current patterns beside the proposed ones;
   - the match count, and a few example files;
   - a checkbox.

   Apply writes only the ticked groups.
5. **Where it writes: the user level, for now** (L1, below).

## Decisions (Okey, 2026-11-18)

| # | Decision | Notes |
|---|---|---|
| L1 | **Write at the user level for now**, as every setting the app writes does today (`SettingsStore.update`, `ConfigurationTarget.Global`). | Context paths are per project by nature, so applying one novel's layout changes it for every project. A workspace-level write (`.vscode/settings.json`, a target on the settings port, and the overlay saying which level a value comes from) can come later. |
| L2 | **A persona can set the paths with the writer, in conversation.** "Ask Jill to set the locations": she sees the folders and the current paths, talks them through, revises, and proposes; the writer applies. | The shape is below. |
| L3 | **No `locations.suggest`.** A persona maps folder names to groups herself; the helper's draft serves only the Settings button. | Ada's lean, taken by Okey. |

## The persona path (L2)

Okey's picture: the writer asks Jill to set the locations; a locations agent
passes Jill file names and paths, Jill discusses them with the writer, and
Jill tells the agent any changes.

**Recommended shape: the "agent" Jill talks to is host code, not a second
model.** Jill is already the model in the loop. A model-to-model relay would
add a paid call, latency and a game of telephone to each step, and the
helper has no tools and holds no conversation (ADR 2026-11-05 D1, D2). What
Jill needs from the other side is facts and checks, which code gives exactly.

1. **A read-only `locations.*` capability family**, for personas (host and
   guests), like `resource.*`:
   - **`locations.current`:** each group's patterns, how many files each
     matches, and a few example files.
   - **`locations.folders`:** the workspace scan: folders, their `.md` and
     `.txt` counts and a few sample names. Names only, never contents,
     bounded and paged, with hints that decode as written.
   - **`locations.check`:** Jill names proposed patterns for some groups,
     and code answers what each would match: counts, examples, files two
     groups would share, and patterns refused as unsafe or matching nothing.
     This is "Jill tells the agent a change and hears back". It writes
     nothing.
2. **A proposal trailer** (`<prose-minion-locations-proposal>`), read in
   `extractWorkshopReplyControls`' one pass like the file-edit and memory
   trailers. It becomes a card in the thread:
   - per group, the current patterns beside the proposed ones, with match
     counts the host computed;
   - a checkbox per group, and **Apply**.
3. **Apply is the writer's, and the host's.** It is a host action keyed by
   the stored proposal, like Persona File Edits' Apply. Before writing, the
   host checks each ticked group again; a group whose setting changed since
   the card was made says so instead of overwriting it.
4. **One proposal, one checker, one apply, two ways in.** The Settings
   button's helper draft and Jill's trailer produce the same proposal
   object. Both are checked by the same code against the real resolver, and
   applied through the same write. The helper stays a one-call task; it
   never joins the room.
5. **Jill doesn't call the helper** (L3). She maps folder names to groups
   herself, so there's no `locations.suggest`.

**Privacy.** Folder and file names reach the room's model only through
Jill's own calls, as `resource.catalog` already shows her configured files.
Logs carry counts only.

## Rules it keeps

- **The helper proposes; the writer applies** (ADR 2026-11-05 D2). It has
  no tools, reads no file contents, and writes nothing.
- **A task is a policy** in `HELPER_TASK_POLICIES`: its prompt section
  (`helper/10-project-locations.md`), input builder, exact-field decoder
  through `parseModelJson`, bounds, and a worked example with its sync test.
  The engine gets no branch.
- **The setting `proseMinion.workshop.memory.helperDrafts` doesn't cover
  this.** It's a button the writer presses, so no setting is needed. That
  also keeps it out of the setting rename the session-name note plans.
- **Folder and file names are writer data.** They leave only on the
  writer's press, and logs carry counts only: folders scanned and sent,
  patterns proposed, kept and dropped, and matches. Never a path or name.
  Fixtures use *Alice*-style made-up folders.

## Completion Criteria

- [ ] "Suggest from my folders" scans names only, within its bounds,
      skipping hidden folders, build output and `node_modules` (test).
- [ ] The helper's answer is checked by code: unsafe patterns are refused,
      patterns matching nothing are dropped, and files in two groups are
      flagged (tests).
- [ ] The review sheet shows each group's current and proposed patterns
      with real match counts and examples; Apply writes only the ticked
      groups, at the user level (L1).
- [ ] A persona can read the current paths and the folder scan, check a
      revision, and propose; the card shows host-computed counts, and Apply
      writes only the ticked groups, refusing one changed since (L2, tests).
- [ ] The Settings draft and a persona's proposal go through one checker and
      one write (test).
- [ ] The `locations.*` family joins `WORKSHOP_CAPABILITY_OPERATIONS`, every
      family switch and `WORKSHOP_NATIVE_CALL_FIELDS`, with the grammar
      prompt pinned by its sync test.
- [ ] Nothing is written without Apply. A failure leaves the settings as
      they were, with one quiet line.
- [ ] Logs carry counts only.

## Related

- [ADR 2026-11-05: A Helper Agent for Small Tasks](../../../docs/adr/2026-11-05-helper-agent.md)
  (D1 tasks as policies, D2 proposes and never writes, D6 this task)
- [Workshop Session Name Draft](../feature-workshop-session-name-draft/README.md):
  the other helper task waiting.
- [`@` in the Workshop Composer](../feature-workshop-composer-at-mentions/README.md):
  its list shows configured files only, so better paths make it more useful.

## Related Files

- `packages/core/src/shared/types/context.ts` (`CONTEXT_PATH_GROUPS`)
- `apps/vscode-extension/package.json` (`proseMinion.contextPaths.*`)
- `packages/core/src/infrastructure/context/ContextResourceResolver.ts`
  (the resolver the proposal is checked with)
- `packages/core/src/presentation/webview/components/SettingsOverlay.tsx`
  and `hooks/domain/useContextPathsSettings.ts`
- `packages/core/src/application/handlers/domain/ConfigurationHandler.ts`
- `packages/core/src/platform/SettingsStore.ts` and
  `apps/vscode-extension/src/platform/vscode/VsCodeSettingsStore.ts`
  (the user-level-only writes)
- `packages/core/src/infrastructure/api/services/helper/` (`HELPER_TASK_POLICIES`)
  and `packages/core/resources/system-prompts/helper/`
