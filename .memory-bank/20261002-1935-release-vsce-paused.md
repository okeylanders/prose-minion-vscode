# VSCE release paused: v2.7.0

**Date:** 2026-10-02 19:35 CDT
**Status:** Resumed at Okey's request on 2026-10-02; original pause retained below
**Step:** 9 — packaged artifact / manual-test gate, before merge, tag or publication
**Branch:** `release/v2.7.0`
**Commit:** `2d1cdd67` — `chore(release): prepare v2.7.0` (pushed)
**Worktree:** `/private/tmp/prose-minion-release-v2.7.0` (clean at pause)
**Main:** `7f9823bea23fd7a1e4571f0be856faa20b2ac5f9`; release not merged
**Previous / new version:** 2.6.2 → 2.7.0

## Reason

Okey said to hold before merging the release branch. He may have the design agent
style images highlighting the Dictionary Topic & Related Lexicon and Craft
Steering additions. No asset work was requested of this agent yet.

## Completed

- Main release review and user-confirmed pending functional checks recorded.
- Versions, lockfile entries, README and both dated changelogs updated.
- Resolved Workshop smoke gate archived; feature plans verified, awaiting publication.
- Clean npm ci; typechecks, 230 suites / 2,784 tests / 2 snapshots, coverage,
  lint (0 errors / 1,037 warnings), production build and VSIX packaging passed.
- Coverage: 84.72% statements, 75.10% branches, 85.13% functions, 85.01% lines.
- Preparation commit pushed to release/v2.7.0; no merge, tag or publication.

Preparation details and complete modified-file list:
`/private/tmp/prose-minion-release-v2.7.0/.memory-bank/20261002-1932-release-v2.7.0-preparation.md`.

## Review / audit

No critical code findings. Three dependency advisories remain documented:
brace-expansion (high, development tooling), markdown-it (moderate, VSCE tooling),
DOMPurify (low, shipped but advisory's IN_PLACE/hook configuration unused).
Dependency maintenance and low-priority retained-history grouping allocation are
tracked follow-ups. No source or dependency fix was made during preparation.

## Existing package

`/Users/okeylanders/Documents/GitHub/prose-minion-vscode/apps/vscode-extension/prose-minion-2.7.0.vsix`

SHA-256: `f3b0317a175949ae91d29893c727b5159cd5c94fa2fffe93685e93a45215477f`.
197 files / 11,850,090 bytes; all 172 core resources match source.
This is the pre-artwork package; it must be rebuilt if packaged assets/docs change.
Release notes are staged at `/tmp/prose-v2.7.0-release-notes.md`.

## Next steps when resumed

1. Incorporate or cherry-pick the design agent's finished images/docs onto
   release/v2.7.0; preserve any concurrent main or worktree edits.
2. Validate new asset paths, package inclusion and presentation, then rebuild
   the VSIX. Update its hash and preparation checkpoint. Run checks appropriate
   to the actual changes; full tests need not be repeated for image-only edits.
3. Obtain confirmation of the final packaged extension before merging, per
   vsce-release step 9. Existing functional checks remain confirmed.
4. Only after Okey resumes and the gate passes: merge, tag, create GitHub release,
   archive completed release records, and clean up the release branch/worktree.
5. Marketplace publishing requires an explicit request.

## Local checkpoint placement

This pause note is deliberately saved in the original checkout's memory bank so
that the next release session can discover it. It is uncommitted; tracked main is
unchanged. The three pre-existing unrelated untracked files are preserved.

## Resume — 2026-10-02

Okey confirmed the artwork was pushed as `66c5eaa` and said, “I think we are ready to go.” He reported typechecks, all 2,788 tests, lint and production build passed, plus real-webview rendering of the new tour slides. This resumes the release and authorizes proceeding after final package verification; the prior hold is lifted. The pause checkpoint moves into the release branch for durable history. Marketplace publishing remains a separate explicit request.
