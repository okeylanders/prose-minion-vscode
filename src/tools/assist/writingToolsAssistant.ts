/**
 * Writing Tools Assistant
 * Dedicated assistant for specialized writing analysis tools:
 * - Cliche Analysis
 * - Scene Continuity Check
 * - Style Consistency
 * - Editor (Grammar & Mechanics)
 */

import type * as vscode from 'vscode';
import { PromptLoader } from '../shared/prompts';
import { AIResourceOrchestrator, ExecutionResult, StreamingTokenCallback } from '@orchestration/AIResourceOrchestrator';
import { AssistantFocus, WritingToolsFocus } from '@messages';

export type { WritingToolsFocus };

export interface WritingToolsInput {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
}

export interface WritingToolsOptions {
  includeCraftGuides?: boolean;
  temperature?: number;
  maxTokens?: number;
  focus: WritingToolsFocus;
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Callback for streaming tokens (enables streaming mode) */
  onToken?: StreamingTokenCallback;
}

export class WritingToolsAssistant {
  constructor(
    private readonly aiResourceOrchestrator: AIResourceOrchestrator,
    private readonly promptLoader: PromptLoader,
    private readonly outputChannel?: vscode.OutputChannel
  ) {}

  async analyze(input: WritingToolsInput, options: WritingToolsOptions): Promise<ExecutionResult> {
    const { focus } = options;

    // Load prompts: minimal base + focus-specific (which contains everything)
    const sharedPrompts = await this.promptLoader.loadSharedPrompts();
    const toolPrompts = await this.loadToolPrompts(focus);

    // Build system message
    const systemMessage = this.buildSystemMessage(sharedPrompts, toolPrompts, focus);

    // Build user message
    const userMessage = this.buildUserMessage(input, focus);

    // Log for transparency
    this.outputChannel?.appendLine(`[WritingToolsAssistant] Analyzing with focus="${focus}"`);

    // Use orchestrator to execute with agent capabilities
    return await this.aiResourceOrchestrator.executeWithAgentCapabilities(
      `writing-tools-${focus}`,
      systemMessage,
      userMessage,
      {
        includeCraftGuides: options?.includeCraftGuides,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 10000,
        signal: options?.signal,
        onToken: options?.onToken
      }
    );
  }

  private async loadToolPrompts(focus: WritingToolsFocus): Promise<string> {
    try {
      // Load minimal base prompt + comprehensive focus prompt
      const paths = [
        'writing-tools-assistant/00-writing-tools-base.md',
        `writing-tools-assistant/focus/${focus}.md`
      ];

      this.outputChannel?.appendLine(`[WritingToolsAssistant] Loading prompts:`);
      paths.forEach((path, index) => {
        this.outputChannel?.appendLine(`  ${index + 1}. ${path}`);
      });

      return await this.promptLoader.loadPrompts(paths);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(
        `[WritingToolsAssistant] Could not load prompts for focus="${focus}", using defaults: ${errorMsg}`
      );
      return this.getDefaultInstructions(focus);
    }
  }

  private buildSystemMessage(
    sharedPrompts: string,
    toolPrompts: string,
    focus: WritingToolsFocus
  ): string {
    const roleDescription = this.getRoleDescription(focus);

    const parts = [
      roleDescription,
      toolPrompts || this.getDefaultInstructions(focus),
      sharedPrompts
    ].filter(Boolean);

    return parts.join('\n\n---\n\n');
  }

