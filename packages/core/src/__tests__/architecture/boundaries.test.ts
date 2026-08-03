/**
 * Architectural boundary guards.
 *
 * A living registry of invariants the type-checker can't express. Add new
 * architectural witnesses here (one `it` per invariant) rather than scattering
 * them — a future contributor should find every boundary in one place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. @prose-minion/core is vscode-free — PERIOD (ADR 2026-06-16, monorepo split).
 *    After the Stage-2 move, the VS Code shell (extension.ts, the
 *    WebviewViewProvider, and the platform/vscode adapters) lives in
 *    `apps/vscode-extension`, NOT here. So core has NO sanctioned-shell
 *    exceptions: nothing under `packages/core/src` may import `vscode`. This is
 *    what lets core compile against an absent `vscode` module and unblocks the
 *    future desktop (Electron) app. Tests are skipped (they mock vscode by design).
 *
 *    RENDERER GLOBAL (sealed in Stage-2 Wave 1): the webview's runtime touchpoint
 *    is the `acquireVsCodeApi()` global, wrapped behind `AppMessagePort`
 *    (presentation/webview/ports/) and referenced in exactly ONE module — the
 *    VS Code adapter `presentation/webview/hooks/useVSCodeApi.ts`. It is NOT an
 *    `import 'vscode'`, so this import-scan guard does not (and need not) catch it.
 *
 *    APP-SHELL WITNESSES live on the other side of the split, next to the
 *    adapter they verify: apps/vscode-extension/src/__tests__/architecture/.
 *    This suite scans packages/core/src ONLY — core must never read the VS
 *    Code shell's source, not even in tests (PR #66 review, Marcus).
 */

import * as fs from 'fs';
import * as path from 'path';

// __dirname = packages/core/src/__tests__/architecture -> core's src root.
const SRC_ROOT = path.resolve(__dirname, '..', '..');

const SKIP_DIRS = new Set<string>([
  path.join(SRC_ROOT, '__tests__'), // tests mock vscode by design
]);

