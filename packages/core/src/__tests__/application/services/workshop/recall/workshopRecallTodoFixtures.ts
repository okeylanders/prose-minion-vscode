/**
 * Session-recall to-do fixtures (Slice 2B): REAL to-dos, promoted from
 * findings with addTodoFromFinding, reworded with editTodo, and closed with
 * setTodoStatus on the real aggregate, then saved through the real
 * coordinator and store.
 *
 * A finding's key and text never appear in a turn's visible content here,
 * and every to-do promoted from a sentinel finding is reworded, so the
 * sentinels live only in `findingKey`, `findingText`, and
 * `writerEdit.originalText`: fields recall must never show (D5).
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopActionableFinding, WorkshopTodoItem, WorkshopToolId } from '@messages';
import {
  RECALL_ROOT,
  saveRecallRoom,
  SavedRecallRoom
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

export const TODO_SENTINELS = {
  findingKey: 'SENTINEL-FINDING-KEY',
  /** Also the reworded to-do's `writerEdit.originalText`. */
  findingText: 'SENTINEL-FINDING-TEXT'
} as const;

const DAY = 24 * 60 * 60_000;

/** The to-dos the corpus holds, by role, with the ids the real ledger minted. */
export interface RecallTodoCorpus extends SavedRecallRoom {
  /** Oldest first: “Chapter 6-7 stock signature”, “Cliché pass”, “Endings chat”. */
  readonly sessionIds: readonly [string, string, string];
  readonly todos: {
    /** Stock & Signature finding, reworded; open, and stale after the excerpt revision. */
    readonly laughter: WorkshopTodoItem;
    /** Jill's synthesis of that report; completed, and stale. */
    readonly very: WorkshopTodoItem;
    /** Stock & Signature finding; open, and stale. */
    readonly shapped: WorkshopTodoItem;
    /** Jill, on excerpt v2; open and current. */
    readonly cadence: WorkshopTodoItem;
    /** Jill, on excerpt v2; dismissed. */
    readonly semicolon: WorkshopTodoItem;
    /** Cliché report in the second session, where Margot was a guest; open. */
    readonly cliche: WorkshopTodoItem;
    /** Jill in the open third session; open. */
    readonly endings: WorkshopTodoItem;
  };
}

/** One finding per text; a sentinel finding hides its key and text from the turn. */
function findings(
  items: ReadonlyArray<{ text: string; priority?: WorkshopActionableFinding['priority']; key?: string }>
): WorkshopActionableFinding[] {
  return items.map((item, index) => ({
    key: item.key ?? `finding-${index + 1}`,
    text: item.text,
    ordinal: index + 1,
    ...(item.priority ? { priority: item.priority } : {})
  }));
}

/** A tool report carrying findings; its visible text never repeats them. */
export function reportWithFindings(
  session: WorkshopSessionService,
  toolId: WorkshopToolId,
  requestId: string,
  content: string,
  found: WorkshopActionableFinding[]
) {
  session.beginToolRun(toolId, requestId);
  return session.completeToolReport(requestId, content, `conv-${requestId}`, undefined, false, found)!.turn;
}

/** A host reply carrying findings. */
export function hostReplyWithFindings(
  session: WorkshopSessionService,
  requestId: string,
  question: string,
  found: WorkshopActionableFinding[]
) {
  session.beginPersonaMessage(requestId, question);
  return session.completeRun(requestId, 'Here is my read.', undefined, false, 'runtime-host', found)!;
}

