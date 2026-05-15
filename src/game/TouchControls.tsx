import { useEffect, useRef, useState } from "react";

// Touch overlay that synthesizes the same keyboard codes the game already
// listens for. Reusing the keyboard pipeline keeps every system (cheats,
// dash directionals, super dash hold, parry) working unchanged.
//
// We dispatch keydown/keyup on window. The game's handlers preventDefault
// for arrow keys/Space — that's fine since these are synthetic events.
function fire(type: "keydown" | "keyup", code: string) {
  const evt = new KeyboardEvent(type, {
    code,
    key: code,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(evt);
}

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

type BtnProps = {
  code: string | string[];
  label: string;
  className?: string;
  ariaLabel?: string;
};

function HoldButton({ code, label, className, ariaLabel }: BtnProps) {
  const codes = Array.isArray(code) ? code : [code];
  const heldRef = useRef(false);

  const press = (e: React.PointerEvent) => {
    e.preventDefault();
    if (heldRef.current) return;
    heldRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    codes.forEach((c) => fire("keydown", c));
  };
  const release = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!heldRef.current) return;
    heldRef.current = false;
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    codes.forEach((c) => fire("keyup", c));
  };

  useEffect(() => () => {
    if (heldRef.current) codes.forEach((c) => fire("keyup", c));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      className={
        "select-none touch-none active:scale-95 transition-transform " +
        "scribble-border bg-paper/85 text-ink font-bungee " +
        "flex items-center justify-center pointer-events-auto " +
        (className ?? "")
      }
      style={{ WebkitTapHighlightColor: "transparent", userSelect: "none" }}
    >
      {label}
    </button>
  );
}

export default function TouchControls({ visible }: { visible: boolean }) {
  const [touch, setTouch] = useState(false);

  useEffect(() => { setTouch(isTouchDevice()); }, []);

  if (!visible || !touch) return null;

  // Overlay layout: lives INSIDE the game stage (absolute) so it never
  // pushes the canvas around. Buttons sit at the bottom corners with a
  // translucent background so the action stays visible behind them.
  return (
    <div
      className="absolute inset-0 z-30 pointer-events-none select-none"
      style={{ touchAction: "none" }}
    >
      {/* LEFT cluster: d-pad */}
      <div className="absolute left-2 bottom-2 sm:left-3 sm:bottom-3 flex gap-1.5 sm:gap-2">
        <HoldButton code="ArrowLeft"  label="◀" className="w-12 h-12 sm:w-14 sm:h-14 text-xl" ariaLabel="Move left" />
        <HoldButton code="ArrowRight" label="▶" className="w-12 h-12 sm:w-14 sm:h-14 text-xl" ariaLabel="Move right" />
      </div>

      {/* RIGHT cluster: actions */}
      <div className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3 grid grid-cols-3 gap-1.5 sm:gap-2">
        <HoldButton code="ShiftLeft" label="SLIDE" className="w-12 h-10 sm:w-14 sm:h-12 text-[10px]" />
        <HoldButton code="Space"     label="JUMP"  className="w-12 h-10 sm:w-14 sm:h-12 text-[10px]" />
        <HoldButton code="KeyK"      label="DASH"  className="w-12 h-10 sm:w-14 sm:h-12 text-[10px]" />
        <HoldButton code="KeyJ"      label="PARRY" className="w-12 h-10 sm:w-14 sm:h-12 text-[10px] col-start-2" />
      </div>
    </div>
  );
}
