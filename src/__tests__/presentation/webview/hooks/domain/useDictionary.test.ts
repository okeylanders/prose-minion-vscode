/**
 * useDictionary Contract Tests
 *
 * Validates Tripartite Interface pattern for dictionary operations.
 */

import { DictionaryState, DictionaryActions, DictionaryPersistence } from '@/presentation/webview/hooks/domain/useDictionary';

describe('useDictionary - Type Contracts', () => {
  describe('Tripartite Interface Pattern', () => {
    it('should define State interface', () => {
      const state: DictionaryState = {
        result: '',
        toolName: undefined,
        loading: false,
        word: '',
        context: '',
        wordEdited: false,
        sourceUri: '',
        relativePath: '',
        statusMessage: '',
        isFastGenerating: false,
        progress: undefined,
        lastFastGenerationMetadata: null,
        tickerMessage: ''
      };

      expect(state).toHaveProperty('result');
      expect(state).toHaveProperty('loading');
      expect(state).toHaveProperty('word');
      expect(state).toHaveProperty('context');
      expect(state).toHaveProperty('wordEdited');
      expect(state).toHaveProperty('sourceUri');
      expect(state).toHaveProperty('isFastGenerating');
      expect(state).toHaveProperty('progress');
      expect(state).toHaveProperty('tickerMessage');
    });

    it('should define Actions interface', () => {
      const actions: DictionaryActions = {
        handleDictionaryResult: jest.fn(),
        handleStatusMessage: jest.fn(),
        setLoading: jest.fn(),
        setWord: jest.fn(),
        setContext: jest.fn(),
        setWordEdited: jest.fn(),
        setSource: jest.fn(),
        clearResult: jest.fn(),
        handleFastGenerateResult: jest.fn(),
        setFastGenerating: jest.fn()
      };

      expect(typeof actions.handleDictionaryResult).toBe('function');
      expect(typeof actions.setWord).toBe('function');
      expect(typeof actions.clearResult).toBe('function');
      expect(typeof actions.handleFastGenerateResult).toBe('function');
      expect(typeof actions.setFastGenerating).toBe('function');
    });

    it('should define Persistence interface', () => {
      const persistence: DictionaryPersistence = {
        utilitiesResult: '',
        dictionaryToolName: undefined,
        dictionaryWord: '',
        dictionaryContext: '',
        dictionaryWordEdited: false,
        dictionarySourceUri: '',
        dictionaryRelativePath: '',
        dictionaryStatusMessage: ''
      };

      expect(persistence).toHaveProperty('utilitiesResult');
      expect(persistence).toHaveProperty('dictionaryWord');
      expect(persistence).toHaveProperty('dictionaryContext');
      expect(persistence).toHaveProperty('dictionaryToolName');
    });
  });
});
