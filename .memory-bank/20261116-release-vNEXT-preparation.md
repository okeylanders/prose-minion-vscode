# Release preparation — vNEXT

**Date:** November 16, 2026 (America/Chicago). **Branch:** `release/v2.14.0`, based on `aac51253`. **Previous release:** v2.13.0 (November 12). **Version:** v2.14.0 (minor; confirmed by Okey). The provisional `origin/release/vNEXT` remains for coordination with Fable. Fable owns release documentation and design.

## Changes since v2.13.0

65 commits, including main PR #266 (Everyday Conveniences) and #258 (widget response recovery), plus the OpenRouter model refresh. New features include window-fitted multi-file Workshop reads, Selected Text attachments, Dictionary history search, a collapsible Workshop rail and file re-read in a new room. Model choices add Gemini 4 Hydrogen, Qwen4 Max and Hy4 Flash. Fixes include tolerating an omitted empty widget reply field and preserving drafts and room binding on Selected Text refusals. The epic's Development Host live pass was accepted by Okey before merge; it is not an installed release-VSIX acceptance.

**Compatibility:** Sessions with Selected Text metadata require a current extension; older versions reject those sessions. Upgrade all installations that share such sessions. The consumer changelog still starts at 2.13.0. Fable should cover these changes, the compatibility note, and the model additions in release writing.

## Review

A focused release review sampled Selected Text, re-read, multi-file reads, Dictionary history search and widget recovery; no new blocker found. It is not an exhaustive review of the 190-file diff. The previous re-read race and Selected Text draft/room findings were fixed and re-reviewed in PRs #260 and #264. PR #258 deliberately treats an omitted `invariantFlags` field as empty without evidence the model performed the check; that tradeoff is recorded in its review.

## Dependency audit

The configured npm registry returned HTTP 404 for its audit endpoint. A public npm registry audit initially reported 2 critical, 6 high and 7 moderate packages. The two critical findings were DOMPurify 3.4.14 (runtime sanitizer; the cited SAFE_FOR_TEMPLATES/DOM-output and IN_PLACE modes are not enabled by this code) and Handlebars 4.7.9 (ts-jest development dependency). The lockfile was updated narrowly to DOMPurify 3.4.18 and Handlebars 4.7.10, and core now requires DOMPurify ^3.4.18. A repeated public audit of the updated lockfile reports 0 critical, 6 high and 7 moderate; `npm audit --omit=dev` reports 0 vulnerabilities. These results cover the public registry, not the configured registry.

Remaining findings are tooling paths: high `@azure/identity` / `@azure/msal-node` (vsce authentication), `brace-expansion` (eslint, vsce, and Tailwind glob tooling), `markdown-it` (vsce Markdown processing), `source-map-js` (PostCSS), and `undici` (vsce via cheerio); moderate `@vscode/vsce`, `glob`, `minimatch`, `sucrase`, `fast-uri`, `postcss-selector-parser`, and `qs` also occur through vsce, build, or test tooling. They do not appear in the production dependency audit; no claim is made that their build/publish-time attack paths are impossible. Existing build and packaging checks exercise normal usage, not adversarial advisory-specific inputs. Defer further tooling upgrades for release review rather than treating the audit as clean.

## Validation and remaining work

- Typecheck and production build passed with the patched dependencies on Node 20.20.2. Webpack reported three bundle-size warnings; Browserslist data was seven months old. Bundle sentinel passed.
- Full test and coverage runs passed against patched dependencies on Node 20.20.2: 870 suites, 12,330 tests, 59 snapshots in each. Coverage: 92.78% statements, 85.67% branches, 93.30% functions, 92.74% lines. Earlier Node 26 runs were stopped after the LightboxMisnestedMemberEdges test failed because its deep JSON.stringify witness no longer throws; that suite passed on Node 20.
- Lint passed: zero errors, 1,172 warnings.
- Coordinate Fable’s work from `release/vNEXT` into `release/v2.14.0` without losing either branch’s changes. Version references are updated to 2.14.0.
- Finish Fable's docs, rerun release verification against the final tree, create the VSIX and obtain explicit manual acceptance. Merge, tag, GitHub release and Marketplace publication are separate later gates.
