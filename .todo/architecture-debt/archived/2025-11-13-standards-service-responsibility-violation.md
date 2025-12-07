> **✅ RESOLVED**
> - **PR**: #41
> - **Date**: 2025-11-15
> - **Sprint**: Sub-Epic 3, Sprint 01

# StandardsService Responsibility Violation: computePerFileStats

**Date Identified**: 2025-11-13
**Identified During**: Sprint 02 - Create Measurement Service Wrappers
**Priority**: Medium
**Estimated Effort**: 1-2 hours

---

## Problem

StandardsService has a responsibility violation - it owns both standards-related concerns AND measurement orchestration:

**Current (Wrong) Responsibilities:**
1. ✅ Standards comparison (`enrichWithStandards`)
2. ✅ Genre lookup (`findGenre`)
3. ❌ **Per-file stats computation** (`computePerFileStats`) - This belongs in ProseStatsService!

The `computePerFileStats` method reads multiple files and calls a prose stats analyzer on each one. This is **measurement orchestration**, not standards enrichment. It violates Single Responsibility Principle and crosses domain boundaries.

---

## Current Implementation

### StandardsService (WRONG location)
**File**: `src/infrastructure/api/services/resources/StandardsService.ts:143-167`

```typescript
async computePerFileStats(
  relativePaths: string[],
  proseStatsAnalyzer: ProseStatsAnalyzer
): Promise<Array<{ path: string; stats: any }>> {
  const results: Array<{ path: string; stats: any }> = [];

  for (const rel of relativePaths) {
    try {
      const uri = await this.findUriByRelativePath(rel);
      if (!uri) continue;

      const raw = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(raw).toString('utf8');
      const stats = proseStatsAnalyzer.analyze({ text });

      results.push({ path: rel, stats });
    } catch (err) {
      // error handling
    }
  }

  return results;
}
```

**Usage**: `ProseAnalysisService.ts:219`
```typescript
if (files && files.length > 0 && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
  const per = await this.standardsService.computePerFileStats(files, this.proseStatsService);
  // ... aggregation logic
}
```

---

## Recommendation

### Move to ProseStatsService (CORRECT location)

**File**: `src/infrastructure/api/services/measurement/ProseStatsService.ts`

```typescript
export class ProseStatsService {
  private proseStats: PassageProseStats;

  constructor(
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    this.proseStats = new PassageProseStats();
  }

  /**
   * Analyze single text
   */
  analyze(input: { text: string }): any {
    return this.proseStats.analyze(input);
  }

  /**
   * Analyze multiple files (manuscript/chapters mode)
   *
   * @param relativePaths - Array of relative file paths
   * @returns Array of { path, stats } for each file
   */
  async analyzeMultipleFiles(
    relativePaths: string[]
  ): Promise<Array<{ path: string; stats: any }>> {
    const results: Array<{ path: string; stats: any }> = [];

    for (const rel of relativePaths) {
      try {
        const uri = await this.findUriByRelativePath(rel);
        if (!uri) continue;

        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString('utf8');
        const stats = this.analyze({ text });

        results.push({ path: rel, stats });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.outputChannel?.appendLine(`[ProseStatsService] Per-file stats failed for ${rel}: ${msg}`);
      }
    }

    return results;
  }

  private async findUriByRelativePath(relativePath: string): Promise<vscode.Uri | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const candidate = vscode.Uri.joinPath(folder.uri, relativePath);
      try {
        await vscode.workspace.fs.stat(candidate);
        return candidate;
      } catch {
        // continue to next folder
      }
    }
    return undefined;
  }
}
```

**Updated Usage**: `ProseAnalysisService.ts`
```typescript
async measureProseStats(text: string, files?: string[], sourceMode?: string): Promise<MetricsResult> {
  try {
    const stats = this.proseStatsService.analyze({ text });

    // Chapter aggregation (for multi-file modes)
    if (files && files.length > 0 && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
      // CORRECT: ProseStatsService handles per-file analysis
      const per = await this.proseStatsService.analyzeMultipleFiles(files);

      const chapterWordCounts = per.map(p => p.stats.wordCount);
      const chapterCount = chapterWordCounts.length;
      const totalWords = chapterWordCounts.reduce((a, b) => a + b, 0);
      const avgChapterLength = chapterCount > 0 ? Math.round(totalWords / chapterCount) : 0;

      (stats as any).chapterCount = chapterCount;
      (stats as any).averageChapterLength = avgChapterLength;
      (stats as any).perChapterStats = per;
    }

    // Standards enrichment (StandardsService only handles standards)
    const enriched = await this.standardsService.enrichWithStandards(stats);
    return AnalysisResultFactory.createMetricsResult('prose_stats', enriched);
  } catch (error) {
    // error handling
  }
}
```

