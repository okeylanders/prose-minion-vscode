/**
 * CommonMark fenced-code delimiters, shared by the host and the webview.
 *
 * Fast Generate concatenates independently generated dictionary blocks, and
 * the Dictionary renderer replaces registered fences with components. Both
 * need the same answer to one question: where does a fence end? A fence with
 * no closing delimiter (a token-limited response, a forgotten closer) runs to
 * the end of the document under CommonMark, swallowing whatever follows it.
 */

export interface FenceDelimiter {
  char: '`' | '~';
  length: number;
}

const FENCE_OPENER = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;

/** The delimiter a line opens a fence with, or undefined when it opens none. */
export function parseFenceOpener(line: string): FenceDelimiter | undefined {
  const match = FENCE_OPENER.exec(line);
  if (!match) {
    return undefined;
  }
  const char = match[1][0] as FenceDelimiter['char'];
  // A backtick fence's info string may not itself contain a backtick.
  if (char === '`' && match[2].includes('`')) {
    return undefined;
  }
  return { char, length: match[1].length };
}

/** True when `line` closes a fence opened with `opener`: same character, at least as long, nothing after it. */
export function closesFence(line: string, opener: FenceDelimiter): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  return Boolean(match && match[1][0] === opener.char && match[1].length >= opener.length);
}

/** The delimiter of the fence still open at the end of `markdown`, or undefined when every fence closes. */
export function findUnterminatedFence(markdown: string): FenceDelimiter | undefined {
  let open: FenceDelimiter | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    if (open) {
      if (closesFence(line, open)) {
        open = undefined;
      }
    } else {
      open = parseFenceOpener(line);
    }
  }
  return open;
}

/**
 * Closes a fence left open at the end of `markdown`, so text appended after it
 * (the next independently generated block) stays outside the fence.
 */
export function closeUnterminatedFence(markdown: string): string {
  const open = findUnterminatedFence(markdown);
  return open ? `${markdown}\n${open.char.repeat(open.length)}` : markdown;
}

/**
 * True when a line starts a Markdown section that cannot belong to a fenced
 * block's body: an ATX heading or another fence. Every dictionary section
 * begins with a heading, so an unclosed fence ends no later than the next one.
 */
export function startsMarkdownSection(line: string): boolean {
  return ATX_HEADING.test(line) || parseFenceOpener(line) !== undefined;
}
