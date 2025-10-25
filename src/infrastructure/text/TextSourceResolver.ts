/**
 * TextSourceResolver - Infrastructure layer
 * Resolves text input for metrics tools from various sources.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ResolvedTextSource, TextSourceSpec } from '../../shared/types';

export class TextSourceResolver {
  constructor(private readonly output?: vscode.OutputChannel) {}

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

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      throw new Error('No text selected. Select text in the editor first.');
    }

    const text = editor.document.getText(editor.selection);
    const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    return { text, relativePaths: [relativePath], displayPath: relativePath };
  }

  private async resolveActiveFile(spec: TextSourceSpec): Promise<ResolvedTextSource> {
    const uri = await this.resolveSingleFilePath(spec.pathText);
    if (!uri) {
      throw new Error('Active file not found. Provide a valid path.');
    }

    const content = await this.readFileUtf8(uri);
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    return { text: content, relativePaths: [relativePath], displayPath: relativePath };
  }

  private async resolveManuscript(spec: TextSourceSpec): Promise<ResolvedTextSource> {
    const patterns = this.getManuscriptPatterns(spec.pathText);
    const matches = await this.findFilesAcrossWorkspaces(patterns);
    const unique: vscode.Uri[] = [];
    const seen = new Set<string>();

    for (const uri of matches) {
      if (!this.isSupportedFile(uri)) continue;
      const rel = this.normalizeKey(vscode.workspace.asRelativePath(uri, false));
      if (!seen.has(rel)) {
        seen.add(rel);
        unique.push(uri);
      }
    }

    if (unique.length === 0) {
      throw new Error('No manuscript files matched the provided patterns.');
    }

    const parts: string[] = [];
    const relativePaths: string[] = [];

    for (const uri of unique) {
      const rel = vscode.workspace.asRelativePath(uri, false);
      relativePaths.push(rel);
      const content = await this.readFileUtf8(uri);
      parts.push(content);
    }

    const aggregated = parts.join('\n\n');
    return { text: aggregated, relativePaths, displayPath: relativePaths.join(', ') };
  }

  private async resolveChapters(spec: TextSourceSpec): Promise<ResolvedTextSource> {
    const patterns = this.getChaptersPatterns(spec.pathText);
    const matches = await this.findFilesAcrossWorkspaces(patterns);
    const unique: vscode.Uri[] = [];
    const seen = new Set<string>();

    for (const uri of matches) {
      if (!this.isSupportedFile(uri)) continue;
      const rel = this.normalizeKey(vscode.workspace.asRelativePath(uri, false));
      if (!seen.has(rel)) {
        seen.add(rel);
        unique.push(uri);
      }
    }

    if (unique.length === 0) {
      throw new Error('No chapter files matched the provided patterns.');
    }

    const parts: string[] = [];
    const relativePaths: string[] = [];

    for (const uri of unique) {
      const rel = vscode.workspace.asRelativePath(uri, false);
      relativePaths.push(rel);
      const content = await this.readFileUtf8(uri);
      parts.push(content);
    }

    const aggregated = parts.join('\n\n');
    return { text: aggregated, relativePaths, displayPath: relativePaths.join(', ') };
  }

  private async resolveSingleFilePath(pathText?: string): Promise<vscode.Uri | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

    // If a path was supplied, try it first (absolute or workspace-relative)
    if (pathText && pathText.trim()) {
      const trimmed = pathText.trim();

      // Absolute
      if (path.isAbsolute(trimmed)) {
        const uri = vscode.Uri.file(trimmed);
        if (await this.exists(uri)) return uri;
      }

      // Try as workspace-relative into each folder
      for (const folder of workspaceFolders) {
        const full = vscode.Uri.file(path.join(folder.uri.fsPath, trimmed));
        if (await this.exists(full)) return full;
      }

      // As a fallback, try findFiles with an exact relative pattern
      for (const folder of workspaceFolders) {
        const include = new vscode.RelativePattern(folder, this.normalizePattern(trimmed));
        const found = await vscode.workspace.findFiles(include, this.defaultExcludeGlob());
        if (found.length > 0) return found[0];
      }
    }

    // Fallback to active editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      return editor.document.uri;
    }
    return undefined;
  }

  private getManuscriptPatterns(pathText?: string): string[] {
    if (pathText && pathText.trim()) {
      return pathText.split(',').map(s => this.normalizePattern(s)).filter(Boolean);
    }
    const config = vscode.workspace.getConfiguration('proseMinion');
    const rawValue = config.get<string>('contextPaths.manuscript') || '';
    return rawValue
      .split(',')
      .map(s => this.normalizePattern(s))
      .filter(Boolean);
  }

  private getChaptersPatterns(pathText?: string): string[] {
    if (pathText && pathText.trim()) {
      return pathText.split(',').map(s => this.normalizePattern(s)).filter(Boolean);
    }
    const config = vscode.workspace.getConfiguration('proseMinion');
    const rawValue = config.get<string>('contextPaths.chapters') || '';
    return rawValue
      .split(',')
      .map(s => this.normalizePattern(s))
      .filter(Boolean);
  }

  private async findFilesAcrossWorkspaces(patterns: string[]): Promise<vscode.Uri[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const results: vscode.Uri[] = [];
    for (const folder of folders) {
      for (const pattern of patterns) {
        try {
          const include = new vscode.RelativePattern(folder, pattern);
          const uris = await vscode.workspace.findFiles(include, this.defaultExcludeGlob());
          results.push(...uris);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.output?.appendLine(`[TextSourceResolver] Error searching ${pattern}: ${message}`);
        }
      }
    }
    return results;
  }

  private isSupportedFile(uri: vscode.Uri): boolean {
    const ext = path.extname(uri.fsPath).toLowerCase();
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

  private async exists(uri: vscode.Uri): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return stat.type === vscode.FileType.File;
    } catch {
      return false;
    }
  }

  private async readFileUtf8(uri: vscode.Uri): Promise<string> {
    const raw = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(raw).toString('utf8');
  }
}
