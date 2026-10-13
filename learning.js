export const day = (now=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function loadState(storage) {
 try {
  const s=JSON.parse(storage.getItem('word-learning-v1'));
  if(s?.version===1 && Array.isArray(s.items) && s.items.every(x=>typeof x.id==='string'&&typeof x.word==='string'&&typeof x.meaning==='string')) return s;
 } catch {}
 return {version:1,items:[]};
}
export function addItem(state,item,now=new Date()) {
 const old=state.items.find(x=>x.id===item.id);
 if(old) {old.studyDay=day(now); return false;}
 state.items.push({...item,studyDay:day(now),due:now.toISOString(),stage:0});
 return true;
}
export function rateItem(item,rating,now=new Date()) {
 if(!['remember','uncertain','forgot'].includes(rating)) throw new Error('invalid_rating');
 item.stage=rating==='remember'?Math.min((item.stage||0)+1,3):0;
 const days=rating==='remember'?[1,1,3,7][item.stage]:1;
 item.due=new Date(+now+days*86400000).toISOString();
 item.lastRating=rating;item.lastReview=now.toISOString();
 // Self-report schedules practice; it never sets a mastered flag.
 return rating!=='remember';
}

export function mergeStates(local, remote) {
 const items=new Map(remote.items.map(x=>[x.id,x]));
 for(const item of local.items){
  const other=items.get(item.id);
  if(!other){items.set(item.id,item);continue;}
  const newer=(Date.parse(other.lastReview)||0)>(Date.parse(item.lastReview)||0)?other:item;
  items.set(item.id,{...newer,studyDay:[item.studyDay,other.studyDay].filter(Boolean).sort().at(-1)});
 }
 return {version:1,items:[...items.values()]};
}
