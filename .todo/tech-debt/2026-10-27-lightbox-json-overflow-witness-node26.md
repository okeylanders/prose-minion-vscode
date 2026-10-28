# Make the Lightbox JSON guard failure witness portable

**Status:** Open
**Priority:** Medium
**Found during:** [October 27 model audit](../epics/epic-lightbox-2026-10-19/model-audit-2026-10-27.md)

## Problem

`LightboxMisnestedMemberEdges.test.ts`'s N-01 group assumes that serializing a
valid array nested 20,000 levels throws. The comment targets Node 18 and 22.
On the audit machine's **Node v26.1.0**, `JSON.stringify` succeeds at that
depth. Consequently three tests fail: the witness does not throw, the repair
correctly proceeds instead of being skipped, and `renest.moved` is 1 rather
than 0. The test and Lightbox decoder/repair implementation were unchanged
by the model audit.

This can be reproduced with Node alone, independently of the model catalog:

```sh
node -e 'const d = 20000; const v = JSON.parse("[".repeat(d) + "]".repeat(d)); JSON.stringify(v); console.log("serialization succeeded")'
```

## Related files

- `packages/core/src/__tests__/infrastructure/lightbox/LightboxMisnestedMemberEdges.test.ts`
- `packages/core/src/infrastructure/lightbox/LightboxBlockFormat.ts`
- `packages/core/src/infrastructure/api/parsers/ModelJsonRepair.ts`

## Completion criteria

- Exercise the guard's inability to serialize deterministically across the
  supported runtimes; avoid relying on an engine's incidental recursion limit.
- Retain the production-level witness that a failed guard moves nothing and
  does not fail valid sibling blocks. Also retain coverage that a successfully
  checked guard can repair the same misplaced member.
- Keep the existing parser/content safety boundaries intact; do not weaken
  the assertions or add runtime branches merely to accommodate the fixture.
- Re-run the affected suite on Node 26 and the project's supported VS Code
  extension host runtime.
