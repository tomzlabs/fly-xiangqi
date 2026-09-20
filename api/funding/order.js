import {enabled,query,reply,createOrder,hash,equalSecret,uuid,reconcile} from '../../server/funding.mjs';
export default async function handler(req,res){
 try{
  if(req.method==='POST'){
   if(!enabled())return reply(res,503,{error:'收款尚未开放'});
   const minutes=req.body?.minutes;
   if(![1,3,5].includes(minutes))return reply(res,400,{error:'无效套餐'});
   return reply(res,201,await createOrder(minutes));
  }
  if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'});
  if(!uuid(req.query?.id))return reply(res,400,{error:'无效订单'});
  const token=req.headers['x-order-capability'];
  if(typeof token!=='string'||token.length!==64)return reply(res,404,{error:'订单不存在'});
  const [order]=await query('SELECT * FROM funding_orders WHERE id=$1',[req.query.id]);
  if(!order||!equalSecret(hash(token),order.capability_hash))return reply(res,404,{error:'订单不存在'});
  // Existing orders can settle after new purchasing has been disabled.
  const signature=await reconcile(order);
  return reply(res,200,{id:order.id,state:signature?'TIME_ADDED':Date.now()>new Date(order.expires_at).getTime()?'EXPIRED':'AWAITING_PAYMENT',signature,seconds:order.seconds});
 }catch{return reply(res,503,{error:'暂时无法核验，请稍后重试。请勿重复付款。'});}
}
