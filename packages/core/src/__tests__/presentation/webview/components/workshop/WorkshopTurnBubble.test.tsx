/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), {
    setOptions: jest.fn()
  });
  return { marked };
});

import {
  parseVariations,
  WORKSHOP_TURN_ID_ATTRIBUTE,
  WorkshopTurnBubble
} from '@components/workshop/WorkshopTurnBubble';
import { WorkshopTurn } from '@messages';

const assistantTurn = (content: string): WorkshopTurn => ({
  id: 'turn-1',
  role: 'assistant',
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'tool_report',
  toolId: 'prose',
  toolLabel: 'Prose',
  reportTurnId: 'turn-1',
  content,
  timestamp: 0,
  excerptVersion: 1
});

describe('parseVariations', () => {
  it('parses the prompted three-variation markdown shape', () => {
    const parsed = parseVariations(`Intro text.

### Variation 1 - Sharper
First version.

### Variation 2 - Softer
Second version.

### Variation 3 - Stranger
Third version.`);

    expect(parsed?.intro).toBe('Intro text.');
    expect(parsed?.variations).toEqual([
      { number: '1', label: 'Sharper', content: 'First version.' },
      { number: '2', label: 'Softer', content: 'Second version.' },
      { number: '3', label: 'Stranger', content: 'Third version.' }
    ]);
  });

  it('accepts small heading/label drift but requires at least two non-empty sections', () => {
    expect(parseVariations(`## Variation 1: One\nA\n\n#### Variation 2\nB`)?.variations)
      .toHaveLength(2);
    expect(parseVariations('### Variation 1 - One\nA')).toBeNull();
    expect(parseVariations('### Variation 1 - One\nA\n\n### Variation 2 - Two\n   ')).toBeNull();
  });
});

