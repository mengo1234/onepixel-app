"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";

type ExportReport = {
  eventId: string;
  eventTitle: string;
  generatedAt: string;
  zones: Array<{ zone_id: string; unique_devices: number; ready_devices: number; avg_offset_ms: number }>;
};

export function ReportExport({ report }: { report: ExportReport }) {
  function download() {
    const rows = [
      ["event_id", "event_title", "generated_at", "zone_id", "unique_devices", "ready_devices", "avg_offset_ms"],
      ...report.zones.map((zone) => [report.eventId, report.eventTitle, report.generatedAt, zone.zone_id, zone.unique_devices, zone.ready_devices, zone.avg_offset_ms]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `onepixel-${report.eventId}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <button type="button" onClick={download} className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-white/12 text-xs text-[#b2b9b7] transition hover:border-white/30 hover:text-white active:scale-[0.98]"><DownloadSimpleIcon size={16} /> Esporta CSV</button>;
}
