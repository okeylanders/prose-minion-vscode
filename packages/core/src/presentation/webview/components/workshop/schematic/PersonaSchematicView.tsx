/**
 * PersonaSchematicView — the read-only persona configuration schematic
 * (State B). Assembles the identity hub + nine panels from a `PersonaSchematic`
 * and the persona catalog, and owns hub → panel scroll/flash navigation.
 * Ported from the assembly + navigation logic in
 * docs/design/Prose Minion - Persona Schematic.html.
 */

import * as React from 'react';
import type { WorkshopPersonaId } from '@messages';
import { getWorkshopPersona } from '@shared/constants/workshopPersonas';
import { getPersonaSchematic } from '@/shared/personas/personaSchematics';
import { schematicAccentVars } from './personaSchematicChrome';
import { ApertureDial, GradientTrack, Gauge, LockGlyph, Panel } from './SchematicParts';
import { SchematicHub } from './SchematicHub';
import { SchematicConstellation } from './SchematicConstellation';

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const TENSION_FIELDS = [
  ['strength', 'Strength'],
  ['shadow', 'Shadow'],
  ['trigger', 'Trigger'],
  ['observable', 'Observable'],
  ['regulator', 'Regulator'],
  ['boundary', 'Caricature boundary']
] as const;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface PersonaSchematicViewProps {
  personaId: WorkshopPersonaId;
  titleId: string;
  onBack: () => void;
}

