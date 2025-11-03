# ADR: Secure API Key Storage via SecretStorage

Status: Accepted
Date: 2025-10-27
Implemented: Complete (PR #11)
Implementation Date: 2025-10-27

## Context

The OpenRouter API key is currently stored in VSCode's user settings (`proseMinion.openRouterApiKey`) with `"format": "password"` for UI masking. While this masks the key in the settings UI, it has several security limitations:

1. **Plain text storage**: The key is stored unencrypted in `settings.json`
2. **File system exposure**: Any process or user with file access can read the key
3. **Settings sync**: The key may be synced to cloud storage or version control accidentally
4. **No OS-level protection**: Does not leverage platform keychain/credential managers

Users handling sensitive API keys with billing implications need stronger security guarantees.

## Decision

Migrate API key storage from VSCode settings to VSCode's **SecretStorage API**, which provides:

1. **OS-level encryption**: Keys stored in system keychain (macOS Keychain, Windows Credential Manager, Linux libsecret)
2. **Isolated storage**: Separate from settings files and settings sync
3. **Secure access**: Only accessible through the extension's context
4. **Backward compatibility**: Automatic migration from old settings-based storage

### Architecture Changes

1. **New infrastructure layer**: `SecretStorageService` wraps `context.secrets` API
2. **Configuration layer updates**: Remove API key from settings-based configuration flow
3. **Message protocol**: New messages for secure API key operations (`REQUEST_API_KEY`, `UPDATE_API_KEY`, `DELETE_API_KEY`)
4. **Migration logic**: One-time migration from settings to SecretStorage on extension activation
5. **UI updates**: Custom API key input field in Settings overlay (separate from settings data)

## Alternatives Considered

- **Keep current approach with password format**: Rejected due to plain-text storage and file system exposure
- **Environment variables**: Rejected as not user-friendly for non-technical writers
- **Encrypted settings file**: Rejected as reinventing OS keychain capabilities
- **External secret manager (1Password, etc.)**: Rejected as too complex for target audience

## Consequences

### Positive
- API keys encrypted by OS rather than stored in plain text
- Keys isolated from settings sync and file system
- Better security posture for users with billing concerns
- Aligns with VSCode best practices for sensitive data

### Negative
- Slightly more complex configuration flow (custom UI field required)
- Migration logic needed for existing users
- Testing requires OS-specific keychain access

### Migration Impact
- Existing users will have their API key automatically migrated on first activation
- Old setting will be cleared after successful migration
- Users will see a notification about the migration

## Implementation Notes

### Files Changed

1. **New file**: `src/infrastructure/secrets/SecretStorageService.ts`
   - Methods: `getApiKey()`, `setApiKey(key)`, `deleteApiKey()`
   - Event handling: `onDidChange` for secret updates

2. **Update**: `src/extension.ts`
   - Instantiate `SecretStorageService` with `context.secrets`
   - Add migration logic to move API key from settings to SecretStorage
   - Inject secrets service into `MessageHandler` and `ProseAnalysisService`

3. **Update**: `src/application/handlers/domain/ConfigurationHandler.ts`
   - Add handlers for `REQUEST_API_KEY`, `UPDATE_API_KEY`, `DELETE_API_KEY`
   - Remove `openRouterApiKey` from settings data payload
   - Read API key from `SecretStorageService` instead of configuration

4. **Update**: `package.json`
   - Mark `proseMinion.openRouterApiKey` as deprecated with migration notice
   - Keep setting definition for backward compatibility during migration phase

5. **Update**: `src/presentation/webview/components/SettingsOverlay.tsx`
   - Add custom API key input field (separate from auto-generated settings fields)
   - Mask input field with password type
   - Add "Save API Key" and "Clear API Key" buttons
   - Request API key on mount (masked display: "••••••••" if present, empty if not)

6. **Update**: `src/shared/types/messages/configuration.ts`
   - Add message types: `REQUEST_API_KEY`, `API_KEY_STATUS`, `UPDATE_API_KEY`, `DELETE_API_KEY`
   - Export from `index.ts`

### Message Flow

**Initial Load:**
```
UI → REQUEST_API_KEY → Handler → SecretStorage
SecretStorage → Handler → API_KEY_STATUS(hasSavedKey: boolean) → UI
```

**Save Key:**
```
UI → UPDATE_API_KEY(key) → Handler → SecretStorage
SecretStorage → Handler → API_KEY_STATUS(hasSavedKey: true) → UI
```

**Delete Key:**
```
UI → DELETE_API_KEY → Handler → SecretStorage
SecretStorage → Handler → API_KEY_STATUS(hasSavedKey: false) → UI
```

### Migration Logic

On extension activation:
1. Check if API key exists in `SecretStorage`
2. If not, check old setting `proseMinion.openRouterApiKey`
3. If old setting has value:
   - Save to `SecretStorage`
   - Clear old setting
   - Show notification: "Your API key has been migrated to secure storage"

## Links

- Epic: `.todo/epics/epic-secure-storage-2025-10-27/`
- Sprint: `.todo/epics/epic-secure-storage-2025-10-27/sprints/01-secretstorage-migration.md`
- Branch: `sprint/epic-secure-storage-2025-10-27-01-implementation`

## References

- [VSCode SecretStorage API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)
- [Extension Guidelines: Sensitive Data](https://code.visualstudio.com/api/references/extension-guidelines#dont-store-secrets-in-settings)
