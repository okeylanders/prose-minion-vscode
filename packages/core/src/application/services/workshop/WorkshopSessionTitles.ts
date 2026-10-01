/**
 * Named Workshop session titles. A title is a label, never an identity: the
 * session id names a session, and the store keeps file names collision-free.
 */

export const WORKSHOP_SESSION_TITLE_MAX_LENGTH = 160;

const BRANCH_TITLE_SUFFIX = ' — branch';

/** A trimmed, non-blank title within the length limit. */
export function requireWorkshopSessionTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized) {
    throw new Error('Workshop session title cannot be blank.');
  }
  if (normalized.length > WORKSHOP_SESSION_TITLE_MAX_LENGTH) {
    throw new Error(
      `Workshop session titles are limited to ${WORKSHOP_SESSION_TITLE_MAX_LENGTH} characters.`
    );
  }
  return normalized;
}

/**
 * A branch's default title (ADR 2026-09-30, D3): `"<source title> — branch"`,
 * renamable afterwards. A long source title is trimmed so the suffix still
 * fits, and never mid-way through a surrogate pair.
 */
export function workshopBranchTitle(sourceTitle: string): string {
  const room = WORKSHOP_SESSION_TITLE_MAX_LENGTH - BRANCH_TITLE_SUFFIX.length;
  let base = sourceTitle.trim();
  if (base.length > room) {
    base = base.slice(0, room);
    if (/[\uD800-\uDBFF]$/.test(base)) {
      base = base.slice(0, -1);
    }
    base = base.trimEnd();
  }
  return requireWorkshopSessionTitle(`${base}${BRANCH_TITLE_SUFFIX}`);
}
