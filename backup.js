// ===== 备份：手动导出（JSON 全量 / CSV 表格）＋ 导入恢复。数据只在本机，没有云同步 =====
const BK_VER=1;
function stamp(){const d=new Date(NOW()+9*3600000).toISOString();return d.slice(0,10).replace(/-/g,'')+'-'+d.slice(11,16).replace(':','');}
function blobToB64(b){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=()=>no(r.error);r.readAsDataURL(b);});}
function b64ToBlob(s,type){const bin=atob(s);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type});}
// iPhone：优先系统分享面板（可「存储到文件」/隔空投送/微信）；不支持时直接下载
async function deliverFile(blob,name){const f=new File([blob],name,{type:blob.type});
 if(navigator.canShare&&navigator.canShare({files:[f]})&&!window.__noShare){try{await navigator.share({files:[f],title:name});return 'shared';}catch(e){if(e&&e.name==='AbortError')return 'cancel';}}
 const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);window.__lastDownload={name,size:blob.size,type:blob.type};return 'downloaded';}
async function buildBackup(withFiles){const db=load();const out={app:'cc13',kind:'backup',version:BK_VER,exported_at:new Date().toISOString(),exported_at_tokyo:new Date(NOW()+9*3600000).toISOString().slice(0,16).replace('T',' ')+' 东京时间',db,cfg:cfg(),reads:{},attachments:[]};
 for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(READKEY))out.reads[k]=localStorage.getItem(k);}
 if(withFiles){const ref=Att.referenced(db);for(const r of await IDB.all('att')){if(!ref.has(r.id))continue;out.attachments.push({id:r.id,name:r.name,type:r.type,size:r.size,created:r.created,data:await blobToB64(r.blob)});}}
 return out;}
