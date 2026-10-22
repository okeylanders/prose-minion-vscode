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
export * from './citations';
export * from './inferenceContext';
export * from './accountBalance';
export * from './warnings';

// Domain-specific messages
export * from './analysis';
export * from './dictionary';
export * from './dictionaryHistory';
export * from './context';
export * from './metrics';
export * from './search';
export * from './configuration';
export * from './publishing';
export * from './sources';
export * from './ui';
export * from './results';
export * from './streaming';
export * from './configuredResources';
export * from './workshop';
export * from './lightbox';
export * from './lightboxReadings';
export * from './lightboxRuns';
export * from './lightboxEstimate';
export * from './lightboxStoryTiles';
export * from './lightboxGravity';
export * from './lightboxStale';
export * from './lightboxHandoff';
export * from './lightboxProjectFiles';
export * from './lightboxContextFiles';
export * from './lightboxCraftTiles';
export * from './lightboxNumbers';
export * from './lightboxPlotTiles';
export * from './lightboxSections';
export * from './lightboxOpinion';
export * from './lightboxSteering';
export * from './lightboxPassages';
export * from './lightboxBoards';

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
  RequestDictionaryHistoryMessage,
  DictionaryHistoryMessage,
  RequestDictionaryHistoryEntryMessage,
  DictionaryHistoryEntryMessage,
  DeleteDictionaryHistoryEntryMessage,
  ClearDictionaryHistoryMessage
} from './dictionaryHistory';
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
  OpenWorkshopMessage,
  OpenLightboxMessage,
  OpenAssistantSettingsMessage,
  RequestStartupNoticeMessage,
  StartupNoticeDataMessage,
  DismissStartupNoticeMessage,
  WebviewErrorMessage
} from './ui';
import { ErrorMessage } from './error';
import { StatusMessage } from './status';
import { ClearTransientApiKeyWarningMessage } from './warnings';
import {
  RequestAccountBalanceMessage,
  AccountBalanceDataMessage
} from './accountBalance';
import {
  CopyResultMessage,
  CopyResultSuccessMessage,
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
  CancelCategorySearchRequestMessage,
  CancelWorkshopRequestMessage
} from './streaming';
import {
  WorkshopRunToolMessage,
  WorkshopQuickActionMessage,
  WorkshopSendMessageMessage,
  WorkshopInviteGuestMessage,
  WorkshopDismissGuestMessage,
  WorkshopSelectPersonaMessage,
  WorkshopSetChatTargetMessage,
  WorkshopSetConversationSettingsMessage,
  WorkshopSetExcerptMessage,
  WorkshopAddContextTextMessage,
  WorkshopAddContextFileMessage,
  WorkshopRefreshContextFilesMessage,
  WorkshopRemoveContextAttachmentMessage,
  WorkshopUpdateContextTextMessage,
  WorkshopRequestContextAttachmentMessage,
  WorkshopContextAttachmentContentMessage,
  WorkshopOpenContextAttachmentFileMessage,
  WorkshopRequestContextCatalogMessage,
  WorkshopContextCatalogMessage,
  WorkshopSearchContextResourcesMessage,
  WorkshopContextSearchResultsMessage,
  WorkshopAddContextResourcesMessage,
  WorkshopAttachMessageResourcesMessage,
  WorkshopAttachMessageFileMessage,
  WorkshopRemoveMessageAttachmentMessage,
  WorkshopSetExcerptResourceMessage,
  WorkshopRunContextWizardMessage,
  WorkshopTodoActionMessage,
  WorkshopPickExcerptFileMessage,
  WorkshopRereadExcerptMessage,
  WorkshopSetSessionScopeMessage,
  WorkshopRepinExcerptMessage,
  WorkshopResetSessionMessage,
  WorkshopRewindSessionMessage,
  WorkshopBranchSessionMessage,
  WorkshopRequestSessionMessage,
  WorkshopDismissErrorMessage,
  WorkshopSaveSessionMessage,
  WorkshopListSessionsMessage,
  WorkshopOpenSessionMessage,
  WorkshopRenameSessionMessage,
  WorkshopDuplicateSessionMessage,
  WorkshopRevealSessionMessage,
  WorkshopDeleteSessionMessage,
  WorkshopExportSessionMessage,
  WorkshopTurnMessage,
  WorkshopComposerDraftRestoredMessage,
  WorkshopSessionStateMessage,
  WorkshopSessionsDataMessage,
  WorkshopSessionActionResultMessage,
  WorkshopSessionSaveStatusMessage,
  WorkshopSessionContextScanMessage,
  WorkshopSessionRecoveryNoticeMessage,
  WorkshopGesturePlaygroundGenerateMessage,
  CancelGesturePlaygroundGenerateRequestMessage,
  WorkshopGesturePlaygroundGenerationProgressMessage,
  WorkshopGesturePlaygroundMenuResultMessage,
  WorkshopCreativeVariationsGenerateMessage,
  CancelCreativeVariationsGenerateRequestMessage,
  WorkshopCreativeVariationsGenerationProgressMessage,
  WorkshopCreativeVariationsResultMessage,
  WorkshopShowVsTellGenerateMessage,
  CancelShowVsTellGenerateRequestMessage,
  WorkshopShowVsTellGenerationProgressMessage,
  WorkshopShowVsTellResultMessage,
  WorkshopRequestLexicalGravityLensesMessage,
  WorkshopLexicalGravityLensesDataMessage,
  WorkshopPreviewLexicalGravityMessage,
  WorkshopLexicalGravityPreviewResultMessage,
  WorkshopBuildLexicalGravityLensMessage,
  WorkshopLexicalGravityLensCandidatesMessage,
  WorkshopSaveLexicalGravityLensesMessage,
  WorkshopLexicalGravityLensesSavedMessage,
  WorkshopOpenLexicalGravityBuildMessage,
  WorkshopLexicalGravityBuildSeedMessage,
  WorkshopSeedClaimMessage,
  WorkshopSeedClaimResultMessage,
  WorkshopSeedAnswerMessage,
  WorkshopSeedReceiverMessage,
  WorkshopStageLightboxTileMessage,
  WorkshopLightboxTileOfferedMessage,
  WorkshopAcceptLightboxTileMessage,
  WorkshopLightboxTileStagedMessage,
  WorkshopRequestWidgetConfigMessage,
  WorkshopWidgetConfigDataMessage,
  WorkshopWidgetConfigRestoredMessage,
  WorkshopCommitWidgetMessage,
  WorkshopApplyStandingWidgetMessage,
  WorkshopRemoveStandingWidgetMessage,
  WorkshopWidgetActionResultMessage
} from './workshop';
import {
  LightboxRequestBoardMessage,
  LightboxSetSourceMessage,
  LightboxPickSourceFileMessage,
  LightboxRefreshSourceMessage,
  LightboxDismissRefusalMessage,
  LightboxBoardMessage,
  LightboxSourceRefusedMessage
} from './lightbox';
import {
  LightboxSetLensesMessage,
  LightboxRunEstimateMessage,
  LightboxRunMessage,
  LightboxCancelRunMessage,
  LightboxRunProgressMessage,
  LightboxGroupResultMessage
} from './lightboxRuns';
import {
  LightboxAddContextFilesMessage,
  LightboxRemoveContextFileMessage,
  LightboxContextFilesMessage
} from './lightboxContextFiles';
import {
  LightboxHandOffMessage,
  LightboxHandOffResultMessage,
  LightboxOpenWorkshopMessage,
  LightboxWorkshopTrayMessage
} from './lightboxHandoff';
import { LightboxSetSparkDismissedMessage } from './lightboxStoryTiles';
import {
  LightboxAddProjectContextMessage,
  LightboxChooseProjectSourceMessage,
  LightboxProjectCatalogMessage,
  LightboxProjectCatalogSearchResultsMessage,
  LightboxRequestProjectCatalogMessage,
  LightboxSearchProjectCatalogMessage
} from './lightboxProjectFiles';
import { LightboxPassageMessage, LightboxRequestPassageMessage } from './lightboxPassages';

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
  | RequestStartupNoticeMessage
  | DismissStartupNoticeMessage
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
  | RequestAccountBalanceMessage
  | RequestApiKeyMessage
  | UpdateApiKeyMessage
  | DeleteApiKeyMessage
  | WebviewErrorMessage
  | OpenWorkshopMessage
  | OpenLightboxMessage
  | OpenAssistantSettingsMessage
  | FastGenerateDictionaryMessage
  | RequestDictionaryHistoryMessage
  | RequestDictionaryHistoryEntryMessage
  | DeleteDictionaryHistoryEntryMessage
  | ClearDictionaryHistoryMessage
  | CancelAnalysisRequestMessage
  | CancelDictionaryRequestMessage
  | CancelContextRequestMessage
  | CancelCategorySearchRequestMessage
  | CancelWorkshopRequestMessage
  | WorkshopRunToolMessage
  | WorkshopQuickActionMessage
  | WorkshopSendMessageMessage
  | WorkshopInviteGuestMessage
  | WorkshopDismissGuestMessage
  | WorkshopSelectPersonaMessage
  | WorkshopSetChatTargetMessage
  | WorkshopSetConversationSettingsMessage
  | WorkshopSetExcerptMessage
  | WorkshopAddContextTextMessage
  | WorkshopAddContextFileMessage
  | WorkshopRefreshContextFilesMessage
  | WorkshopRemoveContextAttachmentMessage
  | WorkshopUpdateContextTextMessage
  | WorkshopRequestContextAttachmentMessage
  | WorkshopOpenContextAttachmentFileMessage
  | WorkshopRequestContextCatalogMessage
  | WorkshopContextCatalogMessage
  | WorkshopSearchContextResourcesMessage
  | WorkshopContextSearchResultsMessage
  | WorkshopAddContextResourcesMessage
  | WorkshopAttachMessageResourcesMessage
  | WorkshopAttachMessageFileMessage
  | WorkshopRemoveMessageAttachmentMessage
  | WorkshopSetExcerptResourceMessage
  | WorkshopRunContextWizardMessage
  | WorkshopTodoActionMessage
  | WorkshopPickExcerptFileMessage
  | WorkshopRereadExcerptMessage
  | WorkshopSetSessionScopeMessage
  | WorkshopRepinExcerptMessage
  | WorkshopResetSessionMessage
  | WorkshopRewindSessionMessage
  | WorkshopBranchSessionMessage
  | WorkshopRequestSessionMessage
  | WorkshopDismissErrorMessage
  | WorkshopSaveSessionMessage
  | WorkshopListSessionsMessage
  | WorkshopOpenSessionMessage
  | WorkshopRenameSessionMessage
  | WorkshopDuplicateSessionMessage
  | WorkshopRevealSessionMessage
  | WorkshopDeleteSessionMessage
  | WorkshopExportSessionMessage
  | WorkshopGesturePlaygroundGenerateMessage
  | CancelGesturePlaygroundGenerateRequestMessage
  | WorkshopCreativeVariationsGenerateMessage
  | CancelCreativeVariationsGenerateRequestMessage
  | WorkshopShowVsTellGenerateMessage
  | CancelShowVsTellGenerateRequestMessage
  | WorkshopRequestLexicalGravityLensesMessage
  | WorkshopPreviewLexicalGravityMessage
  | WorkshopBuildLexicalGravityLensMessage
  | WorkshopSaveLexicalGravityLensesMessage
  | WorkshopOpenLexicalGravityBuildMessage
  | WorkshopSeedClaimMessage
  | WorkshopSeedAnswerMessage
  | WorkshopSeedReceiverMessage
  | WorkshopStageLightboxTileMessage
  | WorkshopAcceptLightboxTileMessage
  | WorkshopRequestWidgetConfigMessage
  | WorkshopCommitWidgetMessage
  | WorkshopApplyStandingWidgetMessage
  | WorkshopRemoveStandingWidgetMessage
  | LightboxRequestBoardMessage
  | LightboxSetSourceMessage
  | LightboxDismissRefusalMessage
  | LightboxPickSourceFileMessage
  | LightboxRefreshSourceMessage
  | LightboxSetLensesMessage
  | LightboxRunMessage
  | LightboxCancelRunMessage
  | LightboxAddContextFilesMessage
  | LightboxRemoveContextFileMessage
  | LightboxHandOffMessage
  | LightboxSetSparkDismissedMessage
  | LightboxOpenWorkshopMessage
  | LightboxRequestProjectCatalogMessage
  | LightboxSearchProjectCatalogMessage
  | LightboxChooseProjectSourceMessage
  | LightboxAddProjectContextMessage
  | LightboxRequestPassageMessage;

