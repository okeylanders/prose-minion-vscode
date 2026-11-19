# Feature: A Guide Persona for Prose Minion Questions

**Date Identified:** 2026-11-18
**Status:** Identified, only if wanted. Split out of [A Complete Prose Minion Reference](../feature-prose-minion-help-reference/README.md) at the Round Two epic's close.
**Priority:** Low
**Origin:** ADR 2026-11-17, "Item H: out of scope"; README default 25

## Problem

Item H (PRs #279, #280) gave every persona `help.search` and `help.read`
over `packages/core/resources/help/`. The room's own persona answers
"how do I…?" questions. There is no guide persona, no "Ask about Prose
Minion" entry, and no way to ask without opening a Workshop room.

## Options

- A guide persona: a persona file whose whole job is the reference.
- A helper task (`HELPER_TASK_POLICIES`) that answers from the reference
  without a room, for a sidebar "Ask" box.
- Nothing: decide after the live pass (steps H1–H4) whether the room's
  persona answers well enough.

## Completion Criteria

- [ ] Okey decides, after the live pass, whether this is wanted.
- [ ] If built: an ADR, and the reference's version caveat and "say when it
      does not cover it" rule carried over unchanged.

## Related Files

- `packages/core/src/application/services/workshop/help/`
- `packages/core/resources/system-prompts/workshop-personas/help-capability.md`
- `packages/core/src/infrastructure/api/services/helper/`
