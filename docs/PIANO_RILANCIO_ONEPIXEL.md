# Piano di rilancio onePixel

Stato: **approvato il 3 agosto 2026, implementazione in corso**
Workspace: `/var/home/fabio/Documenti/Claude/onePixel-NOVA`  
Data audit: 3 agosto 2026

## Avanzamento verificato

- Fasi 0-2 completate: baseline Git/tag, Venue v3, migrazione legacy, generatore di
  anelli concentrici, capienza esatta e wizard stadio.
- Interazioni editor principali completate: click-to-place, vista composita/filtro
  anello, proporzioni corrette, zoom, pan, zoom-to-fit, snap, duplicazione, selezione
  multipla e pannello oggetti.
- Dashboard in corso: modifica evento con vincoli per stato, gestione abilitazione
  utenti superadmin, loading/error globali, panoramica operativa basata sui dati e
  stati vuoti amministrativi completati. Rimossi gli indicatori “live/nominale” finti.
- Configurazioni venue completate con scelta predefinita, archivio, ripristino e
  protezioni per configurazione predefinita/ultima attiva; i nuovi eventi non possono
  usare configurazioni archiviate.
- Verifiche correnti: 44 test control-plane, build TypeScript, test form autenticazione,
  lint e build Next.js superati. Smoke test runtime completato su login, dashboard,
  editor e ciclo predefinita → archivio → ripristino. Il browser grafico isolato non è
  disponibile nella sessione corrente, quindi il gate visuale a 390/768/1440 px resta
  aperto.
- Android modificato soltanto per il logo, su richiesta successiva esplicita: icona
  adattiva/legacy onePixel e release `1.1.6+9`. Nessun altro flusso app è stato
  ispezionato o cambiato in questa fase.

## 1. Obiettivo

Portare onePixel da prototipo funzionante a prodotto modificabile e verificabile,
correggendo prima l'editor delle strutture e poi completando dashboard e app Android
senza perdere i dati e i flussi già funzionanti.

Il piano è stato approvato da Fabio. Le decisioni sugli anelli concentrici, sulla
distribuzione della capienza e sul posizionamento al clic sono ora requisiti confermati.

## 2. Baseline verificata

- Control-plane: build TypeScript riuscita, 7 file di test e 29 test superati.
- Dashboard: lint e build Next.js riusciti, 20 route generate.
- Dashboard: esiste un solo test mirato ai moduli di autenticazione; l'editor non ha
  test automatici.
- Android: `flutter analyze` pulito, 15 test superati e 1 test live/hardware escluso.
- Android corrente: `1.1.5+8`; il documento di verifica e gli artifact descritti nel
  repository sono più vecchi e andranno riallineati.
- Il repository importato non ha commit: tutti i file risultano ancora non tracciati.
  Prima di cambiare il prodotto serve un commit baseline locale, senza segreti e senza
  cache generate.

## 3. Problemi confermati

### 3.1 Editor strutture

- Ogni elemento aggiunto viene creato al centro della tavola per scelta esplicita del
  codice, indipendentemente dal puntatore e dalla porzione visibile.
- I livelli chiamati “anelli” sono soltanto contenitori logici. Il generatore colloca i
  settori dei vari livelli sulle stesse coordinate e l'editor mostra un livello alla
  volta: non esistono veri anelli concentrici visibili dall'alto.
- La generazione può creare livelli vuoti quando il numero di livelli supera il numero
  di settori calcolato.
- La capienza richiesta può non coincidere esattamente con i posti generati per effetto
  degli arrotondamenti righe × posti.
- `preserveAspectRatio="none"` può deformare la pianta e falsare cerchi, distanze e
  coordinate percepite.
- I posti sono disegnati dai bounding box rettangolari, non dalla geometria reale del
  settore.
- La rotazione visuale di un settore non ruota i suoi posti.
- Spostamento e ridimensionamento del settore non trasformano coerentemente gli
  override dei singoli posti.
- Il trascinamento dei vertici su elementi ruotati usa coordinate non compensate.
- Il posto manuale può essere inserito fuori dal settore selezionato.
- La selezione multipla funziona solo con Shift; mancano selezione rettangolare,
  allineamento, distribuzione e trasformazioni di gruppo complete.
- Mancano zoom, pan, zoom-to-fit, snap, griglia metrica controllabile e guide.
- Il comando “nascondi livello” salva il dato ma non governa davvero il rendering.
- Mancano duplicazione rapida, ordine dei livelli grafici, copia/incolla e un elenco
  degli oggetti che permetta di trovare elementi sovrapposti.
- Il componente principale concentra stato, rendering, strumenti, salvataggio e
  pannelli in un unico file, rendendo rischiose le correzioni.

### 3.2 Dashboard

