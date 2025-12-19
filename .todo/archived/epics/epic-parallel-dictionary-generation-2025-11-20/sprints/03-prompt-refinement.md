# Sprint 03: Prompt Refinement

**Epic**: [Parallel Dictionary Generation](../epic-parallel-dictionary-generation.md)
**Status**: Pending
**Duration**: 1-2 days
**Branch**: `epic/parallel-dictionary-generation-2025-11-20` (shared across all sprints)

---

## Goals

Refine block-specific prompts for quality and consistency:
- Test across models (Claude, GPT-4, Gemini)
- Eliminate cross-block leakage (blocks referencing each other)
- Validate quality vs. standard generation
- Achieve 2× speed improvement minimum
- Gather user feedback on speed/quality trade-off

---

## Tasks

### 1. Cross-Model Testing

**Models to Test**:
- Claude Sonnet 3.5
- Claude Opus 3.5
- GPT-4 Turbo
- Gemini Pro

**Test Words** (variety of complexity):
- Simple: "run", "light", "fall"
- Medium: "ephemeral", "serendipity", "melancholy"
- Complex: "antidisestablishmentarianism", "schadenfreude", "sonder"

#### Testing Process

- [ ] **For each model**:
  - [ ] Test with 3 simple words
  - [ ] Test with 3 medium complexity words
  - [ ] Test with 2 complex words
  - [ ] Record results in testing matrix (see below)

- [ ] **Testing Matrix** (create spreadsheet or markdown table):

  **Per-Section Quality Scores (1-5):**

  | Model | Word | 📕 Def | 🔈 Pron | 🧩 POS | 🔍 Sense | 🗣️ Reg | 🪶 Narr | 📚 Coll | 🧬 Morph | 🎭 Voice | 🎵 Sound | 🌐 Trans | ⚠️ Watch | 🧭 Grad | 🧠 AI | Leakage? | Duration |
  |-------|------|--------|---------|--------|----------|--------|---------|---------|----------|----------|----------|----------|----------|---------|-------|----------|----------|
  | Claude Sonnet | run | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | Y/N | X.Xs |

#### Quality Criteria (per section)

**14 Sections to Test:**

1. 📕 **Definition**: Clear, concise, relevant to creative writing (not overly technical)
2. 🔈 **Pronunciation**: IPA correct, phonetic respelling helpful, syllables/stress accurate
3. 🧩 **Parts of Speech**: Complete enumeration with useful descriptors
4. 🔍 **Sense Explorer**: Numbered senses with definitions, examples, synonyms (8-12), antonyms (4-6), nuance notes
5. 🗣️ **Register & Connotation**: Registers identified, emotional valence clear, tonal sliders meaningful
6. 🪶 **Narrative Texture**: Sensory tags relevant, mood levers insightful, symbolic associations creative
7. 📚 **Collocations & Idioms**: High-value collocations, idioms listed, cliché warnings useful
8. 🧬 **Morphology & Family**: Inflections complete, derivational family accurate, compounds relevant
9. 🎭 **Character Voice Variations**: At least 8+ distinct character archetypes with unique phrasings
10. 🎵 **Soundplay & Rhyme**: Rhyme families accurate, slant rhymes creative, metrical guidance useful
11. 🌐 **Translations & Cognates**: Translations in 4+ languages, nuance comments helpful
12. ⚠️ **Usage Watchpoints**: Ambiguity risks identified, overuse alerts practical, regional pitfalls noted
13. 🧭 **Semantic Gradient**: Ordered ladder complete, intensity progression logical
14. 🧠 **AI Advisory Notes**: Uncertainty flagged appropriately, verification suggestions helpful

---

### 2. Guardrail Refinement

**Goal**: Prevent cross-block leakage (blocks referencing each other or including extra sections)

#### Identify Leakage Patterns

- [ ] Review testing matrix for cross-block leakage
- [ ] Document common patterns:
  - Example: 📕 Definition includes etymology notes (should be in 🔍 Sense Explorer)
  - Example: 🔍 Sense Explorer includes pronunciation guidance (should be in 🔈 Pronunciation)
  - Example: 🎭 Character Voice references "as defined above" (cross-reference to 📕 Definition)
  - Example: Blocks include preambles like "Here is the Definition section:"
  - Example: Blocks include section headers redundantly (e.g., "# 📕 Definition" when icon already present)

