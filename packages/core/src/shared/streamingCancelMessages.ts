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

const cancelMessageTypes: Record<StreamingDomain, CancelRequestMessage['type']> = {
  analysis: MessageType.CANCEL_ANALYSIS_REQUEST,
  dictionary: MessageType.CANCEL_DICTIONARY_REQUEST,
  context: MessageType.CANCEL_CONTEXT_REQUEST,
  search: MessageType.CANCEL_CATEGORY_SEARCH_REQUEST
};

export function createCancelRequestMessage(
  domain: StreamingDomain,
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
