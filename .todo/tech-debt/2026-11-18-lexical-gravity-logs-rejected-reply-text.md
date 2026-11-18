# Lexical Gravity logs a rejected reply's text

**Date Identified**: 2026-11-18
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small (two log blocks, one test)
**Source**: [Everyday Conveniences, Round Two](../epics/epic-everyday-conveniences-round-two-2026-11-17/README.md), closing pass

## Problem

`AGENTS.md` says Lexical Gravity logs carry repair kinds and counts, never
lens text or the query, and the epic's rules say logs never carry writer
or model text. Both rejection paths in
`packages/core/src/infrastructure/api/services/widgets/LexicalGravityModelService.ts`
still copy the model's whole reply into the shared output channel, bounded
to 12,000 characters by `boundedLogText`:

- **Preview** (lines 177–181): `Rejected preview response body BEGIN`,
  `boundedLogText(content)`, `… END`. A preview reply rewrites the
  writer's own passage, so this logs the writer's text in model form.
- **Lens build** (lines 237–243): `Rejected lens response body BEGIN`,
  `boundedLogText(content)`, `… END`. The reply holds lens text and echoes
  the subject the writer typed.

The reason line above each (lines 173–176, 234–236) is the codec's fault
message, which names fields, not text, and can stay.

The same reply is already kept whole by `persistRejectedModelResponse`
(the rejected-response recovery file the writer is pointed to), so the log
copy adds nothing a developer cannot get from the recovery file.

**A sibling with the same shape:** `WorkshopRunCompletion.ts` lines
264–268 log a rejected widget recommendation's reply
(`boundedLogText(controls.redacted)`): the persona's reply prose, with only
its control frames redacted.

## Recommendation

- Drop both `… body BEGIN/END` blocks. Keep the reason line, and add the
  reply's length as a count.
- Do the same for the widget-recommendation line in `WorkshopRunCompletion`.
- Remove `boundedLogText` once nothing uses it.
- A test runs each rejection over a reply holding a marker string and
  asserts no logged line holds it.

## Related Files

- `packages/core/src/infrastructure/api/services/widgets/LexicalGravityModelService.ts`
- `packages/core/src/application/services/workshop/WorkshopRunCompletion.ts`
- `packages/core/src/utils/boundedLogText.ts`

## Completion Criteria

- No rejection path in Lexical Gravity or the widget recommendation logs a
  model reply's text; a marker test holds it.
- The recovery file still holds the whole reply.
