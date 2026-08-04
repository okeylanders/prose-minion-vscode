/** Monotonic webview-local correlation token for shared widget mutations. */
let workshopWidgetActionCounter = 0;

export type WorkshopWidgetActionRequest = 'commit' | 'apply-standing' | 'remove-standing';

export function createWorkshopWidgetActionRequestToken(
  action: WorkshopWidgetActionRequest
): string {
  return `${action}-${Date.now()}-${++workshopWidgetActionCounter}`;
}
