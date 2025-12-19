# Sprint 03: Dictionary UX Improvements

**Epic**: [UX Polish](../epic-ux-polish.md)
**Status**: Ready
**Duration**: 1 hour
**Priority**: HIGH

---

## Problem

User feedback from GitHub:

> "Command Palette > 'Prose Minion: Lookup Word' does not automatically trigger the dictionary to run; it only populates the Target Word box; 'Generate Dictionary Entry' needs to be clicked manually. That's a confusing UI flow."

Additionally, button labels are confusing:
- "Generate Dictionary Entry" sounds like creating a new entry
- Users expect "lookup" or "search" terminology for a dictionary

---

## Solution

### 1. Rename Buttons

| Current | New |
|---------|-----|
| Generate Dictionary Entry | Run Dictionary Lookup |
| ⚡ Fast Generate (Experimental) | ⚡ Experimental: Run Dictionary Lookup [Fast] |

### 2. Auto-Run on Command Palette

When user triggers `prose-minion.wordLookupSelection` from Command Palette:
1. Populate word field (current behavior)
2. **Auto-trigger fast dictionary lookup** (new)
3. Show toast notification: "Running dictionary lookup for '[word]'..."

### 3. Toast Notification

Use VSCode's `showInformationMessage` to notify user that lookup is starting.

---

## Tasks

### Part 1: Rename Buttons (15 min)

- [ ] Update UtilitiesTab.tsx button labels
- [ ] Update button titles/tooltips
- [ ] Verify visual appearance

### Part 2: Auto-Run Implementation (30 min)

- [ ] Add `autoRun` flag to selection payload
- [ ] Update ProseToolsViewProvider to pass `autoRun` to webview
- [ ] Update UtilitiesTab to detect `autoRun` and trigger fast lookup
- [ ] Add useEffect to handle auto-run when injection has flag

### Part 3: Toast Notification (15 min)

- [ ] Show toast when auto-run triggers
- [ ] Toast message: "Running dictionary lookup for '[word]'..."
- [ ] Toast appears briefly (auto-dismiss)

---

## Implementation Details

### UtilitiesTab.tsx - Button Labels

```tsx
<button
  className="btn btn-primary"
  onClick={handleLookup}
  disabled={!dictionary.word.trim() || dictionary.loading || dictionary.isFastGenerating}
>
  Run Dictionary Lookup
</button>
<button
  className="btn btn-secondary"
  onClick={handleFastGenerate}
  disabled={!dictionary.word.trim() || dictionary.loading || dictionary.isFastGenerating}
  title="Experimental: Generate using parallel API calls (2-4× faster)"
>
  ⚡ Experimental: Run Dictionary Lookup [Fast]
</button>
```

### extension.ts - Add autoRun Flag

```typescript
const handleWordLookupSelection = () => {
  const payload = getSelectionPayload();
  if (!payload) {
    return;
  }
  // Show toast notification
  vscode.window.showInformationMessage(
    `Running dictionary lookup for "${payload.text.split(/\s+/)[0]}"...`
  );
  sendSelection('dictionary', payload, true); // true = autoRun
};

const sendSelection = (
  target: 'assistant' | 'dictionary',
  payload: { text: string; uri: vscode.Uri; relativePath: string },
  autoRun: boolean = false
) => {
  proseToolsViewProvider?.sendSelectionToWebview({
    text: payload.text,
    sourceUri: payload.uri.toString(),
    relativePath: payload.relativePath,
    target,
    autoRun
  });
  focusToolsView();
};
```

### UtilitiesTab.tsx - Auto-Run Effect

```tsx
// Handle auto-run when injection comes with autoRun flag
React.useEffect(() => {
  const injection = selection.dictionaryInjection;
  if (!injection?.autoRun) {
    return;
  }

  // Small delay to ensure word is populated
  const timer = setTimeout(() => {
    if (dictionary.word.trim()) {
      handleFastGenerate();
    }
  }, 100);

  return () => clearTimeout(timer);
}, [selection.dictionaryInjection?.autoRun, dictionary.word]);
```

---

## Files to Update

```
src/presentation/webview/components/tabs/UtilitiesTab.tsx
src/extension.ts
src/application/providers/ProseToolsViewProvider.ts (if needed for types)
src/presentation/webview/hooks/domain/useSelection.ts (if needed for types)
```

---

## Acceptance Criteria

- [ ] Button says "Run Dictionary Lookup" (primary)
- [ ] Button says "⚡ Experimental: Run Dictionary Lookup [Fast]" (secondary)
- [ ] Command Palette "Word Lookup" auto-runs fast lookup
- [ ] Toast notification appears: "Running dictionary lookup for '[word]'..."
- [ ] Manual click still works as before
- [ ] All tests pass
- [ ] Build succeeds

---

## Testing Checklist

- [ ] Click "Run Dictionary Lookup" → works normally
- [ ] Click "⚡ Experimental..." → works normally
- [ ] Select word in editor → Command Palette → "Word Lookup" → auto-runs fast lookup
- [ ] Toast notification visible
- [ ] Lookup results appear without additional clicks

---

**Created**: 2025-11-24
