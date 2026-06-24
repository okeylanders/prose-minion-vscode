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
  TokenUsageUpdateMessage
} from '@messages';
import type { AIResourceManager } from '@orchestration/AIResourceManager';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
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

/**
 * Narrow application-facing secrets seam. The infrastructure implementation is
 * SecretStorageService, but handlers depend only on the operations they use.
 */
export interface SecretsPort {
  getApiKey(): Promise<string | undefined>;
  setApiKey(key: string): Promise<void>;
  deleteApiKey(): Promise<void>;
}

/** Raw host transport used to deliver a typed message to the webview. */
export type MessageTransport = (
  message: ExtensionToWebviewMessage
) => PromiseLike<unknown>;

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
}
