/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  WorkshopGesturePlaygroundModal,
  WorkshopGestureOpening
} from '@components/workshop/WorkshopGesturePlaygroundModal';
import {
  WorkshopContextAttachmentSnapshot,
  WorkshopExcerptSnapshot,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import { ModelOption } from '@shared/types';

const menu = [
  { heading: 'The eyes', options: ['Her gaze snagged a half-second too long'] },
  { heading: 'Hands & body', options: ['She turned her mug a quarter-turn, then back'] }
];

const widgetModels: ModelOption[] = [
  {
    id: 'anthropic/claude-sonnet-5',
    label: 'Claude Sonnet 5',
    provider: 'Anthropic'
  },
  {
    id: 'openai/gpt-5.4',
    label: 'GPT-5.4',
    provider: 'OpenAI'
  }
];

const activeExcerpt: WorkshopExcerptSnapshot = {
  text: 'He set the mug down. She smiled without looking up.',
  version: 2,
  source: { kind: 'file', relativePath: 'Drafts/chapter-five.md' },
  pinnedAt: 1
};

const contextAttachment: WorkshopContextAttachmentSnapshot = {
  id: 'ctx-1',
  kind: 'file',
  origin: 'writer',
  label: 'character-mara.md',
  words: 480,
  relativePath: 'characters/character-mara.md',
  addedAt: 1
};

const config: WorkshopWidgetConfigSnapshot = {
  id: 'wc-1',
  widgetId: 'gesture-playground',
  revision: 1,
  createdAt: 1,
  draft: {
    targetPhrase: 'she smiled',
    writerInstructions: 'Keep the reaction private and avoid eye language.',
    contextText: 'He set the mug down.',
    characterNotes: 'Mara — guarded.',
    sourceReferences: [],
    dictionaryMarkdown: '# Gesture Dictionary\n\n## The Beat\n\nA private deflection.',
    menu,
    selections: ['She turned her mug a quarter-turn, then back'],
    note: 'keep it small',
    includeDictionaryInCommit: true
  }
};

const renderModal = (
  opening: WorkshopGestureOpening,
  overrides: Partial<React.ComponentProps<typeof WorkshopGesturePlaygroundModal>> = {}
) => {
  const props = {
    open: true,
    opening,
    menuResult: null,
    generationProgress: null,
    activeExcerpt: null,
    contextAttachments: [],
    onGenerate: jest.fn(),
    onCancelGenerate: jest.fn(),
    onCommit: jest.fn(),
    onCopyDictionary: jest.fn(),
    onSaveDictionary: jest.fn(),
    widgetModelOptions: widgetModels,
    selectedWidgetModel: 'anthropic/claude-sonnet-5',
    onWidgetModelChange: jest.fn(),
    onOpenWidgetModelBrowser: jest.fn(),
    onClose: jest.fn(),
    ...overrides
  };
  const view = render(<WorkshopGesturePlaygroundModal {...props} />);
  return { props, view };
};

describe('WorkshopGesturePlaygroundModal', () => {
  afterEach(cleanup);

  it('opens fresh with an empty draft and a disabled commit', () => {
    renderModal({ kind: 'new' });
    expect((screen.getByPlaceholderText('e.g. she smiled') as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement).disabled)
      .toBe(true);
    // No phrase yet → generate stays disabled too.
    expect((screen.getByRole('button', { name: /Generate alternatives/ }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('posts a generate request once a phrase exists', () => {
    const { props } = renderModal({ kind: 'new' });
    fireEvent.change(screen.getByPlaceholderText('e.g. she smiled'), {
      target: { value: 'she smiled' }
    });
    fireEvent.change(
      screen.getByPlaceholderText('What should the alternatives preserve, avoid, or emphasize?'),
      { target: { value: 'Keep it understated.' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /Generate alternatives/ }));
    expect(props.onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      widgetId: 'gesture-playground',
      targetPhrase: 'she smiled',
      writerInstructions: 'Keep it understated.',
      token: expect.any(String)
    }));
  });

  it('seeds editable fields from a persona recommendation', () => {
    const { props } = renderModal({
      kind: 'seed',
      seed: {
        targetPhrase: 'she smiled',
        writerInstructions:
          'Preserve the deflection, avoid stock smile language, and explore object displacement.',
        contextText:
          'Mara turned the cooling mug between her palms. “That is one version of it.” She smiled without looking up.',
        characterNotes:
          'Mara is cornered but refuses to grant the room a clean reaction. Her restraint is deliberate; the mug gives that pressure somewhere physical to go.'
      },
      personaLabel: 'Jill'
    });
    expect(screen.getByText(/Recommended and prefilled by Jill/)).toBeTruthy();
    expect((screen.getByPlaceholderText('e.g. she smiled') as HTMLInputElement).value)
      .toBe('she smiled');
    expect((
      screen.getByPlaceholderText(
        'What should the alternatives preserve, avoid, or emphasize?'
      ) as HTMLTextAreaElement
    ).value).toContain('Preserve the deflection');
    expect((
      screen.getByPlaceholderText('The sentences around the phrase.') as HTMLTextAreaElement
    ).value).toContain('cooling mug');
    expect((screen.getByPlaceholderText('Who is this person in this beat?') as HTMLTextAreaElement).value)
      .toContain('refuses to grant the room');

    fireEvent.click(screen.getByRole('button', { name: /Generate alternatives/ }));
    expect(props.onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      targetPhrase: 'she smiled',
      writerInstructions: expect.stringContaining('object displacement'),
      contextText: expect.stringContaining('That is one version'),
      characterNotes: expect.stringContaining('Her restraint is deliberate')
    }));
  });

  it('adds selected host sources to generate and commit while surfacing stale references', () => {
    const { props, view } = renderModal(
      {
        kind: 'seed',
        seed: {
          targetPhrase: 'she smiled',
          writerInstructions: 'Keep the reaction private.',
          contextText: 'She looked down at the mug.',
          characterNotes: 'Mara refuses to perform relief.',
          sourceReferences: [
            { kind: 'active-excerpt' },
            { kind: 'context-attachment', attachmentId: 'ctx-missing' }
          ]
        },
        personaLabel: 'Jill'
      },
      {
        activeExcerpt,
        contextAttachments: [contextAttachment]
      }
    );

    const activeSource = screen.getByRole('checkbox', {
      name: /Active excerpt — chapter-five/
    }) as HTMLInputElement;
    const availableContext = screen.getByRole('checkbox', {
      name: /Context — character-mara.md/
    }) as HTMLInputElement;
    const unavailableContext = screen.getByRole('checkbox', {
      name: /Context attachment ctx-missing — unavailable/
    }) as HTMLInputElement;
    const generateButton = screen.getByRole(
      'button',
      { name: /Generate alternatives/ }
    ) as HTMLButtonElement;

    expect(activeSource.checked).toBe(true);
    expect(availableContext.checked).toBe(false);
    expect(unavailableContext.checked).toBe(true);
    expect(generateButton.disabled).toBe(true);

    fireEvent.click(unavailableContext);
    expect(screen.queryByText(/ctx-missing — unavailable/)).toBeNull();
    fireEvent.click(availableContext);
    expect(generateButton.disabled).toBe(false);

    fireEvent.click(generateButton);
    expect(props.onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      sourceReferences: [
        { kind: 'active-excerpt' },
        { kind: 'context-attachment', attachmentId: 'ctx-1' }
      ]
    }));
    const token = (props.onGenerate as jest.Mock).mock.calls[0][0].token as string;

    view.rerender(
      <WorkshopGesturePlaygroundModal
        {...props}
        menuResult={{
          widgetId: 'gesture-playground',
          token,
          mode: 'full',
          ok: true,
          menu,
          dictionaryMarkdown: '# Gesture Dictionary\n\nSource-grounded scan.'
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', {
      name: /Her gaze snagged a half-second too long/
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Commit to thread' }));
    expect(props.onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceReferences: [
          { kind: 'active-excerpt' },
          { kind: 'context-attachment', attachmentId: 'ctx-1' }
        ]
      }),
      undefined
    );
  });

  it('caps source material at eight while always allowing deselection', () => {
    const attachments: WorkshopContextAttachmentSnapshot[] = Array.from(
      { length: 9 },
      (_, index) => ({
        ...contextAttachment,
        id: `ctx-${index + 1}`,
        label: `source-${index + 1}.md`
      })
    );
    renderModal(
      { kind: 'new' },
      { contextAttachments: attachments }
    );
    const sourceCheckboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];

    sourceCheckboxes.slice(0, 8).forEach((checkbox) => fireEvent.click(checkbox));
    expect(screen.getByText('8/8 sources selected · maximum reached')).toBeTruthy();
    expect(sourceCheckboxes[8].disabled).toBe(true);
    expect(sourceCheckboxes[8].checked).toBe(false);

    fireEvent.click(sourceCheckboxes[0]);
    expect(sourceCheckboxes[8].disabled).toBe(false);
    fireEvent.click(sourceCheckboxes[8]);
    expect(sourceCheckboxes[8].checked).toBe(true);
    expect(screen.getByText('8/8 sources selected · maximum reached')).toBeTruthy();
  });

  it('shows indeterminate stage and streamed token progress for the active request', () => {
    const { props, view } = renderModal({ kind: 'new' });
    fireEvent.change(screen.getByPlaceholderText('e.g. she smiled'), {
      target: { value: 'she smiled' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate alternatives/ }));
    const token = (props.onGenerate as jest.Mock).mock.calls[0][0].token as string;

    view.rerender(
      <WorkshopGesturePlaygroundModal
        {...props}
        generationProgress={{
          widgetId: 'gesture-playground',
          token,
          phase: 'streaming',
          stage: 'dictionary',
          outputCharacters: 9_380,
          estimatedOutputTokens: 2_345,
          outputTokenLimit: 50_000
        }}
      />
    );

    expect(screen.getByRole('status').textContent)
      .toContain('Building the gesture dictionary');
    expect(screen.getByRole('status').textContent)
      .toContain('~2,345 estimated visible tokens');
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.hasAttribute('aria-valuenow')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel generation' }));
    expect(props.onCancelGenerate).toHaveBeenCalledTimes(1);
  });

  it('renders a successful menu before a collapsed, sanitized Gesture Dictionary', () => {
    const { props, view } = renderModal({ kind: 'new' });
    fireEvent.change(screen.getByPlaceholderText('e.g. she smiled'), {
      target: { value: 'she smiled' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate alternatives/ }));
    const token = (props.onGenerate as jest.Mock).mock.calls[0][0].token as string;

    view.rerender(
      <WorkshopGesturePlaygroundModal
        {...props}
        menuResult={{
          widgetId: 'gesture-playground',
          token,
          mode: 'full',
          ok: true,
          menu,
          dictionaryMarkdown: '# Gesture Dictionary\n\n<script>window.bad = true</script>\n\nUseful scan.'
        }}
      />
    );

    const menuElement = view.container.querySelector('.pm-ws-gesture-menu');
    const dictionaryElement = view.container.querySelector('.pm-ws-gesture-dictionary');
    expect(menuElement).toBeTruthy();
    expect(dictionaryElement).toBeTruthy();
    expect(
      menuElement!.compareDocumentPosition(dictionaryElement!)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect((dictionaryElement as HTMLDetailsElement).open).toBe(false);
    expect(dictionaryElement?.textContent).toContain('Useful scan.');
    expect(dictionaryElement?.querySelector('script')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Gesture Dictionary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Gesture Dictionary' }));
    expect(props.onCopyDictionary).toHaveBeenCalledWith(
      expect.stringContaining('Useful scan.')
    );
    expect(props.onSaveDictionary).toHaveBeenCalledWith(
      expect.stringContaining('Useful scan.')
    );
    expect((screen.getByRole('checkbox', {
      name: /Include the full Gesture Dictionary for the room/
    }) as HTMLInputElement).checked).toBe(false);
  });

  it('requests more gestures from the on-screen result and keeps existing selections', () => {
    const { props, view } = renderModal({ kind: 'clone', config });
    fireEvent.click(screen.getByRole('button', {
      name: /She turned her mug a quarter-turn, then back/
    }));
    fireEvent.click(screen.getByRole('button', {
      name: /She turned her mug a quarter-turn, then back/
    }));
    expect(screen.getByRole('button', { name: 'More gestures' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Regenerate all' })).toBeTruthy();
    const menuElement = view.container.querySelector('.pm-ws-gesture-menu')!;
    const generationActions = view.container.querySelector(
      '.pm-ws-gesture-generation-actions'
    )!;
    expect(
      menuElement.compareDocumentPosition(generationActions)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More gestures' }));
    const payload = (props.onGenerate as jest.Mock).mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      mode: 'more',
      dictionaryMarkdown: config.draft.dictionaryMarkdown,
      menu
    }));

    const additions = menu.map((group, index) => ({
      ...group,
      options: [...group.options, `A new physical consequence ${index + 1}`]
    }));
    view.rerender(
      <WorkshopGesturePlaygroundModal
        {...props}
        menuResult={{
          widgetId: 'gesture-playground',
          token: payload.token,
          mode: 'more',
          ok: true,
          dictionaryMarkdown: config.draft.dictionaryMarkdown,
          menu: additions
        }}
      />
    );

    expect((screen.getByRole('button', {
      name: /She turned her mug a quarter-turn, then back/
    }) as HTMLButtonElement).className).toContain('selected');
    expect(screen.getByRole('button', { name: /A new physical consequence 1/ })).toBeTruthy();
  });

  it('keeps a recovered dictionary inspectable but removes an unusable menu and blocks commit', () => {
    const { props, view } = renderModal({ kind: 'new' });
    fireEvent.change(screen.getByPlaceholderText('e.g. she smiled'), {
      target: { value: 'she smiled' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate alternatives/ }));
    const token = (props.onGenerate as jest.Mock).mock.calls[0][0].token as string;

    view.rerender(
      <WorkshopGesturePlaygroundModal
        {...props}
        menuResult={{
          widgetId: 'gesture-playground',
          token,
          mode: 'full',
          ok: false,
          dictionaryMarkdown: '# Gesture Dictionary\n\nThe useful scan survived.',
          menuError: 'The alternatives menu was malformed.'
        }}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('menu was malformed');
    expect(screen.getByText('The useful scan survived.')).toBeTruthy();
    expect(view.container.querySelector('.pm-ws-gesture-menu')).toBeNull();
    expect((screen.getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('locks generation inputs in flight and invalidates artifacts when an input later changes', () => {
    const { props, view } = renderModal({ kind: 'new' });
    const targetInput = screen.getByPlaceholderText('e.g. she smiled') as HTMLInputElement;
    fireEvent.change(targetInput, { target: { value: 'she smiled' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate alternatives/ }));
    const token = (props.onGenerate as jest.Mock).mock.calls[0][0].token as string;

    expect(targetInput.disabled).toBe(true);
    expect((
      screen.getByPlaceholderText('The sentences around the phrase.') as HTMLTextAreaElement
    ).disabled).toBe(true);

    view.rerender(
      <WorkshopGesturePlaygroundModal
        {...props}
        menuResult={{
          widgetId: 'gesture-playground',
          token,
          mode: 'full',
          ok: true,
          menu,
          dictionaryMarkdown: '# Gesture Dictionary\n\nGenerated for the original inputs.'
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', {
      name: /Her gaze snagged a half-second too long/
    }));
    expect((screen.getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement).disabled)
      .toBe(false);

    fireEvent.change(screen.getByPlaceholderText('The sentences around the phrase.'), {
      target: { value: 'A different surrounding beat.' }
    });

    expect(view.container.querySelector('.pm-ws-gesture-menu')).toBeNull();
    expect(view.container.querySelector('.pm-ws-gesture-dictionary')).toBeNull();
    expect((screen.getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('uses a fixed sheet shell with the editable content in the scrolling center', () => {
    const { view } = renderModal({ kind: 'clone', config });
    const dialog = screen.getByRole('dialog');
    const header = view.container.querySelector('.pm-ws-gesture-head');
    const body = view.container.querySelector('.pm-ws-gesture-body');
    const footer = view.container.querySelector('.pm-ws-gesture-foot');

    expect(dialog.classList.contains('pm-ws-modal-sheet')).toBe(true);
    expect(header?.contains(screen.getByText('Gesture Playground'))).toBe(true);
    expect(body?.contains(screen.getByPlaceholderText('e.g. she smiled'))).toBe(true);
    expect(footer?.contains(screen.getByRole('button', { name: 'Commit as new turn' }))).toBe(true);
    expect(screen.getByRole('button', { name: 'Close Gesture Playground' })).toBeTruthy();
  });

  it('shows the widget model in the footer and keeps the draft open when its browser dismisses', () => {
    const { props, view } = renderModal({ kind: 'clone', config });
    const footer = view.container.querySelector('.pm-ws-gesture-foot');
    const modelTrigger = screen.getByRole('button', {
      name: /Browse widget model options. Current model: Claude Sonnet 5/
    });

    expect(footer?.contains(modelTrigger)).toBe(true);
    expect(screen.getByText('· 1 selected')).toBeTruthy();

    fireEvent.click(modelTrigger);
    expect(props.onOpenWidgetModelBrowser).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Widget Model browser' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Widget Model browser' })).toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(modelTrigger);
    fireEvent.click(screen.getByRole('button', { name: /GPT-5.4/ }));
    expect(props.onWidgetModelChange).toHaveBeenCalledWith('openai/gpt-5.4');
    expect(screen.queryByRole('dialog', { name: 'Widget Model browser' })).toBeNull();
    expect(view.container.querySelector('.pm-ws-gesture-menu')).toBeNull();
    expect(view.container.querySelector('.pm-ws-gesture-dictionary')).toBeNull();
  });

  it('re-hydrates the exact prior draft on clone and commits as a new turn', () => {
    const { props } = renderModal({ kind: 'clone', config });
    expect(screen.getByText(/Re-opened from a committed turn/)).toBeTruthy();
    expect((
      screen.getByPlaceholderText(
        'What should the alternatives preserve, avoid, or emphasize?'
      ) as HTMLTextAreaElement
    ).value).toBe('Keep the reaction private and avoid eye language.');
    expect(screen.getByText('A private deflection.')).toBeTruthy();
    // The persisted menu and selection are restored, not a dead summary.
    expect(screen.getByText('The eyes')).toBeTruthy();
    const kept = screen.getByRole('button', {
      name: /She turned her mug a quarter-turn, then back/
    });
    expect(kept.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('· 1 selected')).toBeTruthy();
    const dictionarySharing = screen.getByRole('checkbox', {
      name: /Include the full Gesture Dictionary for the room/
    }) as HTMLInputElement;
    expect(dictionarySharing.checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Commit as new turn' }));
    expect(props.onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPhrase: 'she smiled',
        writerInstructions: 'Keep the reaction private and avoid eye language.',
        dictionaryMarkdown: expect.stringContaining('A private deflection.'),
        selections: ['She turned her mug a quarter-turn, then back'],
        note: 'keep it small',
        includeDictionaryInCommit: true
      }),
      'wc-1'
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes immediately after dispatching a valid commit', () => {
    const { props } = renderModal({ kind: 'clone', config });
    fireEvent.click(screen.getByRole('button', { name: 'Commit as new turn' }));
    expect(props.onCommit).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
