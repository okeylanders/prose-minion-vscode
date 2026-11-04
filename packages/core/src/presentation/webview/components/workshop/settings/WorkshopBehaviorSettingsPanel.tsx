/** Conversation settings · Behavior: response style, expression, depth, initiative, continuity. */

import * as React from 'react';
import { Icon, IconName } from '@components/shared/Icon';
import {
  WORKSHOP_INTERACTION_MODE_LABELS,
  WORKSHOP_RELATIONAL_DEPTH_LABELS,
  WorkshopConversationBehavior,
  WorkshopInteractionMode,
  WorkshopPersonaExpressionLevel,
  WorkshopRelationalDepth
} from '@messages';
import { OptionCard, SettingsRule, Switch } from './WorkshopConversationSettingsControls';

const MODE_CARDS: ReadonlyArray<{
  mode: WorkshopInteractionMode;
  icon: IconName;
  description: string;
}> = [
  { mode: 'analysis', icon: 'bars', description: 'Leads with the most important finding, traces evidence, offers next moves.' },
  { mode: 'balanced', icon: 'scale', description: 'A workshop exchange — one meaningful observation, mixed with real conversation.' },
  { mode: 'conversational', icon: 'dialogue', description: 'Shorter, responsive turns that follow your thought — no forced reports.' }
];

const EXPRESSION_CARDS: ReadonlyArray<{
  level: WorkshopPersonaExpressionLevel;
  name: string;
  description: string;
}> = [
  { level: 'subtle', name: 'Subtle', description: 'Quieter delivery — fewer quirks and metaphors, same person and expertise.' },
  { level: 'full', name: 'Full', description: 'Their natural voice, tastes, trait tensions, and verbal palette without muting.' },
  {
    level: 'amplified',
    name: 'Amplified',
    description: 'Strongest authored differentiation — calibrated language and communication pressure.'
  }
];

const RELATIONAL_DEPTH_CARDS: ReadonlyArray<{
  depth: WorkshopRelationalDepth;
  icon: IconName;
  description: string;
}> = [
  {
    depth: 'reserved',
    icon: 'hand',
    description: 'Responds to feelings and needs you state directly without unsolicited personal interpretation.'
  },
  {
    depth: 'attuned',
    icon: 'sparkle',
    description: 'Uses high emotional intelligence to notice likely immediate cues and adapt with humility.'
  },
  {
    depth: 'reflective',
    icon: 'eye',
    description: 'May connect the work with life experience you explicitly shared and invite deeper reflection.'
  }
];

const ExpressionGlyph: React.FC<{ level: WorkshopPersonaExpressionLevel }> = ({ level }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {level === 'subtle' ? (
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.4 2.6" />
    ) : level === 'full' ? (
      <><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" r="2.2" fill="currentColor" /></>
    ) : (
      <>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="8" r="4.2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="8" r="1.8" fill="currentColor" />
      </>
    )}
  </svg>
);

interface WorkshopBehaviorSettingsPanelProps {
  draft: WorkshopConversationBehavior;
  disabled: boolean;
  onDraftChange: React.Dispatch<React.SetStateAction<WorkshopConversationBehavior>>;
}

export const WorkshopBehaviorSettingsPanel: React.FC<WorkshopBehaviorSettingsPanelProps> = ({
  draft,
  disabled,
  onDraftChange
}) => (
  <>
    <SettingsRule label="Response style" />
    <div className="pm-ws-behavior-cards">
      {MODE_CARDS.map((card) => (
        <OptionCard
          key={card.mode}
          selected={draft.interactionMode === card.mode}
          disabled={disabled}
          icon={<Icon name={card.icon} size={14} />}
          name={WORKSHOP_INTERACTION_MODE_LABELS[card.mode]}
          description={card.description}
          onClick={() => onDraftChange((current) => ({
            ...current,
            interactionMode: card.mode
          }))}
        />
      ))}
    </div>
    <p className="pm-ws-behavior-note">What you ask for always wins — “analyze this” gets analysis in any style.</p>

    <SettingsRule label="Persona expression" />
    <div className="pm-ws-behavior-cards">
      {EXPRESSION_CARDS.map((card) => (
        <OptionCard
          key={card.level}
          selected={draft.expressionLevel === card.level}
          disabled={disabled}
          icon={<ExpressionGlyph level={card.level} />}
          name={card.name}
          description={card.description}
          onClick={() => onDraftChange((current) => ({
            ...current,
            expressionLevel: card.level
          }))}
        />
      ))}
    </div>
    <p className="pm-ws-behavior-note">Identity and craft expertise remain present at every level.</p>

    <SettingsRule label="Relational depth" />
    <div className="pm-ws-behavior-cards">
      {RELATIONAL_DEPTH_CARDS.map((card) => (
        <OptionCard
          key={card.depth}
          selected={draft.relationalDepth === card.depth}
          disabled={disabled}
          icon={<Icon name={card.icon} size={14} />}
          name={WORKSHOP_RELATIONAL_DEPTH_LABELS[card.depth]}
          description={card.description}
          onClick={() => onDraftChange((current) => ({
            ...current,
            relationalDepth: card.depth
          }))}
        />
      ))}
    </div>
    <p className="pm-ws-behavior-note">This is a permission ceiling, not a requirement. Each persona decides when depth helps.</p>

    <SettingsRule label="Initiative" />
    <div className="pm-ws-behavior-row">
      <div className="pm-ws-behavior-row-text">
        <div className="pm-ws-behavior-row-name">Use tools &amp; widgets</div>
        <div className="pm-ws-behavior-row-desc">
          Encourage personas to offer one relevant tool or prepare one editable widget when
          it would materially help. Personas never open or install widgets for you.
        </div>
      </div>
      <Switch
        checked={draft.proactiveAssistance}
        disabled={disabled}
        label="Use tools and widgets"
        onClick={() => onDraftChange((current) => ({
          ...current,
          proactiveAssistance: !current.proactiveAssistance
        }))}
      />
    </div>

    <SettingsRule label="Session continuity" />
    <div className="pm-ws-behavior-row">
      <div className="pm-ws-behavior-row-text">
        <div className="pm-ws-behavior-row-name">Carry cues through this session</div>
        <div className="pm-ws-behavior-row-desc">
          Let demonstrated interaction preferences—like preferring blunt critique or brief
          answers—shape later turns. Cleared when the session ends or when you turn this off.
        </div>
      </div>
      <Switch
        checked={draft.carryCuesThroughSession}
        disabled={disabled}
        label="Carry cues through this session"
        onClick={() => onDraftChange((current) => ({
          ...current,
          carryCuesThroughSession: !current.carryCuesThroughSession
        }))}
      />
    </div>
  </>
);
