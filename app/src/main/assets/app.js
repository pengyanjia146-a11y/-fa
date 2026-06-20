'use strict';

const STORE = 'student_reflect_record_stats_v2';
const DATA_VERSION = 7;
const FIELD_IDS = ['qualityScore','bodyScore','gain','problem','tomorrow'];
const SYS_VIOLATION = 'SYS_AUTO_VIOLATION';
const SYS_ALLOWED = 'SYS_ALLOWED_APP';
const SYS_PENDING = 'SYS_PENDING_LEAVE';
const GROUPS = {
  study:'学习投入', deep:'深度学习', entertainment:'娱乐', allowed:'允许应用', life:'生活', sleep:'睡眠', exercise:'运动', other:'其他', pending:'息屏/待判定', violation:'自动违规'
};
const DEFAULT_APP_TYPES = [
  {id:'wechat', name:'微信必要沟通', severity:0, allowed:true, system:true},
  {id:'studyapp', name:'学习类应用', severity:0, allowed:true, study:true, system:true},
  {id:'game', name:'游戏/游戏软件', severity:3, allowed:false},
  {id:'shortvideo', name:'短视频/娱乐刷屏', severity:3, allowed:false},
  {id:'browser', name:'浏览器/网页跑偏', severity:1.5, allowed:false},
  {id:'chat', name:'非必要聊天', severity:2, allowed:false},
  {id:'video', name:'音乐/视频/影视', severity:2.5, allowed:false},
  {id:'tool', name:'工具类但跑偏', severity:1, allowed:false},
  {id:'other', name:'其他应用', severity:1.5, allowed:false},
  {id:'unknown', name:'未分类应用', severity:2, allowed:false, system:true}
];
const DEFAULT_CATS = [
  {id:'study', name:'普通学习', group:'study', system:true},
  {id:'deep', name:'深度学习', group:'deep', system:true},
  {id:'game', name:'游戏娱乐', group:'entertainment', system:true},
  {id:'wechat', name:'微信必要沟通', group:'allowed', system:true},
  {id:'sleep', name:'睡眠', group:'sleep', system:true},
  {id:'rest', name:'休息', group:'life', system:true},
  {id:'meal', name:'吃饭', group:'life', system:true},
  {id:'exercise', name:'运动', group:'exercise', system:true},
  {id:'commute', name:'通勤', group:'life', system:true},
  {id:'other', name:'其他', group:'other', system:true},
  {id:'pending', name:'息屏/待判定离开', group:'pending', system:true, hidden:true},
  {id:'violation', name:'学习违规离开', group:'violation', system:true, hidden:true}
];
const DEFAULT_SUBJECTS = [
  {id:'sub_math', name:'数学', system:true},
  {id:'sub_english', name:'英语', system:true},
  {id:'sub_chinese', name:'语文', system:true},
  {id:'sub_physics', name:'物理', system:true},
  {id:'sub_chemistry', name:'化学', system:true},
  {id:'sub_biology', name:'生物', system:true},
  {id:'sub_history', name:'历史/政治/地理', system:true},
  {id:'sub_general', name:'综合/其他', system:true},
  {id:'sub_none', name:'非学习', system:true}
];
const DEFAULT_STATES = [
  {id:'st_english', name:'英语学习', cat:'study', subject:'sub_english'},
  {id:'st_math', name:'数学学习', cat:'study', subject:'sub_math'},
  {id:'st_science', name:'理化/文综', cat:'study', subject:'sub_general'},
  {id:'st_other_study', name:'其他学习', cat:'study', subject:'sub_general'},
  {id:'st_deep', name:'深度学习', cat:'deep', subject:'sub_general'},
  {id:'st_game', name:'游戏娱乐', cat:'game', subject:'sub_none'},
  {id:'st_wechat', name:'微信必要沟通', cat:'wechat', subject:'sub_none'},
  {id:'st_meal', name:'吃饭', cat:'meal', subject:'sub_none'},
  {id:'st_rest', name:'休息', cat:'rest', subject:'sub_none'},
  {id:'st_sleep', name:'睡眠', cat:'sleep', subject:'sub_none'},
  {id:'st_exercise', name:'运动', cat:'exercise', subject:'sub_none'},
  {id:'st_commute', name:'通勤', cat:'commute', subject:'sub_none'},
  {id:'st_other', name:'其他', cat:'other', subject:'sub_none'},
  {id:SYS_VIOLATION, name:'自动记录：学习违规离开', cat:'violation', system:true, hidden:true, subject:'sub_none'},
  {id:SYS_PENDING, name:'自动记录：息屏/待判定离开', cat:'pending', system:true, hidden:true, subject:'sub_none'},
  {id:SYS_ALLOWED, name:'自动记录：允许应用沟通', cat:'wechat', system:true, hidden:true}
];
let app = {
  categories: DEFAULT_CATS.slice(),
  states: DEFAULT_STATES.slice(),
  subjects: DEFAULT_SUBJECTS.slice(),
  appTypes: DEFAULT_APP_TYPES.slice(),
  appRules: {},
  usage: [],
  history: [],
  current: {date:null, blocks:[], active:false, currentId:null, currentStartMs:null, dayStartMs:null, hidden:null, ended:false},
  permission: {usage:false, lastCheck:0}
};
let currentPage = 'Record';

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, Number.isFinite(v) ? v : a)); }
function nowMs(){ return Date.now(); }
function pad(n){ return String(n).padStart(2,'0'); }
function localDate(ms){ const d = ms ? new Date(ms) : new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function dateBaseMs(date){ const a = date.split('-').map(Number); return new Date(a[0],a[1]-1,a[2],0,0,0,0).getTime(); }
function fmtTime(ms){ const d = new Date(ms); return pad(d.getHours())+':'+pad(d.getMinutes()); }
function fmtDateTime(ms){ return localDate(ms)+' '+fmtTime(ms); }
function fmtDur(min){ min = Math.max(0, Math.round(min||0)); const h = Math.floor(min/60), m = min%60; return h ? (h+'h'+m+'m') : (m+'m'); }
function durMin(s,e){ return Math.max(0, Math.round(((e||nowMs()) - (s||nowMs()))/60000)); }
function fmtClock(ms){
  let sec = Math.max(0, Math.floor((ms||0)/1000));
  const h = Math.floor(sec/3600); sec %= 3600;
  const m = Math.floor(sec/60); const s = sec%60;
  return (h>0 ? (pad(h)+':') : '') + pad(m)+':'+pad(s);
}
function durationClock(s,e){ return fmtClock((e||nowMs()) - (s||nowMs())); }
function currentDayStartMs(){
  if(app.current && app.current.dayStartMs) return app.current.dayStartMs;
  const bs = (app.current && app.current.blocks || []).filter(b=>b && b.s).map(b=>b.s);
  if(app.current && app.current.currentStartMs) bs.push(app.current.currentStartMs);
  return bs.length ? Math.min.apply(null, bs) : nowMs();
}
function uid(prefix){ return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6); }
function norm(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
function overlapMs(a,b,c,d){ return Math.max(0, Math.min(b,d) - Math.max(a,c)); }
function parseTimeOnDate(date,hhmm){ const p = hhmm.split(':').map(Number); return dateBaseMs(date) + p[0]*3600000 + p[1]*60000; }
function toast(msg){
  const d=document.createElement('div'); d.textContent=msg;
  d.style.cssText='position:fixed;left:50%;bottom:72px;transform:translateX(-50%);background:#111827;color:white;padding:10px 14px;border-radius:999px;z-index:99;font-size:13px;max-width:88%;text-align:center';
  document.body.appendChild(d); setTimeout(()=>d.remove(),1700);
}
function catById(id){ return (app.categories||[]).find(x=>x.id===id) || DEFAULT_CATS.find(x=>x.id===id) || {id:'other',name:'其他',group:'other'}; }
function stateById(id){ return (app.states||[]).find(x=>x.id===id) || {id:'missing',name:'未知状态',cat:'other'}; }
function catOfState(id){ return catById(stateById(id).cat); }
function groupOfState(id){ return catOfState(id).group || 'other'; }
function subjectById(id){ return (app.subjects||[]).find(x=>x.id===id) || DEFAULT_SUBJECTS.find(x=>x.id===id) || {id:'sub_general',name:'综合/其他'}; }
function guessSubjectId(name){ const n=String(name||''); if(/数学|函数|几何|代数/.test(n)) return 'sub_math'; if(/英语|英文|单词|阅读|听力|作文/.test(n)) return 'sub_english'; if(/语文|文言|作文|古诗/.test(n)) return 'sub_chinese'; if(/物理/.test(n)) return 'sub_physics'; if(/化学/.test(n)) return 'sub_chemistry'; if(/生物/.test(n)) return 'sub_biology'; if(/历史|政治|地理|文综/.test(n)) return 'sub_history'; return 'sub_general'; }
function subjectOfState(id){ const s=stateById(id); const g=groupOfState(id); if(g!=='study' && g!=='deep') return subjectById('sub_none'); return subjectById(s.subject || guessSubjectId(s.name)); }
function selectableSubjects(){ return (app.subjects||[]).filter(x=>!x.hidden && x.id!=='sub_none'); }
function nameOfState(id){ return stateById(id).name || id; }
function appTypeById(id){ return (app.appTypes||[]).find(x=>x.id===id) || app.appTypes.find(x=>x.id==='unknown') || {id:'unknown',name:'未分类应用',severity:2,allowed:false}; }
function selectableStates(){ return (app.states||[]).filter(s => !s.hidden && catById(s.cat).group !== 'violation'); }
function selectableCats(){ return (app.categories||[]).filter(c => !c.hidden && c.group !== 'violation'); }
function isLearningState(id){ const g = groupOfState(id); return g === 'study' || g === 'deep'; }

function load(){
  try{ const raw = localStorage.getItem(STORE); if(raw) app = Object.assign(app, JSON.parse(raw)); }catch(e){ console.log(e); }
  if(!Array.isArray(app.categories) || !app.categories.length) app.categories = DEFAULT_CATS.slice();
  if(!Array.isArray(app.states) || !app.states.length) app.states = DEFAULT_STATES.slice();
  if(!Array.isArray(app.subjects) || !app.subjects.length) app.subjects = DEFAULT_SUBJECTS.slice();
  if(!Array.isArray(app.appTypes) || !app.appTypes.length) app.appTypes = DEFAULT_APP_TYPES.slice();
  if(!app.ui) app.ui = {selectedAppType:'studyapp'};
  if(!app.appRules) app.appRules = {};
  if(!Array.isArray(app.usage)) app.usage = [];
  if(!Array.isArray(app.history)) app.history = [];
  if(!app.current) app.current = {date:null, blocks:[], active:false, currentId:null, currentStartMs:null, hidden:null, ended:false};
  ensureSystemDefaults();
  migrateStateSubjects();
  normalizeOrders();
  FIELD_IDS.forEach(id => { const v = localStorage.getItem('f_'+id); if(v !== null && $(id)) $(id).value = v; });
}
function ensureSystemDefaults(){
  DEFAULT_CATS.forEach(x => { if(!app.categories.some(y=>y.id===x.id)) app.categories.push(x); });
  DEFAULT_SUBJECTS.forEach(x => { if(!app.subjects.some(y=>y.id===x.id)) app.subjects.push(x); });
  DEFAULT_STATES.filter(x=>x.system).forEach(x => { if(!app.states.some(y=>y.id===x.id)) app.states.push(x); });
  DEFAULT_APP_TYPES.forEach(x => { if(!app.appTypes.some(y=>y.id===x.id)) app.appTypes.push(x); });
}
function migrateStateSubjects(){
  (app.states||[]).forEach(st=>{
    const g=catById(st.cat).group;
    if(!st.subject) st.subject = (g==='study'||g==='deep') ? guessSubjectId(st.name) : 'sub_none';
  });
}
function normalizeOrders(){
  (app.states||[]).forEach((s,i)=>{ if(typeof s.order !== 'number') s.order = i; });
  app.states.sort((a,b)=>(a.order||0)-(b.order||0));
  app.states.forEach((s,i)=>s.order=i);
}
function saveAll(){
  FIELD_IDS.forEach(id => { if($(id)) localStorage.setItem('f_'+id, $(id).value || ''); });
  app.usage = (app.usage || []).slice(-5000);
  localStorage.setItem(STORE, JSON.stringify(app));
}
function archiveToday(silent){
  const blocks = (app.current.blocks || []).slice(); if(!blocks.length) return;
  autoClassifyAll(false);
  const c = compute(blocks);
  const day = {date:app.current.date || localDate(blocks[0].s), blocks:blocks, totals:c.totals, violations:c.violations, chain:c.chain, aspects:c.aspects, overall:c.overall, status:c.status, reflect:{quality:qualityValue(), body:bodyValue(), gain:val('gain'), problem:val('problem'), tomorrow:val('tomorrow')}};
  const idx = app.history.findIndex(d=>d.date===day.date);
  if(idx >= 0) app.history[idx] = day; else app.history.push(day);
  app.history.sort((a,b)=>a.date.localeCompare(b.date));
  if(!silent) toast('已保存到历史');
}

function initSelects(){
  const stateHtml = selectableStates().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'｜'+esc(catById(s.cat).name)+(isLearningState(s.id)?('｜'+esc(subjectOfState(s.id).name)):'')+'</option>').join('');
  ['stateSelect','manualModule'].forEach(id=>{ const el=$(id); if(!el) return; const old=el.value; el.innerHTML=stateHtml; if(old && selectableStates().some(s=>s.id===old)) el.value=old; });
  const catHtml = selectableCats().map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'｜'+esc(GROUPS[c.group]||c.group)+'</option>').join('');
  if($('newStateCat')) $('newStateCat').innerHTML = catHtml;
  const subjHtml = selectableSubjects().map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
  if($('newStateSubject')) $('newStateSubject').innerHTML = subjHtml;
  const groupHtml = Object.entries(GROUPS).filter(([k])=>k!=='violation').map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');
  if($('newCatGroup')) $('newCatGroup').innerHTML = groupHtml;
  const appTypeHtml = (app.appTypes||[]).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+(t.allowed?'｜允许':'｜违规')+'</option>').join('');
  if($('ruleAppType')) { $('ruleAppType').innerHTML = appTypeHtml; if(app.ui && app.ui.selectedAppType && app.appTypes.some(t=>t.id===app.ui.selectedAppType)) $('ruleAppType').value = app.ui.selectedAppType; else if(app.appTypes[0]) { $('ruleAppType').value = app.appTypes[0].id; app.ui.selectedAppType = app.appTypes[0].id; } }
  renderRuleAppTypePicker();
}
function bind(){
  const map = {
    startBtn:startDay, switchBtn:switchState, endBtn:endDay, manualAddBtn:addManualBlock,
    addCatBtn:addCategory, addSubjectBtn:addSubject, addStateBtn:addState, addAppTypeBtn:addAppType, addRuleBtn:addAppRule,
    importUsageBtn:importUsage, clearUsageBtn:clearUsage, syncUsageBtn:syncUsage, openUsageBtn:openUsageSettings, openUsageBtnTop:openUsageSettings, checkPermBtn:checkUsagePermission,
    saveReflectBtn:saveReflect, exportTextBtn:exportText, exportDataBtn:exportData, importDataBtn:importData, saveBackupBtn:saveBackupFile, loadBackupBtn:loadBackupFile, copyExportBtn:copyExportBox, selectExportBtn:selectExportBox,
    exportAppTypesBtn:exportAppTypesJson, saveAppTypesJsonBtn:saveAppTypesJsonFile, copyAppTypesJsonBtn:copyAppTypesJson, importAppTypesJsonBtn:importAppTypesJson,
    newDayBtn:newDay, clearAllBtn:clearAll
  };
  Object.entries(map).forEach(([id,fn])=>{ const el=$(id); if(el) el.addEventListener('click', fn); });
  ['Record','Timeline','Stats','Rules','Reflect'].forEach(p=>{ const el=$('nav'+p); if(el) el.addEventListener('click',()=>showPage(p)); });
  if($('periodSelect')) $('periodSelect').addEventListener('change', renderAll);
  FIELD_IDS.forEach(id => { const el=$(id); if(el) el.addEventListener('change', ()=>{ saveAll(); renderAll(); }); });
  document.addEventListener('visibilitychange', handleVisibility);
  window.onNativeResume = function(){ checkUsagePermission(); if(app.current.active) syncUsage(true); };
}

