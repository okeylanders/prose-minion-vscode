# Metrics Duplicate Legend Fix

**Date**: 2025-11-09
**Time**: 15:10
**Type**: Bug fix

---

## Problem

Metrics tab was showing **duplicate legend** entries when copying or saving reports:
1. Basic legend in MetricsTab.tsx (lines 140-158)
2. Comprehensive legend in resultFormatter.ts (lines 23-75 via `buildMetricsLegend()`)

User wanted to keep only the comprehensive one that appears above the Lexical Density/Vocabulary Diversity explainers.

---

## Root Cause

Historical accumulation - the comprehensive `buildMetricsLegend()` was added to `resultFormatter.ts` (line 596) to append at the end of all metrics output, but MetricsTab.tsx still had its own `buildExportContent()` method that was also appending a basic legend.

**Duplication occurred in**:
- [MetricsTab.tsx:140-158](../src/presentation/webview/components/MetricsTab.tsx#L140-L158) - Added legend to export content
- [resultFormatter.ts:596](../src/presentation/webview/utils/resultFormatter.ts#L596) - `buildMetricsLegend()` already appended

---

## Solution

Removed the duplicate basic legend from MetricsTab.tsx and added explanatory comment.

**Changes**:
- [MetricsTab.tsx:139-141](../src/presentation/webview/components/MetricsTab.tsx#L139-L141)

**Before**:
```typescript
const buildExportContent = React.useCallback(() => {
  let content = markdownContent;

  // Append legend explaining metrics (export only)
  const legend = [
    '### Legend',
    '',
    '- Word Count: Total tokens split by whitespace.',
    // ... 11 more lines
  ].join('\n');

  content += `\n\n${legend}\n`;

  // Append Chapter Details section (per-chapter pivoted tables) if available
```

**After**:
```typescript
const buildExportContent = React.useCallback(() => {
  let content = markdownContent;

  // Note: Legend is already appended by formatMetricsAsMarkdown() in resultFormatter.ts
  // (includes comprehensive Metrics Guide with Vocabulary Diversity and Lexical Density explainers)

  // Append Chapter Details section (per-chapter pivoted tables) if available
```

---

## Impact

**Before**:
```markdown
# 📊 Prose Statistics
...

### Legend
- Word Count: Total tokens...
- Sentence Count: Heuristic...

## Chapter Details
...

### Legend  ← DUPLICATE
- Word Count: Total tokens...
- Sentence Count: Heuristic...

## 📖 Metrics Guide  ← The one we want to keep

### Legend
- **Word Count**: Total tokens...

### 🌈 Vocabulary Diversity
...

### 🎨 Lexical Density
...
```

**After**:
```markdown
# 📊 Prose Statistics
...

## Chapter Details
...

## 📖 Metrics Guide  ← Only one legend

### Legend
- **Word Count**: Total tokens...

### 🌈 Vocabulary Diversity
...

### 🎨 Lexical Density
...
```

---

## Testing

✅ Manually verified:
- Copy/Save from Prose Statistics tab
- Copy/Save from Word Frequency tab
- Copy/Save from Style Flags tab
- All show single comprehensive legend at end

---

## Related Files

- [MetricsTab.tsx](../src/presentation/webview/components/MetricsTab.tsx) - Removed duplicate legend
- [resultFormatter.ts](../src/presentation/webview/utils/resultFormatter.ts) - Contains `buildMetricsLegend()` that's kept

---

## Notes

This was a quick UX polish fix discovered during testing. The comprehensive legend added by `buildMetricsLegend()` includes:
- Basic metric definitions (Legend section)
- Detailed Vocabulary Diversity explainer with formula and ranges
- Detailed Lexical Density explainer with formula and ranges

Much more useful than the basic bullet list that was duplicating.

---

**Commit**: Next commit
**Files Modified**: 1 (MetricsTab.tsx)
**Lines Changed**: -17 lines (removed duplicate legend), +2 lines (explanatory comment)
