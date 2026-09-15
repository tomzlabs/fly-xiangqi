import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { NeuralEngine } from '../src/brain.mjs';
import { Chess } from '../src/xiangqi.mjs';
const bytes=p=>readFileSync(p);
const manifest=JSON.parse(bytes('public/data/manifest.json'));
const meta=JSON.parse(gunzipSync(bytes('public/data/neurons.json.gz')));
const wasm=JSON.parse(bytes('public/wasm/manifest.json'));
const engine=await NeuralEngine.create(bytes('public/wasm/fly_brain.wasm'),gunzipSync(bytes('public/data/connectome.bin.gz')),meta,manifest,wasm.sha256);
const game=new Chess(); game.move('e3e4');
const fen=game.fen();
const result=await engine.run({fen});
const repeat=await engine.run({fen});
const lesion=await engine.run({fen,transmission:false});
if (result.signalNorm<=0 || !result.selected) throw new Error('No downstream response');
if (lesion.signalNorm!==0 || lesion.outputSpikes!==0) throw new Error('Lesion did not eliminate downstream activity');
if (JSON.stringify(result.outputFeatures)!==JSON.stringify(repeat.outputFeatures) || result.events.some((v,i)=>v!==repeat.events[i])) throw new Error('Determinism failed');
const clean=r=>Object.fromEntries(['fen','selected','computeMs','totalSpikes','activeNeurons','outputSpikes','drivenNeurons','signalNorm'].map(k=>[k,r[k]]));
const report={runtime:process.version,platform:process.platform,neurons:manifest.neurons,edges:manifest.edges,
  graphSha256:manifest.graphSha256,wasmSha256:wasm.sha256,wasmMemoryBytes:engine.e.memory.buffer.byteLength,
  intact:clean(result),disconnected:clean(lesion),repeatIdentical:true};
mkdirSync('docs',{recursive:true});writeFileSync('docs/benchmark.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
