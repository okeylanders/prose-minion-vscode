/**
 * Base message types and enums
 * Foundational contracts for all messaging
 */

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

  // Search tab messages (separate from Metrics)
  RUN_WORD_SEARCH = 'run_word_search',

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
  SEARCH_RESULT = 'search_result',
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
  OPEN_GUIDE_FILE = 'open_guide_file',

  // Publishing standards messages
  REQUEST_PUBLISHING_STANDARDS_DATA = 'request_publishing_standards_data',
  PUBLISHING_STANDARDS_DATA = 'publishing_standards_data',
  SET_PUBLISHING_PRESET = 'set_publishing_preset',
  SET_PUBLISHING_TRIM_SIZE = 'set_publishing_trim_size',

  // Token usage/cost updates
  TOKEN_USAGE_UPDATE = 'token_usage_update',

  // Settings overlay and updates
  OPEN_SETTINGS = 'open_settings',
  OPEN_SETTINGS_TOGGLE = 'open_settings_toggle',
  REQUEST_SETTINGS_DATA = 'request_settings_data',
  SETTINGS_DATA = 'settings_data',
  UPDATE_SETTING = 'update_setting',
  RESET_TOKEN_USAGE = 'reset_token_usage'
}

export enum TabId {
  ANALYSIS = 'analysis',
  SUGGESTIONS = 'suggestions',
  SEARCH = 'search',
  METRICS = 'metrics',
  UTILITIES = 'utilities'
}

export type ModelScope = 'assistant' | 'dictionary' | 'context';

export interface ModelOption {
  id: string;
  label: string;
  description?: string;
}

export interface BaseMessage {
  type: MessageType;
  timestamp?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
  isEstimate?: boolean;
}

export type SelectionTarget =
  | 'assistant_excerpt'
  | 'assistant_context'
  | 'dictionary_word'
  | 'dictionary_context';

export interface SaveResultMetadata {
  word?: string;
  excerpt?: string;
  context?: string;
  sourceFileUri?: string;
  relativePath?: string;
  timestamp?: number;
}
