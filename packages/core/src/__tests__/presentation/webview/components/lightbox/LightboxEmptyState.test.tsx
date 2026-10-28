/** @jest-environment jsdom */

/**
 * The Lightbox with nothing boarded names its ways in (launch entry points,
 * 2026-10-20): Choose from project… (the shared project picker, as the
 * Workshop's excerpt has it), Open File in Lightbox from a right-click, and
 * Open Selection in Lightbox. The rail's source card and the board's welcome
 * say the same thing.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LightboxBoardMain, LightboxBoardMainProps } from '@components/lightbox/LightboxBoardMain';
import { LightboxSourcePanel } from '@components/lightbox/LightboxSourcePanel';

const COMMANDS = 'pick Open File in Lightbox, or select a passage and run Open Selection in Lightbox.';

const squash = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

describe('the Lightbox empty state', () => {
  it('names every entry point in the source card, with the commands in bold', () => {
    const onChooseFromProject = jest.fn();
    const { container } = render(
      <LightboxSourcePanel source={null} rereading={false} onChooseFromProject={onChooseFromProject} onRefresh={jest.fn()} />
    );

    const empty = container.querySelector('.pm-lb-source-empty');
    expect(squash(empty?.textContent)).toBe(
      `No source yet. Choose a file from your project, right-click a chapter and ${COMMANDS}`
    );
    expect(Array.from(empty?.querySelectorAll('b') ?? []).map((bold) => bold.textContent)).toEqual([
      'Open File in Lightbox',
      'Open Selection in Lightbox'
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Choose from project…' }));
    expect(onChooseFromProject).toHaveBeenCalledTimes(1);
  });

  it('says the same in the board\'s welcome, with the same button', () => {
    const onChooseFromProject = jest.fn();
    const props = {
      board: null,
      refusal: null,
      filter: 'all',
      lensesOff: [],
      focus: { bind: () => ({}), focusedItem: null, litColumns: new Set<number>() },
      runLine: null,
      onFilter: jest.fn(),
      onChooseFromProject,
      onDismissRefusal: jest.fn(),
      onRun: jest.fn(),
      onStop: jest.fn()
    } as unknown as LightboxBoardMainProps;
    const { container } = render(<LightboxBoardMain {...props} />);

    expect(screen.getByRole('heading', { name: 'Hold a chapter up to the light.' })).not.toBeNull();
    expect(squash(container.querySelector('.pm-lb-sub')?.textContent)).toBe(
      `Choose a chapter from your project, right-click one and ${COMMANDS} ` +
        'The counted board appears at once and costs nothing: no model is asked.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose from project…' }));
    expect(onChooseFromProject).toHaveBeenCalledTimes(1);
  });
});