function handleVisibility(){
  if(!app.current || !app.current.active) return;
  if(document.hidden){
    if(isLearningState(app.current.currentId)){
      app.current.hidden = {s:nowMs(), module:app.current.currentId};
      saveAll();
    }
    return;
  }
  const h = app.current.hidden;
  if(!h) return;
  app.current.hidden = null;
  const end = nowMs();
  if(end - h.s < 15000){ saveAll(); return; }

  // 关键调整：息屏/锁屏不算逃离学习。只有在离开期间确实检测到“其他 App 使用记录”，才切出一段允许沟通或违规。
  // 如果没有使用情况权限，就生成“待判定离开”，不直接扣分；导入/读取使用记录后会自动归因。
  syncUsage(true);
  const probe = {s:h.s, e:end, m:SYS_PENDING};
  const match = bestUsageForBlock(probe);
  const hasPerm = !!(app.permission && app.permission.usage);

  if(!match && hasPerm){
    // 有权限但没查到其他 App 使用，基本视为息屏、锁屏、放下手机，不打断学习链。
    toast('息屏/未使用其他应用：不算逃离学习');
    saveAll(); renderAll(); return;
  }

  if(app.current.currentId === h.module && app.current.currentStartMs < h.s){
    app.current.blocks.push({s:app.current.currentStartMs, e:h.s, m:h.module});
    const vb = {s:h.s, e:end, m: match ? SYS_PENDING : SYS_PENDING, appType:'unknown', n: hasPerm ? '等待归因' : '缺少使用情况权限，暂不扣分；导入记录后自动归因', passive:true, from:h.module};
    app.current.blocks.push(vb);
    app.current.currentStartMs = end;
    app.current.currentId = h.module;
    autoClassifyBlock(vb);
    if(groupOfState(vb.m)==='violation') toast('已被动记录学习违规：'+fmtDur(durMin(h.s,end)));
    else if(groupOfState(vb.m)==='allowed') toast('已记录允许沟通：'+fmtDur(durMin(h.s,end)));
    else toast('已记录待判定离开：'+fmtDur(durMin(h.s,end)));
  }
  saveAll();
  autoClassifyAll(false);
  renderAll();
}

