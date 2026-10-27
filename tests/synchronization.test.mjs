import test from 'node:test';
import assert from 'node:assert/strict';
import {overlap} from '../lib/model.ts';
test('aligned recordings use the shortest duration',()=>assert.deepEqual(overlap([{duration:20,offset:0},{duration:18,offset:0},{duration:22,offset:0}]),{start:0,end:18,duration:18}));
test('positive wrist offset trims its end',()=>assert.deepEqual(overlap([{duration:20,offset:0},{duration:18,offset:2},{duration:22,offset:0}]),{start:0,end:16,duration:16}));
test('negative offset trims the beginning of the shared timeline',()=>assert.deepEqual(overlap([{duration:20,offset:0},{duration:18,offset:-3},{duration:22,offset:2}]),{start:3,end:20,duration:17}));
test('nonoverlapping recordings produce zero duration',()=>assert.equal(overlap([{duration:2,offset:0},{duration:2,offset:5}]).duration,0));
test('all camera times stay within valid recording boundaries',()=>{const cameras=[{duration:31.6,offset:0},{duration:29.2,offset:-2.5},{duration:34.8,offset:1.7}];const r=overlap(cameras);for(let t=r.start;t<=r.end;t+=.01)for(const c of cameras){assert.ok(t+c.offset>=-1e-9);assert.ok(t+c.offset<=c.duration+1e-9);}});
