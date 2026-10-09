/**
 * Negative-space witness for the Show vs. Tell presentation slice
 * (Sprint 05, Slices 3 and 4).
 *
 * Four claims:
 *  1. The component directory is controlled presentation only: no VS Code
 *     transport, no message-enum dispatch, no storage, no editor-write path.
 *  2. The authoring controller is transport-free, and nothing in the webview
 *     reaches the host-only codec, integrity, or workup-id modules (the last
 *     pulls in `node:crypto`). The pure artifact projection is the one feature
 *     service the webview imports, so it must itself stay webview-safe.
 *  3. The transport hook posts only the intake, generate, cancel, and generic
 *     commit messages. None of them could write the editor.
 *  4. No editor-write path exists anywhere in the feature: no Show vs. Tell
 *     file, on either side of the host boundary, references an editor edit,
 *     insert, or apply API, and no Show vs. Tell message type names one.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MessageType } from '@messages';

const SRC = path.resolve(__dirname, '../../../../../../..');
const COMPONENT_DIRECTORY = path.join(SRC, 'presentation/webview/components/workshop/widgets/showVsTell');
const CONTROLLER = path.join(
  SRC,
  'presentation/webview/hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring.ts'
);
const CONTROLLER_DIRECTORY = path.join(
  SRC,
  'presentation/webview/hooks/domain/workshop/controllers/showVsTell'
);
const CONTROLLER_RULES = path.join(CONTROLLER_DIRECTORY, 'showVsTellAuthoringRules.ts');
const CONTROLLER_FILES = fs.readdirSync(CONTROLLER_DIRECTORY).map((name) => path.join(CONTROLLER_DIRECTORY, name));
const TRANSPORT = path.join(
  SRC,
  'presentation/webview/hooks/domain/workshop/widgets/showVsTell/useShowVsTell.ts'
);
const SERVICE_DIRECTORY = path.join(SRC, 'application/services/workshop/widgets/showVsTell');
const HANDLER_DIRECTORY = path.join(
  SRC,
  'application/handlers/domain/workshop/widgets/showVsTell'
);
const CONTRACT_FILE = path.join(SRC, 'shared/types/messages/workshop/showVsTell.ts');
const RESPONSE_SERVICE_DIRECTORY = path.join(SRC, 'infrastructure/api/services/widgets/showVsTell');

const read = (file: string): string => fs.readFileSync(file, 'utf8');
const importSources = (content: string): string[] =>
  [...content.matchAll(/from '([^']+)'/g)].map((match) => match[1]);

const componentFiles = fs.readdirSync(COMPONENT_DIRECTORY).filter((name) => /\.(tsx?|css)$/.test(name));
const webviewFiles = [
  ...componentFiles.filter((name) => /\.tsx?$/.test(name)).map((name) => path.join(COMPONENT_DIRECTORY, name)),
  ...CONTROLLER_FILES,
  TRANSPORT
];
const sourceFilesIn = (directory: string): string[] =>
  fs.existsSync(directory)
    ? fs.readdirSync(directory)
        .filter((name) => /\.tsx?$/.test(name))
        .map((name) => path.join(directory, name))
    : [];
/** Every Show vs. Tell source file, host and webview alike. */
const featureFiles = [
  ...webviewFiles.filter((file) => /\.tsx?$/.test(file)),
  ...sourceFilesIn(SERVICE_DIRECTORY),
  ...sourceFilesIn(HANDLER_DIRECTORY),
  ...sourceFilesIn(RESPONSE_SERVICE_DIRECTORY),
  CONTRACT_FILE
];

