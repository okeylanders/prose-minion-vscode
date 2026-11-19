# PR #287: Workshop Persona Tools re-review

**Astra 6.2 · Changes requested. Not approved for merge into `epic/workshop-persona-tools`.**

Reviewed `396bfad1c71aecaac362575151da47cbbef9ad2e`. [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44527039084). Static review against exact head and supported VS Code source. A raw Git object-size preflight does not guarantee a hard peak-memory cap if text conversion expands output; the post-read cap still applies. No native VS Code or real-model test was run.

The literal log path fixes the original pattern mismatch; both sides now use the same decoder and historical object sizes are checked before loading. The adapter mismatch below keeps the file boundary open on POSIX.

- [apps/vscode-extension/src/platform/vscode/VsCodeFileHistory.ts:97](https://github.com/okeylanders/prose-minion-vscode/blob/396bfad1c71aecaac362575151da47cbbef9ad2e/apps/vscode-extension/src/platform/vscode/VsCodeFileHistory.ts#L97): **P1 · Make the log, size check, and content read refer to the same file.** The supported [VS Code 1.82 Git adapter](https://github.com/microsoft/vscode/blob/1.82.0/extensions/git/src/repository.ts#L1769-L1773) rewrites backslashes to directory separators for the buffered content read, including on POSIX where a backslash is a valid filename character. The log and size lookup can therefore refer to one file while the blob read refers to another. Reject paths the underlying API cannot address literally before history access, or use an API with consistent literal path handling. Add an adapter-scope regression.
