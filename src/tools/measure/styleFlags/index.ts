/**
 * Style Flags Tool
 * Identifies style patterns and potential issues in prose
 */

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
    const adverbPattern = /\b\w+ly\b/gi;
    const matches = text.match(adverbPattern) || [];
    const examples = this.getUniqueExamples(matches, 5);

    return {
      type: 'Adverbs (-ly words)',
      count: matches.length,
      examples
    };
  }

  private checkPassiveVoice(text: string): StyleFlag {
    // Simple passive voice detection (was/were/been + past participle)
    const passivePattern = /\b(was|were|been|being)\s+\w+ed\b/gi;
    const matches = text.match(passivePattern) || [];
    const examples = this.getUniqueExamples(matches, 5);

    return {
      type: 'Passive Voice',
      count: matches.length,
      examples
    };
  }

  private checkWeakVerbs(text: string): StyleFlag {
    // Common weak verbs
    const weakVerbs = ['is', 'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did', 'make', 'makes', 'made', 'get', 'gets', 'got'];
    const pattern = new RegExp(`\\b(${weakVerbs.join('|')})\\b`, 'gi');
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
    const fillers = ['just', 'really', 'very', 'quite', 'rather', 'somewhat', 'somehow', 'actually', 'basically', 'literally'];
    const pattern = new RegExp(`\\b(${fillers.join('|')})\\b`, 'gi');
    const matches = text.match(pattern) || [];
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
