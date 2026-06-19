'use strict';

const STORE = 'student_reflect_record_stats_v2';
const FIELD_IDS = ['qualityScore','bodyScore','gain','problem','tomorrow'];
const SYS_VIOLATION = 'SYS_AUTO_VIOLATION';
const SYS_ALLOWED = 'SYS_ALLOWED_APP';
const GROUPS = {
  study:'学习投入', deep:'深度学习', entertainment:'娱乐', allowed:'允许应用', life:'生活', sleep:'睡眠', exercise:'运动', other:'其他', violation:'自动违规'
};
const DEFAULT_APP_TYPES = [
  {id:'wechat', name:'微信必要沟通', severity:0, allowed:true, system:true},
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
  {id:'violation', name:'学习违规离开', group:'violation', system:true, hidden:true}
];
const DEFAULT_STATES = [
  {id:'st_english', name:'英语学习', cat:'study'},
  {id:'st_math', name:'数学学习', cat:'study'},
  {id:'st_science', name:'理化/文综', cat:'study'},
  {id:'st_other_study', name:'其他学习', cat:'study'},
  {id:'st_deep', name:'深度学习', cat:'deep'},
  {id:'st_game', name:'游戏娱乐', cat:'game'},
  {id:'st_wechat', name:'微信必要沟通', cat:'wechat'},
  {id:'st_meal', name:'吃饭', cat:'meal'},
  {id:'st_rest', name:'休息', cat:'rest'},
  {id:'st_sleep', name:'睡眠', cat:'sleep'},
  {id:'st_exercise', name:'运动', cat:'exercise'},
  {id:'st_commute', name:'通勤', cat:'commute'},
  {id:'st_other', name:'其他', cat:'other'},
  {id:SYS_VIOLATION, name:'自动记录：学习违规离开', cat:'violation', system:true, hidden:true},
  {id:SYS_ALLOWED, name:'自动记录：允许应用沟通', cat:'wechat', system:true, hidden:true}
];
let app = {
  categories: DEFAULT_CATS.slice(),
  states: DEFAULT_STATES.slice(),
  appTypes: DEFAULT_APP_TYPES.slice(),
  appRules: {},
  usage: [],
  history: [],
  current: {date:null, blocks:[], active:false, currentId:null, currentStartMs:null, hidden:null, ended:false},
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
function nameOfState(id){ return stateById(id).name || id; }
function appTypeById(id){ return (app.appTypes||[]).find(x=>x.id===id) || app.appTypes.find(x=>x.id==='unknown') || {id:'unknown',name:'未分类应用',severity:2,allowed:false}; }
function selectableStates(){ return (app.states||[]).filter(s => !s.hidden && catById(s.cat).group !== 'violation'); }
function selectableCats(){ return (app.categories||[]).filter(c => !c.hidden && c.group !== 'violation'); }
function isLearningState(id){ const g = groupOfState(id); return g === 'study' || g === 'deep'; }

function load(){
  try{ const raw = localStorage.getItem(STORE); if(raw) app = Object.assign(app, JSON.parse(raw)); }catch(e){ console.log(e); }
  if(!Array.isArray(app.categories) || !app.categories.length) app.categories = DEFAULT_CATS.slice();
  if(!Array.isArray(app.states) || !app.states.length) app.states = DEFAULT_STATES.slice();
  if(!Array.isArray(app.appTypes) || !app.appTypes.length) app.appTypes = DEFAULT_APP_TYPES.slice();
  if(!app.appRules) app.appRules = {};
  if(!Array.isArray(app.usage)) app.usage = [];
  if(!Array.isArray(app.history)) app.history = [];
  if(!app.current) app.current = {date:null, blocks:[], active:false, currentId:null, currentStartMs:null, hidden:null, ended:false};
  ensureSystemDefaults();
  FIELD_IDS.forEach(id => { const v = localStorage.getItem('f_'+id); if(v !== null && $(id)) $(id).value = v; });
}
function ensureSystemDefaults(){
  DEFAULT_CATS.forEach(x => { if(!app.categories.some(y=>y.id===x.id)) app.categories.push(x); });
  DEFAULT_STATES.filter(x=>x.system).forEach(x => { if(!app.states.some(y=>y.id===x.id)) app.states.push(x); });
  DEFAULT_APP_TYPES.forEach(x => { if(!app.appTypes.some(y=>y.id===x.id)) app.appTypes.push(x); });
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
  const day = {date:app.current.date || localDate(blocks[0].s), blocks:blocks, totals:c.totals, violations:c.violations, aspects:c.aspects, overall:c.overall, status:c.status, reflect:{quality:qualityValue(), body:bodyValue(), gain:val('gain'), problem:val('problem'), tomorrow:val('tomorrow')}};
  const idx = app.history.findIndex(d=>d.date===day.date);
  if(idx >= 0) app.history[idx] = day; else app.history.push(day);
  app.history.sort((a,b)=>a.date.localeCompare(b.date));
  if(!silent) toast('已保存到历史');
}

function initSelects(){
  const stateHtml = selectableStates().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'｜'+esc(catById(s.cat).name)+'</option>').join('');
  ['stateSelect','manualModule'].forEach(id=>{ const el=$(id); if(!el) return; const old=el.value; el.innerHTML=stateHtml; if(old && selectableStates().some(s=>s.id===old)) el.value=old; });
  const catHtml = selectableCats().map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'｜'+esc(GROUPS[c.group]||c.group)+'</option>').join('');
  if($('newStateCat')) $('newStateCat').innerHTML = catHtml;
  const groupHtml = Object.entries(GROUPS).filter(([k])=>k!=='violation').map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');
  if($('newCatGroup')) $('newCatGroup').innerHTML = groupHtml;
  const appTypeHtml = (app.appTypes||[]).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+(t.allowed?'｜允许':'｜违规')+'</option>').join('');
  if($('ruleAppType')) $('ruleAppType').innerHTML = appTypeHtml;
}
function bind(){
  const map = {
    startBtn:startDay, switchBtn:switchState, endBtn:endDay, manualAddBtn:addManualBlock,
    addCatBtn:addCategory, addStateBtn:addState, addAppTypeBtn:addAppType, addRuleBtn:addAppRule,
    importUsageBtn:importUsage, clearUsageBtn:clearUsage, syncUsageBtn:syncUsage, openUsageBtn:openUsageSettings, openUsageBtnTop:openUsageSettings, checkPermBtn:checkUsagePermission,
    saveReflectBtn:saveReflect, exportTextBtn:exportText, exportDataBtn:exportData, importDataBtn:importData,
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
      app.current.hidden = {s:nowMs(), module:app.current.currentId}; saveAll();
    }
    return;
  }
  const h = app.current.hidden;
  if(!h) return;
  app.current.hidden = null;
  const end = nowMs();
  if(end - h.s < 15000){ saveAll(); return; }
  if(app.current.currentId === h.module && app.current.currentStartMs < h.s){
    app.current.blocks.push({s:app.current.currentStartMs, e:h.s, m:h.module, n:'离开前学习'});
    const vb = {s:h.s, e:end, m:SYS_VIOLATION, appType:'unknown', n:'学习时离开前台，等待系统使用记录归因', passive:true, from:h.module};
    app.current.blocks.push(vb);
    app.current.currentStartMs = end;
    app.current.currentId = h.module;
    toast('已被动记录一次学习离开：'+fmtDur(durMin(h.s,end)));
  }
  saveAll();
  syncUsage(true);
  autoClassifyAll(false);
  renderAll();
}

