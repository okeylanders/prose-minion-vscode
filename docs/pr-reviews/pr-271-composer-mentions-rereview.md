# PR #271 re-review: attachment/send ordering

## Verdict

F-01 is resolved at `28c6bed91ac8ec594898df98dd89fe57454d29cd`. No remaining actionable finding in this fix. Technical review clear; no merge performed.

## Review scope and reasoning

Reviewed the delta from the initial review report (`b8c8052e`), including the new attachment-read tracker, context handler staging paths, send handler, composition wiring, documentation and regression tests.

The host registers reads before asynchronous catalog/file work yields. A send waits for the reads already in flight before collecting attachments, covering both Enter and the Send button rather than relying on a webview acknowledgement that the protocol does not provide. A failed read, attachment limit refusal, timeout or room replacement refuses the send and restores its draft. Room revision checks stop a completed old-room read from staging a file into a replacement room. Duplicate picks of an already-staged file do not prevent a valid send. The wait is bounded and timers are cleared.

The original failure was reproduced before this fix using a deferred catalog and real routes. The new regression suite exercises that boundary and verifies the first message carries the file, with no attachment leaking into the next message. It also covers failure, retry, timeout, room replacement and system-picker reads. The original scratch failing-behavior witness was preserved locally and was not included in the new passing run or committed.

## Independent verification

- 6 focused suites / 106 tests passed: attachment ordering, app mentions, mention controller/rules, context routes and composer.
- All three typechecks passed (`npm run typecheck`, exit 0).
- ESLint on the four changed production modules: 0 errors, 11 warnings.
- `git diff --check` passed.
- Exact reviewed code-head CI passed: https://github.com/okeylanders/prose-minion-vscode/actions/runs/44102229485

## Limits

No full local suite rerun, live Extension Development Host, screen-reader/IME QA or live provider call. Previously noted standing-context read and session-operation-gate behaviors were not changed by this fix and are outside F-01. This re-review adds only a report; its new documentation commit has separate CI status.
