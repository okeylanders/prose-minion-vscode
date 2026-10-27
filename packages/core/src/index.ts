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

// --- Shared contract: Workshop startup notice (version + screenshot names) ---
export {
  WORKSHOP_NOTICE_SHOT_DIR,
  WORKSHOP_NOTICE_SHOTS,
  WORKSHOP_STARTUP_NOTICE_DISMISSED_KEY,
  WORKSHOP_STARTUP_NOTICE_VERSION
} from '@shared/constants/workshopNotices';
export type { WorkshopNoticeShot } from '@shared/constants/workshopNotices';

// --- Application: host message router ---
export { MessageHandler } from '@/application/handlers/MessageHandler';
export type {
  CoreServices,
  MessageTransport,
  ResultCache,
  SecretsPort,
  WorkshopUiActions
} from '@/application/handlers/MessageHandlerContracts';

// --- Application: Workshop session aggregate (ADR 2026-07-03) ---
export {
  WorkshopSessionService,
  WorkshopSessionActiveRunPersistenceError
} from '@/application/services/workshop/WorkshopSessionService';
export type {
  WorkshopSessionHydrationResult
} from '@/application/services/workshop/WorkshopSessionRecords';
export {
  parseWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
export type {
  WorkshopConversationLogicalKey,
  WorkshopRuntimeConversationBindings,
  WorkshopSessionStateV1,
  WorkshopStoredTodoItemV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
export {
  WorkshopSessionTimeService,
  parseWorkshopSessionTemporalStateV1,
  workshopGuestConversationKey
} from '@/application/services/workshop/WorkshopSessionTimeService';
export type {
  WorkshopPersonaConversationKey,
  WorkshopPreparedTimeNotice,
  WorkshopSessionTemporalStateV1,
  WorkshopSessionTimeRuntimeState,
  WorkshopTimeNoticeReason
} from '@/application/services/workshop/WorkshopSessionTimeService';
export {
  WorkshopSessionPersistenceCoordinator
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
export type {
  WorkshopSessionHydrateResult,
  WorkshopSessionListData
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
export {
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
export type {
  WorkshopPersistedSessionV1,
  WorkshopPersistedSessionV2,
  WorkshopPersistedSummaryV1
} from '@/application/services/workshop/WorkshopPersistedSession';
export { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
export {
  WorkshopRoomDeliveryService
} from '@/application/services/workshop/WorkshopRoomDeliveryService';
export { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
export { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
export { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
export { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
export {
  WorkshopTranscriptExportService
} from '@/application/services/workshop/export/WorkshopTranscriptExportService';
export {
  WorkshopTranscriptRecallService
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
export {
  RejectedModelResponseRecoveryStore,
  RejectedModelResponseRecoveryShellPresenter,
  persistRejectedModelResponse,
  recoveryLocationNotice
} from '@/infrastructure/storage/RejectedModelResponseRecoveryStore';
export type {
  RejectedModelResponseRecovery,
  RejectedModelResponseRecoveryPresenter,
  RejectedModelResponseRecoveryReceipt
} from '@/infrastructure/storage/RejectedModelResponseRecoveryStore';
export type { RecoverableToolName } from '@messages';
export { WorkshopStandingDirectiveService } from '@/application/services/workshop/directives/WorkshopStandingDirectiveService';
export { LexicalGravityModelService } from '@services/widgets/LexicalGravityModelService';
export { LexicalGravityLensRepository } from '@/infrastructure/storage/LexicalGravityLensRepository';
export { DictionaryHistoryStore } from '@/infrastructure/storage/DictionaryHistoryStore';
export { WorkshopWriterProfileService } from '@/application/services/workshop/WorkshopWriterProfileService';
// Seed delivery: a handoff opens only on the panel's grant (PR #150 F-03)
export {
  WORKSHOP_SEED_TIMEOUT_MS,
  WorkshopSeedDelivery
} from '@/application/services/workshop/WorkshopSeedDelivery';
export type {
  WorkshopSeedDeliveryOptions,
  WorkshopSeedDeliveryPorts
} from '@/application/services/workshop/WorkshopSeedDelivery';
export { GesturePlaygroundService } from '@services/widgets/GesturePlaygroundService';
export { CreativeVariationsService } from '@services/widgets/creativeVariations/CreativeVariationsService';
export { ShowVsTellService } from '@services/widgets/showVsTell/ShowVsTellService';
export {
  buildGestureDirective
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundDirective';
export {
  WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION,
  inspectWorkshopWidgetRecommendation
} from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
export {
  stripWorkshopWidgetRecommendationControl
} from '@/utils/workshopWidgetRecommendationProtocol';
export {
  WORKSHOP_WIDGET_CATALOG,
  workshopWidgetDescriptor,
  workshopWidgetLabel,
  isWorkshopWidgetId,
  isLiveWorkshopWidgetId,
  workshopWidgetArtifactKind,
  workshopWidgetIdFromArtifactKind
} from '@shared/constants/workshopWidgets';
export type {
  WorkshopWidgetDescriptor,
  WorkshopWidgetGroupDescriptor,
  WorkshopWidgetRail,
  WorkshopWidgetGroupName
} from '@shared/constants/workshopWidgets';

// --- Infrastructure: Workshop workspace-session store ---
export {
  WorkshopSessionStore,
  WorkshopSessionStoreUnavailableError,
  WorkshopSessionFileReadError,
  WorkshopNamedSessionNotFoundError,
  WorkshopNamedSessionIdentityConflictError
} from '@/infrastructure/storage/WorkshopSessionStore';
export type {
  WorkshopSessionStoreAvailability,
  WorkshopSessionStoreUnavailableReason,
  WorkshopStoredSessionSummary
} from '@/infrastructure/storage/WorkshopSessionStore';

// --- Infrastructure: Workshop transcript exports ---
export { WorkshopTranscriptExportStore } from '@/infrastructure/storage/WorkshopTranscriptExportStore';

// --- Infrastructure: secrets ---
export { SecretStorageService } from '@/infrastructure/secrets/SecretStorageService';

// --- Infrastructure: AI resource orchestration ---
export { ResourceLoaderService } from '@orchestration/ResourceLoaderService';
export { AIResourceManager } from '@orchestration/AIResourceManager';
export { AIResourceRefresh } from '@orchestration/AIResourceRefresh';

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
export { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
export { LightboxService, type LightboxSourceTicket } from '@/infrastructure/lightbox/LightboxService';
export { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
export { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
export { LightboxWriterBaseline } from '@/infrastructure/lightbox/LightboxWriterBaseline';
export { LightboxBoardStore, type LightboxBoardMemory } from '@/infrastructure/storage/LightboxBoardStore';
export { LightboxBoardLibrary } from '@/application/services/lightbox/LightboxBoardLibrary';
export {
  AccountBalanceService,
  OpenRouterAccountClient
} from '@/infrastructure/account';

// --- Draft Edit (ADR 2026-10-21): the Proofread and Craft Flags passes, their runs, and the adapter's helpers ---
export { ProofreadService } from '@services/proofread/ProofreadService';
export { CraftFlagsService, liveCatalogPrices } from '@services/craftFlags/CraftFlagsService';
export {
  CraftFlagsUseCase,
  type CraftFlagsApproval,
  type CraftFlagsBegin,
  type CraftFlagsGesture,
  type CraftFlagsRunPlan
} from '@/application/services/draftEdit/CraftFlagsUseCase';
export { describeCraftFlagsOutcome, describeCraftFlagsPlan } from '@/application/services/draftEdit/craftFlagsSummary';
export { CRAFT_FLAG_CATEGORIES, craftFlagCategoriesOf, type CraftFlagsOutcome, type CraftFlagsPass } from '@/domain/models/CraftFlag';
export {
  DraftEditUseCase,
  type DraftEditQuickFixOutcome,
  type DraftEditQuickFixRequest,
  type DraftEditRunHooks,
  type DraftEditRunPlan
} from '@/application/services/draftEdit/DraftEditUseCase';
export { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
export { describeDraftEditOutcome, describeQuickFixOutcome, type DraftEditSummary } from '@/application/services/draftEdit/draftEditSummary';
export {
  DRAFT_EDIT_LANGUAGE_IDS,
  PROOFREAD_SPELLING_CONVENTIONS,
  isProofreadSpellingConvention,
  type DraftEditFixReport,
  type DraftEditOutcome,
  type DraftEditPass,
  type DraftEditReview,
  type DraftEditTarget,
  type ProofreadPass,
  type ProofreadSettings,
  type ProofreadSpellingConvention
} from '@/domain/models/DraftEdit';
export { proofreadWordList } from '@/utils/proofread/proofreadWordList';
export { shiftRanges, type TextChange } from '@/utils/draftEdit/shiftRanges';
