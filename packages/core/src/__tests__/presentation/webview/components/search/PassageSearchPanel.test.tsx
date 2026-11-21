/** @jest-environment jsdom */

/**
 * The Passage Search panel (ADR 2026-11-20 D15): the scope controls, the
 * estimate line's variants, Run and Stop, the result's sections and endings,
 * and controls that stay focusable and say why they cannot act.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { PassageSearchPanel } from '@components/search/PassageSearchPanel';
import { SearchTab } from '@components/tabs/SearchTab';
import { PassageSearchState, usePassageSearch, UsePassageSearchReturn } from '@hooks/domain/usePassageSearch';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { MessageType, PassageSearchEstimateView, PassageSearchResultView } from '@messages';
import { passageSearchAnnouncement, passageSearchEstimateBlocked, passageSearchRunBlocked } from '@utils/passageSearchPanel';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { ESTIMATE, RESULT } from '@/__tests__/shared/utils/passageSearchViewFixtures';

jest.mock('@hooks/useVSCodeApi');

const QUESTION = 'Find every time the White Rabbit checks his watch.';
const checked = (element: HTMLElement): boolean => (element as HTMLInputElement).checked;
/** The text a control is described by, as assistive technology reads it. */
const described = (element: HTMLElement): string | undefined =>
  document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent ?? undefined;

