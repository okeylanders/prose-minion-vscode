# Error Handling Guide

## Overview

Prose Minion uses a hierarchical error source system to enable selective error handling and prevent cross-tab loading state interference. Every error message includes a `source` field that identifies which domain or subtool triggered the error.

## ErrorSource Type

All errors must specify their source using the `ErrorSource` type:

```typescript
export type ErrorSource =
  // Analysis domain
  | 'analysis'

  // Metrics domain with subtools
  | 'metrics.prose_stats'
  | 'metrics.style_flags'
  | 'metrics.word_frequency'

  // Search domain
  | 'search'

  // Dictionary domain
  | 'dictionary'

  // Context domain
  | 'context'

  // Settings/configuration domain
  | 'settings.api_key'
  | 'settings.model'
  | 'settings.general'

  // Publishing domain
  | 'publishing'

  // UI operations
  | 'ui.guide'
  | 'ui.selection'

  // File operations
  | 'file_ops.copy'
  | 'file_ops.save'

  // Unknown/legacy (fallback)
  | 'unknown';
```

## Hierarchical Format

Sources use dot-separated hierarchical naming: `domain.subtool`

### Top-Level Domains

For domains without subtools:
- `'analysis'` - Dialogue and prose analysis
- `'search'` - Word search
- `'dictionary'` - Dictionary lookups
- `'context'` - Context generation
- `'publishing'` - Publishing standards

### Domains with Subtools

For domains with multiple subtools, use `domain.subtool`:
- `'metrics.prose_stats'` - Prose statistics (word count, sentences, etc.)
- `'metrics.style_flags'` - Style pattern detection
- `'metrics.word_frequency'` - Word frequency analysis

### Operational Domains

For cross-cutting operations:
- `'settings.api_key'` - API key operations
- `'settings.model'` - Model selection
- `'settings.general'` - General settings
- `'file_ops.copy'` - Copy to clipboard
- `'file_ops.save'` - Save to file
- `'ui.guide'` - Opening guide files
- `'ui.selection'` - Selection requests

### Fallback

- `'unknown'` - Use when error source cannot be determined (clears all loading states)

## ErrorMessage Interface

```typescript
export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  source: ErrorSource;  // Required
  message: string;      // User-facing error message
  details?: string;     // Technical details for logging
}
```

## Sending Errors from Handlers

### Handler Signature

All domain handlers receive a `sendError` callback with this signature:

```typescript
private readonly sendError: (source: ErrorSource, message: string, details?: string) => void
```

### Example: SearchHandler

```typescript
export class SearchHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly sendSearchResult: (result: any, toolName: string) => void,
    private readonly sendError: (source: ErrorSource, message: string, details?: string) => void
  ) {}

  async handleMeasureWordSearch(message: RunWordSearchMessage): Promise<void> {
    try {
      // ... do work
      this.sendSearchResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[SearchHandler] ERROR: ${msg}`);
      this.sendError('search', 'Invalid selection or path', msg);
      //              ^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^  ^^^
      //              source    user-facing message      technical details
    }
  }
}
```

### Example: MetricsHandler with Subtools

```typescript
export class MetricsHandler {
  async handleMeasureProseStats(message: MeasureProseStatsMessage): Promise<void> {
    try {
      // ... do work
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('metrics.prose_stats', 'Invalid selection or path', msg);
      //              ^^^^^^^^^^^^^^^^^^^
      //              Subtool-specific source
    }
  }

  async handleMeasureStyleFlags(message: MeasureStyleFlagsMessage): Promise<void> {
    try {
      // ... do work
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('metrics.style_flags', 'Invalid selection or path', msg);
      //              ^^^^^^^^^^^^^^^^^^
      //              Different subtool
    }
  }
}
```

### Example: ConfigurationHandler with Granular Sources

```typescript
export class ConfigurationHandler {
  async handleUpdateApiKey(message: UpdateApiKeyMessage): Promise<void> {
    try {
      // ... save API key
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('settings.api_key', 'Failed to save API key', msg);
      //              ^^^^^^^^^^^^^^^^^
      //              Specific operation
    }
  }

