/**
 * What a press owns (ADR 2026-10-19 D6, D8; PR #149 F-02). Pure over the
 * shared services it reads.
 *
 * A press reads the current board's paragraphs, the context shelf's files
 * and the lenses that are on, and is priced on the Lightbox model's window
 * and prices. The snapshot holds all of it, with the key that names it
 * (`lightboxEstimateKey`). It is read synchronously, so a press captures it
 * whole before its first await, and an estimate is priced on one snapshot,
 * not on a catalog read after its prompt files load. Comparing a press's key
 * with a fresh snapshot's is how the host knows nothing it priced has moved.
 * The snapshot also names the board's adoption (PR #163 F-02). A saved
 * snapshot of the same board has the same id, text and figures, so the same
 * key and a valid estimate; but opened while a press prepares, it is a newer
 * choice, and the press refuses rather than read it.
 *
 * Host-private: the paragraph and context texts are never posted.
 */

import type { LightboxBoard, LightboxLensId } from '@messages';
import type { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import type { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import type { LightboxRunSource } from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { lightboxEstimateKey, lightboxStandoutsKey, type LightboxModelFacts } from '@/infrastructure/lightbox/LightboxRunEstimate';

export interface LightboxPressSnapshot {
  board: LightboxBoard;
  /** What a run of it reads. */
  source: LightboxRunSource;
  /** The Lightbox model's facts, read once. */
  facts: LightboxModelFacts;
  /** `LightboxRunEstimate.key` of exactly these inputs. */
  key: string;
  /** The board's adoption generation when the snapshot was read (`LightboxService.adoptionOf`); not part of the key. */
  adoption: number | undefined;
}

export interface LightboxPressInputs {
  service: Pick<LightboxService, 'currentBoard' | 'readingSource' | 'adoptionOf'>;
  shelf: Pick<LightboxContextShelf, 'materials' | 'totalWords' | 'revision'>;
  modelFacts: () => LightboxModelFacts;
  lensesOff: readonly LightboxLensId[];
}

/** The current board's snapshot, when it is the board named (or any board, with none named). */
export function lightboxPressSnapshot(inputs: LightboxPressInputs, boardId?: string): LightboxPressSnapshot | undefined {
  const current = inputs.service.currentBoard();
  if (!current || (boardId !== undefined && current.boardId !== boardId)) {
    return undefined;
  }
  const text = inputs.service.readingSource(current.boardId);
  if (!text) {
    return undefined;
  }
  const board = text.board;
  const facts = inputs.modelFacts();
  const adoption = inputs.service.adoptionOf(board.boardId);
  return {
    board,
    source: {
      boardId: board.boardId,
      material: {
        paragraphs: text.paragraphTexts,
        columns: board.ribbon.map(({ from, to }) => ({ from, to })),
        context: inputs.shelf.materials(),
        // The palette builds its clusters from what the board counted most (Slice 3).
        countedWords: board.measured.topWords.map((term) => term.term),
        // The numbers lens reads the figures the board measured as standing out (Slice 4B).
        numbers: board.measured.numbers.rows
      },
      sourceWords: board.source.wordCount,
      contextWords: inputs.shelf.totalWords(),
      averageWordsPerSentence: board.measured.headline.averageWordsPerSentence
    },
    facts,
    adoption,
    key: lightboxEstimateKey({
      boardId: board.boardId,
      contentHash: board.source.contentHash,
      lensesOff: inputs.lensesOff,
      contextRevision: inputs.shelf.revision(),
      facts,
      standoutsKey: lightboxStandoutsKey(board.measured.numbers.rows)
    })
  };
}
