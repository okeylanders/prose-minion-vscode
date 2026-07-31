/** Project-backed library for writer-generated Lexical Gravity fields. */

import * as path from 'path';
import { WorkshopLexicalGravityLens } from '@messages';
import { FileSystem, FileType, LogSink, Workspace } from '@/platform';
import {
  validateLexicalGravityLens
} from '@/application/services/workshop/lexicalGravity/LexicalGravityConfigCodec';
import {
  cloneLexicalGravityLens,
  lexicalGravityLensSlug
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const LEXICAL_GRAVITY_LIBRARY_LIMITS = Object.freeze({
  maximumFiles: 200,
  maximumFileBytes: 256 * 1024,
  maximumBatchSize: 3
});

export class LexicalGravityLibraryUnavailableError extends Error {
  constructor(readonly reason: 'no-workspace' | 'multi-root') {
    super(
      reason === 'no-workspace'
        ? 'Lexical Gravity libraries require an open workspace folder.'
        : 'Lexical Gravity libraries require a single-root workspace.'
    );
    this.name = 'LexicalGravityLibraryUnavailableError';
  }
}

export interface LexicalGravityLibraryAvailability {
  rootPath: string;
  lensesDirectory: string;
  displayPath: string;
}

export class LexicalGravityLensRepository {
  private temporaryCounter = 0;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly log: LogSink
  ) {}

  availability(): LexicalGravityLibraryAvailability {
    const folders = this.workspace.workspaceFolders();
    if (folders.length === 0) {throw new LexicalGravityLibraryUnavailableError('no-workspace');}
    if (folders.length !== 1) {throw new LexicalGravityLibraryUnavailableError('multi-root');}
    return {
      rootPath: folders[0].path,
      lensesDirectory: path.join(folders[0].path, 'prose-minion', 'lenses'),
      displayPath: path.join('prose-minion', 'lenses')
    };
  }

  async list(): Promise<WorkshopLexicalGravityLens[]> {
    const available = this.availability();
    let entries: Array<[string, FileType]>;
    try {
      entries = await this.fileSystem.readDirectory(available.lensesDirectory);
    } catch (error) {
      if (isMissingPath(error)) {return [];}
      throw error;
    }
    const files = entries
      .filter(([name, type]) => type === FileType.File && name.endsWith('.json'))
      .sort(([left], [right]) => left.localeCompare(right, 'en-US'))
      .slice(0, LEXICAL_GRAVITY_LIBRARY_LIMITS.maximumFiles);
    const lenses: WorkshopLexicalGravityLens[] = [];
    for (const [name] of files) {
      const lens = await this.readLens(path.join(available.lensesDirectory, name), name, true);
      if (lens) {lenses.push(lens);}
    }
    return lenses;
  }

  async findForQuery(query: string): Promise<WorkshopLexicalGravityLens | undefined> {
    const available = this.availability();
    const slug = lexicalGravityLensSlug(query);
    if (!slug) {throw new Error('Lens subject must include at least one letter or number');}
    return this.readLens(
      path.join(available.lensesDirectory, `${slug}.json`),
      `${slug}.json`,
      false
    );
  }

  async saveManyForQuery(
    query: string,
    candidates: WorkshopLexicalGravityLens[]
  ): Promise<WorkshopLexicalGravityLens[]> {
    const available = this.availability();
    const baseSlug = lexicalGravityLensSlug(query);
    if (!baseSlug) {throw new Error('Lens subject must include at least one letter or number');}
    if (
      candidates.length < 1
      || candidates.length > LEXICAL_GRAVITY_LIBRARY_LIMITS.maximumBatchSize
    ) {
      throw new Error(
        `Choose 1–${LEXICAL_GRAVITY_LIBRARY_LIMITS.maximumBatchSize} generated lenses to save`
      );
    }
    const usedSlugs = new Set<string>();
    const lenses = candidates.map((candidate, index) => {
      const variantSlug = lexicalGravityLensSlug(candidate.variant ?? '');
      const proposedSlug = index === 0
        ? baseSlug
        : `${baseSlug}-${variantSlug || `take-${index + 1}`}`;
      const slug = this.uniqueSlug(proposedSlug, usedSlugs);
      return validateLexicalGravityLens({
        ...cloneLexicalGravityLens(candidate),
        slug,
        source: 'project'
      });
    });

    await this.fileSystem.createDirectory(available.lensesDirectory);
    const writes = lenses.map((lens) => ({
      lens,
      destination: path.join(available.lensesDirectory, `${lens.slug}.json`),
      temporary: path.join(
        available.lensesDirectory,
        `.${lens.slug}.${++this.temporaryCounter}.tmp`
      )
    }));
    await Promise.all(writes.map(({ destination }) => this.assertDestinationMissing(destination)));

    const published: string[] = [];
    try {
      await Promise.all(writes.map(({ lens, temporary }) => this.fileSystem.writeFile(
        temporary,
        encoder.encode(`${JSON.stringify(lens, null, 2)}\n`)
      )));
      for (const { temporary, destination } of writes) {
        await this.fileSystem.rename(temporary, destination, { overwrite: false });
        published.push(destination);
      }
    } catch (error) {
      await Promise.all(writes.map(({ temporary }) => this.deleteAfterFailure(temporary)));
      await Promise.all(published.map((destination) => this.deleteAfterFailure(destination)));
      throw error;
    }
    return lenses.map(cloneLexicalGravityLens);
  }

  private uniqueSlug(proposed: string, used: Set<string>): string {
    let slug = proposed;
    let suffix = 2;
    while (used.has(slug)) {
      slug = `${proposed}-${suffix++}`;
    }
    used.add(slug);
    return slug;
  }

  private async assertDestinationMissing(filePath: string): Promise<void> {
    try {
      await this.fileSystem.stat(filePath);
      throw new Error(`Lexical Gravity lens ${path.basename(filePath)} already exists`);
    } catch (error) {
      if (isMissingPath(error)) {return;}
      throw error;
    }
  }

  private async deleteAfterFailure(filePath: string): Promise<void> {
    try {
      await this.fileSystem.delete(filePath);
    } catch (error) {
      if (!isMissingPath(error)) {
        this.log.appendLine(
          `[LexicalGravityLensRepository] Could not clean up ${path.basename(filePath)}`
        );
      }
    }
  }

  private async readLens(
    filePath: string,
    displayName: string,
    tolerateInvalid: boolean
  ): Promise<WorkshopLexicalGravityLens | undefined> {
    try {
      const stat = await this.fileSystem.stat(filePath);
      if (
        stat.type !== FileType.File
        || stat.size > LEXICAL_GRAVITY_LIBRARY_LIMITS.maximumFileBytes
      ) {
        throw new Error('invalid size/type');
      }
      const raw = decoder.decode(await this.fileSystem.readFile(filePath));
      return validateLexicalGravityLens(JSON.parse(raw));
    } catch (error) {
      if (isMissingPath(error)) {return undefined;}
      const message = error instanceof Error ? error.message : String(error);
      if (tolerateInvalid) {
        this.log.appendLine(`[LexicalGravityLensRepository] Skipped ${displayName}: ${message}`);
        return undefined;
      }
      throw new Error(`Saved Lexical Gravity lens ${displayName} is invalid: ${message}`);
    }
  }
}

function isMissingPath(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:ENOENT|FileNotFound|not found|does not exist)/i.test(message);
}
