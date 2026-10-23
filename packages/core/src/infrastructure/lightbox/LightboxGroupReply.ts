/**
 * LightboxGroupReply — what a reading group's reply becomes once its call
 * has come back (ADR 2026-10-19 D7, D8). Split from `LightboxReadingRunner`,
 * which owns the run and its calls (PR #149 F-10).
 *
 * - **Unusable replies.** A reply whose frame cannot be read, even after
 *   its structural repairs, fails its group; its paid body is quarantined in
 *   the rejected-response recovery store and the writer is told where it
 *   went. The rejection's message is logged and shown; its diagnostic is
 *   written only beside the body, with the contract the call asked for
 *   (`lightboxRecoveryContract`: its group's own sentinels and blocks).
 * - **Repaired replies** (Slice 4H, epic decision 39). A frame given a
 *   structure-only repair is read as any other, and each repair is logged
 *   by its kind (`[LightboxReadingRunner] Group E repaired: <kind>`), never
 *   with any text; so is how many fields were clipped at the safety ceiling.
 * - **Replies cut off at the output ceiling** (epic decision 40) keep the
 *   blocks they finished; the block they were cut inside is withheld with
 *   the host's reason, and the paid body is still saved for recovery, its
 *   place named in that reason. One the frame cannot salvage fails as an
 *   unusable reply does.
 * - **Checked replies.** Otherwise the frame's blocks are checked against
 *   the chapter (quotes verified, terms counted) and assembled into tiles.
 *   Blocks and items that break their own rules are withheld, not failed.
 *
 * Logs carry groups, lenses, counts, kinds and reasons, never the chapter
 * or the model's prose (PR #149 F-05).
 */

import type { LightboxLensId, LightboxReadingGroupId, RejectedModelResponseContract } from '@messages';
import type { LogSink } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { lightboxLensLabel } from '@shared/constants/lightbox';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import {
  persistRejectedWidgetResponse,
  recoveryLocationNotice,
  type RejectedModelResponseRecovery,
  type RejectedModelResponseRecoveryPresenter
} from '@/infrastructure/storage/RejectedModelResponseRecoveryStore';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import {
  LIGHTBOX_CUT_OFF_REASON,
  LIGHTBOX_LENS_KEYS,
  LIGHTBOX_READING_PROTOCOL_VERSION,
  LightboxGroupFrameError,
  lightboxGroupSentinels,
  type LightboxDecodedGroup,
  type LightboxGroupDecodeContext
} from '@/infrastructure/lightbox/LightboxReadingWire';
import { lightboxRejectionOf, type LightboxRejection } from '@/infrastructure/lightbox/LightboxCallFailure';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { lightboxColumnKeys } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import type { LightboxPreparedCall } from '@/infrastructure/lightbox/LightboxRunEstimate';
import {
  failedLightboxGroup,
  type LightboxGroupOutcome,
  type LightboxRunSource
} from '@/infrastructure/lightbox/LightboxReadingRunContracts';

/**
 * What a group's reply is checked with: built once per run, over the whole
 * chapter. `columnKeys` names each ribbon column's text as read, so a stale
 * tension score stays on the paragraphs it read (PR #150 F-06).
 */
export type LightboxGroupTools = Pick<Parameters<typeof assembleLightboxGroup>[1], 'verifier' | 'counter' | 'columnKeys' | 'standouts'>;

/** The tools over the whole chapter, built once per run before any call is sent; throws when the chapter cannot be prepared. */
export function lightboxGroupTools(source: LightboxRunSource): LightboxGroupTools {
  return {
    verifier: createLightboxQuoteVerifier(source.material.paragraphs),
    counter: createLightboxTermCounter(source.material.paragraphs),
    // Each ribbon column's text as read, so a stale tension score stays on it (PR #150 F-06).
    columnKeys: lightboxColumnKeys(source.material.paragraphs, source.material.columns),
    // What a numbers reading may name, and how its quotes are checked (Slice 4B).
    standouts: lightboxStandoutRows(source.material.numbers)
  };
}

