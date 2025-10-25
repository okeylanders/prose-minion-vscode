import { analyzeWordFrequency } from './analyze.js';
import { formatJson, formatMarkdown } from './formatters.js';

export const wordFrequency = {
  description:
    'Deterministically measure how often specific words appear across markdown files, including per-file counts, average gaps, clusters, and contextual snippets.',
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        description: 'A markdown file path or array of paths/directories to scan recursively.',
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1 }]
      },
      path: { type: 'string', description: 'Single markdown file or directory to scan (alias for paths).' },
      words: {
        description: 'Word or list of words to measure.',
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1 }]
      },
      word: { type: 'string', description: 'Single word to measure (alias for words).' },
      caseSensitive: { type: 'boolean', description: 'Match words using case-sensitive comparisons.', default: false },
      contextWords: {
        type: 'number',
        description: 'How many words of context to display around each occurrence.',
        default: 5
      },
      clusterWindow: {
        type: 'number',
        description: 'Maximum distance in words between the first and last hits to treat as a cluster.',
        default: 150
      },
      minClusterSize: {
        type: 'number',
        description: 'Minimum number of hits inside the cluster window required to flag a cluster.',
        default: 3
      },
      returnFormat: {
        type: 'string',
        enum: ['markdown', 'json'],
        description: 'Return markdown summary (default) or raw JSON.',
        default: 'markdown'
      }
    },
    anyOf: [
      { required: ['paths'] },
      { required: ['path'] }
    ],
    allOf: [
      { anyOf: [{ required: ['words'] }, { required: ['word'] }] }
    ]
  },
  handler: async (args) => {
    try {
      const paths = normalizePaths(args);
      const targets = normalizeTargets(args);
      const caseSensitive = args?.caseSensitive === true;
      const contextWords = clampPositiveInt(args?.contextWords, 5, 0);
      const clusterWindow = clampPositiveInt(args?.clusterWindow, 150, 1);
      const minClusterSize = clampPositiveInt(args?.minClusterSize, 3, 2);
      const returnFormat = args?.returnFormat === 'json' ? 'json' : 'markdown';

      const report = await analyzeWordFrequency({
        paths,
        targets,
        caseSensitive,
        contextWords,
        clusterWindow,
        minClusterSize
      });

      if (returnFormat === 'json') {
        return formatJson(report);
      }
      return formatMarkdown(report);
    } catch (e) {
      const message = e?.message || String(e);
      return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
    }
  }
};

function normalizePaths(args) {
  const result = [];
  const { paths, path } = args ?? {};

  if (Array.isArray(paths)) {
    for (const value of paths) {
      const str = String(value ?? '').trim();
      if (str) result.push(str);
    }
  } else if (typeof paths === 'string') {
    const str = paths.trim();
    if (str) result.push(str);
  }

  if (typeof path === 'string') {
    const str = path.trim();
    if (str) result.push(str);
  }

  return result;
}

function normalizeTargets(args) {
  const values = [];
  const { words, word } = args ?? {};

  if (Array.isArray(words)) {
    for (const w of words) {
      const str = String(w ?? '').trim();
      if (str) values.push(str);
    }
  } else if (typeof words === 'string') {
    const str = words.trim();
    if (str) values.push(str);
  }

  if (typeof word === 'string') {
    const str = word.trim();
    if (str) values.push(str);
  }

  return values;
}

function clampPositiveInt(value, fallback, min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const floored = Math.floor(num);
  return Math.max(min, floored);
}
