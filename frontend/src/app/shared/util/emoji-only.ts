/**
 * src/app/shared/util/emoji-only.ts
 * Detects a message that is only one to three emoji, which the chat draws big (like WhatsApp does).
 */

/** One emoji: a pictographic character with an optional variation selector or skin tone, joined with others by ZWJ. */
const EMOJI =
  /^(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*){1,3}$/u;

/** True when the text (ignoring spaces at both ends) is only one to three emoji. */
export function isOnlyEmoji(text: string): boolean {
  return EMOJI.test(text.trim());
}
