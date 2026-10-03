# Release dependency audit follow-up

**Date Identified**: 2026-10-02
**Reviewed**: 2026-10-02
**Status**: Deferred — no applicable runtime exploit identified for v2.7.0
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
