/**
 * The `project-locations` task's codec and input (ADR 2026-11-19 D21):
 * exact fields, group keys from the closed list, patterns as strings (the
 * checker judges them), a group given none kept, a cut-off reply dropped;
 * the input names only, bounded by folders and characters. *Alice*.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { CONTEXT_PATH_GROUPS } from '@shared/types/context';
import { readHelperReply } from '@services/helper/HelperReply';
import { HELPER_TASK_POLICIES } from '@services/helper/HelperTaskPolicies';
import {
  PROJECT_LOCATIONS_POLICY,
  buildProjectLocationsInput,
  decodeProjectLocations,
  projectLocationsFoldersSent
} from '@services/helper/tasks/ProjectLocationsTask';
import type { ProjectFolderSummary } from '@shared/types/projectFolders';

const BUDGET = PROMPT_BUDGETS.helper['project-locations'];
const read = (content: string, finishReason?: string) => readHelperReply(PROJECT_LOCATIONS_POLICY, content, finishReason);
const folder = (path: string): ProjectFolderSummary => ({ path, markdownFiles: 2, textFiles: 0, sampleNames: ['Alice.md', 'Mad Hatter.md'] });

describe('project-locations codec', () => {
  it('reads groups of patterns, as written', () => {
    expect(decodeProjectLocations({ groups: { characters: ['Cast/**/*', ' /odd '], locations: ['Wonderland/**/*'] } })).toEqual({
      ok: true,
      value: { groups: { characters: ['Cast/**/*', ' /odd '], locations: ['Wonderland/**/*'] } }
    });
  });

  it('leaves out a group given no patterns, so it keeps its own', () => {
    expect(decodeProjectLocations({ groups: { characters: [], themes: ['Themes/**/*'] } })).toEqual({ ok: true, value: { groups: { themes: ['Themes/**/*'] } } });
    expect(decodeProjectLocations({ groups: {} })).toEqual({ ok: true, value: { groups: {} } });
  });

  it('accepts every group of the closed list, and faults any other key', () => {
    for (const group of CONTEXT_PATH_GROUPS) {
      expect(decodeProjectLocations({ groups: { [group]: ['Cast/**/*'] } })).toMatchObject({ ok: true });
    }
    expect(decodeProjectLocations({ groups: { people: ['Cast/**/*'] } })).toEqual({ ok: false, fault: 'outside-vocabulary' });
    expect(decodeProjectLocations({ groups: { Characters: ['Cast/**/*'] } })).toEqual({ ok: false, fault: 'outside-vocabulary' });
  });

  it('faults wrong shapes and fields', () => {
    expect(decodeProjectLocations({})).toEqual({ ok: false, fault: 'missing-field' });
    expect(decodeProjectLocations({ groups: {}, note: 'Alice' })).toEqual({ ok: false, fault: 'unknown-field' });
    expect(decodeProjectLocations({ groups: ['Cast/**/*'] })).toEqual({ ok: false, fault: 'wrong-type' });
    expect(decodeProjectLocations({ groups: { characters: 'Cast/**/*' } })).toEqual({ ok: false, fault: 'wrong-type' });
    expect(decodeProjectLocations({ groups: { characters: ['Cast/**/*', 3] } })).toEqual({ ok: false, fault: 'wrong-type' });
  });

  it('reads through the shared parser, and refuses a reply cut off or too long', () => {
    const reply = JSON.stringify({ groups: { characters: ['Cast/**/*'] } });
    expect(read(reply)).toEqual({ ok: true, value: { groups: { characters: ['Cast/**/*'] } }, repairs: [] });
    expect(read(reply, 'length')).toEqual({ ok: false, fault: 'cut-off' });
    expect(read(JSON.stringify({ groups: { characters: ['A'.repeat(BUDGET.responseCharacters)] } }))).toEqual({ ok: false, fault: 'too-long' });
    expect(read('Cast is the characters folder.')).toEqual({ ok: false, fault: 'malformed-json' });
  });

  it('is in the registry, at temperature 0 with its own ceiling', () => {
    expect(HELPER_TASK_POLICIES['project-locations']).toBe(PROJECT_LOCATIONS_POLICY);
    expect(PROJECT_LOCATIONS_POLICY.call).toMatchObject({ temperature: 0, outputTokens: BUDGET.outputTokens, responseCharacters: BUDGET.responseCharacters });
  });
});

describe('project-locations input', () => {
  it('sends each group\'s name and meaning, and the folders by name and count only', () => {
    const data = buildProjectLocationsInput({ folders: [folder('Cast')], scanStopped: false });
    expect((data.groups as Array<{ name: string }>).map((group) => group.name)).toEqual([...CONTEXT_PATH_GROUPS]);
    expect(data.folders).toEqual([{ path: 'Cast', markdownFiles: 2, textFiles: 0, sampleNames: ['Alice.md', 'Mad Hatter.md'] }]);
    expect(data.foldersLeftOut).toBe(0);
    expect(data.scanStopped).toBe(false);
  });

  it('sends at most its folders, and says how many were left out', () => {
    const folders = Array.from({ length: BUDGET.folders + 5 }, (_, index): ProjectFolderSummary => ({ path: `F${index}`, markdownFiles: 1, textFiles: 0, sampleNames: [] }));
    const data = buildProjectLocationsInput({ folders, scanStopped: true });
    expect((data.folders as unknown[]).length).toBe(BUDGET.folders);
    expect(data.foldersLeftOut).toBe(5);
    expect(PROJECT_LOCATIONS_POLICY.describeInput({ folders, scanStopped: true })).toEqual({ folders: BUDGET.folders, 'folders left out': 5 });
  });

  it('holds the request within its characters by sending fewer folders', () => {
    const long = (index: number): ProjectFolderSummary => ({ path: `Wonderland/${'Rabbit '.repeat(20)}${index}`, markdownFiles: 1, textFiles: 0, sampleNames: ['A'.repeat(80), 'B'.repeat(80), 'C'.repeat(80)] });
    const input = { folders: Array.from({ length: 150 }, (_, index) => long(index)), scanStopped: false };
    const sent = projectLocationsFoldersSent(input);
    expect(sent).toBeLessThan(150);
    expect(sent).toBeGreaterThan(0);
    expect(JSON.stringify(buildProjectLocationsInput(input)).length).toBeLessThanOrEqual(BUDGET.inputCharacters);
  });
});
