import QRCode from 'qrcode';
export function mountFunding(){
 const root=document.getElementById('funding');
 root.innerHTML=`<div><p class="eyebrow">KEEP THE WORLD UNFOLDING</p><h2>为这个世界，添一点时间。</h2><p>开放后，你购买的时间会进入公共视频直播池，供所有人一起观看。当前实时模拟免费。</p><p class="funding-note">Solana 主网 · USDC · 钱包需要少量 SOL 支付网络费</p></div><div class="funding-panel"><span>公共直播剩余时间</span><strong class="pool-clock" id="pool-clock">— — : — —</strong><p id="pool-status" role="status">正在读取时间池…</p><div class="funding-packages" id="funding-packages"></div><p class="funding-note" id="funding-price-note">每分钟 5 USDC 为拟定价格；视频直播尚未上线，不接受充值。</p><div id="funding-order" hidden><canvas id="funding-qr" aria-label="Solana Pay 付款二维码"></canvas><p id="funding-quote"></p><a id="funding-pay">打开钱包付款 ↗</a><p id="funding-result" role="status"></p><button id="funding-dismiss" hidden>关闭订单</button></div></div>`;
 const $=id=>document.getElementById(id);
 let busy=false,active=null,polling=false;
 try{active=JSON.parse(sessionStorage.getItem('fly-funding-order'));if(!active?.id||!active?.capability)active=null;}catch{}
 async function api(path,options){const r=await fetch(path,options);const data=await r.json();if(!r.ok)throw new Error(data.error||data.reason||'服务暂不可用');return data;}
 function save(){try{if(active)sessionStorage.setItem('fly-funding-order',JSON.stringify(active));else sessionStorage.removeItem('fly-funding-order');}catch{}}
 async function showOrder(){
  if(!active)return;
  $('funding-order').hidden=false;
  const expired=Date.now()>new Date(active.expiresAt).getTime();
  $('funding-pay').hidden=expired;$('funding-qr').hidden=expired;$('funding-dismiss').hidden=!expired;
  $('funding-quote').textContent=`${Number(active.units)/1e6} USDC → 公共直播 +${active.seconds} 秒。请在 ${new Date(active.expiresAt).toLocaleTimeString()} 前付款。`;
  $('funding-pay').href=active.paymentUrl;
  await QRCode.toCanvas($('funding-qr'),active.paymentUrl,{width:220,margin:2});
  $('funding-result').textContent=expired?'订单已过期，请勿付款。正在核验已有付款…':'等待付款确认，请勿重复支付。';
 }
 async function refresh(){
  try{
   const data=await api('/api/funding/status');
   $('pool-clock').textContent=data.remainingSeconds===null?'— — : — —':`${String(Math.floor(data.remainingSeconds/60)).padStart(2,'0')}:${String(data.remainingSeconds%60).padStart(2,'0')}`;
   $('pool-status').textContent=data.reason||'余额由服务器核验；所有观众共享。';
   $('funding-price-note').textContent=data.enabled?'每分钟 5 USDC。付款经链上最终确认后加时。':'每分钟 5 USDC 为拟定价格；视频直播尚未上线，不接受充值。';
   $('funding-packages').replaceChildren(...data.packages.map(pack=>{
    const b=document.createElement('button');b.textContent=`+${pack.minutes} 分钟 · ${pack.usdc} USDC`;b.disabled=!data.enabled||busy||Boolean(active);
    b.onclick=async()=>{
     busy=true;for(const button of $('funding-packages').children)button.disabled=true;
     try{active=await api('/api/funding/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({minutes:pack.minutes})});save();await showOrder();}
     catch(e){$('pool-status').textContent=e.message;}finally{busy=false;}
    };return b;
   }));
  }catch{
   $('pool-clock').textContent='— — : — —';$('pool-status').textContent='时间池尚未连接，暂不接受充值。';
   for(const b of $('funding-packages').children)b.disabled=true;
  }
 }
 async function poll(){
  if(!active||polling)return;polling=true;const orderId=active.id;
  try{
   const data=await api(`/api/funding/order?id=${encodeURIComponent(active.id)}`,{headers:{'x-order-capability':active.capability}});
   if(active?.id!==orderId)return;
   if(data.state==='TIME_ADDED'||data.state==='EXPIRED'){
    $('funding-pay').removeAttribute('href');$('funding-pay').hidden=true;$('funding-qr').hidden=true;
    $('funding-result').textContent=data.state==='TIME_ADDED'?`到账成功！已为大家增加 ${data.seconds} 秒。`:'订单已过期，请勿继续付款。若已支付，请稍等最终确认，或联系 @okmetom。';
    $('funding-dismiss').hidden=false;
    if(data.state==='TIME_ADDED'){active=null;save();await refresh();}
   }
  }catch(e){$('funding-result').textContent=e.message;}finally{polling=false;}
 }
 $('funding-dismiss').onclick=()=>{active=null;save();$('funding-order').hidden=true;$('funding-pay').hidden=false;$('funding-qr').hidden=false;$('funding-dismiss').hidden=true;refresh();};
 showOrder().catch(()=>{$('funding-result').textContent='无法显示付款二维码，请稍后重试。';});
 refresh();poll();setInterval(refresh,10000);setInterval(poll,12000);
}
