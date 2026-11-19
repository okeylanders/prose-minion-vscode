/**
 * @jest-environment jsdom
 */

/**
 * The Settings sheet (ADR 2026-11-19 D23, D25): the button, the one line
 * when every group matches nothing, each proposed group's current and
 * proposed patterns with counts and examples, a workspace-set group shown
 * and not offered, "Applies to all your projects", and Apply's lines.
 * *Alice*.
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ContextPathsSuggestionSheet } from '@components/settings/ContextPathsSuggestionSheet';
import type { UseContextPathsSuggestionReturn } from '@hooks/domain/useContextPathsSuggestion';
import type { ContextPathProposalView } from '@shared/types';
import { CONTEXT_PATH_EVERY_GROUP_EMPTY } from '@shared/constants/contextPathSuggestionWords';

const VIEW: ContextPathProposalView = {
  groups: [
    {
      group: 'characters',
      level: 'user',
      current: { patterns: ['characters/**/*'], count: 0, examples: [] },
      proposed: {
        kept: [{ pattern: 'Cast/**/*', count: 3 }],
        dropped: [{ pattern: 'People/**/*', reason: 'unmatched' }, { pattern: '/Cast/**', reason: 'absolute' }],
        count: 3,
        examples: ['Cast/Alice.md', 'Cast/Mad Hatter.md'],
        shared: { count: 1, examples: [{ path: 'Wonderland/Queen of Hearts.md', groups: ['locations'] }] }
      },
      offer: { offered: true }
    },
    {
      group: 'locations',
      level: 'workspace',
      current: { patterns: ['locations/**/*'], count: null, examples: [] },
      proposed: { kept: [{ pattern: 'Wonderland/**/*', count: 3 }], dropped: [], count: 3, examples: [], shared: { count: 0, examples: [] } },
      offer: { offered: false, reason: 'workspace-set' }
    },
    { group: 'themes', level: 'default', current: { patterns: [], count: 0, examples: [] }, offer: { offered: false, reason: 'not-proposed' } }
  ]
};

function hook(overrides: Partial<UseContextPathsSuggestionReturn> = {}): UseContextPathsSuggestionReturn {
  return {
    phase: 'idle',
    ticked: [],
    everyGroupEmpty: false,
    suggest: jest.fn(),
    toggleGroup: jest.fn(),
    apply: jest.fn(),
    dismiss: jest.fn(),
    requestStatus: jest.fn(),
    handleSuggestion: jest.fn(),
    handleApplied: jest.fn(),
    handleStatus: jest.fn(),
    persistedState: {},
    ...overrides
  };
}

describe('ContextPathsSuggestionSheet', () => {
  afterEach(cleanup);

  it('offers the button, asks for the status when shown, and points at it only when every group matches nothing', () => {
    const quiet = hook();
    const { rerender } = render(<ContextPathsSuggestionSheet suggestion={quiet} />);
    expect(quiet.requestStatus).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(CONTEXT_PATH_EVERY_GROUP_EMPTY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest from my folders' }));
    expect(quiet.suggest).toHaveBeenCalled();
    rerender(<ContextPathsSuggestionSheet suggestion={hook({ everyGroupEmpty: true })} />);
    expect(screen.getAllByText(CONTEXT_PATH_EVERY_GROUP_EMPTY)).toHaveLength(1);
  });

  it('reviews each proposed group: patterns, counts, examples, shared files, and what was left out', () => {
    render(<ContextPathsSuggestionSheet suggestion={hook({ phase: 'review', view: VIEW, ticked: ['characters'] })} />);
    expect(screen.getByText('Applies to all your projects.')).toBeTruthy();
    expect(screen.getByText('Cast/**/*')).toBeTruthy();
    expect(screen.getByText('Cast/Alice.md')).toBeTruthy();
    expect(screen.getByText('Wonderland/Queen of Hearts.md')).toBeTruthy();
    expect(screen.getByText('matches no file')).toBeTruthy();
    expect(screen.getByText('starts at the top of the disk')).toBeTruthy();
    expect(screen.getByText('couldn\'t count')).toBeTruthy();
    // A group not proposed is not listed; it is counted as keeping its patterns.
    expect(screen.queryByText('Themes')).toBeNull();
    expect(screen.getByText('One group wasn\'t proposed and keeps its patterns.')).toBeTruthy();
  });

  it('shows a workspace-set group with its checkbox off and disabled, and says why', () => {
    const suggestion = hook({ phase: 'review', view: VIEW, ticked: ['characters'] });
    render(<ContextPathsSuggestionSheet suggestion={suggestion} />);
    const [characters, locations] = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(characters.checked).toBe(true);
    expect(locations.checked).toBe(false);
    expect(locations.disabled).toBe(true);
    expect(screen.getByText('Set for this workspace in its settings file, so Apply can\'t change it here.')).toBeTruthy();
    fireEvent.click(characters);
    expect(suggestion.toggleGroup).toHaveBeenCalledWith('characters');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(suggestion.apply).toHaveBeenCalled();
  });

  it('says a suggestion made from a partial scan is partial (PR #288 P2)', () => {
    render(<ContextPathsSuggestionSheet suggestion={hook({ phase: 'review', view: { ...VIEW, scan: { folders: 4, sent: 4, stopped: false, unreadable: 2 } }, ticked: [] })} />);
    expect(screen.getByText(/2 folders couldn't be read, so this suggestion was made from the rest/)).toBeTruthy();
  });

  it('disables Apply with nothing ticked', () => {
    render(<ContextPathsSuggestionSheet suggestion={hook({ phase: 'review', view: VIEW, ticked: [] })} />);
    expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('says what Apply wrote and why a group was left', () => {
    render(<ContextPathsSuggestionSheet suggestion={hook({
      phase: 'applied',
      applied: [{ group: 'characters', outcome: 'applied' }, { group: 'chapters', outcome: 'left', reason: 'changed' }]
    })} />);
    expect(screen.getByText('Applied to all your projects: Characters.')).toBeTruthy();
    expect(screen.getByText('Draft Chapters & Outlines changed since this was suggested; it was left as it is.')).toBeTruthy();
  });
});
