# Highlight proposals and restore prompts

2026-11-27 · Sprint `sprint/workshop-highlight-prompts` · Base `0279c097` · Implementation gate **open**

## Change card

[Declared] Show the writer a Workshop dialog over the chat for a concrete proposed set. Reopen a saved session with an offer to restore kept highlights for its excerpt. A direct **Show** on a reply is already a decision to redraw. The startup release notice gets the screen first.

| Move | Existing owner | Target and risk |
| --- | --- | --- |
| Consent | `authorizeWorkshopReplyHighlights` checks a validated trailer and the authorized file | Route the existing question into the originating Workshop chat. Cancel a stale answer on room, excerpt or run changes. |
| Restore | The session ledger owns each kept set and its original file | Capture eligible turns for this opening. Persist suppression for the sets actually offered. A newly kept set starts eligible. |
| Presentation | The release notice and Workshop room snapshot arrive independently | Gate a single highlight dialog on a resolved, closed startup notice. Keep the question queued through dismissal. |
| Redraw | `WorkshopHighlightHandler` authorizes the saved file and checks quote placement | Restore and manual Show reuse the same drawing path. Only restoration acts on a batch. |

## Map · 2 minutes

Which action opens a dialog? Arrows trace the trigger to the code that owns it. This map covers one Workshop pane and its editor marks.

```text
Writer chat → host or guest reply → [=] validated highlights trailer → [~] pending proposal
Saved session reopened → [~] eligible kept turns for the excerpt → [+] pending restore
Both → [~] room snapshot (summary and opaque ID) → [~] WorkshopModalShell after startup notice
Button → [+] correlated host decision → [=] authorized quote placement / [~] session suppression
Reply’s Show button → [=] existing turn lookup → [=] authorized quote placement
```

[Observed] `WorkshopRoomHandler` already distinguishes writer-composed replies and guest introductions from tool-only runs. `WorkshopReplyHighlights` keeps parsed proposals only after consent and repeats file authorization. The existing trailer supplies title, places and notes. A plain offer in chat provides no set to confirm. `WorkshopModalShell` supplies Workshop styling, keyboard handling and focus. `useStartupNotice` initially reports closed before the host answers whether to display it. A host-owned question carried in room snapshots survives webview startup and notice dismissal.

## Contracts and review cases

| Action | State owner and expected effect | Fitness witness |
| --- | --- | --- |
| New valid proposed set, including a persona-initiated proposal | Hold this run’s question once. Apply keeps and draws it if the file is open; Skip discards it. | Host, direct guest, plain prose, malformed trailer, aborted run and stale answer |
| Reopen saved conversation with kept sets | One restore question covering saved, eligible sets for this excerpt across earlier turns. Reauthorize and place current quotes when accepted. | Initial extension hydration, named open, repeated snapshots, other source files |
| Not now or dismiss | Consume the restore prompt for this opening. The saved sets remain eligible next time. | No re-prompt in current room; prompt returns on genuine reopen |
| Don’t ask again for these highlights | Store an optional suppression marker on each offered set. Manual Show remains available. Future sets can be offered separately. | Checkpoint round-trip, old sessions, rewind, new set in same session |
| Release notice | Wait for the host’s startup-notice decision; show release first. Closing it reveals the pending question. | Both message orderings, dismiss with and without the checkbox |
| Saved reply Show, unrelated chat, another room | Direct Show uses the existing owner. Unrelated turns/panes cannot create or answer pending questions. | Run/room identity, separate panels, no duplicate proposal or redraw |

[Proposed] The webview receives counts, a display path and opaque correlation fields. Quotes and notes stay with the host. A session-level toggle cannot distinguish old and newly kept sets. An extra model flag would duplicate the validated highlights trailer. An optimistic webview-only queue loses the question on remount; an extension-wide popup does not establish which chat owns it. Kept-set suppression is optional, compatible with existing records and separately recoverable from manual Show. Stored source identity and editor authorization continue to govern access; paths shown in the UI have no authority.

**ADR seed and re-plan verdict · refined.** The initial idea was to replace a notification and show a prompt on launch. Inspection showed that the release notice’s initial false value does not establish readiness and that ordinary state refreshes must not reissue a restore offer. Use a resolved-notice flag, host-owned per-opening state and correlated answers. The UI owner handles release sequencing, the proposal owner handles the live run, the restore owner handles opening/redraw, and the ledger owner handles compatibility. The integrating owner connects typed snapshots and actions. A real VS Code restart and a two-mount UI test exercise the path.
