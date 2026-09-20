import {RECIPIENT,MINT,PACKAGES,enabled,query,reply} from '../../server/funding.mjs';
export default async function handler(req,res){
 if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'});
 try{
  const configured=Boolean(process.env.DATABASE_URL);
  const balance=configured?Number((await query('SELECT seconds FROM funding_pool WHERE id=true'))[0]?.seconds||0):null;
  return reply(res,200,{enabled:enabled(),network:'mainnet-beta',recipient:RECIPIENT,mint:MINT,packages:PACKAGES,remainingSeconds:balance,reason:enabled()?null:'视频直播与收款尚未开放；当前模拟免费。',observedAt:new Date().toISOString()});
 }catch{return reply(res,503,{enabled:false,remainingSeconds:null,reason:'时间池暂时无法连接，收款已暂停。'});}
}
