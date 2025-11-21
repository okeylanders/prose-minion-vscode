/**
 * UI domain messages
 * Tab changes, selections, and guide interactions
 */

import { MessageEnvelope, MessageType, TabId, SelectionTarget } from './base';

export interface TabChangedPayload {
  tabId: TabId;
}

export interface TabChangedMessage extends MessageEnvelope<TabChangedPayload> {
  type: MessageType.TAB_CHANGED;
}

export interface OpenGuideFilePayload {
  guidePath: string;  // Relative path from craft-guides/
}

export interface OpenGuideFileMessage extends MessageEnvelope<OpenGuideFilePayload> {
  type: MessageType.OPEN_GUIDE_FILE;
}

export interface OpenDocsFilePayload {
  docsPath: string;  // Relative path from docs/
}

export interface OpenDocsFileMessage extends MessageEnvelope<OpenDocsFilePayload> {
  type: MessageType.OPEN_DOCS_FILE;
}

export interface OpenResourcePayload {
  path: string;  // Workspace-relative path to resource file
}

export interface OpenResourceMessage extends MessageEnvelope<OpenResourcePayload> {
  type: MessageType.OPEN_RESOURCE;
}

export interface RequestSelectionPayload {
  target: SelectionTarget;
}

export interface RequestSelectionMessage extends MessageEnvelope<RequestSelectionPayload> {
  type: MessageType.REQUEST_SELECTION;
}

export interface SelectionDataPayload {
  target: SelectionTarget;
  content: string;
  sourceUri?: string;
  relativePath?: string;
}

export interface SelectionDataMessage extends MessageEnvelope<SelectionDataPayload> {
  type: MessageType.SELECTION_DATA;
}

export interface SelectionUpdatedPayload {
  text: string;
  sourceUri?: string;
  relativePath?: string;
  target?: 'assistant' | 'dictionary' | 'both';
}

export interface SelectionUpdatedMessage extends MessageEnvelope<SelectionUpdatedPayload> {
  type: MessageType.SELECTION_UPDATED;
}

export interface OpenSettingsMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.OPEN_SETTINGS;
}

export interface OpenSettingsToggleMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.OPEN_SETTINGS_TOGGLE;
}

// Webview diagnostics → extension output channel
export interface WebviewErrorPayload {
  message: string;
  details?: string;
}

export interface WebviewErrorMessage extends MessageEnvelope<WebviewErrorPayload> {
  type: MessageType.WEBVIEW_ERROR;
}
