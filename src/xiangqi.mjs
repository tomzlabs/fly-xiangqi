// Xiangqi rules only: no search or evaluation enters the neural readout.
// Coordinates follow UCCI: a0 is Red's left corner, i9 is Black's left corner.
export const START_FEN='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
export const names={w:{r:'车',n:'马',b:'相',a:'仕',k:'帅',c:'炮',p:'兵'},b:{r:'车',n:'马',b:'象',a:'士',k:'将',c:'砲',p:'卒'}};
const other=c=>c==='w'?'b':'w', file=x=>String.fromCharCode(97+x);
const index=s=>/^[a-i][0-9]$/.test(s)?Number(s[1])*9+s.charCodeAt(0)-97:-1;
const square=i=>file(i%9)+Math.floor(i/9);
const palace=(x,y,c)=>x>=3&&x<=5&&(c==='w'?y<=2:y>=7);
export class Chess {
  constructor(fen=START_FEN){this.load(fen);}
  load(fen){
    const fields=fen.trim().split(/\s+/), rows=fields[0].split('/'), cells=Array(90).fill(null);
    if(fields.length!==6||rows.length!==10||!['w','b'].includes(fields[1])||fields[2]!=='-'||fields[3]!=='-'||!/^\d+$/.test(fields[4])||!/^\d+$/.test(fields[5])||+fields[5]<1)throw new Error('请输入中国象棋 FEN：10 行、每行 9 路，红方 w / 黑方 b。');
    const counts={w:{},b:{}};
    rows.forEach((row,r)=>{
      let x=0;for(const ch of row){
        if(/[1-9]/.test(ch)){x+=Number(ch);continue;}
        const type=ch.toLowerCase(),color=ch===type?'b':'w',y=9-r;
        if(!'rnbakcp'.includes(type)||x>=9)throw new Error('FEN 棋子或行宽无效。');
        if((type==='k'||type==='a')&&!palace(x,y,color))throw new Error('将帅和仕士必须在己方九宫内。');
        if(type==='b'&&(color==='w'?y>4:y<5))throw new Error('象相不能过河。');
        cells[y*9+x]={type,color};counts[color][type]=(counts[color][type]||0)+1;x++;
      }if(x!==9)throw new Error('FEN 每行必须正好 9 路。');
    });
    for(const c of ['w','b']){
      if(counts[c].k!==1)throw new Error('双方必须各有一个将帅。');
      for(const [t,n] of Object.entries(counts[c]))if(n>(t==='p'?5:t==='k'?1:2))throw new Error('FEN 棋子数量超出上限。');
    }
    // Validation is transactional, including king safety of the side that just moved.
    const probe=Object.create(Chess.prototype);probe.cells=cells;
    if(probe.checked(other(fields[1])))throw new Error('非行棋方的将帅不能处于被将军状态。');
    this.cells=cells;this.side=fields[1];this.half=+fields[4];this.full=+fields[5];this.log=[];this.positions=[this.key()];
    return true;
  }
  turn(){return this.side;}
  get(s){const p=this.cells[index(s)];return p?{...p}:undefined;}
  board(){return Array.from({length:10},(_,r)=>Array.from({length:9},(_,x)=>{const i=(9-r)*9+x;return this.cells[i]?{...this.cells[i],square:square(i)}:null;}));}
  fen(){
    const rows=this.board().map(row=>{let s='',empty=0;for(const p of row){if(!p){empty++;continue;}if(empty)s+=empty;empty=0;s+=p.color==='w'?p.type.toUpperCase():p.type;}return s+(empty||'');});
    return `${rows.join('/')} ${this.side} - - ${this.half} ${this.full}`;
  }
  key(){return this.fen().split(' ').slice(0,2).join(' ');}
  reaches(from,to){
    if(from===to)return false;
    const p=this.cells[from];if(!p)return false;
    const x=from%9,y=Math.floor(from/9),tx=to%9,ty=Math.floor(to/9),dx=tx-x,dy=ty-y,ax=Math.abs(dx),ay=Math.abs(dy);
    const at=(a,b)=>this.cells[b*9+a];
    if(p.type==='n')return ax===2&&ay===1?!at(x+Math.sign(dx),y):ax===1&&ay===2&&!at(x,y+Math.sign(dy));
    if(p.type==='b')return ax===2&&ay===2&&(p.color==='w'?ty<=4:ty>=5)&&!at(x+dx/2,y+dy/2);
    if(p.type==='a')return ax===1&&ay===1&&palace(tx,ty,p.color);
    if(p.type==='p')return (dx===0&&dy===(p.color==='w'?1:-1))||(ay===0&&ax===1&&(p.color==='w'?y>=5:y<=4));
    if(p.type==='k'&&ax+ay===1&&palace(tx,ty,p.color))return true;
    if(dx!==0&&dy!==0)return false;
    let blockers=0;const step=dx?Math.sign(dx):Math.sign(dy)*9;
    for(let i=from+step;i!==to;i+=step)if(this.cells[i])blockers++;
    if(p.type==='r')return blockers===0;
    if(p.type==='c')return blockers===(this.cells[to]?1:0);
    return p.type==='k'&&dx===0&&this.cells[to]?.type==='k'&&blockers===0;
  }
  checked(color){
    const king=this.cells.findIndex(p=>p?.color===color&&p.type==='k');
    return king<0||this.cells.some((p,i)=>p&&p.color!==color&&this.reaches(i,king));
  }
  isCheck(){return this.checked(this.side);}
  moves({square:only,verbose=false}={}){
    const moves=[];
    for(let from=0;from<90;from++){
      const p=this.cells[from];if(!p||p.color!==this.side||(only&&square(from)!==only))continue;
      for(let to=0;to<90;to++){
        const target=this.cells[to];if(target?.color===p.color||target?.type==='k'||!this.reaches(from,to))continue;
        this.cells[to]=p;this.cells[from]=null;const safe=!this.checked(p.color);this.cells[from]=p;this.cells[to]=target;
        if(safe){const move={from:square(from),to:square(to),piece:p.type,color:p.color,captured:target?.type};move.san=this.notation(move);moves.push(verbose?move:move.san);}
      }
    }return moves;
  }
  notation(m){
    const f=index(m.from),t=index(m.to),x=f%9,y=Math.floor(f/9),tx=t%9,ty=Math.floor(t/9),red=m.color==='w';
    const numeral=n=>red?'一二三四五六七八九'[n-1]:String(n),column=a=>numeral(red?9-a:a+1);
    const peers=this.cells.map((p,i)=>({p,i})).filter(({p,i})=>p?.color===m.color&&p.type===m.piece&&i%9===x).sort((a,b)=>red?b.i-a.i:a.i-b.i);
    let prefix=names[m.color][m.piece]+column(x);
    if(peers.length>1){const pos=peers.findIndex(v=>v.i===f);prefix=(pos===0?'前':pos===peers.length-1?'后':peers.length===3?'中':numeral(pos+1))+names[m.color][m.piece];}
    const direction=ty===y?'平':(ty-y)*(red?1:-1)>0?'进':'退';
    return prefix+direction+(direction==='平'||'nba'.includes(m.piece)?column(tx):numeral(Math.abs(ty-y)));
  }
  move(input){
    const m=this.moves({verbose:true}).find(m=>typeof input==='string'?(m.from+m.to===input||m.san===input):m.from===input.from&&m.to===input.to);
    if(!m||this.isDraw())throw new Error('不合法的中国象棋走法。');
    this.log.push({move:m,cells:this.cells.slice(),side:this.side,half:this.half,full:this.full});
    const from=index(m.from),to=index(m.to);this.cells[to]=this.cells[from];this.cells[from]=null;
    this.half=m.captured?0:this.half+1;if(this.side==='b')this.full++;this.side=other(this.side);this.positions.push(this.key());return m;
  }
  undo(){const saved=this.log.pop();if(!saved)return null;Object.assign(this,{cells:saved.cells,side:saved.side,half:saved.half,full:saved.full});this.positions.pop();return saved.move;}
  history({verbose=false}={}){return this.log.map(x=>verbose?{...x.move}:x.move.san);}
  isCheckmate(){return this.isCheck()&&!this.moves().length;}
  isStalemate(){return !this.isCheck()&&!this.moves().length;}
  // Casual experiment rule: repetition is a draw, no tournament chase arbitration.
  isThreefoldRepetition(){return this.positions.filter(p=>p===this.key()).length>=3;}
  isDraw(){return this.isThreefoldRepetition()||this.half>=120;}
  isGameOver(){return this.isDraw()||!this.moves().length;}
}