function startDay(){
  if(app.current.active){ toast('已经开始了'); return; }
  if((app.current.blocks||[]).length && !confirm('今天已有记录。重新开始会清空当前未归档时间轴，继续吗？')) return;
  const first = $('stateSelect').value || (selectableStates()[0] && selectableStates()[0].id);
  if(!first){ toast('请先添加一个可用状态'); return; }
  app.current = {date:localDate(), blocks:[], active:true, currentId:first, currentStartMs:nowMs(), hidden:null, ended:false};
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
  app.current = {date:localDate(), blocks:[], active:false, currentId:null, currentStartMs:null, hidden:null, ended:false};
  ['gain','problem','tomorrow'].forEach(id=>{ if($(id)) $(id).value=''; localStorage.removeItem('f_'+id); });
  saveAll(); renderAll(); showPage('Record'); toast('已新开一天');
}
function clearAll(){
  if(!confirm('确认清空全部本地数据？这一步不可恢复。')) return;
  localStorage.removeItem(STORE); FIELD_IDS.forEach(id=>localStorage.removeItem('f_'+id));
  app = {categories:DEFAULT_CATS.slice(), states:DEFAULT_STATES.slice(), appTypes:DEFAULT_APP_TYPES.slice(), appRules:{}, usage:[], history:[], current:{date:null, blocks:[], active:false, currentId:null, currentStartMs:null, hidden:null, ended:false}, permission:{usage:false,lastCheck:0}};
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
function addState(){
  const name=val('newStateName'), cat=$('newStateCat').value;
  if(!name){ toast('状态名称不能为空'); return; }
  if(catById(cat).group === 'violation'){ toast('违规状态不能主动添加'); return; }
  app.states.push({id:uid('st'), name, cat}); $('newStateName').value=''; saveAll(); initSelects(); renderAll(); toast('已添加状态');
}
function deleteState(id){
  const s=stateById(id); if(s.system){ toast('系统状态不能删除'); return; }
  if(app.current.currentId===id){ toast('当前正在使用，不能删除'); return; }
  if(blocksAll().some(b=>b.m===id)){ toast('已有时间记录用到它，暂时不删，避免历史统计混乱'); return; }
  app.states=app.states.filter(x=>x.id!==id); saveAll(); initSelects(); renderAll();
}
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
  const key=norm(val('ruleAppKey')), label=val('ruleAppLabel'), appType=$('ruleAppType').value;
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
function bestUsageForBlock(b){
  let best=null, bestOv=0;
  (app.usage||[]).forEach(u=>{ const ov=overlapMs(b.s,b.e,u.s,u.e); if(ov>bestOv){ bestOv=ov; best=u; } });
  if(!best || bestOv < 15000) return null;
  return {rec:best, overlapMin:Math.max(1,Math.round(bestOv/60000))};
}
function autoClassifyBlock(b){
  if(b.m !== SYS_VIOLATION && b.m !== SYS_ALLOWED) return b;
  const match = bestUsageForBlock(b);
  if(!match){ b.m = SYS_VIOLATION; b.appType = b.appType || 'unknown'; b.n = b.n || '没有匹配到手机使用记录'; return b; }
  const u=match.rec; const rule=appRuleFor(u); const type = rule ? appTypeById(rule.appType) : appTypeById('unknown');
  b.appKey=u.key; b.appLabel=u.label; b.autoOverlapMin=match.overlapMin; b.appType=type.id;
  if(type.allowed){ b.m=SYS_ALLOWED; b.n='允许应用：'+u.label+'，重叠 '+match.overlapMin+'m'; }
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
  const t={total:0, study:0, deep:0, entertainment:0, allowed:0, violation:0, sleep:0, exercise:0, life:0, other:0};
  blocks.forEach(b=>{ const m=durMin(b.s,b.e); const g=groupOfState(b.m); t.total+=m; if(g==='study'){t.study+=m;} else if(g==='deep'){t.study+=m;t.deep+=m;} else if(g==='entertainment'){t.entertainment+=m;} else if(g==='allowed'){t.allowed+=m;} else if(g==='violation'){t.violation+=m;} else if(g==='sleep'){t.sleep+=m;t.life+=m;} else if(g==='exercise'){t.exercise+=m;t.life+=m;} else if(g==='life'){t.life+=m;} else t.other+=m; });
  return t;
}
function violationStats(blocks){
  const out={count:0,total:0,weighted:0,types:{},rows:[]};
  blocks.filter(b=>groupOfState(b.m)==='violation').forEach(b=>{ const m=durMin(b.s,b.e); const type=appTypeById(b.appType||'unknown'); out.count++; out.total+=m; out.weighted+=m*(type.severity||2); if(!out.types[type.id]) out.types[type.id]={id:type.id,name:type.name,count:0,time:0,weighted:0}; out.types[type.id].count++; out.types[type.id].time+=m; out.types[type.id].weighted+=m*(type.severity||2); out.rows.push({b,min:m,type}); });
  out.typeRows=Object.values(out.types).sort((a,b)=>b.weighted-a.weighted || b.count-a.count); return out;
}
function compute(blocks){
  const t=totalsFrom(blocks), v=violationStats(blocks); const studyGoal=360, deepGoal=90, entLimit=60; const q=qualityValue(), body=bodyValue();
  const studyScore=clamp(t.study/studyGoal*100,0,110);
  const deepScore=clamp((t.deep/deepGoal*100)*0.7 + (q*10)*0.3,0,100);
  const focusScore=clamp(100 - v.count*8 - v.weighted*1.15,0,100);
  const entertainmentScore=clamp(100 - Math.max(0,t.entertainment-entLimit)*1.5 - t.entertainment*0.15 - v.weighted*0.35,0,100);
  let sleepScore=60; if(t.sleep>0){ if(t.sleep>=390 && t.sleep<=540) sleepScore=92; else if(t.sleep>=330 && t.sleep<390) sleepScore=78; else if(t.sleep>540 && t.sleep<=630) sleepScore=75; else sleepScore=55; }
  const lifeScore=clamp(sleepScore*0.45 + body*10*0.4 + clamp(t.exercise/30*15,0,15),0,100);
  const reflectScore=clamp(reflectionFilled()/3*100,0,100);
  const aspects={study:studyScore, deep:deepScore, focus:focusScore, entertainment:entertainmentScore, life:lifeScore, reflect:reflectScore};
  const overall=Math.round(aspects.study*0.30 + aspects.deep*0.15 + aspects.focus*0.20 + aspects.entertainment*0.15 + aspects.life*0.10 + aspects.reflect*0.10);
  return {totals:t, violations:v, aspects, overall, status:dayStatus(overall,t,v)};
}
function dayStatus(score,t,v){
  if(score>=88 && v.count===0 && t.study>=330) return {label:'高效稳定日', advice:'学习投入和专注都不错，注意别牺牲睡眠。'};
  if(t.study<180) return {label:'学习投入不足日', advice:'明天先保证一段连续学习，不要先追求完美。'};
  if(v.count>=3 || v.total>=25) return {label:'专注受损日', advice:'重点看主要违规 App，提前限制它。'};
  if(t.entertainment>90) return {label:'娱乐偏高日', advice:'娱乐可以有，但必须设置边界。'};
  if(score<60) return {label:'需要调整日', advice:'不要全改，先抓最拖后腿的一项。'};
  if(score>=75) return {label:'正常推进日', advice:'有推进，继续提高深度学习比例。'};
  return {label:'普通记录日', advice:'先保证记录连续，再逐步优化。'};
}
function aspectLabel(k){ return ({study:'学习投入',deep:'深度学习',focus:'专注纪律',entertainment:'娱乐控制',life:'生活状态',reflect:'反思复盘'})[k] || k; }

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
  renderLive(); renderDailyStatus(c); renderAspectBars('aspectBars',c.aspects); renderSummary(c); renderViolations(c); renderTimeline(blocks); renderStats(); renderRules();
}
function setText(id,txt){ if($(id)) $(id).textContent=txt; }
function renderLive(){
  const el=$('liveBox'); if(!el) return;
  if(!app.current.active){ el.textContent='未开始。选择状态后点“开始今天”。'; return; }
  el.innerHTML='当前：<b>'+esc(nameOfState(app.current.currentId))+'</b><br>开始：'+fmtTime(app.current.currentStartMs)+'｜已持续：'+fmtDur(durMin(app.current.currentStartMs,nowMs()));
}
function renderDailyStatus(c){ if($('dailyStatus')) $('dailyStatus').innerHTML='<b>'+esc(c.status.label)+'</b><br><span class="small">'+esc(c.status.advice)+'</span>'; }
function renderAspectBars(id,aspects){
  const el=$(id); if(!el) return; el.innerHTML=Object.entries(aspects).map(([k,v])=>'<div style="margin:9px 0"><div class="row" style="margin:0"><b>'+aspectLabel(k)+'</b><span class="small" style="text-align:right">'+Math.round(v)+'</span></div><div class="bar"><div style="width:'+clamp(v,0,100)+'%"></div></div></div>').join('');
}
function renderSummary(c){
  const rows=[['学习总时长',c.totals.study],['深度学习',c.totals.deep],['娱乐',c.totals.entertainment],['允许应用沟通',c.totals.allowed],['学习违规离开',c.totals.violation],['睡眠',c.totals.sleep],['运动',c.totals.exercise],['生活/其他',c.totals.life+c.totals.other]];
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
  if($('periodCards')) $('periodCards').innerHTML=[['综合分',c.overall],['学习',fmtDur(c.totals.study)],['深度',fmtDur(c.totals.deep)],['违规',c.violations.count+'次/'+fmtDur(c.violations.total)]].map(x=>'<div class="metric"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('');
  renderAspectBars('periodAspectBars', c.aspects);
  setText('periodViolationSummary','该周期违规 '+c.violations.count+' 次，总计 '+fmtDur(c.violations.total)+'。');
  if($('periodViolationRows')) $('periodViolationRows').innerHTML=c.violations.typeRows.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+x.count+'</td><td>'+fmtDur(x.time)+'</td></tr>').join('') || '<tr><td colspan="3" class="small">暂无违规。</td></tr>';
  if($('dayRows')) $('dayRows').innerHTML=days.slice().reverse().map(d=>'<tr><td>'+esc(d.date)+'</td><td>'+esc((d.status||{}).label||'')+'</td><td>'+Math.round(d.overall||0)+'</td><td>'+fmtDur((d.totals||{}).study||0)+' / '+fmtDur((d.totals||{}).entertainment||0)+'</td></tr>').join('') || '<tr><td colspan="4" class="small">暂无历史。</td></tr>';
}
function periodDays(p){
  archiveToday(true); let days=(app.history||[]).slice(); const today=localDate();
  if(p==='today') return days.filter(d=>d.date===today);
  if(p==='week'){ const n=new Date(); const day=(n.getDay()+6)%7; const start=new Date(n.getFullYear(),n.getMonth(),n.getDate()-day).getTime(); return days.filter(d=>dateBaseMs(d.date)>=start); }
  if(p==='all') return days;
  const count=Number(p)||7; const start=dateBaseMs(today)-(count-1)*86400000; return days.filter(d=>dateBaseMs(d.date)>=start);
}
function renderRules(){
  if($('catRows')) $('catRows').innerHTML=(app.categories||[]).filter(c=>!c.hidden).map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(GROUPS[c.group]||c.group)+'</td><td>'+(c.system?'<span class="tiny">系统</span>':'<button class="mini danger" onclick="deleteCategory(\''+c.id+'\')">删</button>')+'</td></tr>').join('');
  if($('stateRows')) $('stateRows').innerHTML=selectableStates().map(s=>'<tr><td>'+esc(s.name)+'</td><td>'+esc(catById(s.cat).name)+'</td><td>'+(s.system?'<span class="tiny">系统</span>':'<button class="mini danger" onclick="deleteState(\''+s.id+'\')">删</button>')+'</td></tr>').join('');
  if($('appTypeRows')) $('appTypeRows').innerHTML=(app.appTypes||[]).map(t=>'<tr><td>'+esc(t.name)+(t.allowed?' <span class="tag">允许</span>':'')+'</td><td>'+Number(t.severity||0)+'</td><td>'+(t.system?'<span class="tiny">系统</span>':'<button class="mini danger" onclick="deleteAppType(\''+t.id+'\')">删</button>')+'</td></tr>').join('');
  renderAppRules();
}
function unmappedApps(){
  const map={}; (app.usage||[]).forEach(u=>{ const k=norm(u.key||u.label); if(!k) return; if(app.appRules[k] || app.appRules[norm(u.label)]) return; if(!map[k]) map[k]={key:u.key,label:u.label,count:0,time:0}; map[k].count++; map[k].time += durMin(u.s,u.e); }); return Object.values(map).sort((a,b)=>b.time-a.time).slice(0,30);
}
function renderAppRules(){
  const opts=(app.appTypes||[]).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('');
  if($('unmappedAppRows')) $('unmappedAppRows').innerHTML=unmappedApps().map(u=>'<tr><td>'+esc(u.label||u.key)+'<br><span class="tiny">'+esc(u.key)+'</span></td><td>'+u.count+'次/'+fmtDur(u.time)+'</td><td><select id="map_'+esc(norm(u.key))+'">'+opts+'</select><button class="mini" onclick="quickMap(\''+esc(norm(u.key))+'\',\''+esc(u.label||u.key)+'\')">保存</button></td></tr>').join('') || '<tr><td colspan="3" class="small">暂无未分类 App。</td></tr>';
  if($('appRuleRows')) $('appRuleRows').innerHTML=Object.values(app.appRules||{}).map(r=>'<tr><td>'+esc(r.label||r.key)+'<br><span class="tiny">'+esc(r.key)+'</span></td><td>'+esc(appTypeById(r.appType).name)+'</td><td><button class="mini danger" onclick="deleteAppRule(\''+esc(r.key)+'\')">删</button></td></tr>').join('') || '<tr><td colspan="3" class="small">暂无规则。</td></tr>';
}
function quickMap(key,label){ const sel=$('map_'+key); if(!sel) return; app.appRules[key]={key,label,appType:sel.value}; autoClassifyAll(false); saveAll(); renderAll(); toast('已保存 App 规则'); }

