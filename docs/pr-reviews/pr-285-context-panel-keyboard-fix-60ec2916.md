# PR #285: Keyboard access to the Context panel

**The scroll-body P2 is fixed. No new findings in `9e554828..60ec2916`.** The fix gives both the measured and parts-only scroll bodies a native tab stop immediately after the disclosure summary. Each is exposed as a region named “Context details”. The shared `:focus-visible` rule draws a one-pixel inset outline using the VS Code focus-border color, with a fallback. The disclosure, source ordering, and scroll limits are unchanged.

- Repeated the original 80-source fixture in each state, without any clickable rows. Both rendered bodies had `tabIndex=0`, the expected accessible name and role, all 80 entries, and accepted DOM focus.
- All 11 repository tests in the two relevant component suites passed; a separate fixture-render test also passed. All three reviewed files matched the code-head blob hashes.
- [CI on the reviewed commit](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44435846823) was in progress when this report was written. Passed steps: Typecheck (core host + core webview + app shell).
- Verified markup, DOM focus and the CSS rule, not a pixel-level focus-ring render or native Tab, Page Down/End, or screen-reader interaction. The minimum VS Code 1.82 runtime was not available here.

This closes the [scroll-body finding](https://github.com/okeylanders/prose-minion-vscode/pull/285#pullrequestreview-5967864756). Neither underlying stacked PR was in scope.
