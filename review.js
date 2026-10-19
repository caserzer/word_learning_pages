// Review v2: immutable evidence lives in the existing mergeable history log.
import {newId,normalizeHistory} from './sync.js?v=4fd3277138bdb577';
import {getUseQuestion} from './review-content.js?v=6ce6a947486b19f4';
export const MODES={integrated:'综合复习',meaning:'看英文想词义',listening:'听音想词义',spelling:'看词义拼写',dictation:'听音默写',use:'词组填空'};
export const SKILLS={meaning:'词义',listening:'听辨',spelling:'拼写',use:'用法'};
export const skillFor=mode=>({dictation:'spelling',listening:'listening',meaning:'meaning',spelling:'spelling',use:'use'})[mode];
export const reviewDay=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const copy=x=>JSON.parse(JSON.stringify(x));
const onDay=at=>at&&Number.isFinite(Date.parse(at))?reviewDay(new Date(at)):'';
export const normalizeAnswer=value=>String(value).trim().replace(/\s+/g,' ');
export function matchesAnswer(value,answers){return answers.some(answer=>normalizeAnswer(value)===normalizeAnswer(answer));}
export function evidence(item,skill,now=new Date()){
 const removed=new Set(item.removedReviewIds||[]);
 const events=(item.history||[]).filter(e=>e.evidenceVersion===2&&e.skill===skill&&!removed.has(e.id)).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 let streak=0,lastDay='',due=null,last=null,weak=false;const successfulDays=new Set();
 for(const e of events){
  if(e.outcome==='skip')continue;last=e;
  if(e.independent&&e.outcome==='correct'&&!successfulDays.has(onDay(e.at))){successfulDays.add(onDay(e.at));weak=false;streak++;lastDay=onDay(e.at);due=new Date(Date.parse(e.at)+[1,3,7,14,30,60,120][Math.min(streak-1,6)]*86400000).toISOString();}
  else if(['wrong','hinted'].includes(e.outcome)||e.selfRating==='forgot'||e.hints?.length){weak=true;streak=0;due=new Date(Date.parse(e.at)+86400000).toISOString();}
  else if(e.outcome==='self-rated'){weak=false;due=new Date(Date.parse(e.at)+86400000).toISOString();}
 }
 return {skill,events,last,weak,streak,lastDay,due,overdue:due?Date.parse(due)<=+now:true,independentDays:successfulDays.size};
}
export function availableModes(item){return ['meaning','listening','spelling','dictation',...(getUseQuestion(item)?['use']:[])];}
export function chooseMode(item,now=new Date()){
 const modes=['meaning','listening','spelling',...(getUseQuestion(item)?['use']:[])];
 // Unknown skills first, then overdue / recently wrong, then smallest independent streak.
 const chosen=modes.map((mode,index)=>{const e=evidence(item,skillFor(mode),now);return {mode,index,e};}).sort((a,b)=>Number(Boolean(a.e.last))-Number(Boolean(b.e.last))||Number(!a.e.overdue)-Number(!b.e.overdue)||a.e.streak-b.e.streak||String(a.e.last?.at||'').localeCompare(b.e.last?.at||'')||a.index-b.index)[0];
 return chosen.mode==='spelling'&&chosen.e.last?.mode==='spelling'?'dictation':chosen.mode;
}
export function filterReviewItems(items,filters={},now=new Date()){
 const today=reviewDay(now),q=(filters.query||'').trim().toLowerCase();
 return items.filter(item=>{
  const added=onDay(item.createdAt)||item.studyDay||'',dates=(item.history||[]).filter(e=>e.outcome!=='skip').map(e=>onDay(e.at)).filter(Boolean);
  const due=Date.parse(item.due)<=+now;
  const hasEvidence=(item.history||[]).some(e=>e.evidenceVersion===2&&e.outcome!=='skip');
  const weak=Object.keys(SKILLS).some(skill=>evidence(item,skill,now).weak)||!hasEvidence&&['forgot','uncertain'].includes(item.lastRating);
  if(filters.scope==='recommended'&&!due&&!weak&&!Object.keys(SKILLS).some(s=>evidence(item,s,now).last&&evidence(item,s,now).overdue))return false;
  if(filters.scope==='added'&&added!==today)return false;
  if(filters.scope==='practiced'&&!dates.includes(today))return false;
  if(filters.scope==='wrong'&&!weak)return false;
  if(filters.list&&!(item.lists||[]).includes(filters.list)&&item.sourceId!==filters.list)return false;
  if(q&&!`${item.word} ${item.meaning}`.toLowerCase().includes(q))return false;
  const inRange=d=>(!filters.since||d>=filters.since)&&(!filters.until||d<=filters.until);
  if((filters.since||filters.until)&&!(filters.dateType==='practiced'?dates.some(inRange):added&&inRange(added)))return false;
  return true;
 }).sort((a,b)=>(Date.parse(a.due)||Infinity)-(Date.parse(b.due)||Infinity)||a.id.localeCompare(b.id));
}
export function makeQuestion(item,mode,attempt=0){
 if(!availableModes(item).includes(mode))return null;
 return {id:item.id,token:newId(),mode,attempt,input:'',hints:[],revealed:false,result:null,audioPlayed:false};
}
export function startRound(flow,items,{mode='integrated',size=10,scope='recommended'}={},now=new Date()){
 const selected=items.filter(x=>mode!=='use'||getUseQuestion(x)).slice(0,[5,10,20].includes(Number(size))?Number(size):10);
 const queue=selected.map(item=>makeQuestion(item,mode==='integrated'?chooseMode(item,now):mode));
 Object.assign(flow,{reviewVersion:2,sessionId:newId(),phase:queue.length?'review':'finished',reviewKind:'multimode',reviewIds:selected.map(x=>x.id),reviewInitialCount:queue.length,position:0,retried:[],queue,mode,scope,startedAt:now.toISOString(),recall:null,undo:null});
 return queue.length;
}
export const currentQuestion=flow=>flow.reviewVersion===2?flow.queue?.[flow.position]:null;
export function addHint(flow,kind){const q=currentQuestion(flow);if(q&&!q.result&&!q.hints.includes(kind))q.hints.push(kind);}
export function submitQuestion(state,flow,result,now=new Date()){
 const q=currentQuestion(flow),item=state.items.find(x=>x.id===q?.id);if(!q||!item||q.result)return false;
 normalizeHistory(item);if(item.removedReviewIds.includes(q.token))q.token=newId();if(item.history.some(e=>e.id===q.token)){q.result=item.history.find(e=>e.id===q.token);return false;}
 const typed=['spelling','dictation','use'].includes(q.mode),answers=q.mode==='use'?getUseQuestion(item)?.answers:[item.word];
 if(result==='submit'&&(!typed||!q.input.trim()||!answers))return false;
 if(!['submit','remember','forgot','skip'].includes(result))return false;
 if(['listening','dictation'].includes(q.mode)&&!q.audioPlayed&&result!=='skip')return false;
 const raw=result==='submit'?(matchesAnswer(q.input,answers)?'correct':'wrong'):result==='skip'?'skip':'self-rated';
 const outcome=raw==='correct'&&q.hints.length?'hinted':raw;
 const before=copy(flow);delete before.undo;
 const schedule=Object.fromEntries(['learningStatus','stage','due','lastRating','lastReview','lastReviewEventId','reviewUpdatedAt','history'].map(k=>[k,item[k]??null]));schedule.history=copy(item.history||[]);
 const skill=skillFor(q.mode),prior=item.history.filter(e=>e.evidenceVersion===2&&e.skill===skill&&e.outcome!=='skip');
 const independent=raw==='correct'&&!q.hints.length&&q.attempt===0&&!prior.some(e=>e.sessionId===flow.sessionId||onDay(e.at)===reviewDay(now));
 const event={id:q.token,at:now.toISOString(),rating:outcome==='correct'||result==='remember'?'remember':outcome==='wrong'||result==='forgot'?'forgot':'uncertain',evidenceVersion:2,mode:q.mode,skill,outcome,independent,hints:[...q.hints],attempt:q.attempt,sessionId:flow.sessionId,...(!typed&&result!=='skip'?{selfRating:result}:{}),...(typed?{input:q.input}:{})};
 item.reviewBase||=Object.fromEntries(['stage','due','lastRating','lastReview','lastReviewEventId','learningStatus'].map(k=>[k,item[k]??null]));
 item.history.push(event);
 if(outcome!=='skip'){
  if(state.sessions?.learning)state.sessions.learning.waiting=state.sessions.learning.waiting.filter(id=>id!==item.id);
  item.lastReview=event.at;item.lastReviewEventId=event.id;item.lastRating=event.rating;item.learningStatus='scheduled';
  const relevant=['meaning','listening','spelling',...(getUseQuestion(item)?['use']:[])].map(s=>evidence(item,s,now)).filter(e=>e.due);
  item.due=relevant.map(e=>e.due).sort()[0]||new Date(+now+86400000).toISOString();
 }
 const revision=new Date(Math.max(+now,(Date.parse(item.reviewUpdatedAt)||0)+1)).toISOString();item.reviewUpdatedAt=revision;item.reviewRevision=revision+':'+q.token;
 event.schedule=Object.fromEntries(['stage','due','lastRating','lastReview','lastReviewEventId','learningStatus'].map(k=>[k,item[k]??null]));
 q.result=copy(event);q.revealed=true;
 flow.undo={id:item.id,before,schedule,eventId:event.id,expectedRevision:item.reviewRevision};
 return true;
}
export function advanceQuestion(flow,items){
 const q=currentQuestion(flow);if(!q?.result)return false;
 const needsRetry=['wrong','hinted'].includes(q.result.outcome)||q.result.selfRating==='forgot'||q.hints.length>0&&q.result.outcome!=='skip';
 if(needsRetry&&q.attempt<2){
  // Append only when another word separates attempts. A lone weak word is offered
  // in the summary for a later round, never immediately repeated as new evidence.
  const tail=flow.queue.at(-1);
  if(tail?.id!==q.id){const item=items.find(x=>x.id===q.id);if(item)flow.queue.push(makeQuestion(item,q.mode,q.attempt+1));}
 }
 flow.position++;flow.recall=null;
 if(flow.position>=flow.queue.length)flow.phase='finished';
 return true;
}
export function roundSummary(flow){
 const events=(flow.queue||[]).map(q=>q.result).filter(Boolean);
 return {independent:events.filter(e=>e.independent).length,hinted:events.filter(e=>e.hints.length||e.outcome==='hinted').length,wrong:events.filter(e=>e.outcome==='wrong'||e.selfRating==='forgot').length,selfRated:events.filter(e=>e.outcome==='self-rated').length,skipped:events.filter(e=>e.outcome==='skip').length,weakIds:[...new Set((flow.queue||[]).filter(q=>q.result&&(['wrong','hinted'].includes(q.result.outcome)||q.result.selfRating==='forgot'||q.result.hints.length)).map(q=>q.id))],baseDone:Math.min(flow.position,flow.reviewInitialCount),baseTotal:flow.reviewInitialCount,extraDone:Math.max(0,flow.position-flow.reviewInitialCount),extraTotal:Math.max(0,(flow.queue?.length||0)-flow.reviewInitialCount)};
}
