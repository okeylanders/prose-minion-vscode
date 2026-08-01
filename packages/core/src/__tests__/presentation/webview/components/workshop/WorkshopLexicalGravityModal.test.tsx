/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  WorkshopLexicalGravityModal,
  WorkshopLexicalGravityOpening
} from '@components/workshop/WorkshopLexicalGravityModal';
import {
  builtInLexicalGravityLenses
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';
import { ModelOption } from '@shared/types';

const models: ModelOption[] = [{
  id: 'anthropic/claude-sonnet-5',
  label: 'Claude Sonnet 5',
  provider: 'Anthropic'
}];

const renderModal = (
  opening: WorkshopLexicalGravityOpening = { kind: 'new' },
  overrides: Partial<React.ComponentProps<typeof WorkshopLexicalGravityModal>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopLexicalGravityModal> = {
    open: true,
    opening,
    lenses: builtInLexicalGravityLenses(),
    storagePath: 'prose-minion/lenses',
    previewResult: null,
    lensCandidates: null,
    lensesSaved: null,
    actionResult: null,
    onRequestLenses: jest.fn(),
    onPreview: jest.fn(),
    onBuildLens: jest.fn(),
    onSaveLenses: jest.fn(),
    onApply: jest.fn(),
    onClearTransientResults: jest.fn(),
    onConsumeActionResult: jest.fn(),
    widgetModelOptions: models,
    selectedWidgetModel: models[0].id,
    onWidgetModelChange: jest.fn(),
    onOpenWidgetModelBrowser: jest.fn(),
    onClose: jest.fn(),
    ...overrides
  };
  const view = render(<WorkshopLexicalGravityModal {...props} />);
  return { props, view };
};

describe('WorkshopLexicalGravityModal', () => {
  afterEach(cleanup);

  it('ports the approved four-value surface and keeps deterministic play model-free', () => {
    const { props } = renderModal();

    expect(screen.getByText(/passage-scoped directive/)).toBeTruthy();
    expect((screen.getByPlaceholderText('Look up or invent a lens…') as HTMLInputElement).value)
      .toBe('');
    expect((screen.getByRole('button', { name: /Build lens/ }) as HTMLButtonElement).disabled)
      .toBe(true);
    const buildHeading = screen.getByText('Build New Lens');
    const existingHeading = screen.getByText('Select From Existing');
    expect(buildHeading.compareDocumentPosition(existingHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(screen.getByRole('button', { name: /Photography/ }).getAttribute('class'))
      .toContain('is-selected');
    expect(screen.getByRole('button', { name: /Photography/ }).getAttribute('title'))
      .toBe('Photography');
    expect(screen.getByText('2°')).toBeTruthy();
    expect(screen.queryByText('3°')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Music/ }));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '40' } });
    fireEvent.change(screen.getAllByRole('slider')[1], { target: { value: '3' } });
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Gradient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Substitutions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clichés' }));

    expect(props.onPreview).not.toHaveBeenCalled();
    expect(props.onBuildLens).not.toHaveBeenCalled();
    expect(screen.getByText('music to my ears')).toBeTruthy();
    expect(screen.getByText('What the room is told')).toBeTruthy();
    expect(screen.getByText(/<prose-directive id="pd-preview"/)).toBeTruthy();
  });

  it('spends only on explicit preview and applies the exact edited four-value draft', () => {
    const { props, view } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Music/ }));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '40' } });
    fireEvent.change(screen.getAllByRole('slider')[1], { target: { value: '3' } });
    fireEvent.click(screen.getByRole('switch'));

    fireEvent.click(screen.getByRole('button', { name: 'Preview the Effect' }));
    expect(props.onPreview).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        lensSlug: 'music', weight: 40, reach: 3, metaphorPull: true
      })
    );

    const token = (props.onPreview as jest.Mock).mock.calls[0][0] as string;
    view.rerender(<WorkshopLexicalGravityModal
      {...props}
      previewResult={{
        token,
        ok: true,
        preview: { configKey: 'music|40|3|1', text: 'A resonant preview.' }
      }}
    />);

    expect(view.container.querySelector('.pm-ws-lg-preview')?.textContent).toContain(
      builtInLexicalGravityLenses().find(({ slug }) => slug === 'music')!.sample
    );
    expect(view.container.querySelector('.pm-ws-lg-preview')?.textContent)
      .toContain('A resonant preview.');
    const preview = view.container.querySelector('.pm-ws-lg-preview')!;
    const previewAgain = screen.getByRole('button', { name: 'Preview again' });
    const disclosure = view.container.querySelector('.pm-ws-lg-directive-disclosure')!;
    expect(preview.compareDocumentPosition(previewAgain) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(previewAgain.compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Install on passage' }));
    expect(props.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        lensSlug: 'music', weight: 40, reach: 3, metaphorPull: true
      }),
      undefined
    );
  });

  it('sends one or more selected generated lenses through one project-save boundary', () => {
    const { props, view } = renderModal();
    const input = screen.getByPlaceholderText('Look up or invent a lens…');
    fireEvent.change(input, { target: { value: 'falconry' } });
    fireEvent.click(screen.getByRole('button', { name: /Build lens/ }));
    const token = (props.onBuildLens as jest.Mock).mock.calls[0][0] as string;
    const candidate = {
      candidateId: 'falconry-1',
      lens: {
        ...builtInLexicalGravityLenses()[0],
        slug: 'falconry',
        name: 'Falconry',
        source: 'project' as const,
        variant: 'The hunt'
      }
    };
    const secondCandidate = {
      candidateId: 'falconry-2',
      lens: {
        ...candidate.lens,
        variant: 'The mews'
      }
    };
    const thirdCandidate = {
      candidateId: 'falconry-3',
      lens: {
        ...candidate.lens,
        variant: 'The stoop'
      }
    };

    view.rerender(<WorkshopLexicalGravityModal
      {...props}
      lensCandidates={{
        token,
        query: 'falconry',
        ok: true,
        candidates: [candidate, secondCandidate, thirdCandidate]
      }}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Falconry — The hunt/ }));
    fireEvent.click(screen.getByRole('button', { name: /Falconry — The stoop/ }));
    expect(screen.getByText('2 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 selected lenses' }));

    expect(props.onSaveLenses).toHaveBeenCalledWith(
      token,
      'falconry',
      ['falconry-1', 'falconry-3']
    );

    view.rerender(<WorkshopLexicalGravityModal
      {...props}
      lensCandidates={{
        token,
        query: 'falconry',
        ok: true,
        candidates: [candidate, secondCandidate, thirdCandidate]
      }}
      lensesSaved={{
        token,
        ok: true,
        lenses: [{ ...candidate.lens, slug: 'falconry' }],
        candidateIds: ['falconry-1', 'falconry-3'],
        remainingCandidateIds: ['falconry-2']
      }}
    />);

    expect(view.container.querySelector('.pm-ws-lg-options')?.textContent)
      .not.toContain('Falconry — The hunt');
    expect(view.container.querySelector('.pm-ws-lg-options')?.textContent)
      .not.toContain('Falconry — The stoop');
    expect(screen.getByTitle('Falconry — The hunt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Falconry — The mews/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 selected lens' }));
    expect(props.onSaveLenses).toHaveBeenLastCalledWith(
      token,
      'falconry',
      ['falconry-2']
    );

    view.rerender(<WorkshopLexicalGravityModal
      {...props}
      lensCandidates={{
        token,
        query: 'falconry',
        ok: true,
        candidates: [candidate, secondCandidate, thirdCandidate]
      }}
      lensesSaved={{
        token,
        ok: true,
        lenses: [{ ...secondCandidate.lens, slug: 'falconry-the-mews' }],
        candidateIds: ['falconry-2'],
        remainingCandidateIds: []
      }}
    />);

    expect(view.container.querySelector('.pm-ws-lg-options')).toBeNull();
  });

  it('uses the concise Apply action while editing the live directive', () => {
    const lens = builtInLexicalGravityLenses()[0];
    renderModal({
      kind: 'edit',
      config: {
        id: 'wc-1',
        widgetId: 'lexical-gravity',
        revision: 1,
        directiveId: 'pd-1',
        createdAt: 1,
        draft: {
          lensSlug: lens.slug,
          weight: 60,
          reach: 2,
          metaphorPull: false,
          resolvedLens: lens
        }
      }
    });

    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
    expect(screen.queryByText(/only the commit pays/i)).toBeNull();
  });

  it('explains when a generated subject already exists without spending another call', () => {
    const { props, view } = renderModal();
    const input = screen.getByPlaceholderText('Look up or invent a lens…');
    fireEvent.change(input, { target: { value: 'photography' } });
    fireEvent.click(screen.getByRole('button', { name: /Build lens/ }));
    const token = (props.onBuildLens as jest.Mock).mock.calls[0][0] as string;

    view.rerender(<WorkshopLexicalGravityModal
      {...props}
      lensCandidates={{
        token,
        query: 'photography',
        ok: true,
        existingLens: builtInLexicalGravityLenses()[0]
      }}
    />);

    expect(screen.getByText(/already a built-in lens/)).toBeTruthy();
  });

  it('shows lens-build failures immediately beside the Build lens action', () => {
    const { props, view } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('Look up or invent a lens…'), {
      target: { value: 'falconry' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Build lens/ }));
    const token = (props.onBuildLens as jest.Mock).mock.calls[0][0] as string;

    view.rerender(<WorkshopLexicalGravityModal
      {...props}
      lensCandidates={{
        token,
        query: 'falconry',
        ok: false,
        error: 'The model returned unusable lexical fields. Try building the lens again.'
      }}
    />);

    const lookup = view.container.querySelector('.pm-ws-lg-lookup');
    const alert = screen.getByRole('alert');
    expect(lookup?.nextElementSibling).toBe(alert);
    expect(alert.textContent).toContain('unusable lexical fields');
    expect((screen.getByRole('button', { name: /Build lens/ }) as HTMLButtonElement).disabled)
      .toBe(false);
  });
});
