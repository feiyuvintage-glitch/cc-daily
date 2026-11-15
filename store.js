// ===== CC的工作日常 · 数据与业务层（本机存储；与飛版隔离的独立命名空间） =====
const DBKEY='cc13_db', OFFKEY='cc13_offset_ms', CFGKEY='cc13_cfg', RECONKEY='cc13_reconlog', READKEY='cc13_read_';
const DAY=86400000;
function NOW(){return Date.now()+Number(localStorage.getItem(OFFKEY)||0);}
function tokyoDate(ms){const d=new Date((ms??NOW())+9*3600000);return d.toISOString().slice(0,10);}
function today(){return tokyoDate();}
function addDays(ds,n){const d=new Date(ds+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function diffDays(a,b){return Math.round((new Date(a+'T00:00:00Z')-new Date(b+'T00:00:00Z'))/DAY);}
function cfg(){try{return JSON.parse(localStorage.getItem(CFGKEY)||'{}')}catch(e){return{}}}
function setCfg(k,v){const c=cfg();c[k]=v;localStorage.setItem(CFGKEY,JSON.stringify(c));}
const EMPTY=()=>({seq:{},writes:0,
 inv:[],inv_deleted:[],repairs:[],loan_pending:[],
 hj:[],hj_deleted:[],
 sales:[],sales_deleted:[],sale_tomb:[],bindings:[],payments:[],pay_tomb:[],groups:[],drafts:[],inv_mirror:null,
 accounts:[],flows:[],rules:[],debts:[],checks:[],fund_settings:{recon_on:true},fund_meta:{anomaly:0,runs:0,lastWrites:0,log:[]},
 expenses:[],exp_tomb:[],exp_registry:[],
 catalogues:[],lots:[],projects:[],watches:[],metrics:[],cat_deleted:[],
 samples:[],sample_versions:[],brand_rules:[],sample_tomb:[],
 cities:[],trips:[],
 members:[],records:[],
 family:[],
 works:[],work_tomb:[],
 docs:[],doc_renewals:[],
 todo_snooze:[],todo_cleared:[],todo_prev:[],todo_meta:{}
});
let __txDepth=0,__db=null;
function load(){try{const s=localStorage.getItem(DBKEY);return s?Object.assign(EMPTY(),JSON.parse(s)):EMPTY();}catch(e){return EMPTY();}}
function save(db){db.writes=(db.writes||0)+1;try{localStorage.setItem(DBKEY,JSON.stringify(db));}catch(e){throw new UserErr('手机存储空间不足，未保存。请先导出备份并清理照片');}if(typeof mirrorToIDB==='function')mirrorToIDB();}
// 一次动作 = 一次读改写；抛错则整笔不落库（原子）
function tx(fn){const db=load();const r=fn(db);if(r&&r.__nowrite)return r.v;if(!tx.noRecon){try{reconcile(db);}catch(e){console.error(e);}}save(db);return r;}
function read(fn){return fn(load());}
function nextId(db,name){db.seq[name]=(db.seq[name]||0)+1;return db.seq[name];}
class UserErr extends Error{constructor(m,extra){super(m);this.extra=extra;}}

// ---------- 归一与匹配 ----------
function toHalf(s){return String(s||'').replace(/[\uff01-\uff5e]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/\u3000/g,' ');}
function normCode(s){return toHalf(s).replace(/[\s\-_.]/g,'').toLowerCase();}
function normName(s){return toHalf(s).replace(/[\s\-_.·]/g,'').toLowerCase();}
function editDist(a,b){a=[...a];b=[...b];const m=a.length,n=b.length;const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=1;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];}
const BRAND_ALIAS={'宝格丽':'bvlgari','宝格莉':'bvlgari','bulgari':'bvlgari','卡地亚':'cartier','梵克雅宝':'vca','梵克':'vca','vancleef':'vca','蒂芙尼':'tiffany'};
function brandKey(b){const n=normName(b);return BRAND_ALIAS[n]||n;}
function digits(s){return (String(s).match(/\d+/g)||[]).join('').replace(/^0+/,'');}

// ---------- 库存 ----------
function invActiveRepair(db,code){return db.repairs.find(r=>r.code===code&&!r.returned_date);}
function invMaterialOk(p){const m=(p&&p.material||'').trim();return m&&m!=='待补'&&!/^(黄金色|白金色|玫瑰金色|银色|金色)$/.test(m);}
function invPending(it){return it.status!=='sold'&&(!invMaterialOk(it.params)||!(it.params&&it.params.weight_g>0));}
function invCategory(name,specs){const keys=['手镯','手链','项链','项圈','戒指','耳环','耳饰','耳夹','耳针','耳钉','耳坠','胸针','吊坠','腕表','手表'];if(/套装|套件/.test(name))return'套装';for(const src of [name,specs||'']){for(const k of keys)if(src.includes(k)){if(['耳环','耳夹','耳针','耳钉','耳坠','耳饰'].includes(k))return'耳饰';if(k==='项圈')return'项链';return k;}}return'其它';}
function invMargin(it){return it.cost>0&&it.price>0?Math.round((it.price-it.cost)/it.price*1000)/10:null;}
function invSpecs(p){if(!p)return'';const seg=[p.style,p.era,p.ring_size&&('圈号'+p.ring_size),p.chain_length,p.dimensions,invMaterialOk(p)?p.material:'',p.weight_g?('重'+(p.weight_approx?'约':'')+p.weight_g+'g'):'',p.stones,(p.certs||[]).length?('附'+p.certs.join('、附')):'',p.other].filter(Boolean);return seg.join(' / ');}
const Inv={
 list(db){purgeExpired(db);return db.inv;},
 add(d){return tx(db=>{d.code=(d.code||'').trim();if(!d.code)throw new UserErr('编号不能为空');if(!(d.name||'').trim())throw new UserErr('品名不能为空');if(db.inv.some(x=>x.code===d.code))throw new UserErr('编号「'+d.code+'」已存在（编号冲突）');db.inv_deleted=db.inv_deleted.filter(x=>x.code!==d.code);const t=NOW();const it={id:nextId(db,'inv'),code:d.code,brand:d.brand||'',name:d.name.trim(),params:d.params||{material:'待补'},cost:+d.cost||0,price:+d.price||0,status:d.status||'in_stock',sale_date:d.sale_date||'',customer:d.customer||'',note:d.note||'',loaned_to:d.loaned_to||'',purchase_date:d.purchase_date||'',source:'manual',photo:d.photo||'',created_at:t,updated_at:t};it.specs=invSpecs(it.params);db.inv.push(it);return it;});},
 update(id,d){return tx(db=>{const it=db.inv.find(x=>x.id===id);if(!it)throw new UserErr('该件不存在');if(d.code!==undefined){d.code=d.code.trim();if(!d.code)throw new UserErr('编号不能为空');if(db.inv.some(x=>x.code===d.code&&x.id!==id))throw new UserErr('编号「'+d.code+'」已存在（编号冲突）');}Object.assign(it,d,{source:'manual',updated_at:NOW()});it.specs=invSpecs(it.params);return it;});},
 del(id){return tx(db=>{const i=db.inv.findIndex(x=>x.id===id);if(i<0)throw new UserErr('不存在');const it=db.inv[i];db.inv.splice(i,1);db.inv_deleted.push({...it,deleted_at:NOW()});return it;});},
 restore(code){return tx(db=>{const s=db.inv_deleted.find(x=>x.code===code);if(!s)throw new UserErr('快照不存在或已过期');if(db.inv.some(x=>x.code===code))throw new UserErr('编号已被占用，不能恢复');db.inv_deleted=db.inv_deleted.filter(x=>x.code!==code);const {deleted_at,...it}=s;db.inv.push(it);return it;});},
 purge(code){return tx(db=>{db.inv_deleted=db.inv_deleted.filter(x=>x.code!==code);});},
 sendRepair(id,dest,date,note){return tx(db=>{const it=db.inv.find(x=>x.id===id);if(invActiveRepair(db,it.code))throw new UserErr('已在修中');db.repairs.push({id:nextId(db,'rep'),code:it.code,destination:dest,sent_date:date,returned_date:'',note:note||'',created_at:NOW()});});},
 returnRepair(rid,date){return tx(db=>{const r=db.repairs.find(x=>x.id===rid);r.returned_date=date;});},
 sendDraft(id){return tx(db=>{const it=db.inv.find(x=>x.id===id);if(salesBoundTo(db,'inv',it.code)||db.drafts.some(x=>x.inv_code===it.code))throw new UserErr('这件已有销售镜像或草稿，不能再送');db.drafts.push({id:nextId(db,'draft'),inv_code:it.code,price:it.price,created_at:NOW()});});},
 markSold(id,{date,price,customer}){return tx(db=>{const it=db.inv.find(x=>x.id===id);Object.assign(it,{status:'sold',sale_date:date,sold_price:+price,customer,sold_by_mirror:true,updated_at:NOW()});});},
 unSold(id){return tx(db=>{const it=db.inv.find(x=>x.id===id);Object.assign(it,{status:'in_stock',sale_date:'',customer:'',sold_price:null,updated_at:NOW()});});},
};
function salesBoundTo(db,src,code){const liveIds=new Set(db.sales.map(s=>s.id));return db.bindings.find(b=>b.src===src&&b.code===code&&liveIds.has(b.sale_id));}

// ---------- 合股·寄卖 ----------
const HJ={
 add(sec,d){return tx(db=>{const pre=sec==='hg'?'AA':'BB';const n=nextId(db,'hj_'+sec);const code=pre+'-'+String(n).padStart(3,'0');const it={id:nextId(db,'hj'),section:sec,code,name:(d.name||'').trim(),category:d.category||'',description:d.description||'',amount:+d.amount||0,salePrice:d.salePrice===''||d.salePrice==null?null:+d.salePrice,note:d.note||'',origin:'page',status:sec==='jm'?'在寄':'',inv_code:d.inv_code||'',return_due:d.return_due||'',start_date:d.start_date||'',returned_date:'',created_at:NOW()};if(!it.name)throw new UserErr('品名必填');db.hj.push(it);return it;});},
 update(id,d){return tx(db=>{const it=db.hj.find(x=>x.id===id);Object.assign(it,d,{origin:'page'});return it;});},
 del(id){return tx(db=>{const i=db.hj.findIndex(x=>x.id===id);const it=db.hj[i];db.hj.splice(i,1);db.hj_deleted.push({code:it.code,snapshot:it,deleted_at:NOW()});});},
 restore(code){return tx(db=>{const s=db.hj_deleted.find(x=>x.code===code);db.hj.push(s.snapshot);db.hj_deleted=db.hj_deleted.filter(x=>x.code!==code);});},
 returnToOwner(id,date){return tx(db=>{const it=db.hj.find(x=>x.id===id);if(it.section!=='jm')throw new UserErr('合股条目不开放退回');if(salesBoundTo(db,'jm',it.code))throw new UserErr('已售出条目不开放退回');it.prev_status=it.status;it.status='已退回';it.returned_date=date;});},
 undoReturn(id){return tx(db=>{const it=db.hj.find(x=>x.id===id);it.status=it.prev_status||'在寄';it.returned_date='';});},
};

// ---------- 销售：镜像 / 选择器 ----------
function refreshInvMirror(db){db.inv_mirror={at:NOW(),dispatch:'D'+NOW().toString(36),inv:db.inv.map(i=>({code:i.code,brand:i.brand,name:i.name,specs:i.specs,price:i.price,cost:i.cost,status:i.status,loaned_to:i.loaned_to,repair:!!invActiveRepair(db,i.code)})),hj:db.hj.map(h=>({section:h.section,code:h.code,name:h.name,description:h.description,amount:h.amount,status:h.status,inv_code:h.inv_code}))};}
const SalesMirror={refresh(){return tx(db=>{refreshInvMirror(db);return db.inv_mirror;});}};
function saleCodeUsed(db,code){return db.sales.some(s=>s.code===code)||db.sales_deleted.some(s=>s.code===code)||db.sale_tomb.includes(code);}
function buildCandidates(db,{q='',excludeSaleId=null,batchTaken=[]}={}){
 const m=db.inv_mirror||{inv:[],hj:[]};const rows=[];const live=new Map(db.sales.map(s=>[s.id,s]));
 const occ=(src,code)=>{const b=db.bindings.find(b=>b.src===src&&b.code===code&&live.has(b.sale_id)&&b.sale_id!==excludeSaleId);return b?live.get(b.sale_id).code:null;};
 const jmByInv=new Map(m.hj.filter(h=>h.section==='jm'&&h.inv_code).map(h=>[h.inv_code,h]));
 for(const i of m.inv){const jm=jmByInv.get(i.code);const bind=jm?{src:'jm',code:jm.code}:{src:'inv',code:i.code};
  let occBy=occ(bind.src,bind.code)||occ('inv',i.code);let layer=i.status==='sold'?2:(i.loaned_to||i.repair)?1:0;let why='';
  if(occBy){layer=3;why='已绑 销售单 '+occBy;} if(jm&&jm.status==='已退回'){layer=3;why='寄卖已退回寄卖方';}
  if(batchTaken.some(t=>t.src===bind.src&&t.code===bind.code)){layer=3;why='本批其他件块已选';}
  rows.push({key:'inv:'+i.code,fillCode:i.code,bind,srcLabel:jm?'库存·寄卖 '+jm.code:'库存',isInv:true,brand:i.brand,name:i.name,specs:i.specs,listPrice:i.price,cost:i.cost,layer,why,state:i.status==='sold'?'库存已标已售':i.loaned_to?'外借中':i.repair?'维修中':'在库'});}
 for(const h of m.hj){if(h.section==='jm'&&h.inv_code&&m.inv.some(i=>i.code===h.inv_code))continue;const bind={src:h.section,code:h.code};let occBy=occ(bind.src,bind.code);let layer=h.status==='维修中'?1:0;let why='';if(occBy){layer=3;why='已绑 销售单 '+occBy;}if(h.status==='已退回'){layer=3;why='已退回寄卖方（先去合股·寄卖撤销退回）';}if(batchTaken.some(t=>t.src===bind.src&&t.code===bind.code)){layer=3;why='本批其他件块已选';}
  rows.push({key:h.section+':'+h.code,fillCode:h.code,bind,srcLabel:h.section==='jm'?'寄卖':'合股',isInv:false,brand:'',name:h.name,specs:h.description,listPrice:h.section==='jm'?h.amount:null,cost:h.section==='hg'?h.amount:null,layer,why,state:h.status||''});}
 const nq=q.trim();let out=rows;
 if(nq){const words=nq.split(/\s+/).map(w=>w);out=[];for(const r of rows){let worst=0,ok=true;for(const w of words){const t=tierOf(r,w);if(!t){ok=false;break;}worst=Math.max(worst,t);}if(ok)out.push({...r,tier:worst});}}
 out.sort((a,b)=>(nq?(a.tier-b.tier):0)||(a.layer-b.layer)||((b.isInv?1:0)-(a.isInv?1:0))||(b.fillCode>a.fillCode?1:b.fillCode<a.fillCode?-1:0));
 return out;}
function tierOf(r,w){const q=normCode(w);if(!q)return 6;const c=normCode(r.fillCode),bc=normCode(r.bind.code);if(c===q||bc===q)return 1;const dq=digits(q);if(dq&&(digits(c)===dq||digits(bc)===dq)&&/^\d+$/.test(q))return 2;if(c.startsWith(q)||bc.startsWith(q))return 3;if(c.includes(q)||bc.includes(q))return 4;const hay=normName(r.brand+' '+r.name+' '+(r.specs||''));const bk=brandKey(w);if(hay.includes(normName(w))||(bk&&normName(r.brand).includes(bk))||(bk&&brandKey(r.brand)===bk))return 5;return 0;}
function suggestAltCode(db,code,extra=[]){if(!saleCodeUsed(db,code)&&!extra.includes(code))return null;let n=2;while(saleCodeUsed(db,code+'-'+n)||extra.includes(code+'-'+n))n++;return code+'-'+n;}

// ---------- 销售：客户 ----------
function customerList(db){const map=new Map();for(const s of db.sales){if(!s.customer)continue;const e=map.get(s.customer)||{name:s.customer,count:0,last:0,unpaid:0};e.count++;e.last=Math.max(e.last,s.createdAt);e.unpaid+=Math.max(0,s.price-saleReceived(db,s.id));map.set(s.customer,e);}return [...map.values()];}
function customerCandidates(db,q){const list=customerList(db);const nq=normName(q);if(!nq){const recent=[...list].sort((a,b)=>b.last-a.last).slice(0,5);const rest=list.filter(x=>!recent.includes(x)).sort((a,b)=>b.count-a.count);return [...recent,...rest];}
 const pre=[],inc=[];for(const c of list){const n=normName(c.name);if(n.startsWith(nq))pre.push(c);else if(n.includes(nq))inc.push(c);}const byRecent=(a,b)=>b.last-a.last;return [...pre.sort(byRecent),...inc.sort(byRecent)];}
// 相近名提示：中文名两边都≥3 字、英文名两边都≥4 字时才比编辑距离≤1；2 字中文名、单字一律只认完全相等（归一后相等＝自动对齐，不弹提示）
const isCJK=s=>/[\u3400-\u9fff]/.test(s);
function customerHint(db,input){const raw=input;const n=normName(raw);if(!n)return null;const list=customerList(db);if(list.some(c=>c.name===raw))return null;let best=null;for(const c of list){const cn=normName(c.name);if(cn===n)return{name:c.name,kind:'same'};const la=[...cn].length,lb=[...n].length;const min=(isCJK(cn)||isCJK(n))?3:4;if(la<min||lb<min)continue;if(editDist(cn,n)<=1){if(!best||c.count>best.count)best=c;}}return best?{name:best.name,kind:'near'}:null;}
function alignCustomer(db,input){const n=normName(input);if(!n)return input;const hit=customerList(db).find(c=>normName(c.name)===n&&c.name!==input);return hit?hit.name:input;}

// ---------- 销售：收款 ----------
function livePayments(db,saleId){return db.payments.filter(p=>p.sale_id===saleId&&!p.deleted_at);}
function saleReceived(db,saleId){return livePayments(db,saleId).reduce((a,p)=>a+payDeduct(db,p),0);}
function acct(db,id){return db.accounts.find(a=>a.id===id);}
function payDeduct(db,p){return +p.cny||0;} // 人民币账户：人民币金额；日元账户：抵应收人民币数（同一字段 cny）
function arStatus(db,s){const r=saleReceived(db,s.id);if(r<=0)return'未收';if(r<s.price)return'部分收';return'已收清';}
function paySyncState(db,p){if(!p.ever_linked||!p.account_id)return{k:'none',t:''};if(p.blocked)return{k:'blocked',t:'同步受阻 · '+p.blocked};const f=db.flows.find(f=>f.id===p.flow_id);const sale=db.sales.find(s=>s.id===p.sale_id);const shouldLive=!p.deleted_at&&!!sale;if(f&&f.src_rev===p.pay_rev&&(!f.voided)===shouldLive)return{k:'ok',t:'已同步'};return{k:'pending',t:'待同步到资金'};}
const Pay={
 add(saleId,d){return tx(db=>{const s=db.sales.find(x=>x.id===saleId);if(!s)throw new UserErr('销售单不存在');const a=d.account_id?acct(db,d.account_id):null;if(a&&a.archived)throw new UserErr('账户已归档，不能选');if(!(+d.cny>0))throw new UserErr(a&&a.currency==='JPY'?'请填本笔抵应收的人民币数':'请填人民币金额');if(a&&a.currency==='JPY'&&!(+d.jpy>0))throw new UserErr('日元账户须填实际入账日元数');const p={id:nextId(db,'pay'),sale_id:saleId,date:d.date||today(),method:d.method||'',account_id:a?a.id:null,cny:+d.cny,jpy:a&&a.currency==='JPY'?+d.jpy:null,pay_rev:1,ever_linked:!!a,flow_id:null,created_at:NOW()};db.payments.push(p);return p;});},
 edit(pid,d){return tx(db=>{const p=db.payments.find(x=>x.id===pid);if(!p||p.deleted_at)throw new UserErr('收款不存在或已删除');const oldA=p.account_id?acct(db,p.account_id):null;const newAid=d.account_id===undefined?p.account_id:(d.account_id||null);const a=newAid?acct(db,newAid):null;
  const amountChanged=(d.cny!==undefined&&+d.cny!==p.cny)||(d.jpy!==undefined&&+d.jpy!==p.jpy);
  if(a&&a.archived&&(newAid!==p.account_id||amountChanged))throw new UserErr('该账户已归档：改金额必须改选未归档账户');
  let bump=false;if(newAid!==p.account_id)bump=true;const cur=a?a.currency:'CNY';
  if(d.cny!==undefined&&+d.cny!==p.cny&&cur!=='JPY')bump=true; // 改人民币金额升版
  if(d.jpy!==undefined&&+d.jpy!==p.jpy&&cur==='JPY')bump=true; // 改日元数升版；日元账户下改 cny＝改抵扣额，不升版
  if(a&&!p.ever_linked){p.ever_linked=true;p.linked_at=NOW();}
  Object.assign(p,{date:d.date??p.date,method:d.method??p.method,account_id:newAid,cny:d.cny!==undefined?+d.cny:p.cny,jpy:a&&a.currency==='JPY'?(d.jpy!==undefined?+d.jpy:p.jpy):null});if(bump)p.pay_rev++;p.blocked=null;return p;});},
 del(pid){return tx(db=>{const p=db.payments.find(x=>x.id===pid);p.deleted_at=NOW();});},
 restore(pid){return tx(db=>{const p=db.payments.find(x=>x.id===pid);if(!db.sales.find(s=>s.id===p.sale_id))throw new UserErr('所属销售单已删除，先恢复销售单');p.deleted_at=null;p.blocked=null;});},
 purge(pid){return tx(db=>{const p=db.payments.find(x=>x.id===pid);db.payments=db.payments.filter(x=>x.id!==pid);if(p.ever_linked)db.pay_tomb.push({id:pid,at:NOW()});});},
};

// ---------- 销售：主表 ----------
function validateSaleFields(db,it,{excludeId=null,batchCodes=[],batchBinds=[]}){const errs=[];if(!(it.code||'').trim())errs.push('编号必填');if(!(it.name||'').trim())errs.push('品名必填');if(!/^\d{4}-\d{2}-\d{2}$/.test(it.saleDate||''))errs.push('售出日期须为 YYYY-MM-DD');if(it.price===''||it.price==null||isNaN(+it.price))errs.push('卖价必填');if(it.cost===''||it.cost==null||isNaN(+it.cost))errs.push('成本必填');
 const code=(it.code||'').trim();if(code){const clash=db.sales.find(s=>s.code===code&&s.id!==excludeId)||db.sales_deleted.find(s=>s.code===code&&s.id!==excludeId)||(db.sale_tomb.includes(code)?{code}:null);if(clash)errs.push('编号「'+code+'」已被用过（唯一冲突）'+(suggestAltCode(db,code)?'，可用备选号 '+suggestAltCode(db,code):''));if(batchCodes.includes(code))errs.push('编号与本批另一件重复');}
 if(it.bind){const m=db.inv_mirror||{inv:[],hj:[]};const live=new Map(db.sales.map(s=>[s.id,s]));const b=db.bindings.find(b=>b.src===it.bind.src&&b.code===it.bind.code&&live.has(b.sale_id)&&b.sale_id!==excludeId);if(b)errs.push('绑定冲突：'+it.bind.code+' 已绑 销售单 '+live.get(b.sale_id).code);
  const exists=it.bind.src==='inv'?m.inv.some(i=>i.code===it.bind.code):m.hj.some(h=>h.code===it.bind.code);if(!exists)errs.push('绑定编号不在镜像中');
  if(it.bind.src==='inv'&&m.hj.some(h=>h.section==='jm'&&h.inv_code===it.bind.code))errs.push('这件也登记在寄卖，须绑寄卖编号');
  const h=m.hj.find(h=>h.code===it.bind.code);if(h&&h.status==='已退回')errs.push('该寄卖件已退回寄卖方，请先去合股·寄卖撤销退回');
  if(batchBinds.some(x=>x.src===it.bind.src&&x.code===it.bind.code))errs.push('与本批另一件绑定同一件货');}
 return errs;}
function groupNewId(db){const d=today().replace(/-/g,'');const n=nextId(db,'grp_'+d);const id='G-'+d+'-'+String(n).padStart(3,'0');db.groups.push({id,created_at:NOW(),next_seq:1});return id;}
const Sales={
 createBatch(common,items){return tx(db=>{if(items.length<1)throw new UserErr('至少一件');if(items.length>20)throw new UserErr('一次最多 20 件');
   const errors=[];const codes=[],binds=[];items.forEach((it,i)=>{const full={...it,customer:common.customer,saleDate:common.saleDate};const e=validateSaleFields(db,full,{batchCodes:codes,batchBinds:binds});if(e.length)errors.push({index:i,errs:e});codes.push((it.code||'').trim());if(it.bind)binds.push(it.bind);});
   if(errors.length){const err=new UserErr('有 '+errors.length+' 件校验不过，整批未保存',errors);throw err;}
   const t=NOW();const customer=alignCustomer(db,(common.customer||'').trim());let gid=null;if(items.length>=2)gid=groupNewId(db);const g=gid&&db.groups.find(x=>x.id===gid);
   const out=items.map(it=>{const s={id:nextId(db,'sale'),code:it.code.trim(),brand:it.brand||'',name:it.name.trim(),specs:it.specs||'',saleDate:common.saleDate,customer,listPrice:it.listPrice===''||it.listPrice==null?null:+it.listPrice,price:+it.price,cost:+it.cost,note:it.note||'',source:'manual',createdAt:t,updatedAt:t,group_id:gid,group_seq:gid?g.next_seq++:null,fill_snap:it.fill_snap||null,cost_note:it.cost_note||'',dunning:false};db.sales.push(s);if(it.bind)db.bindings.push({sale_id:s.id,src:it.bind.src,code:it.bind.code,inv_code:it.bind.inv_code||null});db.drafts=db.drafts.filter(dr=>!(it.bind&&(dr.inv_code===it.bind.code||dr.inv_code===it.bind.inv_code)));return s;});
   if(cfg().faultAfter!=null){/*故障注入：模拟写入中途崩溃——由于整批一次落库，抛错即整笔不写*/const k=cfg().faultAfter;if(out.length>k)throw new UserErr('（注入故障）第 '+(k+1)+' 件写入时崩溃');}
   return out;});},
 update(id,d){return tx(db=>{const s=db.sales.find(x=>x.id===id);if(!s)throw new UserErr('不存在');const full={...s,...d};const e=validateSaleFields(db,full,{excludeId:id});if(e.length)throw new UserErr(e.join('；'));let left=false;
   const cust=alignCustomer(db,(d.customer??s.customer).trim());if(s.group_id&&(cust!==s.customer||(d.saleDate&&d.saleDate!==s.saleDate))){s.left_group=s.group_id;s.group_id=null;s.group_seq=null;left=true;}
   Object.assign(s,d,{customer:cust,listPrice:d.listPrice===''?null:(d.listPrice==null?s.listPrice:+d.listPrice),price:+full.price,cost:+full.cost,source:'manual',updatedAt:NOW()});
   if('bind' in d){db.bindings=db.bindings.filter(b=>b.sale_id!==id);if(d.bind)db.bindings.push({sale_id:id,src:d.bind.src,code:d.bind.code});delete s.bind;}
   return {sale:s,leftGroup:left};});},
 del(id){return tx(db=>{const i=db.sales.findIndex(x=>x.id===id);const s=db.sales[i];db.sales.splice(i,1);db.sales_deleted.push({...s,deleted_at:NOW()});return s;});},
 restore(id){return tx(db=>{const s=db.sales_deleted.find(x=>x.id===id);if(!s)throw new UserErr('快照不存在或已过期');if(db.sales.some(x=>x.code===s.code))throw new UserErr('编号被占用，拒绝恢复');const {deleted_at,...row}=s;let note='';
   if(row.group_id){const peers=db.sales.filter(x=>x.group_id===row.group_id);if(!(peers.length&&peers.some(p=>p.customer===row.customer&&p.saleDate===row.saleDate))&&peers.length){note='组信息已变，按独立单恢复';row.group_id=null;}else{note=peers.length?'已自动回组 '+row.group_id:'组内已无其他在册件，保留组号 '+row.group_id;}}
   // 绑定恢复：若绑定的件已被其他单占用，则绑定保持惰性
   const b=db.bindings.find(b=>b.sale_id===row.id);if(b){const other=db.bindings.find(x=>x!==b&&x.src===b.src&&x.code===b.code&&db.sales.some(s=>s.id===x.sale_id));if(other){db.bindings=db.bindings.filter(x=>x!==b);note+=(note?'；':'')+'原绑定的件已被其他单占用，绑定未复活';}}
   db.sales_deleted=db.sales_deleted.filter(x=>x.id!==id);db.sales.push(row);return {sale:row,note};});},
 purge(id){return tx(db=>{const s=db.sales_deleted.find(x=>x.id===id);db.sales_deleted=db.sales_deleted.filter(x=>x.id!==id);db.sale_tomb.push(s.code);for(const p of db.payments.filter(p=>p.sale_id===id)){if(p.ever_linked)db.pay_tomb.push({id:p.id,at:NOW()});}db.payments=db.payments.filter(p=>p.sale_id!==id);db.bindings=db.bindings.filter(b=>b.sale_id!==id);});},
 mergeInto(id,gid){return tx(db=>{const s=db.sales.find(x=>x.id===id);if(s.group_id)throw new UserErr('已在组里，须先移出');const peers=db.sales.filter(x=>x.group_id===gid);if(!peers.length)throw new UserErr('组内无成员');if(peers[0].customer!==s.customer)throw new UserErr('客户不同，不能并组');if(peers[0].saleDate!==s.saleDate){s.saleDate=peers[0].saleDate;}const g=db.groups.find(x=>x.id===gid);s.group_id=gid;s.group_seq=g.next_seq++;});},
 leaveGroup(id){return tx(db=>{const s=db.sales.find(x=>x.id===id);s.left_group=s.group_id;s.group_id=null;s.group_seq=null;});},
 setDunning(id,v){return tx(db=>{db.sales.find(x=>x.id===id).dunning=v;});},
 mergeCandidates(db,id){const s=db.sales.find(x=>x.id===id);const same=db.sales.filter(x=>x.id!==id&&x.customer&&x.customer===s.customer);return{sameDate:same.filter(x=>x.saleDate===s.saleDate),otherDate:same.filter(x=>x.saleDate!==s.saleDate)};},
};
function groupMembers(db,gid){return db.sales.filter(s=>s.group_id===gid).sort((a,b)=>a.group_seq-b.group_seq);}

// ---------- 资金 ----------
function acctBalance(db,a){let b=a.opening||0;for(const f of db.flows){if(f.voided)continue;if(f.account_id===a.id){if(f.direction==='in')b+=f.amount;else if(f.direction==='out'||f.direction==='transfer')b-=f.amount;}if(f.direction==='transfer'&&f.counter_account_id===a.id)b+=f.amount;}return b;}
function unit(cur){return cur==='JPY'?1:100;}
function newFlow(db,f){const r={id:nextId(db,'flow'),account_id:f.account_id,counter_account_id:f.counter_account_id||null,date:f.date,direction:f.direction,amount:f.amount,category:f.category||'',note:f.note||'',counterparty:f.counterparty||'',voided:false,void_reason:'',expense_id:f.expense_id||null,sale_payment_id:f.sale_payment_id||null,src_rev:f.src_rev||null,rule_id:f.rule_id||null,debt_id:f.debt_id||null,debt_link:f.debt_link||null,src_jpy_cny:f.src_jpy_cny||null,created_at:NOW()};db.flows.push(r);return r;}
function reconcile(db){
 const st={writes:0,anomaly:0,created:0,voided:0,unvoided:0,updated:0};const W=()=>st.writes++;
  // A. 费用 ↔ 资金（对账总开关同时管两条链）
 if(db.fund_settings.recon_on){const reg=new Set(db.exp_registry||[]);for(const e of db.expenses){if(!reg.has(e.id)){reg.add(e.id);(db.exp_registry=db.exp_registry||[]).push(e.id);}const linked=e.account_id&&(e.scope==='company'||e.actual_outflow);const flows=db.flows.filter(f=>f.expense_id===e.id);const live=flows.find(f=>!f.voided);const a=linked?acct(db,e.account_id):null;
  if(!linked){if(live){live.voided=true;live.void_reason='费用取消出账账户';W();st.voided++;}continue;}
  const amt=e.amount;const note=e.item+' · '+e.payee;
  if(e.deleted_at){if(live){live.voided=true;live.void_reason='来源费用已删除';W();st.voided++;}continue;}
  if(live){if(live.account_id!==e.account_id||live.amount!==amt){live.voided=true;live.void_reason='费用金额/账户变更';W();st.voided++;const n=newFlow(db,{account_id:e.account_id,date:e.date,direction:'out',amount:amt,category:e.category,note,expense_id:e.id});e.flow_id=n.id;W();st.created++;}
    else if(live.date!==e.date||live.note!==note||live.category!==e.category){live.date=e.date;live.note=note;live.category=e.category;W();st.updated++;if(e.flow_id!==live.id){e.flow_id=live.id;}}
    else if(e.flow_id!==live.id){e.flow_id=live.id;W();}continue;}
  const back=flows.find(f=>f.voided&&f.void_reason==='来源费用已删除'&&f.account_id===e.account_id&&f.amount===amt);
  if(back){if(a&&a.archived){e.sync_blocked='出账账户已归档，未撤销作废';continue;}back.voided=false;back.void_reason='';back.date=e.date;e.flow_id=back.id;W();st.unvoided++;continue;}
  const n=newFlow(db,{account_id:e.account_id,date:e.date,direction:'out',amount:amt,category:e.category,note,expense_id:e.id});e.flow_id=n.id;W();st.created++;}
  // 费用链部分载荷护栏：来源费用读不到时，只有墓碑里有（30 天到期清除）才作废；登记过但读不到、或从没登记过的一律不动，只计入页首「镜像异常」
  const expIds=new Set(db.expenses.map(e=>e.id));const etomb=new Set(db.exp_tomb||[]);const seenE=new Set();
  for(const f of db.flows){if(!f.expense_id||expIds.has(f.expense_id))continue;if(etomb.has(f.expense_id)){if(!f.voided){f.voided=true;f.void_reason='来源费用已清除';W();st.voided++;}else if(!/已清除/.test(f.void_reason)){f.void_reason+='；来源已清除';W();}continue;}if(!seenE.has(f.expense_id)){seenE.add(f.expense_id);st.anomaly++;}}}
 // B. 销售收款 ↔ 资金（总开关）
 if(db.fund_settings.recon_on){const saleById=new Map(db.sales.map(s=>[s.id,s]));const delSale=new Map(db.sales_deleted.map(s=>[s.id,s]));const tomb=new Set(db.pay_tomb.map(t=>t.id));const payById=new Map(db.payments.map(p=>[p.id,p]));
  for(const p of db.payments){if(!p.ever_linked)continue;const flows=db.flows.filter(f=>f.sale_payment_id===p.id);const live=flows.find(f=>!f.voided);const sale=saleById.get(p.sale_id)||delSale.get(p.sale_id);const active=!p.deleted_at&&saleById.has(p.sale_id)&&!!p.account_id;
   if(!active){if(live){live.voided=true;live.void_reason=p.deleted_at?'收款已删除':(!saleById.has(p.sale_id)?'所属销售单已删除':'收款取消挂账户');W();st.voided++;}continue;}
   const a=acct(db,p.account_id);const amount=a.currency==='JPY'?p.jpy*1:p.cny*unit(a.currency);const note='销售收款 · '+(sale?sale.code:'?')+' · '+(sale&&sale.customer||'');
   if(live&&live.src_rev===p.pay_rev){let ch=false;if(live.date!==p.date){live.date=p.date;ch=true;}if(live.note!==note){live.note=note;ch=true;}if(a.currency==='JPY'&&live.src_jpy_cny!==p.cny){live.src_jpy_cny=p.cny;ch=true;}if(ch){W();st.updated++;}if(p.flow_id!==live.id){p.flow_id=live.id;W();}continue;}
   if(live){live.voided=true;live.void_reason='收款升版 r'+live.src_rev+'→r'+p.pay_rev;W();st.voided++;}
   const back=!live&&flows.find(f=>f.voided&&f.src_rev===p.pay_rev&&/已删除/.test(f.void_reason)&&!/来源已清除/.test(f.void_reason));
   if(back){if(a.archived){p.blocked='账户已归档，未撤销作废';W();continue;}back.voided=false;back.void_reason='';back.date=p.date;back.note=note;p.flow_id=back.id;p.blocked=null;W();st.unvoided++;continue;}
   if(a.archived&&!live){p.blocked='账户已归档';continue;}
   const n=newFlow(db,{account_id:a.id,date:p.date,direction:'in',amount,category:'销售收款',note,sale_payment_id:p.id,src_rev:p.pay_rev,src_jpy_cny:a.currency==='JPY'?p.cny:null});p.flow_id=n.id;p.blocked=null;W();st.created++;}
  // 墓碑与部分载荷保护
  const seen=new Set();for(const f of db.flows){if(!f.sale_payment_id||seen.has(f.sale_payment_id+':'+f.id))continue;seen.add(f.sale_payment_id+':'+f.id);if(payById.has(f.sale_payment_id))continue;if(tomb.has(f.sale_payment_id)){if(!f.voided){f.voided=true;f.void_reason='来源已清除';W();st.voided++;}else if(!/来源已清除/.test(f.void_reason)){f.void_reason+='；来源已清除';W();}continue;}st.anomaly++;}
 }
 if(db.fund_meta.anomaly!==st.anomaly){db.fund_meta.anomaly=st.anomaly;st.writes++;}
 return st;}
const Funds={
 reconcileNow(){const db=load();const st=reconcile(db);const log=JSON.parse(localStorage.getItem(RECONKEY)||'[]');log.push({at:NOW(),...st});localStorage.setItem(RECONKEY,JSON.stringify(log.slice(-200)));if(st.writes>0)save(db);return st;}, // 无差异时零写入
 addAccount(d){return tx(db=>{if(!d.name)throw new UserErr('账户名必填');const a={id:nextId(db,'acct'),name:d.name,kind:d.kind||'bank',currency:d.currency,opening:Math.round((+d.opening||0)*unit(d.currency)),note:d.note||'',archived:false,created_at:NOW()};db.accounts.push(a);return a;});},
 archiveAccount(id){return tx(db=>{acct(db,id).archived=true;});},
 unarchiveAccount(id){return tx(db=>{acct(db,id).archived=false;});},
 addFlow(d){return tx(db=>{const a=acct(db,+d.account_id);if(!a)throw new UserErr('请选账户');if(!(+d.amount>0))throw new UserErr('金额须为正');const amount=Math.round(+d.amount*unit(a.currency));let debtId=null;
   if(d.category==='外债'&&d.counterparty){const dir=d.direction==='out'?'borrow':'lend';const debt=db.debts.find(x=>x.person===d.counterparty&&x.dir===dir&&x.currency===a.currency&&!x.settled&&(x.amount-debtPaid(db,x))>=amount);if(debt)debtId=debt.id;}
   const f=newFlow(db,{account_id:a.id,counter_account_id:d.counter_account_id?+d.counter_account_id:null,date:d.date||today(),direction:d.direction,amount,category:d.category,note:d.note,counterparty:d.counterparty,rule_id:d.rule_id?+d.rule_id:null,debt_id:debtId,debt_link:debtId?'pay':null});if(debtId)settleCheck(db,debtId);return f;});},
 guard(db,f){if(f.expense_id)throw new UserErr('由费用生成，去费用空间改');if(f.sale_payment_id){const p=db.payments.find(p=>p.id===f.sale_payment_id);const s=p&&(db.sales.find(s=>s.id===p.sale_id)||db.sales_deleted.find(s=>s.id===p.sale_id));throw new UserErr('由销售收款生成，去销售空间改（销售 › '+(s?s.code:'?')+' › 收款）');}},
 editFlow(id,d){return tx(db=>{const f=db.flows.find(x=>x.id===id);Funds.guard(db,f);const a=acct(db,f.account_id);Object.assign(f,{date:d.date??f.date,amount:d.amount!=null?Math.round(+d.amount*unit(a.currency)):f.amount,category:d.category??f.category,note:d.note??f.note});});},
 voidFlow(id){return tx(db=>{const f=db.flows.find(x=>x.id===id);Funds.guard(db,f);f.voided=true;f.void_reason='手动作废';if(f.debt_id)settleCheck(db,f.debt_id);});},
 unvoidFlow(id){return tx(db=>{const f=db.flows.find(x=>x.id===id);Funds.guard(db,f);f.voided=false;f.void_reason='';if(f.debt_id)settleCheck(db,f.debt_id);});},
 addRule(d){return tx(db=>{db.rules.push({id:nextId(db,'rule'),name:d.name,day:+d.day,amount:+d.amount,currency:d.currency||'JPY',account_id:d.account_id?+d.account_id:null,enabled:true,from:d.from||today().slice(0,7)});});},
 payRule(rid,accountId,date){return tx(db=>{const r=db.rules.find(x=>x.id===rid);const a=acct(db,accountId);newFlow(db,{account_id:a.id,date,direction:'out',amount:r.amount*unit(a.currency),category:'固定支出',note:r.name,rule_id:r.id});});},
 addDebt(d){return tx(db=>{const debt={id:nextId(db,'debt'),dir:d.dir,person:d.person,currency:d.currency,amount:Math.round(+d.amount*unit(d.currency)),due:d.due||'',settled:false,created_at:NOW()};db.debts.push(debt);if(d.account_id){newFlow(db,{account_id:+d.account_id,date:today(),direction:d.dir==='borrow'?'in':'out',amount:debt.amount,category:'外债',counterparty:d.person,debt_id:debt.id,debt_link:'origin'});}return debt;});},
 payDebt(id,accountId,amount,date){return tx(db=>{const d=db.debts.find(x=>x.id===id);const a=acct(db,accountId);newFlow(db,{account_id:a.id,date,direction:d.dir==='borrow'?'out':'in',amount:Math.round(+amount*unit(a.currency)),category:'外债',counterparty:d.person,debt_id:d.id,debt_link:'pay'});settleCheck(db,id);});},
 check(id,actual){return tx(db=>{const a=acct(db,id);const bal=acctBalance(db,a);db.checks.push({account_id:id,at:NOW(),book:bal,actual:Math.round(+actual*unit(a.currency)),diff:Math.round(+actual*unit(a.currency))-bal});});},
 setRecon(on){return tx(db=>{db.fund_settings.recon_on=on;});},
 rollbackSaleFlows(){return tx(db=>{let n=0;for(const f of db.flows)if(f.sale_payment_id&&!f.voided){f.voided=true;f.void_reason='对账总开关关停后回退';n++;}return n;});},
};
function debtPaid(db,d){return db.flows.filter(f=>f.debt_id===d.id&&f.debt_link==='pay'&&!f.voided).reduce((a,f)=>a+f.amount,0);}
function settleCheck(db,id){const d=db.debts.find(x=>x.id===id);d.settled=debtPaid(db,d)>=d.amount;}

// ---------- 费用 ----------
function expUnarchived(db,e){return !e.receipt&&!e.receipt_exempt;}
function expSyncState(db,e){const linked=e.account_id&&(e.scope==='company'||e.actual_outflow);if(!linked)return null;if(e.sync_blocked)return'同步受阻';const f=db.flows.find(f=>f.id===e.flow_id);if(!f||f.voided||f.amount!==e.amount||f.account_id!==e.account_id||f.date!==e.date)return'待同步到资金';return'ok';}
const Exp={
 add(d){return tx(db=>{const e=validateExp(db,d,true);const r={id:nextId(db,'exp'),...e,status:'确认',deleted_at:null,created_at:NOW(),flow_id:null,receipt:null,receipt_exempt:false};db.expenses.push(r);return r;});},
 update(id,d){return tx(db=>{const r=db.expenses.find(x=>x.id===id);if(r.deleted_at)throw new UserErr('已删除行须先恢复才能编辑');const e=validateExp(db,{...r,...d},false,r);Object.assign(r,e);r.sync_blocked=null;return r;});},
 del(id){return tx(db=>{db.expenses.find(x=>x.id===id).deleted_at=NOW();});},
 restore(id){return tx(db=>{db.expenses.find(x=>x.id===id).deleted_at=null;});},
 purge(id){return tx(db=>{db.expenses=db.expenses.filter(x=>x.id!==id);(db.exp_tomb=db.exp_tomb||[]).push(id);});},
 attach(id,name,att){return tx(db=>{db.expenses.find(x=>x.id===id).receipt={file_name:name,kind:/\.pdf$/i.test(name)?'pdf':'image',label:'发票',att:att||null};});},
 exempt(id,v){return tx(db=>{db.expenses.find(x=>x.id===id).receipt_exempt=v;});},
};
function validateExp(db,d,isNew,old){if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||''))throw new UserErr('日期格式不对');const amt=+d.amount;if(!(Number.isInteger(amt)&&amt>0&&amt<=999999999))throw new UserErr('金额须为正整数');for(const k of['category','item','payee'])if(!(d[k]||'').trim())throw new UserErr({category:'分类',item:'项目',payee:'付款对象'}[k]+'必填');
 let account_id=d.account_id?+d.account_id:null;const a=account_id?acct(db,account_id):null;if(a&&a.currency!=='JPY')throw new UserErr('只能选日元账户');if(a&&a.archived&&(!old||old.account_id!==account_id))throw new UserErr('账户已归档');
 if(d.scope==='company'&&!account_id&&(isNew||(old&&old.account_id)))throw new UserErr('公司费用必须选一个日元出账账户');
 if(d.scope==='personal'&&!d.actual_outflow)account_id=null;if(d.scope==='personal'&&d.actual_outflow&&!account_id)throw new UserErr('勾了实际流出，请选出账账户');
 return{scope:d.scope,date:d.date,category:d.category.trim(),item:d.item.trim(),payee:d.payee.trim(),amount:amt,period:d.period||'',note:d.note||'',account_id,actual_outflow:!!d.actual_outflow};}

