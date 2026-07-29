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
    contextText: 'He set the mug down.',
    characterNotes: 'Mara — guarded.',
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
    expect((screen.getByRole('button', { name: /Generate directions/ }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('posts a generate request once a phrase exists', () => {
    const { props } = renderModal({ kind: 'new' });
    fireEvent.change(screen.getByPlaceholderText('e.g. she smiled'), {
      target: { value: 'she smiled' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate directions/ }));
    expect(props.onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      widgetId: 'gesture-playground',
      targetPhrase: 'she smiled',
      token: expect.any(String)
    }));
  });

  it('seeds editable fields from a persona recommendation', () => {
    renderModal({
      kind: 'seed',
      seed: { targetPhrase: 'she smiled', characterNotes: 'Mara — guarded.' },
      personaLabel: 'Jill'
    });
    expect(screen.getByText(/Recommended and prefilled by Jill/)).toBeTruthy();
    expect((screen.getByPlaceholderText('e.g. she smiled') as HTMLInputElement).value)
      .toBe('she smiled');
    expect((screen.getByPlaceholderText('Who is this person in this beat?') as HTMLTextAreaElement).value)
      .toBe('Mara — guarded.');
  });

  it('re-hydrates the exact prior draft on clone and commits as a new turn', () => {
    const { props } = renderModal({ kind: 'clone', config });
    expect(screen.getByText(/Re-opened from a committed turn/)).toBeTruthy();
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
