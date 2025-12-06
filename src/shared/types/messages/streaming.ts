/**
 * Streaming message types and payloads
 * For progressive AI response display with cancellation support
 */

import { TokenUsage } from '../index';
import { MessageType, MessageEnvelope } from './base';

/**
 * Domain types that support streaming
 */
export type StreamingDomain = 'analysis' | 'dictionary' | 'context';

/**
 * Payload for STREAM_CHUNK messages
 * Sent as each token arrives from the streaming API
 */
export interface StreamChunkPayload {
  /** Unique identifier for this request (for correlation) */
  requestId: string;
  /** Domain originating the stream */
  domain: StreamingDomain;
  /** Token content received */
  token: string;
}

/**
 * Payload for STREAM_STARTED messages
 * Sent immediately when a streaming request begins so the UI can enable cancel
 */
export interface StreamStartedPayload {
  /** Unique identifier for this request */
  requestId: string;
  /** Domain originating the stream */
  domain: StreamingDomain;
}

/**
 * Payload for STREAM_COMPLETE messages
 * Sent when streaming finishes (success or abort)
 */
export interface StreamCompletePayload {
  /** Unique identifier for this request */
  requestId: string;
  /** Domain originating the stream */
  domain: StreamingDomain;
  /** Full accumulated content */
  content: string;
  /** Token usage statistics (if available) */
  usage?: TokenUsage;
  /** Whether the stream was cancelled */
  cancelled?: boolean;
  /** Whether the response was truncated due to max token limit */
  truncated?: boolean;
}

/**
 * Payload for cancel messages
 * Sent from webview to cancel an in-progress streaming request
 */
export interface CancelRequestPayload {
  /** Unique identifier for the request to cancel */
  requestId: string;
  /** Domain of the request to cancel */
  domain: StreamingDomain;
}

/**
 * Message types for streaming
 */
export interface StreamStartedMessage extends MessageEnvelope<StreamStartedPayload> {
  type: MessageType.STREAM_STARTED;
}

export interface StreamChunkMessage extends MessageEnvelope<StreamChunkPayload> {
  type: MessageType.STREAM_CHUNK;
}

export interface StreamCompleteMessage extends MessageEnvelope<StreamCompletePayload> {
  type: MessageType.STREAM_COMPLETE;
}

export interface CancelAnalysisRequestMessage extends MessageEnvelope<CancelRequestPayload> {
  type: MessageType.CANCEL_ANALYSIS_REQUEST;
}

export interface CancelDictionaryRequestMessage extends MessageEnvelope<CancelRequestPayload> {
  type: MessageType.CANCEL_DICTIONARY_REQUEST;
}

export interface CancelContextRequestMessage extends MessageEnvelope<CancelRequestPayload> {
  type: MessageType.CANCEL_CONTEXT_REQUEST;
}
