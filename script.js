const $=id=>document.getElementById(id);
const STORAGE_KEY="focusmate_v2_tasks";
let tasks=loadTasks(), currentFilter="all", toastTimer;
let planViewDate=null;
const SKEY="focusmate_v7_sessions", AKEY="focusmate_v7_active";
function readStore(k,def){try{return JSON.parse(localStorage.getItem(k))??def}catch{return def}}
let sessions=readStore(SKEY,[]),active=readStore(AKEY,null),calendarMonth=new Date(),selectedDay=localToday();
function saveTiming(){localStorage.setItem(SKEY,JSON.stringify(sessions));if(active)localStorage.setItem(AKEY,JSON.stringify(active));else localStorage.removeItem(AKEY)}
function isTracked(t){return t.trackTime!==false}
function clock(sec){sec=Math.floor(Math.max(0,sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return (h?String(h).padStart(2,"0")+":":"")+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")}
function human(sec){const m=Math.floor(sec/60);return m>=60?`${Math.floor(m/60)}시간 ${m%60}분`:m?`${m}분`:`${Math.floor(sec)}초`}
function measured(id){return sessions.filter(s=>String(s.id)===String(id)).reduce((v,s)=>v+s.seconds,0)+(active&&String(active.id)===String(id)?active.elapsed+(active.running?(Date.now()-active.since)/1000:0):0)}
function stopActive(){if(!active)return;const seconds=active.elapsed+(active.running?(Date.now()-active.since)/1000:0);if(seconds>0)sessions.push({id:active.id,date:localToday(),seconds});active=null;saveTiming()}
function startTask(id){const t=tasks.find(x=>String(x.id)===String(id));if(!t||t.done||t.incomplete||!isTracked(t)||!canActOn(t))return;if(active&&String(active.id)!==String(id))stopActive();if(!active)active={id,elapsed:0,running:false};if(active.running)return;active.running=true;active.since=Date.now();saveTiming();renderTasks();updateLinked();showToast("학습 시간 측정을 시작했어요.")}
function pauseTask(id){if(!active||String(active.id)!==String(id)||!active.running)return;active.elapsed+=(Date.now()-active.since)/1000;active.running=false;saveTiming();renderTasks();updateLinked();showToast("학습 시간을 일시정지했어요.")}
function completeTask(id){const t=tasks.find(x=>String(x.id)===String(id));if(!t||!canActOn(t))return;if(active&&String(active.id)===String(id))stopActive();t.done=true;t.incomplete=false;t.failedAt=null;t.failureType=null;save();updateDashboard();showToast("계획을 완료했어요!")}
function updateLinked(){/* 독립 집중 타이머 화면 제거: 일정별 측정은 유지 */}
function refreshClocks(){document.querySelectorAll("[data-clock]").forEach(x=>x.textContent=clock(measured(x.dataset.clock)));updateLinked()}

function loadTasks(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]}catch{return []}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(tasks))}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showToast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2500)}
function stats(){const total=tasks.length,done=tasks.filter(t=>t.done).length,failed=tasks.filter(t=>t.incomplete&&!t.done).length,left=total-done-failed,rate=total?Math.round(done/total*100):0;return{total,done,failed,left,rate}}
function updateDashboard(){
 expireOverdueTasks();
 const s=stats();
 updateWeeklyHero(s);
 $("totalStat").textContent=s.total+"개";$("doneStat").textContent=s.done+"개";$("leftStat").textContent=s.left+"개";$("rateStat").textContent=s.rate+"%";
 $("progressFill").style.width=s.rate+"%";$("progressText").textContent=s.rate+"%";
 $("reportTotal").textContent=s.total+"개";$("reportDone").textContent=s.done+"개";$("reportLeft").textContent=s.left+"개";$("reportRate").textContent=s.rate+"%";$("reportFill").style.width=s.rate+"%";
 $("planCountText").textContent=`총 ${s.total}개 · 완료 ${s.done}개 · 실패 ${s.failed}개 · 진행 중 ${s.left}개`;
 if(!s.total){$("reportMessage").textContent="아직 등록된 계획이 없어요."}
 else{$('reportMessage').textContent=`현재 달성률은 ${s.rate}%예요.`}
 renderTasks();
 failureSummaryRender();
}
function parseMinutes(t){
 if(Number.isFinite(Number(t.minutes))&&Number(t.minutes)>0)return Number(t.minutes);
 const d=String(t.duration||"");const hour=Number((d.match(/(\d+)\s*(?:시간|h)/)||[])[1]||0);const minute=Number((d.match(/(\d+)\s*(?:분|m)/)||[])[1]||0);
 return hour*60+minute;
}
function readableMinutes(m){if(!m)return "시간 미지정";return (Math.floor(m/60)?Math.floor(m/60)+"시간 ":"")+(m%60?m%60+"분":"").trim()}
function localDateFromISO(iso){const [y,m,d]=iso.split("-").map(Number);return new Date(y,m-1,d)}
function toISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function taskStart(t){return t.startDate||t.date}
function taskEnd(t){return t.date||t.startDate}
function taskRange(t){const start=taskStart(t),end=taskEnd(t);return start&&end&&start!==end?`${start} ~ ${end}`:(end||"날짜 미정")}
function occursOn(t,iso){return !!(taskStart(t)&&taskEnd(t)&&taskStart(t)<=iso&&iso<=taskEnd(t))}
function canActOn(t){return !!t && occursOn(t,localToday()) && !t.done && !t.incomplete && !isExpired(t)}
function isExpired(t){return !!taskEnd(t) && taskEnd(t)<localToday()}
function isAutoFailed(t){return !!t && t.incomplete && t.failureType==="expired"}
function expireOverdueTasks(){
 let changed=false;
 for(const t of tasks){
  if(t.done||t.incomplete||!isExpired(t))continue;
  if(active&&String(active.id)===String(t.id))stopActive();
  t.done=false;t.incomplete=true;t.failureType="expired";
  t.failedAt=new Date(`${taskEnd(t)}T23:59:59`).toISOString();
  addHistory(t,"자동 실패","",{deadline:taskEnd(t)});
  changed=true;
 }
 if(changed)save();
 return changed;
}
function shiftDay(iso,n){const d=localDateFromISO(iso);d.setDate(d.getDate()+n);return toISO(d)}
function addHistory(t,status,reason,extra={}){if(!Array.isArray(t.history))t.history=[];t.history.push({status,reason:reason.trim(),at:new Date().toISOString(),...extra})}
function updateWeeklyHero(s){
 $("homeHero").classList.toggle("hidden",s.total>0);
 $("weeklyHero").classList.toggle("hidden",s.total===0);
 const today=new Date();today.setHours(0,0,0,0);
 const monday=new Date(today);monday.setDate(today.getDate()-(today.getDay()+6)%7);
 const sunday=new Date(monday);sunday.setDate(monday.getDate()+6);
 const weekly=tasks.filter(t=>{if(!taskStart(t)||!taskEnd(t))return false;return taskStart(t)<=toISO(sunday)&&taskEnd(t)>=toISO(monday)});
 const done=weekly.filter(t=>t.done).length,total=weekly.length,rate=total?Math.round(done/total*100):0;
 $("weeklyRate").textContent=rate+"%";$("weeklyFill").style.width=rate+"%";
 $("weeklyTotal").textContent=total+"개";$("weeklyDone").textContent=done+"개";$("weeklyLeft").textContent=total-done+"개";
 $("weeklySummary").textContent=total?`이번 주 계획 ${total}개 중 ${done}개를 완료했어요!`:'이번 주 날짜로 등록된 계획이 아직 없어요.';
}
let pendingPostponeId=null;
function openPostpone(id){
 const t=tasks.find(x=>String(x.id)===id);if(!canActOn(t))return;
 pendingPostponeId=id;
 $("postponeTaskName").textContent='「'+t.name+'」';
 $("postponeLoss").textContent=isTracked(t)?readableMinutes(parseMinutes(t)):"시간 측정 없는 일정";
 const minDate=shiftDay(localToday(),1);
 $("postponeStartDate").min=localToday();
 $("postponeStartDate").value= minDate;
 $("postponeTargetDate").value=shiftDay(taskEnd(t),1);
 syncPostponeDates();$("postponeReason").value="";
 $("postponeModal").classList.remove("hidden");$("postponeNo").focus();
}
function closePostpone(){pendingPostponeId=null;$("postponeModal").classList.add("hidden")}
$("postponeNo").addEventListener("click",closePostpone);
function syncPostponeDates(){
 const t=tasks.find(x=>String(x.id)===String(pendingPostponeId));if(!t)return;
 const start=$("postponeStartDate").value;
 const minEnd=shiftDay(taskEnd(t),1);
 $("postponeTargetDate").min=start>minEnd?start:minEnd;
 if($("postponeTargetDate").value<$("postponeTargetDate").min)$("postponeTargetDate").value=$("postponeTargetDate").min;
 $("postponeDate").textContent=`변경 예정 기간: ${taskRange(t)} → ${start||"시작일 선택 필요"} ~ ${$("postponeTargetDate").value}`;
}
$("postponeStartDate").addEventListener("change",syncPostponeDates);
$("postponeTargetDate").addEventListener("change",syncPostponeDates);
$("postponeYes").addEventListener("click",()=>{
 if(pendingPostponeId===null)return;
 const id=pendingPostponeId;
 const t=tasks.find(x=>String(x.id)===String(id));
 if(!canActOn(t)){closePostpone();updateDashboard();return;}
 const start=$("postponeStartDate").value,target=$("postponeTargetDate").value;
 if(!$("postponeStartDate").checkValidity()||!$("postponeTargetDate").checkValidity()||!start||!target||start<localToday()||target<start||target<=taskEnd(t)){showToast("시작일과 마감일을 올바르게 선택해 주세요. 마감일은 기존보다 늦어야 해요.");return}
 const reason=$("postponeReason").value;
 const oldDate=t.date;const oldStart=taskStart(t);
 if(active&&String(active.id)===String(t.id))stopActive();
 const previousSeconds=measured(t.id);
 sessions=sessions.filter(x=>String(x.id)!==String(t.id));
 if(active&&String(active.id)===String(t.id))active=null;
 saveTiming();
 t.date=target;t.startDate=start;
 t.postponed=(t.postponed||0)+1;
 addHistory(t,"미루기",reason,{from:oldDate,to:t.date,fromStart:oldStart,toStart:start,previousSeconds:Math.floor(previousSeconds)});
 closePostpone();save();updateDashboard();
 if($("calendar").classList.contains("active"))renderCalendar();
 showToast(`${start} ~ ${target}로 일정을 미뤘어요.`);
});
// 경고 팝업은 바깥 클릭과 Escape로 닫히지 않음. 두 선택 버튼만 허용.
document.addEventListener("keydown",e=>{if(!$("postponeModal").classList.contains("hidden")){if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation()}if(e.key==="Tab"){const first=$("postponeNo"),last=$("postponeYes");if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}},true);
function taskHTML(t){
 const allowed=canActOn(t), autoFailed=isAutoFailed(t);
 const a=active&&String(active.id)===String(t.id);
 const timer=allowed&&isTracked(t)?`<button class="task-btn" data-${a&&active.running?"pause":"start"}="${t.id}">${a&&active.running?"Ⅱ 일시정지":a?"▶ 재개":"▶ 시작"}</button>`:"";
 const reason=latestReason(t);
 const note=t.incomplete?`<div class="task-note">${autoFailed?"기한 초과 · 자동 실패":"실패"} · ${escapeHTML(reason||"사유 미입력")}</div>`:"";
 const history=t.history?.length?`<details class="task-history"><summary>변경 기록 ${t.history.length}건</summary>${t.history.map(h=>`<div>${escapeHTML(h.status)} · ${escapeHTML(h.reason||"사유 미입력")}${h.to?` (${escapeHTML(h.fromStart?`${h.fromStart} ~ ${h.from}`:h.from||"")} → ${escapeHTML(h.toStart?`${h.toStart} ~ ${h.to}`:h.to)})`:""}</div>`).join("")}</details>`:"";
 const actions=t.incomplete
  ?`${autoFailed?`<button class="task-btn" data-incomplete="${t.id}">✎ ${reason?"사유 수정":"실패 사유 입력"}</button>`:`<button class="task-btn undo-btn" data-undo="${t.id}">↶ 실패 취소</button>`}`
  :t.done?`<button class="task-btn undo-btn" data-undo="${t.id}" ${isExpired(t)?"disabled title=\"마감일이 지나 완료를 취소할 수 없습니다\"":""}>↶ 완료 취소</button>`
  :`${timer}<button class="task-btn done-btn" data-complete="${t.id}" ${allowed?"":"disabled title=\"오늘 진행할 일정이 아닙니다\""}>✓ 완료</button><button class="task-btn postpone-btn" data-postpone="${t.id}" ${allowed?"":"disabled"}>◷ 미루기</button><button class="task-btn" data-incomplete="${t.id}" ${allowed?"":"disabled"}>✎ 실패</button>`;
 return `<div class="task-row ${t.done?"completed":t.incomplete?"failed":""}"><div class="task-main"><div class="task-title">${escapeHTML(t.name)}</div><div class="task-meta">${escapeHTML(t.type||"학습")} · ${escapeHTML(t.subject||"과목 미지정")} · ${escapeHTML(taskRange(t))} · ${escapeHTML(isTracked(t)?t.duration||"예상 시간 미정":"시간 측정 없는 일정")}</div>${note}${history}<div class="task-measured">${isTracked(t)?`⏱ 실제 <span data-clock="${t.id}">${clock(measured(t.id))}</span>`:"시간 측정 없는 일정"}</div></div><span class="tag ${t.priority==="높음"?"high":""}">${escapeHTML(t.priority)}</span><div class="task-actions">${actions}<button class="delete-btn" data-delete="${t.id}" title="계획 삭제">🗑</button></div></div>`;
}
let pendingIncompleteId=null;
function openIncomplete(id){const t=tasks.find(x=>String(x.id)===String(id));if(!canActOn(t)&&!isAutoFailed(t))return;pendingIncompleteId=id;$("incompleteTaskName").textContent=t.name;$("incompleteReason").value=latestReason(t);$("incompleteModal").classList.remove("hidden");$("incompleteReason").focus()}
function closeIncomplete(){pendingIncompleteId=null;$("incompleteModal").classList.add("hidden")}
$("incompleteCancel").addEventListener("click",closeIncomplete);
$("incompleteSave").addEventListener("click",()=>{const t=tasks.find(x=>String(x.id)===String(pendingIncompleteId));if(!t||(!canActOn(t)&&!isAutoFailed(t)))return;const reason=$("incompleteReason").value.trim();if(!reason){showToast("실패 사유를 입력해 주세요.");$("incompleteReason").focus();return;}if(active&&String(active.id)===String(t.id))stopActive();t.done=false;t.incomplete=true;
 if(isAutoFailed(t)){
  t.history=(Array.isArray(t.history)?t.history:[]).filter(h=>h.status!=="자동 실패 사유");
  addHistory(t,"자동 실패 사유",reason);
 }else{
  t.failureType="manual";t.failedAt=new Date().toISOString();
  t.history=(Array.isArray(t.history)?t.history:[]).filter(h=>h.status!=="실패"&&h.status!=="미완료");
  addHistory(t,"실패",reason);
 }closeIncomplete();save();updateDashboard();if($("calendar").classList.contains("active"))renderCalendar();showToast("실패 사유를 저장했어요.")});