  async handleSetModelSelection(message: SetModelSelectionMessage): Promise<void> {
    try {
      // ... update model
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('settings.model', 'Failed to update model selection', msg);
      //              ^^^^^^^^^^^^^^^
      //              Different setting
    }
  }
}
```

## Error Handling in Webview

### Selective Loading State Clearing

The webview's ERROR handler clears loading states selectively based on the error source:

```typescript
// App.tsx
useMessageRouter({
  [MessageType.ERROR]: (msg) => {
    setError(msg.message);  // Display error banner

    const source = msg.source || 'unknown';

    if (source.startsWith('metrics.')) {
      // Any metrics subtool error
      metrics.setLoading(false);
    } else if (source === 'search') {
      search.setLoading(false);
    } else if (source === 'analysis') {
      analysis.setLoading(false);
    } else if (source === 'dictionary') {
      dictionary.setLoading(false);
    } else if (source === 'context') {
      context.setLoading(false);
    } else if (source.startsWith('settings.') || source.startsWith('file_ops.') || source.startsWith('ui.') || source === 'publishing') {
      // These operations don't have loading states
      // Error message display is sufficient
    } else {
      // Unknown source - clear all as safe fallback
      analysis.setLoading(false);
      metrics.setLoading(false);
      dictionary.setLoading(false);
      context.setLoading(false);
      search.setLoading(false);
    }
  },
});
```

### Error Banner Behavior

Error messages are displayed in a banner at the top of the UI and are cleared:
1. **On successful result**: Any result message (ANALYSIS_RESULT, METRICS_RESULT, etc.) clears the error
2. **On tab change**: Switching tabs clears the error
3. **Automatically**: Errors do not auto-dismiss by time

## Adding New Error Sources

### Step 1: Add to ErrorSource Type

Edit [src/shared/types/messages/results.ts](../src/shared/types/messages/results.ts):

```typescript
export type ErrorSource =
  // ... existing sources

  // Your new domain
  | 'newdomain'
  | 'newdomain.subtool1'
  | 'newdomain.subtool2'

  // ... rest
```

### Step 2: Update Handler Signature

```typescript
// Import ErrorSource
import { ErrorSource } from '../../../shared/types/messages';

