/**
 * LightboxGroupReply — what a reading group's reply becomes once its call
 * has come back (ADR 2026-10-19 D7, D8). Split from `LightboxReadingRunner`,
 * which owns the run and its calls (PR #149 F-10).
 *
 * - **Unusable replies.** A reply cut off at the output ceiling
 *   (`finishReason === 'length'`) fails its group, and so does one whose
 *   frame cannot be read; either paid body is quarantined in the
 *   rejected-response recovery store and the writer is told where it went.
 *   The rejection's message is logged and shown; its diagnostic is written
 *   only beside the body.
 * - **Checked replies.** Otherwise the frame's blocks are checked against
 *   the chapter (quotes verified, terms counted) and assembled into tiles.
 *   Blocks and items that break their own rules are withheld, not failed.
 *
 * Logs carry groups, lenses, counts and reasons, never the chapter or the
 * model's prose (PR #149 F-05).
 */

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
import { lightboxRejectionOf, type LightboxRejection } from '@/infrastructure/lightbox/LightboxCallFailure';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
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
export type LightboxGroupTools = Pick<Parameters<typeof assembleLightboxGroup>[1], 'verifier' | 'counter' | 'columnKeys'>;

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
  const content = result.rawContent ?? result.content;
  if (result.finishReason === 'length') {
    return failedLightboxGroup(call, await quarantine(ports, call, content, result, {
      message: `the reply reached the ${PROMPT_BUDGETS.lightbox.groupOutputTokens.toLocaleString('en-US')}-token output ceiling`
    }), result);
  }

  let decoded: ReturnType<typeof decodeLightboxGroup>;
  try {
    decoded = decodeLightboxGroup(content, {
      group: call.group,
      lenses: call.lenses,
      columnCount: source.material.columns.length
    });
  } catch (error) {
    return failedLightboxGroup(call, await quarantine(ports, call, content, result, lightboxRejectionOf(error)), result);
  }

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
 * Save the paid body for recovery; the returned sentence tells the writer
 * where it went. The rejection's message is logged and shown; its
 * diagnostic is written only beside the body, in the recovery store's
 * gitignored folder.
 */
async function quarantine(
  ports: LightboxGroupReplyPorts,
  call: LightboxPreparedCall,
  content: string,
  result: ExecutionResult,
  rejection: LightboxRejection
): Promise<string> {
  ports.outputChannel.appendLine(`[LightboxReadingRunner] Group ${call.group} rejected: ${rejection.message}`);
  const receipt = await persistRejectedWidgetResponse(ports.recovery, ports.recoveryPresenter, {
    toolName: 'lightbox-readings',
    requestSummary: `Lightbox group ${call.group}: ${call.lenses.map(lightboxLensLabel).join(', ')}`,
    rawResponse: content,
    rejection: rejection.diagnostic ? `${rejection.message}. ${rejection.diagnostic}` : rejection.message,
    result
  });
  return `The reading came back unusable (${rejection.message}). ${recoveryLocationNotice(receipt)} Read the rest to try again.`;
}
