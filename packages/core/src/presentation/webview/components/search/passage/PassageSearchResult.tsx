/**
 * A Passage Search result as drawn (ADR 2026-11-20 D11, D13, D15): the
 * headline, how the search ended, the analysis with its cites as buttons,
 * the host's label table, every instance, then what was left out and why.
 *
 * Posts nothing. An instance is opened by its number through `onOpen`; a
 * cite scrolls to its instance on this page.
 */

import * as React from 'react';
import type { PassageSearchInstanceView, PassageSearchResultView } from '@messages';
import {
  passageSearchAnalysisNote,
  passageSearchLocation,
  passageSearchMissingLines,
  passageSearchReadLine,
  passageSearchSummary
} from '@shared/utils/passageSearchWords';

interface PassageSearchResultProps {
  result: PassageSearchResultView;
  onOpen: (instance: number) => void;
}

const instanceElementId = (number: number): string => `pm-ps-instance-${number}`;

/** Bring a cited instance into view and move focus to it, so a keyboard reader lands there too. */
const showInstance = (number: number): void => {
  const element = document.getElementById(instanceElementId(number));
  if (!element) {
    return;
  }
  element.scrollIntoView?.({ block: 'center' });
  element.focus?.();
};

const Instance: React.FC<{ instance: PassageSearchInstanceView; onOpen: (instance: number) => void }> = ({ instance, onOpen }) => {
  const location = passageSearchLocation(instance);
  return (
    <li className="pm-ps-instance" id={instanceElementId(instance.number)} tabIndex={-1} aria-label={`Instance ${instance.number}, ${location}`}>
      <div className="pm-ps-instance-head">
        <span className="pm-ps-number">#{instance.number}</span>
        {instance.canOpen ? (
          <button
            type="button"
            className="pm-ps-link"
            onClick={() => onOpen(instance.number)}
            aria-label={`Open ${location}`}
            title="Open at this line"
          >
            {location}
          </button>
        ) : (
          <span className="pm-ps-location">{location}</span>
        )}
        <span className="pm-ps-label">{instance.label}</span>
      </div>
      <blockquote className="pm-ps-quote">
        {instance.before && <span className="pm-ps-context">{instance.before}</span>}
        <mark>{instance.quote}</mark>
        {instance.after && <span className="pm-ps-context">{instance.after}</span>}
      </blockquote>
      {instance.note && <p className="pm-ps-note">{instance.note}</p>}
    </li>
  );
};

export const PassageSearchResult: React.FC<PassageSearchResultProps> = ({ result, onOpen }) => {
  const numbers = React.useMemo(() => new Set(result.instances.map((instance) => instance.number)), [result.instances]);
  const analysisNote = passageSearchAnalysisNote(result);
  const missing = passageSearchMissingLines(result);

  return (
    <div className="pm-ps-result">
      <h3 className="pm-ps-headline">{result.analysis?.headline ?? passageSearchSummary(result)}</h3>
      <p className="pm-ps-meta">
        {result.analysis ? `${passageSearchSummary(result)}. ` : ''}
        {passageSearchReadLine(result)} Model: {result.model}
      </p>
      {result.endedMessage && <p className="pm-ps-ended">{result.endedMessage}</p>}

      {result.analysis && (
        <section aria-label="Analysis">
          {result.analysis.sections.map((section, sectionIndex) => (
            <div className="pm-ps-section" key={sectionIndex}>
              <h4>{section.title}</h4>
              <ul>
                {section.claims.map((claim, claimIndex) => (
                  <li key={claimIndex}>
                    {claim.text}{' '}
                    <span className="pm-ps-cites">
                      {claim.cites.map((cite) => (
                        <button
                          type="button"
                          className="pm-ps-cite"
                          key={cite}
                          onClick={() => showInstance(cite)}
                          aria-disabled={!numbers.has(cite)}
                          aria-label={`Show instance ${cite}`}
                        >
                          #{cite}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      {analysisNote && <p className="pm-ps-meta">{analysisNote}</p>}

      {result.labels.length > 0 && (
        <table className="pm-ps-labels">
          <caption>Labels, counted by Prose Minion</caption>
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Instances</th>
              <th scope="col">Files</th>
            </tr>
          </thead>
          <tbody>
            {result.labels.map((label) => (
              <tr key={label.label}>
                <th scope="row">{label.label}</th>
                <td>{label.count}</td>
                <td>{label.files}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result.instances.length > 0 && (
        <section aria-label="Instances">
          <h4>Instances</h4>
          <ol className="pm-ps-instances">
            {result.instances.map((instance) => (
              <Instance key={instance.number} instance={instance} onOpen={onOpen} />
            ))}
          </ol>
        </section>
      )}

      {missing.length > 0 && (
        <section aria-label="What was left out" className="pm-ps-missing">
          <h4>What was left out</h4>
          <ul>
            {missing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
