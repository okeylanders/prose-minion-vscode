/**
 * Architectural boundary guards.
 *
 * A living registry of invariants the type-checker can't express. Add new
 * architectural witnesses here (one `it` per invariant) rather than scattering
 * them — a future contributor should find every boundary in one place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. @prose-minion/core is vscode-free — PERIOD (ADR 2026-06-16, monorepo split).
 *    After the Stage-2 move, the VS Code shell (extension.ts, the
 *    WebviewViewProvider, and the platform/vscode adapters) lives in
 *    `apps/vscode-extension`, NOT here. So core has NO sanctioned-shell
 *    exceptions: nothing under `packages/core/src` may import `vscode`. This is
 *    what lets core compile against an absent `vscode` module and unblocks the
 *    future desktop (Electron) app. Tests are skipped (they mock vscode by design).
 *
 *    RENDERER GLOBAL (sealed in Stage-2 Wave 1): the webview's runtime touchpoint
 *    is the `acquireVsCodeApi()` global, wrapped behind `AppMessagePort`
 *    (presentation/webview/ports/) and referenced in exactly ONE module — the
 *    VS Code adapter `presentation/webview/hooks/useVSCodeApi.ts`. It is NOT an
 *    `import 'vscode'`, so this import-scan guard does not (and need not) catch it.
 *
 *    APP-SHELL WITNESSES live on the other side of the split, next to the
 *    adapter they verify: apps/vscode-extension/src/__tests__/architecture/.
 *    This suite scans packages/core/src ONLY — core must never read the VS
 *    Code shell's source, not even in tests (PR #66 review, Marcus).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  persistedWorkshopWidgetLifecycleIds,
  type PersistedWorkshopWidgetId
} from '@/application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle';
import { workshopWidgetDescriptor } from '@shared/constants/workshopWidgets';

// __dirname = packages/core/src/__tests__/architecture -> core's src root.
const SRC_ROOT = path.resolve(__dirname, '..', '..');
const REPOSITORY_ROOT = path.resolve(SRC_ROOT, '..', '..', '..');

const SKIP_DIRS = new Set<string>([
  path.join(SRC_ROOT, '__tests__'), // tests mock vscode by design
]);

// Catches static `import … from 'vscode'`, `import * as vscode from 'vscode'`,
// `require('vscode')`, AND dynamic `import('vscode')` / `await import('vscode')`
// (a prior TextSourceResolver used exactly that idiom — see decision tracker D15).
const VSCODE_IMPORT = new RegExp(
  [
    /from\s+['"]vscode['"]/.source,
    /import\s+\*\s+as\s+vscode\s+from\s+['"]vscode['"]/.source,
    /require\(\s*['"]vscode['"]\s*\)/.source,
    /import\(\s*['"]vscode['"]\s*\)/.source,
  ].join('|')
);

const HANDLERS_ROOT = path.join(
  SRC_ROOT,
  'application',
  'handlers'
);
const WORKSHOP_HANDLER_ROOT = path.join(HANDLERS_ROOT, 'domain', 'workshop');
const WORKSHOP_SESSION_COLLABORATOR_ROOT = path.join(
  SRC_ROOT,
  'application',
  'services',
  'workshop',
  'session'
);

const WORKSHOP_ROOM_HANDLER_OWNER =
  'application/handlers/domain/workshop/WorkshopRoomHandler.ts';
const MESSAGE_HANDLER_OWNER = 'application/handlers/MessageHandler.ts';
const WORKSHOP_SLICE_COMPOSITION_OWNER =
  'application/handlers/domain/workshop/WorkshopSliceComposition.ts';
const WORKSHOP_SESSION_HANDLER_OWNER =
  'application/handlers/domain/workshop/WorkshopSessionMessageHandler.ts';
const WORKSHOP_TODO_HANDLER_OWNER =
  'application/handlers/domain/workshop/WorkshopTodoHandler.ts';
const WORKSHOP_CONTEXT_HANDLER_OWNER =
  'application/handlers/domain/workshop/WorkshopContextHandler.ts';
const WORKSHOP_EXCERPT_SCOPE_HANDLER_OWNER =
  'application/handlers/domain/workshop/WorkshopExcerptScopeHandler.ts';
const WORKSHOP_STANDING_HANDLER_OWNER =
  'application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.ts';
const WORKSHOP_WIDGET_HOST_HANDLER_OWNER =
  'application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts';
const WORKSHOP_GESTURE_HANDLER_OWNER =
  'application/handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler.ts';
const WORKSHOP_CREATIVE_VARIATIONS_HANDLER_OWNER =
  'application/handlers/domain/workshop/widgets/creativeVariations/WorkshopCreativeVariationsHandler.ts';
const WORKSHOP_LEXICAL_HANDLER_OWNER =
  'application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler.ts';

/**
 * Complete inbound Workshop route ledger. MessageRouter rejects duplicates at
 * runtime; this static witness also catches missing registrations, registrations
 * added without a ledger entry, and a route moving to the wrong sibling.
 *
 * Excerpt/scope and context/resource routes stay grouped separately so each
 * sibling's ownership remains visible while the route inventory stays fixed.
 */
const WORKSHOP_ROUTE_OWNERS = [
  {
    owner: WORKSHOP_ROOM_HANDLER_OWNER,
    registration: 'mutation',
    messageTypes: [
      'WORKSHOP_RUN_TOOL',
      'WORKSHOP_QUICK_ACTION',
      'WORKSHOP_SEND_MESSAGE',
      'WORKSHOP_SELECT_PERSONA',
      'WORKSHOP_SET_CHAT_TARGET',
      'WORKSHOP_INVITE_GUEST',
      'WORKSHOP_DISMISS_GUEST',
      'WORKSHOP_SET_CONVERSATION_SETTINGS'
    ]
  },
  {
    owner: WORKSHOP_ROOM_HANDLER_OWNER,
    registration: 'direct',
    messageTypes: ['CANCEL_WORKSHOP_REQUEST']
  },
  {
    owner: WORKSHOP_EXCERPT_SCOPE_HANDLER_OWNER,
    registration: 'mutation',
    messageTypes: [
      'WORKSHOP_SET_EXCERPT',
      'WORKSHOP_PICK_EXCERPT_FILE',
      'WORKSHOP_REREAD_EXCERPT',
      'WORKSHOP_SET_EXCERPT_RESOURCE',
      'WORKSHOP_SET_SESSION_SCOPE',
      'WORKSHOP_REPIN_EXCERPT'
    ]
  },
  {
    owner: WORKSHOP_CONTEXT_HANDLER_OWNER,
    registration: 'mutation',
    messageTypes: [
      'WORKSHOP_ADD_CONTEXT_TEXT',
      'WORKSHOP_ADD_CONTEXT_FILE',
      'WORKSHOP_REMOVE_CONTEXT_ATTACHMENT',
      'WORKSHOP_UPDATE_CONTEXT_TEXT',
      'WORKSHOP_ADD_CONTEXT_RESOURCES',
      'WORKSHOP_ATTACH_MESSAGE_RESOURCES',
      'WORKSHOP_ATTACH_MESSAGE_FILE',
      'WORKSHOP_REMOVE_MESSAGE_ATTACHMENT',
      'WORKSHOP_RUN_CONTEXT_WIZARD'
    ]
  },
  {
    owner: WORKSHOP_CONTEXT_HANDLER_OWNER,
    registration: 'direct',
    messageTypes: [
      'WORKSHOP_REQUEST_CONTEXT_ATTACHMENT',
      'WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE',
      'WORKSHOP_REQUEST_CONTEXT_CATALOG',
      'WORKSHOP_SEARCH_CONTEXT_RESOURCES'
    ]
  },
  {
    owner: WORKSHOP_TODO_HANDLER_OWNER,
    registration: 'mutation',
    messageTypes: ['WORKSHOP_TODO_ACTION']
  },
  {
    owner: WORKSHOP_SESSION_HANDLER_OWNER,
    registration: 'mutation',
    messageTypes: [
      'WORKSHOP_RESET_SESSION',
      'WORKSHOP_SAVE_SESSION',
      'WORKSHOP_OPEN_SESSION',
      'WORKSHOP_RENAME_SESSION',
      'WORKSHOP_DUPLICATE_SESSION',
      'WORKSHOP_DELETE_SESSION'
    ]
  },
  {
    owner: WORKSHOP_SESSION_HANDLER_OWNER,
    registration: 'direct',
    messageTypes: [
      'WORKSHOP_REQUEST_SESSION',
      'WORKSHOP_LIST_SESSIONS',
      'WORKSHOP_REVEAL_SESSION'
    ]
  },
  {
    owner: WORKSHOP_GESTURE_HANDLER_OWNER,
    registration: 'direct',
    messageTypes: [
      'WORKSHOP_GESTURE_PLAYGROUND_GENERATE',
      'CANCEL_GESTURE_PLAYGROUND_GENERATE_REQUEST'
    ]
  },
  {
    owner: WORKSHOP_CREATIVE_VARIATIONS_HANDLER_OWNER,
    registration: 'direct',
    messageTypes: [
      'WORKSHOP_CREATIVE_VARIATIONS_GENERATE',
      'CANCEL_CREATIVE_VARIATIONS_GENERATE_REQUEST'
    ]
  },
  {
    owner: WORKSHOP_WIDGET_HOST_HANDLER_OWNER,
    registration: 'mutation',
    messageTypes: ['WORKSHOP_COMMIT_WIDGET']
  },
  {
    owner: WORKSHOP_WIDGET_HOST_HANDLER_OWNER,
    registration: 'direct',
    messageTypes: ['WORKSHOP_REQUEST_WIDGET_CONFIG']
  },
  {
    owner: WORKSHOP_LEXICAL_HANDLER_OWNER,
    registration: 'direct',
    messageTypes: [
      'WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES',
      'WORKSHOP_PREVIEW_LEXICAL_GRAVITY',
      'WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS'
    ]
  },
  {
    owner: WORKSHOP_LEXICAL_HANDLER_OWNER,
    registration: 'mutation',
    messageTypes: ['WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES']
  },
  {
    owner: WORKSHOP_STANDING_HANDLER_OWNER,
    registration: 'mutation',
    messageTypes: [
      'WORKSHOP_APPLY_STANDING_WIDGET',
      'WORKSHOP_REMOVE_STANDING_WIDGET'
    ]
  }
] as const;

