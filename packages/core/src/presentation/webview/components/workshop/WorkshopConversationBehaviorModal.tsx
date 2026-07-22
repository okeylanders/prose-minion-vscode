/** Conversation Settings — Behavior and global writer-profile drafts. */

import * as React from 'react';
import { Icon, IconName } from '@components/shared/Icon';
import { WorkshopModalShell } from './WorkshopModalShell';
import {
  WORKSHOP_INTERACTION_MODE_LABELS,
  WORKSHOP_RELATIONAL_DEPTH_LABELS,
  WORKSHOP_WRITER_PROFILE_LIMITS,
  WorkshopConversationBehavior,
  WorkshopInteractionMode,
  WorkshopPersonaExpressionLevel,
  WorkshopRelationalDepth,
  WorkshopWriterProfile
} from '@messages';

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
  { level: 'amplified', name: 'Amplified', description: 'Strongest authored differentiation — calibrated language and communication pressure.' }
];

const RELATIONAL_DEPTH_CARDS: ReadonlyArray<{
  depth: WorkshopRelationalDepth;
  icon: IconName;
  description: string;
}> = [
  { depth: 'reserved', icon: 'hand', description: 'Responds to feelings and needs you state directly without unsolicited personal interpretation.' },
  { depth: 'attuned', icon: 'sparkle', description: 'Uses high emotional intelligence to notice likely immediate cues and adapt with humility.' },
  { depth: 'reflective', icon: 'eye', description: 'May connect the work with life experience you explicitly shared and invite deeper reflection.' }
];

const ExpressionGlyph: React.FC<{ level: WorkshopPersonaExpressionLevel }> = ({ level }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {level === 'subtle' ? (
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.4 2.6" />
    ) : level === 'full' ? (
      <><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" r="2.2" fill="currentColor" /></>
    ) : (
      <><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" /><circle cx="8" cy="8" r="4.2" stroke="currentColor" strokeWidth="1.2" /><circle cx="8" cy="8" r="1.8" fill="currentColor" /></>
    )}
  </svg>
);

const behaviorEquals = (a: WorkshopConversationBehavior, b: WorkshopConversationBehavior): boolean =>
  a.interactionMode === b.interactionMode
  && a.expressionLevel === b.expressionLevel
  && a.relationalDepth === b.relationalDepth
  && a.carryCuesThroughSession === b.carryCuesThroughSession;

const profileEquals = (a: WorkshopWriterProfile, b: WorkshopWriterProfile): boolean =>
  a.enabled === b.enabled
  && a.preferredAddress === b.preferredAddress
  && a.bio === b.bio;

interface PendingApply {
  submittedBehavior: WorkshopConversationBehavior;
  submittedProfile: WorkshopWriterProfile;
  baselineBehavior: WorkshopConversationBehavior;
  baselineProfile: WorkshopWriterProfile;
}

interface WorkshopConversationBehaviorModalProps {
  open: boolean;
  behavior: WorkshopConversationBehavior;
  writerProfile: WorkshopWriterProfile;
  isRunning: boolean;
  errorMessage?: string;
  onApply: (behavior: WorkshopConversationBehavior, writerProfile: WorkshopWriterProfile) => void;
  onClose: () => void;
}

type SettingsTab = 'behavior' | 'profile';

