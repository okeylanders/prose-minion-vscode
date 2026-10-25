# The composition root is past 500 lines

**Status:** Open
**Priority:** Low
**Found:** 2026-10-25, Draft Edit Slice 2

## Problem

`apps/vscode-extension/src/extension.ts` is 842 lines. It was 735 before
Draft Edit; Slice 1 added the Proofread wiring and its command host (815),
and Slice 2 the Fix and quick-fix commands (842). The project keeps modules
under 500 lines.

Most of the growth is not composition. It is VS Code glue for command hosts
that read the editor and the window: the Proofread host
(`readProofreadDocument`, `proofreadCommandHost`), and the Lightbox's Open
File host. Their rules already live behind host ports in
`application/commands/`. Only the adapters for those ports sit in the
composition root.

## Suggested fix

- Move each command host's VS Code adapter into its own module under
  `apps/vscode-extension/src/platform/vscode/` (for example
  `createProofreadCommandHost()`), beside the other port adapters.
- `extension.ts` then only builds them and registers the commands.
- `providerAssembly.test.ts` pins one line of the Proofread host
  (`proofread.fixReview` read through `getConfiguration`); point it at the
  new module.

## Done when

- `extension.ts` composes and registers, and is back under 500 lines, or
  the remainder is pure composition with a note saying why.
- The architecture and assembly tests pass unchanged in what they protect.
