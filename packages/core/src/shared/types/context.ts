/**
 * Shared types for the context assistant workflow
 */

export const CONTEXT_PATH_GROUPS = [
  'characters',
  'locations',
  'themes',
  'things',
  'chapters',
  'manuscript',
  'projectBrief',
  'general'
] as const;

export type ContextPathGroup = typeof CONTEXT_PATH_GROUPS[number];

export const isContextPathGroup = (value: string): value is ContextPathGroup =>
  (CONTEXT_PATH_GROUPS as readonly string[]).includes(value);
