# Sprint 03: Result Formatting + Export

**Sprint ID**: 03-result-formatting
**Epic**: [Context Search](../epic-context-search.md)
**Status**: Complete
**Estimated Effort**: 0.5 days (was 1 day) - **50% reduction via WordSearchService**
**Actual Effort**: ~0.5 days
**Branch**: `epic/context-search-2025-11-17`
**Depends On**: Sprint 02 (frontend UI)
**ADR**: [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)
**Commit**: `1424f54`

## Goal

Add category label to results and export functionality (**chapter/cluster analysis already provided by WordSearchService**).

## Scope

### In Scope
- ✅ Expanded summary table (word | count | chapter)
- ✅ Details & cluster analysis section
- ✅ Chapter-by-chapter breakdown
- ✅ Export to markdown report
- ✅ Copy-to-clipboard functionality

### Out of Scope
- ❌ Batch processing / pagination (Sprint 04)
- ❌ Settings persistence (Sprint 04)
- ❌ Advanced filtering (Phase 2)

## Tasks

### 1. Backend: Chapter Detection
**File**: `src/infrastructure/api/services/search/ContextSearchService.ts`

- [ ] Add chapter detection logic (reuse from Word Search):
  - Detect chapter markers (e.g., "# Chapter 1", "## Chapter: Title")
  - Split text into chapter segments
  - Track word occurrences per chapter
- [ ] Update `countOccurrences()` to include chapter-level data:
  ```typescript
  interface MatchWithChapters {
    word: string;
    count: number;
    chapters: Array<{
      chapterName: string;
      count: number;
      locations: Array<{ line: number; context: string }>;
    }>;
  }
  ```
- [ ] Update `formatResults()` to populate chapter data in result

### 2. Frontend: Expanded Summary Table
**File**: `src/presentation/webview/components/SearchTab.tsx` (or extract to `ContextSearchResults.tsx`)

- [ ] Add "Expanded Summary" section (below basic summary):
  ```tsx
  <table className="expanded-summary">
    <thead>
      <tr>
        <th>Word</th>
        <th>Count</th>
        <th>Chapters</th>
      </tr>
    </thead>
    <tbody>
      {result.matches.map(match => (
        <tr key={match.word}>
          <td>{match.word}</td>
          <td>{match.count}</td>
          <td>{match.chapters?.map(ch => ch.chapterName).join(', ') || 'N/A'}</td>
        </tr>
      ))}
    </tbody>
  </table>
  ```

### 3. Frontend: Details & Cluster Analysis
**File**: `src/presentation/webview/components/SearchTab.tsx`

- [ ] Add "Details & Cluster Analysis" section:
  - Collapsible sections per word
  - Chapter-by-chapter breakdown
  - Show context snippets (±50 chars around match)
  ```tsx
  <div className="details-section">
    {result.matches.map(match => (
      <details key={match.word}>
        <summary>{match.word} ({match.count} occurrences)</summary>
        {match.chapters?.map(chapter => (
          <div key={chapter.chapterName} className="chapter-detail">
            <h4>{chapter.chapterName} ({chapter.count})</h4>
            <ul>
              {chapter.locations.map((loc, idx) => (
                <li key={idx}>
                  Line {loc.line}: <code>{loc.context}</code>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    ))}
  </div>
  ```

### 4. Export Functionality
**File**: `src/presentation/webview/components/SearchTab.tsx` or new `ExportService.ts`

**Export Button**:
- [ ] Add "Export Report" button (below results)
- [ ] Implement `exportContextSearchReport()` function

**Markdown Format** (match Word Search):
```markdown
# Context Search Report: [Query]

**Search Date**: [timestamp]
**Query**: [category query]
**Scope**: [selection/file/glob]
**Total Matches**: [number]
**Unique Words**: [number]
**Words Analyzed**: [number]

---

## Summary
| Word | Count |
|------|-------|
| coat | 15 |
| pants | 8 |
...

## Expanded Summary
| Word | Count | Chapters |
|------|-------|----------|
| coat | 15 | Chapter 1, Chapter 3, Chapter 7 |
| pants | 8 | Chapter 2, Chapter 5 |
...

## Details & Cluster Analysis

### coat (15 occurrences)

#### Chapter 1 (5)
- Line 42: ...he put on his **coat** and left...
- Line 87: ...the **coat** was torn...
...

#### Chapter 3 (7)
...

### pants (8 occurrences)
...
```

**Implementation**:
- [ ] Generate markdown string from result object
- [ ] Create blob and download link
- [ ] Trigger download with filename: `context-search-[query]-[timestamp].md`
- [ ] Alternatively: Post message to extension to save via VSCode API (preferred)

