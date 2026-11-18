/* FocusMate V21: 로그인 계정별 저장. 익명 자동 로그인은 비활성화했습니다. */
(()=>{'use strict';
const URL='https://cxgdranvunowulsmjqdm.supabase.co';
const KEY='sb_publishable_8-xEXU2GhOQvY5a0xSmLMg_vc_rgFs0';
const status=document.getElementById('cloudStatus');
if(window.focusmateDemoMode){
 window.focusmateConnect=async()=>{};
 window.focusmateLogout=window.focusmateDemoLogout;
 if(status)status.textContent='로컬 체험 모드 · 클라우드 동기화 없음';
 return;
}
const setStatus=s=>{if(status)status.textContent=s;};
if(!window.supabase?.createClient){setStatus('Supabase를 불러오지 못했습니다.');return;}
const client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
window.focusmateSupabase=client;
let user=null,ready=false,dirty=false,saving=false,timer=null;
const originalSave=window.save,originalTiming=window.saveTiming;
const snapshot=()=>({tasks:JSON.parse(localStorage.getItem('focusmate_v2_tasks')||'[]'),sessions:JSON.parse(localStorage.getItem('focusmate_v7_sessions')||'[]'),active:null});
const queue=()=>{dirty=true;if(!ready)return;clearTimeout(timer);timer=setTimeout(flush,850);};
window.save=function(){originalSave();queue();};window.saveTiming=function(){originalTiming();queue();};
async function flush(){if(!ready||!user||saving||!dirty)return;saving=true;dirty=false;
 try{const {error}=await client.from('focusmate_profiles').upsert({user_id:user.id,payload:snapshot(),updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;setStatus('계정 연결됨 · 저장 완료');}
 catch(e){dirty=true;setStatus('클라우드 저장 실패 · 이 기기에 보관 중');console.warn('sync:',e.message);}
 finally{saving=false;if(dirty&&ready){clearTimeout(timer);timer=setTimeout(flush,3000);}}
}
function clearLocal(){tasks=[];sessions=[];active=null;localStorage.setItem('focusmate_v2_tasks','[]');localStorage.setItem('focusmate_v7_sessions','[]');localStorage.removeItem('focusmate_v7_active');updateDashboard();}
async function connect(session){
 if(ready&&user&&dirty){await flush();if(dirty)throw Error('저장되지 않은 기록이 있어 계정을 전환할 수 없습니다.');}
 clearTimeout(timer);ready=false;dirty=false;user=session?.user||null;
 if(!user){clearLocal();setStatus('로그인이 필요합니다.');return;}
 setStatus('계정 기록 불러오는 중…');
 const result=await client.from('focusmate_profiles').select('payload').eq('user_id',user.id).maybeSingle();
 if(result.error)throw result.error;
 // 이전 익명 계정의 로컬 기록은 자동 병합하지 않습니다. 계정 간 데이터 혼합 방지.
 const remote=result.data?.payload||{};
 tasks=Array.isArray(remote.tasks)?remote.tasks:[];
 sessions=Array.isArray(remote.sessions)?remote.sessions:[];active=null;
 localStorage.setItem('focusmate_v2_tasks',JSON.stringify(tasks));localStorage.setItem('focusmate_v7_sessions',JSON.stringify(sessions));localStorage.removeItem('focusmate_v7_active');
 updateDashboard();if(document.getElementById('calendar')?.classList.contains('active'))renderCalendar();
 ready=true;setStatus('계정 연결됨 · 동기화 준비 완료');window.dispatchEvent(new Event('focusmate-cloud-ready'));
}
window.focusmateConnect=connect;
window.focusmateLogout=async()=>{
 // Do not discard unsynced study data when a cloud write fails.
 if(saving){for(let i=0;i<40&&saving;i++)await new Promise(resolve=>setTimeout(resolve,100));if(saving)throw Error('클라우드 저장이 진행 중입니다. 잠시 후 다시 시도해 주세요.');}
 if(dirty)await flush();
 if(dirty)throw Error('아직 클라우드에 저장되지 않은 기록이 있습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
 const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
 clearTimeout(timer);ready=false;user=null;clearLocal();setStatus('로그아웃됨');
};
window.addEventListener('online',()=>{if(ready){dirty=true;flush();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty)flush();});
})();
