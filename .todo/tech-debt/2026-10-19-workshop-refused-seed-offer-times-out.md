# A Seed Offer the Workshop Refuses Only Times Out

**Date Identified**: 2026-10-19 (Lightbox Slice 4; the Slice 3 Build lens seed has the same shape)
**Reviewed**: 2026-10-20
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (one provider port, one answer path, tests)

## Problem

When the Workshop panel provider offers a seed, it routes a synthetic
message through the panel's own MessageHandler: the Build lens seed
(`WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD`) or a Lightbox tile
(`WORKSHOP_STAGE_LIGHTBOX_TILE`). The Workshop handler checks the seed's
shape again. If the check fails, the handler logs the field and drops the
offer: it never tells the webview a seed is waiting, so nothing claims it,
and the provider settles the handoff only at its 20-second deadline, as
`timeout`. The Lightbox then says the Workshop "did not confirm", when the
real reason is that the Workshop refused the item.

The Lightbox host builds both seeds within the same bounds the Workshop
checks, so this happens only when the two sides disagree (a contract drift
or a bug). Nothing opens or is staged, and no writer text is lost; only the
reason and the 20-second wait are wrong.

## Recommendation

Let a Workshop handler refuse an offer it cannot accept straight to the
provider: for example a narrow host port (`refuseSeed(kind, deliveryId)`)
that settles the waiting delivery with a new `refused` failure, worded by
each Lightbox refusal map. Keep the webview out of it: the offer never
reached it.

## Related Files

- `packages/core/src/application/handlers/domain/workshop/WorkshopLightboxTileHandler.ts` (`handleOffer`)
- `packages/core/src/application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler.ts` (`handleOpenBuild`)
- `packages/core/src/application/services/workshop/WorkshopSeedDelivery.ts`
- `apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts`

## Completion Criteria

- A malformed seed or tile offer settles at once with a refusal the
  Lightbox can word, for both seed kinds, with tests through the provider.
