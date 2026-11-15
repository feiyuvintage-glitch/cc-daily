// ===== 销售空间 =====
const SS={q:'',f:{brand:'',customer:'',date:''},draft:null,sort:'date',panel:''};
let F=null; // 表单状态
function saleProfit(s){return s.price-s.cost;}function saleMargin(s){return s.price>0?Math.round((s.price-s.cost)/s.price*1000)/10:null;}
function salesVisible(db){let L=db.sales.slice();const q=SS.q.trim().toLowerCase();
 if(SS.f.brand)L=L.filter(s=>(s.brand||'非品牌')===SS.f.brand);if(SS.f.customer)L=L.filter(s=>s.customer===SS.f.customer);
 if(SS.f.date){const m={m1:30,m3:91,m6:182}[SS.f.date];const from=addDays(today(),-m);L=L.filter(s=>s.saleDate>=from);}
 if(q)L=L.filter(s=>[s.code,s.name,s.brand,s.specs,s.customer].join(' ').toLowerCase().includes(q));
 const by={date:(a,b)=>b.saleDate.localeCompare(a.saleDate)||b.code.localeCompare(a.code),created:(a,b)=>b.createdAt-a.createdAt||b.id-a.id,price:(a,b)=>b.price-a.price,profit:(a,b)=>saleProfit(b)-saleProfit(a),margin:(a,b)=>(saleMargin(b)??-1e9)-(saleMargin(a)??-1e9)}[SS.sort];return L.sort(by);}
UI.sales=()=>{let db=load();if(purgeExpired(db))save(db);if(!db.inv_mirror){refreshInvMirror(db);save(db);}db=load();
 const L=salesVisible(db);const tot=L.reduce((a,s)=>a+s.price,0),cost=L.reduce((a,s)=>a+s.cost,0),pr=tot-cost;
 const custHits=SS.q.trim()?[...new Set(L.map(s=>s.customer).filter(Boolean))]:[];
 const scope=[SS.f.date&&{m1:'近1个月',m3:'近3个月',m6:'近6个月'}[SS.f.date],SS.f.brand,SS.f.customer,SS.q&&('「'+SS.q+'」')].filter(Boolean).join(' · ')||'全部销售单';
 const drafts=db.drafts.filter(d=>!salesBoundTo(db,'inv',d.inv_code));
 return header('sales',`<button class="btn sm" data-a="salesMenu" aria-label="更多">⋯</button>`)+
 `<div class="card hero"><div class="row between"><span class="muted">${esc(scope)}</span><span class="muted">共 ${L.length} 单</span></div><div class="main num">${cny(tot)}</div><div class="row between muted"><span>总成本 <b class="num">${cny(cost)}</b></span><span>总利润 <b class="num profit">${cny(pr)}</b>${tot?` · 毛利率 ${Math.round(pr/tot*1000)/10}%`:''}</span></div></div>
 <div class="row" style="margin-bottom:8px"><button class="btn pri" data-a="saleNew">＋ 记一笔</button>${drafts.length?`<button class="chip" data-a="saleDrafts">库存送来的草稿 ${drafts.length}</button>`:''}</div>
 <div class="row"><input id="sq" placeholder="搜编号/品名/品牌/规格/客户" value="${esc(SS.q)}" data-in="salesQ" data-en="salesQ">${SS.q?'<button class="btn sm" data-a="salesQClear">×</button>':''}<button class="btn sm" data-a="salesFilter">筛选${SS.f.brand||SS.f.customer||SS.f.date?'•':''}</button><select id="ssort" data-ch="salesSort" style="width:96px">${[['date','售出日期'],['created','最新录入'],['price','卖价'],['profit','利润'],['margin','毛利率']].map(o=>`<option value="${o[0]}" ${SS.sort===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
 ${custHits.length>=2?`<div class="chips" style="margin-top:6px">${custHits.map(c=>`<button class="chip" data-a="salesPickCust" data-c="${esc(c)}">${esc(c)} · ${L.filter(s=>s.customer===c).length}</button>`).join('')}</div>`:''}
 <div class="row" style="margin:8px 0"><button class="chip" data-a="salesRank">客户排行</button><button class="chip" data-a="salesAR">应收账款 ${cny(db.sales.reduce((a,s)=>a+Math.max(0,s.price-saleReceived(db,s.id)),0))}</button></div>
 ${L.length?L.map(s=>saleCard(db,s)).join(''):`<div class="empty">${db.sales.length?'筛选无结果 <button class="link" data-a="salesClearAll">清除搜索和筛选</button>':'还没有销售单，点「＋ 记一笔」'}</div>`}`;};
function saleSyncPill(db,s){const ps=livePayments(db,s.id).map(p=>paySyncState(db,p));if(ps.some(x=>x.k==='blocked'))return'<span class="pill warn">同步受阻</span>';if(ps.some(x=>x.k==='pending'))return'<span class="pill warn">待同步到资金</span>';return'';}
function salePic(db,s){const b=db.bindings.find(b=>b.sale_id===s.id);if(!b)return null;const code=b.inv_code||b.code;const it=db.inv.find(i=>i.code===code)||db.inv.find(i=>i.code===b.code);if(it&&it.pics&&it.pics.length)return it.pics[0];const h=db.hj.find(h=>h.code===b.code);return h&&h.pics&&h.pics[0]||null;}
function saleCard(db,s){const m=saleMargin(s);const pic=salePic(db,s);const gN=s.group_id?groupMembers(db,s.group_id).length:0;const ar=arStatus(db,s);
 return `<div class="lcard" data-a="saleOpen" data-id="${s.id}" ${s.dunning?'style="border-left:3px solid var(--profit)"':''}><div class="pic">${pic?attImg(pic,'width:100%;height:100%;object-fit:cover'):esc(s.code)}</div><div class="body"><div style="font-size:17px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="code">${esc(s.code)}</span> ${esc(s.name)}</div>
 <div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((s.specs||'').split(' / ').join(' · '))}</div>
 <div class="kv"><span>卖价 <b>${cny(s.price)}</b></span><span>利润${m!=null?' '+m+'%':''} <b class="profit">${cny(saleProfit(s))}</b></span><span class="muted">标价 ${cny(s.listPrice)}</span><span class="muted">成本 ${cny(s.cost)}</span></div>
 <div class="muted small">${s.saleDate} · ${esc(s.customer||'未记客户')}</div><div class="row wrap" style="gap:4px;margin-top:2px">${badges([gN>=2&&`<span class="pill ink">同单 ${gN} 件</span>`,s.dunning&&'<span class="pill red">催收中</span>',ar!=='已收清'&&`<span class="pill grey">${ar}</span>`,saleSyncPill(db,s)])}</div></div></div>`;}
H.salesQ=el=>{SS.q=el.value;const pos=el.selectionStart;render();const n=$('#sq');n.focus();n.setSelectionRange(pos,pos);};
H.salesQClear=()=>{SS.q='';render();};H.salesSort=el=>{SS.sort=el.value;render();};
H.salesPickCust=el=>{SS.f.customer=el.dataset.c;SS.q='';render();};H.salesClearAll=()=>{SS.q='';SS.f={brand:'',customer:'',date:''};render();};
H.salesFilter=()=>{SS.draft={...SS.f};const db=load();const brands=[...new Set(db.sales.map(s=>s.brand||'非品牌'))];const custs=[...new Set(db.sales.map(s=>s.customer).filter(Boolean))].sort(new Intl.Collator('zh-Hans-CN').compare);
 const w=openModal({single:true,title:'筛选',body:`<div class="row between" style="position:sticky;top:52px;background:#fff;z-index:2;padding:4px 0"><button class="btn" data-a="sfReset">重置</button><button class="btn pri" data-a="sfConfirm" id="sfConfirmBtn">确认 · ${salesCountDraft()} 单</button></div>
 <div class="sec-h">日期</div><div class="chips">${[['','全部'],['m1','近1个月'],['m3','近3个月'],['m6','近6个月']].map(o=>`<button class="chip ${SS.draft.date===o[0]?'on':''}" data-a="sfDraft" data-k="date" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>
 <div class="sec-h">品牌</div><div class="chips">${['',...brands].map(b=>`<button class="chip ${SS.draft.brand===b?'on':''}" data-a="sfDraft" data-k="brand" data-v="${esc(b)}">${esc(b||'全部')}</button>`).join('')}</div>
 <div class="sec-h">客户</div><div class="chips">${['',...custs].map(b=>`<button class="chip ${SS.draft.customer===b?'on':''}" data-a="sfDraft" data-k="customer" data-v="${esc(b)}">${esc(b||'全部客户')}</button>`).join('')}</div>`});};
