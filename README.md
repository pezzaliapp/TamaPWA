# TamaPWA — Pet virtuale (con Promemoria, Minigioco, Backup)

**PWA in una cartella.** Offline, salvataggio locale e decadimenti nel tempo reale.
Novità:
- 🔔 *Promemoria* locali (no server): controlli periodici e notifiche se i bisogni scendono troppo.
- 🎮 *Minigioco Catch!*: tocca il bersaglio in 10s → più punti, più Felicità.
- ⬇️⬆️ *Backup/Ripristino* stato in JSON.

## File
- `index.html`, `style.css`, `script.js`
- `manifest.json`, `service-worker.js`
- `icon-192.png`, `icon-512.png` (segnaposto)
- `README.md`

## Uso
- **Promemoria**: clicca *🔔 Promemoria*, consenti le notifiche, scegli la frequenza (60/180/360 min).
- **Gioca**: *🎮 Gioca* apre il minigioco *Catch!* (10s).
- **Backup**: *⬇️ Backup* scarica JSON. **Ripristina**: *⬆️ Ripristina* → seleziona JSON salvato.

## Pubblicazione rapida
Carica tutto nella root della repo `TamaPWA`. Abilita GitHub Pages per una demo web installabile.

MIT © 2025
