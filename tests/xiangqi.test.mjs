import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess, START_FEN} from '../src/xiangqi.mjs';
const idx=s=>s.charCodeAt(0)-97+Number(s[1])*9;
function position(pieces,side='w'){
  const c=new Chess();c.cells=Array(90).fill(null);c.side=side;
  for(const [s,p] of Object.entries({d0:'K',f9:'k',...pieces}))c.cells[idx(s)]={type:p.toLowerCase(),color:p===p.toUpperCase()?'w':'b'};
  c.positions=[c.key()];return c;
}
const targets=(c,s)=>c.moves({square:s,verbose:true}).map(m=>m.to);
test('initial board has 32 pieces, 44 moves and 1920 two-ply continuations',()=>{
  const c=new Chess();assert.equal(c.board().flat().filter(Boolean).length,32);assert.equal(c.moves().length,44);
  let count=0;for(const m of c.moves({verbose:true})){c.move(m);count+=c.moves().length;c.undo();}
  assert.equal(count,1920);assert.equal(c.fen(),START_FEN);
});
test('horse legs block only their associated jumps',()=>{
  const c=position({e4:'N',e5:'P'});const t=targets(c,'e4');assert(!t.includes('d6'));assert(!t.includes('f6'));assert(t.includes('g5'));assert(t.includes('c5'));
});
test('elephant eye and river restriction apply to both colors',()=>{
  const c=position({e2:'B',f3:'P'});assert(!targets(c,'e2').includes('g4'));assert(targets(c,'e2').includes('c4'));
  const d=position({e4:'B'});assert(!targets(d,'e4').includes('g6'));
  const b=position({e5:'b'},'b');assert(!targets(b,'e5').includes('g3'));assert(targets(b,'e5').includes('g7'));
});
test('cannon must jump exactly one screen to capture, cannot jump to empty points',()=>{
  const c=position({a2:'C',a4:'P',a7:'r'});assert(targets(c,'a2').includes('a7'));assert(!targets(c,'a2').includes('a5'));assert(targets(c,'a2').includes('a3'));
  c.cells[idx('a4')]=null;assert(!targets(c,'a2').includes('a7'));
  c.cells[idx('a4')]={type:'p',color:'w'};c.cells[idx('a5')]={type:'p',color:'b'};assert(!targets(c,'a2').includes('a7'));
});
test('rook cannot pass occupied squares and cannot capture friendly pieces',()=>{
  const c=position({a2:'R',a4:'P',c2:'p'});assert(!targets(c,'a2').includes('a4'));assert(!targets(c,'a2').includes('a5'));assert(targets(c,'a2').includes('c2'));assert(!targets(c,'a2').includes('d2'));
});
test('pawns move forward and gain lateral moves only after crossing',()=>{
  const c=position({a4:'P'});assert.deepEqual(targets(c,'a4'),['a5']);
  const d=position({a5:'P'});assert.deepEqual(targets(d,'a5').sort(),['a6','b5']);
  const b=position({a5:'p'},'b');assert.deepEqual(targets(b,'a5'),['a4']);
  const last=position({a9:'P'});assert.deepEqual(targets(last,'a9'),['b9']);
});
test('advisors and generals are confined to their palaces',()=>{
  const c=position({e1:'A'});assert.deepEqual(targets(c,'e1').sort(),['d2','f0','f2']);
  assert(!targets(c,'d0').includes('c0'));assert(!targets(c,'d0').includes('e1'));
});
test('moving a screen cannot expose facing generals',()=>{
  const c=new Chess('4k4/9/9/9/4P4/9/9/9/9/4K4 w - - 0 1');
  assert(!targets(c,'e5').includes('d5'));assert(targets(c,'e5').includes('e6'));assert(!targets(c,'e5').includes('e9'));
});
test('self check is rejected and checking pieces are highlighted through state',()=>{
  const c=position({d8:'r',d3:'R'});assert(!targets(c,'d3').includes('e3'));assert(targets(c,'d3').includes('d8'));
  c.cells[idx('d3')]=null;assert(c.isCheck());
});
test('checkmate and stalemate are both terminal losses, not automatic material draws',()=>{
  const mate=new Chess('R3k4/4R4/9/9/9/9/9/9/9/4K4 b - - 0 1');
  assert(mate.isCheckmate());assert(mate.isGameOver());assert(!mate.isDraw());
  const stale=new Chess('4k4/3R1R3/9/9/4P4/9/9/9/9/4K4 b - - 0 1');
  assert(stale.isStalemate());assert(stale.isGameOver());assert(!stale.isDraw());
});
test('Chinese notation, capture, undo and FEN roundtrip preserve state',()=>{
  const c=new Chess();assert.equal(c.move('h2e2').san,'炮二平五');assert.equal(c.move('b9c7').san,'马2进3');
  const fen=c.fen();assert.equal(new Chess(fen).fen(),fen);c.undo();c.undo();assert.equal(c.fen(),START_FEN);
  const d=position({a2:'C',a4:'P',a7:'r'}),before=d.fen();assert.equal(d.move('a2a7').captured,'r');d.undo();assert.equal(d.fen(),before);
});
test('invalid FEN and illegal moves do not mutate the game',()=>{
  const c=new Chess();for(const fen of ['invalid','9/9/9/9/9/9/9/9/9/9 w - - 0 1','4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1',START_FEN.replace('RNBAKABNR','RNBAKABN1')+'extra'])assert.throws(()=>c.load(fen));
  assert.throws(()=>c.move('e3d3'));assert.equal(c.fen(),START_FEN);
});
test('experiment repetition and no-capture draw can be undone',()=>{
  const c=new Chess();for(let n=0;n<2;n++)for(const move of ['b0c2','b9c7','c2b0','c7b9'])c.move(move);
  assert(c.isThreefoldRepetition());assert(c.isGameOver());c.undo();assert(!c.isDraw());
  const d=new Chess(START_FEN.replace('0 1','119 1'));d.move('b0c2');assert(d.isDraw());d.undo();assert(!d.isDraw());
});
