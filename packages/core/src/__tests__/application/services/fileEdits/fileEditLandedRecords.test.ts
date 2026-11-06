/**
 * What an Apply records for a future Revert (ADR 2026-11-05 D10, N-01): per
 * landed operation, its before and after and the context around it in the
 * text after, within the bounds; past them, or with no version after, only
 * hashes. *Alice*.
 */
import { createHash } from 'crypto';
import { fileEditLandedRecords } from '@/application/services/fileEdits/fileEditLandedRecords';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { planTextEdits } from '@/utils/textEdits/planTextEdits';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';

const { revertCharacters, landedContextCharacters } = PROMPT_BUDGETS.workshopFileEdits;
const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

function records(text: string, operations: TextEditOperation[], landed: number[], version: number | 'unknown' = 4) {
  const plan = planTextEdits(text, operations, { allowsRewrite: true });
  if (plan.kind !== 'planned') {
    throw new Error('not planned');
  }
  return fileEditLandedRecords(text, plan.edits, plan.operations, new Set(landed), version === 'unknown' ? undefined : version);
}

describe('fileEditLandedRecords', () => {
  const text = 'Alice is seven.\n\nShe follows the White Rabbit.';

  it('records each landed operation with its context in the text after', () => {
    expect(records(text, [{ op: 'replace', find: 'seven', with: 'ten' }, { op: 'append', text: 'She is late.' }], [0, 1])).toEqual([
      { operation: 0, before: 'seven', after: 'ten', contextBefore: 'Alice is ', contextAfter: '.\n\nShe follows the White Rabbit.\n\nShe is late.', versionAfter: 4 },
      { operation: 1, before: '', after: '\n\nShe is late.', contextBefore: 'Alice is ten.\n\nShe follows the White Rabbit.', contextAfter: '', versionAfter: 4 }
    ]);
  });

  it('records only what landed, with context that keeps what did not', () => {
    expect(records(text, [{ op: 'replace', find: 'seven', with: 'ten' }, { op: 'replace', find: 'White', with: 'Grey' }], [1])).toEqual([
      { operation: 1, before: 'White', after: 'Grey', contextBefore: 'Alice is seven.\n\nShe follows the ', contextAfter: ' Rabbit.', versionAfter: 4 }
    ]);
  });

  it('holds context to its bound on each side', () => {
    const long = `${'a'.repeat(200)} seven ${'b'.repeat(200)}`;
    const [record] = records(long, [{ op: 'replace', find: 'seven', with: 'ten' }], [0]);
    expect(record).toMatchObject({ contextBefore: `${'a'.repeat(landedContextCharacters - 1)} `, contextAfter: ` ${'b'.repeat(landedContextCharacters - 1)}` });
  });

  it('keeps operations joined into one edit apart, each with its own place', () => {
    const [prepend, append] = records('', [{ op: 'prepend', text: 'Alice.' }, { op: 'append', text: 'Rabbit.' }], [0, 1]);
    // Into empty content the prepend stands alone and the append brings the separator.
    expect(prepend).toMatchObject({ before: '', after: 'Alice.', contextBefore: '', contextAfter: '\n\nRabbit.' });
    expect(append).toMatchObject({ before: '', after: '\n\nRabbit.', contextBefore: 'Alice.', contextAfter: '' });
  });

  it('keeps only hashes past the revert bound, or with no version after', () => {
    const big = 'A'.repeat(revertCharacters + 1);
    expect(records(text, [{ op: 'replace', find: 'seven', with: big }], [0])).toEqual([{ operation: 0, beforeSha256: sha('seven'), afterSha256: sha(big) }]);
    expect(records(text, [{ op: 'replace', find: 'seven', with: 'ten' }], [0], 'unknown')).toEqual([{ operation: 0, beforeSha256: sha('seven'), afterSha256: sha('ten') }]);
  });
});
