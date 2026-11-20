/**
 * Passage Search in words, and its Markdown report (ADR 2026-11-20 D14,
 * D15): the estimate line's variants, what a result says is missing, and
 * one full report as a snapshot. *Alice*-style text throughout.
 */

import { ESTIMATE, RESULT } from '@/__tests__/shared/utils/passageSearchViewFixtures';
import { formatPassageSearchReport } from '@shared/utils/passageSearchReport';
import {
  passageSearchAnalysisNote,
  passageSearchEstimateDetails,
  passageSearchEstimateLine,
  passageSearchLocation,
  passageSearchMissingLines,
  passageSearchOrganizeSample,
  passageSearchProgressLine,
  passageSearchReadLine,
  passageSearchSummary
} from '@shared/utils/passageSearchWords';

describe('the estimate line', () => {
  it('shows calls, the approximate price and the model', () => {
    expect(passageSearchEstimateLine(ESTIMATE)).toBe('23 calls · ≈ $0.42 · test/reader');
  });

  it('says "price unavailable" beside the count when there is no live price', () => {
    const { usd: _usd, ...unpriced } = ESTIMATE;
    expect(passageSearchEstimateLine(unpriced)).toBe('23 calls · price unavailable · test/reader');
  });

  it('writes a price that rounds to nothing as under a cent, and one call in the singular', () => {
    expect(passageSearchEstimateLine({ ...ESTIMATE, calls: 1, usd: 0.001 })).toBe('1 call · < $0.01 · test/reader');
  });

  it('never words a price as a cap', () => {
    const lines = [passageSearchEstimateLine(ESTIMATE), ...passageSearchEstimateDetails({ ...ESTIMATE, organizeAllowance: true })].join(' ');
    expect(lines).not.toMatch(/up to|at most|maximum/i);
    expect(lines).toContain('an estimate, not a limit');
  });

  it('says the allowance for organizing, and the files left out', () => {
    expect(passageSearchEstimateDetails(ESTIMATE)).toEqual(['22 files to read. The price is an estimate, not a limit.']);
    expect(passageSearchEstimateDetails({ ...ESTIMATE, organizeAllowance: true, leftOutMessage: '1 file left out: it has no place to split.' })).toEqual([
      '22 files to read. The price is an estimate, not a limit.',
      'It includes an allowance for organizing the results.',
      '1 file left out: it has no place to split.'
    ]);
  });

  it('says when an organizing pass would not read every instance', () => {
    expect(passageSearchOrganizeSample({ read: 400, of: 1240 })).toBe('It would read 400 of 1,240 instances.');
    expect(passageSearchOrganizeSample({ read: 3, of: 3 })).toBeUndefined();
  });
});

describe('a result in words', () => {
  it('writes progress, the summary and a location', () => {
    expect(passageSearchProgressLine({ calls: { planned: 23, done: 7 }, found: 5 })).toBe('Reading 7 of 23 · 5 found');
    expect(passageSearchSummary(RESULT)).toBe('3 instances in 2 files');
    expect(passageSearchSummary({ ...RESULT, instances: [] })).toBe('No instances found in 7 files.');
    expect(passageSearchLocation(RESULT.instances[0])).toBe('chapters/alice-ch1.md · line 12');
    expect(passageSearchLocation(RESULT.instances[2])).toBe('Selected text · line 2 of the searched text');
  });

  it('says what the reads covered', () => {
    expect(passageSearchReadLine(RESULT)).toBe('7 of 23 calls answered, over 7 of 22 files.');
    expect(passageSearchReadLine({ ...RESULT, calls: { planned: 23, answered: 23, failed: 0, cut: 0, cancelled: 0, unsent: 0 } })).toBe('Read 22 files in 23 calls.');
  });

  it('lists what is missing and why, and nothing when nothing is', () => {
    expect(passageSearchMissingLines(RESULT)).toEqual([
      '15 of 22 files were not searched.',
      '1 of 22 files was searched only in part.',
      '2 calls were stopped in flight, so the text they cover was not searched; they may still have been charged.',
      '13 calls were not made, so the text they cover was not searched.',
      '1 call failed, so the text it covers was not searched.',
      '1 reply was cut off at the length limit; the instances finished before the cut are kept.',
      '1 quote could not be found in the text as quoted, so it is not listed.',
      '2 quotes matched more than one place, so they are not listed.',
      '1 repeat of a moment already listed was merged into it.',
      '1 claim in the analysis was left out: it cited no instance here, or quoted one wrongly.',
      '1 file left out: not readable as text.'
    ]);
    const { analysis: _analysis, leftOutMessage: _leftOut, ...whole } = RESULT;
    expect(passageSearchMissingLines({
      ...whole,
      files: { ...whole.files, searched: { full: 22, partial: 0, none: 0 } },
      dropped: { 'quote-not-found': 0, 'quote-ambiguous': 0, malformed: 0, duplicate: 0 },
      calls: { planned: 23, answered: 23, failed: 0, cut: 0, cancelled: 0, unsent: 0 }
    })).toEqual([]);
  });

  it('says how many files were not searched or searched in part, and calls stopped in flight', () => {
    const lines = passageSearchMissingLines({
      ...RESULT,
      calls: { ...RESULT.calls, cancelled: 2 },
      files: { ...RESULT.files, planned: 23, searched: { full: 19, partial: 1, none: 3 } }
    });
    expect(lines.slice(0, 3)).toEqual([
      '3 of 23 files were not searched.',
      '1 of 23 files was searched only in part.',
      '2 calls were stopped in flight, so the text they cover was not searched; they may still have been charged.'
    ]);
  });

  it('says how much an analysis read, and why one is missing', () => {
    expect(passageSearchAnalysisNote(RESULT)).toBeUndefined();
    expect(passageSearchAnalysisNote({ analysis: { ...RESULT.analysis!, read: { instances: 400, of: 1240 } } }))
      .toBe('The analysis read 400 of 1,240 instances.');
    expect(passageSearchAnalysisNote({ analysisMissing: 'cut' }))
      .toBe('The results were not organized: the organizing reply was cut off. The list below is whole.');
    expect(passageSearchAnalysisNote({})).toBeUndefined();
  });
});

