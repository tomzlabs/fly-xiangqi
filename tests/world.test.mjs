import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,sense,advanceWorld,snapshot,makeClip,ContinuousBrain} from '../src/world/simulation.mjs';

test('environment changes affect bounded sensory inputs',()=>{
  const s=createWorld(),before=sense(s);s.light=0;s.food={x:-3,z:2};s.energy=0;
  const after=sense(s);assert.equal(after.length,8);assert(after.every(x=>x>=0&&x<=1));assert.notDeepEqual(before,after);assert.equal(after[2],0);assert.equal(after[3],0);assert.equal(after[6],1);
});
test('world motion stays bounded, rest stops translation, snapshots are independent',()=>{
  const s=createWorld();s.heading=0;const before=snapshot(s);for(let i=0;i<200;i++)advanceWorld(s,{action:'forward'});
  assert.equal(s.x,4.3);assert(s.energy>=0&&s.energy<=1);const x=s.x,z=s.z;advanceWorld(s,{action:'rest'});assert.equal(s.x,x);assert.equal(s.z,z);s.food.x=99;assert.equal(before.food.x,1.4);
});
test('clip plan carries changes to the environment and actual action',()=>{
  const a=createWorld(),b=createWorld();b.food={x:-2,z:-1.3};b.light=.15;b.action='left';const clip=makeClip(a,b,7);
  assert.match(clip.prompt,/\(-2.00,-1.30\)/);assert.match(clip.prompt,/0.15/);assert.match(clip.prompt,/Action: left/);assert.equal(clip.id,7);
});
test('invalid sensory requests fail before advancing the native model',()=>{
  let advances=0;const e={reset(){},advance(){advances++}};const brain=new ContinuousBrain({e,meta:{outputs:[]}});
  assert.throws(()=>brain.step([NaN]));assert.throws(()=>brain.step(Array(8).fill(2)));assert.throws(()=>brain.step(Array(8).fill(.5),60));assert.equal(advances,0);
});
