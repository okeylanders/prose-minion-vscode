/**
 * LightboxStatRow — the headline stats and the standards comparison
 * (ADR 2026-10-19 D5). Every figure comes from the prose-stats tool and the
 * standards enrichment; nothing is a reading. Readability is the tool's
 * simplified score (100 − 2 × words per sentence), labeled as such.
 */
import * as React from 'react';
import type {
  LightboxBoard,
  LightboxStandardsItem,
  LightboxStandardsStatus
} from '@messages';

export interface LightboxStatRowProps {
  board: LightboxBoard;
}

const STATUS_MARKS: Record<LightboxStandardsStatus, string> = {
  below: '▼',
  within: '✓',
  above: '▲',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the comparison service's status literal.
  'n/a': ''
};

const number = (value: number): string => value.toLocaleString('en-US');

function readingTime(minutes: number): string {
  if (minutes <= 0) {
    return '0m';
  }
  if (minutes < 1) {
    return '<1m';
  }
  const rounded = Math.round(minutes);
  return rounded < 60 ? `${rounded}m` : `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
}

/** "Fast (short sentences)" → ["Fast", "short sentences"]. */
function splitPacing(pacing: string): [string, string | undefined] {
  const match = /^([^(]+?)\s*\(([^)]+)\)\s*$/.exec(pacing);
  return match ? [match[1], match[2]] : [pacing, undefined];
}

function rangeLabel(item: LightboxStandardsItem): string {
  const { min, max } = item.standard ?? {};
  if (min !== undefined && max !== undefined) {
    return `${number(min)}–${number(max)}`;
  }
  if (min !== undefined) {
    return `≥ ${number(min)}`;
  }
  return max !== undefined ? `≤ ${number(max)}` : 'no range';
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxStatRow: React.FC<LightboxStatRowProps> = ({ board }) => {
  const headline = board.measured.headline;
  const [pace, paceNote] = splitPacing(headline.pacing);
  const standards = board.measured.standards;
  const stats = [
    { value: number(headline.wordCount), label: headline.wordCount === 1 ? 'word' : 'words' },
    { value: String(headline.averageWordsPerSentence), label: 'avg words / sentence' },
    { value: `${headline.dialoguePercentage}%`, label: 'dialogue' },
    { value: String(headline.readabilityScore), label: 'readability · simplified' },
    { value: readingTime(headline.readingTimeMinutes), label: 'reading time' },
    { value: pace, label: paceNote ? `pacing · ${paceNote}` : 'pacing', accent: true }
  ];

  return (
    <section className="pm-lb-stats" aria-label="Headline stats">
      <div className="pm-lb-stat-row">
        {stats.map((stat) => (
          <div key={stat.label} className="pm-lb-stat">
            <div className={`pm-lb-stat-value${stat.accent ? ' is-accent' : ''}`}>{stat.value}</div>
            <div className="pm-lb-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="pm-lb-chips">
        <span className="pm-lb-chip"><b>{number(headline.paragraphCount)}</b> {headline.paragraphCount === 1 ? 'paragraph' : 'paragraphs'}</span>
        <span className="pm-lb-chip"><b>{number(headline.sentenceCount)}</b> {headline.sentenceCount === 1 ? 'sentence' : 'sentences'}</span>
        <span className="pm-lb-chip"><b>{number(headline.uniqueWordCount)}</b> unique</span>
        <span className="pm-lb-chip">
          <b>{number(headline.hapaxCount)}</b> hapax · {headline.hapaxPercent}%
        </span>
        <span className="pm-lb-chip"><b>{headline.vocabularyDiversity}%</b> diversity</span>
        <span className="pm-lb-chip"><b>{headline.lexicalDensity}%</b> lexical density</span>
      </div>
      {standards && (
        <div className="pm-lb-chips" aria-label="Against your publishing standard">
          <span className="pm-lb-chips-label">Against your standard</span>
          {standards.items.map((item) => (
            <span key={item.key} className={`pm-lb-chip pm-lb-std-${item.status === 'n/a' ? 'na' : item.status}`}>
              {item.label} <b>{typeof item.value === 'number' ? number(item.value) : item.value}</b>
              {' · '}{rangeLabel(item)} {STATUS_MARKS[item.status]}
            </span>
          ))}
          {standards.publishingFormat && (
            <span className="pm-lb-chip">
              {standards.publishingFormat.trimLabel} trim · <b>~{number(standards.publishingFormat.estimatedPageCount)}</b> pages
            </span>
          )}
        </div>
      )}
    </section>
  );
};
