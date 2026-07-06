import {
  CancelAnalysisRequestMessage,
  CancelCategorySearchRequestMessage,
  CancelContextRequestMessage,
  CancelDictionaryRequestMessage,
  MessageType,
  StreamingDomain
} from '@messages';

export type CancelRequestMessage =
  | CancelAnalysisRequestMessage
  | CancelDictionaryRequestMessage
  | CancelContextRequestMessage
  | CancelCategorySearchRequestMessage;

/**
 * Domains with a webview-initiated cancel message. `workshop` streams have no
 * cancel wire yet — the host self-preempts on re-run/reset (Sprint 2); a UI
 * cancel affordance arrives with the composer work. Excluding it here makes
 * that a compile error instead of a silently ignored message.
 */
export type CancellableStreamingDomain = Exclude<StreamingDomain, 'workshop'>;

const cancelMessageTypes: Record<CancellableStreamingDomain, CancelRequestMessage['type']> = {
  analysis: MessageType.CANCEL_ANALYSIS_REQUEST,
  dictionary: MessageType.CANCEL_DICTIONARY_REQUEST,
  context: MessageType.CANCEL_CONTEXT_REQUEST,
  search: MessageType.CANCEL_CATEGORY_SEARCH_REQUEST
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