function salesCountDraft(){const keep=SS.f;SS.f=SS.draft;const n=salesVisible(load()).length;SS.f=keep;return n;}
H.sfDraft=el=>{SS.draft[el.dataset.k]=el.dataset.v;el.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===el));$('#sfConfirmBtn').textContent='确认 · '+salesCountDraft()+' 单';};
H.sfReset=()=>{SS.f={brand:'',customer:'',date:''};closeModal();render();};H.sfConfirm=()=>{SS.f={...SS.draft};closeModal();render();};
H.salesMenu=()=>{const db=load();openModal({single:true,title:'更多',body:`<button class="btn" style="width:100%;margin-bottom:8px" data-a="salesExport">导出（打印 / PDF / CSV）</button><button class="btn" style="width:100%;margin-bottom:8px" data-a="salesDeleted">已删除 ${db.sales_deleted.length} 条</button><button class="btn" style="width:100%" data-a="salesMirrorRefresh">同步名单（库存/寄卖/合股镜像）</button><div class="muted" style="margin-top:8px">镜像更新于 ${db.inv_mirror?new Date(db.inv_mirror.at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'—'}</div>`});};
H.salesMirrorRefresh=()=>{SalesMirror.refresh();closeModal();toast('名单镜像已刷新');render();};
H.salesRank=()=>{const db=load();const m=new Map();for(const s of db.sales){const k=s.customer||'未记客户';const e=m.get(k)||{n:0,t:0,p:0};e.n++;e.t+=s.price;e.p+=saleProfit(s);m.set(k,e);}const tot=db.sales.reduce((a,s)=>a+s.price,0)||1;const rows=[...m].sort((a,b)=>b[1].t-a[1].t);
 openModal({single:true,title:'客户排行 · 全部时间',body:rows.map(([k,e],i)=>`<div class="lrow" ${k!=='未记客户'?`data-a="salesPickCustM" data-c="${esc(k)}"`:''}><b class="${i?'':'code'}">${i+1}</b><div class="grow">${esc(k)}<div class="bar"><i style="width:${e.t/tot*100}%"></i></div><div class="muted small">${e.n} 单 · ${Math.round(e.t/tot*1000)/10}% · 利润 ${cny(e.p)}</div></div><b class="num">${cny(e.t)}</b></div>`).join('')});};
H.salesPickCustM=el=>{SS.f.customer=el.dataset.c;closeModal();render();};
H.salesAR=()=>{const db=load();const by=new Map();for(const s of db.sales){const owe=s.price-saleReceived(db,s.id);if(owe>0){const k=s.customer||'未记客户';(by.get(k)||by.set(k,[]).get(k)).push({s,owe});}}
 openModal({single:true,title:'应收账款',body:[...by].map(([k,L])=>`<div class="sec-h">${esc(k)} · 未收 ${cny(L.reduce((a,x)=>a+x.owe,0))}</div>`+L.map(x=>`<div class="lrow" data-a="saleOpenFromPanel" data-id="${x.s.id}"><span class="code">${esc(x.s.code)}</span><span class="grow">${esc(x.s.name)}</span><span class="num">${cny(x.owe)}</span></div>`).join('')).join('')||'<div class="empty">没有未收</div>'});};
