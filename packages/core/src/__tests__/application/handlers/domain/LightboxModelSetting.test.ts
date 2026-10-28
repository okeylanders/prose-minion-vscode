/**
 * The Lightbox's own model setting (Slice 4L, epic decision 51), host side:
 * one settings store, the real `AIResourceManager` and a real
 * `ConfigurationHandler` per webview, with the config watcher's hot-swap and
 * broadcasts (`modelSettingsHarness`). Model ids are placeholders and the
 * catalog is a stubbed fetch: no provider is called.
 */
import {
  createModelSettingsHosts as createHosts,
  disposeModelSettingsHosts,
  stubModelCatalog
} from '@/__tests__/application/handlers/domain/modelSettingsHarness';
import { OpenRouterModels } from '@providers/OpenRouterModels';

const WORKSHOP = 'placeholder/workshop-model';
const WORKSHOP_NEXT = 'placeholder/workshop-model-next';
const LIGHTBOX = 'placeholder/lightbox-model';
const LIGHTBOX_NEXT = 'placeholder/lightbox-model-next';

describe('the Lightbox model setting (Slice 4L): no cross-talk with the Workshop', () => {
  beforeEach(() => stubModelCatalog([WORKSHOP, WORKSHOP_NEXT, LIGHTBOX, LIGHTBOX_NEXT]));

  afterEach(() => {
    disposeModelSettingsHosts();
    jest.restoreAllMocks();
    OpenRouterModels.clearCache();
  });

  it('a Lightbox pick writes lightboxModel, never assistantModel, and moves only the Lightbox engine', async () => {
    const host = await createHosts({ assistantModel: WORKSHOP });
    const assistantEngine = host.manager.getEngine('assistant');

    await host.select('lightbox', { scope: 'lightbox', modelId: LIGHTBOX });

    expect(host.writes).toEqual([['lightboxModel', LIGHTBOX]]);
    expect(host.values.assistantModel).toBe(WORKSHOP);
    expect(host.manager.getEngine('assistant')).toBe(assistantEngine);
    expect(assistantEngine?.getModel()).toBe(WORKSHOP);
    expect(host.manager.getEngine('lightbox')?.getModel()).toBe(LIGHTBOX);
    // The Lightbox's own answer, and the Workshop's broadcast: the Workshop's model is where it was.
    expect(host.latestModelData('lightbox')).toMatchObject({ selections: { assistant: WORKSHOP, lightbox: LIGHTBOX }, following: ['craft'] });
    expect(host.latestModelData('workshop')).toMatchObject({ selections: { assistant: WORKSHOP, lightbox: LIGHTBOX } });
  });

  it('a Workshop pick never changes a Lightbox model that has been set', async () => {
    const host = await createHosts({ assistantModel: WORKSHOP, lightboxModel: LIGHTBOX });

    await host.select('workshop', { scope: 'assistant', modelId: WORKSHOP_NEXT });

    expect(host.writes).toEqual([['assistantModel', WORKSHOP_NEXT]]);
    expect(host.values.lightboxModel).toBe(LIGHTBOX);
    expect(host.manager.getEngine('lightbox')?.getModel()).toBe(LIGHTBOX);
    expect(host.latestModelData('lightbox')).toMatchObject({ selections: { assistant: WORKSHOP_NEXT, lightbox: LIGHTBOX }, following: ['craft'] });
  });

  it('unset, the Lightbox follows a Workshop pick, as its fallback says', async () => {
    const host = await createHosts({ assistantModel: WORKSHOP });
    expect(host.manager.getEngine('lightbox')?.getModel()).toBe(WORKSHOP);

    await host.select('workshop', { scope: 'assistant', modelId: WORKSHOP_NEXT });

    expect(host.values.lightboxModel).toBeUndefined();
    expect(host.manager.getEngine('lightbox')?.getModel()).toBe(WORKSHOP_NEXT);
    expect(host.latestModelData('lightbox')).toMatchObject({
      selections: { assistant: WORKSHOP_NEXT, lightbox: WORKSHOP_NEXT },
      following: ['lightbox', 'craft']
    });
  });

  it('"Same as Workshop" clears the Lightbox model, and it follows again', async () => {
    const host = await createHosts({ assistantModel: WORKSHOP, lightboxModel: LIGHTBOX });

    await host.select('lightbox', { scope: 'lightbox', modelId: null });

    // Removed, not written blank: the manifest default ("") is what it reads again.
    expect(host.writes).toEqual([['lightboxModel', undefined]]);
    expect('lightboxModel' in host.values).toBe(false);
    expect(host.values.assistantModel).toBe(WORKSHOP);
    expect(host.manager.getEngine('lightbox')?.getModel()).toBe(WORKSHOP);
    expect(host.latestModelData('lightbox')).toMatchObject({ selections: { lightbox: WORKSHOP }, following: ['lightbox', 'craft'] });
  });

  it('refuses to make any other scope follow, and an unknown scope, writing nothing', async () => {
    const host = await createHosts({ assistantModel: WORKSHOP });

    await host.select('workshop', { scope: 'assistant', modelId: null } as never);
    await host.select('workshop', { scope: 'toString', modelId: LIGHTBOX } as never);

    expect(host.writes).toEqual([]);
    expect(host.values.assistantModel).toBe(WORKSHOP);
    expect(host.errors('workshop').map((message) => (message.payload as { details?: string }).details)).toEqual([
      'The assistant model cannot follow another scope',
      'Unknown model scope: toString'
    ]);
  });
});

