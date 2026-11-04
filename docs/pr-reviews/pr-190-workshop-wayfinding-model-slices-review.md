# PR #190 review: Workshop Wayfinding Slice 7, model slices

**Disposition: no actionable findings in the reviewed implementation.** This branch report is not a formal GitHub approval or authorization to merge.

**Reviewed head:** `f9a6ab7a8fdd3d414292af88d24c66b9cc60f17e`  
**Base:** `4a180ab0c1e5d4233a133265768304af296dbaaa`  
**PR:** [#190](https://github.com/okeylanders/prose-minion-vscode/pull/190) · **Reviewed:** 2026-11-04

## Review

The shared derivation compares requested IDs per scope, keeps unstamped turns unknown and seeds a truncated thread from the last prior stamp per scope. Thread and transcript use the same placement logic; JSON carries model stamps without synthetic slice entries. The reviewed paths keep model metadata out of per-turn recall and preview projection.

Independent checks found no actionable issue in:
- scoped ordering, switch-backs, intervening capability cards and unstamped gaps;
- 199/200/201-turn window boundaries, replacement, rewind/branch and rollback;
- transcript/export parity, legacy sessions, message counts and defensive copies;
- model-label updates, stable focused bubbles/disclosures and private labels;
- codec-accepted hostile model IDs through the App, HTML, Markdown, JSON, recall and preview boundaries.

Two product defaults are explicitly recorded on the PR for Okey's decision: dictionary changes say **“Dictionary model”**, and the served-by note is thread-only while JSON retains IDs. They are disclosed choices, not hidden implementation findings.

## Verification

- **12 suites / 110 tests** pass in the derivation/lifecycle lane, including **11 independent probes**. Those cover 160 deterministic multi-scope histories across 5,280 window cuts, real coordinator rewind/branch and failed New/Open/Rewind/Branch writes, and real-App seed replacement with reused turn IDs.
- **11 targeted production suites / 94 tests** and **2 independent suites / 8 tests** pass in the boundary lane. Real saved successful and retained failed dictionary cards keep stamps in JSON while model IDs and hidden evidence stay out of recall and preview. Hostile IDs render inert; dynamic catalog labels do not change identity or remount focused content.
- [CI run 41784727575](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41784727575) passed on synthetic merge `cfacd0b` of `f9a6ab7` into `4a180ab`: **636 suites / 8,977 tests / 59 snapshots**, typecheck, lint and both builds. Local full suite was not rerun independently.

Native VS Code theme/layout and live acceptance remain for Slice 8. No implementation change, formal approval, merge or paid provider call was made during this review.
