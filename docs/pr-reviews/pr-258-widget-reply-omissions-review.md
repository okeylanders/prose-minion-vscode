# PR #258: Omitted-empty widget reply fields review

## Verdict

**Scoped technical approval of code head `6d54f10d1a54e58408ca83cd6dbe81e5dc84c8cb` against `main` at `89e2eef053510f129ca5bb0a00cddf4c86b81172`. No blocking finding.** No merge performed.

Reviewed all 15 changed files, downstream persisted validators and warning presentation, and the Creative Variations implementation runway. The change recovers otherwise usable replies without weakening required content, unknown-key rejection, or persisted config schemas.

## Checks

- The shared helper copies parsed objects and creates fresh empty arrays. Only the explicitly listed absent fields and null list values are normalized; present non-null invalid types still reach strict validation.
- Creative Variations and Show vs. Tell retain bounded prose, cardinality/order, declared-invariant checks, host-derived flag identities, and strict durable workup validation. Nonempty warnings are not discarded.
- Lexical Gravity still validates declared roles/dynamics/axes, axis-field pairing, lexical-mode emptiness, and entailment dependencies after normalization. Filling only one missing axis member does not make a non-null mismatched pair valid.
- Model prompts still request every field. Successful omission diagnostics contain controlled field names/counts, not manuscript content.
- Persistence codecs remain exact; no session schema migration is needed. Existing rejected-response logging behavior is unchanged and is not covered by a claim that every service log is content-free.

## Explicit product tradeoff: absence is not evidence of an invariant check

The author's caveat is correct. An omitted or null `invariantFlags` becomes `[]`; neither the UI nor a reopened workup retains whether the model explicitly supplied an empty list. The output-channel count is diagnostic only, not durable writer-facing provenance. A model may omit the field because it failed to perform the check, not because it found no risk.

This is **not a newly bypassed commit-authority gate**: the accepted Creative Variations runway D3 (amended August 15) explicitly makes even hard-conflict flags visible context, while all returned cards remain writer-selectable and committable. An explicit model-supplied `[]` was never independent proof of compliance either. The PR openly adopts a recovery tradeoff, rather than implementing a reliable semantic invariant verifier.

Non-blocking recommendation: record this narrow response-boundary exception and loss of provenance in the existing widget design/runway, alongside the new agents-guide section. A separate broad ADR is not necessary for this small implementation, but the older “partial response rejects” language should not be mistaken for the current wire-field contract. If product expectations change to guarantee a performed invariant check, preserve an “unverified” state or require a validated check result rather than treating this fallback as assurance.

## Independent verification

On Node `v24.22.1`, after a clean dependency install using a writable npm cache:

- Focused widget service/response/config suites: **9 suites / 292 tests passed**.
- Full `npm test -- --runInBand`: **844 suites / 11,945 tests / 59 snapshots passed**, 524.327 seconds.
- `npm run typecheck`: core, webview, and extension all passed.
- `npm run lint`: **0 errors / 1,171 warnings**, matching the existing documented warning baseline.
- `npm run build`: both webpack bundles and verification passed; existing webpack performance warnings remain.
- `git diff --check` on the two PR commits: clean.

[Exact-code-head PR CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/43480578822) succeeded. A report-only publication creates a new head whose checks must be evaluated separately.

No live-model call, Extension Development Host session, or new visual/accessibility verification was performed. This is a scoped code/test review, not a semantic-quality guarantee for model replies. The publishing identity owns the PR, so the verdict is recorded as a COMMENT review rather than a formal self-approval.
