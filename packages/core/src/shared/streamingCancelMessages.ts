import {
  CancelAnalysisRequestMessage,
  CancelCategorySearchRequestMessage,
  CancelContextRequestMessage,
  CancelDictionaryRequestMessage,
  CancelWorkshopRequestMessage,
  MessageType,
  StreamingDomain
} from '@messages';

export type CancelRequestMessage =
  | CancelAnalysisRequestMessage
  | CancelDictionaryRequestMessage
  | CancelContextRequestMessage
  | CancelCategorySearchRequestMessage
  | CancelWorkshopRequestMessage;

/**
 * Every streaming domain now has a webview-initiated cancel message. (The
 * Sprint 2 `Exclude<…, 'workshop'>` compile-time gate retired on schedule
 * when Sprint 3 landed the workshop cancel wire.)
 */
export type CancellableStreamingDomain = StreamingDomain;

const cancelMessageTypes: Record<CancellableStreamingDomain, CancelRequestMessage['type']> = {
  analysis: MessageType.CANCEL_ANALYSIS_REQUEST,
  dictionary: MessageType.CANCEL_DICTIONARY_REQUEST,
  context: MessageType.CANCEL_CONTEXT_REQUEST,
  search: MessageType.CANCEL_CATEGORY_SEARCH_REQUEST,
  workshop: MessageType.CANCEL_WORKSHOP_REQUEST
};

export function createCancelRequestMessage(
  domain: CancellableStreamingDomain,
  requestId: string,
  source: string
): CancelRequestMessage {
  // `type` comes from an exhaustive domain map; the cast narrows the union so
  // callers receive the matching cancel-message shape without duplicating cases.
  return {
    type: cancelMessageTypes[domain],
    source,
    payload: {
      requestId,
      domain
    },
    timestamp: Date.now()
  } as CancelRequestMessage;
}