describe('formatPassageSearchReport', () => {
  it('writes the headline, the ending, the analysis, the table, every instance and what was left out', () => {
    expect(formatPassageSearchReport(RESULT)).toMatchInlineSnapshot(`
"# Passage Search

## The Rabbit checks the time whenever Alice is watching

- **Question:** Find every time the White Rabbit checks his watch.
- **Found:** 3 instances in 2 files
- **Read:** 7 of 23 calls answered, over 7 of 22 files.
- **Model:** test/reader
- **Ended early:** Stopped before every call was answered.

## Analysis

### The watch as a prop

- He takes the watch out before he speaks. [#1, #3]
- Lateness is said aloud once. [#2]

## Labels

| Label | Instances | Files |
|---|---:|---:|
| Watch checked | 2 | 2 |
| Late \\| hurrying | 1 | 1 |

## Instances

### #1 · chapters/alice-ch1.md · line 12

**Watch checked**

> took a watch out of its waistcoat-pocket

_In context:_ …when the Rabbit actually […], and looked at it…

The Rabbit consults the watch and hurries on.

### #2 · chapters/alice-ch1.md · line 31

**Late | hurrying**

> "Oh dear! Oh dear!
> I shall be late!"

### #3 · Selected text · line 2 of the searched text

**Watch checked**

> looked at it, and then hurried on

_In context:_ …pocket, and […], Alice started…

A second look at the watch.

## What was left out

- 15 of 22 files were not searched.
- 1 of 22 files was searched only in part.
- 2 calls were stopped in flight, so the text they cover was not searched; they may still have been charged.
- 13 calls were not made, so the text they cover was not searched.
- 1 call failed, so the text it covers was not searched.
- 1 reply was cut off at the length limit; the instances finished before the cut are kept.
- 1 quote could not be found in the text as quoted, so it is not listed.
- 2 quotes matched more than one place, so they are not listed.
- 1 repeat of a moment already listed was merged into it.
- 1 claim in the analysis was left out: it cited no instance here, or quoted one wrongly.
- 1 file left out: not readable as text.
"
`);
  });

  it('uses the host\'s own headline when there is no analysis, and says when nothing was found', () => {
    const { analysis: _analysis, endedMessage: _ended, leftOutMessage: _leftOut, ...plain } = RESULT;
    const report = formatPassageSearchReport({
      ...plain,
      instances: [],
      labels: [],
      analysisMissing: 'failed',
      ended: 'complete',
      dropped: { 'quote-not-found': 0, 'quote-ambiguous': 0, malformed: 0, duplicate: 0 },
      calls: { planned: 23, answered: 23, failed: 0, cut: 0, cancelled: 0, unsent: 0 },
      files: { planned: 22, searched: { full: 22, partial: 0, none: 0 }, withInstances: 0, leftOut: { unreadable: 0, unsplittable: 0, empty: 0 } }
    });
    expect(report).toContain('## No instances found in 22 files.');
    expect(report).toContain('_The results were not organized: the organizing call failed. The list below is whole._');
    expect(report).toContain('## Instances\n\nNone.');
    expect(report).not.toContain('## Labels');
    expect(report).not.toContain('## What was left out');
    expect(report).not.toContain('Ended early');
  });
});
