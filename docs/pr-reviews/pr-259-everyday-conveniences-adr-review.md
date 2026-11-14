# PR #259: Everyday Conveniences ADR review

Reviewed: 2026-11-14. Source head: `5deaca8e4d4a114933b0686e8ffc7fc4825573a7`.
Scope: technical design review of the proposed ADR, not acceptance of product defaults, implementation approval, or permission to merge.

## Verdict: changes requested

### F-01 (Medium): decide the no-progress case for whole-line reads

ADR D2 lines 124–130 requires whole lines under each byte share; D6 lines 210–216 emits a startLine-only continuation whenever a file stops early. There is no decision for a first line larger than the maximum one-file budget (64 KiB), or larger than the fitted share. A valid source under the 2 MiB source ceiling can consist of a 70 KiB first line. The new packing rule then returns no line, and a continuation at that same line cannot advance even on a one-file retry. A model following the hint can spend its call budget retrying an impossible read. This is a change from today's `sliceUtf8` partial-line behavior, despite D5 saying a one-path read changes only by fitting.

Before implementing A, specify the outcome for a line that cannot fit: for example, an explicit per-file no-progress refusal with no retry hint when the line cannot fit even alone, and a single-file retry only where it can increase the share enough. Alternatively design a bounded partial-line continuation that does not silently skip the rest. Do not advertise a successful delivered line or mint a line-range manifest row for zero delivered lines. Add tests for a >64 KiB single line and for a line larger than a multi-file share but smaller than the single-file ceiling, including mixed good/bad files. Retain the overall window ceiling.

## Clarifications to carry into implementation

- **Snapshot lifetime:** D11 defines a window-owned cache evicted by count, whereas D14 says room replacement makes an id unknown. Name the room-replacement invalidation/generation owner and cover New/Open/Rewind/Branch with a delayed send. The current `handleSendMessage` reads current session state; a UUID lookup alone does not bind a cached selection to the room in which its pill was shown. If selections intentionally survive replacement, reconcile that policy with D14 instead of relying on accidental eviction.
- **Case identity wording:** D4 calls case-folded duplicates the lookup's rule. `findConfiguredResource` actually prefers exact matches before its case-folded fallback. Thus two distinctly cased configured files can both resolve exactly today. Refusing that pair in one multi-read may be a valid conservative policy, but describe it as such and test it rather than claiming exact equivalence to lookup.
- **Forward-only persistence:** the existing July 30 codec policy allows optional additive fields while older strict readers reject new keys. Keep that limitation in the eventual release notes for `selectedText`; this review does not promise older builds can read newly saved sessions.

## Positive checks

The proposed reads-module dependency direction preserves the existing capability boundary. The fitting helper currently counts escaped content and metadata; preserve this in the move. Per-file provenance must retain each source fingerprint and line range, not reuse the combined card body size/range for all files. The registry-based artifact kind and neutralized quoted body match current attachment architecture. Keeping the legacy remembered selection API separate avoids breaking paste verification. The seed claim/receiver/grant flow matches the existing AGENTS.md delivery rules. Transcript label-only projection agrees with current `attachmentLabels` behavior.

## Evidence and verification

Inspected the complete ADR and epic README at the reviewed head; AGENTS.md seed-delivery and architecture rules; current `WorkshopResourceCapability`, `WorkshopConfiguredResourceLookup`, `WorkshopPersonaCapability`, recall fit/share/window helpers, `EditorContext`, `VsCodeEditorContext`, attachment identity/kind/frame code, transcript projection, room send handler, and July 30 codec ADR. The long-line issue is a design-level counterexample to the specified algorithm, not a runtime reproduction of unimplemented code.

Docs-only PR: no implementation tests, typecheck, lint, build, Extension Development Host, or paid model calls run. No implementation files changed. GitHub reported non-mergeable at the initial check; conflicts were not resolved and no merge was attempted. Product questions/defaults remain Okey's decisions.
