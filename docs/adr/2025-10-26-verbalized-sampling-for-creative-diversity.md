# ADR: Verbalized Sampling for Creative Diversity in Dialogue & Prose Assistants

- Status: Proposed
- Date: 2025-10-26

## Context

The dialogue microbeat assistant and prose assistant tools rely on aligned LLMs (Claude, GPT-4, Gemini) accessed through OpenRouter. While these models are highly capable, recent research from Stanford, Northeastern, and West Virginia University has identified a critical limitation: **post-training alignment introduces mode collapse that systematically reduces creative output diversity**.

### The Problem: Typicality Bias in Aligned Models

When OpenAI, Anthropic, and Google trained their models to be "helpful and harmless" using RLHF (Reinforcement Learning from Human Feedback) and DPO (Direct Preference Optimization), an unintended consequence occurred: the models learned to favor the most **typical, conventional, safe responses** over diverse creative alternatives.

Research analysis of 6,874 human preference ratings from the HelpSteer dataset reveals that human annotators exhibit systematic typicality bias (α = 0.57±0.07, p<10^-14) driven by:
- **Mere-exposure effect**: Preference for familiar patterns
- **Availability heuristic**: Common responses feel more "correct"
- **Processing fluency**: Easy-to-process content seems higher quality
- **Schema congruity**: Responses matching mental models get rated higher

For creative writing tasks like dialogue beat suggestions and prose improvements, this manifests as:
- Repetitive microbeat recommendations (head nods, sighs, crossed arms)
- Stereotypical imagery and metaphors
- Safe, conventional phrasing over unique alternatives
- Reduced vocabulary diversity in suggestions

The creativity isn't lost—it's **trapped** in the probability distribution. The model still "knows" diverse alternatives but systematically suppresses them in favor of high-probability, typical responses.

### The Solution: Verbalized Sampling

The Stanford team's technique, called **Verbalized Sampling**, unlocks this trapped creativity without retraining or fine-tuning. By instructing models to "sample from the tails of the distribution" and provide multiple responses with explicit probability awareness, we can recover 66.8% of the base model's creative diversity (vs. 23.8% without it).

**Key Research Findings:**
- **1.6–2.1× diversity increase** for creative writing tasks (poems, stories, dialogue)
- **25.7% improvement** in human preference ratings for creative outputs
- **Larger models benefit more**: GPT-4 sees 2× the diversity boost vs. GPT-4-Mini
- **No safety degradation**: Factual accuracy and helpfulness remain intact
- **Emergent creativity**: The technique reveals capabilities that appeared "lost" post-alignment

## Decision

Enhance the `dialog-microbeat-assistant` and `prose-assistant` system prompts to incorporate Verbalized Sampling techniques that encourage diverse, creative suggestions drawn from the full probability distribution rather than only the most typical responses.

### Implementation Strategy

Add a new section to both system prompt files that:
1. Explicitly instructs the model to sample from the tails of the probability distribution
2. Encourages generation of multiple diverse alternatives (not just the "safest" option)
3. Frames suggestions as a sample of possibilities rather than the singular "best" answer
4. Maintains the existing quality standards while expanding creative range

This enhancement will:
- **Preserve existing structure**: Add as a new section at the bottom of current prompts
- **Maintain backward compatibility**: Existing guidance remains; new guidance augments
- **Respect author voice**: Diversity in suggestions doesn't mean abandoning craft principles
- **Avoid over-generation**: Balance between variety and overwhelming the user

## Proposed Changes

### Files to Update

1. **`resources/system-prompts/dialog-microbeat-assistant/00-dialog-microbeat-assistant.md`**
   - Add new section: "## Diversity & Creative Sampling Instructions"

2. **`resources/system-prompts/prose-assistant/00-prose-assistant.md`**
   - Add new section: "## Diversity & Creative Sampling Instructions"

### New Prompt Section (Dialogue Microbeat Assistant)

