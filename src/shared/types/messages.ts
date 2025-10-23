/**
 * Message types for communication between extension and webview
 * Following clean architecture: these are shared contracts
 */

import { ContextPathGroup } from './context';
import { TextSourceSpec } from './sources';

export enum MessageType {
  // Analysis tab messages
  ANALYZE_DIALOGUE = 'analyze_dialogue',
  ANALYZE_PROSE = 'analyze_prose',
  LOOKUP_DICTIONARY = 'lookup_dictionary',
  GENERATE_CONTEXT = 'generate_context',
  COPY_RESULT = 'copy_result',
  SAVE_RESULT = 'save_result',
  REQUEST_SELECTION = 'request_selection',

  // Metrics tab messages
  MEASURE_PROSE_STATS = 'measure_prose_stats',
  MEASURE_STYLE_FLAGS = 'measure_style_flags',
  MEASURE_WORD_FREQUENCY = 'measure_word_frequency',

  // Metrics source helpers
  REQUEST_ACTIVE_FILE = 'request_active_file',
  ACTIVE_FILE = 'active_file',
  REQUEST_MANUSCRIPT_GLOBS = 'request_manuscript_globs',
  MANUSCRIPT_GLOBS = 'manuscript_globs',
  REQUEST_CHAPTER_GLOBS = 'request_chapter_globs',
  CHAPTER_GLOBS = 'chapter_globs',

  // Results messages
  ANALYSIS_RESULT = 'analysis_result',
  METRICS_RESULT = 'metrics_result',
  DICTIONARY_RESULT = 'dictionary_result',
  CONTEXT_RESULT = 'context_result',
  SAVE_RESULT_SUCCESS = 'save_result_success',
  SELECTION_DATA = 'selection_data',
  ERROR = 'error',
  STATUS = 'status',

  // UI state messages
  TAB_CHANGED = 'tab_changed',
  SELECTION_UPDATED = 'selection_updated',

  // Configuration messages
  REQUEST_MODEL_DATA = 'request_model_data',
  MODEL_DATA = 'model_data',
  SET_MODEL_SELECTION = 'set_model_selection',

  // Guide actions
  OPEN_GUIDE_FILE = 'open_guide_file'
}

export enum TabId {
  ANALYSIS = 'analysis',
  SUGGESTIONS = 'suggestions',
  METRICS = 'metrics',
  UTILITIES = 'utilities'
}

export type ModelScope = 'assistant' | 'dictionary' | 'context';

export interface ModelOption {
  id: string;
  label: string;
  description?: string;
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
  contextText?: string;
  sourceFileUri?: string;
}

export interface AnalyzeProseMessage extends BaseMessage {
  type: MessageType.ANALYZE_PROSE;
  text: string;
  contextText?: string;
  sourceFileUri?: string;
}

export interface LookupDictionaryMessage extends BaseMessage {
  type: MessageType.LOOKUP_DICTIONARY;
  word: string;
  contextText?: string;
}

export interface CopyResultMessage extends BaseMessage {
  type: MessageType.COPY_RESULT;
  toolName: string;
  content: string;
}

export interface SaveResultMessage extends BaseMessage {
  type: MessageType.SAVE_RESULT;
  toolName: string;
  content: string;
  metadata?: SaveResultMetadata;
}

export type SelectionTarget =
  | 'assistant_excerpt'
  | 'assistant_context'
  | 'dictionary_word'
  | 'dictionary_context';

export interface RequestSelectionMessage extends BaseMessage {
  type: MessageType.REQUEST_SELECTION;
  target: SelectionTarget;
}

export interface GenerateContextMessage extends BaseMessage {
  type: MessageType.GENERATE_CONTEXT;
  excerpt: string;
  existingContext?: string;
  sourceFileUri?: string;
  requestedGroups?: ContextPathGroup[];
}

export interface MeasureProseStatsMessage extends BaseMessage {
  type: MessageType.MEASURE_PROSE_STATS;
  text?: string;
  source?: TextSourceSpec;
}

export interface MeasureStyleFlagsMessage extends BaseMessage {
  type: MessageType.MEASURE_STYLE_FLAGS;
  text?: string;
  source?: TextSourceSpec;
}

