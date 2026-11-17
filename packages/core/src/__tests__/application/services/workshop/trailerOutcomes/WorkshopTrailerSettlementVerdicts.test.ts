/**
 * Settlement returns typed verdicts (ADR 2026-11-17 D13; PR #269 F-01): a
 * frame that ends with no card always carries a closed reason, and the log
 * line is written from it. The lines are the ones settlement wrote before
 * the verdicts were typed, byte for byte. *Alice*.
 */

import { settleWorkshopMemoryProposals } from '@/application/services/workshop/memory/WorkshopReplyMemory';
import { settleWorkshopMemoryEdit } from '@/application/services/workshop/memory/WorkshopReplyMemoryEdit';
import { resolveWorkshopReplyFileEdits } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import { decodeWorkshopMemoryProposal } from '@/utils/workshopMemoryProposalProtocol';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { fakeFileEditStaging, fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { EDIT_NOTE, EDIT_NOTE_LISTED, editFrame, MEMORY_EDIT_DROP_CASES } from './memoryEditDropCases';

const OPEN = { memoryOpen: true } as const;

describe('a memory edit\'s settlement verdict', () => {
  it.each(MEMORY_EDIT_DROP_CASES.map((entry) => [entry.reason, entry] as const))('%s: dropped with that reason, and today\'s log line', (reason, entry) => {
    const controls = extractWorkshopReplyControls(`Good.\n\n${editFrame(...entry.elements)}`, OPEN);
    const settled = settleWorkshopMemoryProposals(controls.memory, { open: true, mode: 'ask', ...(entry.listing ? { memories: entry.listing } : {}) });
    expect(settled.proposals).toEqual([]);
    expect(settled.drops).toEqual([{ at: 'settlement', reason }]);
    expect(settled.logs).toEqual([`Memory edit dropped (target=${EDIT_NOTE.id}; reason=${reason})`]);
  });

  it('a draft whose operations conflict is dropped by the planner\'s own name for it', () => {
    // The decoder refuses this first; settlement still names it when handed one.
    const settled = settleWorkshopMemoryEdit({
      proposes: 'edit',
      target: EDIT_NOTE.id,
      operations: [{ op: 'rewrite', field: 'summary', value: 'S' }, { op: 'replace', field: 'summary', find: 'chapter 3', with: 'chapter 2' }]
    }, EDIT_NOTE_LISTED, undefined, undefined);
    expect(settled).toEqual({
      kind: 'dropped',
      reason: 'conflicting-operations',
      log: `Memory edit dropped (target=${EDIT_NOTE.id}; reason=conflicting-operations)`
    });
  });

  it('an edit that lands is a card, with today\'s log line', () => {
    const decoded = decodeWorkshopMemoryProposal(`<edit>${EDIT_NOTE.id}</edit>\n<append>Also at six.</append>`);
    if (decoded.kind !== 'edit') {
      throw new Error('not an edit');
    }
    const settled = settleWorkshopMemoryEdit(decoded.edit, EDIT_NOTE_LISTED, undefined, undefined);
    expect(settled.kind).toBe('card');
    expect(settled.log).toBe(`Memory edit pending (target=${EDIT_NOTE.id}; changes=body; operations=append)`);
  });
});

describe('a reply\'s memory frames, each counted once', () => {
  it('read-time rejections and settlement drops are typed, beside the cards', () => {
    const cap = PROMPT_BUDGETS.workshopProjectMemory.proposalsPerReply;
    const reply = [
      'Good.',
      '',
      '<prose-minion-memory-proposal><title>No kind</title></prose-minion-memory-proposal>',
      memoryFrame({ title: 'Tea is at six' }),
      memoryFrame({ title: 'Tea is at six' }),
      editFrame('<find-in-body>the Queen</find-in-body>', '<replace-with>Alice</replace-with>'),
      ...Array.from({ length: cap }, (_, index) => memoryFrame({ title: `Croquet rule ${index}` }))
    ].join('\n');
    const controls = extractWorkshopReplyControls(reply, OPEN);
    const settled = settleWorkshopMemoryProposals(controls.memory, { open: true, mode: 'ask', memories: EDIT_NOTE_LISTED });
    expect(settled.drops).toEqual([
      { at: 'read', reason: expect.stringMatching(/^malformed:/) },
      { at: 'read', reason: 'duplicate' },
      { at: 'read', reason: 'over-cap' },
      { at: 'read', reason: 'over-cap' },
      { at: 'settlement', reason: 'find-missing' }
    ]);
    expect(settled.proposals).toHaveLength(cap - 1);
    expect(settled.proposals.length + settled.drops.length).toBe(cap + 4);
    // One log line per frame, as before.
    expect(settled.logs).toHaveLength(cap + 4);
  });

  it('memory off: every frame is the read-time `memory-off`, with today\'s log lines', () => {
    const controls = extractWorkshopReplyControls(`Good.\n\n${memoryFrame()}\n${editFrame('<append>x</append>')}`, { memoryOpen: false });
    expect(settleWorkshopMemoryProposals(controls.memory, { open: false })).toEqual({
      proposals: [],
      autoSave: [],
      drops: [{ at: 'read', reason: 'memory-off' }, { at: 'read', reason: 'memory-off' }],
      logs: ['Memory proposal dropped (reason=memory-off)', 'Memory proposal dropped (reason=memory-off)']
    });
  });

  it('a reply with no frame has no drop', () => {
    expect(settleWorkshopMemoryProposals(extractWorkshopReplyControls('Just prose.', OPEN).memory, { open: true }).drops).toEqual([]);
  });
});

describe('a reply\'s file-edit frames, each counted once', () => {
  it('two frames staged to one document: the second is the typed `duplicate-identity`, with today\'s log line', async () => {
    // Two different requests the port stages to the same file.
    const staging = fakeFileEditStaging();
    const stage = staging.stage.bind(staging);
    staging.stage = async (target, options) => {
      const result = await stage(target, options);
      return result.kind === 'staged'
        ? { ...result, target: { ...result.target, documentUri: 'file:///ws/characters/alice.md', relativePath: 'characters/alice.md' } }
        : result;
    };
    const reply = `Yes.\n\n${fileEditFrame({ path: 'characters/alice.md' })}\n${fileEditFrame({ path: 'characters/alice-again.md' })}`;
    const context = await resolveWorkshopReplyFileEdits({ reply, open: true, staging });
    expect(context?.proposals).toHaveLength(1);
    expect(context?.drops).toEqual([{ at: 'staging', reason: 'duplicate-identity' }]);
    expect(context?.logs).toEqual([
      'File edit proposal pending (target=file; class=notes; operations=replace)',
      'File edit proposal dropped (reason=duplicate-identity)'
    ]);
  });

  it('read-time rejections are typed, one per frame, beside the cards and refused cards', async () => {
    const staging = fakeFileEditStaging({ refuse: (target) => target.kind === 'excerpt' ? 'excerpt-not-a-file' : undefined });
    const malformed = fileEditFrame({ path: 'characters/b.md', why: null });
    const reply = `Yes.\n\n${malformed}\n${fileEditFrame()}\n${fileEditFrame()}\n${fileEditFrame({ excerpt: true })}`;
    const context = await resolveWorkshopReplyFileEdits({ reply, open: true, staging });
    expect(context?.drops).toEqual([{ at: 'read', reason: 'malformed:missing-why' }, { at: 'read', reason: 'duplicate' }]);
    expect(context?.proposals.map((proposal) => proposal.state)).toEqual(['pending', 'refused']);
    expect(context!.proposals.length + context!.drops.length).toBe(4);
    expect(context?.logs.slice(0, 2)).toEqual([
      'File edit proposal dropped (reason=malformed:missing-why)',
      'File edit proposal dropped (reason=duplicate)'
    ]);
  });

  it('a run stopped before staging counts each decoded frame as `not-staged`, and stages nothing', async () => {
    const staging = fakeFileEditStaging();
    const controller = new AbortController();
    controller.abort();
    const reply = `Yes.\n\n${fileEditFrame({ path: 'characters/b.md', why: null })}\n${fileEditFrame()}\n${fileEditFrame({ path: 'characters/c.md' })}`;
    const context = await resolveWorkshopReplyFileEdits({ reply, open: true, staging, signal: controller.signal });
    expect(staging.calls).toEqual([]);
    expect(context?.proposals).toEqual([]);
    expect(context?.drops).toEqual([
      { at: 'read', reason: 'malformed:missing-why' },
      { at: 'completion', reason: 'not-staged' },
      { at: 'completion', reason: 'not-staged' }
    ]);
  });
});
