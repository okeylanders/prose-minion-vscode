/**
 * Dictionary Utility
 * Generates rich dictionary-style entries for a given word
 */

import { PromptLoader } from '../shared/prompts';
import { AIResourceOrchestrator, ExecutionResult } from '../../application/services/AIResourceOrchestrator';

export interface DictionaryLookupInput {
  word: string;
  contextText?: string;
  notes?: string;
}

export interface DictionaryLookupOptions {
  temperature?: number;
  maxTokens?: number;
}

export class DictionaryUtility {
  constructor(
    private readonly aiResourceOrchestrator: AIResourceOrchestrator,
    private readonly promptLoader: PromptLoader
  ) {}

  async lookup(
    input: DictionaryLookupInput,
    options?: DictionaryLookupOptions
  ): Promise<ExecutionResult> {
    if (!input.word?.trim()) {
      throw new Error('Word is required for dictionary lookup');
    }

    const sharedPrompts = await this.promptLoader.loadSharedPrompts();
    const toolPrompts = await this.loadToolPrompts();
    const systemMessage = this.buildSystemMessage(sharedPrompts, toolPrompts);
    const userMessage = this.buildUserMessage(input);

    return await this.aiResourceOrchestrator.executeWithoutCapabilities(
      'dictionary-utility',
      systemMessage,
      userMessage,
      {
        temperature: options?.temperature ?? 0.4,
        maxTokens: options?.maxTokens ?? 2200
      }
    );
  }

  private async loadToolPrompts(): Promise<string> {
    try {
      return await this.promptLoader.loadPrompts([
        'dictionary-utility/00-dictionary-utility.md',
        'dictionary-utility/01-dictionary-example.md'
      ]);
    } catch (error) {
      console.warn('Could not load dictionary utility prompts, using defaults');
      return this.getDefaultInstructions();
    }
  }

  private buildSystemMessage(sharedPrompts: string, toolPrompts: string): string {
    const parts = [
      toolPrompts || this.getDefaultInstructions(),
      sharedPrompts
    ].filter(Boolean);

    return parts.join('\n\n---\n\n');
  }

  private buildUserMessage(input: DictionaryLookupInput): string {
    const lines = [
      `Please prepare a rich dictionary report for the target word.`,
      '',
      `Word: ${input.word.trim()}`
    ];

    if (input.contextText?.trim()) {
      lines.push('', 'Contextual Excerpt:', input.contextText.trim());
    }

    if (input.notes?.trim()) {
      lines.push('', 'Author Notes:', input.notes.trim());
    }

    lines.push('', 'Focus on nuance, usage, and fiction-writing applications.');

    return lines.join('\n');
  }

  private getDefaultInstructions(): string {
    return `# Dictionary Utility — Output Contract

You are the \`dictionary-utility\`. Produce an exhaustive, fiction-focused dictionary entry whenever a word is supplied.

## Response Format
Respond in markdown only with the following sections, preserving the icons and headings exactly:

1. 📕 **Definition** — Core definition(s) in concise prose.
2. 🔈 **Pronunciation** — IPA, phonetic respelling, syllable count, and stress pattern.
3. 🧩 **Parts of Speech** — List every part of speech the word can assume.
4. 🔍 **Sense Explorer** — Numbered senses; for each include definition, example sentence, expanded synonyms (8–12), antonyms, and notes.
5. 🗣️ **Register & Connotation** — Describe tone, register, connotation sliders, emotional valence.
6. 🪶 **Narrative Texture** — Sensory tags, mood levers, symbolism for storytellers.
7. 📚 **Collocations & Idioms** — High-impact collocations, idioms, and clichés to watch.
8. 🧬 **Morphology & Family** — Inflections, derivations, compound forms, related morphology.
9. 🎭 **Character Voice Variations** — Alternatives across at least four distinct character archetypes (e.g., academic theorist, hardboiled detective, teen slangster, lyrical poet, battlefield commander, whimsical fae guide, villainous mastermind, AI concierge).
10. 🎵 **Soundplay & Rhyme** — Rhyme families, alliteration partners, meter tips.
11. 🌐 **Translations & Cognates** — Key equivalents in major languages with nuance notes.
12. ⚠️ **Usage Watchpoints** — Pitfalls, cliché warnings, or ambiguity flags.
13. 🧭 **Semantic Gradient** — Ordered ladder of near-synonyms illustrating intensity/nuance.
14. 🧠 **AI Advisory Notes** — Call out any sections that rely on model inference or may need verification.

### Additional Guidelines
- Stay factual where data is known; clearly label speculative guidance.
- Prefer bullet lists and tables for readability.
- Adapt the richness of synonyms/antonyms to the word’s versatility.
- Reference genre applications whenever relevant.
- Never include system-level commentary or raw XML tags in the final output.`;
  }
}
