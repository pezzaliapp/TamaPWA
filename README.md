# TamaPWA — PWA con Sprite pixel‑art

Novità:
- Sprite **pixel‑art** per ogni **variante** (sportivo, goloso, pulito, sognatore, equilibrato)
  e per **umore** (felice/ok/triste/malaticcio) + **sleep**.
- Tutto il resto come la PWA auto‑update (Catch!, Simon, suoni 8‑bit, Demo).

## Deploy
1. Carica i file nella root della repo (GitHub Pages).
2. A ogni release bumpa `CACHE` in `service-worker.js` (es. `...-v2`).
3. Le sprite sono servite e cache‑ate **dinamicamente** al primo use.

