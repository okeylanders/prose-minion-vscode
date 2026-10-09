/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  WorkshopShowVsTellModal
} from '@components/workshop/widgets/showVsTell/WorkshopShowVsTellModal';
import type { WorkshopShowVsTellDraft } from '@messages';
import { ModelOption } from '@shared/types';
import {
  buildShowVsTellArtifact
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
import {
  SHOW_VS_TELL_READOUT,
  SHOW_VS_TELL_READOUT_CAPTION
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  fixtureVariantId,
  generatedShowVsTellDraft,
  ungeneratedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

const widgetModels: ModelOption[] = [
  { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'Anthropic' }
];

const keptDraft = (carry: Array<[number, 'direction' | 'prose']>): WorkshopShowVsTellDraft => ({
  ...generatedShowVsTellDraft(),
  kept: carry.map(([ordinal, carryMode]) => ({ variantId: fixtureVariantId(ordinal), carryMode }))
});

const usageFor = (draft: WorkshopShowVsTellDraft) => {
  const text = buildShowVsTellArtifact(draft);
  return { text, characters: text.length, budget: 600 };
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WorkshopShowVsTellModal>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopShowVsTellModal> = {
    open: true,
    draft: ungeneratedShowVsTellDraft(),
    generation: { kind: 'idle' },
    invalidationNotice: null,
    intakeNotice: null,
    passageNotice: null,
    generateBlockers: [],
    commitBlockers: ['no-workup'],
    commitPending: false,
    commitError: null,
    banner: { kind: 'none' },
    artifactUsage: null,
    availableSources: [],
    canUsePassageFromExcerpt: false,
    onUseSelection: jest.fn(),
    onBeatTextChange: jest.fn(),
    onPassageTextChange: jest.fn(),
    onUsePassageFromExcerpt: jest.fn(),
    onUsePassageFromSelection: jest.fn(),
    onToggleSourceReference: jest.fn(),
    onPovModeChange: jest.fn(),
    onPovFocalCharacterChange: jest.fn(),
    onMustSurviveChange: jest.fn(),
    onMustNotChangeChange: jest.fn(),
    onToggleChannel: jest.fn(),
    onLengthBudgetChange: jest.fn(),
    onPositionChange: jest.fn(),
    onGenerate: jest.fn(),
    onCancelGenerate: jest.fn(),
    onToggleKeep: jest.fn(),
    onCarryModeChange: jest.fn(),
    onNoteChange: jest.fn(),
    onCommit: jest.fn(),
    widgetModelOptions: widgetModels,
    selectedWidgetModel: 'anthropic/claude-sonnet-5',
    onWidgetModelChange: jest.fn(),
    onOpenWidgetModelBrowser: jest.fn(),
    onClose: jest.fn(),
    ...overrides
  };
  render(<WorkshopShowVsTellModal {...props} />);
  return props;
};

const filledSegments = (row: HTMLElement): number =>
  row.querySelectorAll('.pm-ws-svt-bar-on').length;

describe('WorkshopShowVsTellModal', () => {
  afterEach(cleanup);

  it('mounts as a labelled modal with the neutral framing and the editor footer', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Show vs. Tell Playground' })).toBeTruthy();
    expect(screen.getByText(/Both ends are tools/)).toBeTruthy();
    expect(screen.getByText(
      'Nothing is inserted into the editor — commit hands directions to the room.'
    )).toBeTruthy();
  });

  describe('readout', () => {
    it.each(['state-it', 'summarize', 'hinge', 'evidence', 'inhabit'] as const)(
      'renders the pinned seven-row table for %s with one accent colour',
      (position) => {
        renderModal({ draft: { ...ungeneratedShowVsTellDraft(), position } });
        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row');

        expect(rows).toHaveLength(7);
        SHOW_VS_TELL_READOUT.forEach((dimension, index) => {
          const row = rows[index];
          expect(within(row).getByRole('rowheader').textContent).toBe(dimension.label);
          expect(filledSegments(row)).toBe(dimension.levels[position]);
          expect(row.querySelectorAll('.pm-ws-svt-bars i')).toHaveLength(4);
          expect(within(row).getByRole('img').getAttribute('aria-label'))
            .toBe(`${dimension.levels[position]} of 4`);
        });
        // One accent class and nothing else colours a bar.
        const classes = new Set(
          [...table.querySelectorAll('.pm-ws-svt-bars i')].map((bar) => bar.className)
        );
        expect([...classes].every((name) => name === '' || name === 'pm-ws-svt-bar-on')).toBe(true);
      }
    );

    it('peaks ambiguity and reader work at Evidence, not Inhabit', () => {
      renderModal({ draft: { ...ungeneratedShowVsTellDraft(), position: 'evidence' } });
      const rows = within(screen.getByRole('table')).getAllByRole('row');
      const byLabel = (label: string) =>
        rows.find((row) => within(row).getByRole('rowheader').textContent === label)!;

      expect(filledSegments(byLabel('ambiguity'))).toBe(4);
      expect(filledSegments(byLabel('reader work'))).toBe(4);
      cleanup();
      renderModal({ draft: { ...ungeneratedShowVsTellDraft(), position: 'inhabit' } });
      const inhabit = within(screen.getByRole('table')).getAllByRole('row');
      expect(filledSegments(inhabit.find((row) =>
        within(row).getByRole('rowheader').textContent === 'ambiguity')!)).toBe(3);
    });

    it('carries the frozen caption and no score, rank, or verdict language', () => {
      renderModal({ draft: generatedShowVsTellDraft() });
      const verdict = /\b(?:score|rank|ranked|best|better|worse|worst|good|bad|winner|recommended)\b/iu;

      expect(screen.getByText(SHOW_VS_TELL_READOUT_CAPTION)).toBeTruthy();
      // The continuum, readout, and workup are where a verdict could hide.
      const continuum = screen.getByRole('radiogroup', { name: 'Position on the continuum' })
        .closest('fieldset')!;
      const workup = screen.getByRole('region', { name: 'Generated workup' });
      const surfaces = [continuum, workup].map((node) =>
        (node.textContent ?? '').replace(SHOW_VS_TELL_READOUT_CAPTION, ''));
      surfaces.forEach((text) => expect(text).not.toMatch(verdict));
      // And nothing in the workup carries a ranking affordance.
      expect(workup.querySelector('[class*="rank"], [class*="best"], [class*="score"]')).toBeNull();
    });

    it('prints the shared vocabulary line for the selected position', () => {
      renderModal({ draft: { ...ungeneratedShowVsTellDraft(), position: 'hinge' } });
      const line = screen.getByText(/shared vocabulary →/);

      expect(line.textContent).toBe(
        'shared vocabulary → Prose Controller ch. 06 narrative handling · show : tell = mixed'
      );
      cleanup();
      renderModal({ draft: { ...ungeneratedShowVsTellDraft(), position: 'inhabit' } });
      expect(screen.getByText(/shared vocabulary →/).textContent).toMatch(/show : tell = scene only$/);
    });
  });

  describe('continuum', () => {
    it('is a five-step radio group with end labels and the selected step’s tradeoff line', () => {
      const props = renderModal();
      const group = screen.getByRole('radiogroup', { name: 'Position on the continuum' });
      const steps = within(group).getAllByRole('radio');

      expect(steps.map((step) => step.textContent)).toEqual([
        'State itdirect tell',
        'Summarizecompressed narrative',
        'Hingetell the bridge, show the fulcrum',
        'Evidenceobservable action & sense',
        'Inhabitfull scene time'
      ]);
      expect(steps.map((step) => step.getAttribute('aria-checked')))
        .toEqual(['false', 'false', 'true', 'false', 'false']);
      expect(screen.getByText('compress / explain')).toBeTruthy();
      expect(screen.getByText('dramatize / embody')).toBeTruthy();
      expect(screen.getByText(
        'Tells the bridge, shows the moment that turns. Usually the working answer — so distrust it once.'
      )).toBeTruthy();

      fireEvent.click(steps[4]);
      expect(props.onPositionChange).toHaveBeenCalledWith('inhabit');
    });
  });

  describe('intake', () => {
    it('shows honest provenance and the POV tag', () => {
      renderModal({
        draft: {
          ...ungeneratedShowVsTellDraft(),
          beat: {
            text: 'Beat.',
            provenance: { kind: 'excerpt', relativePath: 'chapters/four.md', startLine: 12, endLine: 12 }
          },
          pov: { mode: 'close-third', focalCharacter: 'Daniel' }
        }
      });

      expect(screen.getByText('seeded from selection · chapters/four.md · L12–12')).toBeTruthy();
      expect(screen.getByText('POV: close third · Daniel')).toBeTruthy();
    });

    it('labels a pasted beat as pasted', () => {
      renderModal();

      expect(screen.getByText('pasted')).toBeTruthy();
      expect(screen.getByText('POV: unspecified')).toBeTruthy();
    });

    it('caps the beat at 160 characters and routes edits and editor-selection requests', () => {
      const props = renderModal();
      const beat = screen.getByRole('textbox', { name: /Selected beat/ });

      expect(beat.getAttribute('maxLength')).toBe('160');
      fireEvent.change(beat, { target: { value: 'New beat.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Use editor selection' }));

      expect(props.onBeatTextChange).toHaveBeenCalledWith('New beat.');
      expect(props.onUseSelection).toHaveBeenCalledTimes(1);
    });

    it('marks must survive optional (D3) and must not change optional, both multi-line', () => {
      const props = renderModal();
      const survive = screen.getByRole('textbox', { name: /Must survive every variation optional/ });
      const hold = screen.getByRole('textbox', { name: /Must not change optional/ });

      expect(survive.tagName).toBe('TEXTAREA');
      expect(survive.getAttribute('aria-required')).toBeNull();
      expect(screen.queryByText(/needs a declared/)).toBeNull();
      expect(hold.tagName).toBe('TEXTAREA');
      fireEvent.change(hold, { target: { value: 'no flashback\nno new scene' } });
      expect(props.onMustNotChangeChange).toHaveBeenCalledWith('no flashback\nno new scene');
    });

    it('offers POV mode plus a focal character that is blank and disabled under unspecified', () => {
      const props = renderModal();
      const mode = screen.getByRole('combobox', { name: 'POV mode' });
      const focal = screen.getByRole('textbox', { name: 'POV focal character' });

      expect((focal as HTMLInputElement).disabled).toBe(true);
      expect((focal as HTMLInputElement).value).toBe('');
      fireEvent.change(mode, { target: { value: 'first' } });
      expect(props.onPovModeChange).toHaveBeenCalledWith('first');
      cleanup();
      renderModal({
        draft: { ...ungeneratedShowVsTellDraft(), pov: { mode: 'close-third', focalCharacter: 'Daniel' } }
      });
      expect((screen.getByRole('textbox', { name: 'POV focal character' }) as HTMLInputElement).disabled)
        .toBe(false);
    });
  });

  describe('layout (D1)', () => {
    it('orders the beat, then POV + invariants beside channels + budget, then the full-width passage, the full-width context, and the continuum', () => {
      renderModal({ availableSources: [{ reference: { kind: 'active-excerpt' }, label: 'Active excerpt', detail: 'v3' }] });
      const body = document.querySelector('.pm-ws-svt-body')!;
      const order = [
        screen.getByRole('textbox', { name: /Selected beat/ }),
        screen.getByRole('combobox', { name: 'POV mode' }),
        screen.getByRole('textbox', { name: /Must survive every variation/ }),
        screen.getByRole('textbox', { name: /Must not change/ }),
        screen.getByRole('textbox', { name: /Surrounding passage/ }),
        screen.getByRole('checkbox', { name: /Active excerpt/ }),
        screen.getByRole('radiogroup', { name: 'Position on the continuum' })
      ];
      const positions = order.map((element) =>
        Array.from(body.querySelectorAll('*')).indexOf(element));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);

      // Channels and the length budget sit in the grid beside the constraints,
      // above the full-width passage.
      const grid = body.querySelector('.pm-ws-svt-grid')!;
      expect(grid.contains(screen.getByRole('group', { name: 'Channels to emphasize' }))).toBe(true);
      expect(grid.contains(screen.getByRole('radiogroup', { name: 'Length budget' }))).toBe(true);
      expect(grid.contains(screen.getByRole('combobox', { name: 'POV mode' }))).toBe(true);
      expect(grid.contains(screen.getByRole('textbox', { name: /Surrounding passage/ }))).toBe(false);
      expect(screen.getByRole('textbox', { name: /Surrounding passage/ }).closest('.pm-ws-svt-field-wide')).not.toBeNull();
      expect(screen.getByRole('checkbox', { name: /Active excerpt/ }).closest('.pm-ws-svt-field-wide')).not.toBeNull();
    });
  });

  describe('surrounding passage (D2)', () => {
    const sources = [
      { reference: { kind: 'active-excerpt' as const }, label: 'Active excerpt', detail: 'chapters/four.md · version 3' },
      { reference: { kind: 'context-attachment' as const, attachmentId: 'ctx-1' }, label: 'Character notes', detail: 'Workshop text · 12 words' },
      { reference: { kind: 'context-attachment' as const, attachmentId: 'ctx-2' }, label: 'kitchen.md', detail: 'scenes/kitchen.md · 410 words' }
    ];

    it('is a full-width text box with its own counter, Use excerpt, and Use selection', () => {
      const props = renderModal({
        draft: { ...ungeneratedShowVsTellDraft(), surroundingContext: { writerText: 'He set the mug down.', sourceReferences: [] } },
        canUsePassageFromExcerpt: true
      });
      const passage = screen.getByRole('textbox', { name: /Surrounding passage/ }) as HTMLTextAreaElement;

      expect(passage.tagName).toBe('TEXTAREA');
      expect(passage.value).toBe('He set the mug down.');
      expect(passage.getAttribute('maxLength')).toBe('250000');
      expect(screen.getByText('20 / 250,000 chars')).toBeTruthy();
      fireEvent.change(passage, { target: { value: 'He set the mug down.\nShe did not look up.' } });
      expect(props.onPassageTextChange).toHaveBeenCalledWith('He set the mug down.\nShe did not look up.');

      fireEvent.click(screen.getByRole('button', { name: 'Use excerpt' }));
      fireEvent.click(screen.getByRole('button', { name: 'Use selection' }));
      expect(props.onUsePassageFromExcerpt).toHaveBeenCalledTimes(1);
      expect(props.onUsePassageFromSelection).toHaveBeenCalledTimes(1);
      expect(props.onUseSelection).not.toHaveBeenCalled();
      expect(screen.queryByRole('mark')).toBeNull();
    });

    it('disables Use excerpt without an active excerpt and shows the honest truncation notice', () => {
      renderModal({ canUsePassageFromExcerpt: false, passageNotice: 'That passage was longer than 250,000 characters, so the box holds its first 250,000.' });

      expect((screen.getByRole('button', { name: 'Use excerpt' }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText(/longer than 250,000 characters/)).toBeTruthy();
      expect(screen.getByText('none · beat travels alone')).toBeTruthy();
    });

    it('offers the context as a multi-select of room sources and toggles each through the callback', () => {
      const props = renderModal({
        draft: { ...ungeneratedShowVsTellDraft(), surroundingContext: { writerText: '', sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-2' }] } },
        availableSources: sources
      });
      const boxes = within(screen.getByRole('group', { name: /Context/ })).getAllByRole('checkbox') as HTMLInputElement[];

      expect(boxes.map((box) => box.checked)).toEqual([true, false, true]);
      expect(screen.queryByRole('radio', { name: /No surrounding passage/ })).toBeNull();
      fireEvent.click(boxes[1]);
      expect(props.onToggleSourceReference).toHaveBeenCalledWith({ kind: 'context-attachment', attachmentId: 'ctx-1' });
      fireEvent.click(boxes[0]);
      expect(props.onToggleSourceReference).toHaveBeenCalledWith({ kind: 'active-excerpt' });
      expect(screen.getByText('read by the host when you generate · never stored here')).toBeTruthy();
    });

    it('marks an unavailable selected source among the others and names the fix', () => {
      renderModal({
        draft: { ...ungeneratedShowVsTellDraft(), surroundingContext: { writerText: '', sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-9' }] } },
        availableSources: sources,
        generateBlockers: ['source-unavailable']
      });

      expect(screen.getByText('Context attachment ctx-9 — unavailable')).toBeTruthy();
      expect((screen.getByRole('checkbox', { name: /ctx-9 — unavailable/ }) as HTMLInputElement).checked).toBe(true);
      expect(screen.getByText('Untick the unavailable context source before generating.')).toBeTruthy();
    });
  });

  describe('channels and length budget', () => {
    it('names the POV limit on the interiority chip', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /interiority/ }).textContent)
        .toBe('interiorityPOV character’s inference only');
      cleanup();
      renderModal({
        draft: { ...ungeneratedShowVsTellDraft(), pov: { mode: 'close-third', focalCharacter: 'Daniel' } }
      });
      expect(screen.getByRole('button', { name: /interiority/ }).textContent)
        .toBe('interiorityDaniel’s inference only');
      expect(screen.getByText(/never another character’s mind/)).toBeTruthy();
    });

    it('toggles channels with no lock on the last one, and picks one of four budgets (D4)', () => {
      const props = renderModal();
      const action = screen.getByRole('button', { name: 'observable action' });
      const sense = screen.getByRole('button', { name: 'sensory evidence' });

      expect(action.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'dialogue / subtext' }).getAttribute('aria-pressed'))
        .toBe('false');
      fireEvent.click(sense);
      expect(props.onToggleChannel).toHaveBeenCalledWith('sensory-evidence');

      cleanup();
      const single = renderModal({ draft: { ...ungeneratedShowVsTellDraft(), channels: ['observable-action'] } });
      const last = screen.getByRole('button', { name: 'observable action' }) as HTMLButtonElement;
      expect(last.getAttribute('aria-pressed')).toBe('true');
      expect(last.getAttribute('aria-disabled')).toBeNull();
      expect(last.disabled).toBe(false);
      expect(last.title).toBe('');
      fireEvent.click(last);
      expect(single.onToggleChannel).toHaveBeenCalledWith('observable-action');

      cleanup();
      const budgetProps = renderModal();
      const budgets = within(screen.getByRole('radiogroup', { name: 'Length budget' })).getAllByRole('radio');
      expect(budgets.map((budget) => budget.textContent))
        .toEqual(['tighter', 'same length', '+1 sentence', '+1 paragraph']);
      expect(budgets[1].getAttribute('aria-checked')).toBe('true');
      fireEvent.click(budgets[3]);
      expect(budgetProps.onLengthBudgetChange).toHaveBeenCalledWith('plus-one-paragraph');
    });
  });

  describe('zero channels and no must survive (D3, D4)', () => {
    it('says no emphasis, keeps every chip unlocked, and lets Generate fire with a blank must survive', () => {
      const props = renderModal({
        draft: {
          ...ungeneratedShowVsTellDraft(),
          channels: [],
          invariants: { mustSurvive: '', mustNotChange: '' }
        },
        generateBlockers: []
      });

      expect(screen.getByText(/No emphasis:/)).toBeTruthy();
      for (const chip of within(screen.getByRole('group', { name: 'Channels to emphasize' })).getAllByRole('button')) {
        expect(chip.getAttribute('aria-pressed')).toBe('false');
        expect((chip as HTMLButtonElement).disabled).toBe(false);
      }
      const generate = screen.getByRole('button', { name: /Generate the workup/ }) as HTMLButtonElement;
      expect(generate.disabled).toBe(false);
      fireEvent.click(generate);
      expect(props.onGenerate).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/never another character’s mind/)).toBeTruthy();
    });
  });

  describe('generation', () => {
    it('shows the seam copy and Generate before a workup, with a written reason when blocked', () => {
      renderModal({ generateBlockers: ['beat-required'] });
      const generate = screen.getByRole('button', { name: /Generate the workup/ });

      expect((generate as HTMLButtonElement).disabled).toBe(true);
      expect(generate.getAttribute('aria-describedby'))
        .toBe(screen.getByText(/Add the beat to explore\./).id);
      expect(screen.getByText(/deterministic scaffold · one model call, fast tier · commit never re-runs it/))
        .toBeTruthy();
    });

    it('fires Generate and, once a workup exists, becomes a ghost Regenerate', () => {
      const props = renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Generate the workup/ }));
      expect(props.onGenerate).toHaveBeenCalledTimes(1);

      cleanup();
      renderModal({ draft: generatedShowVsTellDraft() });
      const regenerate = screen.getByRole('button', { name: /Regenerate the workup/ });
      expect(regenerate.className).toContain('pm-ws-svt-gen-ghost');
      expect(screen.getByText(/clears kept variants and carry modes/)).toBeTruthy();
    });

    it('shows the busy copy and a cancel affordance while generating', () => {
      const props = renderModal({
        generation: { kind: 'generating', detail: 'Receiving the workup · 1,000 characters' }
      });

      expect(screen.getByText('Receiving the workup · 1,000 characters…')).toBeTruthy();
      expect(screen.getByText(/One fast model call…/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel generation' }));
      expect(props.onCancelGenerate).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: /Generate the workup/ })).toBeNull();
    });

    it('surfaces a host failure verbatim as an alert', () => {
      renderModal({ generation: { kind: 'failed', message: 'OpenRouter API key not configured. Please set your API key in settings.' } });

      expect(screen.getByRole('alert').textContent)
        .toBe('OpenRouter API key not configured. Please set your API key in settings.');
    });

    it('explains an invalidation when the workup was cleared', () => {
      renderModal({ invalidationNotice: 'Generated workup cleared because the beat changed.' });

      expect(screen.getByRole('status').textContent)
        .toBe('Generated workup cleared because the beat changed.');
    });
  });

  describe('workup', () => {
    it('renders four fixed groups in order with headers and sub-labels', () => {
      renderModal({ draft: generatedShowVsTellDraft() });
      const groups = screen.getAllByRole('region').filter((region) => region.className === 'pm-ws-svt-group');

      expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
        'Told, cleanly',
        'Shown as evidence',
        'Shown from inside',
        'Mixed — tell the bridge, show the fulcrum'
      ]);
      expect(screen.getAllByText('compress / explain')).toHaveLength(2);
      expect(screen.getByText('the hinge')).toBeTruthy();
      expect(screen.getByText("POV-legal — the POV character's read, not another's mind")).toBeTruthy();
    });

    it('renders prose, channels, gains, costs, direction, and word count on each card', () => {
      renderModal({ draft: generatedShowVsTellDraft() });
      const card = screen.getByRole('article', { name: 'Variant 3' });

      expect(card.textContent).toContain('She took the mug with her left hand and kept the right one on the doorframe.');
      expect(card.textContent).toContain('observable action');
      expect(card.textContent).toContain('Gains Deniability: nothing is claimed, so nothing can be argued with.');
      expect(card.textContent).toContain('Costs Precision: some readers will only see a woman holding a door.');
      expect(card.textContent).toContain('Directionguard as body fact — hand, doorframe; claim nothing');
      expect(within(card).getByText('16 w')).toBeTruthy();
    });

    it('renders gains and costs as text, never as HTML', () => {
      const draft = generatedShowVsTellDraft();
      draft.workup!.groups[0].variants[0].gains = '<b>bold</b> <img src=x onerror=alert(1)> **md**';
      draft.workup!.groups[0].variants[0].costs = '<script>alert(1)</script>';
      renderModal({ draft });
      const card = screen.getByRole('article', { name: 'Variant 1' });

      expect(card.textContent).toContain('<b>bold</b> <img src=x onerror=alert(1)> **md**');
      expect(card.textContent).toContain('<script>alert(1)</script>');
      expect(card.querySelector('img, script')).toBeNull();
      // The only <b> elements are the UI-supplied labels.
      expect([...card.querySelectorAll('b')].map((node) => node.textContent))
        .toEqual(['Direction', 'Gains', 'Costs']);
    });

    it('preserves multi-line prose', () => {
      renderModal({ draft: generatedShowVsTellDraft() });
      const prose = screen.getByRole('article', { name: 'Variant 6' }).querySelector('blockquote')!;

      expect(prose.textContent).toContain('“Ask me the real question,” she said.\n“I don’t have a real question.”');
    });

    it('draws flags passively: a hard conflict warns but never blocks keeping', () => {
      renderModal({ draft: generatedShowVsTellDraft() });
      const conflicted = screen.getByRole('article', { name: 'Variant 4' });

      expect(conflicted.textContent).toContain('Hard conflict with Must not change: The lilies may pull the scene toward a flashback.');
      expect(within(conflicted).getByText(/Strong warning/)).toBeTruthy();
      expect((within(conflicted).getByRole('checkbox', { name: 'Keep variant 4' }) as HTMLButtonElement).disabled)
        .toBe(false);
      expect(screen.getByRole('article', { name: 'Variant 3' }).textContent)
        .toContain('Advisory for Must survive: The guard may read as fear rather than old distrust.');
    });

    it('keeps with a checkbox and shows the carry toggle only for kept variants', () => {
      const props = renderModal({ draft: keptDraft([[3, 'direction'], [7, 'prose']]) });

      const kept3 = screen.getByRole('checkbox', { name: 'Keep variant 3' });
      expect(kept3.getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('checkbox', { name: 'Keep variant 2' }).getAttribute('aria-checked')).toBe('false');
      expect(screen.queryByRole('group', { name: 'Carry mode for variant 2' })).toBeNull();

      const carry3 = screen.getByRole('group', { name: 'Carry mode for variant 3' });
      expect(carry3.textContent).toBe('commit asprose variantdirection only');
      expect(within(carry3).getByRole('button', { name: 'direction only' }).getAttribute('aria-pressed')).toBe('true');
      expect(within(carry3).getByRole('button', { name: 'prose variant' }).getAttribute('aria-pressed')).toBe('false');
      const carry7 = screen.getByRole('group', { name: 'Carry mode for variant 7' });
      expect(within(carry7).getByRole('button', { name: 'prose variant' }).getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(within(carry3).getByRole('button', { name: 'prose variant' }));
      expect(props.onCarryModeChange).toHaveBeenCalledWith(fixtureVariantId(3), 'prose');
      fireEvent.click(screen.getByRole('checkbox', { name: 'Keep variant 2' }));
      expect(props.onToggleKeep).toHaveBeenCalledWith(fixtureVariantId(2));
    });

    it('edits the single-line note and keeps it in the payload strip', () => {
      const props = renderModal({ draft: generatedShowVsTellDraft() });
      const note = screen.getByRole('textbox', { name: /Note to the room/ });

      expect(note.tagName).toBe('INPUT');
      expect(note.getAttribute('maxLength')).toBe('160');
      fireEvent.change(note, { target: { value: 'new' } });
      expect(props.onNoteChange).toHaveBeenCalledWith('new');
    });
  });

  describe('payload meter and commit', () => {
    it('reads "nothing kept yet" with no usage', () => {
      renderModal({ draft: { ...generatedShowVsTellDraft(), kept: [] } });

      expect(screen.getByText('nothing kept yet — commit stays off')).toBeTruthy();
      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('prints the projection’s exact lines and a count equal to its length', () => {
      const draft = generatedShowVsTellDraft();
      const usage = usageFor(draft);
      renderModal({ draft, artifactUsage: usage, commitBlockers: [] });

      const lines = screen.getByLabelText('Artifact lines that would commit');
      expect(lines.textContent).toBe(buildShowVsTellArtifact(draft));
      expect(screen.getByText(`${usage.characters.toLocaleString()} / 600 chars`)).toBeTruthy();
      const meter = screen.getByRole('progressbar', { name: 'Commit payload budget' });
      expect(meter.getAttribute('aria-valuenow')).toBe(String(usage.characters));
      expect(meter.getAttribute('aria-valuemax')).toBe('600');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('turns red past 600 with an accessible blocker that explains the fix', () => {
      const draft = generatedShowVsTellDraft();
      const over = { text: 'x'.repeat(640), characters: 640, budget: 600 };
      renderModal({
        draft,
        artifactUsage: over,
        commitBlockers: ['over-artifact-budget']
      });

      const counter = screen.getByText('640 / 600 chars');
      expect(counter.className).toContain('pm-ws-svt-payload-over');
      const meter = screen.getByRole('progressbar', { name: 'Commit payload budget' });
      expect(meter.className).toContain('pm-ws-svt-meter-over');
      expect(meter.getAttribute('aria-valuenow')).toBe('600');
      const blocker = screen.getByRole('alert');
      expect(blocker.textContent).toBe(
        'Over the 600-character ceiling by 40. Switch kept variants to direction only, keep fewer, or shorten the note.'
      );
      expect(meter.getAttribute('aria-describedby')).toBe(blocker.id);
    });

    it('keeps Commit disabled while any blocker stands, and names the first', () => {
      const props = renderModal({
        draft: keptDraft([[3, 'direction']]),
        artifactUsage: usageFor(keptDraft([[3, 'direction']])),
        commitBlockers: ['room-run-active', 'tool-target']
      });
      const commit = screen.getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement;

      expect(commit.disabled).toBe(true);
      expect(commit.getAttribute('aria-describedby')).toBe(
        screen.getByText('Wait for the current Workshop response to finish before committing.').id
      );
      fireEvent.click(commit);
      expect(props.onCommit).not.toHaveBeenCalled();
    });

    it('enables Commit exactly when no blocker stands, and commits once per click', () => {
      const props = renderModal({
        draft: keptDraft([[3, 'direction']]),
        artifactUsage: usageFor(keptDraft([[3, 'direction']])),
        commitBlockers: []
      });
      const commit = screen.getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement;

      expect(commit.disabled).toBe(false);
      expect(commit.getAttribute('aria-describedby')).toBeNull();
      fireEvent.click(commit);
      expect(props.onCommit).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['generation-in-flight', 'Generation is still running.'],
      ['room-run-active', 'Wait for the current Workshop response to finish before committing.'],
      ['tool-target', 'Switch to a persona target before committing — tool sidecars do not take craft directions.'],
      ['no-workup', 'Generate a workup before committing.'],
      ['no-keep', 'Keep at least one variant to commit.']
    ] as const)('explains the %s blocker', (blocker, copy) => {
      renderModal({ commitBlockers: [blocker] });

      expect(screen.getByText(copy)).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement).disabled)
        .toBe(true);
    });

    it('locks the sheet while a commit is in flight and says so on the button', () => {
      const props = renderModal({
        draft: keptDraft([[3, 'direction']]),
        commitBlockers: ['commit-in-flight'],
        commitPending: true
      });

      const commit = screen.getByRole('button', { name: 'Committing…' }) as HTMLButtonElement;
      expect(commit.disabled).toBe(true);
      expect(commit.getAttribute('aria-describedby')).toBeNull();
      expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Regenerate the workup' }) as HTMLButtonElement).disabled)
        .toBe(true);
      expect(screen.queryByText('Committing…', { selector: 'span' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('shows the host refusal and keeps the draft in view', () => {
      renderModal({
        draft: keptDraft([[3, 'direction']]),
        commitBlockers: [],
        commitError: 'The commit payload is over its 600-character ceiling.'
      });

      expect(screen.getByRole('alert').textContent).toBe(
        'The commit payload is over its 600-character ceiling.'
      );
      expect((screen.getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement).disabled)
        .toBe(false);
    });

    it('labels the button Commit as new turn when reopened from a chip, with the committed-turn banner', () => {
      renderModal({
        draft: keptDraft([[3, 'direction']]),
        commitBlockers: [],
        banner: { kind: 'clone', from: 'committed-turn' }
      });

      expect(screen.queryByRole('button', { name: 'Commit to thread' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Commit as new turn' })).toBeTruthy();
      expect(document.querySelector('.pm-ws-svt-banner-clone')!.textContent).toBe(
        'Re-opened from a committed turn. The old chip stays as history — committing again creates a new turn at the head.'
      );
    });

    it('shows the rewound-message banner and the same new-turn label', () => {
      renderModal({
        draft: keptDraft([[3, 'direction']]),
        commitBlockers: [],
        banner: { kind: 'clone', from: 'rewound-message' }
      });

      expect(document.querySelector('.pm-ws-svt-banner-clone')!.textContent).toBe(
        'Reopened from a message you rewound. Adjust it, then commit to send it again as a new turn at the head.'
      );
      expect(screen.getByRole('button', { name: 'Commit as new turn' })).toBeTruthy();
    });

    it('names the persona on the seed banner without any pronoun, and commits to the thread', () => {
      renderModal({
        draft: keptDraft([[3, 'direction']]),
        commitBlockers: [],
        banner: { kind: 'seed', personaLabel: 'Margot' }
      });

      const text = document.querySelector('.pm-ws-svt-banner-seed')!.textContent!;
      expect(text).toBe(
        'Recommended and prefilled by Margot. Margot spotted a told beat worth testing — proposing and prefilling is as far as a persona goes; you decide what commits.'
      );
      expect(text).not.toMatch(/\b(she|he|her|his|him|hers|they|them|their)\b/i);
      expect(screen.getByRole('button', { name: 'Commit to thread' })).toBeTruthy();
      expect(document.querySelector('.pm-ws-svt-banner-clone')).toBeNull();
    });

    it('shows no banner for a fresh draft', () => {
      renderModal();

      expect(document.querySelector('.pm-ws-svt-banner')).toBeNull();
    });

    it('names the over-ceiling fix as the commit reason when that is the first blocker', () => {
      renderModal({
        draft: keptDraft([[3, 'direction']]),
        artifactUsage: { text: 'x'.repeat(601), characters: 601, budget: 600 },
        commitBlockers: ['over-artifact-budget']
      });

      expect(document.getElementById('pm-ws-svt-commit-reason')!.textContent)
        .toBe('The commit payload is over its 600-character ceiling — switch variants to direction only, keep fewer, or shorten the note.');
    });

    it('summarises the kept count in the footer', () => {
      renderModal({ draft: keptDraft([[3, 'direction'], [7, 'prose']]), commitBlockers: [] });

      expect(screen.getByText('· 2 kept · 1 as direction')).toBeTruthy();
    });
  });

  it('routes Cancel and the close affordance to onClose, cancelling a running generation first', () => {
    const props = renderModal({ generation: { kind: 'generating' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onCancelGenerate).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
