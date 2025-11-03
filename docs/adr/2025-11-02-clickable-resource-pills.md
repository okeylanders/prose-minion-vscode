# ADR: Clickable Resource Pills in Context Assistant

**Date**: 2025-11-02
**Status**: Accepted
**Implemented**: Complete (PR #15)
**Implementation Date**: 2025-11-02
**Priority**: MEDIUM (v1.0 Polish)
**Epic**: Clickable Resource Pills
**Sprint**: 01-clickable-resource-pills

## Context

The Context Assistant displays two types of pills/tags in the Analysis tab:
1. **Guide pills** - Clickable, opens craft guides in VSCode editor
2. **Resource pills** - NOT clickable, purely informational

This creates an inconsistent UX where users expect all pills to be interactive, but resource pills are static.

### Current State

**Guide Pills** (Clickable):
```tsx
<button
  className="guide-tag"
  onClick={() => vscode.postMessage({
    type: MessageType.OPEN_GUIDE_FILE,
    payload: { guidePath: guide }
  })}
>
  {displayName}
</button>
```

**Resource Pills** (Not Clickable):
```tsx
<span className="context-resource-chip">
  {path}
</span>
```

## Problem

1. **Inconsistent UX** - Some pills are clickable, others aren't
2. **Limited Discoverability** - Users can't easily navigate to referenced resources
3. **Manual Workflow** - Users must manually search for resources mentioned in context
4. **Missed Opportunity** - Resources are already tracked, but not leveraged for navigation

## Decision

Make resource pills clickable with the same interaction pattern as guide pills:
- Clicking a resource pill opens the file in VSCode editor
- Uses workspace-relative path resolution
- Provides error handling for missing files
- Maintains consistent visual affordances (hover states, cursor)

## Solution

### 1. New Message Type

Add `OPEN_RESOURCE` message type following the established message domain pattern:

```typescript
// src/shared/types/messages/ui.ts
export interface OpenResourcePayload {
  path: string; // workspace-relative path
}

export interface OpenResourceMessage extends MessageEnvelope<OpenResourcePayload> {
  type: MessageType.OPEN_RESOURCE;
}
```

### 2. Backend Handler

Extend `UIHandler` to handle resource opening (mirrors existing `handleOpenGuideFile`):

```typescript
// src/application/handlers/domain/UIHandler.ts
async handleOpenResource(message: OpenResourceMessage): Promise<void> {
  const { path } = message.payload;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  if (!workspaceRoot) {
    this.sendError('ui.resource', 'No workspace folder open');
    return;
  }

  const fileUri = vscode.Uri.joinPath(workspaceRoot, path);

  try {
    await vscode.workspace.fs.stat(fileUri); // Check existence
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside
    });
  } catch (error) {
    this.sendError('ui.resource', `Could not open resource: ${path}`);
  }
}
```

### 3. Frontend Update

Change resource pills from `<span>` to `<button>` with onClick handler:

```tsx
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

### 4. Styling

Add hover states and cursor changes:

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

## Architecture Alignment

This solution follows established patterns from the presentation layer refactor:

### Clean Architecture Adherence ✅

1. **Domain Separation**
   - UI domain handler owns resource opening logic
   - Message contracts in shared types
   - Frontend components send messages, backend performs actions

2. **Message Envelope Pattern**
   - Uses standard envelope structure (type, source, payload, timestamp)
   - Source tracking: `webview.analysis.tab` → `extension.ui`
   - Consistent with existing `OPEN_GUIDE_FILE` message

3. **Single Responsibility**
   - UIHandler is responsible for all file opening operations
   - AnalysisTab handles rendering and user interaction
   - Clear separation of concerns

4. **Open/Closed Principle**
   - Extends UIHandler without modifying existing functionality
   - Adds new message type without changing routing structure
   - New handler registered alongside existing handlers

## Implementation Approach

1. Add message type to `messages/ui.ts`
2. Update `MessageType` enum in `messages/base.ts`
3. Export new types from `messages/index.ts`
4. Add handler in `UIHandler.ts` and register route
5. Update `AnalysisTab.tsx` to make pills clickable
6. Add CSS hover states

## Benefits

1. **Consistent UX** - All pills now follow the same interaction pattern
2. **Improved Navigation** - One click to open referenced resources
3. **Better Discoverability** - Users can explore context resources easily
4. **Minimal Complexity** - Reuses existing patterns (OPEN_GUIDE_FILE)
5. **Keyboard Accessible** - Button elements support Tab + Enter

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Resource path doesn't exist | Error handling with user-friendly message |
| No workspace open | Check for workspace before resolving paths |
| User confusion about clickability | Visual hover states and cursor changes |
| Breaking existing UI | Only changes presentation, not data flow |

## Testing Checklist

- [ ] Click character resource → opens file
- [ ] Click location resource → opens file
- [ ] Click theme resource → opens file
- [ ] Click non-existent resource → shows error gracefully
- [ ] Hover shows visual feedback (cursor, highlight)
- [ ] Keyboard navigation works (Tab + Enter)
- [ ] Works in light and dark themes
- [ ] Guide pills still work correctly

## Architecture Debt

None. This implementation follows existing patterns and doesn't introduce technical debt.

## Alternatives Considered

### 1. Show Preview in Webview
- **Pros**: Keeps user in Prose Minion UI
- **Cons**: More complex, requires modal/preview component
- **Decision**: Rejected - Opening in editor is simpler and more useful

### 2. Copy Path to Clipboard
- **Pros**: Easiest to implement
- **Cons**: Least useful, doesn't solve navigation problem
- **Decision**: Rejected - Doesn't provide real value

### 3. Right-Click Context Menu
- **Pros**: Multiple actions available
- **Cons**: More complex, less discoverable
- **Decision**: Deferred to v1.1+ as enhancement

## Future Enhancements (v1.1+)

- Preview on hover (tooltip with first few lines)
- Right-click menu: "Open", "Copy Path", "Exclude from Context"
- Visual indicator of which resources were included in prompt
- Resource usage statistics

## Acceptance Criteria

- [ ] Resource pills are visually clickable (cursor: pointer on hover)
- [ ] Clicking resource pill opens file in editor beside current view
- [ ] Error handling for missing files shows user-friendly message
- [ ] Consistent UX with guide pills (hover states, keyboard support)
- [ ] Works in both light and dark themes
- [ ] No regression in guide pill functionality
- [ ] Build passes with no TypeScript errors

## References

- Related Feature: Guide pills ([AnalysisTab.tsx](../../src/presentation/webview/components/AnalysisTab.tsx):423-432)
- Pattern: [UIHandler.ts](../../src/application/handlers/domain/UIHandler.ts):66-107 (`handleOpenGuideFile`)
- Architecture: [Presentation Layer Review](../../.memory-bank/20251102-presentation-layer-architectural-review.md)
- Epic: `.todo/epics/epic-clickable-resource-pills-2025-11-02/`

## Success Metrics

- Users can navigate to context resources with single click
- Consistent interaction pattern across all pill types
- Zero confusion about which elements are interactive
- No user-reported issues with resource navigation