export const WorkshopConversationBehaviorModal: React.FC<WorkshopConversationBehaviorModalProps> = ({
  open,
  behavior,
  writerProfile,
  isRunning,
  errorMessage,
  onApply,
  onClose
}) => {
  const [tab, setTab] = React.useState<SettingsTab>('behavior');
  const [behaviorDraft, setBehaviorDraft] = React.useState({ ...behavior });
  const [profileDraft, setProfileDraft] = React.useState({ ...writerProfile });
  const [pending, setPending] = React.useState<PendingApply | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const behaviorTabRef = React.useRef<HTMLButtonElement>(null);
  const profileTabRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) {
      setTab('behavior');
      setBehaviorDraft({ ...behavior });
      setProfileDraft({ ...writerProfile });
      setPending(null);
      setConfirmClear(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!pending) return;
    if (!open) {
      setPending(null);
      return;
    }
    if (
      behaviorEquals(behavior, pending.submittedBehavior)
      && profileEquals(writerProfile, pending.submittedProfile)
    ) {
      setPending(null);
      onClose();
    } else if (
      !behaviorEquals(behavior, pending.baselineBehavior)
      || !profileEquals(writerProfile, pending.baselineProfile)
    ) {
      setPending(null);
    }
  }, [behavior, onClose, open, pending, writerProfile]);

  React.useEffect(() => {
    if (pending && errorMessage) setPending(null);
  }, [errorMessage, pending]);

  const editingLocked = pending !== null;
  const applyLocked = isRunning || editingLocked;
  const switchTab = (next: SettingsTab) => {
    setTab(next);
    setConfirmClear(false);
  };
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = event.key === 'ArrowLeft' || event.key === 'Home'
      ? 'behavior'
      : event.key === 'ArrowRight' || event.key === 'End'
        ? 'profile'
        : undefined;
    if (!next) return;
    event.preventDefault();
    switchTab(next);
    (next === 'behavior' ? behaviorTabRef : profileTabRef).current?.focus();
  };
  const apply = () => {
    if (applyLocked) return;
    const submittedBehavior = { ...behaviorDraft };
    const submittedProfile = {
      ...profileDraft,
      preferredAddress: profileDraft.preferredAddress.trim(),
      bio: profileDraft.bio.trim()
    };
    onApply(submittedBehavior, submittedProfile);
    setPending({
      submittedBehavior,
      submittedProfile,
      baselineBehavior: { ...behavior },
      baselineProfile: { ...writerProfile }
    });
  };
  const clearProfile = () => {
    setProfileDraft({ enabled: false, preferredAddress: '', bio: '' });
    setConfirmClear(false);
  };

  return (
    <WorkshopModalShell
      open={open}
      titleId="pm-ws-settings-title"
      closeLabel="Close conversation settings"
      className="pm-ws-behavior-modal"
      onClose={onClose}
    >
      <div className="pm-ws-tools-modal-head">
        <div>
          <div className="pm-ws-eyebrow">Workshop · Room settings</div>
          <h2 id="pm-ws-settings-title">Conversation settings</h2>
          <p>Choose how Workshop personas respond and what you explicitly share with them. Tools are unchanged.</p>
        </div>
        <WorkshopModalShell.CloseButton />
      </div>

      <div className="pm-ws-settings-tabs" role="tablist" aria-label="Conversation settings sections">
        <button ref={behaviorTabRef} type="button" role="tab" id="pm-ws-behavior-tab" aria-selected={tab === 'behavior'} aria-controls="pm-ws-behavior-panel" tabIndex={tab === 'behavior' ? 0 : -1} onClick={() => switchTab('behavior')} onKeyDown={handleTabKeyDown}>Behavior</button>
        <button ref={profileTabRef} type="button" role="tab" id="pm-ws-profile-tab" aria-selected={tab === 'profile'} aria-controls="pm-ws-profile-panel" tabIndex={tab === 'profile' ? 0 : -1} onClick={() => switchTab('profile')} onKeyDown={handleTabKeyDown}>About you</button>
      </div>

      {tab === 'behavior' ? (
        <div className="pm-ws-behavior-body" role="tabpanel" id="pm-ws-behavior-panel" aria-labelledby="pm-ws-behavior-tab">
          <SettingsRule label="Response style" />
          <div className="pm-ws-behavior-cards">
            {MODE_CARDS.map((card) => <OptionCard key={card.mode} selected={behaviorDraft.interactionMode === card.mode} disabled={editingLocked} icon={<Icon name={card.icon} size={14} />} name={WORKSHOP_INTERACTION_MODE_LABELS[card.mode]} description={card.description} onClick={() => setBehaviorDraft((current) => ({ ...current, interactionMode: card.mode }))} />)}
          </div>
          <p className="pm-ws-behavior-note">What you ask for always wins — “analyze this” gets analysis in any style.</p>

          <SettingsRule label="Persona expression" />
          <div className="pm-ws-behavior-cards">
            {EXPRESSION_CARDS.map((card) => <OptionCard key={card.level} selected={behaviorDraft.expressionLevel === card.level} disabled={editingLocked} icon={<ExpressionGlyph level={card.level} />} name={card.name} description={card.description} onClick={() => setBehaviorDraft((current) => ({ ...current, expressionLevel: card.level }))} />)}
          </div>
          <p className="pm-ws-behavior-note">Identity and craft expertise remain present at every level.</p>

          <SettingsRule label="Relational depth" />
          <div className="pm-ws-behavior-cards">
            {RELATIONAL_DEPTH_CARDS.map((card) => <OptionCard key={card.depth} selected={behaviorDraft.relationalDepth === card.depth} disabled={editingLocked} icon={<Icon name={card.icon} size={14} />} name={WORKSHOP_RELATIONAL_DEPTH_LABELS[card.depth]} description={card.description} onClick={() => setBehaviorDraft((current) => ({ ...current, relationalDepth: card.depth }))} />)}
          </div>
          <p className="pm-ws-behavior-note">This is a permission ceiling, not a requirement. Each persona decides when depth helps.</p>

          <SettingsRule label="Session continuity" />
          <div className="pm-ws-behavior-row">
            <div className="pm-ws-behavior-row-text"><div className="pm-ws-behavior-row-name">Carry cues through this session</div><div className="pm-ws-behavior-row-desc">Let demonstrated interaction preferences—like preferring blunt critique or brief answers—shape later turns. Cleared when the session ends or when you turn this off.</div></div>
            <Switch checked={behaviorDraft.carryCuesThroughSession} disabled={editingLocked} label="Carry cues through this session" onClick={() => setBehaviorDraft((current) => ({ ...current, carryCuesThroughSession: !current.carryCuesThroughSession }))} />
          </div>
        </div>
      ) : (
        <div className="pm-ws-behavior-body pm-ws-profile-body" role="tabpanel" id="pm-ws-profile-panel" aria-labelledby="pm-ws-profile-tab">
          <div className="pm-ws-profile-share-row">
            <div><div className="pm-ws-behavior-row-name">Share this profile with Workshop personas</div><div className="pm-ws-behavior-row-desc">Jill and invited personas receive it as background context. Analysis tools do not.</div></div>
            <Switch checked={profileDraft.enabled} disabled={editingLocked} label="Share this profile with Workshop personas" onClick={() => setProfileDraft((current) => ({ ...current, enabled: !current.enabled }))} />
          </div>

          <label className="pm-ws-profile-field">
            <span>How should the room address you?</span>
            <input type="text" aria-label="How should the room address you?" value={profileDraft.preferredAddress} maxLength={WORKSHOP_WRITER_PROFILE_LIMITS.preferredAddress} disabled={editingLocked} placeholder="Okey, Dr. Landers, Okey is fine…" onChange={(event) => setProfileDraft((current) => ({ ...current, preferredAddress: event.target.value }))} />
            <small>{profileDraft.preferredAddress.length} / {WORKSHOP_WRITER_PROFILE_LIMITS.preferredAddress}</small>
          </label>

          <label className="pm-ws-profile-field">
            <span>What would you like the room to know about you?</span>
            <textarea aria-label="What would you like the room to know about you?" value={profileDraft.bio} maxLength={WORKSHOP_WRITER_PROFILE_LIMITS.bio} rows={8} disabled={editingLocked} placeholder="A little enduring context that can help the room work with you…" onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))} />
            <small>{profileDraft.bio.length} / {WORKSHOP_WRITER_PROFILE_LIMITS.bio}</small>
          </label>

          <div className="pm-ws-profile-notice"><Icon name="person" size={14} /><span>Stored globally in VS Code settings, not in this project or its session history. This is ordinary settings data—not a secret—so don’t include sensitive information. Personas use it as background context without reciting it or repeatedly using your name.</span></div>

          <div className="pm-ws-profile-clear">
            {confirmClear ? <><span role="status">Clear both fields and turn sharing off?</span><button type="button" className="pm-ws-action-btn" disabled={editingLocked} onClick={() => setConfirmClear(false)}>Keep profile</button><button type="button" className="pm-ws-danger-btn" disabled={editingLocked} onClick={clearProfile}>Clear</button></> : <button type="button" className="pm-ws-action-btn" disabled={editingLocked || (!profileDraft.preferredAddress && !profileDraft.bio)} onClick={() => setConfirmClear(true)}>Clear profile…</button>}
          </div>
        </div>
      )}

      <div className="pm-ws-behavior-foot">
        {pending ? <span className="pm-ws-behavior-foot-note pm-ws-behavior-foot-note-busy" role="status">Conversation settings are updating…</span> : isRunning ? <span className="pm-ws-behavior-foot-note pm-ws-behavior-foot-note-busy" role="status">A response is in progress — changes are available when it finishes.</span> : <span className="pm-ws-behavior-foot-note">Applies the Behavior and About You drafts together to the active room.</span>}
        <button className="pm-ws-action-btn" type="button" onClick={onClose}>Cancel</button>
        <button className="pm-ws-primary-btn" type="button" disabled={applyLocked} onClick={apply}>Apply to next turn</button>
      </div>
    </WorkshopModalShell>
  );
};

const SettingsRule: React.FC<{ label: string }> = ({ label }) => <div className="pm-ws-tools-modal-rule"><span className="pm-ws-eyebrow">{label}</span><hr /></div>;

const OptionCard: React.FC<{ selected: boolean; disabled: boolean; icon: React.ReactNode; name: string; description: string; onClick: () => void }> = ({ selected, disabled, icon, name, description, onClick }) => <button className={`pm-ws-behavior-card ${selected ? 'pm-ws-behavior-card-selected' : ''}`} type="button" aria-pressed={selected} disabled={disabled} onClick={onClick}><span className="pm-ws-behavior-card-top">{icon}<span className="pm-ws-behavior-card-name">{name}</span></span><span className="pm-ws-behavior-card-desc">{description}</span></button>;

const Switch: React.FC<{ checked: boolean; disabled: boolean; label: string; onClick: () => void }> = ({ checked, disabled, label, onClick }) => <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`pm-ws-behavior-toggle ${checked ? 'pm-ws-behavior-toggle-on' : ''}`} onClick={onClick}><span className="pm-ws-behavior-toggle-thumb" /></button>;
