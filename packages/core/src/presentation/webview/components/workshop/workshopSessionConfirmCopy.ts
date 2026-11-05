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

/** "the 10 pinned files are" / "the pinned file is". */
const pinnedFilesLabel = (count: number): string =>
  count === 1 ? 'the pinned file is' : `the ${count} pinned files are`;

export function workshopSessionConfirmCopy(
  confirm: WorkshopSessionConfirm | null,
  context: {
    shelvedExcerptTitle?: string;
    /** Pinned files (Pinned Context Slice 3): above 0, a full reset starts with them. */
    pinnedFileCount?: number;
  }
): WorkshopSessionConfirmCopy {
  switch (confirm?.kind) {
    case 'open':
      return {
        title: `Open “${confirm.title}”?`,
        body: 'Your current Workshop room will be replaced.',
        confirmLabel: 'Open session'
      };
    case 'new-full':
      return (context.pinnedFileCount ?? 0) > 0
        ? {
            title: 'Clear the excerpt and context?',
            body: 'This starts a new room with your pinned context: the excerpt, anything on the shelf, ' +
              'every context attachment, the thread, tasks, guests, and conversation memory are all ' +
              `cleared, then ${pinnedFilesLabel(context.pinnedFileCount ?? 0)} attached. ` +
              'Saved sessions on disk are not touched.',
            confirmLabel: 'Clear everything'
          }
        : {
            title: 'Clear the excerpt and context?',
            body: 'This starts an empty room: the excerpt, anything on the shelf, every ' +
              'context attachment, the thread, tasks, guests, and conversation memory ' +
              'are all cleared. Saved sessions on disk are not touched.',
            confirmLabel: 'Clear everything'
          };
    case 'new-empty':
      return {
        title: 'Clear the excerpt and context?',
        body: 'This starts an empty room, with pinned context left out: the excerpt, ' +
          'anything on the shelf, every context attachment, the thread, tasks, guests, ' +
          'and conversation memory are all cleared. Saved sessions on disk are not touched.',
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
              (confirm.edit === 'widget'
                ? 'Its widget reopens so you can adjust it and send it again. '
                : 'Its text returns to the composer so you can edit it and send it again. ') +
              REWIND_KEEPS,
            confirmLabel: 'Rewind and edit'
          }
        : {
            title: 'Rewind to here?',
            body: `${turnsLabel(confirm.removedCount)} will be removed. ${REWIND_KEEPS}`,
            confirmLabel: 'Rewind'
          };
    case 'save-before-branch':
      return {
        title: 'Save before branching',
        body: 'Branching creates a new session from this point. ' +
          "Save this session first so it isn't replaced.",
        confirmLabel: 'Save session…'
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
