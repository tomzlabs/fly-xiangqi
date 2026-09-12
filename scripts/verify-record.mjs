import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { NeuralEngine } from '../src/brain.mjs';
const file=process.argv[2];
if(!file)throw new Error('Usage: node scripts/verify-record.mjs path/to/fly-chess-trial.json');
const record=JSON.parse(readFileSync(file)), trial=record.trial;
if(!trial)throw new Error('Expected a single-trial export');
const manifest=JSON.parse(readFileSync('public/data/manifest.json'));
const wm=JSON.parse(readFileSync('public/wasm/manifest.json'));
assert.equal(trial.graphSha256,manifest.graphSha256,'Dataset differs');
assert.equal(trial.wasmSha256,wm.sha256,'Numerical core differs');
const engine=await NeuralEngine.create(readFileSync('public/wasm/fly_brain.wasm'),
  gunzipSync(readFileSync('public/data/connectome.bin.gz')),
  JSON.parse(gunzipSync(readFileSync('public/data/neurons.json.gz'))),manifest,wm.sha256);
const repeat=await engine.run(trial);
for(const key of ['selected','inputs','outputFeatures','outputCounts','candidates','totalSpikes','activeNeurons'])assert.deepEqual(repeat[key],trial[key],key+' differs');
assert.deepEqual(Array.from(repeat.events),trial.events,'Spike trace differs');
console.log(`Verified ${repeat.totalSpikes} spike events, output features and ${repeat.candidates.length} legal action scores.`);
