# PR #285: Context panel scrolling

Reviewed `a85c4296..cc225634` only: the two `ContextBudget.tsx` wrappers and their `index.css` rule. The earlier telemetry findings remain closed. Neither stacked PR was reviewed.

## P2: Make the scroll body keyboard-focusable on supported VS Code versions

Both wrappers (ContextBudget.tsx:161, 227) use a plain div. When the list is long and contains no interactive descendants, a keyboard user on the supported Chromium 114 floor can open the summary but cannot tab into the scrollport to read the last sources. The summary is its sibling, not a descendant. [Chromium's keyboard scrolling notes](https://developer.chrome.com/blog/keyboard-focusable-scrollers) document that automatic scrollport focus arrived in Chrome 132. The extension supports VS Code 1.82.

Give both bodies `tabIndex={0}`, an accessible name (for example a named region), and a visible focus indicator. Check Tab from the open summary, Page Down/End, Tab onward, and closing/reopening, for both a measured participant and known parts with no total.

## Verification

- Rendered both states with 80 sources using the actual component. Both produced 80 list items, no body tabindex, and zero focusable descendants when there were no expandable pieces. Native details/summary structure is preserved.
- All 10 tests in the ContextBudget and ContextBreakdownSummary suites passed locally. [CI for the reviewed code](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44431872858) passed typechecks, tests, lint and both bundles.
- The keyboard finding is based on rendered DOM and documented engine behavior. No native VS Code, screen-reader, or visual/wheel pass: local headless Chromium could not start due to a socket restriction.
