/**
 * The session browser's rows for locked sessions (ADR 2026-11-19 D6e):
 * a locked session's row reads busy or recovery-required, never omitted.
 *
 * - A listed session whose file has a lock beside it carries that lock's
 *   state.
 * - A session whose file is claimed into its lock (no saved file) is listed
 *   from the copy its owner left, `prior.json` first, then `next.json`,
 *   under its saved name. With a query, it is listed only when its title
 *   holds the query (case folded): its content is not searched.
 * - Read-only: nothing in a lock is moved.
 */

import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { workshopStoredSessionSummary, type WorkshopStoredSessionSummary } from '@/infrastructure/storage/WorkshopSessionSearchIndexV1';
import type { WorkshopNamedSessionLockRow } from '@/infrastructure/storage/WorkshopNamedSessionLock';

export async function withWorkshopNamedSessionLocks(
  sessions: readonly WorkshopStoredSessionSummary[],
  rows: readonly WorkshopNamedSessionLockRow[],
  query: string | undefined,
  read: (filePath: string, fileName: string) => Promise<WorkshopPersistedSessionV2 | undefined>
): Promise<WorkshopStoredSessionSummary[]> {
  const byFile = new Map(rows.map((row) => [row.fileName, row]));
  const listed = sessions.map((session) => {
    const row = byFile.get(session.fileName);
    return row ? { ...session, lock: row.state } : session;
  });
  const ids = new Set(listed.map((session) => session.sessionId));
  const files = new Set(listed.map((session) => session.fileName));
  for (const row of rows.filter((candidate) => !files.has(candidate.fileName))) {
    const copy = [...row.copies].sort((left, right) => (left.kind === right.kind ? 0 : left.kind === 'prior' ? -1 : 1))[0];
    const session = copy ? await read(copy.path, copy.kind).catch(() => undefined) : undefined;
    if (!session || ids.has(session.sessionId) || (query && !session.title.toLowerCase().includes(query.toLowerCase()))) {
      continue;
    }
    ids.add(session.sessionId);
    listed.push({ ...workshopStoredSessionSummary(session, row.fileName), lock: row.state });
  }
  return listed;
}
