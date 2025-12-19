# Epic: Verbalized Sampling for Creative Diversity

## Status

**10-26-2025 | 2:30 PM CST**: Implemented

## Sprint Plan: 2025-10-26 → 2025-10-29

This epic implements Verbalized Sampling techniques in the dialogue microbeat and prose assistant system prompts to unlock creative diversity while maintaining craft quality. Based on Stanford/Northeastern/WVU research showing 1.6–2.1× diversity increase and 66.8% recovery of base model creativity.

## Objectives

- Enhance dialogue microbeat assistant with diversity-focused sampling instructions
- Enhance prose assistant with diversity-focused sampling instructions
- Use moderate approach: permissive framing that encourages boundary-pushing with justification
- Maintain craft quality and context-grounding while expanding creative range
- Validate diversity improvement through manual testing

## References

- ADR: [docs/adr/2025-10-26-verbalized-sampling-for-creative-diversity.md](../../../docs/adr/2025-10-26-verbalized-sampling-for-creative-diversity.md)
- Research: [.research/Stanford AI Breakthrough: Unlock ChatGPT Creativity | Generative AI.pdf](../../../.research/Stanford%20AI%20Breakthrough:%20Unlock%20ChatGPT%20Creativity%20|%20Generative%20AI.pdf)
- Future work: [docs/adr/2025-10-26-prose-playground-assistant-draft.md](../../../docs/adr/2025-10-26-prose-playground-assistant-draft.md)

## Scope Overview

1. **Prompt Enhancements (Critical)** — Add "Diversity & Creative Sampling Instructions" to both assistants
2. **Manual Testing** — Validate diversity improvement and craft adherence
3. **Documentation** — Update CLAUDE.md if needed

Out-of-scope: Prose Playground assistant (deferred to future epic per draft ADR)

## Milestones and Work Items

### Sprint 1 — Prompt Enhancements & Testing (Days 1–3)

**Goal**: Implement moderate approach prompt enhancements and validate through manual testing

**Tasks**:
1. Update dialogue microbeat assistant system prompt
   - Add "Diversity & Creative Sampling Instructions" section
   - Implement moderate approach (permissive language, integration framing)
   - Add permission clause: "If you find yourself thinking 'This is too unusual'..."

2. Update prose assistant system prompt
   - Add "Diversity & Creative Sampling Instructions" section
   - Implement moderate approach with prose-specific guidance
   - Add permission clause for vocabulary/imagery suggestions

3. Manual testing
   - Generate 10+ responses from dialogue assistant with test passages
   - Generate 10+ responses from prose assistant with test passages
   - Compare diversity (unique microbeats/phrases) vs. baseline
   - Verify craft adherence (no POV breaks, blocking errors, tone mismatches)

4. Documentation updates (if needed)
   - Update CLAUDE.md if prompt changes significantly alter assistant behavior
   - Add note to release notes/changelog about improved diversity

**Affected Files**:
- resources/system-prompts/dialog-microbeat-assistant/00-dialog-microbeat-assistant.md
- resources/system-prompts/prose-assistant/00-prose-assistant.md
- .claude/CLAUDE.md (optional update)

**Acceptance Criteria**:
- ✅ New "Diversity & Creative Sampling Instructions" section added to both assistant prompts
- ✅ Prompts use moderate approach (permissive, integration-focused language)
- ✅ Manual testing shows 1.5–2.0× diversity increase in suggestions
- ✅ No regressions in POV/tense consistency, blocking logic, or tone matching
- ✅ Suggestions still grounded in craft principles (quality preservation maintained)

**Risks/Notes**:
- This is a prompt-only change; no code modifications required
- Testing is manual to assess qualitative diversity and coherence
- If diversity increase is insufficient, consider adjusting probability threshold (p<0.10 → p<0.05)
- If quality degrades, tighten quality preservation language

## Cross-Cutting Concerns

- **Backward Compatibility**: Fully backward compatible; additive enhancement only
- **No Code Changes**: This is prompt engineering; no TypeScript/React changes
- **Model Agnostic**: Works across Claude, GPT-4, Gemini (larger models benefit more)
- **Token Cost Neutral**: No increase in prompt length or response tokens expected

## Review & Verification Cadence

- Draft prompt updates → user review → implement → manual testing
- Test with diverse passage types (dialogue-heavy, descriptive prose, action, introspective)
- Compare responses before/after prompt changes
- Document diversity metrics (unique suggestions per response) and quality observations

## Definition of Done

- ADR finalized and committed with accepted status
- Prompt updates committed to both assistant system prompt files
- Manual testing completed with documented results
- No regressions in assistant quality or craft adherence
- Optional: CLAUDE.md or changelog updated if behavior change is significant enough to communicate to users

## Future Work (Separate Epic)

- Prose Playground Assistant (minimal-constraint creative exploration tool)
- See draft ADR: [docs/adr/2025-10-26-prose-playground-assistant-draft.md](../../../docs/adr/2025-10-26-prose-playground-assistant-draft.md)
