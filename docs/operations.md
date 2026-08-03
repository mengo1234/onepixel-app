# Operazioni

## Avvio con container

1. Genera un segreto casuale di almeno 32 caratteri e impostalo come
   `ONEPIXEL_QR_SECRET`.
2. Mantieni `ONEPIXEL_DEMO_SEED=false` fuori dallo sviluppo.
3. Copia `deploy.env.example` in `deploy.env`, sostituisci tutti i valori di
   esempio e verifica senza mostrare i segreti:

   ```bash
   ./scripts/verify-production-env.sh deploy.env
   ```

4. Avvia `docker compose --env-file deploy.env up -d --build`.
5. Pubblica dashboard e API dietro HTTPS; l'app Android di produzione deve
   essere compilata con l'URL HTTPS e cleartext disabilitato.

Il compose inoltra esplicitamente al control-plane modalità pagamento, chiave
Stripe, segreto webhook e client OAuth Google. Il verificatore rifiuta valori
placeholder, origine/API/dashboard non HTTPS, cookie non sicuri o seed demo.

PGlite rende questa installazione autosufficiente su un singolo nodo. Per più
nodi o eventi molto grandi, migrare le stesse tabelle a PostgreSQL gestito e il
fan-out WebSocket a un broker condiviso prima di scalare orizzontalmente.

## Backup

Arresta il control-plane per ottenere uno snapshot consistente, poi:

```bash
cd services/control-plane
ONEPIXEL_DATABASE=./.data/postgres \
ONEPIXEL_STORAGE=./.data/storage \
npm run backup -- /percorso/backup-onepixel-2026-07-30
```

Il backup contiene database, media e un `manifest.json` con SHA-256. La cartella
di destinazione deve essere nuova o vuota.

## Ripristino

Il ripristino rifiuta database o storage di destinazione non vuoti e verifica
l'impronta prima di scrivere:

```bash
npm run restore -- \
  /percorso/backup-onepixel-2026-07-30 \
  /percorso/nuovo-postgres \
  /percorso/nuovo-storage
```

Avvia il servizio indicando le due nuove directory, controlla `/health`, prova
il login e risolvi un QR di collaudo prima di spostare il traffico.

## Sicurezza operativa

- Ruota il segreto QR richiedendo la rigenerazione dei QR ancora attivi.
- Conserva chiave Android e password fuori dal repository.
- Limita CORS con `ONEPIXEL_ALLOWED_ORIGINS`.
- Mantieni i media immutabili e servili tramite HTTPS/CDN in produzione.
- Esporta e conserva gli audit log secondo il contratto con l'organizzazione.
