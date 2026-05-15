import { MACH_COLORS, MACH_LABELS } from "@/game/constants";
import type { HudState } from "@/game/GameCanvas";

export default function Hud({ hud }: { hud: HudState }) {
  const machColor = MACH_COLORS[hud.mach];
  const machLabel = MACH_LABELS[hud.mach];
  const seconds = (hud.timeMs / 1000).toFixed(2);
  const sm = !!hud.starman;
  const ss = !!hud.somSom; // som-som variant: cyan instead of rainbow
  const invBarClass = ss ? "" : "rainbow-bar";
  const speedBarClass = ss ? "" : "rainbow-bar rainbow-bar-slow";
  const invBarBg = ss ? "#22e2ff" : undefined;

  return (
    <div className="hud-touch-pad pointer-events-none absolute inset-0 p-2 sm:p-4 flex flex-col gap-1.5 sm:gap-2">
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

        {/* TIMER */}
        <div className="scribble-border bg-paper px-2 sm:px-4 py-1 sm:py-2">
          <div className="font-bungee text-ink text-lg sm:text-2xl leading-none">{seconds}<span className="text-[10px] sm:text-sm">s</span></div>
        </div>

        {/* SCORE */}
        <div className="scribble-border bg-paper px-2 sm:px-3 py-1 sm:py-2 text-right">
          <div className="font-marker text-ink text-base sm:text-xl leading-none">{hud.score}</div>
          {hud.combo > 1 && (
            <div className="font-marker text-[hsl(var(--accent))] text-[10px] sm:text-sm animate-jitter">x{hud.combo} COMBO!!</div>
          )}
        </div>
      </div>

      {/* mach indicator (bottom-left) */}
      <div className="mt-auto flex items-end justify-between gap-1.5 sm:gap-2 flex-wrap">
        <div className="scribble-border bg-paper px-1.5 sm:px-2 py-1 sm:py-1.5 min-w-[120px] sm:min-w-[180px]">
          <div className="flex items-center justify-between mb-0.5 gap-2">
            <span className="font-marker text-ink text-[9px] sm:text-[10px] tracking-widest">SPEED</span>
            <span
              className={`font-bungee text-[11px] sm:text-sm leading-none ${sm && !ss ? "rainbow-text animate-jitter" : sm && ss ? "animate-jitter" : hud.mach >= 3 ? "animate-jitter" : ""}`}
              style={
                sm && ss
                  ? { color: "#22e2ff", textShadow: "1px 1px 0 #22e2ff55" }
                  : sm
                  ? undefined
                  : { color: machColor, textShadow: hud.mach >= 2 ? `1px 1px 0 ${machColor}55` : "none" }
              }
            >
              {sm ? (ss ? "SPEEDBOI!!" : "INVBOI!!") : machLabel}
            </span>
          </div>
          <div className="h-2 border-2 border-ink bg-paper relative overflow-hidden">
            <div
              className={`h-full transition-[width] duration-75 ${sm ? speedBarClass : ""}`}
              style={{
                width: `${sm ? 100 : Math.min(100, (hud.speed / 980) * 100)}%`,
                background: sm ? invBarBg : machColor,
              }}
            />
            {[0.286, 0.469, 0.653, 0.836].map((p, i) => (
              <div key={i} className="absolute top-0 bottom-0 w-[2px] bg-ink" style={{ left: `${p * 100}%` }} />
            ))}
          </div>
        </div>

        {/* parry meter */}
        <div className="scribble-border bg-paper px-1.5 sm:px-2 py-1 sm:py-1.5">
          <div className="font-marker text-ink text-[9px] sm:text-[10px] tracking-widest mb-0.5">PARRY [J]</div>
          <div
            className={`w-10 sm:w-14 h-2 border-2 border-ink ${sm ? invBarClass : hud.parryReady ? "bg-parry" : "bg-paper"}`}
            style={sm && ss ? { background: "#22e2ff" } : undefined}
          />
        </div>

        {/* dash meter */}
        <div className="scribble-border bg-paper px-1.5 sm:px-2 py-1 sm:py-1.5">
          <div className="font-marker text-ink text-[9px] sm:text-[10px] tracking-widest mb-0.5">DASH [K]</div>
          <div className="w-10 sm:w-14 h-2 border-2 border-ink bg-paper relative overflow-hidden">
            <div
              className={`h-full ${sm ? invBarClass : ""}`}
              style={{
                width: `${sm ? 100 : (1 - Math.min(1, hud.dashCooldown / hud.dashCooldownMax)) * 100}%`,
                background: sm ? invBarBg : hud.dashCooldown <= 0 ? "#22e2ff" : "#7d8a8a",
                transition: "width 75ms linear",
              }}
            />
          </div>
        </div>

        {/* progress (hidden on the smallest screens to save horizontal room) */}
        <div className="hidden sm:block scribble-border bg-paper px-2 py-1.5 flex-1 max-w-xs">
          <div className="font-marker text-ink text-[10px] tracking-widest mb-0.5">LEVEL PROGRESS</div>
          <div className="h-2 border-2 border-ink bg-paper relative">
            <div
              className="h-full bg-ink"
              style={{ width: `${hud.progress * 100}%` }}
            />
            <div
              className="absolute -top-1 w-2 h-4 bg-[hsl(var(--accent))] border-2 border-ink"
              style={{ left: `calc(${hud.progress * 100}% - 4px)` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
