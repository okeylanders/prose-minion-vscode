/**
 * From decoded group E blocks to board tiles (ADR 2026-10-19 D7 and its
 * 2026-10-20 addendum; Slice 4C). Pure: no host, no I/O. Driven by
 * `LightboxReadingTiles`, one instance per group, through its claim
 * assembler: every claim is checked by the verifier against the paragraph it
 * names, a claim with no found quote is withheld by title, each kind's gate
 * (`LightboxTileGates`, `LightboxPlotGates`) is the one stale carry applies,
 * and ids are minted per run.
 *
 * - **Template.** The template is one tile (its name, description and
 *   quotes, with the freshness reading); each beat is a tile, titled by its
 *   stance, the host's word. Engagement is
 *   joined in `finish`, once the summary is assembled: it must give exactly
 *   one level to each movement drawn from the same response, or it is
 *   withheld whole ("Engagement"); with the summary not read in the call it
 *   must be empty.
 * - **Pressure.** A thread's quotes are checked once, in order; the gate
 *   needs its plant, its resolution when it gives one, and paragraph order.
 *   An escalation not found is dropped and named among the withheld quotes.
 *   The host computes its span, which is also its paragraphs.
 * - **Artifacts.** Its terms are counted with the gravity lens's counter
 *   (every occurrence once, under the longest term), which gives its
 *   mentions and first paragraph. Its arc keeps the found steps in paragraph
 *   order; a step that breaks the order is withheld by its position. Its
 *   "planted, unused" is kept only when the host's counts bear it out.
 * - **Summary.** The synopsis needs two found quotes. The movements are
 *   checked as a set (`lightboxMovementSetGate`), sorted by where each says
 *   it starts: drawn as one tile each, numbered in order, or withheld whole
 *   ("Movements") with the rule they broke.
 */

