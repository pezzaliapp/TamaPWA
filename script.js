
const $=s=>document.querySelector(s);
const logEl=document.getElementById('log'), toastWrap=document.getElementById('toasts');
function log(msg){ const t=new Date(); const hh=String(t.getHours()).padStart(2,'0'), mm=String(t.getMinutes()).padStart(2,'0'); const p=document.createElement('span'); p.className='entry'; p.textContent=`[${hh}:${mm}] ${msg}`; logEl.prepend(p); while(logEl.children.length>6) logEl.lastChild.remove(); }
function toast(msg){ const el=document.createElement('div'); el.className='toast'; el.textContent=msg; toastWrap.appendChild(el); setTimeout(()=>el.classList.add('hide'),1400); setTimeout(()=>el.remove(),1800); log(msg); }
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
let ctx; function getAC(){ if(!ctx) ctx=new (window.AudioContext||window.webkitAudioContext)(); return ctx; }
function beep(f=440,d=120,t='square',v=.25){ try{ const c=getAC(); const o=c.createOscillator(), g=c.createGain(); o.type=t; o.frequency.setValueAtTime(f,c.currentTime); g.gain.setValueAtTime(v,c.currentTime); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+d/1000);}catch{} }
['pointerdown','touchstart','click','keydown'].forEach(ev=>window.addEventListener(ev,async()=>{ try{ const c=getAC(); if(c.state==='suspended') await c.resume(); }catch{} },{once:true,passive:true}));
function good(){ beep(784,90); setTimeout(()=>beep(988,90),95); }
function bad(){ beep(220,140); setTimeout(()=>beep(180,180),120); }
function tick(){ beep(520,70,'square',.18); }
function fanfare(){ beep(659,120); setTimeout(()=>beep(880,140),140); setTimeout(()=>beep(1175,160),320); }

// State
const S=JSON.parse(localStorage.getItem('tama')||'{}');
if(!S.init){ Object.assign(S,{init:true,h:40,ha:50,e:60,c:60,he:80,age:0,stage:'Uovo',last:Date.now(),soundOn:true,sleep:false,scores:{catch:0,reflex:null,sequence:0}}); save(); }
function save(){ localStorage.setItem('tama', JSON.stringify(S)); }

// UI refs
const face=$('#face'), moodEl=$('#mood'), ageEl=$('#age'), stageEl=$('#stage');
const bH=$('#bH'), bHa=$('#bHa'), bE=$('#bE'), bC=$('#bC'), bHe=$('#bHe');
const chipH=$('#chipH'), chipHa=$('#chipHa'), chipE=$('#chipE'), chipC=$('#chipC');
const feedBtn=$('#feed'), cleanBtn=$('#clean'), sleepBtn=$('#sleep'), soundBtn=$('#sound'), installBtn=$('#install'), playBtn=$('#play'), resetBtn=$('#reset');

function showChip(el,emoji,txt){ if(!el) return; el.textContent=`${emoji} ${txt}`; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }
function updateMood(){ let m='Neutro', f='😐'; if(S.sleep){m='Dorme'; f='😴';} else if(S.ha>=70 && S.e>=40){m='Felice'; f='🙂';} else if(S.ha<30 || S.e<25 || S.h<20){m='Triste'; f='😢';} face.textContent=f; moodEl.textContent=m; }
function render(){ bH.style.width=S.h+'%'; bHa.style.width=S.ha+'%'; bE.style.width=S.e+'%'; bC.style.width=S.c+'%'; bHe.style.width=S.he+'%'; ageEl.textContent=Math.floor(S.age)+'g'; stageEl.textContent=S.stage; sleepBtn.textContent=S.sleep?'☀️ Sveglia':'😴 Dormi'; updateMood(); }

// Rewards
function grantRewards(d,label){ if(d.ha) {S.ha=clamp(S.ha+d.ha,0,100); showChip(chipHa,'🙂',(d.ha>0?'+':'')+d.ha);} if(d.e){S.e=clamp(S.e+d.e,0,100); showChip(chipE,'⚡',(d.e>0?'+':'')+d.e);} if(d.h){S.h=clamp(S.h+d.h,0,100); showChip(chipH,'🍎',(d.h>0?'+':'')+d.h);} if(d.c){S.c=clamp(S.c+d.c,0,100); showChip(chipC,'🧼',(d.c>0?'+':'')+d.c);} save(); render(); if(label) toast(label); }

