/** @jest-environment jsdom */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ContextBudget } from '@components/shared/ContextBudget';
import { ContextBudgetSnapshot } from '@shared/types';

const snapshot: ContextBudgetSnapshot = {
  modelId: 'model/a',
  contextTokens: 42_000,
  promptTokens: 38_000,
  completionTokens: 4_000,
  peakPromptTokensThisTurn: 41_000,
  requestedMaxOutputTokens: 10_000,
  callsThisTurn: 5,
  turnProcessedTokens: 172_000,
  contextCompression: 'not-applied',
  measuredAt: 1
};

describe('ContextBudget', () => {
  it('renders retained context separately from last-request, processed-turn, cumulative, and compression details', () => {
    render(<ContextBudget
      label="Jill context"
      snapshot={snapshot}
      modelOptions={[
        { id: 'model/b', label: 'Newly selected Model B', contextLength: 1_000_000, liveDataAvailable: true },
        { id: 'model/a', label: 'Measured Model A', contextLength: 200_000, liveDataAvailable: true }
      ]}
      cumulativeProcessedTokens={429_000}
    />);

    // The compact row splits numbers and percent; the accessible sentence
    // still carries the full locked phrasing in one place.
    expect(screen.getByLabelText(/Jill context\. Context 42K \/ 190K · 22%/)).toBeTruthy();
    expect(screen.getByText('22%')).toBeTruthy();
    expect(screen.getByLabelText(/Jill context.*5 calls this turn.*172,000 tokens processed/i)).toBeTruthy();
    expect(screen.getByText(/keeps\s+its own conversation; switching targets never resets it/)).toBeTruthy();
    expect(screen.getByText('5 calls · 172,000 processed')).toBeTruthy();
    expect(screen.getByText('429,000 processed')).toBeTruthy();
    expect(screen.getByText('42,000')).toBeTruthy();
    expect(screen.getByText('38,000')).toBeTruthy();
    expect(screen.getByText('4,000')).toBeTruthy();
    expect(screen.getByText('Not applied')).toBeTruthy();
    expect(screen.getByText('Measured Model A')).toBeTruthy();
    expect(screen.queryByText('Newly selected Model B')).toBeNull();
  });

  it('renders empty and unavailable states without a hardcoded context window', () => {
    const { rerender } = render(<ContextBudget
      label="Quinn context"
      modelOptions={[]}
      cumulativeProcessedTokens={0}
    />);
    expect(screen.getByText(/Not measured yet — updates after the first reply/)).toBeTruthy();

    rerender(<ContextBudget
      label="Quinn context"
      snapshot={snapshot}
      modelOptions={[{
        id: 'model/a', label: 'Offline Model A', contextLength: 200_000, liveDataAvailable: false
      }]}
      cumulativeProcessedTokens={0}
    />);
    expect(screen.getByText(/Window unavailable/)).toBeTruthy();
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
  });

  it('renders the In-context manifest with parenthetical kinds, attribution, and stale dimming (Phase 7)', () => {
    render(<ContextBudget
      label="Jill context"
      snapshot={snapshot}
      modelOptions={[{ id: 'model/a', label: 'Model A', contextLength: 200_000, liveDataAvailable: true }]}
      cumulativeProcessedTokens={429_000}
      requesterLabel="Jill"
      sources={[
        { kind: 'pin', origin: 'writer', label: 'chapters/ch-04.md', sizeChars: 5200, isEstimate: true, excerptVersion: 1, stale: true, deliveredAt: 1 },
        { kind: 'pin', origin: 'writer', label: 'chapters/ch-04.md', sizeChars: 5300, isEstimate: true, excerptVersion: 2, deliveredAt: 2 },
        { kind: 'attachment', origin: 'writer', label: 'Mara note…', sizeChars: 120, isEstimate: true, deliveredAt: 3 },
        { kind: 'message-attachment', origin: 'writer', label: 'raven.md', sizeChars: 900, isEstimate: true, deliveredAt: 4 },
        { kind: 'resource', origin: 'host', label: 'Characters/raven.md', configuredResource: { group: 'characters', path: 'Characters/raven.md' }, sizeChars: 460, promptTokensDelta: 120, isEstimate: false, deliveredAt: 5 },
        { kind: 'tool-evidence', origin: 'host', label: 'Dialogue & Beats', sizeChars: 8000, promptTokensDelta: 2100, isEstimate: true, deliveredAt: 6 }
      ]}
    />);

    expect(screen.getByText('In context')).toBeTruthy();
    const rows = document.querySelectorAll('.pm-context-source');
    expect(rows).toHaveLength(6);

    // Stale prior pin dims and carries its tag; the live pin does not.
    expect(rows[0].className).toContain('pm-context-source-stale');
    expect(rows[0].textContent).toContain('STALE');
    expect(rows[1].className).not.toContain('pm-context-source-stale');
    expect(rows[0].textContent).toContain('v1');
    expect(rows[1].textContent).toContain('v2');

    // Parenthetical kinds keep the four material classes distinguishable.
    expect(rows[1].textContent).toContain('(pinned excerpt)');
    expect(rows[2].textContent).toContain('(standing context)');
    expect(rows[3].textContent).toContain('(message attachment)');
    expect(rows[4].textContent).toContain('(project resource)');
    expect(rows[5].textContent).toContain('(tool report)');

    // Origin attribution: writer rows vs host-requested rows.
    expect(rows[2].textContent).toContain('added by you');
    expect(rows[4].textContent).toContain('requested by Jill');

    // Measured cost renders as tokens; unmeasured rows show honest char estimates.
    expect(rows[4].textContent).toContain('120 tokens');
    expect(rows[3].textContent).toContain('~900 chars');
  });
});
