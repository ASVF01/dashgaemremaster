import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/game/settings";

export default function FpsOverlay() {
  const [settings] = useSettings();
  const [fps, setFps] = useState(0);
  const framesRef = useRef(0);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    if (!settings.showFps) return;
    let raf = 0;
    const tick = () => {
      framesRef.current += 1;
      const now = performance.now();
      const elapsed = now - lastRef.current;
      if (elapsed >= 500) {
        setFps(Math.round((framesRef.current * 1000) / elapsed));
        framesRef.current = 0;
        lastRef.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [settings.showFps]);

  if (!settings.showFps) return null;
  return (
    <div className="absolute top-2 right-2 z-50 scribble-border bg-paper px-2 py-1 font-marker text-base text-ink pointer-events-none">
      {fps} FPS
    </div>
  );
}
