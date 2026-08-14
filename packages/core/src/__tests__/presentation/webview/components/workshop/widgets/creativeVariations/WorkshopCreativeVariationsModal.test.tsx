/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  WorkshopCreativeVariationsModal
} from '@components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal';
import { ModelOption } from '@shared/types';
import {
  ADVISORY_RISK_ID,
  baseDraft,
  emptyDraft,
  generatedDraft,
  workup
} from './creativeVariationsFixtures';

const widgetModels: ModelOption[] = [
  { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'Anthropic' },
  { id: 'openai/gpt-5.4', label: 'GPT-5.4', provider: 'OpenAI' }
];

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WorkshopCreativeVariationsModal>> = {}
) => {
  const props = {
    open: true,
    banner: { kind: 'none' } as const,
    draft: baseDraft,
    generation: { kind: 'idle' } as const,
    invalidationNotice: null,
    commitPending: false,
    commitError: null,
    commitBlockers: ['no-workup'] as const,
    artifactUsage: null,
    highOverlapThreshold: 80,
    availableSources: [],
    onUseSelection: jest.fn(),
    onSubjectTextChange: jest.fn(),
    onSurroundingContextChange: jest.fn(),
    onToggleSourceReference: jest.fn(),
    onMustSurviveChange: jest.fn(),
    onMustNotChangeChange: jest.fn(),
    onAimChange: jest.fn(),
    onDistanceChange: jest.fn(),
    onRequestedCountChange: jest.fn(),
    onGenerate: jest.fn(),
    onCancelGenerate: jest.fn(),
    onToggleCardSelection: jest.fn(),
    onCarryModeChange: jest.fn(),
    onToggleAdvisoryRisk: jest.fn(),
    onNoteChange: jest.fn(),
    onCopyVariation: jest.fn(),
    onCommit: jest.fn(),
    widgetModelOptions: widgetModels,
    selectedWidgetModel: 'anthropic/claude-sonnet-5',
    onWidgetModelChange: jest.fn(),
    onOpenWidgetModelBrowser: jest.fn(),
    onClose: jest.fn(),
    ...overrides
  };
  const view = render(<WorkshopCreativeVariationsModal {...props} />);
  return { props, view };
};

