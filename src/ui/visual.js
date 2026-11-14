// The look: settings.visual becomes CSS variables on the page root (the phrase highlight needs them there too).

export const PRESETS = Object.freeze([
  { id: 'sable', accent: '#8fb6d9', base: null, text: null },
  { id: 'violet', accent: '#b79cf2', base: '#17131f', text: '#ece6f7' },
  { id: 'rose', accent: '#f0a3b8', base: '#1c1418', text: '#f7e9ee' },
  { id: 'mint', accent: '#8fd9b6', base: '#101a17', text: '#e4f3ec' },
  { id: 'amber', accent: '#e8b96a', base: '#1b1610', text: '#f5ecdc' },
  { id: 'paper', accent: '#3a5a8c', base: '#f1ece2', text: '#23201b' },
]);

export function hexToRgb(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex ?? ''));
  return match ? match.slice(1).map(part => parseInt(part, 16)) : null;
}

/** WCAG relative luminance of a #rrggbb colour (0 black … 1 white). */
export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Dark or light text for a filled accent button, whichever has more contrast. */
export const inkFor = hex => (luminance(hex) > 0.36 ? '#10141a' : '#ffffff');

export function rgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb.join(', ')}, ${alpha})` : null;
}

export function applyVisual(visual, root) {
  const set = (name, value) => (value == null ? root.style.removeProperty(name) : root.style.setProperty(name, String(value)));
  set('--sv-accent', visual.accent);
  set('--sv-ink', inkFor(visual.accent));
  set('--sv-accent-soft', rgba(visual.accent, 0.18));
  set('--sv-base', visual.base);
  set('--sv-text', visual.text);
  set('--sv-mark', rgba(visual.mark ?? visual.accent, 0.38));
  set('--sv-opacity', `${Math.round(visual.opacity * 100)}%`);
  set('--sv-blur', `${visual.blur}px`);
  set('--sv-radius', `${visual.radius}px`);
  set('--sv-font', `${visual.fontSize}px`);
  set('--sv-scale', visual.scale);
  set('--sv-bg-image', visual.bgImage ? `url("${visual.bgImage}")` : null);
  set('--sv-bg-dim', visual.bgDim);
  root.dataset.svBg = visual.bgImage ? visual.bgFit : 'none';
  root.dataset.svCover = visual.cover;
  root.dataset.svSpin = visual.spin ? '1' : '0';
}

export function clearVisual(root) {
  for (const name of ['accent', 'ink', 'accent-soft', 'base', 'text', 'mark', 'opacity', 'blur', 'radius', 'font', 'scale', 'bg-image', 'bg-dim']) {
    root.style.removeProperty(`--sv-${name}`);
  }
  delete root.dataset.svBg;
  delete root.dataset.svCover;
  delete root.dataset.svSpin;
}
