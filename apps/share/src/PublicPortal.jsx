import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  CalendarBlank,
  Check,
  CheckCircle,
  CreditCard,
  Gauge,
  LockKey,
  MapPin,
  QrCode,
  SignOut,
  Sparkle,
} from '@phosphor-icons/react'

const portalCopy = {
  it: {
    demo: 'DEMO PUBBLICA · NESSUN ADDEBITO', back: 'Torna al sito', accessEye: 'ACCESSO ORGANIZZATORE', accessTitle: 'Prima accedi. Poi sblocchi il tuo evento.', accessText: 'Questa anteprima usa un accesso e un pagamento simulati. Non inviamo dati e non addebitiamo nulla.', signIn: 'Accedi', register: 'Registrati', name: 'Il tuo nome', organization: 'Organizzazione', email: 'Email', password: 'Password', continue: 'Accedi e continua', create: 'Crea account e continua', helper: 'Qualsiasi dato valido va bene per la demo.', paymentEye: 'PAGAMENTO DEMO', paymentTitle: 'Scegli la capienza.', paymentText: 'Il pagamento è finto: serve solo a provare il percorso completo prima della dashboard.', small: 'Piccolo', medium: 'Medio', large: 'Grande', smallCap: 'Fino a 500 partecipanti', mediumCap: 'Fino a 5.000 partecipanti', largeCap: 'Fino a 1.000.000 partecipanti', holder: 'Titolare', card: 'Carta demo', expiry: 'Scadenza', cvc: 'CVC', pay: 'Completa pagamento demo', noCharge: 'Non verrà effettuato alcun addebito.', control: 'CENTRO DI CONTROLLO', welcome: 'La tua regia è pronta.', paid: 'Pagamento demo confermato', unlocked: 'Hai un evento sbloccato e pronto da configurare.', createEvent: 'Configura evento', venues: 'Strutture', events: 'Eventi', reports: 'Report', profile: 'Profilo', credit: 'Credito evento', available: 'DISPONIBILE', capacity: 'Capienza', status: 'Stato', ready: 'Pronto', next: 'Prossimo passaggio', nextText: 'Crea la struttura, scegli QR o GPS e prepara la timeline.', recent: 'Evento demo', venueName: 'Arena Nord', eventDate: '31 LUG · 20:45', signOut: 'Esci dalla demo', overview: 'Panoramica', newEvent: 'Nuovo evento', fakeNote: 'Anteprima pubblica. La regia completa usa il server onePixel.',
  },
  en: {
    demo: 'PUBLIC DEMO · NO CHARGE', back: 'Back to site', accessEye: 'ORGANIZER ACCESS', accessTitle: 'Sign in first. Then unlock your event.', accessText: 'This preview uses simulated access and payment. No data is sent and nothing is charged.', signIn: 'Sign in', register: 'Register', name: 'Your name', organization: 'Organization', email: 'Email', password: 'Password', continue: 'Sign in and continue', create: 'Create account and continue', helper: 'Any valid-looking details work in the demo.', paymentEye: 'DEMO PAYMENT', paymentTitle: 'Choose capacity.', paymentText: 'Payment is simulated so you can try the entire path before entering the dashboard.', small: 'Small', medium: 'Medium', large: 'Large', smallCap: 'Up to 500 participants', mediumCap: 'Up to 5,000 participants', largeCap: 'Up to 1,000,000 participants', holder: 'Cardholder', card: 'Demo card', expiry: 'Expiry', cvc: 'CVC', pay: 'Complete demo payment', noCharge: 'No charge will be made.', control: 'CONTROL CENTER', welcome: 'Your control room is ready.', paid: 'Demo payment confirmed', unlocked: 'You have one unlocked event ready to configure.', createEvent: 'Configure event', venues: 'Venues', events: 'Events', reports: 'Reports', profile: 'Profile', credit: 'Event credit', available: 'AVAILABLE', capacity: 'Capacity', status: 'Status', ready: 'Ready', next: 'Next step', nextText: 'Build the venue, choose QR or GPS and prepare the timeline.', recent: 'Demo event', venueName: 'Arena Nord', eventDate: '31 JUL · 20:45', signOut: 'Leave demo', overview: 'Overview', newEvent: 'New event', fakeNote: 'Public preview. The full control room uses the onePixel server.',
  },
}