// ---------- 过期清理（挂在读取路径） ----------
function purgeExpired(db){const lim=NOW()-30*DAY;let n=0;
 const keep=x=>x.deleted_at>lim;
 const inv=db.inv_deleted.filter(x=>!keep(x));db.inv_deleted=db.inv_deleted.filter(keep);n+=inv.length;
 const hj=db.hj_deleted.filter(x=>!keep(x));db.hj_deleted=db.hj_deleted.filter(keep);n+=hj.length;
 for(const s of db.sales_deleted.filter(x=>!keep(x))){db.sale_tomb.push(s.code);for(const p of db.payments.filter(p=>p.sale_id===s.id))if(p.ever_linked)db.pay_tomb.push({id:p.id,at:NOW()});db.payments=db.payments.filter(p=>p.sale_id!==s.id);n++;}db.sales_deleted=db.sales_deleted.filter(keep);
 for(const p of db.payments.filter(p=>p.deleted_at&&p.deleted_at<=lim)){if(p.ever_linked)db.pay_tomb.push({id:p.id,at:NOW()});n++;}db.payments=db.payments.filter(p=>!(p.deleted_at&&p.deleted_at<=lim));
 const ex=db.expenses.filter(e=>e.deleted_at&&e.deleted_at<=lim);db.expenses=db.expenses.filter(e=>!(e.deleted_at&&e.deleted_at<=lim));for(const e of ex)(db.exp_tomb=db.exp_tomb||[]).push(e.id);n+=ex.length;
 db.cat_deleted=db.cat_deleted.filter(keep);
 db.samples=db.samples.filter(s=>!(s.deleted_at&&s.deleted_at<=lim));
 db.members=db.members.filter(s=>!(s.deleted_at&&s.deleted_at<=lim));db.records=db.records.filter(s=>!(s.deleted_at&&s.deleted_at<=lim));
 db.family=db.family.filter(s=>!(s.deleted_at&&s.deleted_at<=lim));db.works=db.works.filter(s=>!(s.deleted_at&&s.deleted_at<=lim));db.docs=db.docs.filter(s=>!(s.deleted_at&&s.deleted_at<=lim));db.trips=db.trips.filter(s=>!(s.deleted_at&&s.deleted_at<=lim));
 return n;}
function daysLeft(delAt){return Math.max(0,Math.ceil((delAt+30*DAY-NOW())/DAY));}
