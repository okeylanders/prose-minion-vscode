/**
 * The Passage Search report (ADR 2026-11-20 D15, D21): one Markdown
 * formatter for Copy, Save and, later, the Workshop card's report. It reads
 * the display-safe result only, so it holds no absolute path. Pure; shared
 * by the host and the webview.
 *
 * In order: the headline, how the search ended, the analysis, the label
 * table, every instance, then what was left out and why. Counts are the
 * host's; the label table beside the analysis is the source of truth.
 */

import type { PassageSearchResultView } from '@messages';
import {
  passageSearchAnalysisNote,
  passageSearchCites,
  passageSearchLocation,
  passageSearchMissingLines,
  passageSearchReadLine,
  passageSearchSummary
} from '@shared/utils/passageSearchWords';

/** One line, with nothing that would start a table cell, a heading or a list. */
const inline = (text: string): string => text.replace(/\s+/g, ' ').trim();
const cell = (text: string): string => inline(text).replace(/\|/g, '\\|');
/** A quote as a block quote, its own line breaks kept. */
const quoted = (text: string): string => text.split(/\r?\n/).map((line) => `> ${line}`.trimEnd()).join('\n');

/** The source text either side of a quote, on one line, with the quote's place marked; undefined when there is none. */
const contextLine = (before: string, after: string): string | undefined =>
  before.trim().length + after.trim().length === 0 ? undefined : `_In context:_ …${before.replace(/\s+/g, ' ').trimStart()}[…]${after.replace(/\s+/g, ' ').trimEnd()}…`;

export function formatPassageSearchReport(result: PassageSearchResultView): string {
  const lines: string[] = ['# Passage Search', ''];
  lines.push(`## ${inline(result.analysis?.headline ?? passageSearchSummary(result))}`, '');
  lines.push(`- **Question:** ${inline(result.question)}`);
  lines.push(`- **Found:** ${passageSearchSummary(result)}`);
  lines.push(`- **Read:** ${passageSearchReadLine(result)}`);
  lines.push(`- **Model:** ${result.model}`);
  if (result.endedMessage) {
    lines.push(`- **Ended early:** ${result.endedMessage}`);
  }
  lines.push('');

  const analysisNote = passageSearchAnalysisNote(result);
  if (result.analysis) {
    lines.push('## Analysis', '');
    for (const section of result.analysis.sections) {
      lines.push(`### ${inline(section.title)}`, '');
      for (const claim of section.claims) {
        lines.push(`- ${inline(claim.text)} ${passageSearchCites(claim.cites)}`);
      }
      lines.push('');
    }
  }
  if (analysisNote) {
    lines.push(`_${analysisNote}_`, '');
  }

  if (result.labels.length > 0) {
    lines.push('## Labels', '', '| Label | Instances | Files |', '|---|---:|---:|');
    for (const label of result.labels) {
      lines.push(`| ${cell(label.label)} | ${label.count} | ${label.files} |`);
    }
    lines.push('');
  }

  lines.push('## Instances', '');
  if (result.instances.length === 0) {
    lines.push('None.', '');
  }
  for (const instance of result.instances) {
    lines.push(`### #${instance.number} · ${inline(passageSearchLocation(instance))}`, '');
    lines.push(`**${inline(instance.label)}**`, '', quoted(instance.quote), '');
    const context = contextLine(instance.before, instance.after);
    if (context) {
      lines.push(context, '');
    }
    if (instance.note.trim().length > 0) {
      lines.push(inline(instance.note), '');
    }
  }

  const missing = passageSearchMissingLines(result);
  if (missing.length > 0) {
    lines.push('## What was left out', '', ...missing.map((line) => `- ${line}`), '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
