/**
 * The no-line-break-change rule (ADR 2026-10-21 D6; PR #171's write-side
 * hardening): an edit may change the text on a line, never a line break or
 * which line a character stands on.
 */
import { changesLineBreaks } from '@/utils/draftEdit/lineBreaks';

describe('changesLineBreaks', () => {
  it.each([
    ['an edit with no line break', 'teh', 'the'],
    ['an edit beside a line break it keeps', 'end of\n line', 'end of\nline'],
    ['a CRLF line break it keeps', 'a  b\r\nc', 'a b\r\nc'],
    ['no change at all', 'a\nb', 'a\nb']
  ])('allows %s', (_name, original, replacement) => {
    expect(changesLineBreaks(original, replacement)).toBe(false);
  });

  it.each([
    ['adds one', 'afterwards it', 'afterwards,\nit'],
    ['removes one', 'a\nb', 'a b'],
    ['moves one without changing the count', 'foo\nbar', 'fo\nobar'],
    ['moves a character to the next line', 'the\nquick', 'th\nequick'],
    ['turns CRLF into LF', 'a\r\nb', 'a\nb'],
    ['adds a bare carriage return', 'a b', 'a\rb'],
    ['doubles a line break', 'a\nb', 'a\n\nb'],
    // Strict by design: changes on both lines read the same as moving text across the break; two findings can make them.
    ['changes text on both sides of one', 'teh\nquikc', 'the\nquick']
  ])('refuses an edit that %s', (_name, original, replacement) => {
    expect(changesLineBreaks(original, replacement)).toBe(true);
  });
});
