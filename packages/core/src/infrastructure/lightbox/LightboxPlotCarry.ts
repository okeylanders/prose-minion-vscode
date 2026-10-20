/**
 * How group E's readings are carried onto changed text (ADR 2026-10-19 D4;
 * Slice 4C). Pure: no host, no I/O. Used by `LightboxStaleReadings`, which
 * holds every carried tile to the gates a fresh read meets
 * (`LightboxTileGates`, `LightboxPlotGates`). Nothing positional is carried
 * by position: every place below comes from where the host finds a quote on
 * the current text.
 *
 * - **Movements**, as a set: each boundary quote is found again (where it
 *   stood, or where its words now stand); each movement starts where its
 *   boundary now stands and ends the paragraph before the next one's, the
 *   last at the final paragraph; the set is checked again as a whole, in its
 *   own order, and withheld whole ("Movements") when it no longer tiles the
 *   chapter. No old range is projected onto changed paragraphs.
 * - **Engagement** follows its movements by host id: kept while the set
 *   stands, and withheld with it ("Engagement") when it does not.
 * - **A pressure thread**: each quote found again; an escalation that is
 *   gone is dropped, a plant or a resolution that is gone withholds the
 *   thread; the order is checked again, and the span recomputed from where
 *   its quotes now stand.
 * - **An artifact**: its terms recounted (mentions and first paragraph
 *   again), each step found again and the arc held to paragraph order
 *   again, and its "planted, unused" checked against the new counts.
 * - The template, its beats and the synopsis carry their quotes as every
 *   reading does; the freshness reading is kept as read, stale-labelled.
 */

