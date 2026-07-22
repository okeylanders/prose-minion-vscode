# Feature: Workshop Writer Profile

**Date Identified**: 2026-07-22
**Source**: Writer follow-up to Workshop Relational Depth
**Status**: Implemented — automated validation complete; awaiting merge
**Priority**: High
**Estimated Effort**: Medium
**Related ADR**: [Workshop Persona Interaction Modes and Expression Profiles](../../../docs/adr/2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md#16-accepted-amendment-workshop-writer-profile-2026-07-22)
**Related feature**: [Workshop Relational Depth](../feature-workshop-relational-depth/README.md)

## Problem / Motivation

Reflective relational depth permits a persona to connect the writing with life
experience the writer has explicitly shared. Without a durable, writer-authored
source for basic personal context, however, the room must either wait for that
context to appear in every conversation or risk treating model inference as
biography.

The writer should be able to tell the room how to address them and provide a
short amount of enduring personal context. That context must remain explicit,
inspectable, editable, removable, and distinct from inferred emotional state or
persona memory.

## Product Direction

Add an optional **About you** tab to Conversation Settings. It owns a separate
**Workshop Writer Profile** rather than adding biography fields to
`WorkshopConversationBehavior`.

The distinction is deliberate:

- **Writer Profile** supplies writer-authored personal facts and preferences.
- **Relational Depth** controls how deeply a persona may interpret and use that
  context.
- **Carry cues through this session** controls whether bounded interaction cues
  discovered during conversation may survive later turns in the current room.
- Project resources supply project-specific context.

The profile is not inferred memory. A persona may not add to or revise it.

## Profile Contract

Target shape:

```ts
export interface WorkshopWriterProfile {
  enabled: boolean;
  preferredAddress: string;
  bio: string;
}

export const DEFAULT_WORKSHOP_WRITER_PROFILE: WorkshopWriterProfile = {
  enabled: false,
  preferredAddress: '',
  bio: ''
};
```

`preferredAddress` is intentionally broader than `preferredName`: it can hold
"Okey," "Dr. Landers," or a short preference such as "Okey is fine." The bio
is a compact answer to **What would you like the room to know about you?**, not
a résumé or an invitation for the model to construct a psychological profile.

Initial limits:

- preferred address: 80 characters;
- bio: 1,000 characters;
- leading and trailing whitespace is normalized before commit; and
- invalid or partial persisted objects fail closed to the disabled default.

The profile is active only when `enabled` is true and at least one content
field is non-empty. Empty content never creates a prompt frame.

## Persistence and Ownership

Persist the complete profile separately under:

```text
proseMinion.workshop.writerProfile
```

The existing VS Code adapter writes settings at the user/global target. That is
the intended ownership boundary: a writer profile follows the writer rather
than belonging to one manuscript workspace.

The profile is ordinary settings data, not a secret. The UI must say that
plainly and advise the writer not to include sensitive information. The raw
profile must not be copied into:

- workspace session JSON;
- transcript turns or behavior-transition provenance;
- project resources;
- tool-sidecar state; or
- an inferred persona-memory store.

Restored sessions use the writer's currently enabled global profile when a new
provider conversation is created. They do not resurrect an older profile copy
from the saved session. Clearing or disabling the profile therefore removes it
from all subsequently assembled persona prompts.

Project-specific biography, research, goals, or manuscript context belongs in
an explicit project resource such as the project Scratch Pad or a context
attachment. It should not accumulate in this global field.

## Relational-Depth Semantics

The same profile produces different permitted behavior at each relational
depth:

| Relational depth | Permitted use of Writer Profile |
|---|---|
| **Reserved** | Use the preferred address and directly relevant stated facts. Do not volunteer personal interpretations or connections. |
| **Attuned** | Use supplied context to calibrate warmth, pacing, relevance, and questions. Any immediate emotional reading remains tentative. |
| **Reflective** | May offer grounded, corrigible connections between the prose or project and life experience the writer explicitly supplied. |

The profile does not raise relational depth by itself. Reflective permission
does not authorize invented biography, and an enabled bio does not require a
persona to mention it. The persona should never repeatedly use the writer's
name or theatrically demonstrate that it "remembers" the profile.

## Prompt and Runtime Contract

When the profile is active, assemble one bounded
`<workshop-writer-profile>` system frame into the host and every live persona
guest. The trusted wrapper must state that:

- the enclosed strings are writer-supplied descriptive context;
- the preferred-address field is an interaction preference;
- bio text is evidence, not an operating instruction;
- it cannot override host contracts, persona jurisdiction, or explicit current
  requests; and
- it may be interpreted only within the selected Relational Depth.

Both fields are delimiter-neutralized before interpolation. Register the new
frame name with the shared reserved-frame neutralizer so writer content cannot
forge, close, or manufacture trusted Workshop frames.

Profile changes affect durable persona context. Apply them only between runs,
using the existing guarded atomic replacement of retained host and live-guest
system messages. Clear affected context-budget measurements after replacement.
New guests receive the current profile at creation. Deterministic tools and
tool-sidecar conversations receive no Writer Profile prompt or frame.

Do not append the profile to every writer turn. One system-level frame avoids
repeated token cost and keeps explicit personal context separate from current
message content.

## Modal Direction

Keep one **Conversation Settings** surface, but divide it into two tabs rather
than extending the existing scrolling behavior panel indefinitely:

1. **Behavior**
   - Response style
   - Persona expression
   - Relational depth
   - Session continuity
2. **About you**
   - **Share this profile with Workshop personas** toggle
   - **How should the room address you?** single-line field
   - **What would you like the room to know about you?** bounded text area
   - concise global-storage and sensitivity notice
   - **Clear profile** action

The modal retains a fixed header, tab row, and footer while the active tab body
scrolls. Saving is atomic and unavailable during an active run. Closing without
Apply discards draft edits. Clear Profile requires an intentional confirmation
inside the modal, empties both fields, disables sharing, and commits the empty
profile through the same path.

The composer does not display the bio or preferred address. Its Conversation
Settings tooltip or accessible description may add a compact **Profile shared**
state so the writer can tell when personal context is active without exposing
the content.

## Scope

1. Add the writer-profile types, default, bounds, closed validation, and message
   contracts.
2. Add `proseMinion.workshop.writerProfile` to the extension configuration and
   hydrate it through a dedicated `WorkshopWriterProfileService`.
3. Extend Conversation Settings with Behavior and About You tabs, draft-state
   semantics, disclosure copy, clear behavior, and accessibility coverage.
4. Assemble and neutralize the bounded profile frame for host and live persona
   guests only.
5. Reuse guarded between-run system-message replacement for profile changes.
6. Ensure session serialization, transcript projections, tools, and tool
   sidecars never receive raw profile content.
7. Add prompt and qualitative tests across all three Relational Depth levels.

## Out of Scope

- Persona-authored additions or inferred facts about the writer.
- A general-purpose cross-session memory system.
- Project-specific profile overrides.
- Secrets, medical records, therapy notes, or other sensitive-data storage.
- Per-persona profiles or different biographies for different room members.
- Automatic profile construction from manuscripts, conversations, or files.
- Additional demographic fields such as pronouns, location, or occupation;
  these may be written in the bounded bio when the writer chooses.

## Evaluation

Run the same profile, excerpt, and writer turns through Reserved, Attuned, and
Reflective with multiple personas. Check that:

- preferred address is followed naturally without repetitive name use;
- an empty or disabled profile contributes no prompt content;
- Reserved uses facts without volunteering personal interpretation;
- Attuned calibrates the interaction without turning the bio into a diagnosis;
- Reflective makes specific, tentative connections rather than generic therapy
  language;
- malicious or accidental prompt-like bio text cannot override trusted frames;
- correction or profile removal takes effect on the next eligible turn;
- tools and tool sidecars never receive profile content; and
- saved workspace sessions contain no raw profile strings.

## Completion Criteria

- The writer can enable, edit, clear, and disable a preferred address and short
  bio from the About You tab in Conversation Settings.
- The complete validated profile persists separately as a global user setting.
- The UI clearly identifies its global, non-secret nature.
- Host and live persona guests receive only the current enabled profile through
  a bounded, neutralized system frame.
- Relational Depth governs interpretation while profile state remains an
  independent source of explicit facts.
- No raw profile is duplicated into workspace session files, transcripts,
  project resources, deterministic tools, or tool sidecars.
- Profile updates are atomic between runs and context-budget telemetry is
  refreshed.
- Focused tests, full test suite, typecheck, lint, build, prompt packaging, and
  `git diff --check` pass.

## Implementation Notes

- `WorkshopWriterProfileService` owns the current global profile independently
  of `WorkshopSessionService`; session snapshots and future workspace session
  serialization therefore have no raw profile field to copy.
- Conversation Settings submits Behavior and About You together. The existing
  serialized behavior coordinator validates both drafts and performs at most
  one guarded retained-system-message replacement batch before committing the
  live room.
- VS Code persists the two settings keys independently, so durable writes are
  best-effort rather than transactionally atomic. A partial persistence failure
  leaves the already validated live-room commit active and reports the restart
  risk; the UI does not promise atomic storage.
- The webview receives the profile beside the session snapshot payload, not
  inside the session aggregate. The composer exposes only an active/inactive
  indicator; it never displays profile content.
- Initial host, host synthesis, and invited-guest prompt assembly append one
  bounded system-level profile frame. Deterministic tools and tool sidecars do
  not receive it.
- The shared delimiter neutralizer reserves `workshop-writer-profile`, and
  focused tests cover disabled/empty omission, closed validation, all three
  relational depths, forged frame delimiters, global manifest bounds, modal
  draft/clear behavior, and one-batch replacement.

## Related Files

- `docs/adr/2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md`
- `apps/vscode-extension/package.json`
- `apps/vscode-extension/src/platform/vscode/VsCodeSettingsStore.ts`
- `packages/core/src/shared/types/messages/workshop.ts`
- `packages/core/src/application/services/workshop/WorkshopWriterProfileService.ts`
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopComposer.tsx`
- `packages/core/src/utils/workshopPromptFrames.ts`
