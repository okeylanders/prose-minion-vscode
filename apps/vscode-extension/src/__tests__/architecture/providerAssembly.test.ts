/**
 * App-shell architecture witnesses (ADR 2026-06-18 composition root, ADR
 * 2026-07-03 Workshop panel).
 *
 * These live app-side — next to the adapter source they verify — so core's
 * boundary suite never reads across the monorepo split (PR #66 review,
 * Marcus). Same scan idiom as core's boundaries.test.ts: fs + regex +
 * empty-offenders-list. Pure file-content witnesses; no vscode API touched.
 */

// The whole core barrel cannot load under jest (an ESM dependency), so the
// runtime values these witnesses use are required from their modules.
/* eslint-disable @typescript-eslint/naming-convention -- the mocked barrel's export names. */
jest.mock('@prose-minion/core', () => ({
  CRAFT_FLAG_CATEGORIES: jest.requireActual('@/domain/models/CraftFlag').CRAFT_FLAG_CATEGORIES,
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  PROOFREAD_SPELLING_CONVENTIONS: jest.requireActual('@/domain/models/DraftEdit').PROOFREAD_SPELLING_CONVENTIONS,
  describeDraftEditOutcome: jest.requireActual('@/application/services/draftEdit/draftEditSummary').describeDraftEditOutcome
}));
/* eslint-enable @typescript-eslint/naming-convention */

import * as fs from 'fs';
import * as path from 'path';
import { LIGHTBOX_FILE_LANGUAGE_IDS } from '@app/application/commands/openFileInLightbox';
import { CRAFT_FLAG_CATEGORIES, DRAFT_EDIT_LANGUAGE_IDS, PROOFREAD_SPELLING_CONVENTIONS } from '@prose-minion/core';
import {
  PROOFREAD_CLEAR_COMMAND,
  PROOFREAD_DISMISS_COMMAND,
  PROOFREAD_FIX_ALL_COMMAND,
  PROOFREAD_FIX_COMMAND,
  PROOFREAD_FLAG_COMMAND,
  PROOFREAD_REPLACE_COMMAND
} from '@app/application/commands/proofreadCommands';
import {
  CRAFT_FLAGS_CLEAR_COMMAND,
  CRAFT_FLAGS_COMMAND,
  CRAFT_FLAGS_DISMISS_COMMAND
} from '@app/application/commands/craftFlagsCommands';

// __dirname = apps/vscode-extension/src/__tests__/architecture -> app src root.
const APP_SRC_ROOT = path.resolve(__dirname, '..', '..');
const PROVIDERS_ROOT = path.join(APP_SRC_ROOT, 'application', 'providers');
const EXTENSION_ENTRY = path.join(APP_SRC_ROOT, 'extension.ts');
const EXTENSION_MANIFEST = path.resolve(APP_SRC_ROOT, '..', 'package.json');

/** The parts of the extension manifest these witnesses read. */
interface ExtensionManifest {
  activationEvents?: string[];
  contributes: {
    commands: Array<{ command: string; title: string; category?: string; icon?: string }>;
    submenus?: Array<{ id: string; label: string }>;
    /** A menu entry names a command, or a submenu (whose items are the menu of that id). */
    menus: Record<string, Array<{ command?: string; submenu?: string; when?: string; group?: string }>>;
  };
}

const readManifest = (): ExtensionManifest =>
  JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as ExtensionManifest;

/** The editor context menu's Prose Minion submenu (Draft Edit Slice 3): its items are the menu of this id. */
const EDITOR_CONTEXT_SUBMENU = 'prose-minion.editorContext';

/** Each command as the Command Palette names it: "category: title". */
const paletteCommands = (manifest: ExtensionManifest) => manifest.contributes.commands.map(({ category, title, ...rest }) =>
  ({ ...rest, title: category ? `${category}: ${title}` : title }));

/**
 * Providers assemble nothing: every service arrives via the CoreServices
 * bundle built in extension.ts. `new MessageHandler` is the ONE sanctioned
 * construction — the per-webview message seam. This is a suffix-convention
 * net (it catches service-shaped class names, not arbitrary classes): Handler
 * IS in the net, so a `new WorkshopRoomHandler(...)` inside a provider
 * fails here rather than slipping through (PR #66 review, Cal).
 */
