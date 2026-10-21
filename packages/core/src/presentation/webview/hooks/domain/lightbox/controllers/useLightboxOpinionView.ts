/**
 * useLightboxOpinionView — which of the Opinion's views the writer is
 * looking at, per board (ADR 2026-10-19 D7 addendum, D12; Slice 4D).
 *
 * A presentation controller: a UI preference only, persisted in webview
 * state like the tile filter, keyed by board id and bounded to the latest
 * `LIGHTBOX_OPINION_VIEWS_KEPT` boards. The host never learns which view
 * the writer looked at, and nothing else on the board depends on it. With
 * no choice for a board, the tile opens on its default view (Neutral).
 */

import * as React from 'react';
import type { LightboxOpinionViewId } from '@messages';
import { isLightboxOpinionView } from '@shared/constants/lightboxOpinion';
import { usePersistedState } from '@hooks/usePersistence';

/** Boards whose chosen view is remembered; the oldest choice goes first. */
export const LIGHTBOX_OPINION_VIEWS_KEPT = 12;

export interface LightboxOpinionViewState {
  /** The view chosen on the board on screen; undefined until the writer picks one. */
  chosen: LightboxOpinionViewId | undefined;
}

export interface LightboxOpinionViewActions {
  choose: (view: LightboxOpinionViewId) => void;
}

export interface LightboxOpinionViewPersistence {
  /** Board id → the view chosen there, oldest first. */
  lightboxOpinionViews: Record<string, LightboxOpinionViewId>;
}

export type UseLightboxOpinionViewReturn = LightboxOpinionViewState & LightboxOpinionViewActions & {
  persistedState: LightboxOpinionViewPersistence;
};

/** Restore persisted choices; anything malformed is dropped. */
export function parseLightboxOpinionViews(value: unknown): Record<string, LightboxOpinionViewId> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, LightboxOpinionViewId] => entry[0].length > 0 && isLightboxOpinionView(entry[1]));
  return Object.fromEntries(entries.slice(-LIGHTBOX_OPINION_VIEWS_KEPT));
}

/** `views` with `boardId`'s choice set, moved to the newest place, within the bound. */
export function withLightboxOpinionView(
  views: Readonly<Record<string, LightboxOpinionViewId>>,
  boardId: string,
  view: LightboxOpinionViewId
): Record<string, LightboxOpinionViewId> {
  const rest = Object.entries(views).filter(([id]) => id !== boardId);
  return Object.fromEntries([...rest, [boardId, view] as const].slice(-LIGHTBOX_OPINION_VIEWS_KEPT));
}

export function useLightboxOpinionView({ boardId }: { boardId: string | undefined }): UseLightboxOpinionViewReturn {
  const persisted = usePersistedState<Partial<Record<keyof LightboxOpinionViewPersistence, unknown>>>();
  const [views, setViews] = React.useState<Record<string, LightboxOpinionViewId>>(() =>
    parseLightboxOpinionViews(persisted?.lightboxOpinionViews));
  const choose = React.useCallback((view: LightboxOpinionViewId) => {
    if (boardId) {
      setViews((current) => withLightboxOpinionView(current, boardId, view));
    }
  }, [boardId]);
  const persistedState = React.useMemo<LightboxOpinionViewPersistence>(() => ({ lightboxOpinionViews: { ...views } }), [views]);
  return { chosen: boardId ? views[boardId] : undefined, choose, persistedState };
}