export interface MeasureWordFrequencyMessage extends BaseMessage {
  type: MessageType.MEASURE_WORD_FREQUENCY;
  text?: string;
  source?: TextSourceSpec;
}

export interface TabChangedMessage extends BaseMessage {
  type: MessageType.TAB_CHANGED;
  tabId: TabId;
}

export interface OpenGuideFileMessage extends BaseMessage {
  type: MessageType.OPEN_GUIDE_FILE;
  guidePath: string;  // Relative path from craft-guides/
}

export interface RequestModelDataMessage extends BaseMessage {
  type: MessageType.REQUEST_MODEL_DATA;
}

export interface SetModelSelectionMessage extends BaseMessage {
  type: MessageType.SET_MODEL_SELECTION;
  scope: ModelScope;
  modelId: string;
}

export interface RequestActiveFileMessage extends BaseMessage {
  type: MessageType.REQUEST_ACTIVE_FILE;
}

export interface ActiveFileMessage extends BaseMessage {
  type: MessageType.ACTIVE_FILE;
  relativePath?: string; // undefined if no active file
  sourceUri?: string;
}

export interface RequestManuscriptGlobsMessage extends BaseMessage {
  type: MessageType.REQUEST_MANUSCRIPT_GLOBS;
}

export interface ManuscriptGlobsMessage extends BaseMessage {
  type: MessageType.MANUSCRIPT_GLOBS;
  globs: string; // raw config string
}

export interface RequestChapterGlobsMessage extends BaseMessage {
  type: MessageType.REQUEST_CHAPTER_GLOBS;
}

export interface ChapterGlobsMessage extends BaseMessage {
  type: MessageType.CHAPTER_GLOBS;
  globs: string; // raw config string
}

export type WebviewToExtensionMessage =
  | AnalyzeDialogueMessage
  | AnalyzeProseMessage
  | LookupDictionaryMessage
  | CopyResultMessage
  | SaveResultMessage
  | RequestSelectionMessage
  | GenerateContextMessage
  | MeasureProseStatsMessage
  | MeasureStyleFlagsMessage
  | MeasureWordFrequencyMessage
  | TabChangedMessage
  | OpenGuideFileMessage
  | RequestModelDataMessage
  | SetModelSelectionMessage
  | RequestActiveFileMessage
  | RequestManuscriptGlobsMessage
  | RequestChapterGlobsMessage;

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

export interface ContextResultMessage extends BaseMessage {
  type: MessageType.CONTEXT_RESULT;
  result: string;
  toolName: string;
  requestedResources?: string[];
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

export interface SaveResultSuccessMessage extends BaseMessage {
  type: MessageType.SAVE_RESULT_SUCCESS;
  filePath: string;
  toolName: string;
}

export interface SelectionDataMessage extends BaseMessage {
  type: MessageType.SELECTION_DATA;
  target: SelectionTarget;
  content: string;
  sourceUri?: string;
  relativePath?: string;
}

export interface SaveResultMetadata {
  word?: string;
  excerpt?: string;
  context?: string;
  sourceFileUri?: string;
  relativePath?: string;
  timestamp?: number;
}

export interface SelectionUpdatedMessage extends BaseMessage {
  type: MessageType.SELECTION_UPDATED;
  text: string;
  sourceUri?: string;
  relativePath?: string;
  target?: 'assistant' | 'dictionary' | 'both';
}

export interface ModelDataMessage extends BaseMessage {
  type: MessageType.MODEL_DATA;
  options: ModelOption[];
  selections: Partial<Record<ModelScope, string>>;
}

export type ExtensionToWebviewMessage =
  | AnalysisResultMessage
  | MetricsResultMessage
  | DictionaryResultMessage
  | ContextResultMessage
  | SaveResultSuccessMessage
  | SelectionDataMessage
  | ErrorMessage
  | StatusMessage
  | SelectionUpdatedMessage
  | ModelDataMessage
  | ActiveFileMessage
  | ManuscriptGlobsMessage
  | ChapterGlobsMessage;
