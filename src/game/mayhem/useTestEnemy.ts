// MAYHEM — test animatronic.
//
// It cycles through cameras 1, 3 and 5, walks into the hallway (announcing
// itself if the player isn't standing there), then presses an eye against the
// door keyhole. It gives up and leaves 15 seconds after it appeared.
import { useEffect, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";

export type EnemySpot =
  | { kind: "gone" }
  | { kind: "cam"; cam: number }
  | { kind: "hall" }
  | { kind: "door" };

const CAM_ROUTE = [1, 3, 5];
const CAM_STEP_MS = 3000;
const HALL_MS = 3000;
const PRESENCE_MS = 15000;
const STARE_GRACE_MS = 4200;
const IDLE_MIN_MS = 14000;
const IDLE_MAX_MS = 26000;

export function useTestEnemy(view: string) {
  const [spot, setSpot] = useState<EnemySpot>({ kind: "gone" });
  const [caught, setCaught] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const timers = useRef<number[]>([]);
  const stareTimer = useRef<number | null>(null);
  const staringRef = useRef(false);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const at = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // ---- appearance timeline ----
  useEffect(() => {
    let alive = true;

    const leave = () => {
      if (!alive) return;
      if (stareTimer.current != null) { window.clearTimeout(stareTimer.current); stareTimer.current = null; }
      staringRef.current = false;
      // Cut every sound it just made, then a single footstep away.
      mayhemSfx.animMove();
      setSpot({ kind: "gone" });
      scheduleSpawn();
    };

    const enterHall = () => {
      setSpot({ kind: "hall" });
      // it entered the hallway — announce it unless the player is in there
      if (viewRef.current !== "hallway") mayhemSfx.animInHall();
    };

    const spawn = () => {
      if (!alive) return;
      const route = [...CAM_ROUTE].sort(() => Math.random() - 0.5);
      setSpot({ kind: "cam", cam: route[0] });
      at(CAM_STEP_MS, () => setSpot({ kind: "cam", cam: route[1] }));
      at(CAM_STEP_MS * 2, () => setSpot({ kind: "cam", cam: route[2] }));
      at(CAM_STEP_MS * 3, enterHall);
      at(CAM_STEP_MS * 3 + HALL_MS, () => setSpot({ kind: "door" }));
      at(PRESENCE_MS, leave);
    };

    const scheduleSpawn = () => {
      clearTimers();
      at(IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS), spawn);
    };

    // Debug: [I] instantly puts the test character in the hallway.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "i" && e.key !== "I") return;
      if (!alive) return;
      clearTimers();
      enterHall();
      at(HALL_MS, () => setSpot({ kind: "door" }));
      at(PRESENCE_MS, leave);
    };
    window.addEventListener("keydown", onKey);

    scheduleSpawn();
    return () => {
      window.removeEventListener("keydown", onKey);
      alive = false;
      clearTimers();
      if (stareTimer.current != null) window.clearTimeout(stareTimer.current);
      mayhemSfx.stopAnimSounds();
    };
  }, []);

  // ---- eye-to-eye at the keyhole ----
  useEffect(() => {
    const staring = spot.kind === "door" && view === "keyhole";
    if (staring && !staringRef.current) {
      staringRef.current = true;
      mayhemSfx.animKeyholeStare();
      stareTimer.current = window.setTimeout(() => {
        stareTimer.current = null;
        setCaught(true);
        window.setTimeout(() => setCaught(false), 900);
      }, STARE_GRACE_MS);
    } else if (!staring && staringRef.current) {
      staringRef.current = false;
      if (stareTimer.current != null) { window.clearTimeout(stareTimer.current); stareTimer.current = null; }
      mayhemSfx.stopAnimSounds();
    }
  }, [spot, view]);

  return {
    spot,
    caught,
    enemyCam: spot.kind === "cam" ? spot.cam : null,
    atKeyhole: spot.kind === "door",
  };
}