function emptyHTML(message){return `<div class="empty-state">🌱<br>${message}</div>`}
function renderTasks(){
 const view=planViewDate||localToday();
 const visible=tasks.filter(t=>occursOn(t,view));
 const sorted=[...visible].sort((a,b)=>Number(a.done)-Number(b.done));
 const homeSorted=tasks.filter(t=>occursOn(t,localToday())).sort((a,b)=>{
   if($("homeSort").value==="priority"){
     const rank={"높음":0,"보통":1,"낮음":2};
     const diff=(rank[a.priority]??1)-(rank[b.priority]??1);
     if(diff!==0)return diff;
   }
   return (Number(b.created)||0)-(Number(a.created)||0)||tasks.indexOf(b)-tasks.indexOf(a);
 });
 $("homeTaskList").innerHTML=homeSorted.length?homeSorted.slice(0,4).map(taskHTML).join(""):emptyHTML("아직 계획이 없어요.<br>위의 '첫 계획 만들기' 버튼을 눌러 시작해 보세요.");
 const filtered=sorted.filter(t=>currentFilter==="all"||(currentFilter==="todo"&&!t.done&&!t.incomplete)||(currentFilter==="done"&&t.done));
 $("planCountText").textContent=`${view} · 총 ${visible.length}개 · 완료 ${visible.filter(t=>t.done).length}개 · 실패 ${visible.filter(t=>t.incomplete).length}개 · 진행 중 ${visible.filter(t=>!t.done&&!t.incomplete).length}개`;
 $("fullTaskList").innerHTML=filtered.length?filtered.map(taskHTML).join(""):emptyHTML(currentFilter==="done"?"완료한 계획이 아직 없어요.":currentFilter==="todo"?"진행 중인 계획이 없어요.":"등록된 계획이 없어요. 위에서 첫 계획을 추가해 보세요.");
 document.querySelectorAll("[data-start]").forEach(x=>x.addEventListener("click",()=>startTask(x.dataset.start)));
 document.querySelectorAll("[data-pause]").forEach(x=>x.addEventListener("click",()=>pauseTask(x.dataset.pause)));
 document.querySelectorAll("[data-complete]").forEach(x=>x.addEventListener("click",()=>completeTask(x.dataset.complete)));
 document.querySelectorAll("[data-undo]").forEach(el=>el.addEventListener("click",()=>{const t=tasks.find(x=>String(x.id)===el.dataset.undo);if(t&&!isAutoFailed(t)&&!isExpired(t)){t.done=false;t.incomplete=false;t.failedAt=null;t.failureType=null;t.history=(Array.isArray(t.history)?t.history:[]).filter(h=>h.status!=="실패"&&h.status!=="미완료");save();updateDashboard();showToast("상태를 진행 중으로 되돌렸어요.")}}));
 document.querySelectorAll("[data-postpone]").forEach(el=>el.addEventListener("click",()=>openPostpone(el.dataset.postpone)));
 document.querySelectorAll("[data-incomplete]").forEach(el=>el.addEventListener("click",()=>openIncomplete(el.dataset.incomplete)));
 document.querySelectorAll("[data-delete]").forEach(el=>el.addEventListener("click",()=>{
  const id=String(el.dataset.delete);
  const t=tasks.find(x=>String(x.id)===id);
  if(!t||!confirm(`'${t.name}' 계획을 삭제할까요?\n연결된 학습 시간 기록도 함께 삭제됩니다.`))return;
  // 타이머를 종료하되 삭제된 일정의 기록은 남기지 않음
  if(active&&String(active.id)===id)active=null;
  sessions=sessions.filter(x=>String(x.id)!==id);
  tasks=tasks.filter(x=>String(x.id)!==id);
  saveTiming();save();updateDashboard();updateLinked();
  if($("calendar").classList.contains("active"))renderCalendar();
  showToast("계획과 연결된 학습 기록을 삭제했어요.");
}));
}
function showPage(id){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===id));const info={home:["안녕하세요!","오늘의 목표를 하나씩 완성해 봐요."],plans:["나의 계획","하고 싶은 일을 직접 등록하고 관리해 보세요."],report:["학습 리포트","내가 세운 계획과 실천 결과를 확인해요."],calendar:["학습 캘린더","날짜별 계획과 실제 들인 시간을 확인해요."]};$("pageTitle").textContent=info[id][0];$("pageSubtitle").textContent=info[id][1];if(id==="calendar")renderCalendar();}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.goto)));
function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function openPlanModal(){ $("planForm").reset();$("minutesWrap").classList.remove("hidden");$("taskStartDate").value=localToday();$("taskDate").value=localToday();$("taskDate").min=$("taskStartDate").value;$("planModal").classList.remove("hidden");$("taskName").focus() }
function closePlanModal(){ $("planModal").classList.add("hidden") }
$("openPlanModal").addEventListener("click",openPlanModal);
$("closePlanModal").addEventListener("click",closePlanModal);
$("cancelPlanModal").addEventListener("click",closePlanModal);
$("planModal").addEventListener("click",e=>{if(e.target===$("planModal"))closePlanModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closePlanModal();closeIncomplete()}});
$("taskStartDate").addEventListener("change",()=>{$("taskDate").min=$("taskStartDate").value;if($("taskDate").value<$("taskStartDate").value)$("taskDate").value=$("taskStartDate").value});
$("taskTrack").addEventListener("change",()=>$("minutesWrap").classList.toggle("hidden",$("taskTrack").value==="no"));
$("planForm").addEventListener("submit",e=>{
 e.preventDefault();const name=$("taskName").value.trim();const trackTime=$("taskTrack").value==="yes";const minutes=trackTime&&$("taskMinutes").value!==""?Number($("taskMinutes").value):0;
 if(!name||!$("taskStartDate").value||!$("taskDate").value||$("taskDate").value<$("taskStartDate").value||(trackTime&&minutes!==0&&(!Number.isInteger(minutes)||minutes<1||minutes>1440))){showToast("필수 항목을 올바르게 입력해 주세요.");return}
 const duration=!trackTime?"시간 측정 없는 일정":minutes===0?"예상 시간 미정":minutes>=60?`${Math.floor(minutes/60)}시간${minutes%60?` ${minutes%60}분`:""}`:`${minutes}분`;
 tasks.push({id:typeof crypto.randomUUID==="function"?crypto.randomUUID():String(Date.now()+Math.random()),name,type:$("taskType").value,subject:$("taskSubject").value.trim(),startDate:$("taskStartDate").value,date:$("taskDate").value,duration,minutes,trackTime,priority:$("taskPriority").value,done:false,created:Date.now()});
 save();closePlanModal();updateDashboard();showToast("새 학습 계획을 저장했어요!");
});
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{currentFilter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));renderTasks()}));
$("homeSort").addEventListener("change",renderTasks);
planViewDate=localToday();$("planViewDate").value=planViewDate;
function setPlanViewDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;planViewDate=date;$("planViewDate").value=date;renderTasks()}
$("planViewDate").addEventListener("change",e=>setPlanViewDate(e.target.value));
$("planPrevDay").addEventListener("click",()=>setPlanViewDate(shiftDay(planViewDate,-1)));
$("planNextDay").addEventListener("click",()=>setPlanViewDate(shiftDay(planViewDate,1)));