const tiers = [
  { id: 'small', price: '3 €', cap: 'smallCap' },
  { id: 'medium', price: '7 €', cap: 'mediumCap' },
  { id: 'large', price: '19 €', cap: 'largeCap' },
]

const dashboardCopy = {
  it: {
    venuesEye: 'SPAZI E GEOMETRIE', venuesTitle: 'Le tue strutture.', venuesText: 'Costruisci stadi, palazzetti, piazze e percorsi. Ogni zona resta modificabile nell’editor 2D.',
    eventsEye: 'PROGRAMMAZIONE', eventsTitle: 'I tuoi eventi.', eventsText: 'Prepara accessi, contenuti e regia. Il credito acquistato sblocca una nuova configurazione.',
    reportsEye: 'DATI POST EVENTO', reportsTitle: 'Report operativi.', reportsText: 'Controlla copertura, dispositivi pronti e precisione della sincronizzazione.',
    openEditor: 'Apri editor 2D', addVenue: 'Crea una struttura', venueReady: 'STRUTTURA PRONTA', rings: '3 anelli · 12 settori', seats: '24.890 posti', editable: 'Interamente modificabile',
    configure: 'Configura il tuo evento', eventDraft: 'Bozza da completare', eventReady: 'Pronto per la regia', access: 'Accesso', audience: 'Pubblico', noEvents: 'Il tuo credito è pronto: configura ora il primo evento.',
    coverage: 'Copertura', devices: 'Dispositivi pronti', sync: 'Scarto medio', commands: 'Comandi eseguiti', reportNote: 'Dati dimostrativi dell’evento Arena Nord.',
    setupEye: 'CREAZIONE GUIDATA', setupTitle: 'Configura evento.', setupText: 'Quattro passaggi chiari. Puoi tornare indietro e modificare tutto prima della pubblicazione.', backOverview: 'Torna alla panoramica',
    steps: ['Evento', 'Struttura', 'Accesso', 'Regia'], eventName: 'Nome evento', eventKind: 'Tipologia', eventKinds: ['Partita', 'Concerto', 'Manifestazione', 'Corteo'], date: 'Data e ora',
    chooseVenue: 'Scegli la struttura', useArena: 'Usa Arena Nord', fromMap: 'Seleziona dalla mappa', fromEditor: 'Crea nell’editor 2D', accessMode: 'Come entra il pubblico?', accessModes: [['QR preciso', 'Settore, fila o singolo posto'], ['GPS area', 'Ingresso automatico nella macro-area'], ['GPS capofila', 'Raggio mobile per cortei']],
    controlMode: 'Prepara i segnali live', controlItems: ['Colori sincronizzati', 'Testo e animazioni', 'Vibrazione e torcia', 'Audio e cori'], nextStep: 'Continua', previous: 'Indietro', publish: 'Salva evento demo', saved: 'Evento demo salvato', savedText: 'La configurazione è ora visibile nella pagina Eventi.',
  },
  en: {
    venuesEye: 'SPACES AND GEOMETRY', venuesTitle: 'Your venues.', venuesText: 'Build stadiums, arenas, squares and routes. Every zone remains editable in the 2D editor.',
    eventsEye: 'SCHEDULING', eventsTitle: 'Your events.', eventsText: 'Prepare access, content and control. Your purchased credit unlocks a new configuration.',
    reportsEye: 'POST-EVENT DATA', reportsTitle: 'Operational reports.', reportsText: 'Review coverage, ready devices and synchronization accuracy.',
    openEditor: 'Open 2D editor', addVenue: 'Create a venue', venueReady: 'VENUE READY', rings: '3 rings · 12 sectors', seats: '24,890 seats', editable: 'Fully editable',
    configure: 'Configure your event', eventDraft: 'Draft to complete', eventReady: 'Ready for control', access: 'Access', audience: 'Audience', noEvents: 'Your credit is ready: configure your first event now.',
    coverage: 'Coverage', devices: 'Ready devices', sync: 'Average offset', commands: 'Commands executed', reportNote: 'Demo data from the Arena Nord event.',
    setupEye: 'GUIDED CREATION', setupTitle: 'Configure event.', setupText: 'Four clear steps. Go back and change anything before publishing.', backOverview: 'Back to overview',
    steps: ['Event', 'Venue', 'Access', 'Control'], eventName: 'Event name', eventKind: 'Event type', eventKinds: ['Match', 'Concert', 'Demonstration', 'March'], date: 'Date and time',
    chooseVenue: 'Choose the venue', useArena: 'Use Arena Nord', fromMap: 'Select from map', fromEditor: 'Create in 2D editor', accessMode: 'How does the audience join?', accessModes: [['Precise QR', 'Section, row or individual seat'], ['GPS area', 'Automatic entry in the macro area'], ['Leader GPS', 'Mobile radius for marches']],
    controlMode: 'Prepare live signals', controlItems: ['Synchronized colors', 'Text and animations', 'Vibration and torch', 'Audio and chants'], nextStep: 'Continue', previous: 'Back', publish: 'Save demo event', saved: 'Demo event saved', savedText: 'The configuration is now visible on the Events page.',
  },
}

