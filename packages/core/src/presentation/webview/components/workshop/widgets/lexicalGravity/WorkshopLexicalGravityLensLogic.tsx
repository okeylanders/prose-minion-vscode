/** Lens Logic inspector — renders the backend-owned v2 interpretive grammar. */

import * as React from 'react';
import { WorkshopLexicalGravityLens } from '@messages';

type LogicSection = 'attention' | 'axes' | 'roles' | 'dynamics' | 'guardrails';

const SECTIONS: ReadonlyArray<[LogicSection, string]> = [
  ['attention', 'Attention'],
  ['axes', 'Axes'],
  ['roles', 'Roles'],
  ['dynamics', 'Dynamics'],
  ['guardrails', 'Guardrails']
];

interface WorkshopLexicalGravityLensLogicProps {
  lens: WorkshopLexicalGravityLens;
}

export const WorkshopLexicalGravityLensLogic: React.FC<WorkshopLexicalGravityLensLogicProps> = ({
  lens
}) => {
  const [section, setSection] = React.useState<LogicSection>('attention');
  const logic = lens.logic;
  return (
    <div className="pm-ws-lg-logicbox">
      <div className="pm-ws-lg-logic-head">
        <span className="pm-ws-lg-logic-cap">Lens logic</span>
        <span className="pm-ws-lg-v2tag">v2</span>
        <span className="pm-ws-lg-logic-lens">{lens.name.toLowerCase()}</span>
      </div>
      <p className="pm-ws-lg-premise">“{logic.premise}”</p>
      <div className="pm-ws-lg-ltabs" role="tablist" aria-label="Lens logic sections">
        {SECTIONS.map(([id, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={section === id}
            className={section === id ? 'is-on' : ''}
            key={id}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pm-ws-lg-logic-body">
        {section === 'attention' && (
          <div className="pm-ws-lg-att">
            <div>
              <div className="pm-ws-lg-lcap">Foregrounds</div>
              <ul className="pm-ws-lg-list">
                {logic.attention.foregrounds.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <div className="pm-ws-lg-lcap is-bg">Backgrounds</div>
              <ul className="pm-ws-lg-list is-bg">
                {logic.attention.backgrounds.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        )}
        {section === 'axes' && logic.axes.map((axis) => (
          <div className="pm-ws-lg-axis" key={axis.id}>
            <span className="pm-ws-lg-axis-name">{axis.name}</span>
            <span className="pm-ws-lg-axis-track">
              <em>{axis.poles[0]}</em><i /><em>{axis.poles[1]}</em>
            </span>
          </div>
        ))}
        {section === 'roles' && logic.roles.map((role) => (
          <div className="pm-ws-lg-role" key={role.id}>
            <em>{role.name}</em><span>{role.description}</span>
          </div>
        ))}
        {section === 'dynamics' && logic.dynamics.map((dynamic) => (
          <div className="pm-ws-lg-dyn" key={dynamic.id}>
            <div className="pm-ws-lg-dyn-head">
              <b>{dynamic.operation}</b><span>{dynamic.movement}</span>
            </div>
            <div className="pm-ws-lg-dyn-line"><i>entails</i><span>{dynamic.entailment}</span></div>
            <div className="pm-ws-lg-dyn-line"><i>affords</i><span>{dynamic.narrativeAffordance}</span></div>
          </div>
        ))}
        {section === 'guardrails' && (
          <ul className="pm-ws-lg-list is-guard">
            {logic.guardrails.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </div>
      <div className="pm-ws-lg-fcap">
        interpretive grammar — roles &amp; axes map to the passage at prose time; nothing here stores a character
      </div>
    </div>
  );
};
