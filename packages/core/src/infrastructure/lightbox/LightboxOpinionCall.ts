/**
 * Group F's call, as the runner prepares and opens it (ADR 2026-10-19 D6,
 * D7 addendum; Slice 4D). Split from `LightboxReadingRunner`, which owns
 * the run, its ownership and its calls.
 *
 * - **Prepared** with the press, like every group: its system message (its
 *   own lens file and worked example) and its task. Its digest does not
 *   exist yet, so the call reserves the digest's whole bound, and the
 *   estimate and the fit check price it "up to" that bound.
 * - **Opened** only when the runner starts it: after every other group of
 *   the run has settled, while the run still owns its board. The digest is
 *   built then, from the board as those groups left it, through the
 *   press owner's port. With no current reading on the board, or a port that
 *   fails, nothing is sent and F fails in host words. The digest's size and
 *   key are logged, never its text.
 */

import type { LogSink } from '@/platform';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { describeLightboxHostFailure } from '@/infrastructure/lightbox/LightboxCallFailure';
import type { LightboxGroupRequest } from '@/infrastructure/lightbox/LightboxReadingPrompts';
import type { LightboxPreparedCall } from '@/infrastructure/lightbox/LightboxRunEstimate';
import {
  failedLightboxGroup,
  type LightboxGroupOutcome,
  type LightboxOpinionPort
} from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import type { LightboxGroupReplyPorts } from '@/infrastructure/lightbox/LightboxGroupReply';
import { readLightboxOpinionReply } from '@/infrastructure/lightbox/LightboxOpinionReply';
import { LIGHTBOX_OPINION_NOTHING_TO_WEIGH } from '@shared/constants/lightboxOpinion';
import {
  buildLightboxOpinionTaskSection,
  buildLightboxOpinionUserMessage,
  type LightboxOpinionDigest
} from '@/infrastructure/lightbox/LightboxOpinionDigest';

const NO_BOARD = 'The board this press read is gone, so the Opinion was not read.';

/** F as prepared with its press: its task alone, with the digest's bound reserved. */
export function prepareLightboxOpinionCall(systemMessage: string, request: LightboxGroupRequest): LightboxPreparedCall {
  return {
    group: request.group,
    lenses: [...request.lenses],
    systemMessage,
    userMessage: buildLightboxOpinionTaskSection(),
    chapterTokens: 0,
    digestTokens: PROMPT_BUDGETS.lightbox.opinionDigestTokens
  };
}

export interface LightboxOpinionCallRun {
  port: LightboxOpinionPort | undefined;
  replyPorts: LightboxGroupReplyPorts;
  /** The run's token. */
  token: string;
  /** The runner's own call: sends `call` while the run owns its board, and reads what came back with `read`. */
  send: (
    call: LightboxPreparedCall,
    read: (result: ExecutionResult) => Promise<LightboxGroupOutcome>
  ) => Promise<LightboxGroupOutcome | undefined>;
}

/**
 * Open F's call and send it: its outcome, a failure with nothing sent, or
 * nothing when the run stopped meanwhile. A failure checking its reply
 * fails F alone, in host words, keyed by the digest it read.
 */
export async function settleLightboxOpinionCall(
  prepared: LightboxPreparedCall,
  run: LightboxOpinionCallRun
): Promise<LightboxGroupOutcome | undefined> {
  const { outputChannel } = run.replyPorts;
  const opened = openLightboxOpinionCall(prepared, run.port, outputChannel, run.token);
  if ('failure' in opened) {
    return failedLightboxGroup(prepared, opened.failure);
  }
  const { call, digest } = opened;
  try {
    return await run.send(call, (result) => readLightboxOpinionReply(run.replyPorts, { call, result, digest, token: run.token }));
  } catch (error) {
    const failure = describeLightboxHostFailure(error, 'weigh');
    outputChannel.appendLine(`[LightboxReadingRunner] Group F could not be checked: ${failure.log}`);
    return { ...failedLightboxGroup(call, failure.message), digestKey: digest.key };
  }
}

/**
 * F's call with its digest, built now from the board through `port`, or
 * why it cannot be sent. Never throws.
 */
export function openLightboxOpinionCall(
  call: LightboxPreparedCall,
  port: LightboxOpinionPort | undefined,
  outputChannel: LogSink,
  token: string
): { call: LightboxPreparedCall; digest: LightboxOpinionDigest } | { failure: string } {
  let built: ReturnType<LightboxOpinionPort['digest']>;
  try {
    built = port ? port.digest() : { refusal: NO_BOARD };
  } catch (error) {
    const failure = describeLightboxHostFailure(error, 'digest');
    outputChannel.appendLine(`[LightboxReadingRunner] Run ${token} could not gather the board for group F: ${failure.log}`);
    return { failure: failure.message };
  }
  if ('refusal' in built) {
    outputChannel.appendLine(`[LightboxReadingRunner] Run ${token} sent no group F call: nothing to weigh`);
    return { failure: built.refusal };
  }
  if (built.readings === 0) {
    outputChannel.appendLine(`[LightboxReadingRunner] Run ${token} sent no group F call: no current reading on the board`);
    return { failure: LIGHTBOX_OPINION_NOTHING_TO_WEIGH };
  }
  outputChannel.appendLine(
    `[LightboxReadingRunner] Run ${token} group F digest: ${built.items.size} items, ${built.readings} readings, ` +
      `${built.leftOut} left out, about ${estimateTextTokens(built.section).toLocaleString('en-US')} tokens, key ${built.key.slice(0, 12)}`
  );
  return { call: { ...call, userMessage: buildLightboxOpinionUserMessage(built) }, digest: built };
}
