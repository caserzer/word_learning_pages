import {day,loadState,addItem,rateItem,mergeStates,getFlow,learnWord,beginReview,advanceReview,pronunciationParts,reviewProgress,senseOptions} from './learning.js?v=328e6bc594d49f7f';
const $=id=>document.getElementById(id);
const base=(window.WORD_LEARNING_CONFIG?.API_BASE_URL||'').replace(/\/$/,'');
let storage;try{storage=window.localStorage;}catch{}
const state=loadState(storage),flow=getFlow(state);
let searchVersion=0,activeItem=null,audio=null,audioTimer=null,speechGeneration=0;
function save(){try{
 const merged=mergeStates(state,loadState(storage));
 for(const item of merged.items){const current=state.items.find(x=>x.id===item.id);if(current)Object.assign(current,item);else state.items.push(item);}
 storage.setItem('word-learning-v1',JSON.stringify(state));$('storage-warning').hidden=true;
}catch{$('storage-warning').hidden=false;}}
function audioState(button,message){$('speak').textContent=button;$('audio-status').textContent=message;}
function stopAudio(){audioState('听发音','');speechGeneration++;clearTimeout(audioTimer);if(audio){audio.pause();audio=null;}window.speechSynthesis?.cancel();}
function say(item){
 stopAudio();const generation=speechGeneration;audioState('正在加载…','正在加载美式录音…');
 const fallback=()=>{
  if(generation!==speechGeneration)return;
  const synth=window.speechSynthesis;
  if(!synth||!window.SpeechSynthesisUtterance){audioState('重试发音','这个浏览器暂时不能播放发音，请换一个支持语音的浏览器。');return;}
  const utterance=new window.SpeechSynthesisUtterance(item.word);utterance.lang='en-US';
  const voice=synth.getVoices().find(v=>/^en[-_]US$/i.test(v.lang));if(voice)utterance.voice=voice;
  utterance.rate=.85;utterance.onerror=()=>{if(generation===speechGeneration)audioState('重试发音','朗读暂时不可用，请检查设备语音设置。');};utterance.onstart=()=>{if(generation===speechGeneration)audioState('正在朗读','设备英语朗读');};utterance.onend=()=>{if(generation===speechGeneration)audioState('再听一次','设备朗读结束');};
  audioState('设备朗读…','正在准备设备英语朗读…');try{synth.speak(utterance);}catch{utterance.onerror();}
 };
 if(item.audio?.audioUrl){
  let fellBack=false,recording;const fail=()=>{if(fellBack||generation!==speechGeneration)return;fellBack=true;clearTimeout(audioTimer);recording?.pause();fallback();};
  try{recording=new Audio(item.audio.audioUrl);audio=recording;recording.onerror=fail;recording.onplaying=()=>{if(!fellBack&&generation===speechGeneration){clearTimeout(audioTimer);audioState('正在播放','美式录音播放中');}};recording.onended=()=>{if(!fellBack&&generation===speechGeneration){clearTimeout(audioTimer);audioState('再听一次','录音播放结束');}};audioTimer=setTimeout(fail,8000);recording.play().catch(fail);}catch{fail();}
 }else fallback();
}
function wordDisplay(node,item){
 node.replaceChildren();node.setAttribute('aria-label',item.word);
 const parts=item.syllablesVerified?item.syllables:pronunciationParts(item.word);
 // Only explicitly verified sound-informed segments; never guess from vowels.
 if(Array.isArray(parts)&&parts.length&&parts.join('').toLowerCase()===item.word.toLowerCase()){
  let offset=0;for(const [i,part] of parts.entries()){const span=document.createElement('span');span.textContent=item.word.slice(offset,offset+part.length);span.className=/[A-Za-z]/.test(part)?'syllable s'+(i%4):'';node.append(span);offset+=part.length;}
 }else node.textContent=item.word;
}
function render(){
 for(const id of ['home','entry','card','pause'])$(id).hidden=true;
 $('stage').textContent=({home:'单词学习',input:'添加单词',study:'学习',review:'回顾',group:'小组回顾',choice:'回顾完成',finished:'今日完成'})[flow.phase]||'学习';
 $('close').hidden=['home','finished'].includes(flow.phase);
 $('finish').textContent=flow.pending.length?'回顾剩余词并结束':'结束今天的学习';
 $('count').textContent=`今天已学 ${flow.studied.length} 个词 · 到期 ${state.items.filter(x=>Date.parse(x.due)<=Date.now()).length} 个`;
 $('today').disabled=flow.phase!=='home';
 $('saved-count').textContent=`已保存 ${state.items.length} 个词`;
 $('queue').replaceChildren(...state.items.map(x=>{const li=document.createElement('li');wordDisplay(li,x);return li;}));
 const resume=Boolean(flow.suspended)||(flow.active&&!['home','finished'].includes(flow.phase));$('begin').textContent=resume?'继续上次学习':'开始今天的学习';
 if(flow.phase==='home'){$('home').hidden=false;return;}
 if(flow.phase==='input'){$('entry').hidden=false;$('progress').textContent=`今天已学 ${flow.studied.length} 个，这一组 ${flow.pending.length} / 3 个。`;return;}
 if(flow.phase==='study'||flow.phase==='review'){
  activeItem=state.items.find(x=>x.id===(flow.phase==='study'?flow.currentId:flow.reviewIds[flow.position]));
  if(!activeItem){flow.phase='input';save();render();return;}
  $('card').hidden=false;wordDisplay($('prompt'),activeItem);$('answer').textContent=activeItem.meaning;
  const review=flow.phase==='review';$('card-progress').textContent=review?reviewProgress(flow):`认识这个词 · 今天第 ${flow.studied.length+1} 个`;
  $('answer').hidden=review;$('reveal').hidden=!review;$('ratings').hidden=true;$('learned').hidden=review;
  $('card-source').replaceChildren(sourceDetails(activeItem));audioState('听发音','');
  $('sense-editor').hidden=review;$('sense-editor').open=false;
  const options=senseOptions(activeItem.originalMeaning||activeItem.meaning);$('sense-choice').hidden=options.length<2;$('sense-choice-label').hidden=options.length<2;$('sense-choice').replaceChildren(...options.map(text=>{const option=document.createElement('option');option.value=text;option.textContent=text;return option;}));$('sense-choice').value=activeItem.meaning;$('sense-text').value=activeItem.meaning;
  return;
 }
 $('pause').hidden=false;const p=$('pause-primary'),s=$('pause-secondary');s.hidden=false;
 if(flow.phase==='group'){
  $('pause-title').textContent='三个词，回顾一下';$('pause-text').textContent='先看英文，想想意思。不确定的词会再练一次。';
  p.textContent='回顾这三个词';p.onclick=()=>review(flow.pending,'group');s.textContent='回顾后结束今天';s.onclick=finish;
 }else if(flow.phase==='choice'){
  $('pause-title').textContent='这一组回顾完成';$('pause-text').textContent='再学一个，还是今天先到这里？';
  p.textContent='继续学下一个';p.onclick=nextInput;s.textContent='结束今天的学习';s.onclick=finish;
 }else{
  $('pause-title').textContent='今天的学习完成了';$('pause-text').textContent=`今天学了 ${flow.studied.length} 个词。刚回顾过的词不再重复，下次到期再见。`;
  p.textContent='回到首页';p.onclick=()=>{flow.phase='home';flow.active=false;save();render();};s.textContent='再学一个';s.onclick=nextInput;
 }
}
function nextInput(){stopAudio();flow.active=true;flow.phase='input';searchVersion++;$('results').replaceChildren();$('query').value='';$('status').textContent='';save();render();$('query').focus();}
function chooseWord(item){$('status').textContent='';stopAudio();searchVersion++;addItem(state,item);flow.active=true;flow.currentId=item.id;flow.phase='study';save();render();$('prompt').focus();}
function review(ids,kind){stopAudio();if(['due','today'].includes(kind)&&flow.suspended)flow.resumeAfterReview={phase:flow.suspended,currentId:flow.currentId,reviewIds:[...flow.reviewIds],position:flow.position,retried:[...flow.retried],reviewKind:flow.reviewKind,reviewInitialCount:flow.reviewInitialCount};beginReview(flow,ids.filter(id=>state.items.some(x=>x.id===id)),kind);save();render();}
function finish(){review(flow.pending,'finish');}
$('begin').onclick=()=>{flow.active=true;if(flow.suspended){flow.phase=flow.suspended;delete flow.suspended;save();render();}else nextInput();};
$('finish').onclick=finish;
$('learned').onclick=()=>{if(flow.phase!=='study')return;stopAudio();learnWord(flow,activeItem.id);save();if(flow.phase==='input')nextInput();else render();};
$('speak').onclick=()=>{if(activeItem)say(activeItem);};
$('reveal').onclick=()=>{$('answer').hidden=false;$('ratings').hidden=false;$('reveal').hidden=true;$('announcement').textContent=activeItem.word+'：'+activeItem.meaning+'。请选择记得、模糊或忘记。';document.querySelectorAll('[data-rating]')[0].focus();};
$('sense-choice').onchange=()=>{$('sense-text').value=$('sense-choice').value;};
$('save-sense').onclick=()=>{const meaning=$('sense-text').value.trim();if(!meaning){$('sense-text').focus();return;}activeItem.originalMeaning||=activeItem.meaning;activeItem.meaning=meaning;activeItem.meaningUpdatedAt=new Date().toISOString();save();render();$('announcement').textContent='课本意思已保存。';$('learned').focus();};
document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>{
 if(flow.phase!=='review'||$('ratings').hidden)return;
 stopAudio();const again=rateItem(activeItem,b.dataset.rating);const done=advanceReview(flow,activeItem.id,again);if(done&&flow.resumeAfterReview){const prior=flow.resumeAfterReview;delete flow.resumeAfterReview;Object.assign(flow,prior,{suspended:prior.phase,phase:'home'});}save();render();if(flow.phase==='review')$('prompt').focus();else if(flow.phase==='home')$('begin').focus();else if(flow.phase!=='input')$('pause-title').focus();
});
$('close').onclick=()=>{stopAudio();flow.suspended=flow.phase;flow.phase='home';save();render();$('begin').textContent='继续上次学习';};
$('due').onclick=()=>{const ids=state.items.filter(x=>Date.parse(x.due)<=Date.now()).map(x=>x.id);if(!ids.length){$('status').textContent='现在没有到期的词。';return;}review(ids,'due');};
$('today').onclick=()=>{if(flow.phase==='home')review(state.items.filter(x=>x.studyDay===day()).map(x=>x.id),'today');};
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
async function renderNewWord(q,version){
 const form=document.createElement('form');form.className='new-word';
 const title=document.createElement('h3');title.textContent='添加新词：'+q;
 const label=document.createElement('label');label.textContent='课本释义（可以自行填写）';
 const meaning=document.createElement('input');meaning.id='new-word-meaning';meaning.name='meaning';meaning.autocomplete='off';label.htmlFor=meaning.id;meaning.required=true;meaning.maxLength=500;meaning.placeholder='输入中文意思';
 const info=document.createElement('p');info.textContent='正在补充词义…';
 const spelling=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.required=true;spelling.append(check,document.createTextNode('我已确认这个单词或词组的拼写'));
 const submit=document.createElement('button');submit.textContent='确认并学习';
 const attribution=document.createElement('a');attribution.href='https://mymemory.translated.net/';attribution.target='_blank';attribution.rel='noopener';attribution.textContent='翻译建议来源：MyMemory';const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='资料来源';details.append(summary,attribution);
 form.append(title,label,meaning,info,spelling,submit,details);$('results').prepend(form);
 let enriched={definitions:[],audio:null};
 form.onsubmit=e=>{e.preventDefault();if(!check.checked||!meaning.value.trim())return;
  const item={id:'custom-'+q.toLowerCase().replace(/\s+/g,' '),word:q,meaning:meaning.value.trim(),kind:q.includes(' ')?'phrase':'word',pages:[],audio:enriched.audio,definitions:enriched.definitions,translationSource:enriched.translation?.source||null,translationProvider:enriched.translation?.provider||'MyMemory',verification:'user_confirmed'};
  chooseWord(item);
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
function candidate(item){const b=document.createElement('button');b.className='candidate secondary';b.textContent=item.word+' · '+item.meaning;b.onclick=()=>chooseWord(item);$('results').append(b);}
$('search').onsubmit=async e=>{
 e.preventDefault();const q=$('query').value.trim(),version=++searchVersion;if(!q)return;
 const existing=state.items.find(x=>x.word===q)||state.items.find(x=>q.toLowerCase()!=='may'&&x.word.toLowerCase()===q.toLowerCase());if(existing){chooseWord(existing);return;}
 $('results').replaceChildren();$('status').textContent='正在查找…';
 try{
  const r=await fetch(base+'/api/vocabulary?q='+encodeURIComponent(q),{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const data=await r.json();if(version!==searchVersion)return;
  if(q.toLowerCase()==='may'){
   const combined=data.items.find(x=>x.word==='may / May');
   if(combined){$('status').textContent='选一下课本中的意思。';candidate({...combined,id:'w-may-modal',word:'may',meaning:'可以；也许，可能'});candidate({...combined,id:'w-may-month',word:'May',meaning:'五月'});return;}
  }
  const exact=data.items.filter(x=>x.word.toLowerCase()===q.toLowerCase());
  if(exact.length===1){$('status').textContent='';chooseWord(exact[0]);return;}
  if(exact.length>1){$('status').textContent='选一下课本中的意思。';exact.forEach(candidate);return;}
  $('status').textContent='';
  if(/^[A-Za-z][A-Za-z '\-]{0,79}$/.test(q))void renderNewWord(q,version);
  else {data.items.forEach(candidate);if(!data.items.length)$('status').textContent='请用英文输入要添加的单词或词组。';}
 }catch{if(version!==searchVersion)return;$('status').textContent='暂时连不上词库，可以填写课本意思继续。';if(/^[A-Za-z][A-Za-z '\-]{0,79}$/.test(q))void renderNewWord(q,version);}
};
render();
