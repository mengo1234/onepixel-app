import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet } from "@/lib/control-plane";
import { Localized } from "@/components/dashboard-language";

type Me = { organization: { name: string; brand: { primary?: string; logo?: string | null } } | null };

export default async function SettingsPage() {
  const me = await controlPlaneGet<Me>("/v1/auth/me");
  return <Localized><div className="space-y-8"><PageHeader eyebrow="Profilo organizzazione" title="La tua identità, dentro ogni evento." description="Nome, colore e logo vengono distribuiti nell’app insieme al pacchetto della coreografia." />{me.organization ? <OrganizationSettingsForm initial={me.organization} /> : <section className="rounded-[28px] border border-dashed border-white/12 p-8"><BuildingsIcon size={25} className="text-[#d1e66a]" /><h2 className="mt-4 text-base font-semibold">Nessuna organizzazione selezionata</h2><p className="mt-2 max-w-lg text-xs leading-5 text-[#7d8583]">Il profilo globale onePixel non ha un brand organizzazione. Apri la gestione clienti per configurare o controllare le organizzazioni abilitate.</p><Link href="/admin/organizations" className="mt-5 inline-flex rounded-full border border-white/12 px-4 py-2.5 text-xs text-white">Gestisci organizzazioni</Link></section>}</div></Localized>;
}
