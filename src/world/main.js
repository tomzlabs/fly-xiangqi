import './style.css';
import {WorldView} from './view.js';
import {createWorld,sense,advanceWorld,snapshot,makeClip,LABELS,WORLD_MODEL} from './simulation.mjs';

const base=import.meta.env.BASE_URL;
document.getElementById('app').innerHTML=`
<header><a class="brand" href="${base}"><strong>蝇境</strong><span>THE FLY OBSERVATORY</span></a><nav><a href="#film">视频片段</a><a href="https://github.com/tomzlabs/fly-xiangqi" target="_blank" rel="noreferrer">GitHub ↗</a></nav></header>
<main><div class="intro"><div><p class="eyebrow">A SMALL WORLD, STILL UNFOLDING</p><h1>一只果蝇，正在经历此刻。</h1></div><span>实验 001<br>苔藓 · 浆果 · 光</span></div>
<div class="layout"><section><div class="stage" id="stage"><div class="stage-label" id="stage-label">实时模拟 · 连接组加载中</div><div class="stage-bottom"><strong id="action">世界已就绪</strong><span id="position">X −1.80 / Z +0.80</span></div></div><div class="controls"><button id="pause" class="primary" disabled>暂停世界</button><button id="camera" aria-pressed="false">跟随果蝇</button><button id="record" disabled>录制 30 秒</button><button id="export" disabled>导出分镜</button></div></section>
<aside class="side"><h2>此刻，正在发生</h2><p class="status" id="status" role="status">正在加载完整连接组。首次打开需要下载约 50 MB。</p><div class="metrics"><div><strong id="world-time">00:00</strong><span>世界时间</span></div><div><strong id="spikes">—</strong><span>本轮真实脉冲</span></div><div><strong id="neural-time">0.00 s</strong><span>神经模型时间</span></div><div><strong id="energy">80%</strong><span>模拟能量</span></div></div><div><label class="field">光照强度<input id="light" type="range" min="0" max="100" value="70"/><small>改变输入，观察行为的变化。</small></label><button id="food">移动浆果</button></div><ul class="events" id="events"><li>等待第一轮神经活动。</li></ul></aside></div>
<section class="section" id="film"><div><p class="eyebrow">FROM BEHAVIOR TO FILM</p><h2>世界继续，故事继续。</h2><p>每 4 秒模拟生成一段分镜。导出后可接入视频生成，生成好的片段按顺序播放。</p></div><div><div class="clips" id="clips"><span class="empty">第一段分镜正在积累行为记录…</span></div><label class="upload">载入视频片段<input id="videos" type="file" accept="video/*" multiple/></label><p id="video-status" role="status" style="margin-top:12px">尚未接入付费视频生成。上方是实时模拟画面。</p><div class="video-wrap" id="video-wrap" hidden><video id="player" controls playsinline preload="auto"></video></div></div></section>
<details><summary>这只果蝇，如何行动？</summary><p>138,639 个神经元的连接组参与逐步计算。连续窗口保留膜电位、突触电流、延迟事件和随机数状态。环境的光照、浆果距离、边界与能量，被人工映射到感觉输入；固定、未训练的读出层将输出映射成移动、转向或停留。这些映射尚未经过生物行为验证，画面是工程模拟。</p><p>世界时间与神经模型时间按 1:1 推进，计算较慢时播放也会放慢。动作之间的视觉过渡经过平滑。模拟仅在此页面打开时运行，刷新会重新开始；分镜仅保留最近 60 段。生成视频是对行为的艺术呈现，不代表读取果蝇的主观体验。付费生成需要单独配置服务和上限。</p></details>
<footer><span>蝇境 / 连接组驱动的微观世界实验</span><a href="https://x.com/okmetom" target="_blank" rel="noreferrer">@okmetom ↗</a></footer></main>`;
const $=id=>document.getElementById(id);
const view=new WorldView($('stage'));
const state=createWorld();let previous={...state},lastResult=null,paused=false,ready=false,inflight=false,lastUpdate=performance.now(),windowMs=850;
let clips=[],clipStart=snapshot(state),nextClipTime=4,clipCount=0,events=[],recorder,recordTimer,recordChunks=[];
const clock=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const worker=new Worker(new URL('../worker.js',import.meta.url),{type:'module'});
function requestStep(){if(!ready||paused||inflight)return;inflight=true;worker.postMessage({type:'world-step',channels:sense(state)});}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function renderClips(){ $('clips').replaceChildren(...clips.slice(-8).map(clip=>{const b=document.createElement('button');b.className='clip';b.textContent=`片段 ${String(clip.id).padStart(3,'0')}`;const sub=document.createElement('span');sub.textContent=`${clock(clip.start.time)} · ${LABELS[clip.end.action]}`;b.append(sub);b.onclick=()=>download(JSON.stringify(clip,null,2),`fly-scene-${clip.id}.json`,'application/json');return b;}));}
function fail(message){paused=true;ready=false;$('status').textContent=message;$('status').classList.add('error');$('stage-label').textContent='模拟已停止';$('pause').disabled=true;if(recorder?.state==='recording')recorder.stop();}
worker.onmessage=({data})=>{
  if(data.type==='loading')$('status').textContent=data.phase||`连接组加载 ${Math.min(100,Math.round(data.received/data.total*100))}%`;
  if(data.type==='error')fail(data.message);
  if(data.type==='ready')worker.postMessage({type:'world-start',seed:42});
  if(data.type==='world-started'){ready=true;$('pause').disabled=false;$('record').disabled=typeof MediaRecorder==='undefined'||!view.canvas.captureStream;$('status').textContent='连续神经模拟已开始。你可以改变光照与浆果位置。';$('stage-label').textContent='实时模拟 · 连续神经状态';requestStep();}
  if(data.type==='world-result'){
    const now=performance.now();windowMs=Math.max(80,now-lastUpdate);lastUpdate=now;inflight=false;previous={...state};lastResult=data.result;advanceWorld(state,data.result);
    $('action').textContent=LABELS[state.action];$('position').textContent=`X ${state.x.toFixed(2)} / Z ${state.z.toFixed(2)}`;
    $('world-time').textContent=clock(state.time);$('neural-time').textContent=`${(lastResult.neuralMs/1000).toFixed(2)} s`;$('spikes').textContent=lastResult.spikes.toLocaleString();$('energy').textContent=Math.round(state.energy*100)+'%';
    if(events[0]?.action!==state.action){events.unshift({time:state.time,action:state.action});events=events.slice(0,16);$('events').innerHTML=events.map(e=>`<li><time>${clock(e.time)}</time>${LABELS[e.action]}</li>`).join('');}
    if(state.time+1e-6>=nextClipTime){const end=snapshot(state,lastResult);clips.push(makeClip(clipStart,end,++clipCount));clips=clips.slice(-60);clipStart=end;nextClipTime+=4;$('export').disabled=false;renderClips();}
    // Yield to controls before the next expensive worker request.
    setTimeout(requestStep,20);
  }
};
worker.onerror=e=>fail(e.message||'模拟加载失败，请刷新重试');worker.postMessage({type:'init'});
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'继续世界':'暂停世界';$('stage-label').textContent=paused?'模拟已暂停':'实时模拟 · 连续神经状态';if(!paused)requestStep();};
$('camera').onclick=()=>{view.track=!view.track;$('camera').textContent=view.track?'俯瞰世界':'跟随果蝇';$('camera').setAttribute('aria-pressed',String(view.track));};
$('light').oninput=e=>state.light=Number(e.target.value)/100;
let foodIndex=0;const foodPositions=[[1.4,-0.4],[-2,-1.3],[2,1.8],[0,-2]];
$('food').onclick=()=>{foodIndex=(foodIndex+1)%foodPositions.length;const [x,z]=foodPositions[foodIndex];state.food={x,z};};
$('export').onclick=()=>download(JSON.stringify({version:1,model:WORLD_MODEL,createdAt:new Date().toISOString(),note:'Engineered sensory and untrained motor adapter. Artistic video plans; not subjective experience.',clips},null,2),'fly-world-plan.json','application/json');
$('record').onclick=()=>{
  if(recorder?.state==='recording'){recorder.stop();return;}
  try{
    const stream=view.canvas.captureStream(30);const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});recordChunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};
    recorder.onerror=()=>{$('status').textContent='录制失败，请重试。';};
    recorder.onstop=()=>{clearTimeout(recordTimer);download(new Blob(recordChunks,{type:recorder.mimeType}),`fly-world-${Date.now()}.${recorder.mimeType.includes('mp4')?'mp4':'webm'}`,recorder.mimeType);stream.getTracks().forEach(t=>t.stop());$('record').textContent='录制 30 秒';$('record').classList.remove('recording');};
    recorder.start(1000);$('record').textContent='结束并保存';$('record').classList.add('recording');recordTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},30000);
  }catch(e){$('status').textContent='浏览器未能开始录制：'+e.message;}
};
let videoUrls=[],videoNames=[],videoIndex=0;
function playVideo(){const p=$('player');p.src=videoUrls[videoIndex];$('video-status').textContent=`正在播放 ${videoIndex+1}/${videoUrls.length} · ${videoNames[videoIndex]}（顺序循环）`;p.play().catch(()=>{$('video-status').textContent='片段已载入，点击视频播放。';});}
$('videos').onchange=e=>{videoUrls.forEach(URL.revokeObjectURL);const files=Array.from(e.target.files).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));videoNames=files.map(f=>f.name);videoUrls=files.map(f=>URL.createObjectURL(f));videoIndex=0;$('video-wrap').hidden=!files.length;if(files.length)playVideo();};
$('player').onended=()=>{videoIndex=(videoIndex+1)%videoUrls.length;playVideo();};
$('player').onerror=()=>{$('video-status').textContent='这个视频无法解码，请载入浏览器支持的 MP4 或 WebM。';};
function frame(now){const t=paused?1:Math.min(1,(now-lastUpdate)/windowMs);let dh=state.heading-previous.heading;dh=Math.atan2(Math.sin(dh),Math.cos(dh));view.render({...state,x:previous.x+(state.x-previous.x)*t,z:previous.z+(state.z-previous.z)*t,heading:previous.heading+dh*t},paused?0:now/1000);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.render_game_to_text=()=>JSON.stringify({ready,paused,inflight,world:state,neural:lastResult,clips:clips.length,recording:recorder?.state==='recording',coordinateSystem:'x/z horizontal, y up; heading 0 points +x'});
