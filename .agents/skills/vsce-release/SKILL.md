---
name: vsce-release
description: Prepare, smoke-test, publish, pause, or resume a Prose Minion VS Code extension release. Use for an existing release branch or a handoff of an already tested VSIX to GitHub Releases and the VS Code Marketplace.
---

# Release Prose Minion for VS Code

Use the same VSIX for the installed smoke test, GitHub release asset and Marketplace publication. A change to packaged code, documentation or artwork after testing produces a new candidate. Package it again, record the new digest and repeat the affected installed checks before accepting it.

**Begin** from the current remote `main`, or pick up the requested `release/vX.Y.Z` branch where its changelogs and release notes leave off. Use a clean worktree. **Pause** by saving the next unfinished step in `.memory-bank/YYYYMMDD-HHMM-release-vX.Y.Z.md` or the handoff when repository writes are unavailable. **Resume** by matching that checkpoint against GitHub, the package digest and the Marketplace. A publish-only request can start at the handoff below.

## Prepare the release branch

1. Compare the branch with the previous published tag. Review merged PRs, commits and memory-bank records. Identify the user-facing changes, compatibility implications and appropriate version bump. Keep release edits on the release branch for review.
2. Update the version in the root, core and VS Code extension manifests and the corresponding `package-lock.json` entries. Update `apps/vscode-extension/CHANGELOG.md` for writers and `docs/CHANGELOG-DETAILED.md` for maintainers. Finish packaged changelog edits before packaging.
3. Use those changelogs and the previous release's design as the brief for `apps/vscode-extension/README.md`. Illustrate the headline workflows using the actual release UI with demo manuscripts. Check legibility, callout placement, links and images on the rendered branch README. Pin remote artwork links to a pushed artwork commit so they also resolve before the merge.
4. Update the Workshop What's New modal and its screenshot registry. Advance the notice revision, put new pages first and retain earlier primers. Check navigation, dismissal and image loading at narrow and wide editor widths. Update the searchable persona help under `packages/core/resources/help/`, including upgrade guidance where relevant. Regenerate its version and manifest-derived tables with `node apps/vscode-extension/scripts/generate-help-tables.js` and check `helpReferenceSync.test.ts`.
5. From the monorepo root, install from the lockfile and run typechecks, lint, full Jest coverage and the production build (`npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run build`). Review the release diff and changed behavior. Run `npm audit` and `npm audit --omit=dev`, compare findings with the previous release, and record relevant fixes, accepted findings and untested paths. Commit and push the reviewed candidate.

## Install and exercise the candidate

1. Run `npm run package` at the root. Preserve `apps/vscode-extension/prose-minion-X.Y.Z.vsix` outside the build tree. Record the source commit, filename, byte count and SHA-256. Check ZIP integrity, publisher/name/version in both manifests, and the packaged bundles, resources, help and tour images against the build tree.
2. Start with the previous public VSIX in a disposable native VS Code profile and extensions directory. Save representative user state and dismiss the old tour. Install the **candidate file** into that same profile, open the running extension and exercise it through the editor and webviews. Verify activation, upgrade compatibility, the new tour appearing, its opt-out surviving reopen, and the old session reopening intact.
3. Choose fixtures from the changed features and their live-pass checklists. Exercise the normal journey and important cancellation, partial-result, persistence and recovery paths. For v2.16.0 these included sidebar and Workshop Passage Search, linked quotes and saved reports, per-item to-do Undo, Git comparison, reviewed context-path Apply, persona help and interrupted-session recovery. Use these as examples for the next release's test selection.
4. If the release calls for authorized live inference, use the owner's configured OpenRouter BYOK model routes (OpenAI or Anthropic here), including helper and organizer calls. Enter the key through the extension's Settings in the isolated profile and clear it afterward. Record actual models, observed results, limitations and a representative screenshot. Distinguish installed observations from fixture renders and automated tests.
5. Push the smoke report and supporting evidence to the release branch. Record the digest of the accepted VSIX and the tested source commit, which may precede a documentation-only evidence commit. Confirm acceptance before merging. If the user already accepted this exact candidate, carry that acceptance forward.

## Merge, tag and publish

