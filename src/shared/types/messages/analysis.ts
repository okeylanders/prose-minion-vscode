/**
 * Analysis domain messages
 * Dialogue and prose analysis contracts
 */

import { MessageEnvelope, MessageType } from './base';

/**
 * Focus modes for dialogue/prose analysis
 * - dialogue: Dialogue line refinement focus (word choice, subtext, character voice)
 * - microbeats: Action beats and physical grounding focus
 * - both: Balanced 50/50 coverage (default)
 * - cliche: Identify overused phrases, dead metaphors, stock expressions
 * - continuity: Catch logical inconsistencies, choreography issues, object tracking
 * - style: Detect stylistic drift (tense shifts, POV breaks, register drift)
 * - editor: Traditional copyediting (grammar, spelling, punctuation, mechanics)
 */
export type AssistantFocus =
  | 'dialogue'
  | 'microbeats'
  | 'both'
  | 'cliche'
  | 'continuity'
  | 'style'
  | 'editor';

export interface AnalyzeDialoguePayload {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
  focus?: AssistantFocus;
}

export interface AnalyzeDialogueMessage extends MessageEnvelope<AnalyzeDialoguePayload> {
  type: MessageType.ANALYZE_DIALOGUE;
}

export interface AnalyzeProsePayload {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
}

export interface AnalyzeProseMessage extends MessageEnvelope<AnalyzeProsePayload> {
  type: MessageType.ANALYZE_PROSE;
}

export interface AnalysisResultPayload {
  result: string;
  toolName: string;
  usedGuides?: string[];  // Array of guide paths that were used in the analysis
}

export interface AnalysisResultMessage extends MessageEnvelope<AnalysisResultPayload> {
  type: MessageType.ANALYSIS_RESULT;
}
