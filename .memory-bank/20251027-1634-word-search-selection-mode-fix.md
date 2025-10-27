# Memory Note — Word Search Selection Mode Fix

Date: 2025-10-27 16:34

## Summary

Fixed critical bug where Word Search ignored selection mode and always searched entire files instead of just selected text. The issue was Word Search using underscored (ignored) parameters and reading files from disk rather than using the provided text parameter like other metrics tools.

## Problem Discovery

User reported Search was "wonky" - it worked intermittently in selection mode. Initial hypothesis was stale cached text from refactor, but deeper investigation revealed the real issue.

### Investigation Process

1. **Initial misdiagnosis**: Thought the issue was stale `selectedText` being cached in webview state
2. **Added diagnostic logging**: Backend Output channel logging in SearchHandler
3. **Key finding**: Logs showed backend WAS receiving correct selection (e.g., 281 chars), but Search still found matches outside that selection
4. **Root cause discovered**: Word Search implementation ignored the `text` parameter entirely

### The Smoking Gun

Output logs showed:
```
[SearchHandler] Resolved to:
  mode: selection
  text length: 356 chars
  text preview: "Jasper and Nate had been best friends..."
  paths: Drafts/chapter-1.4.md
```

But Search results showed matches on line 15 containing "pallor" - a word NOT in the 356-char selection. This proved Search was reading the whole file from disk despite receiving the correct selection.

## Root Cause

**File**: `src/infrastructure/api/ProseAnalysisService.ts:364`

Word Search method signature had underscored parameters (convention for intentionally unused params):

```typescript
async measureWordSearch(
  _text: string,        // ← IGNORED!
  files?: string[],
  _sourceMode?: string, // ← IGNORED!
  options?: { ... }
)
```

The implementation:
1. Ignored the `text` parameter (your selection)
2. Always looped through `files[]` array
3. Read each file from disk with `vscode.workspace.fs.readFile(uri)`
4. Searched the entire file content

This was fundamentally different from how other metrics work (`measureStyleFlags`, `measureWordFrequency`) which DO use the text parameter.

## The Fix

### Change 1: Remove Underscore Prefixes (Use Parameters)

```typescript
async measureWordSearch(
  text: string,      // ← Now USED, not ignored
  files?: string[],
  sourceMode?: string, // ← Now USED to detect selection mode
  options?: { ... }
)
```

### Change 2: Add Selection Mode Detection

```typescript
// When in selection mode, search the provided text instead of reading files
// In selection mode, files[] contains metadata (where selection came from) but we use the text parameter
const useTextMode = sourceMode === 'selection' && text && text.trim().length > 0;
const relFiles = useTextMode ? ['[selected text]'] : (Array.isArray(files) ? files : []);
```

**Critical insight**: In selection mode, the `files` array contains metadata (the path where the selection came from, e.g., `["Drafts/chapter-1.4.md"]`) for display purposes, NOT files to search. We must check `sourceMode` instead of `files.length`.

### Change 3: Use Text Parameter in Selection Mode

```typescript
for (const rel of relFiles) {
  let content: string;
  let filePath: string;

  if (useTextMode) {
    // Selection mode: use provided text
    content = text;
    filePath = '[selected text]';
  } else {
    // File modes: read from disk as before
    const uri = await this.findUriByRelativePath(rel);
    if (!uri) continue;
    const raw = await vscode.workspace.fs.readFile(uri);
    content = Buffer.from(raw).toString('utf8');
    filePath = uri.fsPath;
  }

  // ... rest of search logic unchanged
}
```

## Debug Logging Added

Added Output channel logging to SearchHandler for troubleshooting:
- Logs incoming message params (source.mode, pathText, text field)
- Logs resolved values (mode, text length, text preview, paths)
- Logs errors

This helps diagnose similar issues in the future. To view: Output panel → "Prose Minion" dropdown.

## Testing Confirmation

After fix, verified:
- ✅ Selection mode searches ONLY selected text (not whole file)
- ✅ Searching for word NOT in selection returns 0 results
- ✅ Active File mode still works (searches whole file)
- ✅ Manuscripts/Chapters modes still work

Output logs after fix:
```
[SearchHandler] Resolved to:
  mode: selection
  text length: 356 chars
```
Results: Only searched those 356 chars, not entire file. ✅

## Files Changed

**Core Fix:**
- [ProseAnalysisService.ts:364-466](../src/infrastructure/api/ProseAnalysisService.ts#L364-L466) - measureWordSearch now respects text parameter

**Debug/Diagnostics:**
- [SearchHandler.ts:18-48](../src/application/handlers/domain/SearchHandler.ts#L18-L48) - Output channel logging

**Cleanup:**
- Deleted `src/presentation/webview/App.old.tsx` (backup file no longer needed)

## Related Work

This issue was discovered during Sprint 2 of the Presentation Hooks epic while testing the refactored Search tab. Prior Sprint 2 fixes included:
- Webview stability (VSCode API singleton)
- Header restoration
- File save UX improvements
- Scope selection routing (metrics vs search independence)

## Key Learnings

1. **Underscore convention**: `_param` means "intentionally unused" - a red flag when investigating bugs
2. **Metadata vs Data**: In selection mode, `files[]` contains metadata (source path) not files to search
3. **Output channel logging**: More reliable than console.log for VSCode extension debugging
4. **Test both modes**: Selection mode and file modes have different code paths

## Future Considerations

Consider removing debug logging after confirming stability, or making it conditional on a debug flag.

## Commit

```
dda28ff fix(search): make Word Search respect selection mode like other metrics
```

## Links

- Epic: [epic-presentation-refactor-2025-10-27](../.todo/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md)
- Sprint 2 scope: Lines 227-284 in epic document
- Branch: `sprint/epic-presentation-refactor-2025-10-27-01-domain-hooks`
