(() => {
  'use strict';

  // --- Stato e costanti ---
  const stateKey = 'tamaPWA_state_v2';

  const initial = () => ({
    createdAt: Date.now(),
    lastTick: Date.now(),
    ageDays: 0,
    hunger: 80,
    happiness: 80,
    energy: 80,
    cleanliness: 80,
    health: 100,
    stage: 'egg',
    sleeping: false,
    // Notifiche
    notifMinutes: 360,    // ogni 6 ore
    notifEnabled: false,
  });

  let S = loadState();

  const DECAY_PER_HOUR = { hunger: 6, happiness: 4, energy: 5, cleanliness: 3 };
  const HEALTH_REGEN = 2;
  const HEALTH_DECAY = 6;
  const TICK_MS = 1000;
  const AGING_HOURS_PER_DAY = 24;
  const NEEDS_THRESHOLD = 45; // sotto questa media notifichiamo

  // --- DOM ---
  const $ = (s)=>document.querySelector(s);
  const bars = {
    hunger: $('#barHunger'), happiness: $('#barHappy'),
    energy: $('#barEnergy'), cleanliness: $('#barClean'), health: $('#barHealth')
  };
  const moodText   = $('#moodText');
  const ageText    = $('#ageText');
  const stageBadge = $('#stageBadge');
  const lastSeen   = $('#lastSeenText');
  const installBtn = $('#installBtn');

  // Dialogs & buttons
  const infoBtn    = $('#infoBtn');
  const howtoDlg   = $('#howto');
  const resetBtn   = $('#resetBtn');
  const notifBtn   = $('#notifBtn');
  const notifDlg   = $('#notifDialog');
  const notifFreq  = $('#notifFreq');
  const notifSave  = $('#notifSave');
  const notifDisable = $('#notifDisable');

  // Backup/Restore
  const backupBtn  = $('#backupBtn');
  const restoreBtn = $('#restoreBtn');
  const restoreFile= $('#restoreFile');

  // Game
  const gameDlg = $('#gameDialog');
  const startGameBtn = $('#startGameBtn');
  const gameArea = $('#gameArea');
  const scoreEl  = $('#score');
  const timeEl   = $('#time');

  // Azioni
  document.querySelectorAll('#actions [data-act]').forEach(btn=>{
    btn.addEventListener('click', ()=> doAction(btn.dataset.act));
  });

  infoBtn.addEventListener('click', ()=> howtoDlg.showModal());
  resetBtn.addEventListener('click', ()=> {
    if (confirm('Resetta il tuo pet? Operazione irreversibile.')) {
      S = initial(); persist(); render(true);
    }
  });

  // Install prompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installBtn.hidden = false; });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true;
  });

  // Notifiche - dialog
  notifBtn.addEventListener('click', ()=>{
    notifFreq.value = String(S.notifMinutes || 360);
    notifDlg.showModal();
  });
  notifSave.addEventListener('click', async ()=>{
    S.notifMinutes = parseInt(notifFreq.value,10) || 360;
    const ok = await ensureNotifPermission();
    S.notifEnabled = ok;
    persist();
    notifDlg.close();
    if (ok) { scheduleLocalCheck(); alert('Promemoria attivati.'); }
    else alert('Permesso notifiche negato.');
  });
  notifDisable.addEventListener('click', ()=>{
    S.notifEnabled = false; persist(); notifDlg.close(); alert('Promemoria disattivati.');
  });

  // Backup
  backupBtn.addEventListener('click', ()=>{
    const data = JSON.stringify(S, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `TamaPWA-backup-${new Date().toISOString().slice(0,19)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  // Restore
  restoreBtn.addEventListener('click', ()=> restoreFile.click());
  restoreFile.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if (!file) return;
    try{
      const text = await file.text();
      const obj = JSON.parse(text);
      // sanifica minimale
      S = Object.assign(initial(), obj);
      persist(); render(true);
      alert('Ripristino completato!');
    }catch(err){ alert('File non valido.'); }
    restoreFile.value = '';
  });

  // Minigioco (Catch!)
  document.querySelector('[data-act="play"]').addEventListener('click', ()=>{
    openGame();
  });
  let gameTimer=null, moveTimer=null, timeLeft=10, score=0;
  startGameBtn.addEventListener('click', startGame);
  function openGame(){ score=0; timeLeft=10; scoreEl.textContent='0'; timeEl.textContent='10'; gameArea.innerHTML=''; gameDlg.showModal(); }
  function startGame(){
    score=0; timeLeft=10; scoreEl.textContent=score; timeEl.textContent=timeLeft;
    spawnTarget();
    clearInterval(gameTimer); clearInterval(moveTimer);
    gameTimer = setInterval(()=>{
      timeLeft--; timeEl.textContent=timeLeft;
      if (timeLeft<=0){ endGame(); }
    },1000);
    moveTimer = setInterval(()=> moveTarget(), 600);
  }
  function endGame(){
    clearInterval(gameTimer); clearInterval(moveTimer);
    // premio: felicità cresce con il punteggio, energia cala un po'
    S.happiness = clamp(S.happiness + Math.min(5 + score*3, 40), 0, 100);
    S.energy    = clamp(S.energy - Math.max(2, Math.floor(score/2)), 0, 100);
    persist(); render();
    alert(`Fine! Punteggio: ${score}. Felicità +${Math.min(5 + score*3, 40)}`);
  }
  function spawnTarget(){
    const t = document.createElement('div');
    t.className='target'; t.textContent='★';
    t.addEventListener('click', ()=>{ score++; scoreEl.textContent=String(score); moveTarget(true); });
    gameArea.appendChild(t);
    moveTarget(true);
  }
  function moveTarget(first=false){
    const t = gameArea.querySelector('.target');
    if (!t) return;
    const gw = gameArea.clientWidth, gh = gameArea.clientHeight;
    const x = Math.random()*(gw-40), y = Math.random()*(gh-40);
    t.style.transform = `translate(${x}px, ${y}px)`;
    if (first) t.focus?.();
  }

  // Ripresa dopo assenza
  applyOfflineDecay();

  // Loop principale
  render(true);
  setInterval(tick, TICK_MS);

  // ===== Core =====
  function tick(){
    const now = Date.now();
    const dt = (now - S.lastTick) / 1000; if (dt <= 0) { S.lastTick = now; return; }
    const dh = dt / 3600;

    if (!S.sleeping){
      S.hunger      = clamp(S.hunger      - DECAY_PER_HOUR.hunger * dh, 0, 100);
      S.happiness   = clamp(S.happiness   - DECAY_PER_HOUR.happiness * dh, 0, 100);
      S.energy      = clamp(S.energy      - DECAY_PER_HOUR.energy * dh, 0, 100);
      S.cleanliness = clamp(S.cleanliness - DECAY_PER_HOUR.cleanliness * dh, 0, 100);
    } else {
      S.energy      = clamp(S.energy + 12 * dh, 0, 100);
      S.hunger      = clamp(S.hunger - 2 * dh, 0, 100);
      S.happiness   = clamp(S.happiness - 1 * dh, 0, 100);
      S.cleanliness = clamp(S.cleanliness - 1 * dh, 0, 100);
      if (S.energy >= 95) S.sleeping = false;
    }

    const low = (S.hunger<35) || (S.happiness<35) || (S.energy<35) || (S.cleanliness<35);
    const good= (S.hunger>60) && (S.happiness>60) && (S.energy>60) && (S.cleanliness>60);
    if (good) S.health = clamp(S.health + HEALTH_REGEN * dh, 0, 100);
    else if (low) S.health = clamp(S.health - HEALTH_DECAY * dh, 0, 100);

    const hoursFromBirth = (now - S.createdAt) / 3600000;
    const days = Math.floor(hoursFromBirth / AGING_HOURS_PER_DAY);
    if (days !== S.ageDays) { S.ageDays = days; updateStage(); }

    S.lastTick = now;
    persist(); render();
  }

  function doAction(act){
    switch(act){
      case 'feed':
        S.hunger = clamp(S.hunger + 28, 0, 100);
        S.cleanliness = clamp(S.cleanliness - 4, 0, 100);
        emote('yum'); break;
      case 'play':
        // apertura minigioco gestita sopra
        break;
      case 'sleep':
        S.sleeping = true; emote('sleep'); break;
      case 'clean':
        S.cleanliness = clamp(S.cleanliness + 30, 0, 100);
        emote('clean'); break;
    }
    persist(); render();
  }

  function emote(kind){
    const petSprite = document.querySelector('#petSprite');
    switch(kind){
      case 'yum':   petSprite.textContent = '(ˆڡˆ)'; break;
      case 'play':  petSprite.textContent = '(＾▽＾)'; break;
      case 'sleep': petSprite.textContent = '(-_-) zZ'; break;
      case 'clean': petSprite.textContent = '(•ᴗ•)✨'; break;
    }
    setTimeout(()=>render(), 1000);
  }

  function updateStage(){
    const d = S.ageDays;
    if (d < 1) S.stage = 'egg';
    else if (d < 3) S.stage = 'baby';
    else if (d < 7) S.stage = 'teen';
    else S.stage = 'adult';
  }

  function render(first=false){
    bars.hunger.style.width      = S.hunger + '%';
    bars.happiness.style.width   = S.happiness + '%';
    bars.energy.style.width      = S.energy + '%';
    bars.cleanliness.style.width = S.cleanliness + '%';
    bars.health.style.width      = S.health + '%';

    const mood = getMood();
    moodText.textContent = 'Umore: ' + mood.label;
    ageText.textContent = 'Età: ' + S.ageDays + 'g';
    stageBadge.textContent = stageLabel(S.stage);

    const petSprite = document.querySelector('#petSprite');
    if (!['(ˆڡˆ)','(＾▽＾)','(-_-) zZ','(•ᴗ•)✨'].includes(petSprite.textContent)){
      petSprite.textContent = spriteFor(mood.code, S.stage, S.sleeping);
    }

    if (first){
      const diff = Date.now() - (loadPreviousTick() || S.lastTick);
      if (diff > 90*1000) lastSeen.textContent = 'Bentornato! Sei stato via per ' + humanize(diff) + '.';
      else lastSeen.textContent = '';
    }
  }

  function spriteFor(mood, stage, sleeping){
    if (sleeping) return '(-_-) zZ';
    const base = {
      egg:   {happy:'(•͈⌣•͈)︎', ok:'（・⊝・）', sad:'(・へ・)', sick:'(×_×)'},
      baby:  {happy:'(ᵔᴥᵔ)', ok:'(•ᴗ•)',     sad:'(・_・;)', sick:'(×_×)'},
      teen:  {happy:'(＾▽＾)', ok:'(・∀・)',   sad:'(￣ヘ￣;)', sick:'(×_×)'},
      adult: {happy:'(＾‿＾)', ok:'(・‿・)',   sad:'(；￣Д￣)', sick:'(×_×)'}
    }[stage] || {};
    return base[mood] || '(・‿・)';
  }

  function stageLabel(s){
    return {egg:'Uovo', baby:'Baby', teen:'Teen', adult:'Adult'}[s] || 'Pet';
  }

  function getMood(){
    if (S.health < 25) return {code:'sick', label:'Malaticcio'};
    const avg = (S.hunger + S.happiness + S.energy + S.cleanliness) / 4;
    if (avg >= 75) return {code:'happy', label:'Felice'};
    if (avg >= 45) return {code:'ok',    label:'Curioso'};
    return {code:'sad',   label:'Triste'};
  }

  function applyOfflineDecay(){
    const prev = S.lastTick;
    const now = Date.now();
    const dtMs = now - prev;
    if (dtMs <= 0) return;

    const dh = dtMs / 3600000;
    if (!S.sleeping){
      S.hunger      = clamp(S.hunger      - DECAY_PER_HOUR.hunger * dh, 0, 100);
      S.happiness   = clamp(S.happiness   - DECAY_PER_HOUR.happiness * dh, 0, 100);
      S.energy      = clamp(S.energy      - DECAY_PER_HOUR.energy * dh, 0, 100);
      S.cleanliness = clamp(S.cleanliness - DECAY_PER_HOUR.cleanliness * dh, 0, 100);
    } else {
      S.energy = clamp(S.energy + 12 * dh, 0, 100);
    }
    const low = (S.hunger<35) || (S.happiness<35) || (S.energy<35) || (S.cleanliness<35);
    const good= (S.hunger>60) && (S.happiness>60) && (S.energy>60) && (S.cleanliness>60);
    if (good) S.health = clamp(S.health + HEALTH_REGEN * dh, 0, 100);
    else if (low) S.health = clamp(S.health - HEALTH_DECAY * dh, 0, 100);

    updateStage(); persist();
  }

  function humanize(ms){
    const s = Math.floor(ms/1000);
    const d = Math.floor(s/86400);
    const h = Math.floor((s%86400)/3600);
    const m = Math.floor((s%3600)/60);
    if (d>0) return `${d}g ${h}h`;
    if (h>0) return `${h}h ${m}m`;
    if (m>0) return `${m}m`;
    return `${s}s`;
  }

  function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }

  function persist(){
    localStorage.setItem(stateKey, JSON.stringify(S));
    localStorage.setItem(stateKey+'_lastSeen', String(Date.now()));
  }

  function loadPreviousTick(){
    const t = localStorage.getItem(stateKey+'_lastSeen');
    return t ? Number(t) : null;
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(stateKey);
      if (!raw) return initial();
      const obj = JSON.parse(raw);
      return Object.assign(initial(), obj);
    }catch{
      return initial();
    }
  }

  // ===== Notifiche locali (senza server) =====
  async function ensureNotifPermission(){
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }

  // controlla periodicamente e notifica se i bisogni sono bassi
  let notifInterval = null;
  function scheduleLocalCheck(){
    if (notifInterval) clearInterval(notifInterval);
    if (!S.notifEnabled) return;
    const periodMs = (S.notifMinutes || 360) * 60 * 1000;
    notifInterval = setInterval(checkAndNotify, periodMs);
  }

  async function checkAndNotify(){
    if (!S.notifEnabled) return;
    const avg = (S.hunger + S.happiness + S.energy + S.cleanliness)/4;
    if (avg < NEEDS_THRESHOLD){
      const text = 'Il tuo Tama ha bisogno di attenzioni!';
      try{
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && Notification.permission === 'granted'){
          reg.showNotification('TamaPWA', {
            body: text, icon: 'icon-192.png', badge: 'icon-192.png'
          });
        }
      }catch{ /* ignore */ }
    }
  }

  // avvia il ciclo di controllo quando la pagina è caricata
  if (S.notifEnabled) scheduleLocalCheck();

})();