  private getRoleDescription(focus: WritingToolsFocus): string {
    const roles: Record<WritingToolsFocus, string> = {
      cliche: 'You are a writing assistant specializing in identifying cliches, dead metaphors, and overused expressions in creative writing.',
      continuity: 'You are a writing assistant specializing in detecting scene continuity errors, choreography issues, and logical inconsistencies.',
      style: 'You are a writing assistant specializing in detecting stylistic drift, tense shifts, POV breaks, and register inconsistencies.',
      editor: 'You are a copyeditor specializing in grammar, spelling, punctuation, and mechanical correctness in creative writing.',
      fresh: 'You are a writing assistant specializing in reader engagement analysis—character depth, pacing dynamics, stakes, and overall page-turner quality.',
      repetition: 'You are a writing assistant specializing in detecting repetitive patterns—echo words, recycled metaphors, repeated action beats, and structural redundancy.',
      'decision-points': 'You are a writing assistant specializing in semantic gradient commitment—detecting middle-gradient word defaults, semantic airlocks (appositive hedges), and adverb intensifiers that indicate uncommitted AI scaffolding requiring authorial decision.',
      'show-and-tell': 'You are a writing assistant specializing in dramatization balance—analyzing when prose under-shows (tells flatly at peaks) or over-shows (labors minor moments), and the appropriate use of scene vs. summary.',
      gestures: 'You are a writing assistant specializing in gesture prose variations—generating diverse physical action alternatives that show emotion, intent, and character through body language, micro-expressions, and movement rather than telling.',
      choreography: 'You are a writing assistant specializing in scene-wide choreography analysis—detecting repetitive movement patterns, staging monotony, and physical action flow across the entire passage while maintaining spatial continuity and suggesting novel variations by zone.',
      'stock-and-signature': 'You are a writing assistant specializing in cognitive economy analysis—identifying where convention serves as invisible infrastructure versus where the author\'s distinctive voice rises above it, ensuring stock elements stay functional, emotional peaks are built on signature beats, and flagging any suspiciously polished AI-assisted passages for originality verification.'
    };
    return roles[focus];
  }

  private buildUserMessage(input: WritingToolsInput, focus: WritingToolsFocus): string {
    const instructions = this.getAnalysisInstruction(focus);

    const lines: string[] = [
      instructions,
      '',
      '### Passage to Analyze',
      '```markdown',
      input.text,
      '```',
      ''
    ];

    if (input.sourceFileUri) {
      lines.push(`Source File: ${input.sourceFileUri}`, '');
    }

    if (input.contextText && input.contextText.trim().length > 0) {
      lines.push('### Supplemental Context', input.contextText.trim(), '');
    }

    return lines.join('\n');
  }

  private getAnalysisInstruction(focus: WritingToolsFocus): string {
    const instructions: Record<WritingToolsFocus, string> = {
      cliche: 'Please analyze this passage for cliches, dead metaphors, stock phrases, and overused expressions. Provide fresh alternatives.',
      continuity: 'Please analyze this passage for continuity errors, choreography issues, object tracking problems, and logical inconsistencies.',
      style: 'Please analyze this passage for stylistic drift, tense shifts, POV breaks, and register inconsistencies.',
      editor: 'Please copyedit this passage for grammar, spelling, punctuation, and mechanical errors.',
      fresh: 'Please analyze this passage for reader engagement: character depth, pacing, stakes, tension, and page-turner quality.',
      repetition: 'Please analyze this passage for repetitive patterns: echo words, recycled metaphors, repeated action beats, sentence structures, and descriptive redundancy.',
      'decision-points': 'Please analyze this passage for gradient commitment issues: middle-gradient word defaults (walked, looked, felt, very, quite), semantic airlocks (appositive hedges like "which was Y", "a kind of Z"), and weak verb + adverb patterns. For each, apply the Commitment Questions (Intent/Character/Theme/Clarity) and suggest gradient alternatives.',
      'show-and-tell': 'Please analyze this passage for dramatization balance: identify moments that are under-dramatized (told flatly when they should be shown through action/sensation) and over-dramatized (labored with excessive rendering when efficient telling would serve better). Consider pacing rhythm, reader cognitive load, and whether each moment warrants its current treatment.',
      gestures: 'Please analyze this passage and generate a rich variety of alternative gesture prose for each moment where physical action conveys emotion or intent. For each gesture opportunity, provide 5-8 distinct variations ranging from subtle micro-expressions to bold full-body movements. Focus on showing character state through body language rather than telling.',
      choreography: 'Please analyze this passage for scene-wide choreography patterns: identify repetitive movements (everyone nodding, constant walking, similar transitions), map the physical staging into zones, check spatial continuity, and provide diverse alternative choreography for each zone. Generate 3-5 complete scene variations with novel movement vocabulary while maintaining physical logic.',
      'stock-and-signature': 'Please analyze this passage for cognitive economy: categorize each beat into the 4-tier spectrum (Functional Stock, Decorated Stock, Stock Doing Heavy Lifting, Signature Beats). Identify the structural template being used, assess the stock/signature ratio, verify peaks are built on signature not stock. Separately: (1) flag any passages with genuine external provenance risk, and (2) identify closure-complete passages that may compete with scene flow (craft observation, not accusation).'
    };
    return instructions[focus];
  }

