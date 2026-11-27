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
  if (totalWords === 0) {
    return { text: text.slice(0, bounds.characters), words: 0, truncation: { keptWords: 0, totalWords: 0 } };
  }
  const word = /\S+/g;
  let end = 0;
  let keptWords = 0;
  for (let match = word.exec(text); match !== null; match = word.exec(text)) {
    const wordEnd = match.index + match[0].length;
    if (keptWords >= bounds.words || wordEnd > bounds.characters) {
      break;
    }
    end = wordEnd;
    keptWords += 1;
  }
  if (keptWords === 0) {
    // One unbroken run longer than the character bound: cut inside it, never inside a surrogate pair.
    const head = text.trimStart().slice(0, bounds.characters);
    const last = head.charCodeAt(head.length - 1);
    const kept = last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head;
    return { text: kept, words: 1, truncation: { keptWords: 1, totalWords } };
  }
  return { text: text.slice(0, end), words: keptWords, truncation: { keptWords, totalWords } };
}