// Actions
feedBtn.onclick=()=>{ if(S.sleep) S.sleep=false; grantRewards({h:+28,c:-4},'🍎 Fame +28 / Pulizia -4'); good(); };
cleanBtn.onclick=()=>{ if(S.sleep) S.sleep=false; grantRewards({c:+30},'🧼 Pulizia +30'); good(); };
sleepBtn.onclick=()=>{ S.sleep=!S.sleep; save(); render(); toast(S.sleep?'😴 Dorme':'☀️ Sveglia'); };
soundBtn.onclick=()=>{ S.soundOn=!S.soundOn; soundBtn.textContent=S.soundOn?'🔊 Suoni: ON':'🔈 Suoni: OFF'; if(S.soundOn) good(); save(); };
installBtn.onclick=async()=>{ try{ await navigator.serviceWorker.register('service-worker.js'); toast('PWA installata/aggiornata'); }catch{ toast('Impossibile installare SW'); } };
resetBtn.onclick=async()=>{ try{ if('serviceWorker' in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); for(const r of regs){ await r.unregister(); } } if('caches' in window){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } localStorage.removeItem('tama'); location.reload(true);}catch{} };

// Decay & age
setInterval(()=>{ const now=Date.now(); const dt=(now-S.last)/1000; if(dt<=0){S.last=now;return;} let dh=dt/3600; if(document.hidden) dh*=0.25; if(!S.sleep){ S.h=Math.max(0,S.h-2*dh); S.ha=Math.max(0,S.ha-1.5*dh); S.e=Math.max(0,S.e-2*dh); S.c=Math.max(0,S.c-1*dh);} else { S.e=Math.min(100,S.e+5*dh);} S.age+=dh/24; S.last=now; save(); render(); },1000);

// Games entry
playBtn.onclick=()=>{ const games=['catch','reflex','sequence']; const g=games[Math.random()*games.length|0]; (g==='catch')?$('#gCatch').showModal():(g==='reflex')?$('#gReflex').showModal():$('#gSequence').showModal(); };

// ===== Catch =====
const dlgCatch=$('#gCatch'), startCatch=$('#startCatch'), catchArea=$('#catchArea'), target=$('#target'), cPtsEl=$('#cPts'), cTimeEl=$('#cTime');
let cPts=0, cTime=15, vx=2.4, vy=1.9, playing=false;
startCatch.onclick=()=>{ cPts=0;cTime=15;vx=2.4;vy=1.9;cPtsEl.textContent='0';cTimeEl.textContent='15';target.style.left='10px';target.style.top='10px';playing=true; moveLoop(); timeLoop(); };
target.addEventListener('pointerdown',e=>{ if(!playing) return; e.preventDefault(); cPts++; cPtsEl.textContent=String(cPts); beep(700,80); vx+=(vx>0?.22:-.22); vy+=(vy>0?.20:-.20); target.textContent=(cPts%5==0)?'+2':'+'; },{passive:false});
function moveLoop(){ if(!playing) return; const maxX=catchArea.clientWidth-target.offsetWidth; const maxY=catchArea.clientHeight-target.offsetHeight; let nx=target.offsetLeft+vx, ny=target.offsetTop+vy; if(nx<0||nx>maxX){ vx*=-1; nx=Math.max(0,Math.min(maxX,nx)); } if(ny<0||ny>maxY){ vy*=-1; ny=Math.max(0,Math.min(maxY,ny)); } target.style.left=nx+'px'; target.style.top=ny+'px'; requestAnimationFrame(moveLoop); }
function timeLoop(){ if(!playing) return; cTime--; cTimeEl.textContent=String(cTime); if(cTime<=0){ playing=false; endCatch(); } else { setTimeout(timeLoop,1000); } }
function endCatch(){ const gain=Math.min(12,2+Math.floor(cPts/3)); const cost=4; const food=Math.min(6,Math.floor(cPts/4)); grantRewards({ha:+gain,e:-cost,h:+food}, `🎯 Catch — Punti ${cPts}: +Fel ${gain} / -En ${cost}` + (food? ` / +Fame ${food}`:'')); fanfare(); dlgCatch.close(); }

