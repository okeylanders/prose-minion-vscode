# WTA "Diversity & Creative Sampling" section needs its A/B validation

**Status**: Open
**Priority**: Medium
**Created**: 2026-07-11
**Source**: PR #71 review, finding #9 (Bria)

## Problem

Sprint 06A restored a ~50-line "Diversity & Creative Sampling" section to
`packages/core/resources/system-prompts/writing-tools-assistant/00-writing-tools-base.md`
(it changes instructions for every WTA focus). The sprint's own follow-up task —
"Run representative manual A/B comparisons… record the chosen behavior and
sample rationale" — was never done; the section shipped inside the XML-transport
commit without that validation.

## Completion criteria

- Run representative manual A/B comparisons (with/without the section) across
  at least the `editor`, `fresh`, and `cliche` WTA focuses on real passages.
- Record the chosen behavior and sample rationale (memory-bank entry or a note
  beside the prompt).
- Either keep the section (with the recorded rationale) or remove it.

## Related

- `.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/06a-agent-run-engine.md`
  (unchecked A/B bullet)
- `docs/pr-reviews/pr-71-agent-run-engine-review.md` finding #9
