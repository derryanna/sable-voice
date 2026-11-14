// What to read: a rendered message becomes a flat text with a kind per character (narration, speech, thought, skip),
// then a list of short phrases for the voice. The text maps 1:1 onto the message's text nodes, so a phrase can be
// highlighted and a tapped place can be found again. No browser globals: the caller passes the element.

export const KIND = Object.freeze({ NARRATION: 0, SPEECH: 1, THOUGHT: 2, SKIP: 9 });

// Space look-alikes (no-break, figure space, braille blank, ideographic…). One character in, one out.
const BLANKS = /[   -   ⠀　ㅤ]/g;
export const normalizeBlanks = value => String(value).replace(BLANKS, ' ');

const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'TR', 'TD', 'TH', 'PRE',
  'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'FIGCAPTION', 'DL', 'DT', 'DD', 'DETAILS', 'SUMMARY', 'CENTER']);
const NEVER_TAGS = new Set(['SCRIPT', 'STYLE', 'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'BUTTON', 'SELECT',
  'TEXTAREA', 'INPUT', 'NOSCRIPT', 'TEMPLATE', 'CUSTOM-STYLE']);

export const parseList = value => String(value ?? '').split(/[,\n]/).map(item => item.trim()).filter(Boolean);

/**
 * Walks a rendered message. Returns { text, kinds[], nodes[{node,start,end}], blocks[{el,start,end}], rules[] }:
 * `blocks` are lines/paragraphs (ranges of `text`), `rules` are the text positions of horizontal rules.
 * options: tags (names never read), selectors (CSS, never read), code (skip code), asterisk ('thought' | 'narration').
 */