async function exportJSON(withFiles){const b=await buildBackup(withFiles);const blob=new Blob([JSON.stringify(b)],{type:'application/json'});const name=`CC的工作日常备份-${stamp()}${withFiles?'-含附件':''}.json`;const how=await deliverFile(blob,name);if(how!=='cancel'){setCfg('lastBackup',NOW());setCfg('lastBackupName',name);}return {how,name,size:blob.size,files:b.attachments.length};}
function validateBackup(o){if(!o||o.app!=='cc13'||o.kind!=='backup')throw new UserErr('这不是「CC的工作日常」的备份文件');if(!o.db||typeof o.db!=='object'||!Array.isArray(o.db.sales)||!Array.isArray(o.db.inv))throw new UserErr('备份内容不完整，已拒绝导入');if((o.version||0)>BK_VER)throw new UserErr('备份来自更新的版本，请先更新 App');return true;}
function backupSummary(db){const n=(a)=>(a||[]).length;return [['库存',n(db.inv)],['销售单',n(db.sales)],['收款',n(db.payments)],['资金流水',n(db.flows)],['公司费用',n(db.expenses)],['合股·寄卖',n(db.hj)],['图册',n(db.catalogues)],['鉴定样本',n(db.samples)],['行程',n(db.trips)],['健康记录',n(db.records)],['家庭条目',n(db.family)],['孩子作品',n(db.works)],['证件',n(db.docs)]];}
async function importBackup(o){validateBackup(o);
 // 先把当前数据存一份到本机，导入后可一键撤销
 const prev={db:localStorage.getItem(DBKEY),cfg:localStorage.getItem(CFGKEY),at:NOW()};await IDB.put('kv',prev,'before_import');
 for(const a of o.attachments||[]){const blob=b64ToBlob(a.data,a.type);await IDB.put('att',{id:a.id,name:a.name,type:a.type,size:a.size,blob,thumb:/^image\//.test(a.type)?await makeThumb(blob):null,created:a.created||Date.now()});}
 const db=Object.assign(EMPTY(),o.db);localStorage.setItem(DBKEY,JSON.stringify(db));const c=Object.assign({},o.cfg||{});c.lastImport=NOW();c.lastBackup=cfg().lastBackup;localStorage.setItem(CFGKEY,JSON.stringify(c));
 for(const [k,v] of Object.entries(o.reads||{}))if(k.startsWith(READKEY))localStorage.setItem(k,v);mirrorToIDB();return {files:(o.attachments||[]).length};}
async function undoImport(){const p=await IDB.get('kv','before_import');if(!p)throw new UserErr('没有可撤销的导入');if(p.db)localStorage.setItem(DBKEY,p.db);else localStorage.removeItem(DBKEY);if(p.cfg)localStorage.setItem(CFGKEY,p.cfg);await IDB.del('kv','before_import');mirrorToIDB();}
// 本机第二份副本：每次写入后存进 IndexedDB；万一 localStorage 被清空，开机自动找回
function mirrorToIDB(){clearTimeout(mirrorToIDB._t);mirrorToIDB._t=setTimeout(()=>{const s=localStorage.getItem(DBKEY);if(s)IDB.put('kv',{db:s,at:Date.now()},'mirror').catch(()=>{});},400);}
async function recoverFromIDB(){if(localStorage.getItem(DBKEY))return false;try{const m=await IDB.get('kv','mirror');if(m&&m.db){localStorage.setItem(DBKEY,m.db);return true;}}catch(e){}return false;}

// ---------- CSV（UTF-8 带 BOM，Excel/Numbers 直接打开不乱码） ----------
function csvCell(v){if(v==null)return'';let s=typeof v==='object'?JSON.stringify(v):String(v);if(/^[=+\-@]/.test(s)&&!/^-?\d/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function toCSV(cols,rows){return '\ufeff'+[cols.map(c=>csvCell(c[0])).join(','),...rows.map(r=>cols.map(c=>csvCell(c[1](r))).join(','))].join('\r\n');}
const D=ms=>ms?new Date(ms+9*3600000).toISOString().slice(0,16).replace('T',' '):'';
const AN=(db,id)=>{const a=db.accounts.find(x=>x.id===id);return a?a.name:'';};
const CSV_TABLES={
 inv:['库存',db=>[...db.inv.map(i=>({...i,_del:''})),...db.inv_deleted.map(i=>({...i,_del:'已删除'}))],[['编号',r=>r.code],['品牌',r=>r.brand],['品名',r=>r.name],['规格',r=>r.specs],['材质',r=>r.params&&r.params.material],['毛重g',r=>r.params&&r.params.weight_g],['成本',r=>r.cost],['标价',r=>r.price],['状态',r=>({in_stock:'在库',sold:'已售'}[r.status]||r.status)],['外借给',r=>r.loaned_to],['售出日期',r=>r.sale_date],['售价',r=>r.sold_price],['客户',r=>r.customer],['备注',r=>r.note],['删除',r=>r._del]]],
 sales:['销售',db=>[...db.sales.map(s=>({...s,_del:''})),...db.sales_deleted.map(s=>({...s,_del:'已删除'}))],[['编号',r=>r.code],['售出日期',r=>r.saleDate],['客户',r=>r.customer],['品牌',r=>r.brand],['品名',r=>r.name],['规格',r=>r.specs],['标价',r=>r.listPrice],['卖价',r=>r.price],['成本',r=>r.cost],['利润',r=>r.price-r.cost],['同单组',r=>r.group_id],['备注',r=>r.note],['删除',r=>r._del]]],
 payments:['销售收款',db=>db.payments,[['收款ID',r=>r.id],['销售单',r=>{const s=[...load().sales,...load().sales_deleted].find(x=>x.id===r.sale_id);return s?s.code:r.sale_id;}],['日期',r=>r.date],['方式',r=>r.method],['人民币',r=>r.cny],['日元入账',r=>r.jpy],['账户',r=>AN(load(),r.account_id)],['版本',r=>'r'+r.pay_rev],['删除',r=>r.deleted_at?'已删除':'']]],
 flows:['资金流水',db=>db.flows,[['流水ID',r=>r.id],['日期',r=>r.date],['账户',r=>AN(load(),r.account_id)],['方向',r=>({in:'收入',out:'支出',transfer:'转账'}[r.direction])],['金额',r=>{const a=load().accounts.find(x=>x.id===r.account_id);return a?r.amount/unit(a.currency):r.amount;}],['币种',r=>(load().accounts.find(x=>x.id===r.account_id)||{}).currency],['分类',r=>r.category],['对方',r=>r.counterparty],['备注',r=>r.note],['来源',r=>r.expense_id?'费用#'+r.expense_id:r.sale_payment_id?'收款#'+r.sale_payment_id+' r'+r.src_rev:''],['作废',r=>r.voided?'作废：'+r.void_reason:'']]],
 accounts:['资金账户',db=>db.accounts,[['账户',r=>r.name],['币种',r=>r.currency],['期初',r=>r.opening/unit(r.currency)],['当前余额',r=>acctBalance(load(),r)/unit(r.currency)],['已归档',r=>r.archived?'是':'']]],
 expenses:['公司费用',db=>db.expenses,[['日期',r=>r.date],['公司/个人',r=>r.scope==='company'?'公司':'个人'],['分类',r=>r.category],['项目',r=>r.item],['付款对象',r=>r.payee],['金额(円)',r=>r.amount],['出账账户',r=>AN(load(),r.account_id)],['发票',r=>r.receipt?r.receipt.file_name:(r.receipt_exempt?'无票':'未存档')],['备注',r=>r.note],['删除',r=>r.deleted_at?'已删除':'']]],
 hj:['合股寄卖',db=>db.hj,[['编号',r=>r.code],['类型',r=>r.section==='hg'?'合股':'寄卖'],['品名',r=>r.name],['分类',r=>r.category],['描述',r=>r.description],['金额',r=>r.amount],['卖价',r=>r.salePrice],['状态',r=>r.status],['关联库存',r=>r.inv_code],['应退日',r=>r.return_due],['备注',r=>r.note]]],
 catalogues:['拍卖图册',db=>db.catalogues,[['书名',r=>r.title],['拍卖行',r=>r.house],['地点',r=>r.location],['拍卖日期',r=>r.sale_date],['类型',r=>r.kind],['版本',r=>r.version==='preview'?'预展版':'成交版'],['有PDF',r=>r.pdf_att||r.pdf?'是':'']]],
 samples:['鉴定样本',db=>db.samples,[['编号',r=>r.code],['品牌',r=>r.brand],['品类',r=>r.category],['结论',r=>r.verdict],['印记',r=>r.hallmark],['序列号',r=>r.serial],['日期',r=>r.sampleDate],['删除',r=>r.deleted_at?'已删除':'']]],
 trips:['出差行程',db=>db.trips,[['城市',r=>(load().cities.find(c=>c.id===r.cityId)||{}).name],['开始',r=>r.startDate],['结束',r=>r.endDate],['目的',r=>r.purpose],['航班',r=>(r.flights||[]).map(f=>f.flightNo+' '+f.departPlace+'→'+f.arrivePlace+' '+f.departDate+' '+f.departTime).join('；')]]],
 records:['家庭健康',db=>db.records,[['成员',r=>(load().members.find(m=>m.id===r.member_id)||{}).name],['类型',r=>r.kind],['事项',r=>r.title],['日期',r=>r.date],['时间',r=>r.time_hm],['完成',r=>r.done?'是':''],['删除',r=>r.deleted_at?'已删除':'']]],
 family:['家庭',db=>db.family,[['事项',r=>r.title],['分类',r=>r.category],['成员',r=>r.member],['日期',r=>r.start_date],['删除',r=>r.deleted_at?'已删除':'']]],
 works:['孩子创作',db=>db.works,[['标题',r=>r.title],['作者',r=>r.author==='a'?'孩子A':r.author==='b'?'孩子B':r.author],['日期',r=>r.workDate],['类型',r=>r.kind],['照片数',r=>(r.pics||[]).length],['收藏',r=>r.favorite?'★':''],['删除',r=>r.deleted_at?'已删除':'']]],
 docs:['证件与到期',db=>db.docs,[['分类',r=>r.category],['持有人',r=>r.holder],['名称',r=>r.name],['到期日',r=>r.noExpiry?'长期有效':r.expiryDate],['提醒窗口天',r=>r.renewWindowDays],['备注',r=>r.note],['删除',r=>r.deleted_at?'已删除':'']]],
};
function tableCSV(k){const db=load();const [name,rows,cols]=CSV_TABLES[k];return {name,csv:toCSV(cols,rows(db)||[])};}
// 极简 ZIP（只存不压），把全部 CSV 打成一个文件
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u){let c=0xffffffff;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function makeZip(files){const enc=new TextEncoder();const parts=[],central=[];let off=0;const le=(n,b)=>{const a=new Uint8Array(b);for(let i=0;i<b;i++)a[i]=(n>>>(8*i))&255;return a;};
 for(const f of files){const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data);
  const head=[le(0x04034b50,4),le(20,2),le(0x0800,2),le(0,2),le(0,2),le(0,2),le(crc,4),le(data.length,4),le(data.length,4),le(name.length,2),le(0,2),name];
  const cen=[le(0x02014b50,4),le(20,2),le(20,2),le(0x0800,2),le(0,2),le(0,2),le(0,2),le(crc,4),le(data.length,4),le(data.length,4),le(name.length,2),le(0,2),le(0,2),le(0,2),le(0,2),le(0,4),le(off,4),name];
  for(const p of head){parts.push(p);off+=p.length;}parts.push(data);off+=data.length;central.push(...cen);}
 const cenSize=central.reduce((a,p)=>a+p.length,0);const end=[le(0x06054b50,4),le(0,2),le(0,2),le(files.length,2),le(files.length,2),le(cenSize,4),le(off,4),le(0,2)];
 return new Blob([...parts,...central,...end],{type:'application/zip'});}
async function exportCSV(k){if(k==='all'){const files=Object.keys(CSV_TABLES).map(t=>{const x=tableCSV(t);return{name:x.name+'.csv',data:x.csv};});return deliverFile(makeZip(files),`CC的工作日常表格-${stamp()}.zip`);}
 const x=tableCSV(k);return deliverFile(new Blob([x.csv],{type:'text/csv;charset=utf-8'}),`${x.name}-${stamp()}.csv`);}

// ---------- 页面：备份与数据 ----------
UI.backup=()=>{const db=load();const c=cfg();const last=c.lastBackup?Math.floor((NOW()-c.lastBackup)/DAY):null;const empty=!db.inv.length&&!db.sales.length&&!db.accounts.length&&!db.expenses.length;
 return `<div class="ph"><span class="ico brand">⇅</span><h1>备份与数据</h1></div>
 <div class="card"><b>数据只存在这台手机上</b><div class="muted" style="margin-top:4px">没有云同步。换手机或清理 Safari 数据前，先导出备份存到「文件」或电脑。</div>
 <div style="margin-top:8px">上次备份：<b class="${last==null||last>7?'warnt':''}">${last==null?'还没备份过':last===0?'今天':last+' 天前'}</b>${c.lastBackupName?`<div class="muted small">${esc(c.lastBackupName)}</div>`:''}</div><div class="muted small" id="bkStore">本机存储：计算中…</div></div>
 <div class="sec-h">导出备份</div>
 <button class="btn pri big" data-a="bkJson" data-f="1">备份全部（含照片和 PDF）</button>
 <button class="btn big" data-a="bkJson" data-f="0">只备份数据（不含附件，文件小）</button>
 <div class="muted small" style="margin:4px 0 0">JSON 文件，用来以后「导入恢复」。iPhone 上会弹出分享面板，选「存储到文件」。</div>
 <div class="sec-h">导出表格（CSV，Excel / Numbers 可直接打开）</div>
 <button class="btn big" data-a="bkCsv" data-k="all">全部表格打包（ZIP）</button>
 <div class="chips" style="margin-top:6px">${Object.entries(CSV_TABLES).map(([k,v])=>`<button class="chip" data-a="bkCsv" data-k="${k}">${v[0]}</button>`).join('')}</div>
 <div class="sec-h">导入恢复</div>
 <div class="muted small">选一个之前导出的 .json 备份。导入会<b>整体替换</b>本机现有数据；替换前会自动留一份，可撤销。</div>
 ${attPicker('选择备份文件…',{kind:'bkfile',id:'0',accept:'.json,application/json',cls:'btn big'}).replace('data-ch="attPick"','data-ch="bkPick"')}
 <div id="bkPreview"></div>
 <button class="btn big" data-a="bkUndo">撤销上次导入</button>
 ${empty?`<div class="sec-h">示例数据</div><div class="muted small">本机还是空的。想先看看效果，可以载入一套示例数据（以后用「清空」或导入备份替换）。</div><button class="btn big" data-a="bkDemo">载入示例数据</button>`:''}
 <details class="card" style="margin-top:12px"><summary>危险操作</summary><div class="muted small">清空本机全部数据（不可撤销，先备份）。</div><button class="btn dangerline" data-a="bkWipe">清空本机数据</button></details>
 <div class="muted small" style="margin-top:12px">版本 ${APP_VER} · 离线可用</div>`;};
async function bkStorageLine(){const el=$('#bkStore');if(!el)return;let s='';try{const e=await navigator.storage.estimate();s=`已用约 ${(e.usage/1048576).toFixed(1)} MB`;}catch(e){}let p='';try{p=navigator.storage.persisted&&await navigator.storage.persisted()?' · 已设为持久保存':' · 未设持久保存（加到主屏幕后更稳）';}catch(e){}const ls=((localStorage.getItem(DBKEY)||'').length*2/1048576).toFixed(2);el.textContent=`本机存储：数据 ${ls} MB${s?' · 全部 '+s:''}${p}`;}
H.bkJson=async el=>{el.disabled=true;try{const r=await exportJSON(el.dataset.f==='1');if(r.how!=='cancel')toast(`已导出 ${esc(r.name)}（${(r.size/1024).toFixed(0)} KB${r.files?'，附件 '+r.files+' 个':''}）`);}catch(e){console.error(e);toast('<b>导出失败：</b>'+esc(e.message||e));}el.disabled=false;render();};
H.bkCsv=async el=>{try{await exportCSV(el.dataset.k);toast('表格已导出');}catch(e){toast('<b>导出失败：</b>'+esc(e.message||e));}};
let _bkPending=null;
H.bkPick=async el=>{const f=el.files[0];if(!f)return;try{const o=JSON.parse(await f.text());validateBackup(o);_bkPending=o;const sum=backupSummary(o.db);
 $('#bkPreview').innerHTML=`<div class="card" style="border-color:var(--warn);background:var(--warn-soft)"><b>${esc(f.name)}</b><div class="muted small">导出于 ${esc(o.exported_at_tokyo||o.exported_at)} · 附件 ${(o.attachments||[]).length} 个</div><div class="kv" style="margin:6px 0">${sum.map(([k,n])=>`<span>${k} <b style="font-size:15px">${n}</b></span>`).join('')}</div><div class="warnt small">导入会替换本机现有数据（现有数据先自动留底，可撤销）。</div><button class="btn warn big" data-a="bkImport">确认导入并替换</button></div>`;}catch(e){_bkPending=null;$('#bkPreview').innerHTML=`<div class="errbox">${esc(e.message||'文件读不出来')}</div>`;}el.value='';};
H.bkImport=el=>confirm2(el,'再点一次：确认替换',async()=>{if(!_bkPending)return;try{const r=await importBackup(_bkPending);_bkPending=null;toast('导入完成'+(r.files?'（附件 '+r.files+' 个）':''));render();}catch(e){toast('<b>导入失败：</b>'+esc(e.message||e));}});
H.bkUndo=el=>confirm2(el,'确认撤销导入',async()=>{try{await undoImport();toast('已撤销，回到导入前的数据');render();}catch(e){toast(esc(e.message));}});
H.bkDemo=()=>{seedAll();mirrorToIDB();toast('已载入示例数据');go('home');};
H.bkWipe=el=>confirm2(el,'确认清空（不可撤销）',async()=>{localStorage.removeItem(DBKEY);await IDB.del('kv','mirror');await IDB.clear('att');toast('本机数据已清空');go('home');});
