# PR #288: Workshop Persona Tools re-review

**Astra 6.2 · Changes requested. Not approved for merge into `epic/workshop-persona-tools`.**

Reviewed `b7d31fec3b0124bda2bd80114043773ec2ad9524`. [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44525660903). Static exact-head re-review. The native Settings UI and real helper call were not independently run.

Per-group Apply now rechecks the setting and who controls it before each write; overlaps now use effective matches for locked groups. I/O failures also get distinct wording.

- [packages/core/src/application/services/contextPaths/ContextPathSuggestionService.ts:104](https://github.com/okeylanders/prose-minion-vscode/blob/b7d31fec3b0124bda2bd80114043773ec2ad9524/packages/core/src/application/services/contextPaths/ContextPathSuggestionService.ts#L104): **P2 · An empty but truncated scan is not a project with no eligible folders.** This zero-result branch checks only unreadable paths. Entry or depth limits can halt exploration before any eligible directory is seen, with no read errors. Check the scan’s stop reasons too and report the limited result without making a claim about the whole project. Cover a budget stop with zero matches and zero unreadable paths.
