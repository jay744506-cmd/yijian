import {demoClothes} from './artwork.js?v=1.4';
import {load,store} from './storage.js?v=1.4';
import {categories,subcategories,normalizeClothing,statuses,uid,localDate,dateFromKey,shiftDate,layout,fresh,recommend,validateBackup} from './core.js?v=1.7';

import {mergeWardrobe} from './merge.js?v=1.5';
import {APP_VERSION,isStandalone,pwaStatus,setupPwa,checkPwaUpdate,applyPwaUpdate,hasPwaUpdate} from './pwa.js?v=1.4.2';
const root=document.getElementById('yi-wardrobe');
const main=root.querySelector('main'),nav=root.querySelector('nav'),modal=root.querySelector('.yi-modal');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>`<i data-lucide="${n}" aria-hidden="true"></i>`;
const copy=v=>structuredClone(v);
const today=()=>localDate();
let data,saveChain=Promise.resolve(),saveError=false,toastTimer,lastFocus,uploadImage=null,installPrompt=null;
let backgroundDraftImage=null;
const ui={page:['studio','closet','outfits','calendar'].includes(location.hash.slice(1))?location.hash.slice(1):'studio',category:'全部',subcategory:'全部',query:'',availability:'all',occasion:'日常',look:0,selected:null,studioView:'edit',outfitFilter:'全部',picker:'全部',pickerSubcategory:'全部',day:today(),month:dateFromKey(today()),undo:[],redo:[],drag:null,importData:null};
const cloth=id=>data.clothes.find(c=>c.id===id);
const draft=()=>data.draft;
function icons(){globalThis.lucide?.createIcons({attrs:{width:19,height:19}})}
function applyBackground(){
 const settings=data?.settings||{},color=/^#[0-9a-f]{6}$/i.test(settings.backgroundColor||'')?settings.backgroundColor:'#fbfaf7';
 const image=typeof settings.backgroundImage==='string'&&settings.backgroundImage.length<=3000000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(settings.backgroundImage)?settings.backgroundImage:null;
 const rgb=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
 const dark=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722<.38;
 const palette=dark?{'--yi-ink':'#fff4f1','--yi-muted':'#d8c5c1','--yi-paper':'#302729ee','--yi-soft':'#433235','--yi-line':'#6f555b','--yi-accent':'#e5a8b0','--yi-on-accent':'#3b1c24','--yi-photo':'#5a4348'}:{'--yi-ink':'#2d2022','--yi-muted':'#715d60','--yi-paper':'#fffdfbf2','--yi-soft':'#f8eceb','--yi-line':'#ead8d8','--yi-accent':'#8f4352','--yi-on-accent':'#fffaf8','--yi-photo':'#f1e3df'};
 root.style.setProperty('--yi-bg',color);
 root.style.setProperty('--yi-wallpaper',image?`url("${image}")`:'none');
 root.style.colorScheme=dark?'dark':'light';
 for(const [key,value]of Object.entries(palette))root.style.setProperty(key,value);
 root.classList.toggle('yi-has-bg-image',!!image);
}
function toast(text){const el=root.querySelector('.yi-toast');el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,3400)}
async function persist(){
 data.updatedAt=Date.now();const snapshot=copy(data);
 const pending=saveChain.catch(()=>{}).then(()=>store(snapshot));saveChain=pending;
 try{const merged=await pending;data=mergeWardrobe(snapshot,data,merged);saveError=false;document.querySelectorAll('[data-save-state]').forEach(el=>el.textContent='已保存到本机');return true}
 catch(error){saveError=true;document.querySelectorAll('[data-save-state]').forEach(el=>el.textContent='保存失败，请先导出备份');toast(error?.name==='QuotaExceededError'?'存储空间不足，请先导出备份再整理照片。':'本机保存失败，请导出备份，避免关闭后丢失。');return false}
}
function sheet(title,body){lastFocus=document.activeElement;modal.innerHTML=`<section class="yi-sheet" role="dialog" aria-modal="true" aria-label="${escape(title)}"><div class="yi-row"><h2>${escape(title)}</h2><button class="yi-close" data-action="close" aria-label="关闭">${icon('x')}</button></div>${body}</section>`;modal.hidden=false;document.body.style.overflow='hidden';icons();modal.querySelector('button')?.focus()}
function close(){modal.hidden=true;modal.innerHTML='';document.body.style.overflow='';if(lastFocus?.isConnected)lastFocus.focus()}
function formError(message){const el=modal.querySelector('.yi-error');if(el){el.textContent=message;el.hidden=false}else toast(message)}
function title(eyebrow,name,sub=''){return `<div><p class="yi-eyebrow">${eyebrow}</p><h1>${name}</h1>${sub?`<p class="yi-muted">${sub}</p>`:''}</div>`}
function getLooks(){return recommend(data,ui.occasion)}
function currentLook(){if(ui.previewLook)return ui.previewLook;const list=getLooks();return list[ui.look%Math.max(1,list.length)]}
function signature(items){return JSON.stringify(items.map(i=>[i.id,Math.round(i.x),Math.round(i.y),i.scale,i.rotation]))}
function matchingOutfit(look){return look&&data.outfits.find(o=>signature(o.items)===signature(look.items))}
function miniLook(items,extra=''){return `<div class="yi-mini-look ${extra}" aria-label="搭配预览">${items.map(i=>{const c=cloth(i.id);return c?`<img src="${c.image}" alt="${escape(c.name)}" style="left:${i.x}%;top:${i.y}%;--scale:${i.scale};--rotation:${i.rotation}deg">`:''}).join('')}</div>`}
function week(){return `<div class="yi-week">${Array.from({length:5},(_,n)=>{const day=shiftDate(today(),n),p=data.plans[day],date=dateFromKey(day),c=p?.items.map(i=>cloth(i.id)).find(Boolean);return `<button class="yi-day ${n===0?'current':''}" data-day-link="${day}">${['周日','周一','周二','周三','周四','周五','周六'][date.getDay()]}<small>${date.getMonth()+1}.${date.getDate()}</small>${c?`<img class="yi-day-art" src="${c.image}" alt="${escape(p.name)}">`:`<span class="yi-day-empty">${icon('plus')}</span>`}${p?(p.worn?'已穿过':'已安排'):n===0?'今天':'待安排'}</button>`}).join('')}</div>`}
function home(){
 const look=currentLook(),temp=data.settings.temperature,saved=data.outfits.length,planned=Object.keys(data.plans).filter(key=>key>=today()).length;
 return `<div class="yi-home-head"><div>${title('TODAY','今天穿什么？',temp===null?'从自己的衣橱里，选一套现在想穿的。':`${temp}℃ · ${data.settings.weather} · ${data.settings.city||'本地天气'}`)}</div><button class="yi-icon-button" data-action="settings" aria-label="个人设置与备份">${icon('sliders-horizontal')}</button></div><div class="yi-chips yi-occasion-chips">${['日常','通勤','约会','户外'].map(s=>`<button class="yi-chip" data-occasion="${s}" aria-pressed="${ui.occasion===s}">${s}</button>`).join('')}</div>${look?`<div class="yi-look-card"><div class="yi-look"><span class="yi-look-label">THE DAILY EDIT</span><span class="yi-look-count">${ui.previewLook?'我的搭配':String(ui.look%Math.max(1,getLooks().length)+1).padStart(2,'0')+' / '+String(getLooks().length).padStart(2,'0')}</span>${look.items.map(i=>{const c=cloth(i.id);return c?`<img class="yi-art" src="${c.image}" alt="${escape(c.name)}" style="left:${i.x}%;top:${i.y}%;width:40%;height:48%;transform:translate(-50%,-50%) rotate(${i.rotation}deg) scale(${i.scale})">`:''}).join('')}<span class="yi-look-note">LESS, BUT BETTER.</span><button class="yi-heart" data-action="favorite" aria-label="保存推荐搭配" aria-pressed="${!!matchingOutfit(look)}">${icon('heart')}</button></div><div class="yi-look-info"><div><p class="yi-eyebrow">${ui.occasion}${temp!==null?' · '+temp+'℃':''}</p><h2>${escape(look.name)}</h2><p class="yi-subline">${escape(look.note||'穿自己喜欢的，就是好看的。')}</p></div><button class="yi-text-button" data-action="customize">调整 ${icon('arrow-up-right')}</button></div><div class="yi-actions"><button class="yi-primary" data-action="wear">${icon('check')}今天穿这套</button><button class="yi-secondary" data-action="shuffle" ${getLooks().length<2?'disabled':''}>${icon('shuffle')}换一套</button></div></div>`:`<div class="yi-empty-card">${icon('shirt')}<h2>先放进第一件衣服</h2><p>收好你的照片，衣间会帮你开始搭配。</p><button class="yi-primary" data-action="upload">${icon('plus')}添加衣服</button></div>`}<div class="yi-quick-grid"><button class="yi-quick-card" data-page="closet"><span class="yi-quick-icon">${icon('shirt')}</span><span><strong>${data.clothes.length}</strong><small>件衣服</small></span><span class="yi-quick-arrow">${icon('arrow-up-right')}</span></button><button class="yi-quick-card" data-page="studio"><span class="yi-quick-icon">${icon('layers-2')}</span><span><strong>${saved}</strong><small>套搭配</small></span><span class="yi-quick-arrow">${icon('arrow-up-right')}</span></button><button class="yi-quick-card" data-page="calendar"><span class="yi-quick-icon">${icon('calendar-days')}</span><span><strong>${planned}</strong><small>个计划</small></span><span class="yi-quick-arrow">${icon('arrow-up-right')}</span></button></div>${!data.settings.onboarded?`<div class="yi-notice yi-compact-notice"><span>示例衣服已准备好，换成自己的照片就能开始。</span><button data-action="upload">添加照片</button><button class="yi-close" data-action="dismiss-intro" aria-label="不再显示提示">${icon('x')}</button></div>`:''}`;
}
function subtypeFilter(category,selected,attribute){return category==='全部'?'':`<div class="yi-subfilters" aria-label="${category}细分类">${['全部',...subcategories[category],'未细分'].map(s=>`<button data-${attribute}="${s}" aria-pressed="${s===selected}">${s}</button>`).join('')}</div>`}
function filteredClothes(){return data.clothes.filter(c=>(ui.category==='全部'||c.category===ui.category)&&(ui.subcategory==='全部'||c.subcategory===ui.subcategory)&&(ui.availability==='all'||c.status===ui.availability)&&[c.name,c.meta,c.category,c.subcategory,c.notes].join(' ').toLowerCase().includes(ui.query.toLowerCase()))}
function clothCards(){return filteredClothes().map(c=>`<button class="yi-cloth" data-cloth="${c.id}"><span class="yi-cloth-picture ${c.status!=='available'?'unavailable':''}"><img src="${c.image}" alt="${escape(c.name)}" loading="lazy">${c.sample?'<span class="yi-tag">示例</span>':''}${c.status!=='available'?`<span class="yi-tag yi-status-tag">${statuses[c.status]}</span>`:''}</span><span class="yi-cloth-name">${escape(c.name)}</span><span class="yi-cloth-meta"><span class="yi-dot" style="--swatch:${c.color}"></span>${escape(c.subcategory==='未细分'?c.category:c.subcategory)} · ${escape(c.meta)}</span>${c.notes?`<span class="yi-cloth-note">${escape(c.notes)}</span>`:''}</button>`).join('')||`<div class="yi-grid-empty">${icon('search')}<p>${data.clothes.length?'暂时没有符合条件的衣服。':'你的衣橱还是空的，先放进第一件吧。'}</p><button class="yi-text-button" data-action="${data.clothes.length?'reset-filter':'upload'}" style="margin:auto">${data.clothes.length?'清除筛选':'添加第一件衣服'} ${icon('arrow-right')}</button></div>`}
function closet(){return `<div class="yi-row yi-heading">${title('MY LITTLE WARDROBE','我的衣橱',`${data.clothes.length} 件喜欢的衣服，慢慢穿`)}<button class="yi-plus" data-action="upload" aria-label="添加衣服">${icon('plus')}</button></div><div class="yi-import-row"><button class="yi-secondary" data-action="paste-image">${icon('clipboard')}粘贴图片入库</button><span>从淘宝复制衣服图片后点这里</span></div><label class="yi-search">${icon('search')}<input aria-label="搜索衣服" placeholder="搜索衣服、分类或备注…" value="${escape(ui.query)}"></label><div class="yi-chips">${['全部',...categories].map(s=>`<button class="yi-chip" data-category="${s}" aria-pressed="${ui.category===s}">${s}</button>`).join('')}</div>${subtypeFilter(ui.category,ui.subcategory,'subcategory')}<div class="yi-row" style="margin:-5px 0 14px"><span class="yi-muted" id="cloth-count">${filteredClothes().length} 件单品</span><button class="yi-text-button" data-action="availability">${icon('sliders-horizontal')}${ui.availability==='all'?'全部状态':statuses[ui.availability]}</button></div><div class="yi-grid">${clothCards()}</div><div class="yi-local">${icon('lock-keyhole')}照片保存在本机，不上传服务器</div>`}
function itemMarkup(){return draft().items.map(i=>{const c=cloth(i.id);return c?`<button class="yi-canvas-item ${i.id===ui.selected?'selected':''}" data-item="${i.id}" aria-label="${escape(c.name)}，拖动或使用方向键移动" style="left:${i.x}%;top:${i.y}%;--scale:${i.scale};--rotation:${i.rotation}deg"><img src="${c.image}" alt=""></button>`:''}).join('')}
function pickerMarkup(){return data.clothes.filter(c=>(ui.picker==='全部'||c.category===ui.picker)&&(ui.pickerSubcategory==='全部'||c.subcategory===ui.pickerSubcategory)).map(c=>`<button data-add="${c.id}" aria-label="添加${escape(c.name)}"><img src="${c.image}" alt="${escape(c.name)}" loading="lazy">${draft().items.some(i=>i.id===c.id)?'<span class="yi-added">✓</span>':''}</button>`).join('')||'<p class="yi-muted" style="grid-column:1/-1;padding:16px 0">这个分类还没有衣服。</p>'}
function studioLegacy(){
 const d=draft(),sel=d.items.find(i=>i.id===ui.selected);
 return `<div class="yi-row yi-heading">${title('YOUR STYLE, YOUR RULES','自己搭一套')}<button class="yi-plus" data-action="new-outfit" aria-label="新建搭配">${icon('plus')}</button></div><div class="yi-segment"><button data-studio="edit" class="${ui.studioView==='edit'?'active':''}">搭配画布</button><button data-studio="saved" class="${ui.studioView==='saved'?'active':''}">我的穿搭 · ${data.outfits.length}</button></div>${ui.studioView==='saved'?outfitLibrary():`<input class="yi-editor-name" aria-label="穿搭名称" maxlength="40" value="${escape(d.name)}"><label class="yi-outfit-occasion">穿搭分类<select aria-label="穿搭分类" data-draft-occasion>${['日常','通勤','约会','户外'].map(o=>`<option ${d.occasion===o?'selected':''}>${o}</option>`).join('')}</select></label><div class="yi-canvas" aria-label="自定义搭配画布">${itemMarkup()}${d.items.length?'':'<div class="yi-empty" style="padding-top:75px">从下面选一件衣服<br>开始你的第一套搭配</div>'}<span class="yi-canvas-caption">拖动衣服 · 双指缩放与旋转</span></div><section class="yi-model-section"><div class="yi-row"><h2>模特图 <small>选填</small></h2>${d.modelPhoto?`<button class="yi-text-button" data-action="remove-model-photo">移除图片</button>`:''}</div><p class="yi-muted">上传模特参考照片，和这套穿搭一起保存。</p>${d.modelPhoto?`<img class="yi-model-preview" src="${d.modelPhoto}" alt="当前穿搭的模特图">`:'<div class="yi-model-empty">还没有模特图</div>'}<label class="yi-secondary yi-model-upload">${icon('image-plus')}${d.modelPhoto?'更换模特图':'上传模特图'}<input id="model-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传模特图"></label></section><div class="yi-editor-tools"><div class="yi-tools-secondary"><button data-action="undo" aria-label="撤销" ${ui.undo.length?'':'disabled'}>${icon('undo-2')}</button><button data-action="redo" aria-label="重做" ${ui.redo.length?'':'disabled'}>${icon('redo-2')}</button></div><div class="yi-tools-secondary"><button data-action="arrange" aria-label="自动排列" ${d.items.length?'':'disabled'}>${icon('layout-grid')}</button><button data-action="front" aria-label="移到最前" ${sel?'':'disabled'}>${icon('layers-2')}</button><button data-action="remove" aria-label="移除选中衣服" ${sel?'':'disabled'}>${icon('trash-2')}</button><button data-action="export-image" aria-label="导出穿搭图片" ${d.items.length?'':'disabled'}>${icon('download')}</button></div></div><div class="yi-editor-adjust"><label>大小<input type="range" data-adjust="scale" aria-label="衣服大小" min="0.3" max="2" step="0.05" value="${sel?.scale||1}" ${sel?'':'disabled'}></label><label>旋转<input type="range" data-adjust="rotation" aria-label="衣服角度" min="-180" max="180" step="1" value="${sel?.rotation||0}" ${sel?'':'disabled'}></label></div><div class="yi-row"><h2>从衣橱选一件</h2><span class="yi-muted">已选 ${d.items.length} 件</span></div><div class="yi-chips" style="margin:12px 0 0">${['全部',...categories].map(s=>`<button class="yi-chip" data-picker="${s}" aria-pressed="${ui.picker===s}">${s}</button>`).join('')}</div>${subtypeFilter(ui.picker,ui.pickerSubcategory,'picker-subcategory')}<div class="yi-picker">${pickerMarkup()}</div><p class="yi-editor-hint">${icon('mouse-pointer-2')}选中衣服后，可用方向键微调位置</p><div class="yi-actions"><button class="yi-primary" data-action="save-outfit" ${d.items.length?'':'disabled'}>${icon('bookmark')}${d.id?'保存修改':'保存这套穿搭'}</button><button class="yi-secondary" data-action="draft-plan" ${d.items.length?'':'disabled'} aria-label="将当前搭配安排到日历">${icon('calendar-plus')}</button></div><p class="yi-local" data-save-state>${saveError?'保存失败，请先导出备份':'草稿自动保存在本机'}</p>`}`;
}
function studioCompactLegacy(){
 const d=draft(),sel=d.items.find(i=>i.id===ui.selected),selectedName=sel?cloth(sel.id)?.name:'';
 return `<div class="yi-studio-head"><div>${title('MY OUTFITS','我的穿搭','把衣服放进画布，做出属于你的搭配')}</div><button class="yi-plus" data-action="new-outfit" aria-label="新建穿搭">${icon('plus')}</button></div><div class="yi-segment"><button data-studio="edit" class="${ui.studioView==='edit'?'active':''}">搭配画布</button><button data-studio="saved" class="${ui.studioView==='saved'?'active':''}">已保存 ${data.outfits.length}</button></div>${ui.studioView==='saved'?outfitLibrary():`<section class="yi-editor-card"><div class="yi-editor-title"><input class="yi-editor-name" aria-label="穿搭名称" maxlength="40" value="${escape(d.name)}" placeholder="给这套穿搭起个名字"><select aria-label="穿搭分类" data-draft-occasion>${['日常','通勤','约会','户外'].map(o=>`<option ${d.occasion===o?'selected':''}>${o}</option>`).join('')}</select></div><div class="yi-canvas" aria-label="自定义搭配画布">${itemMarkup()}${d.items.length?'':'<div class="yi-empty" style="padding-top:75px">从下面选一件衣服<br>开始你的第一套搭配</div>'}<span class="yi-canvas-caption">点选衣服 · 拖动位置 · 双指缩放旋转</span></div><div class="yi-canvas-toolbar"><span>${d.items.length?`已选 ${d.items.length} 件`:'还没有单品'}</span><div class="yi-tools-secondary"><button data-action="undo" aria-label="撤销" ${ui.undo.length?'':'disabled'}>${icon('undo-2')}</button><button data-action="redo" aria-label="重做" ${ui.redo.length?'':'disabled'}>${icon('redo-2')}</button><button data-action="arrange" aria-label="自动排列" ${d.items.length?'':'disabled'}>${icon('layout-grid')}</button><button data-action="export-image" aria-label="导出穿搭图片" ${d.items.length?'':'disabled'}>${icon('download')}</button></div></div>${sel?`<div class="yi-selected-bar"><span>${icon('move')}已选：${escape(selectedName||'这件衣服')}</span><label>大小<input type="range" data-adjust="scale" aria-label="衣服大小" min="0.3" max="2" step="0.05" value="${sel.scale}"></label><button class="yi-text-button yi-danger" data-action="remove">移除</button></div>`:'<p class="yi-editor-hint">点选画布中的衣服后，可调整大小或移除。</p>'}</section><section class="yi-add-panel"><div class="yi-row"><h2>添加衣服</h2><span class="yi-muted">已选 ${d.items.length} 件</span></div><div class="yi-chips yi-picker-chips">${['全部',...categories].map(s=>`<button class="yi-chip" data-picker="${s}" aria-pressed="${ui.picker===s}">${s}</button>`).join('')}</div>${subtypeFilter(ui.picker,ui.pickerSubcategory,'picker-subcategory')}<div class="yi-picker">${pickerMarkup()}</div></section><details class="yi-advanced"><summary>${icon('image-plus')}添加模特图 <small>可选</small></summary><div class="yi-advanced-body">${d.modelPhoto?`<img class="yi-model-preview" src="${d.modelPhoto}" alt="当前穿搭的模特图">`:'<p class="yi-muted">上传一张参考图，和这套穿搭一起保存。</p>'}${d.modelPhoto?`<button class="yi-text-button" data-action="remove-model-photo">移除图片</button>`:''}<label class="yi-secondary yi-model-upload">${icon('image-plus')}${d.modelPhoto?'更换模特图':'上传模特图'}<input id="model-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传模特图"></label></div></details><div class="yi-actions yi-studio-actions"><button class="yi-primary" data-action="save-outfit" ${d.items.length?'':'disabled'}>${icon('bookmark')}${d.id?'保存修改':'保存到我的穿搭'}</button><button class="yi-secondary" data-action="draft-plan" ${d.items.length?'':'disabled'} aria-label="安排到日历">${icon('calendar-plus')}安排</button></div><p class="yi-local" data-save-state>${saveError?'保存失败，请先导出备份':'草稿自动保存在本机'}</p>`}`;
}
function studio(){
 const d=draft(),sel=d.items.find(i=>i.id===ui.selected),selectedName=sel?cloth(sel.id)?.name:'';
 return `<div class="yi-page-head"><div>${title('CANVAS','搭配画布','拖动单品，快速拼出今天想穿的样子')}</div><button class="yi-plus" data-action="new-outfit" aria-label="新建搭配">${icon('plus')}</button></div><section class="yi-editor-card"><div class="yi-editor-title"><input class="yi-editor-name" aria-label="穿搭名称" maxlength="40" value="${escape(d.name)}" placeholder="给这套穿搭起个名字"><select aria-label="穿搭分类" data-draft-occasion>${['日常','通勤','约会','户外'].map(o=>`<option ${d.occasion===o?'selected':''}>${o}</option>`).join('')}</select></div><div class="yi-canvas" aria-label="自定义搭配画布">${itemMarkup()}${d.items.length?'':'<div class="yi-empty" style="padding-top:75px">从下面选一件衣服<br>开始你的第一套搭配</div>'}<span class="yi-canvas-caption">点选衣服 · 拖动位置 · 双指缩放旋转</span></div><div class="yi-canvas-toolbar"><span>${d.items.length?`已选 ${d.items.length} 件`:'还没有单品'}</span><div class="yi-tools-secondary"><button data-action="undo" aria-label="撤销" ${ui.undo.length?'':'disabled'}>${icon('undo-2')}</button><button data-action="redo" aria-label="重做" ${ui.redo.length?'':'disabled'}>${icon('redo-2')}</button><button data-action="arrange" aria-label="自动排列" ${d.items.length?'':'disabled'}>${icon('layout-grid')}</button><button data-action="export-image" aria-label="导出穿搭图片" ${d.items.length?'':'disabled'}>${icon('download')}</button></div></div>${sel?`<div class="yi-selected-bar"><span>${icon('move')}已选：${escape(selectedName||'这件衣服')}</span><label>大小<input type="range" data-adjust="scale" aria-label="衣服大小" min="0.3" max="2" step="0.05" value="${sel.scale}"></label><button class="yi-text-button yi-danger" data-action="remove">移除</button></div>`:'<p class="yi-editor-hint">点选画布中的衣服后，可调整大小或移除。</p>'}</section><section class="yi-add-panel"><div class="yi-row"><h2>添加衣服</h2><span class="yi-muted">已选 ${d.items.length} 件</span></div><div class="yi-chips yi-picker-chips">${['全部',...categories].map(s=>`<button class="yi-chip" data-picker="${s}" aria-pressed="${ui.picker===s}">${s}</button>`).join('')}</div>${subtypeFilter(ui.picker,ui.pickerSubcategory,'picker-subcategory')}<div class="yi-picker">${pickerMarkup()}</div></section><details class="yi-advanced"><summary>${icon('image-plus')}添加模特图 <small>可选</small></summary><div class="yi-advanced-body">${d.modelPhoto?`<img class="yi-model-preview" src="${d.modelPhoto}" alt="当前穿搭的模特图">`:'<p class="yi-muted">上传一张参考图，和这套穿搭一起保存。</p>'}${d.modelPhoto?`<button class="yi-text-button" data-action="remove-model-photo">移除图片</button>`:''}<label class="yi-secondary yi-model-upload">${icon('image-plus')}${d.modelPhoto?'更换模特图':'上传模特图'}<input id="model-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传模特图"></label></div></details><div class="yi-actions yi-studio-actions"><button class="yi-primary" data-action="save-outfit" ${d.items.length?'':'disabled'}>${icon('bookmark')}${d.id?'保存修改':'保存到我的穿搭'}</button><button class="yi-secondary" data-action="draft-plan" ${d.items.length?'':'disabled'} aria-label="安排到日历">${icon('calendar-plus')}安排</button></div><p class="yi-local" data-save-state>${saveError?'保存失败，请先导出备份':'草稿自动保存在本机'}</p>`;
}
function outfits(){
 return `<div class="yi-page-head"><div>${title('MY OUTFITS','我的穿搭','保存喜欢的组合，下一次直接穿')}</div><button class="yi-plus" data-action="new-outfit" aria-label="新建穿搭">${icon('plus')}</button></div><div class="yi-outfit-summary"><span><strong>${data.outfits.length}</strong> 套已保存</span><button class="yi-text-button" data-page="studio">去搭一套 ${icon('arrow-up-right')}</button></div>${outfitLibrary()}`;
}
function savedCards(outfits){return outfits.slice().reverse().map(o=>`<article class="yi-outfit-card"><div class="yi-outfit-visual ${o.modelPhoto?'has-model':''}">${miniLook(o.items)}${o.modelPhoto?`<img class="yi-saved-model" src="${o.modelPhoto}" alt="${escape(o.name)}的模特图" loading="lazy">`:''}</div><div class="yi-outfit-info"><div class="yi-row"><h2>${escape(o.name)}</h2><span class="yi-tag">${o.occasion} · ${o.items.length} 件</span></div><div class="yi-actions"><button class="yi-primary" data-edit="${o.id}">${icon('pencil')}继续编辑</button><button class="yi-secondary" data-preview-outfit="${o.id}">编辑这套</button><button class="yi-secondary" data-schedule="${o.id}">${icon('calendar-plus')}安排</button><button class="yi-secondary" data-outfit-menu="${o.id}" aria-label="${escape(o.name)}更多操作">${icon('ellipsis')}</button></div></div></article>`).join('')}
function outfitLibrary(){const filtered=data.outfits.filter(o=>ui.outfitFilter==='全部'||o.occasion===ui.outfitFilter);return `<div class="yi-chips">${['全部','日常','通勤','约会','户外'].map(o=>`<button class="yi-chip" data-outfit-filter="${o}" aria-pressed="${ui.outfitFilter===o}">${o} · ${data.outfits.filter(v=>o==='全部'||v.occasion===o).length}</button>`).join('')}</div>${filtered.length?savedCards(filtered):'<div class="yi-grid-empty"><h2>这个分类还没有保存的穿搭</h2><p>在搭配画布选择穿搭分类，再点击保存。</p><button class="yi-secondary" data-outfit-filter="全部">查看全部已保存穿搭</button></div>'}`}
function savedForOccasion(){const outfits=data.outfits.filter(o=>o.occasion===ui.occasion);return `<section class="yi-section"><div class="yi-row"><h2>${ui.occasion} · 已保存 ${outfits.length} 套</h2><button class="yi-text-button" data-action="all-outfits">全部穿搭（${data.outfits.length}）</button></div>${outfits.length?savedCards(outfits):'<p class="yi-help">此分类暂无保存的穿搭；以前的搭配可在「全部穿搭」里查看并修改分类。</p>'}</section>`}

