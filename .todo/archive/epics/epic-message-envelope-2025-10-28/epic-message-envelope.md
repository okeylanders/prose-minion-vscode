# Epic: Message Envelope Architecture & Handler Registration

## Status

**10-28-2025**: Not Started

## Sprint Plan: 2025-10-28

This epic refactors the message architecture to solve fundamental problems with message routing and configuration event handling. Implements handler-registered strategy pattern and standardized message envelope with source tracking.

## Objectives

- Reduce MessageHandler from 495 lines to ~200 lines (60% reduction)
- Eliminate switch-based routing with handler registration pattern
- Implement standardized message envelope with source tracking
- Solve configuration echo-back race conditions permanently
- Enable source-based echo prevention in ConfigurationHandler
- Establish consistent message structure across all ~50+ message types
- Improve debugging with source tracking in all messages
- Enable future enhancements (correlation IDs, tracing, middleware)

## References

- ADR: [docs/adr/2025-10-28-message-envelope-architecture.md](../../../docs/adr/2025-10-28-message-envelope-architecture.md)
- Planning Doc: [.planning/architecture-refactor-message-routing-and-config-events.md](../../../.planning/architecture-refactor-message-routing-and-config-events.md)
- Related ADR: [docs/adr/2025-10-27-presentation-layer-domain-hooks.md](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md) (presentation refactor that exposed these issues)
- Related ADR: [docs/adr/2025-10-26-message-architecture-organization.md](../../../docs/adr/2025-10-26-message-architecture-organization.md) (backend domain handlers)

## Context

The presentation hooks refactor (completed 2025-10-27) exposed fundamental architectural problems:

### Core Problems

1. **Switch-Based Routing** - MessageHandler uses 30+ case switch, handlers are passive
2. **Configuration Race Conditions** - Settings updates echo back from config watcher, causing state thrashing
3. **Multiple Sources of Truth** - VSCode config, frontend state, backend cache, service state
4. **Unclear Ownership** - No clear answer to "who responds to model selection changes?"
5. **Inconsistent Message Structure** - No standard envelope, can't track message origin
6. **Temporal Coupling** - VSCode config async save but sync read returns stale values

### Real-World Impact

Settings screen completely broken after presentation hooks refactor:
- Model dropdowns show wrong values
- Text inputs revert while typing
- UI flickers from competing updates
- Config changes trigger duplicate service refreshes

**Root Cause**: Architectural problems, not implementation bugs. Patching won't work.

## Scope Overview

1. **Handler Registration (Critical)** — MessageRouter with strategy pattern
2. **Message Envelope Types (Critical)** — StandardEnvelope interface, update all ~50+ message types
3. **Extension-Side Migration (Critical)** — Update 10 domain handlers to register routes and use payload
4. **Webview-Side Migration (Critical)** — Update 7 domain hooks to use payload
5. **Echo Prevention (Critical)** — Source-based echo filtering in ConfigurationHandler
6. **Persistence Migration (Required)** — Drop old state format, support new envelope format
7. **Testing (Required)** — Per-domain testing, settings echo testing, integration testing
8. **Documentation (Required)** — Update ARCHITECTURE.md, create memory bank entry

Out-of-scope: Correlation IDs, message tracing middleware, advanced routing (future epic)

## Milestones and Work Items

### Sprint 1 — Handler Registration + Message Envelope Types (Day 1)

**Goal**: Implement MessageRouter, define envelope types, let TypeScript guide the migration

**Estimated Time**: 4-6 hours

**Phase 1: MessageRouter Implementation**

1. Create MessageRouter class
   - Map-based strategy pattern: `MessageType → Handler`
   - `register(type, handler)` method with duplicate detection
   - `route(message)` method with missing handler detection
   - Clear error messages for debugging
   - File: `src/application/handlers/MessageRouter.ts` (new)

