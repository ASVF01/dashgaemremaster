import { useEffect, useState } from "react";
import { isGamepadBlocked, safeGetGamepads } from "@/game/gamepad";

// Tiny on-screen HUD that polls navigator.getGamepads() and prints what the
// browser sees. Use this to diagnose "my controller does nothing" reports —
// it tells us whether the browser detected the pad at all, what id/mapping
// it reported, and which button indices fire when you press things.
//
// Toggle with the "G" key. Hidden by default.

type Snapshot = {
  index: number;
  id: string;
  mapping: string;
  connected: boolean;
  blocked: boolean;
  axes: number[];
  buttons: { i: number; pressed: boolean; value: number }[];
} | null;

export default function GamepadDebug() {
  const [visible, setVisible] = useState(false);
  const [snap, setSnap] = useState<Snapshot>(null);
  const [evt, setEvt] = useState<string>("(no gamepad events yet)");

  // Toggle with G
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyG" && !e.repeat) setVisible((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Listen to connect/disconnect so we know the browser saw the pad
  useEffect(() => {
    const onConn = (e: GamepadEvent) =>
      setEvt(`connected: ${e.gamepad.id} (mapping=${e.gamepad.mapping})`);
    const onDisc = (e: GamepadEvent) =>
      setEvt(`disconnected: ${e.gamepad.id}`);
    window.addEventListener("gamepadconnected", onConn);
    window.addEventListener("gamepaddisconnected", onDisc);
    return () => {
      window.removeEventListener("gamepadconnected", onConn);
      window.removeEventListener("gamepaddisconnected", onDisc);
    };
  }, []);

  // Poll while visible
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const tick = () => {
      const blocked = isGamepadBlocked();
      const pads = blocked ? [] : safeGetGamepads();
      let gp: Gamepad | null = null;
      for (const p of pads) if (p && p.connected) { gp = p; break; }
      if (!gp) {
        setSnap(blocked ? {
          index: -1,
          id: "Gamepad API blocked by this preview/browser",
          mapping: "blocked",
          connected: false,
          blocked: true,
          axes: [],
          buttons: [],
        } : null);
      } else {
        setSnap({
          index: gp.index,
          id: gp.id,
          mapping: gp.mapping,
          connected: gp.connected,
          blocked: false,
          axes: Array.from(gp.axes).map((a) => Math.round(a * 100) / 100),
          buttons: gp.buttons.map((b, i) => ({
            i,
            pressed: typeof b === "object" ? b.pressed : (b as unknown as number) > 0.5,
            value: Math.round((typeof b === "object" ? b.value : (b as unknown as number)) * 100) / 100,
          })),
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-2 right-2 z-[9999] max-w-[420px] bg-black/85 text-green-300 font-mono text-[11px] p-3 rounded shadow-2xl border border-green-500/40 pointer-events-none"
      style={{ whiteSpace: "pre-wrap" }}
    >
      <div className="text-yellow-300 mb-1">[GAMEPAD DEBUG] press G to hide</div>
      <div className="text-white/80 mb-2">event: {evt}</div>
      {!snap && (
        <div className="text-red-300">
          no gamepad detected.{"\n"}
          → press a button on the controller while this preview has focus.{"\n"}
          → some browsers require an actual click in the page first.
        </div>
      )}
      {snap && (
        <>
          {snap.blocked && <div className="text-red-300 mb-1">API blocked here — open the published/full preview if needed.</div>}
          <div>id: {snap.id}</div>
          <div>mapping: {snap.mapping}</div>
          <div>axes: [{snap.axes.join(", ")}]</div>
          <div className="mt-1">buttons (only pressed shown):</div>
          {snap.buttons.filter((b) => b.pressed || b.value > 0.05).map((b) => (
            <div key={b.i}>
              #{b.i} → {b.pressed ? "DOWN" : "    "} val={b.value}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
