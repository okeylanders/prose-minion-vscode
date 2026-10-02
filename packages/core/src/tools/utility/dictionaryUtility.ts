/**
 * Dictionary Utility
 * Generates rich dictionary-style entries for a given word
 */

import { PromptLoader } from '../shared/prompts';
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { ExecutionResult, StreamingTokenCallback } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { DictionaryEntryOptions } from '@messages';

const ENCYCLOPEDIA_BLUEPRINT_PLACEHOLDER = '{{ENCYCLOPEDIA_BLUEPRINT_SECTION}}';

export interface DictionaryLookupInput extends DictionaryEntryOptions {
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
    const includeEncyclopedia = input.includeEncyclopedia !== false;
    const toolPrompts = await this.loadToolPrompts(includeEncyclopedia);
    const systemMessage = this.buildSystemMessage(sharedPrompts, toolPrompts, includeEncyclopedia);
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

  private async loadToolPrompts(includeEncyclopedia: boolean): Promise<string> {
    try {
      const paths = [
        'dictionary-utility/00-dictionary-utility.md',
        'dictionary-utility/01-dictionary-example.md'
      ];
      if (includeEncyclopedia) {
        paths.push('dictionary-utility/02-encyclopedia-entry.md');
      }
      const prompts = await this.promptLoader.loadPrompts(paths);
      return this.composeEncyclopediaBlueprint(prompts, includeEncyclopedia);
    } catch (error) {
      console.warn('Could not load dictionary utility prompts, using defaults');
      return this.getDefaultInstructions(includeEncyclopedia);
    }
  }

  private buildSystemMessage(sharedPrompts: string, toolPrompts: string, includeEncyclopedia: boolean): string {
    const parts = [
      toolPrompts || this.getDefaultInstructions(includeEncyclopedia),
      sharedPrompts,
      includeEncyclopedia
        ? 'Encyclopedia entry: ENABLED for this lookup. The output blueprint includes the required final section 16, Topic & Related Lexicon. Continue after AI Advisory Notes with "# 📂 Topic & Related Lexicon" and the complete encyclopedia entry. The response is incomplete without it. The original ~1000-word target applies only to the preceding dictionary sections; allow additional space for the encyclopedia entry.'
        : 'The optional Topic & Related Lexicon (encyclopedia) section is disabled for this lookup. Generate only the standard dictionary sections, ending with AI Advisory Notes.'
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
    lines.push('', input.includeEncyclopedia !== false
      ? 'Include the encyclopedia entry: after AI Advisory Notes, finish with the complete "# 📂 Topic & Related Lexicon" section, including topic explanations, related vocabulary, writing examples, and possible reference books.'
      : 'Do not include an encyclopedia entry. Finish with AI Advisory Notes.');

    return lines.join('\n');
  }

  private composeEncyclopediaBlueprint(instructions: string, includeEncyclopedia: boolean): string {
    const section = includeEncyclopedia
      ? '16. 📂 **Topic & Related Lexicon** — Required final encyclopedia section: developed topic explanations, related vocabulary, concrete examples and writing applications, plus 1–2 possible reference books per topic when suitable.'
      : '';
    return instructions.replace(ENCYCLOPEDIA_BLUEPRINT_PLACEHOLDER, section);
  }

  private getDefaultInstructions(includeEncyclopedia: boolean): string {
    const dictionaryInstructions = `# Dictionary Utility — Output Contract

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
14. Special Focus — When context or author notes are provided, add a dedicated markdown section titled "## **Special Focus: [brief context label]**" that directly answers the user's contextual question or use case with targeted guidance, examples, and if helpful a recommended layering or comparison.
15. 🧠 **AI Advisory Notes** — Call out any sections that rely on model inference or may need verification.
${ENCYCLOPEDIA_BLUEPRINT_PLACEHOLDER}

### Additional Guidelines
- Stay factual where data is known; clearly label speculative guidance.
- Prefer bullet lists and tables for readability.
- Adapt the richness of synonyms/antonyms to the word’s versatility.
- Reference genre applications whenever relevant.
- Treat optional context as a concrete writing question, not just background color.
- Never include system-level commentary or raw XML tags in the final output.`;
    const instructions = this.composeEncyclopediaBlueprint(dictionaryInstructions, includeEncyclopedia);
    return includeEncyclopedia
      ? `${instructions}\n\n${this.getDefaultEncyclopediaInstructions()}`
      : instructions;
  }

  private getDefaultEncyclopediaInstructions(): string {
    return `# Encyclopedia Entry Required for This Lookup

The writer has ENABLED the encyclopedia entry for this lookup. It is a required part of this response. After completing all fifteen standard dictionary sections, append this section LAST, after **AI Advisory Notes**. Preserve the original sections' order, depth, and creative breadth.

Use the heading "# 📂 Topic & Related Lexicon". The response is incomplete if it stops at AI Advisory Notes or omits the encyclopedia section.

### Topic & Related Lexicon Guidelines
- Fan out into the word's conceptual neighborhood: fields, processes, practices, and creative possibilities. Usually explore 2–4 useful topic families, with more or fewer when the word and context invite it; these are starting points, not quotas.
- Give each topic a descriptive subheading and at least two developed paragraphs of explanation, not a one- to three-sentence teaser. Teach the broader subject: how it works, useful distinctions or mechanisms, and why this word opens a door into it. Connect that knowledge to what a writer can notice, imagine, or do.
- Explore related vocabulary within each topic, usually 4–8 useful terms. Explain each term's meaning, its connection to the target word, and a distinction or example that makes it usable. Give an interesting term several sentences when useful instead of restricting every entry to a one-line gloss.
- Related terms are not automatically synonyms or antonyms: explain relationships such as broader categories, subtypes, neighboring concepts, contrasts, components, or associated processes. Let this map enrich the entry alongside its existing synonym lists and morphological family.
- Include a concrete illustration and a writing application for each topic: a miniature scene, a phrase comparison, a sensory observation, or a small experiment, followed by an explanation of what the writer can learn or try.
- For words with several senses, give their useful topic families room to develop. Let the supplied context lead the exploration while leaving space for interesting connections beyond it.
- Welcome imaginative connections across sound, sensation, imagery, character, genre, and metaphor. Make the transition into a creative association clear in natural prose, so a craft possibility is distinguishable from a technical fact without smothering the exploration in caveats.
- Under **Possible resources**, offer 1–2 seminal or foundational reference books for each topic when you can confidently identify suitable works. Give the title and author, explain what each book teaches, and connect it to this topic or the writer's next step. A well-chosen craft book or accessible introduction is useful too; describe its role honestly.
- Recommend only real books whose titles and authors you know confidently. Omit the resource list when none comes to mind; do not invent titles, authors, quotations, editions, page numbers, or claims of having consulted a source. These are possible further reading, not citations proving the generated entry.
- Give this section the room its topics need. Its explanations, vocabulary, examples, and resources have no short word cap; do not compress the other dictionary sections to make room for it.`;
  }
}
