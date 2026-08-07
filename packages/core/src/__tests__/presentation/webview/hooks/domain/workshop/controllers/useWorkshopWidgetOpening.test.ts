/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useWorkshopWidgetOpening,
  WorkshopWidgetOpeningHost
} from '@hooks/domain/workshop/controllers/useWorkshopWidgetOpening';
import {
  WorkshopGesturePlaygroundWidgetConfigSnapshot,
  WorkshopLexicalGravityWidgetConfigSnapshot,
  WorkshopStandingDirectiveSummary
} from '@messages';
import {
  builtInLexicalGravityLenses
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';

const gestureConfig: WorkshopGesturePlaygroundWidgetConfigSnapshot = {
  id: 'wc-gesture',
  widgetId: 'gesture-playground',
  revision: 1,
  createdAt: 1,
  draft: {
    targetPhrase: 'she smiled',
    writerInstructions: '',
    contextText: '',
    characterNotes: '',
    sourceReferences: [],
    dictionaryMarkdown: '',
    menu: [],
    selections: [],
    note: '',
    includeDictionaryInCommit: false
  }
};

const lens = builtInLexicalGravityLenses()[0];
const lexicalConfig: WorkshopLexicalGravityWidgetConfigSnapshot = {
  id: 'wc-lexical',
  widgetId: 'lexical-gravity',
  revision: 2,
  createdAt: 2,
  draft: {
    lensSlug: lens.slug,
    applicationMode: 'interpret',
    evidenceMode: 'blend',
    weight: 60,
    reach: 2,
    metaphorPull: true,
    resolvedLens: lens
  }
};

const activeLexical: WorkshopStandingDirectiveSummary = {
  id: 'pd-1',
  family: 'lexical-gravity',
  widgetId: 'lexical-gravity',
  widgetConfigId: lexicalConfig.id,
  revision: 2,
  updatedAt: 2,
  lensName: lens.name,
  applicationMode: 'interpret',
  evidenceMode: 'blend',
  weight: 60,
  reach: 2,
  metaphorPull: true
};

const emptyHost = (): WorkshopWidgetOpeningHost => ({
  widgetConfigData: null,
  widgetConfigResponseId: null,
  widgetConfigError: null,
  requestWidgetConfig: jest.fn(),
  clearWidgetConfigData: jest.fn()
});

describe('useWorkshopWidgetOpening', () => {
  it('owns fresh, recommendation, and close transitions', () => {
    const host = emptyHost();
    const onCloseGesturePlayground = jest.fn();
    const { result } = renderHook(() => useWorkshopWidgetOpening({
      host,
      standingDirectives: [],
      onError: jest.fn(),
      onCloseGesturePlayground,
      onCloseLexicalGravity: jest.fn()
    }));

    act(() => result.current.launchWidget('gesture-playground'));
    expect(result.current.gesturePlaygroundOpening).toEqual({ kind: 'new' });

    act(() => result.current.openWidgetRecommendation({
      widgetId: 'gesture-playground',
      seed: { targetPhrase: 'the cup shook' }
    }, 'Margot'));
    expect(result.current.gesturePlaygroundOpening).toEqual({
      kind: 'seed',
      seed: { targetPhrase: 'the cup shook' },
      personaLabel: 'Margot'
    });

    act(() => result.current.closeGesturePlayground());
    expect(result.current.gesturePlaygroundOpening).toBeNull();
    expect(host.clearWidgetConfigData).toHaveBeenCalledTimes(1);
    expect(onCloseGesturePlayground).toHaveBeenCalledTimes(1);
  });

  it('reopens only the exact requested config and preserves active Lexical edit identity', () => {
    let host = emptyHost();
    const { result, rerender } = renderHook(() => useWorkshopWidgetOpening({
      host,
      standingDirectives: [activeLexical],
      onError: jest.fn(),
      onCloseGesturePlayground: jest.fn(),
      onCloseLexicalGravity: jest.fn()
    }));

    act(() => result.current.launchWidget('lexical-gravity'));
    expect(host.requestWidgetConfig).toHaveBeenCalledWith(lexicalConfig.id);
    expect(result.current.pendingWidgetConfigId).toBe(lexicalConfig.id);

    host = {
      ...host,
      widgetConfigData: gestureConfig,
      widgetConfigResponseId: gestureConfig.id
    };
    rerender();
    expect(result.current.pendingWidgetConfigId).toBe(lexicalConfig.id);
    expect(result.current.gesturePlaygroundOpening).toBeNull();

    host = {
      ...host,
      widgetConfigData: lexicalConfig,
      widgetConfigResponseId: lexicalConfig.id
    };
    rerender();
    expect(result.current.pendingWidgetConfigId).toBeNull();
    expect(result.current.lexicalGravityOpening).toEqual({
      kind: 'edit',
      config: lexicalConfig
    });
  });

  it('settles an exact host error without opening another surface', () => {
    let host = emptyHost();
    const onError = jest.fn();
    const { result, rerender } = renderHook(() => useWorkshopWidgetOpening({
      host,
      standingDirectives: [],
      onError,
      onCloseGesturePlayground: jest.fn(),
      onCloseLexicalGravity: jest.fn()
    }));

    act(() => result.current.openWidgetConfig('wc-missing'));
    host = {
      ...host,
      widgetConfigResponseId: 'wc-missing',
      widgetConfigError: 'That widget configuration is no longer available.'
    };
    rerender();

    expect(onError).toHaveBeenCalledWith(
      'That widget configuration is no longer available.'
    );
    expect(result.current.pendingWidgetConfigId).toBeNull();
    expect(result.current.gesturePlaygroundOpening).toBeNull();
    expect(result.current.lexicalGravityOpening).toBeNull();
  });

  it('reports and settles an unsupported widget config instead of failing silently', () => {
    let host = emptyHost();
    const onError = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result, rerender } = renderHook(() => useWorkshopWidgetOpening({
      host,
      standingDirectives: [],
      onError,
      onCloseGesturePlayground: jest.fn(),
      onCloseLexicalGravity: jest.fn()
    }));

    act(() => result.current.openWidgetConfig('wc-prose'));
    host = {
      ...host,
      widgetConfigResponseId: 'wc-prose',
      widgetConfigData: {
        ...gestureConfig,
        id: 'wc-prose',
        widgetId: 'prose-controller'
      } as unknown as WorkshopWidgetOpeningHost['widgetConfigData']
    };
    rerender();

    expect(onError).toHaveBeenCalledWith(
      "prose-controller can't be opened in this version."
    );
    expect(warn).toHaveBeenCalledWith(
      "[Workshop] prose-controller can't be opened in this version."
    );
    expect(result.current.pendingWidgetConfigId).toBeNull();
    expect(host.clearWidgetConfigData).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
