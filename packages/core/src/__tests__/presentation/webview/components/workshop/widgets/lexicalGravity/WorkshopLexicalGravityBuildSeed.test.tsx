/**
 * @jest-environment jsdom
 */

/**
 * A Build lens subject handed over from the Lightbox (ADR 2026-10-19 D11):
 * the Workshop checks the seed and composes the subject (host), the widget
 * opening controller opens Build lens with it once and never over an open
 * sheet, and the sheet is prefilled but builds nothing until the writer
 * presses Build.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import {
  MessageType,
  WorkshopLexicalGravityBuildSeed,
  WorkshopLexicalGravityBuildSeedPayload
} from '@messages';
import { MessageRouter } from '@handlers/MessageRouter';
import {
  WorkshopLexicalGravityHandler
} from '@/application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler';
import {
  composeLexicalGravityBuildSubject,
  validateLexicalGravityBuildSeed
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityBuildSeed';
import {
  builtInLexicalGravityLenses
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import {
  WorkshopLexicalGravityModal
} from '@components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityModal';
import {
  useWorkshopWidgetOpening,
  WorkshopWidgetOpeningHost
} from '@hooks/domain/workshop/controllers/useWorkshopWidgetOpening';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const seed: WorkshopLexicalGravityBuildSeed = {
  origin: 'lightbox',
  field: 'Telescope',
  metaphor: 'The body as an instrument that folds.',
  terms: [
    { term: 'shutting up', count: 2 },
    { term: 'like a telescope', count: 2 },
    { term: 'like telescopes', count: 1 }
  ],
  sourceLabel: 'Drafts/alice-1.md'
};

describe('the Build lens seed (host)', () => {
  it('composes the subject from the field and as many whole terms as fit the build query', () => {
    expect(composeLexicalGravityBuildSubject(seed)).toBe('Telescope: shutting up, like a telescope, like telescopes');
    expect(composeLexicalGravityBuildSubject(seed, 30)).toBe('Telescope: shutting up');
    expect(composeLexicalGravityBuildSubject({ field: 'Telescope', terms: [{ term: 'telescope', count: 3 }] }))
      .toBe('Telescope');
    const long = { field: 'Deep water', terms: Array.from({ length: 12 }, (_, index) => ({ term: `term number ${index}`, count: 1 })) };
    expect(composeLexicalGravityBuildSubject(long).length)
      .toBeLessThanOrEqual(PROMPT_BUDGETS.workshopWidgets.lexicalBuildQueryCharacters);
  });

  it('checks the seed exactly, naming a field that breaks it', () => {
    expect(validateLexicalGravityBuildSeed({ ...seed, field: '  Telescope ' }).field).toBe('Telescope');
    expect(() => validateLexicalGravityBuildSeed({ ...seed, extra: 1 })).toThrow('unknown field extra');
    expect(() => validateLexicalGravityBuildSeed({ ...seed, terms: [{ term: 'x', count: 0 }] })).toThrow('seed.terms[0].count');
    expect(() => validateLexicalGravityBuildSeed({ ...seed, field: 'x'.repeat(61) })).toThrow('seed.field');
  });

  it('opens Build lens through the direct route, posting the seed and its subject and calling no model', async () => {
    const model = { buildLenses: jest.fn(), preview: jest.fn() };
    const repository = { findForQuery: jest.fn() };
    const posted: Array<{ type: string; payload: unknown }> = [];
    const log = { appendLine: jest.fn() };
    const handler = new WorkshopLexicalGravityHandler(
      model as never,
      repository as never,
      async (message) => {
        posted.push(message as never);
      },
      log as never
    );
    const router = new MessageRouter();
    const mutations = jest.fn();
    handler.registerRoutes(router, mutations as never);
    expect(mutations.mock.calls.map(([type]) => type)).not.toContain(MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD);

    await router.route({
      type: MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
      source: 'extension.lightbox',
      payload: { seed, deliveryId: 'lexical-build-seed-7-1' },
      timestamp: 1
    } as never);
    // The seed keeps the provider's delivery id, which the webview's answer names (PR #150 F-03).
    expect(posted).toEqual([{
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED,
      source: 'extension.workshop.lexical-gravity',
      timestamp: expect.any(Number),
      payload: { seedId: 'lexical-build-seed-7-1', seed, subject: composeLexicalGravityBuildSubject(seed) }
    }]);
    expect(model.buildLenses).not.toHaveBeenCalled();
    expect(repository.findForQuery).not.toHaveBeenCalled();
    // The log counts; it never carries the field or its terms.
    const logged = log.appendLine.mock.calls.map(([line]) => String(line)).join('\n');
    expect(logged).not.toMatch(/Telescope|telescope|shutting/);

    await router.route({
      type: MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
      source: 'extension.lightbox',
      payload: { seed: { ...seed, origin: 'elsewhere' }, deliveryId: 'lexical-build-seed-7-2' },
      timestamp: 2
    } as never);
    await router.route({
      type: MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
      source: 'extension.lightbox',
      payload: { seed },
      timestamp: 3
    } as never);
    expect(posted).toHaveLength(1);
  });
});

describe('opening Build lens from a seed', () => {
  const payload: WorkshopLexicalGravityBuildSeedPayload = {
    seedId: 'lexical-build-seed-1',
    seed,
    subject: composeLexicalGravityBuildSubject(seed)
  };
  const emptyHost = (): WorkshopWidgetOpeningHost => ({
    widgetConfigData: null,
    widgetConfigResponseId: null,
    widgetConfigError: null,
    restoredWidgetConfigId: null,
    requestWidgetConfig: jest.fn(),
    clearWidgetConfigData: jest.fn(),
    consumeRestoredWidgetConfig: jest.fn()
  });

  it('opens the sheet once with the seed, refuses over a sheet that is already open, and answers the host either way', () => {
    let delivered: WorkshopLexicalGravityBuildSeedPayload | null = payload;
    const answer = jest.fn((given: { seedId: string }) => {
      if (delivered?.seedId === given.seedId) {
        delivered = null;
      }
    });
    const onError = jest.fn();
    const { result, rerender } = renderHook(() => useWorkshopWidgetOpening({
      host: emptyHost(),
      lexicalGravityBuild: { lexicalGravityBuildSeed: delivered, answerLexicalGravityBuildSeed: answer },
      standingDirectives: [],
      onError,
      onCloseGesturePlayground: jest.fn(),
      onCloseLexicalGravity: jest.fn(),
      onCloseCreativeVariations: jest.fn(),
      onCloseShowVsTell: jest.fn()
    }));
    expect(result.current.lexicalGravityOpening).toEqual({ kind: 'build', seed: payload });
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenLastCalledWith({ seedId: 'lexical-build-seed-1', opened: true });

    // A second handoff while the sheet is open is refused, not swapped in, and the host hears why.
    delivered = { ...payload, seedId: 'lexical-build-seed-2' };
    rerender();
    expect(onError).toHaveBeenCalledWith('A field from the Lightbox did not open over your open sheet. Close it, then build the field from the Lightbox again.');
    expect(answer).toHaveBeenLastCalledWith({ seedId: 'lexical-build-seed-2', opened: false, reason: 'busy' });
    expect(answer).toHaveBeenCalledTimes(2);
    expect(result.current.lexicalGravityOpening).toEqual({ kind: 'build', seed: payload });
    act(() => result.current.closeLexicalGravity());
    expect(result.current.lexicalGravityOpening).toBeNull();
  });

  afterEach(cleanup);

  it('prefills Build lens with the subject and shows the seed, building nothing until Build is pressed', () => {
    const onBuildLens = jest.fn();
    render(
      <WorkshopLexicalGravityModal
        open
        opening={{ kind: 'build', seed: payload }}
        lenses={builtInLexicalGravityLenses()}
        incompatibleResources={[]}
        storagePath="prose-minion/lenses"
        previewResult={null}
        lensCandidates={null}
        lensesSaved={null}
        actionResult={null}
        onRequestLenses={jest.fn()}
        onPreview={jest.fn()}
        onBuildLens={onBuildLens}
        onSaveLenses={jest.fn()}
        onApply={jest.fn()}
        onClearTransientResults={jest.fn()}
        onConsumeActionResult={jest.fn()}
        widgetModelOptions={[]}
        selectedWidgetModel=""
        onWidgetModelChange={jest.fn()}
        onOpenWidgetModelBrowser={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const subject = screen.getByPlaceholderText('Try “code vs. prose”…') as HTMLInputElement;
    expect(subject.value).toBe('Telescope: shutting up, like a telescope, like telescopes');
    expect(screen.getByRole('tab', { name: /Create New/ }).getAttribute('aria-selected')).toBe('true');
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('From the Lightbox: the borrowed field “Telescope”');
    expect(note.textContent).toContain('shutting up ×2');
    expect(note.textContent).toContain('Nothing is built, saved or installed until you press Build lens.');
    expect(onBuildLens).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Build lens/ }));
    expect(onBuildLens).toHaveBeenCalledWith(expect.any(String), subject.value, undefined);
  });
});
