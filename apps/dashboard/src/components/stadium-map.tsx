import { Localized } from "./dashboard-language";

type StadiumMapProps = {
  compact?: boolean;
  active?: boolean;
  live?: boolean;
  venueName?: string;
  zoneCount?: number;
  deviceCount?: number;
};

const sectors = [
  { name: "N1", x: 33, y: 9, w: 34, h: 13, color: "#d1e66a" },
  { name: "O1", x: 8, y: 29, w: 18, h: 42, color: "#e2a65a" },
  { name: "E1", x: 74, y: 29, w: 18, h: 42, color: "#77a4a1" },
  { name: "S1", x: 33, y: 78, w: 34, h: 13, color: "#d17667" },
];

export function StadiumMap({ compact = false, active = false, live = false, venueName = "Struttura", zoneCount = sectors.length, deviceCount = 0 }: StadiumMapProps) {
  const highlighted = active || live;
  return (
    <Localized><div
      className={`surface-grid relative overflow-hidden rounded-[30px] border border-white/10 bg-[#101415] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
        compact ? "min-h-[280px]" : "min-h-[470px]"
      }`}
      role="img"
      aria-label="Mappa dello stadio vista dall'alto con quattro settori"
    >
      <div className="absolute inset-5 rounded-[25%] border border-white/8 md:inset-8" />
      <div className="absolute left-[30%] top-[26%] h-[48%] w-[40%] rounded-[18px] border border-[#d1e66a]/35 bg-[#293421] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
        <div className="relative size-full rounded-[12px] border border-white/15">
          <span className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
          <span className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        </div>
      </div>
      {sectors.map((sector, index) => (
        <div
          key={sector.name}
          className="absolute grid place-items-center overflow-hidden rounded-2xl border border-white/10 text-xs font-semibold text-[#0b0d0e] transition duration-300 hover:scale-[1.02]"
          style={{
            left: `${sector.x}%`,
            top: `${sector.y}%`,
            width: `${sector.w}%`,
            height: `${sector.h}%`,
            backgroundColor: sector.color,
            opacity: highlighted ? 0.9 : 0.76,
          }}
        >
          <span className="relative z-[1] rounded-full bg-[#0b0d0e]/75 px-2 py-0.5 font-mono text-[9px] text-white">
            {sector.name}
          </span>
          <span
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: "radial-gradient(circle, #0b0d0e 1.4px, transparent 1.6px)",
              backgroundSize: `${index % 2 === 0 ? 10 : 9}px 9px`,
            }}
          />
        </div>
      ))}
      {highlighted && (
        <div className="pointer-events-none absolute left-8 right-8 top-1/2 h-px bg-[#d1e66a]/80 shadow-[0_0_18px_rgba(209,230,106,0.18)] signal-scan" />
      )}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#0b0d0e]/80 px-3 py-1.5 text-[10px] text-[#aab1af] backdrop-blur-md">
        <span className={`size-1.5 rounded-full bg-[#d1e66a] ${highlighted ? "breathe" : ""}`} />
        {live ? `Live · ${deviceCount.toLocaleString("it-IT")} dispositivi` : `${venueName} · ${zoneCount} settori`}
      </div>
    </div></Localized>
  );
}