// ===== Reflex =====
const dlgReflex=$('#gReflex'), startReflex=$('#startReflex'), reflexArea=$('#reflexArea'), rRoundEl=$('#rRound'), rTimeEl=$('#rTime'), rBestEl=$('#rBest');
let rRound=0, rBest=S.scores.reflex, rStart=0, rState='idle', rTimeout=null;
startReflex.onclick=()=>{ clearTimeout(rTimeout); rRound=0; rBest=S.scores.reflex; reflexArea.className='ready'; reflexArea.textContent='Pronto…'; rRoundEl.textContent='0'; rTimeEl.textContent='—'; rBestEl.textContent=(rBest==null?'—':rBest); nextReflex(); };
function nextReflex(){ rRound++; rRoundEl.textContent=String(rRound); if(rRound>5){ fanfare(); toast('⚡ Reflex: serie completata!'); dlgReflex.close(); return; } rState='waiting'; reflexArea.className='ready'; reflexArea.textContent='Attendi…'; const delay=600+Math.random()*1800; rTimeout=setTimeout(()=>{ rState='go'; reflexArea.className='go'; reflexArea.textContent='GO!'; tick(); rStart=performance.now(); },delay); }
reflexArea.addEventListener('pointerdown',ev=>{ ev.preventDefault(); if(rState==='waiting'){ reflexArea.className='ready'; reflexArea.textContent='Troppo presto!'; bad(); S.ha=Math.max(0,S.ha-1); save(); render(); clearTimeout(rTimeout); setTimeout(nextReflex,700); } else if(rState==='go'){ const t=Math.round(performance.now()-rStart); rState='scored'; rTimeEl.textContent=String(t); rBest=(rBest==null)?t:Math.min(rBest,t); S.scores.reflex=rBest; toast('⚡ '+t+' ms'); grantRewards({ha:+2,h:+1}, '⚡ Reflex: +Fel 2 / +Fame 1'); setTimeout(nextReflex,700);} },{passive:false});

// ===== Sequence (Simon strict) =====
const dlgSeq=$('#gSequence'), startSeq=$('#startSequence'), seqBoard=$('#seqBoard'), seqStatus=$('#seqStatus'), seqRoundEl=$('#seqRound');
const qs=[...seqBoard.querySelectorAll('.q')];
let seq=[], seqIdx=0, seqRound=0, seqState='idle', accepting=false, lastTap=0;
startSeq.onclick=()=>{ seq=[]; seqRound=0; seqIdx=0; seqStatus.textContent='Pronti…'; setTimeout(nextRound,500); };
function nextRound(){ seqRound++; seqRoundEl.textContent=String(seqRound); seqIdx=0; seq.push(1+(Math.random()*4|0)); playSeq(); }
function playSeq(){ seqState='playback'; accepting=false; seqStatus.textContent='Guarda…'; let i=0; const STEP=520,GAP=230; (function step(){ if(i>=seq.length){ seqState='input'; accepting=true; seqIdx=0; seqStatus.textContent='Tocca in ordine ('+seq.length+')'; return; } const v=seq[i], el=qs[v-1]; el.classList.add('active'); tick(); beep([440,520,660,780][v-1],110); setTimeout(()=>{ el.classList.remove('active'); i++; setTimeout(step,GAP); },STEP); })(); }
qs.forEach(btn=>btn.addEventListener('pointerup',ev=>{ ev.preventDefault(); const now=performance.now(); if(now-lastTap<120) return; lastTap=now; if(seqState!=='input'||!accepting) return; const val=+btn.dataset.q; btn.classList.add('active'); setTimeout(()=>btn.classList.remove('active'),160); beep([440,520,660,780][val-1],120); if(val===seq[seqIdx]){ seqIdx++; if(seqIdx<seq.length){ seqStatus.textContent='Avanti… ('+seqIdx+'/'+seq.length+')'; good(); } else { const food=Math.min(5, Math.floor(seq.length/2)); grantRewards({ha:+6,e:-3,h:+food}, '🟥🟩 Sequence round '+seqRound+' — +Fel 6 / -En 3 / +Fame '+food); fanfare(); nextRound(); } } else { bad(); seqStatus.textContent='Errore! Riparte il round'; accepting=false; setTimeout(playSeq,800); } },{passive:false}));

// Init
render();

// SW
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('service-worker.js').then(reg=>{
    if(reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    reg.addEventListener('updatefound', ()=>{
      const nw=reg.installing;
      nw && nw.addEventListener('statechange', ()=>{ if(nw.state==='installed' && navigator.serviceWorker.controller){ nw.postMessage('SKIP_WAITING'); } });
    });
    navigator.serviceWorker.addEventListener('controllerchange', ()=>location.reload());
  }).catch(console.warn);
}
