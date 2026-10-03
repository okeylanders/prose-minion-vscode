# Craft Steering Analysis

Status: Verified — automated checks passed; Okey confirmed all manual host/provider checks on 2026-10-02. Awaiting v2.7.0 publication.
Priority: Medium
Branch: `feature/craft-steering-analysis`

## Motivation

Add a companion to Stock & Signature that examines the sound and movement of prose. The author's starting point is the opening chapter of Ursula K. Le Guin's *Steering the Craft*, especially the relationship between successive sentences. The tool should help tune language while protecting purposeful repetition, fragments, pauses, and changes of emotional register.

## Product decisions

- Picker label: **Craft Steering**. Report title: **Craft Steering Analysis**. Tool ID: `craft-steering`.
- Available under **Craft & Voice** in both the sidebar Writing Tools picker and the Workshop Tools picker, using the existing waveform icon.
- Uses the existing WritingToolsFocus pathway, including streaming, cancellation, context, retained Workshop conversation, and persona `analysis.run` access. This is an additional focus, with no new transport or persistence contract.
- Primary attention: sound, rhythm, and sentence handoffs. Additional lenses: punctuation/breath, repetition/modifiers, tense/viewpoint/distance, and density/omission where they affect movement.
- Report: twelve sections, grounded in exact passage evidence: Intent & Rhythm Portrait; What to Preserve; Sound & Cadence Audit; Sentence & Paragraph Handoffs; Breath & Narrative Control; Revision Priorities; Sample Revisions; Craft Notes; Creative Variations; Bound Creative Variations; Intent & Fidelity Check; Read-Aloud Practice & Open Questions.
- Sample Revisions demonstrate one to three local changes. Creative Variations provide three to five distinct complete treatments of one compact selection; Bound Creative Variations provide three to five additional versions with declared invariants and one primary craft dimension changed per experiment. Both default to three; tiny inputs can support fewer. Already effective prose still permits explicitly optional exploration.
- Each proposed version explains gains, costs, and protected features. A worked punctuation example demonstrates how paragraphing changes duration without adding events. The report format follows the detailed end-of-prompt approach used by Fresh and Stock & Signature.
- The rubric and exercises are original applications. Attribution identifies the inspiration without impersonating Le Guin, claiming endorsement, reconstructing the book, or inventing quotations.
- No ideal sentence length, compulsory smoothness, automatic repetition removal, or mandatory criticism. A quiet or complete ending can be right.

## Source grounding

- [Le Guin's official book page](https://www.ursulakleguin.com/steering-the-craft): scope and edition context.
- [Authorized first-chapter excerpt at Literary Hub](https://lithub.com/a-writing-lesson-from-ursula-k-leguin/): sound and the progression between sentences.
- [Silver Press book description](https://www.silverpress.org/collections/all-products/products/steering-the-craft): broader narrative craft scope.

These sources establish the inspiration. The report structure, revision safeguards, and integration behavior are product decisions, not a chapter-by-chapter representation of the book.

## Related files

- `packages/core/resources/system-prompts/writing-tools-assistant/focus/craft-steering.md`
- `packages/core/src/tools/assist/writingToolsAssistant.ts` (role, task, fallback, focus guard)
- `packages/core/src/shared/types/messages/analysis.ts`
- `packages/core/src/shared/constants/workshopTools.ts`
- `packages/core/src/shared/constants/resultToolNames.ts`
- `packages/core/src/presentation/webview/components/tabs/AllToolsModal.tsx`
- `packages/core/src/presentation/webview/components/workshop/workshopToolIcons.ts`
- `packages/core/src/application/handlers/domain/AnalysisHandler.ts`
- `packages/core/resources/system-prompts/workshop-personas/analysis-capability.md`

## Completion criteria

- [x] The tool is registered in both pickers and routes through existing analysis services.
- [x] Persona analysis accepts the new tool ID and advertises its purpose.
- [x] The dedicated prompt and missing-resource fallback preserve the focus and authorial intent.
- [x] Saved reports use `craft-steering-analysis-` filenames.
- [x] Typecheck, focused tests, and production build pass; prompt included in staged resources.
- [x] Manual Extension Development Host check of both pickers, streaming/cancel, copy/save, and Workshop follow-up.
- [x] Author reviews a real model report for craft usefulness and fidelity to the passage's intent.

## Manual review passages

Use a short, rhythmic passage with purposeful repeated wording and a held pause; a paragraph whose last sentence hands a question or image into the next paragraph; and a single sentence. Confirm the report protects what works, quotes both sides of any disputed transition, avoids invented continuation, and scales its length to the input. Use the same passage from each picker to compare behavior. Model evaluation and host interaction remain separate from automated routing evidence.

## Automated verification (2026-09-30)

- `npm run typecheck`: core, webview, and extension passed.
- Eight focused Jest suites: 111 tests passed. Covered both tool pickers, passage prompt assembly, missing-resource fallback, persona XML acceptance, isolated Workshop analysis, quick actions, and result saving.
- After expanding the report template: the two affected passage-assistant suites passed again (35 tests), all three typechecks passed, and the production build passed in the main checkout. The fallback test now checks sample revisions and both variation sections.
- `npm run build`: production extension and webview compiled; bundle verification passed. Webpack reported size recommendations for the 1.21 MiB webview bundle.
- `cmp` confirmed the staged Craft Steering prompt exactly matches the source resource.
- `git diff --check`: passed.

These checks establish integration and packaging behavior; they do not establish the quality of a generated critique. No paid provider calls or interactive host checks were run.

## Manual verification confirmed — 2026-10-02

Okey confirmed all checks performed on main reviewed at `7f9823be`. The manual completion criteria above are marked passed on that report, without inventing additional provider logs or output samples. Release preparation targets v2.7.0.
