import { mix, hash } from '../brain.mjs';

export const ACTIONS = ['forward', 'left', 'right', 'groom', 'rest'];
export const LABELS = { forward:'向前探索', left:'向左转身', right:'向右转身', groom:'停下梳理', rest:'安静停留' };
export const WORLD_MODEL = 'fly-world-v1-experimental';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// A deliberately engineered sensory/motor adapter, not a validated fly behavior model.
export function sense(s) {
  const sample=angle=> {
    const x=s.x+Math.cos(angle)*0.3,z=s.z+Math.sin(angle)*0.3;
    return Math.exp(-Math.hypot(x-s.food.x,z-s.food.z)/2.5);
  };
  return [sample(s.heading-0.6),sample(s.heading+0.6),
    s.light*(0.55+0.45*Math.cos(s.heading)),s.light*(0.55-0.45*Math.cos(s.heading)),
    clamp((Math.abs(s.x)-3)/1.5,0,1),clamp((Math.abs(s.z)-2)/1.5,0,1),
    1-s.energy,0.35];
}

export class ContinuousBrain {
  constructor(engine, seed=42) {
    this.engine=engine; this.timeMs=0; this.windows=0;
    engine.e.reset(seed,1);
    this.previousCounts=new Uint32Array(engine.meta.outputs.length);
    this.previousIntegral=new Float64Array(engine.meta.outputs.length);
  }
  step(channels, durationMs=120) {
    if(channels.length!==8 || channels.some(x=>!Number.isFinite(x)||x<0||x>1)) throw new Error('Invalid world sensory channels');
    if(durationMs!==120) throw new Error('World window must be 120 ms');
    if(this.timeMs>=400000000) throw new Error('本次模拟已到计时上限，请重新开始');
    const {e,meta,manifest}=this.engine, steps=durationMs/0.1;
    // Positive rates keep the native driven-neuron list stable across windows.
    meta.sensory.forEach((id,i)=>e.set_drive(id,1+179*channels[i%8]));
    e.advance(steps);
    const counts=new Uint32Array(e.memory.buffer,e.counts_ptr(),manifest.neurons);
    const integral=new Float64Array(e.memory.buffer,e.integral_ptr(),manifest.neurons);
    let outputSpikes=0;
    const features=meta.outputs.map((id,i)=> {
      const delta=counts[id]-this.previousCounts[i]; outputSpikes+=delta;
      const value=delta+(integral[id]-this.previousIntegral[i])/(steps*7);
      this.previousCounts[i]=counts[id];this.previousIntegral[i]=integral[id];return value;
    });
    const scores=ACTIONS.map(action=>({action,score:features.reduce((v,f,i)=>v+f*((mix(meta.outputs[i]^hash(action)^0x574f524c)&1)?1:-1),0)/Math.sqrt(features.length)})).sort((a,b)=>b.score-a.score);
    const norm=Math.hypot(...features);
    this.timeMs+=durationMs;this.windows++;
    return {action:norm>1e-8?scores[0].action:'rest',scores,signal:norm,outputSpikes,
      spikes:e.events_len()/2,neuralMs:this.timeMs,windows:this.windows};
  }
}

export function createWorld() { return {time:0,x:-1.8,z:0.8,heading:-0.3,energy:0.8,light:0.7,food:{x:1.4,z:-0.4},action:'rest',distance:0}; }
export function advanceWorld(s, result, dt=0.12) {
  s.action=result.action;s.time+=dt;
  if(s.action==='left')s.heading-=dt*2;
  if(s.action==='right')s.heading+=dt*2;
  s.heading=Math.atan2(Math.sin(s.heading),Math.cos(s.heading));
  if(['forward','left','right'].includes(s.action)) {
    const speed=s.action==='forward'?1.1:0.28;
    const x=clamp(s.x+Math.cos(s.heading)*speed*dt,-4.3,4.3),z=clamp(s.z+Math.sin(s.heading)*speed*dt,-3,3);
    s.distance+=Math.hypot(x-s.x,z-s.z);s.x=x;s.z=z;
  }
  const eating=Math.hypot(s.x-s.food.x,s.z-s.food.z)<0.85;
  s.energy=clamp(s.energy+dt*(eating?0.07:s.action==='rest'?0.001:-0.003),0,1);
  return s;
}
export function snapshot(s,result) { return {...structuredClone(s),neural:result?{...result}:null}; }
export function makeClip(start,end,index) {
  const number=x=>x.toFixed(2);
  return {id:index,model:'sora-2',seconds:'4',size:'1280x720',start,end,
    prompt:`Use case: an ongoing simulated fruit-fly world, clip ${index}.\nScene: the same miniature glass terrarium, dark moss floor, one raspberry moves from (${number(start.food.x)},${number(start.food.z)}) to (${number(end.food.x)},${number(end.food.z)}), warm sunlight intensity changes from ${number(start.light)} to ${number(end.light)} (0 to 1 scale).\nSubject: one tiny Drosophila, amber thorax, striped brown abdomen, red eyes, six legs, translucent wings. Keep the same fly and terrarium in every frame.\nAction: ${end.action}; fly travels from (${number(start.x)},${number(start.z)}) to (${number(end.x)},${number(end.z)}) meters, heading ${number(end.heading)} radians. These are simulation directions, preserve their relative layout.\nCamera: one continuous fixed macro shot, no cuts, same angle as the reference; change lighting only as specified above.\nStyle: cinematic natural-history miniature, shallow depth of field.\nConstraints: continue from the reference frame when provided; no new creatures, no text. This is artistic visualization of simulation, not a recording of subjective experience.`};
}
