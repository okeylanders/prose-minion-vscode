/**
 * "Suggest from my folders" end to end, with a fake helper and the real
 * resolver (ADR 2026-11-19 D21, D24, D25, D22a): the scan, the helper's
 * proposal, the one checker, the held proposal, and Apply: only ticked
 * groups, at the user level, a changed group left with words, a
 * workspace-set group refused, an incomplete re-check left, a failed write
 * stopping the rest. Logs carry counts only. *Alice*.
 */
import { ContextPathSuggestionService, type ProjectLocationsHelper } from '@/application/services/contextPaths/ContextPathSuggestionService';
import { ProjectFolderScan } from '@/application/services/contextPaths/ProjectFolderScan';
import type { HelperRunResult } from '@services/helper/HelperAgentService';
import type { ProjectLocationsProposal } from '@services/helper/tasks/ProjectLocationsTask';
import { ALICE_NAMES } from './aliceProject';
import { aliceChecker, EMPTY_SETTINGS } from './aliceChecker';
import type { AliceProjectOptions } from './aliceProject';

const PROPOSAL: ProjectLocationsProposal = {
  groups: {
    characters: ['Cast/**/*', 'People/**/*'],
    locations: ['Wonderland/**/*'],
    chapters: ['Book 1/Chapters/**/*'],
    projectBrief: ['synopsis.md']
  }
};

function serviceFor(
  options: Partial<AliceProjectOptions> = {},
  answer: HelperRunResult<ProjectLocationsProposal> = { kind: 'drafted', value: PROPOSAL }
) {
  const host = aliceChecker(options);
  const helper: ProjectLocationsHelper & { run: jest.Mock } = { run: jest.fn(async () => answer) };
  const service = new ContextPathSuggestionService(
    new ProjectFolderScan(host.project.fileSystem, host.project.workspace, host.project.log),
    helper,
    host.checker,
    host.settings,
    host.project.log
  );
  return { ...host, helper, service };
}