describe('WorkshopCreativeVariationsModal', () => {
  afterEach(cleanup);

  it('mounts as a labelled modal and gives focus to its close affordance', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Creative Variations Explorer' });
    const close = screen.getByRole('button', { name: 'Close Creative Variations' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(close);
  });

  it('disables generation with a written reason while the passage is blank', () => {
    renderModal({ draft: emptyDraft });
    const generate = screen.getByRole('button', { name: /Generate the workup/ });
    expect((generate as HTMLButtonElement).disabled).toBe(true);
    const reasons = screen.getByText('Add the passage to vary.');
    expect(generate.getAttribute('aria-describedby')).toBe(reasons.id);
  });

  it('enables generation with only a passage and marks constraints and aim optional', () => {
    const { props } = renderModal({
      draft: {
        ...emptyDraft,
        subject: { text: 'The only required input.', provenance: { kind: 'pasted' } }
      }
    });
    const generate = screen.getByRole('button', { name: /Generate the workup/ });
    expect((generate as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('textbox', { name: /Must survive every take optional/ }))
      .toBeTruthy();
    expect(screen.getByRole('textbox', { name: /Creative aim optional/ }))
      .toBeTruthy();
    fireEvent.click(generate);
    expect(props.onGenerate).toHaveBeenCalledTimes(1);
  });

  it('blocks generation while a selected source is no longer available', () => {
    renderModal({
      draft: {
        ...baseDraft,
        surroundingContext: {
          writerText: '',
          sourceReferences: [{ kind: 'active-excerpt' }]
        }
      }
    });

    const generate = screen.getByRole('button', { name: /Generate the workup/ });
    expect((generate as HTMLButtonElement).disabled).toBe(true);
    const reasons = document.getElementById('pm-ws-cvx-gen-reasons');
    expect(reasons?.textContent).toContain(
      'Remove unavailable source material before generating again.'
    );
    expect(generate.getAttribute('aria-describedby')).toBe(reasons?.id);
  });

  it('shows the pasted-provenance label and honest no-context copy for pasted subjects', () => {
    renderModal({
      draft: {
        ...baseDraft,
        subject: { text: 'Pasted paragraph.', provenance: { kind: 'pasted' } }
      }
    });
    expect(screen.getByText('pasted · no surrounding passage')).toBeTruthy();
    expect(screen.getByText(/cannot check continuity against the pages around it/)).toBeTruthy();
  });

  it('states when separately supplied context travels with a pasted subject', () => {
    renderModal({
      draft: {
        ...baseDraft,
        subject: { text: 'Pasted paragraph.', provenance: { kind: 'pasted' } },
        surroundingContext: {
          writerText: 'The paragraph before this one.',
          sourceReferences: []
        }
      }
    });

    expect(screen.getByText('pasted · context supplied separately')).toBeTruthy();
    expect(screen.getByText(/sees this passage.*surrounding context/i)).toBeTruthy();
    expect(screen.queryByText(/declared constraints and nothing else/)).toBeNull();
  });

  it('shows display-safe excerpt provenance with line bounds', () => {
    renderModal();
    expect(
      screen.getByText('from excerpt · Drafts/chapter-five.md · L12–18')
    ).toBeTruthy();
  });

  it('labels persona-prefilled provenance without claiming the writer pasted it', () => {
    renderModal({
      banner: { kind: 'seed', personaLabel: 'Jill' },
      draft: {
        ...baseDraft,
        subject: {
          text: 'A persona-prepared passage.',
          provenance: { kind: 'persona-prefill' }
        }
      }
    });

    expect(screen.getByText('Recommended and prefilled by Jill.')).toBeTruthy();
    expect(screen.getByText('Persona-prefilled passage')).toBeTruthy();
    expect(screen.getByText(/persona prefill/)).toBeTruthy();
    expect(screen.queryByText('Pasted passage')).toBeNull();
    expect(screen.getByText(/Generation sees only this exact text/)).toBeTruthy();
  });

  it('requests editor selection through the semantic callback', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Use editor selection' }));
    expect(props.onUseSelection).toHaveBeenCalledTimes(1);
  });

  it('renders the four verbalized distances with Tail marked as the default', () => {
    const { props } = renderModal();
    const tail = screen.getByRole('button', { name: /Tail · default/ });
    expect(tail.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Adjacent/ }));
    expect(props.onDistanceChange).toHaveBeenCalledWith('adjacent');
    ['Familiar', 'Far tail'].forEach((label) => {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeTruthy();
    });
  });

  it('offers exactly three, four, or five takes', () => {
    const { props } = renderModal();
    const group = screen.getByRole('group', { name: 'How many takes' });
    const buttons = Array.from(group.querySelectorAll('button')).map(
      (button) => button.textContent
    );
    expect(buttons).toEqual(['3', '4', '5']);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(props.onRequestedCountChange).toHaveBeenCalledWith(4);
    expect(screen.getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('renders a cancellable generating state as a live status', () => {
    const { props } = renderModal({ generation: { kind: 'generating' } });
    expect(screen.getByRole('status').textContent).toContain('Generating the workup');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel generation' }));
    expect(props.onCancelGenerate).toHaveBeenCalledTimes(1);
  });

  it('aborts the active generation before a modal close settles', () => {
    const { props } = renderModal({ generation: { kind: 'generating' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancelGenerate).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders generation failure as an alert', () => {
    renderModal({
      generation: { kind: 'failed', message: 'The response failed validation. Try again.' }
    });
    expect(screen.getByRole('alert').textContent).toContain(
      'The response failed validation. Try again.'
    );
  });

  it('renders the generated workup as structured cards and toggles selection', () => {
    const { props } = renderModal({ draft: generatedDraft });
    expect(screen.getByText('3 returned · none ranked')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Select Take 1 — Baseline — the competent fix' })
    );
    expect(props.onToggleCardSelection).toHaveBeenCalledWith(1);
  });

  it('offers Regenerate with the atomic-clear caption once a workup exists', () => {
    renderModal({ draft: generatedDraft });
    expect(screen.getByRole('button', { name: /Regenerate the workup/ })).toBeTruthy();
    expect(
      screen.getByText(/clears selections, carry modes, and accepted risks/)
    ).toBeTruthy();
  });

  it('announces why a settled workup was cleared', () => {
    renderModal({
      invalidationNotice: 'Generated workup cleared because the creative aim changed.'
    });
    expect(screen.getByRole('status').textContent).toBe(
      'Generated workup cleared because the creative aim changed.'
    );
  });

  it('shows carry controls on a selected card and promotes to full prose explicitly', () => {
    const { props } = renderModal({
      draft: {
        ...generatedDraft,
        selections: [{ position: 1, carryMode: 'direction', acceptedAdvisoryRiskIds: [] }]
      }
    });
    const carry = screen.getByRole('group', { name: 'Carry mode for Take 1' });
    const directionButton = carry.querySelector('button[aria-pressed="true"]');
    expect(directionButton?.textContent).toContain('direction · default');
    fireEvent.click(screen.getByRole('button', { name: 'full prose' }));
    expect(props.onCarryModeChange).toHaveBeenCalledWith(1, 'full-prose');
  });

  it('raises per-risk acceptance for advisory flags on a selected card', () => {
    const { props } = renderModal({
      draft: {
        ...generatedDraft,
        selections: [{ position: 2, carryMode: 'direction', acceptedAdvisoryRiskIds: [] }]
      }
    });
    const accept = screen.getByRole('button', {
      name: /Accept advisory risk on Take 2: adds a fact — the chair/
    });
    expect(accept.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(accept);
    expect(props.onToggleAdvisoryRisk).toHaveBeenCalledWith(2, ADVISORY_RISK_ID);
  });

  it('keeps a hard-conflict card visible but not selectable, with a written reason', () => {
    renderModal({ draft: generatedDraft });
    const select = screen.getByRole('button', {
      name: 'Select Take 3 — Absence as furniture'
    });
    expect((select as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/Cannot commit — the model declared a hard conflict/)
    ).toBeTruthy();
    expect(screen.getByText(/watching\. Still\.$/)).toBeTruthy();
  });

  it('reports textual overlap as evidence — maximum pair, never a ranking', () => {
    renderModal({ draft: generatedDraft });
    const maximum = workup.overlap.maximumPair;
    expect(screen.getByText(
      `maximum pair: Take ${maximum.leftPosition} ↔ Take ${maximum.rightPosition} · ${maximum.score}%`
    )).toBeTruthy();
    expect(
      screen.getByText('deterministic surface reuse · not a meaning or quality score')
    ).toBeTruthy();
  });

  it('warns on high overlap without hiding or removing takes', () => {
    renderModal({ draft: generatedDraft, highOverlapThreshold: 80 });
    const warning = screen.getByRole('status');
    const maximum = workup.overlap.maximumPair;
    expect(warning.textContent).toContain(
      `High textual overlap between Take ${maximum.leftPosition} and Take ${maximum.rightPosition} (${maximum.score}%).`
    );
    expect(warning.textContent).toContain('Nothing is ranked, hidden, or removed');
    // Every card is still on screen.
    expect(screen.getByText('Absence as furniture')).toBeTruthy();
    expect(screen.getByText('Her refusal, timed')).toBeTruthy();
  });

  it('does not warn when the maximum pair sits under the threshold', () => {
    renderModal({
      draft: generatedDraft,
      highOverlapThreshold: workup.overlap.maximumPair.score + 1
    });
    expect(screen.queryByText(/High textual overlap/)).toBeNull();
  });

  it('lists the full pair matrix behind a disclosure', () => {
    renderModal({ draft: generatedDraft });
    fireEvent.click(screen.getByText('All pairs'));
    const firstPair = workup.overlap.pairs[0];
    expect(screen.getByRole('row', {
      name: new RegExp(
        `Take ${firstPair.leftPosition} ↔ Take ${firstPair.rightPosition} `
        + `${firstPair.prose}% ${firstPair.direction}% ${firstPair.maximum}%`
      )
    })).toBeTruthy();
  });

  it('opens and dismisses the side-by-side comparison from ephemeral compare marks', () => {
    renderModal({ draft: generatedDraft });
    const compareBar = screen.getByRole('button', { name: 'Compare side by side' });
    expect((compareBar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Compare Take 1 side by side' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare Take 2 side by side' }));
    expect((compareBar as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(compareBar);
    const comparison = screen.getByRole('region', { name: 'Side-by-side comparison' });
    expect(comparison.textContent).toContain('Must survive:');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss comparison' }));
    expect(screen.queryByRole('region', { name: 'Side-by-side comparison' })).toBeNull();
  });

  it('copies a full variation through the semantic callback', () => {
    const { props } = renderModal({ draft: generatedDraft });
    fireEvent.click(screen.getByRole('button', { name: 'Copy Take 1 prose' }));
    expect(props.onCopyVariation).toHaveBeenCalledWith(
      generatedDraft.workup!.cards[0].prose
    );
  });

  it('projects the compact payload with carry counts and the budget meter', () => {
    renderModal({
      draft: {
        ...generatedDraft,
        selections: [
          { position: 1, carryMode: 'direction', acceptedAdvisoryRiskIds: [] },
          { position: 2, carryMode: 'full-prose', acceptedAdvisoryRiskIds: [ADVISORY_RISK_ID] }
        ]
      },
      artifactUsage: { characters: 640, budget: 20_000 },
      commitBlockers: []
    });
    expect(
      screen.getByText(/2 takes · 1 as direction · 1 as full prose/)
    ).toBeTruthy();
    expect(screen.getByText(/2 declared invariants ride with them/)).toBeTruthy();
    const meter = screen.getByRole('progressbar', { name: 'Commit payload budget' });
    expect(meter.getAttribute('aria-valuenow')).toBe('640');
    expect(meter.getAttribute('aria-valuemax')).toBe('20000');
  });

  it('does not claim an inferred invariant when both authored fields are blank', () => {
    renderModal({
      draft: {
        ...generatedDraft,
        invariants: { mustSurvive: '', mustNotChange: '' },
        selections: [{ position: 1, carryMode: 'direction', acceptedAdvisoryRiskIds: [] }]
      },
      artifactUsage: { characters: 100, budget: 20_000 },
      commitBlockers: []
    });

    expect(screen.getByText(/blank invariant fields add no constraint/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('both declared constraint fields');
  });

  it('disables commit with the controller-supplied blocker as an accessible reason', () => {
    renderModal({
      draft: generatedDraft,
      commitBlockers: ['unaccepted-advisory-risk']
    });
    const commit = screen.getByRole('button', { name: 'Commit to thread' });
    expect((commit as HTMLButtonElement).disabled).toBe(true);
    const reason = screen.getByText(
      'Accept every advisory risk on your selected takes, or unselect those takes.'
    );
    expect(commit.getAttribute('aria-describedby')).toBe(reason.id);
  });

  it('explains the tool-target authority boundary before commit', () => {
    renderModal({
      draft: generatedDraft,
      commitBlockers: ['tool-target']
    });
    const commit = screen.getByRole('button', { name: 'Commit to thread' });
    const reason = screen.getByText(
      'Switch to a persona target — tool sidecars do not take creative directions.'
    );
    expect((commit as HTMLButtonElement).disabled).toBe(true);
    expect(commit.getAttribute('aria-describedby')).toBe(reason.id);
  });

  it('commits through the semantic callback when no blockers remain', () => {
    const { props } = renderModal({ draft: generatedDraft, commitBlockers: [] });
    const commit = screen.getByRole('button', { name: 'Commit to thread' });
    expect((commit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(commit);
    expect(props.onCommit).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet mounted and destructive controls locked while commit is pending', () => {
    const { props } = renderModal({
      draft: generatedDraft,
      commitPending: true,
      commitBlockers: ['commit-in-flight']
    });
    const commit = screen.getByRole('button', { name: 'Committing…' });
    expect((commit as HTMLButtonElement).disabled).toBe(true);
    expect(commit.getAttribute('aria-describedby')).toBeNull();
    expect((screen.getByRole('textbox', {
      name: /Selected passage/
    }) as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', {
      name: /Note to the room optional/
    }) as HTMLTextAreaElement).disabled).toBe(true);
    const close = screen.getByRole('button', { name: 'Close Creative Variations' });
    expect((close as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(close);
    expect(props.onCommit).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('uses the widget model selector quartet', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', {
      name: /Browse widget model options. Current model: Claude Sonnet 5/
    }));
    expect(props.onOpenWidgetModelBrowser).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /GPT-5.4/ }));
    expect(props.onWidgetModelChange).toHaveBeenCalledWith('openai/gpt-5.4');
  });

  it('labels the clone posture and relabels commit as a new turn', () => {
    renderModal({ banner: { kind: 'clone' }, draft: generatedDraft, commitBlockers: [] });
    expect(screen.getByText(/Re-opened from a committed turn/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Commit as new turn' })).toBeTruthy();
  });

  it('credits a persona seed without ceding writer authority', () => {
    renderModal({ banner: { kind: 'seed', personaLabel: 'Jill' } });
    expect(
      screen.getByText(/Recommended and prefilled by Jill/)
    ).toBeTruthy();
    expect(
      screen.getByText(/generating, selecting, and committing\s+stay yours/)
    ).toBeTruthy();
  });

  it('surfaces a commit failure as an alert while the draft stays open', () => {
    renderModal({
      draft: generatedDraft,
      commitError: 'Creative Variations did not reach the room. Your draft is still open.'
    });
    expect(screen.getByRole('alert').textContent).toContain('did not reach the room');
  });
});
