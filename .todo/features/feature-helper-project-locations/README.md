# Feature: The Helper Suggests the Project's Context Paths

**Date Identified:** 2026-11-05 (decided as D6 of [ADR 2026-11-05](../../../docs/adr/2026-11-05-helper-agent.md)); filed as its own note 2026-11-18
**Status:** Idea. Designed in outline (the ADR's D6, "not built in v1"); never tracked until now. The helper-agent epic left it "in the ADR for a later epic" when it was archived. An amendment to that ADR, since it settles details D6 leaves open.
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
5. **Where it writes: this workspace, not every project.** The real
   decision, below.

## The decision this needs from Okey: which settings level

- **Today every setting the app writes goes to the user level**
  (`SettingsStore.update`: "the only target this app writes";
  `VsCodeSettingsStore` uses `ConfigurationTarget.Global`).
- **Context paths are per project by nature.** Applying one novel's folder
  layout at the user level changes it for every other project.
- **Recommended: write the applied groups to the workspace level**
  (`.vscode/settings.json`).
  - It needs a target on the settings port: an `update` that names the
    workspace, implemented by the VS Code adapter.
  - A workspace value overrides the user value, so the Settings overlay
    should say which level each group's value comes from, and offer "Use my
    default" to clear the workspace's.
- **Alternatively, keep writing the user level.** Simpler, but wrong for a
  writer with more than one project.

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
      groups, at the level Okey chooses.
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
