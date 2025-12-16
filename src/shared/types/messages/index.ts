/**
 * Messages barrel export
 * Re-exports all message types for backward compatibility
 */

// Base types
export * from './base';

// Cross-cutting concerns
export * from './error';
export * from './status';
export * from './tokenUsage';

// Domain-specific messages
export * from './analysis';
export * from './dictionary';
export * from './context';
export * from './metrics';
export * from './search';
export * from './configuration';
export * from './publishing';
export * from './sources';
export * from './ui';
export * from './results';
export * from './streaming';

// Union types for message routing
import {
  AnalyzeDialogueMessage,
  AnalyzeProseMessage,
  AnalyzeWritingToolsMessage,
  AnalysisResultMessage
} from './analysis';
import {
  LookupDictionaryMessage,
  DictionaryResultMessage,
  FastGenerateDictionaryMessage,
  FastGenerateDictionaryResultMessage,
  DictionaryGenerationProgressMessage
} from './dictionary';
import {
  GenerateContextMessage,
  ContextResultMessage
} from './context';
import {
  MeasureProseStatsMessage,
  MeasureStyleFlagsMessage,
  MeasureWordFrequencyMessage,
  MetricsResultMessage
} from './metrics';
import {
  RunWordSearchMessage,
  SearchResultMessage,
  CategorySearchRequestMessage,
  CategorySearchResultMessage
} from './search';
import {
  RequestModelDataMessage,
  SetModelSelectionMessage,
  ModelDataMessage,
  RequestSettingsDataMessage,
  UpdateSettingMessage,
  SettingsDataMessage,
  TokenUsageUpdateMessage,
  ResetTokenUsageMessage,
  RequestApiKeyMessage,
  ApiKeyStatusMessage,
  UpdateApiKeyMessage,
  DeleteApiKeyMessage
} from './configuration';
import {
  RequestPublishingStandardsDataMessage,
  PublishingStandardsDataMessage,
  SetPublishingPresetMessage,
  SetPublishingTrimMessage
} from './publishing';
import {
  RequestActiveFileMessage,
  ActiveFileMessage,
  RequestManuscriptGlobsMessage,
  ManuscriptGlobsMessage,
  RequestChapterGlobsMessage,
  ChapterGlobsMessage
} from './sources';
import {
  TabChangedMessage,
  OpenGuideFileMessage,
  OpenDocsFileMessage,
  OpenResourceMessage,
  RequestSelectionMessage,
  SelectionDataMessage,
  SelectionUpdatedMessage,
  OpenSettingsMessage,
  OpenSettingsToggleMessage,
  WebviewErrorMessage
} from './ui';
import { ErrorMessage } from './error';
import { StatusMessage } from './status';
import {
  CopyResultMessage,
  SaveResultMessage,
  SaveResultSuccessMessage
} from './results';
import {
  StreamStartedMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  CancelAnalysisRequestMessage,
  CancelDictionaryRequestMessage,
  CancelContextRequestMessage,
  CancelCategorySearchRequestMessage
} from './streaming';

export type WebviewToExtensionMessage =
  | AnalyzeDialogueMessage
  | AnalyzeProseMessage
  | AnalyzeWritingToolsMessage
  | LookupDictionaryMessage
  | CopyResultMessage
  | SaveResultMessage
  | UpdateSettingMessage
  | RequestSettingsDataMessage
  | RequestSelectionMessage
  | GenerateContextMessage
  | MeasureProseStatsMessage
  | MeasureStyleFlagsMessage
  | MeasureWordFrequencyMessage
  | RunWordSearchMessage
  | CategorySearchRequestMessage
  | TabChangedMessage
  | OpenGuideFileMessage
  | OpenDocsFileMessage
  | OpenResourceMessage
  | RequestModelDataMessage
  | SetModelSelectionMessage
  | RequestPublishingStandardsDataMessage
  | SetPublishingPresetMessage
  | SetPublishingTrimMessage
  | RequestActiveFileMessage
  | RequestManuscriptGlobsMessage
  | RequestChapterGlobsMessage
  | ResetTokenUsageMessage
  | RequestApiKeyMessage
  | UpdateApiKeyMessage
  | DeleteApiKeyMessage
  | WebviewErrorMessage
  | FastGenerateDictionaryMessage
  | CancelAnalysisRequestMessage
  | CancelDictionaryRequestMessage
  | CancelContextRequestMessage
  | CancelCategorySearchRequestMessage;

export type ExtensionToWebviewMessage =
  | AnalysisResultMessage
  | MetricsResultMessage
  | SearchResultMessage
  | CategorySearchResultMessage
  | DictionaryResultMessage
  | ContextResultMessage
  | SaveResultSuccessMessage
  | SettingsDataMessage
  | OpenSettingsMessage
  | OpenSettingsToggleMessage
  | SelectionDataMessage
  | ErrorMessage
  | StatusMessage
  | SelectionUpdatedMessage
  | ModelDataMessage
  | ActiveFileMessage
  | ManuscriptGlobsMessage
  | ChapterGlobsMessage
  | PublishingStandardsDataMessage
  | TokenUsageUpdateMessage
  | ApiKeyStatusMessage
  | FastGenerateDictionaryResultMessage
  | DictionaryGenerationProgressMessage
  | StreamStartedMessage
  | StreamChunkMessage
  | StreamCompleteMessage;
