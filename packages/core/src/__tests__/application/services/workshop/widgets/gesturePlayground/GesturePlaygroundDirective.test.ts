import {
  buildGestureDirective
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundDirective';

describe('buildGestureDirective', () => {
  it('carries selections and the note while leaving the dictionary out by default', () => {
    expect(buildGestureDirective({
      targetPhrase: ' she smiled ',
      selections: ['the smile arrived late', 'it was the smile she used on waiters'],
      note: 'keep it small',
      dictionaryMarkdown: '# Gesture Dictionary\n\nPrivate scan.',
      includeDictionaryInCommit: false
    })).toBe([
      'Gesture directions I want for "she smiled":',
      '· the smile arrived late',
      '· it was the smile she used on waiters',
      'note: keep it small'
    ].join('\n'));
  });

  it('omits the note line when empty', () => {
    expect(buildGestureDirective({
      targetPhrase: 'p',
      selections: ['a'],
      note: '  ',
      dictionaryMarkdown: '# Gesture Dictionary',
      includeDictionaryInCommit: false
    })).toBe('Gesture directions I want for "p":\n· a');
  });

  it('appends the full dictionary as room reference when explicitly included', () => {
    expect(buildGestureDirective({
      targetPhrase: 'p',
      selections: ['a'],
      note: '',
      dictionaryMarkdown: '  # Gesture Dictionary\n\nThe full scan.  ',
      includeDictionaryInCommit: true
    })).toContain(
      'Full Gesture Dictionary shared by the writer as reference:\n' +
      '# Gesture Dictionary\n\nThe full scan.'
    );
  });
});
