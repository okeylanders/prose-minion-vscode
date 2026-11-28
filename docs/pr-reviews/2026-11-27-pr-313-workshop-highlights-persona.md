# PR #313: Teach personas the Workshop highlight protocol

- Reviewer: independent Astra 6.2
- Reviewed head: `91d9d8ef7b52db8bfd06a18c56975ff9dcba9217`
- Target: `epic/workshop-persona-highlights` at `0bb448907266dc7c09495cfc1995e7ba87345002`
- Merge base: `28162b11f3c90436023020bad22a1baeb7292898`
- Verdict: **Approved for merge into the epic for this slice.** No blocking findings. This is not approval of the integrated feature or #316's automatic placement.

## P3 (nonblocking): Help overpromises what “all” can mark in one reply

[`packages/core/resources/help/workshop.md:99`](../../packages/core/resources/help/workshop.md#L99) says “All” means all passages the persona found. The prompt permits one set with a maximum of 24 places, and the codec rejects an oversized set outright. Note the 24-place limit in help. The persona should disclose when it cannot mark every match in a single reply and wait for the writer to ask for a further batch.

## Verification

Astra reconstructed the exact head tree (`a24b9cc5b03a60ff69d547c05fb175cfef8bd351`). All 199 local tests in nine targeted suites and core typecheck passed, including production prompt loading for host/guest, help lookup, the worked quote/span example against the codec and anchor placement, and a 25-place rejection check. [Exact-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45919851317) passed, including lint, three typechecks, and both bundles. No live model, native VS Code GUI, or four-slice integration smoke was rerun. The prompt is consistent about asking first and targeting the excerpt file; prompt tests do not establish runtime enforcement of writer consent.
