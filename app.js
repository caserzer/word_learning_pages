import {reviewEvidence,REVIEW_SKILLS,createReviewUI,day,loadState,addItem,rateItem,mergeStates,getFlow,learnWord,beginReview,advanceReview,pronunciationParts,pronunciationInfo,reviewProgress,senseOptions,commitDraft,recordReview,undoReview,wordKey,wordGroups,searchBook,dueItems,prepareSense,previewImport,applyImport,getSessions,activateSession,parkLearning,resumeLearning,saveWaiting,dailyStats,todayReviewItems,createSync,mergeCloud,restoreTask} from './learning.js?v=8ec77165d45ae416';
const $=id=>document.getElementById(id),base=(window.WORD_LEARNING_CONFIG?.API_BASE_URL||'').replace(/\/$/,'');
let sync=null;
let storage;try{storage=window.localStorage;if(storage.getItem('word-learning-before-cloud-v1')===null)storage.setItem('word-learning-before-cloud-v1',storage.getItem('word-learning-v1')||JSON.stringify({version:1,items:[]}));}catch{}
const state=loadState(storage),sessions=getSessions(state);let flow=state.flow;
const bookState=state.bookState||{query:'',status:'',list:'',since:'',sort:'recent',page:0};state.bookState=bookState;let importPreview=null;
let view=state.workspaceView||(flow.phase!=='input'||flow.draft||flow.lookupDraft?'today':'home'),searchVersion=0,activeItem=null,audio=null,audioTimer=null,speechGeneration=0,audioButton=null,bookEditId=null,bookReturnView='today';
function mergeLatest(){if(sync?.ready){applyCloudState(mergeCloud(state,loadState(storage)),false);return;}const merged=mergeStates(state,loadState(storage));for(const item of merged.items){const current=state.items.find(x=>x.id===item.id);if(current)Object.assign(current,item);else state.items.push(item);}}
function save(){try{state.workspaceView=view;sync?.capture();mergeLatest();storage.setItem('word-learning-v1',JSON.stringify(state));sync?.saved();$('storage-warning').hidden=true;}catch{$('storage-warning').hidden=false;}}
function audioState(button,message){if(button==='再听一次'&&['录音播放结束','设备朗读结束'].includes(message)&&flow?.reviewVersion===2){const q=flow.queue?.[flow.position];if(q&&!q.result){q.audioPlayed=true;save();}}if(audioButton)audioButton.textContent=button;$('audio-status').textContent=message;}
function stopAudio(){audioState('听发音','');speechGeneration++;clearTimeout(audioTimer);if(audio){audio.pause();audio=null;}window.speechSynthesis?.cancel();}
function say(item,button=$('speak')){
 stopAudio();audioButton=button;const generation=speechGeneration;audioState('正在加载…','正在加载美式录音…');
 const fallback=()=>{
  if(generation!==speechGeneration)return;
  const synth=window.speechSynthesis;
  if(!synth||!window.SpeechSynthesisUtterance){audioState('重试发音','这个浏览器暂时不能播放发音，请换一个支持语音的浏览器。');return;}
  const utterance=new window.SpeechSynthesisUtterance(item.word);utterance.lang='en-US';
  const voice=synth.getVoices().find(v=>/^en[-_]US$/i.test(v.lang));if(voice)utterance.voice=voice;
  utterance.rate=.85;utterance.onerror=()=>{if(generation===speechGeneration)audioState('重试发音','朗读暂时不可用，请检查设备语音设置。');};utterance.onstart=()=>{if(generation===speechGeneration)audioState('正在朗读','设备英语朗读');};utterance.onend=()=>{if(generation===speechGeneration)audioState('再听一次','设备朗读结束');};
  audioState('设备朗读…','正在准备设备英语朗读…');try{synth.speak(utterance);}catch{utterance.onerror();}
 };
 if(safeLink(item.audio?.audioUrl)){
  let fellBack=false,recording;const fail=()=>{if(fellBack||generation!==speechGeneration)return;fellBack=true;clearTimeout(audioTimer);recording?.pause();fallback();};
  try{recording=new Audio(item.audio.audioUrl);audio=recording;recording.onerror=fail;recording.onplaying=()=>{if(!fellBack&&generation===speechGeneration){clearTimeout(audioTimer);audioState('正在播放','美式录音播放中');}};recording.onended=()=>{if(!fellBack&&generation===speechGeneration){clearTimeout(audioTimer);audioState('再听一次','录音播放结束');}};audioTimer=setTimeout(fail,8000);recording.play().catch(fail);}catch{fail();}
 }else fallback();
}
function wordDisplay(node,item){
 node.replaceChildren();node.setAttribute('aria-label',item.word);
 const parts=pronunciationParts(item.word);
 // Only explicitly verified sound-informed segments; never guess from vowels.
 if(Array.isArray(parts)&&parts.length&&parts.join('').toLowerCase()===item.word.toLowerCase()){
  let offset=0;for(const [i,part] of parts.entries()){const span=document.createElement('span');span.textContent=item.word.slice(offset,offset+part.length);span.className=/[A-Za-z]/.test(part)?'syllable s'+(i%4):'';node.append(span);offset+=part.length;}
 }else node.textContent=item.word;
}
function phoneticDisplay(node,item){
 const {ipa}=pronunciationInfo(item);node.textContent=ipa?'美式参考音标 '+ipa:'';node.hidden=!ipa;node.className='phonetic';node.setAttribute('translate','no');
}
function showPanel(id){for(const key of ['home','entry','card','pause','due-home','book','review-v2'])$(key).hidden=key!==id;}
function focusReview(){(flow.reviewVersion===2?$('review-input')||$('review-prompt'):$('prompt'))?.focus();}
function itemById(id){return state.items.find(x=>x.id===id);}
function itemFromStorage(id){return loadState(storage).items.find(x=>x.id===id);}
function refreshRail(){
 const stats=dailyStats(state);$('rail-summary').textContent=`今日新增 ${stats.added} 个义项`;$('progress').textContent=`本组 ${flow.pending.length} / 3 个，满三个就回顾。`;
 $('group-queue').replaceChildren(...[0,1,2].map(i=>{const li=document.createElement('li'),item=itemById(flow.pending[i]);if(item){const b=document.createElement('button');b.className='quiet';b.textContent=item.word;b.onclick=()=>openBook(item.id);li.append(b);}else li.textContent=`第 ${i+1} 个词`;return li;}));
 $('daily-count').textContent=`今日练习 ${stats.reviewed} 个义项 · ${stats.attempts} 次练习`;
 $('queue').replaceChildren(...flow.reviewed.map(id=>itemById(id)).filter(Boolean).map(item=>{const li=document.createElement('li'),b=document.createElement('button');b.className='quiet';b.textContent=item.word;b.onclick=()=>openBook(item.id);li.append(b);return li;}));
 $('nav-book').setAttribute('aria-current',view==='book'?'page':'false');$('batch-status').textContent=flow.intake?.length?`还待核对 ${flow.intake.length} 个词` : '';
 $('nav-today').setAttribute('aria-current',view==='home'?'page':'false');$('nav-due').setAttribute('aria-current',view==='due'?'page':'false');
 $('close').hidden=view!=='today'||['home','finished'].includes(flow.phase);$('undo-bar').hidden=!flow.undo;
}
function render(){
 if(view==='today'&&state.activeSession!=='due'){let exposed=false;for(const id of [...flow.pending,...flow.reviewed])exposed=markReviewExposure('learning-list',id,itemById(id)?.word)||exposed;if(exposed)save();}
 $('announcement').textContent='';document.body?.setAttribute('data-view',view);document.body?.setAttribute('data-review-v2',String(view==='today'&&flow.phase==='review'&&flow.reviewVersion===2));refreshRail();
 if(view==='home'){renderHome();return;}
 if(view==='book'){showPanel('book');renderBook();return;}
 if(view==='due'){showPanel('due-home');reviewUI.homeView($('review-home-v2'));const n=dueItems(state.items).length;$('due-count').textContent=n?`个人词本 ${wordGroups(state.items).length} 个词，共 ${state.items.length} 个义项；${n} 个义项到期。`:'现在没有到期的词。';const continuing=sessions.due.phase==='review'||sessions.due.suspended==='review';$('due').textContent=continuing?'继续这轮复习':sessions.due.phase==='finished'?'继续下一轮':'开始到期复习';$('due-result').textContent=sessions.due.phase==='finished'?`本轮完成，仍有 ${n} 个义项待复习。可以继续，也可以添加新词。`:'';$('due').disabled=!n&&!continuing;renderTodayReview(continuing);return;}
 if(flow.phase==='home'&&flow.suspended){showPause('上次停在这里','草稿和回顾位置都保留着。','继续上次',resume,'返回今日',()=>switchView('home'));return;}
 if(flow.phase==='finished'){showPause('本轮完成',`这一轮的记录已保存，可以继续学新词。`,'继续学新词',addNew,'返回今日',()=>switchView('home'));return;}
 if(flow.phase==='group'){showPause('这一组准备好了','这是上一版保留的未完成小组。','回顾这三个词',()=>review(flow.pending,'group'),'回顾后结束',finish);return;}
 if(flow.phase==='choice'){flow.phase='input';flow.result='这一组回顾完成，可以直接输入下一个词。';save();}
 if(flow.phase==='review'){renderReview();return;}
 showPanel('entry');$('finish').textContent=flow.pending.length?`回顾这 ${flow.pending.length} 个词`:'返回今日';
 $('group-result').hidden=!flow.result;$('group-result').textContent=flow.result||'';
 const draft=flow.draft||(flow.phase==='study'?itemById(flow.currentId):null);$('draft').hidden=!draft;$('batch-form').hidden=false;$('single-entry').hidden=false;$('single-entry').open=!draft;if(draft)$('batch-entry').open=false;$('saved-drafts').hidden=!flow.draftQueue.length;$('saved-drafts').textContent=`继续之前的 ${flow.draftQueue.length} 份草稿`;
 if(draft){if(markReviewExposure('study',draft.id,draft.word))save();flow.draft||=JSON.parse(JSON.stringify(draft));activeItem=flow.draft;wordDisplay($('draft-word'),activeItem);phoneticDisplay($('draft-phonetic'),activeItem);$('draft-meaning').value=activeItem.meaning;
  const options=[...new Set([...state.items.filter(x=>wordKey(x.word)===wordKey(activeItem.word)).map(x=>x.meaning),...senseOptions(activeItem.originalMeaning||activeItem.meaning)])];if(!options.includes(activeItem.meaning))options.unshift(activeItem.meaning);
  $('draft-sense').replaceChildren(...options.map(text=>{const o=document.createElement('option');o.value=text;o.textContent=text;return o;}));$('draft-sense').value=activeItem.meaning;$('draft-sense').hidden=options.length<2;$('draft-sense-label').hidden=options.length<2;
  $('learned').textContent=flow.pending.length===2&&!flow.studied.includes(activeItem.id)?'保存并回顾这 3 个词':'保存并学习';$('draft-source').replaceChildren(sourceDetails(activeItem));$('sense-notice').textContent=state.items.some(x=>wordKey(x.word)===wordKey(activeItem.word))?'已有词：保留已有意思会复用记录；不同意思将保存为独立义项，不覆盖原进度。':'';
 }
}
function renderTodayReview(continuing){
 const eligible=todayReviewItems(state.items),today=day();
 const addedToday=state.items.filter(item=>item.createdAt&&Number.isFinite(Date.parse(item.createdAt))?day(new Date(item.createdAt))===today:item.studyDay===today);
 const waiting=addedToday.filter(item=>item.learningStatus==='waiting').length,initial=addedToday.filter(item=>item.learningStatus==='initial').length;
 $('today').disabled=false;
 $('today').textContent=continuing?(sessions.due.reviewKind==='today'?'继续今日回顾':'继续未完成复习'):`回顾今天已学 · ${eligible.length} 个`;
 $('today-review-status').textContent=`今天已学或自评、可回顾 ${eligible.length} 个义项；今日新增待学 ${waiting} 个，待初次回顾 ${initial} 个。`+(continuing?'会先继续未完成的这一轮，保留当前题目和答案。':'待学词需先学习，再进入回顾；继续学习会先恢复已有草稿或小组。');
 const f=sessions.learning;
 $('today-learn').hidden=!(f.waiting.length||f.pending.length||f.recapQueue.length||f.draft||f.lookupDraft||f.draftQueue.length||f.intake.length);
 $('today-learn').textContent='继续学习 / 初次回顾';
}
function showPause(title,text,primary,fn,secondary,other){showPanel('pause');$('pause-title').textContent=title;$('pause-text').textContent=text;$('pause-primary').textContent=primary;$('pause-primary').onclick=fn;$('pause-secondary').textContent=secondary;$('pause-secondary').onclick=other;}
function renderReview(){
 if(flow.reviewVersion===2){showPanel('review-v2');reviewUI.questionView($('review-v2'));return;}
 showPanel('card');activeItem=itemById(flow.reviewIds[flow.position]);if(!activeItem){nextInput();return;}
 wordDisplay($('prompt'),activeItem);phoneticDisplay($('card-phonetic'),activeItem);$('card-progress').textContent=reviewProgress(flow)+' · '+(activeItem.lists?.at(-1)||activeItem.studyDay||'词本')+' · 义项 '+(state.items.filter(x=>wordKey(x.word)===wordKey(activeItem.word)).findIndex(x=>x.id===activeItem.id)+1);$('answer').textContent=activeItem.meaning;
 const revealed=Boolean(flow.recall);$('answer').hidden=!revealed;$('recall-actions').hidden=revealed;$('recall-instruction').hidden=revealed;$('check-instruction').hidden=!revealed;
 $('ratings').hidden=flow.recall!=='known';$('hint-next').hidden=flow.recall!=='hint';
 $('check-instruction').textContent=flow.recall==='known'?'和你刚才想的意思对上了吗？':'看清意思，再听一遍。这个词会再练一次。';$('card-source').replaceChildren(sourceDetails(activeItem));
}
function nextInput(){stopAudio();searchVersion++;view='today';flow.active=true;flow.phase='input';flow.draft=null;flow.lookupDraft=null;flow.typedQuery='';flow.recall=null;$('query').value='';$('results').replaceChildren();$('status').textContent='';save();render();$('query').focus();}
function markReviewExposure(kind,id=null,word=null){const task=sessions.due;if(task.reviewVersion!==2||!(task.phase==='review'||task.suspended==='review'))return false;let changed=false;for(const q of task.queue||[]){if(!q.result&&(!id||q.id===id||word&&itemById(q.id)?.word===word)){q.hints||=[];if(!q.hints.includes(kind)){q.hints.push(kind);changed=true;}}}return changed;}
function chooseWord(item){markReviewExposure('study',item.id,item.word);if(flow.phase==='review'||flow.suspended==='review'||state.activeSession==='due')addNew();flow.undo=null;stopAudio();searchVersion++;view='today';flow.active=true;flow.phase='study';flow.currentId=item.id;flow.typedQuery=item.word;flow.draft=JSON.parse(JSON.stringify(item));flow.draftList=flow.listName||day();flow.lookupDraft=null;$('results').replaceChildren();$('status').textContent='';save();render();$('draft-word').focus();}
function rememberDraft(){if(!flow.draft)return;flow.draft.meaning=$('draft-meaning').value.trim();if(!flow.draft.meaning){$('draft-meaning').focus();return;}stopAudio();flow.undo=null;const word=flow.draft.word;flow.draft=prepareSense(state,flow.draft,flow.draftList||flow.listName||day());const existing=itemById(flow.draft.id);if(existing)existing.lists=flow.draft.lists;if(!commitDraft(state,flow))return;if(flow.fromIntake&&flow.intake?.length)flow.intake.shift();flow.fromIntake=false;searchVersion++;flow.typedQuery='';$('results').replaceChildren();$('query').value='';save();render();if(flow.phase==='review'){focusReview();}else{$('status').textContent=`${word} 已记到本组。`;$('query').focus();if(flow.intake?.length)void nextIntake();}}
function review(ids,kind){
 ids=ids.filter(id=>itemById(id));stopAudio();searchVersion++;
 if(['due','today'].includes(kind)){
  flow=activateSession(state,'due');
  if(flow.phase==='review'||flow.suspended==='review'){flow.phase='review';delete flow.suspended;view='today';save();render();focusReview();return;}
  if(!ids.length){view='due';save();render();$('today-review-status').textContent+=kind==='today'?($('today-learn').hidden?' 今天还没有可回顾的词，可以点“添加新词”开始。':' 请点“继续学习 / 初次回顾”；已有草稿或小组会先继续，进度不会丢失。'):' 现在没有到期的词，可以继续学习新词。';return;}
 }else flow=activateSession(state,'learning');
 beginReview(flow,ids,kind);flow.recall=null;flow.undo=null;view='today';save();render();if(flow.phase==='review')focusReview();
}
function finish(){if(flow.pending.length)review(flow.pending,'finish');else switchView('home');}
function resume(){if(flow.suspended){flow.phase=flow.suspended;delete flow.suspended;}view='today';save();render();if(flow.phase==='review')focusReview();else if(flow.draft)$('draft-word').focus();else $('query').focus();restoreLookup();}
function switchView(next){stopAudio();searchVersion++;view=next;save();render();if(next==='today')restoreLookup();}
function reveal(choice){if(flow.phase!=='review'||flow.recall)return;flow.recall=choice;save();render();$('announcement').textContent=activeItem.word+'：'+activeItem.meaning;if(choice==='known')document.querySelectorAll('[data-rating]')[0].focus();else $('hint-next').focus();}
function score(rating){
 if(flow.phase!=='review'||!flow.recall)return;if(flow.recall==='hint'&&rating==='remember')return;
 stopAudio();const kind=flow.reviewKind;recordReview(state,flow,activeItem.id,rating);
 if(flow.phase!=='review'){
  if(['group','finish'].includes(kind)){state.completedGroups||=[];const id='group-'+Date.now()+'-'+Math.random();state.completedGroups.push({id,day:day(),ids:[...new Set(flow.reviewIds)]});flow.undo.completedGroupId=id;}
  if(state.activeSession==='due'){flow.phase='finished';view='due';$('status').textContent='本轮完成。可以继续下一轮，或添加新词。';}
  else if(kind==='group'){flow.phase='input';flow.result=`本组回顾完成。可以继续学习或返回今日。`;$('query').value='';}
 }

 save();render();if(flow.phase==='review'&&view==='today')focusReview();else if(view==='today'&&flow.phase==='input'){ $('query').focus();if(flow.intake?.length)void nextIntake();}else $('undo').focus();
}
$('learned').onclick=rememberDraft;$('cancel-draft').onclick=skipIntake;$('finish').onclick=finish;
$('draft-meaning').oninput=()=>{if(flow.draft){flow.draft.originalMeaning||=flow.draft.meaning;flow.draft.meaning=$('draft-meaning').value;phoneticDisplay($('draft-phonetic'),flow.draft);$('draft-source').replaceChildren(sourceDetails(flow.draft));save();}};
$('draft-sense').onchange=()=>{$('draft-meaning').value=$('draft-sense').value;$('draft-meaning').oninput();};
$('draft-audio').onclick=()=>flow.draft&&say(flow.draft,$('draft-audio'));$('speak').onclick=()=>activeItem&&say(activeItem);
$('recall-known').onclick=()=>reveal('known');$('recall-hint').onclick=()=>reveal('hint');$('hint-next').onclick=()=>score('uncertain');
document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>score(b.dataset.rating));
$('undo').onclick=()=>{stopAudio();const remote=itemFromStorage(flow.undo?.id);if(flow.undo&&remote&&(remote.reviewRevision||remote.reviewUpdatedAt||remote.lastReview)!==flow.undo.expectedRevision){flow.undo=null;mergeLatest();$('status').textContent='这个词已在另一处更新，不能覆盖较新的记录。';save();render();return;}mergeLatest();const groupId=flow.undo?.completedGroupId;if(!undoReview(state,flow)){$('status').textContent='这个词已在另一处更新，不能覆盖较新的记录。';save();render();return;}if(groupId){state.completedGroups=state.completedGroups.filter(x=>x.id!==groupId);state.removedGroupIds=[...new Set([...(state.removedGroupIds||[]),groupId])];}view='today';save();render();$('status').textContent='已撤销上一笔，请重新核对。';focusReview();};
$('close').onclick=()=>switchView('home');
$('nav-today').onclick=()=>switchView('home');$('nav-due').onclick=()=>switchView('due');
$('due').onclick=()=>review(dueItems(state.items).slice(0,Number($('batch-size').value)||10).map(x=>x.id),'due');$('today').onclick=()=>review(todayReviewItems(state.items).map(x=>x.id),'today');
$('export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='word-learning-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
function openBook(id){markReviewExposure('wordbook');stopAudio();searchVersion++;if(view!=='book')bookReturnView=view;view='book';bookEditId=null;$('word-detail').hidden=true;$('book-list').hidden=false;$('book-browse').hidden=false;save();render();if(id)openDetail(id);if(id)$('book-meaning').focus();else $('book-query').focus();}
function action(text,fn){const b=document.createElement('button');b.className='quiet';b.textContent=text;b.onclick=fn;return b;}
function renderBook(){
 const result=searchBook(state.items,bookState);bookState.page=result.page;
 $('book-count').textContent=`${wordGroups(state.items).length} 个词 / ${state.items.length} 个义项，找到 ${result.total} 个词条`;
 $('book-list').replaceChildren(...result.rows.map(g=>{const row=document.createElement('article');row.className='book-row';const title=action(g.word,()=>openDetail(g.items[0].id));title.className='wordlink';const meaning=document.createElement('p');meaning.textContent=g.items.map(x=>x.meaning).join(' / ');const meta=document.createElement('span');meta.className='muted';meta.textContent=`${g.items.length} 个义项 · ${g.items.filter(x=>Date.parse(x.due)<=Date.now()).length} 个到期`;row.append(title,meaning,meta,action('查看',()=>openDetail(g.items[0].id)));return row;}));
 if(!result.total){const p=document.createElement('p');p.textContent='没有找到匹配的词。试试英文片段、中文意思，或清除筛选。';$('book-list').append(p);}
 $('book-page').textContent=`第 ${result.page+1} / ${result.pages} 页`;$('book-prev').disabled=result.page===0;$('book-next').disabled=result.page===result.pages-1;
 const item=itemById(bookEditId);$('book-editor').hidden=!item;if(item){$('book-word').textContent=item.word;$('book-meaning').value=item.meaning;}
 const values=[...new Set(state.items.flatMap(x=>x.lists||[x.studyDay]).filter(Boolean))].sort().reverse();$('book-filter-list').replaceChildren(...['',...values].map(v=>{const o=document.createElement('option');o.value=v;o.textContent=v||'全部词单';return o;}));
 for(const [id,k] of [['book-query','query'],['book-state','status'],['book-filter-list','list'],['book-since','since'],['book-sort','sort']])$(id).value=bookState[k]||'';
}
function openDetail(id){const item=itemById(id);if(!item)return;if(flow.phase==='review'&&wordKey(itemById(flow.reviewIds[flow.position])?.word||'')===wordKey(item.word))flow.recall='hint';
 $('word-detail').hidden=false;$('book-browse').hidden=true;const title=document.createElement('h2');wordDisplay(title,item);title.className='word';const phonetic=document.createElement('p');phoneticDisplay(phonetic,item);const listen=action('听发音',()=>say(item,listen));const nodes=[action('返回检索结果',()=>{$('word-detail').hidden=true;$('book-list').hidden=false;$('book-browse').hidden=false;$('book-query').focus();}),title,phonetic,listen,sourceDetails(item)];
 for(const sense of state.items.filter(x=>wordKey(x.word)===wordKey(item.word))){const article=document.createElement('article'),p=document.createElement('p'),history=document.createElement('p');p.textContent=sense.meaning;history.className='muted';history.textContent=`${sense.lastReview?'上次练习 '+sense.lastReview.slice(0,10):'尚未复习'}；${Date.parse(sense.due)<=Date.now()?'已到期':'下次 '+(sense.due||'').slice(0,10)}；词单：${(sense.lists||[sense.studyDay]).filter(Boolean).join('、')}`;const log=document.createElement('p');log.className='muted';log.textContent=(sense.history||[]).slice(-5).map(x=>x.at.slice(0,10)+' '+(x.evidenceVersion===2?({meaning:'词义',listening:'听辨',spelling:'拼写',dictation:'听写',use:'用法'}[x.mode]||'练习')+' · '+({correct:x.independent?'独立答对':'答对（重练）',hinted:'提示后答对',wrong:'答错','self-rated':'自评',skip:'跳过'}[x.outcome]||'已记录'):({remember:'自评对上了',uncertain:'使用提示',forgot:'记错再练'}[x.rating]||'自评'))).join('；');const skills=document.createElement('p');skills.className='muted';skills.textContent=Object.entries(REVIEW_SKILLS).map(([key,label])=>{const e=reviewEvidence(sense,key);return label+'：'+(!e.last?'尚无练习证据':e.last.outcome==='self-rated'?'已自评（非客观测验）':'独立客观成功 '+e.independentDays+' 天')+(e.weak?'，待巩固':'');}).join('；');article.append(p,history,log,skills,action('修改此义项',()=>{bookEditId=sense.id;renderBook();$('book-meaning').focus();}),action((flow.phase==='review'||flow.suspended==='review')&&['due','today'].includes(flow.reviewKind)?'继续未完成复习':'练习此义项',()=>{ $('word-detail').hidden=true;reviewUI.startItems([sense]);}));nodes.push(article);}
 const addSense=action('添加另一个意思',()=>{addNew();chooseWord({...item,id:item.id+'-sense-'+Date.now(),meaning:'',originalMeaning:item.originalMeaning||item.meaning});$('draft-meaning').focus();});nodes.push(addSense);$('word-detail').replaceChildren(...nodes);$('book-list').hidden=true;save();title.setAttribute('tabindex','-1');title.focus();
}
$('open-book').onclick=()=>openBook();$('book-back').onclick=()=>{bookEditId=null;$('word-detail').hidden=true;$('book-list').hidden=false;$('book-browse').hidden=false;switchView(bookReturnView);if(view==='today'&&flow.phase==='review')focusReview();else if(view==='today'&&flow.draft)$('draft-word').focus();};$('book-query').oninput=()=>filterBook();
$('book-cancel').onclick=()=>{const id=bookEditId;bookEditId=null;renderBook();openDetail(id);};$('book-editor').onsubmit=e=>{e.preventDefault();const item=itemById(bookEditId),meaning=$('book-meaning').value.trim();if(!item||!meaning)return;item.originalMeaning||=item.meaning;item.meaning=meaning;item.meaningUpdatedAt=new Date().toISOString();if(flow.draft?.id===item.id){flow.draft.originalMeaning||=item.originalMeaning;flow.draft.meaning=meaning;}for(const task of [sessions.learning,sessions.due,...sessions.learning.recapQueue])if(task?.reviewIds?.[task.position]===item.id)task.recall=null;save();bookEditId=null;renderBook();openDetail(item.id);$('status').textContent='词义已修改。学习和回顾位置没有改变。';};
function safeLink(value){try{return typeof value==='string'&&new URL(value).protocol==='https:';}catch{return false;}}
function sourceDetails(item){
 const details=document.createElement('details'),summary=document.createElement('summary');
 summary.textContent='资料来源';details.append(summary);
 const pronunciation=pronunciationInfo(item);if(pronunciation.note){const note=document.createElement('p');note.textContent=pronunciation.note;details.append(note);}
 const p=document.createElement('p');p.textContent=item.sourceTitle?item.sourceTitle+' · '+(item.sourceSection||''):item.pages?.length?'词表 PDF 第 '+item.pages.join('、')+' 页':'自行录入或免费词典补充';details.append(p);
 for(const text of Array.isArray(item.sourceNotes)?item.sourceNotes:[]){const note=document.createElement('p');note.textContent=text;details.append(note);}
 if(item.forms){const forms=document.createElement('p');forms.textContent='词形：'+item.forms;details.append(forms);}
 if(safeLink(item.audio?.descriptionUrl)){const a=document.createElement('a');a.href=item.audio.descriptionUrl;a.target='_blank';a.rel='noopener';a.textContent=(item.audio.artist||'录音作者')+' · '+item.audio.license;details.append(a);}
 if(safeLink(item.translationSource)){const a=document.createElement('a');a.href=item.translationSource;a.textContent='释义来源：'+(item.translationProvider||'MyMemory');details.append(a);}
 for(const definition of Array.isArray(item.definitions)?item.definitions:[]){if(!safeLink(definition.source))continue;const a=document.createElement('a');a.href=definition.source;a.target='_blank';a.rel='noopener';a.textContent='词义来源 '+(definition.license?.name||'');details.append(a);}
 return details;
}
async function renderNewWord(q,version){
 if(markReviewExposure('lookup','lookup-query',q))save();
 const form=document.createElement('form');form.className='new-word';
 const title=document.createElement('h3');title.className='word';wordDisplay(title,{word:q});const phonetic=document.createElement('p');phoneticDisplay(phonetic,{word:q});const listen=document.createElement('button');listen.type='button';listen.className='secondary';listen.textContent='听发音';listen.onclick=()=>say({word:q,audio:enriched.audio},listen);
 const label=document.createElement('label');label.textContent='课本释义（可以自行填写）';
 const meaning=document.createElement('input');meaning.id='new-word-meaning';meaning.name='meaning';meaning.autocomplete='off';label.htmlFor=meaning.id;meaning.required=true;meaning.maxLength=500;meaning.placeholder='输入中文意思';
 const info=document.createElement('p');info.textContent='正在补充词义…';
 const spelling=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.required=true;spelling.append(check,document.createTextNode('我已确认这个单词或词组的拼写'));
 const submit=document.createElement('button');submit.textContent='确认拼写并记下';const cancel=document.createElement('button');cancel.type='button';cancel.className='quiet';cancel.textContent='换一个词';cancel.onclick=skipIntake;
 const attribution=document.createElement('a');attribution.href='https://mymemory.translated.net/';attribution.target='_blank';attribution.rel='noopener';attribution.textContent='翻译建议来源：MyMemory';const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='资料来源';details.append(summary,attribution);const phoneticNote=document.createElement('p');phoneticNote.textContent=pronunciationInfo({word:q}).note;phoneticNote.hidden=!phoneticNote.textContent;details.append(phoneticNote);
 form.append(title,phonetic,listen,label,meaning,info,spelling,submit,cancel,details);$('results').prepend(form);
 let enriched={definitions:[],audio:null};const previous=flow.lookupDraft?.query===q?flow.lookupDraft:null;meaning.value=previous?.meaning||'';check.checked=previous?.spelling||false;flow.lookupDraft={query:q,meaning:meaning.value,spelling:check.checked,mode:'new'};save();meaning.oninput=check.onchange=()=>{flow.lookupDraft={query:q,meaning:meaning.value,spelling:check.checked,mode:'new'};save();};
 form.onsubmit=e=>{e.preventDefault();if(!check.checked||!meaning.value.trim())return;
  const item={id:'custom-'+q.toLowerCase().replace(/\s+/g,' '),word:q,meaning:meaning.value.trim(),kind:q.includes(' ')?'phrase':'word',pages:[],audio:enriched.audio,ipa:enriched.ipa,ipaSource:enriched.ipa&&enriched.audio?.dialect==='en-US'?'dictionaryapi.dev':null,definitions:enriched.definitions,translationSource:enriched.translation?.source||null,translationProvider:enriched.translation?.provider||'MyMemory',verification:'user_confirmed'};
  chooseWord(item);rememberDraft();
 };
 try{
  const r=await fetch(base+'/api/lookup?q='+encodeURIComponent(q),{signal:AbortSignal.timeout(6500)});
  if(!r.ok)throw Error();const data=await r.json();if(version!==searchVersion||!form.isConnected)return;
  enriched=data;
  phoneticDisplay(phonetic,{...data,word:q,ipaSource:'dictionaryapi.dev'});
  const pronunciation=pronunciationInfo({...data,word:q,ipaSource:'dictionaryapi.dev'});phoneticNote.textContent=pronunciation.note;phoneticNote.hidden=!pronunciation.note;
  if(data.translation){if(!meaning.value.trim()){meaning.value=data.translation.text;meaning.oninput();}info.textContent='已补充中文意思，可以按课本修改。';attribution.href=data.translation.source;attribution.textContent='释义来源：'+(data.translation.provider||'MyMemory');}
  else info.textContent=data.definitions.length?'英文词典释义（点击可采用，也可填课本中文）：':'暂时没有找到释义，填上课本里的意思就可以添加。';
  for(const d of data.definitions){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=d.partOfSpeech+' · '+d.text;b.onclick=()=>{meaning.value='[英文释义] '+d.text;meaning.oninput();};info.append(b);}
 }catch{if(version===searchVersion)info.textContent='暂时查不到释义，仍可填写课本意思后添加。';}
}
function candidate(item){if(markReviewExposure('lookup',item.id,item.word))save();const b=document.createElement('button');b.className='candidate secondary';b.textContent=item.word+' · '+item.meaning;b.onclick=()=>chooseWord(item);$('results').append(b);}
$('search').onsubmit=async e=>{
 e.preventDefault();const q=$('query').value.trim(),version=++searchVersion;if(!q)return;stashDraft(q);flow.undo=null;$('undo-bar').hidden=true;flow.draft=null;flow.phase='input';flow.lookupDraft={query:q,meaning:'',spelling:false,mode:'query'};flow.typedQuery=q;save();$('draft').hidden=true;
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
function restoreLookup(){if(view==='today'&&!flow.draft&&flow.lookupDraft&&['home','input'].includes(flow.phase)&&!flow.suspended){$('query').value=flow.lookupDraft.query;$('results').replaceChildren();if(flow.lookupDraft.mode==='query')void $('search').onsubmit({preventDefault(){}});else void renderNewWord(flow.lookupDraft.query,++searchVersion);}}
if(window.matchMedia?.('(max-width:760px)')?.matches)$('rail-details').open=false;
$('query').value=flow.typedQuery||flow.lookupDraft?.query||flow.draft?.word||'';$('query').oninput=()=>{flow.undo=null;$('undo-bar').hidden=true;flow.typedQuery=$('query').value;save();};
$('nav-book').onclick=()=>openBook();
$('review-details').onclick=()=>{if(flow.phase==='review'){flow.recall='hint';save();openBook(flow.reviewIds[flow.position]);}};
function filterBook(){for(const [id,k] of [['book-query','query'],['book-state','status'],['book-filter-list','list'],['book-since','since'],['book-sort','sort']])bookState[k]=$(id).value;bookState.page=0;$('word-detail').hidden=true;$('book-list').hidden=false;$('book-browse').hidden=false;renderBook();save();}
for(const id of ['book-state','book-filter-list','book-since','book-sort'])$(id).onchange=filterBook;
$('clear-filters').onclick=()=>{$('word-detail').hidden=true;$('book-list').hidden=false;$('book-browse').hidden=false;Object.assign(bookState,{query:'',status:'',list:'',since:'',sort:'recent',page:0});renderBook();save();};
for(const [id,d] of [['book-prev',-1],['book-next',1]])$(id).onclick=()=>{bookState.page+=d;renderBook();save();$('book-query').focus();};
function skipIntake(){if(flow.fromIntake&&flow.intake?.length)flow.intake.shift();flow.fromIntake=false;nextInput();if(flow.intake?.length)void nextIntake();}
async function nextIntake(){if(!flow.intake?.length||flow.phase==='review')return;flow.fromIntake=true;const entry=flow.intake[0];$('query').value=typeof entry==='string'?entry:entry.word;flow.listName=entry.list||flow.listName;await $('search').onsubmit({preventDefault(){}});}
$('batch-words').value=flow.intakeText||'';$('list-name').value=flow.listName||day();
$('batch-words').oninput=()=>{flow.intakeText=$('batch-words').value;save();};$('list-name').oninput=()=>{flow.listName=$('list-name').value.trim();save();};
$('batch-form').onsubmit=e=>{e.preventDefault();const words=[...new Set($('batch-words').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];if(!words.length||words.length>100||words.some(x=>!/^[A-Za-z][A-Za-z '\-]{0,79}$/.test(x))){$('status').textContent='请输入1–100个英文单词或词组，一行一个，单行最多80字符。';return;}const list=$('list-name').value.trim()||day();const queued=new Set(flow.intake.map(x=>typeof x==='string'?x:x.word));flow.intake.push(...words.filter(x=>!queued.has(x)).map(word=>({word,list})));flow.intakeText='';$('batch-words').value='';save();render();if(!flow.draft&&!flow.lookupDraft)void nextIntake();else $('status').textContent='已追加词单，当前核对内容保留。';};
$('backup-download').onclick=$('export').onclick;$('export').onclick=()=>{openBook();$('backup').open=true;$('backup-download').focus();};
$('import-file').onchange=async()=>{importPreview=null;$('import-confirm').disabled=true;try{const file=$('import-file').files?.[0];if(!file)return;if(file.size>10000000)throw Error('备份超过10MB。');importPreview=previewImport(await file.text(),state);$('import-status').textContent=`新增 ${importPreview.additions.length} 个义项；冲突 ${importPreview.conflicts.length} 个；重复 ${importPreview.duplicates.length} 个。未确认前不会修改数据。`;$('import-preview').replaceChildren(...importPreview.conflicts.slice(0,20).map(x=>{const p=document.createElement('p');p.textContent=x.word+'：本机 '+itemById(x.id).meaning+' / 文件 '+x.meaning;return p;}));$('import-confirm').disabled=false;}catch(e){$('import-status').textContent=e.message;}};
$('import-confirm').onclick=()=>{if(!importPreview)return;mergeLatest();const n=applyImport(state,importPreview,$('import-conflicts').checked);getSessions(state);importPreview=null;$('import-confirm').disabled=true;save();renderBook();$('import-status').textContent=`已合并 ${n} 个新义项，本机进度和未完成任务保留。`;};
const reviewUI=createReviewUI({document,state,getFlow:()=>sessions.due,save,render,start:()=>{stopAudio();flow=activateSession(state,'due');flow.phase='review';delete flow.suspended;view='today';save();render();($('review-prompt')||$('prompt'))?.focus();},home:()=>switchView('due'),learn:continueLearning,say,stopAudio,wordDisplay,phoneticDisplay,undo:()=>{flow=activateSession(state,'due');$('undo').onclick();}});
render();restoreLookup();if(view==='today'&&!flow.draft&&!flow.lookupDraft&&flow.intake.length&&flow.phase!=='review')void nextIntake();

function renderHome(){
 showPanel('home');const f=sessions.learning,stats=dailyStats(state);$('home-stats').textContent=`今天新增 ${stats.added} 个义项，完成 ${stats.groups} 组回顾，练过 ${stats.reviewed} 个义项。`;
 $('home-pending').textContent=`待核对 ${f.intake.length+f.draftQueue.length+(!f.fromIntake&&(f.draft||f.lookupDraft||f.typedQuery)?1:0)} 个 · 待学 ${f.waiting.length} 个 · 待初次回顾 ${f.recapQueue.length+(f.pending.length?1:0)} 组${f.day!==day()?'（含上次未完成）':''}`;
 const d=sessions.due;$('home-due').textContent=d.phase==='review'?`继续复习 · 已完成 ${Math.min(d.position,d.reviewInitialCount)} / ${d.reviewInitialCount}`:`到期复习 · ${dueItems(state.items).length} 个义项`;
}
function addNew(){
 if(view!=='today'||flow.phase==='review')state.addReturn={view,session:state.activeSession};
 stopAudio();searchVersion++;flow=activateSession(state,'learning');parkLearning(flow);view='today';$('query').value='';$('results').replaceChildren();$('batch-words').value=flow.intakeText||'';save();render();$('single-entry').open=true;$('query').focus();$('status').textContent='上次进度已保留，可以继续添加新词。';
}
function continueLearning(){
 stopAudio();searchVersion++;flow=activateSession(state,'learning');resumeLearning(flow);view='today';$('query').value=flow.typedQuery||flow.lookupDraft?.query||flow.draft?.word||'';save();render();restoreLookup();
 if(!flow.draft&&!flow.lookupDraft&&flow.phase!=='review'){
  if(flow.waiting.length){const id=flow.waiting[0],item=itemById(id);if(item){chooseWord(item);return;}}
  if(flow.intake.length){void nextIntake();return;}
 }
 if(flow.phase==='review')focusReview();else if(flow.draft)$('draft-word').focus();else $('query').focus();
}
$('add-new').onclick=$('home-add').onclick=addNew;$('home-continue').onclick=$('today-learn').onclick=continueLearning;
$('home-due').onclick=()=>switchView('due');$('return-home').onclick=()=>switchView('home');
$('saved-drafts').onclick=()=>{parkLearning(flow);const draft=flow.draftQueue.shift();if(draft)Object.assign(flow,draft,{phase:draft.draft?'study':'input'});$('query').value=flow.typedQuery||'';save();render();restoreLookup();};
$('save-waiting').onclick=()=>{if(!flow.draft)return;flow.draft.meaning=$('draft-meaning').value.trim();if(!saveWaiting(state,flow))return;if(flow.fromIntake)flow.intake.shift();flow.fromIntake=false;save();render();$('status').textContent='已保存到待学，没有计为已学习。';const back=state.addReturn;delete state.addReturn;if(back?.session==='due'&&back.view==='today'){flow=activateSession(state,'due');view='today';save();render();focusReview();}else if(flow.intake.length)void nextIntake();};

function stashDraft(nextQuery){
 if(flow.draft||flow.lookupDraft&&flow.lookupDraft.query!==nextQuery){
  if(flow.fromIntake)flow.intake.shift();
  flow.draftQueue.push({draft:flow.draft,lookupDraft:flow.lookupDraft,typedQuery:flow.draft?.word||flow.lookupDraft?.query||flow.typedQuery,fromIntake:false,listName:flow.listName,draftList:flow.draftList});
  flow.draft=null;flow.lookupDraft=null;flow.fromIntake=false;
 }
}



// Sync never blocks learning. The original local JSON is kept outside the live state.
function applyCloudState(next,paint=true){
 getSessions(next);
 const changed=JSON.stringify(state.sessions)!==JSON.stringify(next.sessions)||state.activeSession!==next.activeSession;
 const itemsChanged=JSON.stringify(state.items)!==JSON.stringify(next.items);
 const currentBook=state.bookState,currentFilters=state.reviewFilters;Object.assign(state,next);state.bookState=currentBook;state.reviewFilters=currentFilters;
 if(next.sessions){Object.assign(sessions,next.sessions);state.sessions=sessions;flow=sessions[state.activeSession==='due'?'due':'learning'];state.flow=flow;}
 if(changed&&!bookEditId){stopAudio();searchVersion++;view=state.workspaceView||'home';}
 if(paint&&!bookEditId&&(changed||itemsChanged)){render();if(changed)restoreLookup();}
 if(paint)renderSyncBranches();
}
function renderSyncBranches(){
 const target=$('sync-branches');target.replaceChildren();
 for(const task of state.cloud?.tasks||[]){if(task.id===state.cloud.selected)continue;
  const row=document.createElement('p'),button=document.createElement('button');button.className='quiet';
  button.textContent='继续另一份未完成进度'+(task.at?'（'+new Date(task.at).toLocaleString('zh-CN')+'）':'');button.onclick=()=>{save();const next=JSON.parse(JSON.stringify(state));if(restoreTask(next,task.id)){applyCloudState(next);save();$('sync-status').textContent='已恢复这份进度，其他进度仍保留。';}};
  row.append(button);target.append(row);
 }
}
sync=createSync({storage,base,getState:()=>state,applyState:applyCloudState,fetcher:fetch,setTimer:setTimeout,clearTimer:clearTimeout,onStatus:(text,kind)=>{const extra=Math.max(0,(state.cloud?.tasks?.length||0)-1);$('sync-status').textContent=text+(extra?' · 另有 '+extra+' 份进度，可展开云同步继续':'');$('sync-status').dataset.kind=kind;}});
$('sync-connect').onsubmit=e=>{e.preventDefault();try{sync.unlock($('sync-key').value.trim(),$('sync-remember').checked);$('sync-key').value='';}catch(error){$('sync-status').textContent=error.message;$('sync-key').focus();}};
$('sync-now').onclick=()=>void sync.run();
window.addEventListener?.('online',()=>void sync.run());
window.addEventListener?.('focus',()=>void sync.run());
window.addEventListener?.('storage',e=>{if(e.key==='word-learning-v1'){sync.capture();mergeLatest();render();renderSyncBranches();void sync.run();}});
renderSyncBranches();sync.start();

$('backup-original').onclick=()=>{const raw=storage?.getItem('word-learning-before-cloud-v1');if(!raw){$('import-status').textContent='未找到升级前备份，请下载当前完整备份。';return;}const u=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='word-learning-before-cloud.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
