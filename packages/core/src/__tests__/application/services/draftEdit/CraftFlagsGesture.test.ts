/**
 * Gesture strain in a Craft Flags run (ADR 2026-10-21, Amendment 2026-10-26:
 * Slice 3c part 3). The model judges every gesture flag; host code counts the
 * stock beats each one names, every form together, in the live document's
 * narration, and says so beside the note (the writer's decision, 2026-10-27).
 * Text adapts public-domain *Alice*, with stock beats added.
 */
import type { CraftFlagFinding } from '@/domain/models/CraftFlag';
import { flag, read, setup } from '@/__tests__/application/services/draftEdit/craftFlagsHarness';

const strain = (quote: string, extra: Partial<CraftFlagFinding> & { before?: string } = {}) => flag(quote, {
  category: 'gesture',
  kind: 'thin',
  why: 'The sister answers everything with the same beat',
  suggestion: 'her sister turned a page without looking up',
  ...extra
});

const SISTER = [
  'Alice peeped into the book her sister was reading, and her sister nodded.',
  '“It has no pictures,” said Alice. Her sister nods, smiling, and turns a page.',
  '“Do stop nodding at me,” said Alice, and her sister, nodding again, smiled.'
].join('\n\n');

describe('A gesture strain flag (Slice 3c part 3)', () => {
  it('shows its note with the host\'s count of the beat it names, every form together, speech left out', async () => {
    const { runOnce, annotations } = setup(SISTER, [read(strain('nodding again', { before: 'her sister, ' }))]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1 });

    expect(annotations.flaggedText()).toEqual(['nodding again']);
    // nodded, nods and nodding in the narration; the nodding Alice speaks of is hers, and not counted.
    expect(annotations.shown[0]).toMatchObject({
      code: 'craft.gesture',
      severity: 'info',
      message: 'The sister answers everything with the same beat. One way it could go: her sister turned a page without looking up.'
        + ' Nods appear 3 times in this document.'
    });
  });

  it('counts each beat its words name, in their order, and never the phrase as well', async () => {
    const { runOnce, annotations } = setup(SISTER, [read(strain('nodding again, smiled', { before: 'her sister, ' }))]);
    await runOnce();
    expect(annotations.shown[0].message).toMatch(/ Nods appear 3 times in this document, and smiles 2 times\.$/);
    expect(annotations.shown[0].message).not.toMatch(/This phrase appears/);
  });

  it('says no count for a beat the narration holds once', async () => {
    const text = 'Alice was tired of the bank, and her sister shrugged her shoulders.';
    const { runOnce, annotations } = setup(text, [read(strain('shrugged her shoulders', { kind: 'redundant' }))]);
    await runOnce();
    expect(annotations.shown[0].message).toBe(
      'The sister answers everything with the same beat. One way it could go: her sister turned a page without looking up.'
    );
  });

  it('carries the phrase count when its words name no listed beat', async () => {
    const text = 'Her eyes flew across the room. Later, her eyes flew across the room again.';
    const { runOnce, annotations } = setup(text, [read(strain('eyes flew across the room', { kind: 'impossible', before: 'Her ' }))]);
    await runOnce();
    expect(annotations.shown[0].message).toMatch(/ This phrase appears 2 times in this document\.$/);
  });

  it('leaves the beat counts to gesture flags: a cliché on a smile carries its phrase count', async () => {
    const text = 'She smiled from ear to ear. Later she smiled from ear to ear again, and smiled once more.';
    const { runOnce, annotations } = setup(text, [read(flag('smiled from ear to ear', { before: 'She ' }))]);
    await runOnce();
    expect(annotations.shown[0].message).toMatch(/ This phrase appears 2 times in this document\.$/);
    expect(annotations.shown[0].message).not.toMatch(/Smiles appear/);
  });

  it('reads a gesture in a dialogue beat, and drops one inside a character\'s words', async () => {
    const { runOnce, annotations } = setup(SISTER, [
      read(strain('nodding at me'), strain('nodding again', { before: 'her sister, ' }))
    ]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1, dropped: { dialogue: 1 } });
    expect(annotations.flaggedText()).toEqual(['nodding again']);
  });

  it('counts the beats in the live text, once the run has settled', async () => {
    const { runOnce, annotations } = setup(SISTER, [read(strain('nodding again', { before: 'her sister, ' }))], {
      // At the end, so every earlier offset holds: a count read from the gesture's own text would find one nod fewer.
      beforeReply: (documents) => documents.edit([{ offset: SISTER.length, length: 0, text: ' Her sister nodded.' }])
    });
    await runOnce();
    expect(annotations.flaggedText()).toEqual(['nodding again']);
    expect(annotations.shown[0].message).toMatch(/ Nods appear 4 times in this document\.$/);
  });
});
