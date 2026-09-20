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
}