function saveReflect(){ saveAll(); archiveToday(true); renderAll(); toast('反思已保存'); }
function exportText(){
  const c=compute(virtualBlocks()); const lines=[];
  lines.push('日期：'+(app.current.date||localDate())); lines.push('综合分：'+c.overall); lines.push('状态：'+c.status.label); lines.push('学习：'+fmtDur(c.totals.study)+'，深度：'+fmtDur(c.totals.deep)); lines.push('违规：'+c.violations.count+'次，'+fmtDur(c.violations.total)); lines.push('收获：'+val('gain')); lines.push('问题：'+val('problem')); lines.push('明天只改一个点：'+val('tomorrow'));
  $('exportBox').value=lines.join('\n'); toast('已生成今日总结');
}
function exportData(){ saveAll(); $('exportBox').value=JSON.stringify(app,null,2); toast('已导出全部数据'); }
function importData(){
  try{ const data=JSON.parse(val('importDataBox')); if(!data || typeof data!=='object') throw new Error('格式错误'); app=Object.assign(app,data); ensureSystemDefaults(); saveAll(); renderAll(); toast('导入成功'); }catch(e){ toast('导入失败：'+e.message); }
}
function showPage(p){ currentPage=p; ['Record','Timeline','Stats','Rules','Reflect'].forEach(x=>{ const sec=$('page'+x), nav=$('nav'+x); if(sec) sec.classList.toggle('hidden', x!==p); if(nav) nav.classList.toggle('active', x===p); }); renderAll(); }

window.deleteCategory=deleteCategory; window.deleteState=deleteState; window.deleteAppType=deleteAppType; window.deleteAppRule=deleteAppRule; window.deleteBlock=deleteBlock; window.quickMap=quickMap;

document.addEventListener('DOMContentLoaded', function(){ load(); bind(); initSelects(); checkUsagePermission(); showPage('Record'); setInterval(()=>{ if(app.current.active) renderAll(); }, 30000); });
