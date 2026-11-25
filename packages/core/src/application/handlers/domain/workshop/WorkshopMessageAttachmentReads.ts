/**
 * The file reads still on their way to staging a message attachment
 * (PR #271 F-01).
 *
 * Picking a file for the next message (`@` in the composer, the project
 * picker, the system picker) starts a read on the host, and the pill is
 * staged only when the read lands. The webview posts the pick and the send
 * in order, but ordered sends are not ordered completions: a send that
 * arrived during the read used to go out without the file, which was then
 * staged for the message after it.
 *
 * The context handler tracks each read here; the send asks `settle()` before
 * it collects the message's attachments.
 */

/** How long a send waits for the reads ahead of it before it is refused and its draft restored. */
export const WORKSHOP_MESSAGE_ATTACHMENT_READ_WAIT_MS = 10_000;

/** The words for a file whose room was replaced during its read; the file is staged nowhere. */
export const WORKSHOP_MESSAGE_ATTACHMENT_ROOM_CHANGED =
  'The room changed while a file was being attached, so it was not attached.';

/** A picked file's read was refused; the writer was already told why in the read's own words. */
export const WORKSHOP_MESSAGE_ATTACHMENT_UNREADABLE = 'The file could not be read.';

/** A send refused whole while a file picked for it was not staged: the draft goes back to the composer. */
export const WORKSHOP_SEND_WITHOUT_ATTACHMENT_REFUSALS = Object.freeze({
  refused: 'Not sent: a file picked for this message could not be attached. Your message is back in the composer; send it again to send it without that file.',
  'still-reading': 'Not sent: a file picked for this message is still being read. Your message is back in the composer; send it again once the file is attached.',
  'room-changed': 'Not sent: the room changed while a file was being attached. Your message is back in the composer.'
});

/** What the reads ahead of a send came to: all staged, one refused (its reason in the host's words), or one still reading at the deadline. */
export type WorkshopMessageAttachmentReadsOutcome =
  | { kind: 'staged' }
  | { kind: 'refused'; reason: string }
  | { kind: 'still-reading' };

export class WorkshopMessageAttachmentReads {
  private readonly byRoom = new Map<number, Set<Promise<string | undefined>>>();

  /**
   * Hold `read` until it settles. It resolves to nothing when every file it
   * named is staged, or to the reason the first one was not. A read that
   * throws counts as refused.
   */
  track(room: number, read: Promise<string | undefined>): Promise<string | undefined> {
    const reads = this.byRoom.get(room) ?? new Set<Promise<string | undefined>>();
    this.byRoom.set(room, reads);
    const tracked = read
      .catch((error: unknown) => (error instanceof Error ? error.message : String(error)))
      .finally(() => {
        reads.delete(tracked);
        if (reads.size === 0) {
          this.byRoom.delete(room);
        }
      });
    reads.add(tracked);
    return tracked;
  }

  pending(room: number): boolean {
    return this.byRoom.has(room);
  }

  /** A send takes only its room's reads at entry, even if a replaced room still has work pending. */
  async settle(room: number, waitMs = WORKSHOP_MESSAGE_ATTACHMENT_READ_WAIT_MS): Promise<WorkshopMessageAttachmentReadsOutcome> {
    const reads = [...(this.byRoom.get(room) ?? [])];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<'still-reading'>((resolve) => {
      timer = setTimeout(() => resolve('still-reading'), waitMs);
    });
    try {
      const settled = await Promise.race([Promise.all(reads), deadline]);
      if (settled === 'still-reading') {
        return { kind: 'still-reading' };
      }
      const reason = settled.find((refusal) => refusal !== undefined);
      return reason === undefined ? { kind: 'staged' } : { kind: 'refused', reason };
    } finally {
      clearTimeout(timer);
    }
  }
}
