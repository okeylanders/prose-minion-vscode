/**
 * Negative-space witness for the Creative Variations presentation slice
 * (Sprint 03, Slice 4): the feature component directory is controlled
 * presentation only — no VS Code transport, no message-enum dispatch, no
 * storage, and no editor-write path. State arrives via typed props; effects
 * leave via semantic callbacks.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  assertCreativeVariationsDraftIntegrity
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigCodec';
import { generatedDraft } from './creativeVariationsFixtures';

const componentDirectory = path.resolve(
  __dirname,
  '../../../../../../..',
  'presentation/webview/components/workshop/widgets/creativeVariations'
);

const FORBIDDEN_TOKENS = [
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

describe('creativeVariations presentation boundaries', () => {
  const files = fs
    .readdirSync(componentDirectory)
    .filter((name) => /\.(tsx?|css)$/.test(name));

  it('contains exactly the runway-named presentation files', () => {
    expect(files.sort()).toEqual([
      'CreativeVariationCard.tsx',
      'CreativeVariationsComparison.tsx',
      'WorkshopCreativeVariationsModal.tsx',
      'creativeVariations.css'
    ]);
  });

  it.each(FORBIDDEN_TOKENS)('never references %s', (token) => {
    for (const file of files) {
      const content = fs.readFileSync(path.join(componentDirectory, file), 'utf8');
      expect({ file, found: content.includes(token) }).toEqual({ file, found: false });
    }
  });

  it('imports domain contracts only from the @messages barrel', () => {
    for (const file of files.filter((name) => name.endsWith('.tsx'))) {
      const content = fs.readFileSync(path.join(componentDirectory, file), 'utf8');
      const importSources = [...content.matchAll(/from '([^']+)'/g)].map(
        (match) => match[1]
      );
      importSources
        .filter((source) => source.includes('messages'))
        .forEach((source) => {
          expect(source).toBe('@messages');
        });
      // No reach into hooks, handlers, services, or infrastructure.
      importSources.forEach((source) => {
        expect(source).not.toMatch(/@hooks|@handlers|@services|infrastructure/);
      });
    }
  });

  it('uses a generated presentation fixture accepted by durable integrity', () => {
    expect(() => assertCreativeVariationsDraftIntegrity(
      generatedDraft,
      'Creative Variations presentation fixture'
    )).not.toThrow();
  });
});
