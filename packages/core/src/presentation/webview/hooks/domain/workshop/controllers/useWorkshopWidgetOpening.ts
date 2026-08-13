/** Presentation owner for opening and reopening Workshop widget authoring surfaces. */

import * as React from 'react';
import {
  WorkshopGesturePlaygroundWidgetConfigSnapshot,
  WorkshopCreativeVariationsWidgetConfigSnapshot,
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityRecommendationSeed,
  WorkshopLexicalGravityWidgetConfigSnapshot,
  WorkshopStandingDirectiveSummary,
  WorkshopTurn,
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetId,
  WorkshopGesturePlaygroundRecommendationSeed
} from '@messages';

/** How the modal was opened; decides seeding and the commit button's label. */
export type WorkshopGesturePlaygroundOpening =
  | { kind: 'new'; seedTargetPhrase?: string }
  | { kind: 'seed'; seed: WorkshopGesturePlaygroundRecommendationSeed; personaLabel: string }
  | { kind: 'clone'; config: WorkshopGesturePlaygroundWidgetConfigSnapshot };

export type WorkshopLexicalGravityOpening =
  | { kind: 'new'; seed?: WorkshopLexicalGravityDraft }
  | { kind: 'seed'; seed: WorkshopLexicalGravityRecommendationSeed; personaLabel: string }
  | { kind: 'edit'; config: WorkshopLexicalGravityWidgetConfigSnapshot };

export type WorkshopCreativeVariationsOpening =
  | { kind: 'new' }
  | { kind: 'clone'; config: WorkshopCreativeVariationsWidgetConfigSnapshot };

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
  onCloseGesturePlayground: () => void;
  onCloseLexicalGravity: () => void;
  onCloseCreativeVariations: () => void;
}

export interface WorkshopWidgetOpeningState {
  gesturePlaygroundOpening: WorkshopGesturePlaygroundOpening | null;
  lexicalGravityOpening: WorkshopLexicalGravityOpening | null;
  creativeVariationsOpening: WorkshopCreativeVariationsOpening | null;
  pendingWidgetConfigId: string | null;
}

export interface WorkshopWidgetOpeningActions {
  openWidgetConfig: (widgetConfigId: string) => void;
  launchWidget: (widgetId: WorkshopWidgetId) => void;
  openWidgetRecommendation: (
    recommendation: NonNullable<WorkshopTurn['widgetRecommendation']>,
    personaLabel?: string
  ) => void;
  closeGesturePlayground: () => void;
  closeLexicalGravity: () => void;
  closeCreativeVariations: () => void;
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
  onCloseGesturePlayground,
  onCloseLexicalGravity,
  onCloseCreativeVariations
}: UseWorkshopWidgetOpeningOptions): UseWorkshopWidgetOpeningReturn {
  const [gesturePlaygroundOpening, setGesturePlaygroundOpening] =
    React.useState<WorkshopGesturePlaygroundOpening | null>(null);
  const [lexicalGravityOpening, setLexicalGravityOpening] =
    React.useState<WorkshopLexicalGravityOpening | null>(null);
  const [creativeVariationsOpening, setCreativeVariationsOpening] =
    React.useState<WorkshopCreativeVariationsOpening | null>(null);
  const [pendingWidgetConfigId, setPendingWidgetConfigId] = React.useState<string | null>(null);

  const openWidgetConfig = React.useCallback((widgetConfigId: string) => {
    setPendingWidgetConfigId(widgetConfigId);
    host.requestWidgetConfig(widgetConfigId);
  }, [host.requestWidgetConfig]);

  const launchWidget = React.useCallback((widgetId: WorkshopWidgetId) => {
    if (widgetId === 'gesture-playground') {
      setGesturePlaygroundOpening({ kind: 'new' });
      return;
    }
    if (widgetId === 'creative-variations') {
      setCreativeVariationsOpening({ kind: 'new' });
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
        setGesturePlaygroundOpening({
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

  const closeGesturePlayground = React.useCallback(() => {
    setGesturePlaygroundOpening(null);
    setPendingWidgetConfigId(null);
    host.clearWidgetConfigData();
    onCloseGesturePlayground();
  }, [host.clearWidgetConfigData, onCloseGesturePlayground]);

  const closeLexicalGravity = React.useCallback(() => {
    setLexicalGravityOpening(null);
    setPendingWidgetConfigId(null);
    host.clearWidgetConfigData();
    onCloseLexicalGravity();
  }, [host.clearWidgetConfigData, onCloseLexicalGravity]);

  const closeCreativeVariations = React.useCallback(() => {
    setCreativeVariationsOpening(null);
    setPendingWidgetConfigId(null);
    host.clearWidgetConfigData();
    onCloseCreativeVariations();
  }, [host.clearWidgetConfigData, onCloseCreativeVariations]);

  React.useEffect(() => {
    if (!pendingWidgetConfigId || host.widgetConfigResponseId !== pendingWidgetConfigId) {
      return;
    }

    const config = host.widgetConfigData;
    if (config?.id === pendingWidgetConfigId) {
      // The wire may be ahead of this webview's discriminated union.
      const receivedWidgetId = String(config.widgetId);
      if (config.widgetId === 'gesture-playground') {
        setGesturePlaygroundOpening({ kind: 'clone', config });
      } else if (config.widgetId === 'creative-variations') {
        setCreativeVariationsOpening({ kind: 'clone', config });
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
    gesturePlaygroundOpening,
    lexicalGravityOpening,
    creativeVariationsOpening,
    pendingWidgetConfigId,
    openWidgetConfig,
    launchWidget,
    openWidgetRecommendation,
    closeGesturePlayground,
    closeLexicalGravity,
    closeCreativeVariations,
    persistedState: {}
  };
}
