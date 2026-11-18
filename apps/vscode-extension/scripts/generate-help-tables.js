// Run with node apps/vscode-extension/scripts/generate-help-tables.js after a manifest change.
const fs = require('fs');
const path = require('path');
const manifest = require('../package.json');

const helpDirectory = path.resolve(__dirname, '../../../packages/core/resources/help');
const versionLine = /^Reference version: \S+$/gm;

function table(headers, rows) {
  const row = (cells) => '| ' + cells.map(cell => String(cell).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')).join(' | ') + ' |';
  return [row(headers), row(headers.map(() => '---')), ...rows.map(row)].join('\n');
}

function generateHelpTables(manifest, overview) {
  const { commands, configuration, menus } = manifest.contributes;
  const commandRows = commands.map(({ command, title }) => {
    const places = ['Command Palette', ...Object.keys(menus).filter(menu =>
      menus[menu].some(entry => entry.command === command))];
    return [command, title, places.join(', ')];
  });
  const commandsText = '# Commands\n\n## Command locations\n\n' +
    "In the Command Palette, search for Prose Minion and the title. The prose-minion.editorContext menu is the editor's Prose Minion submenu. Menu availability depends on the selection, file type and active view.\n\n" +
    table(['Command id', 'Title', 'Where it appears'], commandRows) + '\n';

  // One independently addressable section per setting keeps IDs stable as the manifest grows.
  const sections = Object.entries(configuration.properties).map(([key, setting]) => {
    const heading = key.replace(/^proseMinion\./, '').replace(/\./g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    const row = [key, setting.type, JSON.stringify(setting.default), setting.markdownDescription ?? setting.description];
    return '## Setting ' + heading + '\n\n' + table(['Key', 'Type', 'Default', 'Description'], [row]);
  });

  if ((overview.match(versionLine) ?? []).length !== 1) {
    throw new Error('overview.md must have one Reference version line');
  }
  return {
    'overview.md': overview.replace(versionLine, 'Reference version: ' + manifest.version),
    'commands.md': commandsText,
    'settings.md': '# Settings\n\n' + sections.join('\n\n') + '\n'
  };
}

module.exports = { generateHelpTables };

if (require.main === module) {
  const overview = fs.readFileSync(path.join(helpDirectory, 'overview.md'), 'utf8');
  for (const [file, contents] of Object.entries(generateHelpTables(manifest, overview))) {
    fs.writeFileSync(path.join(helpDirectory, file), contents);
  }
}
