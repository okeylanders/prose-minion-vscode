/**
 * Negative-space witness for the Show vs. Tell presentation slice
 * (Sprint 05, Slice 3).
 *
 * Three claims:
 *  1. The component directory is controlled presentation only: no VS Code
 *     transport, no message-enum dispatch, no storage, no editor-write path.
 *  2. The authoring controller is transport-free, and nothing in the webview
 *     reaches the host-only codec, integrity, or workup-id modules (the last
 *     pulls in `node:crypto`). The pure artifact projection is the one feature
 *     service the webview imports, so it must itself stay webview-safe.
 *  3. The transport hook posts only the intake, generate, and cancel messages:
 *     there is no message that could write the editor.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../../../../../../..');
const COMPONENT_DIRECTORY = path.join(SRC, 'presentation/webview/components/workshop/widgets/showVsTell');
const CONTROLLER = path.join(
  SRC,
  'presentation/webview/hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring.ts'
);
const TRANSPORT = path.join(
  SRC,
  'presentation/webview/hooks/domain/workshop/widgets/showVsTell/useShowVsTell.ts'
);
const SERVICE_DIRECTORY = path.join(SRC, 'application/services/workshop/widgets/showVsTell');

const read = (file: string): string => fs.readFileSync(file, 'utf8');
const importSources = (content: string): string[] =>
  [...content.matchAll(/from '([^']+)'/g)].map((match) => match[1]);

const componentFiles = fs.readdirSync(COMPONENT_DIRECTORY).filter((name) => /\.(tsx?|css)$/.test(name));
const webviewFiles = [
  ...componentFiles.filter((name) => /\.tsx?$/.test(name)).map((name) => path.join(COMPONENT_DIRECTORY, name)),
  CONTROLLER,
  TRANSPORT
];

const HOST_ONLY_MODULE = /ShowVsTell(?:ConfigCodec|ConfigIntegrity|WorkupId)|node:crypto|from 'crypto'/;

const FORBIDDEN_COMPONENT_TOKENS = [
  'useVSCodeApi',
  'acquireVsCodeApi',
  'postMessage',
  'MessageType',
  "from 'vscode'",
  'localStorage',
  'sessionStorage',
  'workspace.applyEdit',
  'WorkspaceEdit'
];

describe('showVsTell presentation boundaries', () => {
  it('contains exactly the named presentation files', () => {
    expect(componentFiles.sort()).toEqual([
      'ShowVsTellChannelsBudget.tsx',
      'ShowVsTellContinuumControl.tsx',
      'ShowVsTellPayloadStrip.tsx',
      'ShowVsTellReadout.tsx',
      'ShowVsTellSurroundingPanel.tsx',
      'ShowVsTellVariantCard.tsx',
      'WorkshopShowVsTellModal.tsx',
      'showVsTell.css',
      'showVsTellAuthoringTypes.ts'
    ]);
  });

  it.each(FORBIDDEN_COMPONENT_TOKENS)('components never reference %s', (token) => {
    for (const file of componentFiles) {
      const content = read(path.join(COMPONENT_DIRECTORY, file));
      expect({ file, found: content.includes(token) }).toEqual({ file, found: false });
    }
  });

  it('components import domain contracts only from the @messages barrel and reach no host layer', () => {
    for (const file of componentFiles.filter((name) => name.endsWith('.tsx'))) {
      for (const source of importSources(read(path.join(COMPONENT_DIRECTORY, file)))) {
        if (source.includes('messages')) {
          expect(source).toBe('@messages');
        }
        expect(source).not.toMatch(/@hooks|@handlers|@services|infrastructure/);
      }
    }
  });

  it('the controller is transport-free', () => {
    const content = read(CONTROLLER);

    expect(content).not.toMatch(/useVSCodeApi|acquireVsCodeApi|MessageType|postMessage/);
    expect(importSources(content).filter((source) => source.includes('messages')))
      .toEqual(['@messages']);
  });

  it('nothing in the webview imports the codec, integrity, or workup-id modules', () => {
    for (const file of webviewFiles) {
      const offending = importSources(read(file)).filter((source) => HOST_ONLY_MODULE.test(source));
      expect({ file: path.relative(SRC, file), offending }).toEqual({
        file: path.relative(SRC, file),
        offending: []
      });
    }
  });

  it('keeps the artifact projection and its imports webview-safe', () => {
    for (const name of ['ShowVsTellArtifact.ts', 'ShowVsTellDerivations.ts', 'ShowVsTellContinuum.ts']) {
      const imports = importSources(read(path.join(SERVICE_DIRECTORY, name)));
      expect({ name, host: imports.filter((source) => HOST_ONLY_MODULE.test(source) || /^node:/.test(source)) })
        .toEqual({ name, host: [] });
    }
  });

  it('has no editor-write path anywhere in the webview slice', () => {
    const editorWrite = /applyEdit|WorkspaceEdit|insertText|EditorContext|TextEditorEdit|replaceSelection|editBuilder/;
    for (const file of webviewFiles) {
      expect({ file: path.relative(SRC, file), found: editorWrite.test(read(file)) })
        .toEqual({ file: path.relative(SRC, file), found: false });
    }
  });

  it('the transport hook posts only intake, generate, and cancel', () => {
    const content = read(TRANSPORT);
    const posted = new Set([...content.matchAll(/MessageType\.([A-Z_]+)/g)].map((match) => match[1]));

    expect([...posted].sort()).toEqual([
      'REQUEST_SELECTION',
      'WORKSHOP_SHOW_VS_TELL_GENERATE'
    ]);
    expect(content).toContain("createCancelRequestMessage(\n          'workshop-show-vs-tell'");
  });

  it('the modal states that nothing is inserted into the editor', () => {
    expect(read(path.join(COMPONENT_DIRECTORY, 'WorkshopShowVsTellModal.tsx')))
      .toContain('Nothing is inserted into the editor — commit hands directions to the room.');
  });
});
