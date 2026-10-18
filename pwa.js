export const APP_VERSION='1.4.3';
let registration=null;
let registrationError=false;
let applyingUpdate=false;
let notify=()=>{};

export function isStandalone(){return !!navigator.standalone||window.matchMedia('(display-mode: standalone)').matches}

export function pwaStatus(){
 if(!window.isSecureContext)return '需要 HTTPS 地址才能离线安装';
 if(!('serviceWorker' in navigator))return '当前浏览器不支持离线缓存';
 if(registrationError)return '离线准备失败，请联网重试';
 if(registration?.waiting)return '新版已下载，可更新';
 if(registration?.installing)return '正在准备离线资源…';
 if(navigator.serviceWorker.controller)return '离线已就绪';
 return '正在准备离线资源…';
}

function watchWorker(worker){
 worker?.addEventListener('statechange',()=>{
  notify();
  if(worker.state==='installed')setTimeout(notify,0);
 });
}

export async function setupPwa(onChange){
 notify=onChange;
 if(!window.isSecureContext||!('serviceWorker' in navigator)){notify();return}
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(applyingUpdate)window.location.reload();else notify();
 });
 try{
  registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  registrationError=false;
  registration.addEventListener('updatefound',()=>{watchWorker(registration.installing);notify()});
  watchWorker(registration.installing);
  notify();
 }catch{registrationError=true;notify()}
}

export async function checkPwaUpdate(){
 if(!navigator.onLine)throw new Error('当前离线，请联网后再检查更新。');
 if(!registration)await setupPwa(notify);
 if(!registration)throw new Error(pwaStatus());
 await registration.update();
 return registration.waiting?'新版已下载，点击「应用更新」即可使用。':registration.installing?'正在下载新版，请稍后查看离线状态。':'已检查更新，目前没有待安装的新版本。';
}

export function applyPwaUpdate(){
 if(!registration?.waiting)return false;
 applyingUpdate=true;
 registration.waiting.postMessage({type:'SKIP_WAITING'});
 return true;
}

export function hasPwaUpdate(){return !!registration?.waiting}
