# Workshop conveniences on the highlights epic

2026-11-27 · Based on `49164024` · Ready for implementation and sprint review

### Change card

| Item | Existing owner | Proposed change | What a reviewer should try |
| --- | --- | --- | --- |
| 36 | Composer, pending attachments, Workshop session | Stage a long plain-text paste as a bounded, editable attachment | Paste at 499 and 500 characters. Type while a request is pending. Undo an attachment-only send by rewinding. |
| 34 | Sent turn, session artifacts, text sheet | Look up the committed body by room and artifact ID | Change the source, switch rooms, rewind, and inspect a widget ID. |
| 4+ | Memory capability and shared agent engine | Fit whole notes and withhold evidence that would overflow a known window | Request notes on the boundary. Follow withheld evidence with a smaller read. |
| 33 | Host, webview and manifest model settings | Use one table of scope defaults, keep user selections | Load an unset scope, an explicit selection and a cleared setting. |

[Declared] Okey chose 500 characters, a way to insert a paste back at the cursor, and a viewer that shows protective markers as written. The memory item specifies half of the available window, whole notes, a retry within the existing call allowance and a ledger that records what was actually delivered. See the decisions in feature notes 36, 34 and 4+.

### Ownership and change map

This map follows one writer action across component boundaries. Arrows show requests or data return. Brackets identify the owner. A maintainer can review the contracts below independently of the UI design.

```text
[Composer / attachment tray] → stage, inspect, update, take or remove → [host route]
[Host route] → mutate or read pending attachments → [Workshop session and codec]
[Workshop session] → bounded artifact and writer turn → [room frame renderer] → model
[Sent turn] → request by room revision and artifact ID → [host lookup of committed writer attachment]
[Committed artifact] → one correlated body → [read-only text sheet]

[AgentRunEngine] → remaining context → [Workshop persona capability] → [whole memory notes]
[AgentRunEngine] → measure next provider request → [admit evidence or send a short notice]
```

| Boundary | Before at the base commit | Target, consumer and verification |
| --- | --- | --- |
| Composer and text sheet | No paste staging. Sent pills are spans in WorkshopTurnBubble.tsx at line 577. | [Proposed] Accessible pill buttons. A 500+ paste leaves typed text in place. Gate submission until staging settles. Only an explicitly requested read/take returns text. Test stale responses, mid-edit typing and keyboard actions. |
| Registry and storage | workshopThreadArtifactKinds.ts distinguishes two special kinds. File attachments have no special kind. WorkshopSessionStateV1Shape and V1Integrity check saved state. | [Proposed] Add pasted-text with optional metadata, stable identity per paste, and compatible hydration. The session owns the only durable body. Preserve failed sends, rewind and separate identical pastes. Test a pre-change fixture. |
| Sent reader | WorkshopRoomHandler stores the writer's body. WorkshopThreadArtifactFrame.ts at line 79 neutralizes delimiters when building the model input. | [Proposed] Return the retained raw writer body verbatim, including literal entity text. Check writer-turn membership and artifact kind. Never infer type from a label. Reauthorize an explicit request to open a current source. Cover old saved turns, earlier pages, ambiguous file sources and widget refusal. |
| Engine and capability | WorkshopPersonaCapability.ts at line 812 drops the measured window for memory reads. AgentRunEngine.ts near line 529 records fulfillment before injecting evidence. | [Proposed] Share the read fit, measure the complete evidence request including the retained wrapper, and record successful delivery only after the fit decision. A notice or standing history that itself exceeds the window still uses the normal preflight failure. Exercise retained and discarded policies. |
| Defaults | The extension manifest, ModelScopeSelections and useModelsSettings each supply defaults. | [Proposed] Host and webview read a per-scope table. A sync test checks VS Code's static manifest and generated help. Pricing and user-facing scope changes belong in this sprint. |

### Review packet

| Risk | Example | Fitness witness and owner |
| --- | --- | --- |
| High, transient state | A delayed read arrives after another sheet opens or another room reuses an ID. | React hooks match request and revision. Host checks live revision and membership. Test both ends. |
| High, durable state | A rejected send consumes a paste or restores two copies on rewind. | Session transactions, codec and per-artifact identity. Test rollback, retry, save/load and equal text with different IDs. |
| High, context and disclosure | A note fits alone but its framing overflows the limit, or an undelivered read appears in catch-up. | Memory adapter measures rendered evidence. Engine measures the next request and calls back into capability accounting. Check card, retained sources, audience, and retry. Logs contain counts. |
| Moderate, presentation and compatibility | A selected passage contains a literal tag and an already encoded entity. A legacy file has no recoverable current path. | Sent sheet shows the saved body as plain text. Verify both strings and unavailable-source feedback. |
| Moderate, cost | An unset scope receives the wrong model or an explicit selection changes. | Check the public catalog against the six scopes and exercise both persisted and default selections. |

[Proposed] Separate sprint branches own pasted messages, sent inspection, defaults and read protection. Stage and sent lookup use different operations. Their owners coordinate the shared room contract, sheet and message dispatcher. Integrate both to test that a paste from the new composer opens in the sent viewer. The model table and read protection can land independently. The draft and sent surfaces share a presentation component, while ownership checks stay in the host. The generic engine knows its budget and delivery outcome. Feature-specific copy and ledger updates stay with the capability.

[Inferred] A textarea-only implementation would lose the paste on reload and would leave two draft authorities. A generic media or schema migration would also change unrelated attachment families. Extending the existing closed registry and session aggregate costs additional route tests but preserves the current ownership and recovery paths. A future text attachment joins the registry and declares its metadata. The sent viewer can read it through the same verified turn relationship.

### Evidence, self-review and ADR seed

- [Declared] See the feature notes for [long paste](../../features/feature-workshop-long-paste-pill/README.md), [sent attachment viewer](../../features/feature-workshop-sent-attachment-viewer/README.md), [window-fitting reads](../../features/feature-workshop-reads-fit-the-window/README.md), and [scope defaults](../../tech-debt/2026-11-20-default-models-behind.md). ADR 2026-11-14 describes the Selected Text and shared read-fit precedents.
- [Observed] A stored file can lack a special kind. A stored body already contains the writer's original characters. Those facts refine the note's suggestions to check the kind and decode the content. The writer turn's reference supplies ownership, and neutralization belongs at frame construction.
- [Observed] Lexical Gravity already repairs early-closed attention, checks its content guard and retains usable candidates. The original reported case and unsafe variants have tests in LexicalGravityLensReplyJson.test.ts and LexicalGravityModelService.test.ts. All 30 tests in those suites passed on the base. The repository's [13+ note](../../tech-debt/2026-11-09-lexical-gravity-reads-json-without-repair.md) defers changing the model reply format pending recurrence. A repository issue/history search found no recorded recurrence after the repair. Private runtime telemetry is unknown.
- [Proposed] **Re-plan verdict: refined.** The original plan copied the kind check and assumed a decode step. File provenance, persisted raw content and the read-window dispatch changed those details before implementation. A saved external basename can be insufficient to identify today's file. The viewer can still show its committed contents. Conditional item 13+ has no implementation slice without new evidence of failure.
- [Proposed] **Implementation gate: open.** Okey's published threshold, insertion and read-budget decisions stand. Attachment owners cover room cancellation, schema compatibility and data-loss cases. The engine and memory owners share an ADR and test the withheld-evidence boundary. Merge review requires the focused tests and an integrated test of the two pill flows.
