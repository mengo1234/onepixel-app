import { BuildingsIcon, ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet } from "@/lib/control-plane";
import { NewOrganizationButton, OrganizationStatusButton } from "@/components/organization-actions";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { roleCookie } from "@/lib/control-plane";
import { Localized } from "@/components/dashboard-language";

type Organization = { id: string; name: string; status: "active" | "suspended"; expires_at: string; max_events: number; max_devices: number; max_capacity: number };

export default async function OrganizationsPage() {
  if ((await cookies()).get(roleCookie)?.value !== "super_admin") notFound();
  const organizations = await controlPlaneGet<Organization[]>("/v1/admin/organizations");
  return (
    <Localized><div className="space-y-8">
      <PageHeader eyebrow="Super amministratore" title="Decidi chi può accendere la piattaforma." description="Crea le organizzazioni dopo la vendita, assegna credenziali e limiti e conserva il controllo operativo generale." />
      <div className="flex justify-end"><NewOrganizationButton /></div>
      <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-[#111516]">
        <table className="w-full min-w-[800px] border-collapse text-left">
          <thead><tr className="border-b border-white/8 font-mono text-[9px] uppercase tracking-[0.15em] text-[#697170]"><th className="px-5 py-4 font-medium">Organizzazione</th><th className="px-5 py-4 font-medium">Licenza</th><th className="px-5 py-4 font-medium">Eventi</th><th className="px-5 py-4 font-medium">Dispositivi</th><th className="px-5 py-4 font-medium">Stato</th><th className="px-5 py-4" /></tr></thead>
          <tbody className="divide-y divide-white/8">
            {organizations.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-xs text-[#737b79]">Nessuna organizzazione creata. Usa il pulsante in alto per aggiungere il primo cliente.</td></tr>}
            {organizations.map((organization) => (
              <tr key={organization.name} className="transition hover:bg-white/[0.025]">
                <td className="px-5 py-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/[0.045] text-[#d1e66a]"><BuildingsIcon size={18} /></span><div><p className="text-sm font-medium text-white">{organization.name}</p><p className="mt-1 text-[10px] text-[#697170]">{organization.id}</p></div></div></td>
                <td className="px-5 py-5 font-mono text-xs text-[#aab1af]">fino al {new Intl.DateTimeFormat("it-IT").format(new Date(organization.expires_at))}</td>
                <td className="px-5 py-5 font-mono text-xs text-[#aab1af]">max {organization.max_events}</td>
                <td className="px-5 py-5 font-mono text-xs text-[#aab1af]">{organization.max_devices.toLocaleString("it-IT")} / capienza {organization.max_capacity.toLocaleString("it-IT")}</td>
                <td className="px-5 py-5"><span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] ${organization.status === "active" ? "bg-[#d1e66a]/10 text-[#d1e66a]" : "bg-[#e2a65a]/10 text-[#e2a65a]"}`}><span className="size-1.5 rounded-full bg-current" /> {organization.status === "active" ? "Attiva" : "Sospesa"}</span></td>
                <td className="px-5 py-5"><OrganizationStatusButton id={organization.id} status={organization.status} name={organization.name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-[#d1e66a]/15 bg-[#d1e66a]/[0.035] p-4 text-xs text-[#adb4b2]">
        <ShieldCheckIcon size={19} className="shrink-0 text-[#d1e66a]" /> Solo il super amministratore può creare credenziali, modificare licenze o sospendere un cliente.
      </div>
    </div></Localized>
  );
}
