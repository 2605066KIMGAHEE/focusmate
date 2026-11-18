if(!window.focusmateDemoMode){
/* v20: AI 키는 브라우저에 저장하지 않습니다. */
(()=>{'use strict';
const daily=document.getElementById('aiDaily'),monthly=document.getElementById('aiMonthly');
let busy=false;
async function run(type){
 const target=type==='daily'?daily:monthly;
 const client=window.focusmateSupabase;
 if(!client){target.textContent='Supabase 연결이 필요합니다.';return;}
 if(busy)return;busy=true;target.textContent='분석 기록을 확인하고 있습니다…';
 try{
  const {data:{session}}=await client.auth.getSession();
  if(!session){target.textContent='익명 계정 연결 후 다시 시도해 주세요.';return;}
  const response=await fetch('https://cxgdranvunowulsmjqdm.supabase.co/functions/v1/gemini-analysis',{method:'POST',headers:{'apikey':'sb_publishable_8-xEXU2GhOQvY5a0xSmLMg_vc_rgFs0','content-type':'application/json','authorization':'Bearer '+session.access_token},body:JSON.stringify({type})});
  const result=await response.json();
  if(!response.ok)throw Error([result.error||'서버 오류',result.detail].filter(Boolean).join(' — '));
  target.textContent=result.status==='pending'?'AI 분석이 진행 중이에요. 잠시 후 다시 확인해 주세요.':result.status==='failed'?'분석에 실패했어요. 버튼을 눌러 다시 시도할 수 있어요.':result.status==='empty'?'해당 기간에 분석할 기록이 없습니다.':result.feedback||'결과가 없습니다.';
  if(result.status==='done'&&type==='monthly'){window.focusmateMonthlyAI=result.feedback;window.focusmateMonthlyAIPeriod=result.period;}
 }catch(e){target.textContent='AI 분석 실패: '+e.message+' (잠시 후 다시 시도해 주세요.)';}
 finally{busy=false;}
}
document.getElementById('aiDailyRefresh').addEventListener('click',()=>run('daily'));
document.getElementById('aiMonthlyRun').addEventListener('click',()=>run('monthly'));
// 크레딧과 API 호출을 아끼기 위해 자동 분석을 중단하고 수동 확인만 허용합니다.
window.addEventListener('focusmate-cloud-ready',()=>{if(daily)daily.textContent='전날 분석 확인 버튼을 누르면 저장된 결과를 조회하거나 분석합니다.';});
})();

}
