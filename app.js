import {day,loadState,addItem,rateItem,mergeStates} from './learning.js?v=b4b04ed82da234df';
const $=id=>document.getElementById(id);
const base=(window.WORD_LEARNING_CONFIG?.API_BASE_URL||'').replace(/\/$/,'');
let storage;
try { storage=window.localStorage; } catch {}
const state=loadState(storage);
let persisted=true;
let session=[],position=0,retries=new Set(),batch=[],searchVersion=0;
function save(){
 try {
  const latest=loadState(storage);
  const merged=mergeStates(state,latest);
  for(const item of merged.items){const current=state.items.find(x=>x.id===item.id);if(current)Object.assign(current,item);else state.items.push(item);}
  storage.setItem('word-learning-v1',JSON.stringify(state));persisted=true;
  $('storage-warning').hidden=true;
 }catch{persisted=false;$('storage-warning').hidden=false;}
 render();
}
function render(){
 $('count').textContent=`共 ${state.items.length} 个词，今天 ${state.items.filter(x=>x.studyDay===day()).length} 个。`;
 $('queue').replaceChildren(...state.items.map(x=>{const li=document.createElement('li');li.textContent=x.word;return li;}));
}
function start(items){session=[];position=0;$('review').hidden=true;if(!items.length){$('status').textContent='这一组暂时没有要复习的词。';return;}session=[...items];position=0;retries=new Set();$('review').hidden=false;show();$('review').scrollIntoView({behavior:'smooth'});}
function show(){
 if(position>=session.length){$('review').hidden=true;$('status').textContent=persisted?'本轮回顾完成！下次复习日期已记录。':'本轮回顾完成，但未保存，请导出备份。';return;}
 $('review-count').textContent=`${position+1} / ${session.length}`;
 $('prompt').textContent=session[position].word;$('answer').textContent=session[position].meaning;
 $('answer').hidden=true;$('ratings').hidden=true;$('reveal').hidden=false;
}
$('reveal').onclick=()=>{$('answer').hidden=false;$('ratings').hidden=false;$('reveal').hidden=true;};
document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>{
 if($('ratings').hidden)return;
 const item=session[position];const again=rateItem(item,b.dataset.rating);
 if(again&&!retries.has(item.id)){retries.add(item.id);session.push(item);}
 position++;save();show();
});
$('close').onclick=()=>{$('review').hidden=true;session=[];};
$('today').onclick=()=>start(state.items.filter(x=>x.studyDay===day()));
$('due').onclick=()=>start(state.items.filter(x=>Date.parse(x.due)<=Date.now()));
$('export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='word-learning-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
function sourceDetails(item){
 const details=document.createElement('details'),summary=document.createElement('summary');
 summary.textContent='资料来源';details.append(summary);
 const p=document.createElement('p');p.textContent=item.pages?.length?'词表 PDF 第 '+item.pages.join('、')+' 页':'自行录入或免费词典补充';details.append(p);
 if(item.audio){const a=document.createElement('a');a.href=item.audio.descriptionUrl;a.target='_blank';a.rel='noopener';a.textContent=(item.audio.artist||'录音作者')+' · '+item.audio.license;details.append(a);}
 if(item.translationSource){const a=document.createElement('a');a.href=item.translationSource;a.textContent='释义来源：'+(item.translationProvider||'MyMemory');details.append(a);}
 for(const definition of item.definitions||[]){const a=document.createElement('a');a.href=definition.source;a.target='_blank';a.rel='noopener';a.textContent='词义来源 '+(definition.license?.name||'');details.append(a);}
 return details;
}
function addButton(item){
 const add=document.createElement('button');add.textContent='加入今天的学习';
 add.onclick=()=>{const fresh=addItem(state,item);save();add.textContent='已加入';add.disabled=true;if(fresh)batch.push(state.items.find(x=>x.id===item.id));if(batch.length===3){start(batch);batch=[];}};
 return add;
}
function renderCard(item){
 const card=document.createElement('article'),title=document.createElement('h3'),meaning=document.createElement('p');
 title.textContent=item.word;meaning.textContent=item.meaning;card.append(title,meaning);
 // Do not turn experimental CMU mappings into authoritative teaching IPA.
 if(item.ipa&&item.ipaVerified){const p=document.createElement('p');p.textContent=item.ipa;card.append(p);}
 card.append(addButton(item));
 if(item.audio){const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=item.audio.audioUrl;audio.onerror=()=>{$('status').textContent='录音暂时无法播放，请稍后重试。';};card.append(audio);}
 card.append(sourceDetails(item));$('results').append(card);
}
async function renderNewWord(q,version){
 const form=document.createElement('form');form.className='new-word';
 const title=document.createElement('h3');title.textContent='添加新词：'+q;
 const label=document.createElement('label');label.textContent='课本释义（可以自行填写）';
 const meaning=document.createElement('input');meaning.id='new-word-meaning';label.htmlFor=meaning.id;meaning.required=true;meaning.maxLength=500;meaning.placeholder='输入中文意思';
 const info=document.createElement('p');info.textContent='正在补充词义…';
 const spelling=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.required=true;spelling.append(check,document.createTextNode('我已确认这个单词或词组的拼写'));
 const submit=document.createElement('button');submit.textContent='添加到今天';
 const attribution=document.createElement('a');attribution.href='https://mymemory.translated.net/';attribution.target='_blank';attribution.rel='noopener';attribution.textContent='翻译建议来源：MyMemory';const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='资料来源';details.append(summary,attribution);
 form.append(title,label,meaning,info,spelling,submit,details);$('results').prepend(form);
 let enriched={definitions:[],audio:null};
 form.onsubmit=e=>{e.preventDefault();if(!check.checked||!meaning.value.trim())return;
  const item={id:'custom-'+q.toLowerCase().replace(/\s+/g,' '),word:q,meaning:meaning.value.trim(),kind:q.includes(' ')?'phrase':'word',pages:[],audio:enriched.audio,definitions:enriched.definitions,translationSource:enriched.translation?.source||null,translationProvider:enriched.translation?.provider||'MyMemory',verification:'user_confirmed'};
  const fresh=addItem(state,item);save();submit.disabled=true;submit.textContent='已加入';if(fresh)batch.push(state.items.find(x=>x.id===item.id));if(batch.length===3){start(batch);batch=[];}
 };
 try{
  const r=await fetch(base+'/api/lookup?q='+encodeURIComponent(q),{signal:AbortSignal.timeout(6500)});
  if(!r.ok)throw Error();const data=await r.json();if(version!==searchVersion||!form.isConnected)return;
  enriched=data;
  if(data.translation){if(!meaning.value.trim())meaning.value=data.translation.text;info.textContent='已补充中文意思，可以按课本修改。';attribution.href=data.translation.source;attribution.textContent='释义来源：'+(data.translation.provider||'MyMemory');}
  else info.textContent=data.definitions.length?'英文词典释义（点击可采用，也可填课本中文）：':'暂时没有找到释义，填上课本里的意思就可以添加。';
  for(const d of data.definitions){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=d.partOfSpeech+' · '+d.text;b.onclick=()=>{meaning.value='[英文释义] '+d.text;};info.append(b);}
 }catch{if(version===searchVersion)info.textContent='暂时查不到释义，仍可填写课本意思后添加。';}
}
$('search').onsubmit=async e=>{
 e.preventDefault();const version=++searchVersion;const q=$('query').value.trim();if(!q)return;
 const existing=state.items.find(x=>x.word.toLowerCase()===q.toLowerCase());
 if(existing){$('results').replaceChildren();renderCard(existing);$('status').textContent='这是你保存过的词，可以加入今天的复习。';return;}
 $('status').textContent='正在查找…';$('results').replaceChildren();
 try{
  const r=await fetch(base+'/api/vocabulary?q='+encodeURIComponent(q),{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();
  const data=await r.json();if(version!==searchVersion)return;
  const local=state.items.find(x=>x.word.toLowerCase()===q.toLowerCase());
  const items=local?[local,...data.items.filter(x=>x.id!==local.id)]:data.items;
  items.forEach(renderCard);
  const exact=items.some(x=>x.word.toLowerCase()===q.toLowerCase()||x.word==='may / May'&&q.toLowerCase()==='may');
  $('status').textContent=exact?'找到啦，加入今天的学习吧。':'';
  if(!exact&&/^[A-Za-z][A-Za-z '\-]{0,79}$/.test(q))void renderNewWord(q,version);
  else if(!items.length)$('status').textContent='请用英文输入要添加的单词或词组。';
 }catch{
  if(version!==searchVersion)return;
  $('status').textContent='暂时连不上词库，你仍可添加新词。';
  if(/^[A-Za-z][A-Za-z '\-]{0,79}$/.test(q))void renderNewWord(q,version);
 }
};

render();
fetch(base+'/health',{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{$('status').textContent=`准备好了，输入今天的单词吧。`;}).catch(()=>{$('status').textContent='暂时连不上词库；已有清单仍可本地复习。';});
