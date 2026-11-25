import * as fs from 'fs';
import * as path from 'path';
import { WORKSHOP_RAIL_TABS } from '@hooks/domain/workshop/controllers/useWorkshopRailTabs';
import { WORKSHOP_CONVERSATION_SETTINGS_TABS } from '@components/workshop/settings/workshopConversationSettingsTabs';
import { searchWorkshopHelp } from '@/application/services/workshop/help/WorkshopHelpReference';
import { bundledHelpReference, helpDirectory } from '@/__tests__/application/services/workshop/help/bundledHelpReference';

const appDirectory = path.resolve(helpDirectory, '../../../../apps/vscode-extension');
interface Manifest {
  version: string;
  contributes: {
    commands: Array<{ command: string }>;
    configuration: { properties: Record<string, unknown> };
  };
}

const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(appDirectory, 'package.json'), 'utf8'));
const { generateHelpTables } = require(path.join(appDirectory, 'scripts/generate-help-tables.js')) as {
  generateHelpTables(input: Manifest, overview: string): Record<string, string>;
};
const helpFile = (name: string): string => fs.readFileSync(path.join(helpDirectory, name), 'utf8');

describe('bundled product help', () => {
  it('ships the current version and the exact tables regenerated from the manifest', () => {
    const generated = generateHelpTables(manifest, helpFile('overview.md'));
    for (const [file, contents] of Object.entries(generated)) {
      expect(helpFile(file)).toBe(contents);
    }
    expect(generated['overview.md'].split('\n')).toContain('Reference version: ' + manifest.version);
    for (const { command } of manifest.contributes.commands) {
      expect(generated['commands.md']).toContain('| ' + command + ' |');
    }
    for (const key of Object.keys(manifest.contributes.configuration.properties)) {
      expect(generated['settings.md']).toContain('| ' + key + ' |');
    }
  });

  it('assigns every command and setting to an existing hand-written section', async () => {
    const ownership: Record<string, string> = JSON.parse(helpFile('index.json'));
    const ids = [
      ...manifest.contributes.commands.map(entry => entry.command),
      ...Object.keys(manifest.contributes.configuration.properties)
    ];
    expect(Object.keys(ownership).sort()).toEqual(ids.sort());
    const index = (await bundledHelpReference({ appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() }).load())?.sections;
    expect(index).toBeDefined();
    for (const owner of Object.values(ownership)) {
      expect(owner).not.toMatch(/^(settings|commands)#/);
      expect(index?.get(owner)?.id).toBe(owner);
    }
  });

  it('finds the Workshop tab commands and closed-room recovery in the bundled help', async () => {
    const reference = await bundledHelpReference({ appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() }).load();
    if (!reference) throw new Error('Bundled Workshop help could not be loaded');

    for (const query of ['multiple Workshop tabs', 'new Workshop tab', 'reopen closed Workshop room']) {
      const { hits } = searchWorkshopHelp(reference.sections, query);
      expect(hits.map(hit => hit.id)).toContain('workshop#multiple-workshop-tabs');
    }
  });

  it('names every Workshop rail and conversation settings tab as a control', () => {
    const workshop = helpFile('workshop.md');
    for (const tab of WORKSHOP_RAIL_TABS) {
      expect(workshop.toLowerCase()).toContain('**' + tab.toLowerCase() + '**');
    }
    for (const { label } of WORKSHOP_CONVERSATION_SETTINGS_TABS) {
      expect(workshop).toContain('**' + label + '**');
    }
  });
});
