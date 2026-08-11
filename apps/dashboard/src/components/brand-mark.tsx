type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3" aria-label="onePixel">
      <span className="relative grid size-9 grid-cols-3 gap-0.5 rounded-[11px] bg-[#d1e66a] p-2 text-[#0b0d0e] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            className={`rounded-[1px] bg-current ${index === 4 ? "opacity-35" : "opacity-90"}`}
          />
        ))}
      </span>
      {!compact && (
        <span className="text-[19px] font-semibold tracking-[-0.055em] text-[#f2f3ed]">
          onePixel
        </span>
      )}
    </div>
  );
}

