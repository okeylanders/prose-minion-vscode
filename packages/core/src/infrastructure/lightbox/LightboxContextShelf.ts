/**
 * The Lightbox's context files (ADR 2026-10-19 D9). Built once at the
 * composition root and carried in `CoreServices`; kept in memory for the
 * extension session, like the boards (D12).
 *
 * Context informs readings and is never evidence: it reaches a group's call
 * as a labeled section after the chapter (`LightboxReadingPrompts`), and the
 * quote verifier never searches it. Its words count toward the fit check, and
 * together they are bounded by `PROMPT_BUDGETS.contextFiles.words`. The shelf
 * belongs to the Lightbox, not to a board, so it stays as the source changes.
 * The text is host-private: only paths, ids and word counts are posted.
 */

import { randomUUID } from 'node:crypto';
import type { LightboxContextFile } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';
import type { LightboxContextMaterial } from '@/infrastructure/lightbox/LightboxReadingPrompts';

export interface LightboxContextInput {
  displayPath: string;
  text: string;
  /** What makes two picks the same file (its absolute path). Never posted. */
  sourceKey: string;
}

export type LightboxContextAddResult =
  | { added: true; file: LightboxContextFile }
  | { added: false; notice: string };

interface ShelfEntry extends LightboxContextFile {
  text: string;
  sourceKey: string;
}

export class LightboxContextShelf {
  private entries: ShelfEntry[] = [];
  private revisionCount = 0;
  private readonly mintId: () => string;

  constructor(options: { mintId?: () => string } = {}) {
    this.mintId = options.mintId ?? (() => `lbc-${randomUUID()}`);
  }

  /**
   * Bumps on every add and removal, so a press can tell the shelf its
   * estimate priced from the shelf as it stands (PR #149 F-02).
   */
  revision(): number {
    return this.revisionCount;
  }

  list(): LightboxContextFile[] {
    return this.entries.map(({ id, displayPath, wordCount }) => ({ id, displayPath, wordCount }));
  }

  totalWords(): number {
    return this.entries.reduce((sum, entry) => sum + entry.wordCount, 0);
  }

  /** The files as a call carries them, in the order they were added. */
  materials(): LightboxContextMaterial[] {
    return this.entries.map(({ displayPath, text }) => ({ displayPath, text }));
  }

  add(input: LightboxContextInput): LightboxContextAddResult {
    const wordCount = countWords(input.text);
    if (wordCount === 0) {
      return { added: false, notice: `${input.displayPath} has no text to add.` };
    }
    if (this.entries.some((entry) => entry.sourceKey === input.sourceKey)) {
      return { added: false, notice: `${input.displayPath} is already in the context.` };
    }
    const ceiling = PROMPT_BUDGETS.contextFiles.words;
    const total = this.totalWords();
    if (total + wordCount > ceiling) {
      return {
        added: false,
        notice: `${input.displayPath} has ${wordCount.toLocaleString('en-US')} words, and the context holds ` +
          `${total.toLocaleString('en-US')} of its ${ceiling.toLocaleString('en-US')}. Remove a file, or choose a shorter one.`
      };
    }
    const entry: ShelfEntry = { id: this.mintId(), displayPath: input.displayPath, wordCount, text: input.text, sourceKey: input.sourceKey };
    this.entries = [...this.entries, entry];
    this.revisionCount += 1;
    return { added: true, file: { id: entry.id, displayPath: entry.displayPath, wordCount } };
  }

  remove(id: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.id !== id);
    if (this.entries.length === before) {
      return false;
    }
    this.revisionCount += 1;
    return true;
  }
}
