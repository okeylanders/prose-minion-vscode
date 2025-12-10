/**
 * Analysis domain messages
 * Dialogue, prose, and writing tools analysis contracts
 */

import { MessageEnvelope, MessageType } from './base';

/**
 * Focus modes for dialogue/microbeat analysis
 * - dialogue: Dialogue line refinement focus (word choice, subtext, character voice)
 * - microbeats: Action beats and physical grounding focus
 * - both: Balanced 50/50 coverage (default)
 */
export type DialogueFocus = 'dialogue' | 'microbeats' | 'both';

/**
 * Focus modes for writing tools analysis
 * - cliche: Identify overused phrases, dead metaphors, stock expressions
 * - continuity: Catch logical inconsistencies, choreography issues, object tracking
 * - style: Detect stylistic drift (tense shifts, POV breaks, register drift)
 * - editor: Traditional copyediting (grammar, spelling, punctuation, mechanics)
 */
export type WritingToolsFocus = 'cliche' | 'continuity' | 'style' | 'editor';

/**
 * Union of all assistant focus modes (for backward compatibility)
 */
export type AssistantFocus = DialogueFocus | WritingToolsFocus;

// ─────────────────────────────────────────────────────────────────────────────
// Dialogue Analysis (dialogue tags, microbeats, action beats)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyzeDialoguePayload {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
  focus?: DialogueFocus;
}

export interface AnalyzeDialogueMessage extends MessageEnvelope<AnalyzeDialoguePayload> {
  type: MessageType.ANALYZE_DIALOGUE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prose Analysis (general prose quality)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyzeProsePayload {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
}

export interface AnalyzeProseMessage extends MessageEnvelope<AnalyzeProsePayload> {
  type: MessageType.ANALYZE_PROSE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writing Tools Analysis (cliche, continuity, style, editor)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyzeWritingToolsPayload {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
  focus: WritingToolsFocus;
}

export interface AnalyzeWritingToolsMessage extends MessageEnvelope<AnalyzeWritingToolsPayload> {
  type: MessageType.ANALYZE_WRITING_TOOLS;
}

export interface AnalysisResultPayload {
  result: string;
  toolName: string;
  usedGuides?: string[];  // Array of guide paths that were used in the analysis
}

export interface AnalysisResultMessage extends MessageEnvelope<AnalysisResultPayload> {
  type: MessageType.ANALYSIS_RESULT;
}
