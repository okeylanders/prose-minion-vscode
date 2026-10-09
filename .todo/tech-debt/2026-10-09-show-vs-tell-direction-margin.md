# Show vs. Tell: direction-only carry can raise the count by up to two

**Status**: Open
**Priority**: Low (decide before Slice 4 wires commit)
**Discovered**: Sprint 05 (Show vs. Tell) Slice 3, 2026-10-09

## Problem

The sprint's completion criteria say switching a variant to direction only
*always* lowers the payload count. The frozen rules cannot guarantee it.

- A prose-carried variant costs `keep: "<prose>"` = `prose.length + 8`.
- A direction-carried variant costs `direction: <direction>` =
  `direction.length + 11`.
- The shared integrity rule only requires `direction` to be **strictly
  shorter** than `prose` (trimmed, pre-encoding). A direction one or two
  characters shorter than its prose therefore makes the direction line up to
  two characters *longer* than the keep line.

`ShowVsTellArtifact.test.ts` pins both facts: the property holds whenever the
direction is at least three characters shorter, and the edge case is
documented as a test. Real directions run a fraction of their prose (the
design fixture is 0.36–0.66), so this is unlikely to bite, but the guarantee
is a stated completion criterion.

## Related files

- `packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact.ts`
- `packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations.ts`
  (`isShowVsTellDirectionShorterThanProse`)
- `packages/core/resources/system-prompts/show-vs-tell/` (the "strictly shorter" wording)

## Options

1. Tighten the shared rule to `direction.length + 3 <= prose.length`
   (measured as the artifact measures them). One-line change in the integrity
   gate plus the prompt wording and the codec/integrity tests; the artifact
   needs no change. Recommended.
2. Keep the rule and soften the completion criterion to "never raises the
   count by more than two".

## Completion criteria

- The decision is recorded in the Sprint 05 doc, and the artifact test's
  "documents the contract edge" case is replaced by the chosen guarantee.
