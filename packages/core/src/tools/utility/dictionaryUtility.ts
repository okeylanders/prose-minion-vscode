/**
 * Dictionary Utility
 * Generates rich dictionary-style entries for a given word
 */

import { PromptLoader } from '../shared/prompts';
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { ExecutionResult, StreamingTokenCallback } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';

export interface DictionaryLookupInput {
  word: string;
  contextText?: string;
  notes?: string;
}

export interface DictionaryLookupOptions {
  temperature?: number;
  maxTokens?: number;
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** When provided, enables streaming mode */
  onToken?: StreamingTokenCallback;
}

export class DictionaryUtility {
  constructor(
    private readonly agentRunEngine: AgentRunEngine,
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

    return this.agentRunEngine.runInitial({
      toolName: 'dictionary-utility',
      systemMessage,
      userMessage,
      policy: AGENT_RUN_POLICIES.dictionary,
      options: {
        temperature: options?.temperature ?? 0.4,
        maxTokens: options?.maxTokens ?? 10000,
        signal: options?.signal,
        onToken: options?.onToken
      }
    });
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
4. 🔍 **Sense Explorer** — Numbered established senses; for each include definition, example sentence, up to 12 suitable synonyms and 6 genuine antonyms where available, and notes. Use fewer for narrow technical senses, and say when no direct antonym exists.
5. 🗣️ **Register & Connotation** — Describe tone, register, connotation sliders, emotional valence.
6. 🪶 **Narrative Texture** — Sensory tags, mood levers, symbolism for storytellers.
7. 📚 **Collocations & Idioms** — High-impact collocations, idioms, and clichés to watch.
8. 📂 **Topic & Related Lexicon** — Usually 1–3 relevant topic families, each with a descriptive subheading, a one- or two-sentence blurb connecting the topic to the target word, and 3–5 related terms with brief meanings and connections. Use fewer topics or terms when more would require padding.
9. 🧬 **Morphology & Family** — Inflections, derivations, compound forms, related morphology.
10. 🎭 **Character Voice Variations** — Alternatives across at least four distinct character archetypes (e.g., academic theorist, hardboiled detective, teen slangster, lyrical poet, battlefield commander, whimsical fae guide, villainous mastermind, AI concierge).
11. 🎵 **Soundplay & Rhyme** — Rhyme families, alliteration partners, meter tips.
12. 🌐 **Translations & Cognates** — Key equivalents in major languages with nuance notes.
13. ⚠️ **Usage Watchpoints** — Pitfalls, cliché warnings, or ambiguity flags.
14. 🧭 **Semantic Gradient** — Ordered ladder of near-synonyms illustrating intensity/nuance.
15. Special Focus — When context or author notes are provided, add a dedicated markdown section titled "## **Special Focus: [brief context label]**" that directly answers the user's contextual question or use case with targeted guidance, examples, and if helpful a recommended layering or comparison.
16. 🧠 **AI Advisory Notes** — Call out any sections that rely on model inference or may need verification.

### Topic & Related Lexicon Guidelines
- Map fields, processes, practices, categories, or subject areas the word belongs to; do not just repeat synonyms or its derivational family.
- For each topic, explain its scope and connection, then list terms as **Term** — brief meaning; connection to the target word.
- Related terms are not automatically synonyms or antonyms. Distinguish broader categories, subtypes, neighboring concepts, contrasting classes, components, and associated processes.
- Separate topic families for multiple established senses. Prioritize the supplied context, and label any writer-facing creative association as a creative association rather than a standard meaning or technical classification.
- Do not invent senses, terms, or relationships to fill the section. Prefer one well-supported topic to several vague ones; omit uncertain terms or flag uncertainty. Keep the section around 120–220 words.

### Additional Guidelines
- Stay factual where data is known; clearly label speculative guidance.
- Do not pad synonyms or antonyms to meet a numerical target. Explain related technical categories in Topic & Related Lexicon instead of giving them false synonym or antonym labels.
- Prefer bullet lists and tables for readability.
- Adapt the richness of synonyms/antonyms to the word’s versatility.
- Reference genre applications whenever relevant.
- Treat optional context as a concrete writing question, not just background color.
- Never include system-level commentary or raw XML tags in the final output.`;
  }
}
