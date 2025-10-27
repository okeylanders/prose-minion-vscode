# Focus: Secure API Key Storage via VSCode SecretStorage (Backend Complete)

When: 2025-10-27 01:10 AM CST

## Summary

Implemented OS-level encrypted storage for OpenRouter API key using VSCode's SecretStorage API. Backend infrastructure fully complete and committed. API keys now stored in platform keychains (macOS Keychain, Windows Credential Manager, Linux libsecret) instead of plain text in settings.json. Automatic migration from old settings-based storage with user notifications.

## Key Changes

### 1. SecretStorageService (Infrastructure Layer)

**New File**: `src/infrastructure/secrets/SecretStorageService.ts`

- Wraps `vscode.SecretStorage` API with typed methods
- **Methods**:
  - `async getApiKey(): Promise<string | undefined>` - Retrieve key from secure storage
  - `async setApiKey(key: string): Promise<void>` - Store key with OS encryption
  - `async deleteApiKey(): Promise<void>` - Remove key from secure storage
  - `onDidChange(listener): Disposable` - Event handling for secret updates
- **Storage Key**: `'openRouterApiKey'` (constant)
- **Error Handling**: Try-catch with console logging, throws on critical failures

### 2. Message Protocol (Shared Types)

**Files Modified**:
- `src/shared/types/messages/base.ts` - Added 4 new MessageType enum values
- `src/shared/types/messages/configuration.ts` - Added 4 new message interfaces
- `src/shared/types/messages/index.ts` - Updated union types for routing

**New Message Types**:
- `REQUEST_API_KEY` - Webview requests API key status
- `API_KEY_STATUS` - Extension responds with `{ hasSavedKey: boolean }`
- `UPDATE_API_KEY` - Webview sends `{ apiKey: string }` to save
- `DELETE_API_KEY` - Webview requests key deletion

**Flow**: UI → REQUEST_API_KEY → Handler → SecretStorage → API_KEY_STATUS → UI

### 3. ConfigurationHandler (Domain Layer)

**File**: `src/application/handlers/domain/ConfigurationHandler.ts`

- Added `SecretStorageService` to constructor (dependency injection)
- **New Handlers**:
  - `handleRequestApiKey()` - Returns key existence status (never exposes actual key)
  - `handleUpdateApiKey()` - Validates, saves to SecretStorage, refreshes service config, shows success notification
  - `handleDeleteApiKey()` - Removes from SecretStorage, refreshes config, shows notification
- **Settings Data**: Removed `openRouterApiKey` from payload (line 40-44)
- **Update Setting**: Removed `openRouterApiKey` from allowedTop set (line 94)
- **Security**: Key never transmitted in settings data messages

### 4. MessageHandler (Application Layer)

**File**: `src/application/handlers/MessageHandler.ts`

- Added `secretsService` parameter to constructor
- Injected `secretsService` into ConfigurationHandler instantiation
- **New Routes** (lines 234-244):
  - `MessageType.REQUEST_API_KEY` → `configurationHandler.handleRequestApiKey()`
  - `MessageType.UPDATE_API_KEY` → `configurationHandler.handleUpdateApiKey()`
  - `MessageType.DELETE_API_KEY` → `configurationHandler.handleDeleteApiKey()`

### 5. Extension Activation & Migration

**File**: `src/extension.ts`

- Instantiates `SecretStorageService` with `context.secrets`
- Injects into `ProseToolsViewProvider` and `ProseAnalysisService`
- **Migration Function** (lines 126-167): `migrateApiKeyToSecrets()`
  1. Check if key already exists in SecretStorage (skip if found)
  2. Read old `proseMinion.openRouterApiKey` from settings
  3. If found, save to SecretStorage
  4. Clear old setting with `config.update('openRouterApiKey', undefined, Global)`
  5. Show notification: "Your API key has been migrated to secure storage for better security."
  6. Log all steps to output channel
- **Execution**: Called with `void migrateApiKeyToSecrets()` on activation (non-blocking)

### 6. ProseAnalysisService (Infrastructure Layer)

**File**: `src/infrastructure/api/ProseAnalysisService.ts`

- Added `SecretStorageService` to constructor
- **initializeAITools()** (lines 83-95):
  - Reads API key from SecretStorage first: `await secretsService.getApiKey()`
  - Falls back to settings if not in SecretStorage (backward compatibility)
  - Maintains existing logic for tool initialization
- **Dual Read**: Ensures compatibility during migration phase

### 7. Package.json Configuration

**File**: `package.json`

- **Deprecated** `proseMinion.openRouterApiKey` setting (lines 134-140)
- Added `markdownDescription`: "**DEPRECATED**: API keys are now stored securely using OS-level encryption. Please use the **Settings** overlay in Prose Minion (gear icon in title bar) to manage your API key. Your existing key will be automatically migrated to secure storage on next reload."
- Added `deprecationMessage`: "Use the Prose Minion Settings overlay to manage your API key securely. Access it via the gear icon in the Prose Minion view title bar."
- **Compatibility**: Setting remains for migration phase, won't break existing installs

### 8. Documentation

**ADR**: `docs/adr/2025-10-27-secure-api-key-storage.md`
- Status: Accepted
- Decision rationale, architecture changes, message flow diagrams
- Alternatives considered, consequences, implementation notes

