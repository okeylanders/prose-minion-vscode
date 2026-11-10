import type { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { MessageRouter } from '@handlers/MessageRouter';
import type {
  WorkshopGesturePlaygroundServicePort
} from '@handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler';
import type {
  WorkshopCreativeVariationsServicePort
} from '@handlers/domain/workshop/widgets/creativeVariations/WorkshopCreativeVariationsHandler';
import type {
  WorkshopShowVsTellServicePort
} from '@handlers/domain/workshop/widgets/showVsTell/WorkshopShowVsTellHandler';
import type {
  WorkshopLexicalGravityModelPort,
  WorkshopLexicalGravityRepositoryPort
} from '@handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler';
import type {
  WorkshopStandingDirectiveServicePort
} from '@handlers/domain/workshop/WorkshopStandingDirectiveHandler';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type {
  WorkshopContextIntakeService
} from '@/application/services/workshop/WorkshopContextIntakeService';
import type {
  WorkshopSessionPersistenceCoordinator
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import type {
  WorkshopOneShotWidgetRoomSend
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitCoordinator';
import type {
  WorkshopTranscriptExportRequest,
  WorkshopTranscriptExportResult
} from '@/application/services/workshop/export/WorkshopTranscriptExportService';
import type { LogSink, ShellService } from '@/platform';
import type { WorkshopReadInRecordLookup } from '@handlers/domain/workshop/WorkshopReadInRoutes';
import type { WorkshopProjectMemoryWritePort } from '@handlers/domain/workshop/WorkshopProjectMemoryHandler';
import type { WorkshopProjectMemoryManagerPort } from '@handlers/domain/workshop/WorkshopProjectMemoryManagerHandler';
import type { WorkshopBookmarkBrowserPort } from '@handlers/domain/workshop/WorkshopBookmarkBrowserHandler';
import type { WorkshopMemoryDraftPorts } from '@handlers/domain/workshop/WorkshopMemoryDraftHandler';
import type {
  WorkshopPinnedContextServices
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextPorts';

/** The one project-memory library as the Workshop's route owners reach it: Slice 3's writes and Slice 4b's manager. */
export type WorkshopProjectMemoryPort = WorkshopProjectMemoryWritePort & WorkshopProjectMemoryManagerPort;
import type { FileEditApplyPort } from '@/domain/models/FileEdit';
import type { WorkshopRunCompletionInput } from '@/application/services/workshop/WorkshopRunCompletion';
import type {
  ErrorSource,
  MessageType,
  WorkshopChatTarget,
  WorkshopEditOfferRequest,
  WorkshopFileEditsMode,
  WorkshopSessionAction,
  WorkshopTurn
} from '@messages';

/**
 * A host-directed run in place of a writer's message (a reply edit offer's
 * press; ADR 2026-11-10 D4, D5). It rides the room's one message path, so
 * the room's usual frames are delivered unchanged; what differs is here:
 * - the writer turn holds the host's sentence and names what was pressed;
 * - `frame` is a trusted frame placed before the writer-message slot, and
 *   `message` fills that slot;
 * - nothing streams to the thread, and `finalReply` checks and words the
 *   reply (the engine's `finalReplyCheck`);
 * - `complete` settles the result in place of `completeWorkshopRun`;
 * - a run that fails or is stopped rolls its writer turn back.
 */
export interface WorkshopDirectedRun {
  readonly editOfferRequest: WorkshopEditOfferRequest;
  readonly displayText: string;
  readonly message: string;
  readonly frame: string;
  readonly finalReply: {
    readonly check: (content: string) => string | undefined;
    readonly retained: (content: string) => string;
  };
  readonly complete: (input: WorkshopRunCompletionInput) => WorkshopTurn | undefined;
}

/** What the room's message path came to; `cancelled` when the run was stopped before it completed. */
export interface WorkshopDirectedRunResult {
  committed: boolean;
  refusalReason?: string;
  cancelled?: boolean;
}

/** Register a Workshop mutation behind the shared session-operation gate. */
export type WorkshopMutationRouteRegistrar = (
  messageType: MessageType,
  handler: (message: never) => Promise<void>,
  sessionAction?: WorkshopSessionAction,
  onBlocked?: (reason: string, message: never) => void
) => void;

/** The route owner used when the shared mutation gate reports a refusal. */
export type WorkshopMutationRouteOwner =
  | 'WorkshopContextHandler'
  | 'WorkshopExcerptScopeHandler'
  | 'WorkshopLexicalGravityHandler'
  | 'WorkshopLightboxTileHandler'
  | 'WorkshopRoomHandler'
  | 'WorkshopSessionMessageHandler'
  | 'WorkshopStandingDirectiveHandler'
  | 'WorkshopTodoHandler'
  | 'WorkshopBookmarkHandler'
  | 'WorkshopBookmarkBrowserHandler'
  | 'WorkshopProjectMemoryHandler'
  | 'WorkshopSavedTurnMemoryHandler'
  | 'WorkshopProjectMemoryManagerHandler'
  | 'WorkshopPinnedContextHandler'
  | 'WorkshopFileEditHandler'
  | 'WorkshopEditOfferHandler'
  | 'WorkshopWidgetHostHandler';

/**
 * Room-owned effects available to Workshop route slices.
 *
 * Callbacks keep live run/budget state and transport ownership in the room
 * orchestrator. A slice receives only the effects it actually uses via Pick.
 * Error source and route-owner attribution are pre-bound by the composition.
 */
export interface WorkshopRoomEffects {
  postSessionState: () => void;
  postTurn: (turn: WorkshopTurn) => void;
  markDirty: (reason: string) => void;
  reportError: (message: string, details?: string) => void;
  sendStatus: (message: string) => void;
  discardConversations: (conversationIds: readonly string[]) => void;
}

/** The guarded run state an excerpt/scope slice may query but must not own. */
export interface WorkshopRunGate {
  excerptMutationBlockedReason: () => string | undefined;
}

/**
 * Feature collaborators cross the Workshop boundary as one focused bundle.
 * Adding another widget extends this seam; it does not add another positional
 * argument to the already broad room-controller constructor.
 */
export interface WorkshopWidgetRuntime {
  gesturePlayground: WorkshopGesturePlaygroundServicePort;
  creativeVariations: WorkshopCreativeVariationsServicePort;
  showVsTell: WorkshopShowVsTellServicePort;
  standingDirectives: WorkshopStandingDirectiveServicePort;
  lexicalGravity: {
    model: WorkshopLexicalGravityModelPort;
    repository: WorkshopLexicalGravityRepositoryPort;
  };
}

/** Transcript export seam; the composition root supplies the real service. */
export interface WorkshopTranscriptExportPort {
  export(request: WorkshopTranscriptExportRequest): Promise<WorkshopTranscriptExportResult>;
}

/** Stable dependencies owned by the Workshop-internal composition tier. */
export interface WorkshopSliceCompositionDependencies {
  contextAssistantService: ContextAssistantService;
  session: WorkshopSessionService;
  postMessage: MessageTransport;
  shell: ShellService;
  contextIntakeService: WorkshopContextIntakeService;
  sessionPersistence: WorkshopSessionPersistenceCoordinator;
  transcriptExport: WorkshopTranscriptExportPort;
  widgetRuntime: WorkshopWidgetRuntime;
  /** Project memory's writes and manager (ADR 2026-11-04 D13): the one library, built in extension.ts. */
  projectMemory: WorkshopProjectMemoryPort;
  /** Pinned context (ADR 2026-11-04 D9): the one library and the seed's first-room report, built in extension.ts. */
  pinnedContext: WorkshopPinnedContextServices;
  /** The Bookmarks screen's reads (ADR 2026-11-05 D8): the recall service, built in extension.ts. */
  bookmarkBrowser: WorkshopBookmarkBrowserPort;
  /** Persona file edits' Apply and Preview (ADR 2026-11-05 D7–D9): the one gateway, built in extension.ts. */
  fileEditApply: FileEditApplyPort;
  /** The helper's memory drafts (ADR 2026-11-05 D5): the helper agent, built in extension.ts, and the setting that turns it off. */
  memoryDrafts: WorkshopMemoryDraftPorts;
  outputChannel: LogSink;
}

/**
 * Live room facts and effects needed across the composition seam.
 *
 * Slice constructors may retain these callbacks but must not invoke them until
 * WorkshopSliceComposition construction has completed. Persistence stays in
 * the dependency bundle rather than being re-exposed as pass-through effects.
 */
export interface WorkshopSliceHostEffects {
  postSessionState: () => void;
  postTurn: (turn: WorkshopTurn) => void;
  reportRouteError: (
    source: ErrorSource,
    message: string,
    details: string | undefined,
    owner: WorkshopMutationRouteOwner
  ) => void;
  sendStatus: (message: string) => void;
  discardConversations: (conversationIds: readonly string[]) => void;
  excerptMutationBlockedReason: () => string | undefined;
  flushDeferredConversationSettings: () => Promise<void>;
  activeRunLabel: () => 'Context wizard' | 'response' | undefined;
  sendRoomMessage: WorkshopOneShotWidgetRoomSend;
  isRoomRunActive: () => boolean;
  /** `proseMinion.workshop.fileEdits`, read live (ADR 2026-11-05 D11): checked at Apply and at the last boundary. */
  fileEditsMode: () => WorkshopFileEditsMode;
  /** A reply edit offer's press (ADR 2026-11-10 D4): a host-directed run to its author's own conversation. */
  runDirected: (target: WorkshopChatTarget, run: WorkshopDirectedRun) => Promise<WorkshopDirectedRunResult>;
  /** A turn's time as the room shows it, in the session's timezone. */
  formatTurnTime: (timestamp: number) => string;
  /**
   * Host-side only (Wayfinding D4): what the chat target's manifest recorded
   * when a read-in file was read, for the reader's "changed since".
   */
  findReadInRecord: WorkshopReadInRecordLookup;
  disposeRoomSubscriptions: () => void;
  disposeActiveRoomRun: () => void;
}

export type WorkshopRoomRouteRegistration = (
  router: MessageRouter,
  registerMutation: WorkshopMutationRouteRegistrar
) => void;
