export const categories=['上衣','下装','连衣裙','外套','鞋履','配饰'];
export const subcategories={
 '上衣':['短袖','长袖','背心 / 吊带','其他上衣'],
 '下装':['半身裙','长裤','短裤','其他下装'],
 '连衣裙':['短袖连衣裙','长袖连衣裙','无袖 / 吊带裙','其他连衣裙'],
 '外套':['薄外套','风衣','西装外套','大衣','羽绒服 / 棉服','其他外套'],
 '鞋履':['运动鞋','休闲鞋','皮鞋','凉鞋','靴子','其他鞋履'],
 '配饰':['手提包','背包','帽子','围巾','首饰','其他配饰']
};
export function normalizeClothing(c){return {...c,subcategory:c.subcategory||'未细分',notes:typeof c.notes==='string'?c.notes:''}}
export const statuses={available:'可穿',washing:'清洗中',stored:'已收纳'};
export const uid=()=>crypto.randomUUID();
export const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const dateFromKey=key=>new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,Number(key.slice(8,10)),12);
export const shiftDate=(key,days)=>{const d=dateFromKey(key);d.setDate(d.getDate()+days);return localDate(d)};
export function layout(ids){const slots=[[32,26,1],[39,65,1.1],[78,34,.72],[76,78,.77],[20,69,.76],[72,56,.65]];return ids.map((id,n)=>({id,x:slots[n%6][0],y:slots[n%6][1],scale:slots[n%6][2],rotation:0}))}
export function fresh(clothes){return {schema:1,clothes:clothes.map(normalizeClothing),outfits:[],plans:{},draft:{id:null,name:'我的早秋穿搭',occasion:'日常',items:layout(['shirt','pants','bag','shoe']),modelPhoto:null,dirty:false},settings:{city:'',temperature:null,weather:'晴',onboarded:false,backupAt:null,backgroundColor:'#fbfaf7',backgroundImage:null},updatedAt:Date.now()}}
export function recommend(data,occasion='日常'){
 const usable=data.clothes.filter(c=>c.status==='available');
 const pool=cat=>usable.filter(c=>c.category===cat);
 const tops=pool('上衣'),bottoms=pool('下装'),dresses=pool('连衣裙'),shoes=pool('鞋履'),bags=pool('配饰'),coats=pool('外套');
 const temperature=data.settings.temperature;
 const candidates=[];
 const add=(name,items,note,id,modelPhoto=null)=>candidates.push({id,name,items,occasion,note,modelPhoto});
 const idSet=new Set(usable.map(c=>c.id));
 data.outfits.filter(o=>o.occasion===occasion&&o.items.length&&o.items.every(i=>idSet.has(i.id))).forEach(o=>add(o.name,o.items,'来自你保存的搭配，熟悉又省心。',o.id,o.modelPhoto||null));
 let count=0;
 const bases=[...tops.flatMap(t=>bottoms.map(b=>[t.id,b.id])),...dresses.map(d=>[d.id])].slice(0,48);
 for(const base of bases){
  const shoe=shoes[count%Math.max(1,shoes.length)];const bag=bags[count%Math.max(1,bags.length)];const coat=coats[count%Math.max(1,coats.length)];
  const ids=[...base,...(bag?[bag.id]:[]),...(shoe?[shoe.id]:[])];
  if(temperature!==null&&temperature<18&&coat)ids.unshift(coat.id);
  const first=usable.find(c=>c.id===base[0]);
  add(`${first.name.replace(/衬衫|针织衫|连衣裙/,'')}的${occasion==='日常'?'松弛日常':occasion+'时光'}`,layout(ids),temperature!==null&&temperature<18?'早晚偏凉，出门记得添一件外套。':occasion==='通勤'?'从自己的衣橱里，找到轻松出门的一套。':'喜欢的单品搭在一起，就是你的日常风格。','rec-'+ids.join('-'));
  count++;
 }
 const recent=new Set(Object.values(data.plans).filter(p=>p.worn&&p.date>=shiftDate(localDate(),-3)).flatMap(p=>p.items.map(i=>i.id)));
 const score=o=>(o.occasion===occasion?4:0)-o.items.filter(i=>recent.has(i.id)).length+((occasion==='通勤'&&o.items.some(i=>data.clothes.find(c=>c.id===i.id)?.kind==='shirt'))?2:0);
 return candidates.sort((a,b)=>score(b)-score(a));
}
export function validateBackup(raw){
 if(!raw||raw.schema!==1||!Array.isArray(raw.clothes)||!Array.isArray(raw.outfits)||!raw.plans||typeof raw.plans!=='object'||Array.isArray(raw.plans))throw new Error('这不是有效的衣间备份文件。');
 if(raw.clothes.length>500||raw.outfits.length>1000||Object.keys(raw.plans).length>10000)throw new Error('备份内容过多，暂不支持导入。');
 const ids=new Set();
 const clothes=raw.clothes.map(c=>{
  if(!c||typeof c.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||!categories.includes(c.category)||!Object.hasOwn(statuses,c.status)||typeof c.image!=='string'||c.image.length>6000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(c.image))throw new Error('备份中的衣服数据不完整或格式不受支持。');
  const subcategory=c.subcategory??'未细分';
  if(subcategory!=='未细分'&&!subcategories[c.category].includes(subcategory))throw new Error('备份中的细分类与衣服分类不匹配。');
  if(c.notes!==undefined&&(typeof c.notes!=='string'||c.notes.length>500))throw new Error('衣服备注必须是 500 字以内的文字。');
  ids.add(c.id);return {id:c.id,name:c.name.slice(0,40),category:c.category,subcategory,notes:c.notes||'',status:c.status,image:c.image,color:/^#[\da-f]{6}$/i.test(c.color)?c.color:'#a3ad92',meta:String(c.meta||'四季').slice(0,60),sample:c.sample===true,kind:typeof c.kind==='string'?c.kind.slice(0,20):'',createdAt:Number(c.createdAt)||Date.now()};
 });
 const validItems=items=>{
  if(!Array.isArray(items)||items.length>24)throw new Error('备份中的搭配格式不正确。');const used=new Set();
  return items.map(i=>{if(!i||!ids.has(i.id)||used.has(i.id)||![i.x,i.y,i.scale,i.rotation].every(Number.isFinite)||i.scale<.3||i.scale>2||i.x<0||i.x>100||i.y<0||i.y>100||Math.abs(i.rotation)>180)throw new Error('搭配中存在无效衣服或位置。');used.add(i.id);return {id:i.id,x:i.x,y:i.y,scale:i.scale,rotation:i.rotation}});
 };
 const validModelPhoto=photo=>{if(photo===undefined||photo===null)return null;if(typeof photo!=='string'||photo.length>3000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))throw new Error('穿搭模特图格式无效。');return photo};
 const outfitIds=new Set();const outfits=raw.outfits.map(o=>{if(!o||typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(o.id)||outfitIds.has(o.id)||typeof o.name!=='string')throw new Error('穿搭名称或编号无效。');outfitIds.add(o.id);return {id:o.id,name:o.name.slice(0,40),occasion:['日常','通勤','约会','户外'].includes(o.occasion)?o.occasion:'日常',items:validItems(o.items),modelPhoto:validModelPhoto(o.modelPhoto),createdAt:Number(o.createdAt)||Date.now(),updatedAt:Number(o.updatedAt)||Date.now()}});
 const plans={};for(const [key,p]of Object.entries(raw.plans)){if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||localDate(dateFromKey(key))!==key||!p||typeof p.name!=='string')throw new Error('穿搭日历日期不正确。');plans[key]={date:key,name:p.name.slice(0,40),items:validItems(p.items),modelPhoto:validModelPhoto(p.modelPhoto),worn:p.worn===true,outfitId:typeof p.outfitId==='string'?p.outfitId:null}}
 const backgroundColor=raw.settings?.backgroundColor??'#fbfaf7',backgroundImage=raw.settings?.backgroundImage??null;
 if(typeof backgroundColor!=='string'||!/^#[0-9a-f]{6}$/i.test(backgroundColor)||backgroundImage!==null&&(typeof backgroundImage!=='string'||backgroundImage.length>3000000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(backgroundImage)))throw new Error('备份中的背景设置无效。');
 const temperature=raw.settings?.temperature;const settings={city:String(raw.settings?.city||'').slice(0,30),temperature:typeof temperature==='number'&&Number.isFinite(temperature)&&temperature>=-30&&temperature<=50?temperature:null,weather:['晴','阴','雨'].includes(raw.settings?.weather)?raw.settings.weather:'晴',onboarded:true,backupAt:raw.settings?.backupAt||null,backgroundColor,backgroundImage};
 const draft={id:null,name:'我的穿搭',occasion:'日常',items:[],modelPhoto:null,dirty:false};return {schema:1,clothes,outfits,plans,draft,settings,updatedAt:Date.now()};
}
