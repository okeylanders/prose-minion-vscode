/**
 * Style Flags Tool
 * Identifies style patterns and potential issues in prose
 *
 * The adverb, passive-voice and filler detectors are exported (Lightbox
 * Slice 4B), so the Lightbox's measured standouts count, place and check a
 * quote with the very rules the tool counts by. The tool counts through
 * them; its output is unchanged (pinned by its tests). The weak-verbs list
 * is exported too (Slice 4F), so craft steering names the same verbs.
 */

/** One match of a detector: its offsets in the text and the text matched. */
export interface StyleFlagMatch {
  start: number;
  end: number;
  text: string;
}

/** Weak verbs the tool flags, as whole words, any case. */
export const STYLE_FLAG_WEAK_VERBS = [
  'is', 'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did', 'make', 'makes', 'made', 'get', 'gets', 'got'
] as const;

/** Fillers and intensifiers the tool flags, as whole words, any case. */
export const STYLE_FLAG_FILLER_WORDS = [
  'just', 'really', 'very', 'quite', 'rather', 'somewhat', 'somehow', 'actually', 'basically', 'literally'
] as const;

function matchesOf(text: string, pattern: RegExp): StyleFlagMatch[] {
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: match[0]
  }));
}

/** Words ending in -ly (a heuristic: "only" and "family" count too). */
export function findAdverbs(text: string): StyleFlagMatch[] {
  return matchesOf(text, /\b\w+ly\b/gi);
}

/** was/were/been/being followed by a word ending in -ed (a heuristic: irregular participles are missed). */
export function findPassiveVoice(text: string): StyleFlagMatch[] {
  return matchesOf(text, /\b(was|were|been|being)\s+\w+ed\b/gi);
}

/** Each of `STYLE_FLAG_FILLER_WORDS`, as a whole word. */
export function findFillerWords(text: string): StyleFlagMatch[] {
  return matchesOf(text, new RegExp(`\\b(${STYLE_FLAG_FILLER_WORDS.join('|')})\\b`, 'gi'));
}

export interface StyleFlagsInput {
  text: string;
}

export interface StyleFlag {
  type: string;
  count: number;
  examples: string[];
}

export interface StyleFlagsOutput {
  flags: StyleFlag[];
  summary: string;
}

export class StyleFlags {
  analyze(input: StyleFlagsInput): StyleFlagsOutput {
    const text = input.text;
    const flags: StyleFlag[] = [];

    // Check for common style issues
    flags.push(this.checkAdverbs(text));
    flags.push(this.checkPassiveVoice(text));
    flags.push(this.checkWeakVerbs(text));
    flags.push(this.checkFillerWords(text));
    flags.push(this.checkRepetition(text));
    flags.push(this.checkClichés(text));

    // Filter out flags with no occurrences
    const activeFlags = flags.filter(flag => flag.count > 0);

    const summary = this.generateSummary(activeFlags);

    return {
      flags: activeFlags,
      summary
    };
  }

  private checkAdverbs(text: string): StyleFlag {
    // Match words ending in -ly
    const matches = findAdverbs(text).map((match) => match.text);
    const examples = this.getUniqueExamples(matches, 5);

    return {
      type: 'Adverbs (-ly words)',
      count: matches.length,
      examples
    };
  }

  private checkPassiveVoice(text: string): StyleFlag {
    // Simple passive voice detection (was/were/been + past participle)
    const matches = findPassiveVoice(text).map((match) => match.text);
    const examples = this.getUniqueExamples(matches, 5);

    return {
      type: 'Passive Voice',
      count: matches.length,
      examples
    };
  }

  private checkWeakVerbs(text: string): StyleFlag {
    // Common weak verbs
    const pattern = new RegExp(`\\b(${STYLE_FLAG_WEAK_VERBS.join('|')})\\b`, 'gi');
    const matches = text.match(pattern) || [];
    const examples = this.getUniqueExamples(matches, 5);

    return {
      type: 'Weak Verbs',
      count: matches.length,
      examples
    };
  }

  private checkFillerWords(text: string): StyleFlag {
    // Common filler words
    const matches = findFillerWords(text).map((match) => match.text);
    const examples = this.getUniqueExamples(matches, 5);

    return {
      type: 'Filler Words',
      count: matches.length,
      examples
    };
  }

  private checkRepetition(text: string): StyleFlag {
    // Find words that appear multiple times in close proximity
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const wordCounts: Record<string, number> = {};

    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    const repeated = Object.entries(wordCounts)
      .filter(([word, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => `${word} (${count}x)`);

    return {
      type: 'Repetitive Words',
      count: repeated.length,
      examples: repeated
    };
  }

  private checkClichés(text: string): StyleFlag {
    // Common clichés
    const clichés = [
      'at the end of the day',
      'bottom line',
      'think outside the box',
      'piece of cake',
      'low-hanging fruit',
      'needle in a haystack',
      'back to square one',
      'hit the nail on the head',
      'a blessing in disguise',
      'break the ice'
    ];

    const found: string[] = [];
    clichés.forEach(cliché => {
      if (text.toLowerCase().includes(cliché)) {
        found.push(cliché);
      }
    });

    return {
      type: 'Clichés',
      count: found.length,
      examples: found
    };
  }

  private getUniqueExamples(matches: string[], limit: number): string[] {
    const unique = Array.from(new Set(matches.map(m => m.toLowerCase())));
    return unique.slice(0, limit);
  }

  private generateSummary(flags: StyleFlag[]): string {
    if (flags.length === 0) {
      return 'No significant style issues found.';
    }

    const topIssues = flags
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(flag => `${flag.type}: ${flag.count}`)
      .join(', ');

    return `Top style issues: ${topIssues}`;
  }
}