export function readDom(root, options = {}) {
  const tags = new Set(parseList(options.tags).map(tag => tag.replace(/[<>/]/g, '').toUpperCase()));
  const selectors = parseList(options.selectors);
  const italic = options.asterisk === 'narration' ? KIND.NARRATION : KIND.THOUGHT;
  const doc = { text: '', kinds: [], nodes: [], blocks: [], rules: [] };
  let open = null;
  const closeBlock = end => {
    if (!open) return;
    if (end > open.start) doc.blocks.push({ el: open.el, start: open.start, end });
    open = null;
  };
  const boundary = () => {
    if (!open) return;
    closeBlock(doc.text.length);
    doc.text += '\n';
    doc.kinds.push(KIND.SKIP);
  };
  const skipped = el => NEVER_TAGS.has(el.tagName) || tags.has(el.tagName) || el.hidden === true
    || (options.code !== false && (el.tagName === 'CODE' || el.tagName === 'PRE'))
    || selectors.some(selector => { try { return el.matches(selector); } catch { return false; } });
  const addText = (node, blockEl, kind) => {
    const data = normalizeBlanks(node.data ?? '');
    if (!data || (!open && !data.trim())) return;
    const base = doc.text.length;
    doc.nodes.push({ node, start: base, end: base + data.length });
    doc.text += data;
    for (let index = 0; index < data.length; index++) {
      const char = data[index];
      if (char === '\n') { closeBlock(base + index); doc.kinds.push(KIND.SKIP); continue; }
      if (!open && char.trim()) open = { el: blockEl, start: base + index };
      doc.kinds.push(open ? kind : KIND.SKIP);
    }
  };
  const walk = (parent, blockEl, kind) => {
    for (const child of parent.childNodes) {
      if (child.nodeType === 3) { addText(child, blockEl, kind); continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName;
      if (tag === 'BR') { boundary(); continue; }
      if (tag === 'HR') { boundary(); doc.rules.push(doc.text.length); continue; }
      const block = BLOCK_TAGS.has(tag);
      if (skipped(child)) { if (block || tags.has(tag)) boundary(); continue; }
      if (block) { boundary(); walk(child, child, kind); boundary(); continue; }
      const inner = tag === 'Q' ? KIND.SPEECH : (tag === 'EM' || tag === 'I') && kind !== KIND.SPEECH ? italic : kind;
      walk(child, blockEl, inner);
    }
  };
  walk(root, root, KIND.NARRATION);
  boundary();
  return doc;
}

const QUOTES = /"[^"\n]+"|“[^”\n]+”|«[^»\n]+»|„[^“”\n]+[“”]|「[^」\n]+」|『[^』\n]+』|＂[^＂\n]+＂/g;
const OOC = [/\[\s*OOC\b[^\]]*(?:\]|$)/gi, /\(\(\s*OOC\b[\s\S]*?\)\)/gi, /\(\s*OOC\b[^)]*\)/gi];
const LINKS = /\bhttps?:\/\/\S+/gi;
const PROSE_START = /^[\s]*[\p{L}\p{N}"«“„—–-]/u;

/** User patterns, one per line: `/body/flags` or plain text of a regular expression. Broken lines are ignored. */
export function parsePatterns(value) {
  const patterns = [];
  for (const line of String(value ?? '').split('\n')) {
    const source = line.trim();
    if (!source) continue;
    const literal = /^\/(.+)\/([a-z]*)$/i.exec(source);
    try {
      const flags = literal ? [...new Set(`${literal[2]}g`)].join('') : 'gi';
      patterns.push(new RegExp(literal ? literal[1] : source, flags));
    } catch { /* a pattern that does not compile reads nothing out */ }
  }
  return patterns;
}

function mark(doc, pattern, kind, from = 0, to = doc.text.length) {
  pattern.lastIndex = 0;
  const slice = doc.text.slice(from, to);
  for (const match of slice.matchAll(pattern)) {
    if (!match[0]) continue;
    for (let index = from + match.index; index < from + match.index + match[0].length; index++) {
      if (doc.kinds[index] !== KIND.SKIP) doc.kinds[index] = kind;
    }
  }
}

/**
 * Applies the reading rules to a doc from readDom (in place): quoted text is speech, OOC / links / user patterns and
 * a tracker footer after the last rule are skipped, kinds the reader turned off are skipped.
 */
export function applyRules(doc, options = {}) {
  const skip = options.skip ?? {};
  const read = options.read ?? {};
  for (const block of doc.blocks) mark(doc, QUOTES, KIND.SPEECH, block.start, block.end);
  if (skip.ooc !== false) for (const pattern of OOC) mark(doc, pattern, KIND.SKIP);
  if (skip.links !== false) mark(doc, LINKS, KIND.SKIP);
  for (const pattern of parsePatterns(skip.regex)) mark(doc, pattern, KIND.SKIP);
  if (skip.footer !== false && doc.rules.length) {
    const from = doc.rules.at(-1);
    const tail = doc.blocks.filter(block => block.start >= from);
    // A footer is a block of tracker lines: each starts with an emoji, a bullet or a bracket, none with a word.
    if (tail.length && tail.every(block => !PROSE_START.test(doc.text.slice(block.start, block.end)))) {
      for (let index = from; index < doc.kinds.length; index++) doc.kinds[index] = KIND.SKIP;
    }
  }
  const off = [];
  if (read.narration === false) off.push(KIND.NARRATION);
  if (read.speech === false) off.push(KIND.SPEECH);
  if (read.thoughts === false) off.push(KIND.THOUGHT);
  if (off.length) for (let index = 0; index < doc.kinds.length; index++) if (off.includes(doc.kinds[index])) doc.kinds[index] = KIND.SKIP;
  return doc;
}

/** What the voice is given: no emoji, no markup leftovers, no quote marks, single spaces. */
export function speakable(value) {
  return String(value)
    .replace(/[​-‍⁠﻿­︎️]/g, '')
    .replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}]/gu, ' ')
    .replace(/<3+|&lt;3+/g, ' ')
    .replace(/["«»“”„‟「」『』＂]/g, ' ')
    .replace(/[*_~`#|<>\\^=]+/g, ' ')
    .replace(/[-–—]{2,}/g, ' — ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:…])/g, '$1')
    .replace(/^[\s,;:—–-]+/, '')
    .trim();
}

const HAS_WORD = /[\p{L}\p{N}]/u;
const SENTENCE_END = /[.!?…]+["»”’)\]]*(?=\s|$)/g;

/** Splits text[start,end) into ranges no longer than `max`: whole sentences glued while they fit, long ones cut at a comma or a space. */
export function splitRun(text, start, end, max = 180) {
  const sentences = [];
  let cursor = start;
  SENTENCE_END.lastIndex = 0;
  const slice = text.slice(start, end);
  for (const match of slice.matchAll(SENTENCE_END)) {
    const stop = start + match.index + match[0].length;
    sentences.push([cursor, stop]);
    cursor = stop;
  }
  if (cursor < end) sentences.push([cursor, end]);
  const pieces = [];
  for (let [from, to] of sentences) {
    while (to - from > max) {
      const window = text.slice(from, from + max);
      let cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '), window.lastIndexOf(' — '), window.lastIndexOf(' – '));
      if (cut < max * 0.4) cut = window.lastIndexOf(' ');
      cut = cut < max * 0.4 ? max : cut + 1;
      pieces.push([from, from + cut]);
      from += cut;
    }
    pieces.push([from, to]);
  }
  const ranges = [];
  for (const [from, to] of pieces) {
    const last = ranges.at(-1);
    if (last && to - last.start <= max) last.end = to;
    else ranges.push({ start: from, end: to });
  }
  for (const range of ranges) {
    while (range.start < range.end && !text[range.start].trim()) range.start += 1;
    while (range.end > range.start && !text[range.end - 1].trim()) range.end -= 1;
  }
  return ranges.filter(range => range.end > range.start);
}

/** Phrases for the voice: [{ start, end, kind, block, text }], in reading order. `block` is the index into doc.blocks. */
export function buildChunks(doc, { max = 180 } = {}) {
  const chunks = [];
  doc.blocks.forEach((block, blockIndex) => {
    let runStart = -1;
    let runKind = KIND.SKIP;
    const close = end => {
      if (runStart < 0) return;
      for (const range of splitRun(doc.text, runStart, end, max)) {
        const spoken = speakable(doc.text.slice(range.start, range.end));
        if (HAS_WORD.test(spoken)) chunks.push({ start: range.start, end: range.end, kind: runKind, block: blockIndex, text: spoken });
      }
      runStart = -1;
    };
    for (let index = block.start; index <= block.end; index++) {
      const kind = index < block.end ? doc.kinds[index] : KIND.SKIP;
      if (kind === runKind && runStart >= 0) continue;
      close(index);
      if (kind !== KIND.SKIP) runStart = index;
      runKind = kind;
    }
  });
  return chunks;
}

/** Whole pipeline for one rendered message element. */
export function readMessage(root, settings = {}) {
  const skip = settings.skip ?? {};
  const doc = applyRules(readDom(root, { tags: skip.tags, selectors: skip.selectors, code: skip.code, asterisk: settings.asterisk }), settings);
  return { doc, chunks: buildChunks(doc, { max: settings.chunkChars ?? 180 }) };
}

function nodeAt(doc, index) {
  let low = 0;
  let high = doc.nodes.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const entry = doc.nodes[middle];
    if (index < entry.start) high = middle - 1;
    else if (index >= entry.end) low = middle + 1;
    else return entry;
  }
  return null;
}

/** A DOM Range over text[start,end), or null when the text nodes are gone (the message was re-rendered). */
export function rangeFor(doc, start, end, document) {
  const first = nodeAt(doc, start);
  const last = nodeAt(doc, Math.max(start, end - 1));
  if (!first || !last || !first.node.isConnected || !last.node.isConnected) return null;
  try {
    const range = document.createRange();
    range.setStart(first.node, Math.min(start - first.start, first.node.data.length));
    range.setEnd(last.node, Math.min(end - last.start, last.node.data.length));
    return range;
  } catch { return null; }
}

/** Index of the phrase at (or first after) a place in a text node; -1 when the node is not part of the doc. */
export function chunkAt(doc, chunks, node, offset = 0) {
  const entry = doc.nodes.find(item => item.node === node);
  if (!entry) return -1;
  const position = entry.start + Math.max(0, Math.min(offset, entry.end - entry.start));
  const index = chunks.findIndex(chunk => chunk.end > position);
  return index < 0 ? chunks.length - 1 : index;
}

/** 'ru', 'ja', 'zh', 'ko' or 'en' by the letters in the text; `fallback` when it has no letters to judge by. */
export function detectLang(value, fallback = 'en') {
  const sample = String(value).slice(0, 400);
  const count = pattern => (sample.match(pattern) ?? []).length;
  const scores = { ru: count(/[Ѐ-ӿ]/g), ja: count(/[぀-ヿ]/g) * 2, ko: count(/[가-힯]/g), zh: count(/[一-鿿]/g), en: count(/[A-Za-z]/g) };
  const [best, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return score > 0 ? best : fallback;
}
