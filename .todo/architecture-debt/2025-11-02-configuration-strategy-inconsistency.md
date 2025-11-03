# Configuration Strategy Inconsistency (Tech Debt)

**Date Identified**: 2025-11-02
**Severity**: Medium
**Category**: Architecture / State Management
**Status**: Documented - Not Yet Addressed

## Problem

The webview has **two different strategies** for managing configuration settings, creating inconsistency and confusion about which pattern to use for new features.

## Current State

### Strategy 1: Domain Hooks (with Persistence)
**Used By**: Publishing Standards

**Pattern**:
```typescript
// Hook: usePublishing.ts
const usePublishing = () => {
  const [publishingPreset, setPublishingPresetState] = useState('none');

  const setPublishingPreset = (preset: string) => {
    setPublishingPresetState(preset);
    vscode.postMessage({ type: MessageType.SET_PUBLISHING_PRESET, ... });
  };

  return { publishingPreset, setPublishingPreset, persistedState: { publishingPreset } };
};

// Component: SettingsOverlay.tsx + MetricsTab.tsx
const publishing = usePublishing();
<select value={publishing.publishingPreset} onChange={(e) => publishing.setPublishingPreset(e.target.value)} />
```

**Flow**:
1. User changes setting in UI
2. Hook updates local state + sends message to backend
3. Backend updates VSCode workspace config
4. Backend sends PUBLISHING_STANDARDS_DATA back to webview
5. Hook handler updates state
6. usePersistence composes hook state into vscode.setState()
7. Multiple components read from same hook (single source of truth)

**Benefits**:
- ✅ Single source of truth across multiple components
- ✅ Persistent state via usePersistence
- ✅ Clean React patterns (hooks)
- ✅ Encapsulated domain logic

**Drawbacks**:
- ⚠️ More complex setup (hook + handler + persistence)
- ⚠️ Requires wiring through App.tsx

### Strategy 2: Message-Based (Local State + Sync)
**Used By**: Word Frequency Character Length Filter

**Pattern**:
```typescript
// Component: MetricsTab.tsx
const [minCharLength, setMinCharLength] = useState(1);

React.useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data.type === MessageType.SETTINGS_DATA) {
      setMinCharLength(event.data.settings['wordFrequency.minCharacterLength']);
    }
  };
  window.addEventListener('message', handler);
  vscode.postMessage({ type: MessageType.REQUEST_SETTINGS_DATA });
}, []);

const handleFilterChange = (value: number) => {
  setMinCharLength(value);
  vscode.postMessage({ type: MessageType.UPDATE_SETTING, payload: { key: 'wordFrequency.minCharacterLength', value } });
};
```

**Flow**:
1. User changes setting in UI
2. Component updates local state + sends UPDATE_SETTING message
3. Backend updates VSCode workspace config
4. Config watcher detects change + sends SETTINGS_DATA back
5. Component listener updates state
6. State lives only in one component (not shared)

**Benefits**:
- ✅ Simple setup (no hook needed)
- ✅ Self-contained in single component
- ✅ Direct message passing

**Drawbacks**:
- ⚠️ No persistence (lost on reload unless synced from backend)
- ⚠️ State duplication if multiple components need it
- ⚠️ Listeners in useEffect (less declarative than hooks)

## Inconsistency Impact

### For Developers
1. **Confusion**: Which pattern should I use for a new setting?
2. **Inconsistent Code**: Two different patterns for same behavior
3. **Maintenance**: Two patterns = more cognitive load
4. **Scalability**: What if 5 more components need word frequency filter state?

### For Features
1. **Publishing Standards**: Uses hook → easily shared between SettingsOverlay + MetricsTab
2. **Word Frequency Filter**: Uses messages → only in MetricsTab, would need duplication to share

### Example Scenario
If we want to add word frequency filter to a future "Advanced Metrics" tab:
- **Hook pattern**: Just use `const wordFreq = useWordFrequency()` - done ✅
- **Message pattern**: Duplicate state + listeners + handlers in new component ❌

## Discovered During

**Epic**: Word Length Filter Metrics (2025-11-02)
**Sprint**: Sprint 02 - Frontend UI & Backend Filtering
**Commits**:
- ae22523 (Publishing Standards hook connection)
- 1fc71f5 (Word Frequency filter message-based)

During Sprint 02, we implemented word frequency filter using message-based approach, then immediately encountered Publishing Standards using hook-based approach. The inconsistency became obvious when fixing Publishing Standards state synchronization.

## Recommended Resolution

### Option A: Migrate All to Domain Hooks (Preferred)

**Approach**: Create `useSettings()` or `useWordFrequency()` hook that manages word frequency filter state just like `usePublishing()` manages publishing standards.