function startDay(){
  if(app.current.active){ toast('已经开始了'); return; }
  if((app.current.blocks||[]).length && !confirm('今天已有记录。重新开始会清空当前未归档时间轴，继续吗？')) return;
  const first = $('stateSelect').value || (selectableStates()[0] && selectableStates()[0].id);
  if(!first){ toast('请先添加一个可用状态'); return; }
  const n0=nowMs(); app.current = {date:localDate(), blocks:[], active:true, currentId:first, currentStartMs:n0, dayStartMs:n0, hidden:null, ended:false};
  saveAll(); renderAll(); toast('已开始今天');
}
function switchState(){
  if(!app.current.active){ toast('先点“开始今天”'); return; }
  const next = $('stateSelect').value;
  if(!next){ toast('没有可切换状态'); return; }
  const n = nowMs();
  if(app.current.currentId && app.current.currentStartMs < n){ app.current.blocks.push({s:app.current.currentStartMs, e:n, m:app.current.currentId}); }
  app.current.currentId = next; app.current.currentStartMs = n; app.current.hidden = null;
  saveAll(); renderAll(); toast('已切换到：'+nameOfState(next));
}
function endDay(){
  if(!app.current.active){ toast('还没有开始今天'); return; }
  if(!confirm('确认结束今天？结束后会归档到历史统计。')) return;
  const n = nowMs();
  if(app.current.currentId && app.current.currentStartMs < n) app.current.blocks.push({s:app.current.currentStartMs, e:n, m:app.current.currentId});
  app.current.active=false; app.current.currentId=null; app.current.currentStartMs=null; app.current.hidden=null; app.current.ended=true;
  autoClassifyAll(false); archiveToday(true); saveAll(); renderAll(); toast('今天已结束并归档');
}
function newDay(){
  if(app.current.active && !confirm('当前还在计时。确认结束并新开一天？')) return;
  if((app.current.blocks||[]).length) archiveToday(true);
  app.current = {date:localDate(), blocks:[], active:false, currentId:null, currentStartMs:null, dayStartMs:null, hidden:null, ended:false};
  ['gain','problem','tomorrow'].forEach(id=>{ if($(id)) $(id).value=''; localStorage.removeItem('f_'+id); });
  saveAll(); renderAll(); showPage('Record'); toast('已新开一天');
}
function clearAll(){
  if(!confirm('确认清空全部本地数据？这一步不可恢复。')) return;
  localStorage.removeItem(STORE); FIELD_IDS.forEach(id=>localStorage.removeItem('f_'+id));
  app = {categories:DEFAULT_CATS.slice(), states:DEFAULT_STATES.slice(), subjects:DEFAULT_SUBJECTS.slice(), appTypes:DEFAULT_APP_TYPES.slice(), appRules:{}, usage:[], history:[], current:{date:null, blocks:[], active:false, currentId:null, currentStartMs:null, dayStartMs:null, hidden:null, ended:false}, permission:{usage:false,lastCheck:0}, ui:{selectedAppType:'studyapp'}};
  saveAll(); renderAll(); toast('已清空');
}
function addManualBlock(){
  const s=$('manualStart').value, e=$('manualEnd').value, m=$('manualModule').value;
  if(!s || !e || !m){ toast('开始、结束、状态都要填'); return; }
  if(groupOfState(m)==='violation'){ toast('违规不能手动补录，只能由学习时离开前台被动生成'); return; }
  const date = app.current.date || localDate(); const sm=parseTimeOnDate(date,s), em=parseTimeOnDate(date,e);
  if(em <= sm){ toast('结束时间要晚于开始时间'); return; }
  app.current.date = date; app.current.blocks.push({s:sm,e:em,m:m,n:val('manualNote')});
  saveAll(); renderAll(); toast('已补录');
}

