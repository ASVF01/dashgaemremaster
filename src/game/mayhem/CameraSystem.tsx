import { useEffect, useRef, useState } from "react";
import cam1 from "@/assets/mayhem/cameras/CAM_1_out_of_5.png.asset.json";
import cam2 from "@/assets/mayhem/cameras/CAM_2_out_of_5.png.asset.json";
import cam3 from "@/assets/mayhem/cameras/CAM_3_out_of_5.png.asset.json";
import cam4 from "@/assets/mayhem/cameras/CAM_4_out_of_5.png.asset.json";
import cam5 from "@/assets/mayhem/cameras/CAM_5_out_of_5.png.asset.json";
import panel1 from "@/assets/mayhem/cameras/CTRL_PANEL_1.png.asset.json";
import panel3 from "@/assets/mayhem/cameras/CTRL_PANEL_3.png.asset.json";
import panel4 from "@/assets/mayhem/cameras/CTRL_PANEL_4.png.asset.json";
import panel5 from "@/assets/mayhem/cameras/CTRL_PANEL_5.png.asset.json";
import { mayhemSfx } from "@/game/sfx";

const FEEDS = [cam1.url, cam2.url, cam3.url, cam4.url, cam5.url];
const PANELS: Partial<Record<number, string>> = {
  1: panel1.url,
  3: panel3.url,
  4: panel4.url,
  5: panel5.url,
};

const BUTTONS = [
  { n: 1, left: 7.6, top: 42.2, width: 22.3, height: 17.5 },
  { n: 2, left: 32.6, top: 42.2, width: 22.3, height: 17.5 },
  { n: 3, left: 56.5, top: 42.2, width: 20.7, height: 17.5 },
  { n: 4, left: 7.6, top: 63.3, width: 22.3, height: 17.5 },
  { n: 5, left: 32.6, top: 63.3, width: 22.3, height: 17.5 },
] as const;

export default function CameraSystem({ onClose, enemyCam = null, enemyMoveCount = 0 }: { onClose: () => void; enemyCam?: number | null; enemyMoveCount?: number }) {
  const [camera, setCamera] = useState(1);
  const [controlsReady, setControlsReady] = useState(false);
  const [staticFlash, setStaticFlash] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const staticTimer = useRef<number | null>(null);

  const flashStatic = () => {
    setStaticFlash(true);
    if (staticTimer.current != null) window.clearTimeout(staticTimer.current);
    staticTimer.current = window.setTimeout(() => setStaticFlash(false), 300);
  };

  const selectCamera = (next: number) => {
    if (next === camera) return;
    mayhemSfx.cameraSwitch();
    setCamera(next);
    flashStatic();
  };

  // The animatronic moved while the cameras were up — burst of static.
  const seenMoves = useRef(enemyMoveCount);
  useEffect(() => {
    if (enemyMoveCount !== seenMoves.current) {
      seenMoves.current = enemyMoveCount;
      flashStatic();
    }
  }, [enemyMoveCount]);

  useEffect(() => {
    const timer = window.setTimeout(() => setControlsReady(true), 520);
    return () => {
      window.clearTimeout(timer);
      if (staticTimer.current != null) window.clearTimeout(staticTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (["1", "2", "3", "4", "5"].includes(event.key)) {
        event.preventDefault();
        selectCamera(Number(event.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [camera]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.065;
      current.current.y += (target.current.y - current.current.y) * 0.065;
      if (feedRef.current) {
        feedRef.current.style.transform = `scale(1.08) translate3d(${-current.current.x * 18}px, ${-current.current.y * 11}px, 0)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const close = () => {
    mayhemSfx.cameraClose();
    onClose();
  };

  return (
    <div
      className="mayhem-camera-slide-in absolute inset-0 z-[72] overflow-hidden bg-black"
      onMouseMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        target.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        target.current.y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      }}
      onMouseLeave={() => { target.current.x = 0; target.current.y = 0; }}
    >
      <div ref={feedRef} className="absolute inset-0 will-change-transform">
        <div className="mayhem-camera-entry-zoom absolute inset-0">
          <img
            key={camera}
            src={FEEDS[camera - 1]}
            alt={`Camera ${camera} surveillance feed`}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover mayhem-camera-feed"
          />
          {enemyCam === camera && (
            <div aria-hidden="true" className="pointer-events-none absolute bottom-[18%] left-1/2 h-[34%] w-[13%] -translate-x-1/2">
              <div className="absolute inset-0 rounded-t-[45%] bg-black/85 blur-[1px]" />
              <i className="absolute left-[28%] top-[9%] block h-[4%] w-[10%] rounded-full bg-[hsl(var(--hell-warning))] shadow-[0_0_10px_hsl(var(--hell-warning))]" />
              <i className="absolute left-[60%] top-[9%] block h-[4%] w-[10%] rounded-full bg-[hsl(var(--hell-warning))] shadow-[0_0_10px_hsl(var(--hell-warning))]" />
            </div>
          )}
        </div>

      </div>

      <div aria-hidden="true" className="mayhem-camera-entry-flash pointer-events-none absolute inset-0 z-[73]" />

      <div aria-hidden="true" className="mayhem-camera-scan pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="hell-static pointer-events-none absolute inset-0 opacity-25" />
      {staticFlash && (
        <div
          aria-hidden="true"
          className="hell-static pointer-events-none absolute inset-0 z-[74] animate-[fade-out_0.3s_ease-out_forwards] opacity-70"
        />
      )}

      {controlsReady && <div className="mayhem-camera-controls-pop absolute bottom-[3%] left-[2.5%] z-[75] w-[clamp(150px,20vw,260px)] origin-bottom-left rotate-[4deg]">
        <div className="relative aspect-[184/166] w-full">
          <img
            src={PANELS[camera] ?? panel1.url}
            alt="Camera control unit"
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]"
          />

          {camera === 2 && (
            <div className="pointer-events-none absolute left-[67.9%] top-[4.8%] flex h-[36.2%] w-[27.2%] items-center justify-center bg-[hsl(var(--hell-steel))] font-pixel text-[clamp(10px,1.5vw,20px)] text-white">
              2
            </div>
          )}

          {BUTTONS.map((button) => (
            <button
              key={button.n}
              type="button"
              aria-label={`View camera ${button.n}`}
              aria-pressed={camera === button.n}
              onClick={() => selectCamera(button.n)}
              className={`absolute border-2 transition-colors ${camera === button.n ? "border-white" : "border-transparent hover:border-white/60"}`}
              style={{ left: `${button.left}%`, top: `${button.top}%`, width: `${button.width}%`, height: `${button.height}%` }}
            />
          ))}
        </div>
      </div>}

      <button
        type="button"
        onClick={close}
        className="absolute bottom-4 right-4 z-[76] border border-white/50 bg-black/70 px-3 py-2 font-pixel text-[9px] text-white hover:border-white"
      >
        [ W ] LOWER CAMERAS
      </button>
      <div className="pointer-events-none absolute right-4 top-4 z-[76] font-pixel text-[10px] tracking-[0.3em] text-white/70">
        CAM {camera} / 5
      </div>
    </div>
  );
}