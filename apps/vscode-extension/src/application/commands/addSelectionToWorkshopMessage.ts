/**
 * Add Selection to Workshop Message (ADR 2026-11-14 D9, D12).
 *
 * Stages the editor's selection as a "Selected Text" pill above the Workshop
 * composer, for the next message only. It never touches the room's excerpt:
 * that is the other command, "Send to New Workshop Excerpt".
 *
 * - **At the gesture, before anything awaits,** the selection is captured as
 *   a snapshot (`EditorSelectionSnapshots.capture`, through the editor
 *   port). What is staged is that snapshot, whatever the selection is by the
 *   time the Workshop takes it.
 * - **Nothing selected:** the usual warning, and nothing opens.
 * - **The selection travels as a seed** (AGENTS.md, Workshop Seed Delivery):
 *   the Workshop panel is opened or revealed and offered the snapshot's id;
 *   its webview claims it, and only a granted claim stages it.
 * - **The outcome settles the command:** staged says nothing more (the pill
 *   is on screen); a refusal or a failure shows one notice, in these words.
 *
 * This module never imports `vscode`: the composition root passes the host
 * as a port, so these rules are tested without a VS Code mock. Logs and
 * notices name outcomes, never the selection's text, its file or its lines.
 */

import type { WorkshopSeedOutcome } from '@prose-minion/core';

export const ADD_SELECTION_TO_WORKSHOP_MESSAGE_COMMAND = 'prose-minion.addSelectionToWorkshopMessage';

/** What the composition root provides: the snapshot service, the Workshop panel and the window. */
export interface AddSelectionToWorkshopMessageHost {
  /** Whether a text editor has had focus and its document is still open. */
  hasEditor(): boolean;
  /** The selection now, as a snapshot; `undefined` when nothing is selected. Synchronous. */
  capture(): { readonly id: string } | undefined;
  /** Open or reveal the Workshop and offer it the snapshot; settles with its answer. */
  stageSelectedText(snapshotId: string): Promise<WorkshopSeedOutcome>;
  showWarning(message: string): void;
  log(line: string): void;
}

export const ADD_SELECTION_NOTICES = {
  noEditor: 'No active text editor',
  noSelection: 'No text selected',
  busy: 'The Workshop is busy just now. Try adding the selection again in a moment.',
  full: 'The next Workshop message already carries as many attachments as it may. Remove one, then add the selection again.',
  duplicate: 'That selection is already attached to the next Workshop message.',
  notDelivered: 'The selection didn’t reach the Workshop. Try adding it again.'
} as const;

/** The one notice a refusal or failure shows; `undefined` when there is nothing to say. */
export function addSelectionNotice(outcome: WorkshopSeedOutcome): string | undefined {
  if (outcome.opened) {
    return undefined;
  }
  switch (outcome.reason) {
    case 'busy':
      return ADD_SELECTION_NOTICES.busy;
    case 'full':
      return ADD_SELECTION_NOTICES.full;
    case 'duplicate':
      return ADD_SELECTION_NOTICES.duplicate;
    case 'replaced':
      // The writer added a newer selection before this one was taken: that one answers for itself.
      return undefined;
    case 'unavailable':
    case 'closed':
    case 'timeout':
    case 'reset':
      return ADD_SELECTION_NOTICES.notDelivered;
    default: {
      const unhandled: never = outcome.reason;
      return unhandled;
    }
  }
}

export async function addSelectionToWorkshopMessage(host: AddSelectionToWorkshopMessageHost): Promise<void> {
  // The gesture: one synchronous read, before anything awaits.
  const snapshot = host.capture();
  if (!snapshot) {
    host.showWarning(host.hasEditor() ? ADD_SELECTION_NOTICES.noSelection : ADD_SELECTION_NOTICES.noEditor);
    return;
  }
  let outcome: WorkshopSeedOutcome;
  try {
    outcome = await host.stageSelectedText(snapshot.id);
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'error';
    host.log(`[Command] Add Selection to Workshop Message failed (${detail})`);
    host.showWarning(ADD_SELECTION_NOTICES.notDelivered);
    return;
  }
  host.log(`[Command] Add Selection to Workshop Message: ${outcome.opened ? 'staged' : outcome.reason} (snapshot ${snapshot.id})`);
  const notice = addSelectionNotice(outcome);
  if (notice) {
    host.showWarning(notice);
  }
}
