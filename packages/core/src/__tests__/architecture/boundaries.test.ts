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
 * Phase-0 migration witness for ADR 2026-08-03. MessageRouter already rejects
 * duplicate registrations at runtime; this map adds a declared ownership
 * ledger that pins each inbound widget/standing route to its expected file.
 * The two family-generic standing routes belong to the shared handler; feature
 * handlers retain only their own catalog, preview, generation, and save routes.
 */
const WORKSHOP_WIDGET_ROUTE_OWNERS = [
  {
    messageType: 'WORKSHOP_GESTURE_PLAYGROUND_GENERATE',
    owner: 'application/handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler.ts'
  },
  {
    messageType: 'CANCEL_GESTURE_PLAYGROUND_GENERATE_REQUEST',
    owner: 'application/handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler.ts'
  },
  {
    messageType: 'WORKSHOP_REQUEST_WIDGET_CONFIG',
    owner: 'application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts'
  },
  {
    messageType: 'WORKSHOP_COMMIT_WIDGET',
    owner: 'application/handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler.ts'
  },
  {
    messageType: 'WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES',
    owner: 'application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler.ts'
  },
  {
    messageType: 'WORKSHOP_PREVIEW_LEXICAL_GRAVITY',
    owner: 'application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler.ts'
  },
  {
    messageType: 'WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS',
    owner: 'application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler.ts'
  },
  {
    messageType: 'WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES',
    owner: 'application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler.ts'
  },
  {
    messageType: 'WORKSHOP_APPLY_STANDING_WIDGET',
    owner: 'application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.ts'
  },
  {
    messageType: 'WORKSHOP_REMOVE_STANDING_WIDGET',
    owner: 'application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.ts'
  }
] as const;

const MODULE_REFERENCE = new RegExp(
  [
    String.raw`import\s+(?:type\s+)?(?:[\w$*{},\s]+?\s+from\s+)?['"][^'"]+['"]`,
    String.raw`import\(\s*['"][^'"]+['"]\s*\)`,
    String.raw`require\(\s*['"][^'"]+['"]\s*\)`,
  ].join('|'),
  'g'
);
const GESTURE_FEATURE_REFERENCE = /(?:GesturePlayground|gesturePlayground|gesture-playground)/;
const LEXICAL_FEATURE_REFERENCE = /(?:LexicalGravity|lexicalGravity|lexical-gravity)/;
const WORKSHOP_FEATURE_HOOKS = [
  path.join(
    SRC_ROOT,
    'presentation/webview/hooks/domain/workshop/widgets/useGesturePlayground.ts'
  ),
  path.join(
    SRC_ROOT,
    'presentation/webview/hooks/domain/workshop/widgets/useLexicalGravity.ts'
  )
];
const WORKSHOP_WIDGET_HOST_HOOK = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/useWorkshopWidgetHost.ts'
);
const WORKSHOP_STANDING_DIRECTIVE_HOOK = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.ts'
);
const WORKSHOP_ROOM_HOOK = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts'
);
const WORKSHOP_SESSIONS_HOOK = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/useWorkshopSessions.ts'
);
const WORKSHOP_PRESENTATION_CONTROLLERS = path.join(
  SRC_ROOT,
  'presentation/webview/hooks/domain/workshop/controllers'
);
const WORKSHOP_STANDING_DIRECTIVE_OPERATIONS = path.join(
  SRC_ROOT,
  'application/services/workshop/directives/WorkshopStandingDirectiveOperations.ts'
);
const WORKSHOP_GENERIC_STANDING_MECHANICS = [
  path.join(
    SRC_ROOT,
    'application/services/workshop/directives/WorkshopStandingDirectiveFrames.ts'
  ),
  path.join(
    SRC_ROOT,
    'application/services/workshop/directives/WorkshopStandingDirectivePresentation.ts'
  ),
  path.join(
    SRC_ROOT,
    'presentation/webview/components/workshop/WorkshopStandingDirectiveRail.tsx'
  )
];
const WORKSHOP_GENERIC_STANDING_COPY_SURFACES = [
  ...WORKSHOP_GENERIC_STANDING_MECHANICS,
  WORKSHOP_STANDING_DIRECTIVE_OPERATIONS,
  WORKSHOP_STANDING_DIRECTIVE_HOOK,
  path.join(
    SRC_ROOT,
    'application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.ts'
  ),
  path.join(
    SRC_ROOT,
    'application/services/workshop/directives/WorkshopStandingDirectiveService.ts'
  ),
  path.join(
    SRC_ROOT,
    'presentation/webview/hooks/domain/workshop/dispatchWorkshopWidgetActionResult.ts'
  )
];
const GENERIC_WIDGET_CONFIG_PRESENTATION_REFERENCE = new RegExp(
  [
    'WORKSHOP_REQUEST_WIDGET_CONFIG',
    'WORKSHOP_WIDGET_CONFIG_DATA',
    'WorkshopWidgetConfigDataMessage',
    'widgetConfigResponseId',
    'widgetConfigError',
    'requestWidgetConfig',
    'clearWidgetConfigData',
    'handleWidgetConfigData'
  ].join('|')
);

