/** Single owners for deterministic Creative Variations identities and request drafts. */

import type {
  WorkshopCreativeVariationsDraft,
  WorkshopWidgetSourceReference
} from '@messages';

type CreativeVariationsGenerationDraftInput = Pick<
  WorkshopCreativeVariationsDraft,
  'subject' | 'surroundingContext' | 'invariants' | 'intent' | 'requestedCount'
>;

export function creativeVariationsGenerationDraft(
  input: CreativeVariationsGenerationDraftInput
): WorkshopCreativeVariationsDraft {
  return {
    subject: input.subject,
    surroundingContext: input.surroundingContext,
    invariants: input.invariants,
    intent: input.intent,
    requestedCount: input.requestedCount,
    workup: null,
    selections: [],
    note: ''
  };
}

export function creativeVariationsSourceReferenceKey(
  reference: WorkshopWidgetSourceReference
): string {
  switch (reference.kind) {
    case 'active-excerpt':
      return 'active-excerpt';
    case 'context-attachment':
      return `context-attachment:${reference.attachmentId}`;
    default:
      return assertNever(reference);
  }
}

export function creativeVariationsFlagId(
  workupId: string,
  cardPosition: number,
  flagOrdinal: number
): string {
  return `${workupId}:card-${cardPosition}:flag-${flagOrdinal}`;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Creative Variations derivation input: ${String(value)}`);
}