const WORKSHOP_CONTEXT_INTAKE_SERVICE = path.join(
  SRC_ROOT,
  'application',
  'services',
  'workshop',
  'WorkshopContextIntakeService.ts'
);
const WORKSHOP_CONTEXT_INTAKE_FORBIDDEN_REFERENCES = [
  'MessageType',
  'MessageRouter',
  'MessageTransport',
  'WorkshopSessionService',
  'LogSink'
] as const;
const WORKSHOP_EXTRACTED_HANDLER_SLICES = [
  {
    file: path.join(WORKSHOP_HANDLER_ROOT, 'WorkshopSessionMessageHandler.ts'),
    reference: /WorkshopSessionMessageHandler/
  },
  {
    file: path.join(WORKSHOP_HANDLER_ROOT, 'WorkshopContextHandler.ts'),
    reference: /WorkshopContextHandler/
  },
  {
    file: path.join(WORKSHOP_HANDLER_ROOT, 'WorkshopExcerptScopeHandler.ts'),
    reference: /WorkshopExcerptScopeHandler/
  },
  {
    file: path.join(WORKSHOP_HANDLER_ROOT, 'WorkshopTodoHandler.ts'),
    reference: /WorkshopTodoHandler/
  }
] as const;
const WORKSHOP_COMPOSED_SLICE_HANDLER_NAMES = [
  'WorkshopContextHandler',
  'WorkshopExcerptScopeHandler',
  'WorkshopCreativeVariationsHandler',
  'WorkshopGesturePlaygroundHandler',
  'WorkshopLexicalGravityHandler',
  'WorkshopSessionMessageHandler',
  'WorkshopStandingDirectiveHandler',
  'WorkshopTodoHandler',
  'WorkshopWidgetHostHandler'
] as const;

const MODULE_REFERENCE = new RegExp(
  [
    String.raw`import\s+(?:type\s+)?(?:[\w$*{},\s]+?\s+from\s+)?['"][^'"]+['"]`,
    String.raw`import\(\s*['"][^'"]+['"]\s*\)`,
    String.raw`require\(\s*['"][^'"]+['"]\s*\)`,
  ].join('|'),
  'g'
);
const GESTURE_FEATURE_REFERENCE = /(?:GesturePlayground|gesturePlayground|gesture-playground)/;
const LEXICAL_FEATURE_REFERENCE = /(?:LexicalGravity|lexicalGravity|lexical-gravity)/;
const CREATIVE_VARIATIONS_FEATURE_REFERENCE = /(?:CreativeVariations|creativeVariations|creative-variations)/;

/**
 * Closed feature inventory for cross-slice architecture witnesses. A feature
 * joins only when its first named source module lands; reserved catalog ids are
 * not implementations.
 */
interface WorkshopFeatureBoundaryDescriptor {
  readonly widgetId: PersistedWorkshopWidgetId;
  readonly name: string;
  readonly pathReference: RegExp;
  readonly importReference: RegExp;
  readonly semanticTokenSources: readonly string[];
  readonly minimumSourceFiles: number;
}

const WORKSHOP_FEATURE_BOUNDARIES: readonly WorkshopFeatureBoundaryDescriptor[] = [
  {
    widgetId: 'gesture-playground',
    name: 'Gesture Playground',
    pathReference: /GesturePlayground/i,
    importReference: GESTURE_FEATURE_REFERENCE,
    semanticTokenSources: [
      String.raw`\b[A-Za-z0-9_]*(?:(?:Gesture|gesture)[A-Z])[A-Za-z0-9_]*\b`,
      String.raw`\b[A-Z0-9_]*GESTURE_[A-Z0-9_]+\b`,
      String.raw`\b[a-z0-9_-]*gesture[_-][a-z0-9_-]+\b`,
      String.raw`\bGesture\s+Playground\b`,
      String.raw`\b(?:target_missing_from_context|invalid_source_references)\b`
    ],
    minimumSourceFiles: 5
  },
  {
    widgetId: 'lexical-gravity',
    name: 'Lexical Gravity',
    pathReference: /LexicalGravity/i,
    importReference: LEXICAL_FEATURE_REFERENCE,
    semanticTokenSources: [
      String.raw`\b[A-Za-z0-9_]*(?:(?:Lexical|lexical)[A-Z])[A-Za-z0-9_]*\b`,
      String.raw`\b[A-Z0-9_]*LEXICAL_[A-Z0-9_]+\b`,
      String.raw`\b[a-z0-9_-]*lexical[_-][a-z0-9_-]+\b`,
      String.raw`\bLexical\s+Gravity\b`,
      String.raw`\b(?:LENS_SLUGS|WEIGHT_STEP|lensSlug|metaphorPull|lens-slug|metaphor-pull|unsupported_lens|invalid_weight|invalid_reach|invalid_metaphor_pull)\b`
    ],
    minimumSourceFiles: 1
  },
  {
    widgetId: 'creative-variations',
    name: 'Creative Variations',
    pathReference: /CreativeVariations/i,
    importReference: CREATIVE_VARIATIONS_FEATURE_REFERENCE,
    semanticTokenSources: [
      String.raw`\b[A-Za-z0-9_]*(?:(?:CreativeVariations|creativeVariations)[A-Z])[A-Za-z0-9_]*\b`,
      String.raw`\b[A-Z0-9_]*CREATIVE_VARIATIONS_[A-Z0-9_]+\b`,
      String.raw`\b[a-z0-9_-]*creative[_-]variations[a-z0-9_-]*\b`,
      String.raw`\bCreative\s+Variations\b`,
      String.raw`\b(?:subjectText|mustSurvive|mustNotChange|requestedCount|invalid_distance|invalid_requested_count|subject-passage|must-survive|must-not-change|creative-aim|sampling-distance|take-count)\b`,
      String.raw`(?:(?<=\.)\b(?:aim|distance)\b|\b(?:aim|distance)\b(?=\s*:))`
    ],
    minimumSourceFiles: 3
  }
];

/** One-shot slices receive selected text through UI contracts, never host write authority. */
const ONE_SHOT_FORBIDDEN_IMPORT_REFERENCE = new RegExp(
  String.raw`\b(?:Platform|EditorContext|FileSystem|Workspace|ShellService|WorkshopTurnBubble|parseVariations|VARIATION_HEADING)\b`
);
const ONE_SHOT_PLATFORM_MODULE_REFERENCE = new RegExp(
  String.raw`(?:from\s+|import\(\s*|require\(\s*)['"]@/platform(?:/[^'"]*)?['"]`
);
const ONE_SHOT_ALLOWED_PLATFORM_IMPORT = new RegExp(
  String.raw`^import\s+(?:type\s+)?{\s*LogSink\s*}\s+from\s+['"]@/platform['"]$`
);
const WORKSHOP_FEATURE_SEMANTICS_TOKEN_SOURCE = WORKSHOP_FEATURE_BOUNDARIES
  .flatMap(({ semanticTokenSources }) => semanticTokenSources)
  .join('|');
const WORKSHOP_NON_FEATURE_SEMANTIC_COLLISIONS = new Set([
  'lexicalDensity',
  'calculateLexicalDensityPercent',
  'lexical_density',
  'gesture-analysis'
]);

interface WorkshopFeatureSemanticOccurrence {
  readonly line: number;
  readonly column: number;
  readonly token: string;
}

