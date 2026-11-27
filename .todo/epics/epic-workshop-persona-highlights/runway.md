# Workshop persona highlights architecture runway

**Status** Ready for implementation. **Decision owner** Okey. **Audience** Workshop maintainers and implementers.

## Change card

[Declared] Item 39 and H0–H2 give the writer a way to ask a persona to highlight any passages in the current excerpt’s file, with a note at each place. [Observed] The shared Workshop reply scanner already strips and redacts control frames. Draft Edit owns the current annotation consumers.

| Move | Target | Highest risk |
|---|---|---|
| Decode | Extend the shared reply scanner with a bounded frame and an exact feature codec | Leaking frame payloads into logs or transcript |
| Commit | Keep quotes and notes on the persona reply and derive the target from its captured file-backed excerpt | Using a switched room, stale excerpt or arbitrary model path |
| Show | Resolve ranges against the live document and display through a distinct annotation family | Incorrect anchors or clearing unrelated diagnostics |
| Restore | Route Show and Clear through host-owned turn identities | Reinstating a rewound or superseded set |

## Architecture delta

```text
Before
  Core → reply scanner → Workshop completion → session and transcript
  Core → Draft Edit → IssueAnnotator → VS Code Proofread and Craft collections
After
  [~] Core → reply scanner → Workshop completion → session and transcript
                     [+] highlight codec        [+] optional reply record
  [+] Workshop highlight settlement and Show/Clear routes
            → [=] quote anchoring and protected regions
            → [~] annotation boundary → [+] separate VS Code Workshop collection
```

The scanner owns framing and redaction. The feature codec owns shape and budgets. Workshop completion owns commitment to a reply. The highlight service owns placement and set identity. The host adapter owns diagnostic display and document lifetime. The webview requests Show or Clear by turn id and renders the host’s result.

| Runtime path | Expected behavior | Witness |
|---|---|---|
| Persona finishes a requested highlight | The scanner extracts one set, the room commits it, and a current open document gets applicable diagnostics | Mixed-frame and live-version tests |
| A writer clears, reopens or rewinds | Clear withdraws one set. Show resolves the retained record again. Rewind withdraws the removed turn’s set | Multi-set, close/reload and rewind tests |
| An old session is opened | Normal hydration accepts an absent highlights field | Authentic pre-feature fixture |

## Contracts and risks

| Dimension | Contract or consequence | Risk and verification |
|---|---|---|
| Structural | The highlight slice receives only annotation and document-read access | High. Extend the architecture boundary witness |
| Runtime | Settlement uses host-captured excerpt identity. A stale document version requires a fresh read before placement | High. Test editor changes during runs and before Show |
| Contract | The model supplies title, anchors and notes. The webview supplies turn identity. The host resolves the file and ranges | High. Reject unknown fields, unsupported shapes and stale identities |
| Persistence | The session shape adds optional highlight data using the same validator as incoming drafts. Rollback or rescue follows normal room/session paths | High. Verify old fixtures, current round trips and exact validation |
| Operations | The trailer and logs report only counts and closed reasons. Markers are transient | Moderate. Check malformed and streaming payload redaction |
| Coordination | Run completion, session shape, annotation boundaries and routes are shared integration points | Moderate. Land protocol and placement before lifecycle and presentation |
| Evolution | A new trailer adds a codec and an explicit scanner entry. A new host implements the existing read and annotation contracts | Low. Keep feature vocabulary in the feature modules |

Placement must reject ambiguous quotes, reversed or overlapping span endpoints and any range touching protected text. Explicit Show re-anchors the saved quotes. Per-set ownership prevents a document-level replacement from wiping other Workshop sets or resurrecting annotations that moved or were dismissed.

## Alternatives and self-review

| Candidate | Assessment |
|---|---|
| Append output to Craft Flags | Smaller patch. Shared replacement and clearing would violate set ownership |
| Separate Workshop collection through the existing port | Reuses tracking and keeps the annotation dependency narrow. Requires room-aware set lifecycle |
| Generic annotation or agent tool registry | Adds framework and consent semantics for a single feature |

**Re-plan verdict** REFINED. The initial plan used the current excerpt at display time. The final plan binds a set to the host’s excerpt identity at the run and uses that binding when showing it again. Workshop tabs and document version checks make both identities necessary. Exact VS Code navigation and presentation require a host smoke test.

The important failure cases are private data in partial frames, diagnostics attached to the wrong file after a tab switch, and an older set reappearing during replacement. The shared scanner must stay a framing registry, with feature shape outside it. Session restoration follows the existing reply codec and keeps transient editor state outside persistence. H0–H2 settle the feature decisions. Implementation can proceed in the order below.

## Implementation slices and fitness witnesses

1. Protocol and pure placement. Own the codec, trailer redaction and anchoring tests.
2. Completion, diagnostics and persistence. Own host binding, session validation, trailer outcomes, transcript count and annotation family isolation. Check the older fixture and architectural imports.
3. Set lifecycle, footer and help. Own Show, Clear, Clear all and rewind cleanup. Verify concurrent sets, reopening, and F8 in VS Code.

## Evidence and ADR seed

- [Observed] `extractWorkshopReplyControls` and `workshopReplyTrailerFrames` handle completed reply frames and shared redaction.
- [Observed] `WorkshopRunCompletion` settles trailer outcomes around the reply commit. `WorkshopSessionStateV1Shape` validates retained reply fields.
- [Observed] `anchorQuote`, `findProtectedRegions`, `IssueAnnotator` and `VsCodeIssueAnnotator` already cover the main placement and display primitives.
- [Proposed] Amend Draft Edit D10 to permit the Workshop highlight service to use a dedicated annotation family with read access to the target. Keep document writes on the existing Draft Edit boundary.
