/**
 * Named Workshop session titles. A title is a label, never an identity: the
 * session id names a session, and the store keeps file names collision-free.
 */

export const WORKSHOP_SESSION_TITLE_MAX_LENGTH = 160;

const BRANCH_TITLE_SUFFIX = ' — branch';
const BRANCH_TITLE_SUFFIX_PATTERN = / — branch(?: ([1-9]\d*))?$/;

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
 * A branch's default title (ADR 2026-09-30, D3): `"<source title> — branch"`.
 * Nested branches increment that suffix rather than repeat it; repeated
 * suffixes from earlier naming count toward the same number. A long source
 * title is trimmed so the suffix fits, never mid-way through a surrogate pair.
 */
export function workshopBranchTitle(sourceTitle: string): string {
  let base = sourceTitle.trim();
  let branchNumber = 1n;
  let existingSuffix = BRANCH_TITLE_SUFFIX_PATTERN.exec(base);
  while (existingSuffix) {
    branchNumber += BigInt(existingSuffix[1] ?? '1');
    base = base.slice(0, existingSuffix.index).trimEnd();
    existingSuffix = BRANCH_TITLE_SUFFIX_PATTERN.exec(base);
  }
  const suffix = branchNumber === 1n
    ? BRANCH_TITLE_SUFFIX
    : `${BRANCH_TITLE_SUFFIX} ${branchNumber}`;
  const room = WORKSHOP_SESSION_TITLE_MAX_LENGTH - suffix.length;
  if (base.length > room) {
    base = base.slice(0, room);
    if (/[\uD800-\uDBFF]$/.test(base)) {
      base = base.slice(0, -1);
    }
    base = base.trimEnd();
  }
  return requireWorkshopSessionTitle(`${base}${suffix}`);
}