H.saleOpenFromPanel=el=>{closeModal();openSaleDetail(+el.dataset.id);};
H.saleOpen=(el,ev)=>{openSaleDetail(+el.dataset.id);};
function openSaleDetail(id,replace){const db=load();const s=db.sales.find(x=>x.id===id);if(!s){toast('该单不存在');return;}if(replace)closeModal();
 const b=db.bindings.find(b=>b.sale_id===id);const pays=db.payments.filter(p=>p.sale_id===id);const live=pays.filter(p=>!p.deleted_at),dead=pays.filter(p=>p.deleted_at);const rec=saleReceived(db,id);const owe=s.price-rec;
 const same=s.customer?db.sales.filter(x=>x.customer===s.customer).sort((a,b)=>b.saleDate.localeCompare(a.saleDate)):[];
 const gm=s.group_id?groupMembers(db,s.group_id):[];
 const payRow=p=>{const a=p.account_id?acct(db,p.account_id):null;const st=paySyncState(db,p);return `<div class="lrow" style="flex-wrap:wrap"><div class="grow"><b class="num">${cny(p.cny)}</b> <span class="muted">${p.date} ${esc(p.method||'')}</span><div class="muted small">${a?esc(a.name)+(a.archived?' <span class="muted">已归档</span>':'')+(a.currency==='JPY'?' · 入账 '+fmtAmt(p.jpy,'JPY'):''):'不挂账户'} · r${p.pay_rev}</div></div>${st.k!=='none'&&st.k!=='ok'?`<span class="pill warn">${esc(st.t)}</span>`:st.k==='ok'?'<span class="pill grey">已同步</span>':''}${p.deleted_at?`<button class="btn sm" data-a="payRestore" data-id="${p.id}" data-s="${id}">恢复</button><button class="btn sm dangerline" data-a="payPurge" data-id="${p.id}" data-s="${id}">清除</button><span class="muted small">还剩 ${daysLeft(p.deleted_at)} 天</span>`:`<button class="btn sm" data-a="payEdit" data-id="${p.id}" data-s="${id}">编辑</button><button class="btn sm dangerline" data-a="payDel" data-id="${p.id}" data-s="${id}">删除</button>`}</div>`;};
 const ratio=s.listPrice?(s.price<=s.listPrice?`成交为标价的 ${Math.round(s.price/s.listPrice*100)}%`:`高于标价 ${Math.round((s.price/s.listPrice-1)*100)}%`):'';
 openModal({single:true,id:'saleDetail',title:`<span class="code">${esc(s.code)}</span> ${esc(s.name)}`,body:`${(()=>{const pic=salePic(db,s);return pic?`<div class="hero-pic" data-a="openAttImg" data-att="${pic}" data-t="${esc(s.code)}">${attImg(pic,'width:100%;height:100%;object-fit:contain')}</div>`:`<div style="height:120px;background:linear-gradient(160deg,#e9edf3,#d7dde7);border-radius:10px;display:flex;align-items:center;justify-content:center" class="code">${esc(s.code)}</div>`;})()}
 <div class="muted" style="margin:6px 0">${esc((s.specs||'').split(' / ').join(' · '))}</div>
 <div class="kv"><span>日期 <b style="font-size:15px">${s.saleDate}</b></span><span>客户 <b style="font-size:15px">${esc(s.customer||'—')}</b></span><span>标价 <b>${cny(s.listPrice)}</b></span><span>卖价 <b>${cny(s.price)}</b></span><span>成本 <b>${cny(s.cost)}</b></span><span>利润 <b class="profit">${cny(saleProfit(s))}</b> ${saleMargin(s)??''}%</span></div>
 ${ratio?`<div class="muted" style="margin-top:4px">${ratio}</div>`:''}${s.note?`<div class="card" style="margin-top:8px">${esc(s.note)}</div>`:''}
 ${b?`<div class="row" style="margin-top:8px"><span class="muted">库存编号</span><b>${esc(b.code)}</b><span class="muted small">${b.src==='jm'?'寄卖':b.src==='hg'?'合股':'库存'}</span><button class="btn sm" data-a="copy" data-t="${esc(b.code)}">复制</button></div>`:''}
 ${s.cost_note?`<div class="muted small">成本：${esc(s.cost_note)}</div>`:''}
 <div class="sec-h">收款 · 已收 ${cny(rec)} · ${owe>0?'还欠 '+cny(owe):owe<0?`<span class="warnt">多收 ${cny(-owe)}</span>`:'已收清'}</div>${live.map(payRow).join('')||'<div class="muted">暂无收款（状态：未收）</div>'}
 <button class="btn" style="margin-top:6px" data-a="payNew" data-s="${id}">＋ 记一笔收款</button>
 ${dead.length?`<div class="sec-h">已删收款 ${dead.length}</div>${dead.map(payRow).join('')}`:''}
 ${gm.length>=2?`<div class="sec-h">同单 · ${esc(s.group_id)} · ${gm.length} 件</div>${gm.map(m=>`<div class="lrow" data-a="saleSwitch" data-id="${m.id}"><span class="muted">#${m.group_seq}</span><span class="code">${esc(m.code)}</span><span class="grow">${esc(m.name)}</span><span class="num">${cny(m.price)}</span></div>`).join('')}<div class="muted">组内合计：售价 ${cny(gm.reduce((a,m)=>a+m.price,0))} · 成本 ${cny(gm.reduce((a,m)=>a+m.cost,0))} · 已收 ${cny(gm.reduce((a,m)=>a+saleReceived(db,m.id),0))}</div><button class="btn sm" data-a="saleLeave" data-id="${id}">移出本组</button>`:`<button class="btn sm" style="margin-top:8px" data-a="saleMerge" data-id="${id}">并入同单（补录）</button>`}
 ${s.customer?`<details style="margin-top:8px"><summary>这位客户的全部单（${same.length} 单 · 共 ${cny(same.reduce((a,x)=>a+x.price,0))}）</summary>${same.map(x=>`<div class="lrow" data-a="saleSwitch" data-id="${x.id}"><span>${x.saleDate}</span><span class="code">${esc(x.code)}</span><span class="grow">${esc(x.name)}</span><span>${cny(x.price)}</span></div>`).join('')}</details>`:''}
 <div class="row" style="margin-top:8px"><button class="btn sm" data-a="saleDun" data-id="${id}">${s.dunning?'撤销催收':'标为催收'}</button></div>`,
 actions:`<span class="muted small grow">来源：${s.source==='manual'?'页面记录':'外部导入'}</span><button class="btn dangerline" data-a="saleDel" data-id="${id}">删除</button><button class="btn" data-a="saleShare" data-id="${id}">分享</button><button class="btn pri" data-a="saleEdit" data-id="${id}">编辑</button>`});}
