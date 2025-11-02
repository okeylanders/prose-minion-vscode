# Sprint 1 — Prompt Enhancements & Testing

## Epic

.todo/epics/epic-verbalized-sampling-2025-10-26/epic-verbalized-sampling.md

## Status

✅ Complete

**10-26-2025 | 2:30 PM CST**: Implemented
**Merged**: October 2025 (PR #4)

## Goal

Implement moderate approach prompt enhancements for dialogue microbeat and prose assistants, adding Verbalized Sampling instructions that encourage creative diversity while maintaining craft quality.

## ADR Reference

- [docs/adr/2025-10-26-verbalized-sampling-for-creative-diversity.md](../../../../docs/adr/2025-10-26-verbalized-sampling-for-creative-diversity.md)
- Status: Approved
- Decision: Add "Diversity & Creative Sampling Instructions" section to both assistant prompts using moderate approach (permissive language, integration framing, explicit permission to push boundaries)

## Tasks

### 1. Update Dialogue Microbeat Assistant Prompt

File: `resources/system-prompts/dialog-microbeat-assistant/00-dialog-microbeat-assistant.md`

**Changes**:
- Add new section at bottom: "## Diversity & Creative Sampling Instructions"
- Include subsections:
  - Sampling Strategy (avoid obvious, character-specific, sensory variation, pacing, contextual uniqueness)
  - Probability Awareness (p<0.10, varied suggestions, skilled writer thinking)
  - Quality Preservation (moderate approach: "Prioritize suggestions that serve...", integration framing, permission clause)
  - Practical Application (reframe from "standard way" to "5–8 distinct ways")

**Key Language**:
- "Prioritize suggestions that serve the scene's emotional truth and blocking logic. When offering an unexpected option, note how it integrates—or why it's worth bending the rules."
- "**If you find yourself thinking 'This is too unusual,' that's a signal you're in the right creative space.** Offer it with context about when/why it would work."

### 2. Update Prose Assistant Prompt

File: `resources/system-prompts/prose-assistant/00-prose-assistant.md`

**Changes**:
- Add new section at bottom: "## Diversity & Creative Sampling Instructions"
- Include subsections:
  - Sampling Strategy (avoid clichés, lexical variety, syntactic diversity, mood-specific palettes, unexpected juxtapositions)
  - Probability Awareness (p<0.10, distinct over synonymous, skilled stylist thinking)
  - Quality Preservation (moderate approach: "Prioritize suggestions that fit...", integration framing, permission clause)
  - Practical Application (reframe from "what words describe X" to "6–8 sensory-specific, contextually grounded ways")

**Key Language**:
- "Prioritize suggestions that fit the established tone, POV, and narrative context. When offering unexpected vocabulary/imagery, note how it integrates—or why it's worth the stylistic risk."
- "**If you find yourself thinking 'This word is too unusual,' that's a signal you're in the right creative space.** Offer it with context about when/why it would elevate the prose."

### 3. Manual Testing

**Test Passages** (prepare 5–6 diverse examples):
- Dialogue-heavy scene (2-3 characters, emotion/tension)
- Descriptive prose (setting, mood)
- Action sequence
- Introspective/internal monologue
- Mixed scene (dialogue + prose)

**Testing Protocol**:
1. Run each passage through BOTH assistants (before/after prompt changes if possible, or compare to expected baseline)
2. Count unique microbeats/phrases per response
3. Assess diversity: Are suggestions genuinely distinct, or subtle variations?
4. Assess quality: Any POV breaks, blocking errors, tone mismatches?
5. Document findings in a test report (can be simple markdown in this sprint folder)

**Baseline Expectations**:
- **Diversity**: 1.5–2.0× increase in unique suggestions (e.g., from 4–5 truly distinct beats to 6–10)
- **Quality**: Zero regressions in craft adherence; suggestions still contextually grounded

### 4. Documentation Updates (Optional)

If prompt changes result in noticeably different assistant behavior:
- Update `.claude/CLAUDE.md` under "What's New" section
- Add note: "Dialogue and prose assistants now provide more diverse, character-specific suggestions while maintaining craft quality (Verbalized Sampling technique)."

## Affected Files

- resources/system-prompts/dialog-microbeat-assistant/00-dialog-microbeat-assistant.md (update)
- resources/system-prompts/prose-assistant/00-prose-assistant.md (update)
- .claude/CLAUDE.md (optional update)
- .todo/epics/epic-verbalized-sampling-2025-10-26/sprints/test-report.md (new, for manual testing results)

## Acceptance Criteria

- ✅ New "Diversity & Creative Sampling Instructions" section added to dialogue microbeat assistant prompt
- ✅ New "Diversity & Creative Sampling Instructions" section added to prose assistant prompt
- ✅ Prompts use moderate approach with permissive language and integration framing
- ✅ Permission clauses included: "If you find yourself thinking 'This is too unusual'..."
- ✅ Manual testing completed with 10+ total responses across both assistants
- ✅ Diversity increase observed (1.5–2.0× unique suggestions per response)
- ✅ No quality regressions (POV, blocking, tone, craft adherence maintained)
- ✅ Test report documented with findings

## Risks/Notes

- **No code changes**: This is purely prompt engineering; no TypeScript/React modifications
- **Manual testing**: Qualitative assessment required; diversity metrics are approximate
- **Iterative tuning**: If results don't meet expectations, adjust probability threshold or quality preservation language
- **Model variability**: Larger models (GPT-4, Claude Opus) will show more diversity improvement than smaller models

## Next Actions After Sprint

1. Merge prompt changes to main branch once validated
2. Monitor user feedback over next 2–4 weeks (GitHub issues, usage patterns)
3. Consider adjustments if feedback indicates:
   - Insufficient diversity → lower probability threshold to p<0.05
   - Quality concerns → tighten quality preservation language
4. Future epic: Prose Playground Assistant (separate tool for minimal-constraint exploration)
