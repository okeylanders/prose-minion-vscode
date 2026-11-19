# PR #285: Workshop context breakdown review

**Verdict: changes recommended.** Three P2 findings affect what the writer sees, not what the model receives.

**Reviewed range:** `9c5cdb575521dcd24b9de57a40faca4c774a520c..76d8472a195de573c1a063dba1dfd9462fa444a1`. Verified a linear chain of exactly three commits (ADR, feature, ADR wording). This is not a review of the underlying stack or of the full diff against main.

### F-01 · P2 · Reopening a saved room hides even the known parts

[Panel projection](https://github.com/okeylanders/prose-minion-vscode/blob/76d8472a195de573c1a063dba1dfd9462fa444a1/packages/core/src/application/services/workshop/WorkshopContextBudgetView.ts#L64-L74). On Open, the manager restores messages and the manifest but deliberately does not restore provider telemetry. The new projection therefore skips measurement entirely, and the component returns its non-expandable “Not measured yet” gauge. Importing the PR’s real pre-tally fixture reproduced this: the host has history but no `breakdown`. The fixture test calls the breakdown builder directly, bypassing precisely this gate. Rewind and system-prompt replacement also invalidate the snapshot.

Keep provider telemetry ephemeral. Show known part amounts on their own, mark genuinely unmeasured parts as such, and withhold percentages and Conversation's remainder until a fresh provider total exists. Test import → projection → panel before sending another message.

### F-02 · P2 · A reply without usage mixes two different turns

[Turn commit](https://github.com/okeylanders/prose-minion-vscode/blob/76d8472a195de573c1a063dba1dfd9462fa444a1/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L647-L659). A successful continuation appends its tally and read-in rows whether or not the provider returns usage. If the continuation has no observation, the previous budget survives. The panel then subtracts the **new** parts from the **old** total. A two-reply witness produced a 30-token current total alongside a new 1,250-token attachment estimate. The UI says estimates exceeded the measured total, but no total was measured for that history at all.

Associate the total with the history it describes, or invalidate it on a successful commit without current telemetry. Keep the tally, but do not compute shares, overflow or remainder across different turns. Test a measured reply followed by a successful reply without usage, then a new measured reply.

### F-03 · P2 · An apportioned read is labeled “measured”

[Read aggregation](https://github.com/okeylanders/prose-minion-vscode/blob/76d8472a195de573c1a063dba1dfd9462fa444a1/packages/core/src/application/services/workshop/WorkshopContextBreakdown.ts#L90-L98). The engine writes a numeric `promptTokensDelta` **and** `isEstimate: true` when a single provider delta is divided across multiple sources by size. The aggregate tests only whether the delta exists. Two estimated rows of 49 tokens each produced 98 tokens labeled “measured”; the unchanged manifest correctly marks both rows as estimated. When all sources in an aggregate happened to share the same round, even knowing the aggregate delta does not make those allocated row costs individually measured (and per-row rounding need not conserve it).

Keep each row’s numeric delta, but use `isEstimate` as well as delta presence when assigning provenance. Cover apportioned-only and apportioned-plus-exact inputs, including splits across different parts.

**Checks:** All three workspace typechecks and all 11 changed Jest suites (55 tests) passed locally. Three additional isolated, non-billable regression witnesses confirmed the observations above using the actual import/projection, engine commit, and aggregation paths. GitHub [CI for the reviewed code](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44414515392) passed. No live provider call or interactive VS Code test was run; no product code was changed.