H.saleSwitch=el=>{openSaleDetail(+el.dataset.id,true);topModal().scrollTop=0;};
H.saleDun=el=>{const id=+el.dataset.id;const s=load().sales.find(x=>x.id===id);Sales.setDunning(id,!s.dunning);openSaleDetail(id,true);};
H.saleLeave=el=>{const id=+el.dataset.id;Sales.leaveGroup(id);openSaleDetail(id,true);toast('已移出组');};
H.saleMerge=el=>{const id=+el.dataset.id;const db=load();const c=Sales.mergeCandidates(db,id);const row=x=>`<div class="lrow"><span class="code">${esc(x.code)}</span><span class="grow">${esc(x.name)} ${x.saleDate}${x.group_id?' · '+x.group_id:''}</span>${x.group_id?`<button class="btn sm" data-a="saleMergeDo" data-id="${id}" data-g="${x.group_id}">并入</button>`:'<span class="muted small">未成组</span>'}</div>`;
 openModal({single:true,title:'并入同单',body:`<div class="sec-h">同客户·同日</div>${c.sameDate.map(row).join('')||'<div class="muted">无</div>'}<div class="sec-h">同客户·日期不同（确认后先改本件日期再并入）</div>${c.otherDate.map(row).join('')||'<div class="muted">无</div>'}`});};
H.saleMergeDo=el=>{const r=safe(()=>Sales.mergeInto(+el.dataset.id,el.dataset.g));if(r&&r.__err)return;closeModal();openSaleDetail(+el.dataset.id,true);toast('已并入 '+el.dataset.g);};
H.saleDel=el=>confirm2(el,'确认删除',()=>{Sales.del(+el.dataset.id);closeAll();render();toast('已删除，30 天内可在「⋯ › 已删除」恢复');});
H.salesDeleted=()=>{closeModal();const db=load();openModal({single:true,title:'已删除 '+db.sales_deleted.length+' 条',body:db.sales_deleted.slice().sort((a,b)=>b.deleted_at-a.deleted_at).map(s=>`<div class="lrow"><div class="grow"><span class="code">${esc(s.code)}</span> ${esc(s.name)}<div class="muted small">${daysLeft(s.deleted_at)===0?'今天到期清除':'还可恢复 '+daysLeft(s.deleted_at)+' 天'}</div></div><button class="btn sm" data-a="saleRestore" data-id="${s.id}">恢复</button><button class="btn sm dangerline" data-a="salePurge" data-id="${s.id}">清除</button></div>`).join('')||'<div class="empty">没有已删除</div>'});};
H.saleRestore=el=>{const r=safe(()=>Sales.restore(+el.dataset.id));if(r&&r.__err)return;closeModal();render();toast('已恢复'+(r.note?'：'+esc(r.note):''));};
H.salePurge=el=>confirm2(el,'确认永久清除',()=>{Sales.purge(+el.dataset.id);closeModal();render();toast('已永久清除');});
// ---- 收款 ----
H.payNew=el=>openPayForm(+el.dataset.s,null);H.payEdit=el=>openPayForm(+el.dataset.s,+el.dataset.id);
H.payDel=el=>confirm2(el,'确认删除',()=>{Pay.del(+el.dataset.id);openSaleDetail(+el.dataset.s,true);toast('收款已删除，30 天内可恢复');});
H.payRestore=el=>{const r=safe(()=>Pay.restore(+el.dataset.id));if(r&&r.__err)return;openSaleDetail(+el.dataset.s,true);};
H.payPurge=el=>confirm2(el,'确认永久清除',()=>{Pay.purge(+el.dataset.id);openSaleDetail(+el.dataset.s,true);});
function openPayForm(saleId,pid){const db=load();const s=db.sales.find(x=>x.id===saleId);const p=pid?db.payments.find(x=>x.id===pid):null;const accs=db.accounts.filter(a=>!a.archived&&(a.currency==='CNY'||a.currency==='JPY'));const cur=p&&p.account_id?acct(db,p.account_id):null;
 const opts=`<option value="">不挂账户（不进资金对账）</option>${accs.map(a=>`<option value="${a.id}" data-cur="${a.currency}" ${p&&p.account_id===a.id?'selected':''}>${esc(a.name)}（${a.currency==='JPY'?'日元':'人民币'}）</option>`).join('')}${cur&&cur.archived?`<option value="${cur.id}" selected data-cur="${cur.currency}">${esc(cur.name)}（已归档）</option>`:''}`;
 openModal({single:true,id:'payForm',title:(p?'编辑收款':'记一笔收款')+' · '+esc(s.code),body:`<div class="grid2"><div><label class="f">收款日期</label><input id="pf_date" type="date" value="${p?p.date:today()}"></div><div><label class="f">方式</label><input id="pf_method" value="${esc(p?p.method:'')}" placeholder="转账/现金"></div></div>
 <label class="f">入账账户</label><select id="pf_acct" data-ch="pfAcct" data-wasunlinked="${p&&!p.ever_linked?1:0}">${opts}</select>
 <div id="pf_jpyrow" ${cur&&cur.currency==='JPY'?'':'hidden'}><label class="f">实际入账日元数</label><input id="pf_jpy" inputmode="numeric" value="${p&&p.jpy!=null?p.jpy:''}"></div>
 <label class="f" id="pf_cnylab">${cur&&cur.currency==='JPY'?'本笔抵应收的人民币数':'人民币金额'}</label><input id="pf_cny" inputmode="numeric" value="${p?p.cny:''}" data-in="pfOver">
 <div id="pf_over" class="hint"></div><div id="pf_confirm" class="card" style="display:none;border-color:var(--warn);background:var(--warn-soft)"><div class="warnt">这笔钱若已算进该账户的期初余额，请不要挂。</div><label><input type="checkbox" id="pf_ok" style="width:auto;min-height:auto"> 我确认未计入期初，挂链</label></div>
 <div class="muted small">应收：卖价 ${cny(s.price)}，已收（不含本笔）${cny(saleReceived(db,saleId)-(p&&!p.deleted_at?p.cny:0))}</div>`,actions:`<button class="btn pri grow" data-a="paySave" data-s="${saleId}" data-id="${pid||''}">保存</button>`});}
