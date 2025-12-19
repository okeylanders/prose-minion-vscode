# Sprint 01: Clickable Resource Pills Implementation

**Sprint**: 01
**Epic**: [Clickable Resource Pills](../epic-clickable-resource-pills.md)
**Start Date**: 2025-11-02
**Target Completion**: 2025-11-02
**Status**: In Progress
**Estimated Effort**: 1-2 hours

---

## Sprint Goal

Implement clickable resource pills in the Context Assistant by extending the UIHandler with OPEN_RESOURCE message type, updating AnalysisTab to post messages on click, and adding appropriate hover styles.

## User Stories

### US-1: Click Resource Pill to Open File
**As a** writer using the Context Assistant
**I want to** click on a resource pill
**So that** I can quickly navigate to the referenced file in VSCode

**Acceptance Criteria**:
- [ ] Clicking a resource pill opens the file in VSCode editor
- [ ] File opens in a new editor tab beside the current view
- [ ] Resource path is resolved relative to workspace root
- [ ] Works for all resource types (characters, locations, themes, etc.)

### US-2: Handle Missing Resources Gracefully
**As a** user
**I want** clear error messages when a resource doesn't exist
**So that** I understand what went wrong and can fix it

**Acceptance Criteria**:
- [ ] Clicking a non-existent resource shows error message
- [ ] Error message is user-friendly (not a stack trace)
- [ ] Extension doesn't crash or freeze
- [ ] Error logged to Output Channel for debugging

### US-3: Visual Feedback for Clickability
**As a** user
**I want** visual cues that resource pills are clickable
**So that** I know they're interactive elements

**Acceptance Criteria**:
- [ ] Cursor changes to pointer on hover
- [ ] Background/border changes on hover
- [ ] Style consistent with guide pills
- [ ] Keyboard accessible (Tab + Enter)

## Scope

### In Scope
1. Add `OPEN_RESOURCE` message type to `messages/ui.ts`
2. Update `MessageType` enum in `messages/base.ts`
3. Export new message types from `messages/index.ts`
4. Add `handleOpenResource` method to `UIHandler.ts`
5. Register `OPEN_RESOURCE` route in UIHandler
6. Update `AnalysisTab.tsx` to make resource pills clickable
7. Add CSS hover styles for clickable resource pills
8. Manual testing

### Out of Scope
- Automated tests (can be added in follow-up)
- Preview on hover
- Right-click context menu
- Resource usage statistics

## Tasks

### Backend (Message Layer)

#### Task 1: Add Message Type
**File**: `src/shared/types/messages/ui.ts`
- [ ] Add `OpenResourcePayload` interface
- [ ] Add `OpenResourceMessage` interface extending `MessageEnvelope<OpenResourcePayload>`

#### Task 2: Update Message Enum
**File**: `src/shared/types/messages/base.ts`
- [ ] Add `OPEN_RESOURCE = 'open_resource'` to `MessageType` enum

#### Task 3: Export Message Types
**File**: `src/shared/types/messages/index.ts`
- [ ] Export `OpenResourcePayload`
- [ ] Export `OpenResourceMessage`
- [ ] Add `OpenResourceMessage` to `ExtensionMessage` union

### Backend (Handler)

#### Task 4: Implement Handler
**File**: `src/application/handlers/domain/UIHandler.ts`
- [ ] Import `OpenResourceMessage` type
- [ ] Add `handleOpenResource(message: OpenResourceMessage): Promise<void>` method
- [ ] Implement workspace-relative path resolution
- [ ] Implement file existence check
- [ ] Implement file opening logic
- [ ] Implement error handling
- [ ] Register route in `registerRoutes` method

### Frontend (Component)

#### Task 5: Make Pills Clickable
**File**: `src/presentation/webview/components/AnalysisTab.tsx`
- [ ] Change resource pills from `<span>` to `<button>`
- [ ] Add `onClick` handler
- [ ] Post `OPEN_RESOURCE` message with envelope structure
- [ ] Add `title` attribute for accessibility
- [ ] Add `clickable` className

### Frontend (Styling)

#### Task 6: Add Hover Styles
**File**: `src/presentation/webview/index.css`
- [ ] Add `.context-resource-chip.clickable` selector
- [ ] Add `cursor: pointer`
- [ ] Add hover background/border changes
- [ ] Add transition for smooth animation
- [ ] Add active state (optional)

### Testing

