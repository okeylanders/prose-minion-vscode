# Sprint 01: StandardsService Responsibility Fix

**Epic**: Technical Debt Cleanup
**Created**: 2025-11-15
**Status**: 🟢 Active
**Priority**: Medium
**Estimated Duration**: 2-3 hours
**Branch**: `epic/technical-debt-cleanup-2025-11-15`

---

## Context

StandardsService currently has a responsibility violation - it owns both standards-related concerns AND measurement orchestration via the `computePerFileStats()` method.

**Current (Wrong) Responsibilities**:
1. ✅ Standards comparison (`enrichWithStandards`)
2. ✅ Genre lookup (`findGenre`)
3. ❌ **Per-file stats computation** (`computePerFileStats`) - Measurement orchestration!

This violates Single Responsibility Principle and crosses domain boundaries.

**Reference**: [Architecture Debt Item](.todo/architecture-debt/2025-11-13-standards-service-responsibility-violation.md)

---

## Goals

1. Move `computePerFileStats()` from StandardsService to ProseStatsService
2. Rename to `analyzeMultipleFiles()` to match domain
3. Write tests **before** refactoring (test-first approach)
4. Ensure manuscript mode continues working (no regressions)

---

## Tasks

### Phase 1: Write Tests First (30 min)

- [ ] Create test file: `src/tests/services/ProseStatsService.test.ts`
- [ ] Write test for multi-file analysis behavior:
  - [ ] Test: Analyzes multiple files successfully
  - [ ] Test: Returns array of { path, stats }
  - [ ] Test: Handles missing files gracefully
  - [ ] Test: Skips files that don't exist
- [ ] Tests should FAIL initially (method doesn't exist yet)

### Phase 2: Implement ProseStatsService.analyzeMultipleFiles() (45 min)

- [ ] Add `analyzeMultipleFiles()` method to ProseStatsService
- [ ] Move `findUriByRelativePath` helper to ProseStatsService (private method)
- [ ] Implement error handling (log to OutputChannel)
- [ ] Run tests - should PASS now

### Phase 3: Update ProseAnalysisService Orchestration (30 min)

- [ ] Update `MetricsHandler.ts` line 86:
  ```typescript
  // OLD:
  const per = await this.standardsService.computePerFileStats(resolved.paths, this.proseStatsService);

  // NEW:
  const per = await this.proseStatsService.analyzeMultipleFiles(resolved.paths);
  ```
- [ ] Remove `ProseStatsAnalyzer` interface parameter (no longer needed)
- [ ] Verify TypeScript compilation succeeds

### Phase 4: Clean Up StandardsService (15 min)

- [ ] Remove `computePerFileStats()` method from StandardsService
- [ ] Remove `findUriByRelativePath()` helper (moved to ProseStatsService)
- [ ] Remove `ProseStatsAnalyzer` interface (no longer needed)
- [ ] Verify TypeScript compilation succeeds

### Phase 5: Test Manuscript Mode (30 min)

- [ ] Launch Extension Development Host (F5)
- [ ] Test manuscript mode with multiple chapter files:
  - [ ] Verify per-file stats computed correctly
  - [ ] Verify chapter count accurate
  - [ ] Verify average chapter length calculated
  - [ ] Verify `perChapterStats` includes all files
- [ ] Check Output Channel for any errors
- [ ] Verify standards enrichment still works

### Phase 6: Commit and Document (15 min)

- [ ] Stage changes
- [ ] Commit with message:
  ```
  [Sprint-01] Fix StandardsService responsibility violation

  Move computePerFileStats to ProseStatsService.analyzeMultipleFiles()

  - Add ProseStatsService.analyzeMultipleFiles() method
  - Move findUriByRelativePath helper to ProseStatsService
  - Update MetricsHandler to use new method
  - Remove computePerFileStats from StandardsService
  - Remove ProseStatsAnalyzer interface (no longer needed)
  - Add tests for multi-file analysis

  StandardsService now only handles standards concerns (SRP restored).
  ProseStatsService owns all prose stats analysis (single or multiple files).

  Refs: .todo/architecture-debt/2025-11-13-standards-service-responsibility-violation.md
  ```
- [ ] Update sprint status to COMPLETE
- [ ] Update epic with outcomes

---

## Acceptance Criteria

- ✅ ProseStatsService has `analyzeMultipleFiles()` method
- ✅ StandardsService no longer has `computePerFileStats()`
- ✅ MetricsHandler uses ProseStatsService for multi-file analysis
- ✅ Tests exist and pass for multi-file analysis
- ✅ Manuscript mode works correctly (manual testing)
- ✅ No TypeScript compilation errors
- ✅ No runtime errors in manuscript mode

---

## Files Modified

**New Files**:
- `src/tests/services/ProseStatsService.test.ts` (new tests)

**Modified Files**:
- `src/infrastructure/api/services/measurement/ProseStatsService.ts` (add analyzeMultipleFiles)
- `src/application/handlers/domain/MetricsHandler.ts` (update orchestration)
- `src/infrastructure/api/services/resources/StandardsService.ts` (remove computePerFileStats)

**Deleted**:
- `ProseStatsAnalyzer` interface (no longer needed)

---

## Current Implementation (Before Refactor)

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

### Usage (MetricsHandler)
**File**: `src/application/handlers/domain/MetricsHandler.ts:86`

```typescript
const per = await this.standardsService.computePerFileStats(resolved.paths, this.proseStatsService);
```

---

## Target Implementation (After Refactor)

### ProseStatsService (CORRECT location)
**File**: `src/infrastructure/api/services/measurement/ProseStatsService.ts`

```typescript
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
```

### Updated Usage (MetricsHandler)
**File**: `src/application/handlers/domain/MetricsHandler.ts`

```typescript
// CORRECT: ProseStatsService handles per-file analysis
const per = await this.proseStatsService.analyzeMultipleFiles(resolved.paths);
```

---

## Benefits

- ✅ **Single Responsibility**: StandardsService only handles standards concerns
- ✅ **Correct Domain Boundaries**: Measurement orchestration belongs in measurement service
- ✅ **Clearer Architecture**: ProseStatsService owns all prose stats analysis
- ✅ **Easier to Test**: No need to pass analyzer as parameter
- ✅ **Consistent Pattern**: Matches StyleFlagsService and WordFrequencyService

---

## Notes

**Why Test-First?**
- `computePerFileStats` is used in manuscript mode (critical feature)
- 30-minute investment in tests prevents breaking production feature
- Tests validate behavior is preserved during refactor

**Why This Sprint First?**
- Quick win (2-3 hours total)
- Cleans up Single Responsibility violation
- Sets up ProseStatsService for future enhancements
- Low risk with test coverage

---

**Status**: 🟢 Active
**Next**: Begin Phase 1 (Write tests first)
