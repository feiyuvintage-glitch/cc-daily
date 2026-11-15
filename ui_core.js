// ===== UI 核心：路由、弹窗、委托事件 =====
const SPACES=[
 ['todo','今日待办','todo','13_todo'],['auction','拍卖图册','biz','01_auction'],['auth','鉴定样本库','biz','02_appraisal'],['inv','库存','biz','03_stock'],['sales','销售','biz','04_sales'],
 ['exp','公司费用表','biz','05_expense'],['funds','流动资金表','biz','06_cash'],['hj','合股·寄卖','biz','07_consign'],['trip','出差飞行图','biz','08_travel'],
 ['health','家庭健康','fam','09_health'],['family','家庭','fam','10_family'],['kids','孩子创作','fam','11_kids'],['docs','证件与到期','fam','12_docs']];
const PAGES={home:'CC的工作日常',backup:'备份与数据'};
const ACC={sales:['#2f4a6b','#B8862E'],inv:['#2f4a6b','#B8862E'],auction:['#2f4a6b','#B8862E'],auth:['#2f4a6b','#B8862E'],exp:['#1c2f4f','#34C77B'],funds:['#1d5a3f','#2F7D5B'],hj:['#1f6f66','#2A9D8F'],trip:['#a8501f','#E86A2C'],health:['#b5594b','#F38876'],family:['#a2741a','#FFC93C'],kids:['#b8650f','#FF9F1C'],docs:['#1679a8','#29B6F6'],todo:['#4B3C8F','#7C6CF2'],home:['#1E2D46','#B8862E'],backup:['#1E2D46','#B8862E']};
function icoImg(sp,size=36){const s=SPACES.find(x=>x[0]===sp);return s?`<img src="icons/space/${s[3]}.png" width="${size}" height="${size}" alt="">`:'';}
let CUR='home';const H={};const UI={};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+Math.round(n).toLocaleString('ja-JP');
const cny=n=>n==null||n===''?'—':'¥'+Math.round(n).toLocaleString('zh-CN');
function fmtAmt(min,cur){const v=min/unit(cur);const neg=v<0;const a=Math.abs(v);const s=cur==='JPY'?Math.round(a).toLocaleString('ja-JP'):(a%1?a.toFixed(2):String(a)).replace(/\B(?=(\d{3})+(?!\d))/g,',');return (neg?'−':'')+(cur==='USD'?'$'+s:s+(cur==='JPY'?' 円':' 元'));}
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
function root(){return $('#root');}
function toast(msg,ms=3500){const t=$('#toast');t.innerHTML=msg;t.style.display='block';clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',ms);}
function go(sp){CUR=sp;if(location.hash!=='#/'+sp)history.replaceState(null,'','#/'+sp);$('#sidebar').hidden=true;const a=ACC[sp]||ACC.sales;document.documentElement.style.setProperty('--acc',a[0]);document.documentElement.style.setProperty('--line',a[1]);render();root().scrollTop=0;}
function render(){const sp=SPACES.find(s=>s[0]===CUR);$('#topTitle').textContent=sp?sp[1]:PAGES[CUR]||'';try{root().innerHTML=(UI[CUR]||(()=>'<div class=empty>未实现</div>'))();}catch(e){console.error(e);root().innerHTML='<div class="card dangert">渲染出错：'+esc(e.message)+'</div>';}renderFabs();if(CUR==='backup')bkStorageLine();}
function header(sp,extra=''){const s=SPACES.find(x=>x[0]===sp);return `<div class="ph"><span class="ico">${icoImg(sp)}</span><h1>${s[1]}</h1>${extra}</div>`;}
function renderFabs(){const f=$('#fabs');if($('#modals').children.length||CUR==='home'){f.innerHTML='';return;}f.innerHTML=`<button class="fab" style="bottom:calc(72px + var(--sab))" data-a="top" aria-label="回顶">↑</button><button class="fab" style="bottom:calc(24px + var(--sab))" data-a="bottom" aria-label="回底">↓</button>`;}
H.top=()=>root().scrollTo(0,0);H.bottom=()=>root().scrollTo(0,root().scrollHeight);
H.sidebar=()=>{const sb=$('#sidebar');sb.hidden=!sb.hidden;const item=s=>`<a href="#/${s[0]}" data-a="go" data-sp="${s[0]}" class="${s[0]===CUR?'on':''}"><span class="ico">${icoImg(s[0])}</span>${s[1]}</a>`;
 sb.innerHTML=`<div class="panel"><a href="#/home" data-a="go" data-sp="home" class="${CUR==='home'?'on':''}"><span class="ico brand">CC</span>首页</a>${item(SPACES[0])}<div class="gh">生意</div>${SPACES.filter(s=>s[2]==='biz').map(item).join('')}<div class="gh">家庭</div>${SPACES.filter(s=>s[2]==='fam').map(item).join('')}<div class="gh">数据</div><a href="#/backup" data-a="go" data-sp="backup" class="${CUR==='backup'?'on':''}"><span class="ico brand">⇅</span>备份与数据</a></div>`;};
H.sbMask=(el,ev)=>{if(ev.target===el)el.hidden=true;};
H.go=(el,ev)=>{ev.preventDefault();closeAll();go(el.dataset.sp);};
// ---- 弹窗 ----
let LOCK=0;
function openModal({title,body,actions='',single=false,id='',titleExtra=''}){const m=$('#modals');const wrap=document.createElement('div');wrap.dataset.mid=id;
 const head=`<div class="mh"><div class="t">${title}</div>${titleExtra}<button class="closeb" data-a="closeModal" aria-label="关闭">✕</button></div>`;
 if(single){wrap.className='sroot';wrap.innerHTML=`<div class="inner"><div class="panel">${head}<div class="mb">${body}</div>${actions?`<div class="ma">${actions}</div>`:''}</div></div>`;}
 else{wrap.className='mask';wrap.innerHTML=`<div class="mp">${head}<div class="mb">${body}</div>${actions?`<div class="ma">${actions}</div>`:''}</div>`;}
 m.appendChild(wrap);LOCK++;root().style.overflow='hidden';renderFabs();return wrap;}
function closeModal(){const m=$('#modals');if(m.lastElementChild)m.lastElementChild.remove();LOCK=Math.max(0,LOCK-1);if(!LOCK)root().style.overflow='';renderFabs();}
function closeAll(){while($('#modals').children.length)closeModal();}
function topModal(){return $('#modals').lastElementChild;}
H.closeModal=()=>{closeModal();render();};
function confirm2(el,label,fn){if(el.dataset.armed){fn();return;}el.dataset.armed='1';el.dataset.old=el.innerHTML;el.innerHTML=label;el.classList.add('danger');setTimeout(()=>{if(el.isConnected){delete el.dataset.armed;el.innerHTML=el.dataset.old;el.classList.remove('danger');}},6000);}
function safe(fn){try{return fn();}catch(e){if(e instanceof UserErr){toast('<b>未保存：</b>'+esc(e.message));return {__err:e};}throw e;}}
function val(id){const e=document.getElementById(id);return e?e.value:undefined;}
function chk(id){const e=document.getElementById(id);return e?e.checked:false;}
document.addEventListener('click',ev=>{const el=ev.target.closest('[data-a]');if(!el)return;const h=H[el.dataset.a];if(h){h(el,ev);}});
document.addEventListener('input',ev=>{const el=ev.target;if(el.dataset.in&&H[el.dataset.in])H[el.dataset.in](el,ev);});
document.addEventListener('change',ev=>{const el=ev.target;if(el.dataset.ch&&H[el.dataset.ch])H[el.dataset.ch](el,ev);});
document.addEventListener('focusin',ev=>{const el=ev.target;if(el.dataset.fo&&H[el.dataset.fo])H[el.dataset.fo](el,ev);});
document.addEventListener('focusout',ev=>{const el=ev.target;if(el.dataset.bl&&H[el.dataset.bl])H[el.dataset.bl](el,ev);});
document.addEventListener('keydown',ev=>{const el=ev.target;if(ev.key==='Enter'&&el.dataset.en&&H[el.dataset.en]){ev.preventDefault();H[el.dataset.en](el,ev);}if(ev.key==='Escape'&&topModal()&&!topModal().classList.contains('sroot')){closeModal();render();}});
const APP_VER='1.0.0';
async function boot(){try{await recoverFromIDB();}catch(e){}const h=(location.hash||'').replace('#/','');if(SPACES.some(s=>s[0]===h)||PAGES[h])CUR=h;if(new URLSearchParams(location.search).get('seed')==='1'&&!localStorage.getItem(DBKEY))seedAll();
 {const db=load();if(localStorage.getItem(DBKEY)&&purgeExpired(db))save(db);}
 go(CUR);try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}
 if('serviceWorker' in navigator&&location.protocol!=='file:'&&!window.__noSW)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});setTimeout(()=>Att.gc(),3000);window.__booted=true;}
