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

// __dirname = apps/vscode-extension/src/__tests__/architecture -> app src root.
const APP_SRC_ROOT = path.resolve(__dirname, '..', '..');
const PROVIDERS_ROOT = path.join(APP_SRC_ROOT, 'application', 'providers');
const EXTENSION_ENTRY = path.join(APP_SRC_ROOT, 'extension.ts');
const EXTENSION_MANIFEST = path.resolve(APP_SRC_ROOT, '..', 'package.json');

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
    const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as {
      activationEvents?: string[];
      contributes: {
        commands: Array<{ command: string; title: string }>;
        // eslint-disable-next-line @typescript-eslint/naming-convention -- the manifest's menu id.
        menus: { 'editor/context': Array<{ command: string; when?: string }> };
      };
    };
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');

    expect(manifest.activationEvents).toEqual(expect.arrayContaining([
      'onWebviewPanel:prose-minion.lightbox',
      'onCommand:prose-minion.openLightbox',
      'onCommand:prose-minion.lightboxSelection'
    ]));
    expect(manifest.contributes.commands).toEqual(expect.arrayContaining([
      { command: 'prose-minion.openLightbox', title: 'Prose Minion: Open Lightbox' },
      { command: 'prose-minion.lightboxSelection', title: 'Prose Minion: Open Selection in Lightbox' }
    ]));
    expect(manifest.contributes.menus['editor/context']).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: 'prose-minion.lightboxSelection', when: 'editorHasSelection' })
    ]));
    for (const command of ['prose-minion.openLightbox', 'prose-minion.lightboxSelection']) {
      expect(extensionSource).toContain(`registerCommand('${command}'`);
    }
    expect(extensionSource).toMatch(/openLightbox: \(\) => lightboxPanelProvider\?\.openOrReveal\(\)/);
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
