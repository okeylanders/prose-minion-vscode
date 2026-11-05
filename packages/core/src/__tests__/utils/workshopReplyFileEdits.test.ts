/**
 * Reading file-edit frames out of a persona's reply (ADR 2026-11-05 D2, D9;
 * epic Slice 3): one pass with memory's frames, so either kind may stand
 * last; frames past the cap are dropped and counted, never the reply; a
 * frame never shows in the bubble's text, the streaming text or retained
 * history; with the setting off, every frame is dropped and counted.
 * Made-up text: Alice.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  extractWorkshopReplyControls,
  sanitizeWorkshopReplyForRetention,
  stripWorkshopReplyTrailersForStreaming,
  WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE,
  WORKSHOP_FILE_EDIT_REDACTION,
  WORKSHOP_MEMORY_PROPOSAL_REDACTION,
  WORKSHOP_TRAILERS_ONLY_REPLY_LINE
} from '@/utils/workshopReplyControls';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';
import { fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';

const CAP = PROMPT_BUDGETS.workshopFileEdits.proposalsPerReply;
const OPEN = { memoryOpen: true, fileEditsOpen: true };
const path = (index: number) => `characters/person-${index}.md`;
const frames = (count: number) => Array.from({ length: count }, (_, index) => fileEditFrame({ path: path(index) })).join('\n');

describe('file-edit frames in a reply', () => {
  it('one frame becomes one edit; the prose is kept, the frame removed and redacted', () => {
    const controls = extractWorkshopReplyControls(`Alice is ten now.\n\n${fileEditFrame()}\n`, OPEN);
    expect(controls.rest).toBe('Alice is ten now.');
    expect(controls.redacted).toBe(`Alice is ten now.\n\n${WORKSHOP_FILE_EDIT_REDACTION}`);
    expect(controls.memory).toEqual({ kind: 'none' });
    expect(controls.fileEdits).toEqual({
      kind: 'frames',
      proposals: [{
        target: { kind: 'resource', group: 'characters', path: 'characters/alice.md' },
        why: 'Alice is ten now.',
        operations: [{ op: 'replace', find: 'Alice is seven', with: 'Alice is ten' }]
      }],
      rejections: []
    });
  });

  it('a reply with no frame has no file edits at all', () => {
    expect(extractWorkshopReplyControls('Just prose.', OPEN)).toEqual({ rest: 'Just prose.', redacted: 'Just prose.', memory: { kind: 'none' } });
  });

  it('several frames are kept in the order written, up to the cap; past it, each is dropped and counted', () => {
    const controls = extractWorkshopReplyControls(`Good.\n\n${frames(CAP + 2)}`, OPEN);
    expect(controls.rest).toBe('Good.');
    expect(controls.fileEdits?.proposals.map((proposal) => proposal.target)).toEqual(
      Array.from({ length: CAP }, (_, index) => ({ kind: 'resource', group: 'characters', path: path(index) }))
    );
    expect(controls.fileEdits?.rejections).toEqual(['over-cap', 'over-cap']);
  });

  it('a second frame for the same file is a duplicate; a malformed one drops only itself', () => {
    const controls = extractWorkshopReplyControls([
      'Good.',
      fileEditFrame(),
      fileEditFrame({ path: 'characters/Alice.md' }),
      fileEditFrame({ path: 'characters/hatter.md', why: null }),
      fileEditFrame({ excerpt: true })
    ].join('\n\n'), OPEN);
    expect(controls.fileEdits?.proposals.map((proposal) => proposal.target)).toEqual([
      { kind: 'resource', group: 'characters', path: 'characters/alice.md' },
      { kind: 'excerpt' }
    ]);
    expect(controls.fileEdits?.rejections).toEqual(['duplicate', 'malformed:missing-why']);
  });

  it('with the setting off, every frame is stripped, dropped and counted, and the prose is kept', () => {
    const controls = extractWorkshopReplyControls(`Good.\n\n${frames(2)}`, { memoryOpen: true, fileEditsOpen: false });
    expect(controls.rest).toBe('Good.');
    expect(controls.fileEdits).toEqual({ kind: 'frames', proposals: [], rejections: ['file-edits-off', 'file-edits-off'] });
    // Absent reads as off.
    expect(extractWorkshopReplyControls(`Good.\n\n${fileEditFrame()}`, { memoryOpen: true }).fileEdits?.rejections).toEqual(['file-edits-off']);
  });

  it('a frame past `frameCharacters` is dropped whole, unread, and never shows', () => {
    const bound = PROMPT_BUDGETS.workshopFileEdits.frameCharacters;
    const huge = fileEditFrame({ body: [`<append>${'a'.repeat(bound)}</append>`] });
    const controls = extractWorkshopReplyControls(`Good.\n\n${huge}\n${fileEditFrame()}`, OPEN);
    expect(controls.rest).toBe('Good.');
    expect(controls.fileEdits?.rejections).toEqual(['oversized']);
    expect(controls.fileEdits?.proposals).toHaveLength(1);
  });

  describe('beside memory frames', () => {
    it('either kind may stand last: both are at the tail, in any order', () => {
      const reply = `Good.\n\n${fileEditFrame()}\n${memoryFrame()}\n${fileEditFrame({ excerpt: true })}`;
      const controls = extractWorkshopReplyControls(reply, OPEN);
      expect(controls.rest).toBe('Good.');
      expect(controls.redacted).toBe(['Good.', WORKSHOP_FILE_EDIT_REDACTION, WORKSHOP_MEMORY_PROPOSAL_REDACTION, WORKSHOP_FILE_EDIT_REDACTION].join('\n\n'));
      expect(controls.memory).toMatchObject({ kind: 'frames', rejections: [] });
      expect(controls.memory.kind === 'frames' && controls.memory.proposals).toHaveLength(1);
      expect(controls.fileEdits?.proposals).toHaveLength(2);
      expect(controls.fileEdits?.rejections).toEqual([]);
    });

    it('each kind counts against its own cap', () => {
      const controls = extractWorkshopReplyControls(`Good.\n\n${frames(CAP)}\n${memoryFrame()}`, OPEN);
      expect(controls.fileEdits?.proposals).toHaveLength(CAP);
      expect(controls.memory.kind === 'frames' && controls.memory.proposals).toHaveLength(1);
    });

    it('a frame of one kind inside the other is nested, and neither is read', () => {
      const inner = fileEditFrame();
      const reply = `Good.\n\n<prose-minion-memory-proposal>\n<title>A</title>\n${inner}\n</prose-minion-memory-proposal>`;
      const controls = extractWorkshopReplyControls(reply, OPEN);
      expect(controls.rest).toBe('Good.');
      expect(controls.memory).toEqual({ kind: 'frames', proposals: [], rejections: ['malformed:nested'] });
      expect(controls.fileEdits).toBeUndefined();
    });

    it('a frame closed by the other kind\'s tag is malformed', () => {
      const reply = 'Good.\n\n<prose-minion-file-edit>\n<excerpt/>\n<why>x</why>\n<append>y</append>\n</prose-minion-memory-proposal>';
      const controls = extractWorkshopReplyControls(reply, OPEN);
      expect(controls.rest).toBe('Good.');
      expect(controls.fileEdits?.rejections).toEqual(['malformed:tag']);
    });
  });

  describe('a frame never shows', () => {
    it.each<[string, string, string]>([
      ['written mid-reply (misplaced)', `Before.\n\n${fileEditFrame()}\n\nAfter.`, 'misplaced'],
      ['unclosed, to the end', `Good.\n\n<prose-minion-file-edit>\n<excerpt/>\n<why>x</why>`, 'malformed:unclosed'],
      ['with attributes', `Good.\n\n<prose-minion-file-edit id="1"><excerpt/></prose-minion-file-edit>`, 'malformed:tag'],
      ['a stray closing tag', 'Good.\n\n</prose-minion-file-edit>', 'malformed:unopened']
    ])('%s', (_name, reply, reason) => {
      const controls = extractWorkshopReplyControls(reply, OPEN);
      expect(controls.rest.toLowerCase()).not.toContain('prose-minion-file-edit');
      expect(controls.redacted.toLowerCase()).not.toContain('prose-minion-file-edit');
      expect(controls.fileEdits?.rejections).toEqual([reason]);
    });

    it('while streaming: a frame being written, or a tag still arriving, is held back', () => {
      expect(stripWorkshopReplyTrailersForStreaming(`Good.\n\n<prose-minion-file-edit>\n<group>chara`)).toBe('Good.');
      expect(stripWorkshopReplyTrailersForStreaming('Good.\n\n<prose-minion-fi')).toBe('Good.');
      expect(stripWorkshopReplyTrailersForStreaming('Good.\n\n</prose-minion-file-edit')).toBe('Good.');
      expect(stripWorkshopReplyTrailersForStreaming('Good. <b>bold</b>')).toBe('Good. <b>bold</b>');
    });

    it('in retained history: stripped, and a reply that was only trailers keeps the host\'s line', () => {
      expect(sanitizeWorkshopReplyForRetention(`Good.\n\n${fileEditFrame()}`)).toBe('Good.');
      expect(sanitizeWorkshopReplyForRetention(fileEditFrame())).toBe(WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE);
      expect(sanitizeWorkshopReplyForRetention(`${memoryFrame()}\n${fileEditFrame()}`)).toBe(WORKSHOP_TRAILERS_ONLY_REPLY_LINE);
    });

    it('quoted into a prompt, its tag is neutralized, so no quote can forge one', () => {
      expect(neutralizeReservedPersonaPromptDelimiters(fileEditFrame())).not.toMatch(/<\/?prose-minion-file-edit>/);
    });
  });
});
