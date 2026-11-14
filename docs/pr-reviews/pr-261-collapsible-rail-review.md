# PR #261 review: Workshop collapsible rail

## Verdict

No blocking findings in the reviewed code scope. This is a scoped code-review approval, not a merge operation or a guarantee of current integration readiness.

Reviewed code: `df13e220c41baf587da826087be186171e56cd28` on `epic/everyday-conveniences-collapsible-rail`.
Initial comparison base: `c2c59e860e2a7a56d3bbca5894f703e7faefed29`.
Review date: 2026-11-14.

## Review coverage

Inspected the shared shell opt-in, Workshop composition and persisted state, collapse hook, strip, hidden-tab badges, focus/Escape handling, responsive styles, and regression tests.

- Collapse remains presentation-only and host-agnostic. The shared shell's original non-opt-in path is retained.
- Wide preference is stored separately from the temporary narrow overlay; narrow opening does not overwrite the saved preference.
- Rail content stays mounted while hidden, preserving drafts and local component state.
- Both tabs can accrue unseen-arrival badges when the rail is hidden.
- Collapse from within the rail transfers focus to the named control; strip activation selects, opens, then focuses the tab.
- Input/editable Escape is left to editing behavior. CSS uses a reduced-motion override and passes the CSS-floor checks.

Reading typed props from the existing rail element and the size of WorkshopApp remain maintainability debt, not newly confirmed correctness blockers.

## Independent verification

- Focused tests: **9 suites / 172 tests passed**, including shell, collapse hook, strip, app integration, badge controller, CSS floor, and architectural boundaries.
- Full Jest attempt (`--maxWorkers=2`): **846 suites passed; 1 suite could not run because its worker was terminated with SIGKILL**. The attempt ran **11,906 passing tests and 59 passing snapshots**.
- The sole interrupted suite, `LightboxSteeringReadings.test.ts`, was rerun alone with `--runInBand`: **72 tests passed**. Thus all 847 suites have passing executions across the full attempt and isolated rerun; this is not described as one uninterrupted green full-suite run.
- All three typecheck targets passed.
- Lint: **0 errors / 1,173 warnings**.
- Build: both webpack bundles compiled and bundle verification passed.
- GitHub CI for the reviewed code head was successful (run 43604927605).

## Integration and limits

The epic base advanced during review to `e1e221a8c757f4784a3e7ac296ceab754521f285`. A local `git merge-tree --write-tree` check between that base and the reviewed head completed without conflicts. The PR metadata endpoint nevertheless reported `mergeable: false` at the final pre-publication check, so merge readiness should be rechecked in GitHub rather than inferred from this approval.

No independent live VS Code reload, Chromium 114 run, screen-reader session, or visual browser smoke test was performed. The author reports separate visual checks; those are not counted as this review's verification. Tests were run on the reviewed head, not a newly integrated epic-base merge.

No product code was changed and no PR was merged.
