/**
 * HP bar widgets.
 *
 * `BaseHpBar` is the reusable default: N scribbly squares, one per hit point.
 * Future characters with different HP totals can reuse it by passing `maxHp`.
 * `AlternateHpBar` is THE ALTERNATE's one-hit variant (single red square).
 */

export function BaseHpBar({ hp, maxHp = 3 }: { hp: number; maxHp?: number }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 scribble-border bg-paper px-2 sm:px-3 py-1 sm:py-2">
      <span className="font-marker text-ink text-sm sm:text-lg">HP</span>
      <div className="flex gap-1">
        {Array.from({ length: maxHp }, (_, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 sm:w-5 sm:h-5 border-2 border-ink ${
              i < hp ? "bg-[hsl(var(--accent))]" : "bg-paper"
            }`}
            style={{ transform: `rotate(${(i - (maxHp - 1) / 2) * 6}deg)` }}
          />
        ))}
      </div>
    </div>
  );
}

export function AlternateHpBar({ hp }: { hp: number }) {
  const alive = hp > 0;
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 scribble-border bg-paper px-2 sm:px-3 py-1 sm:py-2">
      <span className="font-marker text-ink text-sm sm:text-lg">HP</span>
      <div
        className={`w-3.5 h-3.5 sm:w-5 sm:h-5 border-2 border-ink ${
          alive ? "bg-[hsl(var(--destructive))] animate-jitter-soft" : "bg-paper"
        }`}
        style={{ transform: "rotate(-4deg)" }}
      />
    </div>
  );
}
