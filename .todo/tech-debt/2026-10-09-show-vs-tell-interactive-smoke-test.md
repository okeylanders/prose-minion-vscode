# Show vs. Tell Interactive Smoke Test

**Status**: Open
**Priority**: High
**Discovered**: Sprint 05 (Show vs. Tell) Slice 6b, 2026-10-09

## Problem

Show vs. Tell is verified by unit, host, webview, and architecture tests. No
Extension Development Host or native-browser run has exercised the whole flow.
Those flows are: intake, the five-position continuum and readout, generation,
keep and carry, the payload meter, the one-shot commit, the chip, reopen,
clone-and-recommit, and the Host and Guest recommendation prefill. Until that
run happens, the readout-comprehension criterion in Sprint 05 stays unticked,
and layout, focus order, and copy have not been checked in a real webview.

## Related files

- `packages/core/src/presentation/webview/components/workshop/widgets/showVsTell/` (modal, continuum, readout)
- `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/showVsTell/`
- [Sprint 05 — Show vs. Tell](../epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md) (Completion criteria; Open follow-ups)

## Completion criteria

- Launch the Extension Development Host (`npm run watch`, then F5), and walk the
  full flow once with a fixture or an offline stub. No live provider is needed.
- Record the result in the sprint doc, with any defect filed under `.todo`.
- Confirm the readout criterion: the writer can name each position's tradeoffs,
  and nothing on the surface ranks either end.
- Check reopen after a window reload and that commit leaves editor text unchanged.