H.pfAcct=el=>{const o=el.selectedOptions[0];const jp=o&&o.dataset.cur==='JPY';$('#pf_jpyrow').hidden=!jp;$('#pf_cnylab').textContent=jp?'本笔抵应收的人民币数':'人民币金额';$('#pf_confirm').style.display=(el.dataset.wasunlinked==='1'&&el.value)?'block':'none';};
H.pfOver=el=>{const sid=+$('[data-a=paySave]').dataset.s;const pid=+$('[data-a=paySave]').dataset.id||0;const db=load();const s=db.sales.find(x=>x.id===sid);const p=pid?db.payments.find(x=>x.id===pid):null;const after=saleReceived(db,sid)-(p?p.cny:0)+(+el.value||0);$('#pf_over').textContent=after>s.price?'多收 '+cny(after-s.price)+'（允许保存，状态记已收清）':'';};
H.paySave=el=>{const sid=+el.dataset.s,pid=+el.dataset.id||0;const d={date:val('pf_date'),method:val('pf_method'),account_id:val('pf_acct')?+val('pf_acct'):null,cny:val('pf_cny'),jpy:val('pf_jpy')};
 if($('#pf_confirm').style.display==='block'&&!chk('pf_ok')){toast('请先确认期初余额提醒');return;}
 const r=safe(()=>pid?Pay.edit(pid,d):Pay.add(sid,d));if(r&&r.__err)return;closeModal();openSaleDetail(sid,true);toast(pid?'收款已更新':'收款已记');};
// ---- 新增/编辑表单 ----
const SNAPF=['brand','name','specs','listPrice','cost'];
function newBlock(){return{code:'',brand:'',name:'',specs:'',listPrice:'',price:'',cost:'',note:'',bind:null,fill_snap:null,cost_note:'',offers:[],altSuggest:null,errs:[],showCand:false,lagHint:''};}
H.saleNew=()=>openSaleForm(null);H.saleEdit=el=>{closeModal();openSaleForm(+el.dataset.id);};
H.saleDrafts=()=>{const db=load();const ds=db.drafts.filter(d=>!salesBoundTo(db,'inv',d.inv_code));openModal({single:true,title:'库存送来的草稿',body:ds.map(d=>`<div class="lrow" data-a="saleFromDraft" data-c="${esc(d.inv_code)}"><span class="code">${esc(d.inv_code)}</span><span class="grow">标价 ${cny(d.price)}</span>›</div>`).join('')});};
H.saleFromDraft=el=>{closeModal();openSaleForm(null);const db=load();const c=buildCandidates(db,{}).find(x=>x.fillCode===el.dataset.c);if(c){bindCand(0,c);F.blocks[0].price=String(c.listPrice||'');F.blocks[0].fromDraft=true;renderForm();}};
function openSaleForm(id){SalesMirror.refresh();const db=load();F={editId:id,customer:'',saleDate:today(),blocks:[newBlock()],custOpen:false,custHint:null,origCustomer:null,origDate:null,group:null};
 if(id){const s=db.sales.find(x=>x.id===id);const b=db.bindings.find(b=>b.sale_id===id);Object.assign(F,{customer:s.customer,saleDate:s.saleDate,origCustomer:s.customer,origDate:s.saleDate,group:s.group_id});Object.assign(F.blocks[0],{code:s.code,brand:s.brand,name:s.name,specs:s.specs,listPrice:s.listPrice??'',price:String(s.price),cost:String(s.cost),note:s.note,fill_snap:s.fill_snap,cost_note:s.cost_note,bind:b?{src:b.src,code:b.code,key:(b.src==='inv'?'inv:':b.src+':')+b.code}:null});}
 openModal({single:true,id:'saleForm',title:id?'编辑销售单':'记一笔',titleExtra:`<button class="btn sm pri" data-a="sfSave">保存</button>`,body:'<div id="sfBody"></div>',actions:`<button class="btn pri grow" data-a="sfSave" id="sfSaveBottom">保存</button>`});renderForm();}
