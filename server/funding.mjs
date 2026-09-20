import {createHash, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import bs58 from 'bs58';
import {neon} from '@neondatabase/serverless';
export const RECIPIENT='2vHrtE8gs2MFwCbJcVjr6MoTzpGHxgQcgev66TeRxczC';
export const MINT='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const PACKAGES=[1,3,5].map(minutes=>({minutes,seconds:minutes*60,usdc:minutes*5,units:String(minutes*5_000_000)}));
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function enabled(){
 return process.env.FUNDING_ENABLED==='true'&&process.env.LIVE_PUBLISHER_READY==='true'&&Boolean(process.env.DATABASE_URL&&process.env.SOLANA_RPC_URL&&process.env.OPERATOR_SECRET);
}
export async function query(sql,params=[]){
 if(!process.env.DATABASE_URL)throw new Error('Database unavailable');
 return neon(process.env.DATABASE_URL).query(sql,params);
}
export function equalSecret(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;
 const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);
}
export function reply(res,code,body){res.setHeader('Cache-Control','no-store');return res.status(code).json(body);}
export function paymentUrl(order){
 return `solana:${order.recipient}?${new URLSearchParams({amount:String(Number(order.units)/1e6),'spl-token':order.mint,reference:order.reference,label:'Fly World',message:`Shared livestream ${order.seconds}s`})}`;
}
export async function createOrder(minutes){
 const pack=PACKAGES.find(p=>p.minutes===minutes);if(!pack)throw new Error('Invalid package');
 const capability=randomBytes(32).toString('hex');
 const order={id:randomUUID(),reference:bs58.encode(randomBytes(32)),recipient:RECIPIENT,mint:MINT,units:pack.units,seconds:pack.seconds};
 const [saved]=await query(`INSERT INTO funding_orders(id,capability_hash,reference,recipient,mint,units,seconds,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '15 minutes') RETURNING expires_at`,[order.id,hash(capability),order.reference,order.recipient,order.mint,order.units,order.seconds]);
 return {...order,capability,expiresAt:saved.expires_at,paymentUrl:paymentUrl(order)};
}
export async function rpc(method,params=[]){
 const response=await fetch(process.env.SOLANA_RPC_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('RPC unavailable');const body=await response.json();
 if(body.error)throw new Error('RPC unavailable');return body.result;
}
// getTransaction must be queried with finalized commitment on mainnet.
// Credit the receiver's net USDC increase, never a client-supplied amount.
export function verifiesPayment(tx,order){
 if(!tx?.meta||tx.meta.err!==null||!Number.isInteger(tx.blockTime))return false;
 const time=tx.blockTime*1000;
 if(time<new Date(order.created_at).getTime()-1000||time>new Date(order.expires_at).getTime())return false;
 const keys=tx.transaction?.message?.accountKeys;
 if(!Array.isArray(keys)||!keys.some(k=>k.pubkey===order.reference&&!k.signer&&!k.writable))return false;
 const before=tx.meta.preTokenBalances||[],after=tx.meta.postTokenBalances||[];
 let delta=0n;
 try{
  for(const b of after){
   if(b.mint!==order.mint||b.owner!==order.recipient||b.uiTokenAmount?.decimals!==6||b.programId!=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')continue;
   const a=before.find(x=>x.accountIndex===b.accountIndex);
   // An ownership change is not a payment.
   if(a&&(a.owner!==b.owner||a.mint!==b.mint))continue;
   delta+=BigInt(b.uiTokenAmount.amount)-BigInt(a?.uiTokenAmount?.amount||'0');
  }
  // Include receiver accounts closed or drained by the same transaction.
  for(const a of before){
   if(a.owner===order.recipient&&a.mint===order.mint&&!after.some(b=>b.accountIndex===a.accountIndex))delta-=BigInt(a.uiTokenAmount.amount);
  }
  return delta>=BigInt(order.units);
 }catch{return false;}
}
export async function reconcile(order){
 if(order.signature)return order.signature;
 if(await rpc('getGenesisHash')!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')throw new Error('Mainnet required');
 const signatures=await rpc('getSignaturesForAddress',[order.reference,{limit:20,commitment:'finalized'}]);
 for(const item of signatures||[]){
  if(item.err)continue;
  const tx=await rpc('getTransaction',[item.signature,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:0}]);
  if(verifiesPayment(tx,order)){await query('SELECT credit_funding($1,$2)',[order.id,item.signature]);return item.signature;}
 }
 return null;
}