**Extension-Side Save** (Recommended):
- [ ] Add `EXPORT_CONTEXT_SEARCH` message type
- [ ] FileOperationsHandler: Implement export logic (save to `prose-minion/reports/`)
- [ ] Use timestamped filename
- [ ] Show confirmation notification: "Report saved to prose-minion/reports/..."

### 5. Copy to Clipboard
- [ ] Add "Copy to Clipboard" button
- [ ] Copy formatted markdown to clipboard
- [ ] Show toast notification: "Report copied to clipboard"

### 6. Styling
**File**: `src/presentation/webview/styles/SearchTab.css`

- [ ] Style expanded summary table (striped rows, hover effects)
- [ ] Style details section (collapsible, indented)
- [ ] Style chapter breakdown (nested lists)
- [ ] Style export buttons (primary action style)

### 7. Manual Testing
- [ ] Test with multi-chapter text (verify chapter detection)
- [ ] Test export functionality (verify markdown format)
- [ ] Test copy-to-clipboard (verify content)
- [ ] Test edge cases (no chapters, single chapter)

## Acceptance Criteria

- ✅ Expanded summary table shows chapter breakdown
- ✅ Details section displays chapter-by-chapter occurrences
- ✅ Context snippets show ±50 chars around matches
- ✅ Export button saves markdown report to `prose-minion/reports/`
- ✅ Copy-to-clipboard works with formatted markdown
- ✅ Markdown format matches Word Search structure
- ✅ Chapter detection works for common markdown heading formats

## Testing Checklist

**Test Case 1: Multi-Chapter Export**
- Input: Search with text containing 5 chapters
- Expected: Expanded summary lists all chapters, details section has 5 chapter breakdowns
- Result: ✅ / ❌

**Test Case 2: No Chapters**
- Input: Search with text containing no chapter markers
- Expected: Chapters column shows "N/A", details section still works
- Result: ✅ / ❌

**Test Case 3: Export Markdown**
- Input: Click "Export Report"
- Expected: File saved to `prose-minion/reports/context-search-[query]-[timestamp].md`
- Result: ✅ / ❌

**Test Case 4: Copy to Clipboard**
- Input: Click "Copy to Clipboard"
- Expected: Markdown content copied, toast notification shows
- Result: ✅ / ❌

**Test Case 5: Context Snippets**
- Input: View details section
- Expected: Each occurrence shows ±50 chars of context
- Result: ✅ / ❌

## Implementation Notes

### Chapter Detection Regex

Reuse from Word Search:
```typescript
const chapterRegex = /^#{1,3}\s+(Chapter|CHAPTER|Ch\.?)\s+(\d+|[IVXLCDM]+).*$/gm;
```

### Context Snippet Extraction

```typescript
function extractContext(text: string, index: number, radius = 50): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\n/g, ' ');
}
```

### Export Message Flow

```typescript
// Frontend
function exportReport() {
  vscode.postMessage({
    type: MessageType.EXPORT_CONTEXT_SEARCH,
    source: 'webview.search.contextSearch',
    payload: {
      report: generateMarkdown(result),
      filename: `context-search-${sanitize(query)}-${Date.now()}.md`
    },
    timestamp: Date.now()
  });
}

// Backend (FileOperationsHandler)
async function handleExportContextSearch(message: MessageEnvelope) {
  const { report, filename } = message.payload;
  const reportPath = path.join(workspace, 'prose-minion', 'reports', filename);
  await fs.writeFile(reportPath, report, 'utf8');
  vscode.window.showInformationMessage(`Report saved: ${filename}`);
}
```

## Definition of Done

- [ ] All tasks completed
- [ ] Code committed to sprint branch
- [ ] Manual tests passed
- [ ] Export functionality verified
- [ ] Markdown format matches Word Search
- [ ] No TypeScript errors
- [ ] Ready for performance optimizations (Sprint 04)

## References

- [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)
- [Word Search Service](../../../src/infrastructure/api/services/search/WordSearchService.ts) (chapter detection reference)
- [FileOperationsHandler](../../../src/application/handlers/domain/FileOperationsHandler.ts) (export reference)

## Outcomes

- **Commit**: `1424f54`
- **Completion Date**: 2025-11-18
- **Actual Effort**: ~0.5 days
- **Discoveries**:
  - Added `formatCategorySearchAsMarkdown()` to shared resultFormatter.ts (reused existing helpers like `formatGap`, `escapePipes`)
  - Cluster settings UI added (context words, cluster window, min cluster size) - shared with Word Search
  - Copy/Save buttons use existing COPY_RESULT/SAVE_RESULT message types
