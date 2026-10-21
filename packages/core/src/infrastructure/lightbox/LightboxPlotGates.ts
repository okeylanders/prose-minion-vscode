/**
 * Group E's acceptance rules (ADR 2026-10-19 D4, D7; Slice 4C). Pure: no
 * host, no I/O. Applied by fresh assembly (`LightboxPlotTiles`) and by stale
 * carry (`LightboxPlotCarry`) alike, after each has found the quotes on the
 * current text, through `LightboxTileGates` for single tiles and directly for
 * the rules over a set; only a reason's tense differs by phase:
 * - **A synopsis** stands on at least two found quotes.
 * - **A pressure thread** needs its planted quote found; a resolution it
 *   gives must be found too (a thread is never shown open because its
 *   resolution was lost); and its quotes stand in paragraph order: planted,
 *   then each escalation, then the resolution, never earlier than the one
 *   before. Order is paragraph order; two quotes in one paragraph are in
 *   order whichever stands first in it (the limit, stated).
 * - **An artifact** is counted at least once (one of its terms is in the
 *   chapter) and keeps at least one found step. Its steps keep paragraph
 *   order: a step that stands before the step it follows is withheld by its
 *   position, and the arc keeps the rest. Its "planted, unused" is kept only
 *   when every mention and every step stands within `LIGHTBOX_UNUSED_REACH`
 *   paragraphs after its first; "unused" means exactly that here.
 * - **The movements**, as a set: every boundary found in its movement's
 *   first paragraph, the first starting at ¶1, each starting the paragraph
 *   after the one before ends (no gap, no overlap), the last ending at the
 *   final paragraph. A set that breaks a rule is withheld whole, by the rule
 *   it broke; so is a set holding a movement that broke the format.
 * - **Engagement** gives exactly one level per drawn movement, each naming a
 *   movement the same response drew; otherwise it is withheld whole, and it
 *   is never guessed. Carried, it follows its movements by host id and goes
 *   with them.
 * Every reason is host-owned: none echoes a model's names or words.
 */

import type { LightboxEngagementMark, LightboxVerifiedQuote } from '@messages';
import { LIGHTBOX_UNUSED_REACH } from '@shared/constants/lightboxPlot';
import {
  LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES,
  lightboxMovementKey,
  type LightboxDecodedEngagement
} from '@/infrastructure/lightbox/LightboxPlotWire';

type Phase = 'fresh' | 'carried';
type Verdict = { ok: true } | { ok: false; reason: string };

export const LIGHTBOX_PLOT_GATE_REASONS = {
  synopsisTooFew: {
    fresh: `Fewer than ${LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES} of its quotes were found in the paragraphs they named.`,
    carried: `Fewer than ${LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES} of its quotes are still in the chapter.`
  },
  plantGone: {
    fresh: 'Its planted quote was not found in the paragraph it named.',
    carried: 'Its planted quote is no longer in the chapter.'
  },
  resolutionGone: {
    fresh: 'Its resolution was not found in the paragraph it named, so the board cannot show it resolved.',
    carried: 'Its resolution is no longer in the chapter, so the board cannot show it resolved.'
  },
  threadOrder: {
    fresh: 'Its quotes do not stand in paragraph order: planted, then each escalation, then the resolution.',
    carried: 'Its quotes no longer stand in paragraph order: planted, then each escalation, then the resolution.'
  },
  artifactUncounted: {
    fresh: 'None of the terms it names is in the chapter.',
    carried: 'None of the terms it names is still in the chapter.'
  },
  stepOutOfOrder: 'It stands before the step it follows, so the arc no longer runs in paragraph order.',
  unusedFar: `Not shown: the object is mentioned, or changes, more than ${LIGHTBOX_UNUSED_REACH} paragraphs after its first, so it is not unused.`,
  movementMalformed: 'A movement broke the format, so the movements no longer tile the chapter.',
  boundaryGone: {
    fresh: 'A movement\'s boundary quote was not found, so the movements cannot tile the chapter.',
    carried: 'A movement\'s boundary quote is no longer in the chapter, so the movements no longer tile it.'
  },
  boundaryNotFirst: 'A movement\'s boundary quote was not found in its first paragraph.',
  notFromStart: {
    fresh: 'The movements do not start at ¶1.',
    carried: 'The first movement\'s boundary no longer stands in ¶1, so the movements leave the opening uncovered.'
  },
  emptyRange: {
    fresh: 'A movement ends before it starts.',
    carried: 'Two movements\' boundaries now stand out of order, or in one paragraph, so the movements no longer tile the chapter.'
  },
  overlap: 'Two movements overlap.',
  gap: 'The movements leave a gap: one does not start the paragraph after the one before ends.',
  notToEnd: 'The last movement does not end at the final paragraph.',
  engagementNoMovements: {
    fresh: 'Engagement sits on the movements, and this reading drew none on the board.',
    carried: 'Engagement sat on the movements, which no longer tile the chapter.'
  },
  engagementNotRead: 'Engagement names movements, but the movements were not read in this call.',
  engagementUnknown: 'An engagement entry names a movement this reading did not draw.',
  engagementNotOne: 'Engagement must give each movement exactly one level, and it does not.'
} as const;

