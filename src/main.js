import './style.css';
import { Chess } from 'chess.js';
import { BrainView } from './brain-view.js';
import { pieceSvg, pieceNames } from './pieces.js';

const base=import.meta.env.BASE_URL;
document.querySelector('#app').innerHTML=`
<div class="shell">
  <header class="topbar">
    <a class="brand" href="#"><img src="${base}fly.svg" alt=""/><div><strong>fly chess lab</strong><small>连接与落子</small></div></a>
    <nav aria-label="主导航"><a href="#play">开始对弈</a><a href="#method">计算说明</a><a href="#sources">数据来源 ↗</a></nav>
    <div class="release"><i></i> EXPERIMENT 0.1</div>
  </header>
  <section class="intro" id="play">
    <div><p class="eyebrow">A CONNECTOME AT THE CHESSBOARD</p><h1>你的下一步，<span>它的神经回响。</span></h1><p>真实果蝇连接数据，在你的浏览器中计算。<br class="mobile-break"/>落下一枚棋子，观察信号怎样穿过神经网络。</p></div>
    <div class="intro-aside"><span class="tag" id="runtime"><i></i>正在载入连接组</span><span class="fine">FlyWire v783 · 未训练读出</span></div>
  </section>
  <main class="lab">
    <section aria-label="国际象棋对弈">
      <div class="panel">
        <div class="panel-head"><div class="panel-title"><span class="round-icon">♙</span> 对弈台</div><span class="panel-kicker">HUMAN × CONNECTOME</span></div>
        <div class="board-wrap">
          <div class="opponent"><div class="avatar"><img src="${base}fly.svg" alt=""/></div><div class="person"><b>果蝇神经网络</b><span id="fly-color">执黑 · 固定连接，逐步积分</span></div><span class="turn-badge" id="fly-turn">等待输入</span></div>
          <div class="board-frame"><div class="ranks" id="ranks" aria-hidden="true"></div><div class="board" id="board" role="group" aria-label="棋盘"></div></div>
          <div class="files" id="files" aria-hidden="true"></div>
          <div class="opponent player-bottom"><div class="avatar human">♙</div><div class="person"><b>你</b><span id="human-color">执白 · 点击棋子，再选择落点</span></div><span class="turn-badge" id="human-turn">你的回合</span></div>
        </div>
        <div class="board-actions"><div class="actions-left"><button id="new-game" class="button primary" disabled>↻ 新对局</button><button id="undo" class="button" disabled>撤回</button><button id="flip" class="button icon-button" aria-label="翻转棋盘" title="翻转棋盘">⇅</button></div><select class="side-select" id="side" aria-label="选择执棋颜色" disabled><option value="w">我执白棋</option><option value="b">我执黑棋</option></select></div>
        <div class="status" id="status" role="status" aria-live="polite"><i class="status-dot"></i><span id="status-text">正在准备神经网络，连接数据只需下载一次。</span></div>
      </div>
      <div class="move-strip"><b>棋谱</b><div class="move-list" id="moves">落子之后，棋谱会记录在这里。</div></div>
    </section>
    <section class="panel" aria-label="神经活动与计算结果">
      <div class="panel-head"><div class="panel-title">连接组观察窗 <small>雌性果蝇 · 全脑</small></div><span class="panel-kicker" id="neuron-count">FAFB v783</span></div>
      <div class="brain-stage">
        <div class="brain-canvas" id="brain"></div><div class="brain-corner">DORSAL VIEW<br/>实测锚点 / 非神经形态</div><span class="brain-phase" id="phase">等待计算</span>
        <div class="brain-caption"><span>拖动旋转 · 滚轮缩放</span><span id="brain-caption">亮点仅来自实际放电记录</span></div>
        <div class="loading-overlay" id="loading"><div class="loading-orbit"><img src="${base}fly.svg" alt=""/></div><b id="loading-title">正在载入一张真实的连接图</b><p id="loading-help">完整网络约 50 MB。下载完成后，棋步计算在本机进行。</p><div class="load-track"><i id="load-bar"></i></div><span class="load-value" id="load-value">正在读取数据清单…</span><button id="retry-load" class="button" hidden>重试载入</button></div>
      </div>
      <div class="legend"><span><i style="--color:#8296c2"></i>视觉回路</span><span><i style="--color:#746c97"></i>中央脑等</span><span><i style="--color:#47a99a"></i>视觉输入</span><span><i style="--color:#b66680"></i>下行 / 运动</span></div>
      <div class="metrics"><div class="metric"><strong id="active">—</strong><span>本次放电神经元</span></div><div class="metric"><strong id="spikes">—</strong><span>累计脉冲数</span></div><div class="metric"><strong id="output-spikes">—</strong><span>下行 / 运动脉冲</span></div><div class="metric"><strong><b id="sim-time" style="font-weight:500">—</b><small>ms</small></strong><span>模型内时间</span></div></div>
      <div class="neural-progress"><i id="progress"></i></div>
      <div class="readout"><div class="readout-heading"><span>神经活动 → 走法评分</span><small>固定线性投影 · 尚未训练</small></div><div class="candidates" id="candidates"><div class="empty-readout">等你落子。<br/>网络的放电与膜电位，将共同决定候选走法的排序。</div></div><div class="trace-line"><span id="wall-time">120 ms 模拟 · 0.1 ms 步长</span><button class="link-button" id="replay" disabled>回放脉冲 ↗</button></div></div>
    </section>
  </main>
  <section class="experiment" aria-label="计算实验设置">
    <div><h2 class="experiment-title">这张连接图，真的参与了落子吗？</h2><p>用同一局面和输入种子，再运行一次断开全部突触的网络，比较输出信号。<br/>对照实验不会改变棋局。</p></div>
    <div class="experiment-controls"><label class="field">模拟时长<select id="duration"><option value="60">60 ms</option><option value="120" selected>120 ms</option><option value="240">240 ms</option></select></label><label class="field">输入种子<input id="seed" type="number" min="1" max="4294967295" value="42" step="1"/></label><button class="button" id="ablate" disabled>验证连接作用 ↗</button></div>
  </section>
  <div class="ablation-result" id="ablation-result" hidden aria-live="polite"></div>
  <div class="about">
    <section id="method"><p class="eyebrow">INSIDE THE EXPERIMENT</p><h2>真正计算，也明确边界。</h2><p>使用研究作者公开的果蝇神经连接及兴奋／抑制权重，用泄漏整合发放模型（LIF）逐步计算膜电位、延迟传播与放电脉冲。全部 <span id="about-neurons">138,639</span> 个神经元和原始连接都参与模拟。</p><div class="pipeline"><span>棋盘编码</span><i>→</i><span>连接组 · LIF</span><i>→</i><span>神经读出</span><i>→</i><span>合法落子</span></div><ul class="science-list"><li><b>测量数据：</b>连接关系、突触数和神经元锚点来自公开数据；兴奋／抑制符号沿用作者模型。</li><li><b>模型假设：</b>统一的 LIF 参数及时间离散。棋盘到视觉神经元、下行活动到走法的映射由我们定义。</li><li><b>能力边界：</b>读出层尚未学习棋艺，可能走出很差的棋。它是基于连接组的计算实验，不是活体果蝇，也不是生物认知能力的证明。</li></ul><details><summary>膜电位也能影响落子吗？</summary><p>可以。每个输出神经元的特征为：脉冲数 + 平均膜电位偏移 / 7 mV。即使尚未达到放电阈值，经过突触传播的电位变化也能影响线性读出。页面会如实显示零个输出脉冲。</p></details><details><summary>象棋规则与网络各自负责什么？</summary><p>chess.js 只生成合法走法、处理升变和判定终局。固定线性投影仅接收 1,409 个下行／运动神经元的模拟活动。没有象棋引擎、局面搜索、子力评分或将杀辅助。若输出信号为零，系统停止走棋并提示调整实验参数。</p></details></section>
    <section id="sources"><p class="eyebrow">OPEN DATA, INSPECTABLE MOVES</p><h2>每一条连接，都有出处。</h2><div class="source-row"><a href="https://github.com/philshiu/Drosophila_brain_model" target="_blank" rel="noreferrer">Drosophila_brain_model ↗</a><span>Shiu 等 · 模型及 v783 数据</span></div><div class="source-row"><a href="https://github.com/flyconnectome/flywire_annotations" target="_blank" rel="noreferrer">FlyWire annotations ↗</a><span>神经元类型与空间锚点</span></div><div class="source-row"><a href="https://doi.org/10.1038/s41586-024-07763-9" target="_blank" rel="noreferrer">Nature · 2024 ↗</a><span>神经元模型的研究基础</span></div><div class="source-row"><a href="${base}data/manifest.json" target="_blank" rel="noreferrer">本次数据清单 ↗</a><span>固定提交 · 数量 · SHA-256</span></div><div class="hash" id="hash">连接图校验中…</div><div style="display:flex;gap:9px;margin-top:19px;flex-wrap:wrap"><button class="button" id="export" disabled>↓ 导出计算记录</button><button class="button" id="export-audit" disabled>↓ 导出对照实验</button></div><p style="font-size:11px;margin-top:14px">记录包含局面、输入种子、每次脉冲、输出特征、候选分数及模型校验值。下载后可核对实际计算链路。</p><details><summary>载入自定义棋局（FEN）</summary><form id="fen-form" style="margin-top:10px"><input id="fen-input" aria-label="FEN 棋局字符串" style="width:100%;padding:8px;border:1px solid #d4d8e5;border-radius:5px;font-size:11px" placeholder="粘贴完整 FEN 字符串"/><button class="button" id="load-fen" type="submit" style="margin-top:8px" disabled>载入局面</button></form></details></section>
  </div>
  <footer><span><b>fly chess lab</b> 连接数据来自真实果蝇，棋盘接口来自工程设计。</span><span>本机计算 · 完整连接组 · 可重复实验</span></footer>
</div>
<dialog class="modal" id="promotion"><h2>选择升变棋子</h2><div class="promotion-options" id="promotion-options"></div><button class="button" id="cancel-promotion">取消</button></dialog>`;

