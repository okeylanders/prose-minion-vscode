# Sprint 1 — SecretStorage Migration Implementation

## Epic

.todo/epics/epic-secure-storage-2025-10-27/epic-secure-storage.md

## Status

**10-27-2025**: In Progress

## Goal

Migrate OpenRouter API key storage from VSCode settings to VSCode's SecretStorage API, providing OS-level encryption and automatic migration for existing users.

## ADR Reference

- [docs/adr/2025-10-27-secure-api-key-storage.md](../../../../docs/adr/2025-10-27-secure-api-key-storage.md)
- Status: Accepted
- Decision: Use VSCode SecretStorage API for encrypted API key storage with automatic migration from settings

## Tasks

### 1. Create SecretStorageService Infrastructure

File: `src/infrastructure/secrets/SecretStorageService.ts` (new)

**Implementation**:
```typescript
export class SecretStorageService {
  private static readonly API_KEY_SECRET = 'openRouterApiKey';

  constructor(private secrets: vscode.SecretStorage) {}

  async getApiKey(): Promise<string | undefined>
  async setApiKey(key: string): Promise<void>
  async deleteApiKey(): Promise<void>
  onDidChange(listener: () => void): vscode.Disposable
}
```

**Key Features**:
- Wraps `vscode.SecretStorage` API
- Type-safe methods for API key operations
- Event handling for secret changes
- Proper error handling and logging

### 2. Update Extension Activation

File: `src/extension.ts`

**Changes**:
- Instantiate `SecretStorageService` with `context.secrets`
- Add migration function: `migrateApiKeyToSecrets()`
- Inject secrets service into MessageHandler constructor
- Show notification on successful migration

**Migration Logic**:
```typescript
async function migrateApiKeyToSecrets(
  secretsService: SecretStorageService,
  config: vscode.WorkspaceConfiguration
): Promise<void> {
  const existingKey = await secretsService.getApiKey();
  if (existingKey) {
    return; // Already migrated
  }

  const oldKey = config.get<string>('openRouterApiKey');
  if (oldKey) {
    await secretsService.setApiKey(oldKey);
    await config.update('openRouterApiKey', undefined, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
      'Your API key has been migrated to secure storage.'
    );
  }
}
```

### 3. Update ConfigurationHandler

File: `src/application/handlers/domain/ConfigurationHandler.ts`

**Changes**:
- Add `secretsService: SecretStorageService` to constructor
- Add handler methods:
  - `handleRequestApiKey()` → `API_KEY_STATUS`
  - `handleUpdateApiKey(key: string)` → `API_KEY_STATUS`
  - `handleDeleteApiKey()` → `API_KEY_STATUS`
- Update `handleRequestSettingsData()` to exclude `openRouterApiKey`
- Add cases to switch statement in MessageHandler

**Key Logic**:
```typescript
private async handleRequestApiKey(): Promise<void> {
  const apiKey = await this.secretsService.getApiKey();
  this.postMessage({
    type: MessageType.API_KEY_STATUS,
    hasSavedKey: !!apiKey
  });
}

private async handleUpdateApiKey(key: string): Promise<void> {
  await this.secretsService.setApiKey(key);
  this.postMessage({
    type: MessageType.API_KEY_STATUS,
    hasSavedKey: true
  });
}
```

### 4. Add Message Types

File: `src/shared/types/messages/configuration.ts`

**New Messages**:
```typescript
export interface RequestApiKeyMessage extends BaseMessage {
  type: MessageType.REQUEST_API_KEY;
}

export interface ApiKeyStatusMessage extends BaseMessage {
  type: MessageType.API_KEY_STATUS;
  hasSavedKey: boolean;
}

export interface UpdateApiKeyMessage extends BaseMessage {
  type: MessageType.UPDATE_API_KEY;
  apiKey: string;
}

export interface DeleteApiKeyMessage extends BaseMessage {
  type: MessageType.DELETE_API_KEY;
}
```

**Update MessageType enum** in `src/shared/types/messages/base.ts`:
```typescript
export enum MessageType {
  // ... existing types
  REQUEST_API_KEY = 'REQUEST_API_KEY',
  API_KEY_STATUS = 'API_KEY_STATUS',
  UPDATE_API_KEY = 'UPDATE_API_KEY',
  DELETE_API_KEY = 'DELETE_API_KEY',
}
```

### 5. Update Settings UI

File: `src/presentation/webview/components/SettingsOverlay.tsx`

**Changes**:
- Add state: `apiKeyInput: string`, `hasSavedKey: boolean`
- Request API key status on mount
- Add custom API key section (separate from auto-generated settings)
- Implement save/clear handlers

**UI Structure**:
```tsx
<div className="settings-section">
  <h3>API Key (Secure Storage)</h3>
  <p className="setting-description">
    Your OpenRouter API key is stored securely using OS-level encryption
    (Keychain/Credential Manager).
  </p>

  <input
    type="password"
    placeholder={hasSavedKey ? "••••••••" : "Enter API key"}
    value={apiKeyInput}
    onChange={(e) => setApiKeyInput(e.target.value)}
  />

  <button onClick={handleSaveApiKey}>Save API Key</button>
  {hasSavedKey && <button onClick={handleClearApiKey}>Clear API Key</button>}
</div>
```

