/**
 * What the writer and the log are told when a new Workshop room starts (ADR
 * 2026-11-04 D7). Pure, so `WorkshopSessionMessageHandler` only reads the
 * start, calls the coordinator, and posts these.
 */

import type {
  WorkshopResetSummary
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import {
  isEmptyWorkshopRoomSeedReport,
  type WorkshopRoomSeedLeftOutReason,
  type WorkshopRoomSeedReport
} from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_SESSION_STARTS, type WorkshopSessionStart } from '@messages';

/** The start a reset request names, or undefined when it names none we know. */
export function workshopSessionStartOf(payload: unknown): WorkshopSessionStart | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  const start = (payload as { start?: unknown }).start;
  return WORKSHOP_SESSION_STARTS.find((known) => known === start);
}

/** The refusal for a reset request with a missing or unknown `start`. */
export const WORKSHOP_SESSION_START_REFUSAL =
  'Couldn’t start a new session: the request didn’t say how to start it.';

function leftOutReason(reason: WorkshopRoomSeedLeftOutReason): string {
  switch (reason) {
    case 'missing':
      return 'not found';
    case 'unreadable':
      return 'couldn’t be read';
    case 'over-budget':
      return `doesn’t fit in the ${PROMPT_BUDGETS.contextAttachments.words.toLocaleString('en-US')}-word context limit`;
  }
}

/** Why a carried file's re-read was left out: what is true of the file now. */
function keptReason(reason: WorkshopRoomSeedLeftOutReason): string {
  switch (reason) {
    case 'missing':
      return 'not found now';
    case 'unreadable':
      return 'couldn’t be read now';
    case 'over-budget':
      return `its current version doesn’t fit in the ${PROMPT_BUDGETS.contextAttachments.words.toLocaleString('en-US')}-word context limit`;
  }
}

/** "about 23,400 words": hundreds from a thousand up, tens below. */
function aboutWords(words: number): string {
  const step = words >= 1000 ? 100 : 10;
  const rounded = Math.round(words / step) * step;
  const shown = rounded > 0 ? rounded : words;
  return `about ${shown.toLocaleString('en-US')} ${shown === 1 ? 'word' : 'words'}`;
}

const filesLabel = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'}`;

/**
 * Whether the report has anything to say: files it meant to attach, or the
 * list itself left out (an unreadable `pinned-context.json` plans no file,
 * so its `pinnedCount` is 0, but the writer is told why nothing came).
 */
function seedSays(seed: WorkshopRoomSeedReport | undefined): seed is WorkshopRoomSeedReport {
  return seed !== undefined && (!isEmptyWorkshopRoomSeedReport(seed) || seed.leftOut.length > 0);
}

/** The sentence after the opening, for a seed that has something to say. */
function seedSentence(opening: string, joined: string, seed: WorkshopRoomSeedReport): string {
  if (seed.pinnedCount === 0) {
    const listed = seed.leftOut.map((entry) => `${entry.label} (${leftOutReason(entry.reason)})`).join(', ');
    return `${opening}. No pinned context attached: ${listed}.`;
  }
  if (seed.leftOut.length === 0) {
    return `${opening}${joined} your pinned context: ` +
      `${filesLabel(seed.attachedCount)}, ${aboutWords(seed.attachedWords)}.`;
  }
  // A kept file is still in the room, with its earlier body: never "not attached".
  const clauses = [
    ['not attached', seed.leftOut.filter((entry) => !entry.kept).map((entry) => `${entry.label} (${leftOutReason(entry.reason)})`)],
    ['kept as it was', seed.leftOut.filter((entry) => entry.kept).map((entry) => `${entry.label} (${keptReason(entry.reason)})`)]
  ] as const;
  const said = clauses
    .filter(([, entries]) => entries.length > 0)
    .map(([lead, entries]) => `${lead}: ${entries.join(', ')}`)
    .join('; ');
  return `${opening}. ${seed.attachedCount} of ${seed.pinnedCount} pinned ` +
    `${seed.pinnedCount === 1 ? 'file' : 'files'} attached; ${said}.`;
}

/** The writer's result line for a room that started. */
export function workshopSessionStartResult(
  start: WorkshopSessionStart,
  seed?: WorkshopRoomSeedReport
): string {
  switch (start) {
    case 'empty':
      return 'Started an empty Workshop session: excerpt and context cleared, and pinned context left out.';
    case 'full-reset':
      return seedSays(seed)
        ? seedSentence(
            'Started a new Workshop session with the excerpt and context cleared',
            ' and',
            seed
          )
        : 'Started an empty Workshop session — excerpt and context cleared.';
    case 'carry':
      return seedSays(seed)
        ? seedSentence('Started a new Workshop session', ' with', seed)
        : 'Started a new Workshop session.';
  }
}

/** The seed's counts for the log: never a label. */
function seedLogPart(seed: WorkshopRoomSeedReport | undefined): string {
  if (!seedSays(seed)) {
    return '';
  }
  const reasons = (['missing', 'unreadable', 'over-budget'] as const)
    .map((reason) => [reason, seed.leftOut.filter((entry) => !entry.kept && entry.reason === reason).length] as const)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(',');
  const kept = seed.leftOut.filter((entry) => entry.kept).length;
  return `; pinned: attached=${seed.attachedCount}/${seed.pinnedCount}, ` +
    `words=${seed.attachedWords}, leftOut=${reasons || 'none'}, kept=${kept}`;
}

/**
 * The handler's log line: today's, with the start and the seed's counts.
 * A clearing start still names what it cleared, as it did before pinned
 * context, because "it deleted my context" is otherwise unanswerable.
 */
export function workshopSessionStartLog(
  start: WorkshopSessionStart,
  summary: WorkshopResetSummary
): string {
  const cleared = start === 'carry'
    ? ''
    : ` — excerpt: ${summary.excerptLabel ?? 'none'}; context cleared: ` +
      (summary.attachmentLabels.length > 0 ? summary.attachmentLabels.join(', ') : 'none');
  return '[WorkshopSessionMessageHandler] Session reset and current checkpoint replaced ' +
    `(start=${start}${cleared}${seedLogPart(summary.seed)})`;
}
