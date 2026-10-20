/**
 * Group D's tiles as the webview draws them (ADR 2026-10-19 D3, D7; Slice
 * 4B). Pure: no React, no transport.
 *
 * Everything here selects and words what the host decided: the tier counts,
 * a phrase's count, an ending per column and the measured figures are the
 * host's. The only arithmetic is presentation: shares of the host's counts,
 * a tally of the read endings, and where on a bar a figure sits.
 */

import type {
  LightboxBoard,
  LightboxNumberRow,
  LightboxNumbersMeasure,
  LightboxParagraphEnding,
  LightboxRhythmEndingsTile,
  LightboxStockTier,
  LightboxStockTiersTile
} from '@messages';
import { LIGHTBOX_STOCK_TIER_LABELS } from '@shared/constants/lightbox';
import { lightboxLensView, lightboxTilesOfKind, pluralize } from '@hooks/domain/lightbox/lightboxReadings';

/** Tiers in the order the bar draws them. */
export const LIGHTBOX_TIER_ORDER: readonly LightboxStockTier[] = ['functional', 'decorated', 'weighted', 'signature'];

export interface LightboxTierShare {
  tier: LightboxStockTier;
  label: string;
  count: number;
  /** Of the beats found, 0–100, whole. */
  percent: number;
}

/** Each tier's share of the beats the host found. */
export function lightboxTierShares(tile: Pick<LightboxStockTiersTile, 'tiers' | 'classified'>): LightboxTierShare[] {
  return LIGHTBOX_TIER_ORDER.map((tier) => ({
    tier,
    label: LIGHTBOX_STOCK_TIER_LABELS[tier],
    count: tile.tiers[tier],
    percent: tile.classified > 0 ? Math.round((tile.tiers[tier] / tile.classified) * 100) : 0
  }));
}

/** "51 beats the reading classified, found in the chapter: 31 functional stock …" for the bar's label. */
export function lightboxTierSummary(tile: Pick<LightboxStockTiersTile, 'tiers' | 'classified'>): string {
  const parts = lightboxTierShares(tile).map((share) => `${share.count} ${share.label.toLowerCase()}`);
  return `${pluralize(tile.classified, 'beat')} classified and found: ${parts.join(', ')}`;
}

export interface LightboxEndingTally {
  lands: number;
  holds: number;
  opens: number;
  /** The last paragraph of each column read as opening, ascending. */
  opensAt: number[];
  /** Columns with no ending (a carried column whose text changed). */
  unread: number;
}

/** How many columns the reading says land, hold and open. */
export function lightboxEndingTally(
  tile: Pick<LightboxRhythmEndingsTile, 'endings'>,
  ribbon: LightboxBoard['ribbon']
): LightboxEndingTally {
  const tally: LightboxEndingTally = { lands: 0, holds: 0, opens: 0, opensAt: [], unread: 0 };
  tile.endings.forEach((ending, index) => {
    if (ending === null) {
      tally.unread += 1;
      return;
    }
    tally[ending] += 1;
    if (ending === 'opens' && ribbon[index]) {
      tally.opensAt.push(ribbon[index].to);
    }
  });
  return tally;
}

/** What the ribbon's endings lane draws, and what it says about itself. */
export interface LightboxEndingsLane {
  endings?: Array<LightboxParagraphEnding | null>;
  stale: boolean;
  note: string;
  tileId?: string;
}

/**
 * The endings lane, honestly, as the tension lane is (PR #150 F-06): a stale
 * reading draws only the endings whose columns are unchanged, and a reading
 * not read, withheld or still coming says which.
 */
export function lightboxEndingsLane(board: LightboxBoard, lensOn: boolean): LightboxEndingsLane {
  if (!lensOn) {
    return { stale: false, note: 'The rhythm lens is off.' };
  }
  const view = lightboxLensView(board, 'rhythm');
  const [tile] = lightboxTilesOfKind(board, 'rhythm-endings');
  if (!tile || view.phase !== 'ok') {
    const note = view.phase === 'reading'
      ? 'Reading how the paragraphs end…'
      : view.phase === 'failed' || view.phase === 'cancelled'
        ? 'The paragraph endings did not come back.'
        : view.phase === 'ok'
          ? 'The paragraph endings were withheld.'
          : 'Endings are a reading. Not read yet.';
    return { stale: view.stale, note };
  }
  if (tile.endings.length !== board.ribbon.length) {
    return { stale: view.stale, note: 'The endings were read on other paragraphs and cannot be drawn on these. Re-read to read this version.', tileId: tile.id };
  }
  const note = !view.stale
    ? 'How each paragraph ends, as read: lands, holds or opens.'
    : 'Read against an earlier version of this chapter: endings stand only on paragraphs unchanged since.';
  return { endings: tile.endings, stale: view.stale, note, tileId: tile.id };
}

