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
  CATEGORY_SEARCH_REQUEST = 'category_search_request',
  CATEGORY_SEARCH_RESULT = 'category_search_result',

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
  OPEN_DOCS_FILE = 'open_docs_file',
  OPEN_RESOURCE = 'open_resource',

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
  RESET_TOKEN_USAGE = 'reset_token_usage',

  // Secure API key management
  REQUEST_API_KEY = 'request_api_key',
  API_KEY_STATUS = 'api_key_status',
  UPDATE_API_KEY = 'update_api_key',
  DELETE_API_KEY = 'delete_api_key'
  ,
  // Webview diagnostics
  WEBVIEW_ERROR = 'webview_error',

  // Fast dictionary generation (parallel)
  FAST_GENERATE_DICTIONARY = 'fast_generate_dictionary',
  FAST_GENERATE_DICTIONARY_RESULT = 'fast_generate_dictionary_result',
  DICTIONARY_GENERATION_PROGRESS = 'dictionary_generation_progress'
}

export enum TabId {
  ANALYSIS = 'analysis',
  SUGGESTIONS = 'suggestions',
  SEARCH = 'search',
  METRICS = 'metrics',
  UTILITIES = 'utilities'
}

export type ModelScope = 'assistant' | 'dictionary' | 'context' | 'category';

export type CategoryRelevance = 'broad' | 'focused' | 'specific' | 'synonym';
export type CategoryWordLimit = 20 | 50 | 75 | 100 | 250 | 350 | 500;
export const CATEGORY_RELEVANCE_OPTIONS: readonly CategoryRelevance[] = ['broad', 'focused', 'specific', 'synonym'];

export interface ModelOption {
  id: string;
  label: string;
  description?: string;
}

export interface BaseMessage {
  type: MessageType;
  timestamp?: number;
}

/**
 * Message source type - identifies where a message originated
 *
 * Format: `domain.component` (hierarchical, dot-separated)
 *
 * Extension sources:
 * - extension.configuration
 * - extension.analysis
 * - extension.metrics
 * - extension.search
 * - extension.dictionary
 * - extension.context
 * - extension.publishing
 * - extension.sources
 * - extension.ui
 * - extension.file_ops
 *
 * Webview sources:
 * - webview.settings.overlay
 * - webview.settings.tab_bar
 * - webview.analysis.tab
 * - webview.metrics.tab
 * - webview.dictionary.tab
 * - webview.search.tab
 * - webview.context.assistant
 * - webview.selection
 */
export type MessageSource =
  | `extension.${string}`
  | `webview.${string}`
  | 'unknown';

/**
 * Standard message envelope for all messages
 *
 * Provides consistent structure across all message types with routing metadata.
 * Enables source tracking, correlation, and future features like tracing middleware.
 *
 * @example
 * ```typescript
 * // Extension sending MODEL_DATA
 * const message: ModelDataMessage = {
 *   type: MessageType.MODEL_DATA,
 *   source: 'extension.configuration',
 *   payload: {
 *     modelOptions: { ... },
 *     modelSelections: { ... }
 *   },
 *   timestamp: Date.now()
 * };
 *
 * // Webview sending UPDATE_SETTING
 * const message: UpdateSettingMessage = {
 *   type: MessageType.UPDATE_SETTING,
 *   source: 'webview.settings.overlay',
 *   payload: {
 *     key: 'ui.showTokenWidget',
 *     value: true
 *   },
 *   timestamp: Date.now()
 * };
 * ```
 */
export interface MessageEnvelope<TPayload = any> {
  /** Message type for routing */
  type: MessageType;

  /** Source of the message (e.g., 'webview.settings.overlay', 'extension.configuration') */
  source: MessageSource;

  /** Message-specific data (type varies by MessageType) */
  payload: TPayload;

  /** Timestamp of message creation */
  timestamp: number;

  /** Optional target hint for routing (e.g., 'extension.configuration') */
  target?: MessageSource;

  /** Optional correlation ID for request/response tracking */
  correlationId?: string;
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
