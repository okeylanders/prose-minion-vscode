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

/** "about 23,400 words": hundreds from a thousand up, tens below. */
function aboutWords(words: number): string {
  const step = words >= 1000 ? 100 : 10;
  const rounded = Math.round(words / step) * step;
  const shown = rounded > 0 ? rounded : words;
  return `about ${shown.toLocaleString('en-US')} ${shown === 1 ? 'word' : 'words'}`;
}

const filesLabel = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'}`;

/** The sentence after the opening, for a seed that meant to attach something. */
function seedSentence(opening: string, joined: string, seed: WorkshopRoomSeedReport): string {
  if (seed.leftOut.length === 0) {
    return `${opening}${joined} your pinned context: ` +
      `${filesLabel(seed.attachedCount)}, ${aboutWords(seed.attachedWords)}.`;
  }
  const notAttached = seed.leftOut
    .map((entry) => `${entry.label} (${leftOutReason(entry.reason)})`)
    .join(', ');
  return `${opening}. ${seed.attachedCount} of ${seed.pinnedCount} pinned ` +
    `${seed.pinnedCount === 1 ? 'file' : 'files'} attached; not attached: ${notAttached}.`;
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
      return seed && !isEmptyWorkshopRoomSeedReport(seed)
        ? seedSentence(
            'Started a new Workshop session with the excerpt and context cleared',
            ' and',
            seed
          )
        : 'Started an empty Workshop session — excerpt and context cleared.';
    case 'carry':
      return seed && !isEmptyWorkshopRoomSeedReport(seed)
        ? seedSentence('Started a new Workshop session', ' with', seed)
        : 'Started a new Workshop session.';
  }
}

/** The seed's counts for the log: never a label. */
function seedLogPart(seed: WorkshopRoomSeedReport | undefined): string {
  if (!seed || isEmptyWorkshopRoomSeedReport(seed)) {
    return '';
  }
  const reasons = (['missing', 'unreadable', 'over-budget'] as const)
    .map((reason) => [reason, seed.leftOut.filter((entry) => entry.reason === reason).length] as const)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(',');
  return `; pinned: attached=${seed.attachedCount}/${seed.pinnedCount}, ` +
    `words=${seed.attachedWords}, leftOut=${reasons || 'none'}`;
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
