// Original compact vector chess silhouettes, in a shared 48-unit coordinate space.
const bodies={
  p:'M18 32c0-5 3-7 3-10a7 7 0 1 1 6 0c0 3 3 5 3 10z',
  r:'M16 32V19l-3-3V8h6v5h3V8h4v5h3V8h6v8l-3 3v13z',
  n:'M14 32c0-7 3-11 10-15l-6 2-6-3 6-8 6 1 3-5 4 9c5 6 6 12 5 19z',
  b:'M16 32c1-5 5-7 5-10-9-6-4-12 3-18 7 6 12 12 3 18 0 3 4 5 5 10z M20 11l6 6',
  q:'M16 32 11 13l8 5 5-11 5 11 8-5-5 19z',
  k:'M18 32c0-5-7-10-5-15 2-4 7-2 11 2 4-4 9-6 11-2 2 5-5 10-5 15z M24 5v13M19 10h10',
};
export function pieceSvg(type,color) {
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="piece ${color}"><g fill="${color==='w'?'#fafbff':'#30354f'}" stroke="${color==='w'?'#626480':'#20253f'}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="${bodies[type]}"/><path d="M15 32h18v4H15zM12 36h24l2 5H10z"/>${type==='n'?'<circle cx="24" cy="14" r="1.4" fill="#b4adc9" stroke="none"/>':''}${type==='q'?'<circle cx="10" cy="11" r="2.4"/><circle cx="24" cy="6" r="2.4"/><circle cx="38" cy="11" r="2.4"/>':''}</g></svg>`;
}
export const pieceNames={p:'兵',r:'车',n:'马',b:'象',q:'后',k:'王'};
