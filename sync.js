// Shared, single-person sync. This module contains no credential or user identity.
export const STATE_KEY = 'word-learning-v1';
export const BACKUP_KEY = 'word-learning-before-cloud-v1';
export const DEVICE_KEY = 'word-learning-device-v1';
export const KEY_KEY = 'word-learning-sync-key-v1';
export const clone = value => JSON.parse(JSON.stringify(value));
export const stable = value => JSON.stringify(order(value));
function order(value) { return Array.isArray(value) ? value.map(order) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, order(value[k])])) : value; }
export function newId() { return globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2); }
const unique = values => [...new Set(values)].sort();
function unionObjects(a=[],b=[],key=x=>x.id||stable(x)) {
 const map=new Map();for(const v of [...a,...b]){const k=key(v),old=map.get(k);if(!old||stable(v)>stable(old))map.set(k,clone(v));}return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v);
}
export function normalizeHistory(item) {
 const counts=new Map();item.history=(item.history||[]).map(h=>{if(h.id)return h;const k=h.at+'|'+h.rating,n=(counts.get(k)||0)+1;counts.set(k,n);return {...h,id:'legacy:'+k+'|'+n};});
 const last=item.history.filter(h=>h.at===item.lastReview&&(!item.lastRating||h.rating===item.lastRating)).at(-1);
 if(last&&!item.lastReviewEventId)item.lastReviewEventId=last.id;
 if(last&&!last.schedule)last.schedule={stage:item.stage,due:item.due,lastRating:item.lastRating||last.rating,lastReview:item.lastReview,lastReviewEventId:last.id,learningStatus:item.learningStatus};
 item.removedReviewIds=unique(item.removedReviewIds||[]);return item;
}
function newer(a,b,field,secondary='') {
 const tie=x=>field==='reviewUpdatedAt'?stable({stage:x.stage,due:x.due,lastRating:x.lastRating,lastReview:x.lastReview,learningStatus:x.learningStatus}):stable({meaning:x.meaning,originalMeaning:x.originalMeaning});
 const ka=[Date.parse(a[field]||(field==='reviewUpdatedAt'?a.lastReview:null))||0,String(a[secondary]||''),tie(a)],kb=[Date.parse(b[field]||(field==='reviewUpdatedAt'?b.lastReview:null))||0,String(b[secondary]||''),tie(b)];
 for(let i=0;i<ka.length;i++)if(ka[i]!==kb[i])return ka[i]>kb[i]?a:b;return a;
}
function mergeItem(a,b) {
 const virgin=x=>x.importOrigin&&!x.lastReview&&!(x.history||[]).length&&!x.reviewUpdatedAt&&!x.meaningUpdatedAt;
 if(virgin(a)&&!b.importOrigin)return clone(b);
 if(virgin(b)&&!a.importOrigin)return clone(a);
 const schedule=newer(a,b,'reviewUpdatedAt','reviewRevision'),content=newer(a,b,'meaningUpdatedAt');
 const removedReviewIds=unique([...(a.removedReviewIds||[]),...(b.removedReviewIds||[])]),removed=new Set(removedReviewIds);
 const history=unionObjects(a.history,b.history).filter(h=>!removed.has(h.id)).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 const created=[a.createdAt,b.createdAt].filter(Boolean).sort()[0];
 // An offline undo may arrive before another device's earlier review. Project the
 // last surviving event instead of allowing the undo snapshot to hide that review.
 const bases=[a.reviewBase,b.reviewBase].filter(Boolean).sort((x,y)=>(Date.parse(x.lastReview)||0)-(Date.parse(y.lastReview)||0)||stable(x).localeCompare(stable(y)));
 const reviewBase=bases[0];
 const last=history.at(-1),canceled=schedule.lastReviewEventId?removed.has(schedule.lastReviewEventId):Boolean(schedule.lastReview&&!history.some(h=>h.at===schedule.lastReview));
 let projected=last?.schedule&&(Date.parse(last.at)>(Date.parse(schedule.lastReview)||0)||canceled)?last.schedule:null;
 if(!projected&&canceled)projected=reviewBase||{stage:0,due:null,lastReview:null,lastReviewEventId:null,lastRating:null,learningStatus:'initial'};
 return {...clone(schedule),...(projected?clone(projected):{}),...(reviewBase?{reviewBase:clone(reviewBase)}:{}),meaning:content.meaning,originalMeaning:content.originalMeaning,meaningUpdatedAt:content.meaningUpdatedAt,
  contentHistory:unionObjects(a.contentHistory,b.contentHistory).concat(a.meaning!==b.meaning?[{meaning:a.meaning,at:a.meaningUpdatedAt||null},{meaning:b.meaning,at:b.meaningUpdatedAt||null}]:[]).filter((x,i,all)=>all.findIndex(y=>stable(x)===stable(y))===i).sort((a,b)=>stable(a).localeCompare(stable(b))),
  lists:unique([...(a.lists||[a.studyDay]),...(b.lists||[b.studyDay])].filter(Boolean)),studyDay:[a.studyDay,b.studyDay].filter(Boolean).sort()[0],...(created?{createdAt:created}:{}),history,removedReviewIds};
}
const refArrays=new Set(['studied','pending','reviewed','reviewIds','retried','waiting','ids']);
function remap(value,aliases,key='') {
 if(typeof value==='string')return (key==='id'||key==='currentId'||refArrays.has(key))?(aliases.get(value)||value):value;
 if(Array.isArray(value)){const result=value.map(x=>remap(x,aliases,key));return ['waiting','pending','studied'].includes(key)?[...new Set(result)]:result;}
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remap(v,aliases,k)]));return value;
}
function dominates(a,b) { const keys=unique([...Object.keys(a),...Object.keys(b)]);return keys.every(k=>(a[k]||0)>=(b[k]||0))&&keys.some(k=>(a[k]||0)>(b[k]||0)); }
export function taskValue(state) {return clone({sessions:state.sessions,activeSession:state.activeSession||'learning',workspaceView:state.workspaceView||'home',...(state.addReturn?{addReturn:state.addReturn}:{})});}
export function captureTask(state,actor) {
 state.cloud||={format:1,tasks:[],selected:null};
 const value=taskValue(state),old=state.cloud.tasks.find(x=>x.id===state.cloud.selected);
 if(old&&stable(old.value)===stable(value))return;
 if(!old&&!state.items.length&&!Object.values(state.sessions||{}).some(f=>f.draft||f.lookupDraft||f.typedQuery||f.intake?.length||f.waiting?.length||f.pending?.length||f.recapQueue?.length||f.draftQueue?.length||f.phase==='review'))return;
 if(state.cloud.tasks.some(x=>x.id!==old?.id&&(x.clock[actor]||0)>=(old?.clock?.[actor]||0)+1))actor=actor+'-'+newId();
 const clock={...(old?.clock||{})};clock[actor]=(clock[actor]||0)+1;
 const next={id:actor+':'+clock[actor],clock,value,at:new Date().toISOString()};
 state.cloud.tasks=state.cloud.tasks.filter(x=>!dominates(clock,x.clock));state.cloud.tasks.push(next);state.cloud.selected=next.id;
}
export function restoreTask(state,id) {
 const task=state.cloud.tasks.find(x=>x.id===id);if(!task)return false;
 Object.assign(state,clone(task.value));if(!task.value.addReturn)delete state.addReturn;state.flow=state.sessions[state.activeSession==='due'?'due':'learning'];state.cloud.selected=id;return true;
}
const senseKey = x => x.word.trim().toLowerCase().replace(/\s+/g,' ')+'\0'+x.meaning.trim();
// Receipts travel with the private document. Replaying a command cannot recreate
// an edited sense, reset learning, or count an existing sense as newly added.
export function applyImports(state,commands=[]) {
 state.importReceipts||=[];
 for(const command of commands){
  if(state.importReceipts.some(r=>r.id===command.id))continue;
  if(typeof command.id!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(command.studyDay)||!Number.isFinite(Date.parse(command.requestedAt))||!Array.isArray(command.items)||command.items.length>1000)throw Error('无效的待学导入');
  const bindings=[];
  for(const source of command.items){
   const importId='import:'+command.id+':'+source.id;
   let item=state.items.find(x=>x.id===importId)||state.items.find(x=>senseKey(x)===senseKey(source));
   if(!item){
    const id=importId;
    item={...clone(source),id,importOrigin:command.id,studyDay:command.studyDay,createdAt:command.requestedAt,lists:[command.studyDay],stage:0,due:null,history:[],learningStatus:'waiting'};
    state.items.push(item);
   }
   bindings.push({sourceId:source.id,itemId:item.id,word:source.word,meaning:source.meaning});
  }
  state.importReceipts.push({id:command.id,bindings});
 }
 return state;
}
function reconcileImports(a,b) {
 const receipts=new Map();
 for(const r of [...(a.importReceipts||[]),...(b.importReceipts||[])]){
  const old=receipts.get(r.id);receipts.set(r.id,{id:r.id,bindings:unionObjects(old?.bindings,r.bindings,x=>stable(x))});
 }
 const aliases=new Map();
 for(const receipt of receipts.values())for(const binding of receipt.bindings){
  const candidates=[a,b].flatMap(s=>s.items.filter(x=>senseKey(x)===senseKey(binding)||(x.id===binding.itemId&&(x.importOrigin===receipt.id||(s.importReceipts||[]).some(r=>r.id===receipt.id&&r.bindings.some(v=>v.sourceId===binding.sourceId&&v.itemId===x.id))))));
  const ids=unique(candidates.map(x=>x.id));
  // Prefer an already-existing personal ID over the dictionary/import ID.
  ids.sort((x,y)=>Number(x===binding.sourceId||x.startsWith('import:'))-Number(y===binding.sourceId||y.startsWith('import:'))||x.localeCompare(y));
  if(ids.length)for(const id of ids)aliases.set(id,ids[0]);
 }
 const resolve=id=>{const seen=new Set();while(aliases.has(id)&&aliases.get(id)!==id&&!seen.has(id)){seen.add(id);id=aliases.get(id);}return id;};
 for(const [id] of aliases)aliases.set(id,resolve(id));
 for(const s of [a,b]){
  s.items=s.items.map(x=>({...x,id:aliases.get(x.id)||x.id}));
  s.sessions=remap(s.sessions,aliases);s.flow=remap(s.flow,aliases);s.completedGroups=remap(s.completedGroups,aliases);
  if(s.cloud)s.cloud.tasks=s.cloud.tasks.map(x=>({...x,value:remap(x.value,aliases)}));
 }
 return [...receipts.values()].map(r=>({...r,bindings:unionObjects([],r.bindings.map(x=>({...x,itemId:aliases.get(x.itemId)||x.itemId})),x=>stable(x))})).sort((a,b)=>a.id.localeCompare(b.id));
}
export function mergeCloud(local,remote) {
 const a=clone(local),b=clone(remote||{version:1,items:[]});a.items.forEach(normalizeHistory);b.items.forEach(normalizeHistory);
 // Old independent browsers may reuse dictionary IDs for different meanings.
 // Split only unversioned content conflicts; explicit later edits remain versioned.
 const groups=new Map();for(const item of [...a.items,...b.items]){const k=item.cloudOriginId||item.id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);}
 for(const [origin,items] of groups){
  if(!items.some(x=>x.cloudOriginId)&& (new Set(items.map(x=>x.meaning)).size<2||items.some(x=>x.meaningUpdatedAt)))continue;
  for(const s of [a,b]){const aliases=new Map();for(const item of s.items.filter(x=>(x.cloudOriginId||x.id)===origin)){
   let discriminator=item.cloudMeaningKey;
   if(!discriminator&&item.cloudOriginId){try{discriminator=decodeURIComponent(item.id.slice((origin+'~sense~').length));}catch{discriminator=item.meaning;}}
   discriminator||=item.meaning;
   const id=item.cloudOriginId?item.id:origin+'~sense~'+encodeURIComponent(discriminator);aliases.set(item.id,id);item.cloudOriginId=origin;item.cloudMeaningKey=discriminator;item.id=id;
  }if(aliases.size){s.importReceipts=(s.importReceipts||[]).map(r=>({...r,bindings:r.bindings.map(x=>({...x,itemId:aliases.get(x.itemId)||x.itemId}))}));s.sessions=remap(s.sessions,aliases);s.flow=remap(s.flow,aliases);s.completedGroups=remap(s.completedGroups,aliases);if(s.cloud)s.cloud.tasks=s.cloud.tasks.map(x=>({...x,value:remap(x.value,aliases)}));}}
 }
 const importReceipts=reconcileImports(a,b);
 const map=new Map();for(const item of [...b.items,...a.items])map.set(item.id,map.has(item.id)?mergeItem(item,map.get(item.id)):item);
 const tasks=unionObjects(a.cloud?.tasks,b.cloud?.tasks).filter((x,_,all)=>!all.some(y=>dominates(y.clock,x.clock)));
 const removedGroupIds=unique([...(a.removedGroupIds||[]),...(b.removedGroupIds||[])]);
 const result={...a,importReceipts,items:[...map.values()].sort((a,b)=>a.id.localeCompare(b.id)),completedGroups:unionObjects(a.completedGroups,b.completedGroups).filter(x=>!removedGroupIds.includes(x.id)),removedGroupIds,
  cloud:{format:1,tasks,selected:tasks.some(x=>x.id===a.cloud?.selected)?a.cloud.selected:tasks.at(-1)?.id||null}};
 if(result.cloud.selected&&result.cloud.selected!==a.cloud?.selected)restoreTask(result,result.cloud.selected);return result;
}
export function cloudDocument(state) {
 // Browser settings and access key never leave their dedicated local keys.
 const result={version:1,items:state.items,importReceipts:state.importReceipts||[],completedGroups:state.completedGroups||[],removedGroupIds:state.removedGroupIds||[],cloud:{format:1,tasks:state.cloud?.tasks||[],selected:null}};
 return clone(result);
}
export function createSync({storage,base,getState,applyState,onStatus=()=>{},fetcher=globalThis.fetch,setTimer=setTimeout,clearTimer=clearTimeout,actor=newId(),now=Date.now,requestTimeout=20000,isVisible=()=>globalThis.document?.visibilityState!=='hidden',pollInterval=120000}) {
 let busy=false,timer=null,retry=1000,stopped=false,ready=false,key='',device='',original='',migration=false,cooldownUntil=0,retryUntil=0,nextPollAt=0,acknowledged=null,dirty=false;
 const status=(text,kind='pending')=>onStatus(text,kind);
 if(!/^https:\/\//.test(base)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)){onStatus('同步地址必须使用 HTTPS。','error');return {ready:false,capture(){},saved(){},visibilityChanged(){},run:async()=>{},start(){},unlock(){throw Error('同步地址不安全');}};}
 const read=()=>{const raw=storage.getItem(STATE_KEY);return raw?JSON.parse(raw):{version:1,items:[]};};
 try {
  const raw=storage.getItem(STATE_KEY);original=storage.getItem(BACKUP_KEY);
  if(original===null){original=raw||JSON.stringify({version:1,items:[]});storage.setItem(BACKUP_KEY,original);if(storage.getItem(BACKUP_KEY)!==original)throw Error('backup');}
  device=storage.getItem(DEVICE_KEY)||newId();storage.setItem(DEVICE_KEY,device);
  key=storage.getItem(KEY_KEY)||'';migration=storage.getItem('word-learning-migrated-v1')==='yes';ready=true;
  getState().items.forEach(normalizeHistory);captureTask(getState(),actor);
 } catch {status('无法保留升级前备份，云同步未启动。请先导出备份。','error');}
 function persist(state) {
  if(stable(state)!==stable(getState()))applyState(state);
  const current=getState();if(stable(read())!==stable(current))storage.setItem(STATE_KEY,JSON.stringify(current));
 }
 function capture() {if(!ready)return;captureTask(getState(),actor);}
 function schedule(delay=500) {if(!ready||stopped||!key)return;clearTimer(timer);if(!isVisible()&&!dirty)return;timer=setTimer(()=>void run({automatic:true}),Math.max(delay,cooldownUntil-now(),retryUntil-now()));}
 function saved() {if(!ready)return;capture();dirty=acknowledged!==stable(cloudDocument(getState()));if(dirty)schedule();if(!key)status('记录已保存在本机；填写同步口令后自动合并旧记录。','locked');}
 async function request(method,body) {
  const issuedKey=key,controller=new AbortController();let timeout;
  const expired=new Promise((_,reject)=>{timeout=globalThis.setTimeout(()=>{controller.abort();const error=Error('同步超时');error.name='TimeoutError';reject(error);},requestTimeout);});
  try {
  const response=await Promise.race([fetcher(base+'/api/sync',{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Sync-Version':'1','X-Device-Id':device},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:controller.signal}),expired]);
  if(issuedKey!==key)throw Error('同步口令已更新，正在重新连接…');
  if([401,403].includes(response.status)){stopped=true;throw Error('同步口令无效或已更换；本机记录仍保留，请重新填写口令。');}
  if(response.status===429){const seconds=Number(response.headers.get('Retry-After'));const wait=Number.isFinite(seconds)&&seconds>0?Math.min(seconds,900):900;cooldownUntil=now()+wait*1000;throw Error('口令尝试次数过多，约'+Math.ceil(wait/60)+'分钟后自动重试；所有设备暂缓同步，本机记录仍保留，可继续学习。');}
  if(response.status===426){stopped=true;throw Error('请刷新页面以继续同步；本机和云端记录均保留。');}
  let data;try{data=await Promise.race([response.json(),expired]);}catch(error){if(error.name==='TimeoutError'||error.name==='AbortError')throw error;throw Error('服务器响应异常');}
  if(issuedKey!==key)throw Error('同步口令已更新，正在重新连接…');
  if(response.status===503){throw Error(data.error==='sync_not_configured'?'云端同步尚未配置；本机记录仍保留。':'云端暂时不可用；本机记录仍保留，将自动重试。');}
  if(!response.ok&&response.status!==409)throw Error(response.status===413?'记录超出当前同步容量；本机和云端原记录均保留，请导出备份。':'同步暂时失败，本机记录仍保留。');
  if(data.protocol!==1||!Number.isSafeInteger(data.revision)||data.revision<0||data.state?.version!==1||data.state.cloud?.format!==1||!Array.isArray(data.state.items)||!Array.isArray(data.state.cloud.tasks))throw Error('云端格式尚不兼容，本机记录仍保留。');
  return {data,conflict:response.status===409};
  }finally{globalThis.clearTimeout(timeout);}
 }
 async function run({automatic=false}={}) {
  if(!ready||!key||busy||stopped)return;
  if(automatic&&!isVisible()&&!dirty){clearTimer(timer);return;}
  if(automatic&&acknowledged===stable(cloudDocument(getState()))&&now()<nextPollAt){schedule(nextPollAt-now());return;}
  if(now()<cooldownUntil||(automatic&&now()<retryUntil)){schedule();return;}busy=true;clearTimer(timer);status('正在同步，学习可继续…');
  try {
   capture();const latest=read();const local=mergeCloud(getState(),latest);persist(local);
   let {data}=await request('GET');migration=Boolean(data.migrated);let settled=false;
   // CAS retries always re-merge the latest local edits; responses never replace them.
   for(let attempt=0;attempt<4;attempt++){
    capture();const merged=applyImports(mergeCloud(getState(),data.state),data.imports);persist(merged);capture();
    const outgoing=cloudDocument(getState());
    if(data.migrated&&stable(outgoing)===stable(data.state)){migration=true;settled=true;break;}
    const body={protocol:1,baseRevision:data.revision,operationId:newId(),state:outgoing,...(!migration?{migration:{deviceId:device,original}}:{})};
    const result=await request('PUT',body);data=result.data;
    if(result.conflict)continue;
    migration=true;settled=true;capture();persist(mergeCloud(getState(),data.state));break;
   }
   if(!settled)throw Error('另一台设备正在更新，稍后会继续合并。');
   if(storage.getItem('word-learning-migrated-v1')!=='yes')storage.setItem('word-learning-migrated-v1','yes');retry=1000;cooldownUntil=0;retryUntil=0;acknowledged=stable(data.state);dirty=stable(cloudDocument(getState()))!==acknowledged;
   // Edits while a request was in flight need a subsequent upload.
   if(stable(cloudDocument(getState()))!==stable(data.state)){status('新记录待同步…');schedule(300);}else{status('已同步 · 所有设备共用一份记录','ok');nextPollAt=now()+pollInterval;schedule(pollInterval);}
  } catch(error) {nextPollAt=0;retryUntil=now()+retry;status(error.name==='TimeoutError'||error.name==='AbortError'?'同步超时，记录已保存在本机，稍后自动重试。':error.message||'离线中，记录已保存在本机，联网后自动重试。','error');schedule(retry);retry=Math.min(retry*2,60000);}
  finally{busy=false;}
 }
 return {capture,saved,run,visibilityChanged(){if(!isVisible()&&!dirty)clearTimer(timer);else void run({automatic:true});},start(){if(key)schedule(0);else status('记录已保存在本机；填写同步口令后自动合并旧记录。','locked');},
  unlock(value,remember=true){if(!ready)throw Error('本机备份尚未成功，请先导出备份。');if(!/^[A-Za-z0-9_-]{6,128}$/.test(value))throw Error('请填写6–128位的专用同步口令（字母、数字、- 或 _）。');key=value;acknowledged=null;nextPollAt=0;retryUntil=0;retry=1000;if(remember)storage.setItem(KEY_KEY,key);else storage.removeItem?.(KEY_KEY);stopped=false;schedule(0);},
  stop(){stopped=true;clearTimer(timer);},get ready(){return ready;},get actor(){return actor;}};
}
