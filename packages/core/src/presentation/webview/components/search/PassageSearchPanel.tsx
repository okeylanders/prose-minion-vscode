/**
 * PassageSearchPanel - the Search tab's third subtab (ADR 2026-11-20 D15):
 * a search that reads. The writer chooses what to read and asks a question;
 * Estimate shows the calls and the approximate price; Run sends exactly
 * that; Stop keeps what was found.
 *
 * The panel owns no transport of its own but Copy and Save, which post the
 * report as every sidebar tool does. Everything else is `usePassageSearch`.
 */

import * as React from 'react';
import { MessageType } from '@messages';
import { Icon } from '@components/shared/Icon';
import { PassageSearchScopeControls } from '@components/search/passage/PassageSearchScopeControls';
import { PassageSearchResult } from '@components/search/passage/PassageSearchResult';
import { UsePassageSearchReturn } from '@hooks/domain/usePassageSearch';
import { formatPassageSearchReport } from '@shared/utils/passageSearchReport';
import {
  passageSearchEstimateDetails,
  passageSearchEstimateLine,
  passageSearchOrganizeEstimateLine,
  passageSearchOrganizeSample,
  passageSearchProgressLine
} from '@shared/utils/passageSearchWords';
import { passageSearchAnnouncement, passageSearchEstimateBlocked, passageSearchRunBlocked } from '@utils/passageSearchPanel';
import { VSCodeAPI } from '../../types/vscode';

interface PassageSearchPanelProps {
  vscode: VSCodeAPI;
  passageSearch: UsePassageSearchReturn;
}

const SOURCE = 'webview.search.passage';

