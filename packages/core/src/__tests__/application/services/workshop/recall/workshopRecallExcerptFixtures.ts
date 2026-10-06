/**
 * Session-recall excerpt fixtures (Slice 2C): REAL chats on one excerpt,
 * built through the real aggregate and saved through the real coordinator
 * and store, for "summarize the chats on chapter-6.7, what's left."
 *
 * Three sessions are on chapter 6.7: one matches by excerpt label only, one
 * by title only, one by both. A fourth, on chapter 6.8, is the decoy. Every
 * tool report carries a sentinel in its body, so a discussion-detail read can
 * prove it never shows one; every persona reply and writer message carries a
 * discussion marker, so the read can prove each one appears in full.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopActionableFinding, WorkshopTodoItem, WorkshopToolId } from '@messages';
import {
  RECALL_ROOT,
  saveRecallRoom,
  SavedRecallRoom
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { reportWithFindings } from '@/__tests__/application/services/workshop/recall/workshopRecallTodoFixtures';

export const EXCERPT_SENTINELS = {
  /** In every tool report's body: a discussion-detail read never shows one. */
  toolReportBody: 'SENTINEL-TOOL-REPORT-BODY',
  /** In everything the 6.8 decoy says: no 6.7 call returns any of it. */
  decoy: 'SENTINEL-DECOY'
} as const;

const DAY = 24 * 60 * 60_000;
const MINUTE = 60_000;

/** A report of about `words` words: long, like a real one, and marked. */
export function reportBody(label: string, words: number): string {
  const sentence = 'The beat lands on a stock gesture where a signature move would carry it. ';
  const sentenceWords = sentence.trim().split(/\s+/).length;
  return `${EXCERPT_SENTINELS.toolReportBody} ${label}. ${sentence.repeat(Math.ceil(words / sentenceWords))}`.trim();
}

/** The chats, oldest first, with the to-dos and markers each one holds. */
export interface RecallExcerptCorpus extends SavedRecallRoom {
  readonly sessions: {
    /** “Stock & signature” on chapter-6.7-draft.md: an excerpt-only match. */
    readonly stock: string;
    /** “Chapter 6.8 bridge” on chapter-6.8.md: the decoy. */
    readonly decoy: string;
    /** “Chapter 6.7 cliché pass” on chapter-6.7-draft.md: title and excerpt match. */
    readonly cliche: string;
    /** “Chapter 6.7 endings”, an open conversation: a title-only match. */
    readonly endings: string;
  };
  /** Each 6.7 chat's discussion: the writer's messages and the persona replies, verbatim. */
  readonly discussion: Readonly<Record<'stock' | 'cliche' | 'endings', readonly string[]>>;
  /** Tool reports per 6.7 chat, with their visible bodies. */
  readonly reports: Readonly<Record<'stock' | 'cliche', ReadonlyArray<{ readonly toolLabel: string; readonly body: string }>>>;
  readonly todos: {
    readonly stock: WorkshopTodoItem;
    readonly cliche: WorkshopTodoItem;
    readonly endings: WorkshopTodoItem;
    readonly decoy: WorkshopTodoItem;
  };
}

const finding = (text: string): WorkshopActionableFinding[] => [{ key: 'finding-1', text, ordinal: 1 }];

function pinExcerpt(session: WorkshopSessionService, relativePath: string, text: string): void {
  session.setExcerpt({
    text,
    source: { kind: 'file', sourceUri: `file://${RECALL_ROOT}/${relativePath}`, relativePath }
  });
  session.setSessionScope('excerpt');
}

/** A writer question, then the host's reply; both are discussion. */
function exchange(
  session: WorkshopSessionService,
  advance: (milliseconds: number) => void,
  requestId: string,
  question: string,
  reply: string,
  said: string[]
): void {
  advance(MINUTE);
  session.beginPersonaMessage(requestId, question);
  advance(MINUTE);
  session.completeRun(requestId, reply, undefined, false, 'runtime-host');
  said.push(question, reply);
}

/** A tool run, its report, and the host's synthesis of it. */
function reportAndSynthesis(
  session: WorkshopSessionService,
  advance: (milliseconds: number) => void,
  toolId: WorkshopToolId,
  requestId: string,
  body: string,
  synthesis: string,
  said: string[]
) {
  advance(MINUTE);
  const report = reportWithFindings(session, toolId, requestId, body, finding(`Revise after ${requestId}.`));
  advance(MINUTE);
  session.beginPersonaSynthesis(`${requestId}-synthesis`, report.id);
  session.completeRun(`${requestId}-synthesis`, synthesis, undefined, false, 'runtime-host');
  said.push(synthesis);
  return report;
}

/** Tool runs per report-heavy 6.7 chat. */
export const EXCERPT_REPORT_PASSES = 5;

/**
 * Save the four chats into one workspace. `reportWords` sizes every tool
 * report: at the default, five 3,000-word reports make each report-heavy
 * chat's full transcript about 80,000 characters, so the three 6.7 chats
 * together overflow a 150,000-character read in full detail.
 */
