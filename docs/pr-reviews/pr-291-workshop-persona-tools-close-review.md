# PR #291: Workshop Persona Tools closing pass

**Reviewer:** Astra 6.2  
**Reviewed:** `757cd8045c491097187c28c713489fca352ecbf6` into `epic/workshop-persona-tools` at `7e63d170`  
**Verdict:** Changes requested; not approved for merge into the epic.

## Findings

1. **P2 — The new named-session guard misses a regression at the final rename.** `packages/core/src/__tests__/architecture/boundaries.test.ts:3422–3432` checks the method chain and that the named create passes `false`, but not that `WorkshopSessionStore.ts:975` forwards the overwrite setting to the final rename. Accidentally defaulting that rename to overwrite leaves the new guard green. The current product code correctly forwards the setting. Pin forwarding or verify behaviorally that a named-create collision preserves the existing bytes.
2. **P2 — The file-history guidance contradicts itself about external execution.** `.ai/central-agent-setup.md:2292–2305` says no external tool runs, while the same section acknowledges that Git may invoke a repository-configured text converter when acquiring blob bytes. Limit the no-external-tool guarantee to core paragraph and word alignment, and state the source-acquisition caveat separately so the workspace trust boundary is clear.

## Nonblocking live-pass corrections

- Update the two references that still treat #290 as pending. Record the VS Code host version separately from the extension version and explicitly exercise the 1.82 floor if that compatibility is to be verified.
- Use a disposable synthetic workspace for hosted-model calls, forced exits, recovery and settings tests; avoid private drafts and note any temporary user-level setting changes.
- For A1.7, make the two changes in one reply or expect separate transcript receipts. For A1.5, do not rely on ordinary Output for raw prompt frames unless a supported inspection mode is identified.

## Validation

Static review of all six changed files and the exact-head store. No production code changed. [GitHub CI passed on the reviewed head](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44565279653). No local tests, Extension Development Host, real-model, multi-window or crash tests were run in this review. The checklist covers A, B, C1 and C2; the live pass remains outstanding.
