const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Apply only this tab's changes to the latest snapshot, preserving other tabs' additions.
export function mergeWardrobe(base,local,remote){
 if(!base||!remote)return structuredClone(local);
 const merged={...remote};
 delete merged.aiResults;
 for(const field of Object.keys(local)){
  if(['clothes','outfits'].includes(field)){
   const key='id',before=new Map((base[field]||[]).map(v=>[v[key],v])),next=new Map((local[field]||[]).map(v=>[v[key],v])),values=new Map((remote[field]||[]).map(v=>[v[key],v]));
   for(const id of before.keys())if(!next.has(id))values.delete(id);
   for(const [id,value]of next)if(!same(value,before.get(id)))values.set(id,value);
   merged[field]=[...values.values()];
  }else if(['plans','settings'].includes(field)){
   merged[field]={...remote[field]};
   for(const key of new Set([...Object.keys(base[field]||{}),...Object.keys(local[field]||{})]))if(!same(base[field]?.[key],local[field]?.[key])){
    if(Object.hasOwn(local[field]||{},key))merged[field][key]=local[field][key];else delete merged[field][key];
   }
  }else if(!same(base[field],local[field]))merged[field]=local[field];
 }
 return structuredClone(merged);
}