**Epic**: `.todo/epics/epic-secure-storage-2025-10-27/epic-secure-storage.md`
- Objectives, scope, milestones, cross-cutting concerns

**Sprint**: `.todo/epics/epic-secure-storage-2025-10-27/sprints/01-secretstorage-migration.md`
- Task breakdown, acceptance criteria, testing protocol
- **UI Implementation Details** (lines 105-170) - Complete spec for SettingsOverlay.tsx changes

## Files Modified/Added

**New Files** (4):
- `src/infrastructure/secrets/SecretStorageService.ts`
- `docs/adr/2025-10-27-secure-api-key-storage.md`
- `.todo/epics/epic-secure-storage-2025-10-27/epic-secure-storage.md`
- `.todo/epics/epic-secure-storage-2025-10-27/sprints/01-secretstorage-migration.md`

**Modified Files** (9):
- `package.json` - Deprecated setting
- `src/extension.ts` - Migration logic, DI
- `src/application/providers/ProseToolsViewProvider.ts` - Inject secretsService
- `src/application/handlers/MessageHandler.ts` - Routing, DI
- `src/application/handlers/domain/ConfigurationHandler.ts` - API key handlers
- `src/infrastructure/api/ProseAnalysisService.ts` - SecretStorage read
- `src/shared/types/messages/base.ts` - Message enum
- `src/shared/types/messages/configuration.ts` - Message interfaces
- `src/shared/types/messages/index.ts` - Union types

**Commit**: `444e954` on branch `sprint/epic-secure-storage-2025-10-27-01-implementation`

## Technical Notes

### Security Improvements

1. **OS-Level Encryption**: Keys stored in platform-native keychains
   - macOS: Keychain Access
   - Windows: Credential Manager
   - Linux: libsecret (GNOME Keyring/KWallet)
2. **File System Isolation**: Key never appears in settings.json or any plaintext file
3. **Settings Sync Exclusion**: Secrets not synced via VSCode Settings Sync (local-only)
4. **No Exposure**: Key never sent in webview messages (only status: hasSavedKey boolean)

### Migration Strategy

- **One-Way**: Settings → SecretStorage (no rollback mechanism)
- **One-Time**: Checks for existing SecretStorage key first, skips if found
- **Non-Blocking**: Migration runs asynchronously on activation
- **User Notification**: Only shown on successful migration (not on errors or skips)
- **Backward Compatible**: ProseAnalysisService falls back to settings during transition

### Build Status

- ✅ TypeScript compilation successful (no errors)
- ⚠️ Bundle size warnings (existing, unrelated to this change)
- ✅ All message types properly routed
- ✅ Dependency injection chain complete

## Next Steps

### Immediate (For New Session)

**UI Implementation** - `src/presentation/webview/components/SettingsOverlay.tsx` (599 lines)

**Required Changes**:
1. Add state: `apiKeyInput`, `hasSavedKey`
2. Request `REQUEST_API_KEY` on mount
3. Handle `API_KEY_STATUS` message
4. Add custom API Key section with:
   - Password input field
   - Placeholder: "••••••••" if saved, "Enter your OpenRouter API key" if not
   - Save API Key button (disabled if input empty)
   - Clear API Key button (only visible if `hasSavedKey`)
5. Filter out `openRouterApiKey` from auto-generated settings fields

**Reference**: Sprint doc lines 105-170 have complete implementation spec

### Testing Protocol (After UI Complete)

**Test Case 1: Fresh Install**
- Install with no prior API key
- Open Settings overlay
- Verify empty input field
- Enter key, click Save
- Verify success notification
- Verify settings.json does NOT contain key
- Reload extension, verify key persists

**Test Case 2: Migration**
- Manually add `"proseMinion.openRouterApiKey": "test-key"` to settings.json
- Reload VSCode
- Verify migration notification
- Verify settings.json cleared
- Verify Settings overlay shows "••••••••"
- Test assistant tools work with migrated key

**Test Case 3: Clear Key**
- With saved key
- Click Clear API Key
- Verify notification
- Verify "••••••••" removed
- Reload, verify key still deleted

**Test Case 4: Update Key**
- With saved key
- Enter new key, click Save
- Verify assistant tools use new key

### Future Enhancements (Separate Epic)

- Multi-API-key support (multiple providers)
- API key validation/testing from Settings UI
- Export/import settings (exclude secrets)
- Admin/team settings for shared configs

## Related Work

- **Replaces**: Previous password masking (20251027-0030-marketplace-optimization-and-documentation.md)
  - That commit added `"format": "password"` for UI masking only
  - This commit implements true encryption via OS keychain
- **Links to**: Settings overlay work (20251026-2015-sprint-5-settings-overlay-progress.md)
  - Settings UI infrastructure already exists
  - Just needs API key section added

## Architecture Impact

- **Clean Architecture Maintained**: Clear layer boundaries preserved
  - Infrastructure: SecretStorageService
  - Application: MessageHandler, ConfigurationHandler
  - Presentation: SettingsOverlay.tsx (pending)
- **Dependency Injection**: Properly injected through constructor chain
- **Message Passing**: Typed, routed, domain-organized
- **Alpha Development**: Breaking change accepted (no backward compatibility required)

## Open Questions

None. Backend implementation complete and functional. Ready for UI integration.