#### Strengthen Guardrails

- [ ] **Update prompts** (`resources/system-prompts/dictionary-fast/*.md`):
  - Add stronger constraints:
    - "Output ONLY the requested content. Do not include section headers, preambles, or closing remarks."
    - "Do not reference or include information from other sections (definitions, etymology, etc.)."
    - "Begin directly with the content."
  - Add output format examples:
    ```markdown
    Example (good):
    1. (verb) To move at a speed faster than a walk...
    2. (noun) An act of running...

    Example (bad):
    Here are the definitions for "run":
    ## Definitions
    1. (verb) To move at a speed faster than a walk...
    [Also see Etymology section for origin]
    ```

- [ ] Test refined prompts with same test words
- [ ] Verify leakage reduced to <5% of cases

---

### 3. Quality Validation vs. Standard Generation

**Goal**: Ensure fast generate quality is comparable to standard generation

#### Comparison Testing

- [ ] Generate 10 dictionary entries using **standard generation**
- [ ] Generate same 10 words using **fast generation**
- [ ] Compare side-by-side:
  | Word | Standard Quality (1-5) | Fast Quality (1-5) | Quality Delta | Standard Duration (s) | Fast Duration (s) | Speed Improvement |
  |------|------------------------|-----------------------|---------------|----------------------|-------------------|-------------------|
  | run | 5 | 4 | -1 | 12.3 | 4.2 | 2.9× |
  | ... | ... | ... | ... | ... | ... | ... |

#### Quality Acceptance Criteria

- [ ] Fast generate quality ≥ 4/5 average (80% quality)
- [ ] Quality delta ≤ 1 point on average (acceptable trade-off)
- [ ] No critical information missing (e.g., definitions must be present)

---

### 4. Performance Validation

**Goal**: Achieve minimum 2× speed improvement

#### Performance Testing

- [ ] Test 20 words with fast generate
- [ ] Record durations for each
- [ ] Calculate average duration
- [ ] Compare to standard generation baseline (8-15s average)

#### Performance Acceptance Criteria

- [ ] Average fast generate duration: **≤7 seconds** (2× faster than 14s baseline)
- [ ] 90th percentile duration: **≤10 seconds** (even slow cases acceptable)
- [ ] Fastest cases: **≤4 seconds** (optimal parallelism)

---

### 5. Prompt Optimization

**Based on testing outcomes, optimize prompts for:**

#### A. Length Optimization

- [ ] Review block outputs for verbosity
- [ ] Adjust length hints in prompts:
  - Too verbose? Add "Be concise" or reduce example count
  - Too sparse? Add "Provide comprehensive coverage" or increase example count

#### B. Tone Consistency

- [ ] Ensure all blocks use consistent tone (professional but accessible)
- [ ] Adjust prompts to match standard dictionary tone
- [ ] Test tone across models (some models may need different phrasing)

#### C. Model-Specific Variations (if needed)

- [ ] If a model consistently underperforms:
  - Create model-specific prompt variant
  - Test variant vs. unified prompt
  - Document which models need custom prompts
  - Implement conditional prompt loading in service

---

### 6. User Feedback Collection

**Goal**: Gather qualitative feedback on speed/quality trade-off

#### Feedback Questions

- [ ] Create feedback form or interview script:
  1. "Did you notice a speed difference between standard and fast generate?" (Yes/No)
  2. "How would you rate the quality of fast generate results?" (1-5 scale)
  3. "Would you use fast generate again?" (Yes/No/Maybe)
  4. "Any sections consistently missing or low-quality?" (Open-ended)
  5. "Acceptable trade-off (speed vs. quality)?" (Yes/No/Comments)

#### Testing Participants

- [ ] Recruit 3-5 users (or self-test with varied use cases)
- [ ] Provide 10 test words (mix of simple/medium/complex)
- [ ] Ask to generate using both methods
- [ ] Collect feedback

#### Feedback Analysis

- [ ] Aggregate responses
- [ ] Identify common quality issues
- [ ] Determine if trade-off acceptable (target: >70% "yes, would use again")

---

## Acceptance Criteria

