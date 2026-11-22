# PR #296: Combined Passage Search re-review

Astra 6.2 reviewed `3712736acc0458b2180e46272d33315bfdab2d03` against `epic/passage-search` at `f5949b97329366746a29a3c7400646a0463a1b51`, which includes #295. **Hold for one P2.** The original combined partial-coverage scenario and compact-summary fix passed.

## P2: An acknowledged Stop can still auto-send to the persona

[WorkshopPassageSearchHandler.ts:263–282](https://github.com/okeylanders/prose-minion-vscode/blob/3712736acc0458b2180e46272d33315bfdab2d03/packages/core/src/application/handlers/domain/workshop/WorkshopPassageSearchHandler.ts#L263-L282) acknowledges Stop but automatically delivers if the finished result is classified as complete. [PassageSearchService.ts:311–322](https://github.com/okeylanders/prose-minion-vscode/blob/3712736acc0458b2180e46272d33315bfdab2d03/packages/core/src/infrastructure/api/services/search/passage/PassageSearchService.ts#L311-L322) rechecks provider retirement after awaiting the organizer but does not recheck the abort signal. The organizer can return `no-room` while fitting the request, or a rejected prompt load can become `analysisMissing: failed`, without reporting the accepted Stop.

On the pinned combined code with a stubbed provider, the reviewer let the read return a hit, issued Stop while organizer preparation was suspended, then ended preparation without a fitting request or with a prompt-load rejection. Stop returned `done`, the search still returned `complete`, and a persona delivery began without pressing Send. The prompt rejection was also reproduced with the production default ceilings and zero organizer dispatches. Control checks during a read and during a dispatched organizing call kept partial results and did not auto-send.

After the awaited organizer pass, recheck the signal (keeping retired-key precedence), discard analysis on Stop, preserve reads and already-incurred usage, and return `stopped` so the held result waits for manual Send. Add Stop-then-no-room and Stop-then-prompt-rejection coverage through the combined route.

## What passed

- Two planned file reads, one successful match and one context-window refusal. The local refusal added no dispatch or usage. One read plus one organizer totaled two dispatches and $0.02 in the metered stub. The partial result stayed held until manual Send.
- The compact manual delivery preserved the incomplete-coverage caveat. At the tested 242-token bound it was sent; one token less refused delivery and left the report available. The prior compact-summary P3 is closed.
- The checked-in combined test exercises card data, report/directive/transcript and the saved/reopened session codec. Astra independently ran focused core and route-level mocks, not the full native webview or the session-codec route suite locally.

[Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45080573524). Astra ran 44 pinned directive, analysis and coverage cases in an offline TypeScript harness in addition to the targeted probes above. No live provider, native VS Code, or merge.
