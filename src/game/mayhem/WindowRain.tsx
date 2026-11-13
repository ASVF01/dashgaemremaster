import React, { useEffect, useRef } from "react";

interface WindowRainProps {
  lightning?: boolean;
}

export const WindowRain: React.FC<WindowRainProps> = ({ lightning }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightningRef = useRef(Boolean(lightning));
  lightningRef.current = Boolean(lightning);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const width = 160;
    const height = 160;
    canvas.width = width;
    canvas.height = height;

    const drops = Array.from({ length: 32 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: -35 - Math.random() * 30,
      vy: 220 + Math.random() * 140,
      len: 8 + Math.random() * 7,
    }));

    let timer: number | undefined;
    let lastTime = performance.now();
    const frameInterval = 1000 / 24;
    const render = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      for (const drop of drops) {
        drop.x += drop.vx * dt;
        drop.y += drop.vy * dt;

        if (drop.y > height + drop.len || drop.x < -12) {
          drop.x = Math.random() * (width + 20);
          drop.y = -drop.len - Math.random() * 12;
        }

        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 1.5, drop.y - drop.len);
      }

      ctx.strokeStyle = lightningRef.current
        ? "hsl(205 95% 88% / 0.9)"
        : "hsl(200 45% 75% / 0.48)";
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.stroke();
      timer = window.setTimeout(render, frameInterval);
    };

    const onVisibilityChange = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (!document.hidden) {
        lastTime = performance.now();
        timer = window.setTimeout(render, frameInterval);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!document.hidden) timer = window.setTimeout(render, frameInterval);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="mo-window-rain-canvas"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
};