**Handlers**:
```typescript
const handleSaveApiKey = () => {
  if (!apiKeyInput.trim()) return;

  vscode.postMessage({
    type: MessageType.UPDATE_API_KEY,
    apiKey: apiKeyInput.trim()
  });

  setApiKeyInput(''); // Clear input after save
};

const handleClearApiKey = () => {
  vscode.postMessage({
    type: MessageType.DELETE_API_KEY
  });
};
```

**Remove from auto-generated settings**:
- Filter out `openRouterApiKey` when rendering settings fields
- Keep only non-secret settings in the auto-generated section

### 6. Update package.json

File: `package.json`

**Changes**:
```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "proseMinion.openRouterApiKey": {
          "type": "string",
          "default": "",
          "markdownDescription": "**DEPRECATED**: API keys are now stored in secure storage. Please use the Settings overlay in Prose Minion to manage your API key.",
          "deprecationMessage": "Use the Prose Minion Settings overlay to manage your API key securely."
        }
      }
    }
  }
}
```

**Verify VSCode version requirement**:
```json
{
  "engines": {
    "vscode": "^1.53.0"
  }
}
```

## Affected Files

- src/infrastructure/secrets/SecretStorageService.ts (new)
- src/extension.ts (update)
- src/application/handlers/MessageHandler.ts (update - add cases)
- src/application/handlers/domain/ConfigurationHandler.ts (update)
- src/shared/types/messages/base.ts (update - add MessageType enum values)
- src/shared/types/messages/configuration.ts (update - add message interfaces)
- src/shared/types/messages/index.ts (update - export new messages)
- src/presentation/webview/components/SettingsOverlay.tsx (update)
- package.json (update)

## Acceptance Criteria

- ✅ SecretStorageService class created with `getApiKey()`, `setApiKey()`, `deleteApiKey()` methods
- ✅ Extension activation includes migration logic from settings to SecretStorage
- ✅ Migration clears old setting after successful transfer
- ✅ Migration notification shown to users with existing API keys
- ✅ ConfigurationHandler integrated with SecretStorageService
- ✅ New message types defined and exported
- ✅ MessageHandler routes API key messages to ConfigurationHandler
- ✅ Settings UI displays custom API key section with password input
- ✅ API key status indicator shows "••••••••" when key exists
- ✅ Save API Key button stores key in SecretStorage
- ✅ Clear API Key button removes key from SecretStorage
- ✅ API key not included in settings data payload
- ✅ package.json marks old setting as deprecated
- ✅ Manual testing confirms API key encrypted (not in settings.json)
- ✅ Manual testing confirms API key persists across VSCode restarts

## Testing Protocol

### Test Case 1: Fresh Install (No Existing API Key)
1. Install extension with no prior API key
2. Open Settings overlay
3. Verify API key field is empty
4. Enter API key and click Save
5. Verify success notification
6. Close and reopen Settings overlay
7. Verify "••••••••" displayed (hasSavedKey: true)
8. Check settings.json → API key should NOT be present

### Test Case 2: Migration from Settings
1. Manually add `"proseMinion.openRouterApiKey": "test-key"` to settings.json
2. Reload VSCode window
3. Verify migration notification appears
4. Check settings.json → old setting should be removed
5. Open Settings overlay → verify "••••••••" displayed
6. Test that assistant tools still work with migrated key

### Test Case 3: Clear API Key
1. With saved API key
2. Open Settings overlay
3. Click "Clear API Key"
4. Verify "••••••••" removed, field becomes empty
5. Close and reopen Settings overlay
6. Verify field still empty (key deleted from SecretStorage)

### Test Case 4: Update Existing API Key
1. With saved API key
2. Open Settings overlay
3. Enter new API key value
4. Click Save
5. Verify "••••••••" displayed
6. Test that assistant tools work with new key

## Risks/Notes

- **OS-specific testing**: Requires testing on macOS (Keychain), Windows (Credential Manager), and Linux (libsecret)
- **Migration is one-way**: No rollback to settings-based storage
- **VSCode version requirement**: SecretStorage API requires VSCode 1.53.0+
- **No remote sync**: Secrets are local-only, not synced via Settings Sync (security feature)
- **Manual re-entry**: Users who manually edit settings.json will need to re-enter API key in UI

## Next Actions After Sprint

1. Merge to main branch after testing
2. Update CHANGELOG.md with security improvement note
3. Consider adding API key validation endpoint (test key before saving)
4. Monitor GitHub issues for migration-related problems
5. Consider adding "Export Settings" feature (non-secret settings only)

## Definition of Done

- All acceptance criteria met
- Manual testing completed on at least macOS
- No regressions in existing functionality
- API key storage verified as encrypted
- Migration path tested and working
- Code reviewed and committed to sprint branch
- PR created with ADR and sprint references
