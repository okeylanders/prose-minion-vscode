/** Workshop standing-directive family contracts. */

import { MessageEnvelope, MessageType } from '../base';
import {
  WorkshopLexicalGravityApplyStandingWidgetPayload,
  WorkshopLexicalGravityReach
} from './lexicalGravity';

/** Closed family key carried by the standing prose-directive frame. */
export type WorkshopStandingDirectiveFamily =
  | 'lexical-gravity'
  | 'prose-controller';

/** Session-owned identity for one currently active directive family. */
export interface WorkshopStandingDirectiveSnapshot {
  id: string;
  family: WorkshopStandingDirectiveFamily;
  widgetId: 'lexical-gravity' | 'prose-controller';
  widgetConfigId: string;
  revision: number;
  updatedAt: number;
}

export interface WorkshopLexicalGravityStandingDirectiveSummary
  extends WorkshopStandingDirectiveSnapshot {
  family: 'lexical-gravity';
  widgetId: 'lexical-gravity';
  lensName: string;
  lensVariant?: string;
  weight: number;
  reach: WorkshopLexicalGravityReach;
  metaphorPull: boolean;
}

export type WorkshopStandingDirectiveSummary =
  WorkshopLexicalGravityStandingDirectiveSummary;

export interface WorkshopStandingWidgetCommit {
  widgetId: 'lexical-gravity' | 'prose-controller';
  widgetConfigId: string;
  rail: 'standing';
  directiveId: string;
  revision: number;
}

export interface WorkshopStandingDirectiveChange {
  action: 'installed' | 'shifted' | 'removed';
  family: WorkshopStandingDirectiveFamily;
  widgetId: 'lexical-gravity' | 'prose-controller';
  directiveId: string;
  widgetConfigId: string;
  revision: number;
}

/** Each live standing feature contributes one exact widget/draft arm. */
export type WorkshopApplyStandingWidgetPayload =
  WorkshopLexicalGravityApplyStandingWidgetPayload;

export interface WorkshopApplyStandingWidgetMessage
  extends MessageEnvelope<WorkshopApplyStandingWidgetPayload> {
  type: MessageType.WORKSHOP_APPLY_STANDING_WIDGET;
}

export interface WorkshopRemoveStandingWidgetPayload {
  requestToken: string;
  family: WorkshopStandingDirectiveFamily;
}

export interface WorkshopRemoveStandingWidgetMessage
  extends MessageEnvelope<WorkshopRemoveStandingWidgetPayload> {
  type: MessageType.WORKSHOP_REMOVE_STANDING_WIDGET;
}
