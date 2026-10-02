# Dictionary Topic & Related Lexicon

Status: Implemented; automated checks passed; live-model smoke pending.
Priority: Low
Branch: `feature/workshop-smoke-tweaks`
Requested: 2026-10-01

## Problem

A dictionary entry explains a word's meanings and morphological family but does not map the topics it belongs to. Okey's *plosive* example shows the desired discovery surface: topic explanations and related vocabulary. Its synonym/antonym labels also show why a conceptual neighbor needs its actual relationship explained.

## Behavior

- Add `📂 Topic & Related Lexicon` between Collocations & Idioms and Morphology & Family in standard/streaming lookup, its missing-resource fallback, and Fast Generate.
- Usually show 1–3 specific topic families, each with a short blurb and 3–5 related terms with brief meanings and connections. Use fewer rather than pad; aim for 120–220 words overall.
- Separate established senses and prioritize supplied context. Label writing applications as creative associations when they are not established senses.
- Distinguish categories, subtypes, neighboring concepts, and technical contrasts from synonyms and antonyms. Sense Explorer can use fewer items or state that no direct antonym exists.
- Fast Generate uses 16 blocks. Renumber the existing block resources after slot 7 to keep their filenames aligned with the existing ordered fan-out registry.

## Related Files

- [Full prompt](../../../packages/core/resources/system-prompts/dictionary-utility/00-dictionary-utility.md) and [reference entry](../../../packages/core/resources/system-prompts/dictionary-utility/01-dictionary-example.md).
- [Fast topic block](../../../packages/core/resources/system-prompts/dictionary-fast/08-topic-related-lexicon-block.md) and [Sense Explorer](../../../packages/core/resources/system-prompts/dictionary-fast/04-sense-explorer-block.md).
- [DictionaryUtility](../../../packages/core/src/tools/utility/dictionaryUtility.ts): standard/streaming instructions and fallback.
- [DictionaryService](../../../packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts): Fast Generate registry, progress, assembly, and usage aggregation.

## Example Grounding

The *plosive* example uses the [International Phonetic Association's chart](https://www.internationalphoneticassociation.org/IPAcharts/IPA_charts_TI/IPA_charts_TI.html) for sound classifications and [UCL's speech-sound overview](https://www.phon.ucl.ac.uk/courses/spsci/SSC_talking/material/week_03/sounds-of-the-worlds-languages.pdf) for articulation distinctions. The prose-pattern group is explicitly a creative association. These checks do not imply that generated dictionary results have consulted or verified those sources.

## Completion Criteria and Verification

- [x] Standard prompt, reference entry, and fallback include the new section and relationship guidance.
- [x] Fast Generate loads all 16 actual bundled prompts and assembles the topic block in the correct position.
- [x] Progress, token/cache aggregation, and failed-block reporting account for the new block.
- [x] Six focused suites / 80 tests pass, including dictionary handler, webview hook, Workshop capability, and architecture boundaries.
- [x] All TypeScript projects, lint (zero errors), and production build pass.
- [ ] Check *plosive* through both lookup modes in the Extension Development Host: topic blurbs and term explanations, with no false synonym/antonym classifications.
- [ ] Check a word with several senses, such as *bank*, with context for one sense; verify useful families remain separate and the contextual sense is prioritized.

Automated checks cover prompt delivery, resources, ordering, fallback, and transport behavior; live report accuracy and usefulness still need the manual checks above.
