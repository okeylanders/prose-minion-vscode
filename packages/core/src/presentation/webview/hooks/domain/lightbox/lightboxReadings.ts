/**
 * The board's readings, as the webview draws them (ADR 2026-10-19 D3, D7).
 * Pure: no React, no transport.
 *
 * The host's board is the truth: a group result replaces its group, and
 * everything here only selects and words what the host decided. A lens's
 * state is derived from its group's status and pending lenses; nothing is
 * inferred from a model.
 */

import type {
  LightboxBoard,
  LightboxGroupResultPayload,
  LightboxLensId,
  LightboxReadingGroup,
  LightboxLineageSetAside,
  LightboxReadingTile,
  LightboxReadingTileKind,
  LightboxWithheldBlock,
  LightboxWithheldClaim,
  LightboxWithheldQuote
} from '@messages';
import { lightboxLensGroup } from '@shared/constants/lightbox';
import { lightboxEarlierReason, lightboxLensHasReading } from '@shared/constants/lightboxProvenance';
import { lightboxBoardCallNote, lightboxPointsToCallNote, type LightboxCallNote } from '@hooks/domain/lightbox/lightboxCallNotes';

/** A group result for this board replaces its group; anything else leaves the board as it is. */
export function mergeLightboxGroupResult(board: LightboxBoard, payload: LightboxGroupResultPayload): LightboxBoard {
  if (payload.boardId !== board.boardId) {
    return board;
  }
  return {
    ...board,
    readings: board.readings.map((group) => (group.group === payload.group.group ? payload.group : group))
  };
}

/** Every tile of one kind, in group order. */
export function lightboxTilesOfKind<K extends LightboxReadingTileKind>(
  board: LightboxBoard,
  kind: K
): Array<Extract<LightboxReadingTile, { kind: K }>> {
  return board.readings.flatMap((group) =>
    group.tiles.filter((tile): tile is Extract<LightboxReadingTile, { kind: K }> => tile.kind === kind)
  );
}

export function findLightboxTile(board: LightboxBoard, id: string): LightboxReadingTile | undefined {
  for (const group of board.readings) {
    const tile = group.tiles.find((candidate) => candidate.id === id);
    if (tile) {
      return tile;
    }
  }
  return undefined;
}

/**
 * Where a lens stands:
 * - `not-run`: nothing read yet (or the lens was off when its group ran);
 * - `reading`: the call in flight reads it, and it has no earlier reading
 *   to show;
 * - `ok`: its readings are on the board (possibly empty), and, with
 *   `reanalyzing`, the call in flight reads it again (Slice 4J);
 * - `failed` / `cancelled`: its group's latest call failed or stopped, and it
 *   has no earlier reading to show.
 */
export type LightboxLensPhase = 'not-run' | 'reading' | 'ok' | 'failed' | 'cancelled';

export interface LightboxLensView {
  lens: LightboxLensId;
  phase: LightboxLensPhase;
  tiles: LightboxReadingTile[];
  withheldBlocks: LightboxWithheldBlock[];
  withheldClaims: LightboxWithheldClaim[];
  /** The lens block's friction, even when it holds no tile. */
  friction?: string;
  /** Lineage: the stories its reading checked and set aside, even when it drew none. */
  setAside?: LightboxLineageSetAside[];
  /** The group's failure or stop, writer-facing. */
  notice?: string;
  /** Read against an earlier version of the text; its quotes were checked again against this one (D4). */
  stale: boolean;
  /**
   * Its reading stays on show while the call in flight reads it again: the
   * earlier one, until the new one lands (Slice 4J, epic decision 49).
   */
  reanalyzing: boolean;
  /**
   * Its reading is an earlier one: the latest call that read it did not
   * replace it, for this reason (host words). Absent while it is read again.
   */
  earlier?: string;
  /**
   * The note of its call that did not land, when what this lens shows is
   * that note's message (its failure, its stop, its earlier reading's
   * reason, or its block withheld by a cut): the widget points to the note
   * instead of repeating it (Slice 4J, epic decision 52).
   */
  callNote?: LightboxCallNote;
}

