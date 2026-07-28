# Decide one location convention for capability request types

**Status:** Open
**Priority:** Low
**Source:** PR #74 review, finding #10 (Stan 🗂️)

## Problem

Resource-read request types are colocated with `ResourceReadXmlCodec`, while
Workshop capability request/result types live in `shared/types` because both
the codec and Workshop message contracts consume them. Both placements are
defensible, but contributors currently have no rule for choosing between them.

## Related files

- `packages/core/src/infrastructure/api/orchestration/ResourceReadXmlCodec.ts`
- `packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts`
- `packages/core/src/shared/types/workshopCapabilities.ts`
- `packages/core/src/shared/types/messages/workshop.ts`

## Completion criteria

- Document a single convention that accounts for codec-only types and types
  crossing into message contracts.
- Move types only if the chosen rule requires it; do not add re-export shims in
  this alpha codebase.
- Architecture/typecheck tests pass with imports following the documented rule.
