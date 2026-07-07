/**
 * `@prose-minion/core` — public API surface (ADR 2026-06-16, monorepo split).
 *
 * This is the ONLY entry point app shells (`apps/vscode-extension`, future
 * `apps/desktop`) may import from. Core internals stay private behind their
 * `@`-aliases; an eslint `no-restricted-imports` rule in each app package bans
 * deep `@/`-reaches into core so the contract has teeth.
 *
 * Re-export rule: `export *` ONLY over a bounded, stable surface; everything
 * else is a NAMED re-export so the public API is visible at a glance. The two
 * `export *`s below qualify — the whole shared message/types contract and the
 * whole platform-port set, both bounded and stable. (They ship runtime values
 * too — `@shared/types` includes the `MessageType` enum + `createEnvelope`,
 * `@/platform` the port shapes — that's fine; just don't `export *` a grab-bag.)
 *
 * The webview never imports this barrel (webpack points its entry straight at
 * `presentation/webview/index.tsx`), so the barrel stays host-side only — it
 * does not pull React/DOM into the extension bundle.
 */

// --- Shared contract: message envelope, MessageType, payloads, context/sources types ---
export * from '@shared/types';

// --- Platform ports (the interfaces each app's adapters implement) + the Platform bundle ---
export * from '@/platform';

// --- Application: host message router ---
export { MessageHandler } from '@/application/handlers/MessageHandler';
export type {
  CoreServices,
  MessageTransport,
  ResultCache,
  SecretsPort
} from '@/application/handlers/MessageHandlerContracts';

// --- Application: Workshop session aggregate (ADR 2026-07-03) ---
export { WorkshopSessionService } from '@/application/services/WorkshopSessionService';

// --- Infrastructure: secrets ---
export { SecretStorageService } from '@/infrastructure/secrets/SecretStorageService';

// --- Infrastructure: AI resource orchestration ---
export { ResourceLoaderService } from '@orchestration/ResourceLoaderService';
export { AIResourceManager } from '@orchestration/AIResourceManager';

// --- Infrastructure: services (measurement / analysis / dictionary / search / resources / shared) ---
export { ProseStatsService } from '@services/measurement/ProseStatsService';
export { StyleFlagsService } from '@services/measurement/StyleFlagsService';
export { WordFrequencyService } from '@services/measurement/WordFrequencyService';
export { AssistantToolService } from '@services/analysis/AssistantToolService';
export { ContextAssistantService } from '@services/analysis/ContextAssistantService';
export { DictionaryService } from '@services/dictionary/DictionaryService';
export { WordSearchService } from '@services/search/WordSearchService';
export { CategorySearchService } from '@services/search/CategorySearchService';
export { StandardsService } from '@services/resources/StandardsService';
export { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
export { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
export {
  AccountBalanceService,
  OpenRouterAccountClient
} from '@/infrastructure/account';
