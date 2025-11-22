/**
 * Word Search Result Formatter
 * Formats word search results with criteria, statistics, and per-file breakdowns
 */

import { formatGap, escapePipes } from './helpers';

/**
 * Formats word search results as markdown
 * @param metrics Word search result data
 * @returns Formatted markdown string
 */
export function formatSearchResultAsMarkdown(metrics: any): string {
  if (!metrics) {
    return '';
  }

  // Shape detection: scannedFiles + targets with perFile occurrences
  if (
    !Array.isArray((metrics as any).scannedFiles) ||
    !Array.isArray((metrics as any).targets)
  ) {
    return '';
  }

  const report: any = metrics;
  let markdown = '# 🔎 Word Search\n\n';

  const targetList = (report.targets || []).map((t: any) => `\`${t.target}\``).join(', ') || '—';
  const scannedFiles = report.scannedFiles || [];
  const options = report.options || {};

  // Criteria section
  markdown += '## Criteria\n\n';
  markdown += `- Targets: ${targetList}\n`;
  markdown += `- Case sensitive: ${options.caseSensitive ? 'yes' : 'no'}\n`;
  markdown += `- Context window: ${options.contextWords ?? 7} words | Cluster window: ${options.clusterWindow ?? 150} (min ${options.minClusterSize ?? 3} hits)\n`;

  if (report.note) {
    markdown += `\n_${report.note}_\n`;
  }

  // Calculate aggregate totals across all targets
  const allTargets = report.targets || [];
  const totalOccurrences = allTargets.reduce((sum: number, t: any) => sum + (t.totalOccurrences ?? 0), 0);
  const totalFilesWithMatches = allTargets.reduce((sum: number, t: any) => sum + (t.filesWithMatches ?? 0), 0);

  // Calculate weighted average gap across all targets
  let totalHits = 0;
  let weightedGapSum = 0;
  for (const target of allTargets) {
    const hits = target.totalOccurrences ?? 0;
    const gap = target.overallAverageGap ?? 0;
    if (hits > 0 && Number.isFinite(gap)) {
      totalHits += hits;
      weightedGapSum += gap * hits;
    }
  }
  const overallAverageGap = totalHits > 0 ? weightedGapSum / totalHits : null;

  // Results section
  markdown += '\n## Results\n\n';
  markdown += `Total occurrences: ${totalOccurrences} across ${totalFilesWithMatches} file(s)\n`;
  if (overallAverageGap !== null) {
    markdown += `Average gap between hits: ${formatGap(overallAverageGap)}\n`;
  }

  // Summary table
  markdown += '\n### Summary\n\n';
  markdown += '| File | Word | Hits | Cluster Count |\n';
  markdown += '|:-----|:-----|-----:|--------------:|\n';

  for (const target of report.targets || []) {
    if (target.perFile && target.perFile.length > 0) {
      for (const file of target.perFile) {
        const fileName = file.relative || file.file || '—';
        const word = target.target || '—';
        const hits = file.count ?? 0;
        const clusterCount = file.clusters?.length ?? 0;
        markdown += `| ${fileName} | \`${word}\` | ${hits} | ${clusterCount} |\n`;
      }
    }
  }
  markdown += '\n';

  for (const target of report.targets || []) {
    if (!target.perFile?.length) {
      markdown += '_No matches found in the scanned markdown files._\n';
      continue;
    }

    for (const file of target.perFile) {
      markdown += `\n#### ${file.relative}\n`;
      const gapText = file.averageGap != null ? ` (avg gap ${formatGap(file.averageGap)})` : '';
      markdown += `Hits: ${file.count}${gapText}\n`;

      if (file.occurrences?.length) {
        markdown += '\n| # | Line | Context |\n';
        markdown += '| - | - | - |\n';
        for (const occ of file.occurrences) {
          const snippet = escapePipes((occ.snippet || '').trim()) || '—';
          markdown += `| ${occ.index} | ${occ.line} | ${snippet} |\n`;
        }
      } else {
        markdown += '\n(No individual occurrences captured.)\n';
      }

      if (file.clusters?.length) {
        markdown += '\nClusters detected:\n';
        for (const cluster of file.clusters) {
          const span = cluster.spanWords ?? 0;
          const range = cluster.startLine === cluster.endLine ? `line ${cluster.startLine}` : `lines ${cluster.startLine}–${cluster.endLine}`;
          const snippet = escapePipes((cluster.snippet || '').trim()) || '—';
          markdown += `- ${cluster.count} hits within ${span} words near ${range}: ${snippet}\n`;
        }
      } else {
        markdown += '\nNo clusters above the configured threshold.\n';
      }
    }
  }

  return markdown;
}
