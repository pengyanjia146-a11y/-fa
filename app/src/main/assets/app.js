'use strict';

const STORE = 'student_reflect_record_stats_v2';
const FIELDS = ['qualityScore','bodyScore','gain','problem','tomorrow'];
const CAT = {
  study:{name:'普通学习',desc:'英语、数学、理化、作业等'},
  deep:{name:'深度学习',desc:'错题复盘、精读、推导、背诵闭环等'},
  game:{name:'游戏娱乐',desc:'游戏、短视频、娱乐刷屏'},
  wechat:{name:'微信必要沟通',desc:'学习中必要沟通，不按违规扣'},
  violation:{name:'学习违规离开',desc:'学习状态中离开前台，且不是必要微信'},
  sleep:{name:'睡眠',desc:'睡觉、午睡'},
  rest:{name:'休息',desc:'休息、放空'},
  meal:{name:'吃饭',desc:'吃饭、洗漱'},
  exercise:{name:'运动',desc:'跑步、走路、球类、拉伸'},
  commute:{name:'通勤',desc:'上学、回家、路上'},
  other:{name:'其他',desc:'暂时无法归类的时间'}
};
const DEFAULT_STATES = [
  {id:'study_math',name:'数学学习',cat:'study',def:true},
  {id:'study_english',name:'英语学习',cat:'study',def:true},
  {id:'study_science',name:'理化/文综',cat:'study',def:true},
  {id:'deep',name:'深度学习/错题复盘',cat:'deep',def:true},
  {id:'wechat',name:'微信必要沟通',cat:'wechat',def:true},
  {id:'violation',name:'学习违规离开',cat:'violation',def:true},
  {id:'game',name:'游戏/娱乐',cat:'game',def:true},
  {id:'meal',name:'吃饭/洗漱',cat:'meal',def:true},
  {id:'rest',name:'休息',cat:'rest',def:true},
  {id:'sleep',name:'睡眠',cat:'sleep',def:true},
  {id:'exercise',name:'运动',cat:'exercise',def:true},
  {id:'commute',name:'通勤',cat:'commute',def:true},
  {id:'other',name:'其他',cat:'other',def:true}
];
const VTYPE = {
  game:{name:'游戏/游戏软件',weight:1.35},
  short_video:{name:'短视频/娱乐刷屏',weight:1.5},
  browser:{name:'浏览器/网页跑偏',weight:1.0},
  chat:{name:'非必要聊天',weight:1.15},
  video:{name:'音乐/视频/影视',weight:1.25},
  tool:{name:'工具类但跑偏',weight:0.7},
  other:{name:'其他应用',weight:1.0},
  unknown:{name:'未自动识别',weight:1.0}
};
const VTYPE_ORDER = ['unknown','game','short_video','browser','chat','video','tool','other'];

let app = {
  states: DEFAULT_STATES.slice(),
  current: {date:null, blocks:[], active:false, currentId:null, currentStartMs:null, hidden:null, ended:false},
  history: [],
  usage: [],
  appRules: {}
};
let currentPage = 'Record';