function addCategory(){
  const name = val('newCatName'); const group = $('newCatGroup').value;
  if(!name){ toast('分类名称不能为空'); return; }
  app.categories.push({id:uid('cat'), name, group}); $('newCatName').value='';
  saveAll(); initSelects(); renderAll(); toast('已添加分类');
}
function deleteCategory(id){
  const c = catById(id); if(c.system){ toast('系统分类不能删除'); return; }
  if(app.states.some(s=>s.cat===id)){ toast('这个分类下面还有状态，先删除或改状态'); return; }
  app.categories = app.categories.filter(x=>x.id!==id); saveAll(); renderAll();
}
function addSubject(){
  const name=val('newSubjectName');
  if(!name){ toast('学科名称不能为空'); return; }
  app.subjects.push({id:uid('sub'), name});
  $('newSubjectName').value=''; saveAll(); initSelects(); renderAll(); toast('已添加学科标签');
}
function deleteSubject(id){
  const sub=subjectById(id); if(sub.system){ toast('系统学科不能删除'); return; }
  if(app.states.some(s=>s.subject===id)){ toast('有状态正在使用这个学科，先改状态'); return; }
  app.subjects=app.subjects.filter(x=>x.id!==id); saveAll(); initSelects(); renderAll();
}
function addState(){
  const name=val('newStateName'), cat=$('newStateCat').value;
  if(!name){ toast('状态名称不能为空'); return; }
  if(catById(cat).group === 'violation'){ toast('违规状态不能主动添加'); return; }
  const group=catById(cat).group;
  const subject=(group==='study'||group==='deep') ? ($('newStateSubject') ? $('newStateSubject').value : guessSubjectId(name)) : 'sub_none';
  normalizeOrders(); app.states.push({id:uid('st'), name, cat, subject, order:app.states.length}); normalizeOrders(); $('newStateName').value=''; saveAll(); initSelects(); renderAll(); toast('已添加状态');
}
function deleteState(id){
  const s=stateById(id); if(s.system){ toast('系统状态不能删除'); return; }
  if(app.current.currentId===id){ toast('当前正在使用，不能删除'); return; }
  if(blocksAll().some(b=>b.m===id)){ toast('已有时间记录用到它，暂时不删，避免历史统计混乱'); return; }
  app.states=app.states.filter(x=>x.id!==id); normalizeOrders(); saveAll(); initSelects(); renderAll();
}
function moveState(id,dir){
  normalizeOrders();
  const list = app.states; const i=list.findIndex(x=>x.id===id); if(i<0) return;
  let j=i+dir;
  while(j>=0 && j<list.length && (list[j].hidden || catById(list[j].cat).group==='violation')) j+=dir;
  if(j<0 || j>=list.length){ toast('已经到头了'); return; }
  const tmp=list[i]; list[i]=list[j]; list[j]=tmp; list.forEach((x,k)=>x.order=k);
  saveAll(); initSelects(); renderAll();
}
function moveStateTop(id){ normalizeOrders(); const i=app.states.findIndex(x=>x.id===id); if(i<0) return; const item=app.states.splice(i,1)[0]; app.states.unshift(item); app.states.forEach((x,k)=>x.order=k); saveAll(); initSelects(); renderAll(); }
function moveStateBottom(id){ normalizeOrders(); const i=app.states.findIndex(x=>x.id===id); if(i<0) return; const item=app.states.splice(i,1)[0]; app.states.push(item); app.states.forEach((x,k)=>x.order=k); saveAll(); initSelects(); renderAll(); }
function addAppType(){
  const name=val('newAppTypeName'); const severity=clamp(Number($('newAppTypeSeverity').value),0,5); const allowed=$('newAppTypeAllowed').value==='1';
  if(!name){ toast('类型名不能为空'); return; }
  app.appTypes.push({id:uid('atype'), name, severity, allowed}); $('newAppTypeName').value=''; saveAll(); initSelects(); renderAll(); toast('已添加应用类型');
}
function deleteAppType(id){
  const t=appTypeById(id); if(t.system){ toast('系统类型不能删除'); return; }
  if(Object.values(app.appRules||{}).some(r=>r.appType===id)){ toast('有 App 规则正在使用它，先删规则'); return; }
  app.appTypes=app.appTypes.filter(x=>x.id!==id); saveAll(); initSelects(); renderAll();
}
function addAppRule(){
  const key=norm(val('ruleAppKey')), label=val('ruleAppLabel'), appType=(app.ui && app.ui.selectedAppType) || ($('ruleAppType') && $('ruleAppType').value) || 'unknown';
  if(!key){ toast('App 名称/包名不能为空'); return; }
  app.appRules[key] = {key, label:label||key, appType};
  $('ruleAppKey').value=''; $('ruleAppLabel').value='';
  autoClassifyAll(false); saveAll(); renderAll(); toast('规则已保存，并已重新匹配');
}
function deleteAppRule(key){ delete app.appRules[key]; autoClassifyAll(false); saveAll(); renderAll(); }