export async function saveTodoCorpus(): Promise<RecallTodoCorpus> {
  const fs = new MemoryFileSystem();
  const todos: Partial<Record<keyof RecallTodoCorpus['todos'], WorkshopTodoItem>> = {};

  const first = await saveRecallRoom('Chapter 6-7 stock signature', (session, advance) => {
    session.setExcerpt({
      text: 'The laughter was raucous. He shapped the cup.',
      source: {
        kind: 'file',
        sourceUri: `file://${RECALL_ROOT}/drafts/chapter-6-7.md`,
        relativePath: 'drafts/chapter-6-7.md'
      }
    });
    session.setSessionScope('excerpt');
    advance(60_000);
    const report = reportWithFindings(session, 'stock-and-signature', 'stock', 'Two reactions lean on stock gestures.', findings([
      { key: `${TODO_SENTINELS.findingKey}-1`, text: `${TODO_SENTINELS.findingText} laughter`, priority: 'medium' },
      { text: 'Correct "shapped" to "shaped".', priority: 'low' }
    ]));
    todos.laughter = session.addTodoFromFinding(report.id, `${TODO_SENTINELS.findingKey}-1`);
    todos.laughter = session.editTodo(todos.laughter.id, 'Convert the "raucous laughter" reaction into a prop-based event.');
    todos.shapped = session.addTodoFromFinding(report.id, 'finding-2');
    advance(60_000);
    session.beginPersonaSynthesis('synthesis', report.id);
    const synthesis = session.completeRun('synthesis', 'I would start with the laughter.', undefined, false, 'runtime-host', findings([
      { key: `${TODO_SENTINELS.findingKey}-2`, text: `${TODO_SENTINELS.findingText} very`, priority: 'high' }
    ]))!;
    todos.very = session.addTodoFromFinding(synthesis.id, `${TODO_SENTINELS.findingKey}-2`);
    todos.very = session.editTodo(todos.very.id, 'Cut the second "very".');
    todos.very = session.setTodoStatus(todos.very.id, 'completed');
    advance(60_000);
    session.replaceExcerpt({
      text: 'The laughter was a bark. He shaped the cup.',
      source: {
        kind: 'file',
        sourceUri: `file://${RECALL_ROOT}/drafts/chapter-6-7.md`,
        relativePath: 'drafts/chapter-6-7.md'
      }
    });
    advance(60_000);
    const reply = hostReplyWithFindings(session, 'cadence', 'What now?', findings([
      { text: 'Vary the cadence of the last paragraph.' },
      { text: 'Swap the semicolon for a full stop.', priority: 'low' }
    ]));
    todos.cadence = session.addTodoFromFinding(reply.id, 'finding-1');
    todos.semicolon = session.addTodoFromFinding(reply.id, 'finding-2');
    todos.semicolon = session.setTodoStatus(todos.semicolon.id, 'dismissed');
  }, { fs, idPrefix: 'first' });

  const second = await saveRecallRoom('Cliché pass', (session, advance) => {
    advance(DAY);
    session.setExcerpt({
      text: 'Cold as ice, she waited.',
      source: {
        kind: 'file',
        sourceUri: `file://${RECALL_ROOT}/drafts/chapter-6-7.md`,
        relativePath: 'drafts/chapter-6-7.md'
      }
    });
    session.setSessionScope('excerpt');
    const report = reportWithFindings(session, 'cliche', 'cliche', 'One stale simile in the opening.', findings([
      { text: 'Replace "cold as ice".', priority: 'high' }
    ]));
    todos.cliche = session.addTodoFromFinding(report.id, 'finding-1');
    // A guest joins, but the coordinator cannot save a guest's to-do today
    // (.todo/tech-debt/2026-10-06-workshop-guest-todo-unsavable.md), so the
    // guest source is witnessed with a synthetic session instead.
    session.adoptPersonaGuest('margot', 'conv-margot', []);
    session.beginPersonaGuestMessage('margot', 'margot', 'How does the voice sound?');
    session.completeRun('margot', 'Close and controlled.', undefined, false, 'conv-margot');
  }, { fs, idPrefix: 'second' });

  const third = await saveRecallRoom('Endings chat', (session, advance) => {
    advance(2 * DAY);
    session.setSessionScope('open');
    const reply = hostReplyWithFindings(session, 'endings', 'How do quiet endings work?', findings([
      { text: 'List three quiet endings you admire.' }
    ]));
    todos.endings = session.addTodoFromFinding(reply.id, 'finding-1');
  }, { fs, idPrefix: 'third' });

  return {
    ...third,
    sessionIds: [first.savedSessionId, second.savedSessionId, third.savedSessionId],
    todos: todos as RecallTodoCorpus['todos']
  };
}

/**
 * A room newer than the whole corpus holding `replies` host replies with
 * three promoted findings each, saved into the corpus's workspace: enough
 * to-dos to reach `todoItems` through ordinary use alone.
 */
export async function saveBusyRoom(corpus: RecallTodoCorpus, replies: number): Promise<SavedRecallRoom> {
  return saveRecallRoom('Busy room', (session, advance) => {
    advance(3 * DAY);
    session.setSessionScope('open');
    for (let reply = 1; reply <= replies; reply += 1) {
      const turn = hostReplyWithFindings(session, `busy-${reply}`, `Pass ${reply}?`, findings([
        { text: `Pass ${reply}: tighten the first line.` },
        { text: `Pass ${reply}: cut a filter word.` },
        { text: `Pass ${reply}: check the last beat.` }
      ]));
      for (const finding of turn.actionableFindings!) {
        session.addTodoFromFinding(turn.id, finding.key);
      }
    }
  }, { fs: corpus.fs, idPrefix: 'busy' });
}
