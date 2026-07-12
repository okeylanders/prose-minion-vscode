/**
 * Bounded prompt envelopes for Workshop host turns.
 *
 * Visible reports remain verbatim. Prompt copies cross a separate trust
 * boundary: reserved frame delimiters are encoded before quoted writer/model
 * material is inserted so an excerpt cannot close or forge host framing.
 */

import { TokenUsage, WorkshopToolId } from '@messages';
import { workshopToolLabel } from '@shared/constants/workshopTools';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';
import type { WorkshopHostHandoff } from '@/application/services/WorkshopSessionService';

export { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';

export const WORKSHOP_TOOL_EVIDENCE_MAX_CHARS = 50_000;

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

/** Combine a pending direct-tool delta with the writer's ordinary host turn. */
export function buildWorkshopHostMessage(
  writerMessage: string,
  handoff?: WorkshopHostHandoff,
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
