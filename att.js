// ===== 本机附件库（照片 / PDF）：IndexedDB，只存在这台手机上 =====
const IDB={_db:null,
 open(){if(this._db)return Promise.resolve(this._db);return new Promise((ok,no)=>{const r=indexedDB.open('cc13',2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('att'))d.createObjectStore('att',{keyPath:'id'});if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');};r.onsuccess=()=>{this._db=r.result;ok(r.result);};r.onerror=()=>no(r.error);});},
 async run(store,mode,fn){const d=await this.open();return new Promise((ok,no)=>{const t=d.transaction(store,mode);const s=t.objectStore(store);let out;const req=fn(s);if(req)req.onsuccess=()=>{out=req.result;};t.oncomplete=()=>ok(out);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error);});},
 get(store,key){return this.run(store,'readonly',s=>s.get(key));},
 put(store,val,key){return this.run(store,'readwrite',s=>key===undefined?s.put(val):s.put(val,key));},
 del(store,key){return this.run(store,'readwrite',s=>s.delete(key));},
 all(store){return this.run(store,'readonly',s=>s.getAll());},
 keys(store){return this.run(store,'readonly',s=>s.getAllKeys());},
 clear(store){return this.run(store,'readwrite',s=>s.clear());}
};
const _urlCache=new Map();
async function makeThumb(blob,max=480){try{const bmp=await createImageBitmap(blob);const k=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);return await new Promise(r=>c.toBlob(r,'image/jpeg',0.82));}catch(e){return null;}}
const Att={
 async add(file){const id='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);const isImg=/^image\//.test(file.type);const thumb=isImg?await makeThumb(file):null;
  const rec={id,name:file.name||'file',type:file.type||'application/octet-stream',size:file.size||0,blob:file,thumb,created:Date.now()};await IDB.put('att',rec);return {id,name:rec.name,type:rec.type,size:rec.size};},
 async url(id,thumb){const k=id+(thumb?':t':'');if(_urlCache.has(k))return _urlCache.get(k);const r=await IDB.get('att',id);if(!r)return null;const b=thumb&&r.thumb?r.thumb:r.blob;const u=URL.createObjectURL(b);_urlCache.set(k,u);return u;},
 async blob(id){const r=await IDB.get('att',id);return r?r.blob:null;},
 async meta(id){const r=await IDB.get('att',id);return r?{id:r.id,name:r.name,type:r.type,size:r.size}:null;},
 async del(id){await IDB.del('att',id);for(const k of [id,id+':t'])if(_urlCache.has(k)){URL.revokeObjectURL(_urlCache.get(k));_urlCache.delete(k);}},
 // 引用：所有记录（含 30 天内已删快照）里出现的附件 id；不被引用的才清理
 referenced(db){const s=new Set();const walk=v=>{if(!v)return;if(typeof v==='string'){if(/^a[0-9a-z]{6,}$/.test(v))s.add(v);return;}if(Array.isArray(v)){v.forEach(walk);return;}if(typeof v==='object')for(const k in v)walk(v[k]);};walk(db);return s;},
 async gc(){try{const db=load();const ref=Att.referenced(db);const keys=await IDB.keys('att');let n=0;const grace=Date.now()-2*DAY;for(const k of keys){if(ref.has(k))continue;const r=await IDB.get('att',k);if(r&&r.created<grace){await Att.del(k);n++;}}return n;}catch(e){return 0;}}
};
// 渲染后自动把 <img data-att> 填上本机图片
function hydrateAtt(){document.querySelectorAll('img[data-att]:not([data-h])').forEach(img=>{img.dataset.h='1';Att.url(img.dataset.att,img.dataset.full?false:true).then(u=>{if(u)img.src=u;else img.alt='（附件不在本机）';});});}
new MutationObserver(()=>{clearTimeout(hydrateAtt._t);hydrateAtt._t=setTimeout(hydrateAtt,0);}).observe(document.documentElement,{childList:true,subtree:true});
function attImg(id,style='',full=false){return id?`<img data-att="${esc(id)}" ${full?'data-full="1"':''} alt="" style="${style}">`:'';}
// 选文件按钮：label 包 input，单手一点即开相册/相机/文件
function attPicker(label,{kind,id,accept='image/*',multiple=false,cls='btn sm'}){return `<label class="${cls} filebtn">${label}<input type="file" accept="${accept}" ${multiple?'multiple':''} data-ch="attPick" data-kind="${kind}" data-id="${esc(id)}"></label>`;}
const ATT_KINDS={}; // kind -> async (id, metas[]) => void
H.attPick=async el=>{const files=[...el.files];if(!files.length)return;const kind=el.dataset.kind,id=el.dataset.id;toast('正在存入本机…',1500);try{const metas=[];for(const f of files)metas.push(await Att.add(f));await ATT_KINDS[kind](id,metas);toast('已存入本机 '+metas.length+' 个文件');}catch(e){console.error(e);toast('<b>未保存：</b>'+esc(e.message||e));}el.value='';};

// ===== PDF 阅读器：连续滚动 + 双指缩放（pdf.js，本机离线） =====
let _pdfjs=null;async function pdfjs(){if(_pdfjs)return _pdfjs;_pdfjs=await import('./vendor/pdf.min.mjs');_pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.min.mjs';return _pdfjs;}
async function openPdf(src,title,opts={}){const key=READKEY+(opts.key||title);const r=document.createElement('div');r.className='reader';r.innerHTML=`<div class="mh rh"><button class="closeb" data-a="readerClose" aria-label="关闭">✕</button><div class="t">${esc(title)}</div><button class="btn sm" data-a="pdfZoom" data-z="-1" aria-label="缩小">－</button><button class="btn sm" data-a="pdfZoom" data-z="1" aria-label="放大">＋</button><button class="btn sm" id="rpg" data-a="readerJump">…</button></div><div class="pages" id="rpages"><div class="empty" style="color:#ccc">正在打开…</div></div>`;
 $('#app').appendChild(r);const pg=r.querySelector('#rpages');
 try{const lib=await pdfjs();let data;if(src.att){const b=await Att.blob(src.att);if(!b)throw new Error('文件不在本机（可能来自没含附件的备份）');data=new Uint8Array(await b.arrayBuffer());}else data=src.data;
  const doc=await lib.getDocument({data,cMapUrl:'./vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'./vendor/standard_fonts/',isEvalSupported:false}).promise;const n=doc.numPages;pg.innerHTML='';
  const st={scale:1,n,doc,pg,rendered:new Map(),key};r._st=st;const W=()=>pg.clientWidth-16;
  const first=await doc.getPage(1);const vp1=first.getViewport({scale:1});st.ratio=vp1.height/vp1.width;
  for(let i=1;i<=n;i++){const d=document.createElement('div');d.className='pg';d.id='pg'+i;d.dataset.p=i;pg.appendChild(d);}
  st.layout=()=>{const w=W()*st.scale;pg.querySelectorAll('.pg').forEach(d=>{d.style.width=w+'px';d.style.height=Math.round(w*st.ratio)+'px';});};st.layout();
  const renderPage=async i=>{const want=st.scale;if(st.rendered.get(i)===want)return;st.rendered.set(i,want);const p=await doc.getPage(i);const w=W()*want;const vp0=p.getViewport({scale:1});const dpr=Math.min(3,window.devicePixelRatio||1);const vp=p.getViewport({scale:w/vp0.width*dpr});const c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);c.style.width='100%';c.style.height='100%';await p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const d=pg.querySelector('#pg'+i);if(d&&st.rendered.get(i)===want){d.innerHTML='';d.appendChild(c);}};
  st.visible=()=>{const top=pg.scrollTop,h=pg.clientHeight;let cur=1;pg.querySelectorAll('.pg').forEach(d=>{const y=d.offsetTop;if(y<top+h*0.5)cur=+d.dataset.p;if(y+d.offsetHeight>top-h&&y<top+2*h)renderPage(+d.dataset.p);});r.querySelector('#rpg').textContent=`第 ${cur} / ${n} 页`;localStorage.setItem(key,cur);};
  st.go=p=>{const d=pg.querySelector('#pg'+Math.max(1,Math.min(n,p)));if(d)pg.scrollTop=d.offsetTop-8;};
  st.zoom=(s,cx,cy)=>{s=Math.max(1,Math.min(4,s));const fx=(pg.scrollLeft+(cx??pg.clientWidth/2))/pg.scrollWidth,fy=(pg.scrollTop+(cy??pg.clientHeight/2))/pg.scrollHeight;st.scale=s;st.layout();pg.scrollLeft=fx*pg.scrollWidth-(cx??pg.clientWidth/2);pg.scrollTop=fy*pg.scrollHeight-(cy??pg.clientHeight/2);st.visible();};
  pg.addEventListener('scroll',()=>{clearTimeout(st._t);st._t=setTimeout(st.visible,60);},{passive:true});
  // 双指缩放：手势中用 transform 预览，松手后按新比例重排并重绘清晰页
  let g=null;pg.addEventListener('touchstart',e=>{if(e.touches.length===2){const[a,b]=e.touches;g={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),s:st.scale,cx:(a.clientX+b.clientX)/2-pg.getBoundingClientRect().left,cy:(a.clientY+b.clientY)/2-pg.getBoundingClientRect().top,k:1};}},{passive:true});
  pg.addEventListener('touchmove',e=>{if(g&&e.touches.length===2){e.preventDefault();const[a,b]=e.touches;g.k=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/g.d;const k=Math.max(1/g.s,Math.min(4/g.s,g.k));pg.style.transformOrigin=`${g.cx}px ${g.cy}px`;pg.style.transform=`scale(${k})`;}},{passive:false});
  pg.addEventListener('touchend',e=>{if(g&&e.touches.length<2){pg.style.transform='';const ns=g.s*g.k;const{cx,cy}=g;g=null;st.zoom(ns,cx,cy);}});
  const last=+localStorage.getItem(key)||0;if(opts.goto)st.go(opts.goto);else if(last>1&&opts.resume)st.go(last);st.visible();
  if(last>1&&opts.resume&&!opts.goto)toast(`已从上次的第 ${last} 页继续`);
 }catch(e){console.error(e);pg.innerHTML=`<div class="empty" style="color:#fff">打不开这个 PDF：${esc(e.message||e)}</div>`;}}
H.pdfZoom=el=>{const st=el.closest('.reader')._st;if(st)st.zoom(st.scale*(el.dataset.z==='1'?1.25:0.8));};
H.readerClose=el=>el.closest('.reader').remove();
H.readerJump=el=>{const st=el.closest('.reader')._st;if(!st)return;const p=prompt('跳到第几页？（共 '+st.n+' 页）');if(p){if(+p>st.n)toast('页码超界，已落在末页');st.go(+p);}};
H.openAttPdf=el=>openPdf({att:el.dataset.att},el.dataset.t||'PDF',{resume:!!el.dataset.resume,key:el.dataset.att});
H.openAttImg=el=>{Att.url(el.dataset.att,false).then(u=>{if(!u){toast('文件不在本机');return;}const r=document.createElement('div');r.className='reader';r.innerHTML=`<div class="mh rh"><button class="closeb" data-a="readerClose" aria-label="关闭">✕</button><div class="t">${esc(el.dataset.t||'照片')}</div></div><div class="pages imgview"><img src="${u}" alt=""></div>`;$('#app').appendChild(r);});};
