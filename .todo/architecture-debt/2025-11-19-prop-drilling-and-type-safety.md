# Prop Drilling & Type Safety Issues

**Date Identified**: 2025-11-19
**Identified During**: Presentation Layer Architecture Review
**Priority**: High
**Estimated Effort**: 4-6 hours

## Problem

Tab components receive excessive props (30-52 each) creating prop drilling from App.tsx. Additionally, the VSCode API is untyped (`any`) throughout the presentation layer, losing type safety.

## Current Implementation

### Excessive Prop Drilling

**AnalysisTab.tsx** - 34 props:
```typescript
interface AnalysisTabProps {
  selectedText?: string;
  vscode: any;
  result: string;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  excerptText: string;
  onExcerptTextChange: (text: string) => void;
  contextText: string;
  onContextTextChange: (text: string) => void;
  statusMessage?: string;
  guideNames?: string;
  contextStatusMessage?: string;
  contextResult: string;
  contextLoading: boolean;
  onContextLoadingChange: (loading: boolean) => void;
  onContextResultChange: (result: string) => void;
  requestedResources: string[];
  onRequestedResourcesChange: (resources: string[]) => void;
  contextSourceUri?: string;
  contextRelativePath?: string;
  // ... and more
}
```

**SearchTab.tsx** - 52 props (including nested settings objects)

**MetricsTab.tsx** - 29 props

### Untyped VSCode API

Every component uses:
```typescript
interface SomeTabProps {
  vscode: any;  // No type safety
}

// In component:
vscode.postMessage({
  type: MessageType.ANALYZE_DIALOGUE,
  source: 'webview.analysis.tab',
  payload: { ... },
  timestamp: Date.now()
});
```

**Problems:**
- No autocomplete for message types
- No validation of payload structure
- Easy to make typos in message envelopes
- Refactoring message payloads is error-prone

### Any Types in Message Handlers

```typescript
// useDictionary.ts
const handleStatusMessage = React.useCallback((message: any) => {
  const { message: statusText } = message.payload;  // Unsafe access
  setStatusMessage(statusText);
}, []);
```

## Recommendation

### 1. Create Typed VSCode API Interface

```typescript
// src/presentation/webview/types/vscode.ts

import { MessageEnvelope } from '../../../shared/types/messages';

export interface VSCodeAPI {
  postMessage<T>(message: MessageEnvelope<T>): void;
  getState(): any;
  setState(state: any): void;
}
```

Update all components:
```typescript
interface AnalysisTabProps {
  vscode: VSCodeAPI;  // Typed!
  // ...
}
```

### 2. Type Message Handlers

```typescript
import { StatusMessage } from '../../../../shared/types/messages';

const handleStatusMessage = React.useCallback((message: StatusMessage) => {
  const { message: statusText } = message.payload;
  setStatusMessage(statusText);
}, []);
```

### 3. Reduce Prop Drilling via Component Extraction

Extract focused sub-components that manage their own state:

**Before:**
```tsx
<AnalysisTab
  excerptText={analysis.excerptText}
  onExcerptTextChange={analysis.setExcerptText}
  contextText={analysis.contextText}
  onContextTextChange={analysis.setContextText}
  // 30+ more props
/>
```

**After:**
```tsx
<AnalysisTab
  vscode={vscode}
  analysis={analysis}  // Pass entire hook return
  context={context}    // Pass entire hook return
  selection={selection}
/>

// Or use context API for deeply-nested state
<AnalysisSettingsProvider value={analysis}>
  <AnalysisTab />
</AnalysisSettingsProvider>
```

### 4. Consider Context API for Settings

For deeply-nested settings that many components need:

```typescript
// src/presentation/webview/context/SettingsContext.tsx

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export const useSettingsContext = () => {
  const context = React.useContext(SettingsContext);
  if (!context) throw new Error('useSettingsContext must be within provider');
  return context;
};

// In App.tsx
<SettingsContext.Provider value={{ wordSearch, wordFrequency, publishing }}>
  {/* Children can access settings without prop drilling */}
</SettingsContext.Provider>
```

## Impact

### Benefits of Fixing

1. **Type safety** - IDE catches message payload errors at compile time
2. **Refactoring safety** - Change message structure with confidence
3. **Reduced prop drilling** - Components are easier to understand
4. **Better testability** - Smaller prop interfaces are easier to mock
5. **Autocomplete** - IDE helps with message types and payloads

### Risks of Not Fixing

1. **Runtime errors** - Typos in message payloads cause silent failures
2. **Maintenance burden** - 30+ props per component is hard to manage
3. **Cognitive load** - Developers must trace prop flow through App.tsx
4. **Fragile refactoring** - Can't safely change message structures

## Implementation Order

1. Create `VSCodeAPI` interface
2. Update `useVSCodeApi` hook to return typed API
3. Update all component prop interfaces
4. Type message handlers in domain hooks
5. Extract sub-components to reduce prop count
6. (Optional) Add context API for settings

## Files to Update

### Type Definitions
- Create: `src/presentation/webview/types/vscode.ts`

### Components (update vscode type)
- `src/presentation/webview/components/AnalysisTab.tsx`
- `src/presentation/webview/components/SearchTab.tsx`
- `src/presentation/webview/components/MetricsTab.tsx`
- `src/presentation/webview/components/UtilitiesTab.tsx`
- `src/presentation/webview/components/SettingsOverlay.tsx`

### Hooks (type message handlers)
- `src/presentation/webview/hooks/domain/useAnalysis.ts`
- `src/presentation/webview/hooks/domain/useDictionary.ts`
- `src/presentation/webview/hooks/domain/useContext.ts`
- `src/presentation/webview/hooks/domain/useSearch.ts`
- `src/presentation/webview/hooks/domain/useSettings.ts`
- All other domain hooks with `any` handlers

## References

- [ADR: Presentation Layer Domain Hooks](../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- [Message types](../../src/shared/types/messages/)
