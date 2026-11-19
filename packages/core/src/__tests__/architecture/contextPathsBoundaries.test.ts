/**
 * The context-path services' boundaries (ADR 2026-11-19 D18, D24):
 * `application/services/contextPaths/` knows no Workshop, Lightbox or
 * presentation module; each file stays under 500 lines; the composition
 * root alone builds the service, its checker and its writer; and the writer
 * is the only module of the feature that writes a setting.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(SRC_ROOT, 'application', 'services', 'contextPaths');
const EXTENSION = path.resolve(SRC_ROOT, '../../../apps/vscode-extension/src/extension.ts');

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const importsOf = (source: string) => [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);

describe('context-path services boundaries', () => {
  const files = sourceFiles(DIR);

  it('lists its modules, each under 500 lines', () => {
    expect(files.map((file) => path.basename(file)).sort()).toEqual([
      'ContextPathApply.ts',
      'ContextPathPatternSafety.ts',
      'ContextPathProposalChecker.ts',
      'ContextPathSettingsWriter.ts',
      'ContextPathSuggestionService.ts',
      'ProjectFolderScan.ts'
    ]);
    for (const file of files) {
      expect([path.basename(file), fs.readFileSync(file, 'utf8').split('\n').length <= 500]).toEqual([path.basename(file), true]);
    }
  });

  it('imports no Workshop, Lightbox, Draft Edit or presentation module', () => {
    const feature = /workshop|lightbox|draftEdit|craftFlags|proofread|presentation/i;
    const offenders = files.flatMap((file) => importsOf(fs.readFileSync(file, 'utf8'))
      .filter((module) => feature.test(module))
      .map((module) => `${path.basename(file)} -> ${module}`));
    expect(offenders).toEqual([]);
  });

  it('is built only at the composition root', () => {
    const builders = /\bnew\s+(ContextPathSuggestionService|ContextPathProposalChecker|ContextPathSettingsWriter|ProjectFolderScan)\s*\(/;
    const inCore = sourceFiles(SRC_ROOT)
      .filter((file) => !path.relative(SRC_ROOT, file).startsWith('__tests__'))
      .filter((file) => builders.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));
    expect(inCore).toEqual([]);
    expect(fs.readFileSync(EXTENSION, 'utf8')).toMatch(/new ContextPathSuggestionService\(/);
  });

  it('writes a setting only through the writer', () => {
    const writers = files.filter((file) => /\.update\(/.test(fs.readFileSync(file, 'utf8'))).map((file) => path.basename(file));
    expect(writers).toEqual(['ContextPathSettingsWriter.ts']);
  });
});
