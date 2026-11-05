/**
 * The `memory-draft` task's codec and input (ADR 2026-11-05 D2, D5): exact
 * fields, the memory's own bounds and kinds, and every fault a drop with
 * its kind, never a repair. Through the shared reply reader, so malformed
 * JSON and ceilings are read as production reads them. Alice fixtures.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { PROJECT_MEMORY_FIELD_CHARACTERS, PROJECT_MEMORY_KINDS } from '@shared/types/projectMemory';
import { readHelperReply } from '@services/helper/HelperReply';
import {
  MEMORY_DRAFT_POLICY,
  buildMemoryDraftInput,
  decodeMemoryDraft
} from '@services/helper/tasks/MemoryDraftTask';

const DRAFT = {
  title: 'The croquet mallets are flamingos',
  summary: 'In the Queen\'s croquet game the mallets are flamingos and the balls hedgehogs.',
  kind: 'canon'
};

const read = (content: string, finishReason?: string) => readHelperReply(MEMORY_DRAFT_POLICY, content, finishReason);

describe('memory-draft codec', () => {
  it('reads a draft with exactly its three fields, trimmed', () => {
    expect(decodeMemoryDraft({ ...DRAFT, title: `  ${DRAFT.title} ` })).toEqual({ ok: true, value: DRAFT });
  });

  it('reads every kind of the closed list, and nothing else', () => {
    for (const kind of PROJECT_MEMORY_KINDS) {
      expect(decodeMemoryDraft({ ...DRAFT, kind })).toEqual({ ok: true, value: { ...DRAFT, kind } });
    }
    expect(decodeMemoryDraft({ ...DRAFT, kind: 'fact' })).toEqual({ ok: false, fault: 'outside-vocabulary' });
    expect(decodeMemoryDraft({ ...DRAFT, kind: 'Canon' })).toEqual({ ok: false, fault: 'outside-vocabulary' });
    expect(decodeMemoryDraft({ ...DRAFT, kind: 3 })).toEqual({ ok: false, fault: 'wrong-type' });
  });

  it('drops a draft missing a field, or holding one the task does not define', () => {
    const { summary: _summary, ...noSummary } = DRAFT;
    expect(decodeMemoryDraft(noSummary)).toEqual({ ok: false, fault: 'missing-field' });
    expect(decodeMemoryDraft({ ...DRAFT, body: 'The Queen shouts.' })).toEqual({ ok: false, fault: 'unknown-field' });
  });

  it('drops a field over its bound, never clipping it', () => {
    const title = 'A'.repeat(PROJECT_MEMORY_FIELD_CHARACTERS.title);
    expect(decodeMemoryDraft({ ...DRAFT, title })).toMatchObject({ ok: true });
    expect(decodeMemoryDraft({ ...DRAFT, title: `${title}A` })).toEqual({ ok: false, fault: 'over-bound' });
    const summary = 'A'.repeat(PROJECT_MEMORY_FIELD_CHARACTERS.summary + 1);
    expect(decodeMemoryDraft({ ...DRAFT, summary })).toEqual({ ok: false, fault: 'over-bound' });
  });

  it('drops an empty, multi-line or non-string field', () => {
    expect(decodeMemoryDraft({ ...DRAFT, title: '   ' })).toEqual({ ok: false, fault: 'empty-field' });
    expect(decodeMemoryDraft({ ...DRAFT, summary: 'Alice falls.\nShe lands.' })).toEqual({ ok: false, fault: 'multi-line' });
    expect(decodeMemoryDraft({ ...DRAFT, title: ['Alice'] })).toEqual({ ok: false, fault: 'wrong-type' });
  });

  it('reads through the shared parser: structure-only repairs kept and named, malformed JSON dropped', () => {
    expect(read(JSON.stringify(DRAFT))).toEqual({ ok: true, value: DRAFT, repairs: [] });
    expect(read(`\`\`\`json\n${JSON.stringify(DRAFT)}\n\`\`\``)).toEqual({ ok: true, value: DRAFT, repairs: ['code-fence'] });
    expect(read('{"title": "Alice falls", "summary": ')).toEqual({ ok: false, fault: 'malformed-json' });
    expect(read('Here is a title: Alice falls.')).toEqual({ ok: false, fault: 'malformed-json' });
    expect(read('["Alice"]')).toEqual({ ok: false, fault: 'not-an-object' });
  });

  it('refuses a reply cut off at its ceiling, or longer than the task allows, before reading it', () => {
    expect(read(JSON.stringify(DRAFT), 'length')).toEqual({ ok: false, fault: 'cut-off' });
    const long = JSON.stringify({ ...DRAFT, title: 'A'.repeat(PROMPT_BUDGETS.helper['memory-draft'].responseCharacters) });
    expect(read(long)).toEqual({ ok: false, fault: 'too-long' });
  });
});

describe('memory-draft input', () => {
  it('sends the passage and who wrote it as plain data, cut to the task\'s bound', () => {
    const bound = PROMPT_BUDGETS.helper['memory-draft'].inputCharacters;
    expect(buildMemoryDraftInput({ text: 'Alice fell.', source: 'writer' })).toEqual({ source: 'writer', passage: 'Alice fell.' });
    const long = buildMemoryDraftInput({ text: 'A'.repeat(bound + 10), source: 'persona' });
    expect((long.passage as string).length).toBe(bound);
    expect(MEMORY_DRAFT_POLICY.describeInput({ text: 'A'.repeat(bound + 10), source: 'persona' })).toEqual({ characters: bound });
  });

  it('reads as much of the turn as the memory sheet\'s body holds', () => {
    expect(PROMPT_BUDGETS.helper['memory-draft'].inputCharacters).toBe(PROMPT_BUDGETS.workshopProjectMemory.bodyCharacters);
  });

  it('calls at temperature 0 with a small ceiling, under its budgets', () => {
    expect(MEMORY_DRAFT_POLICY.call).toMatchObject({
      temperature: 0,
      outputTokens: PROMPT_BUDGETS.helper['memory-draft'].outputTokens,
      responseCharacters: PROMPT_BUDGETS.helper['memory-draft'].responseCharacters
    });
    expect(MEMORY_DRAFT_POLICY.call.outputTokens).toBeLessThanOrEqual(1_000);
  });
});
