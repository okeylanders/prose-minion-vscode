# Release dependency audit follow-up

**Date Identified**: 2026-10-02
**Reviewed**: 2026-10-04
**Status**: Deferred — no applicable runtime exploit identified; renewed tooling audit findings recorded below
**Priority**: Medium
**Estimated Effort**: Small, focused dependency maintenance

## Evidence

A clean `npm ci` from the existing lockfile preceded v2.7.0 verification. Both
`npm audit` and `npm audit --audit-level=high` exited 1 and reported three affected
packages: one high, one moderate and one low. No dependency upgrade was made as
part of release preparation.

| Package | Locked versions | Severity | Extension applicability | Action |
|---|---|---|---|---|
| brace-expansion | 1.1.18, 2.1.4, 5.0.9 | High | Development tools only (including VSCE and Sucrase); no application import or VSIX dependency tree. Malicious brace inputs could still exhaust tooling CPU/stack. | Defer focused development dependency refresh. |
| markdown-it | 14.2.0 | Moderate | VSCE dependency only; extension markdown uses `marked`. Advisory requires vulnerable linkification paths. | Defer packaging-tool dependency refresh. |
| DOMPurify | 3.4.14 | Low | Ships in the webview, but the advisory requires `IN_PLACE` and a node-removing `afterSanitize` hook. Current caller sanitizes strings and uses neither. | Defer a patched dependency update; retain sanitizer verification. |

