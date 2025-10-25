import fs from 'fs/promises';
import path from 'path';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mdx']);

export async function analyzeWordFrequency({ paths, targets, caseSensitive, contextWords, clusterWindow, minClusterSize }) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('Provide at least one path to scan.');
  }
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('Provide at least one target word to measure.');
  }

  const normalizedTargets = prepareTargets(targets, caseSensitive);
  if (normalizedTargets.length === 0) {
    throw new Error('None of the provided target words contained measurable tokens.');
  }

  const { files, missing } = await collectMarkdownFiles(paths);
  if (missing.length > 0) {
    throw new Error(`Path(s) not found or unreadable: ${missing.join(', ')}`);
  }

  const report = {
    scannedFiles: files.map((file) => ({
      absolute: file,
      relative: path.relative(process.cwd(), file) || path.basename(file)
    })),
    options: {
      caseSensitive,
      contextWords,
      clusterWindow,
      minClusterSize
    },
    targets: []
  };

  if (files.length === 0) {
    return { ...report, note: 'No markdown files found for the provided paths.' };
  }

  for (const target of normalizedTargets) {
    const targetSummary = await measureTargetAcrossFiles(target, files, {
      caseSensitive,
      contextWords,
      clusterWindow,
      minClusterSize
    });
    report.targets.push(targetSummary);
  }

  return report;
}

function prepareTargets(values, caseSensitive) {
  const prepared = [];
  for (const raw of values) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) continue;
    const tokenMatches = trimmed.match(makeWordPattern());
    if (!tokenMatches || tokenMatches.length === 0) continue;
    const normalizedTokens = tokenMatches.map((token) => (caseSensitive ? token : token.toLowerCase()));
    prepared.push({
      label: trimmed,
      normalizedTokens,
      tokenLength: normalizedTokens.length
    });
  }
  return prepared;
}

async function collectMarkdownFiles(inputPaths) {
  const files = new Set();
  const missing = [];

  for (const provided of inputPaths) {
    const resolved = resolvePath(provided);
    try {
      const stats = await fs.stat(resolved);
      if (stats.isDirectory()) {
        const topLevel = await listMarkdownFiles(resolved);
        for (const filePath of topLevel) {
          files.add(filePath);
        }
      } else if (stats.isFile() && isMarkdown(resolved)) {
        files.add(resolved);
      }
    } catch {
      missing.push(String(provided));
    }
  }

  return { files: Array.from(files).sort(), missing };
}

function resolvePath(provided) {
  const str = String(provided ?? '').trim();
  if (!str) return str;
  return path.isAbsolute(str) ? str : path.resolve(process.cwd(), str);
}

async function listMarkdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(directory, entry.name))
    .filter((filePath) => isMarkdown(filePath));
}

function isMarkdown(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return MARKDOWN_EXTENSIONS.has(ext);
}

async function measureTargetAcrossFiles(target, files, options) {
  const perFile = [];
  const allDistances = [];
  let totalOccurrences = 0;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const tokens = tokenizeContent(content, options.caseSensitive);
    if (tokens.length === 0) continue;
    const lineIndex = buildLineIndex(content);
    const occurrences = findOccurrences(content, tokens, target, {
      contextWords: options.contextWords,
      lineIndex
    });
    if (occurrences.length === 0) continue;

    const distances = computeDistances(occurrences, target.tokenLength);
    if (distances.length > 0) {
      allDistances.push(...distances);
    }

    const clusters = detectClusters(occurrences, {
      clusterWindow: options.clusterWindow,
      minClusterSize: options.minClusterSize,
      tokens,
      content,
      contextWords: options.contextWords
    });

    totalOccurrences += occurrences.length;
    perFile.push({
      file,
      relative: path.relative(process.cwd(), file) || path.basename(file),
      count: occurrences.length,
      averageGap: average(distances),
      occurrences: occurrences.map((occ, idx) => ({
        index: idx + 1,
        line: occ.line,
        snippet: occ.snippet
      })),
      clusters: clusters.map((cluster) => ({
        count: cluster.count,
        spanWords: cluster.spanWords,
        startLine: cluster.startLine,
        endLine: cluster.endLine,
        snippet: cluster.snippet
      }))
    });
  }

  perFile.sort((a, b) => a.relative.localeCompare(b.relative));

  return {
    target: target.label,
    normalized: target.normalizedTokens.join(' '),
    totalOccurrences,
    overallAverageGap: average(allDistances),
    filesWithMatches: perFile.length,
    perFile
  };
}

function tokenizeContent(content, caseSensitive) {
  const tokens = [];
  const pattern = makeWordPattern();
  let match;
  let idx = 0;
  while ((match = pattern.exec(content)) !== null) {
    const word = match[0];
    tokens.push({
      raw: word,
      normalized: caseSensitive ? word : word.toLowerCase(),
      start: match.index,
      end: match.index + word.length,
      index: idx
    });
    idx += 1;
  }
  return tokens;
}

function buildLineIndex(content) {
  const lineBreaks = [];
  let idx = content.indexOf('\n');
  while (idx !== -1) {
    lineBreaks.push(idx);
    idx = content.indexOf('\n', idx + 1);
  }
  return lineBreaks;
}

