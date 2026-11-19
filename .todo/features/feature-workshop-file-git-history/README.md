# Feature: Personas Read a File's Git History

**Date Identified:** 2026-11-19
**Status:** Idea. Medium: a new host port, a two-call capability family, and a prose-aware diff in core. ADR first: it is the extension's first use of git, and it reads writer data from outside the configured files' current text.
**Priority:** Medium
**Origin:** Okey, 2026-11-19

## In Okey's words

> If the opened project is a git repo it'd be cool to let the agent access
> an excerpt file, or a project file's git history. I guess it'd use the
> local install of git right? And we'd give just a couple of tool calls, or
> maybe just one: the history for a file and the diff between 2 items.

## What it's for

A writer who commits their drafts has a record no persona can see today.
With it, a persona could answer:
- "What did I cut from 6.11 since last week?"
- "Is this new ending better than the one I had in March?"
- "When did Jill's sister stop appearing in chapter 4?"

It is not the Workshop's excerpt versions (v1, v2…). Those are re-reads
within a room; this is the writer's own commits, across rooms and months.

## What exists today

- **Nothing in the extension touches git.** No process spawning, and no use
  of VS Code's Git extension.
- **No diff library.** `package.json` has none.
- **The pieces to build on:**
  - the capability families and their closed operation list;
  - `resource.read`'s way of naming a file (the excerpt, or a catalog key);
  - the shared read fit (`reads/WorkshopReadWindowFit`);
  - the blank-line paragraph rule (`splitBlankLineParagraphs`);
  - the native-call translator's field map.

## Idea

### Two calls

1. **`history.log`:** a file's commits, newest first, a page at a time. Each
   commit gives its short id, its date and its subject line. Its "N more"
   line names the exact next call, which decodes as written.
2. **`history.diff`:** what changed in a file between two commits, or
   between a commit and the file as it is now (`<to>current</to>`).
   - **Prose-aware.** In a prose file each paragraph is one long line, so a
     line diff shows a whole paragraph twice for one changed word. Instead,
     paragraphs are matched first, then the words inside a changed
     paragraph: "¶ 12, changed: she ~~ran~~ **walked** to the door".
     Paragraphs added or removed are shown whole.
   - **Fitted** to half the room left (`WorkshopReadWindowFit`). A diff that
     doesn't fit stops at a paragraph and continues with a later call, never
     mid-paragraph.
   - **"Current" means the file as saved on disk,** not unsaved edits in the
     editor. The result says so.

A third call, `history.read` (the whole file as of a commit), is left out of
v1. A diff with its context answers most questions, and an old version can
be large.

### Which files

- **Only files a persona can already read:** the room's excerpt file, or a
  configured file named by group and path, as `resource.read` names them.
- **Never a free path,** and never a file outside the project.

### How the host reads git: a port, with VS Code's Git extension behind it

- **A new port** in `packages/core/src/platform/` (say `FileHistory`) with
  two methods:
  - `log(file, page)`: the commits that touched the file;
  - `show(file, commit)`: the file's text at a commit.

  The diff itself is computed in core: it's pure, testable and host-free.
- **The VS Code adapter uses the built-in Git extension's API** (`vscode.git`,
  `getAPI(1)`: `getRepository`, `repository.log({ path, maxEntries })`,
  `repository.show(ref, path)`). It runs the local git install, as Okey
  guessed, but through VS Code:
  - the writer's `git.path` setting and the repositories VS Code already
    found are used;
  - multi-root and submodules are handled;
  - our code spawns no process.
- **Another host** (the console app) would run `git` itself, with fixed
  arguments and no shell.
- **No git, git disabled, or not a repository:** each call answers in host
  words ("This project isn't a git repository"), never an error.

### Safety

- **A commit id comes only from a `history.log` result.** The host checks
  its form (hex, 7 to 40 characters) and that it is in this file's history
  before passing it on. A model's text is never given to git as an
  argument, since something like `--output=…` could become an option.
- **Git's own diff machinery isn't used.** Because the diff is computed in
  core from two `show`s, a repository's diff drivers, text conversions and
  external diff tools never run.
- **Workspace trust.** The extension declares no support for untrusted
  workspaces, so it doesn't run in Restricted Mode, and VS Code's Git
  extension doesn't either. A host that runs git itself must check trust:
  a repository's config can make git run commands.
- **Commit subjects and diffs are writer data.** They are evidence,
  neutralized in the capability-result frame, and never instructions.

### What the room sees

- **One card per call,** like other reads. A diff is a manifest row
  (a new kind, `history`) that names the file and its two commits.
- **Publication** follows reads: shared with the room when the reply
  commits.
- **Logs** carry the operation, counts and outcome kinds. Never a commit
  subject, id, path or diff text.

## Open questions

- **A setting?** It reads only local files, as `resource.read` does, so
  leaning: no setting, available whenever the project is a repository.
- **A diff library, or our own?** A word-level diff over a long chapter
  needs a bounded algorithm (Myers, not a naive grid). The `diff` package
  (jsdiff) is small and well known; writing our own keeps dependencies at
  zero. Leaning: jsdiff, if the ADR agrees the payoff is worth a dependency.
- **Author names in the log?** It's the writer's own repository, but a
  shared one names other people. Leaning: dates and subjects only.
- **`history.read` later?** Add it if personas keep asking for whole old
  versions.
- **The Lightbox.** "Compare with an earlier commit" on a board would reuse
  the same port and diff. Not part of this.

## Completion Criteria

- [ ] `history.log` lists a file's commits newest first, paged, with
      continuation hints that decode as written (test).
- [ ] `history.diff` shows paragraph- and word-level changes between two
      commits, or a commit and the saved file. It is fitted to the window
      and continues at a paragraph (tests).
- [ ] Only the excerpt file and configured files can be named. A free path
      is refused (test).
- [ ] A commit id not from the file's history, or not in commit-id form, is
      refused before anything reaches git (test).
- [ ] No repository, no git, or git disabled answers in host words (tests,
      with a fake port).
- [ ] The family joins `WORKSHOP_CAPABILITY_OPERATIONS`, every family
      switch and `WORKSHOP_NATIVE_CALL_FIELDS`, with the grammar prompt
      pinned by its sync test.
- [ ] No `from 'vscode'` in core: the Git extension is used only in the
      adapter.
- [ ] Logs carry counts and outcomes only. Fixtures use *Alice*-style
      made-up history.

## Related

- [Workshop Reads Fit the Window](../feature-workshop-reads-fit-the-window/README.md):
  the fit `history.diff` uses.
- [Workshop Context Strategies](../feature-workshop-context-strategies/README.md):
  diffs between excerpt versions, a neighbor idea.
- [ADR 2026-11-14: Everyday Conveniences](../../../docs/adr/2026-11-14-everyday-conveniences.md):
  how `resource.read` names files.

## Related Files

- `packages/core/src/platform/` (the new port)
- `apps/vscode-extension/src/platform/vscode/` (its adapter, over `vscode.git`)
- `packages/core/src/shared/types/workshopCapabilities.ts`
- `packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts`
- `packages/core/src/application/services/workshop/WorkshopNativeToolCallTranslator.ts`
- `packages/core/src/application/services/workshop/reads/WorkshopReadWindowFit.ts`
- `packages/core/src/utils/blankLineParagraphs.ts` (`splitBlankLineParagraphs`)
- `packages/core/src/shared/types/messages/inferenceContext.ts` (`CONTEXT_SOURCE_KINDS`)
