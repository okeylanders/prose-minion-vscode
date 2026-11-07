/**
 * The helper's tasks (ADR 2026-11-05 D1): one policy per `HelperTask`.
 * Adding a task adds a policy here, its prompt section, a worked example
 * that decodes through the policy's codec, and a sync test; the engine
 * never changes.
 */

import type { HelperAgentService } from '@services/helper/HelperAgentService';
import type { AnyHelperTaskPolicy } from '@services/helper/HelperTaskPolicy';
import { MEMORY_DRAFT_POLICY } from '@services/helper/tasks/MemoryDraftTask';

export const HELPER_TASK_POLICIES = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the task's kebab-case name (ADR 2026-11-05 D1).
  'memory-draft': MEMORY_DRAFT_POLICY
} as const satisfies Readonly<Record<string, AnyHelperTaskPolicy>>;

export type HelperTaskPolicies = typeof HELPER_TASK_POLICIES;
export type HelperTask = keyof HelperTaskPolicies;

/** The helper as the composition root builds it: the service over this registry. */
export type HelperAgent = HelperAgentService<HelperTaskPolicies>;
