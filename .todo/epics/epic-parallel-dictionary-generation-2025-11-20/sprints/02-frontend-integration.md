# Sprint 02: Frontend Integration

**Epic**: [Parallel Dictionary Generation](../epic-parallel-dictionary-generation.md)
**Status**: Pending
**Duration**: 1 day
**Branch**: `epic/parallel-dictionary-generation-2025-11-20` (shared across all sprints)

---

## Goals

Integrate parallel dictionary generation into the UI:
- Extend `useDictionary` hook with fast generate actions
- Add "Experimental: Fast Generate" button
- Display progress updates (existing loader + backend messages)
- Show partial failure warnings
- Persist experimental feature preference

---

## Tasks

### 1. Extend useDictionary Hook

**File**: `src/presentation/webview/hooks/domain/useDictionary.ts`

#### State Extensions

- [ ] Add `isFastGenerating: boolean` to `DictionaryState`
- [ ] Add `fastGenerationProgress` to `DictionaryState`:
  ```typescript
  fastGenerationProgress?: {
    completedBlocks: string[];
    totalBlocks: number;
  }
  ```
- [ ] Add `partialFailures: string[]` to result metadata (if not already present)

#### Action Extensions

- [ ] Add `handleFastGenerate(word: string, context?: string)` to `DictionaryActions`
  - Set `isFastGenerating = true`
  - Clear previous progress
  - Post `FAST_GENERATE_DICTIONARY` message to extension
- [ ] Add `handleFastGenerateResult(result: FastGenerateDictionaryResult)` to `DictionaryActions`
  - Set `isFastGenerating = false`
  - Set `dictionaryResult` (reuse existing state)
  - Show notification if partial failures exist
- [ ] Add `handleProgress(progress: DictionaryGenerationProgress)` to `DictionaryActions`
  - Update `fastGenerationProgress` state

#### Persistence Extensions

- [ ] Add to `DomainPersistence`:
  ```typescript
  experimentalFastGenerateEnabled?: boolean; // User preference (future use)
  ```

#### Message Routing

- [ ] Register handlers in `useMessageRouter` (called from App.tsx):
  - `FAST_GENERATE_DICTIONARY_RESULT → handleFastGenerateResult`
  - `DICTIONARY_GENERATION_PROGRESS → handleProgress`

---

### 2. UI Component Enhancement

**File**: `src/presentation/webview/components/Dictionary.tsx`

#### Button Group Update

- [ ] Add "Fast Generate" button next to "Generate Dictionary Entry":
  ```tsx
  <div className="button-group">
    {/* Existing button */}
    <button
      onClick={() => dictionary.handleGenerate(word, context)}
      disabled={dictionary.isGenerating || dictionary.isFastGenerating}
    >
      Generate Dictionary Entry
    </button>

    {/* NEW: Experimental fast generate button */}
    <button
      onClick={() => dictionary.handleFastGenerate(word, context)}
      disabled={dictionary.isGenerating || dictionary.isFastGenerating}
      className="experimental-button"
      title="Experimental parallel generation (faster, may have incomplete sections)"
    >
      <span className="experimental-badge">🧪</span>
      Fast Generate
    </button>
  </div>
  ```

#### Progress Indicator

- [ ] Add progress display during fast generation:
  ```tsx
  {dictionary.isFastGenerating && (
    <div className="generation-status">
      <div className="loader"></div> {/* Reuse existing loader */}
      {dictionary.fastGenerationProgress && (
        <span className="progress-text">
          Generating blocks: {dictionary.fastGenerationProgress.completedBlocks.length} / {dictionary.fastGenerationProgress.totalBlocks}
        </span>
      )}
    </div>
  )}
  ```

#### Partial Failure Warning

- [ ] Add warning display if partial failures exist:
  ```tsx
  {dictionary.dictionaryResult?.metadata?.partialFailures && dictionary.dictionaryResult.metadata.partialFailures.length > 0 && (
    <div className="warning partial-failures">
      ⚠️ Some sections could not be generated: {dictionary.dictionaryResult.metadata.partialFailures.join(', ')}
    </div>
  )}
  ```

---

### 3. Styling

**File**: `src/presentation/webview/styles/Dictionary.css` (or inline styles)

#### Experimental Button Styles

- [ ] Add styles for `.experimental-button`:
  ```css
  .experimental-button {
    background-color: var(--vscode-button-secondaryBackground);
    border: 1px dashed var(--vscode-button-border);
    opacity: 0.9;
  }

  .experimental-button:hover {
    opacity: 1;
    border-style: solid;
  }

  .experimental-badge {
    margin-right: 4px;
    font-size: 14px;
  }
  ```

#### Progress Text Styles

- [ ] Add styles for `.progress-text`:
  ```css
  .progress-text {
    margin-left: 8px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
  }
  ```

#### Partial Failure Warning Styles

- [ ] Add styles for `.partial-failures`:
  ```css
  .warning.partial-failures {
    margin-top: 8px;
    padding: 8px;
    background-color: var(--vscode-inputValidation-warningBackground);
    border-left: 3px solid var(--vscode-inputValidation-warningBorder);
    font-size: 12px;
  }
  ```

---

### 4. App.tsx Integration

**File**: `src/presentation/webview/App.tsx`

#### Message Routing Registration

