/**
 * Messages barrel export
 * Re-exports all message types for backward compatibility
 */

// Base types
export * from './base';

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

// Union types for message routing
import {
  AnalyzeDialogueMessage,
  AnalyzeProseMessage,
  AnalysisResultMessage
} from './analysis';
import {
  LookupDictionaryMessage,
  DictionaryResultMessage
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
  SearchResultMessage
} from './search';
import {
  RequestModelDataMessage,
  SetModelSelectionMessage,
  ModelDataMessage,
  RequestSettingsDataMessage,
  UpdateSettingMessage,
  SettingsDataMessage,
  TokenUsageUpdateMessage,
  ResetTokenUsageMessage
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
  RequestSelectionMessage,
  SelectionDataMessage,
  SelectionUpdatedMessage,
  OpenSettingsMessage,
  OpenSettingsToggleMessage
} from './ui';
import {
  ErrorMessage,
  StatusMessage,
  CopyResultMessage,
  SaveResultMessage,
  SaveResultSuccessMessage
} from './results';

export type WebviewToExtensionMessage =
  | AnalyzeDialogueMessage
  | AnalyzeProseMessage
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
  | TabChangedMessage
  | OpenGuideFileMessage
  | RequestModelDataMessage
  | SetModelSelectionMessage
  | RequestPublishingStandardsDataMessage
  | SetPublishingPresetMessage
  | SetPublishingTrimMessage
  | RequestActiveFileMessage
  | RequestManuscriptGlobsMessage
  | RequestChapterGlobsMessage
  | ResetTokenUsageMessage;

export type ExtensionToWebviewMessage =
  | AnalysisResultMessage
  | MetricsResultMessage
  | SearchResultMessage
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
  | TokenUsageUpdateMessage;