- Il sistema bilingue traduce il DOM dopo il rendering tramite un observer globale;
  è fragile per testo dinamico, attributi e componenti futuri.
- La pagina eventi permette effetti e regia, ma non offre una vera schermata per
  modificare dopo la creazione dati, accessi, date, struttura e copertina.
- Il superadmin vede gli utenti ma non può abilitarli o sospenderli, nonostante la
  specifica lo richieda.
- Le configurazioni venue possono essere duplicate, ma mancano gestione chiara del
  default, eliminazione/archiviazione e confronto/versionamento comprensibile.
- Editor, timeline, wizard, regia e principali flussi dashboard non hanno una suite
  E2E mantenibile che intercetti regressioni reali.
- Diversi testi e artifact descrivono ancora modalità demo o versioni precedenti e
  vanno distinti con chiarezza dalla produzione.

### 3.3 App Android

- Il client realtime effettua una sola connessione: dopo errore o chiusura non esiste
  riconnessione con backoff, recupero sequenza o indicazione di stato dettagliata.
- L'installazione viene registrata al backend con notifiche e posizione abilitate prima
  di conoscere lo stato reale dei permessi Android.
- Mancano una procedura guidata chiara per i permessi e una pagina per modificarli in
  seguito.
- Il core offline è presente, ma va provato su riavvio processo, perdita rete,
  riconnessione e cambio zona con casi automatici e dispositivo reale.
- Home, profilo e coordinamento principale sono componenti molto grandi; errori,
  concorrenza e navigazione sono difficili da isolare.
- Nearby Connections / relay di settore non sono implementati. Sono un'estensione
  separata e non devono essere confusi con il funzionamento offline già presente.
- Google Sign-In, notifiche reali, fotocamera, GPS, torcia e installazione release
  richiedono collaudo su dispositivo e credenziali/configurazioni esterne corrette.

## 4. Decisioni di prodotto aperte

Le decisioni saranno chieste una alla volta.

1. **Visualizzazione anelli — APPROVATA**: il wizard chiede prima quanti anelli possiede
   lo stadio; la pianta mostra poi tutti gli anelli concentrici contemporaneamente,
   con ogni settore selezionabile. La modalità “solo anello attivo” resta disponibile
   come filtro di lavoro, non come unica vista.
2. **Capienza degli anelli — APPROVATA**: onePixel propone una distribuzione automatica
   coerente con tipologia e geometria dello stadio; l'utente può passare a una
   distribuzione uguale oppure modificare manualmente la capienza di ogni anello. La
   somma deve sempre coincidere esattamente con la capienza totale dichiarata.
3. **Settori per anello — APPROVATA**: onePixel propone automaticamente il numero di
   settori in base a tipologia, geometria e capienza; per ogni anello l'utente può
   accettare la proposta oppure inserire il numero reale. I nomi automatici restano
   modificabili.
4. **Forma dello stadio — APPROVATA**: prima di configurare gli anelli il wizard chiede
   la forma reale. Sono previsti modelli ovali, circolari, rettangolari con angoli
   raccordati e una forma personalizzata disegnata o derivata dal confine importato.
   La forma governa anelli, curve, settori e stima della capienza.
5. **Priorità app — APPROVATA**: non controllare o modificare adesso l'app sul telefono.
   Il primo ciclo riguarda editor e dashboard; la stabilizzazione Android resta nel
   goal ma parte soltanto dopo il completamento e la verifica del web.
6. **P2P di settore — RINVIATO**: Nearby Connections e relay appartengono alla fase app
   successiva e non devono rallentare il primo ciclo editor/dashboard.

## 5. Architettura editor proposta

### 5.1 Modello e compatibilità

- Introdurre una nuova revisione del documento venue con migrazione deterministica dal
  formato attuale; nessuna struttura esistente deve sparire o cambiare capienza in
  silenzio.
- Distinguere esplicitamente:
  - elementi condivisi di base, come campo e confine;
  - anelli/livelli;
  - settori appartenenti a un anello;
  - posti generati e override manuali.
- Rappresentare i settori di uno stadio come porzioni di corona circolare reali, con
  raggio interno/esterno, angolo iniziale/finale e poligono derivato.
- Conservare per ogni trasformazione un'unica matrice/coordinata autorevole, usata da
  forma, etichetta, posti, hit-test e salvataggio.
- Migrare e validare i documenti legacy lato protocollo e backend prima del rendering.

### 5.2 Generatore stadio

- Wizard che raccoglie prima la struttura reale dello stadio: nome, dimensioni utili,
  forma, numero di anelli, settori per anello, corridoi principali, capienza totale e
  distribuzione modificabile. Il numero di anelli non viene dedotto dalla capienza.
