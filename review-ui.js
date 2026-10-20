import {MODES,SKILLS,skillFor,filterReviewItems,startRound,currentQuestion,addHint,submitQuestion,advanceQuestion,roundSummary,evidence} from './review.js?v=370c24f7e6e3012c';
import {getUseQuestion,useQuestionCoverage} from './review-content.js?v=6ce6a947486b19f4';

export function createReviewUI({document:doc,state,getFlow,save,render,start,home,learn,say,stopAudio,wordDisplay,phoneticDisplay,undo}){
 const el=(tag,text,attrs={})=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;for(const [k,v] of Object.entries(attrs))k==='class'?n.className=v:n.setAttribute(k,v);return n;};
 const button=(text,fn,kind='secondary',id)=>{const b=el('button',text,{class:kind,...(id?{id}:{})});b.type='button';b.onclick=fn;return b;};
 const p=(text,cls='muted')=>el('p',text,{class:cls,...(cls==='review-feedback'?{role:'status','aria-live':'polite'}:{})});
 function select(label,entries,value,onchange,id){const box=el('label',label);const input=el('select',undefined,{id,name:id});for(const [v,t] of entries){const o=el('option',t);o.value=v;input.append(o);}input.value=value;input.onchange=()=>onchange(input.value);box.append(input);return box;}
 function field(label,value,type,onchange,id){const box=el('label',label),input=el('input',undefined,{id,type,name:id,autocomplete:'off'});input.value=value||'';input.onchange=()=>onchange(input.value);box.append(input);return box;}
 const config=state.reviewFilters||={scope:'recommended',mode:'integrated',size:10,query:'',list:'',dateType:'added',since:'',until:'',selected:[],page:0};
 let filtersOpen=false;
 const scopeLabels={recommended:'推荐：到期与薄弱',added:'今日新增（含待学）',practiced:'今日练过',wrong:'错题与提示',all:'全部词本'};
 function eligible(){return filterReviewItems(state.items,config).filter(item=>config.mode!=='use'||getUseQuestion(item));}
 function choose(items){const ids=new Set(config.selected||[]);return ids.size?items.filter(x=>ids.has(x.id)):items;}
 function begin(items=choose(eligible())){
  const f=getFlow();if(f.phase==='review'||f.suspended==='review'){start();return;}
  if(!items.length)return;
  startRound(f,items,config);stopAudio();start();
 }
 function homeView(target){
  const focused=doc.activeElement?.id;filtersOpen=doc.getElementById('review-filter-details')?.open??filtersOpen;target.replaceChildren();const f=getFlow(),continuing=f.phase==='review'||f.suspended==='review',rows=eligible(),selected=choose(rows);
  target.append(el('h1','把薄弱的一点，再练清楚。'),p('每轮只选一小组，按词义、听辨、拼写和用法分别记录。自评不会当作客观正确。'));
  if(f.reviewVersion===2&&f.phase==='finished')summaryView(target,f);
  const count=el('p',`${scopeLabels[config.scope]} · ${rows.length} 个义项${config.selected.length?' · 已选 '+selected.length+' 个':''}`,{id:'review-scope-count'});target.append(count);
  const primary=button(continuing?'继续这轮复习':config.mode==='integrated'?'开始综合复习':'开始'+MODES[config.mode],()=>begin(),'primary','review-start');primary.disabled=!continuing&&!selected.length;target.append(primary);
  if(continuing)target.append(p('已有一轮未完成。先继续原来的题目、输入和提示；本页设置用于下一轮。'));
  const options=el('div',undefined,{class:'review-options'});
  options.append(select('练习方式',Object.entries(MODES),config.mode,value=>{config.mode=value;config.page=0;save();homeView(target);},'review-mode'),select('每轮义项数',[['5','5 个'],['10','10 个'],['20','20 个']],String(config.size),value=>{config.size=Number(value);save();},'review-size'),select('复习范围',Object.entries(scopeLabels),config.scope,value=>{config.scope=value;config.selected=[];config.page=0;save();homeView(target);},'review-scope'));
  target.append(options);
  const waiting=selected.filter(x=>['waiting','initial'].includes(x.learningStatus)).length;
  if(waiting){target.append(p(`范围中有 ${waiting} 个待学或待初次回顾义项。开始本轮即直接诊断；看题、听音和揭晓都不算已学。`),button('先学习待学词',learn,'quiet','review-learn-first'));}
  if(config.mode==='use')target.append(p('只显示已核对的课本词组填空。按原词组恢复缺词，不评价其他自由表达。未匹配来源词义的词不出题。'));
  if(!rows.length)target.append(p('这个范围暂时没有可练的词。可以换成“今日新增”或“全部词本”，也可以添加新词。','review-empty'));
  const details=el('details',undefined,{id:'review-filter-details'});details.open=filtersOpen;details.ontoggle=()=>{filtersOpen=details.open;};details.append(el('summary','筛选、搜索与勾选词义'));
  const controls=el('div',undefined,{class:'review-options'}),change=(key,value)=>{config[key]=value;config.page=0;config.selected=[];save();homeView(target);};
  const lists=[...new Set(state.items.flatMap(i=>[...(i.lists||[]),...(i.sourceId?[i.sourceId]:[])]))].sort();
  controls.append(field('英文或中文搜索',config.query,'search',value=>change('query',value),'review-query'),select('词单 / 单元',[['','全部词单'],...lists.map(x=>[x,x==='6a-u2-family-ties'?'6A U2 Family ties':x])],config.list,value=>change('list',value),'review-list'),select('日期依据',[['added','添加日期'],['practiced','实际练习日期']],config.dateType,value=>change('dateType',value),'review-date-type'),field('起始日期',config.since,'date',value=>change('since',value),'review-since'),field('截止日期',config.until,'date',value=>change('until',value),'review-until'));
  details.append(controls);const pageCount=Math.max(1,Math.ceil(rows.length/20));config.page=Math.min(config.page,pageCount-1);
  details.append(button('选择全部筛选结果',()=>{config.selected=rows.map(x=>x.id);save();homeView(target);},'quiet','review-select-all'),button('清除勾选',()=>{config.selected=[];save();homeView(target);},'quiet','review-clear-selection'));
  const list=el('div',undefined,{class:'review-picker'});
  for(const item of rows.slice(config.page*20,(config.page+1)*20)){
   const label=el('label',undefined,{class:'review-check'}),check=el('input',undefined,{type:'checkbox',id:'review-check-'+item.id,name:'review-sense',value:item.id});check.checked=config.selected.includes(item.id);
   check.onchange=()=>{config.selected=check.checked?[...new Set([...config.selected,item.id])]:config.selected.filter(x=>x!==item.id);save();homeView(target);};
   label.append(check,el('span',item.word+' · '+item.meaning));list.append(label);
  }details.append(list);
  const pages=el('div',undefined,{class:'row'}),previous=button('上一页',()=>{config.page--;save();homeView(target);},'quiet','review-prev'),next=button('下一页',()=>{config.page++;save();homeView(target);},'quiet','review-next');previous.disabled=config.page===0;next.disabled=config.page>=pageCount-1;pages.append(previous,p(`${config.page+1} / ${pageCount} 页，每页20个义项`),next);details.append(pages);target.append(details);if(focused)doc.getElementById(focused)?.focus();
 }
 function summaryView(target,f){
  const s=roundSummary(f),wrap=el('div',undefined,{class:'review-summary',id:'review-summary'});
  wrap.append(el('h2','这一轮完成了'),p(`基础 ${s.baseDone} / ${s.baseTotal} · 加练 ${s.extraDone} / ${s.extraTotal}`),p(`独立客观正确 ${s.independent} 次 · 用过提示 ${s.hinted} 次 · 答错或自评未想起 ${s.wrong} 次 · 自评 ${s.selfRated} 次 · 跳过 ${s.skipped} 次`));
  if(s.weakIds.length){wrap.append(p('还需要留意：'+s.weakIds.map(id=>state.items.find(x=>x.id===id)?.word).filter(Boolean).join('、')),button('再练薄弱词',()=>{startRound(getFlow(),s.weakIds.map(id=>state.items.find(x=>x.id===id)).filter(Boolean),{...config,mode:f.mode});start();},'secondary','review-retry'));}
  wrap.append(p('同一轮重试和提示后的答对不增加独立成功；不同技能分别安排复习。'));
  if(f.undo)wrap.append(button('撤销最后一题',undo,'quiet','review-summary-undo'));
  wrap.append(button('结束本轮，返回今日',()=>{stopAudio();doc.getElementById('nav-today').click();},'quiet','review-finish'));target.append(wrap);
 }
 function questionView(target){
  const f=getFlow(),snapshot=currentQuestion(f),item=state.items.find(x=>x.id===snapshot?.id);
  const q=snapshot&&new Proxy(snapshot,{get:(_,key)=>currentQuestion(getFlow())?.[key],set:(_,key,value)=>{const live=currentQuestion(getFlow());if(live)live[key]=value;return true;}});if(!q||!item){home();return;}
  target.replaceChildren();const s=roundSummary(f),use=q.mode==='use'?getUseQuestion(item):null,typed=['spelling','dictation','use'].includes(q.mode),revealed=q.revealed||Boolean(q.result);
  target.append(p(`${MODES[q.mode]} · 基础 ${s.baseDone} / ${s.baseTotal} · 加练 ${s.extraDone} / ${s.extraTotal}`));
  const title=el('h1',undefined,{id:'review-prompt',tabindex:'-1',class:q.mode==='meaning'?'word':'review-prompt'});
  if(q.mode==='meaning')wordDisplay(title,item);else title.textContent=q.mode==='spelling'?item.meaning:q.mode==='use'?use?.prompt||'题目已变更，请跳过':'先听发音，再'+(q.mode==='dictation'?'写出英文':'回想词义');
  target.append(title);
  const audio=button(q.mode==='spelling'||q.mode==='use'?'听发音（记作提示）':'听发音',()=>{if(['spelling','use'].includes(q.mode))addHint(getFlow(),'audio');save();say(item,audio);},'secondary','review-audio');target.append(audio);
  if(!q.result){
   if(typed){const form=el('form',undefined,{id:'review-answer-form'}),label=el('label','你的答案',{for:'review-input'}),input=el('input',undefined,{id:'review-input',name:'review-answer',autocomplete:'off',spellcheck:'false',autocapitalize:'none',autocorrect:'off',maxlength:'200'});input.value=q.input;input.oninput=()=>{q.input=input.value;save();};const submit=button('核对答案',()=>{},'primary','review-submit');submit.type='submit';form.onsubmit=e=>{e.preventDefault();q.input=input.value;if(submitQuestion(state,getFlow(),'submit')){stopAudio();save();render();doc.getElementById('review-next-question')?.focus();}else {input.focus();if(['dictation','listening'].includes(q.mode)&&!q.audioPlayed)doc.getElementById('audio-status').textContent='请先成功播放发音。无法播放时可以切换题型或跳过，不计错。';}};form.append(label,input,submit);target.append(form,p('按本义项或课本原词组填写。空白会整理；大小写、连字符和单词都需要保留。'));}
   if(!typed&&!revealed)target.append(button('已经回想，揭晓核对',()=>{q.revealed=true;save();render();doc.getElementById('review-self-remember')?.focus();},'primary','review-reveal'));
   if(!revealed)target.append(button('需要答案提示',()=>{addHint(getFlow(),'answer');q.revealed=true;save();render();},'quiet','review-hint'));
  }
  if(revealed){
   const answer=el('div',undefined,{id:'review-answer'}),word=el('h2',undefined,{class:'word'}),ipa=el('p');wordDisplay(word,item);phoneticDisplay(ipa,item);answer.append(word,ipa,p(item.meaning,'meaning'));if(use)answer.append(p('本题参考答案：'+use.answers.join(' / ')),p(use.source));target.append(answer);
   if(!typed&&!q.result){target.append(p('这是词义自评，不能作为客观测验正确。'),button('和我想的对上了',()=>finishSelf('remember'),'primary','review-self-remember'),button('没想起 / 想错了',()=>finishSelf('forgot'),'secondary','review-self-forgot'));}
  }
  if(q.result){const message={correct:q.result.independent?'独立答对。':'答对了；本日或本轮已练过，不重复增加独立成功。',hinted:'借助提示答对，之后再独立练一次。',wrong:'这次和本义项的参考答案不同。看清后再练。','self-rated':'已记录你的自评。',skip:'已跳过，不记作答错。'}[q.result.outcome];const ability=evidence(item,skillFor(q.mode));target.append(p(`${SKILLS[skillFor(q.mode)]}：跨日独立客观成功 ${ability.independentDays} 天${ability.due?'；下次 '+new Date(ability.due).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}):''}`),p(message,'review-feedback'),button('下一题',()=>{stopAudio();advanceQuestion(getFlow(),state.items);save();if(getFlow().phase==='finished')home();else{render();doc.getElementById('review-prompt')?.focus();}},'primary','review-next-question'));}
  else {target.append(button('跳过，不计错',()=>{submitQuestion(state,getFlow(),'skip');save();render();},'quiet','review-skip'));if(['listening','dictation'].includes(q.mode))target.append(button('发音不可用，改用看词义拼写',()=>{stopAudio();if(q.revealed)addHint(getFlow(),'revealed-before-switch');q.mode='spelling';q.input='';q.revealed=false;q.audioPlayed=false;save();render();},'quiet','review-audio-unavailable'));}
  target.append(p('打开词本会把本轮未答题记作提示；查看同词的学习卡也会保留提示记录。'));target.append(button('保存进度，返回复习',()=>{stopAudio();home();},'quiet','review-pause'));if(f.undo)target.append(button('撤销上一笔',undo,'quiet','review-undo'));
  function finishSelf(rating){if(['listening','dictation'].includes(q.mode)&&!q.audioPlayed){doc.getElementById('audio-status').textContent='请先成功播放发音；无法播放时可以换题型或跳过，不计错。';return;}if(submitQuestion(state,getFlow(),rating)){stopAudio();save();render();doc.getElementById('review-next-question')?.focus();}}
 }
 return {homeView,questionView,startItems:items=>begin(items)};
}
