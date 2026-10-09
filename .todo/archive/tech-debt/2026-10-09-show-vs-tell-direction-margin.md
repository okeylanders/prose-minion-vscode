# Show vs. Tell: direction-only carry must always lower the count

**Status**: Resolved in Sprint 05 Slice 3 review fixes (F-02), 2026-10-09
**Priority**: Was Low; resolved
**Discovered**: Sprint 05 (Show vs. Tell) Slice 3, 2026-10-09

## Problem (as found)

The sprint's completion criteria say switching a variant to direction only
*always* lowers the payload count, but the frozen "direction strictly shorter
than prose" rule cannot guarantee it:

- A prose-carried variant costs `keep: "<prose>"` = `encode(prose) + 8`.
- A direction-carried variant costs `direction: <direction>` = `encode(direction) + 11`.
- So strict reduction needs `encode(direction) + 4 <= encode(prose)`. A *raw*
  margin of 3 only ties, and a raw margin can disappear entirely: the encoder
  collapses each CRLF pair to one character, so a CRLF-heavy prose can encode
  as short as its direction (a 600-character body became 603 when the
  direction was selected).

The first write-up of this item called it "up to two characters" and proposed
a raw `+3` margin. Both were wrong; the review (F-02) corrected them.

## Resolution

- One shared predicate, `isShowVsTellDirectionShortEnough` in
  `ShowVsTellDerivations.ts`, enforces
  `encode(direction).length + SHOW_VS_TELL_DIRECTION_MARGIN <= encode(prose).length`.
- The margin (4) is derived from the frozen artifact line keys, and the
  encoder is the projection's own (`encodeShowVsTellArtifactValue`, now owned by
  the Derivations and re-exported by the projection).
- The response codec, persisted integrity, and the generation prompt all use
  it. The 600 → 603 witness is rejected at decode and at integrity.
- The absolute 585 ≤ 600 fit guarantee is unchanged.

## Related files

- `packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations.ts`
- `packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact.ts`
- `packages/core/resources/system-prompts/show-vs-tell/00-show-vs-tell.md`
