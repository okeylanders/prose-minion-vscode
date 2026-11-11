# Feature: A Complete Prose Minion Reference a Model Can Answer From

**Date Identified:** 2026-11-11
**Status:** Idea. Medium: the writing is the work; the capability is small.
**Priority:** Medium
**Origin:** Okey, 2026-11-11

## In Okey's words

> Prose Minion help: we should have a fully exhaustive reference doc
> available to the model of everything Prose Minion can do, so the user can
> get help and ask questions about Prose Minion.

## Problem

Prose Minion now has a lot of surface area:
- the sidebar tools;
- the Workshop: personas, guests, widgets, recall, bookmarks, pinned context,
  project memory, file edits, Rewind and Branch;
- the Lightbox;
- Proofread and Craft Flags;
- dozens of settings and commands.

A writer asking a persona "how do I pin a file?" gets a guess. No model has
an authoritative description of the product.

## What exists

- **Writer-facing docs:** the extension README (`apps/vscode-extension/README.md`,
  272 lines), `docs/TOOLS.md`, `docs/CONFIGURATION.md`, and one user guide
  (`docs/user-guides/dictionary-lookup-phrase-and-alternatives`).
  - They were written for people, not for a model.
  - They are likely behind recent features.
  - Nothing keeps them in step with the code.
- **The manifest** (`apps/vscode-extension/package.json`, `contributes`)
  lists every command and setting, with titles and descriptions.
- **The What's New notices** (ADR 2026-08-05) say what changed, release by
  release.

## Idea

1. **A bundled reference.** `packages/core/resources/help/`, one Markdown
   file per area (Workshop, Lightbox, Draft Edit, sidebar tools, settings),
   written for a model to answer from:
   - what each feature does;
   - where its controls are;
   - its settings and commands;
   - its limits;
   - how-to answers to likely questions.
2. **Parts generated from the manifest,** so they can't drift: a table of
   every command (title and where it appears) and every setting (default and
   description), built from `contributes` at build time or checked by a test.
3. **A read-only capability, `help.search` / `help.read`,** offered to every
   persona, shaped like `resource.*`, so any persona can answer from the
   guide and quote its section. The persona prompt says to answer from the
   guide, and to say so when the guide doesn't cover something, never guess.
4. **Optionally, an "Ask about Prose Minion" entry:** a Prose Minion guide
   persona, or a helper task, for writers who just want the answer without
   a room.

## Keeping it true

- **Sync tests:**
  - every contributed command id and setting key appears in the reference;
  - every Workshop rail tab and settings tab is named.
  - A new one fails the build until it's documented.
- **A done-ness rule for future epics:** a feature isn't complete until its
  help section is written. That belongs in `AGENTS.md`'s checklist once this
  lands.
- **The guide states the extension version** it describes, and links the
  What's New notices for recent changes.

## Open questions

- **Capability, persona, or both?** Leaning: the capability first, so the
  room's own persona answers, and a guide persona later if wanted.
- **One source for people and models?** Should the writer-facing README and
  docs be generated from the same reference, or stay separate?
- **The size.** An exhaustive reference may be long. Read by section (as
  `resource.read` does) within the window, never attached whole.

## Completion Criteria

- [ ] The reference covers every feature area, with the generated command
      and settings tables.
- [ ] The sync tests fail on an undocumented command, setting or tab.
- [ ] A persona can search and read the guide, and answers "how do I pin a
      file?" from it, quoting its section (a fixture conversation).
- [ ] `AGENTS.md` gains the help-section rule for new features.

## Related Files

- `apps/vscode-extension/package.json` (`contributes.commands`, `contributes.configuration`)
- `apps/vscode-extension/README.md`, `docs/TOOLS.md`, `docs/CONFIGURATION.md`
- `packages/core/src/shared/types/workshopCapabilities.ts` (where `help.*` would join)
- `packages/core/src/application/services/workshop/WorkshopResourceCapability.ts` (the pattern)
- `docs/adr/2026-08-05-whats-new-notice-ledger.md`