1. Merge the reviewed release branch into `main`, push, and tag the merge commit with `vX.Y.Z`. Verify the peeled remote tag and successful CI on that commit. If the user is pushing the tag locally, give them the merge SHA, then verify the remote tag. On resume, reuse an existing matching merge and tag. Stop on a conflicting tag.
2. Use release notes from the final changelog. Find the existing GitHub release for the tag, including drafts. Create a draft with `gh release create "$tag" --draft --verify-tag --notes-file "$notes" --repo "$repo"` only if absent. Record its numeric release ID. Confirm that ID and tag before modifying the draft.
3. Attach the accepted VSIX with `gh release upload "$tag" "$file" --repo "$repo"`. If an asset with that name exists, download and hash it. Reuse a match and report a conflict before changing anything. Verify the uploaded asset's size and SHA-256, then publish the draft with `gh release edit "$tag" --draft=false --repo "$repo"`. A public matching release only needs verification.
4. With explicit Marketplace authorization, publish the preserved file to `OkeyLanders.prose-minion` using `vsce publish --packagePath "$file"`. Check the exact version first. If it already exists, verify its download. Keep GitHub first unless the user asks to change the order.
5. Download the GitHub release asset and the version-specific Marketplace package to separate fresh files. Use the asset's `browser_download_url` and `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/OkeyLanders/vsextensions/prose-minion/VERSION/vspackage` (numeric version, without the tag's leading `v`). Follow redirects and fail on HTTP errors. Allow time for Marketplace propagation. Compute each download's SHA-256, compare both to the smoke record, and report the URLs, sizes, digests and any unresolved discrepancy. Save the outcome in the release checkpoint.

## Resume from another thread or a local Codex

If a publish or tag operation fails, re-read the remote state before retrying. Record the failing host, operation, HTTP status and sanitized response. GitHub repository access and uploads to `uploads.github.com` can have different credential bindings. GitHub release uploads require repository Contents write permission. For Marketplace, check the `VSCE_PAT` binding to `marketplace.visualstudio.com` and the publisher’s Marketplace (Manage) scope. A publisher lookup or `vsce verify-pat` can succeed while the Marketplace upload returns 401. An integration 401 alone does not establish an IP block, an expired PAT or a missing scope. Check the running environment's bindings for the destination. A newly published environment configuration may only be available to a new task. Keep credentials in their configured secret stores.

Preserve a retrievable copy of the accepted VSIX **before leaving the environment**. Prefer an existing verified release asset or downloadable build artifact. If neither exists, the v2.16.0 handoff used a Git blob in the same release repository. With the accepted file and repository in `file` and `repo`, run from Bash:

```bash
set -euo pipefail
blob=$(python3 - "$file" <<'PY' | gh api --method POST "repos/$repo/git/blobs" --input - --jq .sha
import base64, json, pathlib, sys
data = pathlib.Path(sys.argv[1]).read_bytes()
json.dump({"encoding": "base64", "content": base64.b64encode(data).decode("ascii")}, sys.stdout)
PY
)
test "$blob" = "$(git hash-object --no-filters "$file")"
restored=$(mktemp)
gh api -H 'Accept: application/vnd.github.raw+json' "repos/$repo/git/blobs/$blob" > "$restored"
cmp "$file" "$restored"
printf 'Verified Git blob %s\n' "$blob"
```

A standalone Git blob is a short-term transfer. Download it in the receiving environment while it is available. Include the following in the checkpoint and give the user a ready-to-paste local prompt:

> Resume release TAG in OWNER/REPO. Tested source: SOURCE_SHA. Merge/tag target: MERGE_SHA. CI: RUN_URL. Accepted file: FILENAME, BYTES bytes, SHA-256 DIGEST. Retrieve it from ASSET_URL, ARTIFACT_ID or GIT_BLOB_SHA. GitHub release ID: ID, status: STATUS. Marketplace status: STATUS. Completed steps: STEPS. Next authorized action: ACTION. Download the file, check its size and digest, then use it for the remaining authorized publications. Reuse matching remote state, preserve conflicting assets for review, and verify both public downloads.

For a Git-blob handoff, provide the concrete retrieval and checksum commands with `repo`, `blob`, `file` and `digest` filled in. Run them in a fresh directory. The local publisher needs no checkout or build:

```bash
set -euo pipefail
gh api -H 'Accept: application/vnd.github.raw+json' "repos/$repo/git/blobs/$blob" > "$file"
printf '%s  %s\n' "$digest" "$file" | shasum -a 256 -c -
```

Record what the user authorized and any remaining decision. A copied handoff should never claim approval the user has not given.

The v2.16.0 records show the level of evidence expected for [release preparation](../../../.memory-bank/20261125-release-v2.16.0-preparation.md), [README, Workshop tour and help](../../../.memory-bank/20261125-1100-release-v2.16.0-readme-tour-and-help.md), and the [installed smoke test](../../../.memory-bank/20261125-1120-release-v2.16.0-installed-smoke.md).
