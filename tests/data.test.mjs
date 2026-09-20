import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
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
