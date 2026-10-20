/**
 * App-shell architecture witnesses (ADR 2026-06-18 composition root, ADR
 * 2026-07-03 Workshop panel).
 *
 * These live app-side — next to the adapter source they verify — so core's
 * boundary suite never reads across the monorepo split (PR #66 review,
 * Marcus). Same scan idiom as core's boundaries.test.ts: fs + regex +
 * empty-offenders-list. Pure file-content witnesses; no vscode API touched.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LIGHTBOX_FILE_LANGUAGE_IDS } from '@app/application/commands/openFileInLightbox';

// __dirname = apps/vscode-extension/src/__tests__/architecture -> app src root.
const APP_SRC_ROOT = path.resolve(__dirname, '..', '..');
const PROVIDERS_ROOT = path.join(APP_SRC_ROOT, 'application', 'providers');
const EXTENSION_ENTRY = path.join(APP_SRC_ROOT, 'extension.ts');
const EXTENSION_MANIFEST = path.resolve(APP_SRC_ROOT, '..', 'package.json');

/** The parts of the extension manifest these witnesses read. */
interface ExtensionManifest {
  activationEvents?: string[];
  contributes: {
    commands: Array<{ command: string; title: string; icon?: string }>;
    menus: Record<string, Array<{ command: string; when?: string; group?: string }>>;
  };
}

const readManifest = (): ExtensionManifest =>
  JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as ExtensionManifest;

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

  it('seeds Lightbox sources through the panel\'s own handler under the webview lightbox source', () => {
    const providerSource = fs.readFileSync(path.join(PROVIDERS_ROOT, 'LightboxPanelProvider.ts'), 'utf8');
    const seed = providerSource.slice(providerSource.indexOf('public seedSource('));
    expect(seed).toMatch(/this\.openOrReveal\(\);[\s\S]*?type: MessageType\.LIGHTBOX_SET_SOURCE,\s*source: 'webview\.lightbox'/);
    expect(seed).toMatch(/this\.messageHandler\?\.handleMessage\(message\)/);
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
    expect(providerSource).toMatch(/isReady: \(panel\) => this\.panel === panel && this\.webviewListening && panel\.visible/);
    expect(providerSource).toMatch(/MessageType\.WORKSHOP_SEED_CLAIM \|\| shape\?\.type === MessageType\.WORKSHOP_SEED_ANSWER/);
    // The seed is not written into the Workshop session from outside.
    expect(seed).not.toMatch(/workshopSessionService|coreServices\./);

    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    const start = extensionSource.indexOf('new LightboxPanelProvider(');
    const lightboxArgs = extensionSource.slice(start, extensionSource.indexOf('\n  );', start));
    expect(lightboxArgs).toMatch(/handOffToWorkshop: \(handoff\) => \{[\s\S]*?workshopPanelProvider\?\.seedLexicalGravityBuild\(handoff\.seed\)/);
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
    expect(manifest.contributes.commands).toEqual(expect.arrayContaining([
      { command: 'prose-minion.openLightbox', title: 'Prose Minion: Open Lightbox' },
      { command: 'prose-minion.lightboxSelection', title: 'Prose Minion: Open Selection in Lightbox' },
      // The icon is what the editor title's navigation group draws: tiles on a board.
      { command: 'prose-minion.openFileInLightbox', title: 'Prose Minion: Open File in Lightbox', icon: '$(layout)' }
    ]));
    expect(manifest.contributes.menus['editor/context']).toEqual(expect.arrayContaining([
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
    // context menu names the focused editor's language (VS Code when-clause
    // contexts). Folders, untitled buffers and non-disk views get no entry.
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
    expect(entries('editor/context', OPEN_FILE)).toEqual([{
      command: OPEN_FILE,
      group: 'prose-minion@3',
      when: '!editorHasSelection && resourceScheme == file && (editorLangId == markdown || editorLangId == plaintext)'
    }]);
    expect(entries('editor/context', 'prose-minion.lightboxSelection')).toEqual([{
      command: 'prose-minion.lightboxSelection',
      group: 'prose-minion@3',
      when: 'editorHasSelection'
    }]);

    // The menus offer exactly the languages the command boards.
    for (const [menu, key] of [['explorer/context', 'resourceLangId'], ['editor/title', 'resourceLangId'], ['editor/context', 'editorLangId']]) {
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
    expect(extensionSource).toMatch(/seedSource: \(payload\) => lightboxPanelProvider\?\.seedSource\(payload\)/);
    const selection = extensionSource.slice(
      extensionSource.indexOf('const handleLightboxSelection = () => {'),
      extensionSource.indexOf('const handleWordLookupSelection')
    );
    expect(selection).toMatch(/if \(!text\) \{\s*void handleOpenFileInLightbox\(\);\s*return;\s*\}/);
    expect(selection).toMatch(/lightboxPanelProvider\?\.seedSource\(payload\)/);
    // Both commands reach the board only through the panel's seedSource.
    expect(extensionSource.match(/lightboxPanelProvider\?\.seedSource\(/g)).toHaveLength(2);
  });

  it('names only declared commands in its menus, each with an activation event', () => {
    const manifest = readManifest();
    const declared = new Set(manifest.contributes.commands.map((entry) => entry.command));
    const activation = new Set(manifest.activationEvents ?? []);
    const named = Object.entries(manifest.contributes.menus)
      .flatMap(([menu, entries]) => entries.map((entry) => ({ menu, command: entry.command })));

    expect(named.length).toBeGreaterThan(0);
    expect(named.filter(({ command }) => !declared.has(command))).toEqual([]);
    expect(named.filter(({ command }) => !activation.has(`onCommand:${command}`))).toEqual([]);
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
