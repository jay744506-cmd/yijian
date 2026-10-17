import {mergeWardrobe} from './merge.js?v=1.5';
const DATABASE = 'yijian-personal-wardrobe';
let baseline;
let connection;
function open(){
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('data');
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('请关闭其他衣间页面，再重新打开。'));
  });
  return connection;
}
export async function load(){const db=await open();return new Promise((resolve,reject)=>{const req=db.transaction('data').objectStore('data').get('wardrobe');req.onsuccess=()=>{baseline=structuredClone(req.result);resolve(req.result)};req.onerror=()=>reject(req.error)})}
export async function store(data){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite'),table=tx.objectStore('data'),req=table.get('wardrobe');let merged;req.onsuccess=()=>{merged=mergeWardrobe(baseline,data,req.result);table.put(merged,'wardrobe')};tx.oncomplete=()=>{baseline=structuredClone(data);resolve(merged)};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存被中断'))})}
