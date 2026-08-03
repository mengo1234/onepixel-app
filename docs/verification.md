# Verifica onePixel

Ultimo collaudo locale: 3 agosto 2026.

## Controlli superati

- Rilancio dashboard del 3 agosto: panoramica operativa derivata dagli stati reali
  evento/pacchetto/presenza, prossime azioni per stato, riepilogo strutture ed eventi,
  stati vuoti per profilo e console superadmin; rimossi “LIVE TEST”, “ORG LIVE” e
  “tutti i sistemi nominali” quando non sostenuti da una verifica reale.
- Ciclo configurazioni venue: migrazione `006_venue_layout_lifecycle.sql`, scelta della
  configurazione predefinita, archivio e ripristino. Sono vietati archivio della
  predefinita, archivio dell'ultima configurazione attiva e uso di una configurazione
  archiviata per creare un nuovo evento.
- Verifica corrente: 8 file e 44 test control-plane superati, build TypeScript,
  autenticazione form, ESLint e build Next.js con 20 route superati. Smoke runtime con
  database temporaneo: login organizzazione, `/dashboard` ed editor HTTP 200; cambio
  predefinita, archivio, ripristino e ripristino della predefinita tutti HTTP 200 via
  proxy dashboard. Il QA visuale corrente a 390/768/1440 px resta aperto perché i due
  browser isolati non erano disponibili nella sessione.

- Control-plane: 4 file e 24 test API/DB superati; build TypeScript riuscita. Copertura di ruoli, pagamenti e consumo singolo, upgrade, account partecipante, notifiche, QR singolo/massivo, precedenza QR sul GPS, geofence, catasto, media, backup/ripristino, realtime e tracciamento dell'ultimo accesso amministratore.
- Dashboard: ESLint e build Next.js di produzione riusciti; 20 route generate, incluse editor, wizard evento, regia, upgrade, impostazioni e superadmin. La pagina utenti superadmin è stata verificata a runtime dopo la migrazione `last_login_at`.
- Android: `flutter analyze` senza problemi; 10 test superati e 1 test hardware escluso. Sono coperti IT/EN, schermo 390x844, telefono compatto 320x568, scanner, aggiornamento eventi, preparazione offline, demo, profilo e notifiche.
- Landing: build Vite riuscita, deploy GitHub Pages della revisione `36035c8` completato e risposte HTTP 200 per pagina, APK, quattro immagini workflow e nuovi bundle CSS/JS; hash remoto uguale all'APK firmato locale.
- Grafiche workflow Imagen: quattro asset originali 1448×1086 archiviati in `assets/generated/workflow`; copie WebP 1200×900 ottimizzate per Disegna, Posiziona, Scegli l'accesso e Vai live pubblicate nelle card. Tutte caricano correttamente, hanno testo alternativo IT/EN e non producono overflow a 500 o 1.440 px.
- Deploy produzione: il compose inoltra ora Stripe, webhook, modalità pagamento e client OAuth Google al backend. `scripts/verify-production-env.sh` supera il controllo sintattico, rifiuta l'ambiente di esempio con sette placeholder/invarianti non sicuri e accetta un ambiente sintetico completo senza stampare segreti. La validazione `docker compose config` non è eseguibile in questa sessione perché Podman non può modificare `/run/user/1000/libpod` in sola lettura.
- Funnel pubblico: le CTA Dashboard, Crea un evento e Inizia dalla dashboard aprono accesso demo, selezione fascia 3/7/19 euro, pagamento simulato e dashboard pubblica. I tab Panoramica, Strutture, Eventi e Report renderizzano viste distinte; entrambi i CTA Configura evento aprono il wizard Evento → Struttura → Accesso → Regia e il salvataggio demo aggiorna la pagina Eventi. Lo stato demo persiste localmente e non invia dati né produce addebiti.
- QA browser: landing e dashboard verificate a 500 px e 1.440 px senza overflow orizzontale; navigazione mobile senza scrollbar visibile, pulsanti entro il viewport e raggi coerenti. Editor, studio timeline, login, registrazione, checkout, report, profilo e tutte le viste superadmin sono state aperte nel browser reale. Il selettore IT/EN è stato provato in entrambe le direzioni con persistenza al ricaricamento; lo studio timeline è stato corretto e ricontrollato a 500 px. Nella dashboard completa, login organizzazione → checkout mock → conferma in dashboard → wizard evento è stato verificato end-to-end.

## Flusso end-to-end provato

- Login organizzazione in dashboard con cookie HttpOnly.
- Lettura del mock `Finale Luce` dalla dashboard, editor v2 e regia.
- Mock con tre anelli, 31.988 posti, campo, palco, ingresso, pedana accessibile, due macro-zone GPS e tre cue.
- Emissione massiva di 13 QR, risoluzione pubblica del QR N1, creazione join, manifest con tre cue e token realtime.
- Precedenza verificata dal vivo: ingresso iniziale GPS in `NORD`, scansione QR in `N1 · 18-42`, successivo aggiornamento GPS ancora bloccato su `N1 · 18-42`.
- Endpoint eventi vicini restituisce il mock attivo a distanza zero.
- Ricerca catastale eseguita dalla mappa sul servizio reale: risposta `Foglio 296 · Particella 35 · MILANO (MI)` e confine disponibile per l'importazione senza alterare la fonte ufficiale.

## Artifact Android 1.1.1

- File: `artifacts/onePixel-android-1.1.1.apk`
- Dimensione: 80.450.240 byte
- SHA-256: `68af0403680b6b37347fe069c84b63d87697b49a95f96eaf118b19d5efb8f12f`
- Package: `com.onepixel.onepixel`, versionCode 4, versionName 1.1.1, min SDK 24, target SDK 36.
- Firma: schemi APK v2/v3, RSA 4096, certificato `onePixel Release`, digest certificato SHA-256 `06161895e9eb907969c65256629365421c49edd039861d560f8e3254203a583c`.
- Questa build di collaudo usa `http://127.0.0.1:4100` via `adb reverse`; la demo offline funziona anche senza backend. Eventi remoti richiedono un URL API HTTPS pubblico.

## Stato dispositivo ed esterni

Al momento dell'ultimo controllo il Pixel compariva in `lsusb` come dispositivo Google `18d1:4ee7` in modalità ricarica + debug, ma non era enumerato da `adb` nella sessione isolata. L'installazione fisica della 1.1.1 resta da completare tramite debug wireless o da una sessione host con accesso al device USB.

Per rendere operativi in produzione pagamento e Google Sign-In servono ancora le credenziali esterne del proprietario: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_OAUTH_CLIENT_ID` e l'URL HTTPS del backend.
