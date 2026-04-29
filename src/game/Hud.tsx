import { MACH_COLORS, MACH_LABELS } from "@/game/constants";
import type { HudState } from "@/game/GameCanvas";

export default function Hud({ hud }: { hud: HudState }) {
  const machColor = MACH_COLORS[hud.mach];
  const machLabel = MACH_LABELS[hud.mach];
  const seconds = (hud.timeMs / 1000).toFixed(2);
  const sm = !!hud.starman;

  return (
    <div className="pointer-events-none absolute inset-0 p-4 flex flex-col gap-2">
      {/* top row */}
      <div className="flex items-start justify-between gap-4">
        {/* HP */}
        <div className="flex items-center gap-2 scribble-border bg-paper px-3 py-2">
          <span className="font-marker text-ink text-lg">HP</span>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-5 h-5 border-2 border-ink ${i < hud.hp ? "bg-[hsl(var(--accent))]" : "bg-paper"}`}
                style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
              />
            ))}
          </div>
        </div>

        {/* TIMER */}
        <div className="scribble-border bg-paper px-4 py-2">
          <div className="font-bungee text-ink text-2xl leading-none">{seconds}<span className="text-sm">s</span></div>
        </div>

        {/* SCORE */}
        <div className="scribble-border bg-paper px-3 py-2 text-right">
          <div className="font-marker text-ink text-xl leading-none">{hud.score}</div>
          {hud.combo > 1 && (
            <div className="font-marker text-[hsl(var(--accent))] text-sm animate-jitter">x{hud.combo} COMBO!!</div>
          )}
        </div>
      </div>

      {/* mach indicator (bottom-left) */}
      <div className="mt-auto flex items-end justify-between gap-4">
        <div className="scribble-border bg-paper px-4 py-3 min-w-[260px]">
          <div className="flex items-center justify-between mb-1">
            <span className="font-marker text-ink text-sm tracking-widest">SPEED</span>
            <span
              className={`font-bungee text-xl ${hud.mach >= 3 ? "animate-jitter" : ""}`}
              style={{ color: machColor, textShadow: hud.mach >= 2 ? `2px 2px 0 ${machColor}55` : "none" }}
            >
              {machLabel}
            </span>
          </div>
          <div className="h-3 border-2 border-ink bg-paper relative overflow-hidden">
            <div
              className="h-full transition-[width] duration-75"
              style={{
                width: `${Math.min(100, (hud.speed / 980) * 100)}%`,
                background: machColor,
              }}
            />
            {[0.286, 0.469, 0.653, 0.836].map((p, i) => (
              <div key={i} className="absolute top-0 bottom-0 w-[2px] bg-ink" style={{ left: `${p * 100}%` }} />
            ))}
          </div>
        </div>

        {/* parry meter */}
        <div className="scribble-border bg-paper px-4 py-3">
          <div className="font-marker text-ink text-sm tracking-widest mb-1">PARRY [J]</div>
          <div
            className={`w-20 h-3 border-2 border-ink ${hud.parryReady ? "bg-parry" : "bg-paper"}`}
          />
        </div>

        {/* dash meter */}
        <div className="scribble-border bg-paper px-4 py-3">
          <div className="font-marker text-ink text-sm tracking-widest mb-1">DASH [K]</div>
          <div className="w-20 h-3 border-2 border-ink bg-paper relative overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${(1 - Math.min(1, hud.dashCooldown / hud.dashCooldownMax)) * 100}%`,
                background: hud.dashCooldown <= 0 ? "#22e2ff" : "#7d8a8a",
                transition: "width 75ms linear",
              }}
            />
          </div>
        </div>

        {/* progress */}
        <div className="scribble-border bg-paper px-4 py-3 flex-1 max-w-md">
          <div className="font-marker text-ink text-sm tracking-widest mb-1">LEVEL PROGRESS</div>
          <div className="h-3 border-2 border-ink bg-paper relative">
            <div
              className="h-full bg-ink"
              style={{ width: `${hud.progress * 100}%` }}
            />
            <div
              className="absolute -top-1 w-3 h-5 bg-[hsl(var(--accent))] border-2 border-ink"
              style={{ left: `calc(${hud.progress * 100}% - 6px)` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
