# Stanford Verbalized Sampling Research

## Overview

Stanford researchers discovered that adding just 8 words to AI prompts can dramatically increase creative diversity and quality in LLM outputs. This technique, called **Verbalized Sampling**, instructs the model to internally adjust its temperature/sampling parameters through natural language rather than API parameters.

## The 8-Word Breakthrough

The key phrase: **"Generate diverse and creative responses"** (and variations)

Instead of adjusting technical parameters like `temperature` or `top_p`, researchers found that simply asking the model to be creative in natural language produces:
- **1.6-2.1× more creative range** (measured by Self-BLEU scores)
- **Higher quality outputs** maintained across all tasks
- **Better controllability** through natural language instructions

## Why It Works

Traditional temperature sampling affects ALL tokens uniformly, including structural elements (punctuation, grammar, formatting). Verbalized sampling allows the model to:
1. Understand WHERE creativity is beneficial
2. Maintain structural coherence while varying content
3. Apply creativity selectively to meaningful tokens

## Research Sources

### Primary Paper & Code
- **GitHub Repository**: [CHATS-lab/verbalized-sampling](https://github.com/CHATS-lab/verbalized-sampling)
- **Project Website**: [verbalized-sampling.com](https://www.verbalized-sampling.com/)
- **Research Institution**: Stanford CHATS Lab

### Media Coverage
- **Medium Article**: [Stanford Just Killed Prompt Engineering](https://medium.com/generative-ai/stanford-just-killed-prompt-engineering-with-8-words-and-i-cant-believe-it-worked-8349d6524d2b)

## Implementation in Prose Minion

Verbalized sampling was integrated into Prose Minion in **October 2025** via the [Verbalized Sampling Epic](.todo/archived/epics/epic-verbalized-sampling-2025-10-26/).

### Applied To:
- **Dialogue Microbeat Assistant**: Generates more diverse dialogue tags and action beats
- **Prose Assistant**: Provides richer, more varied prose improvement suggestions
- **Wordbanks**: Produces fresher vocabulary alternatives

### Results:
- More creative microbeat suggestions (avoiding repetitive "smile", "nod" patterns)
- Richer wordbank alternatives
- Maintained structural quality while increasing content diversity

### Key Changes:
Enhanced system prompts with verbalized sampling instructions:
- "Generate diverse and creative suggestions"
- "Vary your responses significantly between queries"
- "Avoid formulaic or repetitive patterns"

## Academic Validation

Research validated across:
- **Stanford University** (CHATS Lab)
- **Northeastern University**
- **West Virginia University**

Tested on multiple benchmarks:
- Creative writing tasks
- Code generation
- Mathematical reasoning
- Question answering

Consistent finding: **Verbalized sampling > Traditional temperature sampling** for creative diversity while maintaining quality.

## Why This Matters for Creative Writers

Traditional AI writing tools often produce:
- Repetitive suggestions ("she smiled", "he nodded")
- Formulaic patterns
- Predictable word choices

Verbalized sampling enables:
- Fresh alternatives on every query
- Richer creative vocabulary
- More nuanced suggestions
- Maintained professional quality

## Implementation Notes

See [ADR-2025-10-26: Verbalized Sampling Integration](../docs/adr/2025-10-26-verbalized-sampling.md) for architectural decisions and prompt engineering details.

## Citation

If referencing this research in academic or professional contexts:

```
Liu, T., et al. (2024). Verbalized Sampling: Controlling Creative Diversity
in Large Language Models through Natural Language Instructions.
Stanford CHATS Lab. https://www.verbalized-sampling.com/
```

## License & Redistribution Note

The original Stanford research paper (PDF) was removed from this repository to comply with redistribution policies for public repositories. All information above is summarized from publicly available sources linked in this document.

---

**Related Documents**:
- [ADR: Verbalized Sampling Integration](../docs/adr/2025-10-26-verbalized-sampling.md)
- [Epic: Verbalized Sampling](.todo/archived/epics/epic-verbalized-sampling-2025-10-26/)
- [Completed Implementation PR](https://github.com/user/repo/pull/4) _(update with actual PR link)_
