/**
 * The one checker (ADR 2026-11-19 D22, D22a, D25), over the real resolver:
 * unsafe patterns refused, unmatched dropped, incomplete never zero,
 * overlap flagged on both groups, a group left out unchanged, a group whose
 * every pattern drops kept, a workspace-set group shown and not offered.
 * *Alice*.
 */
import type { ContextPathGroupView } from '@messages';
import { aliceChecker, EMPTY_SETTINGS } from './aliceChecker';

const groupOf = (groups: readonly ContextPathGroupView[], name: string) => groups.find((group) => group.group === name)!;

describe('ContextPathProposalChecker', () => {
  it('keeps matching patterns, drops unmatched ones, refuses unsafe ones, and offers the group', async () => {
    const { checker } = aliceChecker();
    const checked = await checker.check({ characters: ['Cast/**/*', 'People/**/*', '/Cast/**', '{Cast,People}/**'] });
    expect(checked.kind).toBe('checked');
    if (checked.kind !== 'checked') return;
    const characters = groupOf(checked.proposal.view.groups, 'characters');
    expect(characters.current).toEqual({ patterns: ['characters/**/*'], count: 0, examples: [] });
    expect(characters.proposed).toMatchObject({
      kept: [{ pattern: 'Cast/**/*', count: 3 }],
      dropped: [
        { pattern: 'People/**/*', reason: 'unmatched' },
        { pattern: '/Cast/**', reason: 'absolute' },
        { pattern: '{Cast,People}/**', reason: 'comma' }
      ],
      count: 3,
      examples: ['Cast/Alice.md', 'Cast/Mad Hatter.md', 'Cast/Queen of Hearts.md']
    });
    expect(characters.offer).toEqual({ offered: true });
    expect(checked.proposal.kept.characters).toEqual(['Cast/**/*']);
    expect(checked.proposal.baselines.characters).toBe('characters/**/*');
  });

  it('refuses an unsafe pattern before the resolver ever sees it', async () => {
    const { checker, project } = aliceChecker();
    await checker.check({ characters: ['/Cast/**', 'workspace:Cast/**', '../Cast/**', 'C:/Cast/**'] });
    expect(project.searches.some((glob) => glob.includes('Cast'))).toBe(false);
  });

  it('leaves a group out of the proposal unchanged, and not offered', async () => {
    const { checker } = aliceChecker();
    const checked = await checker.check({ characters: ['Cast/**/*'] });
    if (checked.kind !== 'checked') throw new Error('unchecked');
    const locations = groupOf(checked.proposal.view.groups, 'locations');
    expect(locations.proposed).toBeUndefined();
    expect(locations.offer).toEqual({ offered: false, reason: 'not-proposed' });
    expect(checked.proposal.kept.locations).toBeUndefined();
  });

  it('keeps a group\'s value when every proposed pattern drops', async () => {
    const { checker } = aliceChecker();
    const checked = await checker.check({ characters: ['People/**/*', '/Cast/**'] });
    if (checked.kind !== 'checked') throw new Error('unchecked');
    expect(groupOf(checked.proposal.view.groups, 'characters').offer).toEqual({ offered: false, reason: 'nothing-kept' });
    expect(checked.proposal.kept.characters).toBeUndefined();
  });

  it('flags a file two groups would share on both, from each group\'s own matches', async () => {
    const { checker } = aliceChecker();
    const checked = await checker.check({ characters: ['Cast/**/*', '**/Queen of Hearts.md'], locations: ['Wonderland/**/*'] });
    if (checked.kind !== 'checked') throw new Error('unchecked');
    const characters = groupOf(checked.proposal.view.groups, 'characters');
    const locations = groupOf(checked.proposal.view.groups, 'locations');
    expect(characters.proposed?.shared).toEqual({ count: 1, examples: [{ path: 'Wonderland/Queen of Hearts.md', groups: ['locations'] }] });
    expect(locations.proposed?.shared).toEqual({ count: 1, examples: [{ path: 'Wonderland/Queen of Hearts.md', groups: ['characters'] }] });
  });

  it('counts overlap with a group\'s current files when it is not proposed', async () => {
    const { checker } = aliceChecker({ settings: { ...EMPTY_SETTINGS, 'contextPaths.general': 'Notes/**/*' } });
    const checked = await checker.check({ themes: ['**/lore.md'] });
    if (checked.kind !== 'checked') throw new Error('unchecked');
    expect(groupOf(checked.proposal.view.groups, 'themes').proposed?.shared.examples).toEqual([{ path: 'Notes/lore.md', groups: ['general'] }]);
  });

  describe('an incomplete check is never zero matches (D22a)', () => {
    it('leaves a group with a failed search unchanged and not offered, while a completed zero-match search drops its pattern', async () => {
      const { checker } = aliceChecker({ failingGlobs: ['People/**/*'] });
      const checked = await checker.check({ characters: ['People/**/*', 'Cast/**/*'], locations: ['Places/**/*', 'Wonderland/**/*'] });
      if (checked.kind !== 'checked') throw new Error('unchecked');
      const characters = groupOf(checked.proposal.view.groups, 'characters');
      expect(characters.offer).toEqual({ offered: false, reason: 'incomplete' });
      expect(characters.proposed?.dropped).toEqual([{ pattern: 'People/**/*', reason: 'incomplete' }]);
      expect(checked.proposal.kept.characters).toBeUndefined();
      const locations = groupOf(checked.proposal.view.groups, 'locations');
      expect(locations.offer).toEqual({ offered: true });
      expect(locations.proposed?.dropped).toEqual([{ pattern: 'Places/**/*', reason: 'unmatched' }]);
    });

    it('says a current count could not be made, never zero', async () => {
      const { checker } = aliceChecker({ failingGlobs: ['characters/**/*'] });
      const checked = await checker.check({ locations: ['Wonderland/**/*'] });
      if (checked.kind !== 'checked') throw new Error('unchecked');
      expect(groupOf(checked.proposal.view.groups, 'characters').current.count).toBeNull();
    });

    it('treats an unreadable match as incomplete', async () => {
      const { checker } = aliceChecker({ unreadable: ['Cast/Alice.md'] });
      const checked = await checker.check({ characters: ['Cast/**/*'] });
      if (checked.kind !== 'checked') throw new Error('unchecked');
      expect(groupOf(checked.proposal.view.groups, 'characters').offer).toEqual({ offered: false, reason: 'incomplete' });
    });
  });

  it('shows a group the workspace sets, and does not offer it (D25)', async () => {
    const { checker } = aliceChecker({ levels: { 'contextPaths.characters': 'workspace' } });
    const checked = await checker.check({ characters: ['Cast/**/*'] });
    if (checked.kind !== 'checked') throw new Error('unchecked');
    const characters = groupOf(checked.proposal.view.groups, 'characters');
    expect(characters.level).toBe('workspace');
    expect(characters.proposed?.kept).toEqual([{ pattern: 'Cast/**/*', count: 3 }]);
    expect(characters.offer).toEqual({ offered: false, reason: 'workspace-set' });
  });

  it('does not offer a group whose kept patterns are its patterns already', async () => {
    const { checker } = aliceChecker({ settings: { ...EMPTY_SETTINGS, 'contextPaths.characters': 'Cast/**/*' } });
    const checked = await checker.check({ characters: ['Cast/**/*'] });
    if (checked.kind !== 'checked') throw new Error('unchecked');
    expect(groupOf(checked.proposal.view.groups, 'characters').offer).toEqual({ offered: false, reason: 'unchanged' });
  });

  it('answers no-workspace with no folder open', async () => {
    const { checker } = aliceChecker({ roots: {} });
    expect(await checker.check({ characters: ['Cast/**/*'] })).toEqual({ kind: 'no-workspace' });
  });
});