function calendarIntro(){
 const temp=data.settings.temperature,weather=data.settings.weather;
 return `<div class="yi-calendar-head"><div>${title('PLAN','穿搭日历','提前搭好，早晨多睡十分钟')}</div><button class="yi-weather" data-action="weather">${icon(weather==='雨'?'cloud-rain':weather==='阴'?'cloud':'sun')}${temp===null?'设置天气':`${temp}° ${weather}`}</button></div>`;
}
function calendar(){
 const month=ui.month,start=new Date(month.getFullYear(),month.getMonth(),1,12),offset=(start.getDay()+6)%7;
 const last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();const total=Math.ceil((offset+last)/7)*7;
 const first=localDate(start);const cells=Array.from({length:total},(_,n)=>{const key=shiftDate(first,n-offset),d=dateFromKey(key),p=data.plans[key];return `<button class="yi-date ${d.getMonth()!==month.getMonth()?'other':''} ${key===ui.day?'chosen':''} ${key===today()?'today':''} ${p?'marked':''} ${p?.worn?'worn':''}" data-day="${key}" aria-label="${d.getMonth()+1}月${d.getDate()}日${p?',已安排'+p.name:''}" aria-pressed="${key===ui.day}">${d.getDate()}</button>`}).join('');
 const date=dateFromKey(ui.day),plan=data.plans[ui.day],planned=Object.keys(data.plans).filter(k=>k.slice(0,7)===first.slice(0,7)).length;
 return `${calendarIntro()}<div id="calendar-month" class="yi-calendar"><div class="yi-row"><div class="yi-toolbar"><button data-month="-1" aria-label="上个月">${icon('chevron-left')}</button><span class="yi-calendar-month">${month.getFullYear()} 年 ${month.getMonth()+1} 月</span><button data-month="1" aria-label="下个月">${icon('chevron-right')}</button></div><button class="yi-text-button" data-action="calendar-today">今天</button></div><div class="yi-cal-grid">${['一','二','三','四','五','六','日'].map(s=>`<span class="yi-dow">${s}</span>`).join('')}${cells}</div><div class="yi-controls-legend"><span>• 已安排</span><span>— 已穿过</span><span style="margin-left:auto">本月 ${planned} 天已安排</span></div></div><div class="yi-plan"><div class="yi-row"><h2>${date.getMonth()+1} 月 ${date.getDate()} 日</h2><span class="yi-tag">${plan?(plan.worn?'已穿过':'已安排'):'留一点期待'}</span></div>${plan?`<div class="yi-outfit-visual ${plan.modelPhoto?'has-model':''}">${miniLook(plan.items)}${plan.modelPhoto?`<img class="yi-saved-model" src="${plan.modelPhoto}" alt="${escape(plan.name)}的模特图">`:''}</div><p style="font-size:14px;text-align:center">${escape(plan.name)}</p><div class="yi-actions"><button class="yi-primary" data-action="toggle-worn" ${ui.day>today()?'disabled':''}>${icon(plan.worn?'check-check':'check')}${plan.worn?'已穿过 · 撤销标记':'标记已穿'}</button><button class="yi-secondary" data-action="choose-plan">更换</button><button class="yi-secondary" data-action="remove-plan" aria-label="移除这天的安排">${icon('trash-2')}</button></div>${ui.day>today()?'<p class="yi-help">到了这一天，再记录实际穿着。</p>':''}`:`<div class="yi-empty">这一天还没有安排<br>选一套喜欢的，让明天轻松一点</div><button class="yi-primary" data-action="choose-plan" style="width:100%">${icon('plus')}安排一套穿搭</button>`}</div><p class="yi-local">${icon('calendar-check')}小小的计划，也是一种自我照顾</p>`;
}
function render(){
  main.innerHTML=({studio,closet,outfits,calendar}[ui.page]||studio)();
  nav.innerHTML=[['studio','layers-2','搭配画布'],['closet','shirt','衣橱'],['outfits','heart','我的穿搭'],['calendar','calendar-days','日历']].map(([id,ic,label])=>`<button data-page="${id}" ${ui.page===id?'aria-current="page"':''}>${icon(ic)}${label}</button>`).join('');icons();
}
function navigate(page){ui.page=page;if(location.hash!=='#'+page)history.replaceState(null,'','#'+page);render();window.scrollTo({top:0,behavior:'instant'})}
function checkpoint(){ui.undo.push(copy(draft()));if(ui.undo.length>35)ui.undo.shift();ui.redo=[];draft().dirty=true}
function refreshCanvas(){const canvas=main.querySelector('.yi-canvas');if(canvas){canvas.innerHTML=itemMarkup()+'<span class="yi-canvas-caption">拖动衣服 · 双指缩放与旋转</span>';refreshAdjust()}}
function refreshAdjust(){const sel=draft().items.find(i=>i.id===ui.selected);for(const key of ['scale','rotation']){const slider=main.querySelector(`[data-adjust=${key}]`);if(slider){slider.value=sel?.[key]??(key==='scale'?1:0);slider.disabled=!sel}}for(const action of ['front','remove']){const b=main.querySelector(`[data-action=${action}]`);if(b)b.disabled=!sel}for(const key of ['undo','redo']){const b=main.querySelector(`[data-action=${key}]`);if(b)b.disabled=!ui[key].length}}
function startDraft(outfit){data.draft={id:outfit.id&&data.outfits.some(o=>o.id===outfit.id)?outfit.id:null,name:outfit.name||'我的新搭配',occasion:outfit.occasion||'日常',items:copy(outfit.items),modelPhoto:outfit.modelPhoto||null,dirty:false};ui.undo=[];ui.redo=[];ui.selected=data.draft.items[0]?.id||null;ui.studioView='edit';navigate('studio');persist()}
function replaceDraft(outfit){if(draft().dirty&&(draft().items.length||draft().modelPhoto)){sheet('保留当前搭配？',`<p style="margin-top:16px">当前穿搭有未保存的修改。</p><div class="yi-actions">${draft().items.length?'<button class="yi-primary" data-action="keep-and-replace">保存并继续</button>':''}<button class="yi-secondary" data-action="discard-and-replace">放弃修改</button></div>`);ui.pendingDraft=outfit}else startDraft(outfit)}
async function saveOutfit(silent=false){
 if(!draft().items.length){toast('先从衣橱选择一件衣服');return null}
 const d=draft();const id=d.id||uid(),old=data.outfits.find(o=>o.id===id);
 const outfit={id,name:d.name.trim()||'我的新搭配',occasion:d.occasion,items:copy(d.items),modelPhoto:d.modelPhoto||null,createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};
 const idx=data.outfits.findIndex(o=>o.id===id);if(idx<0)data.outfits.push(outfit);else data.outfits[idx]=outfit;
 d.id=id;d.name=outfit.name;d.dirty=false;
 if(await persist()){if(!silent)toast('穿搭已保存，随时可以继续编辑');return outfit}return null;
}
function subtypeOptions(category,selected='未细分'){return ['未细分',...subcategories[category]].map(s=>`<option ${selected===s?'selected':''}>${s}</option>`).join('')}
function showUpload(id){
 const c=id?cloth(id):null;const category=c?.category||(ui.category==='全部'?'上衣':ui.category);
 uploadImage=c?.image||null;
 sheet(c?'编辑衣服':'收进我的衣橱',`<form id="clothing-form" data-edit-id="${c?.id||''}">
 <label class="yi-upload" for="clothing-photo"><span id="upload-preview">${c?`<img src="${c.image}" alt="${escape(c.name)}">`:`${icon('camera')}<span style="display:block;margin-top:8px">拍照 / 从相册选择</span>`}</span><input id="clothing-photo" type="file" accept="image/*" aria-label="选择衣服照片"></label>
 <div class="yi-import-row"><button type="button" class="yi-secondary" data-action="paste-image">${icon('clipboard')}粘贴已复制的图片</button><span>也可在此按 Ctrl+V</span></div>
 <p class="yi-help">iPhone 请先将图片保存到相册，再选择导入；支持的安卓浏览器可通过分享菜单接收图片。照片自动压缩，仅保存在本机；暂不自动抠图。</p>
 <label>给它起个名字<input name="name" required maxlength="40" placeholder="例如：最喜欢的白衬衫" value="${escape(c?.name||'')}"></label>
 <div class="yi-form-row"><label>大分类<select name="category">${categories.map(s=>`<option ${category===s?'selected':''}>${s}</option>`).join('')}</select></label><label>细分类<select name="subcategory">${subtypeOptions(category,c?.subcategory||(ui.subcategory==='全部'?'未细分':ui.subcategory))}</select></label></div>
 <label>图片备注 <span class="yi-optional">选填</span><textarea name="notes" maxlength="500" rows="3" placeholder="记下品牌、尺码、搭配想法，或这件衣服的小故事…">${escape(c?.notes||'')}</textarea></label>
 <div class="yi-note-footer"><span>保存后显示在照片下方</span><span id="notes-count">${(c?.notes||'').length} / 500</span></div>
 <div class="yi-form-row"><label>状态<select name="status">${Object.entries(statuses).map(([k,v])=>`<option value="${k}" ${c?.status===k?'selected':''}>${v}</option>`).join('')}</select></label><label>材质 / 季节<input name="meta" maxlength="60" placeholder="棉质 · 春 / 秋" value="${escape(c?.meta||'四季')}"></label></div>
 <p class="yi-error" role="alert" hidden></p><div class="yi-actions"><button type="submit" class="yi-primary">${icon('check')}${c?'保存修改':'添加到衣橱'}</button></div></form>`);
}
function clothingDetail(id){const c=cloth(id);if(!c)return;sheet(c.name,`<img class="yi-detail-image" src="${c.image}" alt="${escape(c.name)}"><div class="yi-row"><p>${c.category}${c.subcategory!=='未细分'?' / '+escape(c.subcategory):''} · ${escape(c.meta)}</p><span class="yi-tag">${statuses[c.status]}${c.sample?' · 示例':''}</span></div>${c.notes?`<div class="yi-detail-note"><span>我的备注</span><p>${escape(c.notes)}</p></div>`:'<p class="yi-help">还没有备注，点击编辑就能补充。</p>'}<div class="yi-actions"><button class="yi-primary" data-use="${id}">用这件搭一套 ${icon('arrow-right')}</button><button class="yi-secondary" data-edit-cloth="${id}" aria-label="编辑衣服">${icon('pencil')}</button></div><div class="yi-actions"><button class="yi-secondary" data-toggle-cloth="${id}" style="flex:1">${icon(c.status==='available'?'washing-machine':'check')}${c.status==='available'?'标记为清洗中':'设为可穿'}</button><button class="yi-secondary yi-danger" data-delete-cloth="${id}" aria-label="删除衣服">${icon('trash-2')}</button></div>`)}
function deleteClothingPrompt(id){const c=cloth(id),outfits=data.outfits.filter(o=>o.items.some(i=>i.id===id)).length,plans=Object.values(data.plans).filter(p=>p.items.some(i=>i.id===id)).length;sheet('删除这件衣服？',`<p style="margin-top:16px">将删除「${escape(c.name)}」${outfits||plans?`，并从相关的 ${outfits} 套穿搭、${plans} 条日历安排中移除`:'及其照片'}。仅含此单品的空搭配和空安排也会移除。</p><p style="margin-top:9px">此操作不能撤销，已导出的备份仍可恢复。</p><div class="yi-actions"><button class="yi-primary yi-danger" data-confirm-delete="${id}">确认删除</button><button class="yi-secondary" data-action="close">取消</button></div>`)}
function removeIds(ids){const removed=new Set(ids);data.clothes=data.clothes.filter(c=>!removed.has(c.id));for(const o of data.outfits)o.items=o.items.filter(i=>!removed.has(i.id));data.outfits=data.outfits.filter(o=>o.items.length);for(const [date,p]of Object.entries(data.plans)){p.items=p.items.filter(i=>!removed.has(i.id));if(!p.items.length)delete data.plans[date]}draft().items=draft().items.filter(i=>!removed.has(i.id));if(draft().id&&!data.outfits.some(o=>o.id===draft().id))draft().id=null;ui.undo=[];ui.redo=[];ui.selected=draft().items[0]?.id||null}
function settings(){const n=data.clothes.filter(c=>c.sample).length;sheet('我的个人衣橱',`<p style="margin-top:12px">给喜欢的衣服，一个自己的空间。</p><div class="yi-setting-row"><span>${icon('shirt')}衣服</span><span>${data.clothes.length} 件</span></div><div class="yi-setting-row"><span>${icon('bookmark')}保存的穿搭</span><span>${data.outfits.length} 套</span></div><button class="yi-setting-row" data-action="background-settings"><span>${icon('palette')}背景颜色与图片</span>${icon('chevron-right')}</button><button class="yi-setting-row" data-action="weather"><span>${icon('sun')}天气与城市</span><small>${data.settings.temperature===null?'尚未设置':data.settings.temperature+'℃ · '+data.settings.weather}</small></button><button class="yi-setting-row" data-action="backup"><span>${icon('download')}导出衣橱备份</span>${icon('chevron-right')}</button><button class="yi-setting-row" data-action="import"><span>${icon('upload')}从备份恢复</span>${icon('chevron-right')}</button>${n?`<button class="yi-setting-row" data-action="clear-demo"><span>${icon('eraser')}清空示例衣服</span><small>${n} 件</small></button>`:''}<button class="yi-setting-row" data-action="install"><span>${icon('smartphone')}${isStandalone()?'已添加到手机桌面':'添加到手机桌面'}</span>${icon('chevron-right')}</button><button class="yi-setting-row" data-action="pwa-settings"><span>${icon('wifi')}离线与应用更新</span><small data-pwa-state>${escape(pwaStatus())}</small></button><p class="yi-help">照片、搭配和日历仅保存在这台设备，没有云端同步。更换设备、删除桌面应用或清理网站数据前，请先导出备份到「文件」。</p><p class="yi-help">${data.settings.backupAt?'上次发起备份：'+new Date(data.settings.backupAt).toLocaleString('zh-CN'):'尚未导出过备份'}<br>${saveError?'当前有未保存的数据，请立即导出备份。':'衣间 · PWA '+APP_VERSION}</p>`)}
function refreshPwaStatus(){
 root.querySelectorAll('[data-pwa-state]').forEach(element=>element.textContent=pwaStatus());
 const button=root.querySelector('[data-action="apply-update"]');if(button)button.hidden=!hasPwaUpdate();
}
function pwaSettings(){
 sheet('离线与应用更新',`<p class="yi-help">衣间 · PWA ${APP_VERSION}</p><div class="yi-setting-row"><span>离线状态</span><small data-pwa-state>${escape(pwaStatus())}</small></div><p class="yi-help">显示「离线已就绪」后，可断网打开衣橱、添加照片、保存穿搭和安排日历。检查更新需要联网。</p><button class="yi-setting-row" data-action="check-update"><span>${icon('refresh-cw')}检查更新</span>${icon('chevron-right')}</button><button class="yi-primary" data-action="apply-update" ${hasPwaUpdate()?'':'hidden'}>应用更新并重新打开</button><p class="yi-help">更新前请先保存正在编辑的表单。更新不会清空已保存的衣橱；系统仍可能在存储空间不足时清理网站数据，请定期导出备份。</p>`);
}
function weatherForm(){sheet('今天的天气',`<form id="weather-form"><p>按你所在城市的天气手动填写，用来调整穿搭建议。</p><label>城市（选填）<input name="city" maxlength="30" placeholder="例如：杭州" value="${escape(data.settings.city)}"></label><div class="yi-form-row"><label>温度 / ℃<input name="temperature" type="number" min="-30" max="50" step="1" placeholder="未设置" value="${data.settings.temperature??''}"></label><label>天气<select name="weather">${['晴','阴','雨'].map(s=>`<option ${data.settings.weather===s?'selected':''}>${s}</option>`).join('')}</select></label></div><p class="yi-help">当前版本不请求定位，也不读取实时天气。</p><div class="yi-actions"><button class="yi-primary" type="submit">保存设置</button></div></form>`)}
function choosePlan(){const looks=[...data.outfits.slice().reverse(),...getLooks().filter(o=>!data.outfits.some(s=>s.id===o.id)).slice(0,8)];ui.planOptions=looks;sheet('为 '+Number(ui.day.slice(5,7))+' 月 '+Number(ui.day.slice(8))+' 日选一套',looks.length?looks.map((o,i)=>`<button class="yi-setting-row" data-pick-plan="${i}"><img src="${cloth(o.items[0]?.id)?.image}" alt="" style="height:57px;width:51px;object-fit:contain"><span style="flex:1">${escape(o.name)}</span>${icon('plus')}</button>`).join(''):`<div class="yi-empty">先在搭配画布里保存一套穿搭。</div><button class="yi-primary" data-action="go-studio" style="width:100%">去搭一套</button>`)}
function scheduleForm(outfit){ui.scheduling=copy(outfit);sheet('安排穿搭',`<form id="schedule-form"><p>${escape(outfit.name)}</p><label>哪一天穿？<input type="date" name="date" required value="${ui.day}"></label><p class="yi-help">同一天已有安排时，会先让你确认是否替换。</p><p class="yi-error" role="alert" hidden></p><div class="yi-actions"><button class="yi-primary" type="submit">${icon('calendar-plus')}保存安排</button></div></form>`)}
function updateBackgroundPreview(){
 const form=modal.querySelector('#background-form');if(!form)return;
 const preview=form.querySelector('.yi-background-preview'),color=form.elements.backgroundColor.value;
 preview.style.setProperty('--yi-preview-bg',color);
 preview.style.setProperty('--yi-preview-image',backgroundDraftImage?`url("${backgroundDraftImage}")`:'none');
 form.querySelector('[data-bg-image-state]').textContent=backgroundDraftImage?'已添加背景图片；保存后将在所有页面显示':'未添加背景图片';
}
function backgroundSettings(){
 backgroundDraftImage=data.settings.backgroundImage||null;
 const color=/^#[0-9a-f]{6}$/i.test(data.settings.backgroundColor||'')?data.settings.backgroundColor:'#fbfaf7';
 sheet('设置 App 背景',`<form id="background-form"><p class="yi-help">背景会应用到首页、衣橱、搭配和日历，并随衣橱备份保存。</p><label>背景颜色<input type="color" name="backgroundColor" value="${color}" aria-label="选择背景颜色"></label><div class="yi-background-presets">${[['米白','#fbfaf7'],['浅绿','#e9f1e8'],['浅蓝','#e8f1f5'],['暖粉','#f6e9e7'],['深绿','#25382f']].map(([name,value])=>`<button type="button" data-bg-color="${value}" aria-label="使用${name}背景" style="--yi-swatch:${value}"><span></span>${name}</button>`).join('')}</div><label class="yi-background-upload">添加背景图片<input id="background-photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="yi-help" data-bg-image-state></p><div class="yi-background-preview" role="img" aria-label="背景效果预览"><span>衣间 · 背景预览</span></div><div class="yi-actions"><button class="yi-secondary" type="button" data-action="background-remove-image">移除图片</button><button class="yi-secondary" type="button" data-action="background-reset">恢复默认</button></div><p class="yi-help">图片只保存在本机，上传后会压缩；文字区域会覆盖一层颜色，便于阅读。</p><p class="yi-error" role="alert" hidden></p><div class="yi-actions"><button class="yi-primary" type="submit">保存背景</button></div></form>`);
 updateBackgroundPreview();
}
async function setPlan(key,outfit,worn=false,confirmed=false){
 if(data.plans[key]&&!confirmed){ui.pendingPlan={key,outfit:copy(outfit),worn};sheet('替换这天的安排？',`<p style="margin-top:16px">${key} 已安排「${escape(data.plans[key].name)}」。替换后，将显示「${escape(outfit.name)}」，原来的已穿标记也会更新。</p><div class="yi-actions"><button class="yi-primary" data-action="confirm-plan">确认替换</button><button class="yi-secondary" data-action="close">取消</button></div>`);return}
 data.plans[key]={date:key,outfitId:data.outfits.some(o=>o.id===outfit.id)?outfit.id:null,name:outfit.name,items:copy(outfit.items),modelPhoto:outfit.modelPhoto||null,worn};
 if(await persist()){close();ui.day=key;ui.month=dateFromKey(key);render();toast(worn?'已记下今天的穿搭':'已安排到 '+key)}
}
async function compressPhoto(file){
 if(file.size>15*1024*1024)throw new Error('请选择小于 15 MB 的照片。');
 if(!file.type.startsWith('image/'))throw new Error('请选择照片文件。');
 let bitmap;try{bitmap=await createImageBitmap(file)}catch{throw new Error('暂时无法读取这张照片，请使用 JPG、PNG 或 WebP。')}
 const ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bitmap.width*ratio));c.height=Math.max(1,Math.round(bitmap.height*ratio));c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();return c.toDataURL('image/webp',.88);
}
async function compressStoredImage(file,label='背景图片',maxSide=1600){
 if(file.size>15*1024*1024)throw new Error(`${label}需小于 15 MB。`);
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error(`${label}请使用 JPG、PNG 或 WebP。`);
 let source,url;
 try{source=await createImageBitmap(file)}
 catch{
  url=URL.createObjectURL(file);source=new Image();source.src=url;
  try{await source.decode()}catch{URL.revokeObjectURL(url);throw new Error(`无法读取这张${label}。`)}
 }
 try{
  const width=source.width,height=source.height,ratio=Math.min(1,maxSide/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fbfaf7';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const result=canvas.toDataURL('image/jpeg',.78);
  if(result.length>3000000)throw new Error(`压缩后图片仍过大，请换一张${label}。`);
  return result;
 }finally{source.close?.();if(url)URL.revokeObjectURL(url)}
}
async function useImportImage(file){
 let form=modal.querySelector('#clothing-form');if(!form){navigate('closet');showUpload();form=modal.querySelector('#clothing-form')}
 const submit=form.querySelector('[type=submit]'),previous=uploadImage;
 submit.disabled=true;
 try{
  const image=await compressPhoto(file);
  if(!form.isConnected)return false;
  uploadImage=image;
  form.querySelector('#upload-preview').innerHTML=`<img src="${image}" alt="新衣服预览">`;
  form.querySelector('.yi-error').hidden=true;
  if(!form.elements.name.value&&file.name&&!/^image\.[a-z]+$/i.test(file.name))form.elements.name.value=file.name.replace(/\.[^.]+$/,'').slice(0,40);
  return true;
 }catch(error){uploadImage=previous;if(form.isConnected)formError(error.message);else toast(error.message);return false}
 finally{if(form.isConnected)submit.disabled=false}
}
async function pasteFromClipboard(){
 if(window.YijianIOS){let form=modal.querySelector('#clothing-form');if(!form){navigate('closet');showUpload();form=modal.querySelector('#clothing-form')}form.querySelector('#clothing-photo')?.click();return}
 if(!navigator.clipboard?.read){if(window.YijianAndroid){window.YijianAndroid.importClipboardImage();return}toast('浏览器不支持直接读取图片，请复制图片后在添加衣服窗口按 Ctrl+V，或保存图片再上传。');return}
 try{
  const items=await navigator.clipboard.read();
  const item=items.find(entry=>entry.types.some(type=>type.startsWith('image/')));
  if(!item){toast('剪贴板中没有图片。请在淘宝选择“复制图片”，不是“复制链接”。');return}
  const type=item.types.find(type=>type.startsWith('image/'));
  const blob=await item.getType(type);
  if(await useImportImage(new File([blob],'淘宝衣服图片.'+(type.split('/')[1]||'png'),{type})))toast('图片已放入预览，请确认分类和备注后保存');
 }catch{if(window.YijianAndroid)window.YijianAndroid.importClipboardImage();else toast('无法读取剪贴板。请允许图片读取，或在添加衣服窗口按 Ctrl+V。')}
}
async function receiveSharedImage(){
 const url=new URL(location.href),id=url.searchParams.get('shared-image'),error=url.searchParams.get('share-error');
 if(!id&&!error)return;
 url.searchParams.delete('shared-image');url.searchParams.delete('share-error');
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 if(error){toast(({missing:'没有收到图片；请分享图片文件，而不是商品链接。',large:'图片需小于 15 MB。',invalid:'分享的文件不是图片。',storage:'接收图片失败，请保存图片后手动上传。'})[error]||'图片导入失败，请重试。');return}
 if(!/^[a-f0-9-]{36}$/i.test(id)){toast('分享图片标识无效。');return}
 try{
  const inbox=await caches.open('yijian-share-inbox-v1'),key=new URL('./__shared-image__/'+id,location.href).href;
  const response=await inbox.match(key);
  if(!response){toast('分享的图片已过期，请重新分享。');return}
  const blob=await response.blob();
  await inbox.delete(key);
  if(await useImportImage(new File([blob],'分享的衣服图片.'+(blob.type.split('/')[1]||'png'),{type:blob.type})))toast('图片已导入预览，请分类并保存');
 }catch{toast('无法读取分享的图片，请保存图片后手动上传。')}
}
async function download(blob,name){
 if(window.YijianIOS){
  try{
   const id=window.YijianIOS.beginDownload(name,blob.type||'application/octet-stream');
   for(let offset=0;offset<blob.size;offset+=192*1024){
    const part=blob.slice(offset,offset+192*1024);
    const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(part)});
    window.YijianIOS.appendDownload(id,encoded);
   }
   window.YijianIOS.finishDownload(id);
  }catch(error){console.error(error);toast('保存文件失败，请重试。');return false}
  return true;
 }
 if(window.YijianAndroid){
  try{
   const id=window.YijianAndroid.beginDownload(name,blob.type||'application/octet-stream');
   for(let offset=0;offset<blob.size;offset+=192*1024){
    const part=blob.slice(offset,offset+192*1024);
    const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(part)});
    window.YijianAndroid.appendDownload(id,encoded);
   }
   window.YijianAndroid.finishDownload(id);
  }catch(error){console.error(error);toast('保存文件失败，请重试。');return false}
  return true;
 }
 const file=new File([blob],name,{type:blob.type||'application/octet-stream'});
 if(navigator.share&&navigator.canShare?.({files:[file]})){
  try{await navigator.share({files:[file]});return true}
  catch(error){if(error.name==='AbortError')return false}
 }
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return true;
}
window.yijianDownload=download;
async function exportImage(){
 if(!draft().items.length)return;toast('正在生成穿搭图片…');
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1164;const g=canvas.getContext('2d');g.fillStyle='#eeece3';g.fillRect(0,0,1200,1164);const height=1044;
 for(const i of draft().items){const c=cloth(i.id);if(!c)continue;const img=new Image();img.src=c.image;await img.decode();const fit=Math.min(480/img.width,height*.48/img.height);g.save();g.translate(i.x*12,i.y/100*height);g.rotate(i.rotation*Math.PI/180);g.scale(i.scale,i.scale);g.shadowColor='#303b3220';g.shadowBlur=12;g.shadowOffsetY=12;g.drawImage(img,-img.width*fit/2,-img.height*fit/2,img.width*fit,img.height*fit);g.restore()}
 g.fillStyle='#fbfaf7';g.fillRect(0,height,1200,120);g.fillStyle='#4b6248';g.font='32px "Microsoft YaHei", sans-serif';g.fillText(draft().name||'我的穿搭',44,height+54,950);g.fillStyle='#797d72';g.font='17px sans-serif';g.fillText('衣间 YIJIAN · YOUR STYLE, YOUR RULES',44,height+91);
 canvas.toBlob(blob=>{if(blob){download(blob,(draft().name||'我的穿搭').replace(/[\\/:*?"<>|]/g,'-')+'.png');toast(window.YijianAndroid?'请在系统界面保存穿搭图片':'穿搭图片已导出')}else toast('图片生成失败，请再试一次')},'image/png');
}

root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.action==='reload'){location.reload();return}if(!data)return;
 try{
 if(b.dataset.bgColor){modal.querySelector('#background-form [name=backgroundColor]').value=b.dataset.bgColor;updateBackgroundPreview();return}
 if(b.dataset.page){navigate(b.dataset.page);return}
 if(b.dataset.outfitFilter){ui.outfitFilter=b.dataset.outfitFilter;render();return}
 if(b.dataset.previewOutfit){const outfit=data.outfits.find(o=>o.id===b.dataset.previewOutfit);if(outfit)replaceDraft(outfit);return}
 if(b.dataset.occasion){ui.previewLook=null;ui.occasion=b.dataset.occasion;ui.look=0;render();return}
 if(b.dataset.category){ui.category=b.dataset.category;ui.subcategory='全部';render();return}
 if(b.dataset.subcategory){ui.subcategory=b.dataset.subcategory;render();return}
 if(b.dataset.picker){ui.picker=b.dataset.picker;ui.pickerSubcategory='全部';render();return}
 if(b.dataset.pickerSubcategory){ui.pickerSubcategory=b.dataset.pickerSubcategory;render();return}
 if(b.dataset.studio){ui.studioView=b.dataset.studio;render();return}
 if(b.dataset.cloth){clothingDetail(b.dataset.cloth);return}
 if(b.dataset.editCloth){showUpload(b.dataset.editCloth);return}
 if(b.dataset.toggleCloth){const c=cloth(b.dataset.toggleCloth);c.status=c.status==='available'?'washing':'available';if(await persist()){clothingDetail(c.id);render();toast('已设为'+statuses[c.status])}return}
 if(b.dataset.deleteCloth){deleteClothingPrompt(b.dataset.deleteCloth);return}
 if(b.dataset.confirmDelete){removeIds([b.dataset.confirmDelete]);if(await persist()){close();render();toast('衣服已删除，可从之前导出的备份恢复')}return}
 if(b.dataset.use){close();replaceDraft({name:cloth(b.dataset.use).name+'的搭配',items:[{id:b.dataset.use,x:50,y:40,scale:1.1,rotation:0}]});return}
 if(b.dataset.add){const id=b.dataset.add;ui.selected=id;if(!draft().items.some(i=>i.id===id)){if(draft().items.length>=24){toast('一套搭配最多添加 24 件单品');return}checkpoint();draft().items.push({id,x:50,y:45,scale:.9,rotation:0});persist()}render();return}
 if(b.dataset.item){ui.selected=b.dataset.item;main.querySelectorAll('[data-item]').forEach(el=>el.classList.toggle('selected',el.dataset.item===ui.selected));refreshAdjust();return}
 if(b.dataset.edit){const o=data.outfits.find(o=>o.id===b.dataset.edit);replaceDraft(o);return}
 if(b.dataset.schedule){scheduleForm(data.outfits.find(o=>o.id===b.dataset.schedule));return}
 if(b.dataset.outfitMenu){const o=data.outfits.find(o=>o.id===b.dataset.outfitMenu);sheet(o.name,`<button class="yi-setting-row" data-copy-outfit="${o.id}"><span>${icon('copy')}复制后修改</span></button><button class="yi-setting-row yi-danger" data-delete-outfit="${o.id}"><span>${icon('trash-2')}删除保存的穿搭</span></button><p class="yi-help">删除穿搭不会删除衣服，已安排的日历会保留当时的搭配。</p>`);return}
 if(b.dataset.copyOutfit){const o=data.outfits.find(o=>o.id===b.dataset.copyOutfit);close();replaceDraft({...copy(o),id:null,name:o.name+' · 副本'});return}
 if(b.dataset.deleteOutfit){sheet('删除保存的穿搭？',`<p style="margin-top:16px">只删除这套穿搭方案，衣服和日历安排会保留。</p><div class="yi-actions"><button class="yi-primary yi-danger" data-confirm-outfit-delete="${b.dataset.deleteOutfit}">确认删除</button><button class="yi-secondary" data-action="close">取消</button></div>`);return}
 if(b.dataset.confirmOutfitDelete){data.outfits=data.outfits.filter(o=>o.id!==b.dataset.confirmOutfitDelete);if(draft().id===b.dataset.confirmOutfitDelete)draft().id=null;if(await persist()){close();render();toast('穿搭已删除，衣服和日历已保留')}return}
 if(b.dataset.dayLink){ui.day=b.dataset.dayLink;ui.month=dateFromKey(ui.day);navigate('calendar');main.querySelector('#calendar-month')?.scrollIntoView({behavior:'smooth',block:'start'});return}
 if(b.dataset.day){ui.day=b.dataset.day;ui.month=dateFromKey(ui.day);render();return}
 if(b.dataset.month){ui.month=new Date(ui.month.getFullYear(),ui.month.getMonth()+Number(b.dataset.month),1,12);render();return}
 if(b.dataset.pickPlan!==undefined){await setPlan(ui.day,ui.planOptions[Number(b.dataset.pickPlan)]);return}
 if(b.dataset.availability!==undefined){ui.availability=b.dataset.availability;close();render();return}
 switch(b.dataset.action){
 case 'close':close();break;
 case 'settings':settings();break;
 case 'background-settings':backgroundSettings();break;
 case 'remove-model-photo':draft().modelPhoto=null;draft().dirty=true;await persist();render();toast('模特图已从草稿移除，保存穿搭后生效');break;
 case 'background-remove-image':backgroundDraftImage=null;updateBackgroundPreview();break;
 case 'background-reset':backgroundDraftImage=null;modal.querySelector('#background-form [name=backgroundColor]').value='#fbfaf7';updateBackgroundPreview();break;
 case 'weather':weatherForm();break;
 case 'upload':showUpload();break;
 case 'paste-image':await pasteFromClipboard();break;
 case 'dismiss-intro':data.settings.onboarded=true;persist();render();break;
 case 'shuffle':ui.previewLook=null;ui.look++;render();break;
 case 'wear':if(currentLook())await setPlan(today(),currentLook(),true);break;
 case 'customize':replaceDraft({...copy(currentLook()),id:null});break;
  case 'all-outfits':ui.outfitFilter='全部';navigate('outfits');break;
  case 'favorite':{const look=currentLook();if(!look)break;if(matchingOutfit(look)){navigate('outfits');break}data.outfits.push({id:uid(),name:look.name,occasion:ui.occasion,items:copy(look.items),createdAt:Date.now(),updatedAt:Date.now()});if(await persist()){ui.look=0;render();toast('已保存到「我的穿搭」')}break}
 case 'reset-filter':ui.category='全部';ui.subcategory='全部';ui.query='';ui.availability='all';render();break;
 case 'availability':sheet('查看衣服状态',[['all','全部状态'],...Object.entries(statuses)].map(([k,v])=>`<button class="yi-setting-row" data-availability="${k}"><span>${v}</span>${ui.availability===k?icon('check'):''}</button>`).join(''));break;
 case 'new-outfit':replaceDraft({name:'我的新搭配',items:[]});break;
 case 'keep-and-replace':{const next=ui.pendingDraft;if(await saveOutfit(true)){close();startDraft(next)}break}
 case 'discard-and-replace':{const next=ui.pendingDraft;close();startDraft(next);break}
 case 'undo':if(ui.undo.length){ui.redo.push(copy(draft()));data.draft=ui.undo.pop();ui.selected=draft().items[0]?.id;persist();render()}break;
 case 'redo':if(ui.redo.length){ui.undo.push(copy(draft()));data.draft=ui.redo.pop();ui.selected=draft().items[0]?.id;persist();render()}break;
 case 'arrange':checkpoint();draft().items=layout(draft().items.map(i=>i.id));persist();render();break;
 case 'front':{const i=draft().items.find(i=>i.id===ui.selected);if(i){checkpoint();draft().items=draft().items.filter(x=>x!==i);draft().items.push(i);persist();render()}break}
 case 'remove':checkpoint();draft().items=draft().items.filter(i=>i.id!==ui.selected);ui.selected=draft().items[0]?.id;persist();render();break;
  case 'save-outfit':if(await saveOutfit()){ui.outfitFilter=draft().occasion;ui.previewLook=null;navigate('outfits')}break;
 case 'draft-plan':{const outfit=await saveOutfit(true);if(outfit){render();scheduleForm(outfit)}break}
 case 'export-image':await exportImage();break;
 case 'calendar-today':ui.day=today();ui.month=dateFromKey(ui.day);render();break;
 case 'calendar-month':main.querySelector('#calendar-month')?.scrollIntoView({behavior:'smooth',block:'start'});break;
 case 'choose-plan':choosePlan();break;
 case 'go-studio':close();ui.studioView='edit';navigate('studio');break;
 case 'confirm-plan':{const {key,outfit,worn}=ui.pendingPlan;await setPlan(key,outfit,worn,true);break}
 case 'toggle-worn':if(data.plans[ui.day]&&ui.day<=today()){data.plans[ui.day].worn=!data.plans[ui.day].worn;if(await persist())render()}break;
 case 'remove-plan':sheet('移除这天的安排？','<p style="margin-top:16px">这一天的穿搭安排和已穿标记会被移除，保存的穿搭不受影响。</p><div class="yi-actions"><button class="yi-primary yi-danger" data-action="confirm-remove-plan">确认移除</button><button class="yi-secondary" data-action="close">取消</button></div>');break;
 case 'confirm-remove-plan':delete data.plans[ui.day];if(await persist()){close();render();toast('已移除这天的安排')}break;
 case 'backup':{const backup=copy(data);backup.settings.backupAt=Date.now();const saved=await download(new Blob([JSON.stringify(backup)],{type:'application/json'}),'衣间备份-'+today()+'.json');if(!saved)break;data.settings.backupAt=backup.settings.backupAt;await persist();settings();toast('请确认备份已存到「文件」或下载文件夹，包含照片、穿搭与日历');break}
 case 'import':document.getElementById('backup-input').click();break;
 case 'confirm-import':{if(!ui.importData)break;const imported=ui.importData;try{await saveChain.catch(()=>{});await store(imported);data=imported;applyBackground();saveError=false;ui.importData=null;ui.undo=[];ui.redo=[];ui.selected=null;close();navigate('closet');toast('备份已恢复，照片和日历都回来了')}catch{toast('恢复失败，原衣橱未被覆盖')}break}
 case 'clear-demo':sheet('清空示例衣服？','<p style="margin-top:16px">只删除标记为「示例」的衣服，并从搭配和日历中移除。你上传的照片会保留。操作不可撤销，请先备份需要保留的内容。</p><div class="yi-actions"><button class="yi-primary yi-danger" data-action="confirm-clear-demo">清空示例</button><button class="yi-secondary" data-action="close">保留</button></div>');break;
 case 'confirm-clear-demo':removeIds(data.clothes.filter(c=>c.sample).map(c=>c.id));data.settings.onboarded=true;if(await persist()){close();render();toast('示例衣服已清空，你上传的照片已保留')}break;
 case 'install':if(window.YijianAndroid||window.YijianIOS||isStandalone())toast('衣间已安装在手机上');else if(installPrompt){await installPrompt.prompt();installPrompt=null}else sheet('添加到手机桌面','<p style="margin-top:16px">1. 在 iPhone 的 Safari 普通标签页打开衣间的 HTTPS 链接。微信内打开时，请先选择「在浏览器中打开」。</p><p style="margin-top:12px">2. 点「分享」（方框向上箭头），选择「添加到主屏幕」。如果出现「作为网页 App 打开」，请保持开启，再点「添加」。</p><p style="margin-top:12px">3. 回到手机桌面，从「衣间」图标打开。在「我 → 离线与应用更新」确认「离线已就绪」。</p><p class="yi-help">请先添加到桌面，再开始导入个人照片。Safari 页面与桌面应用可能使用不同的数据空间。安卓可在 Chrome 菜单中选择「安装应用」。</p><p class="yi-help">电脑的 localhost、局域网 HTTP 地址和直接打开 ZIP 都不能用于 iPhone 正式安装。</p>');break;
 case 'pwa-settings':pwaSettings();break;
 case 'check-update':try{toast(await checkPwaUpdate());refreshPwaStatus()}catch(error){toast(error.message||'检查更新失败，请检查网络后重试。')}break;
 case 'apply-update':await saveChain.catch(()=>{});if(saveError){toast('有未保存的数据，请先导出备份。');break}if(!applyPwaUpdate())toast('目前没有待安装的新版本。');break;
 }
 }catch(error){console.error(error);toast('操作没有完成，请重试。你的本机数据仍在。')}
});

let nameTimer;
root.addEventListener('input',e=>{
 if(!data)return;
 if(e.target.matches('#background-form [name=backgroundColor]'))updateBackgroundPreview();
 if(e.target.matches('.yi-search input')){ui.query=e.target.value;main.querySelector('.yi-grid').innerHTML=clothCards();main.querySelector('#cloth-count').textContent=filteredClothes().length+' 件单品';icons()}
 if(e.target.matches('#clothing-form [name=notes]'))modal.querySelector('#notes-count').textContent=e.target.value.length+' / 500';
 if(e.target.matches('.yi-editor-name')){draft().name=e.target.value;draft().dirty=true;clearTimeout(nameTimer);nameTimer=setTimeout(persist,250)}
 if(e.target.dataset.adjust){const i=draft().items.find(i=>i.id===ui.selected);if(i){if(!ui.adjusting){checkpoint();ui.adjusting=true}i[e.target.dataset.adjust]=Number(e.target.value);const el=main.querySelector(`[data-item="${i.id}"]`);if(el){el.style.setProperty('--scale',i.scale);el.style.setProperty('--rotation',i.rotation+'deg')}refreshAdjust()}}
});
root.addEventListener('change',async e=>{
 if(e.target.id==='model-photo'){
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const currentDraft=draft(),button=main.querySelector('[data-action=save-outfit]');if(button)button.disabled=true;
  try{const photo=await compressStoredImage(file,'模特图',1280);if(draft()!==currentDraft)return;currentDraft.modelPhoto=photo;currentDraft.dirty=true;if(await persist()){render();toast('模特图已加入草稿，保存穿搭后会一起保存')}}
  catch(error){toast(error.message)}
  finally{if(button?.isConnected)button.disabled=false}
 }
 if(e.target.id==='background-photo'){
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const button=modal.querySelector('#background-form [type=submit]');if(button)button.disabled=true;
  try{backgroundDraftImage=await compressStoredImage(file);updateBackgroundPreview()}
  catch(error){formError(error.message)}
  finally{if(button?.isConnected)button.disabled=false}
 }
 if(e.target.matches('[data-draft-occasion]')){draft().occasion=e.target.value;draft().dirty=true;await persist()}
 if(e.target.matches('.yi-editor-name')){clearTimeout(nameTimer);await persist()}
 if(e.target.dataset.adjust){ui.adjusting=false;await persist()}
 if(e.target.matches('#clothing-form [name=category]')){const select=e.target.form.elements.subcategory;select.innerHTML=subtypeOptions(e.target.value,select.value)}
 if(e.target.id==='clothing-photo'){
  const file=e.target.files[0];if(file)await useImportImage(file);
 }
 if(e.target.id==='backup-input'){
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{if(file.size>60*1024*1024)throw new Error('备份文件超过 60 MB，暂不支持导入。');const restored=validateBackup(JSON.parse(await file.text()));ui.importData=restored;sheet('恢复这份衣橱备份？',`<p style="margin-top:16px">备份包含 ${restored.clothes.length} 件衣服、${restored.outfits.length} 套穿搭和 ${Object.keys(restored.plans).length} 条日历安排。</p><p style="margin-top:10px">恢复会覆盖当前衣橱。建议先导出当前备份，方便找回。</p><div class="yi-actions"><button class="yi-primary" data-action="confirm-import">确认覆盖并恢复</button><button class="yi-secondary" data-action="backup">先备份当前衣橱</button></div>`)}catch(error){toast(error instanceof SyntaxError?'文件不是有效的 JSON 备份。':error.message)}
 }
});
root.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target,b=form.querySelector('[type=submit]');if(b?.disabled)return;
 if(form.id==='background-form'){
  const color=form.elements.backgroundColor.value;
  if(!/^#[0-9a-f]{6}$/i.test(color)){formError('请选择有效的背景颜色。');return}
  b.disabled=true;data.settings.backgroundColor=color;data.settings.backgroundImage=backgroundDraftImage;
  if(await persist()){applyBackground();close();render();toast('背景已更新，所有页面都会使用新背景')}
  else b.disabled=false;
 }
 if(form.id==='clothing-form'){
  if(!uploadImage){formError('请先选择一张衣服照片。');return}const name=form.elements.name.value.trim();if(!name){formError('给这件衣服起个名字吧。');return}
  b.disabled=true;const id=form.dataset.editId,old=cloth(id);const c={id:id||uid(),name,category:form.elements.category.value,subcategory:form.elements.subcategory.value,notes:form.elements.notes.value.trim(),status:form.elements.status.value,meta:form.elements.meta.value.trim()||'四季',image:uploadImage,color:old?.color||'#a3ad92',kind:old?.kind||'',sample:old?.sample===true&&uploadImage===old.image,createdAt:old?.createdAt||Date.now()};
  if(old)data.clothes[data.clothes.indexOf(old)]=c;else data.clothes.unshift(c);data.settings.onboarded=true;
  if(await persist()){close();ui.category='全部';ui.subcategory='全部';ui.query='';ui.availability='all';navigate('closet');toast(old?'衣服信息已更新':'衣服已收进你的衣橱')}else b.disabled=false;
 }
 if(form.id==='weather-form'){const value=form.elements.temperature.value;data.settings.city=form.elements.city.value.trim();data.settings.temperature=value===''?null:Number(value);data.settings.weather=form.elements.weather.value;ui.look=0;if(await persist()){close();render();toast('天气设置已更新')}}
 if(form.id==='schedule-form'){const key=form.elements.date.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||localDate(dateFromKey(key))!==key){formError('请选择有效的日期');return}const outfit=ui.scheduling;await setPlan(key,outfit);if(modal.hidden)navigate('calendar')}
});

const pointers=new Map();
function syncTransform(i,el){el.style.left=i.x+'%';el.style.top=i.y+'%';el.style.setProperty('--scale',i.scale);el.style.setProperty('--rotation',i.rotation+'deg')}
root.addEventListener('pointerdown',e=>{
 const b=e.target.closest('[data-item]');if(!b||e.button>0)return;e.preventDefault();
 if(ui.drag&&ui.drag.id!==b.dataset.item)return;
 const i=draft().items.find(i=>i.id===b.dataset.item);if(!i)return;
 ui.selected=i.id;main.querySelectorAll('[data-item]').forEach(el=>el.classList.toggle('selected',el===b));
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});b.setPointerCapture(e.pointerId);
 if(!ui.drag){ui.drag={id:i.id,element:b,rect:b.parentElement.getBoundingClientRect(),origin:copy(i),start:{x:e.clientX,y:e.clientY},moved:false}}
 if(pointers.size===2){const [a,z]=[...pointers.values()];ui.drag.pinch={distance:Math.hypot(z.x-a.x,z.y-a.y),angle:Math.atan2(z.y-a.y,z.x-a.x),scale:i.scale,rotation:i.rotation}}
 refreshAdjust();
});
root.addEventListener('pointermove',e=>{
 if(!ui.drag||!pointers.has(e.pointerId))return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const d=ui.drag,i=draft().items.find(i=>i.id===d.id);if(!i)return;
 if(!d.moved){if(pointers.size===1&&Math.hypot(e.clientX-d.start.x,e.clientY-d.start.y)<2)return;checkpoint()}
 if(pointers.size>=2&&d.pinch){const [a,z]=[...pointers.values()];i.scale=Math.max(.3,Math.min(2,d.pinch.scale*Math.hypot(z.x-a.x,z.y-a.y)/Math.max(1,d.pinch.distance)));i.rotation=Math.max(-180,Math.min(180,d.pinch.rotation+(Math.atan2(z.y-a.y,z.x-a.x)-d.pinch.angle)*180/Math.PI))}
 else{i.x=Math.max(10,Math.min(90,d.origin.x+(e.clientX-d.start.x)/d.rect.width*100));i.y=Math.max(10,Math.min(90,d.origin.y+(e.clientY-d.start.y)/d.rect.height*100))}
 d.moved=true;syncTransform(i,d.element);refreshAdjust();
});
function endPointer(e){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(!ui.drag)return;const i=draft().items.find(i=>i.id===ui.drag.id);if(pointers.size===1){ui.drag.origin=copy(i);ui.drag.start=[...pointers.values()][0];ui.drag.pinch=null}else if(!pointers.size){const moved=ui.drag.moved;ui.drag=null;if(moved)persist();refreshAdjust()}}
root.addEventListener('pointerup',endPointer);root.addEventListener('pointercancel',endPointer);
root.addEventListener('keydown',e=>{
 if(!modal.hidden){if(e.key==='Escape'){close();return}if(e.key==='Tab'){const els=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(el=>el.offsetParent!==null),first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}return}
 const b=e.target.closest('[data-item]');if(!b||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const i=draft().items.find(i=>i.id===b.dataset.item);if(!e.repeat)checkpoint();i.x=Math.max(10,Math.min(90,i.x+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)));i.y=Math.max(10,Math.min(90,i.y+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)));syncTransform(i,b);persist();refreshAdjust();
});
modal.addEventListener('click',e=>{if(e.target===modal)close()});
window.addEventListener('paste',async e=>{
 if(!data)return;
 const item=[...(e.clipboardData?.items||[])].find(entry=>entry.kind==='file'&&entry.type.startsWith('image/'));
 if(!item)return;
 e.preventDefault();
 const file=item.getAsFile();if(!file)return;
 if(modal.querySelector('#background-form')){
  try{backgroundDraftImage=await compressStoredImage(file);updateBackgroundPreview();toast('背景图片已放入预览，点击保存背景即可使用')}
  catch(error){formError(error.message)}
 }else if(await useImportImage(file))toast('图片已放入预览，请分类并保存');
});
window.addEventListener('yijian-native-share',async e=>{
 const id=e.detail?.id;
 if(!window.YijianAndroid||!data||!/^[a-f0-9-]{36}$/i.test(id||''))return;
 try{
  const response=await fetch('/__native-share/'+id,{headers:{'X-Yijian-Session':window.YijianAndroid.session()}});
  if(!response.ok)throw new Error('分享图片无法读取');
  const blob=await response.blob();
  const file=new File([blob],'分享的衣服图片.'+(blob.type.split('/')[1]||'png'),{type:blob.type});
  if(await useImportImage(file))toast('图片已导入预览，请分类并保存');
 }catch(error){console.error(error);toast('接收分享图片失败，请从相册选择图片')}
});
window.addEventListener('hashchange',()=>{const page=location.hash.slice(1);if(page==='today')navigate('studio');else if(['closet','studio','outfits','calendar'].includes(page))navigate(page)});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
window.addEventListener('beforeunload',e=>{if(saveError){e.preventDefault();e.returnValue=''}});
// Every edit is persisted at its source; never write a stale snapshot merely on tab switching.
try{
 data=await load();if(!data){data=fresh(demoClothes());await store(data)}
 const hadLegacyAi=Object.hasOwn(data,'aiResults');delete data.aiResults;if(hadLegacyAi)await store(data);
 if(data.clothes.some(c=>c.subcategory===undefined||c.notes===undefined)){data.clothes=data.clothes.map(normalizeClothing);await store(data)}
 if(!data.draft)data.draft={id:null,name:'我的新搭配',occasion:'日常',items:[],modelPhoto:null,dirty:false};
 ui.selected=draft().items[0]?.id||null;applyBackground();render();
 window.YijianAndroid?.ready();
 await receiveSharedImage();
 setupPwa(refreshPwaStatus);
 navigator.storage?.persist?.().catch(()=>{});
}catch(error){console.error(error);main.innerHTML='<div class="yi-grid-empty"><h2>暂时无法打开本机衣橱</h2><p>浏览器可能限制了本地存储。请在普通浏览窗口中打开，允许此网站存储数据后重试。</p><button class="yi-primary" data-action="reload" style="margin:20px auto">重新打开</button></div>'}