/** The lens's withheld blocks that are its own, not the cut its call's note says once (decision 52). */
export function lightboxOwnWithheldBlocks(view: Pick<LightboxLensView, 'withheldBlocks' | 'callNote'>): LightboxWithheldBlock[] {
  return view.callNote ? view.withheldBlocks.filter((block) => !lightboxPointsToCallNote(view.callNote, block.reason)) : view.withheldBlocks;
}

export function lightboxLensView(board: LightboxBoard, lens: LightboxLensId): LightboxLensView {
  const group = board.readings.find((candidate) => candidate.group === lightboxLensGroup(lens));
  const view = lensView(group, lens);
  // Decision 52: what the lens shows that is its call's note's message points there.
  const note = group ? lightboxBoardCallNote(board, group.group) : undefined;
  const shown = view.phase === 'failed' || view.phase === 'cancelled' ? view.notice : view.earlier;
  const points = lightboxPointsToCallNote(note, shown) ||
    (view.tiles.length === 0 && view.withheldBlocks.some((block) => lightboxPointsToCallNote(note, block.reason)));
  return points && note ? { ...view, callNote: note } : view;
}

function lensView(group: LightboxReadingGroup | undefined, lens: LightboxLensId): LightboxLensView {
  const tiles = group?.tiles.filter((tile) => tile.lens === lens) ?? [];
  const withheldBlocks = group?.withheldBlocks.filter((block) => block.lens === lens) ?? [];
  const withheldClaims = group?.withheldClaims.filter((claim) => claim.lens === lens) ?? [];
  const notes = group?.frictions.find((entry) => entry.lens === lens);
  const friction = notes?.friction;
  const stale = group?.staleLenses?.some((mark) => mark.lens === lens) ?? false;
  const base = {
    lens, tiles, withheldBlocks, withheldClaims, stale, reanalyzing: false,
    ...(friction ? { friction } : {}),
    ...(notes?.setAside ? { setAside: notes.setAside } : {})
  };
  if (!group) {
    return { ...base, phase: 'not-run' };
  }
  const read = group.lenses.includes(lens);
  // Slice 4J: an earlier reading the latest call did not replace says so, with the host's reason.
  const earlier = lightboxEarlierReason(group, lens);
  const kept = earlier !== undefined ? { earlier } : {};
  switch (group.status) {
    case 'running':
      if (group.pending?.includes(lens)) {
        // Read again: its reading stays on show, the earlier one, until the new one lands (decision 49).
        return lightboxLensHasReading(group, lens) ? { ...base, phase: 'ok', reanalyzing: true } : { ...base, phase: 'reading' };
      }
      return { ...base, phase: read ? 'ok' : 'not-run', ...kept };
    case 'ok':
      return { ...base, phase: read ? 'ok' : 'not-run', ...kept };
    case 'failed':
    case 'cancelled':
      // A kept reading says why in its earlier note; a lens the call did not read keeps the group's notice, as before.
      return read
        ? { ...base, phase: 'ok', ...(earlier !== undefined ? kept : group.error ? { notice: group.error } : {}) }
        : { ...base, phase: group.status, ...(group.error ? { notice: group.error } : {}) };
    case 'not-run':
      return { ...base, phase: 'not-run' };
  }
}

export interface LightboxQuoteTally {
  /**
   * Every quote the host checked, found or not, as the checks ran (PR #149
   * F-07): a claim withheld for another reason still counts its found quotes.
   */
  checked: number;
  withheld: number;
  claimsWithheld: number;
  blocksWithheld: number;
  /** Groups whose latest call came back (read or failed). */
  calls: number;
  failed: number;
}

export function lightboxQuoteTally(board: LightboxBoard): LightboxQuoteTally {
  const tally: LightboxQuoteTally = { checked: 0, withheld: 0, claimsWithheld: 0, blocksWithheld: 0, calls: 0, failed: 0 };
  for (const group of board.readings) {
    if (group.status === 'ok' || group.status === 'failed') {
      tally.calls += 1;
    }
    if (group.status === 'failed') {
      tally.failed += 1;
    }
    for (const checks of group.quoteChecks) {
      tally.checked += checks.checked;
      tally.withheld += checks.withheld;
    }
    tally.claimsWithheld += group.withheldClaims.length;
    tally.blocksWithheld += group.withheldBlocks.length;
  }
  return tally;
}