- Offrire forme iniziali ovali, circolari e rettangolari raccordate, oltre alla forma
  personalizzata disegnata o derivata dal confine importato. Tutte restano modificabili.
- Dopo la scelta del numero di anelli, mostrare una configurazione dedicata a ciascun
  anello prima di generare la pianta definitiva.
- Partire dalla capienza totale e proporre per ogni anello una quota calcolata dalla
  geometria utile e dalla tipologia scelta. Offrire anche “distribuisci in parti uguali”
  e modifica manuale; visualizzare sempre totale assegnato, residuo e validazione.
- Proporre anche il numero di settori per anello, consentendo di sostituirlo con il dato
  reale prima della generazione. Aggiornare in tempo reale capienza media, righe e posti
  stimati per settore.
- Generare fasce concentriche proporzionate, non rettangoli sovrapposti.
- Distribuire esattamente la capienza richiesta, assegnando l'eventuale resto in modo
  deterministico.
- Creare curve, tribune e settori coerenti con la tipologia, mantenendo campo e riferimenti
  condivisi visibili.
- Consentire la rigenerazione come nuova configurazione/versione, senza distruggere la
  configurazione approvata.

### 5.3 Inserimento e selezione

- Clic su uno strumento → anteprima agganciata al puntatore → clic sulla tavola per
  posizionare. Nessun inserimento implicito al centro.
- Drag dalla palette come interazione opzionale desktop; su touch resta il flusso
  strumento → tocco.
- Escape annulla; Invio conferma; duplicazione mantiene un offset visibile e prevedibile.
- Selezione singola, aggiuntiva, rettangolare e “seleziona tutto nell'anello”.
- Pannello oggetti per selezionare elementi nascosti o sovrapposti.
- Movimento di gruppo, allinea, distribuisci, duplica, blocca, nascondi e cambia anello.

### 5.4 Tavola e trasformazioni

- Viewport con zoom al puntatore, pan, zoom-to-fit, reset e coordinate mondo/schermo
  centralizzate.
- Proporzioni geometriche sempre preservate; bande libere laterali non alterano le
  misure.
- Griglia metrica, snap configurabile, guide dinamiche e indicazione X/Y/dimensioni.
- Maniglie di spostamento, ridimensionamento, rotazione e vertici con target adeguati
  anche su touch.
- Ogni trasformazione aggiorna forma e posti nello stesso comando undo/redo.
- Limiti e warning fuori confine visibili, senza cancellazioni automatiche.

### 5.5 Stato, salvataggio e struttura del codice

- Separare motore geometrico puro, reducer/comandi, viewport, rendering SVG/canvas,
  palette, livelli e inspector.
- Un'azione utente equivale a un comando nella cronologia; digitare un nome non deve
  creare decine di passaggi undo.
- Bozza locale di sicurezza e avviso uscita; salvataggio server esplicito con stato
  `salvataggio / salvato / errore` e possibilità di riprovare.
- Nessuna nuova libreria grafica finché SVG + canvas esistenti soddisfano prestazioni e
  accessibilità; eventuali dipendenze saranno motivate e approvate.

## 6. Fasi di realizzazione

Ordine approvato per il lavoro: **editor → dashboard → app Android → P2P opzionale**.
Non si eseguono controlli sul telefono durante il primo ciclo.

### Fase 0 — Protezione e baseline

- Ripulire soltanto metadati/macOS e artefatti rigenerabili dalla futura baseline.
- Verificare che `.env.local`, chiavi e cache restino esclusi.
- Creare il primo commit locale e un tag/archivio di rollback.
- Salvare output dei test correnti come baseline.

**Gate:** ripristino provato e albero sorgente pulito.

### Fase 1 — Contratti, geometria e migrazione

- Definire documento venue revisionato, parser e migrazione legacy.
- Implementare primitive geometriche pure per anelli, settori, trasformazioni e posti.
- Aggiungere test unitari prima di collegare la UI.
- Aggiornare API e persistenza mantenendo lettura delle venue esistenti.

**Gate:** migrazione idempotente, capienza invariata, round-trip JSON e test geometria
superati.

### Fase 2 — Nuovo generatore stadio/anelli

- Implementare wizard e generatore concentrico.
- Vista composita con tutti gli anelli concentrici visibili e selezionabili; filtro
  facoltativo per lavorare su un solo anello.
- Distribuzione esatta della capienza e contesto condiviso campo/confine.
- Anteprima prima della sostituzione e salvataggio come nuova configurazione.

**Gate:** fixture con almeno 1, 2, 3 e 5 anelli; nessun settore vuoto o sovrapposizione
involontaria; capienza esatta.

### Fase 3 — Interazioni professionali dell'editor