function PixelMark() {
  return <span className="brand" aria-label="onePixel"><span className="pixel-mark" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span><span>onePixel</span></span>
}

function DemoPageHeader({ eyebrow, title, text, action, actionLabel }) {
  return <div className="demo-page-head"><div><p>{eyebrow}</p><h1>{title}</h1><span>{text}</span></div>{action && <button type="button" onClick={action}><CheckCircle size={18} weight="fill" />{actionLabel}</button>}</div>
}

function OverviewView({ t, selectedTier, onConfigure }) {
  return <>
    <DemoPageHeader eyebrow={t.control} title={t.welcome} text={t.fakeNote} action={onConfigure} actionLabel={t.createEvent} />
    <section className="demo-paid-banner"><CheckCircle size={25} weight="fill" /><div><strong>{t.paid}</strong><span>{t.unlocked}</span></div><b>{selectedTier.price}</b></section>
    <section className="demo-metrics">
      <article><small>{t.credit}</small><strong>01</strong><span>{t.available}</span></article>
      <article><small>{t.capacity}</small><strong>{selectedTier.id === 'small' ? '500' : selectedTier.id === 'medium' ? '5.000' : '1M'}</strong><span>{t[selectedTier.cap]}</span></article>
      <article><small>{t.status}</small><strong>{t.ready}</strong><span>QR + GPS</span></article>
    </section>
    <section className="demo-dashboard-grid">
      <article className="demo-next"><div><small>01</small><h2>{t.next}</h2><p>{t.nextText}</p><button type="button" onClick={onConfigure}>{t.createEvent}<ArrowRight size={17} /></button></div><div className="demo-arena"><span>N1</span><span>O1</span><span>E1</span><span>S1</span><i /></div></article>
      <article className="demo-event"><small>{t.recent}</small><div className="demo-event-map"><MapPin size={22} /><QrCode size={24} /></div><h2>{t.venueName}</h2><p>{t.eventDate}</p><span>{t.newEvent}</span></article>
    </section>
  </>
}