function parseUsageLine(line){
  line = line.trim(); if(!line) return null;
  let date = app.current.date || localDate();
  let m = line.match(/^(\d{4}-\d{1,2}-\d{1,2})\s+(\d{1,2}:\d{2})\s*[-~—]\s*(\d{1,2}:\d{2})\s+(.+)$/);
  if(m){ date=m[1]; return makeUsage(date,m[2],m[3],m[4]); }
  m = line.match(/^(\d{1,2}:\d{2})\s*[-~—]\s*(\d{1,2}:\d{2})\s+(.+)$/);
  if(m) return makeUsage(date,m[1],m[2],m[3]);
  return null;
}
function makeUsage(date, start, end, rest){
  let s=parseTimeOnDate(date,start), e=parseTimeOnDate(date,end); if(e<=s) e += 86400000;
  const parts=rest.trim().split(/\s+/); let key='', label='';
  if(parts.length>=2 && /\./.test(parts[0])){ key=parts[0]; label=parts.slice(1).join(' '); }
  else { label=rest.trim(); key=label; }
  return {s,e,key,label,src:'import'};
}
function usageId(u){ return [u.s,u.e,norm(u.key||u.label)].join('|'); }
function addUsage(u){ if(!u || !u.s || !u.e || u.e<=u.s) return false; if(app.usage.some(x=>usageId(x)===usageId(u))) return false; app.usage.push(u); return true; }
function importUsage(){
  const lines=(val('usageImport')).split(/\n+/); let ok=0, bad=0;
  lines.forEach(line=>{ const u=parseUsageLine(line); if(u && addUsage(u)) ok++; else if(line.trim()) bad++; });
  $('usageImport').value=''; autoClassifyAll(false); saveAll(); renderAll(); toast('导入 '+ok+' 条，失败 '+bad+' 条');
}
function clearUsage(){ if(!confirm('清空手机使用记录？不会清空时间轴。')) return; app.usage=[]; autoClassifyAll(false); saveAll(); renderAll(); }
function appRuleFor(u){ if(!u) return null; return app.appRules[norm(u.key)] || app.appRules[norm(u.label)] || null; }
function isIgnorableUsage(u){ const k=norm((u&&u.key)||''); const l=norm((u&&u.label)||''); return /launcher|systemui|桌面|系统界面/.test(k+' '+l); }
function bestUsageForBlock(b){
  let best=null, bestOv=0;
  (app.usage||[]).forEach(u=>{ if(isIgnorableUsage(u)) return; const ov=overlapMs(b.s,b.e,u.s,u.e); if(ov>bestOv){ bestOv=ov; best=u; } });
  if(!best || bestOv < 15000) return null;
  return {rec:best, overlapMin:Math.max(1,Math.round(bestOv/60000))};
}
function autoClassifyBlock(b){
  if(b.m !== SYS_VIOLATION && b.m !== SYS_ALLOWED && b.m !== SYS_PENDING) return b;
  const match = bestUsageForBlock(b);
  if(!match){ b.m = SYS_PENDING; b.appType = b.appType || 'unknown'; b.n = b.n || '息屏/无其他应用记录，或等待导入使用记录'; return b; }
  const u=match.rec; const rule=appRuleFor(u); const type = rule ? appTypeById(rule.appType) : appTypeById('unknown');
  b.appKey=u.key; b.appLabel=u.label; b.autoOverlapMin=match.overlapMin; b.appType=type.id;
  if(type.allowed){ b.m=SYS_ALLOWED; b.n=(type.study ? '学习类应用：' : '允许应用：')+u.label+'，'+type.name+'，重叠 '+match.overlapMin+'m'; }
  else { b.m=SYS_VIOLATION; b.n='违规应用：'+u.label+'，'+type.name+'，重叠 '+match.overlapMin+'m'; }
  return b;
}
function autoClassifyAll(shouldRender){
  (app.current.blocks||[]).forEach(autoClassifyBlock);
  (app.history||[]).forEach(d=>{ (d.blocks||[]).forEach(autoClassifyBlock); const c=compute(d.blocks||[]); d.totals=c.totals; d.violations=c.violations; d.aspects=c.aspects; d.overall=c.overall; d.status=c.status; });
  if(shouldRender) renderAll();
}
function syncUsage(silent){
  if(!window.AndroidBridge || !AndroidBridge.queryUsageEvents){ if(!silent) toast('当前版本没有系统读取接口，可用粘贴导入'); return; }
  try{
    const date = app.current.date || localDate(); const start=dateBaseMs(date); const end=start+86400000;
    const raw = AndroidBridge.queryUsageEvents(String(start), String(end));
    const arr = JSON.parse(raw || '[]'); let ok=0;
    arr.forEach(u=>{ if(u && !u.error && addUsage(u)) ok++; });
    autoClassifyAll(false); saveAll(); renderAll(); if(!silent) toast('读取到 '+ok+' 条新记录');
  }catch(e){ if(!silent) toast('读取失败：'+e.message); }
}
function openUsageSettings(){ if(window.AndroidBridge && AndroidBridge.openUsageSettings) AndroidBridge.openUsageSettings(); else toast('当前环境不能打开系统权限页'); }
function checkUsagePermission(){
  let ok=false;
  try{ ok = !!(window.AndroidBridge && AndroidBridge.hasUsagePermission && AndroidBridge.hasUsagePermission()); }catch(e){ ok=false; }
  app.permission = {usage:ok, lastCheck:nowMs()}; saveAll(); renderPermission(); return ok;
}

function virtualBlocks(){
  const arr=(app.current.blocks||[]).slice();
  if(app.current.active && app.current.currentId && app.current.currentStartMs){ arr.push({s:app.current.currentStartMs,e:nowMs(),m:app.current.currentId,live:true}); }
  return arr.sort((a,b)=>a.s-b.s);
}
function blocksAll(){ return [].concat(app.current.blocks||[], ...(app.history||[]).map(d=>d.blocks||[])); }
function val(id){ return ($(id) && $(id).value != null) ? String($(id).value).trim() : ''; }
function qualityValue(){ return clamp(Number(val('qualityScore')||6),0,10); }
function bodyValue(){ return clamp(Number(val('bodyScore')||6),0,10); }
function reflectionFilled(){ return ['gain','problem','tomorrow'].filter(id=>val(id).length>=4).length; }
function totalsFrom(blocks){
  const t={total:0, study:0, deep:0, entertainment:0, allowed:0, pending:0, violation:0, sleep:0, exercise:0, life:0, other:0};
  blocks.forEach(b=>{ const m=durMin(b.s,b.e); const g=groupOfState(b.m); t.total+=m; if(g==='study'){t.study+=m;} else if(g==='deep'){t.study+=m;t.deep+=m;} else if(g==='entertainment'){t.entertainment+=m;} else if(g==='allowed'){t.allowed+=m;} else if(g==='pending'){t.pending+=m;} else if(g==='violation'){t.violation+=m;} else if(g==='sleep'){t.sleep+=m;t.life+=m;} else if(g==='exercise'){t.exercise+=m;t.life+=m;} else if(g==='life'){t.life+=m;} else t.other+=m; });
  return t;
}
function violationStats(blocks){
  const out={count:0,total:0,weighted:0,types:{},rows:[]};
  blocks.filter(b=>groupOfState(b.m)==='violation').forEach(b=>{ const m=durMin(b.s,b.e); const type=appTypeById(b.appType||'unknown'); out.count++; out.total+=m; out.weighted+=m*(type.severity||2); if(!out.types[type.id]) out.types[type.id]={id:type.id,name:type.name,count:0,time:0,weighted:0}; out.types[type.id].count++; out.types[type.id].time+=m; out.types[type.id].weighted+=m*(type.severity||2); out.rows.push({b,min:m,type}); });
  out.typeRows=Object.values(out.types).sort((a,b)=>b.weighted-a.weighted || b.count-a.count); return out;
}
function learningChainStats(blocks){
  const sorted=(blocks||[]).slice().sort((a,b)=>a.s-b.s);
  const chains=[]; let cur=null;
  function finish(){ if(cur && cur.studyMin>0){ cur.subjectCount=Object.keys(cur.subjects).length; chains.push(cur); } cur=null; }
  sorted.forEach(b=>{
    const m=durMin(b.s,b.e), g=groupOfState(b.m);
    if(g==='study' || g==='deep'){
      if(!cur) cur={start:b.s,end:b.e,studyMin:0,deepMin:0,breakMin:0,subjects:{},switches:0,lastSubject:null,blocks:0};
      const sid=subjectOfState(b.m).id;
      if(cur.lastSubject && cur.lastSubject!==sid) cur.switches++;
      cur.lastSubject=sid; cur.subjects[sid]=(cur.subjects[sid]||0)+m; cur.studyMin+=m; if(g==='deep') cur.deepMin+=m; cur.end=b.e; cur.blocks++;
    } else if(cur && (g==='life'||g==='allowed'||g==='pending'||g==='exercise') && m<=20){
      cur.breakMin+=m; cur.end=b.e;
    } else {
      finish();
    }
  }); finish();
  chains.sort((a,b)=>b.studyMin-a.studyMin);
  const longest=chains[0] || {studyMin:0,deepMin:0,breakMin:0,subjects:{},subjectCount:0,switches:0,blocks:0};
  const totalStudyChains=chains.reduce((sum,c)=>sum+c.studyMin,0);
  const multiSubjectMin=chains.filter(c=>c.subjectCount>=2).reduce((sum,c)=>sum+c.studyMin,0);
  const bestSubjectBalance = longest.studyMin ? Object.values(longest.subjects).sort((a,b)=>b-a).slice(1).reduce((a,b)=>a+b,0) / longest.studyMin : 0;
  const chainScore = clamp(
    clamp(longest.studyMin/120*55,0,55) +
    clamp(multiSubjectMin/180*20,0,20) +
    clamp(longest.switches*8,0,15) +
    clamp(bestSubjectBalance*20,0,10), 0, 100);
  return {chains,longest,totalStudyChains,multiSubjectMin,score:chainScore};
}
function compute(blocks){
  const t=totalsFrom(blocks), v=violationStats(blocks), chain=learningChainStats(blocks); const studyGoal=360, deepGoal=90, entLimit=60; const q=qualityValue(), body=bodyValue();
  const studyScore=clamp(t.study/studyGoal*100,0,110);
  const deepScore=clamp((t.deep/deepGoal*100)*0.7 + (q*10)*0.3,0,100);
  const focusScore=clamp(100 - v.count*8 - v.weighted*1.15,0,100);
  const entertainmentScore=clamp(100 - Math.max(0,t.entertainment-entLimit)*1.5 - t.entertainment*0.15 - v.weighted*0.35,0,100);
  let sleepScore=60; if(t.sleep>0){ if(t.sleep>=390 && t.sleep<=540) sleepScore=92; else if(t.sleep>=330 && t.sleep<390) sleepScore=78; else if(t.sleep>540 && t.sleep<=630) sleepScore=75; else sleepScore=55; }
  const lifeScore=clamp(sleepScore*0.45 + body*10*0.4 + clamp(t.exercise/30*15,0,15),0,100);
  const reflectScore=clamp(reflectionFilled()/3*100,0,100);
  const aspects={study:studyScore, chain:chain.score, deep:deepScore, focus:focusScore, entertainment:entertainmentScore, life:lifeScore, reflect:reflectScore};
  const overall=Math.round(aspects.study*0.25 + aspects.chain*0.15 + aspects.deep*0.15 + aspects.focus*0.20 + aspects.entertainment*0.10 + aspects.life*0.10 + aspects.reflect*0.05);
  return {totals:t, violations:v, chain, aspects, overall, status:dayStatus(overall,t,v,chain)};
}
function dayStatus(score,t,v,chain){
  if(score>=88 && v.count===0 && t.study>=330 && (chain.longest.studyMin||0)>=90) return {label:'高效稳定日', advice:'学习投入、连续学习链和专注都不错，注意别牺牲睡眠。'};
  if(t.study<180) return {label:'学习投入不足日', advice:'明天先保证一段连续学习，不要先追求完美。'};
  if(v.count>=3 || v.total>=25) return {label:'专注受损日', advice:'重点看主要违规 App，提前限制它。'};
  if(t.entertainment>90) return {label:'娱乐偏高日', advice:'娱乐可以有，但必须设置边界。'};
  if(score<60) return {label:'需要调整日', advice:'不要全改，先抓最拖后腿的一项。'};
  if((chain.longest.studyMin||0)<45 && t.study>=180) return {label:'学习碎片化日', advice:'总学习不算少，但连续学习链偏短；明天先做一段60分钟以上的完整链。'};
  if(score>=75) return {label:'正常推进日', advice:'有推进，继续提高深度学习和连续学习链质量。'};
  return {label:'普通记录日', advice:'先保证记录连续，再逐步优化。'};
}
function aspectLabel(k){ return ({study:'学习投入',chain:'连续学习链',deep:'深度学习',focus:'专注纪律',entertainment:'娱乐控制',life:'生活状态',reflect:'反思复盘'})[k] || k; }