export const PassageSearchPanel: React.FC<PassageSearchPanelProps> = ({ vscode, passageSearch }) => {
  const { question, scopes, organize, plan, run, result, runRefusal, organizeOffer, openRefusal } = passageSearch;
  const running = run.status === 'running';
  const estimateBlocked = passageSearchEstimateBlocked(passageSearch);
  const runBlocked = passageSearchRunBlocked(passageSearch);
  const announcement = passageSearchAnnouncement(passageSearch);

  const pressEstimate = React.useCallback(() => {
    if (!estimateBlocked) {
      passageSearch.requestEstimate();
    }
  }, [estimateBlocked, passageSearch.requestEstimate]);

  const pressRun = React.useCallback(() => {
    if (!runBlocked) {
      passageSearch.runSearch();
    }
  }, [runBlocked, passageSearch.runSearch]);

  const postReport = React.useCallback((type: MessageType.COPY_RESULT | MessageType.SAVE_RESULT) => {
    if (!result) {
      return;
    }
    vscode.postMessage({
      type,
      source: SOURCE,
      payload: {
        toolName: 'passage_search',
        content: formatPassageSearchReport(result),
        ...(type === MessageType.SAVE_RESULT ? { metadata: { timestamp: Date.now() } } : {})
      },
      timestamp: Date.now()
    });
  }, [result, vscode]);

  return (
    <>
      <PassageSearchScopeControls
        scopes={scopes}
        onActiveFile={passageSearch.setActiveFileScope}
        onSelection={passageSearch.setSelectionScope}
        onGroup={passageSearch.setGroupScope}
        onPattern={passageSearch.setPatternScope}
      />

      <div className="input-container">
        <label className="block text-sm font-medium mb-2" htmlFor="pm-ps-question">Question</label>
        <span className="text-xs text-gray-500 block mb-1" id="pm-ps-question-hint">
          Describe the moments to find. A model reads the text, so this can be a gesture, a habit or a kind of line, not only a word.
        </span>
        <textarea
          id="pm-ps-question"
          className="w-full"
          rows={3}
          value={question}
          onChange={(event) => passageSearch.setQuestion(event.target.value)}
          placeholder="e.g., Find every time the White Rabbit checks his watch"
          aria-describedby="pm-ps-question-hint"
        />

        <label className="pm-ps-check mt-3">
          <input type="checkbox" checked={organize} onChange={(event) => passageSearch.setOrganize(event.target.checked)} />
          <span>Organize the results (one more call that reads what was found)</span>
        </label>

        <div className="pm-ps-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={pressEstimate}
            aria-disabled={estimateBlocked !== undefined}
            aria-describedby={estimateBlocked ? 'pm-ps-estimate-reason' : undefined}
          >
            Estimate
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={pressRun}
            aria-disabled={runBlocked !== undefined}
            aria-describedby={runBlocked ? 'pm-ps-run-reason' : 'pm-ps-estimate-line'}
          >
            Run
          </button>
          {running && (
            <button type="button" className="btn btn-secondary" onClick={passageSearch.stopSearch} aria-disabled={run.stopping}>
              Stop
            </button>
          )}
        </div>
        {estimateBlocked && <p className="pm-ps-reason" id="pm-ps-estimate-reason">{estimateBlocked}</p>}
        {!estimateBlocked && runBlocked && <p className="pm-ps-reason" id="pm-ps-run-reason">{runBlocked}</p>}
        {estimateBlocked && runBlocked && <span className="pm-ps-sr" id="pm-ps-run-reason">{runBlocked}</span>}

        {plan.status === 'planned' && (
          <div className="pm-ps-estimate">
            <p className="pm-ps-estimate-line" id="pm-ps-estimate-line">{passageSearchEstimateLine(plan.estimate)}</p>
            {passageSearchEstimateDetails(plan.estimate).map((line) => (
              <p className="pm-ps-meta" key={line}>{line}</p>
            ))}
          </div>
        )}
        {plan.status === 'refused' && <p className="pm-ps-refusal">{plan.message}</p>}
        {runRefusal && <p className="pm-ps-refusal">{runRefusal}</p>}
      </div>

      {/* One polite line for assistive technology: progress while running, then the outcome. */}
      <div className="pm-ps-sr" role="status" aria-live="polite">{announcement}</div>

      {running && (
        <div className="pm-ps-progress" aria-hidden="true">
          <span className="pm-ps-spinner" />
          <span>
            {run.stopping
              ? 'Stopping…'
              : run.kind === 'organize'
                ? 'Organizing the results…'
                : run.progress ? passageSearchProgressLine(run.progress) : 'Starting the search…'}
          </span>
        </div>
      )}

      {result && !running && (
        <div className="result-box">
          <div className="result-action-bar">
            <button className="icon-button" onClick={() => postReport(MessageType.COPY_RESULT)} title="Copy passage search report" aria-label="Copy passage search report">
              <Icon name="copy" size={14} />
            </button>
            <button className="icon-button" onClick={() => postReport(MessageType.SAVE_RESULT)} title="Save passage search report" aria-label="Save passage search report">
              <Icon name="save" size={14} />
            </button>
          </div>

          {result.canOrganize && organize && (
            <div className="pm-ps-organize">
              {organizeOffer.status === 'planned' ? (
                <>
                  <p className="pm-ps-estimate-line">{passageSearchOrganizeEstimateLine(organizeOffer.estimate)}</p>
                  {passageSearchOrganizeSample(organizeOffer.estimate.instances) && (
                    <p className="pm-ps-meta">{passageSearchOrganizeSample(organizeOffer.estimate.instances)}</p>
                  )}
                  <button type="button" className="btn btn-primary" onClick={passageSearch.runOrganize}>Organize</button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={organizeOffer.status === 'estimating' ? undefined : passageSearch.requestOrganizeEstimate}
                  aria-disabled={organizeOffer.status === 'estimating'}
                >
                  {organizeOffer.status === 'estimating' ? 'Estimating…' : 'Organize these results'}
                </button>
              )}
              {organizeOffer.status === 'refused' && <p className="pm-ps-refusal">{organizeOffer.message}</p>}
            </div>
          )}

          {openRefusal && <p className="pm-ps-refusal" role="alert">{openRefusal}</p>}
          <PassageSearchResult result={result} onOpen={passageSearch.openInstance} />
        </div>
      )}

      {!result && !running && plan.status === 'none' && !runRefusal && (
        <div className="placeholder-content text-gray-500">
          No results yet. Choose what to read, ask a question, then Estimate and Run.
        </div>
      )}
    </>
  );
};
