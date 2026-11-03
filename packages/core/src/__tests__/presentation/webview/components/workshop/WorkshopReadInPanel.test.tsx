/** @jest-environment jsdom */

/**
 * WorkshopReadInPanel (ADR 2026-11-03 D2, D3): what the chat target fetched,
 * named for that participant. Rows with an open action are buttons that say
 * what they open; the rest are plain items; superseded rows are tagged.
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  WorkshopReadInPanel,
  WorkshopReadInPanelProps
} from '@components/workshop/WorkshopReadInPanel';
import type { ContextSourceEntry } from '@shared/types';
import { participantIdentityColorIndex } from '@utils/contextBudget';
import { formatReadInTime } from '@utils/workshop/contextSources';

const row = (overrides: Partial<ContextSourceEntry>): ContextSourceEntry => ({
  kind: 'resource',
  origin: 'host',
  label: 'characters/rabbit.md',
  configuredResource: { group: 'characters', path: 'characters/rabbit.md' },
  sizeChars: 240,
  isEstimate: true,
  deliveredAt: Date.UTC(2026, 10, 3, 15, 14),
  ...overrides
});

const renderPanel = (entries: ContextSourceEntry[], overrides: Partial<WorkshopReadInPanelProps> = {}) => {
  const props: WorkshopReadInPanelProps = {
    entries,
    participantIdentity: 'jill',
    participantLabel: 'Jill',
    onOpenReader: jest.fn(),
    ...overrides
  };
  render(<WorkshopReadInPanel {...props} />);
  return props;
};

const region = () => screen.getByRole('region', { name: 'Read in by Jill' });

describe('WorkshopReadInPanel', () => {
  it('names the participant in its heading, in that participant\'s color', () => {
    renderPanel([]);
    expect(within(region()).getByText('Read in')).toBeTruthy();
    const by = within(region()).getByText('by Jill');
    const dot = by.querySelector('.pm-context-budget-dot');
    expect(dot?.className).toContain(`pm-context-budget-dot-${participantIdentityColorIndex('jill')}`);
  });

  it('shows one muted line when nothing has been read', () => {
    renderPanel([], { participantLabel: 'Continuity', participantIdentity: 'tool:continuity' });
    expect(screen.getByText('When Continuity reads a file or runs a tool, it shows here.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders each row with its label, kind and delivery time, in order', () => {
    const rabbit = row({});
    const report = row({
      kind: 'tool-evidence',
      origin: 'tool',
      label: 'Continuity report',
      configuredResource: undefined,
      deliveredAt: rabbit.deliveredAt + 60_000
    });
    renderPanel([rabbit, report]);

    const items = within(region()).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('characters/rabbit.md').className).toContain('pm-ws-readin-label-path');
    expect(within(items[0]).getByText(`resource · ${formatReadInTime(rabbit.deliveredAt)}`)).toBeTruthy();
    expect(within(items[1]).getByText('Continuity report').className).not.toContain('pm-ws-readin-label-path');
    expect(within(items[1]).getByText(`tool report · ${formatReadInTime(report.deliveredAt)}`)).toBeTruthy();
  });

  it('makes a reader row a button that names its action, and opens it', () => {
    const rabbit = row({});
    const props = renderPanel([rabbit]);
    const button = screen.getByRole('button', { name: 'Open characters/rabbit.md in the reader' });
    const meta = document.getElementById(button.getAttribute('aria-describedby')!);
    expect(meta?.textContent).toBe(`resource · ${formatReadInTime(rabbit.deliveredAt)}`);
    fireEvent.click(button);
    expect(props.onOpenReader).toHaveBeenCalledWith(rabbit);
  });

  it('leaves rows without an action as plain list items', () => {
    renderPanel([
      row({ kind: 'dictionary', label: 'gloaming', configuredResource: undefined }),
      row({ kind: 'transcript', label: 'Chapter 6 pacing pass', configuredResource: undefined }),
      row({ kind: 'resource', label: 'unconfigured.md', configuredResource: undefined })
    ]);
    expect(within(region()).getAllByRole('listitem')).toHaveLength(3);
    expect(within(region()).queryByRole('button')).toBeNull();
  });

  it('keeps a superseded row, dashed and tagged, and says so when it opens', () => {
    renderPanel([row({ stale: true }), row({ deliveredAt: Date.UTC(2026, 10, 3, 15, 20) })]);
    const [earlier, later] = within(region()).getAllByRole('button');
    expect(earlier.getAttribute('aria-label')).toBe('Open characters/rabbit.md in the reader, an earlier read');
    expect(earlier.className).toContain('pm-ws-readin-row-stale');
    expect(within(earlier).getByText('superseded')).toBeTruthy();
    expect(later.className).not.toContain('pm-ws-readin-row-stale');
    expect(within(later).queryByText('superseded')).toBeNull();
  });

  it('tags a superseded plain row too', () => {
    renderPanel([row({ kind: 'dictionary', label: 'gloaming', configuredResource: undefined, stale: true })]);
    const [item] = within(region()).getAllByRole('listitem');
    expect(item.className).toContain('pm-ws-readin-row-stale');
    expect(within(item).getByText('superseded')).toBeTruthy();
  });
});
