import {
  countWorkshopTranscriptMessages,
  projectWorkshopTranscript
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import {
  FIXTURE_EPOCH,
  dividerTurn,
  fixtureTurn,
  representativeRoom,
  writerTurn
} from './workshopTranscriptFixtures';

const project = (turns = representativeRoom()) =>
  projectWorkshopTranscript(turns, { title: 'Dock scene', exportedAt: FIXTURE_EPOCH });

describe('projectWorkshopTranscript', () => {
  it('keeps the thread order of writer messages, replies, and dividers', () => {
    const transcript = project();

    expect(transcript.entries.map((entry) => `${entry.kind}:${entry.turnId}`)).toEqual([
      'event:s-1',
      'writer:u-1',
      'reply:a-1',
      'writer:u-2',
      'reply:a-2',
      'event:cap-1',
      'event:e-1',
      'event:u-3',
      'reply:a-3',
      'writer:u-4',
      'reply:a-4'
    ]);
    expect(countWorkshopTranscriptMessages(transcript)).toBe(7);
  });

  it('leaves context-change dividers out entirely', () => {
    const transcript = project();

    expect(transcript.entries.some((entry) => entry.turnId === 'c-1')).toBe(false);
    expect(JSON.stringify(transcript)).not.toContain('secret-notes.md');
  });

  it('exports attachment and widget commits as labels, never their bodies', () => {
    const transcript = project();
    const [withAttachment, withWidget] = transcript.entries.filter(
      (entry) => entry.kind === 'writer'
    );

    expect(withAttachment).toMatchObject({
      content: 'Does the dock scene earn its length?\nBe blunt.',
      attachmentLabels: ['chapter-3.md']
    });
    expect(JSON.stringify(withAttachment)).not.toContain('drafts/chapter-3.md');
    expect(withWidget).toMatchObject({
      content: 'Try these gestures.',
      widget: { label: 'Gesture Playground', detail: '3 directions' }
    });
    expect(JSON.stringify(withWidget)).not.toContain('ta-2');
  });

  it('collapses persona-requested capability artifacts to a one-line request', () => {
    const transcript = project();
    const capability = transcript.entries.find((entry) => entry.turnId === 'cap-1');

    expect(capability).toEqual({
      kind: 'event',
      turnId: 'cap-1',
      timestamp: FIXTURE_EPOCH,
      text: "Writer's Dictionary · “liminal” · requested by Jill · success"
    });
    expect(JSON.stringify(transcript)).not.toContain('FULL DICTIONARY EVIDENCE BODY');
  });

  it('attributes replies and keeps truncation and de-duplicated sources', () => {
    const transcript = project();
    const replies = transcript.entries.filter((entry) => entry.kind === 'reply');

    expect(replies.map((reply) => reply.kind === 'reply' && [reply.speaker, reply.participant]))
      .toEqual([
        ['Jill', 'host'],
        ['Felix', 'guest'],
        ['Prose Assistant', 'tool'],
        ['Prose Assistant', 'tool']
      ]);
    expect(replies[0]).toMatchObject({
      truncated: false,
      sources: [
        { url: 'https://example.com/docks', label: 'Dock history' },
        { url: 'https://example.org/markets', label: 'example.org' }
      ]
    });
    expect(replies[1]).toMatchObject({ truncated: true });
    expect(JSON.stringify(replies[0])).not.toContain('totalTokens');
  });

  it('marks private instrument exchanges on both sides', () => {
    const transcript = project();

    expect(transcript.entries.find((entry) => entry.turnId === 'u-4'))
      .toMatchObject({ privateWith: 'Prose Assistant' });
    expect(transcript.entries.find((entry) => entry.turnId === 'a-4'))
      .toMatchObject({ privateWith: 'Prose Assistant' });
    expect(transcript.entries.find((entry) => entry.turnId === 'a-3'))
      .not.toHaveProperty('privateWith');
  });

  it('names a direct tool run as the thread divider does', () => {
    const transcript = project();

    expect(transcript.entries.find((entry) => entry.turnId === 'u-3')).toMatchObject({
      kind: 'event',
      text: 'Prose Assistant · direct run · excerpt v2'
    });
  });

  it('lists reply speakers once, in order of first appearance', () => {
    expect(project().participants).toEqual(['Jill', 'Felix', 'Prose Assistant']);
  });

  it('drops blank messages and dividers rather than exporting empty shells', () => {
    const transcript = project([
      dividerTurn('s-1', 'session_resume', '   '),
      writerTurn('u-1', { content: '  ' }),
      fixtureTurn('a-1', { content: '' })
    ]);

    expect(transcript.entries).toEqual([]);
  });

  it('keeps legacy scope dividers and standing-directive markers as history', () => {
    const transcript = project([
      dividerTurn('sc-1', 'scope_change', 'Switched to open conversation'),
      dividerTurn('sd-1', 'standing_directive_change', 'Lexical Gravity installed')
    ]);

    expect(transcript.entries.map((entry) => entry.kind === 'event' && entry.text)).toEqual([
      'Switched to open conversation',
      'Lexical Gravity installed'
    ]);
  });
});
