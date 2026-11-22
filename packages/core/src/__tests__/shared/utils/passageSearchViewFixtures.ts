/**
 * A display-safe Passage Search estimate and result, in *Alice*-style text,
 * for the words, the report, the hook and the panel tests.
 */

import type { PassageSearchEstimateView, PassageSearchResultView } from '@messages';

export const ESTIMATE: PassageSearchEstimateView = {
  model: 'test/reader',
  files: 22,
  calls: 23,
  inputTokens: 90000,
  outputTokens: 18400,
  usd: 0.42,
  organizeAllowance: false,
  leftOut: { unreadable: 0, unsplittable: 0, empty: 0 }
};

export const RESULT: PassageSearchResultView = {
  resultId: 'result-1',
  question: 'Find every time the White Rabbit checks his watch.',
  model: 'test/reader',
  instances: [
    {
      number: 1,
      file: 'chapters/alice-ch1.md',
      line: 12,
      lines: 'document',
      canOpen: true,
      quote: 'took a watch out of its waistcoat-pocket',
      before: 'when the Rabbit actually ',
      after: ', and looked at it',
      note: 'The Rabbit consults the watch and hurries on.',
      label: 'Watch checked'
    },
    {
      number: 2,
      file: 'chapters/alice-ch1.md',
      line: 31,
      lines: 'document',
      canOpen: true,
      quote: '"Oh dear! Oh dear!\nI shall be late!"',
      before: '',
      after: '',
      note: '',
      label: 'Late | hurrying'
    },
    {
      number: 3,
      file: 'Selected text',
      line: 2,
      lines: 'text',
      canOpen: false,
      quote: 'looked at it, and then hurried on',
      before: 'pocket, and ',
      after: ', Alice started',
      note: 'A second look at the watch.',
      label: 'Watch checked'
    }
  ],
  labels: [
    { label: 'Watch checked', count: 2, files: 2 },
    { label: 'Late | hurrying', count: 1, files: 1 }
  ],
  analysis: {
    headline: 'The Rabbit checks the time whenever Alice is watching',
    sections: [
      {
        title: 'The watch as a prop',
        claims: [
          { text: 'He takes the watch out before he speaks.', cites: [1, 3] },
          { text: 'Lateness is said aloud once.', cites: [2] }
        ]
      }
    ],
    read: { instances: 3, of: 3 },
    dropped: { claims: 1, uncited: 0, misquoted: 1, malformed: 0, sections: 0, cites: 0 },
    replaced: { headline: false, titles: 0 },
    clipped: 0
  },
  dropped: { 'quote-not-found': 1, 'quote-ambiguous': 2, malformed: 0, duplicate: 1 },
  overLimit: 0,
  calls: { planned: 23, answered: 7, failed: 1, cut: 1, cancelled: 2, unsent: 13 },
  files: { planned: 22, searched: { full: 6, partial: 1, none: 15 }, withInstances: 2, leftOut: { unreadable: 1, unsplittable: 0, empty: 0 } },
  ended: 'stopped',
  endedMessage: 'Stopped before every call was answered.',
  leftOutMessage: '1 file left out: not readable as text.',
  canOrganize: false
};
