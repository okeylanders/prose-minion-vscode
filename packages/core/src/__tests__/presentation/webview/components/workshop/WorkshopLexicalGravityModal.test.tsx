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
    expect(screen.getByRole('button', { name: /Photography/ }).getAttribute('class'))
      .toContain('is-selected');
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
  });

  it('spends only on explicit preview and applies the exact edited four-value draft', () => {
    const { props, view } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Music/ }));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '40' } });
    fireEvent.change(screen.getAllByRole('slider')[1], { target: { value: '3' } });
    fireEvent.click(screen.getByRole('switch'));

    fireEvent.click(screen.getByRole('button', { name: 'Preview the pull' }));
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
  });
});
