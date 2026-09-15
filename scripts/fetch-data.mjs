// Fetch the exact public release assets; hashes remain pinned in the repository.
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://github.com/tomzlabs/fly-xiangqi/releases/download/connectome-v783';
const directory=new URL('../public/data/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(directory,{recursive:true});
for(const [name,info] of Object.entries(manifest.files)){
  const target=new URL(name,directory);
  const existing=await readFile(target).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(existing&&sha(existing)===info.sha256){console.log(`Verified cached ${name}`);continue;}
  console.log(`Downloading ${name} (${(info.bytes/1e6).toFixed(1)} MB)`);
  const response=await fetch(`${base}/${name}`,{signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==info.bytes||sha(bytes)!==info.sha256)throw new Error(`${name}: checksum or size mismatch`);
  const temporary=new URL(name+'.download',directory);
  try{await writeFile(temporary,bytes);await rename(temporary,target);}finally{await rm(temporary,{force:true});}
  console.log(`Verified ${name}`);
}