// ---------------------------------------------------------------------------
// Single tiles (through `lightboxTileGate`)
// ---------------------------------------------------------------------------

/** A thread's quotes as found: the resolution `open` (none given), found, or `gone`. */
export interface LightboxThreadCandidate {
  planted: LightboxVerifiedQuote | null;
  /** Only those found. */
  escalations: readonly LightboxVerifiedQuote[];
  resolution: { state: 'open' } | { state: 'found'; quote: LightboxVerifiedQuote } | { state: 'gone' };
}

export function lightboxThreadGate(thread: LightboxThreadCandidate, phase: Phase): Verdict {
  if (!thread.planted) {
    return { ok: false, reason: LIGHTBOX_PLOT_GATE_REASONS.plantGone[phase] };
  }
  if (thread.resolution.state === 'gone') {
    return { ok: false, reason: LIGHTBOX_PLOT_GATE_REASONS.resolutionGone[phase] };
  }
  const sequence = [
    thread.planted,
    ...thread.escalations,
    ...(thread.resolution.state === 'found' ? [thread.resolution.quote] : [])
  ];
  const ordered = sequence.every((quote, index) => index === 0 || quote.paragraph >= sequence[index - 1].paragraph);
  return ordered ? { ok: true } : { ok: false, reason: LIGHTBOX_PLOT_GATE_REASONS.threadOrder[phase] };
}

export function lightboxSynopsisGate(found: number, phase: Phase): Verdict {
  return found >= LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES
    ? { ok: true }
    : { ok: false, reason: LIGHTBOX_PLOT_GATE_REASONS.synopsisTooFew[phase] };
}

/** The steps kept in paragraph order, and the positions (from 0) withheld for breaking it. */
export function lightboxArcInOrder<T extends { quote: LightboxVerifiedQuote }>(
  steps: ReadonlyArray<T | undefined>
): { kept: T[]; outOfOrder: number[] } {
  const kept: T[] = [];
  const outOfOrder: number[] = [];
  steps.forEach((step, index) => {
    if (!step) {
      return;
    }
    const last = kept[kept.length - 1];
    if (last && step.quote.paragraph < last.quote.paragraph) {
      outOfOrder.push(index);
      return;
    }
    kept.push(step);
  });
  return { kept, outOfOrder };
}

/**
 * Whether a read "planted, unused" stands: every mention and step within
 * `LIGHTBOX_UNUSED_REACH` paragraphs after the object's first; the host's
 * reason when it does not.
 */