function VenuesView({ d, t, onConfigure }) {
  return <>
    <DemoPageHeader eyebrow={d.venuesEye} title={d.venuesTitle} text={d.venuesText} action={onConfigure} actionLabel={d.addVenue} />
    <section className="demo-list-grid">
      <article className="demo-venue-card"><div className="demo-arena compact"><span>N1</span><span>O1</span><span>E1</span><span>S1</span><i /></div><div><small>{d.venueReady}</small><h2>{t.venueName}</h2><p>{d.rings}</p><p>{d.seats}</p><span>{d.editable}</span></div></article>
      <button className="demo-create-card" type="button" onClick={onConfigure}><Buildings size={28} /><strong>{d.openEditor}</strong><span>{d.venuesText}</span><ArrowRight size={18} /></button>
    </section>
  </>
}

function EventsView({ d, t, created, onConfigure }) {
  return <>
    <DemoPageHeader eyebrow={d.eventsEye} title={d.eventsTitle} text={d.eventsText} action={onConfigure} actionLabel={t.createEvent} />
    <section className="demo-event-list">
      <article><div className="demo-event-badge"><CalendarBlank size={22} /></div><div><small>{created ? d.eventReady : d.eventDraft}</small><h2>{created ? 'onePixel Opening Night' : d.noEvents}</h2><p>{t.venueName} · {t.eventDate}</p></div><dl><div><dt>{d.access}</dt><dd>QR + GPS</dd></div><div><dt>{d.audience}</dt><dd>500</dd></div></dl><button type="button" onClick={onConfigure}>{created ? d.openEditor : d.configure}<ArrowRight size={17} /></button></article>
    </section>
  </>
}

function ReportsView({ d }) {
  const stats = [[d.coverage, '94,8%', '+2,4%'], [d.devices, '472', 'su 500'], [d.sync, '38 ms', 'eccellente'], [d.commands, '128', '100%']]
  return <>
    <DemoPageHeader eyebrow={d.reportsEye} title={d.reportsTitle} text={d.reportsText} />
    <section className="demo-report-grid">{stats.map(([label, value, note], index) => <article key={label}><small>0{index + 1} · {label}</small><strong>{value}</strong><span>{note}</span><i style={{ '--report': `${[95, 82, 91, 100][index]}%` }} /></article>)}</section>
    <p className="demo-report-note"><Sparkle size={16} />{d.reportNote}</p>
  </>
}

function EventWizard({ d, step, setStep, onCancel, onComplete }) {
  const [eventKind, setEventKind] = useState(0)
  const [venue, setVenue] = useState('arena')
  const [accessMode, setAccessMode] = useState(0)
  return <>
    <div className="demo-wizard-head"><button type="button" onClick={onCancel}><ArrowLeft size={16} />{d.backOverview}</button><DemoPageHeader eyebrow={d.setupEye} title={d.setupTitle} text={d.setupText} /></div>
    <ol className="demo-wizard-steps">{d.steps.map((label, index) => <li key={label} className={index <= step ? 'active' : ''}><button type="button" onClick={() => setStep(index)}><span>0{index + 1}</span>{label}</button></li>)}</ol>
    <section className="demo-wizard-panel">
      {step === 0 && <div className="demo-form-step"><label><span>{d.eventName}</span><input defaultValue="onePixel Opening Night" /></label><label><span>{d.date}</span><input type="datetime-local" defaultValue="2026-08-22T20:45" /></label><fieldset><legend>{d.eventKind}</legend><div className="demo-option-grid">{d.eventKinds.map((item, index) => <button type="button" key={item} className={eventKind === index ? 'selected' : ''} onClick={() => setEventKind(index)}><CalendarBlank size={19} />{item}</button>)}</div></fieldset></div>}
      {step === 1 && <div className="demo-form-step"><h2>{d.chooseVenue}</h2><div className="demo-select-cards">{[["arena", d.useArena, d.rings], ["map", d.fromMap, 'GPS + catasto'], ["editor", d.fromEditor, d.editable]].map(([id, title, note]) => <button type="button" key={id} className={venue === id ? 'selected' : ''} onClick={() => setVenue(id)}><Buildings size={24} /><strong>{title}</strong><span>{note}</span>{venue === id && <CheckCircle size={18} weight="fill" />}</button>)}</div></div>}
      {step === 2 && <div className="demo-form-step"><h2>{d.accessMode}</h2><div className="demo-select-cards">{d.accessModes.map(([title, note], index) => <button type="button" key={title} className={accessMode === index ? 'selected' : ''} onClick={() => setAccessMode(index)}><QrCode size={24} /><strong>{title}</strong><span>{note}</span>{accessMode === index && <CheckCircle size={18} weight="fill" />}</button>)}</div></div>}
      {step === 3 && <div className="demo-form-step"><h2>{d.controlMode}</h2><div className="demo-control-list">{d.controlItems.map((item, index) => <label key={item}><input type="checkbox" defaultChecked={index < 3} /><span><Sparkle size={19} />{item}</span></label>)}</div></div>}
      <footer className="demo-wizard-actions">{step > 0 ? <button type="button" onClick={() => setStep(step - 1)}><ArrowLeft size={17} />{d.previous}</button> : <span />}
        <button className="primary" type="button" onClick={() => step < 3 ? setStep(step + 1) : onComplete()}>{step < 3 ? d.nextStep : d.publish}<ArrowRight size={17} /></button>
      </footer>
    </section>
  </>
}