/**
 * Exact known false-generic ownership for each inventoried phase. Newly
 * discovered pre-existing violations may be recorded only with an owning
 * cleanup phase; once that phase's inventory is recorded, its entries may only
 * shrink. A phase that removes an exception updates this witness in the same
 * commit; Phase 7 requires an empty list.
 */
const WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS = [
  {
    phase: 6,
    file: 'shared/constants/workshopWidgets.ts',
    marker: /LEXICAL_GRAVITY_WEIGHT/
  },
  {
    phase: 6,
    file: 'utils/workshopWidgetRecommendation.ts',
    marker: /For Lexical Gravity/
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

function importsFeature(source: string, featureReference: RegExp): boolean {
  return (source.match(MODULE_REFERENCE) ?? [])
    .some((moduleReference) => featureReference.test(moduleReference));
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

  it('Workshop widget and standing routes remain with their declared owners', () => {
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
    const gestureFiles = sourceFiles
      .filter((file) => {
        const relativePath = path.relative(SRC_ROOT, file);
        return /GesturePlayground/i.test(relativePath);
      });
    const lexicalFiles = sourceFiles
      .filter((file) => /LexicalGravity/i.test(path.relative(SRC_ROOT, file)));
    const gestureOffenders = gestureFiles
      .filter((file) => importsFeature(fs.readFileSync(file, 'utf8'), LEXICAL_FEATURE_REFERENCE))
      .map((file) => path.relative(SRC_ROOT, file));
    const lexicalOffenders = lexicalFiles
      .filter((file) => importsFeature(fs.readFileSync(file, 'utf8'), GESTURE_FEATURE_REFERENCE))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(gestureFiles.length).toBeGreaterThanOrEqual(5);
    expect(lexicalFiles.length).toBeGreaterThan(0);
    expect(gestureOffenders).toEqual([]);
    expect(lexicalOffenders).toEqual([]);
  });

  it('Workshop feature hooks do not own family-generic widget config lookup', () => {
    const offenders = WORKSHOP_FEATURE_HOOKS
      .filter((file) => GENERIC_WIDGET_CONFIG_PRESENTATION_REFERENCE.test(
        fs.readFileSync(file, 'utf8')
      ))
      .map((file) => path.relative(SRC_ROOT, file));
    const widgetHostSource = fs.readFileSync(WORKSHOP_WIDGET_HOST_HOOK, 'utf8');

    expect(offenders).toEqual([]);
    expect(widgetHostSource).toMatch(/WORKSHOP_REQUEST_WIDGET_CONFIG/);
    expect(widgetHostSource).toMatch(/handleWidgetConfigData/);
  });

  it('Workshop room and session hooks stay feature-free with one-way replacement ownership', () => {
    const roomSource = fs.readFileSync(WORKSHOP_ROOM_HOOK, 'utf8');
    const sessionsSource = fs.readFileSync(WORKSHOP_SESSIONS_HOOK, 'utf8');
    const featureState = /(?:gesture|lexical|widget)/i;

    expect(featureState.test(roomSource)).toBe(false);
    expect(featureState.test(sessionsSource)).toBe(false);
    expect(roomSource).not.toMatch(/from\s+['"][^'"]*useWorkshopSessions['"]/);
    expect(sessionsSource).toMatch(/WorkshopRoomReplacementPort/);
    expect(sessionsSource).toMatch(/roomReplacement\.beginReplacement\(\)/);
    expect(fs.existsSync(path.join(
      SRC_ROOT,
      'presentation/webview/hooks/domain/useWorkshop.ts'
    ))).toBe(false);
  });

  it('Workshop presentation controllers receive host effects instead of owning transport', () => {
    const transportReference = /(?:useVSCodeApi|MessageType|postMessage)/;
    const offenders = collectSourceFiles(WORKSHOP_PRESENTATION_CONTROLLERS)
      .filter((file) => transportReference.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('Workshop standing removal has one generic presentation owner', () => {
    const featureOffenders = WORKSHOP_FEATURE_HOOKS
      .filter((file) => /WORKSHOP_REMOVE_STANDING_WIDGET/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));
    const standingOwner = fs.readFileSync(WORKSHOP_STANDING_DIRECTIVE_HOOK, 'utf8');

    expect(featureOffenders).toEqual([]);
    expect(standingOwner).toMatch(/WORKSHOP_REMOVE_STANDING_WIDGET/);
    expect(standingOwner).toMatch(/requestToken/);
    expect(standingOwner).toMatch(/workshopWidgetLabel/);
  });

  it('Workshop standing mechanics dispatch through one closed feature registry', () => {
    const genericOffenders = WORKSHOP_GENERIC_STANDING_MECHANICS
      .filter((file) => importsFeature(fs.readFileSync(file, 'utf8'), LEXICAL_FEATURE_REFERENCE))
      .map((file) => path.relative(SRC_ROOT, file));
    const operations = fs.readFileSync(WORKSHOP_STANDING_DIRECTIVE_OPERATIONS, 'utf8');

    expect(genericOffenders).toEqual([]);
    expect(operations).toMatch(/Record<WorkshopStandingDirectiveFamily/);
    expect(operations).toMatch(
      /'lexical-gravity': LEXICAL_GRAVITY_STANDING_DIRECTIVE_OPERATIONS/
    );
    expect(operations).toMatch(/'prose-controller': proseControllerEntry/);
  });

  it('Workshop generic standing surfaces carry no Lexical writer-facing copy', () => {
    const offenders = WORKSHOP_GENERIC_STANDING_COPY_SURFACES
      .filter((file) => /Lexical Gravity\b/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('Workshop handlers cannot bypass the session aggregate through internal ledgers', () => {
    const INTERNAL_SESSION_LEDGER = /(?:WorkshopWidgetConfigLedger|WorkshopStandingDirectiveLedger)/;
    const offenders = collectSourceFiles(WORKSHOP_HANDLER_ROOT)
      .filter((file) => INTERNAL_SESSION_LEDGER.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('keeps the accepted Workshop legacy ownership exceptions exact during migration', () => {
    const missingFiles = WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS
      .map(({ phase, file }) => ({ phase, file, fullPath: path.join(SRC_ROOT, file) }))
      .filter(({ fullPath }) => !fs.existsSync(fullPath))
      .map(({ phase, file }) => `P${phase}:${file}`);

    expect({ missingLegacyExceptionFiles: missingFiles }).toEqual({
      missingLegacyExceptionFiles: []
    });

    const observed = WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS
      .filter(({ file, marker }) => {
        const fullPath = path.join(SRC_ROOT, file);
        return fs.existsSync(fullPath) && marker.test(fs.readFileSync(fullPath, 'utf8'));
      })
      .map(({ phase, file }) => `P${phase}:${file}`);

    expect(observed).toEqual([
      'P6:shared/constants/workshopWidgets.ts',
      'P6:utils/workshopWidgetRecommendation.ts'
    ]);
  });
});
