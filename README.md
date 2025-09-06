# TamaPWA — PWA con Auto-Update

Questa è la versione PWA della build che funziona, con:
- varianti, due minigiochi (Catch! e Simon), suoni 8-bit, modalità demo;
- **Service Worker** con **auto-update** (banner "Nuova versione disponibile — Aggiorna").

## Deploy (GitHub Pages)
1. Crea la repo (es. `TamaPWA`) e carica questi file nella **root**:
   ```
   index.html
   style.css
   script.js
   manifest.json
   service-worker.js
   icon-192.png
   icon-512.png
   ```
2. Attiva GitHub Pages su `main` / root.
3. Apri la pagina. Alla prima visita cache offline pronta.

## Aggiornamenti futuri
- **Bumpare la costante `CACHE`** in `service-worker.js` (es. `...-v2` → `...-v3`).
- Il banner apparirà quando la nuova versione è pronta; clic su **Aggiorna** per ricaricare l'app.

## Modalità Demo
- Bottone **⏱️ Demo**: ON = 1 minuto = 1 giorno per vedere subito le evoluzioni.

MIT © 2025
