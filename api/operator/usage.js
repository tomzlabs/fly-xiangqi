import {query,reply,equalSecret,uuid} from '../../server/funding.mjs';
export default async function handler(req,res){
 if(req.method!=='POST')return reply(res,405,{error:'Method not allowed'});
 if(!equalSecret(req.headers.authorization,process.env.OPERATOR_SECRET?`Bearer ${process.env.OPERATOR_SECRET}`:null))return reply(res,401,{error:'Unauthorized'});
 const {segmentId,seconds}=req.body||{};
 if(!uuid(segmentId)||!Number.isInteger(seconds)||seconds<1||seconds>30)return reply(res,400,{error:'Invalid segment'});
 try{const [row]=await query('SELECT consume_funding($1,$2) AS remaining',[segmentId,seconds]);return reply(res,200,{remainingSeconds:Number(row.remaining)});}
 catch{return reply(res,409,{error:'Unable to consume time. Publisher must stop.'});}
}
