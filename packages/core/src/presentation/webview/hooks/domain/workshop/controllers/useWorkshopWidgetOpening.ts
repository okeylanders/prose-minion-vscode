/** Presentation owner for opening and reopening Workshop widget authoring surfaces. */

import * as React from 'react';
import {
  WorkshopGestureWidgetConfigSnapshot,
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityRecommendationSeed,
  WorkshopLexicalGravityWidgetConfigSnapshot,
  WorkshopStandingDirectiveSummary,
  WorkshopTurn,
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetId,
  WorkshopWidgetRecommendationSeed
} from '@messages';

/** How the modal was opened; decides seeding and the commit button's label. */
export type WorkshopGestureOpening =
  | { kind: 'new'; seedTargetPhrase?: string }
  | { kind: 'seed'; seed: WorkshopWidgetRecommendationSeed; personaLabel: string }
  | { kind: 'clone'; config: WorkshopGestureWidgetConfigSnapshot };

export type WorkshopLexicalGravityOpening =
  | { kind: 'new'; seed?: WorkshopLexicalGravityDraft }
  | { kind: 'seed'; seed: WorkshopLexicalGravityRecommendationSeed; personaLabel: string }
  | { kind: 'edit'; config: WorkshopLexicalGravityWidgetConfigSnapshot };

export interface WorkshopWidgetOpeningHost {
  widgetConfigData: WorkshopWidgetConfigSnapshot | null;
  widgetConfigResponseId: string | null;
  widgetConfigError: string | null;
  requestWidgetConfig: (configId: string) => void;
  clearWidgetConfigData: () => void;
}

export interface UseWorkshopWidgetOpeningOptions {
  host: WorkshopWidgetOpeningHost;
  standingDirectives: WorkshopStandingDirectiveSummary[];
  onError: (message: string) => void;
  onCloseGesture: () => void;
  onCloseLexicalGravity: () => void;
}

export interface WorkshopWidgetOpeningState {
  gestureOpening: WorkshopGestureOpening | null;
  lexicalGravityOpening: WorkshopLexicalGravityOpening | null;
  pendingWidgetConfigId: string | null;
}

export interface WorkshopWidgetOpeningActions {
  openWidgetConfig: (widgetConfigId: string) => void;
  launchWidget: (widgetId: WorkshopWidgetId) => void;
  openWidgetRecommendation: (
    recommendation: NonNullable<WorkshopTurn['widgetRecommendation']>,
    personaLabel?: string
  ) => void;
  closeGesture: () => void;
  closeLexicalGravity: () => void;
}

export interface WorkshopWidgetOpeningPersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseWorkshopWidgetOpeningReturn = WorkshopWidgetOpeningState &
  WorkshopWidgetOpeningActions & {
    persistedState: WorkshopWidgetOpeningPersistence;
  };

export function useWorkshopWidgetOpening({
  host,
  standingDirectives,
  onError,
  onCloseGesture,
  onCloseLexicalGravity
}: UseWorkshopWidgetOpeningOptions): UseWorkshopWidgetOpeningReturn {
  const [gestureOpening, setGestureOpening] =
    React.useState<WorkshopGestureOpening | null>(null);
  const [lexicalGravityOpening, setLexicalGravityOpening] =
    React.useState<WorkshopLexicalGravityOpening | null>(null);
  const [pendingWidgetConfigId, setPendingWidgetConfigId] = React.useState<string | null>(null);

  const openWidgetConfig = React.useCallback((widgetConfigId: string) => {
    setPendingWidgetConfigId(widgetConfigId);
    host.requestWidgetConfig(widgetConfigId);
  }, [host.requestWidgetConfig]);

  const launchWidget = React.useCallback((widgetId: WorkshopWidgetId) => {
    if (widgetId === 'gesture-playground') {
      setGestureOpening({ kind: 'new' });
      return;
    }
    if (widgetId === 'lexical-gravity') {
      const active = standingDirectives.find(
        (directive) => directive.family === 'lexical-gravity'
      );
      if (active) {
        openWidgetConfig(active.widgetConfigId);
      } else {
        setLexicalGravityOpening({ kind: 'new' });
      }
    }
  }, [openWidgetConfig, standingDirectives]);

  const openWidgetRecommendation = React.useCallback(
    (
      recommendation: NonNullable<WorkshopTurn['widgetRecommendation']>,
      personaLabel?: string
    ) => {
      if (recommendation.widgetId === 'gesture-playground') {
        setGestureOpening({
          kind: 'seed',
          seed: recommendation.seed ?? {},
          personaLabel: personaLabel ?? 'the persona'
        });
      } else if (recommendation.widgetId === 'lexical-gravity') {
        setLexicalGravityOpening({
          kind: 'seed',
          seed: recommendation.seed ?? {},
          personaLabel: personaLabel ?? 'the persona'
        });
      }
    },
    []
  );

  const closeGesture = React.useCallback(() => {
    setGestureOpening(null);
    setPendingWidgetConfigId(null);
    host.clearWidgetConfigData();
    onCloseGesture();
  }, [host.clearWidgetConfigData, onCloseGesture]);

  const closeLexicalGravity = React.useCallback(() => {
    setLexicalGravityOpening(null);
    setPendingWidgetConfigId(null);
    host.clearWidgetConfigData();
    onCloseLexicalGravity();
  }, [host.clearWidgetConfigData, onCloseLexicalGravity]);

  React.useEffect(() => {
    if (!pendingWidgetConfigId || host.widgetConfigResponseId !== pendingWidgetConfigId) {
      return;
    }

    const config = host.widgetConfigData;
    if (config?.id === pendingWidgetConfigId) {
      // The wire may be ahead of this webview's discriminated union.
      const receivedWidgetId = String(config.widgetId);
      if (config.widgetId === 'gesture-playground') {
        setGestureOpening({ kind: 'clone', config });
      } else if (config.widgetId === 'lexical-gravity') {
        const active = standingDirectives.some(
          (directive) => directive.widgetConfigId === config.id
        );
        setLexicalGravityOpening(
          active ? { kind: 'edit', config } : { kind: 'new', seed: config.draft }
        );
      } else {
        const message = `${receivedWidgetId} can't be opened in this version.`;
        console.warn(`[Workshop] ${message}`);
        onError(message);
      }
      setPendingWidgetConfigId(null);
      host.clearWidgetConfigData();
      return;
    }

    if (host.widgetConfigError) {
      onError(host.widgetConfigError);
      setPendingWidgetConfigId(null);
      host.clearWidgetConfigData();
    }
  }, [
    host.clearWidgetConfigData,
    host.widgetConfigData,
    host.widgetConfigError,
    host.widgetConfigResponseId,
    onError,
    pendingWidgetConfigId,
    standingDirectives
  ]);

  return {
    gestureOpening,
    lexicalGravityOpening,
    pendingWidgetConfigId,
    openWidgetConfig,
    launchWidget,
    openWidgetRecommendation,
    closeGesture,
    closeLexicalGravity,
    persistedState: {}
  };
}
