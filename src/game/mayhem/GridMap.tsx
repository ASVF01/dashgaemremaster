import { useEffect, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";
import { GRID_SIZE, OFFICE_CELL, type GridCharacter } from "./useGridRoster";

export default function GridMap({ onClose, characters, moveCount, heat = 0 }: { onClose: () => void; characters: GridCharacter[]; moveCount: number; heat?: number }) {
  const [staticFlash, setStaticFlash] = useState(false);
  const seen = useRef(moveCount);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (moveCount === seen.current) return;
    seen.current = moveCount;
    setStaticFlash(true);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStaticFlash(false), 300);
  }, [moveCount]);
  useEffect(() => () => { if (timer.current != null) window.clearTimeout(timer.current); }, []);

  const close = () => { mayhemSfx.cameraClose(); onClose(); };

  return (
    <div className="mayhem-camera-slide-in absolute inset-0 z-[72] flex items-center justify-center overflow-hidden bg-black">
      <div className="relative aspect-square h-[82vh] max-w-[92vw] border-2 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))] p-1">
        <div className="grid h-full w-full gap-[2px]" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)` }}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
            const x = i % GRID_SIZE, y = Math.floor(i / GRID_SIZE);
            const office = x === OFFICE_CELL.x && y === OFFICE_CELL.y;
            const here = characters.filter((c) => c.x === x && c.y === y);
            return (
              <div key={i} className={`relative flex items-center justify-center border ${office ? "border-white bg-[hsl(var(--hell-panel))]" : "border-[hsl(var(--hell-steel))]/40 bg-[hsl(var(--hell-panel))]/30"}`}>
                {office && <span className="font-pixel text-[clamp(6px,0.8vw,10px)] text-white">HALL ENTRY</span>}
                {here.map((c) => (
                  <span key={c.id} title={c.name} className="absolute inset-[12%] flex items-center justify-center rounded-full font-pixel text-[clamp(6px,0.8vw,10px)] text-black transition-all duration-500" style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }}>
                    {c.tag}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div aria-hidden="true" className="mayhem-camera-scan pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="hell-static pointer-events-none absolute inset-0 opacity-20" />
      {heat > 0.6 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[73] transition-opacity duration-700"
          style={{
            opacity: Math.min(0.5, (heat - 0.6) * 1.4),
            background: "radial-gradient(ellipse at center, rgba(180,20,20,0.15) 0%, rgba(140,0,0,0.55) 100%)",
          }}
        />
      )}
      {staticFlash && <div aria-hidden="true" className="hell-static pointer-events-none absolute inset-0 z-[74] animate-[fade-out_0.3s_ease-out_forwards] opacity-60" />}

      <div className="pointer-events-none absolute left-4 top-4 z-[76] font-pixel text-[10px] tracking-[0.3em] text-white/70">
        TRACKING GRID · {characters.length ? `${characters.length} SIGNAL${characters.length > 1 ? "S" : ""}` : "NO SIGNALS"}
      </div>
      <button type="button" onClick={close} className="absolute bottom-4 right-4 z-[76] border border-white/50 bg-black/70 px-3 py-2 font-pixel text-[9px] text-white hover:border-white">
        [ W ] LOWER MAP
      </button>
    </div>
  );
}