#### Task 7: Manual Testing
- [ ] Click character resource → opens file
- [ ] Click location resource → opens file
- [ ] Click theme resource → opens file
- [ ] Click non-existent resource → shows error
- [ ] Verify hover states work
- [ ] Test keyboard navigation (Tab + Enter)
- [ ] Test in light theme
- [ ] Test in dark theme
- [ ] Verify guide pills still work

## Implementation Details

### Message Type Definition
```typescript
// src/shared/types/messages/ui.ts
export interface OpenResourcePayload {
  path: string; // workspace-relative path
}

export interface OpenResourceMessage extends MessageEnvelope<OpenResourcePayload> {
  type: MessageType.OPEN_RESOURCE;
}
```

### Handler Implementation
```typescript
// src/application/handlers/domain/UIHandler.ts
async handleOpenResource(message: OpenResourceMessage): Promise<void> {
  try {
    const { path } = message.payload;
    this.outputChannel.appendLine(`[UIHandler] Opening resource: ${path}`);

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRoot) {
      this.sendError('ui.resource', 'No workspace folder open');
      return;
    }

    const fileUri = vscode.Uri.joinPath(workspaceRoot, path);

    // Check file exists
    try {
      await vscode.workspace.fs.stat(fileUri);
    } catch {
      this.sendError('ui.resource', `Resource not found: ${path}`);
      return;
    }

    // Open file
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside
    });

    this.outputChannel.appendLine(`[UIHandler] Successfully opened: ${path}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    this.sendError('ui.resource', 'Failed to open resource', msg);
  }
}
```

### Frontend Click Handler
```typescript
// src/presentation/webview/components/AnalysisTab.tsx
{contextRequestedResources.map((path, index) => {
  const handleResourceClick = () => {
    vscode.postMessage({
      type: MessageType.OPEN_RESOURCE,
      source: 'webview.analysis.tab',
      payload: { path },
      timestamp: Date.now()
    });
  };

  return (
    <button
      key={`${path}-${index}`}
      className="context-resource-chip clickable"
      onClick={handleResourceClick}
      title={`Click to open ${path}`}
    >
      {path}
    </button>
  );
})}
```

### CSS Styling
```css
/* src/presentation/webview/index.css */
.context-resource-chip.clickable {
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.context-resource-chip.clickable:hover {
  background-color: var(--vscode-list-hoverBackground);
  border-color: var(--vscode-focusBorder);
}

.context-resource-chip.clickable:active {
  transform: translateY(1px);
}
```

## Acceptance Criteria

### Functional
- [ ] Resource pills open files when clicked
- [ ] Files open in editor beside current view
- [ ] Non-existent resources show error message
- [ ] Error messages are user-friendly
- [ ] No workspace open shows appropriate error

### Visual
- [ ] Cursor changes to pointer on hover
- [ ] Hover state shows visual feedback
- [ ] Style consistent with guide pills
- [ ] Works in light and dark themes

### Technical
- [ ] No TypeScript compilation errors
- [ ] Build succeeds
- [ ] No console errors in webview
- [ ] Output Channel logs resource operations
- [ ] Guide pills still work correctly (no regression)

### Accessibility
- [ ] Keyboard navigation works (Tab to focus)
- [ ] Enter key opens resource
- [ ] Title attribute provides context
- [ ] Screen reader compatible (button element)

## Related ADRs

- [ADR: Clickable Resource Pills (2025-11-02)](../../../../docs/adr/2025-11-02-clickable-resource-pills.md)

## Related Architecture Docs

- [Presentation Layer Review](../../../../.memory-bank/20251102-presentation-layer-architectural-review.md)
- [Message Architecture Refactor](../../../../.memory-bank/20251026-2130-message-architecture-refactor.md)

## Definition of Done

- [ ] All tasks completed
- [ ] All acceptance criteria met
- [ ] Manual testing checklist passed
- [ ] No TypeScript errors
- [ ] Build successful
- [ ] No regressions (guide pills work)
- [ ] Code follows Clean Architecture patterns
- [ ] Sprint retrospective completed

## Sprint Retrospective

_(To be filled after completion)_

### What Went Well
- TBD

### What Could Be Improved
- TBD

### Lessons Learned
- TBD

### Blockers Encountered
- TBD

### Time Tracking
- **Estimated**: 1-2 hours
- **Actual**: TBD
- **Variance**: TBD

---

**Sprint Status**: 🟡 In Progress
**Next Action**: Begin implementation with message type definition
**Blocked**: No
**Last Updated**: 2025-11-02