- Click-to-place, zoom/pan, snap, griglia, selezione ad area e pannello oggetti.
- Trasformazioni coerenti di settori e posti, inclusa rotazione.
- Allineamento, distribuzione, duplicazione, copia/incolla, livelli e visibilità.
- Undo/redo a comandi e salvataggio robusto.
- Rifattorizzazione del componente monolitico in moduli testabili.

**Gate:** test di componente per ogni interazione critica e scenari mouse/touch senza
regressioni sui dati.

### Fase 4 — Completamento dashboard

- Modifica completa di un evento esistente con regole legate allo stato pubblicato/live.
- Gestione utenti superadmin, configurazioni venue e stati operativi mancanti.
- Sostituire la traduzione via DOM con dizionari/componenti tipizzati e fallback chiari.
- Stati loading, vuoto, errore e retry coerenti; accessibilità tastiera e testi leggibili.
- Suite E2E dei flussi organizzazione e superadmin.

**Gate:** flussi create/edit/publish/live/stop/report e amministrazione verificati in
italiano e inglese a 390, 768 e 1440 px.

### Fase 5 — Stabilizzazione app Android (dopo editor e dashboard)

- Separare sessione, navigazione, permessi, discovery, join e realtime in controller
  testabili.
- Introdurre onboarding permessi con consenso reale e sincronizzazione backend corretta.
- Realtime con riconnessione esponenziale, jitter, recupero sicuro e fallback offline.
- Rafforzare ripristino pacchetto, errori download, spazio insufficiente e checksum.
- Completare test widget/integration per anonimo, account, QR, GPS, notifiche, lingua,
  tema e accessibilità.

**Gate:** analyze/test puliti, APK firmato, installazione su Pixel e prove modalità aereo,
riavvio app, perdita/ritorno rete, fotocamera, GPS, vibrazione e torcia.

### Fase 6 — Integrazione e collaudo evento

- Ambiente locale riproducibile con dati demo aggiornati e almeno uno stadio realistico.
- Prova end-to-end dashboard → venue → evento → QR → app → pacchetto → regia → report.
- Test carico con più settori/anelli e migliaia di posti senza creare un nodo DOM per
  ogni posto.
- Controlli sicurezza, isolamento organizzazioni, audit e backup/ripristino.
- Aggiornare specifica, architettura, operazioni e documento di verifica con evidenze
  correnti.

**Gate:** matrice requisiti coperta da prove, nessun punto critico basato solo su
ispezione visiva o dichiarazioni.

### Fase 7 — Release e distribuzione

- Deploy dashboard/API su ambiente di collaudo, smoke test e verifica log.
- APK release con versione nuova, firma, SHA-256 e URL backend HTTPS.
- Rollout controllato, monitoraggio e rollback documentato.
- P2P/relay di settore solo se incluso esplicitamente nella decisione di prodotto.

**Gate:** URL pubblici, artifact e stato dispositivo verificati; nessun segreto nei log o
nel repository.

## 7. Strategia di test minima

### Editor

- Inserimento nel punto cliccato a zoom 50%, 100% e 250%.
- Nessun elemento nuovo sovrapposto involontariamente al centro.
- Traslazione, scala e rotazione mantengono forma, posti e override coerenti.
- Undo/redo ripristina esattamente un'azione completa.
- Livello nascosto/bloccato e filtro anello rispettati.
- Generatore: capienza esatta e geometria valida per più configurazioni.
- Migrazione dei documenti attuali senza perdita.

### Dashboard

- Login/registrazione/sessione HttpOnly e autorizzazioni per ruolo.
- Creazione e modifica venue/evento, upload, QR, timeline, live, stop e report.
- Isolamento tra organizzazioni e azioni superadmin.
- IT/EN, tastiera, focus, errori e viewport principali.

### Android

- Avvio anonimo, account facoltativo e uscita account senza perdere il core anonimo.
- Permessi negati, temporanei e concessi dalle impostazioni.
- QR valido/scaduto/revocato, GPS dentro/fuori zona e precedenza QR.
- Download interrotto, checksum errato, riavvio offline e memoria insufficiente.
- WebSocket perso e recuperato senza duplicare comandi.
- Timeline e effetti con orologio corretto, stop di emergenza e preferenze utente.

## 8. Definizione di completamento

Il rilancio non è completato quando “la build passa”. È completato soltanto quando:

- ogni requisito approvato ha un test o una prova runtime identificabile;
- i dati venue esistenti sono migrati e verificati;
- editor, dashboard e app sono stati provati nei flussi reali concordati;
- il Pixel esegue l'APK corrente e il package/versione sono verificati;
- dashboard e API di collaudo rispondono e i log non mostrano errori critici;
- documentazione e artifact descrivono la versione realmente consegnata;
- esiste un rollback verificato.
