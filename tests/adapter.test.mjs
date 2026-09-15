import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Chess } from '../src/xiangqi.mjs';
import { encodeBoard, rankMoves } from '../src/brain.mjs';

test('board encoder distinguishes pieces, location and side to move without a chess evaluation',()=>{
  const sensory=Array.from({length:1260},(_,i)=>i),chess=new Chess();
  const before=encodeBoard(chess.fen(),sensory);assert.equal(before.length,32);
  chess.move('e3e4');const after=encodeBoard(chess.fen(),sensory);assert.equal(after.length,32);
  assert.notDeepEqual(before,after);
  assert(before.every(x=>x.hz===180));assert(after.every(x=>x.hz===180));
});
test('zero neural signal refuses to invent a move',()=>{
  const result=rankMoves(new Chess().fen(),[1,2,3],[0,0,0]);
  assert.equal(result.selected,null);assert.equal(result.signalNorm,0);
  assert(result.candidates.every(x=>x.score===0));
});
test('readout is causally responsive and only ranks legal moves',()=>{
  const chess=new Chess(),outputs=[45,73,91,112],features=[4,.2,1,2];
  const first=rankMoves(chess.fen(),outputs,features);
  const reversed=rankMoves(chess.fen(),outputs,features.map(x=>-x));
  assert.notEqual(first.selected.uci,reversed.selected.uci);
  const legal=new Set(chess.moves({verbose:true}).map(m=>m.from+m.to));
  assert(first.candidates.every(m=>legal.has(m.uci)));
});
test('terminal Xiangqi positions return no candidate',()=>{
  assert.equal(rankMoves('R3k4/4R4/9/9/9/9/9/9/9/4K4 b - - 0 1',[1],[1]).selected,null);
});
test('distributed data and WASM match the manifest hashes',()=>{
  const sha=x=>createHash('sha256').update(x).digest('hex');
  const m=JSON.parse(readFileSync('public/data/manifest.json'));
  for(const [path,info] of Object.entries(m.files))assert.equal(sha(readFileSync('public/data/'+path)),info.sha256);
  const graph=gunzipSync(readFileSync('public/data/connectome.bin.gz'));
  assert.equal(sha(graph),m.graphSha256);
  assert.equal(graph.readUInt32LE(4),m.neurons);assert.equal(graph.readUInt32LE(8),m.edges);
  const w=JSON.parse(readFileSync('public/wasm/manifest.json'));
  assert.equal(sha(readFileSync('public/wasm/fly_brain.wasm')),w.sha256);
});
