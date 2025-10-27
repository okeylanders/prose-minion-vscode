/**
 * Configuration domain messages
 * Settings, model selection, and token tracking
 */

import { BaseMessage, MessageType, ModelScope, ModelOption, TokenUsage } from './base';

export interface RequestModelDataMessage extends BaseMessage {
  type: MessageType.REQUEST_MODEL_DATA;
}

export interface SetModelSelectionMessage extends BaseMessage {
  type: MessageType.SET_MODEL_SELECTION;
  scope: ModelScope;
  modelId: string;
}

export interface ModelDataMessage extends BaseMessage {
  type: MessageType.MODEL_DATA;
  options: ModelOption[];
  selections: Partial<Record<ModelScope, string>>;
  ui?: {
    showTokenWidget?: boolean;
  };
}

export interface RequestSettingsDataMessage extends BaseMessage {
  type: MessageType.REQUEST_SETTINGS_DATA;
}

export interface UpdateSettingMessage extends BaseMessage {
  type: MessageType.UPDATE_SETTING;
  key: string; // key under proseMinion.* (e.g., 'maxTokens', 'ui.showTokenWidget')
  value: string | number | boolean;
}

export interface SettingsDataMessage extends BaseMessage {
  type: MessageType.SETTINGS_DATA;
  settings: Record<string, string | number | boolean>;
}

export type TokenUsageTotals = TokenUsage;

export interface TokenUsageUpdateMessage extends BaseMessage {
  type: MessageType.TOKEN_USAGE_UPDATE;
  totals: TokenUsageTotals;
}

export interface ResetTokenUsageMessage extends BaseMessage {
  type: MessageType.RESET_TOKEN_USAGE;
}
