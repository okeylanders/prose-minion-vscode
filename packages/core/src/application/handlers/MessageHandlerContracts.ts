import type {
  AnalysisResultMessage,
  CategorySearchResultMessage,
  ContextResultMessage,
  DictionaryResultMessage,
  ErrorMessage,
  ExtensionToWebviewMessage,
  MetricsResultMessage,
  SearchResultMessage,
  StatusMessage,
  TokenUsageUpdateMessage,
  WorkshopSessionStateMessage
} from '@messages';
import type { AIResourceManager } from '@orchestration/AIResourceManager';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import type { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { WorkshopContextResourceService } from '@/application/services/workshop/WorkshopContextResourceService';
import type { WorkshopConversationBehaviorService } from '@/application/services/workshop/WorkshopConversationBehaviorService';
import type { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ProseStatsService } from '@services/measurement/ProseStatsService';
import type { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import type { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { StandardsService } from '@services/resources/StandardsService';
import type { CategorySearchService } from '@services/search/CategorySearchService';
import type { WordSearchService } from '@services/search/WordSearchService';
import type { AccountBalanceService } from '@/infrastructure/account';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import type { PlatformDisposable } from '@/platform';

/**
 * Narrow application-facing secrets seam. The infrastructure implementation is
 * SecretStorageService, but handlers depend only on the operations they use.
 */
export interface SecretsPort {
  getApiKey(): Promise<string | undefined>;
  setApiKey(key: string): Promise<void>;
  deleteApiKey(): Promise<void>;
  /** Fires when the stored key changes (set/clear/migration). */
  onDidChange(listener: () => void): PlatformDisposable;
}

/** Raw host transport used to deliver a typed message to the webview. */
export type MessageTransport = (
  message: ExtensionToWebviewMessage
) => PromiseLike<unknown>;

/**
 * UI capabilities owned by the host shell and exposed to core message handlers.
 * Kept named so new cross-surface actions extend one contract instead of
 * growing anonymous callback bags at each boundary.
 */
export interface WorkshopUiActions {
  openWorkshop?: () => void;
}

/** Per-MessageHandler replay cache. Never share this across webview lifetimes. */
export interface ResultCache {
  analysis?: AnalysisResultMessage;
  dictionary?: DictionaryResultMessage;
  context?: ContextResultMessage;
  metrics?: MetricsResultMessage;
  search?: SearchResultMessage;
  categorySearch?: CategorySearchResultMessage;
  status?: StatusMessage;
  error?: ErrorMessage;
  tokenUsage?: TokenUsageUpdateMessage;
  workshopSession?: WorkshopSessionStateMessage;
}

/**
 * Services constructed once by the app composition root and injected into the
 * application layer. This is intentionally a plain bundle, not a DI container.
 */
export interface CoreServices {
  assistantToolService: AssistantToolService;
  dictionaryService: DictionaryService;
  contextAssistantService: ContextAssistantService;
  proseStatsService: ProseStatsService;
  styleFlagsService: StyleFlagsService;
  wordFrequencyService: WordFrequencyService;
  wordSearchService: WordSearchService;
  standardsService: StandardsService;
  aiResourceManager: AIResourceManager;
  secretsService: SecretsPort;
  textSourceResolver: TextSourceResolver;
  categorySearchService: CategorySearchService;
  accountBalanceService: AccountBalanceService;
  /**
   * Workshop session aggregate (ADR 2026-07-03). Composition-root-owned so the
   * thread outlives any single webview's MessageHandler — reopening the panel
   * or reloading its webview rehydrates from this one instance.
   */
  workshopSessionService: WorkshopSessionService;
  workshopPersonaCapabilityFactory: WorkshopPersonaCapabilityFactory;
  workshopToolSidePass: RunWorkshopToolSidePass;
  /** Configured-resource intake for Workshop's context selector flows (Sprint 12). */
  workshopContextResourceService: WorkshopContextResourceService;
  /** Serialized live/persisted conversation-behavior coordination across webview surfaces. */
  workshopConversationBehaviorService: WorkshopConversationBehaviorService;
}
