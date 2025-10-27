/**
 * UI domain messages
 * Tab changes, selections, and guide interactions
 */

import { BaseMessage, MessageType, TabId, SelectionTarget } from './base';

export interface TabChangedMessage extends BaseMessage {
  type: MessageType.TAB_CHANGED;
  tabId: TabId;
}

export interface OpenGuideFileMessage extends BaseMessage {
  type: MessageType.OPEN_GUIDE_FILE;
  guidePath: string;  // Relative path from craft-guides/
}

export interface RequestSelectionMessage extends BaseMessage {
  type: MessageType.REQUEST_SELECTION;
  target: SelectionTarget;
}

export interface SelectionDataMessage extends BaseMessage {
  type: MessageType.SELECTION_DATA;
  target: SelectionTarget;
  content: string;
  sourceUri?: string;
  relativePath?: string;
}

export interface SelectionUpdatedMessage extends BaseMessage {
  type: MessageType.SELECTION_UPDATED;
  text: string;
  sourceUri?: string;
  relativePath?: string;
  target?: 'assistant' | 'dictionary' | 'both';
}

export interface OpenSettingsMessage extends BaseMessage {
  type: MessageType.OPEN_SETTINGS;
}

export interface OpenSettingsToggleMessage extends BaseMessage {
  type: MessageType.OPEN_SETTINGS_TOGGLE;
}

// Webview diagnostics → extension output channel
export interface WebviewErrorMessage extends BaseMessage {
  type: MessageType.WEBVIEW_ERROR;
  message: string;
  details?: string;
}