describe('ContextPathSuggestionService', () => {
  it('scans names, asks the helper once, checks the answer, and holds the proposal under a host id', async () => {
    const { service, helper } = serviceFor();
    const answer = await service.suggest();
    expect(answer.outcome).toBe('proposed');
    expect(answer.proposalId).toMatch(/^cps-/);
    expect(helper.run).toHaveBeenCalledTimes(1);
    const [task, input] = helper.run.mock.calls[0];
    expect(task).toBe('project-locations');
    expect(input.folders.map((folder: { path: string }) => folder.path)).toEqual(['.', 'Book 1', 'Cast', 'Notes', 'Wonderland', 'Book 1/Chapters']);
    expect(answer.view?.scan).toEqual({ folders: 6, sent: 6, stopped: false, unreadable: 0 });
    const offered = answer.view!.groups.filter((group) => group.offer.offered).map((group) => group.group);
    expect(offered).toEqual(['characters', 'locations', 'chapters', 'projectBrief']);
  });

  it('writes nothing without Apply', async () => {
    const { service, project } = serviceFor();
    await service.suggest();
    expect(project.settings.writes).toEqual([]);
  });

  it('applies only the ticked groups, at the user level, joined with commas', async () => {
    const { service, project } = serviceFor();
    const { proposalId } = await service.suggest();
    const applied = await service.apply(proposalId!, ['characters', 'projectBrief']);
    expect(applied).toEqual({
      outcome: 'done',
      groups: [{ group: 'characters', outcome: 'applied' }, { group: 'projectBrief', outcome: 'applied' }]
    });
    expect(project.settings.writes).toEqual([
      ['contextPaths.characters', 'Cast/**/*'],
      ['contextPaths.projectBrief', 'synopsis.md']
    ]);
  });

  it('leaves a group whose value changed since the suggestion, with its reason, never overwriting it', async () => {
    const { service, project } = serviceFor();
    const { proposalId } = await service.suggest();
    project.settings.values['contextPaths.characters'] = 'Cast/Main/**/*';
    const applied = await service.apply(proposalId!, ['characters', 'locations']);
    expect(applied.groups).toEqual([
      { group: 'characters', outcome: 'left', reason: 'changed' },
      { group: 'locations', outcome: 'applied' }
    ]);
    expect(project.settings.values['contextPaths.characters']).toBe('Cast/Main/**/*');
  });

  it('refuses a workspace-set group sent anyway, and one the workspace began setting since', async () => {
    const { service, project } = serviceFor({ levels: { 'contextPaths.locations': 'workspace' } });
    const { proposalId, view } = await service.suggest();
    expect(view!.groups.find((group) => group.group === 'locations')!.offer).toEqual({ offered: false, reason: 'workspace-set' });
    const applied = await service.apply(proposalId!, ['locations']);
    expect(applied.groups).toEqual([{ group: 'locations', outcome: 'left', reason: 'not-offered' }]);

    const later = serviceFor();
    const second = await later.service.suggest();
    jest.spyOn(later.project.settings, 'levelOf').mockImplementation((_section, key) => (key === 'contextPaths.characters' ? 'workspace' : 'user'));
    expect((await later.service.apply(second.proposalId!, ['characters'])).groups).toEqual([
      { group: 'characters', outcome: 'left', reason: 'workspace-set' }
    ]);
    expect(project.settings.writes).toEqual([]);
    expect(later.project.settings.writes).toEqual([]);
  });

  it('leaves a group whose re-check is incomplete, and one whose kept pattern no longer matches (D22a, D24)', async () => {
    const { service, project } = serviceFor();
    const { proposalId } = await service.suggest();
    const searches = project.workspace.findFiles;
    project.workspace.findFiles = async (folder, glob, exclude) => {
      if (glob === 'Cast/**/*') {
        throw new Error('search failed');
      }
      if (glob === 'Wonderland/**/*') {
        return [];
      }
      return searches(folder, glob, exclude);
    };
    const applied = await service.apply(proposalId!, ['characters', 'locations', 'chapters']);
    expect(applied.groups).toEqual([
      { group: 'characters', outcome: 'left', reason: 'incomplete' },
      { group: 'locations', outcome: 'left', reason: 'matches-changed' },
      { group: 'chapters', outcome: 'applied' }
    ]);
    expect(project.settings.writes.map(([key]) => key)).toEqual(['contextPaths.chapters']);
  });

  describe('reads each group again immediately before its write (PR #288 P1)', () => {
    it('leaves a group the writer edits while its files are matched again', async () => {
      const { service, project } = serviceFor();
      const { proposalId } = await service.suggest();
      const searches = project.workspace.findFiles;
      project.workspace.findFiles = async (folder, glob, exclude) => {
        if (glob === 'Cast/**/*') {
          project.settings.values['contextPaths.characters'] = 'Cast/Main/**/*';
        }
        return searches(folder, glob, exclude);
      };
      const applied = await service.apply(proposalId!, ['characters', 'locations']);
      expect(applied.groups).toEqual([
        { group: 'characters', outcome: 'left', reason: 'changed' },
        { group: 'locations', outcome: 'applied' }
      ]);
      expect(project.settings.values['contextPaths.characters']).toBe('Cast/Main/**/*');
    });

    it('leaves a group edited, or set by the workspace, between two groups\' writes', async () => {
      const { service, project } = serviceFor();
      const { proposalId } = await service.suggest();
      const update = project.settings.update;
      let level: 'workspace' | undefined;
      const levelOf = project.settings.levelOf;
      project.settings.levelOf = (section, key) => (key === 'contextPaths.chapters' && level ? level : levelOf(section, key));
      project.settings.update = async (section, key, value) => {
        await update(section, key, value);
        if (key === 'contextPaths.characters') {
          project.settings.values['contextPaths.locations'] = 'Places/**/*';
          level = 'workspace';
        }
      };
      const applied = await service.apply(proposalId!, ['characters', 'locations', 'chapters', 'projectBrief']);
      expect(applied.groups).toEqual([
        { group: 'characters', outcome: 'applied' },
        { group: 'locations', outcome: 'left', reason: 'changed' },
        { group: 'chapters', outcome: 'left', reason: 'workspace-set' },
        { group: 'projectBrief', outcome: 'applied' }
      ]);
      expect(project.settings.values['contextPaths.locations']).toBe('Places/**/*');
      expect(project.settings.writes.map(([key]) => key)).toEqual(['contextPaths.characters', 'contextPaths.projectBrief']);
    });
  });

  describe('an incomplete scan is never empty or complete (PR #288 P2)', () => {
    it('says a partial scan is partial, in the view and the helper\'s input', async () => {
      const { service, project, helper } = serviceFor();
      const read = project.fileSystem.readDirectory;
      project.fileSystem.readDirectory = async (directory) => {
        if (directory.endsWith('Notes')) {
          throw new Error('denied');
        }
        return read(directory);
      };
      const answer = await service.suggest();
      expect(answer.outcome).toBe('proposed');
      expect(answer.view?.scan).toMatchObject({ unreadable: 1 });
      expect(helper.run.mock.calls[0][1].foldersUnreadable).toBe(1);
      expect(project.lines.join('\n')).toContain('1 folder(s) unreadable');
    });

    it('tells an empty scan with unreadable folders apart from an empty project', async () => {
      const { service, project, helper } = serviceFor();
      project.fileSystem.readDirectory = async () => {
        throw new Error('denied');
      };
      expect((await service.suggest()).outcome).toBe('scan-incomplete');
      expect(helper.run).not.toHaveBeenCalled();
      const bare = serviceFor({ roots: { '/alice': ['picture.png'] } });
      expect((await bare.service.suggest()).outcome).toBe('no-folders');
    });
  });

  it('stops at a failed write and says which groups landed', async () => {
    const { service, project } = serviceFor();
    const { proposalId } = await service.suggest();
    const update = project.settings.update;
    project.settings.update = async (section, key, value) => {
      if (key === 'contextPaths.locations') {
        throw new Error('settings.json is read-only');
      }
      return update(section, key, value);
    };
    const applied = await service.apply(proposalId!, ['projectBrief', 'locations', 'characters', 'chapters']);
    expect(applied.groups).toEqual([
      { group: 'characters', outcome: 'applied' },
      { group: 'locations', outcome: 'left', reason: 'write-failed' },
      { group: 'chapters', outcome: 'left', reason: 'not-reached' },
      { group: 'projectBrief', outcome: 'left', reason: 'not-reached' }
    ]);
  });

  it('refuses a proposal it no longer holds', async () => {
    const { service, project } = serviceFor();
    const first = await service.suggest();
    await service.suggest();
    expect(await service.apply(first.proposalId!, ['characters'])).toEqual({ outcome: 'unknown-proposal', groups: [] });
    expect(project.settings.writes).toEqual([]);
  });

  it('stops a suggestion in flight when a newer one starts', async () => {
    const { service, helper } = serviceFor();
    let release!: () => void;
    helper.run.mockImplementationOnce((_task, _input, options: { signal?: AbortSignal }) => new Promise((resolve) => {
      release = () => resolve(options.signal?.aborted ? { kind: 'failed', reason: 'cancelled' } : { kind: 'drafted', value: PROPOSAL });
    }));
    const first = service.suggest();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = service.suggest();
    release();
    expect((await first).outcome).toBe('cancelled');
    expect((await second).outcome).toBe('proposed');
  });

  it.each([
    [{ kind: 'unconfigured' } as const, 'unconfigured'],
    [{ kind: 'rejected', fault: 'cut-off' } as const, 'failed'],
    [{ kind: 'failed', reason: 'timeout' } as const, 'failed'],
    [{ kind: 'drafted', value: { groups: {} } } as const, 'nothing-proposed']
  ])('answers a helper result %j as %s, leaving the settings as they were', async (result, outcome) => {
    const { service, project } = serviceFor({}, result as HelperRunResult<ProjectLocationsProposal>);
    expect((await service.suggest()).outcome).toBe(outcome);
    expect(project.settings.writes).toEqual([]);
  });

  it('answers no-workspace and no-folders without a call', async () => {
    const none = serviceFor({ roots: {} });
    expect((await none.service.suggest()).outcome).toBe('no-workspace');
    const bare = serviceFor({ roots: { '/alice': ['picture.png'] } });
    expect((await bare.service.suggest()).outcome).toBe('no-folders');
    expect(none.helper.run).not.toHaveBeenCalled();
    expect(bare.helper.run).not.toHaveBeenCalled();
  });

  it('says when every group matches nothing, and only then', async () => {
    expect(await serviceFor().service.everyGroupEmpty()).toBe(true);
    expect(await serviceFor({ settings: { ...EMPTY_SETTINGS, 'contextPaths.general': 'Notes/**/*' } }).service.everyGroupEmpty()).toBe(false);
    expect(await serviceFor({ failingGlobs: ['characters/**/*'] }).service.everyGroupEmpty()).toBe(false);
    expect(await serviceFor({ roots: {} }).service.everyGroupEmpty()).toBe(false);
  });

  it('logs counts and outcomes only: no folder, file name, path or pattern', async () => {
    const { service, project } = serviceFor({ failingGlobs: ['People/**/*'] });
    const { proposalId } = await service.suggest();
    project.settings.values['contextPaths.locations'] = 'Places/**/*';
    await service.apply(proposalId!, ['characters', 'locations', 'chapters']);
    const log = project.lines.join('\n');
    expect(log).toContain('[ContextPaths] Suggestion: proposed');
    expect(log).toContain('[ContextPaths] Apply:');
    for (const name of [...ALICE_NAMES, 'Book 1', 'synopsis', 'Places', '/alice']) {
      expect(log).not.toContain(name);
    }
  });
});
