import { BrandMark } from "@/components/brand-mark";
import { RegisterForm } from "@/components/register-form";
import { Localized } from "@/components/dashboard-language";

const registerErrors: Record<string, string> = {
  invalid_request: "Richiesta di registrazione non valida. Riprova.",
  registration_failed: "Registrazione non riuscita. Controlla i dati inseriti.",
  offline: "Backend onePixel non raggiungibile. Riprova tra poco.",
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const errorCode = (await searchParams).error;
  return (
    <Localized><main className="min-h-[100dvh] bg-[#0b0d0e] px-4 py-5 sm:px-8 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(540px,1.1fr)] lg:gap-10 lg:p-8">
      <section className="relative hidden overflow-hidden rounded-[36px] border border-white/10 bg-[#131819] p-10 surface-grid lg:flex lg:flex-col lg:justify-between">
        <BrandMark />
        <div className="relative z-[1] max-w-lg pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#d1e66a]">DALLO SBLOCCO DEMO ALLA REGIA</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[0.94] tracking-[-0.055em]">Costruisci l&apos;evento. Accendi ogni schermo.</h1>
          <div className="mt-9 grid grid-cols-[1.2fr_0.8fr] gap-3">
            <div className="rounded-[28px] border border-white/10 bg-[#0d1112]/85 p-5"><p className="font-mono text-3xl text-[#d1e66a]">3 €</p><p className="mt-2 text-xs leading-5 text-[#8d9593]">Il primo evento piccolo, senza abbonamento.</p></div>
            <div className="rounded-[28px] border border-white/10 bg-[#d1e66a] p-5 text-[#101314]"><p className="font-mono text-3xl">500</p><p className="mt-2 text-xs leading-5 text-[#333a2b]">partecipanti inclusi</p></div>
          </div>
        </div>
      </section>
      <section className="mx-auto flex w-full max-w-xl flex-col justify-center py-8 lg:py-12">
        <div className="lg:hidden"><BrandMark /></div>
        <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#d1e66a] lg:mt-0">NUOVO ORGANIZZATORE</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Apri la tua regia.</h2>
        <p className="mt-4 max-w-[52ch] text-sm leading-6 text-[#8e9694]">Registrati, scegli la capienza e sblocca un evento mock senza addebiti. La procedura guidata parte immediatamente.</p>
        <RegisterForm initialError={errorCode ? registerErrors[errorCode] ?? "Registrazione non riuscita. Riprova." : ""} />
      </section>
    </main></Localized>
  );
}
