/**
 * Which of a room's attachments are pinned (ADR 2026-11-04 D4). Pure and
 * shared: the host's room seed (Slice 2b), the tab's hook (Slice 3) and the
 * pill's mark (Slice 4) all ask this one rule, so "pinned" is derived from
 * the list as it reads now and never stored in a session.
 */

import type { WorkshopContextAttachmentSnapshot } from '@messages';
import {
  workshopPinnedContextPathKey,
  type WorkshopPinnedContextEntry,
  type WorkshopPinnedContextPathPlatform
} from '@shared/types/workshopPinnedContext';

/** What the rule reads of an attachment: its kind and the two paths it may carry. */
export type WorkshopPinnedContextAttachmentPaths = Pick<
  WorkshopContextAttachmentSnapshot,
  'kind' | 'relativePath' | 'configuredResource'
>;

/**
 * An attachment's path as an entry's is written, then compared by Slice 1's
 * key. On Windows `\` is a separator, so it reads as `/`; on POSIX it is a
 * legal file-name character and stays as written, so `Characters\alice.md`
 * is never `Characters/alice.md` there (PR #208 F02).
 */
function attachmentPathKey(attachmentPath: string, platform: WorkshopPinnedContextPathPlatform): string {
  const separated = platform === 'windows' ? attachmentPath.replace(/\\/g, '/') : attachmentPath;
  return workshopPinnedContextPathKey(separated, platform);
}

/**
 * Whether `attachment` is the file `entry` pins: its catalog key's path is
 * the entry's path or, failing that, its `relativePath` is. Only file
 * attachments match; a text note is never pinned. Paths compare by
 * `workshopPinnedContextPathKey` (NFC, and case-folded on Windows).
 */
export function workshopPinnedContextMatches(
  entry: WorkshopPinnedContextEntry,
  attachment: WorkshopPinnedContextAttachmentPaths,
  platform: WorkshopPinnedContextPathPlatform
): boolean {
  if (attachment.kind !== 'file') {
    return false;
  }
  const wanted = workshopPinnedContextPathKey(entry.path, platform);
  if (attachment.configuredResource && attachmentPathKey(attachment.configuredResource.path, platform) === wanted) {
    return true;
  }
  return attachment.relativePath !== undefined && attachmentPathKey(attachment.relativePath, platform) === wanted;
}
