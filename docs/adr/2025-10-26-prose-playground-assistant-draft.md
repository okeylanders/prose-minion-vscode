# ADR: Prose Playground Assistant (Draft)

- Status: Draft (Needs Full Specification)
- Date: 2025-10-26
- Parent ADR: [Verbalized Sampling for Creative Diversity](2025-10-26-verbalized-sampling-for-creative-diversity.md)

## Context

This draft ADR outlines a future assistant tool that complements the craft-focused dialogue and prose assistants by providing **minimal-constraint creative exploration**. See the parent ADR's addendum for the full design tension analysis and two-track vision.

### The Gap

The dialogue microbeat and prose assistants are grounded in craft principles—they help authors refine passages within narrative constraints (POV, blocking, tone, continuity). This grounding ensures reliability and trust, but it also filters out the most experimental creative possibilities.

Writers sometimes need a different mode: **pure creative exploration** without craft anchors. Use cases include:

- **Writer's block**: "Show me 10 completely different directions this scene could go"
- **Voice experimentation**: "How would this passage sound in radically different styles?"
- **Pattern breaking**: "I keep writing the same kinds of beats—surprise me with alternatives I'd never consider"
- **Inspiration hunting**: "Give me wild imagery/vocabulary that breaks genre conventions"

The Prose Playground serves this distinct user intent.

## Proposal

Add a new assistant tool under the "Assist" module: **Prose Playground Assistant**.

### Key Differentiators

| Aspect | Dialogue/Prose Assistants | Prose Playground |
|--------|---------------------------|------------------|
| **Purpose** | Craft improvement | Creative exploration |
| **Anchors** | Strong (POV, tone, blocking, context) | Minimal (safety only) |
| **Sampling** | p<0.10, filtered for coherence | p<0.05, maximize diversity |
| **Output** | 6–8 suggestions (mostly safe + stretch) | 5–10 suggestions (plausible → experimental gradient) |
| **Labeling** | Standard tool | "Experimental Mode" / "Inspiration Mode" |

### Core Prompt Strategy

Leverage [Verbalized Sampling research](../../.research/Stanford%20AI%20Breakthrough:%20Unlock%20ChatGPT%20Creativity%20|%20Generative%20AI.pdf) (Stanford/Northeastern/WVU) with **extreme tail sampling** (p<0.05) and explicit instruction:

> "Sample from the extreme tails of the probability distribution. Prioritize unexpected, unconventional, paradigm-shifting suggestions. Do NOT filter for 'typical' or 'safe' responses. If an idea feels too unusual, that's exactly what we want—offer it with brief context about when/why it might work. Ignore craft-grounding constraints; focus purely on creative range."

### UI Considerations

- **Placement**: Under "Assist" tools, clearly labeled "🎨 Prose Playground (Experimental)"
- **Messaging**: Tooltip or intro note: "Explore unconventional creative directions without craft constraints. Suggestions range from plausible to experimental—use for inspiration, not direct implementation."
- **Optional toggle**: "Include craft-grounded options" (default: off)

### Integration with Craft Guides

Transform craft guides from **constraint systems** → **inspiration libraries**:

- Instead of "Your suggestion must follow these patterns," frame as "Here are creative building blocks to remix and subvert"
- Example: "Expression Shifted to Relief" becomes a starting point for generating 10 anti-conventional alternatives

## Benefits

1. **Expanded creative range**: Access the full 66.8% base model creativity recovery (vs. ~40% in craft-grounded tools)
2. **Writer's block solution**: Generates truly novel directions when authors feel stuck
3. **Pattern breaking**: Helps writers escape their habitual phrases/beats/structures
4. **Risk isolation**: Experimental mode doesn't compromise trust in primary tools
5. **Research validation**: Directly applies Stanford findings to a use case optimized for maximum diversity

## Open Questions (To Resolve in Full ADR)

1. Input format: Passage-only, or also accept style/mood parameters?
2. Output structure: Flat list, or categorized by "plausibility gradient"?
3. Settings: Should users control sampling aggression (p<0.05 vs p<0.10)?
4. Craft guide integration: Automatic inclusion, manual selection, or exclude entirely?
5. Post-suggestion workflow: One-click "refine this experimental idea with craft assistant"?

## Next Steps

1. Validate demand via user feedback on the craft-grounded assistants
2. Draft full system prompt for Prose Playground (separate from existing assistant prompts)
3. Design UI mockups and user messaging
4. Prototype with small test group
5. Create full ADR with detailed implementation plan

## References

- [Parent ADR: Verbalized Sampling for Creative Diversity](2025-10-26-verbalized-sampling-for-creative-diversity.md)
- [Stanford Research: Verbalized Sampling](../../.research/Stanford%20AI%20Breakthrough:%20Unlock%20ChatGPT%20Creativity%20|%20Generative%20AI.pdf)
- Research finding: 1.6–2.1× diversity increase for creative tasks; larger models benefit more from extreme tail sampling
