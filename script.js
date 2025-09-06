(() => {
  'use strict';

  const stateKey = 'tamaPWA_state_stable';

  const initial = () => ({
    createdAt: Date.now(),
    lastTick: Date.now(),
    ageDays: 0,
    hunger: 80,
    happiness: 80,
    energy: 80,
    cleanliness: 80,
    health: 100,
    stage: 'egg',    // egg, baby, teen, adult
    sleeping: false,
    demoMode: false, // 1 minuto = 1 giorno se ON
  });

  let S = loadState();

  const DECAY_PER_HOUR = { hunger: 6, happiness: 4, energy: 5, cleanliness: 3 };
  const HEALTH_REGEN = 2;
  const HEALTH_DECAY = 6;
  const TICK_MS = 1000;

  // DOM
  const $ = (s)=>document.querySelector(s);
  const bars = {
    hunger: $('#barHunger'),
    happiness: $('#barHappy'),
    energy: $('#barEnergy'),
    cleanliness: $('#barClean'),
    health: $('#barHealth')
  };
  const petSprite = $('#petSprite');
  const moodText  = $('#moodText');
  const ageText   = $('#ageText');
  const stageBadge= $('#stageBadge');
  const lastSeen  = $('#lastSeenText');
  const infoBtn   = $('#infoBtn');
  const howtoDlg  = $('#howto');
  const resetBtn  = $('#resetBtn');
  const demoBtn   = $('#demoBtn');

  // Game elements
  const gameDlg   = $('#gameDialog');
  const gameArea  = $('#gameArea');
  const startBtn  = $('#startGameBtn');
  const scoreEl   = $('#score');
  const timeEl    = $('#time');

  // Actions
  document.querySelectorAll('#actions [data-act]').forEach(btn=>{
    btn.addEventListener('click', ()=> doAction(btn.dataset.act));
  });
  infoBtn.addEventListener('click', ()=> howtoDlg.showModal());
  resetBtn.addEventListener('click', ()=> {
    if (confirm('Resetta il tuo pet? Operazione irreversibile.')) {
      S = initial(); persist(); render(true);
    }
  });
  demoBtn.addEventListener('click', ()=>{
    S.demoMode = !S.demoMode;
    demoBtn.textContent = S.demoMode ? '⏱️ Demo: ON' : '⏱️ Demo: OFF';
    persist();
  });

  // Install prompt PWA (optional)
  const installBtn = document.getElementById('installBtn');
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e; if (installBtn) installBtn.hidden = false;
  });
  if (installBtn) installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true;
  });

  // Resume decay since last visit
  applyOfflineDecay();

  // Loop
  render(true);
  setInterval(tick, TICK_MS);

  // ===== Core =====
  function tick(){
    const now = Date.now();
    const dt = (now - S.lastTick) / 1000; if (dt <= 0){ S.lastTick = now; return; }
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

    // Salute
    const low = (S.hunger<35) || (S.happiness<35) || (S.energy<35) || (S.cleanliness<35);
    const good= (S.hunger>60) && (S.happiness>60) && (S.energy>60) && (S.cleanliness>60);
    if (good) S.health = clamp(S.health + HEALTH_REGEN * dh, 0, 100);
    else if (low) S.health = clamp(S.health - HEALTH_DECAY * dh, 0, 100);

    // Età
    const hoursFromBirth = (now - S.createdAt) / 3600000;
    const hoursPerDay = S.demoMode ? (1/60) : 24; // demo: 1 min = 1 day
    const days = Math.floor(hoursFromBirth / hoursPerDay);
    if (days !== S.ageDays) {
      S.ageDays = days;
      updateStage();
    }

    S.lastTick = now;
    persist();
    render();
  }

  function doAction(act){
    switch(act){
      case 'feed':
        S.hunger = clamp(S.hunger + 28, 0, 100);
        S.cleanliness = clamp(S.cleanliness - 4, 0, 100);
        emote('🍎');
        break;
      case 'play':
        openGame();
        break;
      case 'sleep':
        S.sleeping = true;
        emote('💤');
        break;
      case 'clean':
        S.cleanliness = clamp(S.cleanliness + 30, 0, 100);
        emote('✨');
        break;
    }
    persist();
    render();
  }

  // ===== Catch! Minigame =====
  let gameTimer=null, moveTimer=null, timeLeft=15, score=0;
  function openGame(){
    score=0; timeLeft=15;
    scoreEl.textContent='0'; timeEl.textContent='15';
    gameArea.innerHTML='';
    gameDlg.showModal();
  }
  startBtn.addEventListener('click', startGame);
  function startGame(){
    // clear previous
    clearInterval(gameTimer); clearInterval(moveTimer);
    score=0; timeLeft=15; scoreEl.textContent=score; timeEl.textContent=timeLeft;
    spawnTarget();
    gameTimer = setInterval(()=>{
      timeLeft--; timeEl.textContent=timeLeft;
      if (timeLeft<=0){ endGame(); }
    },1000);
    moveTimer = setInterval(()=> moveTarget(), 600);
  }
  function endGame(){
    clearInterval(gameTimer); clearInterval(moveTimer);
    // premio: felicità cresce con il punteggio, energia cala un po'
    const gain = Math.min(5 + score*2, 40);
    const cost = Math.max(2, Math.floor(score/2));
    S.happiness = clamp(S.happiness + gain, 0, 100);
    S.energy    = clamp(S.energy - cost, 0, 100);
    persist(); render();
    alert(`Fine! Punteggio: ${score}. Felicità +${gain}, Energia -${cost}`);
  }
  function spawnTarget(){
    const t = document.createElement('div');
    t.className='target'; t.textContent='★';
    t.addEventListener('click', ()=>{ score++; scoreEl.textContent=String(score); moveTarget(true); });
    gameArea.appendChild(t);
    moveTarget(true);
  }
  function moveTarget(first=false){
    const t = gameArea.querySelector('.target'); if (!t) return;
    const gw = gameArea.clientWidth, gh = gameArea.clientHeight;
    const x = Math.random()*(gw-40), y = Math.random()*(gh-40);
    t.style.transform = `translate(${x}px, ${y}px)`;
    if (first) t.focus?.();
  }

  // ===== Helpers =====
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

    // Sprite (text-based, stable)
    if (!['🍎','🎯','💤','✨'].includes(petSprite.textContent)){
      petSprite.textContent = spriteFor(mood.code, S.stage, S.sleeping);
    }

    // Update demo button label
    demoBtn.textContent = S.demoMode ? '⏱️ Demo: ON' : '⏱️ Demo: OFF';

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
    // Età
    updateStage();
    persist();
  }

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

  // utils
  function humanize(ms){
    const s = Math.floor(ms/1000);
    const d = Math.floor(s/86400);
    const h = Math.floor((s%86400)/3600);
    const m = Math.floor((s%3600)/60);
    if (d>0) return `${d}g ${h}h`; if (h>0) return `${h}h ${m}m`; if (m>0) return `${m}m`; return `${s}s`;
  }
  function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }
  function persist(){ localStorage.setItem(stateKey, JSON.stringify(S)); localStorage.setItem(stateKey+'_lastSeen', String(Date.now())); }
  function loadPreviousTick(){ const t = localStorage.getItem(stateKey+'_lastSeen'); return t ? Number(t) : null; }
  function loadState(){
    try{ const raw = localStorage.getItem(stateKey); if (!raw) return initial(); const obj = JSON.parse(raw); return Object.assign(initial(), obj); }
    catch{ return initial(); }
  }
})();