function takenExcept(i){return F.blocks.filter((b,j)=>j!==i&&b.bind).map(b=>({src:b.bind.src,code:b.bind.code}));}
function blockHtml(i){const b=F.blocks[i];const first=i===0;const pv=(+b.price||0)-(+b.cost||0);
 return `<div class="block ${b.errs.length?'err':''}" id="blk${i}">${F.blocks.length>1?`<div class="row between"><b>第 ${i+1} 件</b>${i?`<button class="btn sm" data-a="sfDelBlock" data-b="${i}">移除此件</button>`:''}</div>`:''}
 ${b.errs.length?`<div class="errbox">${b.errs.map(esc).join('<br>')}</div>`:''}
 <div class="${first?'grid2':''}"><div><label class="f">编号 *</label><input id="code${i}" value="${esc(b.code)}" autocomplete="off" data-in="sfCodeIn" data-fo="sfCodeFocus" data-bl="sfCodeBlur" data-en="sfCodeEnter" data-b="${i}"></div>${first?`<div><label class="f">售出日期 *</label><input id="sdate" value="${esc(F.saleDate)}" data-in="sfCommon" data-k="saleDate" placeholder="YYYY-MM-DD"></div>`:''}</div>
 ${first&&F.group&&F.saleDate!==F.origDate?`<div class="hint">改了售出日期，保存后本件将移出同单组 ${esc(F.group)}</div>`:''}
 <div id="cand${i}">${b.showCand?candHtml(i):''}</div>
 ${b.bind?`<div class="row small" style="margin-top:4px"><span class="pill ink">已绑 ${esc(b.bind.code)}${b.bind.label?' · '+esc(b.bind.label):''}</span><button class="link" data-a="sfUnbind" data-b="${i}">解除绑定</button></div>`:''}
 ${b.prevBind&&!b.bind?`<div class="row small"><span class="muted">已解除绑定（字段保留）</span><button class="link" data-a="sfUndoUnbind" data-b="${i}">撤销</button></div>`:''}
 ${b.altSuggest?`<div class="hint">编号 ${esc(b.code)} 已被销售单用过（含已删除/墓碑）。<button class="link" data-a="sfAlt" data-b="${i}">用备选号 ${esc(b.altSuggest)}</button></div>`:''}
 ${b.lagHint?`<div class="hint">${b.lagHint}</div>`:''}
 ${b.offers.length?`<div class="hint">新绑定件与你手改过的字段不同：${b.offers.map(k=>`<button class="link" data-a="sfReplace" data-b="${i}" data-k="${k}">替换${{brand:'品牌',name:'品名',specs:'规格',listPrice:'标价',cost:'成本'}[k]}</button>`).join(' ')}</div>`:''}
 <div class="${first?'grid2':''}"><div><label class="f">品牌</label><input id="brand${i}" value="${esc(b.brand)}" data-in="sfIn" data-b="${i}" data-k="brand"></div>${first?`<div><label class="f">客户</label><input id="cust" value="${esc(F.customer)}" autocomplete="off" data-in="custIn" data-fo="custFocus" data-bl="custBlur"></div>`:''}</div>
 ${first?`<div id="custBox">${custBoxHtml()}</div>`:''}
 <label class="f">品名 *</label><input id="name${i}" value="${esc(b.name)}" data-in="sfIn" data-b="${i}" data-k="name">
 <label class="f">规格（用 / 分隔多段）</label><input id="specs${i}" value="${esc(b.specs)}" data-in="sfIn" data-b="${i}" data-k="specs">
 <div class="grid3"><div><label class="f">标价</label><input id="list${i}" inputmode="numeric" value="${esc(b.listPrice)}" data-in="sfIn" data-b="${i}" data-k="listPrice"></div><div><label class="f">卖价 *</label><input id="price${i}" inputmode="numeric" value="${esc(b.price)}" data-in="sfIn" data-b="${i}" data-k="price" placeholder="${b.listRef?'标价 '+b.listRef:''}"></div><div><label class="f">成本 *</label><input id="cost${i}" inputmode="numeric" value="${esc(b.cost)}" data-in="sfIn" data-b="${i}" data-k="cost"></div></div>
 <div class="muted small" id="cn${i}">${b.cost_note?'成本：'+esc(b.cost_note):''}</div>
 <div class="muted" id="pv${i}">利润 <b class="profit num">${cny(pv)}</b>${+b.price>0?' · 毛利率 '+Math.round(pv/(+b.price)*1000)/10+'%':''}</div>
 <label class="f">备注</label><textarea id="note${i}" rows="2" data-in="sfIn" data-b="${i}" data-k="note">${esc(b.note)}</textarea></div>`;}
function custBoxHtml(){let h='';const db=load();if(F.custOpen){const L=customerCandidates(db,F.customer).slice(0,8);h+=`<div class="cand">${L.map(c=>`<div class="c" data-a="custPick" data-c="${esc(c.name)}" data-nofocus="1"><span class="grow">${esc(c.name)} <span class="muted">${c.count} 单</span></span>${c.unpaid>0?`<span class="pill warn">未收 ${cny(c.unpaid)}</span>`:''}</div>`).join('')||'<div class="c muted">无匹配，可直接输入新客户</div>'}</div>`;}
 if(F.custHint)h+=`<div class="hint" id="custHint">是不是：<button class="link" data-a="custHintApply" data-c="${esc(F.custHint.name)}">${esc(F.custHint.name)}</button></div>`;
 if(F.group&&F.editId&&F.customer.trim()!==F.origCustomer)h+=`<div class="hint">改了客户，保存后本件将移出同单组 ${esc(F.group)}</div>`;return h;}
function candHtml(i){const b=F.blocks[i];const db=load();const L=buildCandidates(db,{q:b.code,excludeSaleId:F.editId,batchTaken:takenExcept(i)}).slice(0,12);
 return `<div class="cand">${L.map(c=>`<div class="c ${c.layer===3?'dis':''}" ${c.layer<3?`data-a="sfPick" data-b="${i}" data-k="${esc(c.key)}"`:''} data-nofocus="1"><span class="code">${esc(c.fillCode)}</span><span class="grow">${esc(c.brand)} ${esc(c.name)}<div class="muted small">${esc(c.srcLabel)} · ${esc(c.state)}${c.listPrice!=null?' · 标价 '+cny(c.listPrice):''}${c.why?' · '+esc(c.why):''}</div></span></div>`).join('')||'<div class="c muted">无候选（可手输编号按普通单保存）</div>'}</div>`;}
function renderForm(){const box=$('#sfBody');if(!box)return;const ae=document.activeElement&&document.activeElement.id;const pos=document.activeElement&&document.activeElement.selectionStart;
 box.innerHTML=F.blocks.map((b,i)=>blockHtml(i)).join('')+(F.editId?'':`<button class="btn" data-a="sfAdd" ${F.blocks.length>=20?'disabled':''}>＋ 再加一件（${F.blocks.length}/20）</button>`);
 if(ae){const n=document.getElementById(ae);if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}}
 $('#sfSaveBottom').textContent=F.blocks.length>1?'保存 · '+F.blocks.length+' 件':'保存';}
document.addEventListener('mousedown',ev=>{if(ev.target.closest('[data-nofocus]'))ev.preventDefault();});
document.addEventListener('pointerdown',ev=>{if(ev.target.closest('[data-nofocus]'))ev.preventDefault();});
H.sfCommon=el=>{F[el.dataset.k]=el.value;const b=$('#blk0 .hint');if(F.group){renderForm();}};
H.sfIn=el=>{const i=+el.dataset.b,k=el.dataset.k;const b=F.blocks[i];b[k]=el.value;if(k==='cost'&&b.fill_snap){b.cost_note=String(el.value)===String(b.fill_snap.cost)?b.cost_note.replace('已手改','').trim()||('来自库存 '+(b.bind?b.bind.code:'')):'已手改';$('#cn'+i).textContent='成本：'+b.cost_note;}
 if(k==='price'||k==='cost'){const pv=(+b.price||0)-(+b.cost||0);$('#pv'+i).innerHTML=`利润 <b class="profit num">${cny(pv)}</b>${+b.price>0?' · 毛利率 '+Math.round(pv/(+b.price)*1000)/10+'%':''}`;}};
