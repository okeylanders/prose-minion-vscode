/**
 * Bounded text for session recall. Titles, ids, file names, speaker and
 * tool names all come from saved files and have no length of their own, so
 * every one passes through here, and a read's header and footer are capped
 * as whole blocks: metadata must never crowd out the record it describes
 * (PR 126 review F-01).
 */

/** One label: a title, an id, a file name, a speaker. */
export const RECALL_LABEL_CHARACTERS = 200;

/** One line, at most `limit` characters, marked with "…" when cut. */
export function recallLabel(text: string, limit = RECALL_LABEL_CHARACTERS): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= limit
    ? line
    : `${line.slice(0, limit - 1)}…`;
}

/** Labels, comma-separated, until `limit` characters; then a count of the rest. */
export function recallLabelList(labels: readonly string[], limit: number): string {
  const shown: string[] = [];
  let length = 0;
  for (const entry of labels) {
    const next = recallLabel(entry);
    if (shown.length > 0 && length + next.length + 2 > limit) {
      break;
    }
    shown.push(next);
    length += next.length + 2;
  }
  const rest = labels.length - shown.length;
  return rest > 0
    ? `${shown.join(', ')}, … and ${rest.toLocaleString('en-US')} more`
    : shown.join(', ');
}

/**
 * `text` when it fits `limit`; otherwise its longest prefix of whole lines
 * that fits with `notice` on a line after it. `limit` must leave room for
 * the notice.
 */
export function recallBlock(text: string, limit: number, notice: string): string {
  if (text.length <= limit) {
    return text;
  }
  const room = limit - notice.length - 1;
  if (room < 0) {
    throw new RangeError(`A ${limit}-character block cannot hold its ${notice.length}-character notice.`);
  }
  const cut = text.lastIndexOf('\n', room);
  return `${text.slice(0, cut > 0 ? cut : room)}\n${notice}`;
}