// 시간 제한 없는 스톱워치: 시작/일시정지/재개/초기화
$("todayLabel").textContent=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date());
updateDashboard();

function dayTotals(iso){const list=tasks.filter(t=>occursOn(t,iso));const planned=list.filter(t=>taskStart(t)===iso).reduce((v,t)=>v+parseMinutes(t),0);const actual=sessions.filter(s=>s.date===iso).reduce((v,s)=>v+s.seconds,0)+(active&&localToday()===iso?active.elapsed+(active.running?(Date.now()-active.since)/1000:0):0);return{list,planned,actual}}
function renderCalendar(){const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth();$("monthLabel").textContent=`${y}년 ${m+1}월`;let out="";const first=(new Date(y,m,1).getDay()+6)%7;for(let i=0;i<first;i++)out+='<div></div>';for(let d=1;d<=new Date(y,m+1,0).getDate();d++){const iso=toISO(new Date(y,m,d)),t=dayTotals(iso);out+=`<button class="cal-day ${iso===selectedDay?"selected":""}" data-day="${iso}"><b>${d}</b>${t.list.length?`<small>계획 ${t.list.length}개</small>`:""}${t.actual?`<span>⏱ ${human(t.actual)}</span>`:""}</button>`}$("calendarGrid").innerHTML=out;document.querySelectorAll("[data-day]").forEach(x=>x.addEventListener("click",()=>{selectedDay=x.dataset.day;renderCalendar()}));const t=dayTotals(selectedDay);$("selectedDateLabel").textContent=selectedDay+" 학습 현황";$("calendarSummary").innerHTML=`<div>계획 <b>${t.list.length}개</b></div><div>예상 학습 <b>${human(t.planned*60)}</b></div><div>실제 학습 <b>${human(t.actual)}</b></div>`;$("calendarTasks").innerHTML=t.list.length?t.list.map(x=>`<div class="cal-task"><b>${escapeHTML(x.name)}</b><span>${x.done?"완료":x.incomplete?"실패":"진행 중"} · ${isTracked(x)?human(measured(x.id)):"시간 측정 없는 일정"}</span></div>`).join(""):'<p class="muted">등록된 계획이 없어요.</p>'}
$("prevMonth").addEventListener("click",()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar()});$("nextMonth").addEventListener("click",()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);renderCalendar()});$("calendarToday").addEventListener("click",()=>{calendarMonth=new Date();selectedDay=localToday();renderCalendar()});setInterval(refreshClocks,1000);updateLinked();