```markdown
## Diversity & Creative Sampling Instructions

When generating microbeat suggestions, attribution alternatives, or revision examples, consciously sample from the **tails of the probability distribution** to unlock creative diversity beyond typical responses.

### Sampling Strategy
- **Avoid the obvious**: The first microbeat that comes to mind (head nod, sigh, crossed arms) is likely the most typical—offer it, but don't stop there.
- **Character-specific physicality**: Draw from unique gestures, postures, or spatial behaviors that align with this character's background, profession, emotional state, and relationship dynamics.
- **Sensory variation**: If one beat uses visual cues (eye contact), consider tactile (adjusting collar), auditory (clearing throat), or proprioceptive (weight shift) alternatives.
- **Pacing diversity**: Mix beats that slow the moment (long pause, deliberate action) with those that accelerate (quick gesture, clipped movement).
- **Contextual uniqueness**: Mine the setting, props, and situation for beats that couldn't exist in a different scene (using the sandwich as a prop, glancing at office bookshelves).

### Probability Awareness
When generating your menu of 4–8 microbeat options or revision suggestions:
- Imagine you're sampling from a probability space where p<0.10 for each suggestion (the less-common 10% of possibilities).
- Prioritize **varied** suggestions over **similar** ones—if two beats serve the same function (both show hesitation), keep only the more distinctive option.
- Think: "What would a skilled writer do that most writers wouldn't think of?"

### Quality Preservation
Diversity does not mean randomness or abandoning craft:
- Prioritize suggestions that serve the scene's emotional truth and blocking logic. When offering an unexpected or unconventional option, briefly note how it integrates with the passage's constraints—or why it's worth bending them.
- Maintain POV/tense consistency and character voice.
- Anchor choices in craft principles (from the compendium) even when exploring less-typical options.
- If a highly typical suggestion is genuinely the best choice, include it—but explain why it outperforms alternatives.
- **If you find yourself thinking "This is too unusual," that's a signal you're in the right creative space.** Offer it with context about when/why it would work.

### Practical Application
Instead of thinking: "What's the standard way to show frustration in dialogue?"
Think: "What are 5–8 distinct ways this specific character, in this specific moment, might physically express frustration—ranging from subtle to overt, from internal to external, from conventional to unexpected?"

The goal: Expand the author's creative palette without sacrificing coherence or clarity.
```

### New Prompt Section (Prose Assistant)

```markdown
## Diversity & Creative Sampling Instructions

When providing diction recommendations, imagery suggestions, revision examples, or wordbank entries, consciously sample from the **tails of the probability distribution** to unlock creative diversity beyond conventional prose patterns.

### Sampling Strategy
- **Avoid clichéd imagery**: The first metaphor or sensory detail that comes to mind (trembling hands, pounding heart, golden sunset) is likely overused—acknowledge it if relevant, but offer fresher alternatives.
- **Lexical variety**: For any concept, explore synonyms and near-synonyms across registers (formal/informal), connotations (neutral/charged), and sensory modes (abstract/concrete).
- **Syntactic diversity**: Mix sentence structures—vary length, rhythm, and opening patterns (subject-first, participial phrase, prepositional phrase, inverted syntax).
- **Mood-specific palettes**: Instead of generic "descriptive words," curate vocabulary that aligns with the passage's specific tone (clinical vs. lyrical, detached vs. immersive, whimsical vs. ominous).
- **Unexpected juxtapositions**: Pair sensory details in uncommon ways (sound with texture, taste with emotion, temperature with color).

### Probability Awareness
When generating your wordbank (4–8 terms) or targeted revision suggestions:
- Imagine you're sampling from a probability space where p<0.10 for each word/phrase (the less-common 10% of possibilities).
- Prioritize **distinct** suggestions over **synonymous** ones—if two words evoke nearly identical imagery, keep only the more evocative or contextually specific option.
- Think: "What vivid, precise language would a skilled stylist choose that most writers wouldn't consider?"

### Quality Preservation
Diversity does not mean obscurity or purple prose:
- Prioritize suggestions that fit the established tone, POV, and narrative context. When offering unexpected or unconventional vocabulary/imagery, briefly note how it integrates with the passage's mood—or why it's worth the stylistic risk.
- Maintain continuity of setting, character voice, and internal logic.
- Anchor choices in craft principles (sensory layering, varied cadence, concrete over abstract) even when exploring less-typical options.
- If a common phrase genuinely serves the passage best, include it—but explain why it outperforms more distinctive alternatives.
- **If you find yourself thinking "This word is too unusual," that's a signal you're in the right creative space.** Offer it with context about when/why it would elevate the prose.

### Practical Application
Instead of thinking: "What words describe sadness?"
Think: "What are 6–8 sensory-specific, contextually grounded ways to evoke this character's particular shade of sadness in this setting—drawing from sight, sound, proprioception, spatial awareness, and object interaction—that avoid generic emotional labels?"

For revision examples, instead of applying the most standard fix:
- Generate 2–3 revision variations that solve the same problem through different stylistic choices (rhythm, syntax, imagery density).
- Show the author multiple valid paths, not just the "safest" one.

The goal: Equip the author with a diverse creative toolkit that respects their voice while expanding their stylistic range.
```

