/**
 * Lines for the dialogue-is-voice tests (epic decision 26): synthetic
 * sentences written for them, no writer's text. ¶1 is all speech, ¶2 all
 * narration, ¶3 speech and narration, ¶4 speech in single quotation marks,
 * which the shared dialogue matcher reads as narration.
 */
export const STEERING_VOICE_LINES = [
  '“I’m late, I’m really very late,” said the Rabbit, and he hurried on.',
  'The hall was dark, and the door was shut against the cold.',
  '“It’s cold in here,” she said, and the hall was dark.',
  '‘It’s cold in here,’ she said again.'
] as const;
