/**
 * An edit suggestion from its trailer to its card (epic Slice 6c): the
 * decoder's grammar and refusals, the exact-once anchor, and settling
 * against the listing (target standing, the phrasing fence on the result,
 * the pinned budget, the hold, duplicates and the cap). Pure. *Alice*.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { projectMemoryBody } from '@shared/types/projectMemory';
import { decodeWorkshopMemoryProposal } from '@/utils/workshopMemoryProposalProtocol';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { anchorWorkshopMemoryEdit, findExactlyOnce } from '@/application/services/workshop/memory/WorkshopMemoryEditAnchor';
import { listProjectMemories } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import { projectMemoryVersion } from '@/application/services/workshop/memory/ProjectMemoryVersion';
import { settleWorkshopMemoryProposals } from '@/application/services/workshop/memory/WorkshopReplyMemory';
import type { WorkshopMemoryEditDraft } from '@/utils/workshopMemoryEditProtocol';
import { memoryFrame } from './memoryProposalFixtures';
import { memory } from './projectMemoryLibraryHost';

const OPEN = { memoryOpen: true } as const;
const budgets = PROMPT_BUDGETS.workshopProjectMemory;
const NOTE = memory({ body: projectMemoryBody('Settled at the tea party. The reader notices before Alice does.') });

/** An edit frame's inside. */
const edit = (...elements: string[]) => `<edit>${NOTE.id}</edit>\n${elements.join('\n')}`;
const frame = (...elements: string[]) => `<prose-minion-memory-proposal>\n${edit(...elements)}\n</prose-minion-memory-proposal>`;
const decoded = (...elements: string[]) => decodeWorkshopMemoryProposal(edit(...elements));
const draftOf = (...elements: string[]): WorkshopMemoryEditDraft => {
  const result = decoded(...elements);
  if (result.kind !== 'edit') {
    throw new Error(`not an edit: ${JSON.stringify(result)}`);
  }
  return result.edit;
};

describe('the edit trailer', () => {
  it('reads every operation, in the order written', () => {
    expect(draftOf(
      '<title>The Rabbit\'s watch, backward</title>',
      '<kind>theme</kind>',
      '<find-in-summary>chapter 3</find-in-summary>',
      '<replace-with>chapter 2</replace-with>',
      '<find-in-body>The reader</find-in-body>',
      '<replace-with></replace-with>',
      '<prepend>First.</prepend>',
      '<append>Last.</append>'
    )).toEqual({
      proposes: 'edit',
      target: NOTE.id,
      operations: [
        { op: 'rewrite', field: 'title', value: 'The Rabbit\'s watch, backward' },
        { op: 'rewrite', field: 'kind', value: 'theme' },
        { op: 'replace', field: 'summary', find: 'chapter 3', with: 'chapter 2' },
        { op: 'replace', field: 'body', find: 'The reader', with: '' },
        { op: 'prepend', text: 'First.' },
        { op: 'append', text: 'Last.' }
      ]
    });
  });

  it.each<[string, string[]]>([
    ['invalid-edit-target', ['<title>T</title>'].map(String)],
    ['repeated-element', [`<edit>${NOTE.id}</edit>`, '<title>T</title>']],
    ['edit-supersedes', ['<summary>S</summary>', '<supersedes>mem-1a9e04</supersedes>']],
    ['empty-edit', []],
    ['empty-edit', ['<append>  </append>']],
    ['unpaired-find', ['<find-in-body>tea</find-in-body>']],
    ['unpaired-find', ['<find-in-body>tea</find-in-body>', '<append>x</append>', '<replace-with>y</replace-with>']],
    ['unpaired-find', ['<replace-with>y</replace-with>']],
    ['empty-find', ['<find-in-body> </find-in-body>', '<replace-with>y</replace-with>']],
    ['too-many-replaces', Array.from({ length: budgets.editReplaces + 1 }, (_, i) => `<find-in-body>w${i}</find-in-body><replace-with>v</replace-with>`)],
    ['conflicting-operations', ['<summary>S</summary>', '<find-in-summary>chapter</find-in-summary>', '<replace-with>x</replace-with>']],
    ['conflicting-operations', ['<body>B</body>', '<append>x</append>']],
    ['repeated-element', ['<append>a</append>', '<append>b</append>']],
    ['repeated-element', ['<title>A</title>', '<title>B</title>']],
    ['missing-title', ['<title> </title>']],
    ['invalid-kind', ['<kind>secret</kind>']],
    ['summary-not-one-line', ['<summary>Two\nlines</summary>']],
    ['title-too-long', [`<title>${'x'.repeat(budgets.titleCharacters + 1)}</title>`]],
    ['provenance', ['<summary>S</summary>', '<proposed-by>cliff</proposed-by>']]
  ])('%s', (fault, elements) => {
    const inner = fault === 'invalid-edit-target' ? `<edit>the watch note</edit>\n${elements.join('\n')}` : edit(...elements);
    expect(decodeWorkshopMemoryProposal(inner)).toEqual({ kind: 'rejected', fault });
  });

  it('allows the replace cap exactly', () => {
    const pairs = Array.from({ length: budgets.editReplaces }, (_, i) => `<find-in-body>w${i}</find-in-body><replace-with>v</replace-with>`);
    expect(decoded(...pairs).kind).toBe('edit');
  });

  it('refuses an edit\'s elements in a frame without <edit>', () => {
    expect(decodeWorkshopMemoryProposal('<title>T</title><kind>canon</kind><summary>S</summary><append>x</append>'))
      .toEqual({ kind: 'rejected', fault: 'edit-element' });
  });

  it('a second edit of the same note in one reply is a duplicate; an edit counts toward the cap', () => {
    const one = frame('<append>One.</append>');
    const two = frame('<append>Two.</append>');
    const controls = extractWorkshopReplyControls(`Good.\n\n${one}\n${two}`, OPEN);
    expect(controls.memory).toMatchObject({ kind: 'frames', rejections: ['duplicate'] });
    const many = Array.from({ length: budgets.proposalsPerReply }, (_, i) => memoryFrame({ title: `Note ${i}` })).join('\n');
    const capped = extractWorkshopReplyControls(`Good.\n\n${many}\n${one}`, OPEN);
    expect(capped.memory).toMatchObject({ rejections: ['over-cap'] });
  });
});

