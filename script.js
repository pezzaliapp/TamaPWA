(() => {
  'use strict';

  // --- Stato e costanti ---
  const stateKey = 'tamaPWA_state_v3';

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

    // Metriche per evoluzioni ramificate
    metrics: {
      feedCount: 0,
      playCount: 0,
      cleanCount: 0,
      sleepMinutes: 0,
      energySpentFromPlay: 0,
      // per medie
      hoursTracked: 0,
      cleanlinessSum: 0,
      happinessSum: 0
    },

    // Variante assegnata all'evoluzione
    variant: null   // 'sportivo' | 'goloso' | 'pulito' | 'sognatore' | 'equilibrato'
  });

  let S = loadState();

  const DECAY_PER_HOUR = { hunger: 6, happiness: 4, energy: 5, cleanliness: 3 };
  const HEALTH_REGEN = 2;
  const HEALTH_DECAY = 6;
  const TICK_MS = 1000;
  const AGING_HOURS_PER_DAY = 24;

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
  const variantText= $('#variantText');
  const infoBtn    = $('#infoBtn');
  const howtoDlg   = $('#howto');
  const resetBtn   = $('#resetBtn');
  const installBtn = $('#installBtn');

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
      // dormendo: accumula minuti sonno
      S.energy      = clamp(S.energy + 12 * dh, 0, 100);
      S.hunger      = clamp(S.hunger - 2 * dh, 0, 100);
      S.happiness   = clamp(S.happiness - 1 * dh, 0, 100);
      S.cleanliness = clamp(S.cleanliness - 1 * dh, 0, 100);
      S.metrics.sleepMinutes += dh * 60;
      if (S.energy >= 95) S.sleeping = false;
    }

    // Medie per variant logic
    S.metrics.hoursTracked += dh;
    S.metrics.cleanlinessSum += S.cleanliness * dh;
    S.metrics.happinessSum  += S.happiness   * dh;

    // Salute
    const low = (S.hunger<35) || (S.happiness<35) || (S.energy<35) || (S.cleanliness<35);
    const good= (S.hunger>60) && (S.happiness>60) && (S.energy>60) && (S.cleanliness>60);
    if (good) S.health = clamp(S.health + HEALTH_REGEN * dh, 0, 100);
    else if (low) S.health = clamp(S.health - HEALTH_DECAY * dh, 0, 100);

    // Età ed evoluzioni
    const hoursFromBirth = (now - S.createdAt) / 3600000;
    const days = Math.floor(hoursFromBirth / AGING_HOURS_PER_DAY);
    if (days !== S.ageDays) {
      S.ageDays = days;
      updateStageAndVariant(); // assegna/aggiorna variante al passaggio
    }

    S.lastTick = now;
    persist(); render();
  }

  function doAction(act){
    switch(act){
      case 'feed':
        S.hunger = clamp(S.hunger + 28, 0, 100);
        S.cleanliness = clamp(S.cleanliness - 4, 0, 100);
        S.metrics.feedCount++;
        emote('yum'); break;
      case 'play':
        S.happiness = clamp(S.happiness + 20, 0, 100);
        const spent = Math.min(8, S.energy);
        S.energy    = clamp(S.energy - spent, 0, 100);
        S.metrics.playCount++;
        S.metrics.energySpentFromPlay += spent;
        emote('play'); break;
      case 'sleep':
        S.sleeping = true; emote('sleep'); break;
      case 'clean':
        S.cleanliness = clamp(S.cleanliness + 30, 0, 100);
        S.metrics.cleanCount++;
        emote('clean'); break;
    }
    persist(); render();
  }

  // --- Evoluzioni ramificate ---
  function updateStageAndVariant(){
    const d = S.ageDays;
    if (d < 1) S.stage = 'egg';
    else if (d < 3) S.stage = 'baby';
    else if (d < 7) {
      if (S.stage !== 'teen'){ // appena diventato teen
        S.stage = 'teen';
        if (!S.variant) S.variant = chooseVariant(); // assegna la prima volta
      }
    } else {
      if (S.stage !== 'adult'){
        S.stage = 'adult';
        // alla maturità, eventualmente riconsolida la variante
        S.variant = chooseVariant(true);
      }
    }
  }

  function chooseVariant(consolidate=false){
    // Calcola punteggi
    const hours = Math.max(0.0001, S.metrics.hoursTracked);
    const avgClean = S.metrics.cleanlinessSum / hours;
    const avgHappy = S.metrics.happinessSum  / hours;

    const score = {
      sportivo:    S.metrics.playCount * 2 + S.metrics.energySpentFromPlay * 0.8 + (avgHappy>70 ? 2:0),
      goloso:      S.metrics.feedCount * 2 + Math.max(0, 70 - avgClean) * 0.3,
      pulito:      S.metrics.cleanCount * 2 + avgClean * 0.4,
      sognatore:   (S.metrics.sleepMinutes / 30), // 1 punto ogni 30 minuti di sonno
      equilibrato: (avgHappy>65 ? 8:0) + (Math.abs(avgClean-60) < 10 ? 4:0)
    };

    // In consolidamento al livello adult, leggera inerzia verso la variante attuale
    if (consolidate && S.variant && score[S.variant] !== undefined){
      score[S.variant] += 3;
    }

    // Scegli max
    let best = 'equilibrato', bestVal = -Infinity;
    for (const [k,v] of Object.entries(score)){
      if (v > bestVal){ bestVal = v; best = k; }
    }
    return best;
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
    variantText.textContent = S.variant ? ('Variante: ' + variantLabel(S.variant)) : '';

    const petSprite = document.querySelector('#petSprite');
    if (!['(ˆڡˆ)','(＾▽＾)','(-_-) zZ','(•ᴗ•)✨'].includes(petSprite.textContent)){
      petSprite.textContent = spriteFor(mood.code, S.stage, S.sleeping, S.variant);
    }

    if (first){
      const diff = Date.now() - (loadPreviousTick() || S.lastTick);
      if (diff > 90*1000) lastSeen.textContent = 'Bentornato! Sei stato via per ' + humanize(diff) + '.';
      else lastSeen.textContent = '';
    }
  }

  function spriteFor(mood, stage, sleeping, variant){
    if (sleeping) return '(-_-) zZ';
    // sprite base per stage+umore
    const base = {
      egg:   {happy:'(•͈⌣•͈)︎', ok:'（・⊝・）', sad:'(・へ・)', sick:'(×_×)'},
      baby:  {happy:'(ᵔᴥᵔ)', ok:'(•ᴗ•)',     sad:'(・_・;)', sick:'(×_×)'},
      teen:  {happy:'(＾▽＾)', ok:'(・∀・)',   sad:'(￣ヘ￣;)', sick:'(×_×)'},
      adult: {happy:'(＾‿＾)', ok:'(・‿・)',   sad:'(；￣Д￣)', sick:'(×_×)'}
    }[stage] || {};
    let sprite = base[mood] || '(・‿・)';
    // piccola variazione estetica per variante
    const flair = {
      sportivo: '🏃',
      goloso: '🍰',
      pulito: '✨',
      sognatore: '🌙',
      equilibrato: '⚖️'
    }[variant];
    if (flair) sprite = sprite + ' ' + flair;
    return sprite;
  }

  function stageLabel(s){
    return {egg:'Uovo', baby:'Baby', teen:'Teen', adult:'Adult'}[s] || 'Pet';
  }
  function variantLabel(v){
    return {sportivo:'Sportivo', goloso:'Goloso', pulito:'Pulito', sognatore:'Sognatore', equilibrato:'Equilibrato'}[v] || '';
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
      S.metrics.sleepMinutes += dh * 60;
    }
    // medie
    S.metrics.hoursTracked += dh;
    S.metrics.cleanlinessSum += S.cleanliness * dh;
    S.metrics.happinessSum  += S.happiness   * dh;

    // salute
    const low = (S.hunger<35) || (S.happiness<35) || (S.energy<35) || (S.cleanliness<35);
    const good= (S.hunger>60) && (S.happiness>60) && (S.energy>60) && (S.cleanliness>60);
    if (good) S.health = clamp(S.health + HEALTH_REGEN * dh, 0, 100);
    else if (low) S.health = clamp(S.health - HEALTH_DECAY * dh, 0, 100);

    // stage/variant
    updateStageAndVariant();
    persist();
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
})();