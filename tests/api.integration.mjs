import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const viteRequire=createRequire(require.resolve('vite/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
const {build}=viteRequire('esbuild');
const bundle=await build({stdin:{contents:`import {GET} from './app/api/[...path]/route.ts';export default {fetch(req){return GET(req,{params:Promise.resolve({path:new URL(req.url).pathname.split('/').slice(2)})})}}`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers'],tsconfig:'tsconfig.json'});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-04-01',d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false});
try{
 const db=await mf.getD1Database('DB');const sql=await readFile('drizzle/0000_ancient_harpoon.sql','utf8');for(const s of sql.split('--> statement-breakpoint'))await db.prepare(s.trim()).run();
 const call=async(path,method='GET',body,owner='test-owner',headers={})=>{const r=await mf.dispatchFetch('https://argus.test/api/episodes'+path,{method,headers:{'oai-authenticated-user-id':owner,...(body&&!(body instanceof Uint8Array)?{'Content-Type':'application/json'}:{}),...headers},body:body instanceof Uint8Array?body:body?JSON.stringify(body):undefined});return {r,data:()=>r.json()};};
 const metadata={name:'Integration episode',cameras:['ego','left','right'].map(role=>({role,filename:role+'.mp4',mime:'video/mp4',size:32,duration:12,width:960,height:540}))};
 let x=await call('','POST',{...metadata,cameras:[metadata.cameras[0],metadata.cameras[0],metadata.cameras[2]]});assert.equal(x.r.status,400,'duplicate roles rejected');
 x=await call('','POST',metadata);assert.equal(x.r.status,201);const ep=await x.data();
 x=await call('','POST',metadata);const ep2=await x.data();assert.notEqual(ep.id,ep2.id);
 x=await call('/'+ep.id,'GET',undefined,'someone-else');assert.equal(x.r.status,404,'owner isolation');
 x=await call('/'+ep.id+'/finalize','POST');assert.equal(x.r.status,400,'cannot finalize incomplete episode');
 for(const [i,role] of ['ego','left','right'].entries()){
  x=await call(`/${ep.id}/upload/${role}/start`,'POST');assert.equal(x.r.status,200);
  x=await call(`/${ep.id}/upload/${role}/part?number=1`,'PUT',new Uint8Array(31));assert.equal(x.r.status,400,'reject truncated part');
  x=await call(`/${ep.id}/upload/${role}/part?number=1`,'PUT',new Uint8Array(32).fill(20+i));assert.equal(x.r.status,200);const part=await x.data();
  x=await call(`/${ep.id}/upload/${role}/complete`,'POST',{parts:[part]});assert.equal(x.r.status,200);
 }
 x=await call('/'+ep.id+'/finalize','POST');assert.equal(x.r.status,200);
 x=await call('/'+ep.id);const saved=await x.data();assert.equal(saved.status,'ready');assert.ok(saved.cameras.every(c=>c.uploaded));
 x=await call('/'+ep2.id);assert.equal((await x.data()).status,'uploading','second episode is untouched');
 x=await call(`/${ep.id}/video/left`,'GET',undefined,'test-owner',{'Range':'bytes=5-9'});assert.equal(x.r.status,206);assert.equal(x.r.headers.get('Content-Range'),'bytes 5-9/32');assert.deepEqual([...new Uint8Array(await x.r.arrayBuffer())],[21,21,21,21,21]);
 x=await call(`/${ep.id}/video/right`,'GET',undefined,'test-owner',{'Range':'bytes=-3'});assert.equal(x.r.status,206);assert.equal((await x.r.arrayBuffer()).byteLength,3);
 x=await call(`/${ep.id}/video/ego`,'GET',undefined,'test-owner',{'Range':'bytes=100-'});assert.equal(x.r.status,416);
 x=await call('/'+ep.id,'PATCH',{offsets:[{role:'ego',offset:0},{role:'left',offset:-1},{role:'right',offset:2}]});assert.equal(x.r.status,200);
 x=await call('/'+ep.id);assert.equal((await x.data()).cameras.find(c=>c.role==='left').offset,-1);
 x=await call('/'+ep.id,'PATCH',{offsets:[{role:'ego',offset:0},{role:'left',offset:100},{role:'right',offset:0}]});assert.equal(x.r.status,400,'reject empty overlap');
 x=await call('/'+ep.id,'DELETE',undefined,'test-owner',{'Origin':'https://evil.test'});assert.equal(x.r.status,403);
 x=await call('/'+ep.id,'DELETE');assert.equal(x.r.status,200);
 x=await call('/'+ep.id);assert.equal(x.r.status,404);
 const bucket=await mf.getR2Bucket('BUCKET');assert.equal((await bucket.list()).objects.length,0,'delete cleans objects');

 const bigMetadata={...metadata,name:'Chunked upload check',cameras:metadata.cameras.map(c=>({...c,size:8*1024**2+137}))};
 x=await call('','POST',bigMetadata);const big=await x.data();
 await call(`/${big.id}/upload/ego/start`,'POST');
 x=await call(`/${big.id}/upload/ego/part?number=1`,'PUT',new Uint8Array(8*1024**2).fill(51));const p1=await x.data();
 x=await call(`/${big.id}/upload/ego/part?number=2`,'PUT',new Uint8Array(137).fill(52));const p2=await x.data();
 x=await call(`/${big.id}/upload/ego/complete`,'POST',{parts:[p1,p2]});assert.equal(x.r.status,200,'multiple parts assemble');
 x=await call(`/${big.id}/video/ego`,'GET',undefined,'test-owner',{'Range':'bytes=8388606-8388610'});assert.equal(x.r.status,206);assert.deepEqual([...new Uint8Array(await x.r.arrayBuffer())],[51,51,52,52,52],'range crosses chunk boundary correctly');
 await call('/'+big.id,'DELETE');
 await call('/'+ep2.id,'DELETE');
 console.log('API integration passed: roles, episode isolation, owner scope, upload validation, multipart completion, byte ranges, offsets, CSRF, deletion.');
}finally{await mf.dispose();}
