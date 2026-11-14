// A voice description for a character, written by the tavern's own model from the card.

const CARD_LIMIT = 6000;
const ANSWER_LIMIT = 300;

export const SUGGEST_SYSTEM = 'You describe speaking voices for a text-to-speech engine. '
  + 'Read the character card and answer with one or two short English sentences that describe only how this character\'s voice sounds: '
  + 'gender, age, pitch, timbre, pace, manner of speaking. No name, no appearance, no story, no quotes, no lists. Answer with the description only.';

/** The request text: the card fields that say who the character is, cut to a sane length. */
export function suggestPrompt(card = {}) {
  const parts = [
    ['Name', card.name],
    ['Description', card.description],
    ['Personality', card.personality],
    ['Example of speech', card.mes_example],
  ].filter(([, value]) => typeof value === 'string' && value.trim());
  const text = parts.map(([label, value]) => `${label}: ${value.trim()}`).join('\n\n').slice(0, CARD_LIMIT);
  return text ? `${text}\n\nDescribe this character's voice.` : '';
}

/** The model's answer as one clean line: no thinking blocks, markup, wrapping quotes or runaway length. */
export function cleanSuggestion(raw) {
  let text = String(raw ?? '')
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(voice( description)?|description)\s*:\s*/i, '')
    .replace(/^["'“«]+|["'”»]+$/g, '')
    .trim();
  if (text.length > ANSWER_LIMIT) {
    const cut = text.slice(0, ANSWER_LIMIT);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
    text = end > 80 ? cut.slice(0, end + 1) : cut.trim();
  }
  return text;
}
