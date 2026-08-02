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
}, {
  id: 'google/gemini-3.6-flash',
  label: 'Gemini 3.6 Flash',
  provider: 'Google'
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
    expect((screen.getByPlaceholderText('Try “code vs. prose”…') as HTMLInputElement).value)
      .toBe('');
    expect((screen.getByRole('button', { name: /Build lens/ }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(screen.getByRole('tab', { name: 'Create New' }).getAttribute('aria-selected'))
      .toBe('true');
    expect(screen.queryByRole('button', { name: /Photography/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Library/ }));
    expect(screen.getByRole('button', { name: /Photography/ }).getAttribute('class'))
      .toContain('is-selected');
    expect(screen.getByRole('button', { name: /Photography/ }).getAttribute('title'))
      .toBe('Photography');
    expect(screen.getByText('2°')).toBeTruthy();
    expect(screen.queryByText('3°')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Music/ }));
    fireEvent.change(screen.getByRole('slider', { name: /Weight/ }), { target: { value: '40' } });
    fireEvent.change(screen.getByRole('slider', { name: /Reach/ }), { target: { value: '3' } });
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
    fireEvent.click(screen.getByRole('tab', { name: /Library/ }));
    fireEvent.click(screen.getByRole('button', { name: /Music/ }));
    fireEvent.change(screen.getByRole('slider', { name: /Weight/ }), { target: { value: '40' } });
    fireEvent.change(screen.getByRole('slider', { name: /Reach/ }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('switch'));

    fireEvent.click(screen.getByRole('button', { name: 'Preview the Effect' }));
    expect(screen.getByRole('status', { name: 'Generating After preview' })).toBeTruthy();
    expect(view.container.querySelectorAll('.pm-ws-lg-preview-skeleton i')).toHaveLength(3);
    expect(props.onPreview).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        lensSlug: 'music', weight: 40, reach: 3, metaphorPull: true
      }),
      builtInLexicalGravityLenses().find(({ slug }) => slug === 'music')!.sample
    );

    const token = (props.onPreview as jest.Mock).mock.calls[0][0] as string;
    view.rerender(<WorkshopLexicalGravityModal
      {...props}
      previewResult={{
        token,
        ok: true,
        preview: {
          configKey: 'music|40|3|1',
          sourceText: builtInLexicalGravityLenses().find(({ slug }) => slug === 'music')!.sample,
          text: 'A *resonant* preview.'
        }
      }}
    />);

    expect(screen.queryByRole('status', { name: 'Generating After preview' })).toBeNull();
    expect(view.container.querySelector('.pm-ws-lg-preview')?.textContent).toContain(
      builtInLexicalGravityLenses().find(({ slug }) => slug === 'music')!.sample
    );
    expect(view.container.querySelector('.pm-ws-lg-preview')?.textContent)
      .toContain('A resonant preview.');
    const after = view.container.querySelector('.pm-ws-lg-preview-result')!;
    expect(after.firstElementChild?.textContent).toBe('After');
    expect(after.children[1]?.classList).toContain('markdown-content');
    expect(after.querySelector('em')?.textContent).toBe('resonant');
    expect(after.textContent).not.toContain('“');
    const preview = view.container.querySelector('.pm-ws-lg-preview')!;
    const weight = screen.getByRole('slider', { name: /Weight/ }).closest('label')!;
    const previewAgain = screen.getByRole('button', { name: 'Preview again' });
    const disclosure = view.container.querySelector('.pm-ws-lg-directive-disclosure')!;
    expect(preview.compareDocumentPosition(weight) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(weight.compareDocumentPosition(previewAgain) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
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

  it('quietly lets the generated Before become persistent local preview prose', () => {
    const { props, view } = renderModal();
    const generatedSource = builtInLexicalGravityLenses()[0].sample;

    fireEvent.click(screen.getByRole('button', { name: 'Preview the Effect' }));
    expect(props.onPreview).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ lensSlug: 'photography' }),
      generatedSource
    );
    const firstToken = (props.onPreview as jest.Mock).mock.calls[0][0] as string;
    view.rerender(<WorkshopLexicalGravityModal
      {...props}
      previewResult={{
        token: firstToken,
        ok: true,
        preview: {
          configKey: 'photography|60|2|0',
          sourceText: generatedSource,
          text: 'The generated after prose.'
        }
      }}
    />);

    const customSource = 'Elias watched rain gather in the empty birdbath.';
    const before = screen.getByRole('textbox', { name: 'Before preview prose' });
    expect((before as HTMLTextAreaElement).value).toBe(generatedSource);
    Object.defineProperty(before, 'scrollHeight', { configurable: true, value: 180 });
    fireEvent.change(before, { target: { value: customSource } });
    expect((before as HTMLTextAreaElement).value).toBe(customSource);
    expect((before as HTMLTextAreaElement).style.height).toBe('180px');
    expect((before as HTMLTextAreaElement).style.overflowY).toBe('hidden');
    expect(screen.queryByText(/generated after prose/)).toBeNull();

    Object.defineProperty(before, 'scrollHeight', { configurable: true, value: 400 });
    fireEvent.input(before);
    expect((before as HTMLTextAreaElement).style.height).toBe('240px');
    expect((before as HTMLTextAreaElement).style.overflowY).toBe('auto');

    fireEvent.change(screen.getByRole('slider', { name: /Weight/ }), {
      target: { value: '80' }
    });
    expect((screen.getByRole('textbox', {
      name: 'Before preview prose'
    }) as HTMLTextAreaElement).value).toBe(customSource);

    fireEvent.click(screen.getByRole('button', { name: 'Preview the Effect' }));
    expect(props.onPreview).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ weight: 80, preview: undefined }),
      customSource
    );
  });

  it('keeps the Before source and clears only the stale After when the model changes', () => {
    const lens = builtInLexicalGravityLenses()[0];
    const sourceText = 'Elias watched rain gather in the empty birdbath.';
    const { props } = renderModal({
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
          resolvedLens: lens,
          preview: {
            configKey: 'photography|60|2|0',
            sourceText,
            text: 'The old model framed the rain.'
          }
        }
      }
    });

    fireEvent.click(screen.getByRole('button', {
      name: /Browse widget model options/
    }));
    fireEvent.click(screen.getByRole('button', { name: /Gemini 3\.6 Flash/ }));

    expect(props.onWidgetModelChange).toHaveBeenCalledWith('google/gemini-3.6-flash');
    expect(screen.queryByText(/old model framed/)).toBeNull();
    expect((screen.getByRole('textbox', {
      name: 'Before preview prose'
    }) as HTMLTextAreaElement).value).toBe(sourceText);

    fireEvent.click(screen.getByRole('button', { name: 'Preview the Effect' }));
    expect(props.onPreview).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ preview: undefined }),
      sourceText
    );
  });

  it('sends one or more selected generated lenses through one project-save boundary', () => {
    const { props, view } = renderModal();
    const input = screen.getByPlaceholderText('Try “code vs. prose”…');
    fireEvent.change(input, { target: { value: 'falconry' } });
    fireEvent.click(screen.getByRole('button', { name: /Build lens/ }));
    expect(screen.getByRole('status', { name: 'Drafting three lens options' })).toBeTruthy();
    expect(view.container.querySelectorAll('.pm-ws-lg-option-skeleton')).toHaveLength(3);
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
    expect(screen.queryByRole('status', { name: 'Drafting three lens options' })).toBeNull();
    expect(view.container.querySelectorAll('.pm-ws-lg-option-skeleton')).toHaveLength(0);
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
        lenses: [{ ...candidate.lens, slug: 'falconry', originQuery: 'falconry' }],
        candidateIds: ['falconry-1', 'falconry-3'],
        remainingCandidateIds: ['falconry-2']
      }}
    />);

    expect(view.container.querySelector('.pm-ws-lg-options')?.textContent)
      .not.toContain('Falconry — The hunt');
    expect(view.container.querySelector('.pm-ws-lg-options')?.textContent)
      .not.toContain('Falconry — The stoop');
    fireEvent.click(screen.getByRole('tab', { name: /Library/ }));
    expect(screen.getByTitle('Falconry — The hunt')).toBeTruthy();
    expect(screen.getByTitle('Falconry — The hunt')
      .querySelector('.pm-ws-lg-lens-search-term')?.textContent).toBe('falconry');
    expect(screen.getByTitle('Falconry — The hunt').querySelector('svg')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Create New' }));
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
        lenses: [{
          ...secondCandidate.lens,
          slug: 'falconry-the-mews',
          originQuery: 'falconry'
        }],
        candidateIds: ['falconry-2'],
        remainingCandidateIds: []
      }}
    />);

    expect(view.container.querySelector('.pm-ws-lg-options')).toBeNull();
  });

  it('infers the original search term for project lenses saved before query metadata', () => {
    const source = builtInLexicalGravityLenses()[0];
    renderModal({ kind: 'new' }, {
      lenses: [{
        ...source,
        source: 'project',
        slug: 'code-vs-prose',
        name: 'Compile Time',
        variant: 'Precision & Execution'
      }, {
        ...source,
        source: 'project',
        slug: 'code-vs-prose-mutability-control-flow',
        name: 'Variable State',
        variant: 'Mutability & Control Flow'
      }]
    });

    fireEvent.click(screen.getByRole('tab', { name: /Library/ }));

    expect(screen.getAllByText('code vs prose')).toHaveLength(2);
    expect(screen.queryByText('project lens')).toBeNull();
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
    const input = screen.getByPlaceholderText('Try “code vs. prose”…');
    fireEvent.change(input, { target: { value: 'photography' } });
    fireEvent.click(screen.getByRole('button', { name: /Build lens/ }));
    expect(screen.getByRole('status', { name: 'Drafting three lens options' })).toBeTruthy();
    expect(view.container.querySelectorAll('.pm-ws-lg-option-skeleton')).toHaveLength(3);
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
    fireEvent.change(screen.getByPlaceholderText('Try “code vs. prose”…'), {
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
    expect(screen.queryByRole('status', { name: 'Drafting three lens options' })).toBeNull();
    expect(view.container.querySelectorAll('.pm-ws-lg-option-skeleton')).toHaveLength(0);
    expect(lookup?.nextElementSibling).toBe(alert);
    expect(alert.textContent).toContain('unusable lexical fields');
    expect((screen.getByRole('button', { name: /Build lens/ }) as HTMLButtonElement).disabled)
      .toBe(false);
  });
});