// The commit, warning, codec, integrity, and workup-id modules are host-only.
const HOST_ONLY_MODULE =
  /ShowVsTell(?:ConfigCodec|ConfigIntegrity|WorkupId|OneShotCommit|ArtifactWarnings)|node:crypto|from 'crypto'/;

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
      'ShowVsTellRadioGroup.tsx',
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

  it('splits the authoring controller into exactly the named transport-free files', () => {
    expect(CONTROLLER_FILES.map((file) => path.basename(file)).sort()).toEqual([
      'showVsTellAuthoringRules.ts',
      'useShowVsTellAuthoring.ts',
      'useShowVsTellCommitFlow.ts',
      'useShowVsTellInvalidationWatch.ts'
    ]);
  });

  it.each(CONTROLLER_FILES.map((file) => [path.basename(file), file] as const))(
    'the controller file %s is transport-free',
    (_name, file) => {
      const content = read(file);

      expect(content).not.toMatch(/useVSCodeApi|acquireVsCodeApi|MessageType|postMessage/);
      expect(importSources(content).filter((source) => source.includes('messages')))
        .toEqual(['@messages']);
    }
  );

  it('nothing in the webview imports the codec, integrity, or workup-id modules', () => {
    for (const file of webviewFiles) {
      const offending = importSources(read(file)).filter((source) => HOST_ONLY_MODULE.test(source));
      expect({ file: path.relative(SRC, file), offending }).toEqual({
        file: path.relative(SRC, file),
        offending: []
      });
    }
  });

  it('keeps the artifact projection, eligibility, and their imports webview-safe', () => {
    for (const name of [
      'ShowVsTellArtifact.ts',
      'ShowVsTellCommitEligibility.ts',
      'ShowVsTellDerivations.ts',
      'ShowVsTellContinuum.ts'
    ]) {
      const imports = importSources(read(path.join(SERVICE_DIRECTORY, name)));
      expect({ name, host: imports.filter((source) => HOST_ONLY_MODULE.test(source) || /^node:/.test(source)) })
        .toEqual({ name, host: [] });
    }
  });

  it('has no editor-write path anywhere in the feature, host or webview', () => {
    // Only a word that edits text: "apply" alone also names the unrelated
    // `applyTo`-style options, so this is the set of editor mutation APIs.
    const editorWrite =
      /applyEdit|WorkspaceEdit|insertText|insertSnippet|EditorContext|TextEditorEdit|replaceSelection|editBuilder|activeTextEditor|showTextDocument|openTextDocument|workspace\.fs|APPLY_TO_EDITOR|INSERT_INTO_EDITOR|REPLACE_SELECTION|apply-to-editor|insert-into-editor|insertIntoEditor|applyToEditor/;
    expect(featureFiles.length).toBeGreaterThan(25);
    for (const file of featureFiles) {
      expect({ file: path.relative(SRC, file), found: editorWrite.test(read(file)) })
        .toEqual({ file: path.relative(SRC, file), found: false });
    }
  });

  it('declares no Show vs. Tell message type that could edit, insert, or apply anything', () => {
    const names = Object.keys(MessageType).filter((name) => /SHOW_VS_TELL/.test(name));

    expect(names.sort()).toEqual([
      'CANCEL_SHOW_VS_TELL_GENERATE_REQUEST',
      'WORKSHOP_SHOW_VS_TELL_GENERATE',
      'WORKSHOP_SHOW_VS_TELL_GENERATION_PROGRESS',
      'WORKSHOP_SHOW_VS_TELL_RESULT'
    ]);
    expect(names.join(' ')).not.toMatch(/EDIT|INSERT|APPLY|REPLACE|WRITE/);
  });

  it('lets a commit travel only on the generic widget commit message', () => {
    const content = read(TRANSPORT);

    expect(content).toContain('MessageType.WORKSHOP_COMMIT_WIDGET');
    expect(content).not.toMatch(/MessageType\.[A-Z_]*(?:EDIT|INSERT|APPLY|REPLACE|WRITE)[A-Z_]*/);
  });

  it('the modal states that nothing is inserted into the editor', () => {
    expect(read(path.join(COMPONENT_DIRECTORY, 'WorkshopShowVsTellModal.tsx')))
      .toContain('Nothing is inserted into the editor — commit hands directions to the room.');
  });
});
