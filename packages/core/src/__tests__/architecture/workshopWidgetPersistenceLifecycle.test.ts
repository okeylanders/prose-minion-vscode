import {
  assertWorkshopWidgetCurrentDraftShape,
  isPersistedWorkshopWidgetId,
  type PersistedWorkshopWidgetId,
  persistedWorkshopWidgetLifecycleIds
} from '@/application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle';

describe('WorkshopWidgetPersistenceLifecycle architecture', () => {
  it('publishes the compiler-checked persisted-widget set', () => {
    const ids = persistedWorkshopWidgetLifecycleIds();

    expect(ids).toEqual([
      'gesture-playground',
      'lexical-gravity',
      'creative-variations'
    ]);
    expect(ids.every(isPersistedWorkshopWidgetId)).toBe(true);
  });

  it('does not mistake roadmap catalog entries for persisted codecs', () => {
    expect(isPersistedWorkshopWidgetId('prose-controller')).toBe(false);
    expect(() => assertWorkshopWidgetCurrentDraftShape(
      'prose-controller' as PersistedWorkshopWidgetId,
      {},
      'draft'
    )).toThrow(/Unsupported persisted Workshop widget: prose-controller/);
  });
});
