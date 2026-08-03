# Architettura onePixel

## Componenti

- `apps/mobile`: Flutter Android, cache offline, scanner, mappa, profilo e riproduzione della timeline.
- `apps/dashboard`: Next.js BFF per organizzazioni e super amministratore; conserva il token server in cookie HttpOnly.
- `services/control-plane`: Fastify, PGlite persistente, WebSocket, Stripe, verifica Google ID token, catasto, QR, media e audit.
- `packages/protocol`: documenti venue v2, policy di accesso, cue e manifest.
- `apps/share`: landing bilingue e APK pubblico.

## Sincronizzazione

1. Il dispositivo entra con QR firmato, geofence fisso o raggio mobile.
2. Il backend crea un join firmato e restituisce zona, posto, manifest, asset e timeline con hash.
3. L'app salva il pacchetto e misura l'offset dell'orologio server.
4. I cue vengono eseguiti localmente su una base temporale monotona; il realtime trasporta soltanto start, cue live, sync, stop e presenza.
5. Se la rete cade, l'app continua l'ultima timeline valida; GPS e capofila mantengono l'ultima zona/posizione valida.

## Accesso e posizione

- Il QR contiene `eventId`, `zoneId`, eventuale `seatId`, scadenza e identificativo revocabile. Dopo un join QR la zona è bloccata.
- Il geofence verifica una geometria GeoJSON e assegna una macro-zona soltanto dopo `dwellSeconds`, evitando cambi al confine.
- Il raggio mobile usa l'ultima posizione del capofila. Serve per l'aggancio, non per espellere partecipanti già entrati.
- Le installazioni anonime hanno un ID locale; un account partecipante può collegare più installazioni e salvare eventi.

## Pagamenti

- Checkout Stripe reale in produzione; modalità mock esclusivamente fuori produzione per test locali.
- Ogni checkout pagato genera un record consumabile una sola volta.
- La transazione di creazione/upgrade blocca e consuma il pagamento, impedendo riuso e gare concorrenti.
- Il webhook Stripe usa raw body e verifica la firma.

## Catasto ed editor

La dashboard interroga il servizio cartografico ufficiale dell'Agenzia delle Entrate, normalizza Polygon/MultiPolygon, mantiene i metadati della particella e proietta una copia nella tavola metrica. Il documento venue v2 contiene livelli, elementi, file/posti, confine e fonti catastali; l'evento ne salva uno snapshot.

## Scalabilità

L'installazione locale usa PGlite e storage file immutabile. Per produzione multi-nodo: PostgreSQL gestito, object storage/CDN, Redis o broker per presenza e fan-out, gateway WebSocket orizzontale e worker separati per media. Il protocollo non invia frame continui: migliaia di telefoni scaricano un pacchetto e ricevono pochi comandi realtime.
