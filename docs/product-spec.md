# Specifica prodotto onePixel

## Partecipante Android

- Home bilingue IT/EN con evento vicino, mappa, GPS, QR centrale, notifiche e demo offline.
- Account facoltativo via email/password o Google; QR, GPS e coreografia funzionano anche da anonimo.
- Profilo con nome, foto, tema sistema/chiaro/scuro, lingua, eventi salvati, storico e biglietti.
- Entrata con uno qualsiasi dei metodi consentiti: QR, geofence fisso o raggio mobile del capofila.
- Il QR assegna settore/posto con precisione e prevale su successive variazioni GPS; il GPS assegna macro-zone dopo il tempo di permanenza previsto.
- Timeline offline con colore, testo, vibrazione, torcia e audio. Audio e torcia restano scelte del partecipante quando la regia li abilita.

## Organizzazione

- Dashboard bilingue IT/EN con selettore persistente su tutte le viste operative e superadmin.
- Funnel pubblico dimostrativo accesso → pagamento fake → dashboard, separato dai dati reali e privo di addebiti.
- Registrazione autonoma di un singolo amministratore per organizzazione.
- Pagamento prima della creazione, una volta per evento: piccolo fino a 500 partecipanti a 3 euro, medio fino a 5.000 a 7 euro, grande oltre 5.000 a 19 euro.
- Il superamento del limite blocca nuovi ingressi finché non viene acquistato e consumato un upgrade.
- Procedura guidata per sport, concerti, festival, manifestazioni, aggregazioni, cortei, fiere, eventi civici o temporanei.
- Visibilità pubblica/privata e combinazione libera di QR, area GPS fissa e raggio mobile.
- Logo e colore organizzazione, copertina evento, programma, descrizione, emissione QR singola o massiva CSV/PDF, regia live e report.

## Editor universale 2D

- Stadio, palazzetto, concerto, piazza, spazio aperto, fiera o pianta libera.
- Configurazione iniziale guidata da tipologia, capienza e numero di livelli.
- Livelli/anelli illimitati; tribune, curve, settori, blocchi, campi, palchi, passerelle, ingressi, uscite, corridoi, barriere, aree tecniche, in piedi, accessibili e forme libere.
- Unità metriche, vertici modificabili, rotazione, trascinamento, selezione multipla, undo/redo, file dritte o curve, posti generati e override del singolo posto.
- Configurazioni/versioni multiple della stessa struttura e snapshot immutabile nel singolo evento.
- Selezione da mappa e catasto ufficiale, unione di più particelle, proiezione nella tavola metrica e modifica della copia importata.
- Gli elementi fuori dal confine producono un avviso ma non vengono eliminati automaticamente.

## Cortei e aree mobili

- Un solo amministratore capofila con posizione continua dal telefono usato per la dashboard.
- I partecipanti si agganciano quando entrano nel raggio iniziale e restano iscritti anche quando si allontanano; l'ultima posizione valida del capofila resta disponibile se il segnale cade.
- Percorso pianificato facoltativo; il raggio reale resta centrato sul capofila.

## Super amministratore

- Vista organizzazioni, utenti, pagamenti ed eventi.
- Abilitazione/sospensione di organizzazioni e utenti, tracciamento consumo dei pagamenti e arresto degli eventi.

## Vincoli

- Il pacchetto già scaricato continua offline.
- Nessuna cronologia personale di posizione; si conserva soltanto lo stato operativo necessario a ingresso, macro-zona e capofila.
- Dati organizzazione isolati per `organizationId`, sessioni dashboard HttpOnly, QR firmati e audit delle operazioni sensibili.
