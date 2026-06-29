# Prose Minion — Migration & Facelift

> **Archived 2026-06-29.** This folder is the historical execution record for
> the v2.0.0 migration and facelift. Current follow-up work was split into
> `.todo/features/` and `.todo/tech-debt/`; see `ARCHIVE.md` first.

Tracking workspace for the two-pass overhaul that turns Prose Minion into a
mono-repo — shippable as **both** a VS Code extension and a standalone desktop
app — and re-skins it to match **FrameMinion**.

## The two passes

- **Pass 1 — Monorepo + Ports** _(in progress)_: restructure into
  `packages/core` + `apps/vscode-extension`, with every VS Code API behind a
  platform port so the domain logic is runtime-agnostic. Behavior-preserving
  on the `file://` single-root norm — **with two disclosed exceptions**: (1) the
  saved-file toast drops the workspace-folder prefix in *multi-root* workspaces
  (`asRelativePath(path, false)`, decision **D16**); (2) Stage-1's review added a
  deliberate path-containment guard to `UIHandler`'s open-file joins, which now
  *rejects* `..` traversal that previously opened (security hardening, review
  #6/#7). Both are intentional and tracked, not silent drift.
- **Pass 2 — Design Facelift** _(not started)_: apply the "Prose Minion – Design
  Refresh" to the sidebar to match FrameMinion's look. Needs the design HTML
  saved to disk (see [tech-debt-and-deferred.md](tech-debt-and-deferred.md)).

## Documents

| Doc | Purpose |
|---|---|
| [plan.md](plan.md) | The staged execution plan (Stage 0/1/2 + waves) — the operational "what & how." |
| [status.md](status.md) | Live status: what's done, green, and committed; current focus. **Updated every wave.** |
| [decision-tracker.md](decision-tracker.md) | Running log of decisions + rationale (the small ones; big ones are ADRs). |
| [tech-debt-and-deferred.md](tech-debt-and-deferred.md) | Deferred work and debt discovered along the way. |

## Anchors

- **Architecture rationale (record):** [ADR 2026-06-16 — Monorepo + Ports-and-Adapters](../../../../docs/adr/2026-06-16-monorepo-ports-and-adapters.md)
- **Reference implementation:** FrameMinion (`../frame-minion-vscode`), its ADR-012
- **Branch:** `epic/monorepo-ports-and-adapters`

## Working rhythm

Each wave lands **green** (typecheck both projects + full test suite) and is
**committed**, so the branch is always safe to pause and resume. When a wave
finishes: update `status.md`, append any new decisions to `decision-tracker.md`,
and log anything punted in `tech-debt-and-deferred.md`.