// v10: 모바일 슬라이드 드로어
(function(){
  const toggle=document.getElementById("mobileMenuToggle");
  const sidebar=document.querySelector(".sidebar");
  const backdrop=document.getElementById("mobileMenuBackdrop");
  const nav=document.getElementById("mainNavigation");
  if(!toggle||!sidebar||!backdrop||!nav)return;
  function setOpen(open){
    sidebar.classList.toggle("menu-open",open);
    document.body.classList.toggle("mobile-drawer-open",open);
    toggle.setAttribute("aria-expanded",String(open));
    toggle.setAttribute("aria-label",open?"메뉴 닫기":"메뉴 열기");
    toggle.querySelector("span").textContent=open?"✕":"☰";
    backdrop.setAttribute("aria-hidden",String(!open));
  }
  toggle.addEventListener("click",function(){setOpen(!sidebar.classList.contains("menu-open"))});
  backdrop.addEventListener("click",function(){setOpen(false)});
  nav.querySelectorAll("[data-page]").forEach(function(button){button.addEventListener("click",function(){setOpen(false)})});
  document.addEventListener("keydown",function(event){if(event.key==="Escape")setOpen(false)});
  window.addEventListener("resize",function(){if(window.innerWidth>620)setOpen(false)});
})();


// v13: 기기 내 실패 원인 요약. AI 분석이 아니며 서버로 전송하지 않습니다.
function failureEntries(){return tasks.filter(t=>t.incomplete&&!t.done).map(t=>{const h=(t.history||[]).filter(h=>h.status==="실패"||h.status==="미완료"||h.status==="자동 실패 사유").slice(-1)[0];return {task:t.name,date:(t.failedAt||h?.at||"").slice(0,10),reason:h?.reason||"",item:t}}).filter(x=>x.reason.trim())}
function failureCategory(reason){const s=reason.toLowerCase();if(/시간|바빠|알바|일정|스케줄|약속|근무/.test(s))return "시간 부족";if(/피곤|피로|졸|잠|컨디션|아파|몸/.test(s))return "피로·컨디션";if(/어려|이해|공부량|분량|많아|과다|양/.test(s))return "학습량·난이도 문제";if(/놀|미루|귀찮|집중|의욕|동기/.test(s))return "집중력·동기 저하";return "기타 (직접 확인 필요)"}
function failureSummaryRender(){const target=$("failureSummary");if(!target)return;const entries=failureEntries();if(!entries.length){target.textContent="아직 기록된 실패 사유가 없습니다.";return}const counts={};entries.forEach(e=>{const k=failureCategory(e.reason);counts[k]=(counts[k]||0)+1});target.innerHTML=`<p>기록된 실패 사유 ${entries.length}건</p><ul>${Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<li>${escapeHTML(k)}: ${n}건 (${Math.round(n/entries.length*100)}%)</li>`).join("")}</ul><p class="muted">단어 기반 임시 분류이므로 실제 원인과 다를 수 있습니다.</p>`}
function csvDownload(rows,name){const csv="\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
// v16: 월별 동일 집계 데이터로 화면과 CSV 생성
let selectedReportMonth=new Date().getMonth()+1;
const reportYear=new Date().getFullYear();
function monthlyData(){
 const from=toISO(new Date(reportYear,selectedReportMonth-1,1));
 const to=toISO(new Date(reportYear,selectedReportMonth,0));
 const subset=tasks.filter(t=>{const d=taskEnd(t)||"";return d>=from&&d<=to});
 const done=subset.filter(t=>t.done).length, failed=subset.filter(t=>t.incomplete&&!t.done).length;
 const postponed=subset.reduce((n,t)=>n+(Number(t.postponed)||0),0);
 const totalSeconds=subset.reduce((n,t)=>n+(isTracked(t)?measured(t.id):0),0);
 const reasons=subset.filter(t=>t.incomplete&&!t.done).map(t=>{const h=(t.history||[]).filter(x=>x.status==="실패"||x.status==="미완료"||x.status==="자동 실패 사유").slice(-1)[0];return {name:t.name,reason:h?.reason||"",category:failureCategory(h?.reason||"")}});
 const categories={};reasons.forEach(r=>{categories[r.category]=(categories[r.category]||0)+1});
 return {from,to,subset,done,failed,postponed,totalSeconds,reasons,categories,rate:subset.length?Math.round(done/subset.length*100):0};
}
function latestReason(t){if(!t.incomplete||t.done)return "";return (t.history||[]).filter(h=>h.status==="실패"||h.status==="미완료"||h.status==="자동 실패 사유").slice(-1)[0]?.reason||""}
function actualText(t){const seconds=isTracked(t)?measured(t.id):0;return seconds>0?human(seconds):""}
function monthlyRows(d){const rows=[["일정 이름","종류","과목","시작일","마감일","예상 시간","실제 측정시간","중요도","상태","미루기 횟수","실패 사유","월간 달성률"]];
 d.subset.forEach(t=>rows.push([t.name,t.type||"학습",t.subject||"",taskStart(t),taskEnd(t),isTracked(t)?(t.duration||""):"",actualText(t),t.priority||"",t.done?"완료":t.incomplete?"실패":"진행 중",Number(t.postponed)||0,latestReason(t),d.rate+"%"]));
 rows.push([],["월간 요약","전체 일정",d.subset.length,"완료",d.done,"실패",d.failed,"미루기 총횟수",d.postponed,"달성률",d.rate+"%"]);
 rows.push(["실제 총 학습시간",d.totalSeconds?human(d.totalSeconds):"0분"]);
 Object.entries(d.categories).forEach(([cat,count])=>rows.push(["실패 원인",cat,count+"건"]));
 rows.push(["분석 안내","기기 내 키워드 분류 (AI 아님)"]);
 if(window.focusmateMonthlyAI && d.from.slice(0,7)===window.focusmateMonthlyAIPeriod)rows.push(["Gemini 월간 피드백",window.focusmateMonthlyAI]);
 return rows;
}
function exportSelectedMonth(){const d=monthlyData();csvDownload(monthlyRows(d),`FocusMate_${d.from.slice(0,7)}_월간보고서.csv`);showToast("CSV를 내보냈어요. 기존 기록은 삭제하지 않았습니다.")}
function renderMonthButtons(){const host=$("monthlyMonths");host.innerHTML=Array.from({length:12},(_,i)=>`<button type="button" class="month-choice ${selectedReportMonth===i+1?"selected":""}" data-report-month="${i+1}" aria-pressed="${selectedReportMonth===i+1}">${i+1}월</button>`).join("");host.querySelectorAll("[data-report-month]").forEach(btn=>btn.addEventListener("click",()=>{selectedReportMonth=Number(btn.dataset.reportMonth);renderMonthButtons()}))}
function showMonthlyModal(){renderMonthButtons();$("monthlySelect").classList.remove("hidden");$("monthlyView").classList.add("hidden");$("monthlyModal").classList.remove("hidden")}
function closeMonthlyModal(){$("monthlyModal").classList.add("hidden")}
$("openMonthly").addEventListener("click",showMonthlyModal);
$("closeMonthly").addEventListener("click",closeMonthlyModal);
$("monthlyModal").addEventListener("click",e=>{if(e.target===$("monthlyModal"))closeMonthlyModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("monthlyModal").classList.contains("hidden"))closeMonthlyModal()});
$("exportMonthly").addEventListener("click",exportSelectedMonth);
$("exportMonthlyView").addEventListener("click",exportSelectedMonth);
$("backMonthly").addEventListener("click",()=>{$("monthlyView").classList.add("hidden");$("monthlySelect").classList.remove("hidden")});
$("viewMonthly").addEventListener("click",()=>{const d=monthlyData();const cat=Object.entries(d.categories).sort((a,b)=>b[1]-a[1]);
 $("monthlyReportContent").innerHTML=`<h3>${reportYear}년 ${selectedReportMonth}월 학습 보고서</h3><p class="muted">${d.to>=localToday()?"진행 중인 달 · 중간 집계":"마감된 달 · 저장된 기록 기준"} · 마감일 기준</p><div class="monthly-stat-grid"><div><small>달성률</small><strong>${d.rate}%</strong></div><div><small>완료</small><strong>${d.done}건</strong></div><div><small>실패</small><strong>${d.failed}건</strong></div><div><small>실제 학습시간</small><strong>${d.totalSeconds?escapeHTML(human(d.totalSeconds)):"0분"}</strong></div></div><p>전체 ${d.subset.length}건 · 미루기 ${d.postponed}회</p><h4>실패 원인 (키워드 분류)</h4>${cat.length?`<ul>${cat.map(([k,n])=>`<li>${escapeHTML(k)}: ${n}건 (${Math.round(n/d.failed*100)}%)</li>`).join("")}</ul>`:'<p class="muted">기록된 실패가 없습니다.</p>'}<h4>일정별 기록</h4>${d.subset.length?d.subset.map(t=>`<div class="monthly-task"><b>${escapeHTML(t.name)}</b><span>${t.done?"완료":t.incomplete?"실패":"진행 중"} · 실제 ${escapeHTML(actualText(t)||"측정 없음")} · 미루기 ${Number(t.postponed)||0}회</span>${latestReason(t)?`<p>실패 사유: ${escapeHTML(latestReason(t))}</p>`:""}</div>`).join(""):'<p class="muted">해당 월에 마감되는 일정이 없습니다.</p>'}<p class="muted">현재 분석은 AI가 아닌 기기 내 키워드 집계입니다.</p>`;
 if(window.focusmateMonthlyAI && d.from.slice(0,7)===window.focusmateMonthlyAIPeriod){const ai=document.createElement("div");ai.className="ai-box ai-feedback";ai.textContent="Gemini 월간 피드백\n"+window.focusmateMonthlyAI;$("monthlyReportContent").appendChild(ai)}
 $("monthlySelect").classList.add("hidden");$("monthlyView").classList.remove("hidden");});
// 날짜가 바뀌거나 계정 기록이 불러와졌을 때 마감일 초과 상태를 반영합니다.
let lastCheckedDay=localToday();
function checkDayChange(){
 const today=localToday();
 if(today===lastCheckedDay)return;
 lastCheckedDay=today;
 if(planViewDate&&planViewDate===shiftDay(today,-1)){planViewDate=today;$("planViewDate").value=today;}
 $("todayLabel").textContent=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date());
 updateDashboard();
 if($("calendar").classList.contains("active"))renderCalendar();
}
setInterval(checkDayChange,15000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkDayChange()});
window.addEventListener("focus",checkDayChange);
window.addEventListener("focusmate-cloud-ready",()=>{
 // 계정 데이터 로딩 이후에도 만료 상태를 저장 및 갱신
 updateDashboard();
 if($("calendar").classList.contains("active"))renderCalendar();
});
