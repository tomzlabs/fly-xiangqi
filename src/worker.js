import { NeuralEngine } from './brain.mjs';
import { ContinuousBrain } from './world/simulation.mjs';

let engine, busy=false;
let worldBrain;
const sha = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)), b=>b.toString(16).padStart(2,'0')).join('');
const base=import.meta.env.BASE_URL;
async function get(path) {
  const r=await fetch(base+path);
  if (!r.ok) throw new Error(`数据下载失败：${path} (${r.status})`);
  return r;
}
async function compressed(path, manifest) {
  const r=await get('data/'+path), reader=r.body.getReader(), parts=[];
  const info=manifest.files[path];
  const total=r.headers.get('Content-Encoding')?.includes('gzip')?info.rawBytes:info.bytes;
  let received=0;
  while (true) {
    const {value,done}=await reader.read(); if (done) break;
    parts.push(value); received+=value.byteLength;
    if (path==='connectome.bin.gz') postMessage({type:'loading',received,total});
  }
  const packed=new Uint8Array(received); let offset=0;
  for (const part of parts) { packed.set(part,offset); offset+=part.length; }
  // Static hosts may set Content-Encoding:gzip, in which case fetch already
  // decompressed the body. Verify either representation, never double-decode it.
  let raw;
  if(packed[0]===0x1f&&packed[1]===0x8b) {
    if (await sha(packed)!==info.sha256) throw new Error('压缩数据校验失败：'+path);
    raw=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  } else raw=packed.buffer;
  if(await sha(raw)!==info.rawSha256) throw new Error('数据校验失败：'+path);
  return raw;
}
async function init() {
  if (typeof WebAssembly==='undefined' || typeof DecompressionStream==='undefined') throw new Error('请使用支持 WebAssembly 和 gzip 解压的新版浏览器');
  const [manifest,wm]=await Promise.all([(await get('data/manifest.json')).json(),(await get('wasm/manifest.json')).json()]);
  postMessage({type:'manifest',manifest});
  const [wasm,graph,metadata,positions]=await Promise.all([
    (await get('wasm/fly_brain.wasm')).arrayBuffer(),
    compressed('connectome.bin.gz',manifest),compressed('neurons.json.gz',manifest),compressed('neurons.bin.gz',manifest)
  ]);
  if (await sha(wasm)!==wm.sha256 || await sha(graph)!==manifest.graphSha256) throw new Error('计算核心或连接图 SHA-256 校验失败');
  postMessage({type:'loading',received:manifest.compressedBytes,total:manifest.compressedBytes,phase:'正在初始化完整网络…'});
  const meta=JSON.parse(new TextDecoder().decode(metadata));
  engine=await NeuralEngine.create(wasm,graph,meta,manifest,wm.sha256);
  postMessage({type:'ready',manifest,positions,wasmSha256:wm.sha256,memoryBytes:engine.e.memory.buffer.byteLength},[positions]);
}
self.onmessage=async ({data}) => {
  if (busy) return;
  busy=true;
  try {
    if (data.type==='init') await init();
    else if(data.type==='world-start' && engine) {
      worldBrain=new ContinuousBrain(engine,data.seed||42);
      postMessage({type:'world-started'});
    }
    else if(data.type==='world-step' && worldBrain) {
      const result=worldBrain.step(data.channels);
      postMessage({type:'world-result',result});
    }

  } catch (error) { postMessage({type:'error',id:data.id,message:error.message}); }
  finally { busy=false; }
};