function collectWorkshopFeatureSemanticOccurrences(
  source: string
): WorkshopFeatureSemanticOccurrence[] {
  return source.split('\n').flatMap((line, lineIndex) => [
    ...line.matchAll(new RegExp(WORKSHOP_FEATURE_SEMANTICS_TOKEN_SOURCE, 'g'))
  ].flatMap((match) => WORKSHOP_NON_FEATURE_SEMANTIC_COLLISIONS.has(match[0])
    ? []
    : [{
        line: lineIndex + 1,
        column: (match.index ?? 0) + 1,
        token: match[0]
      }]));
}

function matchesApprovedFeatureToken(token: string, allowedToken: RegExp): boolean {
  const stableFlags = allowedToken.flags.replace(/[gy]/g, '');
  return new RegExp(`^(?:${allowedToken.source})$`, stableFlags).test(token);
}

interface ApprovedGenericFeatureSurface {
  readonly file: string;
  readonly reason: string;
  /** Matches the complete extracted semantic token, never an arbitrary source line. */
  readonly allowedToken: RegExp;
}

/**
 * Generic-path modules may name a feature only at an explicit family boundary.
 * Keeping the list here makes the inverse of the feature-path witness reviewable:
 * a new generic owner cannot silently acquire feature vocabulary just because its
 * path never names that feature.
 */
