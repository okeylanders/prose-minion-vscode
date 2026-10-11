/**
 * The deterministic seven-dimension tradeoff readout and the shared
 * vocabulary line (Sprint 05, Locked decisions).
 *
 * Four segments per bar, one accent colour, no model call. A bar is a level of
 * emphasis, never a score: there is no total, no rank, and no good/bad
 * colour. The vocabulary line maps the local position onto Prose Controller's
 * three narrative-handling values through the one shared constant.
 */

import * as React from 'react';
import {
  NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION,
  NARRATIVE_HANDLING_SHOW_TELL_LABELS,
  type NarrativeHandlingPosition
} from '@shared/constants/narrativeHandlingVocabulary';
import {
  SHOW_VS_TELL_READOUT,
  SHOW_VS_TELL_READOUT_CAPTION,
  SHOW_VS_TELL_READOUT_SEGMENTS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';

export interface ShowVsTellReadoutProps {
  position: NarrativeHandlingPosition;
}

const SEGMENTS = Array.from({ length: SHOW_VS_TELL_READOUT_SEGMENTS }, (_, index) => index);

export const ShowVsTellReadout: React.FC<ShowVsTellReadoutProps> = ({ position }) => {
  const lever = NARRATIVE_HANDLING_SHOW_TELL_LABELS[
    NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION[position]
  ];
  return (
    <>
      <table className="pm-ws-svt-readout">
        <caption className="pm-ws-svt-visually-hidden">Tradeoff readout for this position</caption>
        <tbody>
          {SHOW_VS_TELL_READOUT.map((dimension) => {
            const level = dimension.levels[position];
            return (
              <tr key={dimension.label}>
                <th scope="row">{dimension.label}</th>
                <td>
                  <span
                    className="pm-ws-svt-bars"
                    role="img"
                    aria-label={`${level} of ${SHOW_VS_TELL_READOUT_SEGMENTS}`}
                  >
                    {SEGMENTS.map((segment) => (
                      <i
                        key={segment}
                        className={segment < level ? 'pm-ws-svt-bar-on' : undefined}
                      />
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="pm-ws-svt-readout-cap">{SHOW_VS_TELL_READOUT_CAPTION}</p>
      <p className="pm-ws-svt-vocab">
        shared vocabulary → Prose Controller ch. 06 <i>narrative handling</i> · show : tell ={' '}
        <b>{lever}</b>
      </p>
    </>
  );
};
