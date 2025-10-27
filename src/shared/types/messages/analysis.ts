/**
 * Analysis domain messages
 * Dialogue and prose analysis contracts
 */

import { BaseMessage, MessageType } from './base';

export interface AnalyzeDialogueMessage extends BaseMessage {
  type: MessageType.ANALYZE_DIALOGUE;
  text: string;
  contextText?: string;
  sourceFileUri?: string;
}

export interface AnalyzeProseMessage extends BaseMessage {
  type: MessageType.ANALYZE_PROSE;
  text: string;
  contextText?: string;
  sourceFileUri?: string;
}

export interface AnalysisResultMessage extends BaseMessage {
  type: MessageType.ANALYSIS_RESULT;
  result: string;
  toolName: string;
  usedGuides?: string[];  // Array of guide paths that were used in the analysis
}
