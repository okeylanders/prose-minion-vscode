# Slice 4a: Settings Panels

**Epic:** [Workshop Project Memory](README.md)
**Feature:** [The settings tab](../../features/feature-workshop-project-memory/README.md#the-settings-tab)
**Status:** Built and verified on `epic/workshop-project-memory-slice-4a-settings-panels` (cut from the epic at `8fb016f`). See [Built](#built).

## Outcome

Conversation settings was one 587-line component, past the 500-line limit in
the anti-pattern checklist. It is now a modal shell plus one component per tab
panel. The tab strip and its keys are driven by one ordered list, so Slice 4b's
Memory tab is one entry plus one panel. Behavior is unchanged, and no Memory tab
is added.

## Scope

- **The modal shell** keeps:
  - the tab strip and its arrow-key navigation;
  - the three drafts;
  - the pending apply and its settle, cancel and error rules;
  - the About you clear confirmation (see Deviations);
  - the footer.
- **One component per panel:** Behavior, About you and Advanced.
- **Unchanged:** behavior, markup, class names, ids, ARIA attributes and copy.
  Every existing test passes as it was.

## Built

**Commits.**

- `6a345c8`: the split (shell, panels, shared controls and the tab list).
- `0466d24`: the tab list's key-navigation test. The helper became generic over
  the tab id so the test can use a four-tab list.
- `72f7e42`: a lint brace in the helper.

**Where each piece lives.** The panels sit in their own folder, as the persona
schematic modal's parts do (`components/workshop/schematic/`). The modal stays
at its path, so `WorkshopApp`, `WorkshopComposer` and the modal's test import it
unchanged.

| Piece | Where |
|---|---|
| Shell | `components/workshop/WorkshopConversationBehaviorModal.tsx` |
| Ordered tab list and key helper | `components/workshop/settings/workshopConversationSettingsTabs.ts` (`WORKSHOP_CONVERSATION_SETTINGS_TABS`, `workshopConversationSettingsTabForKey`) |
| Behavior panel (with its card tables and expression glyph) | `settings/WorkshopBehaviorSettingsPanel.tsx` |
| About you panel | `settings/WorkshopAboutYouSettingsPanel.tsx` |
| Advanced panel | `settings/WorkshopAdvancedSettingsPanel.tsx` |
| Shared rule, option card and switch | `settings/WorkshopConversationSettingsControls.tsx` |

**How a tab is added (Slice 4b).** Each entry in the list carries:

- `id` and `label`;
- `tabElementId` and `panelElementId`, the ARIA wiring;
- the panel's `panelClassName`.

The shell renders the strip and the single `role="tabpanel"` wrapper from the
active entry. Home and End go to the list's ends, and the arrows wrap through it.
Focus moves through a ref map keyed by id. Panels are a
`Record<WorkshopConversationSettingsTab, …>`, so a new id doesn't compile without
its panel.

The Memory tab therefore needs four things:

- its id in the union;
- one entry in the list, between `profile` and `advanced`;
- one panel;
- one record entry.

The footer copy changes separately, per the feature note.

**File sizes.**

| File | Before | After |
|---|---|---|
| `WorkshopConversationBehaviorModal.tsx` | 587 | 234 |
| `settings/WorkshopBehaviorSettingsPanel.tsx` | — | 186 |
| `settings/WorkshopAboutYouSettingsPanel.tsx` | — | 142 |
| `settings/workshopConversationSettingsTabs.ts` | — | 68 |
| `settings/WorkshopConversationSettingsControls.tsx` | — | 63 |
| `settings/WorkshopAdvancedSettingsPanel.tsx` | — | 32 |

## Verification

| Check | Before (`8fb016f`) | After (`72f7e42`) |
|---|---|---|
| `npm run typecheck` | pass | pass |
| `npx jest` | 636 suites / 8,977 tests / 59 snapshots | 637 suites / 8,982 tests / 59 snapshots |
| `npm run lint` | 0 errors / 1,153 warnings | 0 errors / 1,156 warnings |

- **Tests.** The new suite is
  `__tests__/presentation/webview/components/workshop/settings/workshopConversationSettingsTabs.test.ts`
  (5 tests). It covers:
  - the order and that ids are distinct;
  - arrow wrap, Home and End;
  - keys the strip ignores;
  - a four-tab list with `memory` between `profile` and `advanced`, which moves
    with no other change;
  - an empty list.
- **Existing tests.** `WorkshopConversationBehaviorModal.test.tsx` and
  `WorkshopComposer.test.tsx` touch the modal, its ids or its copy. Both pass
  unedited.
- **Parity check (not committed).** A throwaway harness rendered the original
  587-line modal and the split one through 13 scripted states, each with
  `isRunning` false and true. Their dialog DOM and focused element matched
  exactly. The states were:
  - every tab;
  - every key, including a full wrap;
  - clear-confirm, then reselecting About you, and Clear;
  - apply (pending);
  - toggling web research.
- **New lint warnings (3),** all PascalCase `naming-convention` on new
  components: `WorkshopBehaviorSettingsPanel`, `WorkshopAboutYouSettingsPanel`
  and `WorkshopAdvancedSettingsPanel`. The other component warnings
  (`SettingsRule`, `OptionCard`, `Switch`, `ExpressionGlyph`) and the shell's
  `curly` warnings moved with their code; they aren't new.
- No `from 'vscode'` in `packages/core/src` (only the guard tests' strings). No
  file over 500 lines.

## Deviations

- **The clear confirmation stays in the shell.** Moving it into the About you
  panel would be tidier, but the original resets it in `switchTab`. That reset
  includes clicking the tab that's already active, and panel-local state would
  survive such a click. The panel takes `confirmClear` and
  `onConfirmClearChange` as props instead.
- **One tabpanel wrapper, owned by the shell.** The panels render their contents
  only, and the shell draws the `role="tabpanel"` div from the active entry.
  This keeps all ARIA wiring in the list. It matches the original's DOM reuse:
  one `<div>` in the same slot, now with no key.
- **The key helper is generic** (`<Tab extends string>`) so the test can show a
  longer list; the modal calls it with the real list.
