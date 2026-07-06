/**
 * UI domain messages
 * Tab changes, selections, and guide interactions
 */

import { MessageEnvelope, MessageType } from './base';

// ============================================================================
// UI Types
// ============================================================================

export enum TabId {
  ANALYSIS = 'analysis',
  SUGGESTIONS = 'suggestions',
  SEARCH = 'search',
  METRICS = 'metrics',
  UTILITIES = 'utilities'
}

export type SelectionTarget =
  | 'assistant_excerpt'
  | 'assistant_context'
  | 'assistant_excerpt_verify'  // For Ctrl+V paste verification - compares, doesn't overwrite
  | 'dictionary_word'
  | 'dictionary_context';

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
  autoRun?: boolean;
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

/** Longest webview-supplied error text a host log line will carry verbatim. */
export const WEBVIEW_ERROR_TEXT_MAX = 500;

/**
 * The ONE parser for `webview_error` wire traffic (PR #66 review, Oliver +
 * Patricia). Two producer shapes exist by design: React error paths post the
 * full envelope (`payload.message`), while the pre-React bootstrap scripts in
 * webviewHtml.ts post a flat `{ type, message }` because they run before any
 * envelope helper is loaded. Every consumer (UIHandler for the sidebar,
 * WorkshopPanelProvider for the panel) goes through here so the shapes can't
 * fork again.
 *
 * The input crosses the webview IPC boundary, so it is validated as `unknown`
 * — TS annotations on the other side prove nothing at runtime — and the text
 * is flattened (no newline forgery into the log) and length-capped.
 *
 * Returns undefined when the value is not a webview_error or carries no
 * usable text.
 */
export function coerceWebviewErrorText(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const candidate = raw as { type?: unknown; message?: unknown; payload?: { message?: unknown } };
  if (candidate.type !== MessageType.WEBVIEW_ERROR) {
    return undefined;
  }
  const text = typeof candidate.payload?.message === 'string'
    ? candidate.payload.message
    : typeof candidate.message === 'string'
      ? candidate.message
      : undefined;
  if (text === undefined) {
    return undefined;
  }
  const flattened = text.replace(/\s+/g, ' ').trim();
  if (flattened.length === 0) {
    return undefined;
  }
  return flattened.length > WEBVIEW_ERROR_TEXT_MAX
    ? `${flattened.slice(0, WEBVIEW_ERROR_TEXT_MAX)}…`
    : flattened;
}
