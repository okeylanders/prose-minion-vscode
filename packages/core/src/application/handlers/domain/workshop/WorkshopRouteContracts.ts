import type { WorkshopLocationsProposalPorts } from '@handlers/domain/workshop/WorkshopLocationsProposalHandler';
import type { WorkshopSavedSessionTodos } from '@/application/services/workshop/todos/WorkshopSavedSessionTodos';
import type { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import type { MessageTransport, WorkshopUiActions } from '@handlers/MessageHandlerContracts';
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
import type { WorkshopSelectedTextSnapshotsPort } from '@handlers/domain/workshop/WorkshopSelectedTextHandler';
import type {
  WorkshopPinnedContextServices
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextPorts';

/** The one project-memory library as the Workshop's route owners reach it: Slice 3's writes and Slice 4b's manager. */
export type WorkshopProjectMemoryPort = WorkshopProjectMemoryWritePort & WorkshopProjectMemoryManagerPort;
import type { WorkshopEditOfferRoomView } from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import type { FileEditApplyPort } from '@/domain/models/FileEdit';
import type { FileEditIdentity } from '@/domain/models/FileEditStaging';
import type { AgentFinalReplyCheck, CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import type { WorkshopPassageSearchPorts } from '@handlers/domain/workshop/WorkshopPassageSearchHandler';
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
 * - `boundExcerpt` says which document `<excerpt/>` names in the reply;
 * - `complete` settles the result in place of `completeWorkshopRun`;
 * - a run that fails or is stopped rolls its writer turn back.
 *
 * A directed run is one of two (ADR 2026-11-20 D18): this, an edit offer's
 * press, or a `WorkshopResultsDeliveryRun`.
 */
export type WorkshopDirectedRun = WorkshopEditOfferDirectedRun | WorkshopResultsDeliveryRun;

/**
 * A host-directed run that delivers results the host holds to the persona
 * who asked for them (ADR 2026-11-20 D18, D19a, D21). It rides the same
 * message path, and differs from a press:
 * - its reply streams and is ordinary prose, settled by
 *   `completeWorkshopRun`, so it may carry trailers;
 * - `frame` is called once, before dispatch, with the room the message has
 *   left when the model's window is known, and returns the frame to place,
 *   or nothing when nothing fits: the run then records and sends nothing;
 * - `markRequestTurn` marks the provisional writer turn the path recorded,
 *   and returns it as marked;
 * - `completion` is read at completion: what a run that is not adopted does
 *   with that turn, and the receipt an adopted reply carries.
 */
export interface WorkshopResultsDeliveryRun {
  readonly resultsDelivery: {
    readonly frame: (window: CapabilityContextWindow | undefined) => string | undefined;
    readonly markRequestTurn: (turnId: string) => WorkshopTurn | undefined;
    readonly completion: () => Pick<WorkshopRunCompletionInput, 'notAdopted' | 'passageSearchDelivery'>;
  };
  readonly displayText: string;
  readonly message: string;
  readonly editOfferRequest?: undefined;
  readonly frame?: undefined;
  readonly finalReply?: undefined;
  readonly boundExcerpt?: undefined;
  readonly complete?: undefined;
}

export interface WorkshopEditOfferDirectedRun {
  readonly resultsDelivery?: undefined;
  readonly editOfferRequest: WorkshopEditOfferRequest;
  readonly displayText: string;
  readonly message: string;
  readonly frame: string;
  readonly finalReply: {
    readonly check: AgentFinalReplyCheck;
    readonly retained: (content: string) => string;
    /** The engine holds the run's retention, and hands over its commit: called once the reply is adopted, or never. */
    readonly deferRetention?: (commit: () => boolean) => void;
  };
  /**
   * The document `<excerpt/>` names in this run's reply, when the run is
   * bound to one (an excerpt offer's own, ADR 2026-11-10 D2): the reply's
   * file edits are staged against it, whatever the room's excerpt is now.
   */
  readonly boundExcerpt?: FileEditIdentity;
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
  | 'WorkshopSelectedTextHandler'
  | 'WorkshopRoomHandler'
  | 'WorkshopSessionMessageHandler'
  | 'WorkshopStandingDirectiveHandler'
  | 'WorkshopTodoHandler'
  | 'WorkshopLocationsProposalHandler'
  | 'WorkshopPassageSearchHandler'
  | 'WorkshopBookmarkHandler'
  | 'WorkshopReactionHandler'
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
  /** Selected Text (ADR 2026-11-14 D11): the window's selection snapshots, built in extension.ts. */
  selectedText: WorkshopSelectedTextSnapshotsPort;
  /** A persona's saved-session to-do changes (ADR 2026-11-19 D6): the write port, built in extension.ts. */
  savedSessionTodos?: WorkshopSavedSessionTodos;
  /** A persona's context-paths card (ADR 2026-11-19 D27): C1's checker and settings, built in extension.ts. */
  locationsProposals?: WorkshopLocationsProposalPorts;
  /** A persona's passage search (ADR 2026-11-20 D20): the one engine, the listing and the report file, built in extension.ts. */
  passageSearch?: WorkshopPassageSearchPorts;
  workshopHighlights?: import('@/application/services/workshop/highlights/WorkshopHighlightEditor').WorkshopHighlightEditor;
  openWorkshopBranch?: WorkshopUiActions['openWorkshopBranch'];
  revealWorkshopRoom?: (roomId: string) => boolean;
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
  /** Whether the room has an excerpt with text now: a passage-search request naming it is checked against this (ADR 2026-11-20 D17). */
  hasExcerpt: () => boolean;
  /** What an edit offer's view is derived from, as `postSessionState` reads it (ADR 2026-11-17 D2). */
  editOfferRoomView: () => WorkshopEditOfferRoomView;
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
