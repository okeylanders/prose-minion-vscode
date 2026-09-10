# Workshop loading creates Git changes and stale-cache recoveries

Status: Implemented locally; manual VS Code verification and review pending.
Priority: High
ADR: [Read-only session loading](../../docs/adr/2026-09-10-workshop-read-only-session-loading.md)

September 10 evidence: the author discarded the tracked named JSON/summary before
a successful pull. Ignored current.json retained 17 old committed turns plus one
automatic resume. Recovery preserved that clean old room when named gained 33
turns. No incoming work was lost. Opening then appended another resume and an
automatic context-refresh notice and autosaved named twice. Evidence snapshot:
`/private/tmp/workshop-20260910-y0eoi2wn/investigation.md`.

Implemented: content-bound clean provenance for rolling mirrors; read-only named
loads; interaction-time resume; automatic context staging without autosave or
notice turns; explicit edits/Save/Refresh preserve their durability. Legacy rolling
files without proof remain conservatively recoverable. No manuscript files edited.

Manual completion: load matching named/current once to establish provenance;
close without interacting; update named through Git; reopen/reveal and confirm
named remains unmodified and no recovery appears. Confirm pending file updates
reach the next message and are persisted by an explicit author action. Repeat with
an unsaved local edit and a conflicting incoming named file; verify the full local
recovery and authoritative incoming room. Validate the prior startup-loader change
while the notice modal is open and after dismissal. Do not overwrite real sessions
for testing; use a disposable workspace copy.