import type {
  LightboxArtifactStep,
  LightboxEngagementMark,
  LightboxMovementTile,
  LightboxReadingTile,
  LightboxVerifiedQuote,
  LightboxWithheldClaim,
  LightboxWithheldQuote
} from '@messages';
import type { LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import type { LightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { recheckLightboxQuote, type LightboxCarriedCraft } from '@/infrastructure/lightbox/LightboxCarryQuotes';
import {
  LIGHTBOX_PLOT_GATE_REASONS,
  lightboxMovementSetGate,
  type LightboxThreadCandidate
} from '@/infrastructure/lightbox/LightboxPlotGates';
import {
  LIGHTBOX_PLOT_TITLES,
  lightboxArcLine,
  lightboxArtifactArc,
  lightboxArtifactCount,
  lightboxArtifactUnused,
  lightboxRange,
  lightboxThreadEvidence,
  lightboxThreadSpan
} from '@/infrastructure/lightbox/LightboxPlotTiles';

/** A group E tile's quotes on the changed text, the fields that follow from them, and what its gate needs. */
export interface LightboxCarriedPlot extends LightboxCarriedCraft {
  /** A thread's quotes as found, for its gate. */
  thread?: LightboxThreadCandidate;
  /** Its paragraphs, when they are not its quotes' (a thread's span). */
  paragraphs?: number[];
}

export type LightboxCarriedMovements =
  | { ok: true; tiles: LightboxMovementTile[]; lost: number }
  | { ok: false; withheld: LightboxWithheldClaim; lost: number };

/** A group's movements, carried as one set onto the current text. */
export function carryLightboxMovements(
  movements: readonly LightboxMovementTile[],
  verifier: LightboxQuoteVerifier
): LightboxCarriedMovements {
  const ordered = [...movements].sort((a, b) => a.ordinal - b.ordinal);
  const found = ordered.map((movement) =>
    recheckLightboxQuote(movement.boundary, (paragraph, text) => verifier.verify(paragraph, text)));
  const boundaries = found.map((result) => ('quote' in result ? result.quote : undefined));
  const last = verifier.paragraphCount;
  const ranges = ordered.map((_movement, index) => ({
    from: boundaries[index]?.paragraph ?? 0,
    to: index + 1 < ordered.length ? (boundaries[index + 1]?.paragraph ?? 0) - 1 : last
  }));
  const lostQuotes: LightboxWithheldQuote[] = ordered.flatMap((movement, index) => {
    const result = found[index];
    return 'reason' in result ? [{ paragraph: movement.boundary.paragraph, reason: result.reason }] : [];
  });
  const verdict = lightboxMovementSetGate(
    ordered.map((_movement, index) => ({ ...ranges[index], boundary: boundaries[index] })),
    last,
    'carried'
  );
  if (!verdict.ok) {
    return {
      ok: false,
      withheld: { kind: 'movement', lens: 'summary', title: LIGHTBOX_PLOT_TITLES.movements, reason: verdict.reason, quotes: lostQuotes },
      lost: lostQuotes.length
    };
  }
  return {
    ok: true,
    tiles: ordered.map((movement, index) => {
      const boundary = boundaries[index] as LightboxVerifiedQuote;
      return { ...movement, ...ranges[index], boundary, evidence: [boundary], paragraphs: lightboxRange(ranges[index]) };
    }),
    lost: 0
  };
}

/**
 * A carried template's engagement: its marks while every movement they sit
 * on still stands, or none, with the claim that says why.
 */
export function carryLightboxEngagement(
  marks: readonly LightboxEngagementMark[],
  standing: ReadonlySet<string>
): { engagement: LightboxEngagementMark[]; withheld?: LightboxWithheldClaim } {
  if (marks.length === 0) {
    return { engagement: [] };
  }
  if (marks.every((mark) => standing.has(mark.movementId))) {
    return { engagement: marks.map((mark) => ({ ...mark })) };
  }
  return {
    engagement: [],
    withheld: {
      kind: 'template',
      lens: 'template',
      title: LIGHTBOX_PLOT_TITLES.engagement,
      reason: LIGHTBOX_PLOT_GATE_REASONS.engagementNoMovements.carried,
      quotes: []
    }
  };
}

/** Carry a pressure thread or an artifact by its own rules; undefined for any other kind. */
export function carryLightboxPlotEvidence(
  tile: LightboxReadingTile,
  verifier: LightboxQuoteVerifier,
  counter: LightboxTermCounter
): LightboxCarriedPlot | undefined {
  const again = (quote: LightboxVerifiedQuote) => recheckLightboxQuote(quote, (paragraph, text) => verifier.verify(paragraph, text));
  const lost: LightboxWithheldQuote[] = [];
  const keep = (quote: LightboxVerifiedQuote): LightboxVerifiedQuote | undefined => {
    const result = again(quote);
    if ('quote' in result) {
      return result.quote;
    }
    lost.push({ paragraph: quote.paragraph, reason: result.reason });
    return undefined;
  };
  switch (tile.kind) {
    case 'pressure-thread': {
      const planted = keep(tile.planted) ?? null;
      const escalations = tile.escalations.map(keep).filter((quote): quote is LightboxVerifiedQuote => quote !== undefined);
      const resolution = tile.resolution ? keep(tile.resolution) : undefined;
      const span = planted ? lightboxThreadSpan(planted, resolution ?? null, verifier.paragraphCount) : tile.span;
      return {
        evidence: lightboxThreadEvidence(planted, escalations, resolution ?? null),
        lost,
        thread: {
          planted,
          escalations,
          resolution: !tile.resolution ? { state: 'open' } : resolution ? { state: 'found', quote: resolution } : { state: 'gone' }
        },
        patch: { ...(planted ? { planted } : {}), escalations, resolution: resolution ?? null, span } as Partial<LightboxReadingTile>,
        paragraphs: lightboxRange(span)
      };
    }
    case 'artifact': {
      const counted = lightboxArtifactCount(tile.support.map((term) => term.term), counter, verifier.paragraphCount);
      const steps = tile.arc.map((step): LightboxArtifactStep | undefined => {
        const quote = keep(step.quote);
        return quote ? { step: step.step, quote } : undefined;
      });
      const arc = lightboxArtifactArc(steps);
      // The reading's flag, whether or not a fresh read kept it.
      const read = tile.plantedUnused || tile.unusedWithheld !== undefined;
      return {
        evidence: arc.kept.map((step) => step.quote),
        lost: [...lost, ...arc.withheld],
        patch: {
          claim: lightboxArcLine(arc.kept),
          mentions: counted.mentions,
          firstParagraph: counted.firstParagraph,
          arc: arc.kept,
          // Cleared unless the new counts withhold the flag again (`LightboxStaleReadings` drops it when unset).
          unusedWithheld: undefined,
          ...lightboxArtifactUnused(read, counted, arc.kept)
        } as Partial<LightboxReadingTile>
      };
    }
    default:
      return undefined;
  }
}
