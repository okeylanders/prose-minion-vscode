import {
  assertWorkshopWidgetDraftShape,
  persistedWorkshopWidgetLifecycleIds
} from '@/application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle';

describe('WorkshopWidgetPersistenceLifecycle architecture', () => {
  it('registers every persisted widget-union arm exactly once', () => {
    const ids = persistedWorkshopWidgetLifecycleIds();

    expect(ids).toEqual(['gesture-playground', 'lexical-gravity']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not mistake roadmap catalog entries for persisted codecs', () => {
    expect(() => assertWorkshopWidgetDraftShape(
      'prose-controller',
      {},
      'draft'
    )).toThrow(/Unsupported persisted Workshop widget: prose-controller/);
  });
});
