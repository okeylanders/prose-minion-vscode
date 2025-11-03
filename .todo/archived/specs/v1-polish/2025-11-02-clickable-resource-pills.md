# Clickable Resource Pills in Context Assistant

**Date**: 2025-11-02
**Priority**: MEDIUM (UX Polish)
**Status**: Planned
**Estimated Time**: 1-2 hours

## Problem

In the Context Assistant UI:
- **Guide request pills** are clickable (opens guide in preview?)
- **Resource pills** (characters, locations, etc.) are NOT clickable
- Inconsistent UX - users expect pills to be interactive

## Solution

Make resource pills clickable with same interaction pattern as guide pills.

### Current Behavior (Guide Pills)

Clicking a guide pill presumably:
- Opens the guide file in VSCode editor, OR
- Shows guide preview in webview, OR
- Copies path to clipboard

**TODO**: Verify current guide pill behavior before implementing resource pills

### Proposed Behavior (Resource Pills)

**Option 1: Open in Editor** (Recommended)
- Click resource pill → Opens file in VSCode editor
- Allows user to read/edit the resource
- Most intuitive for file-based resources

**Option 2: Show Preview**
- Click resource pill → Shows file contents in webview modal
- Keeps user in Prose Minion UI
- Good for quick reference, but more complex

**Option 3: Copy Path**
- Click resource pill → Copies file path to clipboard
- Least useful, but easiest to implement

**Recommendation**: Match guide pill behavior exactly for consistency

### Implementation

#### 1. Verify Guide Pill Behavior

Check how guide pills currently work:
- `src/presentation/webview/components/UtilitiesTab.tsx` - Context UI rendering
- Look for onClick handlers on guide pills
- Document exact behavior

#### 2. Add Resource Pill Click Handlers

Update Context UI to make resource pills clickable:

```tsx
// Example implementation (adjust based on guide pill pattern)
const handleResourceClick = (resourcePath: string) => {
  vscode.postMessage({
    type: MessageType.OPEN_RESOURCE,
    source: 'webview.context.assistant',
    payload: { path: resourcePath },
    timestamp: Date.now()
  });
};

// In render:
{resources.map(resource => (
  <span
    key={resource.path}
    className="resource-pill clickable"
    onClick={() => handleResourceClick(resource.path)}
    title={`Open ${resource.path}`}
  >
    {resource.name}
  </span>
))}
```

#### 3. Backend Handler

Add message handler for opening resources:

```typescript
// In MessageHandler or UIHandler
case MessageType.OPEN_RESOURCE:
  const { path } = message.payload;
  await this.openResourceFile(path);
  break;

private async openResourceFile(relativePath: string): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const fileUri = vscode.Uri.joinPath(workspaceRoot, relativePath);

  try {
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Could not open resource: ${relativePath}`);
    this.outputChannel.appendLine(`Error opening resource: ${error}`);
  }
}
```

## Affected Files

### Frontend
- `src/presentation/webview/components/UtilitiesTab.tsx`
  - Add onClick handlers to resource pills
  - Match guide pill styling (hover states, cursor)

- `src/presentation/webview/hooks/domain/useContext.ts`
  - Maybe add `openResource` action (if needed)

### Backend
- `src/application/handlers/domain/UIHandler.ts` (or MessageHandler)
  - Add `OPEN_RESOURCE` message handler
  - Implement file opening logic

### Shared
- `src/shared/types/messages/ui.ts`
  - Add `OpenResourceMessage` interface:

```typescript
export interface OpenResourcePayload {
  path: string;
}

export interface OpenResourceMessage extends MessageEnvelope<OpenResourcePayload> {
  type: MessageType.OPEN_RESOURCE;
}
```

### CSS
- `src/presentation/webview/styles/index.css`
  - Ensure resource pills have:
    - Hover state (pointer cursor, slight highlight)
    - Active/clicked state
    - Consistent with guide pills

## Testing Checklist

- [ ] Verify guide pill click behavior first
- [ ] Implement matching behavior for resource pills
- [ ] Test clicking character resource → opens file
- [ ] Test clicking location resource → opens file
- [ ] Test clicking theme resource → opens file
- [ ] Test clicking non-existent resource → shows error (gracefully)
- [ ] Verify hover states work (cursor changes)
- [ ] Check keyboard accessibility (Tab + Enter)
- [ ] Test in both light and dark themes

## Acceptance Criteria

- [ ] Resource pills are visually clickable (cursor: pointer on hover)
- [ ] Clicking resource pill opens file in editor (or matches guide behavior)
- [ ] Error handling for missing files
- [ ] Consistent UX with guide pills
- [ ] Keyboard accessible
- [ ] Works in both themes

## Questions to Answer

1. **What do guide pills currently do when clicked?**
   - Need to verify before implementing

2. **Should all resource types be clickable?**
   - Characters: Yes
   - Locations: Yes
   - Themes: Yes
   - Things: Yes
   - Chapters: Yes
   - Manuscript: Yes
   - Project Brief: Yes
   - General: Yes

3. **What if resource is from a glob match?**
   - Ensure path is always workspace-relative
   - Handle edge cases

4. **Should we show which resources were used?**
   - Currently shows resource pills
   - Clicking opens them
   - Maybe add icon to indicate "used in context"

## Future Enhancements (v1.1+)

- [ ] Show preview on hover (tooltip with first few lines)
- [ ] Right-click menu: "Open", "Copy Path", "Exclude from Context"
- [ ] Visual indicator of which resources were actually included in prompt
- [ ] Resource usage statistics (how often each is used)

## Success Metrics

- Users can quickly navigate to referenced resources
- Consistent interaction pattern across all pills
- No confusion about which pills are clickable
