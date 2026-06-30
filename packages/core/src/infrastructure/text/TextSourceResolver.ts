/**
 * TextSourceResolver - Infrastructure layer
 * Resolves text input for metrics tools from various sources.
 *
 * Platform-ported (ADR 2026-06-16): all host access goes through the injected
 * ports (FileSystem / Workspace / SettingsStore / EditorContext) on plain string
 * paths — no `vscode.Uri` / `vscode.workspace.*` here. Stateless, so the
 * composition root builds ONE instance and injects it into both MetricsHandler
 * and SearchHandler.
 */

import * as path from 'path';
import { EditorContext, FileSystem, FileType, LogSink, SettingsStore, Workspace } from '@/platform';
import { ResolvedTextSource, TextSourceSpec } from '@shared/types';

export class TextSourceResolver {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly settings: SettingsStore,
    private readonly editor: EditorContext,
    private readonly output?: LogSink
  ) {}

  async resolve(spec: TextSourceSpec): Promise<ResolvedTextSource> {
    switch (spec.mode) {
      case 'selection':
        return this.resolveSelection(spec);
      case 'activeFile':
        return this.resolveActiveFile(spec);
      case 'manuscript':
        return this.resolveManuscript(spec);
      case 'chapters':
        return this.resolveChapters(spec);
      default:
        throw new Error('Unsupported text source mode');
    }
  }

  private async resolveSelection(spec: TextSourceSpec): Promise<ResolvedTextSource> {
    // Validate the placeholder when provided
    if (spec.pathText && spec.pathText.trim() !== '[selected text]') {
      throw new Error('Invalid selection token. Leave as [selected text] or pick another source.');
    }

    const selection = this.editor.getActiveSelection();
    if (!selection || selection.isEmpty) {
      throw new Error('No text selected. Select text in the editor first.');
    }

    return {
      text: selection.text,
      relativePaths: [selection.relativePath],
      displayPath: selection.relativePath,
    };
  }

  private async resolveActiveFile(spec: TextSourceSpec): Promise<ResolvedTextSource> {
    const filePath = await this.resolveSingleFilePath(spec.pathText);
    if (!filePath) {
      throw new Error('Active file not found. Provide a valid path.');
    }

    const content = await this.readFileUtf8(filePath);
    const relativePath = this.workspace.asRelativePath(filePath, false);
    return { text: content, relativePaths: [relativePath], displayPath: relativePath };
  }

  private async resolveManuscript(spec: TextSourceSpec): Promise<ResolvedTextSource> {
    const patterns = this.getManuscriptPatterns(spec.pathText);
    const matches = await this.findFilesAcrossWorkspaces(patterns);
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const filePath of matches) {
      if (!this.isSupportedFile(filePath)) continue;
      const rel = this.normalizeKey(this.workspace.asRelativePath(filePath, false));
      if (!seen.has(rel)) {
        seen.add(rel);
        unique.push(filePath);
      }
    }

    if (unique.length === 0) {
      throw new Error('No manuscript files matched the provided patterns.');
    }

    const parts: string[] = [];
    const relativePaths: string[] = [];

    for (const filePath of unique) {
      const rel = this.workspace.asRelativePath(filePath, false);
      relativePaths.push(rel);
      const content = await this.readFileUtf8(filePath);
      parts.push(content);
    }

    const aggregated = parts.join('\n\n');
    return { text: aggregated, relativePaths, displayPath: relativePaths.join(', ') };
  }

  private async resolveChapters(spec: TextSourceSpec): Promise<ResolvedTextSource> {
    const patterns = this.getChaptersPatterns(spec.pathText);
    const matches = await this.findFilesAcrossWorkspaces(patterns);
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const filePath of matches) {
      if (!this.isSupportedFile(filePath)) continue;
      const rel = this.normalizeKey(this.workspace.asRelativePath(filePath, false));
      if (!seen.has(rel)) {
        seen.add(rel);
        unique.push(filePath);
      }
    }

    if (unique.length === 0) {
      throw new Error('No chapter files matched the provided patterns.');
    }

    const parts: string[] = [];
    const relativePaths: string[] = [];

    for (const filePath of unique) {
      const rel = this.workspace.asRelativePath(filePath, false);
      relativePaths.push(rel);
      const content = await this.readFileUtf8(filePath);
      parts.push(content);
    }

    const aggregated = parts.join('\n\n');
    return { text: aggregated, relativePaths, displayPath: relativePaths.join(', ') };
  }

  private async resolveSingleFilePath(pathText?: string): Promise<string | undefined> {
    const workspaceFolders = this.workspace.workspaceFolders();

    // If a path was supplied, try it first (absolute or workspace-relative)
    if (pathText && pathText.trim()) {
      const trimmed = pathText.trim();

      // Absolute
      if (path.isAbsolute(trimmed)) {
        if (await this.exists(trimmed)) return trimmed;
      }

      // Try as workspace-relative into each folder
      for (const folder of workspaceFolders) {
        const full = path.join(folder.path, trimmed);
        if (await this.exists(full)) return full;
      }

      // As a fallback, try findFiles with an exact relative pattern
      for (const folder of workspaceFolders) {
        const found = await this.workspace.findFiles(
          folder.path,
          this.normalizePattern(trimmed),
          this.defaultExcludeGlob()
        );
        if (found.length > 0) return found[0];
      }
    }

    // Fallback to active editor
    const selection = this.editor.getActiveSelection();
    if (selection) {
      if (this.isUnsavedEditorDocument(selection)) {
        throw new Error('Active file is not saved to disk. Save the file first or use selected text instead.');
      }
      return selection.fsPath;
    }
    return undefined;
  }

  private isUnsavedEditorDocument(selection: { uriString: string; fsPath: string }): boolean {
    return selection.uriString.startsWith('untitled:') || selection.fsPath.trim().length === 0;
  }

  private getManuscriptPatterns(pathText?: string): string[] {
    if (pathText && pathText.trim()) {
      return pathText.split(',').map(s => this.normalizePattern(s)).filter(Boolean);
    }
    const rawValue = this.settings.get<string>('proseMinion', 'contextPaths.manuscript') || '';
    return rawValue
      .split(',')
      .map(s => this.normalizePattern(s))
      .filter(Boolean);
  }

  private getChaptersPatterns(pathText?: string): string[] {
    if (pathText && pathText.trim()) {
      return pathText.split(',').map(s => this.normalizePattern(s)).filter(Boolean);
    }
    const rawValue = this.settings.get<string>('proseMinion', 'contextPaths.chapters') || '';
    return rawValue
      .split(',')
      .map(s => this.normalizePattern(s))
      .filter(Boolean);
  }

  private async findFilesAcrossWorkspaces(patterns: string[]): Promise<string[]> {
    const folders = this.workspace.workspaceFolders();
    const results: string[] = [];
    for (const folder of folders) {
      for (const pattern of patterns) {
        try {
          const found = await this.workspace.findFiles(folder.path, pattern, this.defaultExcludeGlob());
          results.push(...found);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.output?.appendLine(`[TextSourceResolver] Error searching ${pattern}: ${message}`);
        }
      }
    }
    return results;
  }

  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.md' || ext === '.txt';
  }

  private normalizePattern(pattern: string): string {
    let normalized = pattern.trim();
    if (!normalized) return '';
    if (normalized.startsWith('./')) normalized = normalized.slice(2);
    normalized = normalized.replace(/^\/+/, '');
    normalized = normalized.replace(/^workspace:/i, '');
    // If no glob and no slash, treat as filename
    if (!/[\*\?\[]/.test(normalized) && !normalized.includes('/')) {
      return `**/${normalized}`;
    }
    return normalized;
  }

  private normalizeKey(value: string): string {
    return value.trim().replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  }

  private defaultExcludeGlob(): string {
    return '{**/node_modules/**,**/.git/**,**/.svn/**,**/.hg/**,**/dist/**,**/out/**}';
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      const stat = await this.fileSystem.stat(filePath);
      return stat.type === FileType.File;
    } catch {
      return false;
    }
  }

  private async readFileUtf8(filePath: string): Promise<string> {
    const raw = await this.fileSystem.readFile(filePath);
    return Buffer.from(raw).toString('utf8');
  }
}
