/** @jest-environment jsdom */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), {
    setOptions: jest.fn()
  });
  return { marked };
});

import { WorkshopThread } from '@components/workshop/WorkshopThread';
import { WorkshopTurn } from '@messages';

const report = (id: string, toolId: 'prose' | 'dialogue'): WorkshopTurn => ({
  id,
  role: 'assistant',
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'tool_report',
  toolId,
  toolLabel: toolId === 'prose' ? 'Prose' : 'Dialogue & Beats',
  reportTurnId: id,
  content: `${toolId} report`,
  timestamp: 0,
  excerptVersion: 1
});

describe('WorkshopThread sidecar-owned affordances', () => {
  const noop = jest.fn();

  it('offers quick actions and direct chat only on the report owning the live sidecar', () => {
    render(
      <WorkshopThread
        turns={[report('report-1', 'prose')]}
        toolSidecars={[{
          toolId: 'prose',
          hasConversation: true,
          latestReportTurnId: 'report-1',
          availableForDirectFollowUp: true,
          activeTarget: false
        }]}
        currentExcerptVersion={1}
        onQuickAction={noop}
        onTalkDirectly={noop}
        onCopy={noop}
        onSave={noop}
      />
    );

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Rewrite for flow' }).disabled)
      .toBe(false);
    expect(screen.getByRole('button', { name: 'Talk directly to Prose' })).toBeTruthy();
  });

  it('archives stale report actions after the same tool sidecar is replaced', () => {
    render(
      <WorkshopThread
        turns={[report('report-old', 'prose'), report('report-new', 'prose')]}
        toolSidecars={[{
          toolId: 'prose',
          hasConversation: true,
          latestReportTurnId: 'report-new',
          availableForDirectFollowUp: true,
          activeTarget: false
        }]}
        currentExcerptVersion={1}
        onQuickAction={noop}
        onTalkDirectly={noop}
        onCopy={noop}
        onSave={noop}
      />
    );

    const rewriteButtons = screen.getAllByRole<HTMLButtonElement>('button', { name: 'Rewrite for flow' });
    expect(rewriteButtons[0].disabled).toBe(true);
    expect(rewriteButtons[1].disabled).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Talk directly to Prose' })).toHaveLength(1);
  });

  it('never grows a quick-action bar on a direct-tool chat reply (PR #72 #8)', () => {
    const directReply: WorkshopTurn = {
      id: 'direct-reply',
      role: 'assistant',
      kind: 'message',
      participant: 'tool',
      artifact: 'direct_tool_response',
      toolId: 'prose',
      toolLabel: 'Prose',
      reportTurnId: 'report-1',
      content: 'Direct answer while talking to the tool.',
      timestamp: 1,
      excerptVersion: 1
    };

    render(
      <WorkshopThread
        turns={[report('report-1', 'prose'), directReply]}
        toolSidecars={[{
          toolId: 'prose',
          hasConversation: true,
          latestReportTurnId: 'report-1',
          availableForDirectFollowUp: true,
          activeTarget: true
        }]}
        currentExcerptVersion={1}
        onQuickAction={noop}
        onTalkDirectly={noop}
        onCopy={noop}
        onSave={noop}
      />
    );

    // The reply owns the live sidecar (same reportTurnId), so only the
    // artifact gate keeps report-only quick actions off it.
    expect(screen.getAllByRole('button', { name: 'Rewrite for flow' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Talk directly to Prose' })).toHaveLength(1);
  });

  it('gives persona synthesis copy/save provenance but never tool quick actions', () => {
    const personaTurn: WorkshopTurn = {
      id: 'persona-turn',
      role: 'assistant',
      kind: 'tool_run',
      participant: 'host',
      artifact: 'persona_synthesis',
      personaId: 'jill',
      personaLabel: 'Jill',
      reportTurnId: 'report-1',
      content: 'Jill weighs the report.',
      timestamp: 0,
      excerptVersion: 1
    };

    render(
      <WorkshopThread
        turns={[personaTurn]}
        toolSidecars={[]}
        currentExcerptVersion={1}
        onQuickAction={noop}
        onTalkDirectly={noop}
        onCopy={noop}
        onSave={noop}
      />
    );

    expect(screen.getByText('Jill')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save to notes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /rewrite/i })).toBeNull();
  });

  it('disables task promotion from a superseded excerpt before the host rejects it', () => {
    const staleReport: WorkshopTurn = {
      ...report('report-old', 'prose'),
      actionableFindings: [
        { key: 'finding-1', ordinal: 1, text: 'Tighten the opening.' }
      ]
    };

    render(
      <WorkshopThread
        turns={[staleReport]}
        toolSidecars={[]}
        todos={[]}
        currentExcerptVersion={2}
        onQuickAction={noop}
        onTalkDirectly={noop}
        onAddTodo={noop}
        onCopy={noop}
        onSave={noop}
      />
    );

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Stale' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add all' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Stale' }).getAttribute('title'))
      .toContain('superseded excerpt');
  });
});
