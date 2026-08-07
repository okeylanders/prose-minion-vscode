/** Conversation Widget family contracts and exact supported unions. */

import { MessageEnvelope, MessageType } from '../base';
import {
  WorkshopGesturePlaygroundCommitPayload,
  WorkshopGesturePlaygroundDraft,
  WorkshopGesturePlaygroundRecommendationSeed
} from './gesturePlayground';
import {
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityReach,
  WorkshopLexicalGravityRecommendationSeed
} from './lexicalGravity';
import { WorkshopStandingWidgetCommit } from './standingDirectives';

/**
 * Wire id for a Conversation Widget (ADR 2026-07-22). The canonical catalog —
 * labels, rails, groups, and `live` availability — is
 * shared/constants/workshopWidgets.ts; handlers validate against it and the
 * thread-artifact `kind` is derived from it (`widget:<id>`), so the id IS the
 * frame identity. Ids for unshipped widgets exist so the browser can show an
 * honest roadmap; only `live` ids may launch, commit, or be recommended.
 */
export type WorkshopWidgetId =
  | 'gesture-playground'
  | 'show-vs-tell'
  | 'creative-variations'
  | 'topic-relationship'
  | 'genre-relationship'
  | 'writers-dictionary'
  | 'lexical-gravity'
  | 'prose-controller'
  | 'lens-blending'
  | 'learner-english'
  | 'learner-craft'
  | 'decisions'
  | 'scratch-pad';

/**
 * A persisted widget authoring config. Ids are host-minted `wc-N` (monotonic,
 * never reused — the third identity beside turn ids and `ta-N` artifact ids).
 * One-shot configs stay at revision 1; standing widgets edit-in-place and
 * increment (Sprint 02). Clone-and-recommit mints a NEW config linked by
 * `clonedFromConfigId`.
 */
interface WorkshopWidgetConfigSnapshotBase {
  id: string;
  widgetId: WorkshopWidgetId;
  revision: number;
  clonedFromConfigId?: string;
  /** Set when the commit lands; a config without these is an uncommitted retry token. */
  committedTurnId?: string;
  artifactId?: string;
  directiveId?: string;
  /** Epoch ms when the config was created (host-stamped). */
  createdAt: number;
}

export interface WorkshopGesturePlaygroundWidgetConfigSnapshot
  extends WorkshopWidgetConfigSnapshotBase {
  widgetId: 'gesture-playground';
  draft: WorkshopGesturePlaygroundDraft;
}

export interface WorkshopLexicalGravityWidgetConfigSnapshot
  extends WorkshopWidgetConfigSnapshotBase {
  widgetId: 'lexical-gravity';
  draft: WorkshopLexicalGravityDraft;
}

/** Earned persisted union: each widget owns its exact authoring-state codec. */
export type WorkshopWidgetConfigSnapshot =
  | WorkshopGesturePlaygroundWidgetConfigSnapshot
  | WorkshopLexicalGravityWidgetConfigSnapshot;

/**
 * Bounded config identity carried in ordinary session snapshots. The full
 * authoring Draft (especially its generated dictionary/menu) is fetched only
 * when the writer opens a committed widget chip.
 */
export type WorkshopGesturePlaygroundWidgetConfigSummary =
  Omit<WorkshopGesturePlaygroundWidgetConfigSnapshot, 'draft'> & {
  targetPhrase: string;
  selectionCount: number;
};

export type WorkshopLexicalGravityWidgetConfigSummary =
  Omit<WorkshopLexicalGravityWidgetConfigSnapshot, 'draft'> & {
    lensName: string;
    lensVariant?: string;
    applicationMode: WorkshopLexicalGravityDraft['applicationMode'];
    weight: number;
    reach: WorkshopLexicalGravityReach;
    metaphorPull: boolean;
  };

export type WorkshopWidgetConfigSummary =
  | WorkshopGesturePlaygroundWidgetConfigSummary
  | WorkshopLexicalGravityWidgetConfigSummary;

/**
 * Display-safe widget-commit decoration on a normal user message turn —
 * rail-discriminated from day one (the standing arm arrives with Sprint 02).
 * `artifactId` intentionally duplicates the ref reachable through
 * `messageAttachments`-style joins: direct address beats a join; do not
 * "deduplicate" it (ADR 2026-07-22, Sprint 01 concretions).
 */
export interface WorkshopThreadArtifactWidgetCommit {
  widgetId: WorkshopWidgetId;
  widgetConfigId: string;
  rail: 'thread-artifact';
  artifactId: string;
  selectionCount: number;
}

export type WorkshopTurnWidgetCommit =
  | WorkshopThreadArtifactWidgetCommit
  | WorkshopStandingWidgetCommit;

/**
 * Strictly parsed persona widget recommendation (actionable-findings mold:
 * fail-closed host-side parse, typed field, presentation-only chip). Only
 * `live` registry ids survive parsing — comp-only widgets never render chips.
 */
export type WorkshopWidgetRecommendation =
  | {
      widgetId: 'gesture-playground';
      seed?: WorkshopGesturePlaygroundRecommendationSeed;
    }
  | {
      widgetId: 'lexical-gravity';
      seed?: WorkshopLexicalGravityRecommendationSeed;
    };

export interface WorkshopRequestWidgetConfigMessage extends MessageEnvelope<{ configId: string }> {
  type: MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG;
}

export interface WorkshopWidgetConfigDataMessage extends MessageEnvelope<{
  configId: string;
  config?: WorkshopWidgetConfigSnapshot;
  error?: string;
}> {
  type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA;
}

/** Family rail contract; each supported one-shot widget contributes one exact arm. */
export type WorkshopCommitWidgetPayload = WorkshopGesturePlaygroundCommitPayload;

export interface WorkshopCommitWidgetMessage extends MessageEnvelope<WorkshopCommitWidgetPayload> {
  type: MessageType.WORKSHOP_COMMIT_WIDGET;
}

interface WorkshopWidgetActionResultBase {
  requestToken: string;
  ok: boolean;
  widgetConfigId?: string;
  directiveId?: string;
  turnId?: string;
  /** User-facing failure text when ok is false. */
  message?: string;
}

export type WorkshopWidgetActionResultPayload =
  | (WorkshopWidgetActionResultBase & {
      action: 'commit';
      widgetId: 'gesture-playground';
    })
  | (WorkshopWidgetActionResultBase & {
      action: 'apply-standing';
      widgetId: 'lexical-gravity';
    })
  | (WorkshopWidgetActionResultBase & {
      action: 'remove-standing';
      widgetId: 'lexical-gravity' | 'prose-controller';
      /** Distinguishes a real removal from an idempotent no-op. */
      removed?: boolean;
    });

export interface WorkshopWidgetActionResultMessage
  extends MessageEnvelope<WorkshopWidgetActionResultPayload> {
  type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT;
}
