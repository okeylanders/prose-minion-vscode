import { WorkshopGesturePlaygroundDraft } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  assertGesturePlaygroundDraftShape,
  assertGesturePlaygroundDraftCheckpointShape,
  assertGesturePlaygroundDraftIntegrity,
  cloneGesturePlaygroundDraft,
  normalizeGesturePlaygroundDraftForHydration
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundConfigCodec';

const draft = (): WorkshopGesturePlaygroundDraft => ({
  targetPhrase: 'she smiled',
  writerInstructions: 'Keep the response guarded.',
  contextText: 'She folded the letter before answering.',
  characterNotes: 'Mara deflects when cornered.',
  sourceReferences: [{ kind: 'active-excerpt' }],
  dictionaryMarkdown: '# Gesture Dictionary\n\nA private deflection.',
  menu: Array.from(
    { length: PROMPT_BUDGETS.workshopWidgets.gestureMenuGroupsMinimum },
    (_, groupIndex) => ({
      heading: `Group ${groupIndex + 1}`,
      options: Array.from(
        { length: PROMPT_BUDGETS.workshopWidgets.gestureOptionsPerGroupMinimum },
        (_, optionIndex) => `Direction ${groupIndex + 1}.${optionIndex + 1}`
      )
    })
  ),
  selections: ['Direction 1.1'],
  note: 'Keep it small.',
  includeDictionaryInCommit: false
});

const assertDraft = (value: WorkshopGesturePlaygroundDraft): void => {
  assertGesturePlaygroundDraftShape(value, 'draft');
  assertGesturePlaygroundDraftIntegrity(value, 'draft');
};

describe('GesturePlaygroundConfigCodec', () => {
  it('accepts a draft at the minimum menu and option bounds', () => {
    expect(() => assertDraft(draft())).not.toThrow();
  });

  it.each([
    ['too few', PROMPT_BUDGETS.workshopWidgets.gestureMenuGroupsMinimum - 1],
    ['too many', PROMPT_BUDGETS.workshopWidgets.gestureMenuGroups + 1]
  ])('rejects %s menu groups', (_label, groupCount) => {
    const value = draft();
    const seedGroup = value.menu[0];
    value.menu = Array.from({ length: groupCount }, (_, index) => ({
      heading: `Group ${index + 1}`,
      options: seedGroup.options.map((_, optionIndex) =>
        `Direction ${index + 1}.${optionIndex + 1}`
      )
    }));

    expect(() => assertDraft(value)).toThrow(/draft\.menu must be an array of 4–6 groups/);
  });

  it.each([
    ['too few', PROMPT_BUDGETS.workshopWidgets.gestureOptionsPerGroupMinimum - 1],
    ['too many', PROMPT_BUDGETS.workshopWidgets.gestureOptionsPerGroup + 1]
  ])('rejects %s options in a menu group', (_label, optionCount) => {
    const value = draft();
    value.menu[0].options = Array.from(
      { length: optionCount },
      (_, index) => `Direction 1.${index + 1}`
    );

    expect(() => assertDraft(value))
      .toThrow(/draft\.menu\[0\]\.options must be an array of 3–10 options/);
  });

  it('rejects duplicate options across menu groups', () => {
    const value = draft();
    value.menu[1].options[0] = value.menu[0].options[0];

    expect(() => assertDraft(value)).toThrow(/groups without duplicate options/);
  });

  it('keeps cross-field menu semantics out of the structural grammar', () => {
    const value = draft();
    value.selections = ['An invented direction'];

    expect(() => assertGesturePlaygroundDraftShape(value, 'draft')).not.toThrow();
    expect(() => assertGesturePlaygroundDraftIntegrity(value, 'draft'))
      .toThrow(/directions drawn from the generated menu/);
  });

  it('rejects a selection that is not present in the menu', () => {
    const value = draft();
    value.selections = ['An invented direction'];

    expect(() => assertDraft(value)).toThrow(/directions drawn from the generated menu/);
  });

  it('rejects empty, over-limit, and duplicate selections', () => {
    const empty = draft();
    empty.selections = [];
    expect(() => assertDraft(empty)).toThrow(/an array of 1–8 directions/);

    const overLimit = draft();
    overLimit.selections = overLimit.menu
      .flatMap((group) => group.options)
      .slice(0, PROMPT_BUDGETS.workshopWidgets.gestureSelectionsPerCommit + 1);
    expect(() => assertDraft(overLimit)).toThrow(/an array of 1–8 directions/);

    const duplicate = cloneGesturePlaygroundDraft(draft());
    duplicate.selections.push(duplicate.selections[0]);
    expect(() => assertDraft(duplicate)).toThrow(/without duplicate directions/);
  });

  it('owns its checkpoint defaults and returns stable recovery codes', () => {
    const checkpoint = draft() as unknown as Record<string, unknown>;
    delete checkpoint.includeDictionaryInCommit;
    delete checkpoint.sourceReferences;

    expect(() => assertGesturePlaygroundDraftCheckpointShape(checkpoint, 'draft'))
      .not.toThrow();
    expect(() => assertGesturePlaygroundDraftShape(checkpoint, 'draft'))
      .toThrow(/missing required field/);

    const result = normalizeGesturePlaygroundDraftForHydration(
      checkpoint as unknown as WorkshopGesturePlaygroundDraft
    );
    expect(result.draft).toMatchObject({
      includeDictionaryInCommit: false,
      sourceReferences: []
    });
    expect(result.normalizations).toEqual([
      'defaulted-widget-dictionary-sharing',
      'defaulted-widget-source-references'
    ]);
    expect(result.notices).toEqual([]);
  });
});
