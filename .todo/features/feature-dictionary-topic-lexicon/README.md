# Dictionary Topic & Related Lexicon

Status: Verified — automated checks passed; Okey confirmed all manual host/provider checks on 2026-10-02. Awaiting v2.7.0 publication.
Priority: Low
Branch: `feature/workshop-smoke-tweaks`
Requested: 2026-10-01

## Problem

A dictionary entry explains a word's meanings and morphological family but does not map the topics it belongs to. Okey's *plosive* example establishes the desired creative breadth and fiction-writing applications. The 2026-10-02 correction keeps that breadth in every existing section and makes Topic & Related Lexicon an additive, thorough exploration.

## Behavior

- Append `📂 Topic & Related Lexicon` at the end, after AI Advisory Notes, in standard/streaming lookup, its missing-resource fallback, and Fast Generate.
- The Dictionary tab has a theme-aware **Topic & Related Lexicon — Encyclopedia entry** switch above the run buttons. It starts enabled and remembers the writer's choice with the dictionary form state. Standard, Fast, and context-menu auto-run requests carry that choice.
- Switching it off omits the encyclopedia instructions and example from standard lookup and skips the Topic request entirely in Fast Generate. Persona-initiated dictionary lookup and full-entry calls always disable it, independently of the Dictionary tab's choice.
- When enabled, section 16 is inserted directly into the standard output blueprint, and both the active system contract and the user request require the final Topic section. The enabled-only guidance describes a required part of that lookup; optionality belongs to the writer's switch.
- Usually explore 2–4 topic families with at least two developed explanatory paragraphs each, related vocabulary (typically 4–8 terms), a concrete illustration, and a writing application. Counts guide exploration rather than impose quotas; interesting connections have room to develop.
- Suggest 1–2 seminal or foundational books per topic when confidently known, with title, author, and a note on what the writer can learn. Useful craft books and introductions also qualify. Omit uncertain resources rather than invent bibliographic detail.
- Let context lead while welcoming sound, sensation, imagery, character, genre, and metaphor connections. Explain creative associations naturally, alongside useful technical distinctions.
- Preserve all pre-existing sections' prompt wording and examples, apart from sequence. Restore the original Sense Explorer lists and instructions from before `5ad29fb5`; relationship guidance belongs to the new Topic section.
- Exempt Topic from the full report's original ~1000-word target and the Fast block's ~150-word target so its growth does not crowd out the other sections.
- Fast Generate uses 15 standard blocks plus an optional 16th Topic block. Progress, metadata, failures, and usage/cache aggregation count only selected blocks. The original blocks keep their original numbering; Topic is slot 16.
- Give only the expanded Topic block 6,000 tokens and 90 seconds on initial attempts and retries. Other blocks retain 3,500 tokens and 15 seconds.

## Related Files

- [Full prompt](../../../packages/core/resources/system-prompts/dictionary-utility/00-dictionary-utility.md), [reference entry](../../../packages/core/resources/system-prompts/dictionary-utility/01-dictionary-example.md), and [optional encyclopedia instructions and example](../../../packages/core/resources/system-prompts/dictionary-utility/02-encyclopedia-entry.md).
- [Fast topic block](../../../packages/core/resources/system-prompts/dictionary-fast/16-topic-related-lexicon-block.md) and [Sense Explorer](../../../packages/core/resources/system-prompts/dictionary-fast/04-sense-explorer-block.md).
- [DictionaryUtility](../../../packages/core/src/tools/utility/dictionaryUtility.ts): standard/streaming instructions and fallback.
- [DictionaryService](../../../packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts): Fast Generate registry, progress, assembly, and usage aggregation.

## Example Grounding

