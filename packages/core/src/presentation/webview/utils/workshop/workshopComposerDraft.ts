/**
 * The draft after a seed. A starter replaces it. A text the host gives back
 * (`keepDraft`) fills an empty composer, and otherwise is put ahead of what
 * the writer has typed since: neither text is ever lost (PR #264 P2).
 */
export function workshopComposerDraftAfterSeed(
  current: string,
  seed: { text: string; keepDraft?: boolean },
  selection?: { before: string; start: number; end: number }
): string {
  if (selection) {
    // A staged paste comes back asynchronously. A selection can include typing made since the request.
    const end = selection.before === current ? selection.end : selection.start;
    return current.slice(0, selection.start) + seed.text + current.slice(end);
  }
  if (!seed.keepDraft || current.trim().length === 0) {
    return seed.text;
  }
  return seed.text.trim().length === 0 ? current : `${seed.text}\n\n${current}`;
}
