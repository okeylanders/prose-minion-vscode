/**
 * Shared presentational primitives for the persona schematic — pure, stateless
 * building blocks ported from the render helpers in
 * docs/design/Prose Minion - Persona Schematic.html. No data-fetching, no
 * webview messaging: they render the `PersonaSchematic` view-model only.
 */

import * as React from 'react';
import { SCHEMATIC_CATEGORIES } from './personaSchematicChrome';

/** CSS custom properties don't exist on React.CSSProperties; this narrows the cast. */
type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/** The dashed, not-yet-wired lock used by every `edit` affordance. */
export const LockGlyph: React.FC = () => (
  <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <rect x="1.5" y="4.2" width="7" height="4.6" rx="1" stroke="currentColor" />
    <path d="M3.2 4V3a1.8 1.8 0 013.6 0v1" stroke="currentColor" />
  </svg>
);

/** Per-field dashed `edit` chip — marks where the future config utility attaches. */
export const EditHint: React.FC = () => (
  <span
    className="edit-hint"
    title="Inline editing arrives with the persona config utility — every field here is a bindable unit"
  >
    <LockGlyph /> edit
  </span>
);

interface PanelProps {
  num: number;
  flash?: boolean;
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/** A numbered schematic section. `id="sec-N"` is the hub navigation target. */
export const Panel: React.FC<PanelProps> = ({ num, flash, extra, children }) => (
  <section className={`panel${flash ? ' flash' : ''}`} id={`sec-${num}`}>
    <div className="ph">
      <span className="num">{`0${num}`}</span>
      <span className="t">{SCHEMATIC_CATEGORIES[num]}</span>
      <hr />
      {extra}
      <EditHint />
    </div>
    {children}
  </section>
);

interface GradientTrackProps {
  stops: string[];
  /** Index of the resting detent. */
  def: number;
  /** Render the far stop as a red-ringed overreach ceiling. */
  ceil?: boolean;
  /** Label shown under a governed far stop. */
  farNote?: string;
  /** Padlock the far stop (closed for this persona). */
  locked?: boolean;
}

/** A default → mid → far detent track (lexical gravity, comm, trait pressure). */
export const GradientTrack: React.FC<GradientTrackProps> = ({ stops, def, ceil, farNote, locked }) => {
  const n = stops.length;
  return (
    <div className="trk" style={{ ['--n']: 3 } as CSSVars}>
      {stops.map((stop, i) => {
        const far = i === n - 1 && i !== def;
        const cls = [
          'stop',
          i === def ? 'def' : '',
          far ? 'far' : '',
          far && ceil ? 'ceil' : '',
          n === 2 && i === 1 ? 'span2' : ''
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <span className={cls} key={i}>
            <i />
            <span className="stl">{stop}</span>
            {far && farNote && (
              <span className={`farnote${locked ? ' locked' : ''}`}>
                {locked && <LockGlyph />}
                {farNote}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};

/** The trait-tension gauge: needle resting at strength, tipping into shadow under trigger. */
export const Gauge: React.FC<{ index: number }> = ({ index }) => {
  const delay = { ['--d']: `${index * 1.7}s` } as CSSVars;
  return (
    <svg className="tg-svg" viewBox="0 0 300 128" aria-hidden="true">
      <path d="M64.1 81.7 A88 88 0 0 1 235.9 81.7" fill="none" stroke="rgba(243,236,225,.16)" strokeWidth="2" />
      <path className="tg-zone" style={delay} d="M187.2 20.2 A88 88 0 0 1 226.2 56" fill="none" stroke="var(--shadowc)" strokeWidth="7" strokeLinecap="round" />
      <line x1="240.2" y1="67.2" x2="225.2" y2="72.6" stroke="var(--red)" strokeWidth="2.5" />
      <text x="250" y="64" fontSize="7.5" fill="var(--red)" letterSpacing="1">LIMIT</text>
      <path d="M110 88 q-5 -7 2 -10 q7 -3 2 -10 q-5 -7 2 -10" fill="none" stroke="var(--green)" strokeWidth="1.4" opacity=".75" />
      <text x="98" y="44" fontSize="7.5" fill="var(--green)" letterSpacing="1" textAnchor="middle">REGULATOR</text>
      <g className="tg-needle" style={{ transformOrigin: '150px 100px', ['--d']: `${index * 1.7}s` } as CSSVars}>
        <line x1="150" y1="100" x2="150" y2="26" stroke="var(--pa)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="150" cy="100" r="5" fill="var(--pa)" />
      </g>
      <text x="56" y="106" fontSize="8" fill="var(--pa)" letterSpacing="1.5">STRENGTH</text>
      <text x="212" y="106" fontSize="8" fill="var(--shadowc)" letterSpacing="1.5">SHADOW</text>
      <text x="150" y="124" fontSize="7.5" fill="rgba(243,236,225,.3)" letterSpacing="1" textAnchor="middle">RESTS AT STRENGTH · TIPS UNDER TRIGGER</text>
    </svg>
  );
};

/** The aperture iris — outer ring + dashed boundary + a fill sized to `openness`. */
export const ApertureDial: React.FC<{ openness: number }> = ({ openness }) => {
  const R = 34;
  const inner = Math.max(5, R * openness * 0.9);
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={R + 5} fill="none" stroke="rgba(243,236,225,.12)" strokeWidth="1.5" />
      <circle cx="44" cy="44" r={R} fill="none" stroke="var(--pa)" strokeOpacity=".55" strokeWidth="1.5" strokeDasharray="4 5" />
      <circle className="br2" cx="44" cy="44" r={inner} fill="var(--pa)" fillOpacity=".16" stroke="var(--pa)" strokeWidth="1.5" />
      <text x="44" y="83" fontSize="7.5" fill="rgba(243,236,225,.35)" letterSpacing="1.5" textAnchor="middle">APERTURE</text>
    </svg>
  );
};
