/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useWorkshopWidgetOpening,
  WorkshopWidgetOpeningHost
} from '@hooks/domain/workshop/controllers/useWorkshopWidgetOpening';
import { WorkshopStandingDirectiveSummary } from '@messages';

/**
 * Sprint 05 deliverable 7(b), webview half: Show vs. Tell and Lexical Gravity
 * share an opening controller and nothing else. Opening or closing one never
 * writes the other's opening, never asks the host for the other's config, and
 * never touches the standing directive that carries the gear and evidence mode.
 */

const activeLexical: WorkshopStandingDirectiveSummary = {
  id: 'pd-1',
  family: 'lexical-gravity',
  widgetId: 'lexical-gravity',
  widgetConfigId: 'wc-lexical',
  revision: 2,
  updatedAt: 2,
  lensName: 'Photography',
  applicationMode: 'interpret',
  evidenceMode: 'blend',
  weight: 60,
  reach: 2,
  metaphorPull: true
};

const showVsTellRecommendation = {
  widgetId: 'show-vs-tell' as const,
  seed: {
    beatText: 'She hadn’t trusted him since the funeral.',
    sourceReferences: [],
    mustSurvive: 'The distrust is old.'
  }
};

const lexicalRecommendation = {
  widgetId: 'lexical-gravity' as const,
  seed: { lensSlug: 'photography', weight: 60, reach: 2 as const, metaphorPull: false }
};

describe('useWorkshopWidgetOpening — Show vs. Tell independence from Lexical Gravity', () => {
  const mount = () => {
    const host: WorkshopWidgetOpeningHost = {
      widgetConfigData: null,
      widgetConfigResponseId: null,
      widgetConfigError: null,
      restoredWidgetConfigId: null,
      requestWidgetConfig: jest.fn(),
      clearWidgetConfigData: jest.fn(),
      consumeRestoredWidgetConfig: jest.fn()
    };
    const standingDirectives = [activeLexical];
    const closers = {
      onCloseLexicalGravity: jest.fn(),
      onCloseShowVsTell: jest.fn()
    };
    const onError = jest.fn();
    const rendered = renderHook(() => useWorkshopWidgetOpening({
      host,
      standingDirectives,
      onError,
      onCloseGesturePlayground: jest.fn(),
      onCloseCreativeVariations: jest.fn(),
      ...closers
    }));
    return { host, standingDirectives, closers, onError, ...rendered };
  };

  it('opens a Show vs. Tell prefill without touching Lexical Gravity', () => {
    const h = mount();
    act(() => h.result.current.openWidgetRecommendation(lexicalRecommendation, 'Jill', 'jill'));
    const lexicalOpening = h.result.current.lexicalGravityOpening;
    expect(lexicalOpening).toMatchObject({ kind: 'seed' });

    act(() => h.result.current.openWidgetRecommendation(showVsTellRecommendation, 'Margot', 'margot'));

    expect(h.result.current.showVsTellOpening).toMatchObject({ kind: 'seed', personaId: 'margot' });
    expect(h.result.current.lexicalGravityOpening).toBe(lexicalOpening);
    expect(h.host.requestWidgetConfig).not.toHaveBeenCalled();
    expect(h.closers.onCloseLexicalGravity).not.toHaveBeenCalled();
    expect(h.standingDirectives).toEqual([activeLexical]);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('opens a Lexical Gravity prefill without touching a Show vs. Tell sheet', () => {
    const h = mount();
    act(() => h.result.current.openWidgetRecommendation(showVsTellRecommendation, 'Margot', 'margot'));
    const showVsTellOpening = h.result.current.showVsTellOpening;
    expect(showVsTellOpening).toMatchObject({ kind: 'seed' });

    act(() => h.result.current.openWidgetRecommendation(lexicalRecommendation, 'Jill', 'jill'));

    expect(h.result.current.lexicalGravityOpening).toMatchObject({ kind: 'seed' });
    expect(h.result.current.showVsTellOpening).toBe(showVsTellOpening);
    expect(h.closers.onCloseShowVsTell).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('closes each surface without closing or clearing the other', () => {
    const h = mount();
    act(() => h.result.current.openWidgetRecommendation(lexicalRecommendation, 'Jill', 'jill'));
    act(() => h.result.current.openWidgetRecommendation(showVsTellRecommendation, 'Margot', 'margot'));

    act(() => h.result.current.closeShowVsTell());
    expect(h.result.current.showVsTellOpening).toBeNull();
    expect(h.result.current.lexicalGravityOpening).toMatchObject({ kind: 'seed' });
    expect(h.closers.onCloseShowVsTell).toHaveBeenCalledTimes(1);
    expect(h.closers.onCloseLexicalGravity).not.toHaveBeenCalled();

    act(() => h.result.current.openWidgetRecommendation(showVsTellRecommendation, 'Margot', 'margot'));
    act(() => h.result.current.closeLexicalGravity());
    expect(h.result.current.lexicalGravityOpening).toBeNull();
    expect(h.result.current.showVsTellOpening).toMatchObject({ kind: 'seed' });
    expect(h.closers.onCloseLexicalGravity).toHaveBeenCalledTimes(1);
    expect(h.closers.onCloseShowVsTell).toHaveBeenCalledTimes(1);
  });

  it('launches the widgets on separate rails: only Lexical Gravity reopens its active directive', () => {
    const h = mount();

    act(() => h.result.current.launchWidget('show-vs-tell'));
    expect(h.result.current.showVsTellOpening).toEqual({ kind: 'new' });
    expect(h.host.requestWidgetConfig).not.toHaveBeenCalled();
    expect(h.result.current.lexicalGravityOpening).toBeNull();

    act(() => h.result.current.launchWidget('lexical-gravity'));
    expect(h.host.requestWidgetConfig).toHaveBeenCalledTimes(1);
    expect(h.host.requestWidgetConfig).toHaveBeenCalledWith('wc-lexical');
    expect(h.result.current.showVsTellOpening).toEqual({ kind: 'new' });
  });
});
