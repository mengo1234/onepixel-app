import { ChartBarIcon, PulseIcon } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/page-header";
import { ReportExport } from "@/components/report-export";
import { controlPlaneGet } from "@/lib/control-plane";

type Event = { id: string; title: string; venue_name: string; venue_capacity: number };
type Report = { eventId: string; generatedAt: string; devices: { unique_devices: number; ready_devices: number; avg_offset_ms: number }; commands: { total_commands: number; stop_commands: number }; zones: Array<{ zone_id: string; unique_devices: number; ready_devices: number; avg_offset_ms: number }> };

export default async function ReportsPage() {
  const events = await controlPlaneGet<Event[]>("/v1/events");
  const event = events[0];
  const report = event ? await controlPlaneGet<Report>(`/v1/events/${event.id}/report`) : null;
  const coverage = event && report ? Math.round((report.devices.ready_devices / Math.max(1, event.venue_capacity)) * 1000) / 10 : 0;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Report" title="Misura ciò che è successo davvero." description="Copertura, precisione temporale, pacchetti scaricati e problemi di rete restano disponibili dopo ogni evento." />
      <section className="grid gap-px overflow-hidden rounded-[28px] border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Partecipanti", (report?.devices.unique_devices ?? 0).toLocaleString("it-IT"), "dispositivi unici rilevati"],
          ["Copertura media", `${coverage}%`, `${report?.zones.length ?? 0} settori misurati`],
          ["Offset medio", `${report?.devices.avg_offset_ms ?? 0} ms`, "scarto assoluto registrato"],
          ["Comandi live", `${report?.commands.total_commands ?? 0}`, `${report?.commands.stop_commands ?? 0} arresti generali`],
        ].map(([label, value, detail]) => (
          <div key={label} className="bg-[#111516] p-6"><p className="text-[11px] text-[#78807e]">{label}</p><p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.05em]">{value}</p><p className="mt-2 text-[10px] text-[#8c9492]">{detail}</p></div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#111516] p-6">
          <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#d1e66a]">Copertura per settore</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">{event?.venue_name ?? "Nessun dato"}</h2></div><ChartBarIcon size={21} className="text-[#697170]" /></div>
          <div className="mt-8 grid h-[280px] items-end gap-2 border-b border-white/10" style={{ gridTemplateColumns: `repeat(${Math.max(1, report?.zones.length ?? 0)}, minmax(18px, 1fr))` }}>
            {(report?.zones ?? []).map((zone) => {
              const value = Math.round((zone.ready_devices / Math.max(1, zone.unique_devices)) * 100);
              return <div key={zone.zone_id} className="group flex h-full flex-col justify-end gap-2">
                <span className="text-center font-mono text-[8px] text-[#737b79] opacity-0 transition group-hover:opacity-100">{value}%</span>
                <span className="rounded-t-md bg-[#d1e66a] opacity-75 transition group-hover:opacity-100" style={{ height: `${value}%` }} />
                <span className="pb-2 text-center font-mono text-[8px] text-[#697170]">{zone.zone_id}</span>
              </div>;
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#111516] p-6">
          <PulseIcon size={22} className="text-[#d1e66a]" />
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.04em]">Segnali operativi</h2>
          <div className="mt-6 divide-y divide-white/8 border-y border-white/8">
            {(report?.zones ?? []).slice(0, 6).map((zone) => (
              <div key={zone.zone_id} className="grid grid-cols-[64px_1fr] gap-3 py-3"><span className="font-mono text-[9px] text-[#697170]">{zone.zone_id}</span><div><p className="text-xs text-[#c0c6c4]">{zone.ready_devices} pronti su {zone.unique_devices}</p><p className="mt-1 font-mono text-[9px] text-[#d1e66a]">offset medio {zone.avg_offset_ms} ms</p></div></div>
            ))}
            {!report?.zones.length && <p className="py-6 text-xs text-[#697170]">I dati compariranno dopo i primi collegamenti.</p>}
          </div>
          {report && event && <ReportExport report={{ eventId: report.eventId, eventTitle: event.title, generatedAt: report.generatedAt, zones: report.zones }} />}
        </div>
      </section>
    </div>
  );
}