describe('the Lightbox model setting (Slice 4L): settings sync, both ways', () => {
  beforeEach(() => stubModelCatalog([WORKSHOP, LIGHTBOX, LIGHTBOX_NEXT]));

  afterEach(() => {
    disposeModelSettingsHosts();
    jest.restoreAllMocks();
    OpenRouterModels.clearCache();
  });

  it('Settings overlay → VS Code settings → the Lightbox picker', async () => {
    const host = await createHosts({ assistantModel: WORKSHOP });

    await host.select('sidebar', { scope: 'lightbox', modelId: LIGHTBOX });

    expect(host.values.lightboxModel).toBe(LIGHTBOX);
    expect(host.latestModelData('lightbox')).toMatchObject({ selections: { lightbox: LIGHTBOX }, following: ['craft'] });
  });

  it('the Lightbox picker → VS Code settings → the Settings overlay', async () => {
    const host = await createHosts({ assistantModel: WORKSHOP });

    await host.select('lightbox', { scope: 'lightbox', modelId: LIGHTBOX });
    expect(host.latestModelData('sidebar')).toMatchObject({ selections: { lightbox: LIGHTBOX }, following: ['craft'] });

    await host.select('lightbox', { scope: 'lightbox', modelId: null });
    expect(host.latestModelData('sidebar')).toMatchObject({ selections: { lightbox: WORKSHOP }, following: ['lightbox', 'craft'] });
  });

  it('VS Code settings → the Settings overlay and the Lightbox picker, set and cleared', async () => {
    const host = await createHosts({ assistantModel: WORKSHOP });

    await host.editSettingsExternally('lightboxModel', LIGHTBOX_NEXT);
    for (const surface of ['sidebar', 'lightbox'] as const) {
      expect(host.latestModelData(surface)).toMatchObject({ selections: { assistant: WORKSHOP, lightbox: LIGHTBOX_NEXT }, following: ['craft'] });
    }
    expect(host.manager.getEngine('lightbox')?.getModel()).toBe(LIGHTBOX_NEXT);

    // Emptied in the Settings UI: blank is unset.
    await host.editSettingsExternally('lightboxModel', '');
    for (const surface of ['sidebar', 'lightbox'] as const) {
      expect(host.latestModelData(surface)).toMatchObject({ selections: { lightbox: WORKSHOP }, following: ['lightbox', 'craft'] });
    }
    expect(host.manager.getEngine('lightbox')?.getModel()).toBe(WORKSHOP);
  });
});