function renderPermission(){
  const ok=!!(app.permission&&app.permission.usage); const text= ok ? '已获得使用情况访问权限：可以读取手机使用时间，并自动匹配学习违规原因。' : '缺少使用情况访问权限：学习时离开 App 仍会被动记录，但无法自动知道你用了哪个 App。请打开权限，或粘贴导入手机使用时间。';
  ['permissionText','permissionText2'].forEach(id=>{ const el=$(id); if(el){ el.textContent=text; el.className=ok?'perm okperm':'perm'; } });
  if($('permissionCard')) $('permissionCard').classList.toggle('hidden', ok);
}
function renderAll(){
  ensureSystemDefaults(); initSelects(); renderPermission();
  const blocks=virtualBlocks(); autoClassifyAll(false); const c=compute(blocks);
  setText('dateText',(app.current.date||localDate())+(app.current.active?'｜计时中':'｜未计时'));
  setText('topStudy',fmtDur(c.totals.study)); setText('topDeep',fmtDur(c.totals.deep)); setText('topViolation',c.violations.count+'次'); setText('topScore',String(c.overall)); setText('scoreBig',String(c.overall));
  renderLive(); updateSecondTick(); renderDailyStatus(c); renderAspectBars('aspectBars',c.aspects); renderSummary(c); renderViolations(c); renderTimeline(blocks); renderStats(); renderRules();
}
function setText(id,txt){ if($(id)) $(id).textContent=txt; }
function renderLive(){
  const el=$('liveBox'); if(!el) return;
  if(!app.current.active){ el.textContent='未开始。选择状态后点“开始今天”。'; setText('topLive','00:00'); return; }
  el.innerHTML = '<div>当前：<b>'+esc(nameOfState(app.current.currentId))+'</b></div>'+
    '<div class="timerLarge" id="liveSeconds">00:00</div>'+
    '<div class="timerSub">开始：<b>'+fmtTime(app.current.currentStartMs)+'</b>｜当前状态：<b id="liveCurrentText">00:00</b><br>今日连续计时：<b id="liveTodayText">00:00</b></div>';
}
function updateSecondTick(){
  if(!app.current || !app.current.active){ setText('topLive','00:00'); return; }
  const cur = durationClock(app.current.currentStartMs, nowMs());
  const today = durationClock(currentDayStartMs(), nowMs());
  setText('topLive', cur);
  setText('liveSeconds', cur);
  setText('liveCurrentText', cur);
  setText('liveTodayText', today);
}
function renderDailyStatus(c){ if($('dailyStatus')) $('dailyStatus').innerHTML='<b>'+esc(c.status.label)+'</b><br><span class="small">'+esc(c.status.advice)+'</span>'; }
function renderAspectBars(id,aspects){
  const el=$(id); if(!el) return; el.innerHTML=Object.entries(aspects).map(([k,v])=>'<div style="margin:9px 0"><div class="row" style="margin:0"><b>'+aspectLabel(k)+'</b><span class="small" style="text-align:right">'+Math.round(v)+'</span></div><div class="bar"><div style="width:'+clamp(v,0,100)+'%"></div></div></div>').join('');
}
function renderSummary(c){
  const rows=[['学习总时长',c.totals.study],['最长连续学习链',c.chain.longest.studyMin||0],['跨学科链学习',c.chain.multiSubjectMin||0],['深度学习',c.totals.deep],['娱乐',c.totals.entertainment],['允许应用沟通',c.totals.allowed],['息屏/待判定离开',c.totals.pending],['学习违规离开',c.totals.violation],['睡眠',c.totals.sleep],['运动',c.totals.exercise],['生活/其他',c.totals.life+c.totals.other]];
  if($('summaryRows')) $('summaryRows').innerHTML=rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+fmtDur(r[1])+'</td></tr>').join('');
}
function renderViolations(c){
  setText('violationSummary','违规 '+c.violations.count+' 次，总计 '+fmtDur(c.violations.total)+'。');
  if($('violationRows')) $('violationRows').innerHTML=c.violations.rows.map(x=>'<tr><td>'+fmtTime(x.b.s)+'-'+fmtTime(x.b.e)+'</td><td>'+esc(x.type.name)+'<br><span class="tiny">'+esc(x.b.appLabel||'未匹配App')+' '+esc(x.b.n||'')+'</span></td><td>'+fmtDur(x.min)+'</td></tr>').join('') || '<tr><td colspan="3" class="small">暂无违规。</td></tr>';
}
function renderTimeline(blocks){
  setText('timelineCheck', blocks.length ? ('共 '+blocks.length+' 段，当前记录是连续切换制。') : '还没有时间段。');
  if($('blockRows')) $('blockRows').innerHTML=blocks.map((b,i)=>'<tr><td>'+fmtTime(b.s)+'-'+fmtTime(b.e)+'</td><td>'+esc(nameOfState(b.m))+(b.live?' <span class="tag">进行中</span>':'')+'<br><span class="tiny">'+esc(b.n||'')+'</span></td><td>'+fmtDur(durMin(b.s,b.e))+'</td><td>'+(b.live?'':'<button class="mini danger" onclick="deleteBlock('+i+')">删</button>')+'</td></tr>').join('') || '<tr><td colspan="4" class="small">暂无记录。</td></tr>';
}
function deleteBlock(i){ if(!confirm('删除这一段？')) return; app.current.blocks.splice(i,1); saveAll(); renderAll(); }
function renderStats(){
  const days=periodDays($('periodSelect') ? $('periodSelect').value : 'today'); const blocks=[].concat(...days.map(d=>d.blocks||[])); const c=compute(blocks);
  if($('periodCards')) $('periodCards').innerHTML=[['综合分',c.overall],['学习',fmtDur(c.totals.study)],['最长学习链',fmtDur((c.chain.longest||{}).studyMin||0)],['跨学科链',fmtDur(c.chain.multiSubjectMin||0)],['深度',fmtDur(c.totals.deep)],['违规',c.violations.count+'次/'+fmtDur(c.violations.total)]].map(x=>'<div class="metric"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('');
  renderAspectBars('periodAspectBars', c.aspects);
  setText('periodViolationSummary','该周期违规 '+c.violations.count+' 次，总计 '+fmtDur(c.violations.total)+'。');
  if($('periodViolationRows')) $('periodViolationRows').innerHTML=c.violations.typeRows.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+x.count+'</td><td>'+fmtDur(x.time)+'</td></tr>').join('') || '<tr><td colspan="3" class="small">暂无违规。</td></tr>';
  if($('dayRows')) $('dayRows').innerHTML=days.slice().reverse().map(d=>'<tr><td>'+esc(d.date)+'</td><td>'+esc((d.status||{}).label||'')+'</td><td>'+Math.round(d.overall||0)+'</td><td>'+fmtDur((d.totals||{}).study||0)+' / 链'+fmtDur(((d.chain||{}).longest||{}).studyMin||learningChainStats(d.blocks||[]).longest.studyMin)+' / 娱'+fmtDur((d.totals||{}).entertainment||0)+'</td></tr>').join('') || '<tr><td colspan="4" class="small">暂无历史。</td></tr>';
}
function periodDays(p){
  archiveToday(true); let days=(app.history||[]).slice(); const today=localDate();
  if(p==='today') return days.filter(d=>d.date===today);
  if(p==='week'){ const n=new Date(); const day=(n.getDay()+6)%7; const start=new Date(n.getFullYear(),n.getMonth(),n.getDate()-day).getTime(); return days.filter(d=>dateBaseMs(d.date)>=start); }
  if(p==='all') return days;
  const count=Number(p)||7; const start=dateBaseMs(today)-(count-1)*86400000; return days.filter(d=>dateBaseMs(d.date)>=start);
}
function renderRules(){
  if($('subjectRows')) $('subjectRows').innerHTML=(app.subjects||[]).filter(x=>!x.hidden && x.id!=='sub_none').map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+(x.system?'<span class="tiny">系统</span>':'<button class="mini danger" onclick="deleteSubject(\''+x.id+'\')">删</button>')+'</td></tr>').join('');
  if($('catRows')) $('catRows').innerHTML=(app.categories||[]).filter(c=>!c.hidden).map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(GROUPS[c.group]||c.group)+'</td><td>'+(c.system?'<span class="tiny">系统</span>':'<button class="mini danger" onclick="deleteCategory(\''+c.id+'\')">删</button>')+'</td></tr>').join('');
  if($('stateRows')) $('stateRows').innerHTML=selectableStates().map(s=>'<tr><td>'+esc(s.name)+'</td><td>'+esc(catById(s.cat).name)+'<br><span class="tiny">'+esc(subjectOfState(s.id).name)+'</span></td><td><div class="grid2"><button class="mini btn3" onclick="moveState(\''+s.id+'\',-1)">上移</button><button class="mini btn3" onclick="moveState(\''+s.id+'\',1)">下移</button></div><div class="grid2" style="margin-top:4px"><button class="mini btn3" onclick="moveStateTop(\''+s.id+'\')">置顶</button><button class="mini btn3" onclick="moveStateBottom(\''+s.id+'\')">置底</button></div>'+(s.system?'<span class="tiny">系统</span>':'<button class="mini danger" style="margin-top:4px" onclick="deleteState(\''+s.id+'\')">删除</button>')+'</td></tr>').join('');
  if($('appTypeRows')) $('appTypeRows').innerHTML=(app.appTypes||[]).map(t=>'<tr><td>'+esc(t.name)+(t.study?' <span class="tag">学习</span>':(t.allowed?' <span class="tag">允许</span>':''))+'</td><td>'+Number(t.severity||0)+'</td><td>'+(t.system?'<span class="tiny">系统</span>':'<button class="mini danger" onclick="deleteAppType(\''+t.id+'\')">删</button>')+'</td></tr>').join('');
  renderAppRules();
}
function unmappedApps(){
  const map={}; (app.usage||[]).forEach(u=>{ const k=norm(u.key||u.label); if(!k) return; if(app.appRules[k] || app.appRules[norm(u.label)]) return; if(!map[k]) map[k]={key:u.key,label:u.label,count:0,time:0}; map[k].count++; map[k].time += durMin(u.s,u.e); }); return Object.values(map).sort((a,b)=>b.time-a.time).slice(0,30);
}
function jsq(s){ return String(s == null ? '' : s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' '); }
function renderRuleAppTypePicker(){
  const box=$('ruleAppTypePicker'); if(!box) return;
  const selected=(app.ui && app.ui.selectedAppType) || ($('ruleAppType') && $('ruleAppType').value) || 'unknown';
  box.innerHTML=(app.appTypes||[]).map(t=>{
    const kind=t.study?'学习类应用':(t.allowed?'允许':'违规');
    return '<button type="button" class="typeChoice '+(t.id===selected?'selected':'')+'" onclick="selectRuleAppType(\''+jsq(t.id)+'\')"><span>'+esc(t.name)+'</span><span class="check">'+(t.id===selected?'✓':'')+'</span><br><span class="tiny">'+kind+'｜严重度 '+Number(t.severity||0)+'</span></button>';
  }).join('');
}
function selectRuleAppType(id){
  if(!app.ui) app.ui={}; app.ui.selectedAppType=id;
  if($('ruleAppType')) $('ruleAppType').value=id;
  saveAll(); renderRuleAppTypePicker();
}
function typeChoiceButtonsFor(key,label){
  return '<div class="typePicker">'+(app.appTypes||[]).map(t=>{
    const kind=t.study?'学习类应用':(t.allowed?'允许':'违规');
    return '<button type="button" class="typeChoice" onclick="quickMap(\''+jsq(key)+'\',\''+jsq(label)+'\',\''+jsq(t.id)+'\')"><span>'+esc(t.name)+'</span><span class="check">✓</span><br><span class="tiny">'+kind+'｜严重度 '+Number(t.severity||0)+'</span></button>';
  }).join('')+'</div>';
}
function renderAppRules(){
  renderRuleAppTypePicker();
  if($('unmappedAppRows')) $('unmappedAppRows').innerHTML=unmappedApps().map(u=>{ const key=norm(u.key); const label=u.label||u.key; return '<tr><td>'+esc(label)+'<br><span class="tiny">'+esc(u.key)+'</span></td><td>'+u.count+'次/'+fmtDur(u.time)+'</td><td>'+typeChoiceButtonsFor(key,label)+'</td></tr>'; }).join('') || '<tr><td colspan="3" class="small">暂无未分类 App。</td></tr>';
  if($('appRuleRows')) $('appRuleRows').innerHTML=Object.values(app.appRules||{}).map(r=>'<tr><td>'+esc(r.label||r.key)+'<br><span class="tiny">'+esc(r.key)+'</span></td><td>'+esc(appTypeById(r.appType).name)+'</td><td><button class="mini danger" onclick="deleteAppRule(\''+jsq(r.key)+'\')">删</button></td></tr>').join('') || '<tr><td colspan="3" class="small">暂无规则。</td></tr>';
}
function quickMap(key,label,typeId){ app.appRules[key]={key,label,appType:typeId || ((app.ui&&app.ui.selectedAppType)||'unknown')}; autoClassifyAll(false); saveAll(); renderAll(); toast('已保存 App 规则：'+appTypeById(app.appRules[key].appType).name); }

