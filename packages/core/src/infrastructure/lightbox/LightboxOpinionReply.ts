/**
 * What group F's reply becomes once its call has come back (ADR 2026-10-19
 * D7 addendum; Slice 4D). Beside `LightboxGroupReply`, which reads the
 * chapter groups' replies.
 *
 * - **Unusable replies** fail the group as any group's do: one cut off at
 *   the output ceiling, or whose frame cannot be read, is quarantined in the
 *   rejected-response recovery store and the writer told where it went.
 * - **Checked replies** are held to the Opinion's rules against the digest
 *   the call read, never the chapter: each cite must name an item that
 *   digest held, and nothing the board changed since the digest was built
 *   is consulted here (the tile's standing says that, from the board).
 *   The outcome carries the digest's key, so its landing is correlated
 *   with what it weighed.
 *
 * Logs carry counts and reasons, never the Opinion's words or the digest.
 */

import type { LightboxGroupOutcome } from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { lightboxRejectionOf } from '@/infrastructure/lightbox/LightboxCallFailure';
import { failedLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { quarantineLightboxReply, type LightboxGroupReplyPorts } from '@/infrastructure/lightbox/LightboxGroupReply';
import type { LightboxPreparedCall } from '@/infrastructure/lightbox/LightboxRunEstimate';
import type { LightboxOpinionDigest } from '@/infrastructure/lightbox/LightboxOpinionDigest';
import { lightboxDecodedViews } from '@/infrastructure/lightbox/LightboxOpinionCodec';
import type { LightboxDecodedOpinionBlock } from '@/infrastructure/lightbox/LightboxOpinionWire';
import { gateLightboxOpinion, lightboxOpinionTileOf } from '@/infrastructure/lightbox/LightboxOpinionGates';
import type { LightboxOpinionItem } from '@shared/constants/lightboxOpinionItems';
import type { LightboxOpinionDigestSummary, LightboxOpinionTile, LightboxWithheldClaim } from '@messages';

export interface LightboxOpinionReply {
  call: LightboxPreparedCall;
  result: ExecutionResult;
  digest: LightboxOpinionDigest;
  /** The run's token, which prefixes the tile's id. */
  token: string;
}

/** The Opinion, gated against the items of the digest the call read. */
export function assembleLightboxOpinion(
  block: LightboxDecodedOpinionBlock,
  context: { items: ReadonlyMap<string, LightboxOpinionItem>; digest: LightboxOpinionDigestSummary; id: string }
): { tile: LightboxOpinionTile } | { withheld: LightboxWithheldClaim[] } {
  const gated = gateLightboxOpinion({
    observations: block.observations.map((observation) => ({
      id: observation.id,
      text: observation.text,
      cites: observation.cites.map((cite) => ('measured' in cite
        ? { item: cite.measured }
        : { item: cite.tile, ...(cite.quote !== undefined ? { quote: cite.quote } : {}) }))
    })),
    withheld: block.malformed,
    views: lightboxDecodedViews(block)
  }, context.items, 'fresh');
  return lightboxOpinionTileOf(gated, { id: context.id, friction: block.friction, digest: context.digest }, 'fresh');
}

/** Group F's outcome from a reply that came back. */
export async function readLightboxOpinionReply(
  ports: LightboxGroupReplyPorts,
  { call, result, digest, token }: LightboxOpinionReply
): Promise<LightboxGroupOutcome> {
  const content = result.rawContent ?? result.content;
  const keyed = { digestKey: digest.key };
  if (result.finishReason === 'length') {
    return { ...failedLightboxGroup(call, await quarantineLightboxReply(ports, call, content, result, {
      message: `the reply reached the ${PROMPT_BUDGETS.lightbox.groupOutputTokens.toLocaleString('en-US')}-token output ceiling`
    }), result), ...keyed };
  }
  let decoded: ReturnType<typeof decodeLightboxGroup>;
  try {
    decoded = decodeLightboxGroup(content, { group: 'F', lenses: ['opinion'], columnCount: 0 });
  } catch (error) {
    return { ...failedLightboxGroup(call, await quarantineLightboxReply(ports, call, content, result, lightboxRejectionOf(error)), result), ...keyed };
  }
  const block = decoded.blocks.find((candidate): candidate is LightboxDecodedOpinionBlock => candidate.lens === 'opinion');
  const summary: LightboxOpinionDigestSummary = { key: digest.key, items: digest.items.size, leftOut: digest.leftOut };
  const assembled = block
    ? assembleLightboxOpinion(block, { items: digest.items, digest: summary, id: `lbt-${token.slice(0, 8)}-F-1` })
    : undefined;
  const tile = assembled && 'tile' in assembled ? assembled.tile : undefined;
  ports.outputChannel.appendLine(
    `[LightboxReadingRunner] Group F read (opinion) against a digest of ${digest.items.size} items: ` +
      (block
        ? tile
          ? `${tile.observations.length} observations drawn, ${tile.withheldObservations.length} withheld; ` +
            `${tile.views.length} views drawn, ${tile.withheldViews.length} withheld`
          : 'the Opinion was withheld: no view stood'
        : 'its block was withheld')
  );
  return {
    group: 'F',
    lenses: call.lenses,
    status: 'ok',
    tiles: tile ? [tile] : [],
    withheldBlocks: decoded.withheld.map((entry) => ({ kind: 'opinion' as const, lens: entry.lens, reason: entry.reason })),
    withheldClaims: assembled && 'withheld' in assembled ? assembled.withheld : [],
    frictions: block ? [{ lens: 'opinion', friction: block.friction }] : [],
    ...(result.modelId ? { model: result.modelId } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
    // The Opinion checks no quote against the chapter: the quotes it cites were checked when their tiles were read.
    quoteChecks: block ? [{ lens: 'opinion', checked: 0, withheld: 0 }] : [],
    ...keyed
  };
}