export async function saveExcerptCorpus(options: { reportWords?: number } = {}): Promise<RecallExcerptCorpus> {
  const fs = new MemoryFileSystem();
  const words = options.reportWords ?? 3_000;
  const discussion = { stock: [] as string[], cliche: [] as string[], endings: [] as string[] };
  const reports = { stock: [] as Array<{ toolLabel: string; body: string }>, cliche: [] as Array<{ toolLabel: string; body: string }> };
  const todos: Partial<Record<keyof RecallExcerptCorpus['todos'], WorkshopTodoItem>> = {};

  const stock = await saveRecallRoom('Stock & signature', (session, advance) => {
    pinExcerpt(session, 'drafts/chapter-6.7-draft.md', 'The laughter was raucous. He shapped the cup.');
    exchange(session, advance, 'ask-1', 'DISCUSSION-STOCK-1: where does the scene go generic?',
      'DISCUSSION-STOCK-2: the laughter and the cup both lean on stock beats.', discussion.stock);
    for (let pass = 1; pass <= EXCERPT_REPORT_PASSES; pass += 1) {
      const body = reportBody(`stock pass ${pass}`, words);
      const report = reportAndSynthesis(session, advance, 'stock-and-signature', `stock-${pass}`, body,
        `DISCUSSION-STOCK-SYNTHESIS-${pass}: pass ${pass} says start with the laughter.`, discussion.stock);
      reports.stock.push({ toolLabel: 'Stock & Signature', body });
      if (pass === 1) {
        todos.stock = session.addTodoFromFinding(report.id, 'finding-1');
      }
    }
  }, { fs, idPrefix: 'stock' });

  const decoy = await saveRecallRoom('Chapter 6.8 bridge', (session, advance) => {
    advance(DAY);
    pinExcerpt(session, 'drafts/chapter-6.8.md', 'The bridge held.');
    const said: string[] = [];
    exchange(session, advance, 'decoy-ask', `${EXCERPT_SENTINELS.decoy}: does the bridge scene work?`,
      `${EXCERPT_SENTINELS.decoy}: mostly.`, said);
    const report = reportAndSynthesis(session, advance, 'cliche', 'decoy-cliche',
      `${EXCERPT_SENTINELS.decoy} ${reportBody('decoy', 200)}`, `${EXCERPT_SENTINELS.decoy}: one cliché.`, said);
    todos.decoy = session.addTodoFromFinding(report.id, 'finding-1');
  }, { fs, idPrefix: 'decoy' });

  const cliche = await saveRecallRoom('Chapter 6.7 cliché pass', (session, advance) => {
    advance(2 * DAY);
    pinExcerpt(session, 'drafts/chapter-6.7-draft.md', 'Cold as ice, she waited.');
    for (let pass = 1; pass <= EXCERPT_REPORT_PASSES; pass += 1) {
      const body = reportBody(`cliche pass ${pass}`, words);
      const report = reportAndSynthesis(session, advance, 'cliche', `cliche-${pass}`, body,
        `DISCUSSION-CLICHE-SYNTHESIS-${pass}: pass ${pass} flags the simile.`, discussion.cliche);
      reports.cliche.push({ toolLabel: 'Cliché', body });
      if (pass === 1) {
        todos.cliche = session.addTodoFromFinding(report.id, 'finding-1');
      }
    }
    exchange(session, advance, 'ask-2', 'DISCUSSION-CLICHE-1: which simile goes first?',
      'DISCUSSION-CLICHE-2: “cold as ice”; it carries the least.', discussion.cliche);
  }, { fs, idPrefix: 'cliche' });

  const endings = await saveRecallRoom('Chapter 6.7 endings', (session, advance) => {
    advance(3 * DAY);
    session.setSessionScope('open');
    advance(MINUTE);
    const question = 'DISCUSSION-ENDINGS-1: how should 6.7 end?';
    session.beginPersonaMessage('endings-1', question);
    const answer = 'DISCUSSION-ENDINGS-HOST: quietly, on an image.';
    const reply = session.completeRun('endings-1', answer, undefined, false, 'runtime-host',
      finding('Draft two quiet endings for 6.7.'))!;
    discussion.endings.push(question, answer);
    todos.endings = session.addTodoFromFinding(reply.id, 'finding-1');
    // A guest reply is persona discussion too, and appears in full.
    session.adoptPersonaGuest('margot', 'conv-margot', []);
    advance(MINUTE);
    const guestQuestion = 'DISCUSSION-ENDINGS-2: Margot, a second opinion?';
    session.beginPersonaGuestMessage('margot', 'margot', guestQuestion);
    const guestReply = 'DISCUSSION-ENDINGS-3: end on the cup, not the laughter.';
    session.completeRun('margot', guestReply, undefined, false, 'conv-margot');
    discussion.endings.push(guestQuestion, guestReply);
  }, { fs, idPrefix: 'endings' });

  return {
    ...endings,
    sessions: {
      stock: stock.savedSessionId,
      decoy: decoy.savedSessionId,
      cliche: cliche.savedSessionId,
      endings: endings.savedSessionId
    },
    discussion,
    reports,
    todos: todos as RecallExcerptCorpus['todos']
  };
}
