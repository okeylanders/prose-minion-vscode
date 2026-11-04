/**
 * Session-owned ledger for the writer's bookmarks (ADR 2026-11-03 D5, D6).
 *
 * Modeled on `WorkshopTodoLedger`: host-generated ids, defensive copies, one
 * bookmark per turn, a validated rename, and prepared hydration. The ledger
 * knows which turns may carry a bookmark and how a default label reads; the
 * aggregate supplies the turns. Bookmarks are presentation only: nothing
 * here, and nothing that reads this ledger, may put one in a prompt, a room
 * frame, provider history, or recall.
 *
 * Ids carry their number (`bookmark-<n>-<ms>`), so a reopened session's
 * ledger resumes numbering past them without a persisted counter.
 */

import type {
  WorkshopBookmarkSummary,
  WorkshopTurn,
  WorkshopTurnBookmark
} from '@messages';
import {
  checkWorkshopBookmarkLabel,
  WORKSHOP_BOOKMARK_LABEL_FAULTS
} from '@shared/constants/workshopBookmarks';
import { workshopCapabilityFamilyLabel } from '@shared/constants/workshopCapabilityLabels';
import { projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';

/** The id grammar the ledger mints and the codec accepts. */
export const WORKSHOP_BOOKMARK_ID_PATTERN = /^bookmark-(\d+)-(\d+)$/;

/** The longest default label, ellipsis included. */
export const WORKSHOP_BOOKMARK_DEFAULT_LABEL_CHARACTERS = 60;

/** What the thread calls the writer; the transcript's export label is for a shared page. */
const WRITER_LABEL = 'You';

export type WorkshopBookmarkRefusalReason = 'unknown-turn' | 'ineligible-turn' | 'unknown-bookmark';

/** A bookmark change the host refused. Its message is display copy and names no content. */
export class WorkshopBookmarkRefusedError extends Error {
  constructor(readonly reason: WorkshopBookmarkRefusalReason | 'invalid-label', message: string) {
    super(message);
    this.name = 'WorkshopBookmarkRefusedError';
  }
}

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the reasons' kebab-case words. */
const REFUSAL_MESSAGES: Readonly<Record<WorkshopBookmarkRefusalReason, string>> = {
  'unknown-turn': 'That message is no longer in this session.',
  'ineligible-turn': 'Only replies, your messages, reports and capability cards can be bookmarked.',
  'unknown-bookmark': 'That bookmark is no longer in this session.'
};
/* eslint-enable @typescript-eslint/naming-convention */

const refused = (reason: WorkshopBookmarkRefusalReason): WorkshopBookmarkRefusedError =>
  new WorkshopBookmarkRefusedError(reason, REFUSAL_MESSAGES[reason]);

export interface WorkshopBookmarkLedgerState {
  counter: number;
  bookmarks: WorkshopTurnBookmark[];
}

/** What a set or clear did; an unchanged answer needs no save. */
export type WorkshopBookmarkChange = 'set' | 'cleared' | 'unchanged';

type BookmarkTurnFacts = Pick<WorkshopTurn, 'role' | 'kind' | 'participant'>;

/**
 * Eligible: agent replies (host, guest, tool, including tool reports and
 * capability cards) and the writer's messages. Refused: dividers, session and
 * standing-directive markers, and the writer's direct tool-run requests.
 */
export function isWorkshopBookmarkableTurn(turn: BookmarkTurnFacts): boolean {
  if (turn.kind === 'divider' || turn.participant === 'session' || turn.role === 'system') {
    return false;
  }
  if (turn.role === 'assistant') {
    return turn.participant === 'host' || turn.participant === 'guest' || turn.participant === 'tool';
  }
  return turn.role === 'user' && turn.participant === 'writer' && turn.kind === 'message';
}

/**
 * The label a bookmark shows until the writer names it: the participant's
 * label and the bubble's first line, whitespace collapsed, cut at
 * `WORKSHOP_BOOKMARK_DEFAULT_LABEL_CHARACTERS` with an ellipsis. Pure and
 * deterministic, never model-generated.
 *
 * It reads a turn only through the transcript projection, so a host-private
 * body never reaches a label: a capability card is named by its family and
 * request, never by its evidence.
 */
export function workshopBookmarkDefaultLabel(turn: Readonly<WorkshopTurn>): string {
  if (turn.capability) {
    return cut(`${workshopCapabilityFamilyLabel(turn.capability.operation, turn.toolLabel)} · ${
      collapse(turn.capability.requestSummary)
    }`);
  }
  const entry = projectWorkshopTranscriptTurn(turn as WorkshopTurn);
  const speaker = entry?.kind === 'reply'
    ? entry.speaker
    : turn.role === 'user'
      ? WRITER_LABEL
      : turn.personaLabel ?? turn.toolLabel ?? 'Follow-up';
  const line = entry && entry.kind !== 'event' ? firstLine(entry.content) : '';
  return cut(line ? `${speaker} · ${line}` : speaker);
}

/** The first line with words on it, its leading Markdown block marks dropped and its whitespace collapsed. */
function firstLine(content: string): string {
  for (const raw of content.split(/\r\n|\r|\n/)) {
    const line = collapse(raw.replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d{1,9}[.)]\s+)+/, ''));
    if (line) {
      return line;
    }
  }
  return '';
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** At most the default's length in code points, never splitting a surrogate pair. */
function cut(text: string): string {
  const points = Array.from(text);
  if (points.length <= WORKSHOP_BOOKMARK_DEFAULT_LABEL_CHARACTERS) {
    return text;
  }
  return `${points.slice(0, WORKSHOP_BOOKMARK_DEFAULT_LABEL_CHARACTERS - 1).join('').trimEnd()}…`;
}

