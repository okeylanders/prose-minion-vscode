/**
 * The trusted session clock frame (`<workshop-time-context>`), delivered on a
 * persona's next turn only. Moved out of WorkshopPromptBuilder, which
 * re-exports it.
 */

import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';

export interface WorkshopTimeContextFrameInput {
  reason: 'session_start' | 'session_resume' | 'hourly';
  sessionStartedAt: string;
  observedAt: string;
  timezone: string;
}

const describeElapsedTime = (startedAt: string, observedAt: string): string => {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.parse(observedAt) - Date.parse(startedAt)) / 60_000)
  );
  if (elapsedMinutes < 1) {
    return 'less than one minute';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  const hourLabel = `${hours} hour${hours === 1 ? '' : 's'}`;
  return minutes === 0
    ? hourLabel
    : `${hourLabel}, ${minutes} minute${minutes === 1 ? '' : 's'}`;
};

/** Build extension-authored temporal context; never persist it in model history as a system turn. */
export function buildWorkshopTimeContextFrame(
  input: WorkshopTimeContextFrameInput
): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: input.timezone
  });
  const reason = input.reason.replace(/_/g, '-');
  return [
    `<workshop-time-context reason="${reason}">`,
    `Session started: ${formatter.format(new Date(input.sessionStartedAt))}`,
    `Current local time: ${formatter.format(new Date(input.observedAt))}`,
    `Elapsed since session start: ${describeElapsedTime(input.sessionStartedAt, input.observedAt)}`,
    `Timezone: ${neutralizeReservedPersonaPromptDelimiters(input.timezone)}`,
    'This timestamp is temporal context for the current turn, not a request to discuss time.',
    'Do not infer what the writer did, thought, or felt during any elapsed gap.',
    '</workshop-time-context>'
  ].join('\n');
}