describe('PassageSearchPanel', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  let hook: UsePassageSearchReturn;

  // eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
  function Harness() {
    hook = usePassageSearch();
    return <PassageSearchPanel passageSearch={hook} />;
  }

  const sent = (type: MessageType): Array<Record<string, any>> =>
    vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type).map((message) => message.payload);
  const answer = (type: MessageType, payload: unknown) => ({ type, source: 'extension.search.passage', payload, timestamp: 1 }) as never;
  const button = (name: string | RegExp) => screen.getByRole('button', { name });
  const ask = () => fireEvent.change(screen.getByLabelText('Question'), { target: { value: QUESTION } });

  const estimate = (view: PassageSearchEstimateView = ESTIMATE) => {
    ask();
    fireEvent.click(button('Estimate'));
    const requestId = sent(MessageType.PASSAGE_SEARCH_PLAN_REQUEST).slice(-1)[0].requestId;
    act(() => hook.handlePlan(answer(MessageType.PASSAGE_SEARCH_PLAN, { requestId, status: 'planned', planId: 'plan-1', estimate: view })));
  };
  const run = (): string => {
    estimate();
    fireEvent.click(button('Run'));
    return sent(MessageType.PASSAGE_SEARCH_RUN).slice(-1)[0].requestId;
  };
  const finish = (result: PassageSearchResultView = RESULT) => {
    const requestId = run();
    act(() => hook.handleResult(answer(MessageType.PASSAGE_SEARCH_RESULT, { requestId, status: 'finished', result })));
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    render(<Harness />);
  });

  describe('scopes and the question', () => {
    it('offers the active file, the selection, a checkbox per context group and a pattern field', () => {
      expect(checked(screen.getByRole('checkbox', { name: 'Active file' }))).toBe(true);
      expect(checked(screen.getByRole('checkbox', { name: 'Selection' }))).toBe(false);
      const groups = within(screen.getByRole('group', { name: /Context groups/ })).getAllByRole('checkbox');
      expect(groups.map((box) => box.parentElement?.textContent)).toEqual([
        'Characters', 'Locations & Settings', 'Themes', 'Things / Props',
        'Draft Chapters & Outlines', 'Manuscript Chapters', 'Project Brief Materials', 'General References'
      ]);
      expect((screen.getByLabelText('Paths or patterns') as HTMLTextAreaElement).value).toBe('');
      expect(checked(screen.getByRole('checkbox', { name: /Organize the results/ }))).toBe(true);
    });

    it('sends several scopes at once with the question', () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Selection' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Manuscript Chapters' }));
      fireEvent.change(screen.getByLabelText('Paths or patterns'), { target: { value: 'drafts/*.md' } });
      ask();
      fireEvent.click(button('Estimate'));
      expect(sent(MessageType.PASSAGE_SEARCH_PLAN_REQUEST)).toEqual([{
        requestId: expect.any(String),
        question: QUESTION,
        scopes: { activeFile: true, selection: true, groups: ['manuscript'], pattern: 'drafts/*.md' },
        organize: true
      }]);
    });
  });

  describe('controls that cannot act', () => {
    it('stay focusable, say why, and send nothing', () => {
      const estimateButton = button('Estimate');
      const runButton = button('Run');
      expect((estimateButton as HTMLButtonElement).disabled).toBe(false);
      expect(estimateButton.getAttribute('aria-disabled')).toBe('true');
      expect(described(estimateButton)).toBe('Ask a question to search for first.');
      expect(runButton.getAttribute('aria-disabled')).toBe('true');
      expect(described(runButton)).toBe('Estimate the search first. Run sends exactly what was estimated.');
      fireEvent.click(estimateButton);
      fireEvent.click(runButton);
      expect(vscode.postMessage).not.toHaveBeenCalled();
    });

    it('name the missing scope once a question is asked', () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Active file' }));
      ask();
      expect(described(button('Estimate'))).toBe('Choose something to search first.');
    });

    it('give their reasons as pure rules', () => {
      const base: Pick<PassageSearchState, 'question' | 'scopes' | 'plan' | 'run'> = {
        question: QUESTION, scopes: { activeFile: true, selection: false, groups: [], pattern: '' }, plan: { status: 'none' }, run: { status: 'idle' }
      };
      expect(passageSearchEstimateBlocked(base)).toBeUndefined();
      expect(passageSearchEstimateBlocked({ ...base, scopes: { ...base.scopes, activeFile: false, pattern: '  ' } })).toBe('Choose something to search first.');
      expect(passageSearchEstimateBlocked({ ...base, run: { status: 'running', kind: 'search', stopping: false } })).toContain('A search is running.');
      expect(passageSearchRunBlocked(base)).toContain('Estimate the search first.');
      expect(passageSearchRunBlocked({ ...base, plan: { status: 'planned', planId: 'plan-1', estimate: ESTIMATE } })).toBeUndefined();
    });
  });

  describe('the estimate line', () => {
    it('shows calls, the approximate price and the model, and lets Run go ahead', () => {
      estimate();
      expect(screen.getByText('23 calls · ≈ $0.42 · test/reader')).toBeTruthy();
      expect(screen.getByText('22 files to read. The price is an estimate, not a limit.')).toBeTruthy();
      expect(button('Run').getAttribute('aria-disabled')).toBe('false');
      expect(described(button('Run'))).toBe('23 calls · ≈ $0.42 · test/reader');
    });

    it('says "price unavailable" beside the count with no live price', () => {
      const { usd: _usd, ...unpriced } = ESTIMATE;
      estimate(unpriced);
      expect(screen.getByText('23 calls · price unavailable · test/reader')).toBeTruthy();
    });

    it('says when it includes an allowance for organizing, and the files left out', () => {
      estimate({ ...ESTIMATE, organizeAllowance: true, leftOutMessage: '1 file left out: it has no place to split.' });
      expect(screen.getByText('It includes an allowance for organizing the results.')).toBeTruthy();
      expect(screen.getByText('1 file left out: it has no place to split.')).toBeTruthy();
    });

    it('shows a refusal in the host\'s words', () => {
      ask();
      fireEvent.click(button('Estimate'));
      const requestId = sent(MessageType.PASSAGE_SEARCH_PLAN_REQUEST)[0].requestId;
      act(() => hook.handlePlan(answer(MessageType.PASSAGE_SEARCH_PLAN, { requestId, status: 'refused', reason: 'no-active-file', message: 'No saved file is open in the editor.' })));
      expect(screen.getAllByText('No saved file is open in the editor.').length).toBeGreaterThan(0);
      expect(button('Run').getAttribute('aria-disabled')).toBe('true');
    });

    it('goes away when the question changes', () => {
      estimate();
      fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Where does the Cheshire Cat grin?' } });
      expect(screen.queryByText('23 calls · ≈ $0.42 · test/reader')).toBeNull();
      expect(button('Run').getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('a run', () => {
    it('shows progress in a live region, and Stop', () => {
      const requestId = run();
      expect(screen.getByRole('status').textContent).toContain('Starting the search…');
      act(() => hook.handleProgress(answer(MessageType.PASSAGE_SEARCH_PROGRESS, { requestId, calls: { planned: 23, done: 7 }, found: 5 })));
      expect(screen.getByRole('status').textContent).toContain('Reading 7 of 23 · 5 found');

      fireEvent.click(button('Stop'));
      expect(sent(MessageType.PASSAGE_SEARCH_STOP)).toEqual([{ requestId }]);
      expect(screen.getByRole('status').textContent).toContain('Stopping…');
      expect(described(button('Estimate'))).toBe('A search is running. Stop it, or wait for it to finish.');
    });

    it('announces the outcome, with how the run ended', () => {
      finish();
      expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
      expect(screen.getByRole('status').textContent).toContain('3 instances in 2 files. Stopped before every call was answered.');
    });

    it('shows a refused Run in the host\'s words', () => {
      const requestId = run();
      act(() => hook.handleResult(answer(MessageType.PASSAGE_SEARCH_RESULT, { requestId, status: 'refused', reason: 'plan-expired', message: 'That estimate is no longer current, so nothing was sent.' })));
      expect(screen.getAllByText('That estimate is no longer current, so nothing was sent.').length).toBeGreaterThan(0);
    });
  });

  describe('the result', () => {
    it('shows the headline, the analysis, the label table, every instance and what was left out', () => {
      finish();
      expect(screen.getByRole('heading', { name: 'The Rabbit checks the time whenever Alice is watching' })).toBeTruthy();
      expect(screen.getByText('Stopped before every call was answered.')).toBeTruthy();

      const analysis = screen.getByRole('region', { name: 'Analysis' });
      expect(within(analysis).getByRole('heading', { name: 'The watch as a prop' })).toBeTruthy();
      expect(within(analysis).getByText(/He takes the watch out before he speaks\./)).toBeTruthy();
      expect(within(analysis).getAllByRole('button').map((cite) => cite.textContent)).toEqual(['#1', '#3', '#2']);

      const rows = within(screen.getByRole('table', { name: /Labels/ })).getAllByRole('row').map((row) => row.textContent);
      expect(rows).toEqual(['LabelInstancesFiles', 'Watch checked22', 'Late | hurrying11']);

      const instances = within(screen.getByRole('region', { name: 'Instances' })).getAllByRole('listitem');
      expect(instances).toHaveLength(3);
      expect(instances[0].textContent).toContain('when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it');
      expect(instances[0].textContent).toContain('The Rabbit consults the watch and hurries on.');
      expect(within(instances[0]).getByText('took a watch out of its waistcoat-pocket').tagName).toBe('MARK');

      const missing = within(screen.getByRole('region', { name: 'What was left out' })).getAllByRole('listitem').map((item) => item.textContent);
      expect(missing).toContain('15 of 22 files were not searched.');
      expect(missing).toContain('2 calls were stopped in flight, so the text they cover was not searched; they may still have been charged.');
      expect(missing).toContain('13 calls were not made, so the text they cover was not searched.');
      expect(missing).toContain('2 quotes matched more than one place, so they are not listed.');
    });

    it('opens an instance by its number, and offers no button for text with nothing to open', () => {
      finish();
      fireEvent.click(button('Open chapters/alice-ch1.md · line 31'));
      expect(sent(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE)).toEqual([{ requestId: expect.any(String), resultId: 'result-1', instance: 2 }]);
      expect(screen.queryByRole('button', { name: /Open Selected text/ })).toBeNull();
      expect(screen.getByText('Selected text · line 2 of the searched text')).toBeTruthy();
    });

    it('says why an instance could not be opened', () => {
      finish();
      fireEvent.click(button('Open chapters/alice-ch1.md · line 12'));
      const requestId = sent(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE)[0].requestId;
      act(() => hook.handleOpenInstanceResult(answer(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE_RESULT, { requestId, status: 'refused', message: 'The file could not be opened.' })));
      expect(screen.getByRole('alert').textContent).toContain('The file could not be opened.');
    });

    it('scrolls a cite to its instance and moves focus there', () => {
      finish();
      const target = document.getElementById('pm-ps-instance-3')!;
      target.scrollIntoView = jest.fn();
      fireEvent.click(button('Show instance 3'));
      expect(target.scrollIntoView).toHaveBeenCalled();
      expect(document.activeElement).toBe(target);
    });

    it('uses the host\'s own headline with no analysis, and says why one is missing', () => {
      const { analysis: _analysis, ...plain } = RESULT;
      finish({ ...plain, analysisMissing: 'failed' });
      expect(screen.getByRole('heading', { name: '3 instances in 2 files' })).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Analysis' })).toBeNull();
      expect(screen.getByText('The results were not organized: the organizing call failed. The list below is whole.')).toBeTruthy();
    });

    it.each([
      ['key-changed', 'The API key changed during the search, so the remaining calls were not made.'],
      ['provider-failed', 'The provider refused 5 calls in a row, so the remaining calls were not made.'],
      ['instance-limit', 'The search reached 2,000 instances, the most it keeps, and stopped there.']
    ] as const)('shows a %s ending in the host\'s words', (ended, endedMessage) => {
      finish({ ...RESULT, ended, endedMessage });
      expect(screen.getByText(endedMessage)).toBeTruthy();
    });

    it('shows no ending line for a complete search, and says when nothing was found', () => {
      const { analysis: _analysis, endedMessage: _ended, ...plain } = RESULT;
      finish({ ...plain, ended: 'complete', instances: [], labels: [], files: { ...RESULT.files, searched: { full: 22, partial: 0, none: 0 }, withInstances: 0 } });
      expect(screen.getByRole('heading', { name: 'No instances found in 22 files.' })).toBeTruthy();
      expect(screen.queryByText('Stopped before every call was answered.')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Instances' })).toBeNull();
    });

    it('copies and saves by the result\'s id, sending no report text, and says how each ended', () => {
      finish();
      fireEvent.click(button('Copy passage search report'));
      const [copy] = sent(MessageType.PASSAGE_SEARCH_COPY_REPORT);
      expect(copy).toEqual({ requestId: expect.any(String), resultId: 'result-1' });
      act(() => hook.handleReportResult(answer(MessageType.PASSAGE_SEARCH_REPORT_RESULT, { requestId: copy.requestId, status: 'copied' })));
      expect(screen.getByText('Report copied.')).toBeTruthy();

      fireEvent.click(button('Save passage search report'));
      const [save] = sent(MessageType.PASSAGE_SEARCH_SAVE_REPORT);
      expect(save).toEqual({ requestId: expect.any(String), resultId: 'result-1' });
      act(() => hook.handleReportResult(answer(MessageType.PASSAGE_SEARCH_REPORT_RESULT, {
        requestId: save.requestId, status: 'saved', filePath: 'prose-minion/reports/passage-search-20261121-090507.md', opened: false
      })));
      expect(screen.getByText('Report saved to prose-minion/reports/passage-search-20261121-090507.md, but it could not be opened.')).toBeTruthy();

      expect(sent(MessageType.COPY_RESULT)).toEqual([]);
      expect(sent(MessageType.SAVE_RESULT)).toEqual([]);
      expect(JSON.stringify(vscode.postMessage.mock.calls.slice(-2))).not.toContain('waistcoat');
    });

    it('says in the host\'s words when a report could not be written', () => {
      finish();
      fireEvent.click(button('Save passage search report'));
      const requestId = sent(MessageType.PASSAGE_SEARCH_SAVE_REPORT)[0].requestId;
      act(() => hook.handleReportResult(answer(MessageType.PASSAGE_SEARCH_REPORT_RESULT, { requestId, status: 'refused', message: 'The report could not be saved.' })));
      expect(screen.getByText('The report could not be saved.')).toBeTruthy();
    });
  });

  describe('the question a result answers (PR #294)', () => {
    const QUESTION_B = 'Where does the Cheshire Cat grin?';
    const resultsFor = () => screen.getByText('Results for:').parentElement?.textContent;

    it('shows the result\'s own question when the field changed while the search ran', () => {
      const requestId = run();
      fireEvent.change(screen.getByLabelText('Question'), { target: { value: QUESTION_B } });
      act(() => hook.handleResult(answer(MessageType.PASSAGE_SEARCH_RESULT, { requestId, status: 'finished', result: RESULT })));

      expect((screen.getByLabelText('Question') as HTMLTextAreaElement).value).toBe(QUESTION_B);
      expect(resultsFor()).toBe(`Results for: ${QUESTION}`);
    });

    it('keeps showing the result\'s own question when the field is edited afterwards, and exports that result', () => {
      finish();
      fireEvent.change(screen.getByLabelText('Question'), { target: { value: QUESTION_B } });

      expect(resultsFor()).toBe(`Results for: ${QUESTION}`);
      expect(screen.getByRole('heading', { name: 'The Rabbit checks the time whenever Alice is watching' })).toBeTruthy();
      fireEvent.click(button('Copy passage search report'));
      expect(sent(MessageType.PASSAGE_SEARCH_COPY_REPORT)[0].resultId).toBe('result-1');
    });
  });

  describe('organize these results', () => {
    const organizeEstimate = { model: 'test/reader', calls: 1, inputTokens: 900, outputTokens: 1200, usd: 0.03, instances: { read: 400, of: 1240 } };

    it('is hidden when the host says the result cannot be organized', () => {
      finish();
      expect(screen.queryByRole('button', { name: 'Organize these results' })).toBeNull();
    });

    it('is hidden with the toggle off', () => {
      finish({ ...RESULT, canOrganize: true });
      expect(button('Organize these results')).toBeTruthy();
      fireEvent.click(screen.getByRole('checkbox', { name: /Organize the results/ }));
      expect(screen.queryByRole('button', { name: 'Organize these results' })).toBeNull();
    });

    it('shows its own price before the pass is made', () => {
      const { analysis: _analysis, ...plain } = RESULT;
      finish({ ...plain, canOrganize: true });
      fireEvent.click(button('Organize these results'));
      const [request] = sent(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST);
      expect(request).toEqual({ requestId: expect.any(String), resultId: 'result-1' });
      act(() => hook.handleOrganizePlan(answer(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN, {
        requestId: request.requestId, status: 'planned', resultId: 'result-1', organizePlanId: 'organize-1', estimate: organizeEstimate
      })));
      expect(screen.getByText('1 call · ≈ $0.03 · test/reader')).toBeTruthy();
      expect(screen.getByText('It would read 400 of 1,240 instances.')).toBeTruthy();
      expect(sent(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN)).toEqual([]);

      fireEvent.click(button('Organize'));
      expect(sent(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN)).toEqual([{ requestId: expect.any(String), resultId: 'result-1', organizePlanId: 'organize-1' }]);
      expect(screen.getByRole('status').textContent).toContain('Organizing the results…');
    });

    it('says in the host\'s words when the pass cannot be priced', () => {
      finish({ ...RESULT, canOrganize: true });
      fireEvent.click(button('Organize these results'));
      const requestId = sent(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST)[0].requestId;
      act(() => hook.handleOrganizePlan(answer(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN, {
        requestId, status: 'refused', reason: 'unavailable', message: 'Organizing the results is not available yet.'
      })));
      expect(screen.getByText('Organizing the results is not available yet.')).toBeTruthy();
    });
  });

  it('writes no announcement before anything is asked', () => {
    expect(screen.getByRole('status').textContent).toBe('');
    expect(passageSearchAnnouncement({
      question: '', scopes: { activeFile: true, selection: false, groups: [], pattern: '' },
      plan: { status: 'none' }, run: { status: 'idle' }, organizeOffer: { status: 'none' }
    })).toBe('');
  });
});

describe('SearchTab', () => {
  it('offers Passage Search as its third subtab', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    // eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
    function TabHarness() {
      const passageSearch = usePassageSearch();
      const metrics = { sourceMode: 'activeFile', pathText: '', setSourceMode: jest.fn(), setPathText: jest.fn() };
      const search = {
        searchResult: null, isLoading: false, wordSearchTargets: '', statusMessage: '', setWordSearchTargets: jest.fn(),
        categorySearch: { query: '', result: null, isLoading: false, error: null, relevance: 'focused', wordLimit: 50, ngramMode: 'words', minOccurrences: 2 }
      };
      const wordSearchSettings = { settings: { contextWords: 3, clusterWindow: 50, minClusterSize: 2, caseSensitive: false, enableAssistantExpansion: false }, updateSetting: jest.fn() };
      return (
        <SearchTab
          vscode={vscode}
          search={search as never}
          metrics={metrics as never}
          wordSearchSettings={wordSearchSettings as never}
          modelsSettings={{} as never}
          passageSearch={passageSearch}
        />
      );
    }
    render(<TabHarness />);
    const tabs = within(screen.getByRole('tablist', { name: 'Search tools' })).getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Word Search', 'Category Search', 'Passage Search']);
    fireEvent.click(screen.getByRole('tab', { name: 'Passage Search' }));
    expect(screen.getByLabelText('Question')).toBeTruthy();
  });
});
