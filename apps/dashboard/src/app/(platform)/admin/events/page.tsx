import { CalendarBlankIcon } from "@phosphor-icons/react/dist/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AdminEventStatus } from "@/components/admin-event-status";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet, roleCookie } from "@/lib/control-plane";
import { Localized } from "@/components/dashboard-language";

type Event = { id: string; title: string; kind: string; status: string; starts_at: string; participant_limit: number; organization_name: string; venue_name: string; joined: number };

export default async function AdminEventsPage() {
  if ((await cookies()).get(roleCookie)?.value !== "super_admin") notFound();
  const events = await controlPlaneGet<Event[]>("/v1/admin/events");
  return <Localized><div className="space-y-8"><PageHeader eyebrow="Super amministratore" title="Controllo globale eventi." description="Sorveglia stato, organizzazione, capienza e partecipanti; puoi arrestare un evento senza entrare nella sua regia." /><div className="overflow-x-auto rounded-[28px] border border-white/10 bg-[#111516]"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-white/8 font-mono text-[9px] uppercase tracking-[.15em] text-[#697170]"><th className="px-5 py-4">Evento</th><th className="px-5 py-4">Organizzazione</th><th className="px-5 py-4">Luogo</th><th className="px-5 py-4">Partecipanti</th><th className="px-5 py-4">Quando</th><th className="px-5 py-4">Stato</th></tr></thead><tbody className="divide-y divide-white/8">{events.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-xs text-[#737b79]">Nessun evento presente nella piattaforma.</td></tr>}{events.map((event) => <tr key={event.id} className="hover:bg-white/[.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><CalendarBlankIcon size={17} className="text-[#d1e66a]" /><div><p className="text-xs text-white">{event.title}</p><p className="mt-1 font-mono text-[9px] text-[#68706f]">{event.kind}</p></div></div></td><td className="px-5 py-4 text-xs text-[#aab1af]">{event.organization_name}</td><td className="px-5 py-4 text-xs text-[#aab1af]">{event.venue_name}</td><td className="px-5 py-4 font-mono text-xs text-white">{event.joined.toLocaleString("it-IT")} / {event.participant_limit.toLocaleString("it-IT")}</td><td className="px-5 py-4 text-[10px] text-[#737b79]">{new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.starts_at))}</td><td className="px-5 py-4"><AdminEventStatus id={event.id} status={event.status} /></td></tr>)}</tbody></table></div></div></Localized>;
}