function appTypesObject(){
  saveAll();
  return {appName:'学生状态记录', exportKind:'appTypes', dataVersion:DATA_VERSION, exportTime:fmtDateTime(nowMs()), appTypes:app.appTypes||[], appRules:app.appRules||{}};
}
function exportAppTypesJson(){
  const txt=JSON.stringify(appTypesObject(),null,2);
  if($('appTypesJsonBox')) $('appTypesJsonBox').value=txt;
  if($('exportBox')) $('exportBox').value=txt;
  toast('已导出应用类型 JSON');
}
function importAppTypesJson(){
  try{
    const txt=val('appTypesJsonBox') || val('importDataBox');
    const data=JSON.parse(txt);
    const types=data.appTypes || (data.store&&data.store.appTypes);
    const rules=data.appRules || (data.store&&data.store.appRules);
    if(!Array.isArray(types)) throw new Error('没有找到 appTypes');
    app.appTypes=types;
    app.appRules=rules && typeof rules==='object' ? rules : {};
    ensureSystemDefaults();
    autoClassifyAll(false); saveAll(); initSelects(); renderAll(); toast('应用类型 JSON 已导入');
  }catch(e){ toast('导入失败：'+e.message); }
}
function saveAppTypesJsonFile(){
  const txt=JSON.stringify(appTypesObject(),null,2);
  if($('appTypesJsonBox')) $('appTypesJsonBox').value=txt;
  const name='student_reflect_app_types_'+(app.current.date||localDate())+'.json';
  if(window.AndroidBridge && AndroidBridge.saveBackupFile){ AndroidBridge.saveBackupFile(txt,name); toast('请选择保存位置'); }
  else { if($('exportBox')) $('exportBox').value=txt; toast('当前环境不支持直接保存，已放到文本框'); }
}
function copyTextFrom(el){
  if(!el){ toast('没有可复制内容'); return; }
  const txt=el.value || el.textContent || '';
  if(!txt.trim()){ toast('文本框是空的'); return; }
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(()=>toast('已复制')).catch(()=>fallbackCopy(el)); }
  else fallbackCopy(el);
}
function fallbackCopy(el){ try{ el.focus(); el.select(); document.execCommand('copy'); toast('已复制'); }catch(e){ toast('复制失败，请手动长按复制'); } }
function copyAppTypesJson(){ if(!$('appTypesJsonBox') || !$('appTypesJsonBox').value.trim()) exportAppTypesJson(); copyTextFrom($('appTypesJsonBox')); }
function copyExportBox(){ copyTextFrom($('exportBox')); }
function selectExportBox(){ const el=$('exportBox'); if(!el){ return; } el.focus(); el.select(); toast('已全选，可以复制'); }