/** Why a quote was withheld, in the writer's words. */
export function lightboxWithheldQuoteText(quote: LightboxWithheldQuote): string {
  const elsewhere = quote.foundIn && quote.foundIn.length > 0
    ? `the words stand in ${quote.foundIn.map((index) => `¶${index}`).join(', ')}`
    : undefined;
  switch (quote.reason) {
    case 'not-in-paragraph':
      return `Not in ¶${quote.paragraph}; ${elsewhere ?? 'the words stand elsewhere'}. A quote must stand in the paragraph it names.`;
    case 'undeclared-paragraph':
      return `The chapter has no ¶${quote.paragraph}${elsewhere ? `; ${elsewhere}` : ''}.`;
    case 'not-in-chapter':
      return 'Not found in the chapter: a paraphrase, or words from somewhere else. Only the chapter can be quoted.';
    case 'too-short':
      return 'Too short to anchor anything.';
    case 'no-longer-in-chapter':
      return 'No longer in the chapter: the text changed after this was read, and these words are gone.';
    case 'no-instance':
      return 'Found, but it holds no instance of the measured figure, so it cannot show how that figure is used.';
    case 'out-of-order':
      return 'Found, but it stands before the step it follows, so the arc would no longer run in paragraph order.';
  }
}

/** Whether the lens's readings were made against an earlier version of the text (D4). */
export function lightboxLensIsStale(board: LightboxBoard, lens: LightboxLensId): boolean {
  return board.readings.some((group) => group.staleLenses?.some((mark) => mark.lens === lens) ?? false);
}

/** How many lenses on the board hold readings of an earlier text. */
export function lightboxStaleLensCount(board: LightboxBoard): number {
  return board.readings.reduce((sum, group) => sum + (group.staleLenses?.length ?? 0), 0);
}

/** The tension arc's read score per ribbon column (`null`: unscored), when the board holds one that fits its ribbon. */
export function lightboxTensionScores(board: LightboxBoard): Array<number | null> | undefined {
  const [arc] = lightboxTilesOfKind(board, 'tension-arc');
  return arc && arc.scores.length === board.ribbon.length ? arc.scores : undefined;
}

/** What the ribbon's tension lane draws, and what it says about itself. */
export interface LightboxTensionLane {
  scores?: Array<number | null>;
  /** Read against an earlier version of the text (D4). */
  stale: boolean;
  /** The lane's own account of what it shows, or why it shows nothing. */
  note: string;
}

/**
 * The tension lane, honestly (PR #150 F-06): a stale arc draws only the
 * scores whose paragraphs are unchanged, and says so; an arc that cannot be
 * drawn on this text, or one not read, withheld or still coming, says which.
 */
export function lightboxTensionLane(board: LightboxBoard, lensOn: boolean): LightboxTensionLane {
  if (!lensOn) {
    return { stale: false, note: 'The tension lens is off.' };
  }
  const view = lightboxLensView(board, 'tension');
  const [arc] = lightboxTilesOfKind(board, 'tension-arc');
  if (!arc || view.phase !== 'ok') {
    const note = view.phase === 'reading'
      ? 'Reading the tension arc…'
      : view.phase === 'failed' || view.phase === 'cancelled'
        ? 'The tension arc did not come back.'
        : view.phase === 'ok'
          ? 'The tension arc was withheld.'
          : 'Tension is a reading. Not analyzed yet.';
    return { stale: view.stale, note };
  }
  const scores = lightboxTensionScores(board);
  if (!scores) {
    return { stale: view.stale, note: 'The tension arc was read on other paragraphs and cannot be drawn on these. Re-analyze to score this version.' };
  }
  const unscored = scores.filter((score) => score === null).length;
  if (!view.stale) {
    return { scores, stale: false, note: 'Tension is a reading, scored per column.' };
  }
  const note = unscored === scores.length
    ? 'Tension was read against an earlier version of this chapter, and no paragraph it scored is unchanged. Re-analyze to score this version.'
    : unscored > 0
      ? 'Tension was read against an earlier version of this chapter. Scores stand only on paragraphs unchanged since; re-analyze to score the rest.'
      : 'Tension was read against an earlier version of this chapter; each score stands on the same, unchanged paragraphs.';
  return { scores, stale: true, note };
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`;
}
