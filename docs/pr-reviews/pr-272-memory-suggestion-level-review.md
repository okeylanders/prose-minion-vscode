# PR #272 review: memory suggestion level

## Verdict

Technical review clear: no actionable correctness findings at `e913295964eaafbf74964ba41381b5284d0d5049`. Reviewed the feature commit `02dd9c98`, then the clean epic merge and the resulting feature diff against `649b9f24`. No merge or implementation change performed.

## Scope

Reviewed manifest and closed-list validation, configuration watcher and host settings lifecycle, prompt selection/composition for host and guest, memory-off transitions, deferred changes during runs, rebuild failure retry, host-authoritative webview state, and the Memory tab's immediate-save disclosure. The default prompt remains byte-identical; the higher levels replace only the suggestion-frequency paragraph, preserving privacy rules and per-reply bounds. Session persistence is not expanded by the transient setting display.

## Independent checks

At final reviewed head `e9132959`:
- Focused feature and regression run: 21 suites / 295 tests passed. Includes prompt byte pins and real PromptLoader assembly, service lifecycle, routes, configuration handler, modal/hook/view, provider assembly, and merged thread/JSON parser smoke coverage.
- All core, webview, and extension typechecks passed.
- Full ESLint: 0 errors, 1,177 warnings.
- `git diff --check` passed for the feature change.

The earlier feature head's CI passed. CI for `e9132959` was still running at publication: https://github.com/okeylanders/prose-minion-vscode/actions/runs/44110844573 . That check must finish before treating the branch as fully merge-ready. This report adds a documentation-only commit which can trigger another run.

## Limits and live-pass obligation

No full local suite, native Extension Development Host, real settings-write UX, or live-model test was run. The source note explicitly calls for comparing suggestion counts over one fixture conversation at each level; that remains unverified. Prompt instructions such as one reply in three are not measured behavior. This code-review verdict does not certify that live-pass completion criterion.