window.addEventListener('hashchange',()=>{const h=(location.hash||'').replace('#/','');if(h!==CUR&&(SPACES.some(s=>s[0]===h)||PAGES[h])){closeAll();document.querySelectorAll('.reader').forEach(r=>r.remove());go(h);}});
function badges(list){const b=list.filter(Boolean);if(b.length<=2)return b.join(' ');return b.slice(0,2).join(' ')+` <span class="pill grey" data-a="morebadge" data-all="${esc(b.slice(2).join(''))}">+${b.length-2}</span>`;}
H.morebadge=(el,ev)=>{ev.stopPropagation();el.outerHTML=el.dataset.all;};
function copy(t){try{navigator.clipboard.writeText(t);}catch(e){}window.__lastCopy=t;toast('已复制：'+esc(t));}
H.copy=(el,ev)=>{ev.stopPropagation();copy(el.dataset.t);};

// ===== 首页：大图标、分组、今日要事一眼看到 =====
UI.home=()=>{const db=load();let must=0,all=0;try{const rows=todoDerive(db);must=rows.filter(r=>r.sev==='must').length;all=rows.length;}catch(e){}const c=cfg();const last=c.lastBackup?Math.floor((NOW()-c.lastBackup)/DAY):null;const has=db.inv.length||db.sales.length||db.accounts.length||db.expenses.length||db.family.length||db.docs.length;
 const tile=s=>`<button class="tile" data-a="go" data-sp="${s[0]}"><img src="icons/space/${s[3]}.png" width="48" height="48" alt=""><span>${s[1]}</span></button>`;
 return `<div class="hometop"><div class="brandmark">CC <span>的工作日常</span></div><div class="muted small">${today()} · 东京</div></div>
 <button class="todoBig" data-a="go" data-sp="todo"><img src="icons/space/13_todo.png" width="56" height="56" alt=""><div class="grow"><div class="t">今日待办</div><div class="muted">${all?`共 ${all} 条`:'暂无待办'}</div></div>${must?`<span class="pill red big">必须处理 ${must}</span>`:''}</button>
 <div class="gh2">生意</div><div class="tiles">${SPACES.filter(s=>s[2]==='biz').map(tile).join('')}</div>
 <div class="gh2">家庭</div><div class="tiles">${SPACES.filter(s=>s[2]==='fam').map(tile).join('')}</div>
 <button class="bkline ${last==null||last>7?'stale':''}" data-a="go" data-sp="backup"><span>⇅ 备份与数据</span><span class="small">${has?(last==null?'还没备份过 · 建议现在导出一份':'上次备份 '+(last===0?'今天':last+' 天前')):'本机还没有数据 · 可导入备份或载入示例'}</span></button>`;};