function findLineNumber(lineIndex, position) {
  if (!lineIndex || lineIndex.length === 0) return 1;
  let low = 0;
  let high = lineIndex.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (lineIndex[mid] >= position) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low + 1;
}

function findOccurrences(content, tokens, target, { contextWords, lineIndex }) {
  const occurrences = [];
  const tokenLimit = target.tokenLength;
  if (tokenLimit === 0 || tokens.length < tokenLimit) return occurrences;

  for (let i = 0; i <= tokens.length - tokenLimit; i += 1) {
    let match = true;
    for (let j = 0; j < tokenLimit; j += 1) {
      if (tokens[i + j].normalized !== target.normalizedTokens[j]) {
        match = false;
        break;
      }
    }
    if (!match) continue;

    const startToken = tokens[i];
    const endToken = tokens[i + tokenLimit - 1];
    const contextStartToken = Math.max(0, i - contextWords);
    const contextEndToken = Math.min(tokens.length - 1, i + tokenLimit - 1 + contextWords);
    const snippet = extractSnippet(content, tokens, {
      startTokenIndex: contextStartToken,
      endTokenIndex: contextEndToken,
      highlights: [{ start: startToken.start, end: endToken.end }]
    });

    occurrences.push({
      tokenStart: startToken.index,
      tokenEnd: endToken.index,
      charStart: startToken.start,
      charEnd: endToken.end,
      line: findLineNumber(lineIndex, startToken.start),
      snippet
    });
  }

  return occurrences;
}

function computeDistances(occurrences, tokenLength) {
  if (!occurrences || occurrences.length < 2) return [];
  const distances = [];
  for (let i = 0; i < occurrences.length - 1; i += 1) {
    const current = occurrences[i];
    const next = occurrences[i + 1];
    const gap = next.tokenStart - current.tokenStart - tokenLength;
    if (gap >= 0) distances.push(gap);
  }
  return distances;
}

function detectClusters(occurrences, { clusterWindow, minClusterSize, tokens, content, contextWords }) {
  if (!occurrences || occurrences.length < minClusterSize) return [];
  const clustersByStart = new Map();

  let start = 0;
  for (let end = 0; end < occurrences.length; end += 1) {
    while (
      start < end &&
      occurrences[end].tokenStart - occurrences[start].tokenStart > clusterWindow
    ) {
      start += 1;
    }

    const count = end - start + 1;
    if (count >= minClusterSize) {
      const existing = clustersByStart.get(start);
      if (!existing || end > existing.endIndex) {
        const startOccurrence = occurrences[start];
        const endOccurrence = occurrences[end];
        const contextStartToken = Math.max(0, startOccurrence.tokenStart - Math.max(contextWords * 2, 8));
        const contextEndToken = Math.min(
          tokens.length - 1,
          endOccurrence.tokenEnd + Math.max(contextWords * 2, 8)
        );

        const highlightRanges = [];
        for (let idx = start; idx <= end; idx += 1) {
          highlightRanges.push({
            start: occurrences[idx].charStart,
            end: occurrences[idx].charEnd
          });
        }

        const snippet = extractSnippet(content, tokens, {
          startTokenIndex: contextStartToken,
          endTokenIndex: contextEndToken,
          highlights: highlightRanges
        });

        clustersByStart.set(start, {
          startIndex: start,
          endIndex: end,
          count,
          spanWords: occurrences[end].tokenStart - occurrences[start].tokenStart,
          startLine: startOccurrence.line,
          endLine: endOccurrence.line,
          snippet
        });
      }
    }
  }

  return Array.from(clustersByStart.values()).sort((a, b) => a.startIndex - b.startIndex);
}

function extractSnippet(content, tokens, { startTokenIndex, endTokenIndex, highlights }) {
  if (tokens.length === 0) return '';

  const boundedStart = Math.max(0, startTokenIndex);
  const boundedEnd = Math.min(tokens.length - 1, endTokenIndex);
  const charStart = tokens[boundedStart]?.start ?? 0;
  const charEnd = tokens[boundedEnd]?.end ?? Math.min(content.length, charStart + 120);

  if (charStart >= charEnd) return '';

  const sortedHighlights = (highlights || [])
    .map((range) => ({
      start: Math.max(charStart, range.start),
      end: Math.min(charEnd, range.end)
    }))
    .filter((range) => range.start < range.end)
    .sort((a, b) => a.start - b.start);

  const parts = [];
  let cursor = charStart;
  for (const range of sortedHighlights) {
    if (range.start > cursor) {
      parts.push(content.slice(cursor, range.start));
    }
    parts.push(`**${content.slice(range.start, range.end)}**`);
    cursor = range.end;
  }
  if (cursor < charEnd) {
    parts.push(content.slice(cursor, charEnd));
  }

  const prefix = boundedStart > 0 ? '…' : '';
  const suffix = boundedEnd < tokens.length - 1 ? '…' : '';
  return `${prefix}${parts.join('')}${suffix}`.replace(/\s+/g, ' ').trim();
}

function average(values) {
  if (!values || values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Number.isFinite(sum) ? sum / values.length : null;
}

function makeWordPattern() {
  return /[A-Za-z0-9']+/g;
}