export type ExtensionToWebviewMessage =
  | AnalysisResultMessage
  | MetricsResultMessage
  | SearchResultMessage
  | CategorySearchResultMessage
  | DictionaryResultMessage
  | ContextResultMessage
  | CopyResultSuccessMessage
  | SaveResultSuccessMessage
  | SettingsDataMessage
  | OpenSettingsMessage
  | OpenSettingsToggleMessage
  | SelectionDataMessage
  | StartupNoticeDataMessage
  | ErrorMessage
  | StatusMessage
  | SelectionUpdatedMessage
  | ModelDataMessage
  | ActiveFileMessage
  | ManuscriptGlobsMessage
  | ChapterGlobsMessage
  | PublishingStandardsDataMessage
  | TokenUsageUpdateMessage
  | AccountBalanceDataMessage
  | ApiKeyStatusMessage
  | ClearTransientApiKeyWarningMessage
  | FastGenerateDictionaryResultMessage
  | DictionaryGenerationProgressMessage
  | DictionaryHistoryMessage
  | DictionaryHistoryEntryMessage
  | StreamStartedMessage
  | StreamChunkMessage
  | StreamCompleteMessage
  | WorkshopTurnMessage
  | WorkshopComposerDraftRestoredMessage
  | WorkshopSessionStateMessage
  | WorkshopSessionsDataMessage
  | WorkshopSessionActionResultMessage
  | WorkshopSessionSaveStatusMessage
  | WorkshopSessionContextScanMessage
  | WorkshopSessionRecoveryNoticeMessage
  | WorkshopContextCatalogMessage
  | WorkshopContextSearchResultsMessage
  | WorkshopContextAttachmentContentMessage
  | WorkshopGesturePlaygroundGenerationProgressMessage
  | WorkshopGesturePlaygroundMenuResultMessage
  | WorkshopCreativeVariationsGenerationProgressMessage
  | WorkshopCreativeVariationsResultMessage
  | WorkshopShowVsTellGenerationProgressMessage
  | WorkshopShowVsTellResultMessage
  | WorkshopLexicalGravityLensesDataMessage
  | WorkshopLexicalGravityPreviewResultMessage
  | WorkshopLexicalGravityLensCandidatesMessage
  | WorkshopLexicalGravityLensesSavedMessage
  | WorkshopLexicalGravityBuildSeedMessage
  | WorkshopSeedClaimResultMessage
  | WorkshopLightboxTileOfferedMessage
  | WorkshopLightboxTileStagedMessage
  | WorkshopWidgetConfigDataMessage
  | WorkshopWidgetConfigRestoredMessage
  | WorkshopWidgetActionResultMessage
  | LightboxBoardMessage
  | LightboxSourceRefusedMessage
  | LightboxRunEstimateMessage
  | LightboxRunProgressMessage
  | LightboxGroupResultMessage
  | LightboxContextFilesMessage
  | LightboxHandOffResultMessage
  | LightboxWorkshopTrayMessage
  | LightboxProjectCatalogMessage
  | LightboxProjectCatalogSearchResultsMessage
  | LightboxPassageMessage;
