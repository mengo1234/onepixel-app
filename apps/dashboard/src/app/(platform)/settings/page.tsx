import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet } from "@/lib/control-plane";

type Me = { organization: { name: string; brand: { primary?: string; logo?: string | null } } | null };

export default async function SettingsPage() {
  const me = await controlPlaneGet<Me>("/v1/auth/me");
  return <div className="space-y-8"><PageHeader eyebrow="Profilo organizzazione" title="La tua identità, dentro ogni evento." description="Nome, colore e logo vengono distribuiti nell’app insieme al pacchetto della coreografia." />{me.organization && <OrganizationSettingsForm initial={me.organization} />}</div>;
}
