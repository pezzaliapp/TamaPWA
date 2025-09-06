# TamaPWA — Stable (Auto‑Update)

Questa build include l’**auto‑update PWA** con banner “Nuova versione disponibile — Aggiorna”.

## Come funziona
- Il Service Worker scarica la nuova versione in background.
- Quando è pronta, compare un banner in basso: cliccando **Aggiorna** inviamo `SKIP_WAITING` e la pagina si ricarica con i file nuovi.

## Note per il rilascio
- **Bump** della costante `CACHE` in `service-worker.js` a ogni release.
- Opzionale: `reg.update()` gira ogni ora e quando ritorni alla tab.

## Extra
- Resta la **Modalità Demo** (1 min = 1 giorno) per test veloce dell’evoluzione.
- Minigioco **Catch!** funzionante.

MIT © 2025