export function lightboxUnusedCheck(
  firstParagraph: number,
  paragraphs: readonly number[]
): { kept: true } | { kept: false; reason: string } {
  return paragraphs.every((paragraph) => paragraph <= firstParagraph + LIGHTBOX_UNUSED_REACH)
    ? { kept: true }
    : { kept: false, reason: LIGHTBOX_PLOT_GATE_REASONS.unusedFar };
}

// ---------------------------------------------------------------------------
// The movements, as a set
// ---------------------------------------------------------------------------

/** One movement as the set gate sees it: its range on the current text, and its boundary as found (or not). */
export interface LightboxMovementCandidate {
  from: number;
  to: number;
  boundary: LightboxVerifiedQuote | undefined;
}

/**
 * Whether the movements tile the chapter, in the order given: fresh, sorted
 * by where the reading says each starts; carried, in the set's own order,
 * each starting where its boundary now stands, so text moved out of order
 * fails rather than being tiled anew.
 */
export function lightboxMovementSetGate(
  movements: readonly LightboxMovementCandidate[],
  paragraphCount: number,
  phase: Phase,
  malformed = 0
): Verdict {
  const R = LIGHTBOX_PLOT_GATE_REASONS;
  const refuse = (reason: string): Verdict => ({ ok: false, reason });
  if (malformed > 0 || movements.length === 0) {
    return refuse(R.movementMalformed);
  }
  if (movements.some((movement) => movement.boundary === undefined)) {
    return refuse(R.boundaryGone[phase]);
  }
  if (movements.some((movement) => movement.boundary?.paragraph !== movement.from)) {
    return refuse(R.boundaryNotFirst);
  }
  if (movements[0].from !== 1) {
    return refuse(R.notFromStart[phase]);
  }
  for (let index = 0; index < movements.length; index++) {
    const movement = movements[index];
    const previous = movements[index - 1];
    if (movement.to < movement.from) {
      return refuse(R.emptyRange[phase]);
    }
    if (previous && movement.from <= previous.to) {
      return refuse(R.overlap);
    }
    if (previous && movement.from > previous.to + 1) {
      return refuse(R.gap);
    }
  }
  return movements[movements.length - 1].to === paragraphCount ? { ok: true } : refuse(R.notToEnd);
}

// ---------------------------------------------------------------------------
// Engagement
// ---------------------------------------------------------------------------

/**
 * A fresh reading's engagement on the movements drawn from the same
 * response: exactly one entry per movement, each naming one by the
 * response's own key, or withheld whole. `movements` holds each drawn
 * movement's key and host id, in order; `undefined` when the summary was not
 * read in this call.
 */
export function lightboxEngagementJoin(
  entries: readonly LightboxDecodedEngagement[],
  movements: ReadonlyArray<{ key: string; tileId: string }> | undefined
): { ok: true; marks: LightboxEngagementMark[] } | { ok: false; reason: string } {
  const R = LIGHTBOX_PLOT_GATE_REASONS;
  if (!movements) {
    return entries.length === 0 ? { ok: true, marks: [] } : { ok: false, reason: R.engagementNotRead };
  }
  if (movements.length === 0) {
    return entries.length === 0 ? { ok: true, marks: [] } : { ok: false, reason: R.engagementNoMovements.fresh };
  }
  const byKey = new Map(movements.map((movement) => [movement.key, movement.tileId]));
  const levels = new Map<string, LightboxEngagementMark['level']>();
  for (const entry of entries) {
    const tileId = byKey.get(lightboxMovementKey(entry.movement));
    if (!tileId) {
      return { ok: false, reason: R.engagementUnknown };
    }
    if (levels.has(tileId)) {
      return { ok: false, reason: R.engagementNotOne };
    }
    levels.set(tileId, entry.level);
  }
  if (levels.size !== movements.length) {
    return { ok: false, reason: R.engagementNotOne };
  }
  return { ok: true, marks: movements.map(({ tileId }) => ({ movementId: tileId, level: levels.get(tileId) as LightboxEngagementMark['level'] })) };
}