## Expected Benefits

### For Dialogue Microbeat Assistant
- **Wider beat repertoire**: Move beyond the "usual suspects" (nods, sighs, smirks) to character-specific, context-grounded physicality.
- **Reduced repetition**: Authors receive 4–8 genuinely distinct options instead of subtle variations on the same gesture.
- **Stronger characterization**: Beats drawn from character background/profession feel more authentic and revealing.
- **Enhanced scene variety**: Different exchanges get different beat patterns, avoiding formula.

### For Prose Assistant
- **Richer wordbanks**: 4–8 evocative terms that span registers, connotations, and sensory modes.
- **Unexpected imagery**: Fresh metaphors and details that surprise without feeling forced.
- **Syntactic range**: Revision examples that demonstrate varied sentence rhythms and structures.
- **Style elevation**: Authors see possibilities they wouldn't have considered, expanding their craft vocabulary.

### Quantitative Expectations (Based on Research)
- **1.6–2.1× diversity increase** in suggestions (measured by unique microbeats/phrases per response)
- **~25% improvement** in perceived usefulness of suggestions (based on user feedback)
- **66.8% recovery** of creative range compared to base model output (vs. 23.8% baseline)
- **No degradation** in factual accuracy, craft-adherence, or blocking/continuity logic

### User Experience Impact
- Authors receive a **creative menu** rather than a single "correct" answer
- Suggestions feel less formulaic and more tailored to the specific passage
- The assistants become **generative partners** rather than validators of typical choices
- Writers discover new techniques and vocabulary through exposure to diverse options

## Implementation Notes

### Prompt Engineering Approach
- **Placement**: Add as final section to preserve existing structure and flow
- **Explicit framing**: Use clear headers and bullet points for AI parsing
- **Probability language**: "Sample from tails" (p<0.10) provides concrete guidance without requiring mathematical computation
- **Preservation clauses**: Emphasize that diversity must still respect craft, continuity, and context

### Testing & Validation
- **Qualitative assessment**: Review 10–20 responses from each assistant before/after prompt changes
- **Diversity metrics**: Count unique microbeats/phrases per response; compare to baseline
- **User feedback**: Monitor any reports of suggestions feeling "off-brand" or incoherent
- **Craft adherence**: Verify that increased diversity doesn't introduce POV breaks, blocking errors, or tone mismatches

### Rollout Strategy
1. **Update prompts** for both assistants simultaneously (maintain consistency)
2. **Internal testing**: Generate responses for a set of standard test passages
3. **Monitor initial usage**: Check for any unexpected behaviors or quality regressions
4. **Iterate if needed**: Adjust probability thresholds or quality preservation clauses based on results

### Configuration Considerations
- **No new settings required**: This is a prompt-level enhancement, not a user-facing toggle
- **Model-agnostic**: Works across Claude, GPT-4, Gemini (larger models benefit more)
- **Token cost neutral**: Diversity doesn't require longer prompts or responses; just different sampling strategy

## Risks & Mitigations

### Risk: Over-diversification
**Description**: Suggestions become too esoteric, obscure, or contextually inappropriate.
**Mitigation**: Strong "Quality Preservation" section in prompt; explicit grounding in craft principles and scene context.

### Risk: Inconsistent Application
**Description**: Some responses exhibit high diversity, others revert to typical patterns.
**Mitigation**: This is expected (stochastic sampling); users benefit from occasional high-diversity responses even if not every response is maximally creative.

### Risk: User Preference for Familiar
**Description**: Some users may prefer conventional suggestions and find diverse options distracting.
**Mitigation**: Prompts still include typical options when genuinely best; users can ignore suggestions that don't resonate. Future: Could add opt-out toggle if feedback indicates demand.

