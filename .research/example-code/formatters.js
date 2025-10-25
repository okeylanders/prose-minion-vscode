export function formatJson(report) {
  return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
}

export function formatMarkdown(report) {
  const lines = [];
  lines.push('# Word Frequency Report');

  const targetList = (report.targets || []).map((t) => `\`${t.target}\``).join(', ') || '—';
  const scannedFiles = report.scannedFiles || [];
  const fileList = scannedFiles.map((f) => f.relative).join(', ');
  const options = report.options || {};

  lines.push(`- Targets: ${targetList}`);
  lines.push(`- Files scanned: ${scannedFiles.length}${fileList ? ` (${fileList})` : ''}`);
  lines.push(`- Case sensitive: ${options.caseSensitive ? 'yes' : 'no'}`);
  lines.push(
    `- Context window: ${options.contextWords ?? 5} words | Cluster window: ${options.clusterWindow ?? 150} (min ${options.minClusterSize ?? 3} hits)`
  );

  if (report.note) {
    lines.push(`\n_${report.note}_`);
  }

  for (const target of report.targets || []) {
    lines.push(`\n## Target “${target.target}”`);
    lines.push(
      `- Total occurrences: ${target.totalOccurrences} across ${target.filesWithMatches} file(s)`
    );
    lines.push(`- Average gap between hits: ${formatGap(target.overallAverageGap)}`);

    if (!target.perFile.length) {
      lines.push('\n_No matches found in the scanned markdown files._');
      continue;
    }

    for (const file of target.perFile) {
      lines.push(`\n### ${file.relative}`);
      const gapText = file.averageGap != null ? ` (avg gap ${formatGap(file.averageGap)})` : '';
      lines.push(`Hits: ${file.count}${gapText}`);

      if (file.occurrences.length) {
        lines.push('\n| # | Line | Context |');
        lines.push('| - | - | - |');
        for (const occ of file.occurrences) {
          const snippet = escapePipes(occ.snippet || '').trim() || '—';
          lines.push(`| ${occ.index} | ${occ.line} | ${snippet} |`);
        }
      } else {
        lines.push('\n(No individual occurrences captured.)');
      }

      if (file.clusters.length) {
        lines.push('\nClusters detected:');
        for (const cluster of file.clusters) {
          const span = cluster.spanWords ?? 0;
          const range =
            cluster.startLine === cluster.endLine
              ? `line ${cluster.startLine}`
              : `lines ${cluster.startLine}–${cluster.endLine}`;
          const snippet = escapePipes(cluster.snippet || '').trim() || '—';
          lines.push(
            `- ${cluster.count} hits within ${span} words near ${range}: ${snippet}`
          );
        }
      } else {
        lines.push('\nNo clusters above the configured threshold.');
      }
    }
  }

  if (!report.targets?.length) {
    lines.push('\n_No target words were provided._');
  }

  lines.push('\n---');
  lines.push('Deterministic text analysis only; no external model calls.');

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

function formatGap(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} word${value.toFixed(1) === '1.0' ? '' : 's'}`;
}

function escapePipes(text) {
  return text.replace(/\|/g, '\\|');
}
