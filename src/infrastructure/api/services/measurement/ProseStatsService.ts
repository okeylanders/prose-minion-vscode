/**
 * ProseStatsService
 *
 * Single Responsibility: Wrap PassageProseStats measurement tool and orchestrate prose analysis
 *
 * This service provides:
 * - Thin wrapper around PassageProseStats measurement tool
 * - Multi-file analysis orchestration (manuscript/chapters mode)
 * - File reading and error handling for prose analysis
 *
 * This wrapper:
 * - Provides a clean extension point for future orchestration
 * - Maintains consistent abstraction level across the codebase
 * - Follows the same pattern as analysis service wrappers (AssistantToolService, etc.)
 * - Owns all prose stats analysis (single file or multiple files)
 */

import * as vscode from 'vscode';
import { PassageProseStats } from '../../../../tools/measure/passageProseStats';

/**
 * Service wrapper for prose statistics analysis
 *
 * Provides prose analysis including:
 * - Word count and sentence count
 * - Average words per sentence
 * - Average sentences per paragraph
 * - Lexical density (content words vs total words)
 * - Dialogue percentage
 * - Word length distribution
 * - Unique word count
 * - Reading time estimates
 * - Pacing metrics
 * - Multi-file analysis (manuscript/chapters mode)
 */
export class ProseStatsService {
  private proseStats: PassageProseStats;

  constructor(
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    this.proseStats = new PassageProseStats();
  }

  /**
   * Analyze prose statistics for the given text
   *
   * @param input - Input object containing text to analyze
   * @returns Prose statistics object with metrics
   */
  analyze(input: { text: string }): any {
    return this.proseStats.analyze(input);
  }

  /**
   * Analyze multiple files (manuscript/chapters mode)
   *
   * Reads multiple files from the workspace and analyzes prose statistics for each.
   * This method handles file reading, error handling, and orchestration of multi-file analysis.
   *
   * @param relativePaths - Array of relative file paths from workspace root
   * @returns Array of { path, stats } objects for each successfully analyzed file
   */
  async analyzeMultipleFiles(
    relativePaths: string[]
  ): Promise<Array<{ path: string; stats: any }>> {
    const results: Array<{ path: string; stats: any }> = [];

    for (const rel of relativePaths) {
      try {
        const uri = await this.findUriByRelativePath(rel);
        if (!uri) continue;

        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString('utf8');
        const stats = this.analyze({ text });

        results.push({ path: rel, stats });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.outputChannel?.appendLine(`[ProseStatsService] Per-file stats failed for ${rel}: ${msg}`);
      }
    }

    return results;
  }

  /**
   * Find a VSCode URI by relative path in workspace folders
   *
   * Searches through all workspace folders to find the file matching the relative path.
   *
   * @param relativePath - Relative file path from workspace root
   * @returns VSCode URI if found, undefined otherwise
   */
  private async findUriByRelativePath(relativePath: string): Promise<vscode.Uri | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const candidate = vscode.Uri.joinPath(folder.uri, relativePath);
      try {
        await vscode.workspace.fs.stat(candidate);
        return candidate;
      } catch {
        // continue to next folder
      }
    }
    return undefined;
  }
}