Primary advisories: brace-expansion [quadratic expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr),
[recursive groups](https://github.com/advisories/GHSA-qhr7-859c-m2p7),
[comma recursion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p);
[markdown-it linkification](https://github.com/advisories/GHSA-253c-mchw-3w2r);
[DOMPurify hook / IN_PLACE interaction](https://github.com/advisories/GHSA-p98j-92pf-mc4p).

## Verification and limits

- Existing `MarkdownRenderer.test.tsx` runs the actual sanitizer and covers script,
  event-handler, dangerous-URL, style and image removal. It protects the current
  usage; it does not exercise the unused vulnerable hook configuration.
- Clean installation, all 230 suites / 2,784 tests, typechecks, production build
  and VSIX packaging passed. Build verification is relevant to tooling updates;
  application tests alone do not prove that those tools resist hostile inputs.
- The VSIX has bundled JavaScript and resources, with no `node_modules` tree.
  This is not a clean audit result, and should not be represented as one.

## Recommendation

Use a dedicated maintenance branch to update the affected direct dependencies or
transitive parents to patched versions. Avoid a blanket forced audit fix. Run the
sanitizer tests, full typechecks, production build and packaging, then audit again.

## Related files

- `package-lock.json`
- `packages/core/src/presentation/webview/components/shared/MarkdownRenderer.tsx`
- `packages/core/src/__tests__/presentation/webview/components/shared/MarkdownRenderer.test.tsx`

## Completion criteria

- Locked affected versions are patched and new audit results recorded.
- Sanitizer behavior, build and VSIX packaging remain correct.
- No new DOMPurify hook or `IN_PLACE` usage is introduced without review.
- Archive this item after verification.

## Rechecked during release preparation — 2026-10-04

Both `npm audit --json` and `npm audit --audit-level=high` exited 1. The
committed lockfile now has 44 affected package names: 42 high, one moderate,
one low, and no critical findings. This includes transitive severity
propagation; it is not 44 independent advisories. The newly reported root is
[braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
in braces 3.0.3. The previous brace-expansion, markdown-it, and DOMPurify
advisories remain. No dependency upgrade is part of release preparation.

Every high/moderate affected node has `dev: true` in the lockfile. Direct
parents include Jest, ESLint/TypeScript ESLint, VSCE, Tailwind, and ts-loader.
The source has no application import of braces, brace-expansion, micromatch,
or markdown-it. Development globs and packaging Markdown remain reachable
tooling inputs, so this is deferred risk, not a claim that these tools are
invulnerable.

Tests/build/package checks exercise ordinary tooling inputs, not malicious
nested-pattern exploit cases. MarkdownRenderer's real sanitizer regressions
cover the runtime rendering boundary; application Markdown uses marked, not
markdown-it. DOMPurify remains low severity and the current string sanitizer
uses neither IN_PLACE nor afterSanitize hooks. The audit dispositions below
share these usage and test limits.

Npm suggests major parent changes (including a Jest downgrade) for the braces
chain. Do not blindly apply `npm audit fix --force`; investigate a focused
tooling update separately. Refresh this disposition before publication.

### Every high/moderate affected package

| Package | Locked versions | Severity | Advisory or affected child | Action |
|---|---|---|---|---|
| @jest/console | 29.7.0 | high | jest-message-util | Defer tooling refresh |
| @jest/core | 29.7.0 | high | @jest/console, @jest/reporters, @jest/test-result, @jest/transform, jest-config, jest-haste-map, jest-message-util, jest-resolve, jest-resolve-dependencies, jest-runner, jest-runtime, jest-snapshot, jest-watcher, micromatch | Defer tooling refresh |
| @jest/environment | 29.7.0 | high | @jest/fake-timers | Defer tooling refresh |
| @jest/expect | 29.7.0 | high | expect, jest-snapshot | Defer tooling refresh |
| @jest/fake-timers | 29.7.0 | high | jest-message-util | Defer tooling refresh |
| @jest/globals | 29.7.0 | high | @jest/environment, @jest/expect | Defer tooling refresh |
| @jest/reporters | 29.7.0 | high | @jest/console, @jest/test-result, @jest/transform, jest-message-util | Defer tooling refresh |
| @jest/test-result | 29.7.0 | high | @jest/console | Defer tooling refresh |
| @jest/test-sequencer | 29.7.0 | high | @jest/test-result, jest-haste-map | Defer tooling refresh |
| @jest/transform | 29.7.0 | high | jest-haste-map, micromatch | Defer tooling refresh |
| @typescript-eslint/eslint-plugin | 5.62.0 | high | @typescript-eslint/parser, @typescript-eslint/type-utils, @typescript-eslint/utils | Defer tooling refresh |
| @typescript-eslint/parser | 5.62.0 | high | @typescript-eslint/typescript-estree | Defer tooling refresh |
| @typescript-eslint/type-utils | 5.62.0 | high | @typescript-eslint/typescript-estree, @typescript-eslint/utils | Defer tooling refresh |
| @typescript-eslint/typescript-estree | 5.62.0 | high | globby | Defer tooling refresh |
| @typescript-eslint/utils | 5.62.0 | high | @typescript-eslint/typescript-estree | Defer tooling refresh |
| @vscode/vsce | 3.9.2 | high | secretlint | Defer tooling refresh |
| babel-jest | 29.7.0 | high | @jest/transform | Defer tooling refresh |
| brace-expansion | 1.1.18, 2.1.4, 5.0.9 | high | brace-expansion, brace-expansion, brace-expansion, brace-expansion, brace-expansion, brace-expansion, brace-expansion, brace-expansion, brace-expansion | Defer tooling refresh |
| braces | 3.0.3 | high | braces | Defer tooling refresh |
| chokidar | 3.6.0 | high | braces | Defer tooling refresh |
| create-jest | 29.7.0 | high | jest-config | Defer tooling refresh |
| expect | 29.7.0, 30.2.0 | high | jest-message-util | Defer tooling refresh |
| fast-glob | 3.3.3 | high | micromatch | Defer tooling refresh |
| globby | 11.1.0, 14.1.0 | high | fast-glob | Defer tooling refresh |
| jest | 29.7.0 | high | @jest/core, jest-cli | Defer tooling refresh |
| jest-circus | 29.7.0 | high | @jest/environment, @jest/expect, @jest/test-result, jest-message-util, jest-runtime, jest-snapshot | Defer tooling refresh |
| jest-cli | 29.7.0 | high | @jest/core, @jest/test-result, create-jest, jest-config | Defer tooling refresh |
| jest-config | 29.7.0 | high | @jest/test-sequencer, babel-jest, jest-circus, jest-environment-node, jest-resolve, jest-runner, micromatch | Defer tooling refresh |
| jest-environment-jsdom | 29.7.0 | high | @jest/environment, @jest/fake-timers | Defer tooling refresh |
| jest-environment-node | 29.7.0 | high | @jest/environment, @jest/fake-timers | Defer tooling refresh |
| jest-haste-map | 29.7.0 | high | micromatch | Defer tooling refresh |
| jest-message-util | 29.7.0, 30.2.0 | high | micromatch | Defer tooling refresh |
| jest-resolve | 29.7.0 | high | jest-haste-map | Defer tooling refresh |
| jest-resolve-dependencies | 29.7.0 | high | jest-snapshot | Defer tooling refresh |
| jest-runner | 29.7.0 | high | @jest/console, @jest/environment, @jest/test-result, @jest/transform, jest-environment-node, jest-haste-map, jest-message-util, jest-resolve, jest-runtime, jest-watcher | Defer tooling refresh |
| jest-runtime | 29.7.0 | high | @jest/environment, @jest/fake-timers, @jest/globals, @jest/test-result, @jest/transform, jest-haste-map, jest-message-util, jest-resolve, jest-snapshot | Defer tooling refresh |
| jest-snapshot | 29.7.0 | high | @jest/transform, expect, jest-message-util | Defer tooling refresh |
| jest-watcher | 29.7.0 | high | @jest/test-result | Defer tooling refresh |
| markdown-it | 14.2.0 | moderate | markdown-it | Defer tooling refresh |
| micromatch | 4.0.8 | high | braces | Defer tooling refresh |
| secretlint | 10.2.2 | high | globby | Defer tooling refresh |
| tailwindcss | 3.4.18 | high | chokidar, fast-glob, micromatch | Defer tooling refresh |
| ts-loader | 9.5.4 | high | micromatch | Defer tooling refresh |