2. Update MessageHandler to use router
   - Remove switch statement (lines 176-304)
   - Instantiate MessageRouter
   - Call `handler.registerRoutes(router)` for each domain handler
   - Replace `handleMessage` body with `await this.router.route(message)`
   - Preserve all existing constructor dependencies
   - File: `src/application/handlers/MessageHandler.ts`

**Phase 2: Message Envelope Type Definitions**

3. Define MessageEnvelope interface
   - Generic type: `MessageEnvelope<TPayload>`
   - Required fields: `type`, `source`, `payload`, `timestamp`
   - Optional fields: `target`, `correlationId`
   - Source type: `'extension.${string}' | 'webview.${string}' | 'unknown'`
   - File: `src/shared/types/messages/base.ts`

4. Update all message type interfaces (11 domain files)
   - Extract payload types: `*Payload` interfaces
   - Update message interfaces to extend `MessageEnvelope<*Payload>`
   - Remove payload fields from message interface (now in payload type)
   - Files:
     - `src/shared/types/messages/analysis.ts`
     - `src/shared/types/messages/dictionary.ts`
     - `src/shared/types/messages/context.ts`
     - `src/shared/types/messages/metrics.ts`
     - `src/shared/types/messages/search.ts`
     - `src/shared/types/messages/configuration.ts`
     - `src/shared/types/messages/publishing.ts`
     - `src/shared/types/messages/sources.ts`
     - `src/shared/types/messages/ui.ts`
     - `src/shared/types/messages/results.ts`
     - `src/shared/types/messages/base.ts`

5. Run TypeScript compilation
   - `npm run compile`
   - Expect ~200+ errors showing exactly what to fix
   - Save error output as refactoring TODO list
   - DO NOT fix errors yet (Sprint 2)

