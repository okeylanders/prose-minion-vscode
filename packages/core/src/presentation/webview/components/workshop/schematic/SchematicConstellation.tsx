/**
 * Lexical gravity (panel 06) — noun neighborhoods held close, anti-vocabulary
 * drifting away, and the verb/adjective/analogy gradients. Ported from
 * `constellation()` in docs/design/Prose Minion - Persona Schematic.html.
 * Renders panel INNER content; the view wraps it in <Panel num={6}>.
 */

import * as React from 'react';
import type { PersonaSchematic } from '@/shared/personas/personaSchematic';
import { GradientTrack } from './SchematicParts';

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const W = 880;
const H = 310;
const CX = W / 2;
const CY = H / 2 - 6;
const GOLDEN = 137.5;

export const SchematicConstellation: React.FC<{ gravity: PersonaSchematic['gravity'] }> = ({ gravity }) => {
  const nouns = gravity.nouns.map((word, i) => {
    const ang = (i * GOLDEN) * Math.PI / 180;
    const rad = 64 + (i % 3) * 30;
    return {
      word,
      x: CX + rad * Math.cos(ang) * 1.9,
      y: CY + rad * Math.sin(ang) * 0.62,
      opacity: 0.95 - (i % 3) * 0.14
    };
  });

  const anti = gravity.anti.map((word, i) => {
    const ang = ((i * GOLDEN) + 64) * Math.PI / 180;
    const rad = 132 + (i % 2) * 22;
    const x = CX + rad * Math.cos(ang) * 2.6;
    const y = CY + rad * Math.sin(ang) * 0.78;
    return {
      word,
      x: Math.min(W - 14, Math.max(14, x)),
      y: Math.min(H - 8, Math.max(12, y)),
      dx: (Math.cos(ang) * 7).toFixed(1),
      dy: (Math.sin(ang) * 5).toFixed(1),
      ad: (i * 0.55).toFixed(2)
    };
  });

  return (
    <>
      <div className="constel">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <circle cx={CX} cy={CY} r="13" fill="var(--pa)" fillOpacity=".22" stroke="var(--pa)" strokeWidth="1.4" className="br1" />
          <circle cx={CX} cy={CY} r="24" fill="none" stroke="var(--pa)" strokeOpacity=".3" strokeWidth="1" className="br2" />
          {nouns.map((n, i) => (
            <text key={`n-${i}`} x={n.x.toFixed(0)} y={n.y.toFixed(0)} fontSize="12" fill="var(--pa-hi)" fillOpacity={n.opacity.toFixed(2)} textAnchor="middle">{n.word}</text>
          ))}
          {anti.map((a, i) => (
            <text
              key={`a-${i}`}
              className="anti-w"
              style={{ ['--dx']: `${a.dx}px`, ['--dy']: `${a.dy}px`, ['--ad']: `${a.ad}s` } as CSSVars}
              x={a.x.toFixed(0)}
              y={a.y.toFixed(0)}
              fontSize="11"
              fontStyle="italic"
              fill="rgba(243,236,225,.32)"
              textAnchor="middle"
            >
              {a.word}
            </text>
          ))}
        </svg>
      </div>
      <div className="legend">
        <span className="l1"><i />Noun neighborhoods — strong gravity, held close</span>
        <span className="l2"><i />Weak gravity — anti-vocabulary, drifting away</span>
      </div>
      {gravity.nounNote && (
        <p className="pnote"><b>Note:</b> {gravity.nounNote}</p>
      )}
      <div style={{ marginTop: 10 }}>
        <div className="ax">
          <span className="ax-name">Verb gradient</span>
          <GradientTrack stops={gravity.verb.stops} def={gravity.verb.default} farNote="needs a real collision to unlock" locked />
          {gravity.verb.note && <span className="ax-note">{gravity.verb.note}</span>}
        </div>
        <div className="ax">
          <span className="ax-name">Adjective gradient</span>
          <GradientTrack stops={gravity.adj.stops} def={gravity.adj.default} farNote="needs a real collision to unlock" locked />
          {gravity.adj.note && <span className="ax-note">{gravity.adj.note}</span>}
        </div>
        <div className="ax">
          <span className="ax-name">Analogy palette</span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: 1.55, paddingTop: 4 }}>{gravity.analogy}</span>
        </div>
      </div>
    </>
  );
};