describe('anchoring a quote exactly once', () => {
  it('finds none, one, or more than one (counted overlapping)', () => {
    expect(findExactlyOnce('tea party', 'cake')).toEqual({ count: 0 });
    expect(findExactlyOnce('tea party', 'party')).toEqual({ start: 4 });
    expect(findExactlyOnce('tea and tea', 'tea')).toEqual({ count: 2 });
    expect(findExactlyOnce('aaa', 'aa')).toEqual({ count: 2 });
  });

  it('refuses a quote the note does not hold, or holds twice', () => {
    expect(anchorWorkshopMemoryEdit(draftOf('<find-in-body>cake</find-in-body>', '<replace-with>x</replace-with>'), NOTE))
      .toEqual({ kind: 'refused', reason: 'find-missing' });
    const twice = memory({ body: 'Tea, then more tea.' });
    expect(anchorWorkshopMemoryEdit(draftOf('<find-in-body>ea</find-in-body>', '<replace-with>x</replace-with>'), twice))
      .toEqual({ kind: 'refused', reason: 'find-ambiguous' });
  });

  it('applies replaces in sequence, each found in the note as it stands', () => {
    const result = anchorWorkshopMemoryEdit(draftOf(
      '<find-in-body>The reader</find-in-body>', '<replace-with>Alice</replace-with>',
      '<find-in-body>before Alice does</find-in-body>', '<replace-with>first</replace-with>',
      '<find-in-summary>chapter 3</find-in-summary>', '<replace-with>chapter 2</replace-with>'
    ), NOTE);
    expect(result).toMatchObject({
      kind: 'anchored',
      after: { body: 'Settled at the tea party. Alice notices first.', summary: 'From chapter 2 on, the White Rabbit\'s watch runs backward.' },
      before: { body: 'Settled at the tea party. The reader notices before Alice does.' }
    });
  });

  it('never finds a quote in text an earlier replace wrote', () => {
    const draft = draftOf('<find-in-body>tea party</find-in-body>', '<replace-with>croquet game</replace-with>',
      '<find-in-body>croquet</find-in-body>', '<replace-with>x</replace-with>');
    expect(anchorWorkshopMemoryEdit(draft, NOTE)).toEqual({ kind: 'refused', reason: 'find-missing' });
  });

  it('refuses replaces whose quotes overlap', () => {
    const draft = draftOf('<find-in-body>the tea party</find-in-body>', '<replace-with>x</replace-with>',
      '<find-in-body>party. The</find-in-body>', '<replace-with>y</replace-with>');
    expect(anchorWorkshopMemoryEdit(draft, NOTE)).toEqual({ kind: 'refused', reason: 'replaces-overlap' });
  });

  it('rewrites, prepends and appends', () => {
    expect(anchorWorkshopMemoryEdit(draftOf('<prepend>First.</prepend>', '<append>Last.</append>'), NOTE)).toMatchObject({
      after: { body: 'First.\n\nSettled at the tea party. The reader notices before Alice does.\n\nLast.' }
    });
    expect(anchorWorkshopMemoryEdit(draftOf('<kind>theme</kind>', '<body></body>'), NOTE)).toMatchObject({ after: { kind: 'theme', body: '' } });
  });

  it('holds the result to the field rules, and refuses a change that changes nothing', () => {
    expect(anchorWorkshopMemoryEdit(draftOf('<find-in-summary>chapter 3</find-in-summary>', '<replace-with>one\ntwo</replace-with>'), NOTE))
      .toEqual({ kind: 'refused', reason: 'summary-not-one-line' });
    expect(anchorWorkshopMemoryEdit(draftOf(`<append>${'x'.repeat(budgets.bodyCharacters)}</append>`), NOTE))
      .toEqual({ kind: 'refused', reason: 'body-too-long' });
    expect(anchorWorkshopMemoryEdit(draftOf(`<find-in-summary>${NOTE.summary}</find-in-summary>`, '<replace-with></replace-with>'), NOTE))
      .toEqual({ kind: 'refused', reason: 'summary-emptied' });
    expect(anchorWorkshopMemoryEdit(draftOf(`<title>${NOTE.title}</title>`), NOTE)).toEqual({ kind: 'refused', reason: 'unchanged' });
  });
});

