# TamaPWA — Evoluzioni ramificate basate sulla cura (v3)

Questa release introduce **varianti di crescita** in base al tuo stile di cura.
Quando passi a **Teen (giorno 3)** il pet sceglie una variante; a **Adult (giorno 7)** la consolida.

## Varianti
- **Sportivo** → giochi spesso, consumi energia
- **Goloso** → lo nutri spesso (e la pulizia media è più bassa)
- **Pulito** → lo pulisci spesso e mantieni alta la pulizia media
- **Sognatore** → dorme molto
- **Equilibrato** → nessun eccesso, umore medio-alto e bilanciato

La UI mostra `Variante: ...` sotto allo sprite. Piccola icona accanto allo sprite (🏃🍰✨🌙⚖️).

## Come decide la variante
Il codice tiene traccia di:
- **Azioni**: feed/play/clean + energia spesa durante il gioco
- **Sonno** (minuti accumulati)
- **Medie** su Pulizia e Felicità

Un sistema di punteggi sceglie la variante dominante al passaggio di stadio (con leggera inerzia a Adult).

## File
- `index.html`, `style.css`, `script.js`
- `manifest.json`, `service-worker.js`
- `icon-192.png`, `icon-512.png` (placeholder)
- `README.md`

MIT © 2025
