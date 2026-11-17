# Feature: How Readily Personas Suggest Memories

**Date Identified:** 2026-11-07
**Status:** Idea. Small: one setting, one prompt paragraph per level. An amendment to [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), not a new ADR.
**Priority:** Medium
**Origin:** Okey, 2026-11-07

## In Okey's words

> I want to increase the model's propensity to create memories. Maybe make
> it a setting, under memory settings. Like: suggest and log memories,
> sparingly … aggressively.

## Problem

Personas rarely suggest a project note, by design. The proposal prompt's
"When to suggest one" section ends with the brake
(`resources/system-prompts/workshop-personas/project-memory-proposals.md`):

> Don't suggest one for something the notes already say, something only
> this conversation needs, or a passing thought. **Most replies suggest none.**

That suits a writer who wants a tidy memory. A writer who'd rather dismiss
a few cards than lose a detail has no way to ask for more.

## Idea

A setting on the Workshop's **Memory** settings tab
(`WorkshopMemorySettingsPanel`), beside the memory mode: **Suggest notes**,
with three levels.

| Level | What the persona is told |
|---|---|
| **Sparingly** (default) | Today's paragraph, word for word: only what will matter later, and most replies suggest none. |
| **Readily** | Suggest whenever something on the list lands, small ones included: each floated idea, each open thread, each preference. Don't wait for it to feel important. |
| **Aggressively** | Suggest anything a later conversation might want, and err toward suggesting. The writer dismisses what they don't want. |

It applies in both memory modes that suggest: in **ask** every suggestion
waits for the writer, and in **auto** it is saved and the writer is told
(Okey's "suggest and log").

## What never changes with the level

- The rule on what a note may never record: the writer's feelings, health,
  relationships or private life.
- The ceiling of 10 suggestions per reply, and "each one stands alone".
- "Don't suggest what the notes already say."
- `<supersedes>`, edits and citations, and every trailer check the host makes.

Only the "when to suggest" paragraph moves. A test holds the rest of the
section byte-identical across levels.

## Shape

- **A closed list.** `WORKSHOP_MEMORY_SUGGESTION_LEVELS` (`sparingly`,
  `readily`, `aggressively`), with one paragraph per level. Exactly one is
  assembled into the proposal section, as Relational Depth assembles one
  depth resource.
- **The setting.** `proseMinion.workshop.memory.suggestions`, an enum
  defaulting to `sparingly`, in `application` scope like the memory mode.
  It follows the unified settings path: manifest, `ConfigurationHandler`, the
  Memory tab's hook, the watcher.
- **Mid-room changes.** The paragraph is in the persona's system prompt, so
  a change goes through the existing rebuild of system messages
  (`replaceWorkshopConversationSettings`), as a behavior change does. It
  applies from the next turn, and costs one prompt-cache miss.
- **Sparingly is today.** The default's paragraph is the current text,
  pinned by a test, so nothing changes for anyone who leaves it alone.

## Open questions

- **Aggressively in auto mode.** Every suggestion is saved without review.
  Is that what the writer wants, or should the tab say "In auto mode, this
  saves a lot of notes" beside the choice?
- **Three levels, or four?** For example, a "Regularly" between Readily and
  Aggressively.
- **Per room, or for every room?** The memory mode is one switch for every
  project, so this follows it unless there's a reason not to.

## Completion Criteria

- [ ] The Memory tab offers Sparingly, Readily and Aggressively, synced with
      `proseMinion.workshop.memory.suggestions`.
- [ ] Exactly one level's paragraph is assembled. The rest of the proposal
      section is identical across levels (test), and Sparingly's paragraph
      is today's text (test).
- [ ] A change mid-room applies from the next turn through the system-message
      rebuild.
- [ ] Off mode stays off: no level adds a proposal section where memory is
      off.
- [ ] A live pass runs one fixture conversation at each level and records
      how many suggestions each made. A model's propensity can't be
      unit-tested, so the counts are the evidence.

## Related

- [ADR 2026-11-04: Workshop Project Memory](../../../docs/adr/2026-11-04-workshop-project-memory.md)
  (D6: proposals as a reply trailer; D8: the one memory mode)
- [Workshop Relational Depth](../feature-workshop-relational-depth/README.md):
  the one-resource-per-level pattern.

## Related Files

- `packages/core/resources/system-prompts/workshop-personas/project-memory-proposals.md`
- `packages/core/src/shared/constants/workshopPersonas.ts` (where the section is assembled)
- `packages/core/src/presentation/webview/components/workshop/settings/WorkshopMemorySettingsPanel.tsx`
- `packages/core/src/presentation/webview/hooks/domain/workshop/memory/workshopMemoryTabView.ts`
- `packages/core/src/shared/types/messages/workshop/settings.ts` (`WORKSHOP_PROJECT_MEMORY_SETTING`)
- `apps/vscode-extension/package.json` (`proseMinion.workshop.projectMemory`)