describe('settling an edit against the listing', () => {
  const DEFAULT = listProjectMemories([{ memory: NOTE }]);
  const settle = (reply: string, memories: ReturnType<typeof listProjectMemories> | null = DEFAULT) =>
    settleWorkshopMemoryProposals(extractWorkshopReplyControls(reply, OPEN).memory,
      { open: true, mode: 'ask', ...(memories ? { memories } : {}) });

  it('becomes a pending edit card naming its target, its version, and what the note said', () => {
    const settled = settle(`Good.\n\n${frame('<find-in-body>The reader</find-in-body>', '<replace-with>Alice</replace-with>')}`);
    expect(settled.proposals).toEqual([{
      proposes: 'edit',
      title: NOTE.title,
      kind: NOTE.kind,
      summary: NOTE.summary,
      body: 'Settled at the tea party. Alice notices before Alice does.',
      state: 'pending',
      target: { id: NOTE.id, version: projectMemoryVersion(NOTE, false), pinned: false },
      before: { title: NOTE.title, kind: NOTE.kind, summary: NOTE.summary, body: 'Settled at the tea party. The reader notices before Alice does.' }
    }]);
    expect(settled.autoSave).toEqual([]);
    expect(settled.logs).toEqual([`Memory edit pending (target=${NOTE.id}; changes=body; operations=replace)`]);
  });

  it.each<[string, () => ReturnType<typeof listProjectMemories> | undefined]>([
    ['listing-unread', () => undefined],
    ['unknown-target', () => listProjectMemories([{ memory: memory({ id: 'mem-000009' }) }])],
    ['archived-target', () => listProjectMemories([{ memory: { ...NOTE, status: 'archived' } }])],
    ['superseded-target', () => listProjectMemories([{ memory: NOTE }, { memory: memory({ id: 'mem-000002', supersedes: [NOTE.id] }) }])],
    ['busy-target', () => listProjectMemories([{ memory: NOTE, busy: true }])],
    ['find-missing', () => listProjectMemories([{ memory: { ...NOTE, body: 'Someone rewrote it.' } }])]
  ])('drops it, logged by reason: %s', (reason, listing) => {
    const settled = settle(`Good.\n\n${frame('<find-in-body>The reader</find-in-body>', '<replace-with>Alice</replace-with>')}`, listing() ?? null);
    expect(settled.proposals).toEqual([]);
    expect(settled.logs).toEqual([`Memory edit dropped (target=${NOTE.id}; reason=${reason})`]);
  });

  it('checks the result, not the trailer, against the phrasing fence (D9)', () => {
    const settled = settle(`Good.\n\n${frame('<append>You seem anxious about the ending lately.</append>')}`);
    expect(settled.proposals).toEqual([]);
    expect(settled.logs).toEqual([`Memory edit withheld (target=${NOTE.id}; reason=personal-inference)`]);
  });

  it('refuses a change that would take the memories loaded in full past their budget', () => {
    const pinned = { ...NOTE, pinned: true };
    const others = Array.from({ length: 4 }, (_, i) => memory({ id: `mem-00000${i}`, pinned: true, body: 'x '.repeat(3_000) }));
    const listing = listProjectMemories([{ memory: pinned }, ...others.map((other) => ({ memory: other }))]);
    const settled = settle(`Good.\n\n${frame(`<append>${'Tea. '.repeat(1_500)}</append>`)}`, listing);
    expect(settled.logs).toEqual([`Memory edit dropped (target=${NOTE.id}; reason=pinned-budget)`]);
  });

  it('always waits: under Save and tell me it is held "edit", and asks for no save, whatever else saves', () => {
    const run = { webResearchAttached: false, autoSavesInRoom: () => 0 };
    const reply = `Good.\n\n${memoryFrame({ title: 'Tea is at six' })}\n${frame('<append>Also at six.</append>')}`;
    const settled = settleWorkshopMemoryProposals(extractWorkshopReplyControls(reply, OPEN).memory,
      { open: true, mode: 'auto', memories: listProjectMemories([{ memory: NOTE }]) }, run);
    expect(settled.proposals.map((proposal) => [proposal.proposes, proposal.held])).toEqual([['new', undefined], ['edit', 'edit']]);
    expect(settled.autoSave).toEqual([0]);
  });

  it('logs ids and reasons, never the note\'s or the edit\'s text', () => {
    const settled = settle(`Good.\n\n${frame('<find-in-body>The reader</find-in-body>', '<replace-with>SENTINEL-EDIT-TEXT</replace-with>')}`);
    expect(settled.logs.join('\n')).not.toMatch(/SENTINEL|tea party|Rabbit/);
  });
});
