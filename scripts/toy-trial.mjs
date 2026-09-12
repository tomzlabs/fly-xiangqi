import { readFileSync } from 'node:fs';
const {instance:{exports:e}}=await WebAssembly.instantiate(readFileSync('public/wasm/fly_brain.wasm'));
const n=4, pre=[0,0,1,3],post=[1,3,2,2],weights=[100,-80,100,20], offsets=[0,2,3,3,4];
const bytes=Buffer.alloc(12+(n+1)*4+post.length*6);
bytes.write('FLY1');bytes.writeUInt32LE(n,4);bytes.writeUInt32LE(post.length,8);
offsets.forEach((x,i)=>bytes.writeUInt32LE(x,12+i*4));
post.forEach((x,i)=>bytes.writeUInt32LE(x,12+(n+1)*4+i*4));
weights.forEach((x,i)=>bytes.writeInt16LE(x,12+(n+1)*4+post.length*4+i*2));
const ptr=e.allocate_input(bytes.length);new Uint8Array(e.memory.buffer,ptr,bytes.length).set(bytes);e.load_graph();
e.reset(42,1);e.set_drive(0,500);e.advance(2000);
console.log(JSON.stringify({n,pre,post,weights,seed:42,rate:500,steps:2000,
  events:Array.from(new Uint32Array(e.memory.buffer,e.events_ptr(),e.events_len())),
  voltage:Array.from(new Float64Array(e.memory.buffer,e.voltage_ptr(),n)),
  counts:Array.from(new Uint32Array(e.memory.buffer,e.counts_ptr(),n))}));
