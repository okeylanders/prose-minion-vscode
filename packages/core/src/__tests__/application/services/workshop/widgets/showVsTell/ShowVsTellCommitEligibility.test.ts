import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  buildShowVsTellArtifact
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
import {
  showVsTellCommitIssues
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellCommitEligibility';
import {
  prepareShowVsTellOneShotCommit
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellOneShotCommit';
import {
  showVsTellWorkupVariants
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import {
  projectShowVsTellArtifact
} from '@hooks/domain/workshop/controllers/showVsTell/showVsTellAuthoringRules';
import { fixtureVariantId, generatedShowVsTellDraft } from './showVsTellFixtures';

const CEILING = PROMPT_BUDGETS.workshopWidgets.showVsTellArtifactCharacters;

const codes = (draft: ReturnType<typeof generatedShowVsTellDraft>) =>
  showVsTellCommitIssues(draft).map((issue) => issue.code);

/** The fixture at an exact counted length, padded through the note (7 = "\nnote: "). */
const draftAtBodyLength = (characters: number) => {
  const draft = generatedShowVsTellDraft();
  const bare = buildShowVsTellArtifact({ ...draft, note: '' }).length;
  return { ...draft, note: 'x'.repeat(characters - bare - 7) };
};

describe('Show vs. Tell commit eligibility', () => {
  it('has no issue for a settled workup with kept variants inside the ceiling', () => {
    expect(codes(generatedShowVsTellDraft())).toEqual([]);
  });

  it('reports a missing workup alone, then a missing keep alone', () => {
    expect(codes({ ...generatedShowVsTellDraft(), workup: null, kept: [] })).toEqual(['no-workup']);
    expect(codes({ ...generatedShowVsTellDraft(), kept: [] })).toEqual(['no-keep']);
  });

  it('requires every kept variant to be in the workup, unique, and in workup order', () => {
    const draft = generatedShowVsTellDraft();

    expect(codes({
      ...draft,
      kept: [{ variantId: fixtureVariantId(99), carryMode: 'direction' }]
    })).toEqual(['kept-not-in-workup']);
    expect(codes({ ...draft, kept: [draft.kept[0], draft.kept[0]] })).toEqual(['kept-duplicated']);
    expect(codes({ ...draft, kept: [...draft.kept].reverse() })).toEqual(['kept-out-of-order']);
  });

  it('reports the projection failing to compile as its own issue', () => {
    // Nothing mutates the workup after the kept-in-workup gate, so force the
    // compile error through a variant whose position cannot be named.
    const draft = { ...generatedShowVsTellDraft(), position: 'nowhere' as never };

    expect(codes(draft)).toEqual(['artifact-compilation-failed']);
  });

  describe('ceiling parity: meter, eligibility, and host agree', () => {
    it.each([
      [CEILING - 1, true],
      [CEILING, true],
      [CEILING + 1, false]
    ])('at %i characters (commits: %s)', (characters, commits) => {
      const draft = draftAtBodyLength(characters);
      const body = buildShowVsTellArtifact(draft);
      expect(body).toHaveLength(characters);

      const meter = projectShowVsTellArtifact(draft).usage!;
      const overBudget = meter.characters > meter.budget;
      const eligible = showVsTellCommitIssues(draft).length === 0;
      const host = prepareShowVsTellOneShotCommit({
        widgetId: 'show-vs-tell',
        requestToken: 'parity',
        draft
      }).ok;

      expect(meter.characters).toBe(characters);
      expect(meter.budget).toBe(CEILING);
      expect(overBudget).toBe(!commits);
      expect(eligible).toBe(commits);
      expect(host).toBe(commits);
      if (!commits) {
        expect(showVsTellCommitIssues(draft).map((issue) => issue.code))
          .toEqual(['over-artifact-budget']);
      }
    });

    it('never lets flags change the counted length or the eligibility', () => {
      const draft = draftAtBodyLength(CEILING);
      const unflagged = structuredClone(draft);
      for (const variant of showVsTellWorkupVariants(unflagged.workup!)) {
        variant.invariantFlags = [];
      }

      expect(buildShowVsTellArtifact(unflagged)).toBe(buildShowVsTellArtifact(draft));
      expect(showVsTellCommitIssues(unflagged)).toEqual(showVsTellCommitIssues(draft));
      expect(showVsTellCommitIssues(draft)).toEqual([]);
    });
  });
});