// Catches static `import … from 'vscode'`, `import * as vscode from 'vscode'`,
// `require('vscode')`, AND dynamic `import('vscode')` / `await import('vscode')`
// (a prior TextSourceResolver used exactly that idiom — see decision tracker D15).
const VSCODE_IMPORT = new RegExp(
  [
    /from\s+['"]vscode['"]/.source,
    /import\s+\*\s+as\s+vscode\s+from\s+['"]vscode['"]/.source,
    /require\(\s*['"]vscode['"]\s*\)/.source,
    /import\(\s*['"]vscode['"]\s*\)/.source,
  ].join('|')
);

const HANDLERS_ROOT = path.join(
  SRC_ROOT,
  'application',
  'handlers'
);
const WORKSHOP_HANDLER_ROOT = path.join(HANDLERS_ROOT, 'domain');

/**
 * Phase-0 migration witness for ADR 2026-08-03. This map records current route
 * truth before any files move. Every route must have exactly one owner. Later
 * phases update the owner path as part of the same pure-move commit; the two
 * generic standing routes must leave the Lexical handler in Phase 2.
 */
const WORKSHOP_WIDGET_ROUTE_OWNERS = [
  {
    messageType: 'WORKSHOP_WIDGET_GENERATE',
    owner: 'application/handlers/domain/WorkshopWidgetHandler.ts'
  },
  {
    messageType: 'WORKSHOP_REQUEST_WIDGET_CONFIG',
    owner: 'application/handlers/domain/WorkshopWidgetHandler.ts'
  },
  {
    messageType: 'WORKSHOP_COMMIT_WIDGET',
    owner: 'application/handlers/domain/WorkshopWidgetHandler.ts'
  },
  {
    messageType: 'WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES',
    owner: 'application/handlers/domain/WorkshopLexicalGravityHandler.ts'
  },
  {
    messageType: 'WORKSHOP_PREVIEW_LEXICAL_GRAVITY',
    owner: 'application/handlers/domain/WorkshopLexicalGravityHandler.ts'
  },
  {
    messageType: 'WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS',
    owner: 'application/handlers/domain/WorkshopLexicalGravityHandler.ts'
  },
  {
    messageType: 'WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES',
    owner: 'application/handlers/domain/WorkshopLexicalGravityHandler.ts'
  },
  // Legacy Phase-2 exceptions: family-generic routes have a feature owner.
  {
    messageType: 'WORKSHOP_APPLY_STANDING_WIDGET',
    owner: 'application/handlers/domain/WorkshopLexicalGravityHandler.ts'
  },
  {
    messageType: 'WORKSHOP_REMOVE_STANDING_WIDGET',
    owner: 'application/handlers/domain/WorkshopLexicalGravityHandler.ts'
  }
] as const;

/**
 * Exact known false-generic ownership at the start of the refactor. This list
 * may only shrink. A phase that removes an exception updates this witness in
 * the same commit; Phase 7 requires an empty list.
 */
const WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS = [
  {
    phase: 1,
    file: 'application/handlers/domain/WorkshopWidgetHandler.ts',
    marker: /GesturePlaygroundService/
  },
  {
    phase: 1,
    file: 'presentation/webview/hooks/domain/useWorkshop.ts',
    marker: /message\.payload\.widgetId === 'gesture-playground'/
  },
  {
    phase: 2,
    file: 'application/services/workshop/directives/WorkshopStandingDirectiveService.ts',
    marker: /family: 'lexical-gravity'/
  },
  {
    phase: 2,
    file: 'application/handlers/domain/WorkshopLexicalGravityHandler.ts',
    marker: /MessageType\.WORKSHOP_APPLY_STANDING_WIDGET/
  }
] as const;

const WORKSHOP_CAPABILITY_BOUNDARY = [
  path.join(SRC_ROOT, 'shared', 'types', 'workshopCapabilities.ts'),
  path.join(SRC_ROOT, 'application', 'services', 'workshop', 'WorkshopAnalysisSidePass.ts'),
  path.join(SRC_ROOT, 'application', 'services', 'workshop', 'WorkshopCapabilityXmlCodec.ts'),
  path.join(SRC_ROOT, 'application', 'services', 'workshop', 'WorkshopPersonaCapability.ts')
];
const HOST_OR_PRESENTATION_IMPORT = /(?:from\s+['"](?:vscode|react|@providers\/)|import\s+.*['"](?:vscode|react|@providers\/))/;

// WorkshopSessionService is in the net (PR #67 review #14): it is the
// composition-root-owned reload-safety aggregate — a handler `new`-ing its
// own copy would silently fork the session per webview.
const FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION = new RegExp(
  String.raw`\bnew\s+(TextSourceResolver|CategorySearchService|AccountBalanceService|OpenRouterAccountClient|PublishingStandardsRepository|WorkshopSessionService|WorkshopRoomDeliveryService|WorkshopSessionPersistenceCoordinator|WorkshopSessionStore)\b`
);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(full)) {
        continue;
      }
      collectSourceFiles(full, acc);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('architectural boundaries', () => {
  it('core imports no vscode anywhere (static OR dynamic import)', () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter((file) => VSCODE_IMPORT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('application handlers do not construct infrastructure services', () => {
    const offenders = collectSourceFiles(HANDLERS_ROOT)
      .filter((file) => FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('Workshop capability contracts and routes import no host, React, or provider types', () => {
    const offenders = WORKSHOP_CAPABILITY_BOUNDARY
      .filter((file) => HOST_OR_PRESENTATION_IMPORT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('Workshop has one room-frame materializer and one offset-advance call site', () => {
    const sourceFiles = collectSourceFiles(SRC_ROOT);
    const frameMaterializers = sourceFiles
      .filter((file) =>
        /import\s*\{[^}]*buildWorkshopRoomCatchUp[^}]*\}\s*from/s.test(
          fs.readFileSync(file, 'utf8')
        )
      )
      .map((file) => path.relative(SRC_ROOT, file));
    const offsetAdvancers = sourceFiles
      .filter((file) => /\.advanceRoomDeliveryOffset\(/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(frameMaterializers).toEqual([
      'application/services/workshop/WorkshopRoomDeliveryService.ts'
    ]);
    expect(offsetAdvancers).toEqual([
      'application/services/workshop/WorkshopRoomDeliveryService.ts'
    ]);
  });

  it('Workshop widget and standing routes have exactly one explicit owner', () => {
    const handlerFiles = collectSourceFiles(WORKSHOP_HANDLER_ROOT);
    const actualOwners: Record<string, string> = {};

    for (const { messageType, owner: expectedOwner } of WORKSHOP_WIDGET_ROUTE_OWNERS) {
      const registration = new RegExp(
        String.raw`(?:router\.register|registerMutation)\(\s*MessageType\.${messageType}\b`,
        's'
      );
      const owners = handlerFiles
        .filter((file) => registration.test(fs.readFileSync(file, 'utf8')))
        .map((file) => path.relative(SRC_ROOT, file));

      expect(owners).toEqual([expectedOwner]);
      actualOwners[messageType] = owners[0];
    }

    expect(actualOwners).toEqual(Object.fromEntries(
      WORKSHOP_WIDGET_ROUTE_OWNERS.map(({ messageType, owner }) => [messageType, owner])
    ));
  });

  it('Workshop feature modules do not import the sibling feature', () => {
    const sourceFiles = collectSourceFiles(SRC_ROOT);
    const gestureOffenders = sourceFiles
      .filter((file) => /GesturePlayground/i.test(path.relative(SRC_ROOT, file)))
      .filter((file) => /(?:LexicalGravity|lexicalGravity|lexical-gravity)/.test(
        fs.readFileSync(file, 'utf8')
      ))
      .map((file) => path.relative(SRC_ROOT, file));
    const lexicalOffenders = sourceFiles
      .filter((file) => /LexicalGravity/i.test(path.relative(SRC_ROOT, file)))
      .filter((file) => /(?:GesturePlayground|gesturePlayground|gesture-playground)/.test(
        fs.readFileSync(file, 'utf8')
      ))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(gestureOffenders).toEqual([]);
    expect(lexicalOffenders).toEqual([]);
  });

  it('Workshop handlers cannot bypass the session aggregate through internal ledgers', () => {
    const INTERNAL_SESSION_LEDGER = /(?:WorkshopWidgetConfigLedger|WorkshopStandingDirectiveLedger)/;
    const offenders = collectSourceFiles(WORKSHOP_HANDLER_ROOT)
      .filter((file) => INTERNAL_SESSION_LEDGER.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('keeps the accepted Workshop legacy ownership exceptions exact during migration', () => {
    const observed = WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS
      .filter(({ file, marker }) => marker.test(fs.readFileSync(path.join(SRC_ROOT, file), 'utf8')))
      .map(({ phase, file }) => `P${phase}:${file}`);

    expect(observed).toEqual([
      'P1:application/handlers/domain/WorkshopWidgetHandler.ts',
      'P1:presentation/webview/hooks/domain/useWorkshop.ts',
      'P2:application/services/workshop/directives/WorkshopStandingDirectiveService.ts',
      'P2:application/handlers/domain/WorkshopLexicalGravityHandler.ts'
    ]);
  });
});
