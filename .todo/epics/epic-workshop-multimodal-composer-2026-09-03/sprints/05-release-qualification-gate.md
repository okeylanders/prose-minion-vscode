# Release Gate 05: Qualification

**Status:** Planned

**Proposed branch:** `gate/workshop-multimodal-composer-05-release-qualification`

**Depends on:** Sprints 02-04

**Blocks:** Epic merge/release

## Gate objective

Qualify the integrated long-paste and multimodal composer behavior for release.
Feature sprints own their UX, accessibility, observability, and failure states;
this gate verifies those promises together and records release evidence.

## Deliverables

1. Verify picker and drag-and-drop behavior plus pill layout at narrow and normal
   widths for long filenames, mixed attachment kinds, pending/degraded states,
   keyboard removal, and screen-reader copy. Return defects to the owning
   feature sprint.
2. Verify copy states clearly that one-shot attachments ride the next explicit composer send
   and that binary attachments are sent through OpenRouter to the selected model.
3. Audit memory and payload behavior: pathless dropped bytes cross only the
   bounded transient intake route; stored bytes are loaded/encoded only for
   dispatch, released after request construction/use, and never included in
   snapshot, search, diagnostics, or telemetry.
4. Verify operational logs cover intake kind/size, capability verdict, request
   part kinds/count, asset verification failure, delivery retry, and scoped
   degradation without exposing content, absolute source paths, full digests,
   or base64.
5. Update user docs, architecture docs, changelog draft, privacy/data-flow copy,
   and troubleshooting for unsupported models and provider-specific limits.
6. Run the full release-quality gate and record manual UI evidence at compact
   and normal sidebar widths.
7. With explicit approval only, run tiny image/audio/video/PDF smoke requests
   against currently verified compatible models; force PDF to native processing
   and record actual model, provider, result, usage/cost, and cleanup. Never
   enable a paid OCR fallback.

## Manual validation matrix

| Scenario | Evidence |
|---|---|
| Short vs. long paste | Textarea/pill behavior and keyboard flow |
| Picker vs. Explorer/OS drop | Same accepted formats, validation, and resulting pills |
| Text + image/audio/video/PDF | Ordered pills, successful response, committed turn |
| Attachment-only | Honest transcript label and no invented prompt |
| Unsupported/unknown model | Visible refusal, zero request, attachments retained |
| Cancel/fail/retry | Exact typed message and same `ta-N` ids remain and resend once |
| Reload/named save/duplicate/delete | Metadata and assets follow the correct session |
| Late guest catch-up | Each room artifact delivered once |
| Missing asset | Scoped degraded UI and recovery/removal path |

## Exit criteria

- [ ] Keyboard-only and screen-reader flows are complete.
- [ ] Narrow-width visual proof exists for every pill state.
- [ ] Raw dropped bytes stay within bounded transient intake; no
      base64/path authority escapes its boundary.
- [ ] No paid smoke call occurred without explicit approval and reported cost.
- [ ] Focused suites, full Jest, all TypeScript projects, ESLint, production build,
      VSIX packaging/content inspection, and `git diff --check` pass.
- [ ] Epic, ADR, architecture docs, user docs, and implementation agree.

## Rollback seam

The binary-attachment capability gate is the operational kill switch. Long-paste text can
remain enabled independently if its qualification is green.
