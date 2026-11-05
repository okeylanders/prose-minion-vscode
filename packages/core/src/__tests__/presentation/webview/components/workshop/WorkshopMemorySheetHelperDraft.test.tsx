/**
 * @jest-environment jsdom
 */

/**
 * The helper's draft in WorkshopMemorySheet (ADR 2026-11-05 D5; Helper
 * Agent Slice 2): "Drafting…" as the title's and summary's placeholders,
 * never their values; Save as the draft's own rules leave it; one muted line
 * when it couldn't draft; nothing when no draft was asked. *Alice*.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { WorkshopMemorySheet } from '@components/workshop/memory/WorkshopMemorySheet';
import type { WorkshopMemorySheetState } from '@hooks/domain/workshop/useWorkshopProjectMemory';

const sheet = (overrides: Partial<WorkshopMemorySheetState> = {}): WorkshopMemorySheetState => ({
  mode: 'turn',
  turnId: 'turn-4-assistant-1008',
  draft: { title: '', kind: 'decision', summary: '', body: 'The grin stays after the Cat goes.', supersedes: [], pinned: false },
  replaces: [],
  loading: false,
  saving: false,
  sourceLabel: 'Jill',
  ...overrides
});

const renderSheet = (state: WorkshopMemorySheetState) =>
  render(<WorkshopMemorySheet sheet={state} onChange={jest.fn()} onDropReplaced={jest.fn()} onSubmit={jest.fn()} onClose={jest.fn()} />);

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe('WorkshopMemorySheet: the helper\'s draft', () => {
  it('shows "Drafting…" as placeholders while it drafts, never as values', () => {
    renderSheet(sheet({ helper: { requestId: 'r1', status: 'drafting', touched: [] } }));
    expect(field(/^Title/).placeholder).toBe('Drafting…');
    expect(field(/^Summary/).placeholder).toBe('Drafting…');
    expect(field(/^Title/).value).toBe('');
    expect(screen.queryByText('Couldn’t draft a title and summary.')).toBeNull();
  });

  it('keeps Save as the draft\'s own rules leave it while it drafts', () => {
    renderSheet(sheet({
      helper: { requestId: 'r1', status: 'drafting', touched: ['title', 'summary'] },
      draft: { title: 'Alice\'s title', kind: 'canon', summary: 'Alice wrote it.', body: 'The note.', supersedes: [], pinned: false }
    }));
    expect((screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('says once, quietly, that it couldn\'t draft, and drops the placeholders', () => {
    renderSheet(sheet({ helper: { requestId: 'r1', status: 'failed', touched: [] } }));
    const line = screen.getByText('Couldn’t draft a title and summary.');
    expect(line.getAttribute('role')).toBe('status');
    expect(line.className).toContain('pm-ws-memory-hint');
    expect(field(/^Title/).placeholder).toBe('');
  });

  it('shows neither once filled, nor on a sheet that asked for nothing', () => {
    const { unmount } = renderSheet(sheet({ helper: { requestId: 'r1', status: 'filled', touched: [] } }));
    expect(field(/^Title/).placeholder).toBe('');
    expect(screen.queryByText('Couldn’t draft a title and summary.')).toBeNull();
    unmount();
    renderSheet(sheet({ mode: 'card' }));
    expect(field(/^Title/).placeholder).toBe('');
  });
});
