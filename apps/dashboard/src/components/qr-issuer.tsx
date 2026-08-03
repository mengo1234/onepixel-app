"use client";

import { DownloadSimpleIcon, FileCsvIcon, FilePdfIcon, QrCodeIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import Image from "next/image";
import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { Localized } from "./dashboard-language";

type Zone = { id: string; label: string; seats: number };
type IssuedCode = { zoneId: string; seatId: string | null; deepLink: string; expiresAt: string };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function QrIssuer({ eventId, zones }: { eventId: string; zones: Zone[] }) {
  const [mode, setMode] = useState<"sector" | "seat">("sector");
  const [qrImage, setQrImage] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkCodes, setBulkCodes] = useState<IssuedCode[]>([]);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/control/v1/events/${eventId}/qr`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ zoneId: form.get("zoneId"), seatId: mode === "seat" ? form.get("seatId") : undefined }) });
    const payload = await response.json();
    if (!response.ok) { setPending(false); setError(payload.message ?? "QR non generato"); return; }
    setDeepLink(payload.deepLink);
    setQrImage(await QRCode.toDataURL(payload.deepLink, { width: 720, margin: 3, errorCorrectionLevel: "H", color: { dark: "#0B0D0EFF", light: "#F2F3EDFF" } }));
    setPending(false);
  }

  async function issueBulk(includeSeats: boolean) {
    setBulkPending(true);
    setError("");
    const response = await fetch(`/api/control/v1/events/${eventId}/qr/bulk`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ includeSeats }) });
    const payload = await response.json();
    setBulkPending(false);
    if (!response.ok) { setError(payload.message ?? "Lotto QR non generato"); return; }
    setBulkCodes(payload.codes as IssuedCode[]);
  }

  function exportCsv() {
    const lines = [["zona", "posto", "deep_link", "scadenza"], ...bulkCodes.map((code) => [code.zoneId, code.seatId ?? "", code.deepLink, code.expiresAt])];
    const csv = lines.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `onepixel-${eventId}-qr.csv`);
  }

  async function exportPdf() {
    if (bulkCodes.length > 300) { setError("Per mantenere il PDF leggibile esporta al massimo 300 codici; per lotti più grandi usa il CSV."); return; }
    setBulkPending(true);
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    for (let index = 0; index < bulkCodes.length; index += 1) {
      if (index > 0 && index % 6 === 0) pdf.addPage();
      const position = index % 6;
      const x = 16 + (position % 2) * 94;
      const y = 16 + Math.floor(position / 2) * 91;
      const code = bulkCodes[index];
      const data = await QRCode.toDataURL(code.deepLink, { width: 500, margin: 2, errorCorrectionLevel: "H" });
      pdf.setFillColor(245, 246, 240); pdf.roundedRect(x, y, 82, 80, 4, 4, "F");
      pdf.addImage(data, "PNG", x + 14, y + 5, 54, 54);
      pdf.setTextColor(14, 18, 19); pdf.setFontSize(11); pdf.text(code.zoneId, x + 41, y + 64, { align: "center" });
      pdf.setFontSize(8); pdf.text(code.seatId ? `Posto ${code.seatId}` : "Accesso zona", x + 41, y + 70, { align: "center" });
      pdf.setFontSize(6); pdf.text("onePixel · scansiona dall'app", x + 41, y + 75, { align: "center" });
    }
    pdf.save(`onepixel-${eventId}-qr.pdf`);
    setBulkPending(false);
  }

  return (
    <Localized><section className="overflow-hidden rounded-[30px] border border-white/10 bg-[#111516]">
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px] lg:p-7">
        <form onSubmit={issue}>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d1e66a]">Assegnazione accesso</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Genera QR firmati</h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-[#818987]">Il QR prevale sul GPS e può assegnare una zona o un singolo posto. L&apos;app funziona anche senza account.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#0b0d0e] p-1"><button type="button" onClick={() => setMode("sector")} className={`rounded-xl px-4 py-2 text-xs ${mode === "sector" ? "bg-[#d1e66a] font-semibold text-[#0b0d0e]" : "text-[#8f9795]"}`}>QR zona</button><button type="button" onClick={() => setMode("seat")} className={`rounded-xl px-4 py-2 text-xs ${mode === "seat" ? "bg-[#d1e66a] font-semibold text-[#0b0d0e]" : "text-[#8f9795]"}`}>QR posto</button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><label><span className="mb-2 block text-xs text-[#b8bfbd]">Zona</span><select name="zoneId" required className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0d0e] px-4 text-sm text-white">{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label} · {zone.seats.toLocaleString("it-IT")} posti</option>)}</select></label><label className={mode === "seat" ? "" : "opacity-35"}><span className="mb-2 block text-xs text-[#b8bfbd]">Fila-posto</span><input name="seatId" required={mode === "seat"} disabled={mode !== "seat"} placeholder="18-42" className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0d0e] px-4 text-sm text-white disabled:cursor-not-allowed" /></label></div>
          {error && <p role="alert" className="mt-3 rounded-xl border border-[#e26d5a]/25 bg-[#e26d5a]/10 p-3 text-xs text-[#f08a79]">{error}</p>}
          <button disabled={pending || zones.length === 0} type="submit" className="mt-5 flex h-11 items-center gap-2 rounded-full bg-[#d1e66a] px-6 text-sm font-semibold text-[#0b0d0e] disabled:opacity-40"><QrCodeIcon size={18} weight="bold" />{pending ? "Firma in corso…" : "Genera QR"}</button>
        </form>
        <div className="grid min-h-[260px] place-items-center rounded-[24px] border border-dashed border-white/12 bg-[#0b0d0e] p-4">{qrImage ? <div className="text-center"><Image src={qrImage} alt="QR onePixel firmato" width={220} height={220} unoptimized className="mx-auto rounded-xl" /><a href={qrImage} download={`onepixel-${eventId}.png`} className="mt-3 inline-flex items-center gap-2 text-xs text-[#d1e66a]"><DownloadSimpleIcon size={15} />Scarica PNG</a><p className="sr-only">{deepLink}</p></div> : <div className="text-center text-[#626a68]"><QrCodeIcon size={48} className="mx-auto" /><p className="mt-3 text-xs">Il codice comparirà qui</p></div>}</div>
      </div>
      <div className="border-t border-white/8 bg-[#0d1112] p-5 lg:px-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold">Esportazione massiva</p><p className="mt-1 text-[11px] text-[#737b79]">Tutte le zone oppure ogni posto della configurazione congelata nell&apos;evento.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={bulkPending} onClick={() => void issueBulk(false)} className="rounded-full border border-white/12 px-4 py-2 text-[11px] text-[#b2b9b7]">Genera per zone</button><button type="button" disabled={bulkPending} onClick={() => void issueBulk(true)} className="rounded-full border border-white/12 px-4 py-2 text-[11px] text-[#b2b9b7]">Genera per posti</button></div></div>{bulkPending && <p className="mt-4 flex items-center gap-2 text-xs text-[#d1e66a]"><SpinnerGapIcon className="animate-spin" />Preparazione lotto…</p>}{bulkCodes.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#d1e66a]/20 bg-[#d1e66a]/6 p-3"><span className="mr-auto text-xs text-[#d1e66a]">{bulkCodes.length.toLocaleString("it-IT")} codici pronti</span><button type="button" onClick={exportCsv} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-semibold text-[#101314]"><FileCsvIcon size={15} />CSV</button><button type="button" onClick={() => void exportPdf()} className="flex items-center gap-2 rounded-full bg-[#d1e66a] px-4 py-2 text-[11px] font-semibold text-[#101314]"><FilePdfIcon size={15} />PDF</button></div>}</div>
    </section></Localized>
  );
}
