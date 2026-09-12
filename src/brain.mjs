import { Chess } from 'chess.js';

export const MODEL = Object.freeze({ id: 'fly-chess-lif-v1', dtMs: 0.1, restMv: -52, thresholdMv: -45,
  tauMembraneMs: 20, tauSynapseMs: 5, refractoryMs: 2.2, delayMs: 1.8, weightMv: 0.275,
  inputMv: 68.75, inputHz: 180, adapter: 'piece-square-v1', readout: 'fixed-projection-v1-untrained' });

export function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0 || 1;
}
export function mix(x) {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

export function encodeBoard(fen, sensory) {
  const chess = new Chess(fen), active = new Uint8Array(768);
  for (const row of chess.board()) for (const piece of row) if (piece) {
    const square = piece.square.charCodeAt(0) - 97 + (Number(piece.square[1])-1)*8;
    const channel = 'pnbrqk'.indexOf(piece.type) + (piece.color === chess.turn() ? 0 : 6);
    active[square*12+channel] = 1;
  }
  return sensory.flatMap((id, index) => active[index % 768] ? [{ id, hz: MODEL.inputHz, channel: index % 768 }] : []);
}

export function rankMoves(fen, outputs, features) {
  const moves = new Chess(fen).moves({ verbose: true });
  const norm = Math.sqrt(features.reduce((sum, x) => sum+x*x, 0));
  const candidates = moves.map(move => {
    const uci = move.from + move.to + (move.promotion || '');
    const action = hash(uci);
    let score = 0;
    for (let i=0; i<outputs.length; i++) {
      const weight = (mix(outputs[i] ^ action ^ 0x43534831) & 1) ? 1 : -1;
      score += weight * features[i];
    }
    return { uci, san: move.san, score: score / Math.sqrt(outputs.length) };
  }).sort((a,b) => b.score-a.score || (a.uci<b.uci?-1:a.uci>b.uci?1:0));
  return { candidates, selected: norm > 1e-8 ? candidates[0] || null : null, signalNorm: norm };
}

export class NeuralEngine {
  static async create(wasm, graph, meta, manifest, wasmSha256) {
    const { instance } = await WebAssembly.instantiate(wasm, {});
    const e = instance.exports;
    const bytes = new Uint8Array(graph);
    const pointer = e.allocate_input(bytes.length);
    new Uint8Array(e.memory.buffer, pointer, bytes.length).set(bytes);
    if (e.load_graph() !== manifest.neurons) throw new Error('连接图格式或神经元数量不匹配');
    return new NeuralEngine(e, meta, manifest, wasmSha256);
  }
  constructor(e, meta, manifest, wasmSha256) {
    this.e=e; this.meta=meta; this.manifest=manifest; this.wasmSha256=wasmSha256;
  }
  async run({ fen, seed=42, durationMs=120, transmission=true }, onChunk=()=>{}, yieldTask=async()=>{}) {
    new Chess(fen); // Reject malformed positions before touching simulation state.
    if (!Number.isInteger(seed) || seed<1 || seed>0xffffffff) throw new Error('种子必须为 1 至 4294967295 的整数');
    if (![60,120,240].includes(durationMs)) throw new Error('不支持的模拟时长');
    const { e, meta, manifest } = this, n=manifest.neurons;
    e.reset(seed, transmission ? 1 : 0);
    const inputs=encodeBoard(fen,meta.sensory);
    for (const {id,hz} of inputs) e.set_drive(id,hz);
    const steps=Math.round(durationMs/MODEL.dtMs), events=[], chunks=[];
    let computeMs=0;
    for (let step=0; step<steps; step+=50) {
      const start=performance.now(); e.advance(Math.min(50,steps-step)); computeMs+=performance.now()-start;
      const pairs=new Uint32Array(e.memory.buffer,e.events_ptr(),e.events_len()).slice();
      events.push(pairs);
      const end=Math.min(step+50,steps);
      const counts=new Uint32Array(e.memory.buffer,e.counts_ptr(),n);
      let total=0, active=0; for (const x of counts) { total+=x; if (x) active++; }
      let outputSpikes=0; for (const i of meta.outputs) outputSpikes+=counts[i];
      const chunk={ step:end, simulationMs:end*MODEL.dtMs, totalSpikes:total, activeNeurons:active, outputSpikes, computeMs,
        // One event for every actual threshold crossing. No fabricated visual activity.
        events:pairs };
      chunks.push({ simulationMs:chunk.simulationMs, spikes:pairs.length/2 });
      onChunk(chunk); await yieldTask();
    }
    const counts=new Uint32Array(e.memory.buffer,e.counts_ptr(),n);
    const integral=new Float64Array(e.memory.buffer,e.integral_ptr(),n);
    const outputFeatures=meta.outputs.map(i => counts[i]+integral[i]/(steps*7));
    const outputCounts=meta.outputs.map(i => counts[i]);
    const ranking=rankMoves(fen,meta.outputs,outputFeatures);
    const totalSpikes=counts.reduce((a,b)=>a+b,0);
    const activeNeurons=counts.reduce((a,b)=>a+(b>0),0);
    const flat=new Uint32Array(events.reduce((n,x)=>n+x.length,0)); let cursor=0;
    for (const chunk of events) { flat.set(chunk,cursor); cursor+=chunk.length; }
    return { version:1, fen, seed, durationMs, transmission, computeMs, totalSpikes, activeNeurons,
      outputSpikes:outputCounts.reduce((a,b)=>a+b,0), drivenNeurons:inputs.length,
      model:MODEL, graphSha256:manifest.graphSha256, wasmSha256:this.wasmSha256,
      ...ranking, inputs, outputIndices:meta.outputs, outputRootIds:meta.outputs.map(i=>meta.ids[i]),
      outputCounts, outputFeatures, chunks, events:flat,
      note:'Untrained fixed linear projection of simulated output activity; chess.js only supplies legal moves. No search, material score, mate assistance, or chess engine.' };
  }
}
