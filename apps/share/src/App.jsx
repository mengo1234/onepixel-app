import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Buildings,
  Check,
  DownloadSimple,
  FlagBanner,
  GlobeHemisphereWest,
  MapPin,
  Megaphone,
  QrCode,
  ShieldCheck,
  SpeakerHigh,
  SquaresFour,
  UsersThree,
} from '@phosphor-icons/react'

const downloadUrl = `${import.meta.env.BASE_URL}onePixel-android.apk`
const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL || 'https://onepixel-regia.vercel.app/login'
const registerUrl = import.meta.env.VITE_REGISTER_URL || 'https://onepixel-regia.vercel.app/register'

const copy = {
  it: {
    nav: ['Funzioni', 'Cortei', 'Demo'], login: 'Dashboard',
    eyebrow: 'Una folla. Un solo segnale.', titleA: 'Ogni telefono.', titleB: 'Un pixel vivo.',
    intro: 'Coreografie, cori, audio e segnali sincronizzati per stadi, palazzetti, concerti, piazze e cortei. Il pubblico entra con QR o GPS. La regia decide il resto.',
    orgCta: 'Crea un evento', appCta: 'Scarica l’app Android', noAccount: 'L’app funziona anche senza account',
    live: 'REGIA LIVE', ready: 'dispositivi pronti', section: 'Settore / zona assegnata',
    flowEye: 'Dall’idea al pubblico', flowTitle: 'Costruisci lo spazio.\nAccendi le persone.',
    flow: [
      ['Disegna', 'Crea stadi, palchi, tribune, curve, anelli, file e singoli posti in un editor 2D metrico.'],
      ['Posiziona', 'Seleziona il lotto dalla mappa o dal catasto, unisci particelle e modifica la copia importata.'],
      ['Scegli l’accesso', 'QR preciso per settore o posto, GPS per macro-area, oppure percorso mobile con tappe programmate.'],
      ['Vai live', 'Programma colori, testo, vibrazione, torcia e audio; poi controlla tutto dalla regia.'],
    ],
    flowAlt: ['Arena digitale con anelli, palco, file e singoli posti', 'Arena posizionata dentro un confine catastale modificabile', 'Accesso evento tramite QR, geofence GPS e capofila mobile', 'Regia che sincronizza luci e telefoni di tutta la folla'],
    contextsEye: 'Non solo stadi', contextsTitle: 'Qualunque folla può diventare parte dello spettacolo.',
    contexts: [['Sport', 'Stadi, palazzetti, curve e tribune'], ['Musica', 'Concerti, festival e palchi temporanei'], ['Città', 'Manifestazioni, aggregazioni e piazze'], ['In movimento', 'Cortei con capofila e raggio mobile']],
    accessEye: 'Accesso flessibile', accessTitle: 'L’organizzatore sceglie come si entra.',
    accessCards: [
      ['QR', 'Esatto fino al singolo posto. Se è presente, ha sempre la priorità.'],
      ['GPS fisso', 'Ingresso automatico nell’area evento e assegnazione alla macro-zona.'],
      ['GPS mobile', 'Per i cortei: percorso tracciato, ingresso vicino al gruppo e posizione aggiornata durante il movimento.'],
    ],
    processionEye: 'Cortei programmabili', processionTitle: 'Traccia il percorso.\nPianifica ciò che accade.', processionText: 'Prima dell’evento disegni il tragitto e prepari le azioni. Durante il corteo la regia può aggiornare tutto senza interrompere il pubblico.',
    processionSteps: [
      ['Percorso', 'Segna partenza, arrivo, deviazioni e punti importanti direttamente sulla mappa.'],
      ['Automazioni', 'Programma colori, messaggi, audio e vibrazioni per orario, tappa o distanza.'],
      ['Regia live', 'Sposta una tappa, anticipa un’azione o invia un segnale immediato mentre il corteo avanza.'],
    ],
    processionMap: 'Anteprima del percorso del corteo con partenza, tappa programmata e posizione live', processionStart: 'PARTENZA', processionStage: 'TAPPA 02', processionLive: 'LIVE', processionCta: 'Configura un corteo',
    pricingEye: 'Prova senza rischi', pricingTitle: 'Tutto il flusso. Zero addebiti.', pricingText: 'La modalità attuale è una demo completa: nessuna carta e nessun addebito. Scegli la capienza e prova subito la creazione guidata.',
    tiers: [['Piccolo', 'Fino a 500 persone', '3 €'], ['Medio', 'Fino a 5.000 persone', '7 €'], ['Grande', 'Oltre 5.000 persone', '19 €']], features: ['QR + GPS', 'Editor completo', 'Regia live'], payFirst: 'MODALITÀ MOCK · NESSUNA CARTA O ADDEBITO', perEvent: '/ evento demo', start: 'Prova dalla dashboard',
    installEye: 'Per il pubblico', installTitle: 'Entra. Inquadra.\nDiventa la scena.', installText: 'Mappa eventi vicini, scanner QR sempre a portata di mano, notifiche, profilo facoltativo e modalità demo offline.',
    scan: 'Scansiona per scaricare', direct: 'Download diretto APK', release: 'ANDROID 1.1.5 · 77 MB', alpha: 'APK firmato per Android 7 o successivo. Android potrebbe chiedere di autorizzare l’installazione dal browser.',
    installSteps: [['01', 'Scarica', 'Tocca il pulsante o inquadra il QR.'], ['02', 'Autorizza', 'Consenti al browser di installare app.'], ['03', 'Apri onePixel', 'Non serve creare un account.']],
    releaseEye: 'ULTIMA RELEASE', releaseTitle: 'Versione 1.1.5', releaseNotes: ['Nuovo spazio semicircolare attorno al QR', 'Navigazione Home e Profilo più chiara', 'Tema chiaro e scuro verificati su Android'],
    footer: 'Sincronizzazione dal vivo per luoghi e folle di ogni forma.',
  },
  en: {
    nav: ['Features', 'Marches', 'Demo'], login: 'Dashboard',
    eyebrow: 'One crowd. One signal.', titleA: 'Every phone.', titleB: 'One living pixel.',
    intro: 'Synchronized choreographies, chants, audio and signals for stadiums, arenas, concerts, squares and marches. The audience joins by QR or GPS. The control room handles the rest.',
    orgCta: 'Create an event', appCta: 'Download Android app', noAccount: 'The app also works without an account',
    live: 'LIVE CONTROL', ready: 'devices ready', section: 'Assigned section / zone',
    flowEye: 'From idea to audience', flowTitle: 'Build the space.\nLight up the people.',
    flow: [
      ['Design', 'Create stadiums, stages, stands, rings, rows and individual seats in a metric 2D editor.'],
      ['Place it', 'Select the plot from map or cadastre, combine parcels and edit the imported copy.'],
      ['Choose access', 'Precise QR for section or seat, GPS for macro areas, or a moving route with scheduled stops.'],
      ['Go live', 'Program colours, text, vibration, torch and audio, then control everything live.'],
    ],
    flowAlt: ['Digital venue with rings, stage, rows and individual seats', 'Venue positioned inside an editable cadastral boundary', 'Event access through QR, GPS geofence and mobile leader', 'Control room synchronizing lights and every phone in the crowd'],
    contextsEye: 'Beyond stadiums', contextsTitle: 'Any crowd can become part of the show.',
    contexts: [['Sport', 'Stadiums, arenas, curves and stands'], ['Music', 'Concerts, festivals and temporary stages'], ['City', 'Demonstrations, gatherings and squares'], ['On the move', 'Marches with a leader and mobile radius']],
    accessEye: 'Flexible access', accessTitle: 'The organiser chooses how people join.',
    accessCards: [['QR', 'Accurate down to a single seat. When present, it always takes priority.'], ['Fixed GPS', 'Automatic entry inside the event area and macro-zone assignment.'], ['Mobile GPS', 'For marches: a traced route, entry near the group and live position updates while moving.']],
    processionEye: 'Programmable marches', processionTitle: 'Trace the route.\nPlan what happens.', processionText: 'Draw the route and prepare every action before the event. During the march, the control room can update everything without interrupting the audience.',
    processionSteps: [
      ['Route', 'Mark the start, finish, diversions and key points directly on the map.'],
      ['Automations', 'Schedule colours, messages, audio and vibration by time, stop or distance.'],
      ['Live control', 'Move a stop, bring an action forward or send an instant signal while the march is moving.'],
    ],
    processionMap: 'March route preview with start, scheduled stop and live position', processionStart: 'START', processionStage: 'STOP 02', processionLive: 'LIVE', processionCta: 'Configure a march',
    pricingEye: 'Try it risk-free', pricingTitle: 'The full flow. Zero charges.', pricingText: 'The current mode is a complete demo: no card and no charge. Choose a capacity and immediately try guided event creation.',
    tiers: [['Small', 'Up to 500 people', '€3'], ['Medium', 'Up to 5,000 people', '€7'], ['Large', 'Over 5,000 people', '€19']], features: ['QR + GPS', 'Full editor', 'Live control room'], payFirst: 'MOCK MODE · NO CARD OR CHARGE', perEvent: '/ demo event', start: 'Try the dashboard',
    installEye: 'For the audience', installTitle: 'Join. Scan.\nBecome the scene.', installText: 'Nearby event map, QR scanner always at hand, notifications, optional profile and an offline demo.',
    scan: 'Scan to download', direct: 'Direct APK download', release: 'ANDROID 1.1.5 · 77 MB', alpha: 'Signed APK for Android 7 or later. Android may ask you to allow installations from the browser.',
    installSteps: [['01', 'Download', 'Tap the button or scan the QR code.'], ['02', 'Allow', 'Let the browser install applications.'], ['03', 'Open onePixel', 'No account is required.']],
    releaseEye: 'LATEST RELEASE', releaseTitle: 'Version 1.1.5', releaseNotes: ['New semicircular space around the QR button', 'Clearer Home and Profile navigation', 'Light and dark themes verified on Android'],
    footer: 'Live synchronization for venues and crowds of every shape.',
  },
}

