import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {verifiesPayment,RECIPIENT,MINT,enabled,paymentUrl} from '../server/funding.mjs';
const order={reference:'unique-reference',recipient:RECIPIENT,mint:MINT,units:'5000000',seconds:60,created_at:'2026-09-20T00:00:00Z',expires_at:'2026-09-20T00:15:00Z'};
const balance={accountIndex:1,mint:MINT,owner:RECIPIENT,programId:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',uiTokenAmount:{amount:'5000000',decimals:6}};
function transaction(){return {blockTime:Date.parse('2026-09-20T00:01:00Z')/1000,transaction:{message:{accountKeys:[{pubkey:order.reference,signer:false,writable:false}]}},meta:{err:null,preTokenBalances:[],postTokenBalances:[structuredClone(balance)]}};}
test('Solana verification rejects unrelated, failed, late, wrong-token, wrong-recipient and underpaid transactions',()=>{
 assert.equal(verifiesPayment(transaction(),order),true);
 for(const mutate of [t=>t.meta.err={},t=>t.blockTime+=3600,t=>t.blockTime-=3600,t=>t.transaction.message.accountKeys=[],t=>t.meta.postTokenBalances[0].mint='fake',t=>t.meta.postTokenBalances[0].owner='other',t=>t.meta.postTokenBalances[0].uiTokenAmount.amount='4999999',t=>t.meta.postTokenBalances[0].programId='fake',t=>t.meta.preTokenBalances=[structuredClone(balance)]]){const t=transaction();mutate(t);assert.equal(verifiesPayment(t,order),false);}
 const changed=transaction();changed.meta.preTokenBalances=[{...balance,owner:'other'}];assert.equal(verifiesPayment(changed,order),false);
 const drain=transaction();drain.meta.preTokenBalances=[{...balance,accountIndex:2}];assert.equal(verifiesPayment(drain,order),false);
 assert.match(paymentUrl(order),/^solana:2vHrt/);assert.match(paymentUrl(order),/amount=5&/);
});
test('funding defaults to disabled without explicit live publisher readiness',()=>assert.equal(enabled(),false));
test('atomic ledger credits once, rejects replay, and never spends below zero',async()=>{
 const db=await PGlite.create();
 try{
 await db.exec(await readFile(new URL('../migrations/001-funding.sql',import.meta.url),'utf8'));
 const a=randomUUID(),b=randomUUID();
 for(const id of [a,b])await db.query(`INSERT INTO funding_orders(id,capability_hash,reference,recipient,mint,units,seconds,expires_at) VALUES($1::uuid,'hash',$1::text,'recipient','mint',5000000,60,now()+interval '15 minutes')`,[id]);
 const credit=id=>db.query("SELECT credit_funding($1,'tx-1') AS value",[id]);
 await Promise.all([credit(a),credit(a)]);
 assert.equal(Number((await db.query('SELECT seconds FROM funding_pool')).rows[0].seconds),60);
 await assert.rejects(credit(b));
 const segment=randomUUID();
 await Promise.all([db.query('SELECT consume_funding($1,30)',[segment]),db.query('SELECT consume_funding($1,30)',[segment])]);
 assert.equal(Number((await db.query('SELECT seconds FROM funding_pool')).rows[0].seconds),30);
 await assert.rejects(db.query('SELECT consume_funding($1,20)',[segment]));
 await db.query('SELECT consume_funding($1,30)',[randomUUID()]);
 await assert.rejects(db.query('SELECT consume_funding($1,1)',[randomUUID()]));
 assert.equal(Number((await db.query('SELECT seconds FROM funding_pool')).rows[0].seconds),0);
 }finally{await db.close();}
});
test('public APIs refuse new payments and unauthenticated operator writes by default',async()=>{
 const {default:status}=await import('../api/funding/status.js');
 const {default:create}=await import('../api/funding/order.js');
 const {default:usage}=await import('../api/operator/usage.js');
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;return this;}});
 let res=response();await status({method:'GET'},res);assert.equal(res.code,200);assert.equal(res.body.enabled,false);assert.equal(res.body.remainingSeconds,null);assert.equal(res.headers['Cache-Control'],'no-store');
 res=response();await create({method:'POST',body:{minutes:1}},res);assert.equal(res.code,503);
 res=response();await usage({method:'POST',headers:{},body:{segmentId:randomUUID(),seconds:1}},res);assert.equal(res.code,401);
});
