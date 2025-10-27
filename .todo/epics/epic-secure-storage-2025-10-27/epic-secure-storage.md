# Epic: Secure API Key Storage via SecretStorage

## Status

**10-27-2025**: In Progress

## Sprint Plan: 2025-10-27

This epic migrates OpenRouter API key storage from VSCode settings to VSCode's SecretStorage API, providing OS-level encryption and isolation from settings files.

## Objectives

- Migrate API key storage from plain-text settings to encrypted SecretStorage
- Implement automatic migration for existing users
- Update Settings UI with custom API key management
- Maintain backward compatibility during transition
- Provide clear user notifications about security improvements

## References

- ADR: [docs/adr/2025-10-27-secure-api-key-storage.md](../../../docs/adr/2025-10-27-secure-api-key-storage.md)
- VSCode API: [SecretStorage Documentation](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)

## Scope Overview

1. **Infrastructure Layer (Critical)** — Create SecretStorageService
2. **Extension Activation (Critical)** — Add migration logic and inject secrets service
3. **Configuration Layer (Critical)** — Update ConfigurationHandler for secure API key operations
4. **Message Protocol (Critical)** — Add new message types for API key management
5. **UI Layer (Critical)** — Update SettingsOverlay with custom API key input
6. **Package Configuration (Required)** — Deprecate old setting with migration notice

Out-of-scope: Multi-API-key support (single OpenRouter key only)

## Milestones and Work Items

### Sprint 1 — SecretStorage Migration Implementation (Day 1)

**Goal**: Fully implement secure API key storage with automatic migration and custom UI

**Tasks**:
1. Create SecretStorageService infrastructure
   - Implement `getApiKey()`, `setApiKey(key)`, `deleteApiKey()`
   - Handle `onDidChange` events
   - Add TypeScript interfaces

2. Update extension.ts
   - Instantiate SecretStorageService with `context.secrets`
   - Add migration logic (settings → SecretStorage)
   - Inject secrets service into MessageHandler
   - Show migration notification to users

3. Update ConfigurationHandler
   - Add handlers for `REQUEST_API_KEY`, `UPDATE_API_KEY`, `DELETE_API_KEY`
   - Remove `openRouterApiKey` from settings data payload
   - Integrate with SecretStorageService

4. Add message types
   - Define in `src/shared/types/messages/configuration.ts`
   - Add `REQUEST_API_KEY`, `API_KEY_STATUS`, `UPDATE_API_KEY`, `DELETE_API_KEY`
   - Export from barrel index

5. Update SettingsOverlay UI
   - Add custom API key input field (password type)
   - Request API key status on mount
   - Display "••••••••" if key exists, empty if not
   - Add "Save API Key" and "Clear API Key" buttons
   - Remove API key from auto-generated settings fields

6. Update package.json
   - Mark `proseMinion.openRouterApiKey` as deprecated
   - Add deprecation notice pointing to new secure storage

**Affected Files**:
- src/infrastructure/secrets/SecretStorageService.ts (new)
- src/extension.ts (update)
- src/application/handlers/domain/ConfigurationHandler.ts (update)
- src/shared/types/messages/configuration.ts (update)
- src/shared/types/messages/index.ts (update)
- src/presentation/webview/components/SettingsOverlay.tsx (update)
- package.json (update)

**Acceptance Criteria**:
- ✅ SecretStorageService implemented with all required methods
- ✅ Automatic migration from settings to SecretStorage on activation
- ✅ Old setting cleared after successful migration
- ✅ Migration notification shown to users
- ✅ Custom API key input field in Settings overlay
- ✅ API key never exposed in settings data messages
- ✅ Save/Clear functionality working correctly
- ✅ API key persists across VSCode restarts
- ✅ Manual testing confirms encryption (key not in settings.json)

**Risks/Notes**:
- Testing requires OS-specific keychain access (macOS Keychain, Windows Credential Manager, Linux libsecret)
- Migration is one-way (settings → SecretStorage); no rollback mechanism
- Users who manually edited settings.json will need to re-enter API key in Settings UI
- SecretStorage API requires VSCode 1.53.0+ (verify in package.json engines)

## Cross-Cutting Concerns

- **Security**: API keys encrypted by OS, not stored in plain text
- **Backward Compatibility**: Automatic migration preserves existing keys
- **User Experience**: One-time migration with clear notification
- **Settings Sync**: API key excluded from settings sync (security improvement)
- **Multi-Platform**: Works across macOS, Windows, Linux with OS-specific keychains

## Review & Verification Cadence

- Code review after implementation
- Manual testing on macOS (primary), Windows and Linux if available
- Verify migration path with existing API key in settings
- Verify fresh install path (no existing API key)
- Confirm key not visible in settings.json after save

## Definition of Done

- ADR finalized and committed with accepted status
- SecretStorageService implemented and tested
- Migration logic working correctly
- Settings UI updated with custom API key management
- All message types defined and handled
- package.json updated with deprecation notice
- Manual testing completed successfully
- No regressions in existing functionality
- API key storage secure and encrypted

## Future Work (Separate Epic)

- Multi-API-key support (multiple AI providers)
- API key validation/testing from Settings UI
- Export/import of settings (excluding secrets)
- Admin/team settings for shared configurations (non-secret settings only)
