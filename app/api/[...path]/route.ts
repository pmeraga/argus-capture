import { env } from 'cloudflare:workers';
import { roles, overlap, type Camera, type Episode, type Role } from '@/lib/model';
export const dynamic='force-dynamic';
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
const fail=(s:string,status=400)=>{throw Object.assign(new Error(s),{status});};
async function handle(req:Request,{params}:{params:Promise<{path:string[]}>}) {
 try {
  if(!env.DB||!env.BUCKET) return json({error:'Storage is not configured.'},503);
  const db=env.DB,bucket=env.BUCKET;
  const owner=req.headers.get('oai-authenticated-user-id')||'private-workspace';
  if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin) return json({error:'Cross-origin writes are not allowed.'},403);}
  const {path:p}=await params; const [collection,id,action,role,operation]=p;
  if(collection!=='episodes')return json({error:'Not found'},404);
  if(!id&&req.method==='GET'){
   const result=await db.prepare('SELECT id,name,created_at,status,data FROM episodes WHERE owner=? ORDER BY created_at DESC LIMIT 500').bind(owner).all<any>();
   return json(result.results.map(r=>({id:r.id,name:r.name,createdAt:r.created_at,status:r.status,...JSON.parse(r.data)})));
  }
  if(!id&&req.method==='POST'){
   const b=await req.json() as any;
   if(typeof b.name!=='string'||!b.name.trim()||b.name.length>120)fail('Enter an episode name (1–120 characters).');
   if(!Array.isArray(b.cameras)||b.cameras.length!==3||!roles.every(r=>b.cameras.filter((c:any)=>c.role===r).length===1))fail('Provide exactly one recording for each camera.');
   const cameras:Camera[]=b.cameras.map((c:any)=>{
    if(!Number.isFinite(c.duration)||c.duration<=0||c.duration>86400||!Number.isSafeInteger(c.size)||c.size<=0||c.size>5*1024**3||!Number.isSafeInteger(c.width)||c.width<=0||c.width>16384||!Number.isSafeInteger(c.height)||c.height<=0||c.height>16384||typeof c.filename!=='string'||!c.filename.length||c.filename.length>255||!['video/mp4','video/webm','video/quicktime'].includes(c.mime))fail('Invalid video metadata. Use playable MP4, WebM, or MOV files under 5 GB.');
    return {role:c.role,filename:c.filename,size:c.size,duration:c.duration,width:c.width,height:c.height,mime:c.mime,offset:0,uploaded:false};
   });
   const episode:Episode={id:crypto.randomUUID(),name:b.name.trim(),createdAt:new Date().toISOString(),status:'uploading',cameras,description:typeof b.description==='string'?b.description.slice(0,1000):''};
   await db.prepare('INSERT INTO episodes(id,owner,name,created_at,status,data) VALUES(?,?,?,?,?,?)').bind(episode.id,owner,episode.name,episode.createdAt,episode.status,JSON.stringify({cameras,description:episode.description})).run();return json(episode,201);
  }
  const row=await db.prepare('SELECT * FROM episodes WHERE id=? AND owner=?').bind(id,owner).first<any>();
  if(!row)return json({error:'Episode not found'},404);
  const data=JSON.parse(row.data); const cameras:Camera[]=data.cameras;
  const save=async(status=row.status)=>db.prepare('UPDATE episodes SET data=?,status=? WHERE id=? AND owner=?').bind(JSON.stringify(data),status,id,owner).run();
  if(!action&&req.method==='GET')return json({id,name:row.name,createdAt:row.created_at,status:row.status,...data});
  if(!action&&req.method==='DELETE'){
   for(const c of cameras){if(c.key){if(c.uploadId&&!c.uploaded)await bucket.resumeMultipartUpload(c.key,c.uploadId).abort().catch(()=>{});await bucket.delete(c.key);}}
   await db.prepare('DELETE FROM episodes WHERE id=? AND owner=?').bind(id,owner).run();return json({ok:true});
  }
  if(!action&&req.method==='PATCH'){
   const b=await req.json() as any;
   if(!Array.isArray(b.offsets)||b.offsets.length!==3||!roles.every(r=>b.offsets.filter((o:any)=>o.role===r).length===1))fail('Three camera offsets are required.');
   for(const c of cameras){const o=b.offsets.find((o:any)=>o.role===c.role);if(!Number.isFinite(o.offset)||Math.abs(o.offset)>86400)fail('Invalid offset.');c.offset=o.offset;}
   if(cameras.find(c=>c.role==='ego')?.offset!==0)fail('Egocentric offset must remain zero.');
   if(overlap(cameras).duration<=0)fail('These offsets leave no shared playback interval.');
   await save();return json({ok:true});
  }
  if(action==='finalize'&&req.method==='POST'){
   if(!cameras.every(c=>c.uploaded))fail('All three camera uploads must finish first.');await save('ready');return json({ok:true});
  }
  if(action==='video'&&req.method==='GET'){
   const c=cameras.find(c=>c.role===role);if(!c?.key||!c.uploaded)return json({error:'Video not found'},404);
   const head=await bucket.head(c.key);if(!head)return json({error:'Video missing'},404);
   const range=req.headers.get('range'); let start=0,end=head.size-1;
   if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});
    if(!m[1])start=Math.max(0,head.size-Number(m[2]));else {start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}
    if(start>end||start>=head.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});
   }
   const obj=await bucket.get(c.key,range?{range:{offset:start,length:end-start+1}}:{});if(!obj)return json({error:'Video missing'},404);
   const headers:Record<string,string>={'Content-Type':c.mime,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600','ETag':head.httpEtag};
   if(range)headers['Content-Range']=`bytes ${start}-${end}/${head.size}`;
   return new Response(obj.body,{status:range?206:200,headers});
  }
  if(action==='upload'&&roles.includes(role as Role)){
   const c=cameras.find(c=>c.role===role)!;if(row.status!=='uploading'||c.uploaded)fail('This recording is already complete.');
   if(req.method==='POST'&&operation==='start'){
    if(c.uploadId&&c.key)return json({uploadId:c.uploadId});
    c.key=`episodes/${owner}/${id}/${role}`;const u=await bucket.createMultipartUpload(c.key,{httpMetadata:{contentType:c.mime}});c.uploadId=u.uploadId;await save();return json({uploadId:u.uploadId});
   }
   if(!c.uploadId||!c.key)fail('Start the upload first.');
   const upload=bucket.resumeMultipartUpload(c.key!,c.uploadId!);
   if(req.method==='PUT'&&operation==='part'){
    const n=Number(new URL(req.url).searchParams.get('number'));const total=Math.ceil(c.size/(8*1024**2));if(!Number.isInteger(n)||n<1||n>total)fail('Invalid part number.');
    const bytes=await req.arrayBuffer();const expected=n===total?c.size-(n-1)*8*1024**2:8*1024**2;if(bytes.byteLength!==expected)fail('Upload chunk size mismatch.');
    const result=await upload.uploadPart(n,bytes);return json(result);
   }
   if(req.method==='POST'&&operation==='complete'){
    const b=await req.json() as any;const total=Math.ceil(c.size/(8*1024**2));if(!Array.isArray(b.parts)||b.parts.length!==total||!b.parts.every((p:any,i:number)=>p.partNumber===i+1&&typeof p.etag==='string'))fail('Upload parts are incomplete.');
    const obj=await upload.complete(b.parts);if(obj.size!==c.size){await bucket.delete(c.key!);fail('Stored video size mismatch.');}
    c.uploaded=true;delete c.uploadId;await save();return json({ok:true});
   }
  }
  return json({error:'Not found'},404);
 }catch(e:any){console.error(e.message);return json({error:e.status?e.message:'The request could not be completed. Please retry.'},e.status||500);}
}
export {handle as GET,handle as POST,handle as PUT,handle as PATCH,handle as DELETE};
