# onePixel

onePixel coordina gli schermi Android del pubblico durante stadi, concerti,
palazzetti, manifestazioni, aggregazioni e cortei. Ogni dispositivo scarica in anticipo una sequenza firmata
e la esegue localmente su una timeline sincronizzata, continuando anche quando
la rete dell'evento rallenta.

## Progetti

- `apps/mobile`: app Android Flutter con account facoltativo, mappa, QR e GPS.
- `apps/dashboard`: dashboard Next.js per organizzazioni e super amministratore.
- `services/control-plane`: API, realtime e pianificatore degli eventi.
- `packages/protocol`: contratti condivisi per venue, timeline e telemetria.
- `assets/generated`: asset approvati prodotti con ImageGen.

## Stato

Piattaforma operativa end-to-end: dashboard autenticata, pagamenti per evento,
database persistente, editor 2D venue v2, catasto, QR/GPS, pacchetti offline,
regia WebSocket e APK Android firmato. I
dati demo vengono creati soltanto quando `ONEPIXEL_DEMO_SEED=true`.

## Avvio locale

Servono Node.js 20+, Flutter 3.41+, Android SDK e `ffmpeg`.

```bash
cd services/control-plane
npm ci
ONEPIXEL_DEMO_SEED=true npm start

cd ../../apps/dashboard
npm ci
ONEPIXEL_API_URL=http://127.0.0.1:4100 npm run dev
```

Apri `http://127.0.0.1:3000`. Credenziali demo:

- super amministratore: `admin@onepixel.local` / `OnePixel!2026`
- organizzazione: `regia@arenanord.it` / `Arena!2026`

Le credenziali sono solo per sviluppo e non vengono create in produzione.

## Android

```bash
cd apps/mobile
flutter run --dart-define=ONEPIXEL_API_URL=http://IP-DEL-SERVER:4100
```

La build release richiede le variabili di firma descritte in
`apps/mobile/README.md`. L'APK 1.1.1 verificato si trova in
`artifacts/onePixel-android-1.1.1.apk` ed è pubblicato su
<https://mengo1234.github.io/onepixel-app/>.

## Produzione e recupero

`compose.yaml` avvia dashboard e control-plane con volume persistente. Copia
`deploy.env.example`, sostituisci il segreto QR e usa TLS davanti alle porte
pubbliche. Backup e ripristino sono documentati in `docs/operations.md`.

I risultati dei test e i limiti dell'ambiente sono in `docs/verification.md`.
