import type { TextRange } from '@/domain/models/DraftEdit';
import { createQuoteLocator } from '@/utils/draftEdit/anchorEdits';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import type { WorkshopHighlightsDraft, WorkshopHighlightPlace } from '@/utils/workshopReplyHighlights';

type HighlightDrop = 'unanchored' | 'ambiguous' | 'unordered' | 'protected';

export interface WorkshopHighlightPlacement {
  readonly placed: readonly (TextRange & { readonly note: string })[];
  readonly dropped: Readonly<Record<HighlightDrop, number>>;
}

function locate(anchor: ReturnType<typeof createQuoteLocator>, place: WorkshopHighlightPlace): TextRange | HighlightDrop {
  const start = anchor(place.start);
  if (start.kind !== 'anchored') {
    return start.kind;
  }
  if (!place.end) {
    return { start: start.start, end: start.end };
  }
  const end = anchor(place.end);
  if (end.kind !== 'anchored') {
    return end.kind;
  }
  return start.end <= end.start ? { start: start.start, end: end.end } : 'unordered';
}

export function placeWorkshopHighlights(
  text: string,
  languageId: string,
  set: WorkshopHighlightsDraft
): WorkshopHighlightPlacement {
  const anchor = createQuoteLocator(text);
  const regions = findProtectedRegions(text, languageId);
  const placed: Array<TextRange & { note: string }> = [];
  const dropped = { unanchored: 0, ambiguous: 0, unordered: 0, protected: 0 };
  for (const place of set.places) {
    const range = locate(anchor, place);
    if (typeof range === 'string') {
      dropped[range] += 1;
    } else if (regions.some((region) => region.start < range.end && range.start < region.end)) {
      dropped.protected += 1;
    } else {
      placed.push({ ...range, note: place.note });
    }
  }
  return { placed, dropped };
}
