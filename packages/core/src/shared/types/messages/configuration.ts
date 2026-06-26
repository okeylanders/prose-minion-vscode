/**
 * Configuration domain messages
 * Settings, model selection, and token tracking
 */

import { MessageEnvelope, MessageType } from './base';
import { TokenUsage } from './tokenUsage';

// ============================================================================
// Model Configuration Types
// ============================================================================

export type ModelScope = 'assistant' | 'dictionary' | 'context' | 'category';

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

export interface SetModelSelectionPayload {
  scope: ModelScope;
  modelId: string;
}

export interface SetModelSelectionMessage extends MessageEnvelope<SetModelSelectionPayload> {
  type: MessageType.SET_MODEL_SELECTION;
}

export interface ModelDataPayload {
  options: ModelOption[];
  categoryOptions?: ModelOption[];
  selections: Partial<Record<ModelScope, string>>;
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
