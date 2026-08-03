# onePixel Android

App Flutter Android senza account. Scopre un evento nelle vicinanze, accetta
soltanto QR onePixel firmati, verifica e salva il pacchetto offline, poi esegue
colori, testo, audio, vibrazione e torcia sulla timeline locale.

```bash
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=ONEPIXEL_API_URL=http://192.168.1.10:4100
```

Per una release firmata:

```bash
export ONEPIXEL_KEYSTORE_PATH=/percorso/release.jks
export ONEPIXEL_KEYSTORE_PASSWORD='...'
export ONEPIXEL_KEY_ALIAS=onepixel
export ONEPIXEL_KEY_PASSWORD='...'
flutter build apk --release \
  --dart-define=ONEPIXEL_API_URL=https://api.example.com
```

`../../scripts/create-release-keystore.sh` può creare una chiave locale. Non
versionare mai keystore o password. Italiano e inglese seguono la lingua di
Android; posizione, audio, notifiche e torcia restano soggetti ai permessi del
partecipante.