/** One ribbon column's measured sentences: the mean and the longest, in words. */
export interface LightboxSentenceColumn {
  from: number;
  to: number;
  mean: number;
  longest: number;
  sentences: number;
}

/** Each ribbon column's sentence lengths, from the host's per-paragraph lengths. */
export function lightboxSentenceColumns(board: LightboxBoard): LightboxSentenceColumn[] {
  return board.ribbon.map(({ from, to }) => {
    const lengths = board.paragraphs.slice(from - 1, to).flatMap((paragraph) => paragraph.sentenceWords);
    const total = lengths.reduce((sum, words) => sum + words, 0);
    return {
      from,
      to,
      mean: lengths.length > 0 ? Math.round((total / lengths.length) * 10) / 10 : 0,
      longest: lengths.reduce((max, words) => Math.max(max, words), 0),
      sentences: lengths.length
    };
  });
}

/** Where a figure sits on its row's bar: the preset's band, the writer's mark and the chapter's dot, 0–100. */
export interface LightboxNumberBar {
  band?: { left: number; width: number };
  writer?: number;
  dot: number;
}

export function lightboxNumberBar(row: LightboxNumberRow): LightboxNumberBar {
  const top = Math.max(row.value, row.range?.max ?? 0, row.range?.min ?? 0, row.writer?.average ?? 0, 1) * 1.25;
  const at = (value: number) => Math.max(0, Math.min(100, Math.round((value / top) * 1000) / 10));
  const band = row.range && (row.range.min !== undefined || row.range.max !== undefined)
    ? { left: at(row.range.min ?? 0), width: at(row.range.max ?? top) - at(row.range.min ?? 0) }
    : undefined;
  return { ...(band ? { band } : {}), ...(row.writer ? { writer: at(row.writer.average) } : {}), dot: at(row.value) };
}

/** "21.7 per 1,000 words · 7.2× your average · above the preset's 10–18". */
export function lightboxNumberValue(row: LightboxNumberRow): string {
  const parts = [`${row.value} ${row.unit}`];
  if (row.writer) {
    parts.push(row.writer.ratio !== undefined ? `${row.writer.ratio}× your average of ${row.writer.average}` : 'none in your other chapters');
  }
  if (row.range) {
    const span = `${row.range.min ?? '…'}–${row.range.max ?? '…'}`;
    parts.push(row.range.status === 'within' ? `within the preset's ${span}` : `${row.range.status} the preset's ${span}`);
  }
  return parts.join(' · ');
}

/** Whether a figure stands out, in words: "Stands out above your average", or nothing. */
export function lightboxStandoutLabel(row: LightboxNumberRow): string | undefined {
  const standout = row.standout;
  if (!standout) {
    return undefined;
  }
  const against = standout.against.map((basis) => (basis === 'standards' ? 'the preset' : 'your average')).join(' and ');
  return `Stands out ${standout.direction} ${against}`;
}

/** Where the comparison came from: "Against your chapters (11 files, 20,000 words)", or why there is no average. */
export function lightboxBaselineLine(numbers: LightboxNumbersMeasure, presetRanges: boolean): string {
  const preset = presetRanges ? ' and your publishing preset\'s ranges' : '';
  if (numbers.baseline.kind === 'measured') {
    const { group, files, words, capped } = numbers.baseline;
    return `Against your ${group === 'chapters' ? 'other chapters' : 'manuscript'} (${pluralize(files, 'file')}, ` +
      `${words.toLocaleString('en-US')} words${capped ? ', capped' : ''})${preset}.`;
  }
  return presetRanges ? `Against your publishing preset's ranges. ${numbers.baseline.note}` : numbers.baseline.note;
}