const $=id=>document.getElementById(id), fmt=x=>x.toLocaleString('en-US');
let chess=new Chess(), human='w', flipped=false, selected=null, ready=false, busy=false;
let worker, pending=null, requestId=0, manifest, lastResult=null, lastAudit=null, replayTimer;
const view=new BrainView($('brain'));

function status(message,error=false) { $('status-text').textContent=message; $('status').classList.toggle('error',error); }
function controlState() {
  for (const id of ['new-game','side','ablate','load-fen']) $(id).disabled=!ready||busy;
  for (const id of ['seed','duration']) $(id).disabled=busy;
  $('undo').disabled=!ready||busy||!chess.history().length;
  $('replay').disabled=!lastResult||busy;
  $('export').disabled=!lastResult||busy;
  $('export-audit').disabled=!lastAudit||busy;
}
function endMessage() {
  if(chess.isCheckmate())return chess.turn()===human?'将死，神经网络赢了。':'将死，你赢了。';
  if(chess.isStalemate())return '和棋：无子可动。';
  if(chess.isThreefoldRepetition())return '和棋：三次重复局面。';
  if(chess.isInsufficientMaterial())return '和棋：子力不足。';
  if(chess.isDraw())return '和棋。';
  return null;
}
function renderBoard() {
  const files=(flipped?'hgfedcba':'abcdefgh').split(''), ranks=flipped?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1];
  const legal=selected?chess.moves({square:selected,verbose:true}):[];
  const history=chess.history({verbose:true}), last=history.at(-1);
  $('board').innerHTML=ranks.flatMap(rank=>files.map(file=>{
    const square=file+rank,piece=chess.get(square),target=legal.some(m=>m.to===square);
    const classes=['square',((file.charCodeAt(0)-97+rank)%2===1?'dark':''),square===selected?'selected':'',target?'target':'',target&&piece?'capture':'',last&&(last.from===square||last.to===square)?'last':''].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" data-square="${square}" aria-label="${square}${piece?' '+(piece.color==='w'?'白':'黑')+pieceNames[piece.type]:' 空格'}${target?'，可走':''}" aria-pressed="${selected===square}">${piece?pieceSvg(piece.type,piece.color):''}</button>`;
  })).join('');
  $('ranks').innerHTML=ranks.map(x=>`<span>${x}</span>`).join('');
  $('files').innerHTML=files.map(x=>`<span>${x}</span>`).join('');
  $('fly-color').textContent=`执${human==='w'?'黑':'白'} · 固定连接，逐步积分`;
  $('human-color').textContent=`执${human==='w'?'白':'黑'} · 点击棋子，再选择落点`;
  $('fly-turn').textContent=chess.isGameOver()?'对局结束':busy?'计算中':chess.turn()!==human?'等待计算':'等待输入';
  $('human-turn').textContent=chess.isGameOver()?'对局结束':chess.turn()===human?'你的回合':'等待对手';
  const san=chess.history();
  $('moves').textContent=san.length?san.map((x,i)=>(i%2===0?`${Math.floor(i/2)+1}. `:'')+x).join('  '):'落子之后，棋谱会记录在这里。';
  $('moves').scrollTop=1e6; controlState();
}
function stopReplay() { clearInterval(replayTimer); replayTimer=null; $('replay').textContent='回放脉冲 ↗'; }
function clearTelemetry() {
  stopReplay();view.clear();lastResult=null;lastAudit=null;
  for(const id of ['active','spikes','output-spikes','sim-time'])$(id).textContent='—';
  $('progress').style.width='0';$('phase').textContent='等待计算';
  $('candidates').innerHTML='<div class="empty-readout">等你落子。<br/>网络的放电与膜电位，将共同决定候选走法的排序。</div>';
  $('wall-time').textContent=`${$('duration').value} ms 模拟 · 0.1 ms 步长`;
  $('ablation-result').hidden=true;controlState();
}
function settings() {
  const seed=Number($('seed').value);
  if(!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw new Error('输入种子需为 1 至 4294967295 的整数。');
  return {seed,durationMs:Number($('duration').value)};
}
function requestTrial(options,label) {
  stopReplay();view.clear();$('phase').textContent=label;
  $('progress').style.width='0';
  return new Promise((resolve,reject)=>{
    const id=++requestId;
    pending={id,resolve,reject,options};
    worker.postMessage({type:'run',id,options});
  });
}
function showResult(result) {
  lastResult=result;
  $('active').textContent=fmt(result.activeNeurons);$('spikes').textContent=fmt(result.totalSpikes);
  $('output-spikes').textContent=fmt(result.outputSpikes);$('sim-time').textContent=result.durationMs;
  $('phase').textContent=result.selected?'计算完成 · 真实记录':'未检测到输出信号';
  const candidates=result.candidates.slice(0,5), max=Math.max(...candidates.map(c=>Math.abs(c.score)),1e-12);
  $('candidates').innerHTML=candidates.length?candidates.map(c=>`<div class="candidate"><span>${c.san}</span><div class="track"><i style="width:${Math.max(1,Math.abs(c.score)/max*100)}%"></i></div><span class="score">${c.score.toFixed(5)}</span></div>`).join(''):'<div class="empty-readout">该局面没有合法走法。</div>';
  $('wall-time').textContent=`核心计算 ${Math.round(result.computeMs)} ms · ${result.durationMs} ms 模拟`;
  controlState();
}
async function flyMove() {
  if(!ready||busy||chess.isGameOver()||chess.turn()===human)return;
  let options;try{options=settings();}catch(e){status(e.message,true);return;}
  busy=true;renderBoard();status('神经网络正在接收棋盘输入…');
  try{
    const result=await requestTrial({fen:chess.fen(),...options},'正在积分 · LIF');
    showResult(result);
    if(result.selected){
      const uci=result.selected.uci;
      chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
      status(endMessage()||`神经网络走了 ${result.selected.san}。${chess.isCheck()?'你被将军了。':'轮到你了。'}`);
    } else status('输出神经元没有产生可读信号。可调长模拟时长后重试，或撤回这步。',true);
  }catch(e){status(`计算未完成：${e.message}`,true);}
  finally{busy=false;renderBoard();}
}
async function newGame() {
  if(busy||!ready)return;
  chess=new Chess();human=$('side').value;flipped=human==='b';selected=null;
  clearTelemetry();renderBoard();status(human==='w'?'连接组已就绪。你执白棋，请先落子。':'连接组执白，正在准备第一步。');
  await flyMove();
}
async function makeMove(move) {
  chess.move(move);selected=null;renderBoard();
  if(chess.isGameOver()){status(endMessage());return;}
  await flyMove();
}
let promotionMoves=[];
$('board').addEventListener('click',async e=>{
  const square=e.target.closest('[data-square]')?.dataset.square;
  if(!square||!ready||busy||chess.isGameOver()||chess.turn()!==human)return;
  if(selected){
    const moves=chess.moves({square:selected,verbose:true}).filter(m=>m.to===square);
    if(moves.length>1){
      promotionMoves=moves;
      $('promotion-options').innerHTML=['q','r','b','n'].map(p=>`<button data-promotion="${p}" aria-label="升变为${pieceNames[p]}">${pieceSvg(p,human)}${pieceNames[p]}</button>`).join('');
      $('promotion').showModal();return;
    }
    if(moves.length){await makeMove(moves[0]);return;}
  }
  selected=selected===square?null:chess.get(square)?.color===human?square:null;renderBoard();
});
$('promotion-options').onclick=async e=>{
  const type=e.target.closest('[data-promotion]')?.dataset.promotion;if(!type)return;
  const move=promotionMoves.find(m=>m.promotion===type);$('promotion').close();await makeMove(move);
};
$('cancel-promotion').onclick=()=>$('promotion').close();
$('new-game').onclick=newGame;$('side').onchange=newGame;
$('flip').onclick=()=>{flipped=!flipped;renderBoard();};
$('undo').onclick=()=>{
  if(busy)return;
  chess.undo();if(chess.turn()!==human&&chess.history().length)chess.undo();
  selected=null;clearTelemetry();renderBoard();status('已撤回到你的回合。');
  if(chess.turn()!==human)flyMove();
};
// Parameters can be adjusted to retry a no-signal result without resetting the game.
for(const id of ['duration','seed']) $(id).onchange=()=>{if(ready&&!busy&&chess.turn()!==human&&!chess.isGameOver())flyMove();};
$('fen-form').onsubmit=async e=>{
  e.preventDefault();if(busy||!ready)return;
  try{const loaded=new Chess($('fen-input').value.trim());chess=loaded;selected=null;clearTelemetry();renderBoard();status(endMessage()||'已载入自定义局面。');await flyMove();}
  catch(error){status('无法载入局面：'+error.message,true);}
};
$('ablate').onclick=async()=>{
  if(busy||!ready)return;
  let options;try{options={fen:chess.fen(),...settings()};}catch(e){status(e.message,true);return;}
  busy=true;controlState();status('对照实验 1/2：计算完整连接组；棋盘保持不变。');
  try{
    const intact=await requestTrial(options,'对照 1/2 · 完整连接');
    status('对照实验 2/2：保持输入相同，断开全部突触传播。');
    const disconnected=await requestTrial({...options,transmission:false},'对照 2/2 · 突触断开');
    lastAudit={intact,disconnected};showResult(intact);view.clear();
    $('phase').textContent='对照实验完成 · 评分显示完整网络';
    const dependent=intact.signalNorm>1e-8&&disconnected.signalNorm<1e-8;
    $('ablation-result').innerHTML=`<strong>${dependent?'检测到连接图对输出的因果作用。':'本次实验未检测到足够的输出差异。'}</strong> 同一局面、同一种子，完整网络信号 ${intact.signalNorm.toFixed(6)}，断开后 ${disconnected.signalNorm.toFixed(6)}。${dependent?'断开后的网络没有选择走法。':'可调整时长或更换局面再试。'}<div class="ablation-grid"><div><span>完整网络 · 总脉冲</span><b>${fmt(intact.totalSpikes)}</b></div><div><span>断开连接 · 总脉冲</span><b>${fmt(disconnected.totalSpikes)}</b></div><div><span>完整网络 / 断开 · 读出范数</span><b>${intact.signalNorm.toFixed(4)} / ${disconnected.signalNorm.toFixed(4)}</b></div></div>`;
    $('ablation-result').hidden=false;status('对照实验完成，棋局未改变。可导出两次完整计算记录。');
  }catch(e){status('对照实验失败：'+e.message,true);}
  finally{busy=false;controlState();}
};
$('replay').onclick=()=>{
  if(!lastResult||busy)return;
  if(replayTimer){stopReplay();$('phase').textContent='回放已停止';return;}
  const result=lastResult;view.clear();let cursor=0,step=0;
  $('replay').textContent='停止回放';$('phase').textContent='记录回放 · 已放慢时间';
  replayTimer=setInterval(()=>{
    step+=50;const start=cursor;
    while(cursor<result.events.length&&result.events[cursor]<step)cursor+=2;
    view.showEvents(result.events.subarray(start,cursor));
    $('phase').textContent=`记录回放 · ${Math.min(step*.1,result.durationMs).toFixed(0)} / ${result.durationMs} ms`;
    if(step*.1>=result.durationMs){stopReplay();$('phase').textContent='记录回放完成';}
  },80);
};
function download(value,name) {
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),manifest,eventFormat:'flat [step, neuronIndex, ...]; time_ms = step * 0.1; root IDs indexed by data/neurons.json.gz',...value},(key,v)=>ArrayBuffer.isView(v)?Array.from(v):v,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export').onclick=()=>lastResult&&download({trial:lastResult},'fly-chess-trial.json');
$('export-audit').onclick=()=>lastAudit&&download({audit:lastAudit},'fly-chess-ablation.json');
function boot() {
  worker?.terminate();ready=false;pending=null;$('retry-load').hidden=true;
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  function failed(message) {
    const job=pending;pending=null;
    if(job)job.reject(new Error(message));
    else {
      $('loading-title').textContent='连接组未能载入';$('loading-help').textContent=message;
      $('retry-load').hidden=false;$('load-value').textContent='可重试下载，或检查本地静态文件。';status(message,true);
    }
  }
  worker.onerror=e=>failed(e.message||'WASM 工作线程异常');
  worker.onmessage=({data})=>{
    if(data.type==='manifest') {
      manifest=data.manifest;$('neuron-count').textContent=`${fmt(manifest.neurons)} NEURONS`;
      $('about-neurons').textContent=fmt(manifest.neurons);
    }else if(data.type==='loading'){
      const percent=Math.min(100,Math.round(data.received/data.total*100));
      $('load-bar').style.width=percent+'%';$('load-value').textContent=data.phase||`${(data.received/1e6).toFixed(1)} / ${(data.total/1e6).toFixed(1)} MB · ${percent}%`;
    }else if(data.type==='ready'){
      ready=true;manifest=data.manifest;view.load(data.positions,manifest.neurons);$('loading').hidden=true;
      $('runtime').innerHTML='<i></i>本机 WASM · 校验通过';
      $('hash').innerHTML=`${fmt(manifest.edges)} 条连接 · ${fmt(manifest.synapses)} 个突触<br/>Graph SHA-256<br/><span>${manifest.graphSha256}</span><br/>WASM SHA-256<br/><span>${data.wasmSha256}</span>`;
      newGame();
    }else if(data.type==='chunk'&&pending?.id===data.id){
      view.showEvents(data.events);$('active').textContent=fmt(data.activeNeurons);$('spikes').textContent=fmt(data.totalSpikes);
      $('output-spikes').textContent=fmt(data.outputSpikes);$('sim-time').textContent=data.simulationMs.toFixed(0);
      $('progress').style.width=(data.simulationMs/pending.options.durationMs*100)+'%';
    }else if(data.type==='result'&&pending?.id===data.id){
      const job=pending;pending=null;job.resolve(data.result);
    }else if(data.type==='error')failed(data.message);
  };
  worker.postMessage({type:'init'});
}
$('retry-load').onclick=boot;
renderBoard();boot();
