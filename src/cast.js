// Cast: the model tags who speaks ([v:Name] before a line), the player hides the tag and picks that person's voice.
import { SPEAKER_TAG } from './text.js';
import { CAST_FALLBACKS } from './settings.js';

const FALLBACK = { m: 'male', f: 'female', м: 'male', ж: 'female', male: 'male', female: 'female' };
const NEVER = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA']);

/** 'male' | 'female' for a gender tag, the trimmed name otherwise. */
export const whoKind = who => FALLBACK[String(who ?? '').trim().toLowerCase()] ?? String(who ?? '').trim();

/** The line the player adds to the request, so the model writes the tags. */
export function castPrompt(charName, names = []) {
  const list = [...new Set(names.map(name => String(name ?? '').trim()).filter(Boolean))];
  const known = list.length ? ` Use these names exactly: ${list.join(', ')}.` : '';
  return `[Voice tags for the text-to-speech reader: put a tag right before every spoken line of anyone other than ${charName}, `
    + `glued to the opening quote, like [v:Name]"...".${known} A man not in this list: [v:m]; a woman not in this list: [v:f]. `
    + `${charName}'s own lines and narration get no tag. The tags are invisible to the reader: never mention or explain them.]`;
}

/** The voice set for a role: 'male' / 'female' / 'cast:N' (a row of the open character's list), or null. */
export function roleVoice(settings, charName, role) {
  const cast = settings.cast ?? {};
  if (CAST_FALLBACKS.includes(role)) return cast[role] ?? null;
  const row = /^cast:(\d+)$/.exec(String(role ?? ''));
  if (!row || !charName) return null;
  return (cast.byChar?.[charName] ?? [])[Number(row[1])] ?? null;
}

/** The cast voice for a tagged speaker, or null when nobody in the list has a voice source for it. */
export function pickCastVoice(cast, charName, who) {
  if (!cast?.enabled || !who) return null;
  const kind = whoKind(who);
  if (CAST_FALLBACKS.includes(kind)) return cast[kind]?.source ? cast[kind] : null;
  const rows = (charName ? cast.byChar?.[charName] ?? [] : []).filter(item => item.name.trim());
  const lower = kind.toLowerCase();
  const row = rows.find(item => item.name.trim().toLowerCase() === lower) ?? rows.find(item => lower.startsWith(`${item.name.trim().toLowerCase()} `));
  return row?.source ? row : null;
}

/** Turns every [v:Name] in the text of a rendered message into a hidden mark. Returns how many it hid. */
export function hideTags(root, document) {
  if (!root || !root.textContent.includes('[v:')) return 0;
  const walker = document.createTreeWalker(root, 4);
  const found = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.data.includes('[v:') && !NEVER.has(node.parentNode?.tagName) && !node.parentElement?.closest('code, pre')) found.push(node);
  }
  let hidden = 0;
  for (const node of found) {
    const pieces = [];
    let last = 0;
    for (const match of node.data.matchAll(SPEAKER_TAG)) {
      if (match.index > last) pieces.push(document.createTextNode(node.data.slice(last, match.index)));
      const mark = document.createElement('span');
      mark.className = 'sv-who';
      mark.hidden = true;
      mark.setAttribute('data-sv-who', match[1].trim());
      pieces.push(mark);
      last = match.index + match[0].length;
      hidden += 1;
    }
    if (!pieces.length) continue;
    if (last < node.data.length) pieces.push(document.createTextNode(node.data.slice(last)));
    node.replaceWith(...pieces);
  }
  return hidden;
}

/** Today's counters, started afresh on a new day. */
export function bumpStats(stats, today, field) {
  const fresh = stats?.day === today ? { ...stats } : { day: today, phrases: 0, internet: 0 };
  fresh[field] = (fresh[field] ?? 0) + 1;
  return fresh;
}

export const today = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** "≈ 0.12" when a price per internet phrase is typed, '' otherwise. */
export function costLine(stats, price) {
  const each = Number(String(price ?? '').replace(',', '.'));
  if (!(each > 0) || !stats?.internet) return '';
  const sum = each * stats.internet;
  return `≈ ${sum >= 10 ? sum.toFixed(1) : sum.toFixed(sum >= 1 ? 2 : 3)}`;
}