**Remove from StandardsService**:
- Delete `computePerFileStats` method entirely
- Delete `ProseStatsAnalyzer` interface (no longer needed)
- Remove `findUriByRelativePath` helper (move to ProseStatsService)

---

## Impact

### Benefits of Fixing:
1. ✅ **Single Responsibility**: StandardsService only handles standards concerns
2. ✅ **Correct Domain Boundaries**: Measurement orchestration belongs in measurement service
3. ✅ **Clearer Architecture**: ProseStatsService owns all prose stats analysis (single file or multiple files)
4. ✅ **Easier to Test**: No need to pass analyzer as parameter (no more "service composition" confusion)
5. ✅ **Consistent Pattern**: StyleFlagsService and WordFrequencyService don't have "computePerFileX" methods either

### Risks of Not Fixing:
- ❌ Confuses future developers (standards vs measurement concerns)
- ❌ Violates SRP (StandardsService has two reasons to change)
- ❌ Makes testing harder (complex dependency injection)
- ❌ Inconsistent service pattern (why does StandardsService orchestrate measurement?)

### Why It's Medium Priority:
- Functionality works correctly (not broken)
- Violates architectural principles (but doesn't block new features)
- Will become more problematic if more multi-file features are added
- Best fixed during next measurement service sprint

---

## Why This Happened

From Sprint 01 ADR and implementation:
1. `computePerFileStats` was added to StandardsService because it's used alongside standards enrichment for manuscript mode
2. The ADR wanted to demonstrate "service composition" pattern (passing analyzer as parameter)
3. Tried to avoid creating too many services in Sprint 01

**Lesson Learned**: Demonstrating a pattern (service composition) led to mixing concerns. Domain boundaries are more important than showcasing patterns.

---

## Recommended Sprint to Fix

**Sprint 04 or Sprint 05** (after analysis services are extracted)

**Tasks**:
1. Add `analyzeMultipleFiles()` to ProseStatsService
2. Move `findUriByRelativePath` helper to ProseStatsService
3. Remove `computePerFileStats` from StandardsService
4. Remove `ProseStatsAnalyzer` interface (no longer needed)
5. Update ProseAnalysisService orchestration
6. Test manuscript mode (multi-file aggregation)
7. Update Sprint 01 memory bank to note the fix

---

## References

**Related ADRs**:
- [docs/adr/2025-11-11-prose-analysis-service-refactor.md](../../docs/adr/2025-11-11-prose-analysis-service-refactor.md) - Original refactor decision

**Related Files**:
- `src/infrastructure/api/services/resources/StandardsService.ts:143-167` (current wrong location)
- `src/infrastructure/api/services/measurement/ProseStatsService.ts` (should own this)
- `src/infrastructure/api/ProseAnalysisService.ts:219` (orchestration)

**Related Sprints**:
- Sprint 01: Extract Resource Services (where StandardsService was created)
- Sprint 02: Create Measurement Service Wrappers (where issue was identified)
- Sprint 04/05: Recommended fix timing

---

## Resolution

**Status**: ✅ **RESOLVED**
**Resolution Date**: 2025-11-15
**Resolved By**: [Technical Debt Cleanup Epic - Sprint 01](.todo/epics/epic-technical-debt-cleanup-2025-11-15/sprints/01-standards-service-responsibility-fix.md)
**Commit**: a694ea1

### What Was Done

✅ **ProseStatsService Enhanced**:
- Added `analyzeMultipleFiles()` method for manuscript/chapters mode
- Added `findUriByRelativePath()` helper (moved from StandardsService)
- Proper error handling and logging for file read failures

✅ **StandardsService Cleaned**:
- Removed `computePerFileStats()` method (measurement orchestration)
- Removed `ProseStatsAnalyzer` interface (no longer needed)
- Removed `findUriByRelativePath()` helper (moved to ProseStatsService)
- Now only handles standards concerns (Single Responsibility Principle restored)

✅ **MetricsHandler Updated**:
- Changed from `standardsService.computePerFileStats()` to `proseStatsService.analyzeMultipleFiles()`
- Cleaner, more intuitive API

✅ **Tests Added**:
- 9 comprehensive tests for multi-file analysis
- All tests passing (133 total)

### Outcome

✅ Single Responsibility Principle restored
✅ Correct domain boundaries (measurement in measurement service)
✅ Clearer architecture (ProseStatsService owns all prose stats analysis)
✅ No regressions in manuscript mode
