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
    variant:null, demo:false, sleepStart:null, scores:{sequenceBest:0, reflexBest:null, catchBest:0}
  });
  let S=load();

  // ===== WebAudio (8-bit beeps) =====
  // ===== Mobile Audio Unlock =====
  const audioStateEl = document.getElementById('audioState');
  async function ensureAudioUnlocked(){
    try{
      const c = getCtx();
      if (c.state === 'suspended') { await c.resume(); }
      // iOS unlock via silent buffer
      const buffer = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource(); src.buffer = buffer; src.connect(c.destination); src.start(0);
      if (audioStateEl) audioStateEl.textContent = 'Audio: ok';
    }catch(e){
      if (audioStateEl) audioStateEl.textContent = 'Audio: bloccato (tappa un pulsante)';
    }
  }
  ['pointerdown','touchstart','click','keydown'].forEach(ev=>{
    window.addEventListener(ev, ()=>{ ensureAudioUnlocked(); }, { once:true, passive:true });
  });

  let ctx=null; const getCtx=()=> ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)());
  function beep(freq=440, dur=120, type='square', vol=0.28){
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
  soundBtn.onclick=()=>{ S.soundOn=!S.soundOn; soundBtn.textContent=S.soundOn?'🔊 Suoni: ON':'🔈 Suoni: OFF'; save(); if(S.soundOn){ ensureAudioUnlocked(); beep(660,120); } };
  resetBtn.onclick=()=>{ if(confirm('Reset?')){ S=initial(); save(); render(true);} };

  // Actions
  feedBtn.onclick = ()=>{ if(S.sleep){ S.sleep=false; S.sleepStart=null; } S.h = clamp(S.h+28,0,100); S.c=clamp(S.c-4,0,100); S.metrics.feed++; beep(520); emote('🍎'); save(); render(); };
  sleepBtn.onclick=()=>{ if(!S.sleep){ S.sleep=true; S.sleepStart=Date.now(); emote('💤'); } else { S.sleep=false; S.sleepStart=null; emote('☀️'); } save(); render(); };
  cleanBtn.onclick= ()=>{ if(S.sleep){ S.sleep=false; S.sleepStart=null; } S.c=clamp(S.c+30,0,100); S.metrics.clean++; beep(760); emote('✨'); save(); render(); };

  // ===== Catch game =====
  const dlgCatch = $('#gCatch'), area=$('#area'), startCatch=$('#startCatch'), ptsEl=$('#pts'), tEl=$('#t');
  playBtn.onclick=()=>{ if(S.sleep){ S.sleep=false; S.sleepStart=null; save(); } openCatch(); };
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
    save(); render(); beep(620,140); setTimeout(()=>beep(740,140),160); if (!S.scores) S.scores = {sequenceBest:0, reflexBest:null, catchBest:0};
    if (pts > (S.scores.catchBest||0)) { S.scores.catchBest = pts; toast('🏆 Record Catch: '+pts); }
    
  }

  
  
  
  // ===== Sequence (Simon-like) — v13 =====
  const seqBtn=document.getElementById('sequence');
  const dlgSeq=document.getElementById('gSequence');
  const startSeq=document.getElementById('startSequence');
  const seqStatus=document.getElementById('seqStatus');
  const seqRoundEl=document.getElementById('seqRound');
  const seqBoard=document.getElementById('seqBoard');
  const seqSymbols=document.getElementById('seqSymbols');
  const seqDebug=document.getElementById('seqDebug');
  const seqDebugStrip=document.getElementById('seqDebugStrip');

  function seqLog(){
    if(!seqDebug || !seqDebugStrip) return;
    if(!seqDebug.checked){ seqDebugStrip.style.display='none'; return; }
    seqDebugStrip.style.display='block';
    seqDebugStrip.textContent = `state=${seqState} | round=${seqRound} | idx=${seqIdx}/${seq.length} | seq=[${seq.join(',')}]`;
  }

  if (seqBtn && dlgSeq){
    seqBtn.addEventListener('click', ()=>{ dlgSeq.showModal(); resetSeqUI(); updateSeqMode(); });
  }

  function updateSeqMode(){
    if(!seqBoard) return;
    if (seqSymbols && seqSymbols.checked){
      seqBoard.classList.add('symbols');
      const qs = seqBoard.querySelectorAll('.q');
      if (qs.length>=4){
        qs[0].querySelector('span').textContent='▲';
        qs[1].querySelector('span').textContent='◆';
        qs[2].querySelector('span').textContent='●';
        qs[3].querySelector('span').textContent='■';
      }
    } else {
      seqBoard.classList.remove('symbols');
      seqBoard.querySelectorAll('.q').forEach(q=> q.querySelector('span').textContent='■');
    }
  }
  if (seqSymbols){ seqSymbols.addEventListener('change', updateSeqMode); }

  let seqState='idle', seq=[], seqIdx=0, seqRound=0, seqTimer=null, seqInputOpen=false, seqLastTs=0;

  function resetSeqUI(){
    clearTimeout(seqTimer);
    seq=[]; seqIdx=0; seqRound=0; seqState='idle'; seqInputOpen=false;
    if (seqRoundEl) seqRoundEl.textContent='0';
    if (seqStatus) seqStatus.textContent='—';
    setQDisabled(true);
    if (startSeq) startSeq.disabled=false;
    seqLog();
  }

  if (startSeq){
    startSeq.addEventListener('click', ()=> startSeqGame());
  }

  function startSeqGame(){
    resetSeqUI();
    if (seqStatus) seqStatus.textContent='Guarda la sequenza';
    nextSeqRound(); // will show 1
  }

  function nextSeqRound(){
    seqRound++; if (seqRoundEl) seqRoundEl.textContent=String(seqRound);
    seqIdx=0; seq.push(1+Math.floor(Math.random()*4));
    playSeq();
  }

  function playSeq(){
    seqState='playback'; setQDisabled(true); seqInputOpen=false; seqLog();
    if (startSeq) startSeq.disabled=true;
    let i=0;
    const step = () => {
      if(i>=seq.length){
        seqState='input'; setQDisabled(false); seqIdx=0; seqLog();
        if (seqStatus) seqStatus.textContent='Tocca in ordine (1/'+seq.length+')';
        setTimeout(()=>{ seqInputOpen=true; }, 80);
        if (startSeq) startSeq.disabled=false;
        return;
      }
      const val=seq[i], el=seqBoard.querySelector(`.q[data-q="${val}"]`);
      if (el){ el.classList.add('active'); setTimeout(()=>el.classList.remove('active'), 220); }
      if (seqSymbols && seqSymbols.checked){
        beep([330,440,554,659][val-1], 160);
      } else {
        beep([440,520,660,780][val-1], 160);
      }
      i++; seqTimer=setTimeout(step, 520);
    }; step();
  }

  function setQDisabled(disabled){
    if(!seqBoard) return;
    seqBoard.querySelectorAll('.q').forEach(q=> q.classList.toggle('disabled', !!disabled));
  }

  function colorName(v){
    if (seqSymbols && seqSymbols.checked){
      return {1:'▲',2:'◆',3:'●',4:'■'}[v] || String(v);
    }
    return {1:'rosso',2:'verde',3:'blu',4:'giallo'}[v] || String(v);
  }

  // Delegation for robustness
  if (seqBoard){
    seqBoard.addEventListener('pointerup', (ev)=>{
      const now=performance.now(); if(now-seqLastTs<120) return; seqLastTs=now;
      const btn = ev.target.closest('.q'); if(!btn) return;
      ev.preventDefault();
      const val = Number(btn.dataset.q);
      handleQ(val);
    }, {passive:false});
  }

  function handleQ(val){
    if(seqState!=='input' || !seqInputOpen){ seqLog(); return; }
    const expected = seq[seqIdx];
    const el = seqBoard.querySelector(`.q[data-q="${val}"]`);
    if (el){ el.classList.add('active'); setTimeout(()=>el.classList.remove('active'), 180); }
    if (seqSymbols && seqSymbols.checked){
      beep([330,440,554,659][val-1], 140);
    } else {
      beep([440,520,660,780][val-1], 140);
    }
    if(val===expected){
      seqIdx++; seqLog();
      if(seqIdx<seq.length){
        if (seqStatus) seqStatus.textContent='Tocca in ordine ('+(seqIdx+1)+'/'+seq.length+')';
      } else {
        // SUCCESS: award for completing this round
        const gain = 6; const cost = 3; const food = Math.min(5, Math.floor(seq.length/2));
        S.ha = clamp(S.ha + gain, 0, 100);
        S.e  = clamp(S.e - cost, 0, 100);
        S.h  = clamp(S.h + food, 0, 100);
        // Best tracking
        if (!S.scores) S.scores = {sequenceBest:0, reflexBest:null, catchBest:0};
        if (seqRound > (S.scores.sequenceBest||0)) {
          S.scores.sequenceBest = seqRound;
          toast('🏆 Record Sequence: Round '+seqRound+'!');
        }
        save(); render();
        toast('🟥🟩 Sequence: +Fel '+gain+' / -En '+cost + (food? ' / +Fame '+food : ''));
        if (seqStatus) seqStatus.textContent='Bravo! Prossimo round...';
        seqState='idle'; seqInputOpen=false; setQDisabled(true);
        setTimeout(nextSeqRound, 650);
      }
    } else {
      // FAILURE: partial reward based on progress
      const prog = seqIdx; // correct taps this round
      const gain = Math.min(4, Math.floor(prog/2));
      const food = prog>=2 ? 1 : 0;
      if (gain>0) S.ha = clamp(S.ha + gain, 0, 100);
      if (food>0) S.h  = clamp(S.h  + food, 0, 100);
      save(); render();
      toast('❌ Sequence: atteso '+colorName(expected)+', hai premuto '+colorName(val)+' — +' + (gain>0? ('Fel '+gain) : '0') + (food? ' / +Fame '+food : ''));
      if (seqStatus) seqStatus.textContent='Errore! Round '+seqRound+' non completato.';
      seqState='idle'; seqInputOpen=false; setQDisabled(true);
      beep(200,200,'square',0.25); setTimeout(()=>beep(160,220,'square',0.25),240);
    }
  }

  // ===== Reflex Tap game (v13 hardened) =====
  const dlgReflex=document.getElementById('gReflex');
  const startReflex=document.getElementById('startReflex');
  const reflexArea=document.getElementById('reflexArea');
  const rRoundEl=document.getElementById('rRound');
  const rTimeEl=document.getElementById('rTime');
  const rBestEl=document.getElementById('rBest');
  const reflexBtn=document.getElementById('reflex');

  if (reflexBtn && dlgReflex){
    reflexBtn.addEventListener('click', ()=>{
      dlgReflex.showModal();
      // reset UI
      if (reflexArea){ reflexArea.className='ready'; reflexArea.textContent='Pronto…'; }
      if (rRoundEl){ rRoundEl.textContent='0'; }
      if (rTimeEl){ rTimeEl.textContent='—'; }
      const rb = (S.scores && S.scores.reflexBest!=null) ? S.scores.reflexBest : null;
      if (rBestEl){ rBestEl.textContent= (rb==null?'—':String(rb)); }
    });
  }

  let rRound=0, rBest=(S.scores && S.scores.reflexBest!=null)? S.scores.reflexBest : null, rStart=0, rState='idle', rTimeout=null;

  if (startReflex){
    startReflex.addEventListener('click', ()=> startReflexGame());
  }

  function startReflexGame(){
    clearTimeout(rTimeout);
    rRound=0; rStart=0; rState='waiting';
    if (rBestEl) rBestEl.textContent= (rBest==null?'—':String(rBest));
    nextReflexRound();
  }

  function nextReflexRound(){
    rRound++; if (rRoundEl) rRoundEl.textContent=String(rRound);
    if (rRound>5){ return endReflexSeries(); }
    rState='waiting';
    if (reflexArea){ reflexArea.className='ready'; reflexArea.textContent='Attendi…'; }
    const delay = 600 + Math.random()*1800;
    rTimeout = setTimeout(()=>{
      rState='go';
      if (reflexArea){ reflexArea.className='go'; reflexArea.textContent='GO! TAP!'; }
      rStart = performance.now(); beep(800,90);
    }, delay);
  }

  if (reflexArea){
    reflexArea.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      if (rState==='waiting'){
        // false start
        if (reflexArea){ reflexArea.className='early'; reflexArea.textContent='Troppo presto!'; }
        beep(200,160);
        const penalty = 1;
        S.ha = clamp(S.ha - penalty, 0, 100);
        save(); render();
        clearTimeout(rTimeout);
        setTimeout(nextReflexRound, 700);
      } else if (rState==='go'){
        const t = Math.round(performance.now() - rStart);
        rState='scored';
        if (rTimeEl) rTimeEl.textContent = String(t);
        rBest = (rBest==null)? t : Math.min(rBest, t);
        if (!S.scores) S.scores = {sequenceBest:0, reflexBest:null, catchBest:0};
        const improved = (S.scores.reflexBest==null) || (rBest < S.scores.reflexBest if S.scores.reflexBest!== null else True)
      }
    }, {passive:false});
  }

  function endReflexSeries(){
    rState='idle';
    if (reflexArea){ reflexArea.className='ready'; reflexArea.textContent = 'Serie finita! Best: ' + (rBest==null?'—':rBest+' ms'); }
    alert('Reflex finito! Best: ' + (rBest==null?'—':rBest+' ms'));
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
      // Sleeping: regen energy, slight decay others

      S.e = clamp(S.e + 12*dh, 0, 100);
      S.h = clamp(S.h - 2*dh, 0, 100);
      S.ha= clamp(S.ha- 1*dh, 0, 100);
      S.c = clamp(S.c - 1*dh, 0, 100);
      S.metrics.sleepMin += dh*60;
      const hoursPerDay = S.demo ? (1/60) : 24;
      const maxSleepHours = 6; // auto-wake after 6 in-game hours
      if (S.e>=95) { S.sleep=false; S.sleepStart=null; }
      else if (S.sleepStart){
        const sleptHours = ((Date.now()-S.sleepStart)/3600000) / (1/ hoursPerDay);
        if (sleptHours >= maxSleepHours){ S.sleep=false; S.sleepStart=null; }
      }
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
    // Update sleep button label
    try{ const sb=document.getElementById('sleep'); if(sb) sb.textContent = S.sleep ? '☀️ Sveglia' : '😴 Dormi'; }catch{}
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
  ensureAudioUnlocked();
})();