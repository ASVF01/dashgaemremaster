import type { HudState } from "@/game/GameCanvas";

export default function Hud({ hud }: { hud: HudState }) {
  const seconds = (hud.timeMs / 1000).toFixed(2);
  const sm = !!hud.starman;
  const showParryCd = !sm && hud.parryCooldown > 0.05;
  const showDashCd = !sm && hud.dashCooldown > 0.05;

  return (
    <div className="hud-touch-pad pointer-events-none absolute inset-0 p-2 sm:p-4">
      {/* top row */}
      <div className="flex items-start justify-between gap-2 sm:gap-4 flex-wrap">
        {/* HP */}
        <div className="flex items-center gap-1.5 sm:gap-2 scribble-border bg-paper px-2 sm:px-3 py-1 sm:py-2">
          <span className="font-marker text-ink text-sm sm:text-lg">HP</span>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 sm:w-5 sm:h-5 border-2 border-ink ${i < hud.hp ? "bg-[hsl(var(--accent))]" : "bg-paper"}`}
                style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
              />
            ))}
          </div>
        </div>

        {/* TIMER + LEVEL PROGRESS stacked */}
        <div className="flex flex-col items-center gap-1">
          <div className="scribble-border bg-paper px-2 sm:px-4 py-1 sm:py-2">
            <div className="font-bungee text-ink text-lg sm:text-2xl leading-none">
              {seconds}<span className="text-[10px] sm:text-sm">s</span>
            </div>
          </div>
          <div className="scribble-border bg-paper px-2 py-1 w-[140px] sm:w-[200px]">
            <div className="font-marker text-ink text-[9px] sm:text-[10px] tracking-widest mb-0.5 text-center">
              LEVEL PROGRESS
            </div>
            <div className="h-2 border-2 border-ink bg-paper relative">
              <div className="h-full bg-ink" style={{ width: `${hud.progress * 100}%` }} />
              <div
                className="absolute -top-1 w-2 h-4 bg-[hsl(var(--accent))] border-2 border-ink"
                style={{ left: `calc(${hud.progress * 100}% - 4px)` }}
              />
            </div>
          </div>
        </div>

        {/* SCORE */}
        <div className="scribble-border bg-paper px-2 sm:px-3 py-1 sm:py-2 text-right">
          <div className="font-marker text-ink text-base sm:text-xl leading-none">{hud.score}</div>
          {hud.combo > 1 && (
            <div className="font-marker text-[hsl(var(--accent))] text-[10px] sm:text-sm animate-jitter">
              x{hud.combo} COMBO!!
            </div>
          )}
        </div>
      </div>

      {/* Floating cooldown numbers above the player */}
      {(showParryCd || showDashCd) && (
        <div
          className="absolute font-bungee leading-none flex flex-col items-center gap-0.5"
          style={{
            left: hud.playerScreenX,
            top: Math.max(8, hud.playerScreenY - 44),
            transform: "translateX(-50%)",
          }}
        >
          {showParryCd && (
            <span className="px-1.5 py-0.5 scribble-border bg-paper text-[10px] sm:text-xs text-ink animate-jitter-soft">
              <span className="text-[hsl(var(--accent))]">J</span> {hud.parryCooldown.toFixed(1)}
            </span>
          )}
          {showDashCd && (
            <span className="px-1.5 py-0.5 scribble-border bg-paper text-[10px] sm:text-xs text-ink animate-jitter-soft">
              <span className="text-[hsl(var(--accent))]">K</span> {hud.dashCooldown.toFixed(1)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
