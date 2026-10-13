import {day,loadState,addItem,rateItem,mergeStates} from './learning.js';
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
$('search').onsubmit=async e=>{
 e.preventDefault();const version=++searchVersion;const q=$('query').value.trim();if(!q)return;
 $('status').textContent='正在查找…';
 try{
  const r=await fetch(base+'/api/vocabulary?q='+encodeURIComponent(q),{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();
  const data=await r.json();if(version!==searchVersion)return;
  $('results').replaceChildren();
  for(const item of data.items){
   const card=document.createElement('article'),title=document.createElement('h3'),meaning=document.createElement('p'),note=document.createElement('p'),add=document.createElement('button');
   title.textContent=item.word;meaning.textContent=item.meaning;
   note.className='muted';note.textContent=`${item.ipa||'音标待核对'} · ${item.phoneticNote} · 来源 PDF 第 ${item.pages.join('、')} 页`;
   add.textContent='加入今天的学习';add.onclick=()=>{const fresh=addItem(state,item);save();add.textContent='已加入';add.disabled=true;if(fresh)batch.push(state.items.find(x=>x.id===item.id));if(batch.length===3){start(batch);batch=[];}};
   card.append(title,meaning,note,add);
   if(item.audio){
    const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=item.audio.audioUrl;
    audio.onerror=()=>{$('status').textContent='录音暂时无法播放，请稍后重试。不会用不确定的读音替代。';};
    const credit=document.createElement('a');credit.href=item.audio.descriptionUrl;credit.target='_blank';credit.rel='noopener';credit.textContent=`美式录音资料 · ${item.audio.artist} · ${item.audio.license}（尚未逐条试听）`;
    card.append(audio,credit);
   }else{const p=document.createElement('p');p.className='muted';p.textContent='暂无已核实的本义项美式录音；不自动合成。';card.append(p);}
   $('results').append(card);
  }
  $('status').textContent=data.items.length?'请核对课本释义，再加入学习。':'未找到，请检查拼写；不会静默替换。';
 }catch{if(version===searchVersion)$('status').textContent='词库连接失败，请检查网络后重试。';}
};
render();
fetch(base+'/health',{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{$('status').textContent=`词库已连接：${x.entries} 个词条。`;}).catch(()=>{$('status').textContent='暂时连不上词库；已有清单仍可本地复习。';});
