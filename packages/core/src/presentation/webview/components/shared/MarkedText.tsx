/**
 * MarkedText — text with stretches of it marked (`<mark>`), as a search
 * shows its hits.
 *
 * The text is rendered as React text nodes, cut at the ranges given, so
 * whatever it holds is shown as written and never read as markup. Ranges are
 * offsets into `text`, ascending and not overlapping (what
 * `findFoldedMatches` returns); one that is empty, out of order or out of
 * bounds is skipped rather than trusted.
 */
import * as React from 'react';
import type { TextRange } from '@shared/utils/foldedTextSearch';

export interface MarkedTextProps {
  text: string;
  ranges: readonly TextRange[];
  markClassName?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const MarkedText: React.FC<MarkedTextProps> = ({ text, ranges, markClassName }) => {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const range of ranges) {
    if (range.start < at || range.end <= range.start || range.end > text.length) {
      continue;
    }
    if (range.start > at) {
      parts.push(text.slice(at, range.start));
    }
    parts.push(
      <mark key={range.start} className={markClassName}>
        {text.slice(range.start, range.end)}
      </mark>
    );
    at = range.end;
  }
  if (at < text.length) {
    parts.push(text.slice(at));
  }
  return <>{parts}</>;
};