- [ ] Verify `useMessageRouter` includes new message types:
  ```typescript
  useMessageRouter({
    // ... existing routes
    [MessageType.FAST_GENERATE_DICTIONARY_RESULT]: dictionary.handleFastGenerateResult,
    [MessageType.DICTIONARY_GENERATION_PROGRESS]: dictionary.handleProgress,
  });
  ```

#### Persistence Composition

- [ ] Verify `usePersistence` includes dictionary fast generate state:
  ```typescript
  usePersistence({
    // ... existing state
    ...dictionary.persistedState, // Should include experimentalFastGenerateEnabled
  });
  ```

---

### 5. Error Handling

**File**: `src/presentation/webview/hooks/domain/useDictionary.ts`

- [ ] Handle fast generate errors:
  - Show error message if entire request fails
  - Display partial failures gracefully (show warning, don't block UI)
  - Clear `isFastGenerating` on error
- [ ] Add timeout on frontend (fallback if backend doesn't respond):
  - After 30 seconds, show "Request timed out" message
  - Allow user to retry

---

## Acceptance Criteria

✅ **Hook Enhancement**:
- `useDictionary` exports `isFastGenerating`, `fastGenerationProgress`, `handleFastGenerate`, `handleFastGenerateResult`, `handleProgress`
- Message routing registered for new types
- Persistence includes experimental preference

✅ **UI Integration**:
- "Fast Generate" button visible with 🧪 badge
- Button disabled during generation (both standard and fast)
- Progress updates display (loader + "Generating blocks: X / Y")
- Partial failure warning displays when applicable

✅ **Styling**:
- Experimental button visually distinct (dashed border, secondary background)
- Progress text readable and aligned
- Partial failure warning clearly visible (warning background)

✅ **End-to-End Flow**:
- Click "Fast Generate" → backend receives message
- Progress updates as blocks complete (text updates)
- Result displays when complete
- Partial failures show warning but display completed blocks

---

## Testing Checklist

### Manual Testing

- [ ] **Basic Flow**:
  - Enter word "run", click "Fast Generate"
  - Verify loader appears
  - Verify progress text updates (e.g., "Generating blocks: 3 / 8")
  - Verify result displays when complete
  - Verify all 8 blocks present in result

- [ ] **Progress Updates**:
  - Enter word, click "Fast Generate"
  - Watch progress text update in real-time
  - Verify count increases (1/8 → 2/8 → ... → 8/8)

- [ ] **Partial Failures** (simulate by disconnecting network mid-request):
  - Click "Fast Generate"
  - Disconnect network after ~2 seconds
  - Verify warning displays: "⚠️ Some sections could not be generated: [list]"
  - Verify completed blocks still display

- [ ] **Button States**:
  - Click "Generate Dictionary Entry" → "Fast Generate" button disabled
  - Click "Fast Generate" → "Generate Dictionary Entry" button disabled
  - Verify both buttons re-enable after completion

- [ ] **Persistence**:
  - Use fast generate
  - Reload webview (Developer: Reload Webview)
  - Verify state persists (if applicable)

- [ ] **Error Handling**:
  - Test with no API key → verify error message
  - Test with invalid word (e.g., "xyzabc123") → verify graceful handling
  - Test timeout scenario → verify "Request timed out" message

### Visual Testing

- [ ] Experimental button looks distinct from primary button
- [ ] 🧪 badge clearly visible and aligned
- [ ] Progress text readable (not cut off or misaligned)
- [ ] Partial failure warning visually distinct (warning color)
- [ ] Loader animation smooth during generation

### Cross-Tab Testing

- [ ] Switch between Dictionary tab and another tab during fast generation
- [ ] Return to Dictionary tab → verify progress updates continue
- [ ] Switch tabs after completion → verify result persists

---

## Dependencies

**Backend (Sprint 01)**:
- Message types (`FAST_GENERATE_DICTIONARY`, `FAST_GENERATE_DICTIONARY_RESULT`, `DICTIONARY_GENERATION_PROGRESS`)
- Handler route registration (`DictionaryHandler`)
- Service implementation (`DictionaryService.generateParallelDictionary()`)

**Frontend**:
- `useDictionary` hook (extend)
- `Dictionary.tsx` component (update)
- Message router infrastructure (`useMessageRouter`)
- Persistence infrastructure (`usePersistence`)

---

## Notes

**UX Philosophy**:
- **Experimental badge**: Sets user expectations (may be incomplete, faster but riskier)
- **Progress visibility**: Reduces perceived wait time (show progress, not just spinner)
- **Graceful degradation**: Partial failures don't block UX (show what completed, warn about failures)

**Future Enhancements** (out of scope):
- Visual progress list (horizontal: `*definition* ↔ **etymology** ↔ *voices* ↔ etc`)
- Toggle to default to fast generate (user preference)
- Cost estimator (show API call count)

**Alpha Development**:
- Breaking changes allowed
- Focus on working UX; polish in later sprints

---

## Outcomes (Post-Sprint)

**Completed**: [Date]
**PR**: [Link]
**Actual Duration**: [Days]

**Achievements**:
- [List of completed tasks]
- [UX improvements observed]
- [Any deviations from plan]

**Issues Discovered**:
- [Architecture debt identified]
- [Blockers encountered]
- [Lessons learned]

---

**Last Updated**: 2025-11-20