function saveReflect(){ saveAll(); archiveToday(true); renderAll(); toast('反思已保存'); }
function exportText(){
  const c=compute(virtualBlocks()); const lines=[];
  lines.push('日期：'+(app.current.date||localDate())); lines.push('综合分：'+c.overall); lines.push('状态：'+c.status.label); lines.push('学习：'+fmtDur(c.totals.study)+'，深度：'+fmtDur(c.totals.deep)+'，最长学习链：'+fmtDur(c.chain.longest.studyMin||0)); lines.push('违规：'+c.violations.count+'次，'+fmtDur(c.violations.total)); lines.push('收获：'+val('gain')); lines.push('问题：'+val('problem')); lines.push('明天只改一个点：'+val('tomorrow'));
  $('exportBox').value=lines.join('\n'); toast('已生成今日总结');
}
function backupObject(){ saveAll(); return {appName:'学生状态记录', dataVersion:DATA_VERSION, exportTime:fmtDateTime(nowMs()), store:app}; }
function exportData(){ saveAll(); $('exportBox').value=JSON.stringify(backupObject(),null,2); toast('已导出到文本框'); }
function applyImportedData(data){
  const store = data.store || data.app || data;
  if(!store || typeof store!=='object') throw new Error('没有识别到记录数据');
  app = Object.assign(app, store); ensureSystemDefaults(); normalizeOrders(); saveAll(); renderAll();
}
function importData(){
  try{ const data=JSON.parse(val('importDataBox')); applyImportedData(data); toast('导入成功'); }catch(e){ toast('导入失败：'+e.message); }
}
function saveBackupFile(){
  const txt=JSON.stringify(backupObject(),null,2);
  const name='student_reflect_backup_'+(app.current.date||localDate())+'.json';
  if(window.AndroidBridge && AndroidBridge.saveBackupFile){ AndroidBridge.saveBackupFile(txt,name); toast('请选择保存位置'); }
  else { $('exportBox').value=txt; toast('当前环境不支持直接保存文件，已放到文本框'); }
}
function loadBackupFile(){
  if(window.AndroidBridge && AndroidBridge.openBackupFile){ AndroidBridge.openBackupFile(); toast('请选择备份 JSON 文件'); }
  else toast('当前环境不支持文件选择，请把 JSON 粘贴到输入框导入');
}
window.onNativeBackupLoaded = function(txt){
  try{ const data=JSON.parse(txt); applyImportedData(data); toast('已从备份文件恢复'); }catch(e){ toast('备份文件导入失败：'+e.message); }
};
window.onNativeBackupSaved = function(ok,msg){ toast(ok ? '备份文件已保存' : ('保存失败：'+(msg||''))); };
function showPage(p){ currentPage=p; ['Record','Timeline','Stats','Rules','Reflect'].forEach(x=>{ const sec=$('page'+x), nav=$('nav'+x); if(sec) sec.classList.toggle('hidden', x!==p); if(nav) nav.classList.toggle('active', x===p); }); renderAll(); }

window.selectRuleAppType=selectRuleAppType; window.deleteCategory=deleteCategory; window.deleteSubject=deleteSubject; window.deleteState=deleteState; window.moveState=moveState; window.moveStateTop=moveStateTop; window.moveStateBottom=moveStateBottom; window.deleteAppType=deleteAppType; window.deleteAppRule=deleteAppRule; window.deleteBlock=deleteBlock; window.quickMap=quickMap;

document.addEventListener('DOMContentLoaded', function(){ load(); bind(); initSelects(); checkUsagePermission(); showPage('Record'); setInterval(updateSecondTick, 1000); setInterval(()=>{ if(app.current.active) renderAll(); }, 30000); });
