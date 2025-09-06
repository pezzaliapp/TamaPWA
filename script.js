(() => {
  'use strict';

  const stateKey = 'tamaPWA_state_v4_fixed';

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
    metrics: {
      feedCount: 0, playCount: 0, cleanCount: 0,
      sleepMinutes: 0, energySpentFromPlay: 0,
      hoursTracked: 0, cleanlinessSum: 0, happinessSum: 0
    },
    variant: null
  });

  const VARIANT_SPRITE = {
    sportivo: 'sprite-sportivo.png',
    goloso: 'sprite-goloso.png',
    pulito: 'sprite-pulito.png',
    sognatore: 'sprite-sognatore.png',
    equilibrato: 'sprite-equilibrato.png'
  };

  let S = loadState();

  const DECAY_PER_HOUR_BASE = { hunger: 6, happiness: 4, energy: 5, cleanliness: 3 };
  const HEALTH_REGEN = 2;
  const HEALTH_DECAY = 6;
  const TICK_MS = 1000;
  const AGING_HOURS_PER_DAY = 24;

  // DOM
  const $ = s => document.querySelector(s);
  const bars = {
    hunger: $('#barHunger'), happiness: $('#barHappy'),
    energy: $('#barEnergy'), cleanliness: $('#barClean'), health: $('#barHealth')
  };
  const moodText   = $('#moodText');
  const ageText    = $('#ageText');
  const stageBadge = $('#stageBadge');
  const lastSeen   = $('#lastSeenText');
  const variantText= $('#variantText');
  const petImg     = $('#petImg');
  const infoBtn    = $('#infoBtn');
  const howtoDlg   = $('#howto');
  const resetBtn   = $('#resetBtn');
  const toggleDash = $('#toggleDash');
  const dashboard  = $('#dashboard');

  // Actions
  document.querySelectorAll('#actions [data-act]').forEach(btn=>{
    btn.addEventListener('click', ()=> doAction(btn.dataset.act));
  });
  infoBtn.addEventListener('click', ()=> howtoDlg.showModal());
  resetBtn.addEventListener('click', ()=>{
    if (confirm('Resetta il tuo pet? Operazione irreversibile.')){
      S = initial(); persist(); render(true);
    }
  });
  toggleDash.addEventListener('click', ()=> { dashboard.hidden = !dashboard.hidden; renderDashboard(); });

  // Startup
  applyOfflineDecay();
  render(true);
  setInterval(tick, TICK_MS);

  function tick(){
    const now = Date.now();
    const dt = (now - S.lastTick)/1000; if (dt<=0){ S.lastTick = now; return; }
    const dh = dt / 3600;

    const dec = { ...DECAY_PER_HOUR_BASE };
    if (S.variant === 'equilibrato'){
      Object.keys(dec).forEach(k => dec[k] *= 0.9);
    }

    if (!S.sleeping){
      S.hunger      = clamp(S.hunger      - dec.hunger * dh, 0, 100);
      S.happiness   = clamp(S.happiness   - dec.happiness * dh, 0, 100);
      S.energy      = clamp(S.energy      - dec.energy * dh, 0, 100);
      S.cleanliness = clamp(S.cleanliness - dec.cleanliness * dh, 0, 100);
    }else{
      const regen = (S.variant==='sognatore') ? 12*1.25 : 12;
      S.energy      = clamp(S.energy + regen * dh, 0, 100);
      S.hunger      = clamp(S.hunger - 2 * dh, 0, 100);
      S.happiness   = clamp(S.happiness - 1 * dh, 0, 100);
      S.cleanliness = clamp(S.cleanliness - 1 * dh, 0, 100);
      S.metrics.sleepMinutes += dh*60;
      if (S.energy >= 95) S.sleeping = false;
    }

    // metrics averages
    S.metrics.hoursTracked += dh;
    S.metrics.cleanlinessSum += S.cleanliness * dh;
    S.metrics.happinessSum  += S.happiness   * dh;

    // Health
    const low = (S.hunger<35) || (S.happiness<35) || (S.energy<35) || (S.cleanliness<35);
    const good= (S.hunger>60) && (S.happiness>60) && (S.energy>60) && (S.cleanliness>60);
    if (good) S.health = clamp(S.health + HEALTH_REGEN * dh, 0, 100);
    else if (low) S.health = clamp(S.health - HEALTH_DECAY * dh, 0, 100);

    // Age + evolution
    const hoursFromBirth = (now - S.createdAt) / 3600000;
    const days = Math.floor(hoursFromBirth / AGING_HOURS_PER_DAY);
    if (days !== S.ageDays){
      S.ageDays = days;
      updateStageAndVariant();
    }

    S.lastTick = now;
    persist();
    render();
  }

  function doAction(act){
    switch(act){
      case 'feed': {
        const hungerGain = (S.variant==='goloso') ? 28*1.15 : 28;
        const cleanDrop  = (S.variant==='goloso') ? 4*1.25 : 4;
        S.hunger = clamp(S.hunger + hungerGain, 0, 100);
        S.cleanliness = clamp(S.cleanliness - cleanDrop, 0, 100);
        S.metrics.feedCount++;
        emote('yum');
        break;
      }
      case 'play': {
        let happyGain = 20;
        let energyCost = 8;
        if (S.variant==='sportivo'){ happyGain *= 1.4; energyCost *= 1.3; }
        if (S.variant==='equilibrato'){ happyGain *= 1.1; }
        S.happiness = clamp(S.happiness + happyGain, 0, 100);
        const spent = Math.min(energyCost, S.energy);
        S.energy = clamp(S.energy - spent, 0, 100);
        S.metrics.playCount++;
        S.metrics.energySpentFromPlay += spent;
        emote('play');
        break;
      }
      case 'sleep': {
        S.sleeping = true; emote('sleep'); break;
      }
      case 'clean': {
        let cleanGain = 30;
        if (S.variant==='pulito') { cleanGain *= 1.2; S.health = clamp(S.health + 2, 0, 100); }
        if (S.variant==='equilibrato'){ cleanGain *= 1.05; }
        S.cleanliness = clamp(S.cleanliness + cleanGain, 0, 100);
        S.metrics.cleanCount++;
        emote('clean'); break;
      }
    }
    persist();
    render();
  }

  function updateStageAndVariant(){
    const d = S.ageDays;
    if (d < 1) S.stage = 'egg';
    else if (d < 3) S.stage = 'baby';
    else if (d < 7) {
      if (S.stage !== 'teen'){
        S.stage = 'teen';
        if (!S.variant) S.variant = chooseVariant();
      }
    } else {
      if (S.stage !== 'adult'){
        S.stage = 'adult';
        S.variant = chooseVariant(true);
      }
    }
  }

  function chooseVariant(consolidate=false){
    const hours = Math.max(0.0001, S.metrics.hoursTracked);
    const avgClean = S.metrics.cleanlinessSum / hours;
    const avgHappy = S.metrics.happinessSum  / hours;

    const score = {
      sportivo:    S.metrics.playCount * 2 + S.metrics.energySpentFromPlay * 0.8 + (avgHappy>70 ? 2:0),
      goloso:      S.metrics.feedCount * 2 + Math.max(0, 70 - avgClean) * 0.3,
      pulito:      S.metrics.cleanCount * 2 + avgClean * 0.4,
      sognatore:   (S.metrics.sleepMinutes / 30),
      equilibrato: (avgHappy>65 ? 8:0) + (Math.abs(avgClean-60) < 10 ? 4:0)
    };

    if (consolidate && S.variant && score[S.variant] !== undefined){
      score[S.variant] += 3;
    }

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
    variantText.textContent = S.variant ? ('Variante: ' + variantLabel(S.variant)) : 'Variante: —';

    // sprite image: if no variant yet, show equilibrato
    const v = S.variant || 'equilibrato';
    petImg.src = VARIANT_SPRITE[v];
    petImg.alt = `Sprite ${variantLabel(v)}`;

    if (first){
      const diff = Date.now() - (loadPreviousTick() || S.lastTick);
      if (diff > 90*1000) lastSeen.textContent = 'Bentornato! Sei stato via per ' + humanize(diff) + '.';
      else lastSeen.textContent = '';
    }

    renderDashboard();
  }

  function renderDashboard(){
    const hours = S.metrics.hoursTracked;
    const avgClean = hours>0 ? (S.metrics.cleanlinessSum / hours) : 0;
    const avgHappy = hours>0 ? (S.metrics.happinessSum  / hours) : 0;
    const set = (id,val)=>{ const el=document.getElementById(id); if (el) el.textContent = (typeof val==='number'? Math.round(val): val); };
    set('mFeed', S.metrics.feedCount);
    set('mPlay', S.metrics.playCount);
    set('mClean', S.metrics.cleanCount);
    set('mSleep', Math.round(S.metrics.sleepMinutes));
    set('mEnergySpent', Math.round(S.metrics.energySpentFromPlay));
    set('avgClean', Math.round(avgClean));
    set('avgHappy', Math.round(avgHappy));
    set('hoursTracked', Math.round(hours*10)/10);
    set('dashVariant', S.variant ? variantLabel(S.variant) : '—');
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
    S.hunger      = clamp(S.hunger      - DECAY_PER_HOUR_BASE.hunger * dh, 0, 100);
    S.happiness   = clamp(S.happiness   - DECAY_PER_HOUR_BASE.happiness * dh, 0, 100);
    S.energy      = clamp(S.energy      - DECAY_PER_HOUR_BASE.energy * dh, 0, 100);
    S.cleanliness = clamp(S.cleanliness - DECAY_PER_HOUR_BASE.cleanliness * dh, 0, 100);

    // metrics
    S.metrics.hoursTracked += dh;
    S.metrics.cleanlinessSum += S.cleanliness * dh;
    S.metrics.happinessSum  += S.happiness   * dh;

    // salute
    const low = (S.hunger<35) || (S.happiness<35) || (S.energy<35) || (S.cleanliness<35);
    const good= (S.hunger>60) && (S.happiness>60) && (S.energy>60) && (S.cleanliness>60);
    if (good) S.health = clamp(S.health + HEALTH_REGEN * dh, 0, 100);
    else if (low) S.health = clamp(S.health - HEALTH_DECAY * dh, 0, 100);

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