export class NewDomainHandler {
  constructor(
    // ... other dependencies
    private readonly sendError: (source: ErrorSource, message: string, details?: string) => void
  ) {}
}
```

### Step 3: Use in Error Handling

```typescript
async handleNewOperation(message: NewOperationMessage): Promise<void> {
  try {
    // ... do work
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    this.sendError('newdomain', 'Operation failed', msg);
  }
}
```

### Step 4: Update Webview ERROR Handler

Edit [src/presentation/webview/App.tsx](../src/presentation/webview/App.tsx):

```typescript
[MessageType.ERROR]: (msg) => {
  setError(msg.message);
  const source = msg.source || 'unknown';

  // ... existing conditions

  } else if (source.startsWith('newdomain.')) {
    // Handle new domain with subtools
    newdomain.setLoading(false);
  } else if (source === 'newdomain') {
    // Handle new domain without subtools
    newdomain.setLoading(false);
  }

  // ... rest
},
```

## Best Practices

### 1. Use Specific Sources

**Good**:
```typescript
this.sendError('metrics.prose_stats', 'No text selected', details);
```

**Bad**:
```typescript
this.sendError('unknown', 'No text selected', details);
```

### 2. Provide User-Friendly Messages

**Good**:
```typescript
this.sendError('search', 'Please select text to search', details);
```

**Bad**:
```typescript
this.sendError('search', 'TypeError: Cannot read property length of undefined', details);
```

### 3. Include Technical Details

**Good**:
```typescript
catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  this.sendError('dictionary', 'Dictionary lookup failed', msg);
}
```

**Bad**:
```typescript
catch (error) {
  this.sendError('dictionary', 'Dictionary lookup failed');  // No details
}
```

### 4. Log to OutputChannel

**Good**:
```typescript
catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  this.outputChannel.appendLine(`[SearchHandler] ERROR: ${msg}`);
  this.sendError('search', 'Search failed', msg);
}
```

### 5. Use Subtools for Granularity

When a domain has multiple distinct operations:

**Good**:
```typescript
// Metrics has 3 subtools
this.sendError('metrics.prose_stats', ...);
this.sendError('metrics.style_flags', ...);
this.sendError('metrics.word_frequency', ...);
```

**Less Good**:
```typescript
// All metrics errors lumped together
this.sendError('metrics', ...);
```

## Error Recovery Patterns

### Pattern 1: Immediate Retry

```typescript
async handleOperation(message: OperationMessage): Promise<void> {
  try {
    const result = await this.service.doOperation(message.data);
    this.sendResult(result);
  } catch (error) {
    // Log and send error
    const msg = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(`[Handler] ERROR: ${msg}`);
    this.sendError('domain', 'Operation failed', msg);

    // User can immediately retry (loading state cleared, error shown)
  }
}
```

### Pattern 2: Validation Before Operation

```typescript
async handleOperation(message: OperationMessage): Promise<void> {
  // Validate early, fail fast
  if (!message.requiredField) {
    this.sendError('domain', 'Required field missing');
    return;
  }

  try {
    // Operation only runs after validation
    const result = await this.service.doOperation(message.requiredField);
    this.sendResult(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    this.sendError('domain', 'Operation failed', msg);
  }
}
```

### Pattern 3: Graceful Degradation

```typescript
async handleOperation(message: OperationMessage): Promise<void> {
  try {
    const primaryResult = await this.service.primaryMethod(message.data);
    this.sendResult(primaryResult);
  } catch (primaryError) {
    // Try fallback
    try {
      const fallbackResult = await this.service.fallbackMethod(message.data);
      this.sendResult(fallbackResult);
    } catch (fallbackError) {
      // Both failed, send error
      const msg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      this.sendError('domain', 'Operation failed (primary and fallback)', msg);
    }
  }
}
```

## Debugging Errors

### OutputChannel Logging

All errors are logged to the "Prose Minion" OutputChannel with source information:

```
[MessageHandler] ERROR [search]: Invalid selection or path - No text provided for search.
[MessageHandler] ERROR [metrics.prose_stats]: Invalid selection or path - No text provided for metrics.
[MessageHandler] ERROR [settings.api_key]: Failed to save API key - Invalid key format.
```

**To view**:
1. Open VS Code Output panel (View → Output)
2. Select "Prose Minion" from dropdown

### Error Message Display

Errors appear in a banner at the top of the webview with the user-facing message:

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Invalid selection or path                    │
└─────────────────────────────────────────────────┘
```

Technical details are available in the OutputChannel, not shown to users.

### Loading State Verification

Check that loading states clear correctly:

**Test: Cross-Tab Error Isolation**
1. Start dialogue analysis (slow operation)
2. Switch to Search tab
3. Trigger search error (no selection)
4. **Expected**: Only search loading clears, analysis continues
5. **Verify**: Analysis result appears after operation completes

**Test: Subtool Granularity**
1. Trigger error on metrics.prose_stats
2. **Expected**: Metrics loading clears
3. **Verify**: No other tab loading states affected

## Common Error Scenarios

### No Selection Error

```typescript
// User triggered operation without selecting text
if (!text || text.trim().length === 0) {
  this.sendError('search', 'Please select text to search');
  return;
}
```

### Invalid Configuration

```typescript
// Required setting is missing
const apiKey = await this.secretsService.getApiKey();
if (!apiKey) {
  this.sendError('settings.api_key', 'API key not configured. Please add your OpenRouter API key in settings.');
  return;
}
```

### File Not Found

```typescript
// Resource file missing
try {
  await vscode.workspace.fs.stat(fileUri);
} catch (statError) {
  this.sendError('ui.guide', 'Guide file not found', fileUri.fsPath);
  return;
}
```

### API Error

```typescript
// External API failure
try {
  const result = await this.apiClient.call(params);
  this.sendResult(result);
} catch (apiError) {
  const msg = apiError instanceof Error ? apiError.message : String(apiError);
  this.sendError('analysis', 'AI analysis failed. Please check your API key and try again.', msg);
}
```

### Parse Error

```typescript
// Data parsing failure
try {
  const data = JSON.parse(rawData);
  this.processData(data);
} catch (parseError) {
  const msg = parseError instanceof Error ? parseError.message : String(parseError);
  this.sendError('publishing', 'Failed to load publishing standards', msg);
}
```

## Related Documentation

- [EVENT-BUS-ARCHITECTURE.md](EVENT-BUS-ARCHITECTURE.md) - Complete event bus architecture
- [ARCHITECTURE.md](ARCHITECTURE.md) - Overall system architecture
- [ADR: Message Architecture Organization](adr/2025-10-26-message-architecture-organization.md) - Message organization decision
- [ADR: Presentation Layer Domain Hooks](adr/2025-10-27-presentation-layer-domain-hooks.md) - Hooks refactor decision

## Changelog

### 2025-10-27: Initial Implementation
- Added ErrorSource type with 18 predefined sources
- Implemented hierarchical source format (domain.subtool)
- Updated all 9 domain handlers to pass sources
- Added selective loading state clearing in App.tsx
- Created comprehensive error handling documentation
