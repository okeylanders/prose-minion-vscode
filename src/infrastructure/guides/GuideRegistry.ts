/**
 * Guide Registry - Infrastructure Layer
 * Dynamically discovers and catalogs all available craft guides
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface GuideMetadata {
  path: string;           // Relative path from craft-guides/ (e.g., "scene-example-guides/basketball-game.md")
  displayName: string;    // Human-readable name (e.g., "Basketball Game")
  category: string;       // Category folder (e.g., "scene-example-guides", "descriptors-and-placeholders")
}

export class GuideRegistry {
  private guidesCache: GuideMetadata[] | null = null;
  private lastScanTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel?: vscode.OutputChannel
  ) {}

  /**
   * Get all available guides, using cache if available
   */
  async listAvailableGuides(): Promise<GuideMetadata[]> {
    const now = Date.now();

    // Use cache if valid
    if (this.guidesCache && (now - this.lastScanTime) < this.CACHE_TTL) {
      this.outputChannel?.appendLine(`[GuideRegistry] Using cached guide list (${this.guidesCache.length} guides)`);
      return this.guidesCache;
    }

    // Scan and cache
    this.outputChannel?.appendLine('[GuideRegistry] Scanning craft-guides directory...');
    await this.scanGuidesDirectory();
    this.outputChannel?.appendLine(`[GuideRegistry] Found ${this.guidesCache?.length || 0} guides:`);
    this.guidesCache?.forEach((guide, index) => {
      this.outputChannel?.appendLine(`  ${index + 1}. ${guide.category} / ${guide.displayName} (${guide.path})`);
    });
    return this.guidesCache || [];
  }

  /**
   * Scan the craft-guides directory and catalog all .md files
   */
  async scanGuidesDirectory(): Promise<void> {
    const guidesPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'craft-guides');
    const guides: GuideMetadata[] = [];

    try {
      await this.scanDirectory(guidesPath, '', guides);

      // Sort by category, then by display name
      guides.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.displayName.localeCompare(b.displayName);
      });

      this.guidesCache = guides;
      this.lastScanTime = Date.now();
    } catch (error) {
      console.error('Failed to scan guides directory:', error);
      this.guidesCache = [];
    }
  }

  /**
   * Recursively scan a directory for markdown files
   */
  private async scanDirectory(
    dirUri: vscode.Uri,
    relativePath: string,
    guides: GuideMetadata[]
  ): Promise<void> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);

      for (const [name, type] of entries) {
        // Skip hidden files and README
        if (name.startsWith('.') || name.toLowerCase() === 'readme.md') {
          continue;
        }

        const entryUri = vscode.Uri.joinPath(dirUri, name);
        const entryRelativePath = relativePath ? `${relativePath}/${name}` : name;

        if (type === vscode.FileType.Directory) {
          // Recursively scan subdirectory
          await this.scanDirectory(entryUri, entryRelativePath, guides);
        } else if (type === vscode.FileType.File && name.endsWith('.md')) {
          // Add markdown file as a guide
          const category = this.getCategoryFromPath(entryRelativePath);
          const displayName = this.getDisplayNameFromFilename(name);

          guides.push({
            path: entryRelativePath,
            displayName,
            category
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirUri.fsPath}:`, error);
    }
  }

  /**
   * Extract category from path (the top-level folder name)
   */
  private getCategoryFromPath(relativePath: string): string {
    const parts = relativePath.split('/');
    if (parts.length === 1) {
      return 'general';
    }
    return this.formatCategoryName(parts[0]);
  }

  /**
   * Format category name for display
   */
  private formatCategoryName(category: string): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convert filename to display name
   */
  private getDisplayNameFromFilename(filename: string): string {
    // Remove .md extension
    const nameWithoutExt = filename.replace(/\.md$/i, '');

    // Split on hyphens and capitalize
    return nameWithoutExt
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format guide list for inclusion in AI prompt
   */
  formatGuideListForPrompt(guides: GuideMetadata[]): string {
    if (guides.length === 0) {
      return '## Available Craft Guides\n\nNo guides available.';
    }

    // Group by category
    const groupedByCategory = guides.reduce((acc, guide) => {
      if (!acc[guide.category]) {
        acc[guide.category] = [];
      }
      acc[guide.category].push(guide);
      return acc;
    }, {} as Record<string, GuideMetadata[]>);

    // Build formatted list
    const lines = ['## Available Craft Guides', ''];

    for (const [category, categoryGuides] of Object.entries(groupedByCategory)) {
      lines.push(`### ${category}`);
      for (const guide of categoryGuides) {
        lines.push(`- \`${guide.path}\` - ${guide.displayName}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Clear the cache to force a rescan
   */
  clearCache(): void {
    this.guidesCache = null;
    this.lastScanTime = 0;
  }
}