export const PersonaSchematicView: React.FC<PersonaSchematicViewProps> = ({ personaId, titleId, onBack }) => {
  const persona = getWorkshopPersona(personaId);
  const schematic = getPersonaSchematic(personaId);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);
  const flashTimer = React.useRef<number | undefined>(undefined);
  const [flashSection, setFlashSection] = React.useState<number | null>(null);

  React.useEffect(() => {
    backRef.current?.focus();
    return () => window.clearTimeout(flashTimer.current);
  }, []);

  React.useEffect(() => {
    if (prefersReducedMotion()) {
      scrollRef.current
        ?.closest('.pm-schem')
        ?.querySelectorAll('svg')
        .forEach((svg) => svg.pauseAnimations?.());
    }
  }, [personaId]);

  const navigate = React.useCallback((section: number) => {
    const container = scrollRef.current;
    const target = container?.querySelector<HTMLElement>(`#sec-${section}`);
    if (!container || !target) {
      return;
    }
    const top =
      target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 10;
    container.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    setFlashSection(section);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setFlashSection((current) => (current === section ? null : current));
    }, 1800);
  }, []);

  if (!persona || !schematic) {
    return null;
  }

  const { saturation, palette, comm, pressure, floor, aperture, tensions, turns } = schematic;

  return (
    <div className="pm-schem" style={schematicAccentVars(personaId)}>
      <div className="sc-top">
        <button className="back" type="button" ref={backRef} onClick={onBack}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to personas
        </button>
        <span className="sc-title" id={titleId}>Persona schematic · <b>{persona.label.toUpperCase()}</b></span>
        <div className="sc-tags">
          <span className="ro-tag"><i />live config · read-only</span>
          <button className="edit-cta" type="button" disabled title="Inline editing arrives with the persona config utility">
            <LockGlyph /> Edit persona
          </button>
        </div>
      </div>

      <div className="sc-scroll" ref={scrollRef}>
        <div className="sc-inner">
          <SchematicHub name={persona.label} spec={persona.specialty} metaphor={schematic.metaphor} onNavigate={navigate} />

          {/* 02 — Trait tensions */}
          <Panel num={2} flash={flashSection === 2}>
            <div className="tens-grid">
              {tensions.map((tension, i) => (
                <details className="tension" key={i}>
                  <summary>
                    <div className="tg-head">
                      <span className="tg-idx">T{i + 1}</span>
                      <span className="tg-title">{tension.title}</span>
                      <svg className="tg-caret" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <Gauge index={i} />
                    <div className="tg-trigger" style={{ ['--d']: `${i * 1.7}s` } as CSSVars}>
                      <b>TRIGGER</b><span>{tension.trigger}</span>
                    </div>
                    <div className="tg-open-hint">open the mechanism ▾</div>
                  </summary>
                  <div className="tg-fields">
                    {TENSION_FIELDS.map(([key, label]) => {
                      const value = tension[key];
                      return value ? (
                        <div className={`tf k-${key}`} key={key}>
                          <b>{label}</b><span>{value}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </details>
              ))}
            </div>
            <p className="pnote">
              <b>Causal, not cosmetic:</b> the needle rests at the strength pole; only the named trigger tips it into the shadow zone; the regulator is the restoring spring; the red line is a hard caricature limit the persona never crosses.
            </p>
          </Panel>

          <div className="duo">
            {/* 03 — Turn-taking signature */}
            <Panel num={3} flash={flashSection === 3}>
              <ol className="seq">
                {turns.map((turn, i) => <li key={i}>{turn}</li>)}
              </ol>
            </Panel>

            {/* 04 — Personal aperture */}
            <Panel num={4} flash={flashSection === 4}>
              <div className="apt">
                <ApertureDial openness={aperture.openness} />
                <div>
                  <span className="apt-tag">{aperture.tag}</span>
                  <p>{aperture.text}</p>
                </div>
              </div>
            </Panel>
          </div>

          {/* 05 — Verbal palette */}
          <Panel num={5} flash={flashSection === 5}>
            <div className="pal">
              <div className="pal-grid">
                {palette.map((field, i) => (
                  <div className={`pf${field.none ? ' none' : ''}`} key={i}>
                    <b>{field.label}</b><span>{field.value}</span>
                  </div>
                ))}
                <div className="pf resist">
                  <b>Assistant vocabulary to resist</b><span>{schematic.resist}</span>
                </div>
              </div>
              <div className="meter">
                <div className="meter-col">
                  {Array.from({ length: saturation.of }, (_, i) => (
                    <span className={`mseg${i < saturation.lit ? ' lit' : ''}${saturation.steady ? ' steady' : ''}`} key={i} />
                  ))}
                </div>
                <div className="meter-lab">
                  Saturation<br />{saturation.label}
                  {saturation.sub && <small>{saturation.sub}</small>}
                </div>
              </div>
            </div>
          </Panel>

          {/* 06 — Lexical gravity */}
          <Panel num={6} flash={flashSection === 6}>
            <SchematicConstellation gravity={schematic.gravity} />
          </Panel>

          {/* 07 — Communication gradients */}
          <Panel num={7} flash={flashSection === 7}>
            {comm.map((axis, i) => (
              <div className="ax" key={i}>
                <span className="ax-name">{axis.axis}</span>
                <GradientTrack stops={axis.stops} def={axis.default} farNote={axis.lock ?? 'requires justification'} locked={!!axis.lock} />
                {axis.note && <span className="ax-note">{axis.note}</span>}
              </div>
            ))}
            <p className="pnote">
              <b>Reading the tracks:</b> the glowing detent is the default the persona returns to. The dimmed far zone is governed — reachable only with justification. A padlock means that end is closed for this persona.
            </p>
          </Panel>

          {/* 08 — Trait pressure */}
          <Panel num={8} flash={flashSection === 8}>
            {pressure.map((trait, i) => (
              <div className="ax" key={i}>
                <span className="ax-name">{trait.trait}</span>
                <GradientTrack stops={trait.stops} def={0} farNote="overreach ceiling" ceil />
              </div>
            ))}
            <p className="pnote">Each trait runs default → mid → ceiling. The red-ringed stop is the overreach the regulators exist to prevent.</p>
          </Panel>

          {/* 09 — Signature floor */}
          <Panel num={9} flash={flashSection === 9}>
            <p className="pnote" style={{ margin: '0 0 12px' }}><b>{floor.lead}</b></p>
            <div className="floor-wrap">
              <div className="floor-chips">
                {floor.items.map((item, i) => (
                  <span className="fchip" key={i}><b>F{i + 1}</b>{item}</span>
                ))}
              </div>
              <div className="floor-line" />
              <span className="floor-lab">identity floor — nonzero minimum</span>
              <span className="floor-lab2">every reply must clear this line</span>
            </div>
            {floor.note && <p className="pnote">{floor.note}</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
};
