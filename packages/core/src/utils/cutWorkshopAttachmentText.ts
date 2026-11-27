import { countWords } from './textUtils';

/** A bounded prefix, preserving spacing within the kept text and never splitting a surrogate pair. */
export function cutWorkshopAttachmentText(text: string, bounds: { words: number; characters: number }): {
  text: string;
  words: number;
  truncation?: { keptWords: number; totalWords: number };
} {
  const totalWords = countWords(text);
  if (totalWords <= bounds.words && text.length <= bounds.characters) {
    return { text, words: totalWords };
  }
  const word = /\S+/g;
  let end = 0;
  let wholeWords = 0;
  for (let match = word.exec(text); match !== null; match = word.exec(text)) {
    const wordEnd = match.index + match[0].length;
    if (wholeWords >= bounds.words || wordEnd > bounds.characters) {
      break;
    }
    end = wordEnd;
    wholeWords += 1;
  }
  if (wholeWords === 0) {
    // Leading whitespace can occupy the entire prefix, or the first word can straddle the cutoff.
    end = Math.min(text.length, bounds.characters);
    const last = text.charCodeAt(end - 1);
    const next = text.charCodeAt(end);
    if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      end -= 1;
    }
  }
  const kept = text.slice(0, end);
  const keptWords = countWords(kept);
  return { text: kept, words: keptWords, truncation: { keptWords, totalWords } };
}