✅ **Cross-Model Testing**:
- Testing matrix completed for 4 models × 8 test words
- Quality scores recorded for all 14 sections per entry
- Cross-block leakage documented per section

✅ **Guardrail Refinement**:
- Prompts updated with stronger constraints
- Cross-block leakage reduced to <5% of cases
- Output format examples added to prompts

✅ **Quality Validation**:
- Fast generate quality ≥ 4/5 average (80%)
- Quality delta ≤ 1 point vs. standard generation
- No critical information missing

✅ **Performance Validation**:
- Average duration ≤7 seconds (2× faster than baseline)
- 90th percentile ≤10 seconds
- Documented in ADR outcomes

✅ **User Feedback**:
- 3-5 users tested feature
- >70% would use fast generate again
- Feedback incorporated into prompt refinements

---

## Testing Checklist

### Cross-Model Quality Testing

- [ ] **Claude Sonnet 3.5**:
  - [ ] Test 8 words (3 simple, 3 medium, 2 complex)
  - [ ] Record quality scores for all 14 sections per entry
  - [ ] Note any leakage or issues per section
  - [ ] Check sections: 📕 🔈 🧩 🔍 🗣️ 🪶 📚 🧬 🎭 🎵 🌐 ⚠️ 🧭 🧠

- [ ] **Claude Opus 3.5**:
  - [ ] Test 8 words
  - [ ] Record quality scores for all 14 sections
  - [ ] Compare quality to Sonnet per section
  - [ ] Note performance differences

- [ ] **GPT-4 Turbo**:
  - [ ] Test 8 words
  - [ ] Record quality scores for all 14 sections
  - [ ] Compare quality to Claude models
  - [ ] Note any unique behaviors (e.g., verbosity, tone, weak sections)

- [ ] **Gemini Pro**:
  - [ ] Test 8 words
  - [ ] Record quality scores for all 14 sections
  - [ ] Identify any model-specific issues per section
  - [ ] Determine if custom prompts needed for specific sections

### Guardrail Effectiveness

- [ ] **Before refinement**:
  - [ ] Measure leakage rate (% of blocks with cross-references)
  - [ ] Document common leakage patterns

- [ ] **After refinement**:
  - [ ] Re-test same words
  - [ ] Verify leakage reduced
  - [ ] Target: <5% leakage rate

### Performance Benchmarking

- [ ] **Standard generation baseline**:
  - [ ] Generate 10 words using standard method
  - [ ] Record durations
  - [ ] Calculate average (should be ~8-15s)

- [ ] **Fast generation benchmark**:
  - [ ] Generate same 10 words using fast method
  - [ ] Record durations
  - [ ] Calculate average
  - [ ] Verify ≥2× speed improvement

---

## Dependencies

**Sprint 01 Deliverables**:
- Block-specific prompts created
- Service implementation functional
- Message flow working

**Sprint 02 Deliverables**:
- UI integration complete
- Fast generate button functional
- Progress updates working

---

## Notes

**Testing Strategy**:
- Iterative: Test → Refine → Re-test
- Focus on worst cases (complex words, slow models)
- Document trade-offs (speed vs. quality per model)

**Model Variability**:
- Claude models: Typically high quality, may be verbose
- GPT-4: Balanced quality/speed, consistent output
- Gemini: Variable quality, may need custom prompts

**Prompt Engineering Tips**:
- Negative constraints effective: "Do NOT include X"
- Examples powerful: Show good vs. bad outputs
- Conciseness cues: "Be concise" vs. "Provide comprehensive coverage"

**Alpha Development**:
- Acceptable to drop underperforming models (e.g., if Gemini quality poor, document and defer)
- Focus on best experience (Claude + GPT-4 priority)

---

## Outcomes (Post-Sprint)

**Completed**: [Date]
**PR**: [Link]
**Actual Duration**: [Days]

**Achievements**:
- [Quality scores by model]
- [Leakage rate before/after refinement]
- [Performance benchmark results]
- [User feedback summary]

**Model-Specific Findings**:
- [Which models performed best]
- [Any models requiring custom prompts]
- [Recommended default model for fast generate]

**Issues Discovered**:
- [Architecture debt identified]
- [Prompt engineering challenges]
- [Lessons learned]

---

**Last Updated**: 2025-11-20
