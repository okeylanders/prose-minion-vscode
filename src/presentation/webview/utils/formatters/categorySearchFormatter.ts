/**
 * Category Search Formatter
 * Formats category search results with file-by-file breakdowns and cluster analysis
 */

import { formatGap, escapePipes } from './helpers';

/**
 * Formats Category Search results as markdown
 * Leverages WordSearchResult data for file-by-file breakdowns and clusters
 */
export function formatCategorySearchAsMarkdown(result: any): string {
  if (!result) return '';

  let markdown = '';
  const { query, matchedWords, wordSearchResult } = result;

  // Title
  markdown += `# 🔍 Category Search: "${query}"\n\n`;

  // Metadata
  const timestamp = result.timestamp ? new Date(result.timestamp).toLocaleString() : 'N/A';
  markdown += `**Search Date**: ${timestamp}\n`;
  markdown += `**Matched Words**: ${matchedWords?.length ?? 0}\n\n`;

  // Warnings (non-fatal)
  if (result.warnings?.length) {
    markdown += `> ⚠️ ${result.warnings.join(' ')}\n\n`;
  }

  if (!matchedWords || matchedWords.length === 0) {
    markdown += '_No words matched the category query._\n';
    return markdown;
  }

  // Criteria section
  if (wordSearchResult?.options) {
    const options = wordSearchResult.options;
    markdown += '## Criteria\n\n';
    markdown += `- Case sensitive: ${options.caseSensitive ? 'yes' : 'no'}\n`;
    markdown += `- Context window: ${options.contextWords ?? 7} words | Cluster window: ${options.clusterWindow ?? 150} (min ${options.minClusterSize ?? 3} hits)\n\n`;
  }

  // Calculate totals
  const targets = wordSearchResult?.targets || [];
  const totalOccurrences = targets.reduce((sum: number, t: any) => sum + (t.totalOccurrences ?? 0), 0);
  const totalFilesWithMatches = new Set(
    targets.flatMap((t: any) => (t.perFile || []).map((f: any) => f.file))
  ).size;

  markdown += '## Results\n\n';
  markdown += `**Total occurrences**: ${totalOccurrences} across ${totalFilesWithMatches} file(s)\n\n`;

  // Summary table
  markdown += '### Summary\n\n';
  markdown += '| Word | Count | Files |\n';
  markdown += '|:-----|------:|------:|\n';

  for (const word of matchedWords) {
    const targetData = targets.find(
      (t: any) => t.normalized?.toLowerCase() === word.toLowerCase()
    );
    const count = targetData?.totalOccurrences ?? 0;
    const fileCount = targetData?.filesWithMatches ?? 0;
    markdown += `| \`${word}\` | ${count} | ${fileCount} |\n`;
  }
  markdown += '\n';

  // Files Summary table - shows which files each word appears in
  markdown += '### Files Summary\n\n';
  markdown += '| Word | Count | Clusters | Files | Files w/ Clusters |\n';
  markdown += '|:-----|------:|---------:|:------|:------------------|\n';

  for (const word of matchedWords) {
    const targetData = targets.find(
      (t: any) => t.normalized?.toLowerCase() === word.toLowerCase()
    );

    if (!targetData) continue;

    const count = targetData.totalOccurrences ?? 0;
    const perFile = targetData.perFile || [];

    // Calculate total clusters across all files
    const totalClusters = perFile.reduce((sum: number, f: any) => sum + (f.clusters?.length ?? 0), 0);

    // Get file lists
    const files = perFile.map((f: any) => f.relative || f.file || '—');
    const filesWithClusters = perFile
      .filter((f: any) => f.clusters?.length > 0)
      .map((f: any) => f.relative || f.file || '—');

    const filesStr = files.length > 0 ? files.join(', ') : '—';
    const filesWithClustersStr = filesWithClusters.length > 0 ? filesWithClusters.join(', ') : '—';

    markdown += `| \`${word}\` | ${count} | ${totalClusters} | ${filesStr} | ${filesWithClustersStr} |\n`;
  }
  markdown += '\n';

  // Details section - file-by-file breakdown with clusters and context
  markdown += '## Details & Cluster Analysis\n\n';

  for (const word of matchedWords) {
    const targetData = targets.find(
      (t: any) => t.normalized?.toLowerCase() === word.toLowerCase()
    );

    if (!targetData || !targetData.perFile?.length) continue;

    markdown += `### \`${word}\` (${targetData.totalOccurrences} occurrences)\n\n`;

    for (const file of targetData.perFile) {
      const fileName = file.relative || file.file || '—';
      const gapText = file.averageGap != null ? ` (avg gap ${formatGap(file.averageGap)})` : '';

      markdown += `#### ${fileName}\n`;
      markdown += `**Hits**: ${file.count}${gapText}\n\n`;

      // Occurrences table
      if (file.occurrences?.length) {
        markdown += '| # | Line | Context |\n';
        markdown += '|:-:|-----:|:--------|\n';
        for (const occ of file.occurrences) {
          const snippet = escapePipes((occ.snippet || '').trim()) || '—';
          markdown += `| ${occ.index} | ${occ.line} | ${snippet} |\n`;
        }
        markdown += '\n';
      }

      // Clusters
      if (file.clusters?.length) {
        markdown += '**Clusters detected:**\n';
        for (const cluster of file.clusters) {
          const span = cluster.spanWords ?? 0;
          const range = cluster.startLine === cluster.endLine
            ? `line ${cluster.startLine}`
            : `lines ${cluster.startLine}–${cluster.endLine}`;
          const snippet = escapePipes((cluster.snippet || '').trim()) || '—';
          markdown += `- ${cluster.count} hits within ${span} words near ${range}: ${snippet}\n`;
        }
        markdown += '\n';
      } else {
        markdown += '_No clusters above threshold._\n\n';
      }
    }
  }

  return markdown;
}