**Affected Files (Sprint 1)**:
- src/application/handlers/MessageRouter.ts (new)
- src/application/handlers/MessageHandler.ts (update)
- src/shared/types/messages/*.ts (11 files, update)

**Acceptance Criteria**:
- ✅ MessageRouter class implemented with clear error handling
- ✅ MessageHandler uses router instead of switch statement
- ✅ MessageEnvelope interface defined with generic payload
- ✅ All ~50+ message types updated to use envelope pattern
- ✅ TypeScript compilation fails with ~200+ errors (expected)
- ✅ Error list saved for Sprint 2 reference

**Risks/Notes**:
- TypeScript errors are EXPECTED and DESIRED (they guide Sprint 2)
- DO NOT attempt to fix errors in Sprint 1 (type definitions only)
- MessageRouter must detect duplicate registrations
- MessageRouter must error on unhandled message types

**Commit Pattern**: `[sprint-1] feat(messages): ...`

---

### Sprint 2 — Extension-Side Migration (Day 2)

**Goal**: Update all extension-side code to use envelope pattern and handler registration

**Estimated Time**: 6-8 hours

**Phase 1: Domain Handler Registration (2 hours)**

1. Update ConfigurationHandler
   - Add `registerRoutes(router: MessageRouter)` method
   - Register: REQUEST_MODEL_DATA, UPDATE_SETTING, SET_MODEL_SELECTION, REQUEST_SETTINGS_DATA, SET_API_KEY, DELETE_API_KEY
   - Bind all handler methods in registration
   - File: `src/application/handlers/domain/ConfigurationHandler.ts`

2. Update AnalysisHandler
   - Add `registerRoutes(router: MessageRouter)` method
   - Register: ANALYZE_DIALOGUE, ANALYZE_PROSE, REQUEST_CONTEXT, REQUEST_ANALYSIS_GUIDE
   - Bind all handler methods in registration
   - File: `src/application/handlers/domain/AnalysisHandler.ts`

3. Update MetricsHandler
   - Add `registerRoutes(router: MessageRouter)` method
   - Register: RUN_METRICS, REQUEST_ACTIVE_FILE, REQUEST_MANUSCRIPT_GLOBS, REQUEST_CHAPTER_GLOBS
   - Bind all handler methods in registration
   - File: `src/application/handlers/domain/MetricsHandler.ts`

4. Update SearchHandler
   - Add `registerRoutes(router: MessageRouter)` method
   - Register: RUN_WORD_SEARCH
   - Bind handler method in registration
   - File: `src/application/handlers/domain/SearchHandler.ts`

5. Update DictionaryHandler
   - Add `registerRoutes(router: MessageRouter)` method
   - Register: RUN_DICTIONARY
   - Bind handler method in registration
   - File: `src/application/handlers/domain/DictionaryHandler.ts`

6. Update ContextHandler
   - Add `registerRoutes(router: MessageRouter)` method
   - Register: REQUEST_CONTEXT
   - Bind handler method in registration
   - File: `src/application/handlers/domain/ContextHandler.ts`

7. Update PublishingHandler
   - Add `registerRoutes(router: MessageRouter)` method
   - Register: REQUEST_PUBLISHING_STANDARDS_DATA
   - Bind handler method in registration
   - File: `src/application/handlers/domain/PublishingHandler.ts`

8. Update SourcesHandler
   - Add `registerRoutes(router: MessageRouter)` method
   - Register: REQUEST_ACTIVE_FILE, REQUEST_MANUSCRIPT_GLOBS, REQUEST_CHAPTER_GLOBS
   - Bind all handler methods in registration
   - File: `src/application/handlers/domain/SourcesHandler.ts`

9. Update UIHandler
   - Add `registerRoutes(router: MessageRouter)` method
   - Register: REQUEST_SELECTION, REQUEST_ANALYSIS_GUIDE, CHANGE_TAB
   - Bind all handler methods in registration
   - File: `src/application/handlers/domain/UIHandler.ts`

10. Update FileOperationsHandler
    - Add `registerRoutes(router: MessageRouter)` method
    - Register: COPY_RESULT, SAVE_RESULT
    - Bind all handler methods in registration
    - File: `src/application/handlers/domain/FileOperationsHandler.ts`

**Phase 2: Handler Method Updates (3 hours)**

11. Update all handler methods to use payload
    - Change `message.field` → `message.payload.field`
    - Update ~30+ handler methods across 10 files
    - Fix TypeScript errors as you go
    - Files: All domain handlers (10 files)

**Phase 3: postMessage Updates (2 hours)**

12. Update all `postMessage` calls to use envelope
    - Add `source` field (e.g., `'extension.configuration'`)
    - Wrap fields in `payload: {}`
    - Add `timestamp: Date.now()`
    - Update ~50+ postMessage calls across 10 files
    - Files: All domain handlers (10 files)

**Phase 4: Echo Prevention (1 hour)**

13. Implement source-based echo prevention
    - Add `lastUpdateSource?: string` to ConfigurationHandler
    - Track source in handleUpdateSetting
    - Check source in sendModelData
    - Skip echo if source starts with 'webview.'
    - Log skipped echoes to OutputChannel
    - File: `src/application/handlers/domain/ConfigurationHandler.ts`

**Phase 5: Build Verification**

14. Run TypeScript compilation
    - `npm run compile`
    - Fix any remaining extension-side errors
    - Extension should compile cleanly
    - Webview will still have errors (Sprint 3)

**Affected Files (Sprint 2)**:
- src/application/handlers/domain/ConfigurationHandler.ts
- src/application/handlers/domain/AnalysisHandler.ts
- src/application/handlers/domain/MetricsHandler.ts
- src/application/handlers/domain/SearchHandler.ts
- src/application/handlers/domain/DictionaryHandler.ts
- src/application/handlers/domain/ContextHandler.ts
- src/application/handlers/domain/PublishingHandler.ts
- src/application/handlers/domain/SourcesHandler.ts
- src/application/handlers/domain/UIHandler.ts
- src/application/handlers/domain/FileOperationsHandler.ts

**Acceptance Criteria**:
- ✅ All 10 domain handlers have registerRoutes methods
- ✅ All handlers registered in MessageHandler constructor
- ✅ All handler methods use message.payload pattern
- ✅ All postMessage calls use envelope pattern with source
- ✅ ConfigurationHandler implements echo prevention
- ✅ Extension code compiles without errors
- ✅ All ~50+ extension-side message sends use envelope

**Testing Checklist (Per-Domain)**:
- Test each domain after updating its handler
- Verify messages send correctly (check OutputChannel)
- Verify source appears in logs
- Test ConfigurationHandler echo prevention specifically

**Risks/Notes**:
- Must bind handler methods in registration (use .bind(this))
- Must add source to EVERY postMessage call
- Echo prevention requires careful testing
- OutputChannel logging critical for debugging

**Commit Pattern**: `[sprint-2] feat(handlers): ...`

---

### Sprint 3 — Webview-Side Migration + Testing (Day 3)

**Goal**: Update webview code to use envelope pattern, test everything, ship

**Estimated Time**: 6-8 hours

**Phase 1: Webview postMessage Updates (2 hours)**

1. Update useSettings hook
   - All postMessage calls: add source, wrap payload
   - Source: `'webview.settings.overlay'`
   - Update ~10+ message sends
   - File: `src/presentation/webview/hooks/domain/useSettings.ts`

2. Update useAnalysis hook
   - All postMessage calls: add source, wrap payload
   - Source: `'webview.analysis.tab'`
   - Update ~5+ message sends
   - File: `src/presentation/webview/hooks/domain/useAnalysis.ts`

3. Update useMetrics hook
   - All postMessage calls: add source, wrap payload
   - Source: `'webview.metrics.tab'`
   - Update ~10+ message sends
   - File: `src/presentation/webview/hooks/domain/useMetrics.ts`

4. Update useSearch hook
   - All postMessage calls: add source, wrap payload
   - Source: `'webview.search.tab'`
   - Update ~3+ message sends
   - File: `src/presentation/webview/hooks/domain/useSearch.ts`

5. Update useDictionary hook
   - All postMessage calls: add source, wrap payload
   - Source: `'webview.dictionary.tab'`
   - Update ~3+ message sends
   - File: `src/presentation/webview/hooks/domain/useDictionary.ts`

6. Update useContext hook
   - All postMessage calls: add source, wrap payload
   - Source: `'webview.context.assistant'`
   - Update ~3+ message sends
   - File: `src/presentation/webview/hooks/domain/useContext.ts`

7. Update useSelection hook
   - All postMessage calls: add source, wrap payload
   - Source: `'webview.selection'`
   - Update ~5+ message sends
   - File: `src/presentation/webview/hooks/domain/useSelection.ts`

**Phase 2: Webview Message Handler Updates (2 hours)**

8. Update all message handlers to use payload
   - Change `message.field` → `message.payload.field`
   - Update handler functions in useMessageRouter registrations
   - Update ~40+ handler functions across 7 hooks
   - Files: All domain hooks (7 files)

**Phase 3: Persistence Migration (1 hour)**

9. Update usePersistence to drop old state
   - Add version check in loadPersistedState
   - Drop state if `!state.version`
   - Log state drop to console
   - Current persisted state WILL BE LOST (alpha - acceptable)
   - File: `src/presentation/webview/hooks/usePersistence.ts`

10. Add version to persisted state
    - Include `version: 1` in persisted state object
    - Future state migrations can check version
    - File: `src/presentation/webview/hooks/usePersistence.ts`

**Phase 4: Build Verification (30 min)**

11. Run full build
    - `npm run build`
    - Verify both extension and webview compile
    - Fix any remaining TypeScript errors
    - Verify bundle sizes reasonable (~380 KiB webview)

**Phase 5: Manual Testing (2-3 hours)**

12. Settings Echo Prevention Testing
    - Change model selection in settings dropdown
    - Verify no flicker, value sticks
    - Check OutputChannel for "Skipping echo" log
    - Change setting in settings.json directly
    - Verify webview updates from external change
    - Toggle UI setting (token widget)
    - Verify immediate update, no flicker

13. Per-Domain Functionality Testing
    - **Analysis Tab**:
      - Run dialogue analysis
      - Run prose analysis
      - Verify results display
      - Test context assistant
      - Test guide selection
    - **Metrics Tab**:
      - Run prose stats
      - Run style flags
      - Run word frequency
      - Test scope selection (Active File, Manuscripts, Chapters, Selection)
      - Verify subtool switching
    - **Utilities Tab**:
      - Run dictionary lookup
      - Verify word/context inputs persist
      - Test paste selection
    - **Search Tab**:
      - Run word search
      - Verify results display
      - Test target selection

14. Persistence Testing
    - Make changes in each tab
    - Refresh webview (Cmd+R / Ctrl+R)
    - Verify state DOES NOT persist (old format dropped)
    - Make new changes
    - Refresh webview
    - Verify state DOES persist (new format)

15. Integration Testing
    - Test all tabs in sequence
    - Test settings overlay open/close
    - Test token widget toggle
    - Test file save operations
    - Test copy operations
    - Verify no console errors
    - Verify OutputChannel logs look correct

**Phase 6: Documentation (1 hour)**

16. Update ARCHITECTURE.md
    - Document MessageRouter pattern
    - Document MessageEnvelope structure
    - Document source naming conventions
    - Add message flow diagrams (if helpful)
    - File: `docs/ARCHITECTURE.md`

17. Create memory bank entry
    - Summarize epic outcomes
    - Link to ADR and epic
    - Document metrics (line counts, bug fixes)
    - List breaking changes
    - Note state format change
    - File: `.memory-bank/20251028-HHMM-message-envelope-refactor.md`

18. Update .planning document
    - Mark as IMPLEMENTED
    - Add link to memory bank entry
    - Add link to merged branch
    - File: `.planning/architecture-refactor-message-routing-and-config-events.md`

**Affected Files (Sprint 3)**:
- src/presentation/webview/hooks/domain/useSettings.ts
- src/presentation/webview/hooks/domain/useAnalysis.ts
- src/presentation/webview/hooks/domain/useMetrics.ts
- src/presentation/webview/hooks/domain/useSearch.ts
- src/presentation/webview/hooks/domain/useDictionary.ts
- src/presentation/webview/hooks/domain/useContext.ts
- src/presentation/webview/hooks/domain/useSelection.ts
- src/presentation/webview/hooks/usePersistence.ts
- docs/ARCHITECTURE.md
- .memory-bank/20251028-HHMM-message-envelope-refactor.md
- .planning/architecture-refactor-message-routing-and-config-events.md

**Acceptance Criteria**:
- ✅ All webview postMessage calls use envelope with source
- ✅ All webview message handlers use payload pattern
- ✅ Persistence drops old state format
- ✅ Persistence saves new state format with version
- ✅ Full build succeeds (extension + webview)
- ✅ Settings echo prevention works (no flicker)
- ✅ All tabs function correctly
- ✅ All domains tested manually
- ✅ Persistence works with new format
- ✅ No console errors or warnings
- ✅ OutputChannel logs show sources
- ✅ ARCHITECTURE.md updated
- ✅ Memory bank entry created
- ✅ Planning doc marked complete

**Testing Checklist (Comprehensive)**:
- [ ] Settings: Model selection no echo/flicker
- [ ] Settings: External config changes propagate
- [ ] Settings: UI toggles work immediately
- [ ] Analysis: Dialogue analysis works
- [ ] Analysis: Prose analysis works
- [ ] Analysis: Context assistant works
- [ ] Metrics: All 3 subtools work
- [ ] Metrics: Scope selection works
- [ ] Metrics: Subtool switching works
- [ ] Dictionary: Lookup works
- [ ] Dictionary: Inputs persist
- [ ] Dictionary: Paste selection works
- [ ] Search: Word search works
- [ ] Search: Results display correctly
- [ ] Persistence: Old state dropped
- [ ] Persistence: New state persists
- [ ] Copy: All copy buttons work
- [ ] Save: All save buttons work
- [ ] Save: Files open after save
- [ ] Token widget: Toggle works
- [ ] Token widget: Reset works
- [ ] No console errors
- [ ] OutputChannel logs correct

**Risks/Notes**:
- Persistence state will be lost (users re-select models)
- Must test settings echo prevention thoroughly
- Must test external config changes (settings.json edits)
- Must verify all ~40+ message handlers updated
- Must verify all ~40+ message sends updated

**Commit Pattern**: `[sprint-3] feat(webview): ...`, `[sprint-3] docs: ...`, `[sprint-3] test: ...`

---

## Cross-Cutting Concerns

- **Architecture Consistency**: Handler registration mirrors backend domain handler pattern
- **Debugging**: Source tracking in all messages enables better troubleshooting
- **Maintainability**: No more switch statement, handlers own their routes
- **Extensibility**: Adding new message types = register handler, don't modify orchestrator
- **Type Safety**: MessageEnvelope with generic payload enforces correct structure
- **Performance**: Map lookup similar performance to switch statement
- **Testing**: Can test MessageRouter and handlers independently

## Review & Verification Cadence

- Test TypeScript compilation after Sprint 1 (expect errors)
- Test extension compilation after Sprint 2 (should succeed)
- Test full build after Sprint 3 Phase 4 (should succeed)
- Test per-domain after each handler update (Sprint 2)
- Test settings echo prevention specifically (Sprint 3)
- Test all tabs manually before shipping (Sprint 3)

## Definition of Done

- ADR finalized and committed with accepted status
- MessageRouter implemented and tested
- All ~50+ message types use envelope pattern
- All 10 domain handlers register their routes
- All ~100+ message sends use envelope with source
- ConfigurationHandler implements echo prevention
- Settings screen works without flicker/echo
- All tabs function correctly
- Persistence migrates to new format
- Full build succeeds (extension + webview)
- Comprehensive manual testing completed
- No console errors or warnings
- OutputChannel logs show sources correctly
- ARCHITECTURE.md updated
- Memory bank entry created
- Planning doc marked complete
- All changes committed with descriptive messages
- Branch merged back into presentation-refactor branch

## Success Metrics

- **Code Reduction**: MessageHandler 495 → ~200 lines (60%)
- **Bug Elimination**: Settings echo bugs 5+ → 0
- **Message Consistency**: All ~50+ types use envelope
- **Source Tracking**: All messages include source (100%)
- **Architecture**: Switch statement → Strategy pattern
- **Ownership**: Handlers register their own routes
- **Debugging**: Source in logs enables faster troubleshooting

## Future Work (Separate Epics)

- Correlation IDs for request/response tracking
- Message tracing middleware for debugging
- Advanced routing based on target hints
- Message replay for testing/debugging
- Performance profiling of message routing
- WebSocket for bidirectional streaming (if needed)
- Message queue for offline operation

## Risks and Mitigations

**Risk**: Breaking changes affect users
**Mitigation**: Alpha software, no releases yet. Can reset to main if needed.

**Risk**: TypeScript errors overwhelming
**Mitigation**: Errors are our TODO list. Work domain-by-domain, test frequently.

**Risk**: Persistence state loss
**Mitigation**: Acceptable in alpha. Users re-select models, takes 30 seconds.

**Risk**: Echo prevention doesn't work
**Mitigation**: Thorough testing in Sprint 3. OutputChannel logging for debugging.

**Risk**: Missed message sends during migration
**Mitigation**: TypeScript will catch most. Manual testing catches rest.

**Risk**: Performance degradation from map lookup
**Mitigation**: Map lookup is O(1), same as switch. No measurable difference.
