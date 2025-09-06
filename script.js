(() => {
  'use strict';

  // --- SW registration + Click-to-update banner ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(reg);
          }
        });
      });
      setInterval(() => reg.update(), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return; refreshing = true; window.location.reload();
    });
  }
  function showUpdateToast(reg) {
    let bar = document.getElementById('update-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'update-bar';
      bar.innerHTML = `
        <div class="update-bar">
          <span>Nuova versione disponibile</span>
          <button id="update-reload">Aggiorna</button>
        </div>`;
      document.body.appendChild(bar);
    }
    const btn = document.getElementById('update-reload');
    btn.onclick = () => {
      const waitingSW = reg.waiting;
      if (waitingSW) waitingSW.postMessage({ type: 'SKIP_WAITING' });
    };
  }

  // ===== State =====
  const stateKey='tama_pwa_sprites';
  const initial=()=>({createdAt:Date.now(),last:Date.now(),age:0,stage:'egg',
    h:80,ha:80,e:80,c:80,he:100,sleep:false, soundOn:true,
    metrics:{feed:0,play:0,clean:0,sleepMin:0,energySpent:0,hours:0,cleanSum:0,happySum:0},
    variant:null, demo:false
  });
  let S=load();

  // ===== WebAudio (8-bit beeps) =====
  let ctx=null; const getCtx=()=> ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)());
  function beep(freq=440, dur=120, type='square', vol=0.2){
    if(!S.soundOn) return; try{
      const c=getCtx(), o=c.createOscillator(), g=c.createGain();
      o.type=type; o.frequency.value=freq; g.gain.value=vol;
      o.connect(g); g.connect(c.destination); o.start();
      setTimeout(()=>o.stop(), dur);
    }catch{}
  }

  // ===== DOM =====
  const $ = s=>document.querySelector(s);
  const petImg = $('#petImg'), ageEl=$('#age'), stageEl=$('#stage'), moodEl=$('#mood'), variantEl=$('#variant');
  const bH=$('#bH'), bHa=$('#bHa'), bE=$('#bE'), bC=$('#bC'), bHe=$('#bHe');
  const demoBtn=$('#demo'), feedBtn=$('#feed'), playBtn=$('#play'), simonBtn=$('#simon'), sleepBtn=$('#sleep'), cleanBtn=$('#clean'), soundBtn=$('#sound'), resetBtn=$('#reset');

  demoBtn.onclick=()=>{ S.demo=!S.demo; demoBtn.textContent= S.demo?'⏱️ Demo: ON':'⏱️ Demo: OFF'; save(); };
  soundBtn.onclick=()=>{ S.soundOn=!S.soundOn; soundBtn.textContent=S.soundOn?'🔊 Suoni: ON':'🔈 Suoni: OFF'; save(); };
  resetBtn.onclick=()=>{ if(confirm('Reset?')){ S=initial(); save(); render(true);} };

  // Actions
  feedBtn.onclick = ()=>{ S.h = clamp(S.h+28,0,100); S.c=clamp(S.c-4,0,100); S.metrics.feed++; beep(520); emote('🍎'); save(); render(); };
  sleepBtn.onclick= ()=>{ S.sleep=true; beep(220); emote('💤'); save(); render(); };
  cleanBtn.onclick= ()=>{ S.c=clamp(S.c+30,0,100); S.metrics.clean++; beep(760); emote('✨'); save(); render(); };

  // ===== Catch game =====
  const dlgCatch = $('#gCatch'), area=$('#area'), startCatch=$('#startCatch'), ptsEl=$('#pts'), tEl=$('#t');
  playBtn.onclick=()=>{ openCatch(); };
  let timer=null, mover=null, pts=0, time=15;
  function openCatch(){ pts=0; time=15; ptsEl.textContent=pts; tEl.textContent=time; area.innerHTML=''; dlgCatch.showModal(); }
  startCatch.onclick=()=> startGame();
  function startGame(){
    clearInterval(timer); clearInterval(mover); area.innerHTML='';
    pts=0; time=15; ptsEl.textContent=pts; tEl.textContent=time;
    const t=document.createElement('div'); t.className='t'; t.textContent='★'; t.style.left='0px'; t.style.top='0px';
    const hit=()=>{ pts++; ptsEl.textContent=String(pts); beep(880,90); move(true); };
    t.addEventListener('pointerdown', ev=>{ ev.preventDefault(); ev.stopPropagation(); hit(); });
    t.addEventListener('click', ev=>{ ev.preventDefault(); ev.stopPropagation(); hit(); });
    area.appendChild(t); move(true);
    mover=setInterval(()=>move(false), 600);
    timer=setInterval(()=>{ time--; tEl.textContent=time; if(time<=0){ endGame(); } }, 1000);
  }
  function move(first){
    const t = area.querySelector('.t'); if(!t) return;
    const gw = area.clientWidth, gh = area.clientHeight, tw=t.offsetWidth, th=t.offsetHeight;
    const x = Math.random()*(gw-tw), y = Math.random()*(gh-th);
    t.style.left = x+'px'; t.style.top = y+'px'; if(first&&t.focus) t.focus();
  }
  function endGame(){
    clearInterval(timer); clearInterval(mover);
    const gain = Math.min(5 + pts*2, 40);
    const cost = Math.max(2, Math.floor(pts/2));
    S.ha = clamp(S.ha + gain, 0, 100);
    S.e  = clamp(S.e - cost, 0, 100);
    S.metrics.play++; S.metrics.energySpent += cost;
    save(); render(); beep(620,140); setTimeout(()=>beep(740,140),160); alert('Fine! Punteggio: '+pts+' — Felicità +'+gain+', Energia -'+cost);
  }

  // ===== Simon game =====
  const dlgSimon=$('#gSimon'), startSimon=$('#startSimon'), statusEl=$('#status'), roundEl=$('#round');
  const pads=Array.from(document.querySelectorAll('.pad'));
  function setPadsDisabled(disabled){
    pads.forEach(p=>{ p.classList.toggle('disabled', !!disabled); });
  }

  simonBtn.onclick=()=>{ dlgSimon.showModal(); };
  let sequence=[], userIdx=0, playing=false, round=0;
  startSimon.onclick=()=> startSimonGame();
  function startSimonGame(){ setPadsDisabled(true);
    sequence=[]; round=0; statusEl.textContent='Guarda la sequenza'; nextRound();
  }
  function nextRound(){ setPadsDisabled(true);
    round++; roundEl.textContent=String(round); userIdx=0; sequence.push(1+Math.floor(Math.random()*4));
    playSequence(0);
  }
  function playSequence(i){ setPadsDisabled(true); statusEl.textContent='Guarda la sequenza';
    playing=true; if(i>=sequence.length){ playing=false; setPadsDisabled(false); userIdx=0; statusEl.textContent='Tocca i pad in ordine (1/'+sequence.length+')'; return; }
    const padVal=sequence[i]; const el=pads[padVal-1];
    flashPad(el); beep([440,520,660,780][padVal-1], 180);
    setTimeout(()=>playSequence(i+1), 520);
  }
  function flashPad(el){ el.classList.add('active'); setTimeout(()=>el.classList.remove('active'), 220); }
  pads.forEach(el=>{
    el.addEventListener('pointerdown', ev=>{ ev.preventDefault(); padPress(Number(el.dataset.pad)); });
    el.addEventListener('click', ev=>{ ev.preventDefault(); padPress(Number(el.dataset.pad)); });
  });
  function padPress(val){
    if(playing) return;
    const expected = sequence[userIdx];
    flashPad(pads[val-1]); beep([440,520,660,780][val-1], 120);
    if(val===expected){
      userIdx++;
      if(userIdx<sequence.length){ statusEl.textContent='Tocca i pad in ordine ('+ (userIdx+1) +'/'+sequence.length+')'; }
      if(userIdx===sequence.length){
        S.ha = clamp(S.ha + 6, 0, 100);
        S.e  = clamp(S.e - 3, 0, 100);
        save(); render();
        statusEl.textContent='Bravo! Prossimo round...';
        setTimeout(nextRound, 600);
      }
    }else{
      statusEl.textContent='Errore! Fine partita.';
      beep(200,200,'square',0.25); setTimeout(()=>beep(160,220,'square',0.25),240);
    }
  }

  // ===== Loop / decay / variant logic =====
  const DECAY = {h:6, ha:4, e:5, c:3};
  const HEALTH_REGEN=2, HEALTH_DECAY=6;
  setInterval(tick, 500);
  function tick(){
    const now=Date.now(), dt=(now-S.last)/1000; if(dt<=0){S.last=now;return;}
    const dh = dt/3600;
    if(!S.sleep){
      S.h = clamp(S.h - DECAY.h*dh, 0, 100);
      S.ha= clamp(S.ha- DECAY.ha*dh,0,100);
      S.e = clamp(S.e - DECAY.e*dh, 0, 100);
      S.c = clamp(S.c - DECAY.c*dh, 0, 100);
    }else{
      S.e = clamp(S.e + 12*dh, 0, 100);
      S.h = clamp(S.h - 2*dh, 0, 100);
      S.ha= clamp(S.ha- 1*dh, 0, 100);
      S.c = clamp(S.c - 1*dh, 0, 100);
      S.metrics.sleepMin += dh*60;
      if(S.e>=95) S.sleep=false;
    }
    S.metrics.hours += dh;
    S.metrics.cleanSum += S.c*dh;
    S.metrics.happySum += S.ha*dh;

    const low=(S.h<35)||(S.ha<35)||(S.e<35)||(S.c<35);
    const good=(S.h>60)&&(S.ha>60)&&(S.e>60)&&(S.c>60);
    if(good) S.he = clamp(S.he + HEALTH_REGEN*dh, 0, 100);
    else if(low) S.he = clamp(S.he - HEALTH_DECAY*dh, 0, 100);

    const hoursPerDay = S.demo ? (1/60) : 24;
    const days = Math.floor(((now - S.createdAt)/3600000) / hoursPerDay);
    if(days!==S.age){ S.age=days; updateStageAndVariant(); }

    save(); render();
  }

  function updateStageAndVariant(){
    if (S.age<1) S.stage='egg';
    else if (S.age<3) S.stage='baby';
    else if (S.age<7){ // teen
      if (S.stage!=='teen'){ S.stage='teen'; if(!S.variant) S.variant = chooseVariant(false); }
    } else { // adult
      if (S.stage!=='adult'){ S.stage='adult'; S.variant = chooseVariant(true); }
    }
  }

  function chooseVariant(consolidate){
    const hours = Math.max(0.0001, S.metrics.hours);
    const avgClean = S.metrics.cleanSum / hours;
    const avgHappy = S.metrics.happySum / hours;
    const score = {
      sportivo:  S.metrics.play*2 + S.metrics.energySpent*0.8 + (avgHappy>70?2:0),
      goloso:    S.metrics.feed*2 + Math.max(0,70-avgClean)*0.3,
      pulito:    S.metrics.clean*2 + avgClean*0.4,
      sognatore: (S.metrics.sleepMin/30),
      equilibrato: (avgHappy>65?8:0) + (Math.abs(avgClean-60)<10?4:0)
    };
    if(consolidate && S.variant && score[S.variant]!=null) score[S.variant]+=3;
    let best='equilibrato', bestVal=-Infinity; for(const k in score){ if(score[k]>bestVal){bestVal=score[k];best=k;} }
    return best;
  }

  // ===== Render =====
  const SPRITE = (variant, mood) => `sprite-${variant}-${mood}.png`;
  function render(first=false){
    bH.style.width=S.h+'%'; bHa.style.width=S.ha+'%'; bE.style.width=S.e+'%'; bC.style.width=S.c+'%'; bHe.style.width=S.he+'%';
    ageEl.textContent=S.age; stageEl.textContent=({egg:'Uovo',baby:'Baby',teen:'Teen',adult:'Adult'})[S.stage];
    const mood = getMood(); moodEl.textContent=mood.label;
    const v = S.variant || 'equilibrato';
    variantEl.textContent = S.variant ? cap(S.variant) : '—';
    const moodKey = S.sleep ? 'sleep' : mood.code;
    petImg.src = SPRITE(v, moodKey);
    petImg.alt = `Sprite ${cap(v)} — ${moodKey}`;
  }
  function getMood(){
    if (S.he < 25) return {code:'sick', label:'Malaticcio'};
    const avg=(S.h+S.ha+S.e+S.c)/4;
    if (avg>=75) return {code:'happy', label:'Felice'};
    if (avg>=45) return {code:'ok', label:'Curioso'};
    return {code:'sad', label:'Triste'};
  }
  function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

  // ===== Utils =====
  function emote(symbol){
    const pet = document.getElementById('pet');
    const b = document.createElement('div');
    b.textContent = symbol;
    b.style.position='absolute'; b.style.top='6px'; b.style.right='8px';
    b.style.fontSize='28px'; b.style.filter='drop-shadow(0 2px 2px rgba(0,0,0,.6))';
    b.style.transition='transform .7s ease, opacity .7s ease'; b.style.opacity='1';
    pet.appendChild(b);
    requestAnimationFrame(()=>{ b.style.transform='translateY(-14px)'; b.style.opacity='0'; });
    setTimeout(()=> b.remove(), 800);
  }
  function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }
  function save(){ localStorage.setItem(stateKey, JSON.stringify(S)); }
  function load(){ try{ const r=localStorage.getItem(stateKey); return r?Object.assign(initial(), JSON.parse(r)):initial(); }catch{ return initial(); } }

  // first paint
  render(true);
})();