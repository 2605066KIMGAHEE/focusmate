(()=>{'use strict';
const root=document.documentElement;
const key='focusmate-theme';
let saved;try{saved=localStorage.getItem(key)}catch{}
let dark=saved==='dark'||(!saved&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);
const sunIcon='<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
const moonIcon='<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.3A8.7 8.7 0 0 1 9.7 3.5 8.8 8.8 0 1 0 20.5 14.3Z"/></svg>';
function apply(){root.dataset.theme=dark?'dark':'light';
 const a=document.getElementById('themeToggle'),b=document.getElementById('mobileThemeToggle');
 if(a){a.innerHTML=dark?sunIcon:moonIcon;a.setAttribute('aria-label',dark?'라이트모드 켜기':'다크모드 켜기');a.title=dark?'라이트모드':'다크모드';}
 if(b){b.querySelector('.mobile-theme-icon').innerHTML=dark?sunIcon:moonIcon;b.querySelector('.mobile-theme-label').textContent=dark?'라이트모드':'다크모드';b.setAttribute('aria-label',dark?'라이트모드 켜기':'다크모드 켜기');}}
function toggle(){dark=!dark;try{localStorage.setItem(key,dark?'dark':'light')}catch{}apply()}
function logout(){const btn=document.getElementById('logoutAccount');if(btn)btn.click();}
for(const id of ['themeToggle','mobileThemeToggle'])document.getElementById(id)?.addEventListener('click',toggle);
for(const id of ['headerLogout','mobileLogout'])document.getElementById(id)?.addEventListener('click',logout);
apply();
})();
