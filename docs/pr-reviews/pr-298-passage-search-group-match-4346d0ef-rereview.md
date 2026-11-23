# PR #298: Passage Search Slice 5 re-review

**Reviewer:** Astra 6.2  
**Product head:** `4346d0ef2c31359a9edd9044b81f51ac8caf9175`  
**Epic base:** `e54cc784d6547a3c339e11a720823e8fa452765e` (`epic/passage-search`)

**Verdict: No blocking findings.** The remaining P1 from the [previous re-review](https://github.com/okeylanders/prose-minion-vscode/pull/298#pullrequestreview-6027803023) is closed. This verdict is for integration into the epic, not the separate native/live or release checks.

- **Configured file identity:** `ConfiguredResourceLookup.ts:88–112` now returns `unverified` on scan failure, before consulting the browse list. A successful scan still requires a unique exact or case-folded match and the same host file identity.
- **All three readers stop on refusal:** `WorkshopResourceReadFiles.ts:114–142` returns a failed outcome for the affected file before loading it; `WorkshopHistoryFiles.ts:112–129` and `WorkshopHistoryCapability.ts:103–115` stop before log or diff; `WorkshopReadInResource.ts:111–122,137–148` and `WorkshopReadInRoutes.ts:92–98,158–180` refuse before loading text or opening the editor.
- **Wiring and regressions:** `WorkshopContextIntakeService.ts:209–214` requires the authoritative listing port. All three production constructions in `extension.ts:346–351,465–470,637–642` pass the resolver. `WorkshopConfiguredPairResolution.test.ts:118–195` and `WorkshopReadInRoutes.test.ts:190–210` cover a failed listing for an apparently unique path as well as collisions, no history/text/editor reads for refused files, and a separate group whose scan still succeeds.
- **XML reference follow-up:** `xmlCharacterReferences.ts:30–62` and `WorkshopPassageSearchGroupMatch.test.ts:281–313` verify padded references within the documented 64-digit bound and reject decoding invalid XML code points. Optional wording nit: the comment at lines 25–28 should qualify its “never” about refusing padding to reflect the intentional length bound. No change requested for merge.

**Verification:** Pinned source and regression-test inspection; [exact-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45251792648/job/137963067375) passed typecheck, lint, both bundles, 1,025 suites, 14,529 tests, and 60 snapshots. No local suite rerun, Extension Development Host run, or live provider calls. No merge.
