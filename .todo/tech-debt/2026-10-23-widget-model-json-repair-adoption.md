# Workshop Widgets Should Read Their JSON Through the Shared Model-JSON Parser

**Date Identified**: 2026-10-23 (Lightbox Slice 4H, at the writer's request)
**Reviewed**: 2026-10-23
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small to medium (four call sites, each with its tests)

## Problem

Slice 4H added a deterministic, structure-only repair for a model's JSON,
with a content guard that refuses any change to a string or other scalar:
`parseModelJson` and `salvageModelJson` in
`packages/core/src/infrastructure/api/parsers/ModelJsonRepair.ts`. It is
feature-agnostic by design (it imports nothing; `boundaries.test.ts` holds
it to that), and today only the Lightbox reads through it.

The writer reports that the Workshop widgets' replies sometimes fail the same
way. Each cuts its JSON out of its own frame and calls `JSON.parse`, so a
stray closing brace, a trailing comma or a code fence fails a paid reply,
which goes to `persistRejectedWidgetResponse` /
`RejectedModelResponseRecoveryStore`:

| Widget | Call site |
|---|---|
| Gesture Playground | `infrastructure/api/services/widgets/GesturePlaygroundService.ts`: the composite reply's menu JSON (`JSON.parse(menuJson)`) and the standalone "More gestures" menu |
| Lexical Gravity | `infrastructure/api/services/widgets/LexicalGravityModelService.ts`: the preview and the lens build (`JSON.parse(framed)`, twice) |
| Creative Variations | `infrastructure/api/services/widgets/creativeVariations/CreativeVariationsResponseCodec.ts` |
| Show vs. Tell | `infrastructure/api/services/widgets/showVsTell/ShowVsTellResponseCodec.ts` |

Three of them also put `JSON.parse`'s own message into their error, and that
message can quote a slice of the reply. `ModelJsonParseError` carries only a
position and a closed reason.

## Recommendation

At each call site, replace `JSON.parse(jsonText)` with
`parseModelJson(jsonText)` (adding `closeMissingBrackets: true` only where
the frame's closing sentinel proves the reply stopped with its frame
closed), keep each widget's own sentinels and frame rules, and:
- log each repair by its kind, never with text, as the Lightbox does;
- describe a refusal with `describeModelJsonRefusal`, never the parser's
  message;
- leave `finishReason === 'length'` as each widget treats it today, unless
  that widget gains a salvage rule of its own (`salvageModelJson` reads a
  root object's finished members only).

**Follow-up (Slice 4K):** once a widget reads through the parser, it can
also be offered the Lightbox's repair for a member closed out of its block
([Low](2026-10-24-widget-misnested-member-repair.md)), using the parser's
`rootKeys`.

## Related Files

- `packages/core/src/infrastructure/api/parsers/ModelJsonRepair.ts`
- `packages/core/src/__tests__/infrastructure/api/parsers/ModelJsonRepair.test.ts`
- the four call sites above, and their response-codec tests
- `packages/core/src/infrastructure/lightbox/LightboxReadingFrame.ts` (the
  first caller, as an example)
- [Slice 4H](../epics/epic-lightbox-2026-10-19/slice-4h-reading-tolerance.md)

## Completion Criteria

- Each of the four call sites reads its JSON through `parseModelJson`, with
  a test that a reply with a stray closing brace after its root object
  decodes, and one whose repair would change a string is still rejected and
  saved for recovery.
- No widget's error or log carries `JSON.parse`'s message.