const WORKSHOP_APPROVED_GENERIC_FEATURE_SURFACES: readonly ApprovedGenericFeatureSurface[] = [
  {
    file: 'application/handlers/MessageHandler.ts',
    reason: 'composition-root feature-service wiring',
    allowedToken: /(?:creativeVariationsService|gesturePlayground(?:Service)?|lexicalGravity(?:LensRepository|ModelService)?)/
  },
  {
    file: 'application/handlers/MessageHandlerContracts.ts',
    reason: 'composition-root service contract',
    allowedToken: /(?:Creative Variations|CreativeVariationsService|creativeVariationsService|Gesture Playground|Lexical Gravity|GesturePlaygroundService|LexicalGravity(?:LensRepository|ModelService)|gesturePlaygroundService|lexicalGravity(?:LensRepository|ModelService))/
  },
  {
    file: 'application/handlers/domain/workshop/WorkshopSliceComposition.ts',
    reason: 'Workshop-internal feature-slice composition owner',
    allowedToken: /(?:WorkshopCreativeVariationsHandler|CreativeVariationsWorkupId|createCreativeVariationsWorkupIdFactory|creativeVariationsHandler|WorkshopGesturePlayground(?:Handler|ServicePort)|WorkshopLexicalGravity(?:Handler|ModelPort|RepositoryPort)|gesture-playground|gesturePlayground(?:Handler)?|creative-variations|lexicalGravity(?:Handler)?)/
  },
  {
    file: 'application/handlers/domain/workshop/WorkshopRouteContracts.ts',
    reason: 'Workshop-internal composition contract owner',
    allowedToken: /(?:WorkshopCreativeVariations(?:Handler|ServicePort)|creativeVariations|WorkshopGesturePlayground(?:Handler|ServicePort)|WorkshopLexicalGravity(?:Handler|ModelPort|RepositoryPort)|gesturePlayground|lexicalGravity)/
  },
  {
    file: 'application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle.ts',
    reason: 'closed persisted-config lifecycle registry',
    allowedToken: /(?:(?:GesturePlayground|LexicalGravity|CreativeVariations)(?:ConfigCodec|CheckpointNormalization)|assert(?:GesturePlayground|LexicalGravity|CreativeVariations)Draft(?:CheckpointShape|Integrity|Shape)|normalize(?:GesturePlayground|LexicalGravity|CreativeVariations)DraftForHydration|gesture-playground|gesturePlayground|lexical-gravity|lexicalGravity|creative-variations|creativeVariations)/
  },
  {
    file: 'application/services/workshop/WorkshopSessionStateV1Shape.ts',
    reason: 'closed persisted union validator',
    allowedToken: /(?:(?:GesturePlayground|LexicalGravity|CreativeVariations)ConfigCodec|assert(?:GesturePlayground|LexicalGravity|CreativeVariations)(?:Draft|RecommendationSeed)Shape|gesture-playground|gesturePlayground|lexical-gravity|lexicalGravity|creative-variations|creativeVariations)/
  },
  {
    file: 'application/services/workshop/WorkshopRunCompletion.ts',
    reason: 'recommendation source-availability boundary',
    allowedToken: /(?:gesture-playground|lexical-gravity|creative-variations|lensSlug|metaphorPull|unsupported_lens|invalid_weight|invalid_reach|invalid_metaphor_pull|target_missing_from_context|invalid_source_references|subjectText|mustSurvive|mustNotChange|aim|distance|requestedCount|invalid_distance|invalid_requested_count)/
  },
  {
    file: 'application/services/workshop/WorkshopSessionRecords.ts',
    reason: 'closed recommendation-clone dispatch',
    allowedToken: /(?:gesture-playground|lexical-gravity|creative-variations)/
  },
  {
    file: 'application/services/workshop/directives/WorkshopStandingDirectiveOperations.ts',
    reason: 'approved closed standing-feature registry',
    allowedToken: /(?:LEXICAL_GRAVITY_STANDING_DIRECTIVE_OPERATIONS|LexicalGravityStandingDirectiveOperations|WorkshopLexicalGravityStandingDirectiveApplyRequest|lexical-gravity|lexicalGravity)/
  },
  {
    file: 'application/services/workshop/widgets/WorkshopWidgetConfigLedger.ts',
    reason: 'explicit widget-family draft union owner',
    allowedToken: /(?:WorkshopGesturePlaygroundDraft|WorkshopLexicalGravityDraft|WorkshopCreativeVariationsDraft|gesture-playground|lexical-gravity|creative-variations)/
  },
  {
    file: 'application/services/workshop/widgets/WorkshopWidgetConfigOperations.ts',
    reason: 'closed widget-config operations dispatch',
    allowedToken: /(?:(?:GesturePlayground|LexicalGravity|CreativeVariations)ConfigCodec|clone(?:GesturePlayground|LexicalGravity|CreativeVariations)Draft|summarize(?:GesturePlayground|LexicalGravity|CreativeVariations)Draft|gesture-playground|gesturePlayground|lexical-gravity|lexicalGravity|creative-variations|creativeVariations)/
  },
  {
    file: 'application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations.ts',
    reason: 'closed one-shot feature-preparation dispatch',
    allowedToken: /(?:(?:GesturePlayground|CreativeVariations)OneShotCommit|prepare(?:GesturePlayground|CreativeVariations)OneShotCommit|gesture-playground|gesturePlayground|creative-variations|creativeVariations)/
  },
  {
    file: 'application/services/workshop/widgets/WorkshopWidgetRecommendationOperations.ts',
    reason: 'closed widget-recommendation registry and prompt composer',
    allowedToken: /(?:(?:GESTURE_PLAYGROUND|LEXICAL_GRAVITY|CREATIVE_VARIATIONS)_WIDGET_RECOMMENDATION_ENTRY|(?:GesturePlayground|LexicalGravity|CreativeVariations)Recommendation(?:Field|InvalidFieldReason)?|gesture-playground|gesturePlayground|lexical-gravity|lexicalGravity|creative-variations|creativeVariations|gesture(?:CharacterNotes|Context|RecommendationFrameAllowance|SourceReference|TargetPhrase|WriterInstructions)Characters)/
  },
  {
    file: 'shared/types/messages/workshop/recovery.ts',
    reason: 'closed rejected-widget response-contract registry',
    allowedToken: /(?:RECOVERABLE_WIDGET_RESPONSE_CONTRACTS|RecoverableWidgetToolName|RejectedModelResponseContract|creative-variations(?:-[a-z0-9]+)*|gesture-playground(?:-[a-z0-9]+)*|lexical-gravity(?:-[a-z0-9]+)*|(?:END_)?(?:CREATIVE_VARIATIONS|GESTURE|LEXICAL)_[A-Z0-9_]+)/
  },
  {
    file: 'index.ts',
    reason: 'core public composition barrel',
    allowedToken: /(?:CreativeVariationsService|GesturePlaygroundDirective|GesturePlaygroundService|LexicalGravityLensRepository|LexicalGravityModelService|buildGestureDirective|gesturePlayground)/
  },
  {
    file: 'presentation/webview/WorkshopApp.tsx',
    reason: 'Workshop presentation composition root',
    allowedToken: /(?:CREATIVE_VARIATIONS_HIGH_OVERLAP_SCORE|CreativeVariationsDistinctness|GESTURE_DICTIONARY_RESULT_TOOL_NAME|Gesture Playground|WorkshopCreativeVariationsModal|WorkshopGesturePlaygroundModal|WorkshopLexicalGravityModal|clearCreativeVariationsTransientState|closeCreativeVariations|closeGesturePlayground|closeLexicalGravity|copyCreativeVariation|copyGestureDictionary|creative-variations|creative_variations|creativeVariations|creativeVariationsAuthoring|creativeVariationsOpening|gesture-playground|gesturePlayground|gesturePlaygroundOpening|lexicalGravity|lexicalGravityOpening|onCloseCreativeVariations|onCloseGesturePlayground|onCloseLexicalGravity|saveGestureDictionary|useCreativeVariations|useCreativeVariationsAuthoring|useGesturePlayground|useLexicalGravity)/
  },
  {
    file: 'presentation/webview/components/SettingsOverlay.tsx',
    reason: 'writer-facing model-setting description',
    allowedToken: /Gesture Playground/
  },
  {
    file: 'presentation/webview/components/workshop/WorkshopTurnBubble.tsx',
    reason: 'closed widget-recommendation presentation dispatch',
    allowedToken: /(?:gesture-playground|lexical-gravity|creative-variations|lensSlug|subjectText)/
  },
  {
    file: 'presentation/webview/components/workshop/workshopWidgetIcons.ts',
    reason: 'closed widget-icon presentation registry',
    allowedToken: /(?:gesture-playground|lexical-gravity|creative-variations)/
  },
  {
    file: 'presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts',
    reason: 'closed widget-opening presentation controller',
    allowedToken: /(?:Creative Variations|WorkshopCreativeVariations(?:Opening|RecommendationSeed|WidgetConfigSnapshot)|WorkshopGesturePlayground(?:Opening|RecommendationSeed|WidgetConfigSnapshot)|WorkshopLexicalGravity(?:Draft|Opening|RecommendationSeed|WidgetConfigSnapshot)|closeCreativeVariations|closeGesturePlayground|closeLexicalGravity|creative-variations|creativeVariationsOpening|gesture-playground|gesturePlaygroundOpening|lexical-gravity|lexicalGravityOpening|onCloseCreativeVariations|onCloseGesturePlayground|onCloseLexicalGravity|setCreativeVariationsOpening|setGesturePlaygroundOpening|setLexicalGravityOpening)/
  },
  {
    file: 'presentation/webview/hooks/domain/workshop/dispatchWorkshopSelectionData.ts',
    reason: 'closed Workshop selection-target presentation dispatch',
    allowedToken: /(?:handleCreativeVariationsSubject|workshop_creative_variations_subject)/
  },
  {
    file: 'presentation/webview/hooks/domain/workshop/dispatchWorkshopWidgetActionResult.ts',
    reason: 'closed widget-result presentation dispatch',
    allowedToken: /(?:handleCreativeVariationsActionResult|handleGestureActionResult|handleLexicalActionResult)/
  },
  {
    file: 'presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.ts',
    reason: 'standing-directive presentation integration seam',
    allowedToken: /(?:LexicalGravityDirective|formatLexicalGravitySummary|lexical-gravity|lexicalGravity)/
  },
  {
    file: 'presentation/webview/hooks/useWorkshopAppMessageRouter.ts',
    reason: 'Workshop webview route-composition table',
    allowedToken: /(?:UseCreativeVariationsAuthoringReturn|UseCreativeVariationsReturn|UseGesturePlaygroundReturn|UseLexicalGravityReturn|WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS|WORKSHOP_CREATIVE_VARIATIONS_RESULT|WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS|WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT|WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA|WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED|WORKSHOP_LEXICAL_GRAVITY_LENS_CANDIDATES|WORKSHOP_LEXICAL_GRAVITY_PREVIEW_RESULT|creativeVariationsAuthoring|handleCreativeVariationsActionResult|handleCreativeVariationsSubject|gesturePlayground|handleGestureActionResult|handleLexicalActionResult|lexicalGravity|useCreativeVariationsAuthoring|useGesturePlayground|useLexicalGravity)/
  },
  {
    file: 'presentation/webview/utils/workshopWidgetAskPrefill.ts',
    reason: 'closed writer-ask prefill registry',
    allowedToken: /(?:creative-variations|gesture-playground|lexical-gravity|creative-aim|sampling-distance|take-count|aim|distance)/
  },
  {
    file: 'shared/constants/promptBudgets.ts',
    reason: 'central deterministic prompt-budget catalog',
    allowedToken: /(?:Gesture Playground|Creative Variations|gesture[A-Z][A-Za-z0-9]*|lexical[A-Z][A-Za-z0-9]*|creative[A-Z][A-Za-z0-9]*)/
  },
  {
    file: 'shared/constants/resultToolNames.ts',
    reason: 'closed tool-result name catalog',
    allowedToken: /(?:GESTURE_DICTIONARY_RESULT_TOOL_NAME|gesture-dictionary|gesture_dictionary)/
  },
  {
    file: 'shared/constants/workshopWidgets.ts',
    reason: 'generic widget catalog may own feature ids and labels, not feature value grammar',
    allowedToken: /(?:WorkshopGesturePlaygroundHandler|gesture-playground|lexical-gravity|creative-variations|Gesture Playground|Lexical Gravity|Creative Variations)/
  },
  {
    file: 'shared/streamingCancelMessages.ts',
    reason: 'closed streaming-cancellation registry',
    allowedToken: /(?:(?:CANCEL_|Cancel)(?:CREATIVE_VARIATIONS|CreativeVariations|GESTURE_PLAYGROUND|GesturePlayground).*|workshop-(?:creative-variations|gesture-playground))/
  },
  {
    file: 'shared/types/messages/base.ts',
    reason: 'closed MessageType wire-value registry',
    allowedToken: /(?:Gesture Playground|(?:CANCEL_|WORKSHOP_).*(?:CREATIVE_VARIATIONS|GESTURE_PLAYGROUND|LEXICAL_GRAVITY).*|(?:cancel_|workshop_).*(?:creative_variations|gesture_playground|lexical_gravity).*)/
  },
  {
    file: 'shared/types/messages/index.ts',
    reason: 'message union composition barrel',
    allowedToken: /.*(?:CreativeVariations|GesturePlayground|LexicalGravity).*/
  },
  {
    file: 'shared/types/messages/ui.ts',
    reason: 'closed host selection-target wire union',
    allowedToken: /workshop_creative_variations_subject/
  },
  {
    file: 'shared/types/messages/streaming.ts',
    reason: 'closed streaming-domain wire union',
    allowedToken: /workshop-(?:creative-variations|gesture-playground)/
  },
  {
    file: 'shared/types/messages/workshop/index.ts',
    reason: 'Workshop message subdomain composition barrel',
    allowedToken: /(?:gesturePlayground|lexicalGravity|creativeVariations)/
  },
  {
    file: 'shared/types/messages/workshop/standingDirectives.ts',
    reason: 'explicit standing-family summary and payload union owner',
    allowedToken: /(?:WorkshopLexicalGravityApplicationMode|WorkshopLexicalGravityApplyStandingWidgetPayload|WorkshopLexicalGravityEvidenceMode|WorkshopLexicalGravityReach|WorkshopLexicalGravityStandingDirectiveSummary|lexical-gravity|lexicalGravity|metaphorPull)/
  },
  {
    file: 'shared/types/messages/workshop/widgets.ts',
    reason: 'explicit widget-family config, recommendation, and result union owner',
    allowedToken: /(?:WorkshopGesturePlayground(?:CommitPayload|Draft|RecommendationSeed|WidgetConfigSnapshot|WidgetConfigSummary)|WorkshopLexicalGravity(?:Draft|EvidenceMode|Reach|RecommendationSeed|WidgetConfigSnapshot|WidgetConfigSummary)|WorkshopCreativeVariations(?:CommitPayload|Draft|RecommendationSeed|WidgetConfigSnapshot|WidgetConfigSummary)|gesture-playground|gesturePlayground|lexical-gravity|lexicalGravity|creative-variations|creativeVariations|metaphorPull)/
  },
  {
    file: 'utils/workshopPromptFrames.ts',
    reason: 'leaf neutralizer reserves feature-declared recommendation delimiters',
    allowedToken: /(?:lens-slug|metaphor-pull|subject-passage|must-survive|must-not-change|creative-aim|sampling-distance|take-count)/
  },
  {
    file: 'infrastructure/api/orchestration/capabilities/WorkshopToolContextCapability.ts',
    reason: 'catalog-neighbor algorithm owns an unrelated distance coordinate',
    allowedToken: /distance/
  }
] as const;

/**
 * Reviewable generic-seam inventory for the next standing feature.
 *
 * Each path appears once even when the file owns several exhaustive switches.
 * This proves that every approved generic surface has an applicability decision;
 * the later feature fixture and commit-diff review prove the actual arms and
 * zero sibling edits. Existing Gesture/Lexical feature paths are absent here.
 */
