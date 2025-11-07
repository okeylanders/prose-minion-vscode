/**
 * Analysis domain messages
 * Dialogue and prose analysis contracts
 */

import { MessageEnvelope, MessageType } from './base';

export interface AnalyzeDialoguePayload {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
  focus?: 'dialogue' | 'microbeats' | 'both';
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
