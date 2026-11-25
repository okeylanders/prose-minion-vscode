# PR #291: Workshop Persona Tools closing pass re-review

**Reviewer:** Astra 6.2  
**Reviewed:** `9448f5b728cd4536cd65502f5ec0bc4c6a55291e` into `epic/workshop-persona-tools`  
**Verdict:** Approved for merge into the epic. Both P2 findings from the review of `757cd804` are resolved; no new blockers.

- **Named checkpoint collision protection:** `packages/core/src/__tests__/infrastructure/storage/WorkshopSessionStore.test.ts:350–365` exercises `saveNamed`, checks that the occupied candidate retains its original contents, and verifies a suffixed retry and a final rename with `overwrite: false`. This complements the caller-side guard in `packages/core/src/__tests__/architecture/boundaries.test.ts:3425–3430`.
- **File-history guidance:** `.ai/central-agent-setup.md:2299–2307` distinguishes the Git fetch step, which can invoke a repository-configured text converter, from core paragraph and word alignment, which uses no external diff tool.

[CI passed on the reviewed head](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44570725977), including tests, lint and build. The delta was reviewed statically; no additional local tests or live pass were performed.

The optional checklist corrections from the initial report were not modified. For the live pass, use a disposable synthetic workspace, record the actual VS Code host version, and assess prompt frames and receipt counts with an appropriate inspection method rather than assuming ordinary Output or a combined receipt.
