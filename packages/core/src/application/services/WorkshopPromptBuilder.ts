/**
 * Bounded prompt envelopes for Workshop host turns.
 *
 * Visible reports remain verbatim. Prompt copies cross a separate trust
 * boundary: reserved frame delimiters are encoded before quoted writer/model
 * material is inserted so an excerpt cannot close or forge host framing.
 */

import { TokenUsage, WorkshopToolId, WorkshopTurn } from '@messages';
import { workshopToolLabel } from '@shared/constants/workshopTools';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';

export { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';

export const WORKSHOP_TOOL_EVIDENCE_MAX_CHARS = 50_000;
export const WORKSHOP_DIRECT_HANDOFF_MAX_TURNS = 8;
export const WORKSHOP_DIRECT_HANDOFF_MAX_CHARS = 20_000;

/**
 * Character budget reserved for the envelope's safety frame — the header
 * counts, the truncation marker, and the anti-hallucination instruction.
 * Reserved OFF THE TOP so content can never crowd out the frame that tells
 * the persona how to read it (PR #72 review #3).
 */
const HANDOFF_FRAME_RESERVE = 800;
const HANDOFF_TRUNCATION_MARKER =
  '\n[Direct exchange truncated by the 20,000-character handoff limit.]';

/** A built direct-tool handoff envelope plus the exact turn ids it shipped. */
export interface WorkshopDirectHandoff {
  message: string;
  /**
   * Turn ids whose content actually shipped in `message` — the only valid
   * input to WorkshopSessionService.commitHostHandoff. Turns dropped by the
   * turn window or character budget are absent, so they stay unseen.
   */
  deliveredTurnIds: string[];
  unseenTurns: number;
  includedTurns: number;
  omittedTurns: number;
  truncatedCharacters: number;
}

export interface WorkshopToolEvidenceInput {
  toolId: WorkshopToolId;
  originatingRequest: string;
  report: string;
  usage?: TokenUsage;
  truncated?: boolean;
}

/** Build bounded, attributed evidence for the host synthesis turn. */
export function buildWorkshopToolEvidence(input: WorkshopToolEvidenceInput): string {
  const safeReport = neutralizeReservedPersonaPromptDelimiters(input.report);
  const boundedReport = safeReport.slice(0, WORKSHOP_TOOL_EVIDENCE_MAX_CHARS);
  const omittedCharacters = safeReport.length - boundedReport.length;
  const usage = input.usage
    ? `${input.usage.promptTokens} prompt / ${input.usage.completionTokens} completion / ${input.usage.totalTokens} total tokens`
    : 'Provider usage unavailable';

  return [
    '<workshop-tool-evidence>',
    `Tool: ${workshopToolLabel(input.toolId)} (${input.toolId})`,
    `Originating request: ${neutralizeReservedPersonaPromptDelimiters(input.originatingRequest)}`,
    `Tool response truncated by provider: ${input.truncated ? 'yes' : 'no'}`,
    `Evidence characters omitted by host bound: ${omittedCharacters}`,
    `Usage: ${usage}`,
    '',
    'VERBATIM TOOL REPORT:',
    boundedReport,
    omittedCharacters > 0
      ? `[${omittedCharacters} report characters omitted from persona evidence; the visible artifact remains complete.]`
      : undefined,
    '',
    'Evaluate this report as evidence. You may challenge, prioritize, or contextualize it, but do not impersonate the tool or claim its words as your own.',
    '</workshop-tool-evidence>'
  ].filter((line): line is string => line !== undefined).join('\n');
}

interface BoundedHandoffBody {
  blocks: string[];
  deliveredTurnIds: string[];
  omittedTurns: number;
  truncatedCharacters: number;
}

function formatExchangeBlock(turn: WorkshopTurn): string {
  const speaker = turn.participant === 'writer' ? 'Writer' : workshopToolLabel(turn.toolId!);
  return `[${workshopToolLabel(turn.toolId!)} — ${speaker}]\n${turn.content}`;
}

/**
 * Pack exchange blocks newest-first into the content budget. A turn is
 * "delivered" only when its block (possibly head-truncated, with a visible
 * marker) actually lands in the body; budget-dropped turns are counted, not
 * delivered.
 */
function boundByCharacterBudget(newest: readonly WorkshopTurn[]): BoundedHandoffBody {
  const blocks: string[] = [];
  const deliveredTurnIds: string[] = [];
  let omittedTurns = 0;
  let truncatedCharacters = 0;
  let remaining = WORKSHOP_DIRECT_HANDOFF_MAX_CHARS - HANDOFF_FRAME_RESERVE;

  for (let index = newest.length - 1; index >= 0; index -= 1) {
    const turn = newest[index];
    const block = formatExchangeBlock(turn);
    const separatorLength = blocks.length > 0 ? 2 : 0;
    if (block.length + separatorLength <= remaining) {
      blocks.unshift(block);
      deliveredTurnIds.push(turn.id);
      remaining -= block.length + separatorLength;
      continue;
    }

    if (blocks.length === 0) {
      // The newest block alone exceeds the budget: ship its head with an
      // explicit marker and SPEND THE BUDGET so no older block piggybacks
      // past the cap (PR #72 review #3).
      const keptLength = Math.max(0, remaining - HANDOFF_TRUNCATION_MARKER.length);
      blocks.unshift(`${block.slice(0, keptLength)}${HANDOFF_TRUNCATION_MARKER}`);
      deliveredTurnIds.push(turn.id);
      truncatedCharacters += Math.max(0, block.length - keptLength);
      remaining = 0;
    } else {
      omittedTurns += 1;
      truncatedCharacters += block.length;
    }
  }

  return { blocks, deliveredTurnIds, omittedTurns, truncatedCharacters };
}

function formatHandoffMessage(
  unseenTurns: number,
  omittedTurns: number,
  body: BoundedHandoffBody
): string {
  return [
    'DIRECT-TOOL HANDOFF (structured conversation evidence; do not impersonate the tool)',
    `Unseen turns: ${unseenTurns}`,
    `Included turns: ${body.blocks.length}`,
    `Omitted turns: ${omittedTurns}`,
    `Characters omitted by bound: ${body.truncatedCharacters}`,
    '',
    ...body.blocks.flatMap((block, index) => index === 0 ? [block] : ['', block]),
    '',
    'Use this bounded delta as context for the writer\'s next message. Do not claim you witnessed exchanges omitted by the bounds.'
  ].join('\n');
}

/**
 * Build the bounded direct-tool handoff envelope from the session's unseen
 * exchanges (newest-window, then character budget). Content is budgeted; the
 * safety frame is reserved and never trimmed. Callers commit exactly
 * `deliveredTurnIds` after the host turn succeeds.
 */
export function buildWorkshopDirectHandoff(
  unseen: readonly WorkshopTurn[]
): WorkshopDirectHandoff | undefined {
  if (unseen.length === 0) {
    return undefined;
  }

  const newest = unseen.slice(-WORKSHOP_DIRECT_HANDOFF_MAX_TURNS);
  const windowOmittedTurns = unseen.length - newest.length;
  const body = boundByCharacterBudget(newest);
  const omittedTurns = windowOmittedTurns + body.omittedTurns;

  return {
    message: formatHandoffMessage(unseen.length, omittedTurns, body),
    deliveredTurnIds: body.deliveredTurnIds,
    unseenTurns: unseen.length,
    includedTurns: body.blocks.length,
    omittedTurns,
    truncatedCharacters: body.truncatedCharacters
  };
}

/** Combine a pending direct-tool delta with the writer's ordinary host turn. */
export function buildWorkshopHostMessage(
  writerMessage: string,
  handoff?: WorkshopDirectHandoff,
  writerMessageIsTrustedEnvelope = false
): string {
  const safeWriterMessage = writerMessageIsTrustedEnvelope
    ? writerMessage
    : neutralizeReservedPersonaPromptDelimiters(writerMessage);
  if (!handoff) {
    return safeWriterMessage;
  }
  return [
    neutralizeReservedPersonaPromptDelimiters(handoff.message),
    '',
    'WRITER MESSAGE:',
    safeWriterMessage
  ].join('\n');
}
