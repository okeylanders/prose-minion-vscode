/**
 * Message types for communication between extension and webview
 * Following clean architecture: these are shared contracts
 */

export enum MessageType {
  // Analysis tab messages
  ANALYZE_DIALOGUE = 'analyze_dialogue',
  ANALYZE_PROSE = 'analyze_prose',
  LOOKUP_DICTIONARY = 'lookup_dictionary',

  // Metrics tab messages
  MEASURE_PROSE_STATS = 'measure_prose_stats',
  MEASURE_STYLE_FLAGS = 'measure_style_flags',
  MEASURE_WORD_FREQUENCY = 'measure_word_frequency',

  // Results messages
  ANALYSIS_RESULT = 'analysis_result',
  METRICS_RESULT = 'metrics_result',
  DICTIONARY_RESULT = 'dictionary_result',
  ERROR = 'error',
  STATUS = 'status',

  // UI state messages
  TAB_CHANGED = 'tab_changed',
  SELECTION_UPDATED = 'selection_updated',

  // Guide actions
  OPEN_GUIDE_FILE = 'open_guide_file'
}

export enum TabId {
  ANALYSIS = 'analysis',
  SUGGESTIONS = 'suggestions',
  METRICS = 'metrics',
  UTILITIES = 'utilities'
}

// Base message interface
export interface BaseMessage {
  type: MessageType;
  timestamp?: number;
}

// Messages from webview to extension
export interface AnalyzeDialogueMessage extends BaseMessage {
  type: MessageType.ANALYZE_DIALOGUE;
  text: string;
}

export interface AnalyzeProseMessage extends BaseMessage {
  type: MessageType.ANALYZE_PROSE;
  text: string;
}

export interface LookupDictionaryMessage extends BaseMessage {
  type: MessageType.LOOKUP_DICTIONARY;
  word: string;
  contextText?: string;
}

export interface MeasureProseStatsMessage extends BaseMessage {
  type: MessageType.MEASURE_PROSE_STATS;
  text: string;
}

export interface MeasureStyleFlagsMessage extends BaseMessage {
  type: MessageType.MEASURE_STYLE_FLAGS;
  text: string;
}

export interface MeasureWordFrequencyMessage extends BaseMessage {
  type: MessageType.MEASURE_WORD_FREQUENCY;
  text: string;
}

export interface TabChangedMessage extends BaseMessage {
  type: MessageType.TAB_CHANGED;
  tabId: TabId;
}

export interface OpenGuideFileMessage extends BaseMessage {
  type: MessageType.OPEN_GUIDE_FILE;
  guidePath: string;  // Relative path from craft-guides/
}

export type WebviewToExtensionMessage =
  | AnalyzeDialogueMessage
  | AnalyzeProseMessage
  | LookupDictionaryMessage
  | MeasureProseStatsMessage
  | MeasureStyleFlagsMessage
  | MeasureWordFrequencyMessage
  | TabChangedMessage
  | OpenGuideFileMessage;

// Messages from extension to webview
export interface AnalysisResultMessage extends BaseMessage {
  type: MessageType.ANALYSIS_RESULT;
  result: string;
  toolName: string;
  usedGuides?: string[];  // Array of guide paths that were used in the analysis
}

export interface MetricsResultMessage extends BaseMessage {
  type: MessageType.METRICS_RESULT;
  result: any;
  toolName: string;
}

export interface DictionaryResultMessage extends BaseMessage {
  type: MessageType.DICTIONARY_RESULT;
  result: string;
  toolName: string;
}

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  message: string;
  details?: string;
}

export interface StatusMessage extends BaseMessage {
  type: MessageType.STATUS;
  message: string;
  guideNames?: string;  // Comma-separated list of guide names for ticker animation
}

export interface SelectionUpdatedMessage extends BaseMessage {
  type: MessageType.SELECTION_UPDATED;
  text: string;
}

export type ExtensionToWebviewMessage =
  | AnalysisResultMessage
  | MetricsResultMessage
  | DictionaryResultMessage
  | ErrorMessage
  | StatusMessage
  | SelectionUpdatedMessage;