const PROSE_CONTROLLER_GENERIC_SEAM_ENTRIES = [
  'application/handlers/MessageHandler.ts',
  'application/handlers/MessageHandlerContracts.ts',
  'application/handlers/domain/workshop/WorkshopRouteContracts.ts',
  'application/handlers/domain/workshop/WorkshopSliceComposition.ts',
  'application/services/workshop/WorkshopSessionRecords.ts',
  'application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle.ts',
  'application/services/workshop/widgets/WorkshopWidgetConfigLedger.ts',
  'application/services/workshop/widgets/WorkshopWidgetConfigOperations.ts',
  'application/services/workshop/widgets/WorkshopWidgetRecommendationOperations.ts',
  'index.ts',
  'presentation/webview/WorkshopApp.tsx',
  'presentation/webview/components/workshop/WorkshopTurnBubble.tsx',
  'presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts',
  'presentation/webview/hooks/domain/workshop/dispatchWorkshopWidgetActionResult.ts',
  'presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.ts',
  'presentation/webview/hooks/useWorkshopAppMessageRouter.ts',
  'presentation/webview/utils/workshopWidgetAskPrefill.ts',
  'shared/constants/promptBudgets.ts',
  'shared/types/messages/base.ts',
  'shared/types/messages/index.ts',
  'shared/types/messages/workshop/index.ts',
  'shared/types/messages/workshop/recovery.ts'
] as const;

/**
 * Approved generic surfaces that do not require a new Prose Controller arm.
 * The reason beside every exclusion makes the applicability decision
 * reviewable; together with the seam list this must partition all approvals.
 */
const PROSE_CONTROLLER_INAPPLICABLE_SURFACES = [
  {
    file: 'application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations.ts',
    reason: 'Prose Controller is standing and never enters the one-shot commit dispatch'
  },
  {
    file: 'application/services/workshop/WorkshopSessionStateV1Shape.ts',
    reason: 'already validates the reserved prose-controller config arm'
  },
  {
    file: 'application/services/workshop/WorkshopRunCompletion.ts',
    reason: 'delegates recommendation semantics through the feature operations registry'
  },
  {
    file: 'application/services/workshop/directives/WorkshopStandingDirectiveOperations.ts',
    reason: 'already owns the prose-controller throwing placeholder to replace'
  },
  {
    file: 'presentation/webview/components/SettingsOverlay.tsx',
    reason: 'describes the shared widget model setting without per-feature dispatch'
  },
  {
    file: 'presentation/webview/components/workshop/workshopWidgetIcons.ts',
    reason: 'already contains the exhaustive prose-controller icon entry'
  },
  {
    file: 'presentation/webview/hooks/domain/workshop/dispatchWorkshopSelectionData.ts',
    reason: 'Prose Controller reads the active Workshop passage and needs no editor-selection intake target'
  },
  {
    file: 'shared/constants/resultToolNames.ts',
    reason: 'maps saved analysis tools; standing-widget preview is not a saved tool result'
  },
  {
    file: 'shared/types/messages/ui.ts',
    reason: 'Prose Controller introduces no dedicated editor-selection target'
  },
  {
    file: 'shared/constants/workshopWidgets.ts',
    reason: 'already contains the reserved prose-controller catalog entry'
  },
  {
    file: 'shared/streamingCancelMessages.ts',
    reason: 'maps streaming domains; the standing-widget preview precedent is non-streaming'
  },
  {
    file: 'shared/types/messages/streaming.ts',
    reason: 'declares streaming domains only; Prose Controller uses widget result contracts'
  },
  {
    file: 'shared/types/messages/workshop/standingDirectives.ts',
    reason: 'already includes prose-controller in the standing-family contract'
  },
  {
    file: 'shared/types/messages/workshop/widgets.ts',
    reason: 'already reserves the prose-controller widget/config union arm'
  },
  {
    file: 'utils/workshopPromptFrames.ts',
    reason: 'already neutralizes the family-generic prose-directive envelope'
  },
  {
    file: 'infrastructure/api/orchestration/capabilities/WorkshopToolContextCapability.ts',
    reason: 'catalog-neighbor distance is unrelated to widget feature dispatch'
  }
] as const;
const WORKSHOP_FEATURE_HOOKS = [
  path.join(
    SRC_ROOT,
    'presentation/webview/hooks/domain/workshop/widgets/useGesturePlayground.ts'
  ),
  path.join(
    SRC_ROOT,
    'presentation/webview/hooks/domain/workshop/widgets/useLexicalGravity.ts'
  ),
  path.join(
    SRC_ROOT,
    'presentation/webview/hooks/domain/workshop/widgets/creativeVariations/useCreativeVariations.ts'
  )
];
const WORKSHOP_WIDGET_HOST_HOOK = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/useWorkshopWidgetHost.ts'
);
const WORKSHOP_STANDING_DIRECTIVE_HOOK = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.ts'
);
const WORKSHOP_ROOM_HOOK = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts'
);
const WORKSHOP_SESSIONS_HOOK = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/useWorkshopSessions.ts'
);
const WORKSHOP_PRESENTATION_CONTROLLERS = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/controllers'
);
const WORKSHOP_STANDING_DIRECTIVE_OPERATIONS = path.join(
  SRC_ROOT,
  'application/services/workshop/directives/WorkshopStandingDirectiveOperations.ts'
);
const WORKSHOP_GENERIC_STANDING_MECHANICS = [
  path.join(
    SRC_ROOT,
    'application/services/workshop/directives/WorkshopStandingDirectiveFrames.ts'
  ),
  path.join(
    SRC_ROOT,
    'application/services/workshop/directives/WorkshopStandingDirectivePresentation.ts'
  ),
  path.join(
    SRC_ROOT,
    'presentation/webview/components/workshop/WorkshopStandingDirectiveRail.tsx'
  )
];
const WORKSHOP_GENERIC_FEATURE_COPY_SURFACES = [
  ...WORKSHOP_GENERIC_STANDING_MECHANICS,
  WORKSHOP_STANDING_DIRECTIVE_OPERATIONS,
  path.join(
    SRC_ROOT,
    'application',
    'services',
    'workshop',
    'widgets',
    'WorkshopWidgetRecommendationOperations.ts'
  ),
  WORKSHOP_STANDING_DIRECTIVE_HOOK,
  path.join(
    SRC_ROOT,
    'application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.ts'
  ),
  path.join(
    SRC_ROOT,
    'application/services/workshop/directives/WorkshopStandingDirectiveService.ts'
  ),
  path.join(
    SRC_ROOT,
    'presentation/webview/hooks/domain/workshop/dispatchWorkshopWidgetActionResult.ts'
  )
];
const GENERIC_WIDGET_CONFIG_PRESENTATION_REFERENCE = new RegExp(
  [
    'WORKSHOP_REQUEST_WIDGET_CONFIG',
    'WORKSHOP_WIDGET_CONFIG_DATA',
    'WorkshopWidgetConfigDataMessage',
    'widgetConfigResponseId',
    'widgetConfigError',
    'requestWidgetConfig',
    'clearWidgetConfigData',
    'handleWidgetConfigData'
  ].join('|')
);

/**
 * Exact known false-generic ownership for each inventoried phase. Newly
 * discovered pre-existing violations may be recorded only with an owning
 * cleanup phase; once that phase's inventory is recorded, its entries may only
 * shrink. A phase that removes an exception updates this witness in the same
 * commit; Phase 7 requires an empty list.
 */
interface WorkshopLegacyOwnershipException {
  readonly phase: number;
  readonly file: string;
  readonly marker: RegExp;
}

const WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS:
  readonly WorkshopLegacyOwnershipException[] = [];

