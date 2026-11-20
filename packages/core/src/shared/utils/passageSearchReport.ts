/**
 * A passage search's result as a Markdown report (ADR 2026-11-20 D15, D21):
 * headline, what was read and what is missing, the analysis when there is
 * one, the host's label table, every instance in reading order, and what
 * was not kept and why. Pure, with no import, so the host and the webview
 * write the same report.
 *
 * It takes the result's display-safe fields only: a file by the path a
 * result shows, never a host path. Every quote is the source's own text
 * (D9a); every count is the host's.
 */

export interface PassageSearchReportInstance {
  readonly number: number;
  readonly displayPath: string;
  readonly line: number;
  readonly quote: string;
  readonly note: string;
  /** The key of its label in `labels`. */
  readonly label: string;
}

export interface PassageSearchReportResult {
  readonly question: string;
  readonly model: string;
  readonly instances: readonly PassageSearchReportInstance[];
  readonly labels: ReadonlyArray<{ readonly key: string; readonly label: string; readonly count: number; readonly files: number }>;
  readonly analysis?: {
    readonly headline: string;
    readonly sections: ReadonlyArray<{
      readonly title: string;
      readonly claims: ReadonlyArray<{ readonly text: string; readonly cites: readonly number[] }>;
    }>;
    readonly read: { readonly instances: number; readonly of: number };
  };
  /** Why a pass that was started left no analysis. */
  readonly analysisMissing?: string;
  readonly dropped: Readonly<Record<string, number>>;
  readonly overLimit: number;
  readonly calls: { readonly planned: number; readonly answered: number; readonly failed: number; readonly cut: number; readonly unsent: number };
  readonly files: {
    readonly read: ReadonlyArray<{ readonly displayPath: string }>;
    readonly leftOut: { readonly unreadable: number; readonly unsplittable: number; readonly empty: number };
  };
  readonly ended: string;
}

const count = (value: number): string => value.toLocaleString('en-US');
const plural = (value: number, one: string, many = `${one}s`): string => `${count(value)} ${value === 1 ? one : many}`;

/** "14 instances in 6 files": the host's own headline, where the analysis gives none. */
export function passageSearchReportHeadline(result: Pick<PassageSearchReportResult, 'instances' | 'files'>): string {
  const files = new Set(result.instances.map((instance) => instance.displayPath)).size;
  return result.instances.length === 0
    ? `No instances in ${plural(result.files.read.length, 'file')}.`
    : `${plural(result.instances.length, 'instance')} in ${plural(files, 'file')}.`;
}

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the result's kebab-case words. */
const ENDINGS: Readonly<Record<string, string>> = {
  stopped: 'The search was stopped before every call was made.',
  'key-changed': 'The API key changed during the search, so the remaining calls were not made.',
  'provider-failed': 'The provider refused several calls in a row, so the remaining calls were not made.',
  'instance-limit': 'The search reached the most instances it keeps and stopped there.'
};

const DROPS: Readonly<Record<string, (value: number) => string>> = {
  'quote-not-found': (value) => `${plural(value, 'quote')} a model gave could not be found in the text`,
  'quote-ambiguous': (value) => `${plural(value, 'quote')} matched more than one place`,
  malformed: (value) => `${plural(value, 'entry', 'entries')} could not be read`,
  duplicate: (value) => `${plural(value, 'repeat')} of a moment already listed`
};
/* eslint-enable @typescript-eslint/naming-convention */

/** What was read and what is missing, in the host's words: one line each. */
export function passageSearchReportNotes(result: PassageSearchReportResult): string[] {
  const { calls, files } = result;
  const leftOut = files.leftOut.unreadable + files.leftOut.unsplittable + files.leftOut.empty;
  const dropped = Object.entries(result.dropped).filter(([, value]) => value > 0);
  return [
    `Read ${plural(files.read.length, 'file')} in ${count(calls.answered)} of ${plural(calls.planned, 'call')}.`,
    ...(ENDINGS[result.ended] ? [ENDINGS[result.ended]] : []),
    ...(calls.unsent > 0 ? [`${plural(calls.unsent, 'call was', 'calls were')} not made.`] : []),
    ...(calls.failed > 0 ? [`${plural(calls.failed, 'call')} failed.`] : []),
    ...(calls.cut > 0 ? [`${plural(calls.cut, 'reply was', 'replies were')} cut off at the length limit; what was finished was kept.`] : []),
    ...(leftOut > 0 ? [`${plural(leftOut, 'file was', 'files were')} left out (not readable as text, no place to split, or empty).`] : []),
    ...(result.overLimit > 0 ? [`${plural(result.overLimit, 'instance')} past the limit ${result.overLimit === 1 ? 'was' : 'were'} not kept.`] : []),
    ...(dropped.length > 0
      ? [`Not kept: ${dropped.map(([reason, value]) => (DROPS[reason] ?? ((n: number) => `${count(n)} (${reason})`))(value)).join('; ')}.`]
      : []),
    ...(result.analysis && result.analysis.read.instances < result.analysis.read.of
      ? [`The analysis read ${count(result.analysis.read.instances)} of ${plural(result.analysis.read.of, 'instance')}.`]
      : []),
    ...(result.analysisMissing ? ['The results could not be organized; every instance is listed below.'] : [])
  ];
}

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const quoted = (text: string): string => text.split(/\r?\n/).map((line) => `> ${line}`).join('\n');

export function formatPassageSearchReport(result: PassageSearchReportResult): string {
  const labels = new Map(result.labels.map((label) => [label.key, label.label]));
  const lines: string[] = [
    '# Passage Search',
    '',
    `**Question:** ${result.question.replace(/\s+/g, ' ').trim()}`,
    '',
    `**Model:** ${result.model}`,
    '',
    `**${(result.analysis?.headline ?? passageSearchReportHeadline(result)).replace(/\s+/g, ' ').trim()}**`,
    '',
    '## What was read',
    '',
    ...passageSearchReportNotes(result).map((note) => `- ${note}`),
    ''
  ];
  if (result.analysis && result.analysis.sections.length > 0) {
    lines.push('## Analysis', '');
    for (const section of result.analysis.sections) {
      lines.push(`### ${section.title.replace(/\s+/g, ' ').trim()}`, '');
      for (const claim of section.claims) {
        lines.push(`- ${claim.text.replace(/\s+/g, ' ').trim()} [${claim.cites.join(', ')}]`);
      }
      lines.push('');
    }
  }
  if (result.labels.length > 0) {
    lines.push('## Labels', '', '| Label | Instances | Files |', '| --- | ---: | ---: |');
    for (const label of result.labels) {
      lines.push(`| ${cell(label.label)} | ${count(label.count)} | ${count(label.files)} |`);
    }
    lines.push('');
  }
  lines.push('## Instances', '');
  if (result.instances.length === 0) {
    lines.push('None.', '');
  }
  let file: string | undefined;
  for (const instance of result.instances) {
    if (instance.displayPath !== file) {
      file = instance.displayPath;
      lines.push(`### ${file}`, '');
    }
    lines.push(`**${instance.number}.** line ${count(instance.line)} · *${cell(labels.get(instance.label) ?? instance.label)}*`, '', quoted(instance.quote), '');
    if (instance.note.trim().length > 0) {
      lines.push(instance.note.replace(/\s+/g, ' ').trim(), '');
    }
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}