const FORBIDDEN_SERVICE_CONSTRUCTION = new RegExp(
  String.raw`\bnew\s+(?!MessageHandler\b)[A-Z]\w*(?:Service|Manager|Client|Resolver|Repository|Provider|Orchestrator|Handler|Adapter|Cache|Gateway|Factory)\b`
);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip ANY __tests__ dir in the walk so a future colocated fixture
      // (e.g. a FakeSomethingService test double) can't trip the witness.
      if (entry.name === '__tests__') {
        continue;
      }
      collectSourceFiles(full, acc);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('app-shell provider assembly', () => {
  it('webview providers construct no services — CoreServices is injected, MessageHandler is the only sanctioned new', () => {
    const offenders = collectSourceFiles(PROVIDERS_ROOT)
      .filter((file) => FORBIDDEN_SERVICE_CONSTRUCTION.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('WorkshopPanelProvider is wired from the composition root with the CoreServices bundle (ADR 2026-07-03)', () => {
    const providerSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );
    // The provider receives the bundle; it does not build its own services.
    expect(providerSource).toMatch(/coreServices:\s*CoreServices/);

    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    const start = extensionSource.indexOf('new WorkshopPanelProvider(');
    expect(start).toBeGreaterThan(-1);
    // Scan exactly the constructor call — bounded at its closing `);` — so
    // the witness can't be satisfied by a `coreServices` mention in unrelated
    // trailing code (PR #66 review, Cal).
    const end = extensionSource.indexOf(');', start);
    expect(end).toBeGreaterThan(start);
    const constructionArgs = extensionSource.slice(start, end);
    expect(constructionArgs).toContain('coreServices');
  });

  it('WorkshopPanelProvider seeds excerpts through the webview workshop source convention', () => {
    const providerSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );

    expect(providerSource).toContain("source: 'webview.workshop'");
    expect(providerSource).not.toContain('extension.command.workshop_selection');
  });

  it('routes the Workshop API-key CTA through the existing settings-overlay command', () => {
    const providerSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');

    expect(providerSource).toMatch(
      /new MessageHandler\([\s\S]*?this\.outputChannel,\s*this\.uiActions\s*\)/
    );
    expect(extensionSource).toMatch(
      /openAssistantSettings:[\s\S]*?executeCommand\('prose-minion\.openSettingsOverlay'\)/
    );
  });

  it('registers one Workshop panel serializer that reuses the normal attachment path', () => {
    const providerSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');

    expect(providerSource).toContain('implements vscode.Disposable, vscode.WebviewPanelSerializer');
    expect(providerSource).toMatch(/deserializeWebviewPanel\([\s\S]*?this\.attachPanel\(panel,\s*'restored'\)/);
    expect(providerSource).toMatch(/openOrReveal\(\)[\s\S]*?this\.attachPanel\(panel,\s*'opened'\)/);
    // Serializer state is intentionally not a second Workshop session store.
    expect(providerSource).toContain('_state: unknown');
    expect(providerSource).not.toMatch(/_state\.\w+/);

    // Two full editor tabs restore through serializers: the Workshop and the
    // Lightbox (ADR 2026-10-19 D1). A third needs a deliberate change here.
    const registrations = extensionSource.match(/registerWebviewPanelSerializer\(/g) ?? [];
    expect(registrations).toHaveLength(2);
    expect(extensionSource).toMatch(
      /registerWebviewPanelSerializer\(\s*WorkshopPanelProvider\.viewType,\s*workshopPanelProvider\s*\)/
    );

    const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as {
      activationEvents?: string[];
    };
    expect(manifest.activationEvents).toContain(
      'onWebviewPanel:prose-minion.workshop'
    );
  });

  it('LightboxPanelProvider is wired from the composition root with the CoreServices bundle (ADR 2026-10-19 D1)', () => {
    const providerSource = fs.readFileSync(path.join(PROVIDERS_ROOT, 'LightboxPanelProvider.ts'), 'utf8');
    expect(providerSource).toMatch(/coreServices:\s*CoreServices/);
    expect(providerSource).toMatch(
      /new MessageHandler\(\s*this\.coreServices,[\s\S]*?this\.outputChannel,\s*this\.uiActions\s*\)/
    );

    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    const start = extensionSource.indexOf('new LightboxPanelProvider(');
    expect(start).toBeGreaterThan(-1);
    const end = extensionSource.indexOf(');', start);
    expect(extensionSource.slice(start, end)).toContain('coreServices');
    // The board service is built here, once, and carried in the bundle.
    expect(extensionSource.match(/new LightboxService\(/g)).toHaveLength(1);
    expect(extensionSource).toMatch(/const coreServices: CoreServices = \{[\s\S]*?\blightboxService\b[\s\S]*?\};/);
  });

  it('builds the Lightbox\'s own model engine only here, through the one AI resource manager (Slice 4L)', () => {
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    // One manager builds every scope's engine and client, the Lightbox's included, and rides in the bundle.
    expect(extensionSource.match(/\bnew\s+AIResourceManager\s*\(/g)).toHaveLength(1);
    expect(extensionSource).toMatch(/const coreServices: CoreServices = \{[\s\S]*?\baiResourceManager,[\s\S]*?\};/);
    // The Lightbox's runner reads its engine from that manager.
    const start = extensionSource.indexOf('new LightboxReadingRunner(');
    expect(start).toBeGreaterThan(-1);
    expect(extensionSource.slice(start, extensionSource.indexOf(');', start)))
      .toMatch(/^new LightboxReadingRunner\(\s*aiResourceManager,/);
    // No app module builds an engine, a client or a second manager of its own.
    const offenders = collectSourceFiles(APP_SRC_ROOT)
      .filter((file) => /\bnew\s+(?:AgentRunEngine|OpenRouterClient)\s*\(/.test(fs.readFileSync(file, 'utf8')) ||
        (file !== EXTENSION_ENTRY && /\bnew\s+AIResourceManager\s*\(/.test(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(APP_SRC_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('declares the Lightbox model setting, unset by default so the Lightbox follows the Workshop (Slice 4L)', () => {
    const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as {
      contributes: { configuration: { properties: Record<string, { type?: string; default?: unknown; markdownDescription?: string }> } };
    };
    const setting = manifest.contributes.configuration.properties['proseMinion.lightboxModel'];
    expect(setting).toMatchObject({ type: 'string', default: '' });
    expect(setting.markdownDescription).toMatch(/Leave empty to use the same model as the Workshop/);
  });

  it('registers one Lightbox panel serializer that reuses the normal attachment path', () => {
    const providerSource = fs.readFileSync(path.join(PROVIDERS_ROOT, 'LightboxPanelProvider.ts'), 'utf8');
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');

    expect(providerSource).toContain("public static readonly viewType = 'prose-minion.lightbox';");
    expect(providerSource).toContain('implements vscode.Disposable, vscode.WebviewPanelSerializer');
    expect(providerSource).toContain('retainContextWhenHidden: true');
    expect(providerSource).toMatch(/deserializeWebviewPanel\([\s\S]*?this\.attachPanel\(panel,\s*'restored'\)/);
    expect(providerSource).toMatch(/openOrReveal\(\)[\s\S]*?this\.attachPanel\(panel,\s*'opened'\)/);
    // Serializer state is not a second board store (D12).
    expect(providerSource).toContain('_state: unknown');
    expect(providerSource).not.toMatch(/_state\.\w+/);
    expect(extensionSource).toMatch(
      /registerWebviewPanelSerializer\(\s*LightboxPanelProvider\.viewType,\s*lightboxPanelProvider\s*\)/
    );
  });

  it('seeds Lightbox sources through the panel\'s own handler, under the ticket the command took (PR #152 F-01)', () => {
    const providerSource = fs.readFileSync(path.join(PROVIDERS_ROOT, 'LightboxPanelProvider.ts'), 'utf8');
    const seed = providerSource.slice(providerSource.indexOf('public seedSource('));
    // An overtaken ticket opens nothing; a current one reveals the tab, then boards under that ticket.
    expect(seed).toMatch(
      /if \(!this\.coreServices\.lightboxService\.isCurrentRequest\(ticket\)\) \{\s*return false;\s*\}\s*this\.openOrReveal\(\);\s*void this\.messageHandler\?\.seedLightboxSource\(payload, ticket\);/
    );
    // The ticket never travels in a message a webview could also send.
    expect(seed).not.toMatch(/LIGHTBOX_SET_SOURCE|handleMessage\(/);
    // The Lightbox never reaches into the Workshop's session (D10).
    expect(providerSource).not.toMatch(/WORKSHOP_|workshopSessionService/);
  });

  it('carries a Lightbox handoff into the Workshop only through the Workshop panel\'s own handler (ADR 2026-10-19 D11)', () => {
    const providerSource = fs.readFileSync(path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'), 'utf8');
    const seed = providerSource.slice(
      providerSource.indexOf('public seedLexicalGravityBuild('),
      providerSource.indexOf('public dispose(): void')
    );
    expect(seed).toMatch(/this\.openOrReveal\(\);[\s\S]*?type: MessageType\.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD/);
    expect(seed).toMatch(/\.offer\(panel, \(deliveryId\) => \{[\s\S]*?this\.messageHandler\?\.handleMessage\(message\)/);
    // Delivery is gated on the accepting panel, its readiness and its visibility, and a
    // seed opens only on a granted claim (PR #150 F-03).
    // A seed waits for the panel's receiver to announce itself, so it is listening (F-08).
    expect(providerSource).toMatch(/isReady: \(panel\) => this\.panel === panel && this\.seedReceiver !== undefined && panel\.visible/);
    expect(providerSource).toMatch(
      /MessageType\.WORKSHOP_SEED_CLAIM\s*\|\| shape\?\.type === MessageType\.WORKSHOP_SEED_ANSWER\s*\|\| shape\?\.type === MessageType\.WORKSHOP_SEED_RECEIVER/
    );
    // A Lightbox tile (Slice 4) takes the same path: offered, then routed through the panel's own handler.
    expect(seed).toMatch(/public stageLightboxTile\([\s\S]*?this\.openOrReveal\(\);[\s\S]*?\['lightbox-tile'\]\.offer\(panel, \(deliveryId\) => \{[\s\S]*?type: MessageType\.WORKSHOP_STAGE_LIGHTBOX_TILE[\s\S]*?this\.messageHandler\?\.handleMessage\(message\)/);
    // The seed is not written into the Workshop session from outside.
    expect(seed).not.toMatch(/workshopSessionService|coreServices\./);

    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    const start = extensionSource.indexOf('new LightboxPanelProvider(');
    const lightboxArgs = extensionSource.slice(start, extensionSource.indexOf('\n  );', start));
    expect(lightboxArgs).toMatch(/handOffToWorkshop: \(handoff\) => \{[\s\S]*?workshopPanelProvider\?\.seedLexicalGravityBuild\(handoff\.seed\)/);
    expect(lightboxArgs).toMatch(/case 'tile':\s*return workshopPanelProvider\?\.stageLightboxTile\(handoff\.tile\)/);
    // The Lightbox's own provider never names a Workshop route.
    const lightboxProvider = fs.readFileSync(path.join(PROVIDERS_ROOT, 'LightboxPanelProvider.ts'), 'utf8');
    expect(lightboxProvider).not.toMatch(/WORKSHOP_|seedLexicalGravityBuild/);
  });

  it('declares the Lightbox commands, context menu and activation events', () => {
    const manifest = readManifest();
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');

    expect(manifest.activationEvents).toEqual(expect.arrayContaining([
      'onWebviewPanel:prose-minion.lightbox',
      'onCommand:prose-minion.openLightbox',
      'onCommand:prose-minion.lightboxSelection',
      'onCommand:prose-minion.openFileInLightbox'
    ]));
    expect(paletteCommands(manifest)).toEqual(expect.arrayContaining([
      { command: 'prose-minion.openLightbox', title: 'Prose Minion: Open Lightbox' },
      { command: 'prose-minion.lightboxSelection', title: 'Prose Minion: Open Selection in Lightbox' },
      // The icon is what the editor title's navigation group draws: tiles on a board.
      { command: 'prose-minion.openFileInLightbox', title: 'Prose Minion: Open File in Lightbox', icon: '$(layout)' }
    ]));
    expect(manifest.contributes.menus[EDITOR_CONTEXT_SUBMENU]).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: 'prose-minion.lightboxSelection', when: 'editorHasSelection' })
    ]));
    for (const command of ['prose-minion.openLightbox', 'prose-minion.lightboxSelection', 'prose-minion.openFileInLightbox']) {
      expect(extensionSource).toContain(`registerCommand('${command}'`);
    }
    expect(extensionSource).toMatch(/openLightbox: \(\) => lightboxPanelProvider\?\.openOrReveal\(\)/);
  });

  it('offers Open File in Lightbox on saved Markdown and plain-text files in the Explorer, editor title and editor context menus', () => {
    const { menus } = readManifest().contributes;
    const entries = (menu: string, command: string) => (menus[menu] ?? []).filter((entry) => entry.command === command);
    const OPEN_FILE = 'prose-minion.openFileInLightbox';

    // The Explorer and the editor title name the file's resource; the editor
    // context menu's Prose Minion submenu names the focused editor's language
    // (VS Code when-clause contexts). Folders, untitled buffers and non-disk
    // views get no entry.
    expect(entries('explorer/context', OPEN_FILE)).toEqual([{
      command: OPEN_FILE,
      group: 'prose-minion@1',
      when: '!explorerResourceIsFolder && resourceScheme == file && (resourceLangId == markdown || resourceLangId == plaintext)'
    }]);
    expect(entries('editor/title', OPEN_FILE)).toEqual([{
      command: OPEN_FILE,
      group: 'navigation',
      when: 'resourceScheme == file && (resourceLangId == markdown || resourceLangId == plaintext)'
    }]);
    // The Lightbox's slot in the editor menu: the selection entry with a
    // selection, the file entry without one. They never show together.
    expect(entries(EDITOR_CONTEXT_SUBMENU, OPEN_FILE)).toEqual([{
      command: OPEN_FILE,
      group: '2_open@2',
      when: '!editorHasSelection && resourceScheme == file && (editorLangId == markdown || editorLangId == plaintext)'
    }]);
    expect(entries(EDITOR_CONTEXT_SUBMENU, 'prose-minion.lightboxSelection')).toEqual([{
      command: 'prose-minion.lightboxSelection',
      group: '2_open@2',
      when: 'editorHasSelection'
    }]);

    // The menus offer exactly the languages the command boards.
    for (const [menu, key] of [['explorer/context', 'resourceLangId'], ['editor/title', 'resourceLangId'], [EDITOR_CONTEXT_SUBMENU, 'editorLangId']]) {
      const when = entries(menu, OPEN_FILE)[0].when ?? '';
      expect(when.match(new RegExp(`${key} == (\\w+)`, 'g'))).toEqual(
        LIGHTBOX_FILE_LANGUAGE_IDS.map((languageId) => `${key} == ${languageId}`)
      );
    }

    // No commandPalette rule: the command works from the palette on the
    // active editor's file, and the project hides no command there.
    expect(menus.commandPalette).toBeUndefined();
  });

  it('routes a whole file, from a menu or from the selection command with nothing selected, through Open File in Lightbox', () => {
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');

    expect(extensionSource).toMatch(
      /const handleOpenFileInLightbox = \(target\?: unknown\) => openFileInLightbox\(target, openFileInLightboxHost\);/
    );
    // The launch takes the shared service's ticket and hands it to the panel with the payload (PR #152 F-01).
    expect(extensionSource).toMatch(/beginSourceRequest: \(\) => lightboxService\.beginSourceRequest\(\)/);
    expect(extensionSource).toMatch(
      /seedSource: \(payload, ticket\) => lightboxPanelProvider\?\.seedSource\(payload, ticket\) \?\? false/
    );
    const selection = extensionSource.slice(
      extensionSource.indexOf('const handleLightboxSelection = () => {'),
      extensionSource.indexOf('const handleWordLookupSelection')
    );
    expect(selection).toMatch(/if \(!text\) \{\s*void handleOpenFileInLightbox\(\);\s*return;\s*\}/);
    expect(selection).toMatch(/lightboxPanelProvider\?\.seedSource\(payload\)/);
    // Both commands reach the board only through the panel's seedSource.
    expect(extensionSource.match(/lightboxPanelProvider\?\.seedSource\(/g)).toHaveLength(2);
  });

  it('offers Proofread and Flag on Markdown and plain text in the editor context menu (Draft Edit Slice 1)', () => {
    const manifest = readManifest();
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    const entries = (manifest.contributes.menus[EDITOR_CONTEXT_SUBMENU] ?? [])
      .filter((entry) => entry.command === PROOFREAD_FLAG_COMMAND);

    // With or without a selection (a selection narrows the run), on unsaved buffers too.
    expect(entries).toEqual([{
      command: PROOFREAD_FLAG_COMMAND,
      group: '3_proofread@1',
      when: 'editorLangId == markdown || editorLangId == plaintext'
    }]);
    expect((entries[0].when ?? '').match(/editorLangId == (\w+)/g)).toEqual(
      DRAFT_EDIT_LANGUAGE_IDS.map((languageId) => `editorLangId == ${languageId}`)
    );
    expect(paletteCommands(manifest)).toEqual(expect.arrayContaining([
      { command: PROOFREAD_FLAG_COMMAND, title: 'Prose Minion: Proofread and Flag' },
      { command: PROOFREAD_CLEAR_COMMAND, title: 'Prose Minion: Clear Proofread Flags' }
    ]));
    // Dismiss is a code action's command: registered, never contributed, so the palette never lists it.
    expect(manifest.contributes.commands.map((entry) => entry.command)).not.toContain(PROOFREAD_DISMISS_COMMAND);
    for (const command of ['PROOFREAD_FLAG_COMMAND', 'PROOFREAD_CLEAR_COMMAND', 'PROOFREAD_DISMISS_COMMAND']) {
      expect(extensionSource).toContain(`registerCommand(${command},`);
    }
    // Both ports are the composition root's adapters, threaded through Platform.
    expect(extensionSource).toMatch(/const documentEditor = new VsCodeDocumentEditor\(outputChannel\);\s+context\.subscriptions\.push\(documentEditor\);/);
    expect(extensionSource).toMatch(/documents: documentEditor/);
    expect(extensionSource).toMatch(/annotations: issueAnnotator/);
  });

  it('offers Proofread and Fix wherever it offers Flag, and keeps the quick fixes out of the palette (Draft Edit Slice 2)', () => {
    const manifest = readManifest();
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    const menu = manifest.contributes.menus[EDITOR_CONTEXT_SUBMENU] ?? [];
    const flag = menu.find((entry) => entry.command === PROOFREAD_FLAG_COMMAND);

    expect(menu.filter((entry) => entry.command === PROOFREAD_FIX_COMMAND)).toEqual([{
      command: PROOFREAD_FIX_COMMAND,
      group: '3_proofread@2',
      when: flag?.when
    }]);
    expect(paletteCommands(manifest)).toEqual(expect.arrayContaining([
      { command: PROOFREAD_FIX_COMMAND, title: 'Prose Minion: Proofread and Fix' }
    ]));
    const contributed = manifest.contributes.commands.map((entry) => entry.command);
    for (const quickFix of [PROOFREAD_REPLACE_COMMAND, PROOFREAD_FIX_ALL_COMMAND]) {
      expect(contributed).not.toContain(quickFix);
    }
    for (const command of ['PROOFREAD_FIX_COMMAND', 'PROOFREAD_REPLACE_COMMAND', 'PROOFREAD_FIX_ALL_COMMAND']) {
      expect(extensionSource).toContain(`registerCommand(${command},`);
    }
    // The applier is the composition root's: the one door to the writer's document.
    expect(extensionSource).toMatch(/new DraftEditApplier\(platform\.documents\)/);
  });

  it('declares how Fix reviews its fixes, Refactor Preview by default, under the key the host reads (Draft Edit Slice 2)', () => {
    const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as {
      contributes: { configuration: { properties: Record<string, { type?: string; enum?: string[]; default?: unknown }> } };
    };
    expect(manifest.contributes.configuration.properties['proseMinion.proofread.fixReview'])
      .toMatchObject({ type: 'string', enum: ['preview', 'apply'], default: 'preview' });
    expect(fs.readFileSync(EXTENSION_ENTRY, 'utf8'))
      .toContain(`getConfiguration('proseMinion').get<string>('proofread.fixReview') === 'apply'`);
  });

  it('declares the spelling convention Proofread holds the text to, the host\'s list plus auto, under the key the host reads (Draft Edit Slice 3)', () => {
    const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as {
      contributes: { configuration: { properties: Record<string, { type?: string; enum?: string[]; enumDescriptions?: string[]; default?: unknown }> } };
    };
    const setting = manifest.contributes.configuration.properties['proseMinion.proofread.spellingConvention'];
    expect(setting).toMatchObject({ type: 'string', enum: ['auto', ...PROOFREAD_SPELLING_CONVENTIONS], default: 'auto' });
    expect(setting.enumDescriptions).toHaveLength(setting.enum!.length);
    expect(fs.readFileSync(EXTENSION_ENTRY, 'utf8'))
      .toContain(`spellingConvention: () => vscode.workspace.getConfiguration('proseMinion').get<string>('proofread.spellingConvention')`);
  });

  it('declares the word list Proofread accepts, an array of strings, under the key the host reads (Draft Edit Slice 3b)', () => {
    const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as {
      contributes: { configuration: { properties: Record<string, { type?: string; items?: { type?: string }; default?: unknown }> } };
    };
    expect(manifest.contributes.configuration.properties['proseMinion.proofread.wordList'])
      .toMatchObject({ type: 'array', items: { type: 'string' }, default: [] });
    expect(fs.readFileSync(EXTENSION_ENTRY, 'utf8'))
      .toContain(`wordList: () => vscode.workspace.getConfiguration('proseMinion').get<unknown>('proofread.wordList')`);
  });

  it('offers Craft Flags beside Proofread, in its own group, with its own flags and no quick fix (Draft Edit Slice 3c)', () => {
    const manifest = readManifest();
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    const menu = manifest.contributes.menus[EDITOR_CONTEXT_SUBMENU] ?? [];
    const flag = menu.find((entry) => entry.command === PROOFREAD_FLAG_COMMAND);

    expect(menu.filter((entry) => entry.command === CRAFT_FLAGS_COMMAND)).toEqual([{
      command: CRAFT_FLAGS_COMMAND,
      group: '4_craft@1',
      when: flag?.when
    }]);
    expect(paletteCommands(manifest)).toEqual(expect.arrayContaining([
      { command: CRAFT_FLAGS_COMMAND, title: 'Prose Minion: Craft Flags' },
      { command: CRAFT_FLAGS_CLEAR_COMMAND, title: 'Prose Minion: Clear Craft Flags' }
    ]));
    expect(manifest.contributes.commands.map((entry) => entry.command)).not.toContain(CRAFT_FLAGS_DISMISS_COMMAND);
    for (const command of ['CRAFT_FLAGS_COMMAND', 'CRAFT_FLAGS_CLEAR_COMMAND', 'CRAFT_FLAGS_DISMISS_COMMAND']) {
      expect(extensionSource).toContain(`registerCommand(${command},`);
    }
    // Its own annotator, with Dismiss and Clear only: no replace or fix-all command to offer.
    expect(extensionSource).toContain(
      'new VsCodeIssueAnnotator({ dismiss: CRAFT_FLAGS_DISMISS_COMMAND, clear: CRAFT_FLAGS_CLEAR_COMMAND }, CRAFT_FLAGS)'
    );
    expect(extensionSource).toMatch(/craftAnnotations: craftAnnotator/);
    // Its run is built with no applier.
    const built = extensionSource.slice(extensionSource.indexOf('new CraftFlagsUseCase('), extensionSource.indexOf('const coreServices'));
    expect(built).not.toMatch(/Applier/);
  });

  it('declares the Craft Flags model, empty so it follows the Workshop\'s until picked (Draft Edit Slice 3c)', () => {
    const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as {
      contributes: { configuration: { properties: Record<string, { type?: string; default?: unknown }> } };
    };
    expect(manifest.contributes.configuration.properties['proseMinion.craftModel']).toMatchObject({ type: 'string', default: '' });
  });

  it('declares which Craft Flags categories run, every one on by default, under the key the host reads (Slice 3c part 2)', () => {
    const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as {
      contributes: { configuration: { properties: Record<string, {
        type?: string; uniqueItems?: boolean; default?: unknown; items?: { type?: string; enum?: string[]; enumDescriptions?: string[] };
      }> } };
    };
    const setting = manifest.contributes.configuration.properties['proseMinion.craftFlags.categories'];
    expect(setting).toMatchObject({ type: 'array', uniqueItems: true, items: { type: 'string', enum: [...CRAFT_FLAG_CATEGORIES] } });
    expect(setting.default).toEqual([...CRAFT_FLAG_CATEGORIES]);
    expect(setting.items?.enumDescriptions).toHaveLength(CRAFT_FLAG_CATEGORIES.length);
    expect(fs.readFileSync(EXTENSION_ENTRY, 'utf8'))
      .toContain(`craftFlagCategories: () => vscode.workspace.getConfiguration('proseMinion').get<unknown>('craftFlags.categories')`);
  });

  it('gives the shared AI manager its key and model subscriptions for the extension\'s lifetime, before any webview (PR #171 F-01)', () => {
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    expect(extensionSource).toMatch(/const aiResourceRefresh = new AIResourceRefresh\(aiResourceManager, secretsService, platform\.settings, outputChannel\);/);
    expect(extensionSource).toMatch(
      /context\.subscriptions\.push\(\s*aiResourceRefresh,\s*vscode\.workspace\.onDidChangeConfiguration\(event => aiResourceRefresh\.handleConfigurationChange\(section => event\.affectsConfiguration\(section\)\)\)\s*\)/
    );
    // Live from activation, so an editor command with no webview open sees every change.
    const built = extensionSource.indexOf('new AIResourceRefresh(');
    for (const provider of ['new ProseToolsViewProvider(', 'registerWebviewViewProvider(', 'registerCommand(PROOFREAD_FLAG_COMMAND,']) {
      expect(built).toBeLessThan(extensionSource.indexOf(provider));
    }
  });

  it('names only declared commands and submenus in its menus, each command with an activation event', () => {
    const manifest = readManifest();
    const declared = new Set(manifest.contributes.commands.map((entry) => entry.command));
    const submenus = new Set((manifest.contributes.submenus ?? []).map((entry) => entry.id));
    const activation = new Set(manifest.activationEvents ?? []);
    const entries = Object.entries(manifest.contributes.menus)
      .flatMap(([menu, items]) => items.map((entry) => ({ menu, ...entry })));
    const named = entries.flatMap(({ menu, command }) => (command ? [{ menu, command }] : []));

    expect(named.length).toBeGreaterThan(0);
    // Each entry names exactly one command or one submenu.
    expect(entries.filter((entry) => (entry.command === undefined) === (entry.submenu === undefined))).toEqual([]);
    expect(named.filter(({ command }) => !declared.has(command))).toEqual([]);
    expect(named.filter(({ command }) => !activation.has(`onCommand:${command}`))).toEqual([]);
    // A submenu named in a menu is declared, and has a menu of its own items.
    for (const { submenu } of entries.filter((entry) => entry.submenu !== undefined)) {
      expect(submenus.has(submenu!)).toBe(true);
      expect(manifest.contributes.menus[submenu!]?.length).toBeGreaterThan(0);
    }
  });

  it('quiesces the Workshop handler before the final deactivation flush', () => {
    const providerSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');

    const providerDispose = providerSource.slice(
      providerSource.indexOf('public dispose(): void'),
      providerSource.indexOf('\n  }\n}', providerSource.indexOf('public dispose(): void'))
    );
    expect(providerDispose.indexOf('this.messageHandler?.dispose()'))
      .toBeLessThan(providerDispose.indexOf('panel?.dispose()'));

    const deactivate = extensionSource.slice(
      extensionSource.indexOf('export async function deactivate()'),
      extensionSource.indexOf('\n}', extensionSource.indexOf('export async function deactivate()'))
    );
    expect(deactivate.indexOf('workshopPanelProvider?.dispose()'))
      .toBeLessThan(deactivate.indexOf('await workshopSessionPersistenceCoordinator?.flush()'));

    // The Lightbox mirrors the Workshop's order: handler before panel.
    const lightboxSource = fs.readFileSync(path.join(PROVIDERS_ROOT, 'LightboxPanelProvider.ts'), 'utf8');
    const lightboxDispose = lightboxSource.slice(
      lightboxSource.indexOf('public dispose(): void'),
      lightboxSource.indexOf('\n  }\n}', lightboxSource.indexOf('public dispose(): void'))
    );
    expect(lightboxDispose.indexOf('this.messageHandler?.dispose()'))
      .toBeLessThan(lightboxDispose.indexOf('panel?.dispose()'));
  });

  it('every MessageHandler in a provider is built over the ONE injected coreServices bundle (PR #66 review #12)', () => {
    // The risk is not two panels — it is two independently-assembled service
    // bundles (e.g. a second polling AccountBalanceService) hiding behind
    // retainContextWhenHidden. Every `new MessageHandler(` in every provider
    // must take `this.coreServices` as its first argument, verbatim.
    const offenders: string[] = [];
    for (const file of collectSourceFiles(PROVIDERS_ROOT)) {
      const source = fs.readFileSync(file, 'utf8');
      let cursor = 0;
      for (;;) {
        const start = source.indexOf('new MessageHandler(', cursor);
        if (start === -1) {
          break;
        }
        const end = source.indexOf(');', start);
        const constructionArgs = source.slice(start, end === -1 ? source.length : end);
        if (!/new MessageHandler\(\s*this\.coreServices\b/.test(constructionArgs)) {
          offenders.push(path.relative(APP_SRC_ROOT, file));
        }
        cursor = start + 'new MessageHandler('.length;
      }
    }
    expect(offenders).toEqual([]);

    // And the Workshop and Lightbox providers actually HAVE their per-webview
    // seams — the witness above must be guarding something real.
    for (const provider of ['WorkshopPanelProvider.ts', 'LightboxPanelProvider.ts']) {
      expect(fs.readFileSync(path.join(PROVIDERS_ROOT, provider), 'utf8')).toContain('new MessageHandler(');
    }
  });

  it('builds session recall from the store and coordinator, before the factory that alone consumes it (ADR 2026-10-05 §9)', () => {
    const source = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    const at = (needle: string): number => {
      const index = source.indexOf(needle);
      expect(index).toBeGreaterThan(-1);
      return index;
    };
    const recall = source.slice(at('new WorkshopTranscriptRecallService('));
    const recallArgs = recall.slice(0, recall.indexOf(');'));
    const factory = source.slice(at('new WorkshopPersonaCapabilityFactory('));
    const factoryArgs = factory.slice(0, factory.indexOf(');'));

    expect(recallArgs).toMatch(/\(\s*workshopSessionStore,\s*workshopSessionPersistenceCoordinator,\s*outputChannel\s*$/);
    expect(factoryArgs).toMatch(/workshopTranscriptRecallService\s*$/);
    expect(at('new WorkshopSessionStore(')).toBeLessThan(at('new WorkshopSessionPersistenceCoordinator('));
    expect(at('new WorkshopSessionPersistenceCoordinator(')).toBeLessThan(at('new WorkshopTranscriptRecallService('));
    expect(at('new WorkshopTranscriptRecallService(')).toBeLessThan(at('new WorkshopPersonaCapabilityFactory('));
    expect(at('new WorkshopPersonaCapabilityFactory(')).toBeLessThan(at('new RunWorkshopToolSidePass('));
    // One consumer: no CoreServices field carries it.
    expect(source.match(/workshopTranscriptRecallService/g)).toHaveLength(2);
  });
});
