/**
 * Show vs. Tell budget arithmetic (Sprint 05, frozen at Slice 0).
 *
 * The 600-character ceiling counts the artifact body only. These tests pin the
 * fit guarantee: a maximal beat, both maximal invariants, the longest position
 * line, and one maximal direction-only variant always fit. Loosening any field
 * budget changes a pinned line length and fails here until the sprint doc's
 * arithmetic is redone in the same commit.
 */

import { SHOW_VS_TELL_ARTIFACT_LINE_KEYS } from '@messages';
import { NARRATIVE_HANDLING_POSITIONS } from '@shared/constants/narrativeHandlingVocabulary';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  SHOW_VS_TELL_GROUPS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  showVsTellPositionArtifactValue
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';

const budget = PROMPT_BUDGETS.workshopWidgets;
const keys = SHOW_VS_TELL_ARTIFACT_LINE_KEYS;
const line = (key: string, value: string): string => `${key} ${value}`;

describe('Show vs. Tell budgets', () => {
  it('pins the shared artifact line keys', () => {
    expect(SHOW_VS_TELL_ARTIFACT_LINE_KEYS).toEqual({
      beat: 'beat:',
      position: 'position:',
      mustSurvive: 'must survive:',
      mustNotChange: 'must not change:',
      keep: 'keep:',
      direction: 'direction:',
      note: 'note:'
    });
  });

  it('derives each position line, with Hinge as the longest', () => {
    const positionLines = NARRATIVE_HANDLING_POSITIONS.map((position) =>
      line(keys.position, showVsTellPositionArtifactValue(position))
    );

    expect(positionLines).toEqual([
      'position: state it · direct tell',
      'position: summarize · compressed narrative',
      'position: hinge · tell the bridge, show the fulcrum',
      'position: evidence · observable action & sense',
      'position: inhabit · full scene time'
    ]);
    expect(Math.max(...positionLines.map((candidate) => candidate.length))).toBe(51);
  });

  it('fits the worst-case required lines and one maximal direction under 600 (585)', () => {
    const longestPositionLine = NARRATIVE_HANDLING_POSITIONS
      .map((position) => line(keys.position, showVsTellPositionArtifactValue(position)))
      .reduce((longest, candidate) => candidate.length > longest.length ? candidate : longest);
    const worstCaseLines = [
      line(keys.beat, `"${'b'.repeat(budget.showVsTellBeatCharacters)}"`),
      longestPositionLine,
      line(keys.mustSurvive, 's'.repeat(budget.showVsTellMustSurviveCharacters)),
      line(keys.mustNotChange, 'n'.repeat(budget.showVsTellMustNotChangeCharacters)),
      line(keys.direction, 'd'.repeat(budget.showVsTellDirectionCharacters))
    ];
    const body = worstCaseLines.join('\n');

    expect(worstCaseLines.map((candidate) => candidate.length)).toEqual([168, 51, 134, 97, 131]);
    expect(body.length).toBe(585);
    expect(budget.showVsTellArtifactCharacters).toBe(600);
    expect(body.length).toBeLessThanOrEqual(budget.showVsTellArtifactCharacters);
  });

  it('lets the per-group bounds imply the 4–8 total over four always-present groups', () => {
    const groups = SHOW_VS_TELL_GROUPS.length;

    expect(groups).toBe(4);
    expect(groups * budget.showVsTellVariantsPerGroupMinimum).toBe(budget.showVsTellVariantsMinimum);
    expect(groups * budget.showVsTellVariantsPerGroup).toBe(budget.showVsTellVariants);
    expect([budget.showVsTellVariantsMinimum, budget.showVsTellVariants]).toEqual([4, 8]);
  });

  it('keeps a maximal direction expressible: some legal prose is longer than it', () => {
    expect(budget.showVsTellDirectionCharacters).toBeLessThan(budget.showVsTellProseCharacters);
  });
});
