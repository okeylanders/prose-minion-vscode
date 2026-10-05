# PR Review — Workshop transcript export

**PR:** [#124](https://github.com/okeylanders/prose-minion-vscode/pull/124) (open at review) · **Branches:** `claude/workshop-session-export-rmj92r` → `main`
**Base:** `d0375299af1d98c19ec0014edc91c96c84973b60` · **Reviewed head:** `82040bcffb5087558f58bf0a9d23933f5c29237f`
**Scope:** 58 files · +3,656 / −135 · 2 commits
**Reviewed:** 2026-10-05 · **Mode:** quick, focused Ada Forge review of projection, renderers, file writes, route, editor-opening change, and their tests. This is not a full specialist panel or manual host pass.

## Resolution ledger

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | Markdown export changes message text at its boundaries | `WorkshopTranscriptMarkdown.ts:44-45,58`; projection and JSON preserve the original `content` | ✅ Fixed in `072ea62` (bodies written untrimmed; whitespace-only writer body still omitted; byte-exact regression tests for both roles fail against the trimming renderer) |

**Verdict:** Request one focused correction before merging. The export boundary and write-once path otherwise look coherent in the inspected paths. No Blocking or High finding was identified in this quick review.

## F-01 — Preserve the message bodies in Markdown

The PR promises writer text verbatim and describes the export as the thread as it reads on screen. The projection carries `turn.content` unchanged, and JSON serializes that value. The Markdown renderer calls `entry.content.trim()` for both writer and reply entries. That removes leading indentation and trailing whitespace from the exported message. For example, a message beginning with four spaces loses an indented Markdown code block, and a prose passage loses its original edge spacing. Existing renderer fixtures start and end with non-whitespace characters, so they cannot catch this.

Keep the original body bytes when placing it between the export's speaker delimiters. Add a renderer regression case with leading indentation and trailing whitespace for both roles; assert that the body survives exactly. The presence check for an otherwise blank writer entry can still use `trim()` without trimming the value written.

## Verification actually run

| Check | Result |
| --- | --- |
| Live PR head, base, mergeability, discussion | ✅ Local head matched the open, mergeable PR; no existing comments or reviews |
| GitHub `verify` for reviewed head | ✅ [Run 37345156229](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37345156229) passed its configured typecheck, tests, lint, and build |
| Seven focused export suites | ✅ 82 tests passed locally |
| `npm run typecheck` | ✅ Core, webview, and extension passed locally |
| `git diff --check origin/main...HEAD` | ✅ |
| Independent Extension Development Host, browser, provider, and accessibility checks | Not performed in this quick review; the PR describes author-run host and visual checks |

The route snapshots the full ledger before the first asynchronous file write, rejects a replacement already in flight, and reports a successful write even if opening the file fails. The store uses the existing atomic numbered-file write behavior. HTML escapes user-visible text, rejects image fetches and unsafe link schemes, and carries a restrictive CSP; focused tests exercise those paths. The second commit opens Markdown and JSON beside the active Workshop panel. These are source and automated-test observations, not an independent manual host validation.

The checkout's three pre-existing untracked items were left untouched. This report is the only intended committed file. Recheck the exact PR head and CI after the documentation commit; the review finding remains open until the Markdown renderer is corrected and verified.
