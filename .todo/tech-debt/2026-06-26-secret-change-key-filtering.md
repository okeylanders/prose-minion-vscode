# Secret-Change Key Filtering

**Date Identified**: 2026-06-26
**Source**: PR #64 review, finding 7
**Status**: Identified
**Priority**: Low
**Estimated Effort**: 2-4 hours

## Problem

`SecretsPort.onDidChange` currently exposes a keyless callback. That is adequate
while the extension stores only one secret, but it encodes an implicit "one
secret forever" assumption into the application seam.

If future credentials are added, any secret write could trigger an AI-service
refresh even when the OpenRouter API key did not change.

## Recommendation

Thread the changed secret key through the port and filter refresh behavior to
the OpenRouter API key.

Possible shape:

```typescript
onDidChange(listener: (key: string) => void): PlatformDisposable;
```

The VS Code adapter can map the native secret-storage event to the key string.
The application layer can then ignore unrelated secret changes.

## Related Files

- `packages/core/src/application/handlers/MessageHandlerContracts.ts`
- `packages/core/src/application/handlers/MessageHandler.ts`
- `packages/core/src/infrastructure/secrets/SecretStorageService.ts`
- `packages/core/src/platform/SecretStore.ts`
- `apps/vscode-extension/src/platform/vscode/VsCodeSecretStore.ts`

## Completion Criteria

- The secret-change port exposes the changed key
- MessageHandler refreshes AI services only for the OpenRouter API key
- Tests cover ignored unrelated secret changes
- No secret value is logged or forwarded
