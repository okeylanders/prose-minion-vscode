/**
 * Single owners for deterministic Show vs. Tell identities and comparisons.
 *
 * The response codec, persisted integrity, and the artifact projection all
 * derive from these, so a rule cannot drift between generation and reopen.
 */

import type {
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

/**
 * A direction is an abstraction of its prose, so it must be strictly shorter.
 * Both sides are measured trimmed, in the same UTF-16 units as the artifact.
 */
export function isShowVsTellDirectionShorterThanProse(
  direction: string,
  prose: string
): boolean {
  return direction.trim().length < prose.trim().length;
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

/** Identity of a surrounding-passage source, for duplicate and order checks. */
export function showVsTellSourceReferenceKey(reference: WorkshopWidgetSourceReference): string {
  return reference.kind === 'active-excerpt'
    ? reference.kind
    : `${reference.kind}:${reference.attachmentId}`;
}
