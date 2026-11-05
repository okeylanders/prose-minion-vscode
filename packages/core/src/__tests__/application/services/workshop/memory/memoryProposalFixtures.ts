/** A project-memory trailer and a widget frame for tests (made-up text: Alice). */

export function memoryFrame(fields: {
  title?: string;
  kind?: string;
  summary?: string;
  body?: string;
  supersedes?: string[];
  extra?: string;
} = {}): string {
  return [
    '<prose-minion-memory-proposal>',
    `<title>${fields.title ?? 'The Rabbit\'s watch runs backward'}</title>`,
    `<kind>${fields.kind ?? 'canon'}</kind>`,
    `<summary>${fields.summary ?? 'From chapter 3 on, the White Rabbit\'s watch runs backward.'}</summary>`,
    `<body>${fields.body ?? 'We settled this while working the tea-party scene.'}</body>`,
    ...(fields.supersedes ?? []).map((id) => `<supersedes>${id}</supersedes>`),
    ...(fields.extra ? [fields.extra] : []),
    '</prose-minion-memory-proposal>'
  ].join('\n');
}

export const WIDGET = [
  '### Try a widget',
  '<workshop-widget-recommendation version="1">',
  '<widget-id>', 'gesture-playground', '</widget-id>',
  '<target-phrase>', 'Her eyes stretched wide.', '</target-phrase>',
  '<writer-instructions>', 'Explore stillness.', '</writer-instructions>',
  '<surrounding-context>', 'Alice looked past the Hatter.\nHer eyes stretched wide.', '</surrounding-context>',
  '<source-references>', 'none', '</source-references>',
  '<character-notes>', 'Alice is trying not to show it.', '</character-notes>',
  '</workshop-widget-recommendation>'
].join('\n');

