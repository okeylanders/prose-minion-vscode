# Composer cache label and Workshop attachment budgets

Okey requested two finishing changes before a separate review: center the
cache indicator and use the accent color, allow seven message attachments,
and raise standing context to 100K.

On `fix/anthropic-prompt-caching`:

- The indicator text centers within the flexible space between the plus
  button and the action group. It uses `--pm-accent-hi`; an elapsed window
  keeps the same accent with reduced opacity. Existing wrapping remains.
- Follow-up: replaced the label's wrapping brackets with a 12px decorative
  clock from the shared SVG icon registry; icon and text center together.
- `PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage` is seven.
- `PROMPT_BUDGETS.contextAttachments.words` is 100,000; the related character
  guard scales to 840,000. UI meters, host intake, aggregate refusal, and
  persona context validation all consume the shared budget table.
- Updated current budget comments, the cache-window ADR placement, and the
  existing configurable-context-budget debt note. No new setting or schema.

Verification: 12 focused suites / 363 tests passed, including 100,000 words
preserved through standing-context attachment and a tool pass, seven staged
message resources with an eighth refused, duplicate detection at capacity,
and slot reuse without reusing attachment ids. Monorepo typecheck,
production build/bundle verification, changed-file ESLint, and diff checks
passed. Real composer preview checked at 1162px and 680px widths.
Clock follow-up: indicator/composer tests and webview typecheck passed.

Logs: `/private/tmp/prose-minion-composer-budget-{tests,typecheck,build,eslint}.log`.
All changes remain local for Okey's review agent. Earlier provider activation
commit `52f2e947` is already pushed; unrelated pre-existing files remain untouched.