describe('WorkshopTurnBubble variation cards', () => {
  it('renders each web citation as an independently clickable context-style pill', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Research findings.'),
          citations: [
            { url: 'https://www.anthropic.com/news/claude-opus-5', title: 'Introducing Claude Opus 5' },
            { url: 'https://platform.claude.com/docs/en/about-claude/models/whats-new-opus-5', title: 'What\'s new in Claude Opus 5' },
            { url: 'https://example.com/system-card.pdf' }
          ]
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    const citations = screen.getAllByRole('link');
    expect(citations).toHaveLength(3);
    expect(citations.map((citation) => citation.textContent)).toEqual([
      '1Introducing Claude Opus 5',
      "2What's new in Claude Opus 5",
      '3example.com'
    ]);
    expect(citations[0].classList.contains('pm-ws-ctx-pill')).toBe(true);
    expect(citations[0].classList.contains('pm-ws-turn-citation-pill')).toBe(true);
    expect(citations[1].getAttribute('href')).toBe(
      'https://platform.claude.com/docs/en/about-claude/models/whats-new-opus-5'
    );
  });

  it('renders the direct-run divider with the pinned revision', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          id: 'turn-request',
          role: 'user',
          kind: 'tool_run',
          participant: 'writer',
          artifact: 'tool_request',
          toolId: 'stock-and-signature',
          toolLabel: 'Stock & Signature',
          content: 'Run it.',
          timestamp: 0,
          excerptVersion: 3
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByRole('separator').textContent)
      .toContain('Stock & Signature · direct run · excerpt v3');
  });

  it('renders host-owned direct-run provenance without altering report content', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Verbatim report.'),
          analysisInputs: {
            excerpt: {
              mode: 'inherit',
              material: 'pinned excerpt v3',
              chosenBy: 'Writer',
              words: 240
            },
            context: {
              mode: 'inherit',
              material: 'no context attachments',
              chosenBy: 'Writer',
              words: 0
            }
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('Verbatim report.')).toBeTruthy();
    expect(screen.getByText(/Excerpt · inherit · pinned excerpt v3/)).toBeTruthy();
    expect(screen.getByText(/Context · inherit · no context attachments/)).toBeTruthy();
    expect(screen.queryByText(/Private · you/)).toBeNull();
  });

  it('marks both sides of a direct instrument follow-up as private', () => {
    const directUserTurn: WorkshopTurn = {
      id: 'direct-user',
      role: 'user',
      kind: 'message',
      participant: 'writer',
      artifact: 'direct_tool_message',
      toolId: 'dialogue',
      toolLabel: 'Dialogue & Beats',
      reportTurnId: 'report-1',
      content: 'Can you explain the second finding?',
      timestamp: 1,
      excerptVersion: 1
    };
    const directToolTurn: WorkshopTurn = {
      ...assistantTurn('The second finding is about beat placement.'),
      id: 'direct-tool',
      kind: 'message',
      artifact: 'direct_tool_response',
      toolId: 'dialogue',
      toolLabel: 'Dialogue & Beats',
      reportTurnId: 'report-1'
    };
    const props = {
      quickActionToolId: null,
      onQuickAction: jest.fn(),
      onTalkDirectly: jest.fn(),
      onCopy: jest.fn(),
      onSave: jest.fn()
    };
    const { rerender } = render(<WorkshopTurnBubble turn={directUserTurn} {...props} />);

    expect(screen.getByText('Private · you + Dialogue & Beats')).toBeTruthy();
    expect(document.querySelector('.pm-ws-turn-private')).toBeTruthy();

    rerender(<WorkshopTurnBubble turn={directToolTurn} {...props} />);
    expect(screen.getByText('Private · you + Dialogue & Beats')).toBeTruthy();
    expect(document.querySelector('.pm-ws-turn-private')).toBeTruthy();
  });

  it('renders persona-run divider and inspectable per-input provenance', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Report.'),
          toolId: 'stock-and-signature',
          toolLabel: 'Stock & Signature',
          capability: {
            operation: 'analysis.run',
            status: 'success',
            requestSummary: 'excerpt replace, context omit',
            requestedByPersonaId: 'jill',
            invokedBy: { kind: 'host' },
            metadata: {
              analysisInputs: {
                excerpt: {
                  mode: 'replace',
                  material: 'persona-supplied excerpt (240 words)',
                  chosenBy: 'Jill',
                  words: 240
                },
                context: {
                  mode: 'omit',
                  material: 'omitted',
                  chosenBy: 'Jill',
                  words: 0
                }
              }
            }
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByRole('separator').textContent)
      .toContain('Stock & Signature · via Jill · persona-supplied passage, 240 words');
    fireEvent.click(screen.getByText(/requested by Jill/));
    expect(screen.getByText(/Excerpt · replace · persona-supplied excerpt/)).toBeTruthy();
    expect(screen.getByText(/Context · omit · omitted/)).toBeTruthy();
  });

  it('requires an explicit click to promote a structured finding', () => {
    const onAddTodo = jest.fn();
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Report.\n\n### Next steps\n- Tighten the opening.'),
          actionableFindings: [
            { key: 'finding-1', ordinal: 1, text: 'Tighten the opening.' }
          ]
        }}
        quickActionToolId="prose"
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onAddTodo={onAddTodo}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(onAddTodo).not.toHaveBeenCalled();
    expect(document.querySelector(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="turn-1"]`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(onAddTodo).toHaveBeenCalledWith('turn-1', 'finding-1');
  });

  it('renders the same proposal menu for a guest persona turn', () => {
    const onAddTodo = jest.fn();
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Felix review.\n\n### Next steps\n- Restore the breath.'),
          id: 'guest-turn',
          kind: 'message',
          participant: 'guest',
          artifact: 'persona_message',
          personaId: 'felix',
          personaLabel: 'Felix',
          actionableFindings: [
            { key: 'finding-1', ordinal: 1, text: 'Restore the breath.' }
          ]
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onAddTodo={onAddTodo}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText(/add a next step/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(onAddTodo).toHaveBeenCalledWith('guest-turn', 'finding-1');
  });

  it('shows already-promoted findings without adding them again', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Report.'),
          actionableFindings: [
            { key: 'finding-1', ordinal: 1, text: 'Tighten the opening.' }
          ]
        }}
        quickActionToolId={null}
        promotedFindingKeys={new Set(['finding-1'])}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /added/i }).hasAttribute('disabled')).toBe(true);
  });

  it('offers prioritized host proposals with an explicit Add all action', () => {
    const onAddTodo = jest.fn();
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Here is the revision order.'),
          participant: 'host',
          artifact: 'persona_message',
          toolId: undefined,
          toolLabel: undefined,
          reportTurnId: undefined,
          personaId: 'jill',
          personaLabel: 'Jill',
          actionableFindings: [
            {
              key: 'finding-1', ordinal: 1, priority: 'high',
              text: 'Replace the beacon image.'
            },
            {
              key: 'finding-2', ordinal: 2, priority: 'medium',
              text: 'Audit the gravity metaphor.'
            }
          ]
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onAddTodo={onAddTodo}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('high')).toBeTruthy();
    expect(screen.getByText('medium')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    expect(onAddTodo.mock.calls).toEqual([
      ['turn-1', 'finding-1'],
      ['turn-1', 'finding-2']
    ]);
  });

  it('renders duplicate model numbers with stable positional labels and wires copy/save content', () => {
    const onCopy = jest.fn();
    const onSave = jest.fn();

    render(
      <WorkshopTurnBubble
        turn={assistantTurn(`### Variation 1 - First\nAlpha\n\n### Variation 1 - Second\nBeta`)}
        quickActionToolId="prose"
        quickActionsDisabled
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={onCopy}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Variation 1')).toBeTruthy();
    expect(screen.getByText('Variation 2')).toBeTruthy();

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    const saveButtons = screen.getAllByRole('button', { name: /save to notes/i });

    fireEvent.click(copyButtons[1]);
    fireEvent.click(saveButtons[0]);

    expect(onCopy).toHaveBeenCalledWith('Beta', expect.objectContaining({ id: 'turn-1' }));
    expect(onSave).toHaveBeenCalledWith('Alpha', expect.objectContaining({ id: 'turn-1' }));
  });

  it('renders persona replies as conversation, never as inherited tool variation cards', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('### Variation 1 - One\nA\n\n### Variation 2 - Two\nB'),
          kind: 'message',
          participant: 'host',
          artifact: 'persona_message',
          toolId: undefined,
          toolLabel: undefined,
          personaId: 'jill',
          personaLabel: 'Jill'
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('Jill')).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /save to notes/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /rewrite/i })).toBeNull();
  });

  it('reopens a committed one-shot widget from its writer-turn chip', () => {
    const onOpenWidgetConfig = jest.fn();

    render(
      <WorkshopTurnBubble
        turn={{
          id: 'widget-turn',
          role: 'user',
          kind: 'message',
          participant: 'writer',
          artifact: 'persona_message',
          content: 'Try these directions.',
          timestamp: 1,
          excerptVersion: 1,
          widgetCommit: {
            widgetId: 'gesture-playground',
            widgetConfigId: 'wc-7',
            rail: 'thread-artifact',
            artifactId: 'ta-8',
            selectionCount: 2
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
        onOpenWidgetConfig={onOpenWidgetConfig}
      />
    );

    const chip = screen.getByRole('button', { name: /Gesture Playground/ });
    expect(chip.textContent).toContain('2 directions · re-open');
    fireEvent.click(chip);
    expect(onOpenWidgetConfig).toHaveBeenCalledWith('wc-7');
  });

  it('derives a one-shot chip label and selected-unit noun from its widget id', () => {
    const onOpenWidgetConfig = jest.fn();
    render(
      <WorkshopTurnBubble
        turn={{
          id: 'creative-widget-turn',
          role: 'user',
          kind: 'message',
          participant: 'writer',
          artifact: 'persona_message',
          content: 'Try these variations.',
          timestamp: 1,
          excerptVersion: 1,
          widgetCommit: {
            widgetId: 'creative-variations',
            widgetConfigId: 'wc-8',
            rail: 'thread-artifact',
            artifactId: 'ta-9',
            selectionCount: 3
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
        onOpenWidgetConfig={onOpenWidgetConfig}
      />
    );

    const chip = screen.getByRole('button', { name: /Creative Variations Explorer/ });
    expect(chip.textContent).toContain('3 variations · re-open');
    expect(chip.textContent).not.toContain('Gesture Playground');
    expect(chip.textContent).not.toContain('directions');
    fireEvent.click(chip);
    expect(onOpenWidgetConfig).toHaveBeenCalledWith('wc-8');
  });

  it('forwards the complete rich persona seed when its widget chip is opened', () => {
    const onOpenWidgetRecommendation = jest.fn();
    const recommendation = {
      widgetId: 'gesture-playground' as const,
      seed: {
        targetPhrase: 'His eyes stretched wide.',
        writerInstructions:
          'Preserve recognition rather than generic shock. Explore stillness and misreading.',
        contextText:
          'Micah looked past Jasper. His eyes stretched wide. Nate turned but saw nothing.',
        characterNotes:
          'Micah is containing fear for Nate. Recognition breaks that control in this beat.'
      }
    };

    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('The reaction needs a more specific pressure.'),
          kind: 'message',
          participant: 'host',
          artifact: 'persona_message',
          toolId: undefined,
          toolLabel: undefined,
          personaId: 'jill',
          personaLabel: 'Jill',
          widgetRecommendation: recommendation
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
        onOpenWidgetRecommendation={onOpenWidgetRecommendation}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Gesture Playground/ }));
    expect(onOpenWidgetRecommendation).toHaveBeenCalledWith(recommendation, 'Jill', 'jill');
  });

  it('correlates a Creative Variations prefill to the exact persona turn chip', () => {
    const onOpenWidgetRecommendation = jest.fn();
    const recommendation = {
      widgetId: 'creative-variations' as const,
      seed: {
        subjectText: 'She rotated the mug until the chip faced the wall.',
        mustSurvive: 'The refusal remains implicit.',
        mustNotChange: 'Keep the mug and close third person.',
        aim: 'Move the refusal into physical behavior.',
        distance: 'tail' as const,
        requestedCount: 4 as const
      }
    };

    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Let us get unlike possibilities on the table.'),
          kind: 'message',
          participant: 'guest',
          artifact: 'persona_message',
          toolId: undefined,
          toolLabel: undefined,
          personaId: 'margot',
          personaLabel: 'Margot',
          widgetRecommendation: recommendation
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
        onOpenWidgetRecommendation={onOpenWidgetRecommendation}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Creative Variations Explorer/ }));
    expect(onOpenWidgetRecommendation).toHaveBeenCalledWith(
      recommendation,
      'Margot',
      'margot'
    );
  });

  it('labels logical-turn traffic as processed across provider calls', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('A measured reply.'),
          usage: {
            promptTokens: 160_000,
            completionTokens: 12_000,
            totalTokens: 172_000,
            requestCount: 5
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('172,000 processed').getAttribute('title'))
      .toBe('172,000 tokens processed across 5 calls');
    expect(document.body.textContent).not.toContain('172,000 tokens');
  });

  it('renders excerpt revisions as participant-neutral thread dividers', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          id: 'revision-2',
          role: 'system',
          kind: 'divider',
          participant: 'session',
          artifact: 'excerpt_revision',
          excerptVersion: 2,
          content: 'Excerpt v2 pinned · chapter-two.md · retired: Cliché',
          timestamp: 2
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByRole('separator').textContent).toContain('Excerpt v2 pinned');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders persona-requested dictionary evidence as a compact expandable artifact', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('# liminal\nThreshold-toned.'),
          artifact: 'dictionary_lookup',
          toolId: undefined,
          toolLabel: "Writer's Dictionary",
          reportTurnId: undefined,
          capability: {
            operation: 'dictionary.lookup',
            status: 'success',
            requestSummary: 'liminal',
            requestedByPersonaId: 'jill',
            invokedBy: { kind: 'host' }
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText("Writer's Dictionary · liminal · requested by Jill")).toBeTruthy();
    expect(screen.getByText('success')).toBeTruthy();
    expect(document.querySelector('details.pm-ws-capability-artifact')).toBeTruthy();
    expect(document.body.textContent).not.toContain('prose-minion-tool-call');
  });

  it('keeps full-entry timing and partial failures inspectable', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('# Full entry'),
          artifact: 'dictionary_full_entry',
          toolId: undefined,
          toolLabel: "Writer's Dictionary",
          reportTurnId: undefined,
          capability: {
            operation: 'dictionary.full-entry',
            status: 'partial',
            requestSummary: 'liminal',
            requestedByPersonaId: 'jill',
            invokedBy: { kind: 'host' },
            metadata: {
              successCount: 14,
              totalBlocks: 15,
              totalDuration: 1_250,
              partialFailures: ['soundplay-rhyme']
            }
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Capability metadata').textContent).toContain('14/15');
    expect(screen.getByLabelText('Capability metadata').textContent).toContain('1.3s');
    expect(screen.getByLabelText('Capability metadata').textContent).toContain('soundplay-rhyme');
  });

  it('renders an analysis focus instead of repeating the tool label', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('The cup remains on the table.'),
          artifact: 'tool_report',
          toolId: 'continuity',
          toolLabel: 'Continuity',
          capability: {
            operation: 'analysis.run',
            status: 'success',
            requestSummary: 'Track the cup.',
            requestedByPersonaId: 'jill',
            invokedBy: { kind: 'host' }
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('Continuity · Track the cup. · requested by Jill')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Continuity · Continuity');
  });

  it('renders project-resource provenance and bounds as an inspectable artifact', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('## Project resource · Raven\nSafe evidence.'),
          artifact: 'resource_read',
          toolId: undefined,
          toolLabel: 'Project Resources',
          reportTurnId: undefined,
          capability: {
            operation: 'resource.read',
            status: 'success',
            requestSummary: 'characters/raven.md',
            requestedByPersonaId: 'jill',
            invokedBy: { kind: 'host' },
            metadata: {
              group: 'characters',
              path: 'characters/raven.md',
              startLine: 41,
              endLine: 80,
              totalLines: 300,
              bytes: 128,
              totalBytes: 512,
              truncated: true
            }
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('Project Resources · characters/raven.md · requested by Jill')).toBeTruthy();
    expect(screen.getByLabelText('Capability metadata').textContent).toContain('lines 41–80 of 300');
    expect(screen.getByLabelText('Capability metadata').textContent).toContain('128 of 512 bytes read');
    expect(screen.getByLabelText('Capability metadata').textContent).toContain('project-resource limits');
    expect(screen.queryByRole('button', { name: /talk directly/i })).toBeNull();
  });

  it('distinguishes catalog-path search from file-content search', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('## Project resource search · “Micah”'),
          artifact: 'resource_search',
          toolId: undefined,
          toolLabel: 'Project Resources',
          reportTurnId: undefined,
          capability: {
            operation: 'resource.search',
            status: 'success',
            requestSummary: '“Micah” in characters',
            requestedByPersonaId: 'jill',
            invokedBy: { kind: 'host' },
            metadata: {
              group: 'characters',
              searchMode: 'catalog',
              catalogEntriesScanned: 98,
              filesScanned: 0,
              bytesScanned: 0,
              matchCount: 1,
              truncated: false
            }
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    const metadata = screen.getByLabelText('Capability metadata').textContent;
    expect(metadata).toContain('98 configured paths searched');
    expect(metadata).toContain('1 match found');
    expect(metadata).not.toContain('0 configured files searched');
    expect(metadata).not.toContain('0 bytes searched');
  });
});