export function PublicPortal({ lang, onLanguage, onExit }) {
  const storedPaid = window.localStorage.getItem('onepixel.public-demo-paid') === '1'
  const [step, setStep] = useState(storedPaid ? 'dashboard' : 'access')
  const [mode, setMode] = useState('signin')
  const [tier, setTier] = useState('small')
  const [profile, setProfile] = useState({ name: 'Livia Ferri', organization: 'Luce Civica', email: '' })
  const initialView = new URLSearchParams(window.location.search).get('view')
  const [active, setActive] = useState(['overview', 'venues', 'events', 'reports', 'configure'].includes(initialView) ? initialView : 'overview')
  const [wizardStep, setWizardStep] = useState(0)
  const [eventCreated, setEventCreated] = useState(window.localStorage.getItem('onepixel.public-demo-event') === '1')
  const t = portalCopy[lang]
  const d = dashboardCopy[lang]
  const selectedTier = tiers.find((item) => item.id === tier) ?? tiers[0]

  function access(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setProfile({
      name: String(form.get('name') || 'Livia Ferri'),
      organization: String(form.get('organization') || 'Luce Civica'),
      email: String(form.get('email') || ''),
    })
    setStep('payment')
  }

  function pay(event) {
    event.preventDefault()
    window.localStorage.setItem('onepixel.public-demo-paid', '1')
    setStep('dashboard')
  }

  function signOut() {
    window.localStorage.removeItem('onepixel.public-demo-paid')
    setStep('access')
  }

  function navigate(view) {
    const url = new URL(window.location.href)
    url.searchParams.set('portal', '1')
    url.searchParams.set('view', view)
    window.history.replaceState({}, '', url)
    setActive(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function completeEvent() {
    window.localStorage.setItem('onepixel.public-demo-event', '1')
    setEventCreated(true)
    navigate('events')
  }

  if (step === 'dashboard') return (
    <main className="demo-dashboard">
      <aside className="demo-sidebar">
        <PixelMark />
        <nav aria-label="Demo dashboard">
          {[
            ['overview', t.overview, Gauge],
            ['venues', t.venues, Buildings],
            ['events', t.events, CalendarBlank],
            ['reports', t.reports, Sparkle],
          ].map(([id, label, Icon]) => <button key={id} type="button" className={active === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={17} />{label}</button>)}
        </nav>
        <button className="demo-signout" type="button" onClick={signOut}><SignOut size={17} />{t.signOut}</button>
      </aside>
      <section className="demo-main">
        <header className="demo-topbar"><div><small>{t.demo}</small><strong>{profile.organization}</strong></div><div className="demo-top-actions"><button type="button" onClick={onLanguage}>{lang === 'it' ? 'EN' : 'IT'}</button><span>{(profile.name || profile.email || 'OP').slice(0, 2).toUpperCase()}</span></div></header>
        <div className="demo-content" key={active}>
          {active === 'overview' && <OverviewView t={t} selectedTier={selectedTier} onConfigure={() => navigate('configure')} />}
          {active === 'venues' && <VenuesView d={d} t={t} onConfigure={() => navigate('configure')} />}
          {active === 'events' && <EventsView d={d} t={t} created={eventCreated} onConfigure={() => navigate('configure')} />}
          {active === 'reports' && <ReportsView d={d} />}
          {active === 'configure' && <EventWizard d={d} step={wizardStep} setStep={setWizardStep} onCancel={() => navigate('overview')} onComplete={completeEvent} />}
        </div>
      </section>
    </main>
  )

  return (
    <main className="portal-shell">
      <header className="portal-header"><PixelMark /><div><button type="button" onClick={onLanguage}>{lang === 'it' ? 'EN' : 'IT'}</button><button type="button" onClick={onExit}><ArrowLeft size={15} />{t.back}</button></div></header>
      <section className="portal-stage">
        <div className="portal-progress" aria-label="Progress"><span className="done">01</span><i /><span className={step === 'payment' ? 'done' : ''}>02</span><i /><span>03</span></div>
        {step === 'access' ? <div className="portal-layout">
          <div className="portal-intro"><p>{t.accessEye}</p><h1>{t.accessTitle}</h1><span>{t.accessText}</span><div className="portal-signal"><LockKey size={21} /><b>{t.demo}</b></div></div>
          <form className="portal-panel" onSubmit={access}>
            <div className="portal-tabs"><button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>{t.signIn}</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>{t.register}</button></div>
            {mode === 'register' && <div className="portal-two"><label><span>{t.name}</span><input name="name" required defaultValue={profile.name} /></label><label><span>{t.organization}</span><input name="organization" required defaultValue={profile.organization} /></label></div>}
            <label><span>{t.email}</span><input name="email" type="email" required placeholder="regia@organizzazione.it" /></label>
            <label><span>{t.password}</span><input name="password" type="password" required minLength="6" defaultValue="Demo2026!" /></label>
            <small>{t.helper}</small>
            <button className="portal-primary" type="submit">{mode === 'signin' ? t.continue : t.create}<ArrowRight size={18} weight="bold" /></button>
          </form>
        </div> : <div className="portal-layout">
          <div className="portal-intro"><p>{t.paymentEye}</p><h1>{t.paymentTitle}</h1><span>{t.paymentText}</span><div className="portal-signal"><CreditCard size={21} /><b>{t.noCharge}</b></div></div>
          <form className="portal-panel payment" onSubmit={pay}>
            <div className="portal-tiers">{tiers.map((item) => <button key={item.id} type="button" className={tier === item.id ? 'active' : ''} onClick={() => setTier(item.id)}><span>{t[item.id]}</span><small>{t[item.cap]}</small><strong>{item.price}</strong>{tier === item.id && <Check size={15} weight="bold" />}</button>)}</div>
            <label><span>{t.holder}</span><input required defaultValue={profile.name} /></label>
            <label><span>{t.card}</span><input required inputMode="numeric" defaultValue="4242 4242 4242 4242" /></label>
            <div className="portal-two"><label><span>{t.expiry}</span><input required defaultValue="12/30" /></label><label><span>{t.cvc}</span><input required inputMode="numeric" defaultValue="123" /></label></div>
            <button className="portal-primary" type="submit">{t.pay}<ArrowRight size={18} weight="bold" /></button>
            <small className="portal-secure"><LockKey size={13} />{t.demo}</small>
          </form>
        </div>}
      </section>
    </main>
  )
}
