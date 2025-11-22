# Sprint 03: Prop Drilling & Type Safety

**Sub-Epic**: [Foundation Cleanup](../epic-foundation-cleanup.md)
**Status**: Blocked by Sprint 02
**Priority**: HIGH
**Duration**: 4-6 hours
**Branch**: `sprint/foundation-cleanup-03-type-safety`

---

## Problem

Three related type safety issues:

1. **Untyped VSCode API**: `vscode: any` throughout presentation layer
2. **Untyped message handlers**: `message: any` in all domain hooks
3. **Excessive prop drilling**: 30-52 props per tab component

**Impact**:
- ❌ No IDE autocomplete for VSCode API or message payloads
- ❌ Runtime errors (typos in payloads not caught)
- ❌ Fragile refactoring (can't safely change message structures)
- ❌ Hard to maintain (30+ props per component)

---

## Solution

1. Create typed `VSCodeAPI` interface
2. Type all message handlers in domain hooks
3. Update all component prop interfaces
4. (Optional) Reduce prop count via composition

---

## Tasks

### Part 1: VSCode API Typing (1.5 hrs)

#### 1A: Create VSCodeAPI Interface
- [ ] Create file: `src/presentation/webview/types/vscode.ts`
- [ ] Define typed interface:

```typescript
import { MessageEnvelope } from '@messages';

export interface VSCodeAPI {
  postMessage<T>(message: MessageEnvelope<T>): void;
  getState(): any;
  setState(state: any): void;
}
```

- [ ] Export from types index (if exists)

#### 1B: Update useVSCodeApi Hook
- [ ] Open `src/presentation/webview/hooks/useVSCodeApi.ts`
- [ ] Import `VSCodeAPI` type
- [ ] Update return type:

```typescript
export const useVSCodeApi = (): VSCodeAPI => {
  const vsCodeRef = useRef<VSCodeAPI | null>(null);

  if (!vsCodeRef.current) {
    vsCodeRef.current = acquireVsCodeApi() as VSCodeAPI;
  }

  return vsCodeRef.current;
};
```

#### 1C: Update App.tsx
- [ ] Import `VSCodeAPI` from `'./types/vscode'`
- [ ] Update vscode variable type:

```typescript
const vscode: VSCodeAPI = useVSCodeApi();
```

#### 1D: Update Tab Component Props
Update all tab components:

- [ ] `AnalysisTab.tsx`:
```typescript
interface AnalysisTabProps {
  vscode: VSCodeAPI;  // was: any
  // ... other props
}
```

- [ ] `SearchTab.tsx`:
```typescript
interface SearchTabProps {
  vscode: VSCodeAPI;
  // ...
}
```

- [ ] `MetricsTab.tsx`:
```typescript
interface MetricsTabProps {
  vscode: VSCodeAPI;
  // ...
}
```

- [ ] `UtilitiesTab.tsx`:
```typescript
interface UtilitiesTabProps {
  vscode: VSCodeAPI;
  // ...
}
```

- [ ] `SettingsOverlay.tsx`:
```typescript
interface SettingsOverlayProps {
  vscode: VSCodeAPI;
  // ...
}
```

---

### Part 2: Message Handler Typing (2-3 hrs)

#### 2A: Import Message Types in Domain Hooks

For each domain hook, import the specific message types it handles.

**useAnalysis.ts**:
- [ ] Import types:
```typescript
import {
  AnalyzeDialogueMessage,
  AnalyzeProseMessage,
  AnalysisResultMessage,
  StatusMessage,
  GuideNamesMessage
} from '@messages';
```

- [ ] Type all handlers:
```typescript
const handleDialogueAnalysis = useCallback((message: AnalyzeDialogueMessage) => {
  // Typed payload access
}, []);

const handleResult = useCallback((message: AnalysisResultMessage) => {
  // Typed payload access
}, []);

const handleStatus = useCallback((message: StatusMessage) => {
  const { message: statusText } = message.payload;  // Type-safe!
}, []);
```

**useDictionary.ts**:
- [ ] Import types:
```typescript
import {
  DictionaryLookupMessage,
  DictionaryResultMessage,
  StatusMessage
} from '@messages';
```

- [ ] Type handlers:
```typescript
const handleLookup = useCallback((message: DictionaryLookupMessage) => {
  // ...
}, []);

const handleResult = useCallback((message: DictionaryResultMessage) => {
  // ...
}, []);
```

**useContext.ts**:
- [ ] Import types
- [ ] Type handlers

**useSearch.ts**:
- [ ] Import types
- [ ] Type handlers

**useMetrics.ts**:
- [ ] Import types
- [ ] Type handlers

**useSettings.ts**:
- [ ] Import types
- [ ] Type handlers

**useSelection.ts**:
- [ ] Import types
- [ ] Type handlers

**usePublishing.ts**:
- [ ] Import types
- [ ] Type handlers

**All other domain hooks**:
- [ ] Review each hook for `any` typed message handlers
- [ ] Import specific message types
- [ ] Type all handlers

---

### Part 3: Verify Type Safety (1 hr)

#### 3A: Check for Remaining `any` Types
- [ ] Search codebase:
```bash
grep -r "message: any" src/presentation/webview/hooks/domain/
grep -r "vscode: any" src/presentation/webview/components/
```

- [ ] Should return zero results

#### 3B: Test IDE Autocomplete
- [ ] Open a domain hook
- [ ] Type `message.payload.`
- [ ] Verify IDE shows available fields
- [ ] Test postMessage:
```typescript
vscode.postMessage({
  type: MessageType.ANALYZE_DIALOGUE,
  payload: {
    // IDE should autocomplete payload fields
  }
})
```

#### 3C: Test TypeScript Compilation
- [ ] Run: `npm run build`
- [ ] Should have no type errors
- [ ] Fix any errors that surface (these are bugs caught!)

---

### Part 4: Optional - Reduce Prop Drilling (1-2 hrs)

**Note**: This is optional. Can be deferred if time constrained.

#### 4A: Pass Entire Hook Returns
Instead of spreading props, pass entire hook objects:

**Before**:
```tsx
<AnalysisTab
  result={analysis.result}
  isLoading={analysis.isLoading}
  statusMessage={analysis.statusMessage}
  guideNames={analysis.guideNames}
  onLoadingChange={analysis.setLoading}
  // ... 30 more props
/>
```

**After**:
```tsx
<AnalysisTab
  vscode={vscode}
  analysis={analysis}
  context={context}
  selection={selection}
/>
```

- [ ] Update AnalysisTab to accept hook objects
- [ ] Update SearchTab
- [ ] Update MetricsTab
- [ ] Update UtilitiesTab

#### 4B: Or Use Context API
For deeply-nested settings:

- [ ] Create `SettingsContext.tsx`
- [ ] Wrap App with provider
- [ ] Components use `useSettingsContext()` hook

**Note**: Only do this if prop drilling is causing real pain. Don't over-engineer.

---

## Acceptance Criteria

### VSCode API Typing
- ✅ `VSCodeAPI` interface defined and exported
- ✅ All components use `VSCodeAPI` (not `any`)
- ✅ `useVSCodeApi` returns typed API
- ✅ IDE autocomplete works for postMessage

### Message Handler Typing
- ✅ All domain hooks import specific message types
- ✅ All message handlers have explicit types (no `any`)
- ✅ Type-safe payload access throughout
- ✅ IDE autocomplete works for message payloads

### Code Quality
- ✅ Zero `message: any` in domain hooks
- ✅ Zero `vscode: any` in components
- ✅ TypeScript compilation succeeds with no errors
- ✅ All tests pass: `npm test`

### Optional - Prop Reduction
- ✅ Prop count reduced by 50%+ (if implemented)
- ✅ Components easier to understand (if implemented)

---

## Files to Create

```
src/presentation/webview/types/
└─ vscode.ts
```

## Files to Update

### Hooks
```
src/presentation/webview/hooks/
├─ useVSCodeApi.ts
└─ domain/
    ├─ useAnalysis.ts
    ├─ useDictionary.ts
    ├─ useContext.ts
    ├─ useSearch.ts
    ├─ useMetrics.ts
    ├─ useSettings.ts
    ├─ useSelection.ts
    ├─ usePublishing.ts
    └─ (all other domain hooks)
```

### Components
```
src/presentation/webview/components/
├─ App.tsx
├─ AnalysisTab.tsx
├─ SearchTab.tsx
├─ MetricsTab.tsx
├─ UtilitiesTab.tsx
└─ SettingsOverlay.tsx
```

---

## Testing Checklist

### Type Safety Verification
- [ ] Run: `npm run build`
- [ ] Check: Zero TypeScript errors
- [ ] Test: IDE autocomplete for `vscode.postMessage`
- [ ] Test: IDE autocomplete for `message.payload`
- [ ] Search: `grep -r "vscode: any" src/presentation/` (should be 0 results)
- [ ] Search: `grep -r "message: any" src/presentation/` (should be 0 results)

### Functional Testing
- [ ] Open extension in dev mode
- [ ] Test Analysis tab: analyze dialogue, analyze prose
- [ ] Test Dictionary tab: lookup word
- [ ] Test Context tab: generate context
- [ ] Test Search tab: word search, category search
- [ ] Test Metrics tab: prose stats, style flags, word frequency
- [ ] Verify: All features work as before
- [ ] Check: Console has no new errors

### Automated Testing
- [ ] Run: `npm test`
- [ ] Verify: All tests pass
- [ ] Fix: Any tests broken by type changes

---

## Expected Bugs to Surface

When adding type safety, you may discover bugs:

1. **Typos in payload fields** (now caught at compile time)
2. **Missing required fields** (TypeScript will complain)
3. **Wrong types** (e.g., passing string instead of number)

**This is good!** These are bugs that existed but were hidden by `any` types.

Fix each one as you encounter them.

---

## References

**Architecture Debt**:
- [2025-11-19-prop-drilling-and-type-safety.md](../../../architecture-debt/2025-11-19-prop-drilling-and-type-safety.md)

**Related ADRs**:
- [ADR: Presentation Layer Domain Hooks](../../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- [ADR: Message Envelope Architecture](../../../../docs/adr/2025-10-28-message-envelope-architecture.md)

**Message Types**:
- [src/shared/types/messages/](../../../../src/shared/types/messages/)

---

## Outcomes (Post-Sprint)

*To be filled after sprint completion*

**Completion Date**:
**Actual Duration**:
**PR**:
**Bugs Discovered**: (list any bugs caught by type safety)
**Prop Count Reduction**: (before/after, if implemented)
**Lessons Learned**:

---

**Created**: 2025-11-21
**Status**: Blocked by Sprint 02
**Previous**: [02-shared-types-imports-hygiene.md](02-shared-types-imports-hygiene.md)
**Next**: Sub-Epic 2 (Component Decomposition)
