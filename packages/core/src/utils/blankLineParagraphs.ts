/**
 * The blank-line paragraph rule (ADR 2026-10-19 D4). Pure: no host, no I/O.
 *
 * A paragraph is a run of text between blank lines (`/\n\s*\n/`), the rule
 * PassageProseStats counts paragraphs with. Each is trimmed, and its offsets
 * bound the trimmed text exactly in the text as it was read. A run of only
 * white space is no paragraph.
 *
 * The Lightbox's paragraph model numbers these (`splitLightboxParagraphs`,
 * whose rule id it keeps), and Draft Edit finds a chapter's sections from
 * them (Slice 3c part 4): one rule, so a section means the same thing in both.
 */

export interface BlankLineParagraph {
  /** Trimmed. */
  readonly text: string;
  /** UTF-16 offset of the paragraph's first non-space character. */
  readonly start: number;
  /** Offset just past its last non-space character. */
  readonly end: number;
}

/** Split `text` into its blank-line paragraphs, in order. */
export function splitBlankLineParagraphs(text: string): BlankLineParagraph[] {
  const paragraphs: BlankLineParagraph[] = [];
  // A fresh literal per call, so the global regex's lastIndex is never shared.
  const paragraphBreak = /\n\s*\n/g;
  let chunkStart = 0;
  let match: RegExpExecArray | null;
  while ((match = paragraphBreak.exec(text)) !== null) {
    pushParagraph(text, chunkStart, match.index, paragraphs);
    chunkStart = match.index + match[0].length;
  }
  pushParagraph(text, chunkStart, text.length, paragraphs);
  return paragraphs;
}

function pushParagraph(text: string, from: number, to: number, paragraphs: BlankLineParagraph[]): void {
  const chunk = text.slice(from, to);
  const trimmed = chunk.trim();
  if (trimmed.length === 0) {
    return;
  }
  const start = from + (chunk.length - chunk.trimStart().length);
  paragraphs.push({ text: trimmed, start, end: start + trimmed.length });
}
