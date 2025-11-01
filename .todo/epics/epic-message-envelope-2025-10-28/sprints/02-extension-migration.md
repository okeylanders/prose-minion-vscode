# Sprint 2: Extension-Side Migration

**Status**: Not Started
**Estimated Time**: 6-8 hours
**Branch**: Same as Sprint 1 (`sprint/epic-message-envelope-2025-10-28-01-handler-registration-types`)
**Commit Prefix**: `[sprint-2]`

## Goal

Update all extension-side code to use envelope pattern and handler registration. Fix all TypeScript errors from Sprint 1. Implement echo prevention in ConfigurationHandler.

## Context

Sprint 1 created ~200+ TypeScript errors by updating type definitions. This sprint systematically fixes those errors by:
1. Adding `registerRoutes` to all domain handlers
2. Updating handler methods to use `message.payload`
3. Updating all `postMessage` calls to use envelope
4. Implementing source-based echo prevention

## Task List

### Phase 1: Domain Handler Registration (2 hours)

Work through handlers **one at a time**, testing after each:

**1. ConfigurationHandler** (30 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 6 message types:
  - `REQUEST_MODEL_DATA` → `handleRequestModelData`
  - `UPDATE_SETTING` → `handleUpdateSetting`
  - `SET_MODEL_SELECTION` → `handleSetModelSelection`
  - `REQUEST_SETTINGS_DATA` → `handleRequestSettingsData`
  - `SET_API_KEY` → `handleSetApiKey`
  - `DELETE_API_KEY` → `handleDeleteApiKey`
- Use `.bind(this)` for all registrations
- File: `src/application/handlers/domain/ConfigurationHandler.ts`

**2. AnalysisHandler** (15 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 4 message types:
  - `ANALYZE_DIALOGUE` → `handleAnalyzeDialogue`
  - `ANALYZE_PROSE` → `handleAnalyzeProse`
  - `REQUEST_CONTEXT` → `handleRequestContext`
  - `REQUEST_ANALYSIS_GUIDE` → `handleRequestAnalysisGuide`
- File: `src/application/handlers/domain/AnalysisHandler.ts`

**3. MetricsHandler** (15 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 4 message types:
  - `RUN_METRICS` → `handleRunMetrics`
  - `REQUEST_ACTIVE_FILE` → `handleRequestActiveFile`
  - `REQUEST_MANUSCRIPT_GLOBS` → `handleRequestManuscriptGlobs`
  - `REQUEST_CHAPTER_GLOBS` → `handleRequestChapterGlobs`
- File: `src/application/handlers/domain/MetricsHandler.ts`

**4. SearchHandler** (10 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 1 message type:
  - `RUN_WORD_SEARCH` → `handleRunWordSearch`
- File: `src/application/handlers/domain/SearchHandler.ts`

**5. DictionaryHandler** (10 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 1 message type:
  - `RUN_DICTIONARY` → `handleRunDictionary`
- File: `src/application/handlers/domain/DictionaryHandler.ts`

**6. ContextHandler** (10 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 1 message type:
  - `REQUEST_CONTEXT` → `handleRequestContext`
- File: `src/application/handlers/domain/ContextHandler.ts`

**7. PublishingHandler** (10 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 1 message type:
  - `REQUEST_PUBLISHING_STANDARDS_DATA` → `handleRequestPublishingStandardsData`
- File: `src/application/handlers/domain/PublishingHandler.ts`

**8. SourcesHandler** (10 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 3 message types:
  - `REQUEST_ACTIVE_FILE` → `handleRequestActiveFile`
  - `REQUEST_MANUSCRIPT_GLOBS` → `handleRequestManuscriptGlobs`
  - `REQUEST_CHAPTER_GLOBS` → `handleRequestChapterGlobs`
- File: `src/application/handlers/domain/SourcesHandler.ts`

**9. UIHandler** (10 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 3 message types:
  - `REQUEST_SELECTION` → `handleRequestSelection`
  - `REQUEST_ANALYSIS_GUIDE` → `handleRequestAnalysisGuide`
  - `CHANGE_TAB` → `handleChangeTab`
- File: `src/application/handlers/domain/UIHandler.ts`

**10. FileOperationsHandler** (10 min)
- Add `registerRoutes(router: MessageRouter)` method
- Register 2 message types:
  - `COPY_RESULT` → `handleCopyResult`
  - `SAVE_RESULT` → `handleSaveResult`
- File: `src/application/handlers/domain/FileOperationsHandler.ts`

### Phase 2: Handler Method Updates (3 hours)

**11. Update all handler methods to use payload** (3 hours)
- Pattern: `message.field` → `message.payload.field`
- Work handler by handler, method by method
- Test compilation after each handler
- Estimated ~30+ methods across 10 files
- Files: All domain handlers

Example:
```typescript
// BEFORE
async handleUpdateSetting(message: UpdateSettingMessage): Promise<void> {
  const config = vscode.workspace.getConfiguration('proseMinion');
  await config.update(message.key, message.value, true);
}

// AFTER
async handleUpdateSetting(message: UpdateSettingMessage): Promise<void> {
  const { key, value } = message.payload;
  const config = vscode.workspace.getConfiguration('proseMinion');
  await config.update(key, value, true);
}
```

### Phase 3: postMessage Updates (2 hours)

**12. Update all postMessage calls to use envelope** (2 hours)
- Add `source` field (e.g., `'extension.configuration'`)
- Wrap fields in `payload: {}`
- Add `timestamp: Date.now()`
- Work handler by handler
- Estimated ~50+ postMessage calls across 10 files
- Files: All domain handlers

Example:
```typescript
// BEFORE
this.postMessage({
  type: MessageType.MODEL_DATA,
  modelOptions: options,
  modelSelections: selections
});

// AFTER
this.postMessage({
  type: MessageType.MODEL_DATA,
  source: 'extension.configuration',
  payload: {
    modelOptions: options,
    modelSelections: selections
  },
  timestamp: Date.now()
});
```

**Source naming conventions**:
- `extension.configuration` - ConfigurationHandler
- `extension.analysis` - AnalysisHandler
- `extension.metrics` - MetricsHandler
- `extension.search` - SearchHandler
- `extension.dictionary` - DictionaryHandler
- `extension.context` - ContextHandler
- `extension.publishing` - PublishingHandler
- `extension.sources` - SourcesHandler
- `extension.ui` - UIHandler
- `extension.file_ops` - FileOperationsHandler

### Phase 4: Echo Prevention (1 hour)

**13. Implement source-based echo prevention** (1 hour)
- Add `private lastUpdateSource?: string` field
- Track source in `handleUpdateSetting`:
  ```typescript
  this.lastUpdateSource = message.source;
  setTimeout(() => { this.lastUpdateSource = undefined; }, 100);
  ```
- Check source in `sendModelData`:
  ```typescript
  if (this.lastUpdateSource?.startsWith('webview.')) {
    this.outputChannel.appendLine(`[ConfigurationHandler] Skipping echo to ${this.lastUpdateSource}`);
    return;
  }
  ```
- Log skipped echoes to OutputChannel
- File: `src/application/handlers/domain/ConfigurationHandler.ts`

### Phase 5: Build Verification

**14. Run TypeScript compilation** (ongoing)
- Run: `npm run compile` after each handler
- Verify extension compiles without errors
- Webview will still have errors (Sprint 3 fixes those)

## Files Modified

- `src/application/handlers/domain/ConfigurationHandler.ts`
- `src/application/handlers/domain/AnalysisHandler.ts`
- `src/application/handlers/domain/MetricsHandler.ts`
- `src/application/handlers/domain/SearchHandler.ts`
- `src/application/handlers/domain/DictionaryHandler.ts`
- `src/application/handlers/domain/ContextHandler.ts`
- `src/application/handlers/domain/PublishingHandler.ts`
- `src/application/handlers/domain/SourcesHandler.ts`
- `src/application/handlers/domain/UIHandler.ts`
- `src/application/handlers/domain/FileOperationsHandler.ts`

**Total**: 10 files modified

## Acceptance Criteria

- ✅ All 10 domain handlers have `registerRoutes` methods
- ✅ All handlers registered in MessageHandler constructor
- ✅ All handler methods use `message.payload` pattern
- ✅ All postMessage calls use envelope with source
- ✅ Source naming follows conventions
- ✅ ConfigurationHandler implements echo prevention
- ✅ Extension compiles without errors
- ✅ Webview still has errors (expected - Sprint 3)

## Testing Checklist (Per-Domain)

After each handler update:
- [ ] Extension compiles successfully
- [ ] No TypeScript errors in that handler
- [ ] OutputChannel shows handler registered (if logging added)

After Phase 4 (Echo Prevention):
- [ ] Test in Extension Development Host (F5)
- [ ] Change model selection in settings
- [ ] Check OutputChannel for "Skipping echo" log
- [ ] Verify setting sticks (no revert)

## Risks/Notes

- **Must use `.bind(this)`** in registerRoutes or handlers lose context
- **Must add source to EVERY postMessage** - TypeScript will catch most, but check manually
- **Echo prevention timing** - 100ms timeout should be enough for config watcher
- **Test after each handler** - easier to debug than fixing all at once
- **OutputChannel logging** - critical for debugging echo prevention

## Common Patterns

**registerRoutes Template**:
```typescript
registerRoutes(router: MessageRouter): void {
  router.register(MessageType.X, this.handleX.bind(this));
  router.register(MessageType.Y, this.handleY.bind(this));
}
```

**Handler Method Template**:
```typescript
async handleX(message: XMessage): Promise<void> {
  const { field1, field2 } = message.payload;
  // ... use field1, field2
}
```

**postMessage Template**:
```typescript
this.postMessage({
  type: MessageType.X,
  source: 'extension.domain',
  payload: {
    field1: value1,
    field2: value2
  },
  timestamp: Date.now()
});
```

## Next Sprint

Sprint 3 will:
- Update webview hooks to use envelope
- Update webview message handlers to use payload
- Migrate persistence to new format
- Test everything manually
- Update documentation

## Links

- Epic: [epic-message-envelope.md](../epic-message-envelope.md)
- Sprint 1: [01-handler-registration-types.md](01-handler-registration-types.md)
- Sprint 3: [03-webview-migration-testing.md](03-webview-migration-testing.md)
- ADR: [docs/adr/2025-10-28-message-envelope-architecture.md](../../../../docs/adr/2025-10-28-message-envelope-architecture.md)