const cloneBookmark = (bookmark: WorkshopTurnBookmark): WorkshopTurnBookmark => ({
  id: bookmark.id,
  turnId: bookmark.turnId,
  ...(bookmark.label !== undefined ? { label: bookmark.label } : {}),
  createdAt: bookmark.createdAt
});

/** The number in a minted id, or 0 for one the ledger did not mint. */
const idNumber = (id: string): number => {
  const match = WORKSHOP_BOOKMARK_ID_PATTERN.exec(id);
  return match ? Number(match[1]) : 0;
};

export class WorkshopBookmarkLedger {
  private counter = 0;
  private bookmarks: WorkshopTurnBookmark[] = [];

  constructor(private readonly now: () => number) {}

  /**
   * Set or clear the bookmark on one turn. Setting needs the turn, and an
   * eligible one; clearing a turn with no bookmark changes nothing. Either is
   * idempotent: a turn carries at most one bookmark.
   */
  set(turnId: string, turn: Readonly<WorkshopTurn> | undefined, bookmarked: boolean): WorkshopBookmarkChange {
    const index = this.bookmarks.findIndex((bookmark) => bookmark.turnId === turnId);
    if (!bookmarked) {
      if (index < 0) {
        return 'unchanged';
      }
      this.bookmarks.splice(index, 1);
      return 'cleared';
    }
    if (!turn || turn.id !== turnId) {
      throw refused('unknown-turn');
    }
    if (!isWorkshopBookmarkableTurn(turn)) {
      throw refused('ineligible-turn');
    }
    if (index >= 0) {
      return 'unchanged';
    }
    let id: string;
    do {
      id = `bookmark-${++this.counter}-${this.now()}`;
    } while (this.bookmarks.some((bookmark) => bookmark.id === id));
    this.bookmarks.push({ id, turnId, createdAt: this.now() });
    return 'set';
  }

  /** Name a bookmark, or restore its default with `null` or a blank label. */
  rename(bookmarkId: string, label: string | null): WorkshopBookmarkChange {
    const bookmark = this.bookmarks.find((candidate) => candidate.id === bookmarkId);
    if (!bookmark) {
      throw refused('unknown-bookmark');
    }
    const check = checkWorkshopBookmarkLabel(label);
    if (check.kind === 'invalid') {
      throw new WorkshopBookmarkRefusedError('invalid-label', WORKSHOP_BOOKMARK_LABEL_FAULTS[check.fault]);
    }
    const next = check.kind === 'named' ? check.label : undefined;
    if (next === bookmark.label) {
      return 'unchanged';
    }
    if (next === undefined) {
      delete bookmark.label;
    } else {
      bookmark.label = next;
    }
    return 'set';
  }

  /** Keep only bookmarks whose turn still exists; returns how many went. */
  pruneTo(turnIds: ReadonlySet<string>): number {
    const before = this.bookmarks.length;
    this.bookmarks = this.bookmarks.filter((bookmark) => turnIds.has(bookmark.turnId));
    return before - this.bookmarks.length;
  }

  /** Whether `turnId` carries a bookmark. */
  has(turnId: string): boolean {
    return this.bookmarks.some((bookmark) => bookmark.turnId === turnId);
  }

  list(): WorkshopTurnBookmark[] {
    return this.bookmarks.map(cloneBookmark);
  }

  /**
   * Display-safe summaries in thread order. `turns` is the whole ledger in
   * order; `windowTurnIds` is exactly the turns the same snapshot sends, so
   * `inWindow` agrees with what the thread holds.
   */
  summaries(
    turns: readonly Readonly<WorkshopTurn>[],
    windowTurnIds: ReadonlySet<string>
  ): WorkshopBookmarkSummary[] {
    if (this.bookmarks.length === 0) {
      return [];
    }
    const byTurn = new Map(this.bookmarks.map((bookmark) => [bookmark.turnId, bookmark]));
    return turns.flatMap((turn) => {
      const bookmark = byTurn.get(turn.id);
      if (!bookmark) {
        return [];
      }
      return [{
        id: bookmark.id,
        turnId: turn.id,
        label: bookmark.label ?? workshopBookmarkDefaultLabel(turn),
        participant: turn.participant,
        ...(turn.personaId !== undefined ? { personaId: turn.personaId } : {}),
        ...(turn.toolId !== undefined ? { toolId: turn.toolId } : {}),
        inWindow: windowTurnIds.has(turn.id)
      }];
    });
  }

  exportState(): WorkshopBookmarkLedgerState {
    return {
      counter: this.counter,
      bookmarks: this.bookmarks.map(cloneBookmark)
    };
  }

  /**
   * Complete every potentially throwing clone before aggregate installation.
   * Numbering resumes past every loaded id, and never goes back within this
   * ledger's lifetime.
   */
  prepareState(bookmarks: readonly WorkshopTurnBookmark[]): WorkshopBookmarkLedgerState {
    return {
      counter: Math.max(this.counter, ...bookmarks.map((bookmark) => idNumber(bookmark.id))),
      bookmarks: bookmarks.map(cloneBookmark)
    };
  }

  /** Install state produced by this ledger's prepare phase; this must not throw. */
  installPreparedState(state: WorkshopBookmarkLedgerState): void {
    this.counter = state.counter;
    this.bookmarks = state.bookmarks;
  }

  /** A fresh room clears its bookmarks but never reuses an id number. */
  reset(): void {
    this.bookmarks = [];
  }
}