### Risk: Craft Principle Drift
**Description**: Pursuit of novelty compromises adherence to established writing craft (show-don't-tell, concrete details, etc.).
**Mitigation**: Prompt explicitly anchors diversity in craft principles; quality preservation is equal priority to creative range.

## Alternatives Considered

### Alternative 1: Explicit Multi-Response Format
Ask the AI to return 5 separate responses with `<response><text>...</text><probability>...</probability></response>` tags, as described in the original Verbalized Sampling paper.

**Rejected because**:
- Requires message handler changes to parse structured output
- Increases token usage (5 full responses vs. 1 response with 5 suggestions embedded)
- Disrupts current UX flow (single cohesive response with bulleted menu)
- The *implicit* diversity instruction achieves similar benefits without structural changes

### Alternative 2: Temperature/Top-P Tuning
Increase `temperature` or adjust `top_p` sampling parameters in API calls.

**Rejected because**:
- Research shows prompt-based Verbalized Sampling outperforms temperature tuning for aligned models
- Temperature changes affect entire response (including prose, explanations, craft notes), not just creative suggestions
- Harder to control quality when relying purely on sampling parameters
- Prompt-based approach is more interpretable and maintainable

### Alternative 3: User-Facing Toggle
Add a setting like `proseMinion.assistants.creativeDiversity: boolean` to enable/disable this behavior.

**Deferred**:
- Implement prompt changes first; assess user feedback
- Add toggle only if significant user demand for "conventional mode"
- Premature optimization: most users likely to benefit from increased diversity

## Backward Compatibility

- **Fully backward compatible**: Existing prompt sections remain unchanged
- **Additive enhancement**: New section augments rather than replaces current instructions
- **No message contract changes**: Output format, markdown structure, and UI rendering unchanged
- **No configuration dependencies**: Works with existing settings and model selections

## Testing Plan

### Pre-Rollout Validation
1. **Generate test responses**: Run 20 dialogue passages and 20 prose passages through both assistants
2. **Diversity measurement**: Count unique microbeats/phrases per response; compare to baseline (pre-change) responses
3. **Craft adherence check**: Review for POV breaks, blocking errors, tone mismatches
4. **Typical-option presence**: Verify that conventional suggestions still appear when appropriate (not *only* esoteric options)

### Post-Rollout Monitoring
1. **User feedback**: Monitor GitHub issues, usage patterns, any reports of quality concerns
2. **Response auditing**: Periodically review sampled responses for continued craft adherence
3. **Iterative refinement**: Adjust prompt language (probability thresholds, quality clauses) based on observed behavior

## Success Metrics

### Quantitative
- **Diversity increase**: 1.5–2.0× more unique microbeats/phrases per response (measured on test set)
- **Token efficiency**: No significant increase in response length or token usage
- **Error rate**: No increase in POV breaks, blocking errors, or continuity issues

### Qualitative
- **Usefulness**: User feedback indicates suggestions feel "fresher," "more tailored," "less formulaic"
- **Craft alignment**: Suggestions still grounded in established writing principles
- **Adoption rate**: Authors integrate suggested microbeats/wordbank terms into their work (observable in revision patterns, if trackable)

## References

- **Stanford/Northeastern/WVU Research Paper**: "Verbalized Sampling: Overcoming Mode Collapse in Aligned Language Models" (2024–2025)
  - Local copy: [`.research/Stanford AI Breakthrough: Unlock ChatGPT Creativity | Generative AI.pdf`](../../.research/Stanford%20AI%20Breakthrough:%20Unlock%20ChatGPT%20Creativity%20|%20Generative%20AI.pdf)
  - Key Finding: Post-training alignment reduces creative diversity due to typicality bias (α=0.57±0.07, p<10^-14)
  - Technique: Instructing models to "sample from tails of distribution" recovers 66.8% of base model creativity
  - Performance: 1.6–2.1× diversity increase, 25.7% preference improvement for creative tasks
- **Related ADR**: [Prose Playground Assistant (Draft)](2025-10-26-prose-playground-assistant-draft.md) — Future minimal-constraint creative exploration tool

## Open Questions

1. **Optimal probability threshold**: Is p<0.10 the right target, or should we experiment with p<0.15 or p<0.05?
   - **Decision**: Start with p<0.10 (per research); adjust based on observed output quality.

2. **Per-tool tuning**: Should dialogue assistant use different diversity instructions than prose assistant?
   - **Decision**: Start with parallel prompts; diverge only if usage patterns indicate different needs.

3. **User awareness**: Should we surface this enhancement in release notes or UI tooltips?
   - **Decision**: Yes—mention in changelog that assistants now provide "more diverse, character-specific suggestions."

## Acceptance Criteria

- ✅ New "Diversity & Creative Sampling Instructions" section added to `dialog-microbeat-assistant/00-dialog-microbeat-assistant.md`
- ✅ New "Diversity & Creative Sampling Instructions" section added to `prose-assistant/00-prose-assistant.md`
- ✅ Prompt changes reviewed and approved via this ADR
- ✅ Test responses generated and validated for diversity increase + craft adherence
- ✅ No regressions in POV/tense consistency, blocking logic, or tone matching
- ✅ Documentation updated (if applicable): CLAUDE.md, README, or release notes

## Timeline

- **ADR Review**: 2025-10-26 (today)
- **Prompt Updates**: Immediately after ADR approval
- **Testing**: 1–2 days (generate and review test responses)
- **Rollout**: Merge to main branch once validation complete
- **Monitoring**: Ongoing; review feedback over next 2–4 weeks

## Conclusion

Verbalized Sampling represents a breakthrough in unlocking creative diversity from aligned AI models without retraining or architectural changes. By adding targeted prompt instructions that encourage sampling from the tails of the probability distribution, we can dramatically improve the creative range and usefulness of the dialogue microbeat and prose assistants—providing authors with richer, more varied, and more character-specific suggestions while maintaining craft quality and coherence.

This enhancement aligns perfectly with Prose Minion's mission: empowering creative writers with AI-augmented tools that expand their craft vocabulary and reveal new stylistic possibilities.

---

## Addendum: Design Tension Analysis and Two-Track Vision

### The Paradox at the Heart of This ADR

This proposal contains an inherent tension that warrants explicit discussion: we're instructing models to **"sample from the creative tails of the distribution"** (unlock diversity) while simultaneously requiring that they **"anchor suggestions in craft principles and context"** (constrain output).

**The Risk**: Could "quality preservation" clauses recreate the alignment problem at the prompt level? If we tell the model to be creative but also emphasize "every suggestion must fit established tone/POV/blocking," the model's alignment training might interpret "must fit" as "play it safe," filtering out the most interesting creative suggestions before they reach the user.

This is not a hypothetical concern—it strikes at the core mechanism that creates mode collapse in the first place: human preference for conventional responses.

### Why Anchors Are Appropriate for Prose Minion's Craft-Focused Assistants

Despite this tension, we've chosen to maintain craft-grounding clauses for the dialogue and prose assistants because:

#### 1. Purpose-Fit: These Are Craft Improvement Tools

The dialogue microbeat assistant and prose assistant are **not** open-ended creative writing generators. Users arrive with specific passages needing refinement within established narrative constraints. The tools' value proposition is "help me improve *this specific passage*"—not "show me wild alternatives disconnected from my story."

#### 2. Contextual Constraints Are Real and Necessary

Some constraints are not arbitrary limitations—they're logical requirements:

- **Blocking logic**: A microbeat suggesting a character picks up an object that isn't in the scene isn't "creative"—it's contextually wrong
- **POV consistency**: Third-person limited suddenly including another character's internal thoughts breaks the narrative contract
- **Tonal coherence**: Suggesting whimsical imagery for a tense thriller scene misunderstands the passage's purpose

#### 3. Trust and Adoption
If 3 out of 8 suggestions feel contextually inappropriate, tonally jarring, or logically inconsistent, users will stop trusting the tool—even if the other 5 suggestions are brilliant. Trust is the currency of adoption.

#### 4. Research Alignment
The Stanford paper's 25% preference improvement measured *useful creative diversity*, not *random diversity*. The verbalized sampling technique still produced coherent, contextually appropriate output—it just explored less-obvious solutions within the problem space. The technique unlocks creativity that respects constraints, not creativity that ignores them.

### The Moderate Approach: Balancing Creativity and Craft

Given this analysis, we've adopted a **moderate approach** that threads the needle:

#### What Changed from Initial Draft

- **From restrictive**: "Every suggestion must still serve the scene's emotional truth"
- **To permissive**: "Prioritize suggestions that serve the scene's emotional truth. When offering an unexpected option, note how it integrates—or why it's worth bending the rules."

#### Key Permission Clause

Added explicit encouragement: **"If you find yourself thinking 'This is too unusual,' that's a signal you're in the right creative space."**

This reframes the model's self-censorship mechanism—instead of filtering unusual ideas, it should flag them as *exactly what we want* (with justification).

#### Framing Quality as Integration, Not Restriction

- **Not**: "Must fit the established tone" (binary gate)
- **But**: "Note how it integrates with the passage's mood—or why it's worth the stylistic risk" (invitation to explore boundaries)

This preserves craft grounding while giving the model explicit permission to push boundaries and explain creative risks.

### Two-Track Vision: Grounded Craft Tools + Open Creative Playground

The tension between "unlock creativity" and "anchor to craft" suggests a natural evolution for Prose Minion: **two distinct tool modes for two distinct user intents**.

#### Track 1: Dialogue/Prose Assistants (Current Enhancement)

- **User intent**: "Help me polish this passage within its narrative constraints"
- **Anchors**: Strong grounding in continuity, POV, blocking, tone
- **Sampling strategy**: p<0.10, filtered for coherence
- **Output style**: 6–8 suggestions, mostly contextually safe + 1–2 boundary-pushing options with justification

#### Track 2: Prose Playground Assistant (Future Enhancement)

- **User intent**: "Show me wild alternatives, surprise me, help me break out of my patterns"
- **Anchors**: Minimal—only safety boundaries, no craft constraints
- **Sampling strategy**: p<0.05 or lower (extreme tails of distribution)
- **Output style**: 5–10 suggestions ranging from plausible to experimental, clearly labeled "Inspiration Mode" or "Experimental"
- **Use cases**:
  - Brainstorming when stuck
  - Voice/style experimentation
  - Breaking out of repetitive patterns
  - Exploring "what if I tried something completely different?"

#### Why This Two-Track Design Works

1. **User self-selection**: Users choose based on their current need (polish vs. explore)
2. **Risk isolation**: The Playground can be clearly marked as experimental, preserving trust in the craft-focused tools
3. **A/B learning**: We can observe which approach users prefer for different tasks and iterate
4. **Creative freedom**: The Playground can truly "let go" without undermining the reliability of the primary assistants
5. **Expanded use cases**: Opens Prose Minion to new workflows beyond passage refinement

### Decision: Moderate Now, Playground Later

**For this ADR (immediate implementation)**:

- Keep craft-grounding anchors in dialogue/prose assistants
- Adjust language to be less restrictive and explicitly encourage boundary-pushing with justification
- Accept that we're leaving some creative value on the table in exchange for reliability and trust

**For future work**:

- Create separate [Prose Playground Assistant ADR](2025-10-26-prose-playground-assistant-draft.md) (draft)
- Design minimal-constraint prompt architecture for pure creative exploration
- Determine UI placement and user communication ("Experimental Mode")
- Define integration with craft guides as "inspiration libraries" rather than constraint systems

### Meta-Insight: Prompt Engineering Mirrors the Alignment Problem

This design tension reveals a deeper truth: **prompt engineering can recreate the same typicality bias that verbalized sampling is meant to solve**.

When we write prompts with strong "must" and "always" language around quality, we're essentially performing our own RLHF at the prompt level—telling the model to favor safe, conventional responses. The moderate approach acknowledges this and deliberately uses permissive framing ("prioritize," "note how it integrates or why to bend rules") to counteract this bias.

The two-track vision acknowledges that **there is no universal optimal point on the creativity-constraint spectrum**—different tasks need different balances. Rather than compromise both, we can eventually serve both ends of the spectrum with purpose-built tools.

### Summary of Addendum

1. **The paradox is real**: Instructing creativity while requiring craft adherence could recreate mode collapse at the prompt level
2. **Anchors are justified**: For craft-focused assistants, contextual grounding is not arbitrary—it's purposeful
3. **Moderate approach**: Adjust language to be permissive rather than restrictive; explicitly encourage boundary-pushing with justification
4. **Two-track future**: Grounded craft tools (current) + minimal-constraint Playground (future) serve different user intents
5. **Immediate action**: Implement moderate approach now; defer Playground to separate ADR
6. **Design lesson**: Prompt engineering can mirror the alignment problem we're trying to solve—be intentional about permissive framing