function PixelMark() {
  return <span className="brand" aria-label="onePixel"><span className="pixel-mark" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span><span>onePixel</span></span>
}

function App() {
  const [lang, setLang] = useState('it')
  const legacyPortal = new URLSearchParams(window.location.search).get('portal') === '1'
  const t = copy[lang]
  useEffect(() => {
    if (legacyPortal) window.location.replace(dashboardUrl)
  }, [legacyPortal])
  if (legacyPortal) return <main className="legacy-redirect" aria-live="polite">Apertura della regia onePixel…</main>
  return (
    <main>
      <header className="site-header shell">
        <PixelMark />
        <nav aria-label="Main navigation">
          <a href="#funziona">{t.nav[0]}</a><a href="#cortei">{t.nav[1]}</a><a href="#prezzi">{t.nav[2]}</a>
        </nav>
        <div className="header-actions">
          <button className="language" onClick={() => setLang(lang === 'it' ? 'en' : 'it')} aria-label="Change language"><GlobeHemisphereWest size={16} /> {lang.toUpperCase()}</button>
          <a className="header-cta" href={dashboardUrl}>{t.login} <ArrowRight size={15} weight="bold" /></a>
        </div>
      </header>

      <section className="hero shell">
        <div className="hero-copy reveal reveal-1">
          <p className="eyebrow"><span /> {t.eyebrow}</p>
          <h1>{t.titleA}<br /><em>{t.titleB}</em></h1>
          <p className="lede">{t.intro}</p>
          <div className="hero-actions"><a className="button signal" href={registerUrl}>{t.orgCta}<ArrowRight size={19} weight="bold" /></a><a className="button ghost" href="#installa">{t.appCta}<ArrowDown size={18} weight="bold" /></a></div>
          <p className="micro-proof"><Check size={14} weight="bold" /> {t.noAccount}</p>
        </div>
        <div className="hero-visual reveal reveal-2">
          <img className="stadium-art" src={`${import.meta.env.BASE_URL}onepixel-stadium-transparent-v2.png`} alt="" />
          <div className="phone-shell"><div className="phone-speaker" /><img src={`${import.meta.env.BASE_URL}onepixel-show-pixel.png`} alt="onePixel live choreography screen" /></div>
          <div className="live-card"><small><span /> {t.live}</small><strong>24.891</strong><p>{t.ready}</p></div>
          <div className="zone-card"><QrCode size={18} /><span><small>{t.section}</small><strong>N1 · FILA 18 · 42</strong></span></div>
        </div>
      </section>

      <div className="signal-band"><div><span>COLORE</span><i /><span>VIBRAZIONE</span><i /><span>TORCIA</span><i /><span>AUDIO</span><i /><span>GPS</span><i /><span>QR</span><i /><span>OFFLINE</span></div></div>

      <section className="workflow shell" id="funziona">
        <header className="section-head"><div><p className="eyebrow"><span /> {t.flowEye}</p><h2>{t.flowTitle.split('\n').map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}</h2></div><p>onePixel studio</p></header>
        <div className="flow-grid">{t.flow.map(([title, body], index) => <article key={title}><b>0{index + 1}</b><div className="flow-media"><img loading="lazy" src={`${import.meta.env.BASE_URL}${['workflow-design-v1.webp', 'workflow-position-v1.webp', 'workflow-access-v1.webp', 'workflow-live-v1.webp'][index]}`} alt={t.flowAlt[index]} /><div className="flow-icon">{[<SquaresFour />, <MapPin />, <QrCode />, <SpeakerHigh />][index]}</div></div><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="contexts shell" id="organizzatori">
        <div className="context-copy"><p className="eyebrow"><span /> {t.contextsEye}</p><h2>{t.contextsTitle}</h2></div>
        <div className="context-side"><div className="context-grid">{t.contexts.map(([title, body], i) => <article key={title}><span>{[<FlagBanner />, <Megaphone />, <Buildings />, <UsersThree />][i]}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div><img className="concert-art" src={`${import.meta.env.BASE_URL}onepixel-concert-transparent-v1.png`} alt="" /></div>
      </section>

      <section className="access shell">
        <div className="access-art"><img src={`${import.meta.env.BASE_URL}onepixel-stadium-transparent-v2.png`} alt="Synchronized stadium seen from above" /></div>
        <div className="access-copy"><p className="eyebrow"><span /> {t.accessEye}</p><h2>{t.accessTitle}</h2><div className="access-list">{t.accessCards.map(([title, body], i) => <article key={title}><b>{['01', '02', '03'][i]}</b><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></div>
      </section>

      <section className="procession shell" id="cortei">
        <div className="route-map" role="img" aria-label={t.processionMap}>
          <div className="route-grid" aria-hidden="true" />
          <svg viewBox="0 0 620 520" aria-hidden="true">
            <path className="route-shadow" d="M68 421 C150 390 135 298 226 286 S344 336 382 242 S458 93 557 104" />
            <path className="route-line" d="M68 421 C150 390 135 298 226 286 S344 336 382 242 S458 93 557 104" />
            <circle className="route-point start" cx="68" cy="421" r="12" />
            <circle className="route-point stage" cx="226" cy="286" r="12" />
            <circle className="route-point live" cx="382" cy="242" r="16" />
            <circle className="route-point end" cx="557" cy="104" r="12" />
          </svg>
          <span className="route-label route-label-start">{t.processionStart}</span>
          <span className="route-label route-label-stage">{t.processionStage}</span>
          <span className="route-label route-label-live"><i /> {t.processionLive}</span>
          <aside className="route-control"><small>{t.processionLive}</small><strong>03 / 07</strong><span>{lang === 'it' ? 'azioni completate' : 'actions completed'}</span></aside>
        </div>
        <div className="procession-copy">
          <p className="eyebrow"><span /> {t.processionEye}</p>
          <h2>{t.processionTitle.split('\n').map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}</h2>
          <p className="procession-intro">{t.processionText}</p>
          <div className="procession-list">{t.processionSteps.map(([title, body], i) => <article key={title}><b>0{i + 1}</b><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
          <a className="button signal procession-cta" href={registerUrl}>{t.processionCta}<ArrowRight size={19} weight="bold" /></a>
        </div>
      </section>

      <section className="pricing shell" id="prezzi">
        <div className="pricing-head"><p className="eyebrow"><span /> {t.pricingEye}</p><h2>{t.pricingTitle}</h2><p>{t.pricingText}</p></div>
        <div className="tier-grid">{t.tiers.map(([name, cap, price], i) => <article className={i === 1 ? 'featured' : ''} key={name}><small>0{i + 1}</small><h3>{name}</h3><p>{cap}</p><strong>{price}</strong><span>{t.perEvent}</span><ul>{t.features.map((feature) => <li key={feature}><Check /> {feature}</li>)}</ul></article>)}</div>
        <div className="pricing-cta"><span><Check size={17} weight="bold" /> {t.payFirst}</span><a className="button signal" href={registerUrl}>{t.start}<ArrowRight size={19} weight="bold" /></a></div>
      </section>

      <section className="install shell" id="installa">
        <div className="install-copy"><p className="eyebrow"><span /> {t.installEye}</p><h2>{t.installTitle.split('\n').map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}</h2><p>{t.installText}</p><div className="install-steps">{t.installSteps.map(([number, title, body]) => <article key={number}><b>{number}</b><div><strong>{title}</strong><span>{body}</span></div></article>)}</div><a className="button signal download" href={downloadUrl} download="onePixel-android.apk"><span><small>{t.release}</small>{t.appCta}</span><DownloadSimple size={24} weight="bold" /></a><p className="alpha-note"><ShieldCheck size={15} weight="fill" /> {t.alpha}</p></div>
        <div className="install-side"><div className="qr-panel"><div className="qr-label"><QrCode size={20} /> {t.scan}<strong>1.1.5</strong></div><img src={`${import.meta.env.BASE_URL}install-qr.png`} alt="QR code for onePixel Android download" /><a href={downloadUrl} download="onePixel-android.apk">{t.direct} <ArrowRight size={16} weight="bold" /></a></div><aside className="release-card"><div><small>{t.releaseEye}</small><strong>{t.releaseTitle}</strong></div><ul>{t.releaseNotes.map((note) => <li key={note}><Check size={15} weight="bold" /> {note}</li>)}</ul></aside></div>
      </section>

      <footer className="site-footer shell"><PixelMark /><p>{t.footer}</p><span>© 2026 onePixel</span></footer>
      <a className="mobile-download-bar" href={downloadUrl} download="onePixel-android.apk"><span><small>ANDROID 1.1.5</small>{t.appCta}</span><DownloadSimple size={22} weight="bold" /></a>
    </main>
  )
}

export default App