**Benefits**:
- ✅ Consistent architecture across all settings
- ✅ Follows presentation layer domain hooks pattern (ADR 2025-10-27)
- ✅ Easy to share state across components
- ✅ Persistence built-in via usePersistence
- ✅ Declarative React patterns

**Implementation**:
```typescript
// New hook: useWordFrequency.ts
export const useWordFrequency = () => {
  const [minCharLength, setMinCharLengthState] = useState(1);

  const setMinCharLength = (value: number) => {
    setMinCharLengthState(value);
    vscode.postMessage({ type: MessageType.UPDATE_SETTING, payload: { key: 'wordFrequency.minCharacterLength', value } });
  };

  const handleSettingsData = (message) => {
    setMinCharLengthState(message.settings['wordFrequency.minCharacterLength'] ?? 1);
  };

  return { minCharLength, setMinCharLength, handleSettingsData, persistedState: { minCharLength } };
};

// App.tsx
const wordFreq = useWordFrequency();
useMessageRouter({ [MessageType.SETTINGS_DATA]: wordFreq.handleSettingsData });

// MetricsTab.tsx
<WordLengthFilterTabs activeFilter={wordFreq.minCharLength} onFilterChange={wordFreq.setMinCharLength} />
```

**Effort**: 1-2 hours

### Option B: Migrate All to Message-Based

**Approach**: Convert `usePublishing()` hook back to message-based pattern like word frequency filter.

**Benefits**:
- ✅ Simpler for single-component usage
- ✅ No hook infrastructure needed

**Drawbacks**:
- ❌ State duplication when multiple components need it
- ❌ No persistence without extra work
- ❌ Goes against presentation layer domain hooks architecture

**Recommendation**: ❌ Not recommended - violates ADR 2025-10-27

### Option C: Define Clear Architectural Boundary (Compromise)

**Approach**: Establish guidelines for when to use each pattern.

**Guidelines**:
- **Use Hooks**: Multi-component settings, complex state, persistence needed
  - Examples: Publishing standards, model selections, context paths
- **Use Messages**: Single-component settings, simple toggles, ephemeral state
  - Examples: Loading states, temporary UI flags, one-off actions

**Benefits**:
- ✅ Flexibility for simple cases
- ✅ Guidance for complex cases

**Drawbacks**:
- ⚠️ Still requires judgment call
- ⚠️ Boundary may shift over time

### Recommendation: Option A (Migrate to Hooks)

**Rationale**:
1. Follows presentation layer domain hooks pattern (ADR 2025-10-27)
2. Scalable for future features (easy to share state)
3. Consistent with existing architecture (Settings, Publishing, Context, etc.)
4. Persistence built-in
5. Cleaner React patterns

**Caveat**: Option C is acceptable if we establish VERY clear guidelines and document them in ARCHITECTURE.md.

## Related Documentation

- **ADR**: [docs/adr/2025-10-27-presentation-layer-domain-hooks.md](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- **Epic**: [.todo/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md](../../epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md)
- **Memory Bank**: [.memory-bank/20251102-2030-word-length-filter-epic-complete.md](../../../.memory-bank/20251102-2030-word-length-filter-epic-complete.md)

## Affected Files

**Current Hook-Based Settings**:
- `usePublishing.ts` (publishing standards preset, trim size)
- `useSettings.ts` (general settings, model selections, API key)
- `useContext.ts` (context paths, resources)
- `useSelection.ts` (selection source metadata)

**Current Message-Based Settings**:
- `MetricsTab.tsx` (word frequency minCharacterLength)

**Future Risk**:
- Any new settings added without clear guidance may use either pattern arbitrarily

## Action Items

1. **Decide on Strategy**: Team discussion to choose Option A, B, or C
2. **Document Decision**: Update ARCHITECTURE.md with chosen pattern and guidelines
3. **Implement Migration** (if Option A):
   - Create `useWordFrequency.ts` hook
   - Migrate `MetricsTab.tsx` to use hook
   - Wire hook through App.tsx
   - Add to usePersistence composition
4. **Prevent Future Inconsistency**: Code review checklist item for new settings
5. **Update Agent Guide**: Add guidance to .claude/CLAUDE.md about settings patterns

## Priority

**Medium**: Not blocking, but impacts maintainability and scalability. Should address within next 2-3 sprints to prevent further inconsistency.

## Notes

- This tech debt was discovered organically during implementation, not planned
- Publishing Standards already demonstrates the hook pattern works well
- Word Frequency filter is only one component using message-based (easy to migrate)
- Early adoption of consistent pattern prevents future debt accumulation
