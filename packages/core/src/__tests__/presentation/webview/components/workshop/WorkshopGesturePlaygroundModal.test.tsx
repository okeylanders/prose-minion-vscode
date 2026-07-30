/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  WorkshopGesturePlaygroundModal,
  WorkshopGestureOpening
} from '@components/workshop/WorkshopGesturePlaygroundModal';
import { WorkshopWidgetConfigSnapshot } from '@messages';

const menu = [
  { heading: 'The eyes', options: ['Her gaze snagged a half-second too long'] },
  { heading: 'Hands & body', options: ['She turned her mug a quarter-turn, then back'] }
];

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
    dictionaryMarkdown: '# Gesture Dictionary\n\n## The Beat\n\nA private deflection.',
    menu,
    selections: ['She turned her mug a quarter-turn, then back'],
    note: 'keep it small'
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
    actionResult: null,
    onGenerate: jest.fn(),
    onCancelGenerate: jest.fn(),
    onCommit: jest.fn(),
    onConsumeActionResult: jest.fn(),
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
    expect(screen.getByText('1 selected ·')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Commit as new turn' }));
    expect(props.onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPhrase: 'she smiled',
        writerInstructions: 'Keep the reaction private and avoid eye language.',
        dictionaryMarkdown: expect.stringContaining('A private deflection.'),
        selections: ['She turned her mug a quarter-turn, then back'],
        note: 'keep it small'
      }),
      'wc-1'
    );
  });

  it('surfaces a failed commit and keeps the draft editable', () => {
    const { props, view } = renderModal({ kind: 'clone', config });
    fireEvent.click(screen.getByRole('button', { name: 'Commit as new turn' }));
    view.rerender(
      <WorkshopGesturePlaygroundModal
        {...props}
        actionResult={{
          action: 'commit',
          widgetId: 'gesture-playground',
          ok: false,
          message: 'The room did not accept the commit.'
        }}
      />
    );
    expect(props.onConsumeActionResult).toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('did not accept');
    expect((screen.getByRole('button', { name: 'Commit as new turn' }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('closes only when the host confirms the commit landed', () => {
    const { props, view } = renderModal({ kind: 'clone', config });
    fireEvent.click(screen.getByRole('button', { name: 'Commit as new turn' }));
    expect(props.onClose).not.toHaveBeenCalled();
    view.rerender(
      <WorkshopGesturePlaygroundModal
        {...props}
        actionResult={{
          action: 'commit',
          widgetId: 'gesture-playground',
          ok: true,
          widgetConfigId: 'wc-2',
          turnId: 'turn-9-user-1'
        }}
      />
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
