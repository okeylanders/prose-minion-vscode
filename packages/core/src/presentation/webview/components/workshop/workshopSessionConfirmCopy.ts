/** Writer-facing copy for the Workshop's one session confirmation dialog. */

import type {
  WorkshopSessionConfirm
} from '@hooks/domain/workshop/controllers/useWorkshopSessionSurfaces';

export interface WorkshopSessionConfirmCopy {
  title: string;
  body: string;
  confirmLabel: string;
}

const REWIND_KEEPS =
  'Your excerpt and context stay as they are now. To keep this conversation too, use Branch instead.';

const turnsLabel = (count: number): string => `${count} ${count === 1 ? 'turn' : 'turns'}`;

export function workshopSessionConfirmCopy(
  confirm: WorkshopSessionConfirm | null,
  context: { shelvedExcerptTitle?: string }
): WorkshopSessionConfirmCopy {
  switch (confirm?.kind) {
    case 'open':
      return {
        title: `Open “${confirm.title}”?`,
        body: 'Your current Workshop room will be replaced.',
        confirmLabel: 'Open session'
      };
    case 'new-full':
      return {
        title: 'Clear the excerpt and context?',
        body: 'This starts an empty room: the excerpt, anything on the shelf, every ' +
          'context attachment, the thread, tasks, guests, and conversation memory ' +
          'are all cleared. Saved sessions on disk are not touched.',
        confirmLabel: 'Clear everything'
      };
    case 'replace-shelf':
      return {
        title: 'Replace the passage you set aside?',
        body: `“${context.shelvedExcerptTitle ?? 'The set-aside passage'}” was typed or pasted ` +
          'straight into the room, so the shelf is the only place it exists — ' +
          'pinning a new excerpt discards it for good. To bring it back instead, ' +
          'cancel and use “Re-pin”. Your conversation is kept either way.',
        confirmLabel: 'Discard and pin a new one'
      };
    case 'rewind':
      return confirm.edit
        ? {
            title: 'Edit this message?',
            body: (confirm.removedCount > 1
              ? `This message and ${turnsLabel(confirm.removedCount - 1)} after it will be removed. `
              : 'This message will be removed. ') +
              'Its text returns to the composer so you can edit it and send it again. ' +
              REWIND_KEEPS,
            confirmLabel: 'Rewind and edit'
          }
        : {
            title: 'Rewind to here?',
            body: `${turnsLabel(confirm.removedCount)} will be removed. ${REWIND_KEEPS}`,
            confirmLabel: 'Rewind'
          };
    case 'new':
    case undefined:
      return {
        title: 'Start a new session?',
        body: 'The pinned excerpt and standing context stay; the thread, tasks, ' +
          'guests, and conversation memory reset.',
        confirmLabel: 'New session'
      };
  }
}
