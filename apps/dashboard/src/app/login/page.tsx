import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { Localized } from "@/components/dashboard-language";

const loginErrors: Record<string, string> = {
  invalid_request: "Richiesta di accesso non valida. Riprova.",
  invalid_credentials: "Email o password non corretti.",
  offline: "Backend onePixel non raggiungibile. Riprova tra poco.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const errorCode = (await searchParams).error;
  return (
    <Localized><main className="grid min-h-[100dvh] bg-[#0b0d0e] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex flex-col justify-between px-5 py-6 sm:px-10 lg:px-[8vw] lg:py-10">
        <BrandMark />
        <div className="my-16 max-w-md lg:my-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d1e66a]">Accesso organizzazioni</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[0.95] tracking-[-0.055em] md:text-6xl">La regia comincia qui.</h1>
          <p className="mt-5 max-w-[48ch] text-sm leading-6 text-[#8e9694]">Accedi come organizzatore. Se è la prima volta, crea il tuo account e sblocca gratuitamente un evento demo.</p>
          <LoginForm initialError={errorCode ? loginErrors[errorCode] ?? "Accesso non riuscito. Riprova." : ""} />
          <p className="mt-5 text-center text-xs text-[#7e8684]">Non hai un account? <Link className="font-medium text-[#d1e66a] transition hover:text-white" href="/register">Registrati</Link></p>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#545b5a]">onePixel control surface · accesso protetto</p>
      </section>
      <section className="relative hidden overflow-hidden border-l border-white/8 bg-[#111516] surface-grid lg:block">
        <Image src="/artwork/stadium-pixel-wave-v1.png" alt="Stadio illuminato da una coreografia onePixel" fill priority sizes="55vw" className="object-cover object-[58%_42%] opacity-85" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,13,14,0.76),rgba(11,13,14,0.1)_48%,rgba(11,13,14,0.42)),linear-gradient(0deg,rgba(11,13,14,0.7),transparent_48%)]" />
        <div className="absolute bottom-[8%] left-[9%] max-w-sm rounded-[28px] border border-white/10 bg-[#0b0d0e]/75 p-6 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <p className="font-mono text-[10px] text-[#d1e66a]">31.842 DISPOSITIVI</p><p className="mt-3 text-xl font-semibold tracking-[-0.04em]">Una folla, un solo istante.</p>
        </div>
      </section>
    </main></Localized>
  );
}
