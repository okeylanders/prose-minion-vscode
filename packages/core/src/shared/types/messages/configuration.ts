/**
 * Configuration domain messages
 * Settings, model selection, and token tracking
 */

import { MessageEnvelope, MessageType } from './base';
import { TokenUsage } from './tokenUsage';

// ============================================================================
// Model Configuration Types
// ============================================================================

export type ModelScope = 'assistant' | 'dictionary' | 'context' | 'category' | 'widget' | 'lightbox' | 'proofread';

/**
 * A scope with no model of its own until the writer picks one (Lightbox
 * Slice 4L). Unset, it runs on the model of the scope it follows, and moves
 * when that one does; picked, its model is its own.
 */
export type FollowingModelScope = 'lightbox';

/** What each following scope follows: the Lightbox, the assistant model (the Workshop's). */
export const MODEL_SCOPE_FOLLOWS: Readonly<Record<FollowingModelScope, Exclude<ModelScope, FollowingModelScope>>> = {
  lightbox: 'assistant'
};

export function isFollowingModelScope(scope: unknown): scope is FollowingModelScope {
  return typeof scope === 'string' && Object.prototype.hasOwnProperty.call(MODEL_SCOPE_FOLLOWS, scope);
}

export type ModelParameterConfidence =
  | 'published'
  | 'estimated'
  | 'undisclosed'
  | 'not-applicable';

export interface ModelParameterCount {
  label: string;
  confidence: ModelParameterConfidence;
}

export interface ModelOption {
  id: string;
  label: string;
  description?: string;
  family?: string;
  provider?: string;
  releaseDate?: string;
  knowledgeCutoff?: string;
  expirationDate?: string;
  contextLength?: number;
  parameterCount?: ModelParameterCount;
  pricing?: {
    prompt: string;
    completion: string;
  };
  pricingAvailable?: boolean;
  liveDataAvailable?: boolean;
}

// ============================================================================
// Request Messages (no payload)
// ============================================================================

export interface RequestModelDataPayload {
  refresh?: boolean;
}

export interface RequestModelDataMessage extends MessageEnvelope<RequestModelDataPayload> {
  type: MessageType.REQUEST_MODEL_DATA;
}

export interface RequestSettingsDataMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.REQUEST_SETTINGS_DATA;
}

export interface ResetTokenUsageMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.RESET_TOKEN_USAGE;
}

export interface RequestApiKeyMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.REQUEST_API_KEY;
}

export interface DeleteApiKeyMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.DELETE_API_KEY;
}

// ============================================================================
// Model Selection Messages
// ============================================================================

/**
 * Pick a scope's model, or (Slice 4L) give a following scope's own model up,
 * so it follows again: `modelId: null`, which no other scope accepts.
 */
export type SetModelSelectionPayload =
  | { scope: ModelScope; modelId: string }
  | { scope: FollowingModelScope; modelId: null };

export interface SetModelSelectionMessage extends MessageEnvelope<SetModelSelectionPayload> {
  type: MessageType.SET_MODEL_SELECTION;
}

export interface ModelDataPayload {
  options: ModelOption[];
  categoryOptions?: ModelOption[];
  /** The model each scope runs on; a following scope with none of its own holds the model it follows. */
  selections: Partial<Record<ModelScope, string>>;
  /**
   * The following scopes with no model of their own right now (Slice 4L).
   * The host always sends it; a message without it leaves what the webview
   * knew unchanged.
   */
  following?: FollowingModelScope[];
  ui?: {
    showTokenWidget?: boolean;
  };
}

export interface ModelDataMessage extends MessageEnvelope<ModelDataPayload> {
  type: MessageType.MODEL_DATA;
}

// ============================================================================
// Settings Messages
// ============================================================================

export interface UpdateSettingPayload {
  /** key under proseMinion.* (e.g., 'maxTokens', 'ui.showTokenWidget') */
  key: string;
  value: string | number | boolean;
}

export interface UpdateSettingMessage extends MessageEnvelope<UpdateSettingPayload> {
  type: MessageType.UPDATE_SETTING;
}

export interface SettingsDataPayload {
  settings: Record<string, string | number | boolean>;
}

export interface SettingsDataMessage extends MessageEnvelope<SettingsDataPayload> {
  type: MessageType.SETTINGS_DATA;
}

// ============================================================================
// Token Usage Messages
// ============================================================================

export type TokenUsageTotals = TokenUsage;

export interface TokenUsageUpdatePayload {
  totals: TokenUsageTotals;
  /**
   * Cost of the single most-recent AI request in USD, surfaced beneath the
   * account balance ("Last request $0.014"). `undefined` when no request has
   * completed this session, after a reset, or when the provider returned no
   * cost for the last call. Distinct from `totals.costUsd` (cumulative).
   */
  lastRequestCostUsd?: number;
}

export interface TokenUsageUpdateMessage extends MessageEnvelope<TokenUsageUpdatePayload> {
  type: MessageType.TOKEN_USAGE_UPDATE;
}

// ============================================================================
// API Key Management Messages
// ============================================================================

export interface ApiKeyStatusPayload {
  hasSavedKey: boolean;
}

export interface ApiKeyStatusMessage extends MessageEnvelope<ApiKeyStatusPayload> {
  type: MessageType.API_KEY_STATUS;
}

export interface UpdateApiKeyPayload {
  apiKey: string;
}

export interface UpdateApiKeyMessage extends MessageEnvelope<UpdateApiKeyPayload> {
  type: MessageType.UPDATE_API_KEY;
}
/** Writer-selected lifetime for retained Claude prompt caches. */
export type ClaudeCacheTtl = '5m' | '1h';

export function coerceClaudeCacheTtl(value: unknown): ClaudeCacheTtl {
  return value === '1h' ? '1h' : '5m';
}
