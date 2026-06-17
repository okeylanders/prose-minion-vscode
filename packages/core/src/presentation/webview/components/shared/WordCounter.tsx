/**
 * WordCounter component - Reusable word counter with color-coded thresholds
 *
 * Displays word count with visual feedback:
 * - Green: 0 to warningWords-1
 * - Yellow: warningWords to maxWords-1
 * - Red: maxWords+
 */

import * as React from 'react';

export interface WordCounterProps {
  /** The text to count words in */
  text: string;
  /** Maximum recommended word count (red threshold) */
  maxWords: number;
  /** Warning word count (yellow threshold), defaults to 80% of maxWords */
  warningWords?: number;
  /** Warning message to show when over limit */
  warningMessage?: string;
  /** Whether to show the "/ maxWords words" suffix (default: true) */
  showMax?: boolean;
  /** Custom class name */
  className?: string;
}

export const WordCounter: React.FC<WordCounterProps> = ({
  text,
  maxWords,
  warningWords,
  warningMessage = 'Large input',
  showMax = true,
  className = ''
}) => {
  const effectiveWarningWords = warningWords ?? Math.floor(maxWords * 0.8);

  const wordCount = React.useMemo(() => {
    if (!text || text.trim().length === 0) {
      return 0;
    }
    return text.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
  }, [text]);

  const colorClass = React.useMemo(() => {
    if (wordCount >= maxWords) {
      return 'word-counter-red';
    }
    if (wordCount >= effectiveWarningWords) {
      return 'word-counter-yellow';
    }
    return 'word-counter-green';
  }, [wordCount, maxWords, effectiveWarningWords]);

  const showWarning = wordCount > maxWords;

  return (
    <div className={`word-counter ${colorClass} ${className}`.trim()}>
      {wordCount}{showMax ? ` / ${maxWords}` : ''} words
      {showWarning && ` ⚠️ ${warningMessage}`}
    </div>
  );
};