const WORKSHOP_CAPABILITY_BOUNDARY = [
  path.join(SRC_ROOT, 'shared', 'types', 'workshopCapabilities.ts'),
  path.join(SRC_ROOT, 'application', 'services', 'workshop', 'WorkshopAnalysisSidePass.ts'),
  path.join(SRC_ROOT, 'application', 'services', 'workshop', 'WorkshopCapabilityXmlCodec.ts'),
  path.join(SRC_ROOT, 'application', 'services', 'workshop', 'WorkshopPersonaCapability.ts')
];
const HOST_OR_PRESENTATION_IMPORT = /(?:from\s+['"](?:vscode|react|@providers\/)|import\s+.*['"](?:vscode|react|@providers\/))/;

// WorkshopSessionService is in the net (PR #67 review #14): it is the
// composition-root-owned reload-safety aggregate — a handler `new`-ing its
// own copy would silently fork the session per webview.
const FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION = new RegExp(
  String.raw`\bnew\s+(TextSourceResolver|CategorySearchService|AccountBalanceService|OpenRouterAccountClient|PublishingStandardsRepository|WorkshopSessionService|WorkshopRoomDeliveryService|WorkshopSessionPersistenceCoordinator|WorkshopSessionStore)\b`
);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(full)) {
        continue;
      }
      collectSourceFiles(full, acc);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function importsFeature(source: string, featureReference: RegExp): boolean {
  return (source.match(MODULE_REFERENCE) ?? [])
    .some((moduleReference) => featureReference.test(moduleReference));
}

function forbiddenOneShotImportReference(moduleReference: string): string | undefined {
  const forbiddenNamedReference = moduleReference
    .match(ONE_SHOT_FORBIDDEN_IMPORT_REFERENCE)?.[0];
  if (forbiddenNamedReference) {
    return forbiddenNamedReference;
  }
  if (
    ONE_SHOT_PLATFORM_MODULE_REFERENCE.test(moduleReference)
    && !ONE_SHOT_ALLOWED_PLATFORM_IMPORT.test(moduleReference)
  ) {
    return 'platform authority import';
  }
  return undefined;
}

interface WorkshopGenericSeamInventoryFixture {
  readonly entries: readonly string[];
  readonly inapplicableSurfaces: readonly {
    readonly file: string;
    readonly reason: string;
  }[];
}

function inspectWorkshopGenericSeamInventory(
  fixture: WorkshopGenericSeamInventoryFixture
): {
  readonly duplicateEntries: string[];
  readonly missingEntries: string[];
  readonly unapprovedEntries: string[];
  readonly unclassifiedApprovedSurfaces: string[];
  readonly missingInapplicabilityReasons: string[];
  readonly siblingFeatureEntries: string[];
} {
  const approvedGenericPaths = new Set(
    WORKSHOP_APPROVED_GENERIC_FEATURE_SURFACES.map(({ file }) => file)
  );
  const entries = [...fixture.entries];
  const inapplicable = fixture.inapplicableSurfaces.map(({ file }) => file);
  const partition = [...entries, ...inapplicable];
  const classifiedPaths = new Set<string>(partition);

  return {
    duplicateEntries: partition.filter((file, index) => partition.indexOf(file) !== index),
    missingEntries: partition.filter((file) => !fs.existsSync(path.join(SRC_ROOT, file))),
    unapprovedEntries: partition.filter((file) => !approvedGenericPaths.has(file)),
    unclassifiedApprovedSurfaces: [...approvedGenericPaths]
      .filter((file) => !classifiedPaths.has(file)),
    missingInapplicabilityReasons: fixture.inapplicableSurfaces
      .filter(({ reason }) => reason.trim().length === 0)
      .map(({ file }) => file),
    siblingFeatureEntries: entries.filter((file) =>
      WORKSHOP_FEATURE_BOUNDARIES.some(({ pathReference }) => pathReference.test(file))
    )
  };
}

describe('architectural boundaries', () => {
  it('core imports no vscode anywhere (static OR dynamic import)', () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter((file) => VSCODE_IMPORT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('application handlers do not construct infrastructure services', () => {
    const offenders = collectSourceFiles(HANDLERS_ROOT)
      .filter((file) => FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('Workshop capability contracts and routes import no host, React, or provider types', () => {
    const offenders = WORKSHOP_CAPABILITY_BOUNDARY
      .filter((file) => HOST_OR_PRESENTATION_IMPORT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('Workshop has one room-frame materializer and one offset-advance call site', () => {
    const sourceFiles = collectSourceFiles(SRC_ROOT);
    const frameMaterializers = sourceFiles
      .filter((file) =>
        /import\s*\{[^}]*buildWorkshopRoomCatchUp[^}]*\}\s*from/s.test(
          fs.readFileSync(file, 'utf8')
        )
      )
      .map((file) => path.relative(SRC_ROOT, file));
    const offsetAdvancers = sourceFiles
      .filter((file) => /\.advanceRoomDeliveryOffset\(/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(frameMaterializers).toEqual([
      'application/services/workshop/WorkshopRoomDeliveryService.ts'
    ]);
    expect(offsetAdvancers).toEqual([
      'application/services/workshop/WorkshopRoomDeliveryService.ts'
    ]);
  });

  it('keeps every Workshop route with its declared owner and gate classification', () => {
    const handlerFiles = collectSourceFiles(WORKSHOP_HANDLER_ROOT);
    const routeRegistration =
      /(router\.register|registerMutation)\(\s*MessageType\.([A-Z0-9_]+)\b/g;
    const actualOwnerPairs = handlerFiles.flatMap((file) => {
      const owner = path.relative(SRC_ROOT, file);
      return [...fs.readFileSync(file, 'utf8').matchAll(routeRegistration)]
        .map((match) => [
          match[2],
          owner,
          match[1] === 'registerMutation' ? 'mutation' : 'direct'
        ] as const);
    });
    const expectedOwnerPairs = WORKSHOP_ROUTE_OWNERS.flatMap(({
      owner,
      registration,
      messageTypes
    }) =>
      messageTypes.map((messageType) => [messageType, owner, registration] as const)
    );
    const duplicateLedgerEntries = expectedOwnerPairs
      .map(([messageType]) => messageType)
      .filter((messageType, index, messageTypes) =>
        messageTypes.indexOf(messageType) !== index
      );
    const toOwnerRecord = (
      ownerPairs: ReadonlyArray<readonly [string, string, 'mutation' | 'direct']>
    ) => {
      const ownersByMessageType: Record<string, string[]> = {};
      for (const [messageType, owner, registration] of ownerPairs) {
        (ownersByMessageType[messageType] ??= []).push(`${owner}#${registration}`);
      }
      return Object.fromEntries(
        Object.entries(ownersByMessageType)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([messageType, owners]) => [messageType, owners.sort()])
      );
    };

    expect(expectedOwnerPairs).toHaveLength(50);
    expect(expectedOwnerPairs.filter(([, , registration]) => registration === 'mutation'))
      .toHaveLength(34);
    expect(expectedOwnerPairs.filter(([, , registration]) => registration === 'direct'))
      .toHaveLength(16);
    expect(duplicateLedgerEntries).toEqual([]);
    expect(toOwnerRecord(actualOwnerPairs)).toEqual(toOwnerRecord(expectedOwnerPairs));
  });

  it('only WorkshopRoomHandler constructs the Workshop session-state envelope', () => {
    const sessionStateLiteral = /type:\s*MessageType\.WORKSHOP_SESSION_STATE\b/;
    const owners = collectSourceFiles(WORKSHOP_HANDLER_ROOT)
      .filter((file) => sessionStateLiteral.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(owners).toEqual([WORKSHOP_ROOM_HANDLER_OWNER]);
  });

  /**
   * Scope is deliberate and narrower than the rule it protects.
   *
   * The scan covers HANDLERS_ROOT, so it proves that within the handler tree
   * only MessageHandler constructs the room owner and only
   * WorkshopSliceComposition constructs the eight siblings. It cannot see a
   * sibling built outside that tree — a factory under
   * `application/services/workshop/`, for instance — nor a construction that
   * evades the `new Workshop*Handler(` shape (aliased import, Reflect.construct,
   * a name without the Workshop prefix or Handler suffix). No such path exists
   * today; widen the root here if one is ever introduced.
   */
  it('keeps all Workshop handler construction at the two documented composition tiers', () => {
    const handlerConstruction = /new\s+(Workshop[A-Za-z0-9]+Handler)\s*\(/g;
    const constructions = collectSourceFiles(HANDLERS_ROOT).flatMap((file) =>
      [...fs.readFileSync(file, 'utf8').matchAll(handlerConstruction)]
        .map((match) => ({
          handler: match[1],
          owner: path.relative(SRC_ROOT, file)
        }))
    ).sort((left, right) => left.handler.localeCompare(right.handler));

    const expectedConstructions = [
      {
        handler: 'WorkshopRoomHandler',
        owner: MESSAGE_HANDLER_OWNER
      },
      ...WORKSHOP_COMPOSED_SLICE_HANDLER_NAMES.map((handler) => ({
        handler,
        owner: WORKSHOP_SLICE_COMPOSITION_OWNER
      }))
    ].sort((left, right) => left.handler.localeCompare(right.handler));

    expect(constructions).toEqual(expectedConstructions);
  });

  it('keeps Workshop context intake free of route, transport, session, and logging authority', () => {
    const source = fs.readFileSync(WORKSHOP_CONTEXT_INTAKE_SERVICE, 'utf8');
    const forbiddenReferences = WORKSHOP_CONTEXT_INTAKE_FORBIDDEN_REFERENCES
      .filter((reference) => new RegExp(String.raw`\b${reference}\b`).test(source));

    expect(forbiddenReferences).toEqual([]);
  });

  it('keeps extracted Workshop handler slices from importing one another', () => {
    const offenders = WORKSHOP_EXTRACTED_HANDLER_SLICES.flatMap((slice) => {
      const source = fs.readFileSync(slice.file, 'utf8');
      return WORKSHOP_EXTRACTED_HANDLER_SLICES
        .filter((sibling) => sibling.file !== slice.file)
        .filter((sibling) => importsFeature(source, sibling.reference))
        .map((sibling) =>
          `${path.relative(SRC_ROOT, slice.file)} -> ${path.relative(SRC_ROOT, sibling.file)}`
        );
    });

    expect(WORKSHOP_EXTRACTED_HANDLER_SLICES).toHaveLength(4);
    expect(offenders).toEqual([]);
  });

  it('tracks every implemented persisted widget in the feature-boundary inventory', () => {
    const describedWidgetIds = WORKSHOP_FEATURE_BOUNDARIES
      .map(({ widgetId }) => widgetId)
      .sort();
    const persistedWidgetIds = persistedWorkshopWidgetLifecycleIds().sort();
    const missingCatalogDescriptors = describedWidgetIds
      .filter((widgetId) => !workshopWidgetDescriptor(widgetId));

    expect(missingCatalogDescriptors).toEqual([]);
    expect(describedWidgetIds).toEqual(persistedWidgetIds);
  });

  it('Workshop feature modules do not import sibling features', () => {
    const sourceFiles = collectSourceFiles(SRC_ROOT);
    const featureFiles = WORKSHOP_FEATURE_BOUNDARIES.map((feature) => ({
      feature,
      files: sourceFiles.filter((file) =>
        feature.pathReference.test(path.relative(SRC_ROOT, file))
      )
    }));
    const underrepresentedFeatures = featureFiles
      .filter(({ feature, files }) => files.length < feature.minimumSourceFiles)
      .map(({ feature, files }) =>
        `${feature.name}: ${files.length} < ${feature.minimumSourceFiles}`
      );
    const offenders = featureFiles.flatMap(({ feature, files }) =>
      files.flatMap((file) => WORKSHOP_FEATURE_BOUNDARIES
        .filter((sibling) => sibling.name !== feature.name)
        .filter((sibling) => importsFeature(
          fs.readFileSync(file, 'utf8'),
          sibling.importReference
        ))
        .map((sibling) =>
          `${path.relative(SRC_ROOT, file)} -> ${sibling.name}`
        ))
    );

    expect(underrepresentedFeatures).toEqual([]);
    expect(offenders).toEqual([]);
  });

  it('one-shot feature modules import neither host mutation authority nor the legacy report parser', () => {
    const sourceFiles = collectSourceFiles(SRC_ROOT);
    const oneShotFeatures = WORKSHOP_FEATURE_BOUNDARIES
      .filter(({ widgetId }) => workshopWidgetDescriptor(widgetId)?.rail === 'oneshot');
    const oneShotFiles = sourceFiles.filter((file) => {
      const relativePath = path.relative(SRC_ROOT, file);
      return oneShotFeatures.some(({ pathReference }) => pathReference.test(relativePath));
    });
    const offenders = oneShotFiles.flatMap((file) =>
      (fs.readFileSync(file, 'utf8').match(MODULE_REFERENCE) ?? [])
        .flatMap((moduleReference) => {
          const forbiddenReference = forbiddenOneShotImportReference(moduleReference);
          return forbiddenReference
            ? [`${path.relative(SRC_ROOT, file)} -> ${forbiddenReference}`]
            : [];
        })
    );

    expect(oneShotFeatures.length).toBeGreaterThan(0);
    expect(oneShotFiles.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('extracts feature semantics as exact tokens without flagging known prose metrics', () => {
    const occurrences = collectWorkshopFeatureSemanticOccurrences([
      'type Drift = WorkshopGestureDrift;',
      "const result = 'gesture_dictionary';",
      'const field = lensSlug;',
      'const LENS_SLUGS = new Set();',
      'const WEIGHT_STEP = 5;',
      "const reasons = ['invalid_weight', 'invalid_reach'];",
      'const seed = { subjectText, aim: seed.aim, distance: seed.distance, requestedCount };',
      "const creativeReason = 'invalid_requested_count';",
      "const tag = '<subject-passage>';",
      'const metric = calculateLexicalDensityPercent(source);'
    ].join('\n'));

    expect(occurrences.map(({ token }) => token)).toEqual([
      'WorkshopGestureDrift',
      'gesture_dictionary',
      'lensSlug',
      'LENS_SLUGS',
      'WEIGHT_STEP',
      'invalid_weight',
      'invalid_reach',
      'subjectText',
      'aim',
      'aim',
      'distance',
      'distance',
      'requestedCount',
      'invalid_requested_count',
      'subject-passage'
    ]);
    expect(matchesApprovedFeatureToken('gesturePlayground', /gesturePlayground/)).toBe(true);
    expect(matchesApprovedFeatureToken('gesturePlaygroundExtra', /gesturePlayground/)).toBe(false);
  });

  it('non-feature Workshop modules name features only at approved family seams', () => {
    const approvals = new Map(
      WORKSHOP_APPROVED_GENERIC_FEATURE_SURFACES.map((surface) => [surface.file, surface])
    );
    const missingApprovedSurfaces = WORKSHOP_APPROVED_GENERIC_FEATURE_SURFACES
      .filter(({ file }) => !fs.existsSync(path.join(SRC_ROOT, file)))
      .map(({ file }) => file);
    const unusedApprovedSurfaces = WORKSHOP_APPROVED_GENERIC_FEATURE_SURFACES
      .filter(({ file, allowedToken }) => {
        const fullPath = path.join(SRC_ROOT, file);
        if (!fs.existsSync(fullPath)) {
          return false;
        }
        return !collectWorkshopFeatureSemanticOccurrences(
          fs.readFileSync(fullPath, 'utf8')
        ).some(({ token }) => matchesApprovedFeatureToken(token, allowedToken));
      })
      .map(({ file }) => file);
    const offenders = collectSourceFiles(SRC_ROOT).flatMap((file) => {
      const relativePath = path.relative(SRC_ROOT, file);
      if (WORKSHOP_FEATURE_BOUNDARIES.some(({ pathReference }) =>
        pathReference.test(relativePath)
      )) {
        return [];
      }
      const featureOccurrences = collectWorkshopFeatureSemanticOccurrences(
        fs.readFileSync(file, 'utf8')
      );
      if (featureOccurrences.length === 0) {
        return [];
      }
      const approval = approvals.get(relativePath);
      const unapprovedOccurrences = approval
        ? featureOccurrences.filter(({ token }) =>
            !matchesApprovedFeatureToken(token, approval.allowedToken)
          )
        : featureOccurrences;
      return unapprovedOccurrences.length > 0
        ? [{ file: relativePath, occurrences: unapprovedOccurrences }]
        : [];
    });

    expect({ missingApprovedSurfaces, unusedApprovedSurfaces, offenders }).toEqual({
      missingApprovedSurfaces: [],
      unusedApprovedSurfaces: [],
      offenders: []
    });
  });

  it('inventories every approved generic seam for Prose Controller without sibling paths', () => {
    const entries = [...PROSE_CONTROLLER_GENERIC_SEAM_ENTRIES];
    expect(inspectWorkshopGenericSeamInventory({
      entries,
      inapplicableSurfaces: PROSE_CONTROLLER_INAPPLICABLE_SURFACES
    })).toEqual({
      duplicateEntries: [],
      missingEntries: [],
      unapprovedEntries: [],
      unclassifiedApprovedSurfaces: [],
      missingInapplicabilityReasons: [],
      siblingFeatureEntries: []
    });
    expect(entries).toContain(
      'presentation/webview/hooks/domain/workshop/dispatchWorkshopWidgetActionResult.ts'
    );
    expect(entries).toContain('shared/constants/promptBudgets.ts');
  });

  it('Workshop feature hooks do not own family-generic widget config lookup', () => {
    const offenders = WORKSHOP_FEATURE_HOOKS
      .filter((file) => GENERIC_WIDGET_CONFIG_PRESENTATION_REFERENCE.test(
        fs.readFileSync(file, 'utf8')
      ))
      .map((file) => path.relative(SRC_ROOT, file));
    const widgetHostSource = fs.readFileSync(WORKSHOP_WIDGET_HOST_HOOK, 'utf8');

    expect(offenders).toEqual([]);
    expect(widgetHostSource).toMatch(/WORKSHOP_REQUEST_WIDGET_CONFIG/);
    expect(widgetHostSource).toMatch(/handleWidgetConfigData/);
  });

  it('Workshop room and session hooks stay feature-free with one-way replacement ownership', () => {
    const roomSource = fs.readFileSync(WORKSHOP_ROOM_HOOK, 'utf8');
    const sessionsSource = fs.readFileSync(WORKSHOP_SESSIONS_HOOK, 'utf8');
    const featureState = /(?:gesture|lexical|widget)/i;

    expect(featureState.test(roomSource)).toBe(false);
    expect(featureState.test(sessionsSource)).toBe(false);
    expect(roomSource).not.toMatch(/from\s+['"][^'"]*useWorkshopSessions['"]/);
    expect(sessionsSource).toMatch(/WorkshopRoomReplacementPort/);
    expect(sessionsSource).toMatch(/roomReplacement\.beginReplacement\(\)/);
    expect(fs.existsSync(path.join(
      SRC_ROOT,
      'presentation/webview/hooks/domain/useWorkshop.ts'
    ))).toBe(false);
  });

  it('Workshop presentation controllers receive host effects instead of owning transport', () => {
    const transportReference = /(?:useVSCodeApi|MessageType|postMessage)/;
    const offenders = collectSourceFiles(WORKSHOP_PRESENTATION_CONTROLLERS)
      .filter((file) => transportReference.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('Workshop standing removal has one generic presentation owner', () => {
    const featureOffenders = WORKSHOP_FEATURE_HOOKS
      .filter((file) => /WORKSHOP_REMOVE_STANDING_WIDGET/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));
    const standingOwner = fs.readFileSync(WORKSHOP_STANDING_DIRECTIVE_HOOK, 'utf8');

    expect(featureOffenders).toEqual([]);
    expect(standingOwner).toMatch(/WORKSHOP_REMOVE_STANDING_WIDGET/);
    expect(standingOwner).toMatch(/requestToken/);
    expect(standingOwner).toMatch(/workshopWidgetLabel/);
  });

  it('Workshop standing mechanics dispatch through one closed feature registry', () => {
    const genericOffenders = WORKSHOP_GENERIC_STANDING_MECHANICS
      .filter((file) => importsFeature(fs.readFileSync(file, 'utf8'), LEXICAL_FEATURE_REFERENCE))
      .map((file) => path.relative(SRC_ROOT, file));
    const operations = fs.readFileSync(WORKSHOP_STANDING_DIRECTIVE_OPERATIONS, 'utf8');

    expect(genericOffenders).toEqual([]);
    expect(operations).toMatch(/Record<WorkshopStandingDirectiveFamily/);
    expect(operations).toMatch(
      /'lexical-gravity': LEXICAL_GRAVITY_STANDING_DIRECTIVE_OPERATIONS/
    );
    expect(operations).toMatch(/'prose-controller': proseControllerEntry/);
  });

  it('Workshop generic family surfaces carry no feature-owned writer-facing copy', () => {
    const offenders = WORKSHOP_GENERIC_FEATURE_COPY_SURFACES
      .filter((file) => /\b(?:Gesture Playground|Lexical Gravity)\b/.test(
        fs.readFileSync(file, 'utf8')
      ))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('Workshop handlers cannot bypass the session aggregate through internal collaborators', () => {
    const existingLedgerFiles = [
      path.join(
        SRC_ROOT,
        'application',
        'services',
        'workshop',
        'widgets',
        'WorkshopWidgetConfigLedger.ts'
      ),
      path.join(
        SRC_ROOT,
        'application',
        'services',
        'workshop',
        'directives',
        'WorkshopStandingDirectiveLedger.ts'
      )
    ];
    const collaboratorNames = [
      ...existingLedgerFiles,
      ...collectSourceFiles(WORKSHOP_SESSION_COLLABORATOR_ROOT)
    ].flatMap((file) => {
      const className = path.basename(file, '.ts');
      return new RegExp(`export class ${className}\\b`).test(fs.readFileSync(file, 'utf8'))
        ? [className]
        : [];
    });
    const internalSessionCollaborator = new RegExp(
      `(?:${collaboratorNames.join('|')})`
    );
    const offenders = collectSourceFiles(WORKSHOP_HANDLER_ROOT)
      .filter((file) => internalSessionCollaborator.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(collaboratorNames).toEqual(expect.arrayContaining([
      'WorkshopWidgetConfigLedger',
      'WorkshopStandingDirectiveLedger',
      'WorkshopTodoLedger',
      'WorkshopTurnLedger',
      'WorkshopPassageScope',
      'WorkshopParticipantRoster'
    ]));
    expect(offenders).toEqual([]);
  });

  it('Workshop aggregate hydration prepares every collaborator before the install barrier', () => {
    const sessionSource = fs.readFileSync(
      path.join(
        SRC_ROOT,
        'application',
        'services',
        'workshop',
        'WorkshopSessionService.ts'
      ),
      'utf8'
    );
    const hydrationStart = sessionSource.indexOf('  hydrateCommittedState(');
    const hydrationEnd = sessionSource.indexOf('\n  getSnapshot()', hydrationStart);
    const hydrationBody = sessionSource.slice(hydrationStart, hydrationEnd);
    const prepareCalls = [
      ...hydrationBody.matchAll(/this\.([A-Za-z][A-Za-z0-9]*)\.prepareState\(/g)
    ];
    const installCalls = [
      ...hydrationBody.matchAll(/this\.([A-Za-z][A-Za-z0-9]*)\.installPreparedState\(/g)
    ];
    const prepareOffsets = prepareCalls.map((match) => match.index);
    const installOffsets = installCalls.map((match) => match.index);
    const firstLiveFieldInstall = hydrationBody.search(/\n\s*this\.[A-Za-z][A-Za-z0-9]*\s*=/);

    expect(hydrationStart).toBeGreaterThanOrEqual(0);
    expect(hydrationEnd).toBeGreaterThan(hydrationStart);
    expect(prepareOffsets.length).toBeGreaterThan(0);
    expect(installOffsets.length).toBeGreaterThan(0);
    expect(installCalls.map((match) => match[1]).sort())
      .toEqual(prepareCalls.map((match) => match[1]).sort());
    expect(firstLiveFieldInstall).toBeGreaterThanOrEqual(0);
    expect(prepareOffsets.every((offset) => offset < firstLiveFieldInstall)).toBe(true);
    expect(installOffsets.every((offset) => offset > firstLiveFieldInstall)).toBe(true);
  });

  it('Workshop source, test, and architecture docs agree on normalized ownership', () => {
    const workshopMessageRoot = path.join(SRC_ROOT, 'shared', 'types', 'messages', 'workshop');
    const messageModules = fs.readdirSync(workshopMessageRoot)
      .filter((file) => file.endsWith('.ts'))
      .sort();
    const ownedTests = [
      'application/services/workshop/RunWorkshopToolSidePass.integration.test.ts',
      'application/services/workshop/WorkshopPromptBuilder.threadArtifactFrame.test.ts'
    ];
    const retiredTests = [
      'application/handlers/domain/WorkshopToolSidePass.integration.test.ts',
      'application/services/workshop/WorkshopWidgetFrames.test.ts'
    ];
    const testRoot = path.join(SRC_ROOT, '__tests__');
    const documents = [
      {
        name: '.ai/central-agent-setup.md',
        anchor: '└── workshop/        # Workshop contracts behind one subdomain barrel',
        treeAnchor: '└── workshop/        # Workshop contracts behind one subdomain barrel',
        text: fs.readFileSync(
          path.join(REPOSITORY_ROOT, '.ai', 'central-agent-setup.md'),
          'utf8'
        )
      },
      {
        name: 'docs/ARCHITECTURE.md',
        anchor: 'Contracts mirror those owners under',
        treeAnchor: 'workshop/\n├── index.ts',
        text: fs.readFileSync(
          path.join(REPOSITORY_ROOT, 'docs', 'ARCHITECTURE.md'),
          'utf8'
        )
      }
    ];

    expect(messageModules).toEqual([
      'context.ts',
      'creativeVariations.ts',
      'gesturePlayground.ts',
      'index.ts',
      'lexicalGravity.ts',
      'participants.ts',
      'recovery.ts',
      'session.ts',
      'settings.ts',
      'standingDirectives.ts',
      'widgets.ts'
    ]);
    expect(ownedTests.filter((file) => !fs.existsSync(path.join(testRoot, file)))).toEqual([]);
    expect(retiredTests.filter((file) => fs.existsSync(path.join(testRoot, file)))).toEqual([]);
    const missingDocReferences = documents.flatMap(({ name, text }) => [
      'handlers/domain/workshop/',
      'shared/types/messages/workshop/',
      'useWorkshopRoom',
      'useWorkshopSessions'
    ].filter((reference) => !text.includes(reference))
      .map((reference) => `${name}: ${reference}`));
    const documentedMessageModules = documents.map(({ name, anchor, treeAnchor, text }) => {
      const anchorIndex = text.indexOf(anchor);
      const treeStart = anchorIndex >= 0 ? text.indexOf(treeAnchor, anchorIndex) : -1;
      const fenceEnd = treeStart >= 0 ? text.indexOf('```', treeStart) : -1;
      const workshopTree = treeStart >= 0 && fenceEnd > treeStart
        ? text.slice(treeStart, fenceEnd)
        : '';
      return {
        name,
        modules: [...workshopTree.matchAll(
          /^[│ ]*[├└]──\s+([A-Za-z][A-Za-z0-9]*\.ts)\b/gm
        )].map((match) => match[1]).sort()
      };
    });

    expect({ missingDocReferences, documentedMessageModules }).toEqual({
      missingDocReferences: [],
      documentedMessageModules: documents.map(({ name }) => ({
        name,
        modules: messageModules
      }))
    });
  });

  it('keeps the accepted Workshop legacy ownership exceptions exact during migration', () => {
    const missingFiles = WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS
      .map(({ phase, file }) => ({ phase, file, fullPath: path.join(SRC_ROOT, file) }))
      .filter(({ fullPath }) => !fs.existsSync(fullPath))
      .map(({ phase, file }) => `P${phase}:${file}`);

    expect({ missingLegacyExceptionFiles: missingFiles }).toEqual({
      missingLegacyExceptionFiles: []
    });

    const observed = WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS
      .filter(({ file, marker }) => {
        const fullPath = path.join(SRC_ROOT, file);
        return fs.existsSync(fullPath) && marker.test(fs.readFileSync(fullPath, 'utf8'));
      })
      .map(({ phase, file }) => `P${phase}:${file}`);

    expect(observed).toEqual([]);
  });
});
