import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { DraftEditAnchor } from '@/domain/models/DraftEdit';
import {
  workshopReplyTrailerStructureRejection,
  type WorkshopReplyTrailerFrame,
  type WorkshopReplyTrailerStructureRejection
} from '@/utils/workshopReplyTrailerFrames';

export const WORKSHOP_HIGHLIGHTS_TAG = 'prose-minion-highlights';
export const WORKSHOP_HIGHLIGHTS_REDACTION = '[highlights removed]';

export interface WorkshopHighlightPlace {
  readonly start: DraftEditAnchor;
  readonly end?: DraftEditAnchor;
  readonly note: string;
}

export interface WorkshopHighlightsDraft {
  readonly title: string;
  readonly places: readonly WorkshopHighlightPlace[];
}

type HighlightsRejection = WorkshopReplyTrailerStructureRejection | 'malformed' | 'extra';

export interface WorkshopReplyHighlightsControl {
  readonly set?: WorkshopHighlightsDraft;
  readonly rejections: readonly HighlightsRejection[];
}

const bounds = PROMPT_BUDGETS.workshopHighlights;

function hasOnlyKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key));
}

function boundedText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length <= limit && value.trim().length > 0;
}

function isAnchor(value: unknown): value is DraftEditAnchor {
  return hasOnlyKeys(value, ['quote', 'before', 'after']) &&
    boundedText(value.quote, bounds.quoteCharacters) &&
    (!('before' in value) || boundedText(value.before, bounds.quoteCharacters)) &&
    (!('after' in value) || boundedText(value.after, bounds.quoteCharacters));
}

function isPlace(value: unknown): value is WorkshopHighlightPlace {
  return hasOnlyKeys(value, ['start', 'end', 'note']) &&
    isAnchor(value.start) && (!('end' in value) || isAnchor(value.end)) &&
    boundedText(value.note, bounds.noteCharacters);
}

export function isWorkshopHighlightsDraft(value: unknown): value is WorkshopHighlightsDraft {
  return hasOnlyKeys(value, ['title', 'places']) &&
    boundedText(value.title, bounds.titleCharacters) &&
    Array.isArray(value.places) && value.places.length > 0 &&
    value.places.length <= bounds.placesPerSet && value.places.every(isPlace);
}

/** Allow JSON escaping of every character in each bounded field. */
const maxFrameCharacters = bounds.titleCharacters * 6 + 100 +
  bounds.placesPerSet * ((6 * bounds.quoteCharacters + bounds.noteCharacters) * 6 + 200);

export function decodeWorkshopHighlights(inner: string): WorkshopHighlightsDraft | undefined {
  if (inner.length > maxFrameCharacters) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(inner);
    return isWorkshopHighlightsDraft(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function judgeWorkshopReplyHighlights(
  frames: ReadonlyArray<{ readonly frame: WorkshopReplyTrailerFrame; readonly atTail: boolean }>
): WorkshopReplyHighlightsControl {
  let set: WorkshopHighlightsDraft | undefined;
  const rejections: HighlightsRejection[] = [];
  for (const { frame, atTail } of frames) {
    const structural = workshopReplyTrailerStructureRejection(frame, atTail);
    if (structural) {
      rejections.push(structural);
      continue;
    }
    if (set) {
      rejections.push('extra');
      continue;
    }
    set = decodeWorkshopHighlights(frame.inner ?? '');
    if (!set) {
      rejections.push('malformed');
    }
  }
  return { ...(set ? { set } : {}), rejections };
}
