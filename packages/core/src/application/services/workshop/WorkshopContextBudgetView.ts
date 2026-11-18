/**
 * The Context panel's projection for the chat target (Sprint 12 Phase 7;
 * ADR 2026-11-18). Moved from `WorkshopRoomHandler` and extended with the
 * breakdown by part. The conversation id never leaves this module, and every
 * row is projected on its way out, so no host-private field reaches the
 * webview however it was stored (PR #187 F-02).
 */

import type { LabeledContextBudgetSnapshot } from '@messages';
import { projectContextSource } from '@orchestration/ContextSourceRecord';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopToolLabel } from '@shared/constants/workshopTools';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { buildWorkshopContextBreakdown } from '@/application/services/workshop/WorkshopContextBreakdown';

type ContextBudgetSession = Pick<
  WorkshopSessionService,
  | 'getChatTarget'
  | 'getToolSidecarConversationId'
  | 'getPersonaGuestConversationId'
  | 'getSelectedPersonaId'
  | 'getHostConversationId'
  | 'collectWriterSources'
>;

type ContextBudgetAssistant = Pick<
  AssistantToolService,
  'getConversationContextBudget' | 'getConversationContextSources' | 'measureWorkshopConversation'
>;

/** The chat target's manifest name and retained conversation; the id never leaves the host. */
export function workshopChatTargetConversation(
  session: ContextBudgetSession
): { label: string; conversationId: string | undefined } {
  const target = session.getChatTarget();
  return target.kind === 'tool'
    ? {
        label: `${workshopToolLabel(target.toolId)} context`,
        conversationId: session.getToolSidecarConversationId(target.toolId)
      }
    : target.kind === 'personaGuest'
      ? {
          label: `${workshopPersonaLabel(target.personaId)} context`,
          conversationId: session.getPersonaGuestConversationId(target.personaId)
        }
      : {
          label: `${workshopPersonaLabel(session.getSelectedPersonaId())} context`,
          conversationId: session.getHostConversationId()
        };
}

/**
 * The manifest (writer-declared rows first, then this conversation's
 * agent-fetched deliveries in delivery order) and, for a persona, its
 * context by part, with or without a provider total. A tool sidecar shows
 * no breakdown (D9).
 */
export function projectWorkshopContextBudget(
  session: ContextBudgetSession,
  assistant: ContextBudgetAssistant
): LabeledContextBudgetSnapshot {
  const target = session.getChatTarget();
  const { label, conversationId } = workshopChatTargetConversation(session);
  const readIn = assistant.getConversationContextSources(conversationId);
  const sources = [...session.collectWriterSources(target), ...readIn].map(projectContextSource);
  const snapshot = assistant.getConversationContextBudget(conversationId);
  // Known parts show without a fresh total (after Open, Rewind or a behavior change); the webview
  // then withholds shares and Conversation's remainder (PR #285 F-01).
  const measure = target.kind !== 'tool' ? assistant.measureWorkshopConversation(conversationId) : undefined;
  return {
    label,
    snapshot,
    sources: sources.length > 0 ? sources : undefined,
    ...(measure ? { breakdown: buildWorkshopContextBreakdown(measure, readIn.map(projectContextSource)) } : {})
  };
}