The *plosive* example uses the [International Phonetic Association's chart](https://www.internationalphoneticassociation.org/IPAcharts/IPA_charts_TI/IPA_charts_TI.html) for sound classifications and [UCL's speech-sound overview](https://www.phon.ucl.ac.uk/courses/spsci/SSC_talking/material/week_03/sounds-of-the-worlds-languages.pdf) for articulation distinctions. The prose-pattern group is explicitly a creative association. These checks do not imply that generated dictionary results have consulted or verified those sources.

The expanded examples' possible resources were checked against publisher or author listings: [Ladefoged and Johnson, *A Course in Phonetics* (7th edition, catalog p. 26)](https://www.cengageasia.com/catalog/HE/2022/English_Sectional_2022_2023.pdf#page=30), [Le Guin, *Steering the Craft*](https://www.ursulakleguin.com/steering-the-craft), [Gordon, *The New Science of Strong Materials*](https://www.penguin.co.uk/books/13533/the-new-science-of-strong-materials-by-gordon-j-e/9780140135978), [McGee, *On Food and Cooking*](https://www.simonandschuster.com/books/On-Food-and-Cooking/Harold-McGee/9780684800011), and [Tukey, *Exploratory Data Analysis*](https://www.pearson.com/en-us/subject-catalog/p/exploratory-data-analysis-classic-version/P200000006400). These support the book suggestions, not every generated dictionary claim.

## Completion Criteria and Verification

- [x] Standard lookup conditionally composes the encyclopedia prompt and example; the missing-resource fallback respects the same choice.
- [x] Fast Generate selects the optional final Topic block before generation.
- [x] Progress, token/cache aggregation, and failed-block reporting account for the new block.
- [x] All 15 pre-existing Fast blocks and all original reference-entry sections match the pre-change versions byte-for-byte after accounting for the new section and numbering. Original section wording is preserved in full/fallback instructions; the primary blueprint has an explicit slot for the enabled Topic section.
- [x] Revised verification (2026-10-02): six focused suites / 80 tests pass for prompt composition, service block selection/accounting, message forwarding, persona exclusion, and persisted UI controls. All TypeScript projects and production build pass; all 20 dictionary prompt resources match their staged copies with no stale filenames. Scoped lint has zero errors (naming/curly warnings remain); build reports Browserslist age and webview bundle-size warnings.
- [x] Check *plosive* through both lookup modes in the Extension Development Host: substantial topic explanations, useful term connections, examples, and sensible book suggestions, with the original sections' creative breadth intact.
- [x] Check a word with several senses, such as *bank*, with context for one sense; verify useful families remain separate and the contextual sense is prioritized.
- [x] Check the switch in dark, light, sepia, and Follow VS Code modes; confirm its saved choice and encyclopedia omission in standard, Fast, and persona-triggered results.

Automated checks cover prompt delivery, resources, ordering, fallback, and transport behavior; live report accuracy and usefulness were checked by Okey, who confirmed all checks complete on 2026-10-02.

## Enabled-section omission investigation — 2026-10-02

The writer's GPT-OSS 120B Nitro *copper* lookup ended at AI Advisory Notes with the switch enabled. The VS Code output log at `20260903T093032/window36/exthost/output_logging_20261002T143146/2-Prose Minion.log` shows the current checkout and an extension activation after the latest build. Three standard lookup runs completed; input tokens rose from 2,632 to 4,603 for the last two runs, consistent with inclusion of the encyclopedia resource. Completion counts were 3,092, 3,266, and 3,618. The old log did not record the effective option, full prompt, or finish reason, so it does not independently prove the exact prompt or why generation ended.

The likely cause was conflicting prompt emphasis: the primary blueprint and full reference ended at Advisory Notes, while the appended guidance called itself an "Optional Encyclopedia Entry." The fix inserts section 16 into the enabled blueprint and makes the active selection explicit in both system and user messages. Sparse service diagnostics record the effective mode, token limit, finish reason, and Topic-heading presence without logging the word, manuscript context, or full response. Okey confirmed live rechecking of this fix passed on 2026-10-02.

Fix validation: 29 focused utility/service tests pass, all TypeScript projects and the production build pass, and the corrected prompt resources match the staged extension copies. These checks validate prompt delivery and diagnostics; no additional paid provider call was run.

## Manual verification confirmed — 2026-10-02

Okey confirmed all checks performed on main reviewed at `7f9823be`. The manual completion criteria above are marked passed on that report, without inventing additional provider logs or output samples. Release preparation targets v2.7.0.