function $(id){ return document.getElementById(id); }
function nowMs(){ return Date.now(); }
function localDate(ms){ const d = new Date(ms || Date.now()); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function dateBaseMs(date){ const d = date ? new Date(date+'T00:00:00') : new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function timeStr(ms){ const d = new Date(ms); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function durMin(a,b){ return Math.max(0, Math.round((b-a)/60000)); }
function fmt(m){ m = Math.round(m||0); const h = Math.floor(m/60); const r = m%60; return h ? `${h}h${r}m` : `${r}m`; }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function stateOf(id){ return app.states.find(s=>s.id===id) || {id, name:id || '未知', cat:'other'}; }
function nameOf(id){ return stateOf(id).name; }
function catOf(id){ return stateOf(id).cat || 'other'; }
function isLearning(id){ const c = catOf(id); return c === 'study' || c === 'deep'; }
function vtypeName(k){ return (VTYPE[k] && VTYPE[k].name) || k || '未识别'; }
function aspectLabel(k){ return ({study:'学习投入',deep:'深度质量',focus:'专注纪律',game:'娱乐控制',life:'生活状态',reflect:'反思复盘'})[k] || k; }
function normAppKey(s){ return String(s || '').trim().toLowerCase().replace(/\s+/g,' '); }
function overlapMs(a,b,c,d){ return Math.max(0, Math.min(b,d) - Math.max(a,c)); }
function parseTimeOnDate(date,hhmm){ const [h,m] = hhmm.split(':').map(Number); return dateBaseMs(date) + h*3600000 + m*60000; }

function load(){
  try{
    const raw = localStorage.getItem(STORE);
    if(raw){ app = JSON.parse(raw); }
  }catch(e){ console.log(e); }
  if(!Array.isArray(app.states) || !app.states.length) app.states = DEFAULT_STATES.slice();
  if(!app.current) app.current = {date:null, blocks:[], active:false, currentId:null, currentStartMs:null, hidden:null, ended:false};
  if(!Array.isArray(app.history)) app.history = [];
  if(!Array.isArray(app.usage)) app.usage = [];
  if(!app.appRules) app.appRules = {};
  FIELDS.forEach(id => { const v = localStorage.getItem('f_'+id); if(v !== null && $(id)) $(id).value = v; });
}
function saveAll(){
  FIELDS.forEach(id => { if($(id)) localStorage.setItem('f_'+id, $(id).value); });
  app.usage = (app.usage || []).slice(-3000);
  localStorage.setItem(STORE, JSON.stringify(app));
}
function toast(msg){
  const d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);background:#111827;color:white;padding:10px 14px;border-radius:999px;z-index:99;font-size:13px;max-width:88%;text-align:center';
  document.body.appendChild(d);
  setTimeout(()=>d.remove(),1600);
}

function initSelects(){
  const stateHtml = app.states.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}｜${esc(CAT[s.cat]?.name || s.cat)}</option>`).join('');
  ['stateSelect','manualModule'].forEach(id=>{ const el=$(id); if(!el) return; const old=el.value; el.innerHTML=stateHtml; if(old && app.states.some(s=>s.id===old)) el.value=old; });
  const catHtml = Object.entries(CAT).map(([k,v])=>`<option value="${k}">${esc(v.name)}</option>`).join('');
  if($('newStateCat')) $('newStateCat').innerHTML = catHtml;
  const vhtml = VTYPE_ORDER.map(k=>`<option value="${k}">${esc(VTYPE[k].name)}</option>`).join('');
  if($('ruleVType')) $('ruleVType').innerHTML = vhtml;
}

function virtualBlocks(){
  const arr = (app.current.blocks || []).slice();
  if(app.current.active && app.current.currentId && app.current.currentStartMs){
    arr.push({s:app.current.currentStartMs, e:nowMs(), m:app.current.currentId, n:'进行中', live:true});
  }
  return arr.sort((a,b)=>a.s-b.s);
}

function totalsFrom(blocks){
  const t = {total:0, study:0, deep:0, game:0, wechat:0, violation:0, sleep:0, rest:0, meal:0, exercise:0, commute:0, other:0};
  blocks.forEach(b=>{
    const m = durMin(b.s,b.e); const c = catOf(b.m);
    t.total += m;
    if(c === 'study') t.study += m;
    else if(c === 'deep'){ t.study += m; t.deep += m; }
    else if(c === 'game') t.game += m;
    else if(c === 'wechat') t.wechat += m;
    else if(c === 'violation'){ t.violation += m; }
    else if(t[c] !== undefined) t[c] += m;
    else t.other += m;
  });
  return t;
}

function violationStats(blocks){
  const out = {count:0,total:0,weighted:0,types:{},rows:[]};
  blocks.filter(b=>catOf(b.m)==='violation').forEach(b=>{
    const m = durMin(b.s,b.e); const key = b.vtype || 'unknown'; const vt = VTYPE[key] || VTYPE.unknown;
    out.count += 1; out.total += m; out.weighted += m * vt.weight;
    if(!out.types[key]) out.types[key] = {key, name:vt.name, count:0, time:0, weighted:0};
    out.types[key].count += 1; out.types[key].time += m; out.types[key].weighted += m * vt.weight;
    out.rows.push({b, min:m, key, name:vt.name});
  });
  out.typeRows = Object.values(out.types).sort((a,b)=>b.weighted-a.weighted || b.count-a.count);
  return out;
}

function qualityValue(){ return clamp(Number($('qualityScore')?.value || 0), 0, 10); }
function bodyValue(){ return clamp(Number($('bodyScore')?.value || 0), 0, 10); }
function reflectionFilled(){ return ['gain','problem','tomorrow'].filter(id => ($ (id)?.value || '').trim().length >= 4).length; }
function compute(blocks){
  const t = totalsFrom(blocks);
  const v = violationStats(blocks);
  const studyGoal = 360;
  const deepGoal = 90;
  const gameLimit = 45;
  const q = qualityValue();
  const body = bodyValue();
  const studyScore = clamp(t.study / studyGoal * 100, 0, 110);
  const deepTimeScore = clamp(t.deep / deepGoal * 100, 0, 100);
  const deepScore = clamp(deepTimeScore * 0.65 + q * 10 * 0.35, 0, 100);
  const focusScore = clamp(100 - v.count*9 - v.weighted*1.6, 0, 100);
  const entertainmentTotal = t.game;
  const gameScore = clamp(100 - Math.max(0, entertainmentTotal - gameLimit)*1.8 - entertainmentTotal*0.25, 0, 100);
  let sleepBase = 60;
  if(t.sleep > 0){
    if(t.sleep >= 390 && t.sleep <= 540) sleepBase = 92;
    else if(t.sleep >= 330 && t.sleep < 390) sleepBase = 78;
    else if(t.sleep > 540 && t.sleep <= 630) sleepBase = 75;
    else sleepBase = 55;
  }
  const exerciseBonus = clamp(t.exercise/30*12,0,12);
  const lifeScore = clamp(sleepBase*0.55 + body*10*0.35 + exerciseBonus, 0, 100);
  const reflectScore = clamp(reflectionFilled()/3*100, 0, 100);
  const aspects = {study:studyScore, deep:deepScore, focus:focusScore, game:gameScore, life:lifeScore, reflect:reflectScore};
  const overall = Math.round(aspects.study*0.30 + aspects.deep*0.15 + aspects.focus*0.20 + aspects.game*0.15 + aspects.life*0.10 + aspects.reflect*0.10);
  const status = dayStatus(overall, t, v);
  return {totals:t, violations:v, aspects, overall, status};
}
function dayStatus(score,t,v){
  let label='正常记录日', advice='继续记录，不要只看总分，要看违规和深度学习是否改善。';
  if(score >= 88 && v.count === 0 && t.study >= 330){ label='高效稳定日'; advice='这种状态可以保持，但别牺牲睡眠。'; }
  else if(t.study < 180){ label='学习投入不足日'; advice='明天先保证一段连续学习，不要急着追总分。'; }
  else if(v.count >= 3 || v.total >= 25){ label='专注受损日'; advice='重点不是骂自己，而是找主要违规 App，提前限制它。'; }
  else if(t.game > 75){ label='娱乐偏高日'; advice='娱乐不是不能有，但要设置边界。'; }
  else if(score < 60){ label='需要调整日'; advice='先找到最拖后腿的一项，明天只改一个动作。'; }
  else if(score >= 75){ label='正常推进日'; advice='有推进，继续把深度学习和违规控制做稳。'; }
  return {label, advice};
}

function startDay(){
  if(app.current.active){ toast('已经开始了'); return; }
  if((app.current.blocks||[]).length && !confirm('今天已有记录。重新开始会清空当前未归档时间轴，继续吗？')) return;
  app.current = {date:localDate(), blocks:[], active:true, currentId:$('stateSelect').value, currentStartMs:nowMs(), hidden:null, ended:false};
  saveAll(); renderAll(); toast('已开始今天');
}
function switchState(){
  if(!app.current.active){ toast('先点“开始今天”'); return; }
  const next = $('stateSelect').value;
  const n = nowMs();
  if(app.current.currentId){ app.current.blocks.push({s:app.current.currentStartMs, e:n, m:app.current.currentId}); }
  app.current.currentId = next;
  app.current.currentStartMs = n;
  saveAll(); renderAll(); toast('已切换到：'+nameOf(next));
}
function endDay(){
  if(!app.current.active){ toast('还没有开始今天'); return; }
  if(!confirm('确认结束今天？结束后会归档到历史统计。')) return;
  const n = nowMs();
  app.current.blocks.push({s:app.current.currentStartMs, e:n, m:app.current.currentId});
  app.current.active = false;
  app.current.currentId = null;
  app.current.currentStartMs = null;
  app.current.ended = true;
  autoClassifyAll();
  archiveToday();
  saveAll(); renderAll(); toast('今天已结束并归档');
}
function archiveToday(){
  const blocks = (app.current.blocks || []).slice();
  if(!blocks.length) return;
  const c = compute(blocks);
  const day = {date:app.current.date || localDate(blocks[0].s), blocks, totals:c.totals, violations:c.violations, aspects:c.aspects, overall:c.overall, status:c.status, reflect:{quality:qualityValue(), body:bodyValue(), gain:$('gain')?.value||'', problem:$('problem')?.value||'', tomorrow:$('tomorrow')?.value||''}};
  const idx = app.history.findIndex(d=>d.date===day.date);
  if(idx >= 0) app.history[idx] = day; else app.history.push(day);
  app.history.sort((a,b)=>a.date.localeCompare(b.date));
}
function newDay(){
  if(app.current.active && !confirm('当前还在计时。确认放弃当前进行中状态并新开一天？')) return;
  if((app.current.blocks||[]).length) archiveToday();
  app.current = {date:localDate(), blocks:[], active:false, currentId:null, currentStartMs:null, hidden:null, ended:false};
  ['gain','problem','tomorrow'].forEach(id=>{ if($(id)) $(id).value=''; });
  saveAll(); renderAll(); showPage('Record'); toast('已新开一天');
}

function appRuleFor(key,label){ return app.appRules[normAppKey(key)] || app.appRules[normAppKey(label)] || null; }
function recordId(r){ return [r.s,r.e,normAppKey(r.key||r.label)].join('|'); }
function addUsageRecord(rec){
  rec.key = String(rec.key || rec.label || '').trim(); rec.label = String(rec.label || rec.key || '').trim();
  if(!rec.key && !rec.label) return false;
  if(!rec.s || !rec.e || rec.e <= rec.s) return false;
  if(app.usage.some(x=>recordId(x)===recordId(rec))) return false;
  app.usage.push(rec); return true;
}
function bestUsageForBlock(b){
  let best=null, bestOv=0;
  (app.usage||[]).forEach(u=>{ const ov = overlapMs(b.s,b.e,u.s,u.e); if(ov > bestOv){ bestOv = ov; best = u; } });
  if(!best || bestOv < 30000) return null;
  return {rec:best, overlapMin:Math.max(1,Math.round(bestOv/60000))};
}
function autoClassifyBlock(b){
  if(catOf(b.m) !== 'violation') return b;
  const match = bestUsageForBlock(b);
  if(!match){ b.vtype = b.vtype || 'unknown'; return b; }
  const u = match.rec; const rule = appRuleFor(u.key,u.label);
  b.appKey = u.key; b.appLabel = u.label; b.autoOverlapMin = match.overlapMin;
  b.n = '自动匹配：' + u.label + '，重叠' + match.overlapMin + 'm';
  b.vtype = rule ? rule.vtype : (b.vtype || 'unknown');
  return b;
}
function autoClassifyAll(){
  (app.current.blocks||[]).forEach(autoClassifyBlock);
  (app.history||[]).forEach(d=>{ (d.blocks||[]).forEach(autoClassifyBlock); const c=compute(d.blocks||[]); d.totals=c.totals; d.violations=c.violations; d.aspects=c.aspects; d.overall=c.overall; d.status=c.status; });
}
function parseUsageLine(line){
  const text = line.trim(); if(!text) return null;
  const m = text.match(/^(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}:\d{2})\s*(?:-|~|—|至|到|\s+)\s*(\d{1,2}:\d{2})\s+(.+)$/);
  if(!m) return null;
  const date = m[1] || app.current.date || localDate();
  let s = parseTimeOnDate(date,m[2]); let e = parseTimeOnDate(date,m[3]); if(e <= s) e += 86400000;
  const rest = m[4].trim(); const parts = rest.split(/\s+/);
  const pkg = parts.find(x=>/^[a-zA-Z][\w]*(\.[\w]+)+$/.test(x));
  const label = pkg ? (parts.filter(x=>x!==pkg).join(' ') || pkg) : rest;
  return {s,e,key:pkg || label,label,src:'import'};
}
function importUsageText(){
  const box = $('usageImport'); if(!box) return;
  let ok=0,bad=0;
  box.value.split(/\n+/).forEach(line=>{ const r=parseUsageLine(line); if(r){ if(addUsageRecord(r)) ok++; } else if(line.trim()) bad++; });
  autoClassifyAll(); saveAll(); renderAll(); toast('导入'+ok+'条，无法识别'+bad+'条');
}
function trySyncUsage(){
  if(!window.AndroidBridge || !AndroidBridge.queryUsageEvents){ toast('当前版本没有系统读取桥，请粘贴导入'); return; }
  try{
    if(AndroidBridge.hasUsagePermission && !AndroidBridge.hasUsagePermission()){
      $('usageBridgeStatus').textContent = '还没有使用情况访问权限。请先点“打开权限设置”，允许本应用。';
      toast('请先开启使用情况访问权限'); return;
    }
    const start = (app.current.blocks[0]?.s) || dateBaseMs(app.current.date || localDate());
    const end = Date.now();
    const raw = AndroidBridge.queryUsageEvents(String(start), String(end));
    const arr = JSON.parse(raw || '[]');
    let ok=0;
    arr.forEach(r=>{ if(r.error){ $('usageBridgeStatus').textContent = r.error; return; } if(addUsageRecord({s:Number(r.s),e:Number(r.e),key:r.key || r.package || r.pkg,label:r.label || r.key || r.package,src:'system'})) ok++; });
    autoClassifyAll(); saveAll(); renderAll(); toast('读取系统记录 '+ok+' 条');
  }catch(e){ $('usageBridgeStatus').textContent = '读取失败：' + e; toast('读取失败'); }
}
function openUsageSettings(){
  if(window.AndroidBridge && AndroidBridge.openUsageSettings) AndroidBridge.openUsageSettings();
  else toast('当前环境不能打开系统设置');
}
function clearUsageRecords(){ if(confirm('清空已导入/读取的手机使用记录？应用分类规则不会清空。')){ app.usage=[]; saveAll(); renderAll(); } }
function addAppRule(key,label,vtype){
  key = key || $('ruleAppKey').value; label = label || $('ruleAppLabel').value || key; vtype = vtype || $('ruleVType').value;
  key = String(key||'').trim(); label = String(label||key).trim(); if(!key){ toast('先填 App 名称或包名'); return; }
  app.appRules[normAppKey(key)] = {key,label,vtype};
  if($('ruleAppKey')) $('ruleAppKey').value=''; if($('ruleAppLabel')) $('ruleAppLabel').value='';
  autoClassifyAll(); saveAll(); renderAll(); toast('已保存：'+label+' = '+vtypeName(vtype));
}
function deleteAppRule(k){ delete app.appRules[k]; autoClassifyAll(); saveAll(); renderAll(); }
function usageMatchesForViolations(){
  const rows=[]; const blocks=[];
  (app.current.blocks||[]).forEach(b=>blocks.push(b));
  (app.history||[]).forEach(d=>(d.blocks||[]).forEach(b=>blocks.push(b)));
  blocks.filter(b=>catOf(b.m)==='violation').forEach(b=>{ const m=bestUsageForBlock(b); if(m) rows.push({block:b, usage:m.rec, overlap:m.overlapMin}); });
  return rows;
}
function unmappedApps(){
  const map={};
  usageMatchesForViolations().forEach(x=>{ const u=x.usage; if(appRuleFor(u.key,u.label)) return; const k=normAppKey(u.key||u.label); if(!map[k]) map[k]={key:u.key,label:u.label,count:0,time:0}; map[k].count++; map[k].time+=x.overlap; });
  return Object.values(map).sort((a,b)=>b.time-a.time || b.count-a.count);
}

function addState(){
  const name = $('newStateName').value.trim(); const cat = $('newStateCat').value;
  if(!name){ toast('先填状态名称'); return; }
  app.states.push({id:'c_'+Date.now(), name, cat, def:false}); $('newStateName').value=''; saveAll(); renderAll(); toast('已添加状态');
}
function deleteState(id){
  const s = stateOf(id); if(s.def){ toast('默认状态不能删除'); return; }
  if(app.current.currentId === id){ toast('当前正在使用，不能删除'); return; }
  if((app.current.blocks||[]).some(b=>b.m===id)){ toast('今天时间轴已使用，先别删'); return; }
  if(confirm('删除这个自定义状态？')){ app.states = app.states.filter(x=>x.id!==id); saveAll(); renderAll(); }
}
function addManual(){
  const s=$('manualStart').value, e=$('manualEnd').value; if(!s || !e){ toast('先填开始和结束'); return; }
  let start=parseTimeOnDate(app.current.date || localDate(),s), end=parseTimeOnDate(app.current.date || localDate(),e); if(end<=start) end+=86400000;
  const b={s:start,e:end,m:$('manualModule').value,n:$('manualNote').value || '手动补录'};
  if(catOf(b.m)==='violation') b.vtype='unknown';
  autoClassifyBlock(b); app.current.blocks.push(b); $('manualNote').value=''; saveAll(); renderAll(); toast('已补录');
}
function delBlock(i){ if(confirm('删除这段记录？')){ app.current.blocks.splice(i,1); saveAll(); renderAll(); } }

function renderHome(){
  const blocks=virtualBlocks(); autoClassifyAll(); const c=compute(blocks); const t=c.totals; const v=c.violations;
  $('dateText').textContent = app.current.date || localDate(); $('scoreBig').textContent = c.overall; $('topScore').textContent = c.overall;
  $('topStudy').textContent = fmt(t.study); $('topDeep').textContent = fmt(t.deep); $('topViolation').textContent = v.count+'次';
  $('liveBox').innerHTML = app.current.active ? `正在记录：<b>${esc(nameOf(app.current.currentId))}</b>，已持续 ${fmt(durMin(app.current.currentStartMs, nowMs()))}<br><span class="small">开始：${timeStr(app.current.currentStartMs)}</span>` : '未开始。选择当前状态，然后点“开始今天”。';
  $('startBtn').disabled = app.current.active; $('switchBtn').disabled = !app.current.active; $('endBtn').disabled = !app.current.active;
  $('dailyStatus').innerHTML = `<h3>${esc(c.status.label)}</h3><div class="small">${esc(c.status.advice)}</div>`;
  renderAspectBars($('aspectBars'), c.aspects);
  $('summaryRows').innerHTML = [
    ['总记录',fmt(t.total)],['学习',fmt(t.study)],['深度学习',fmt(t.deep)],['游戏娱乐',fmt(t.game)],['微信必要沟通',fmt(t.wechat)],['学习违规',v.count+'次 / '+fmt(v.total)],['睡眠',fmt(t.sleep)],['运动',fmt(t.exercise)]
  ].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  $('violationSummary').textContent = v.count ? `今日违规 ${v.count} 次，共 ${fmt(v.total)}。主要原因：${v.typeRows[0]?.name || '未识别'}。` : '今天暂无学习违规。';
  $('violationRows').innerHTML = v.rows.map(x=>`<tr><td>${timeStr(x.b.s)}-${timeStr(x.b.e)}<br><span class="tiny">${esc(x.b.appLabel || x.b.n || '')}</span></td><td>${esc(x.name)}</td><td>${fmt(x.min)}</td></tr>`).join('') || '<tr><td colspan="3" class="small">没有违规记录</td></tr>';
}
function renderAspectBars(box, aspects){
  if(!box) return;
  box.innerHTML = Object.entries(aspects).map(([k,v])=>`<div style="margin:10px 0"><div class="row" style="margin:0"><div><b>${aspectLabel(k)}</b></div><div style="text-align:right">${Math.round(v)}</div></div><div class="bar"><div style="width:${clamp(v,0,100)}%"></div></div></div>`).join('');
}
function renderTimeline(){
  const arr=virtualBlocks();
  $('blockRows').innerHTML = arr.map((b)=>`<tr><td>${timeStr(b.s)}-${timeStr(b.e)}<br><span class="tiny">${esc(b.n||'')}</span></td><td><span class="tag">${esc(nameOf(b.m))}</span><br><span class="tiny">${esc(CAT[catOf(b.m)]?.name || catOf(b.m))}</span></td><td>${durMin(b.s,b.e)}</td><td>${b.live?'':`<button class="btn3 miniBtn" data-delblock="${app.current.blocks.indexOf(b)}">删</button>`}</td></tr>`).join('') || '<tr><td colspan="4" class="small">还没有记录</td></tr>';
  checkTimeline(arr);
  document.querySelectorAll('[data-delblock]').forEach(btn=>btn.addEventListener('click',()=>delBlock(Number(btn.dataset.delblock))));
}
function checkTimeline(arr){
  if(!arr.length){ $('timelineCheck').innerHTML='开始今天后，时间轴会连续生成。'; return; }
  const gaps=[]; const overlaps=[];
  for(let i=1;i<arr.length;i++){ const gap=durMin(arr[i-1].e,arr[i].s); if(gap>1) gaps.push(`${timeStr(arr[i-1].e)}-${timeStr(arr[i].s)} ${gap}m`); if(arr[i].s < arr[i-1].e-60000) overlaps.push(timeStr(arr[i].s)); }
  $('timelineCheck').innerHTML = (gaps.length ? `<span class="red">有空档：</span>${gaps.join('，')}` : '<span class="green">时间轴连续。</span>') + (overlaps.length ? ' <span class="orange">有重叠。</span>' : '');
}
function renderRules(){
  initSelects();
  $('stateRows').innerHTML = app.states.map(s=>`<tr><td>${esc(s.name)}<br><span class="tiny">${esc(s.id)}</span></td><td>${esc(CAT[s.cat]?.name || s.cat)}</td><td>${s.def?'<span class="tiny">默认</span>':`<button class="btn3 miniBtn" data-delstate="${esc(s.id)}">删</button>`}</td></tr>`).join('');
  document.querySelectorAll('[data-delstate]').forEach(btn=>btn.addEventListener('click',()=>deleteState(btn.dataset.delstate)));
  const unm=unmappedApps();
  $('unmappedAppRows').innerHTML = unm.map(u=>`<tr><td>${esc(u.label)}<br><span class="tiny">${esc(u.key)}</span></td><td>${u.count}次 / ${fmt(u.time)}</td><td><select data-mapkey="${esc(u.key)}" data-maplabel="${esc(u.label)}"><option value="unknown">选择</option>${VTYPE_ORDER.filter(k=>k!=='unknown').map(k=>`<option value="${k}">${esc(VTYPE[k].name)}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="3" class="small">暂无未分类 App。先读取/导入手机使用记录。</td></tr>';
  document.querySelectorAll('[data-mapkey]').forEach(sel=>sel.addEventListener('change',()=>{ if(sel.value!=='unknown') addAppRule(sel.dataset.mapkey, sel.dataset.maplabel, sel.value); }));
  const rules = Object.entries(app.appRules||{}).sort((a,b)=>a[1].label.localeCompare(b[1].label,'zh-CN'));
  $('appRuleRows').innerHTML = rules.map(([k,r])=>`<tr><td>${esc(r.label)}<br><span class="tiny">${esc(r.key)}</span></td><td>${esc(vtypeName(r.vtype))}</td><td><button class="btn3 miniBtn" data-delrule="${esc(k)}">删</button></td></tr>`).join('') || '<tr><td colspan="3" class="small">还没有应用规则。</td></tr>';
  document.querySelectorAll('[data-delrule]').forEach(btn=>btn.addEventListener('click',()=>deleteAppRule(btn.dataset.delrule)));
}
function renderStats(){
  const days = selectedDays();
  if(!days.length){ $('periodCards').innerHTML='<div class="small">还没有历史或今日记录。</div>'; $('periodAspectBars').innerHTML=''; $('periodViolationSummary').textContent=''; $('periodViolationRows').innerHTML=''; $('dayRows').innerHTML=''; return; }
  const sum={score:0,study:0,deep:0,game:0,violation:0,violationCount:0,total:0}; const asp={study:0,deep:0,focus:0,game:0,life:0,reflect:0}; const typeSum={};
  days.forEach(d=>{ const blocks=d.blocks||[]; const c=compute(blocks); sum.score+=c.overall; Object.keys(asp).forEach(k=>asp[k]+=c.aspects[k]||0); sum.study+=c.totals.study; sum.deep+=c.totals.deep; sum.game+=c.totals.game; sum.total+=c.totals.total; sum.violation+=c.violations.total; sum.violationCount+=c.violations.count; c.violations.typeRows.forEach(x=>{ if(!typeSum[x.key]) typeSum[x.key]={key:x.key,name:x.name,count:0,time:0}; typeSum[x.key].count+=x.count; typeSum[x.key].time+=x.time; }); });
  Object.keys(asp).forEach(k=>asp[k]=asp[k]/days.length);
  const avg=Math.round(sum.score/days.length);
  $('periodCards').innerHTML = `<div class="metric"><b>${avg}</b><span>平均综合分</span></div><div class="metric"><b>${days.length}天</b><span>统计天数</span></div><div class="metric"><b>${fmt(sum.study)}</b><span>总学习</span></div><div class="metric"><b>${fmt(sum.deep)}</b><span>总深度</span></div><div class="metric"><b>${fmt(sum.game)}</b><span>总娱乐</span></div><div class="metric"><b>${sum.violationCount}次/${fmt(sum.violation)}</b><span>总违规</span></div>`;
  renderAspectBars($('periodAspectBars'), asp);
  const typeRows=Object.values(typeSum).sort((a,b)=>b.time-a.time||b.count-a.count);
  $('periodViolationSummary').textContent = sum.violationCount ? `阶段违规 ${sum.violationCount} 次，共 ${fmt(sum.violation)}。主要原因：${typeRows[0]?.name || '无'}。` : '阶段内没有违规记录。';
  $('periodViolationRows').innerHTML = typeRows.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.count}</td><td>${fmt(x.time)}</td></tr>`).join('') || '<tr><td colspan="3" class="small">没有违规记录</td></tr>';
  $('dayRows').innerHTML = days.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(d=>{ const c=compute(d.blocks||[]); return `<tr><td>${esc(d.date)}</td><td>${esc(c.status.label)}<br><span class="tiny">违规${c.violations.count}次/${fmt(c.violations.total)}</span></td><td>${c.overall}</td><td>${fmt(c.totals.study)} / ${fmt(c.totals.game)}</td></tr>`; }).join('');
}
function selectedDays(){
  let raw = app.history.slice();
  if((app.current.blocks||[]).length || app.current.active){ const blocks=virtualBlocks(); raw = raw.filter(d=>d.date !== (app.current.date || localDate())); raw.push({date:app.current.date || localDate(), blocks}); }
  const p = $('periodSelect')?.value || 'today';
  if(p === 'all') return raw;
  const todayKey = localDate();
  if(p === 'today') return raw.filter(d=>d.date === (app.current.date || todayKey));
  let cutoff = new Date();
  if(p === 'week'){ const day = cutoff.getDay() || 7; cutoff.setDate(cutoff.getDate() - day + 1); }
  else { cutoff.setDate(cutoff.getDate() - Number(p) + 1); }
  const key = localDate(cutoff.getTime());
  return raw.filter(d=>d.date >= key);
}
function renderReflect(){ /* fields are normal inputs; nothing special needed */ }
function exportText(){
  const c=compute(virtualBlocks()), t=c.totals, v=c.violations; const lines=[];
  lines.push('日期：' + (app.current.date || localDate()));
  lines.push('每日状态：' + c.status.label + '，综合分：' + c.overall + '/100');
  lines.push('学习：' + fmt(t.study) + '，深度：' + fmt(t.deep) + '，游戏娱乐：' + fmt(t.game) + '，违规：' + v.count + '次/' + fmt(v.total));
  lines.push('各方面：' + Object.entries(c.aspects).map(([k,val])=>aspectLabel(k)+Math.round(val)).join('，'));
  lines.push('违规原因：' + (v.typeRows.length ? v.typeRows.map(x=>x.name + x.count + '次/' + fmt(x.time)).join('，') : '无'));
  lines.push('建议：' + c.status.advice);
  lines.push('时间轴：');
  virtualBlocks().forEach(b=>lines.push(timeStr(b.s)+'-'+timeStr(b.e)+' '+nameOf(b.m)+' '+durMin(b.s,b.e)+'m '+(catOf(b.m)==='violation' ? '['+vtypeName(b.vtype||'unknown')+'] ' : '')+(b.n||'')));
  lines.push('今日收获：' + (($('gain')?.value || '').trim() || ''));
  lines.push('今日问题：' + (($('problem')?.value || '').trim() || ''));
  lines.push('明天只改一个点：' + (($('tomorrow')?.value || '').trim() || ''));
  $('exportBox').value = lines.join('\n');
}
function renderAll(){
  saveAll(); initSelects();
  if($('dateText')) $('dateText').textContent = app.current.date || localDate();
  renderHome(); renderTimeline(); renderRules(); renderStats(); renderReflect();
}
function showPage(p){
  currentPage = p;
  ['Record','Timeline','Stats','Rules','Reflect'].forEach(x=>{ $('page'+x).classList.toggle('hidden',x!==p); $('nav'+x).classList.toggle('active',x===p); });
  renderAll();
}
function clearAll(){ if(confirm('确认清空全部本地数据？此操作不能恢复。')){ localStorage.clear(); app={states:DEFAULT_STATES.slice(),current:{date:null,blocks:[],active:false,currentId:null,currentStartMs:null,hidden:null,ended:false},history:[],usage:[],appRules:{}}; location.reload(); } }

function bindButtons(){
  $('startBtn').addEventListener('click', startDay);
  $('switchBtn').addEventListener('click', switchState);
  $('endBtn').addEventListener('click', endDay);
  $('manualAddBtn').addEventListener('click', addManual);
  $('periodSelect').addEventListener('change', renderAll);
  $('addStateBtn').addEventListener('click', addState);
  $('openUsageBtn').addEventListener('click', openUsageSettings);
  $('syncUsageBtn').addEventListener('click', trySyncUsage);
  $('importUsageBtn').addEventListener('click', importUsageText);
  $('clearUsageBtn').addEventListener('click', clearUsageRecords);
  $('addRuleBtn').addEventListener('click', ()=>addAppRule());
  $('saveReflectBtn').addEventListener('click', ()=>{ saveAll(); renderAll(); toast('已保存反思'); });
  $('exportBtn').addEventListener('click', exportText);
  $('newDayBtn').addEventListener('click', newDay);
  $('clearAllBtn').addEventListener('click', clearAll);
  $('navRecord').addEventListener('click', ()=>showPage('Record'));
  $('navTimeline').addEventListener('click', ()=>showPage('Timeline'));
  $('navStats').addEventListener('click', ()=>showPage('Stats'));
  $('navRules').addEventListener('click', ()=>showPage('Rules'));
  $('navReflect').addEventListener('click', ()=>showPage('Reflect'));
}

document.addEventListener('visibilitychange', () => {
  if(document.hidden){
    if(app.current.active && isLearning(app.current.currentId)){
      app.current.hidden = {startMs:Date.now(), module:app.current.currentId, stateStartMs:app.current.currentStartMs}; saveAll();
    }
  } else {
    if(app.current.active && app.current.hidden){
      const h=app.current.hidden; const n=Date.now(); const away=durMin(h.startMs,n); app.current.hidden=null;
      if(away >= 1){
        setTimeout(()=>{
          const ok = confirm('学习状态中离开前台约 '+away+' 分钟。\n确定=微信必要沟通；取消=学习违规离开，原因稍后自动匹配');
          if(app.current.currentStartMs < h.startMs){ app.current.blocks.push({s:app.current.currentStartMs,e:h.startMs,m:h.module,n:'离开前学习'}); }
          if(ok){ app.current.blocks.push({s:h.startMs,e:n,m:'wechat',n:'学习中微信必要沟通',from:h.module}); }
          else { const b={s:h.startMs,e:n,m:'violation',vtype:'unknown',n:'等待手机使用记录自动匹配',from:h.module}; autoClassifyBlock(b); app.current.blocks.push(b); }
          app.current.currentId = h.module; app.current.currentStartMs = n; saveAll(); renderAll();
        }, 200);
      } else { saveAll(); renderAll(); }
    }
  }
});

window.addEventListener('load', () => {
  try{
    load(); initSelects(); bindButtons(); showPage('Record');
    setInterval(()=>{ if(app.current.active) renderAll(); }, 30000);
  }catch(e){
    document.body.innerHTML = '<main><div class="card"><h2>启动错误</h2><pre style="white-space:pre-wrap">'+esc(e.stack || e)+'</pre></div></main>';
  }
});