  private getDefaultInstructions(focus: WritingToolsFocus): string {
    const defaults: Record<WritingToolsFocus, string> = {
      cliche: `# Cliche Analysis

Identify and flag:
- Dead metaphors ("cold as ice", "heart of gold")
- Stock phrases ("at the end of the day")
- Overused descriptors ("piercing blue eyes")
- Tired similes and comparisons
- Genre-specific cliches

Rate severity (mild/moderate/egregious) and suggest fresh alternatives.`,

      continuity: `# Scene Continuity Check

Identify:
- Choreography issues (character teleportation)
- Object continuity errors (vanishing props)
- Timeline inconsistencies
- Character state contradictions
- Environmental inconsistencies

Provide specific line references and suggested fixes.`,

      style: `# Style Consistency

Identify:
- Tense shifts (past to present drift)
- POV breaks (head-hopping, unearned omniscience)
- Register drift (formal to casual shifts)
- Voice inconsistencies
- Punctuation/formatting inconsistencies

Provide specific corrections with explanations.`,

      editor: `# Editor (Grammar & Mechanics)

Check for:
- Subject-verb agreement
- Pronoun reference clarity
- Homophones (their/there/they're)
- Dialogue punctuation
- Comma splices and run-ons
- Spelling and typos

Provide specific corrections with explanations.`,

      fresh: `# Engagement & Freshness Check

Analyze:
- Character depth and agency (flat vs. dimensional)
- Pacing dynamics (too fast, too slow, well-calibrated)
- Stakes and tension (external and internal)
- Reader hooks (questions planted, curiosity gaps)
- Emotional engagement (earned vs. forced beats)
- Scene purpose (advancing plot, revealing character)

Rate overall engagement and provide actionable improvements.`,

      repetition: `# Repetition Analysis

Identify repetitive patterns:
- Echo words (same word appearing too close together)
- Recycled metaphors and imagery
- Repeated action beats (nodded, sighed, shrugged)
- Sentence structure patterns (all starting with subject-verb)
- Descriptor redundancy (same adjectives reused)
- Emotional tells (same physical reactions for emotions)
- Transitional phrase repetition

Flag severity (mild/moderate/egregious) and suggest varied alternatives.`,

      'decision-points': `# Semantic Gradient Commitment Analysis

Detect where prose defaults to middle-gradient values instead of committing to extremes that carry intent, character, or theme.

## Middle-Gradient Word Defaults
Flag words from the middle 40-60% of intensity spectrums:
- **Verbs:** walked, looked, moved, went, got, felt, seemed, said, told, asked
- **Adjectives:** big, small, good, bad, nice, hard, soft, strange, weird
- **Adverbs:** very, really, quite, rather, somewhat, fairly, kind of, sort of

## Semantic Airlocks
Flag appositive constructions that hedge instead of commit:
- "X, which was Y" / "X, a kind of Z" / "X, something like Y" / "X, almost Y"
- Explanatory appositives (emotion + explanation instead of showing)
- Nested appositive airlocks

## Common AI Patterns
- Weak verb + adverb intensifier → should be strong verb
- Generic emotion + explanatory appositive → should show through action
- Middle-gradient observation + qualifier → should commit to specificity

## Commitment Questions
For each flagged word: Intent? Character? Theme? Clarity?

## Priority
Climactic moments > routine moments. Not all middle-gradient needs revision—strategic use provides pacing relief.`,

      'show-and-tell': `# Show & Tell: Dramatization Balance Analysis

Analyze the balance between dramatized rendering (showing) and efficient narration (telling). Both are valid tools—the craft is knowing when to use each.

## When to Show (Dramatize)
- Emotional peaks and turning points
- Character-defining moments
- First impressions/introductions
- Conflict enacted in real-time
- Sensory experiences that matter thematically

## When to Tell (Summarize)
- Transitions and time skips
- Orienting the reader in space/time
- Cognitive breaks after intense sequences
- Efficient context-setting
- Minor moments that don't warrant dramatic weight

## Under-Dramatized (Should Show)
Flag moments told flatly that warrant rendering:
- "She was devastated" at a climactic moment
- Character introductions described rather than demonstrated
- Conflict summarized when stakes demand enactment
- Emotional states labeled rather than embodied

## Over-Dramatized (Should Tell)
Flag moments labored beyond their weight:
- Belabored transitions that should be a sentence
- Every emotion rendered through elaborate physical tells
- Minor moments given excessive dramatic weight
- Purple prose obscuring simple information
- Reader fatigue from unbroken showing

## Balance Questions
For each flagged passage:
- Peak vs. Valley: Is this a dramatic peak or transitional passage?
- Pacing rhythm: What does the surrounding context demand?
- Cognitive load: Has the reader had enough showing lately?
- Efficiency: Is the prose doing more work than the moment warrants?`,

      gestures: `# Gesture Prose Variations

Generate diverse physical action alternatives for each gesture opportunity in the passage. The goal is to provide a rich menu of options showing how body language can convey emotion, intent, and character.

## Gesture Categories

### Micro-Expressions (Face)
- Eye movements (darting, narrowing, widening, blinking patterns)
- Mouth tells (lip compression, twitches, pursing, parting)
- Brow movements (furrowing, raising, knitting)
- Jaw tension, nostril flares, cheek movements

### Hand Gestures
- Self-soothing (touching face, neck, hair)
- Defensive (crossing arms, gripping objects)
- Aggressive (pointing, fist-making, table-slapping)
- Nervous (fidgeting, drumming, picking)
- Expressive (waving, gesturing while speaking)

### Full-Body Posture
- Stance shifts (leaning in/away, weight distribution)
- Shoulder movements (shrugging, tensing, dropping)
- Spatial behavior (stepping toward/back, turning away)
- Stillness as choice (freezing, becoming statue-like)

### Breath and Rhythm
- Breathing patterns (catching breath, sighing, exhaling sharply)
- Speaking rhythm (pausing, speeding up, trailing off)
- Physical rhythm (pacing, rocking, tapping)

## Variation Spectrum

For each gesture opportunity, provide alternatives across:
- **Intensity**: Subtle → Moderate → Bold
- **Visibility**: Internal sensation → External action
- **Character-specific**: How THIS character would express THIS emotion

## Quality Markers

Good gesture prose:
✅ Shows without naming the emotion
✅ Feels specific to the character
✅ Matches the moment's intensity
✅ Avoids cliché gestures (nodding, shrugging as defaults)
✅ Creates visual imagery
✅ Implies subtext without stating it

Avoid:
❌ Generic gestures that could be anyone
❌ Telling the emotion alongside showing it
❌ Over-describing every micro-movement
❌ Gestures that contradict stated emotions`,

      choreography: `# Scene Choreography Analysis

Analyze the passage as a whole for movement patterns, staging, and physical action flow. Provide diverse alternatives while maintaining spatial continuity.

## Zone Mapping
Divide the scene into spatial/temporal zones:
- **Zone A**: Opening staging (where characters start, initial positions)
- **Zone B**: Core action (primary physical exchanges, main blocking)
- **Zone C**: Transitions (movement between beats, repositioning)
- **Zone D**: Resolution staging (final positions, exit choreography)

## Repetition Detection
Flag choreography patterns that repeat:
- Same movements across characters (everyone nods, shrugs, walks)
- Similar transitions (always "turned and walked")
- Monotonous staging (characters static in same positions)
- Default beats (constant sitting/standing without variety)

## Continuity Check
Verify physical logic:
- Character positions track logically through scene
- Objects remain where placed (or movement is shown)
- Spatial relationships stay consistent
- Actions are physically possible given staging

## Variation Principles
For each zone, provide alternatives that:
- Use different movement vocabulary
- Vary the scale (micro-gestures to major repositioning)
- Consider character-specific physicality
- Maintain emotional through-line while refreshing choreography

## Quality Markers

Good choreography:
✅ Varied movement vocabulary across the scene
✅ Spatial logic maintained throughout
✅ Movement reveals character and emotion
✅ Staging creates visual interest
✅ Transitions feel natural, not mechanical

Avoid:
❌ Everyone doing the same types of movements
❌ Static "talking heads" without physical grounding
❌ Breaking spatial continuity for convenience
❌ Over-choreographing (not every moment needs blocking)`,

      'stock-and-signature': `# Stock & Signature Analysis

Analyze the scene's cognitive economy—where convention serves as invisible infrastructure versus where the author's distinctive voice rises above it.

## The 4-Tier Spectrum

Categorize each significant beat:

**Tier 1 - Functional Stock** ✅ (Keep)
- Invisible infrastructure that orients readers
- Common gestures/transitions that don't draw attention
- Example: "She set her fork down." (pure function)

**Tier 2 - Decorated Stock** ⚠️ (The Fence)
- Stock with elevation attempts that draw attention to conventionality
- Example: "She set her fork down, the clink clean and final."
- Action: Strip to pure function OR upgrade to signature

**Tier 3 - Stock Doing Heavy Lifting** ❌ (Replace)
- Convention asked to carry emotional weight at peaks
- Example: "The refrigerator hummed, a mechanical heartbeat marking time."
- Action: Replace with signature beat

**Tier 4 - Signature Beats** 🔥 (Protect)
- Lines only THIS author would write
- Example: "He folded his napkin into a hard rectangle, crease after crease, like he could iron the hurt out of his words."
- Action: Protect; ensure nothing stock competes nearby

## Target Ratio
- 60-70% Functional Stock (invisible infrastructure)
- 10-15% Fence Moments (decide case-by-case)
- 0% Stock Doing Heavy Lifting
- 20-25% Signature Beats

## Peak-Moment Audit
Verify structural peaks (emotional climax, revelation, coda) are built on signature, not stock.

## External Provenance Check (Hard Risk Only)
Flag passages with genuine external source overlap risk:
- **Known Source**: "This closely echoes [Author]'s *[Title]*"
- **Verification Recommended**: Distinctive phrasing with potential external overlap

ONLY flag when: distinctive phrasing unlikely to arise independently, or specific source echo detectable.
Do NOT flag: scene-bound description, common metaphors, passages that are simply good.

## Closure & Air-Lock Detection (Craft Signal, Not Risk)
Identify passages that are unusually complete/self-contained (NOT an originality accusation):
- May compete with nearby signature beats
- May deserve author confirmation of intent
- Flag: extractable micro-essays, full metaphorical closure, quote-shaped passages

## Quality Markers

Good cognitive economy:
✅ Functional stock stays invisible (not decorated)
✅ Peaks built on signature beats
✅ Signature moments protected from competing stock
✅ Provenance risk separated from closure observations

Avoid:
❌ Decorating functional stock (draws attention to convention)
❌ Building emotional climaxes on stock furniture
❌ Conflating "polished" with "plagiarized"
❌ Treating closure-complete passages as accusations`
    };
    return defaults[focus];
  }
}

/**
 * Type guard to check if a focus is a WritingTools focus
 */
export function isWritingToolsFocus(focus: AssistantFocus): focus is WritingToolsFocus {
  return ['cliche', 'continuity', 'style', 'editor', 'fresh', 'repetition', 'decision-points', 'show-and-tell', 'gestures', 'choreography', 'stock-and-signature'].includes(focus);
}
