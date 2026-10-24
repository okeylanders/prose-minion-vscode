# Offer the Misnested-Member Repair to the Workshop Widgets

**Date Identified**: 2026-10-24 (Lightbox Slice 4K, epic decision 50)
**Reviewed**: 2026-10-24
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small per widget, after it adopts `parseModelJson`

## Problem

Slice 4K added a schema-aware repair to the Lightbox: a member a model
closed out of its block one brace early, so that it stands in the root just
after the block that defines it, is moved back into that block
(`renestLightboxMembers` in
`packages/core/src/infrastructure/lightbox/LightboxBlockFormat.ts`). It reads
where each root member stood from the shared parser
(`parseModelJson(text, { rootKeys: true })`), never from the parsed object's
own key order, and applies the content guard to the root before and after.

The Workshop widgets' replies are open to the same slip: a closing brace
placed before an object's last members. They cannot use the repair yet,
because they do not read through the shared parser at all; that adoption is
its own item, [Workshop widgets should read their JSON through the shared
model-JSON parser](2026-10-23-widget-model-json-repair-adoption.md)
(Medium). Their codecs also stay strict about fields they do not define
(`persistedValidation.exactObject`), so a member closed out of its object is
refused outright rather than ignored.

## Recommendation

Once a widget reads its JSON through `parseModelJson`, consider giving it
the same repair over its own schema:
- ask the parser for `rootKeys`, and move a root member back only into the
  root member just before it, when that member is an object whose format
  defines the key and lacks it; a run of such members moves together;
- never guess past a gap, and decline when a root key is written twice,
  counting a salvage's cut member (`cutKey`) and declining when the cut
  fell inside a root key (`cutInsideKey`) (PR #168 F-01);
- check the root before and after with `modelJsonContentMatches`, treat a
  guard that cannot be checked as a refusal (PR #168 N-01), and log the
  repair by its kind.

The rule is the Lightbox's; the schema is each widget's. If two widgets
want it, lift the walk out of `LightboxBlockFormat` into a feature-agnostic
helper that takes a key → fields table, and keep the Lightbox's table where
it is. Build it only if a widget's rejected replies show the slip: the
recovery folder's sidecars name the widget.

Whether a widget should also ignore fields it does not define (the
Lightbox's decision 50) is a separate product question for each widget's
own contract; this item does not assume it.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxBlockFormat.ts` (the
  repair and its rules)
- `packages/core/src/infrastructure/api/parsers/ModelJsonRepair.ts`
  (`rootKeys`)
- `packages/core/src/__tests__/infrastructure/lightbox/LightboxMisnestedMember.test.ts`
- the four widget call sites listed in the adoption item
- [Slice 4K](../epics/epic-lightbox-2026-10-19/slice-4k-forgive-fields.md)

## Completion Criteria

- Either a widget that has adopted `parseModelJson` repairs a member closed
  out of its block, with a test built from a public-domain fixture and the
  gap, duplicate-key and content-guard controls, or this item is closed
  with the logs' evidence that the slip does not occur in widget replies.
