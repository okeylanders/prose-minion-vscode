/**
 * Single owners for deterministic Show vs. Tell identities and comparisons.
 *
 * The response codec, persisted integrity, and the artifact projection all
 * derive from these, so a rule cannot drift between generation and reopen.
 */

import {
  SHOW_VS_TELL_ARTIFACT_LINE_KEYS,
  type WorkshopShowVsTellDraft,
  WorkshopShowVsTellVariant,
  WorkshopShowVsTellWorkup,
  WorkshopWidgetSourceReference
} from '@messages';
import type { NarrativeHandlingPosition } from '@shared/constants/narrativeHandlingVocabulary';
import {
  SHOW_VS_TELL_POSITIONS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';

const COMPARISON_TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
/**
 * U+02BC is a Unicode letter, so unfolded it would stay inside a token while
 * every other apostrophe splits one. Fold the same variants as Creative
 * Variations so "hadn’t" and "hadnʼt" compare equal.
 */
const APOSTROPHE_VARIANTS = /[\u2018\u2019\u02bc]/g;

/** `workupOrdinal` is one-based across all groups, in workup order. */
export function showVsTellVariantId(workupId: string, workupOrdinal: number): string {
  return `${workupId}:variant-${workupOrdinal}`;
}

export function showVsTellFlagId(variantId: string, flagOrdinal: number): string {
  return `${variantId}:flag-${flagOrdinal}`;
}

/** Every variant in workup order: group order first, then order within the group. */
export function showVsTellWorkupVariants(
  workup: WorkshopShowVsTellWorkup
): WorkshopShowVsTellVariant[] {
  return workup.groups.flatMap((group) => group.variants);
}

/** What one line break (`\r\n`, `\r`, `\n`, U+2028, U+2029) becomes inside an artifact value. */
export const SHOW_VS_TELL_ARTIFACT_LINE_BREAK = '\u21b5';

const LINE_BREAK_SEQUENCE = /\r\n|[\r\n\u2028\u2029]/gu;

/**
 * Trims a value and replaces each line-break sequence with one `↵`. The
 * artifact is line-keyed, so a multi-line value must stay on its own line, and
 * a one-for-one replacement never lengthens a value (`\r\n` shrinks by one),
 * which keeps the frozen 585 ≤ 600 fit guarantee true for any content.
 *
 * This is the single encoder: the projection writes values with it, so what
 * the meter shows is what the host counts.
 */
export function encodeShowVsTellArtifactValue(value: string): string {
  return value.trim().replace(LINE_BREAK_SEQUENCE, SHOW_VS_TELL_ARTIFACT_LINE_BREAK);
}

/**
 * Key for the exact-normalized-duplicate rule: two variants whose prose has
 * the same NFKC-folded, lowercased, apostrophe-folded letter and number
 * tokens are one variant.
 */
export function showVsTellProseComparisonKey(prose: string): string {
  return (
    prose
      .normalize('NFKC')
      .toLowerCase()
      .replace(APOSTROPHE_VARIANTS, "'")
      .match(COMPARISON_TOKEN_PATTERN) ?? []
  ).join(' ');
}

/** The value of the artifact's `position:` line, e.g. `hinge · tell the bridge, show the fulcrum`. */
export function showVsTellPositionArtifactValue(position: NarrativeHandlingPosition): string {
  const descriptor = SHOW_VS_TELL_POSITIONS.find((candidate) => candidate.id === position);
  if (!descriptor) {
    throw new Error(`Unknown Show vs. Tell position: ${String(position)}`);
  }
  return `${descriptor.name.toLowerCase()} · ${descriptor.subtitle}`;
}

/**
 * Deterministic word count for the card's `N w` label. The model never
 * supplies it: it is whitespace-separated runs of the trimmed prose, and a
 * blank string has zero words.
 */
export function showVsTellWordCount(prose: string): number {
  const trimmed = prose.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
}

/** Identity of a context source, for duplicate and order checks. */
export function showVsTellSourceReferenceKey(reference: WorkshopWidgetSourceReference): string {
  return reference.kind === 'active-excerpt'
    ? reference.kind
    : `${reference.kind}:${reference.attachmentId}`;
}

/**
 * Canonical order of context sources (D2): the active excerpt first, then
 * context attachments by ascending `ctx-N` ordinal. A selection is a set, so
 * one order gives it one persisted representation whatever the writer or a
 * persona clicked or listed first. Integrity rejects any other order; the
 * controller and the recommendation parser sort with this comparator.
 */
export function compareShowVsTellSourceReferences(
  left: WorkshopWidgetSourceReference,
  right: WorkshopWidgetSourceReference
): number {
  if (left.kind !== right.kind) {
    return left.kind === 'active-excerpt' ? -1 : 1;
  }
  if (left.kind === 'active-excerpt' || right.kind === 'active-excerpt') {
    return 0;
  }
  return attachmentOrdinal(left.attachmentId) - attachmentOrdinal(right.attachmentId);
}

/** A new array in canonical order; the input is never mutated. */
export function sortShowVsTellSourceReferences(
  references: readonly WorkshopWidgetSourceReference[]
): WorkshopWidgetSourceReference[] {
  return [...references].sort(compareShowVsTellSourceReferences);
}

/** The N of a `ctx-N` id; a malformed id (rejected by the shape gate) sorts last. */
function attachmentOrdinal(attachmentId: string): number {
  const ordinal = Number(attachmentId.slice('ctx-'.length));
  return Number.isSafeInteger(ordinal) ? ordinal : Number.MAX_SAFE_INTEGER;
}

/** The authored inputs of one generation attempt; a workup and its selections are outputs. */
export type ShowVsTellGenerationInput = Pick<
  WorkshopShowVsTellDraft,
  'beat' | 'surroundingContext' | 'pov' | 'invariants' | 'channels' | 'lengthBudget' | 'position'
>;

/**
 * The transient draft a generation request validates against. Running the
 * persisted shape and integrity gates on it means a request the host spends
 * money on is one the writer could also have saved.
 */
export function showVsTellGenerationDraft(
  input: ShowVsTellGenerationInput
): WorkshopShowVsTellDraft {
  return {
    beat: { text: input.beat.text, provenance: { ...input.beat.provenance } },
    surroundingContext: {
      writerText: input.surroundingContext.writerText,
      sourceReferences: input.surroundingContext.sourceReferences.map(
        (reference) => ({ ...reference })
      )
    },
    pov: { ...input.pov },
    invariants: { ...input.invariants },
    channels: [...input.channels],
    lengthBudget: input.lengthBudget,
    position: input.position,
    workup: null,
    kept: [],
    note: ''
  };
}