import type {
  LightboxArtifactStep,
  LightboxCountedSupport,
  LightboxLensId,
  LightboxMovementTile,
  LightboxParagraphSpan,
  LightboxTemplateTile,
  LightboxVerifiedQuote,
  LightboxWithheldQuote
} from '@messages';
import { LIGHTBOX_TEMPLATE_STANCE_LABELS } from '@shared/constants/lightboxPlot';
import type { LightboxClaimAssembler } from '@/infrastructure/lightbox/LightboxReadingTiles';
import type { LightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { countLightboxField } from '@/infrastructure/lightbox/LightboxGravityCounts';
import {
  lightboxArcInOrder,
  lightboxEngagementJoin,
  lightboxMovementSetGate,
  lightboxUnusedCheck
} from '@/infrastructure/lightbox/LightboxPlotGates';
import {
  lightboxMovementKey,
  type LightboxDecodedArtifactsBlock,
  type LightboxDecodedEngagement,
  type LightboxDecodedPressureBlock,
  type LightboxDecodedSummaryBlock,
  type LightboxDecodedTemplateBlock
} from '@/infrastructure/lightbox/LightboxPlotWire';

/** Host titles for what a reading has no title of its own for. */
export const LIGHTBOX_PLOT_TITLES = {
  synopsis: 'Synopsis',
  movements: 'Movements',
  engagement: 'Engagement'
} as const;

export class LightboxPlotAssembly {
  /** The movements drawn from this response, by key, in order; unset until the summary is assembled. */
  private drawnMovements?: Array<{ key: string; tileId: string }>;
  /** The template tile drawn, with the engagement it read, awaiting the movements. */
  private awaiting?: { tile: LightboxTemplateTile; entries: readonly LightboxDecodedEngagement[]; fault?: string };

  constructor(
    private readonly assembler: LightboxClaimAssembler,
    /** The lenses this call read (decoded or withheld). */
    private readonly requested: readonly LightboxLensId[]
  ) {}

  template(block: LightboxDecodedTemplateBlock): void {
    const { assembler } = this;
    const friction = block.friction;
    const tile = assembler.claim(
      { kind: 'template', lens: 'template', title: block.name, claim: block.description, quotes: block.evidence,
        terms: [], support: [], friction },
      (base) => ({ ...base, kind: 'template', freshness: { ...block.freshness }, engagement: [] })
    );
    if (tile?.kind === 'template') {
      this.awaiting = { tile, entries: block.engagement, ...(block.engagementFault ? { fault: block.engagementFault } : {}) };
    }
    assembler.malformed('template-beat', 'template', block.malformed);
    for (const beat of block.beats) {
      // Titled by its stance, the host's own word, so a withheld beat shows nothing unchecked, fresh or carried.
      assembler.claim(
        { kind: 'template-beat', lens: 'template', title: LIGHTBOX_TEMPLATE_STANCE_LABELS[beat.stance], claim: beat.note,
          quotes: beat.evidence, terms: [], support: [], friction },
        (base) => ({ ...base, kind: 'template-beat', stance: beat.stance })
      );
    }
  }

  pressure(block: LightboxDecodedPressureBlock): void {
    const { assembler } = this;
    const last = assembler.context.verifier.paragraphCount;
    assembler.malformed('pressure-thread', 'pressure', block.malformed);
    for (const thread of block.threads) {
      const quotes = [thread.planted, ...thread.escalations, ...(thread.resolution ? [thread.resolution] : [])];
      const checked = assembler.verifyQuotes('pressure', quotes);
      const planted = checked.found[0] ?? null;
      const escalations = checked.found.slice(1, 1 + thread.escalations.length).filter(isQuote);
      const resolved = thread.resolution ? checked.found[quotes.length - 1] : undefined;
      assembler.claim(
        {
          kind: 'pressure-thread', lens: 'pressure', title: thread.question, claim: thread.question, quotes: [],
          prechecked: { evidence: lightboxThreadEvidence(planted, escalations, resolved ?? null), withheld: checked.withheld },
          thread: {
            planted,
            escalations,
            resolution: !thread.resolution ? { state: 'open' } : resolved ? { state: 'found', quote: resolved } : { state: 'gone' }
          },
          terms: [], support: [], friction: block.friction
        },
        (base) => {
          // The gate accepts a thread only with its plant found.
          const span = lightboxThreadSpan(planted as LightboxVerifiedQuote, resolved ?? null, last);
          return {
            ...base,
            kind: 'pressure-thread',
            planted: planted as LightboxVerifiedQuote,
            escalations,
            resolution: resolved ?? null,
            dormant: thread.dormant,
            span,
            paragraphs: lightboxRange(span)
          };
        }
      );
    }
  }

  artifacts(block: LightboxDecodedArtifactsBlock): void {
    const { assembler } = this;
    const { counter, verifier } = assembler.context;
    assembler.malformed('artifact', 'artifacts', block.malformed);
    for (const object of block.objects) {
      const counted = lightboxArtifactCount(object.terms, counter, verifier.paragraphCount);
      const checked = assembler.verifyQuotes('artifacts', object.arc);
      const arc = lightboxArtifactArc(object.arc.map((step, index) => {
        const quote = checked.found[index];
        return quote ? { step: step.step, quote } : undefined;
      }));
      assembler.claim(
        {
          kind: 'artifact', lens: 'artifacts', title: object.name, claim: lightboxArcLine(arc.kept), quotes: [],
          prechecked: { evidence: arc.kept.map((step) => step.quote), withheld: [...checked.withheld, ...arc.withheld] },
          terms: [], support: counted.support, friction: block.friction
        },
        (base) => ({
          ...base,
          kind: 'artifact',
          mentions: counted.mentions,
          firstParagraph: counted.firstParagraph,
          arc: arc.kept,
          ...lightboxArtifactUnused(object.plantedUnused, counted, arc.kept)
        })
      );
    }
  }

  summary(block: LightboxDecodedSummaryBlock): void {
    const { assembler } = this;
    const friction = block.friction;
    if (block.synopsisFault) {
      assembler.withholdClaim({ kind: 'synopsis', lens: 'summary', title: LIGHTBOX_PLOT_TITLES.synopsis, reason: block.synopsisFault, quotes: [] });
    } else {
      assembler.claim(
        { kind: 'synopsis', lens: 'summary', title: LIGHTBOX_PLOT_TITLES.synopsis, claim: block.synopsis.text,
          quotes: block.synopsis.evidence, terms: [], support: [], friction },
        (base) => ({ ...base, kind: 'synopsis' })
      );
    }
    assembler.malformed('movement', 'summary', block.malformed);
    const checked = assembler.verifyQuotes('summary', block.movements.map((movement) => movement.boundary));
    const sorted = block.movements
      .map((movement, index) => ({ movement, boundary: checked.found[index] }))
      .sort((a, b) => a.movement.from - b.movement.from);
    const verdict = lightboxMovementSetGate(
      sorted.map(({ movement, boundary }) => ({ from: movement.from, to: movement.to, boundary })),
      assembler.context.verifier.paragraphCount,
      'fresh',
      block.malformed.length
    );
    this.drawnMovements = [];
    if (!verdict.ok) {
      assembler.withholdClaim({ kind: 'movement', lens: 'summary', title: LIGHTBOX_PLOT_TITLES.movements, reason: verdict.reason, quotes: checked.withheld });
      return;
    }
    sorted.forEach(({ movement, boundary }, index) => {
      // The set gate accepts only movements whose boundaries were found.
      const quote = boundary as LightboxVerifiedQuote;
      const tile: LightboxMovementTile = {
        id: assembler.context.mintId(),
        kind: 'movement',
        lens: 'summary',
        title: movement.title,
        claim: movement.gist,
        paragraphs: lightboxRange(movement),
        evidence: [quote],
        withheldQuotes: [],
        support: [],
        friction,
        ordinal: index + 1,
        from: movement.from,
        to: movement.to,
        boundary: quote
      };
      assembler.keep(tile);
      this.drawnMovements?.push({ key: lightboxMovementKey(movement.id), tileId: tile.id });
    });
  }

  /** Engagement, on the movements this response drew: one level each, or withheld whole. */
  finish(): void {
    const awaiting = this.awaiting;
    if (!awaiting) {
      return;
    }
    const withhold = (reason: string) => this.assembler.withholdClaim({
      kind: 'template', lens: 'template', title: LIGHTBOX_PLOT_TITLES.engagement, reason, quotes: []
    });
    if (awaiting.fault) {
      withhold(awaiting.fault);
      return;
    }
    const movements = this.drawnMovements ?? (this.requested.includes('summary') ? [] : undefined);
    const joined = lightboxEngagementJoin(awaiting.entries, movements);
    if (!joined.ok) {
      withhold(joined.reason);
      return;
    }
    if (joined.marks.length > 0) {
      this.assembler.replace({ ...awaiting.tile, engagement: joined.marks });
    }
  }
}

function isQuote(quote: LightboxVerifiedQuote | undefined): quote is LightboxVerifiedQuote {
  return quote !== undefined;
}

/** Every paragraph of a span, ascending. */
export function lightboxRange(span: LightboxParagraphSpan): number[] {
  return Array.from({ length: Math.max(0, span.to - span.from + 1) }, (_unused, offset) => span.from + offset);
}

/** A thread's span: its plant to its resolution, or to the last paragraph while it is open. */
export function lightboxThreadSpan(
  planted: LightboxVerifiedQuote,
  resolution: LightboxVerifiedQuote | null,
  lastParagraph: number
): LightboxParagraphSpan {
  return { from: planted.paragraph, to: resolution ? resolution.paragraph : Math.max(planted.paragraph, lastParagraph) };
}

/** A thread's found quotes in its own order, each span once. */
export function lightboxThreadEvidence(
  planted: LightboxVerifiedQuote | null,
  escalations: readonly LightboxVerifiedQuote[],
  resolution: LightboxVerifiedQuote | null
): LightboxVerifiedQuote[] {
  const seen = new Set<string>();
  return [planted, ...escalations, resolution].filter((quote): quote is LightboxVerifiedQuote => {
    if (!quote || seen.has(`${quote.paragraph}:${quote.text}`)) {
      return false;
    }
    seen.add(`${quote.paragraph}:${quote.text}`);
    return true;
  });
}

/** An object's terms, counted by the gravity lens's counter: each term's count, all mentions once each, the first paragraph. */
export function lightboxArtifactCount(
  terms: readonly string[],
  counter: LightboxTermCounter,
  paragraphCount: number
): { support: LightboxCountedSupport[]; mentions: number; firstParagraph: number } {
  const field = countLightboxField(terms.map((term) => ({ term, degree: 1 as const })), counter, paragraphCount);
  return {
    support: field.support.map(({ degree: _degree, ...term }) => term),
    mentions: field.hits,
    firstParagraph: field.drift?.first ?? 0
  };
}

/** The found steps kept in paragraph order, and those withheld for breaking it, by position. */
export function lightboxArtifactArc(
  steps: ReadonlyArray<LightboxArtifactStep | undefined>
): { kept: LightboxArtifactStep[]; withheld: LightboxWithheldQuote[] } {
  const ordered = lightboxArcInOrder(steps);
  return {
    kept: ordered.kept,
    withheld: ordered.outOfOrder.map((index) => ({ paragraph: (steps[index] as LightboxArtifactStep).quote.paragraph, reason: 'out-of-order' }))
  };
}

/** The reading's "planted, unused", as the host's counts bear it out. */
export function lightboxArtifactUnused(
  read: boolean,
  counted: { support: readonly LightboxCountedSupport[]; firstParagraph: number },
  arc: readonly LightboxArtifactStep[]
): { plantedUnused: boolean; unusedWithheld?: string } {
  if (!read) {
    return { plantedUnused: false };
  }
  const paragraphs = [...counted.support.flatMap((term) => term.paragraphs), ...arc.map((step) => step.quote.paragraph)];
  const first = Math.min(...paragraphs.filter((paragraph) => paragraph > 0), counted.firstParagraph || Infinity);
  const check = lightboxUnusedCheck(first, paragraphs);
  return check.kept ? { plantedUnused: true } : { plantedUnused: false, unusedWithheld: check.reason };
}

/** An arc in the reading's words, from its found steps only: "found → opens the door → forgotten". */
export function lightboxArcLine(arc: readonly LightboxArtifactStep[]): string {
  return arc.map((step) => step.step).join(' → ');
}
