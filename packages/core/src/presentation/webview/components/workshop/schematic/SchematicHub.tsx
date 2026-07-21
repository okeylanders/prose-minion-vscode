/**
 * Identity hub (panel 01) — the persona core ringed by clickable category
 * nodes that scroll the schematic to their panel. Ported from `hub()` in
 * docs/design/Prose Minion - Persona Schematic.html.
 */

import * as React from 'react';
import { SCHEMATIC_CATEGORIES, SCHEMATIC_HUB_NODES } from './personaSchematicChrome';

interface SchematicHubProps {
  name: string;
  spec: string;
  metaphor: string | null;
  onNavigate: (section: number) => void;
}

const W = 960;
const H = 440;
const CX = 480;
const CY = 215;

export const SchematicHub: React.FC<SchematicHubProps> = ({ name, spec, metaphor, onNavigate }) => {
  const nodes = SCHEMATIC_HUB_NODES.map((node, i) => {
    const dx = node.x - CX;
    const dy = node.y - CY;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const sx = CX + ux * 70;
    const sy = CY + uy * 70;
    const mx = (sx + node.x) / 2 + uy * 18;
    const my = (sy + node.y) / 2 - ux * 18;
    const d = `M${sx.toFixed(0)} ${sy.toFixed(0)} Q${mx.toFixed(0)} ${my.toFixed(0)} ${node.x} ${node.y}`;
    return { ...node, i, d, labAbove: node.y < CY };
  });

  const activate = (section: number) => (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onNavigate(section);
    }
  };

  return (
    <div className="hub">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Persona configuration map">
        {nodes.map((node) => (
          <path key={`trace-${node.i}`} d={node.d} fill="none" stroke="var(--pa)" strokeOpacity=".22" strokeWidth="1.2" />
        ))}
        {nodes.map((node) => (
          <circle key={`pulse-${node.i}`} r="2.4" fill="var(--pa-hi)" opacity=".9">
            <animateMotion
              dur={`${(5.5 + node.i * 0.6).toFixed(1)}s`}
              begin={`${(node.i * 0.8).toFixed(1)}s`}
              repeatCount="indefinite"
              path={node.d}
            />
          </circle>
        ))}

        <circle className="core-glow" cx={CX} cy={CY} r="52" fill="var(--pa)" fillOpacity=".1" />
        <circle className="br3" cx={CX} cy={CY} r="62" fill="none" stroke="var(--pa)" strokeOpacity=".25" strokeWidth="1" />
        <circle className="br2" cx={CX} cy={CY} r="46" fill="none" stroke="var(--pa)" strokeOpacity=".4" strokeWidth="1.2" strokeDasharray="3 6" />
        <circle className="br1" cx={CX} cy={CY} r="31" fill="none" stroke="var(--pa)" strokeOpacity=".65" strokeWidth="1.4" />
        <circle cx={CX} cy={CY} r="17" fill="var(--pa)" fillOpacity=".14" stroke="var(--pa)" strokeWidth="1.5" />
        <text x={CX} y={CY + 5} fontSize="15" fill="var(--pa-hi)" textAnchor="middle" fontWeight="600">{name[0]}</text>
        <text x={CX} y={CY + 88} fontSize="8" fill="var(--pa)" letterSpacing="1.5" textAnchor="middle">01 IDENTITY</text>
        <text x={CX} y={CY + 104} fontSize="13" fill="var(--text)" textAnchor="middle" fontWeight="600" fontFamily="var(--schem-sans)">{name} · {spec}</text>
        <text x={CX} y={CY + 120} fontSize="9" fill="rgba(243,236,225,.45)" letterSpacing="1" textAnchor="middle">
          {metaphor
            ? `PRIMARY METAPHOR FIELD: ${metaphor.toUpperCase()}`
            : 'PRIMARY METAPHOR FIELD: NONE — PLAINNESS IS THE VOICE'}
        </text>

        {nodes.map((node) => (
          <g
            key={`node-${node.i}`}
            className="hub-node"
            role="button"
            tabIndex={0}
            aria-label={`Open ${SCHEMATIC_CATEGORIES[node.section]}`}
            onClick={() => onNavigate(node.section)}
            onKeyDown={activate(node.section)}
          >
            <circle cx={node.x} cy={node.y} r="22" fill="transparent" />
            <circle className="nhalo" cx={node.x} cy={node.y} r="9.5" fill="none" stroke="var(--pa)" strokeOpacity=".35" strokeWidth="1" />
            <circle cx={node.x} cy={node.y} r="4.2" fill="var(--pa)" />
            <text x={node.x} y={node.labAbove ? node.y - 24 : node.y + 22} fontSize="8" fill="var(--pa)" fillOpacity=".8" letterSpacing="1.2" textAnchor="middle">{`0${node.section}`}</text>
            <text className="nlabel" x={node.x} y={node.labAbove ? node.y - 13 : node.y + 34} fontSize="9.5" fill="rgba(243,236,225,.62)" letterSpacing="1.4" textAnchor="middle">
              {SCHEMATIC_CATEGORIES[node.section]?.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
