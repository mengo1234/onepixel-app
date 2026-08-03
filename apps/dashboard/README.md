# onePixel Control

Dashboard Next.js per organizzazioni e super amministratore. Tutte le
operazioni passano dal BFF autenticato: il token backend resta in un cookie
HttpOnly e non è esposto al JavaScript del browser.

```bash
npm ci
ONEPIXEL_API_URL=http://127.0.0.1:4100 npm run lint
ONEPIXEL_API_URL=http://127.0.0.1:4100 npm run build
ONEPIXEL_API_URL=http://127.0.0.1:4100 npm run dev
```

La dashboard include registrazione autonoma, checkout 3/7/19 euro, editor 2D
metrico con livelli/file/posti/configurazioni e catasto, wizard per stadi,
concerti, manifestazioni e cortei, accessi QR/GPS/capofila, timeline, emissione
QR settore/posto in CSV/PDF, regia live, profilo organizzazione, report e viste
super amministratore.