export interface LightboxGroupReplyPorts {
  recovery: RejectedModelResponseRecovery;
  recoveryPresenter: RejectedModelResponseRecoveryPresenter;
  outputChannel: LogSink;
}

export interface LightboxGroupReply {
  call: LightboxPreparedCall;
  /** The call's result: it came back, and was not cancelled. */
  result: ExecutionResult;
  source: LightboxRunSource;
  tools: LightboxGroupTools;
  /** The run's token, which prefixes the tiles' ids. */
  token: string;
}

/** The group's outcome from a reply that came back. */
export async function readLightboxGroupReply(
  ports: LightboxGroupReplyPorts,
  { call, result, source, tools, token }: LightboxGroupReply
): Promise<LightboxGroupOutcome> {
  const read = await decodeLightboxReply(ports, call, result, { columnCount: source.material.columns.length });
  if ('failed' in read) {
    return read.failed;
  }
  const decoded = read.decoded;

  let ordinal = 0;
  const prefix = `lbt-${token.slice(0, 8)}-${call.group}`;
  const assembled = assembleLightboxGroup(decoded, {
    ...tools,
    mintId: () => `${prefix}-${++ordinal}`,
    averageWordsPerSentence: source.averageWordsPerSentence
  });
  ports.outputChannel.appendLine(
    `[LightboxReadingRunner] Group ${call.group} read (${call.lenses.join(', ')}): ` +
      `${assembled.tiles.length} tiles, ${assembled.withheldBlocks.length} blocks withheld, ` +
      `${assembled.withheldClaims.length} claims withheld, ${assembled.quotesChecked} quotes checked ` +
      `(${assembled.quotesWithheld} withheld)` +
      (decoded.ignored.length > 0 ? `, ignored unrequested ${decoded.ignored.join(', ')}` : '')
  );
  return {
    group: call.group,
    lenses: call.lenses,
    status: 'ok',
    tiles: assembled.tiles,
    withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims,
    frictions: assembled.frictions,
    ...(result.modelId ? { model: result.modelId } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
    quoteChecks: assembled.quoteChecks
  };
}

/**
 * A reply decoded by how it ended (Slice 4H), its repairs and clips logged,
 * a cut-off reply saved for recovery with its place named on the cut
 * block; or, when it cannot be read, the group failed with the paid body
 * quarantined. Shared with group F's reply (`LightboxOpinionReply`).
 */
export async function decodeLightboxReply(
  ports: LightboxGroupReplyPorts,
  call: LightboxPreparedCall,
  result: ExecutionResult,
  context: Pick<LightboxGroupDecodeContext, 'columnCount'>
): Promise<{ decoded: LightboxDecodedGroup } | { failed: LightboxGroupOutcome }> {
  const content = result.rawContent ?? result.content;
  const end = result.finishReason === 'length' ? 'ceiling' : 'stop';
  let decoded: LightboxDecodedGroup;
  try {
    decoded = decodeLightboxGroup(content, { group: call.group, lenses: call.lenses, columnCount: context.columnCount, end });
  } catch (error) {
    const rejection = end === 'ceiling' ? ceilingRejection(error) : lightboxRejectionOf(error);
    return { failed: failedLightboxGroup(call, await quarantineLightboxReply(ports, call, content, result, rejection), result) };
  }
  const report = decoded.report;
  for (const repair of report?.repairs ?? []) {
    ports.outputChannel.appendLine(`[LightboxReadingRunner] Group ${call.group} repaired: ${repair}`);
  }
  if (report && report.clipped > 0) {
    ports.outputChannel.appendLine(
      `[LightboxReadingRunner] Group ${call.group} clipped ${report.clipped} field${report.clipped === 1 ? '' : 's'} at the safety ceiling`
    );
  }
  if (!report?.cutOff) {
    return { decoded };
  }
  // Cut off at the output ceiling: what it finished is read, and the paid body is still kept, its place named on the cut block.
  const cut = decoded.withheld.filter((entry) => entry.reason === LIGHTBOX_CUT_OFF_REASON).map((entry) => entry.lens);
  ports.outputChannel.appendLine(
    `[LightboxReadingRunner] Group ${call.group} reached the output ceiling: ${decoded.blocks.length} blocks finished, ` +
      `${cut.length > 0 ? `cut inside ${cut.join(', ')}` : 'cut between blocks'}`
  );
  const receipt = await ports.recovery.capture({
    toolName: 'lightbox-readings',
    requestSummary: lightboxRecoverySummary(call),
    rawResponse: content,
    rejection: `${ceilingMessage()}; the blocks it finished were read and the rest withheld`,
    modelId: result.modelId,
    providerResponseId: result.providerResponseId,
    finishReason: result.finishReason,
    usage: result.usage,
    contract: lightboxRecoveryContract(call)
  });
  const notice = recoveryLocationNotice(receipt);
  return {
    decoded: {
      ...decoded,
      withheld: decoded.withheld.map((entry) => (cut.includes(entry.lens) ? { ...entry, reason: `${entry.reason} ${notice}` } : entry))
    }
  };
}

/**
 * Save the paid body for recovery; the returned sentence tells the writer
 * where it went. The rejection's message is logged and shown; its
 * diagnostic is written only beside the body, in the recovery store's
 * gitignored folder, with the group's own contract.
 */
export async function quarantineLightboxReply(
  ports: LightboxGroupReplyPorts,
  call: LightboxPreparedCall,
  content: string,
  result: ExecutionResult,
  rejection: LightboxRejection
): Promise<string> {
  ports.outputChannel.appendLine(`[LightboxReadingRunner] Group ${call.group} rejected: ${rejection.message}`);
  const receipt = await persistRejectedWidgetResponse(ports.recovery, ports.recoveryPresenter, {
    toolName: 'lightbox-readings',
    requestSummary: lightboxRecoverySummary(call),
    rawResponse: content,
    rejection: rejection.diagnostic ? `${rejection.message}. ${rejection.diagnostic}` : rejection.message,
    result,
    contract: lightboxRecoveryContract(call)
  });
  return `The reading came back unusable (${rejection.message}). ${recoveryLocationNotice(receipt)} Press Finish or Analyze to try again.`;
}

/**
 * The contract a group's call asked for, as its recovery sidecar records it:
 * that group's own sentinels, and the block key of each lens it requested.
 */
export function lightboxRecoveryContract(call: { group: LightboxReadingGroupId; lenses: readonly LightboxLensId[] }): RejectedModelResponseContract {
  const { start, end } = lightboxGroupSentinels(call.group);
  const blocks = call.lenses.map((lens) => LIGHTBOX_LENS_KEYS[lens]).join(', ');
  return {
    id: 'lightbox-reading-group-v1',
    intendedContentType: 'application/json',
    protocol: `First-line ${start}, then JSON {version: ${LIGHTBOX_READING_PROTOCOL_VERSION}, one block per requested lens ` +
      `(${blocks}), each with friction}, then final-line ${end}.`
  };
}

function lightboxRecoverySummary(call: { group: LightboxReadingGroupId; lenses: readonly LightboxLensId[] }): string {
  return `Lightbox group ${call.group}: ${call.lenses.map(lightboxLensLabel).join(', ')}`;
}

function ceilingMessage(): string {
  return `the reply reached the ${PROMPT_BUDGETS.lightbox.groupOutputTokens.toLocaleString('en-US')}-token output ceiling`;
}

/** A reply cut off at the output ceiling that could not be salvaged: the ceiling, then why, in host words. */
function ceilingRejection(error: unknown): LightboxRejection {
  const inner = lightboxRejectionOf(error);
  const detail = error instanceof LightboxGroupFrameError ? inner.message : undefined;
  return {
    message: `${ceilingMessage()}, and what came back could not be read`,
    ...(detail || inner.diagnostic ? { diagnostic: [detail, inner.diagnostic].filter(Boolean).join('. ') } : {})
  };
}