H.sfCodeIn=el=>{const i=+el.dataset.b;F.blocks[i].code=el.value;F.blocks[i].showCand=true;F.blocks[i].lagHint='';$('#cand'+i).innerHTML=candHtml(i);};
H.sfCodeFocus=el=>{const i=+el.dataset.b;F.blocks[i].showCand=true;$('#cand'+i).innerHTML=candHtml(i);};
H.sfCodeBlur=el=>{const i=+el.dataset.b;setTimeout(()=>{if(!F||!F.blocks[i])return;commitCode(i,'blur');},0);};
H.sfCodeEnter=el=>{commitCode(+el.dataset.b,'enter');};
function commitCode(i,how){const b=F.blocks[i];const q=b.code.trim();b.showCand=false;const db=load();
 if(!q){if(b.bind){b.prevBind={bind:b.bind,fill_snap:b.fill_snap};b.bind=null;}renderForm();return;}
 const nq=normCode(q);const L=buildCandidates(db,{q,excludeSaleId:F.editId,batchTaken:takenExcept(i)}).filter(c=>c.layer<3);
 // 只有归一化后与镜像编号完全相等才绑；半截编号什么也不绑
 const pick=L.find(c=>normCode(c.fillCode)===nq||normCode(c.bind.code)===nq);
 if(pick){if(!b.bind||b.bind.key!==pick.key){bindCand(i,pick,how);return;}}
 else if(b.bind){b.prevBind={bind:b.bind,fill_snap:b.fill_snap};b.bind=null;b.offers=[];toast('编号已改，已解除原绑定（字段保留，可撤销）');}
 if(!pick){const own=F.editId?(db.sales.find(s=>s.id===F.editId)||{}).code:null;b.altSuggest=own===q?null:suggestAltCode(db,q,F.blocks.filter((x,j)=>j!==i).map(x=>x.code.trim()));
  // 镜像滞后提示只给「长得像库存编号」的输入（字母-数字，且镜像里有同前缀编号）；真正的库存外件不打扰
  const m=db.inv_mirror||{inv:[],hj:[]};const pre=(q.match(/^[A-Za-z]+/)||[''])[0].toLowerCase();const looksInv=pre&&/\d/.test(q)&&[...m.inv,...m.hj].some(x=>x.code.toLowerCase().startsWith(pre+'-')||x.code.toLowerCase().startsWith(pre));
  if(!b.lagDismissed){const t=db.inv_mirror?new Date(db.inv_mirror.at).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'}):'—';b.lagHint=`库存名单（${t} 更新）里没有「${esc(q)}」。若是刚入库的件请 <button class="link" data-a="sfMirror" data-b="${i}">刷新名单</button>；刷新后仍没有就按普通单保存 <button class="link" data-a="sfLagOff" data-b="${i}">知道了</button>`;}else b.lagHint='';}
 renderForm();}
H.sfLagOff=el=>{const b=F.blocks[+el.dataset.b];b.lagHint='';b.lagDismissed=true;renderForm();};
H.sfMirror=el=>{SalesMirror.refresh();const i=+el.dataset.b;F.blocks[i].lagHint='';commitCode(i,'refresh');};
H.sfPick=el=>{const i=+el.dataset.b;const db=load();const c=buildCandidates(db,{excludeSaleId:F.editId,batchTaken:takenExcept(i)}).find(x=>x.key===el.dataset.k);bindCand(i,c,'click');};
function bindCand(i,c,how){const b=F.blocks[i];const fields={brand:c.brand||'',name:c.name||'',specs:c.specs||'',listPrice:c.listPrice==null?'':String(c.listPrice),cost:c.cost==null?'':String(c.cost)};const offers=[];
 for(const k of SNAPF){const cur=String(b[k]??'');const snapv=b.fill_snap?String(b.fill_snap[k]??''):null;const untouched=cur===''||(snapv!==null&&cur===snapv);if(untouched)b[k]=fields[k];else if(cur!==fields[k])offers.push(k);}
 b.fill_snap=fields;b.bind={key:c.key,src:c.bind.src,code:c.bind.code,inv_code:c.isInv?c.fillCode:null,label:c.srcLabel};b.prevBind=null;
 const db=load();const own=F.editId?db.sales.find(s=>s.id===F.editId).code:null;b.code=c.fillCode;b.altSuggest=own===c.fillCode?null:suggestAltCode(db,c.fillCode,F.blocks.filter((x,j)=>j!==i).map(x=>x.code.trim()));
 b.cost_note=offers.includes('cost')?'已手改':(c.cost!=null?'来自'+(c.isInv?'库存':c.srcLabel)+' '+c.fillCode:'');b.offers=offers;b.listRef=c.listPrice;b.showCand=false;b.lagHint='';b.boundHow=how;renderForm();
 const p=document.getElementById('price'+i);if(p&&!b.fromDraft&&how==='click')p.focus();window.__lastBind={i,key:c.key,how};}
H.sfReplace=el=>{const i=+el.dataset.b,k=el.dataset.k;const b=F.blocks[i];b[k]=b.fill_snap[k];b.offers=b.offers.filter(x=>x!==k);if(k==='cost')b.cost_note='来自库存 '+b.code;renderForm();};
H.sfUnbind=el=>{const i=+el.dataset.b;const b=F.blocks[i];b.prevBind={bind:b.bind,fill_snap:b.fill_snap};b.bind=null;renderForm();toast('已解除绑定，已填字段保留');};
H.sfUndoUnbind=el=>{const i=+el.dataset.b;const b=F.blocks[i];b.bind=b.prevBind.bind;b.fill_snap=b.prevBind.fill_snap;b.prevBind=null;renderForm();};
H.sfAlt=el=>{const i=+el.dataset.b;F.blocks[i].code=F.blocks[i].altSuggest;F.blocks[i].altSuggest=null;renderForm();};
H.sfAdd=()=>{F.blocks.push(newBlock());renderForm();document.getElementById('code'+(F.blocks.length-1)).scrollIntoView({block:'center'});};
H.sfDelBlock=el=>{F.blocks.splice(+el.dataset.b,1);renderForm();};
H.custFocus=()=>{F.custOpen=true;F.custHint=null;$('#custBox').innerHTML=custBoxHtml();};
H.custIn=el=>{F.customer=el.value;F.custOpen=true;F.custHint=null;$('#custBox').innerHTML=custBoxHtml();};
H.custBlur=el=>{setTimeout(()=>{if(!F)return;F.custOpen=false;F.custHint=customerHint(load(),F.customer.trim());if(F.custHint&&F.custHint.kind==='same'&&false)F.custHint=null;const box=$('#custBox');if(box)box.innerHTML=custBoxHtml();window.__custHintShown=(window.__custHintShown||0)+(F.custHint?1:0);},0);};
H.custPick=el=>{F.customer=el.dataset.c;F.custOpen=false;F.custHint=null;$('#cust').value=F.customer;$('#custBox').innerHTML=custBoxHtml();};
H.custHintApply=el=>{F.customer=el.dataset.c;F.custHint=null;$('#cust').value=F.customer;$('#custBox').innerHTML=custBoxHtml();};
H.sfSave=()=>{F.blocks.forEach(b=>b.errs=[]);const items=F.blocks.map(b=>({code:b.code,brand:b.brand,name:b.name,specs:b.specs,listPrice:b.listPrice,price:b.price,cost:b.cost,note:b.note,bind:b.bind?{src:b.bind.src,code:b.bind.code,inv_code:b.bind.inv_code}:null,fill_snap:b.fill_snap,cost_note:b.cost_note}));
 try{if(F.editId){const r=Sales.update(F.editId,{...items[0],customer:F.customer,saleDate:F.saleDate});const id=F.editId;F=null;closeModal();render();openSaleDetail(id);if(r.leftGroup)toast('已保存。客户/日期已改，本件已移出同单组（其余成员不动）');else toast('已保存');}
  else{const out=Sales.createBatch({customer:F.customer,saleDate:F.saleDate},items);F=null;closeModal();render();toast(out.length>1?`已开单 ${out.length} 件 · 组号 ${out[0].group_id}`:'已保存 '+esc(out[0].code));}}
 catch(e){if(!(e instanceof UserErr))throw e;if(Array.isArray(e.extra)){for(const x of e.extra)F.blocks[x.index].errs=x.errs;renderForm();const first=e.extra[0].index;document.getElementById('blk'+first).scrollIntoView({block:'start'});toast('<b>整批未保存：</b>'+esc(e.message));}else{F.blocks[0].errs=[e.message];renderForm();toast('<b>未保存：</b>'+esc(e.message));}}};
// ---- 导出：打印版（iPhone 上「打印 › 存为 PDF」）＋ CSV ----
function salesReportHtml(L,mode){const tot=L.reduce((a,s)=>a+s.price,0),cost=L.reduce((a,s)=>a+s.cost,0);
 return `<div class="rep"><h2>CC的工作日常 · 销售${mode==='full'?'明细':'售出单'}</h2><div class="muted">${today()} 导出 · ${L.length} 单 · 销售额 ${cny(tot)}${mode==='full'?' · 成本 '+cny(cost)+' · 利润 '+cny(tot-cost):''}</div>
 <table><thead><tr><th>日期</th><th>编号</th><th>品名</th><th>客户</th><th>卖价</th>${mode==='full'?'<th>成本</th><th>利润</th>':''}</tr></thead><tbody>${L.map(s=>`<tr><td>${s.saleDate}</td><td>${esc(s.code)}</td><td>${esc(s.brand)} ${esc(s.name)}</td><td>${esc(s.customer)}</td><td class="r">${cny(s.price)}</td>${mode==='full'?`<td class="r">${cny(s.cost)}</td><td class="r">${cny(s.price-s.cost)}</td>`:''}</tr>`).join('')}</tbody></table></div>`;}
H.salesExport=()=>{const db=load();const L=salesVisible(db);closeModal();SS.expMode=SS.expMode||'full';openModal({single:true,title:'导出',body:`<div class="muted">范围：${SS.f.customer||SS.f.brand||SS.f.date||SS.q?'当前筛选结果':'全部销售单'} · ${L.length} 单 · 总销售额 ${cny(L.reduce((a,s)=>a+s.price,0))}</div><div class="chips" style="margin-top:8px"><button class="chip ${SS.expMode==='full'?'on':''}" data-a="salesExpMode" data-v="full">完整版</button><button class="chip ${SS.expMode==='sold'?'on':''}" data-a="salesExpMode" data-v="sold">售出单版（不含成本）</button></div><div class="muted small" style="margin-top:8px">「打印 / 存 PDF」会打开系统打印面板，双指张开预览即可存成 PDF 或分享。</div>`,actions:`<button class="btn" data-a="salesCsv">CSV 表格</button><button class="btn pri grow" data-a="salesPrint">打印 / 存 PDF</button>`});};
H.salesExpMode=el=>{SS.expMode=el.dataset.v;el.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===el));};
H.salesPrint=()=>{const L=salesVisible(load());const p=$('#printArea');p.innerHTML=salesReportHtml(L,SS.expMode||'full');window.print();};
H.salesCsv=async()=>{const L=salesVisible(load());const full=(SS.expMode||'full')==='full';const cols=[['售出日期',r=>r.saleDate],['编号',r=>r.code],['品牌',r=>r.brand],['品名',r=>r.name],['规格',r=>r.specs],['客户',r=>r.customer],['标价',r=>r.listPrice],['卖价',r=>r.price],...(full?[['成本',r=>r.cost],['利润',r=>r.price-r.cost]]:[])];await deliverFile(new Blob([toCSV(cols,L)],{type:'text/csv;charset=utf-8'}),`销售${full?'明细':'售出单'}-${stamp()}.csv`);};
H.saleShare=async el=>{const s=load().sales.find(x=>x.id===+el.dataset.id);if(!s)return;const t=`${s.code} ${s.brand} ${s.name}\n${(s.specs||'').split(' / ').join(' · ')}\n售价 ${cny(s.price)} · ${s.saleDate}`;if(navigator.share){try{await navigator.share({text:t});}catch(e){}}else copy(t);};
