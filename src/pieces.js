import { names } from './xiangqi.mjs';
export function pieceSvg(type,color) {
  const ink=color==='w'?'#aa3f35':'#303d3b';
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="piece ${color}"><circle cx="24" cy="25" r="21" fill="#c9a77a"/><circle cx="24" cy="23" r="20.5" fill="#fff1d7" stroke="${ink}" stroke-width="1.1"/><circle cx="24" cy="23" r="17.3" fill="none" stroke="${ink}" stroke-width=".6"/><text x="24" y="32" text-anchor="middle" fill="${ink}" font-family="Kaiti SC, STKaiti, KaiTi, serif" font-size="27" font-weight="600">${names[color][type]}</text></svg>`;
}
