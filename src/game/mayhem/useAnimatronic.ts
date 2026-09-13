// MAYHEM — FNAF-style animatronic AI.
//
// Every 5 seconds the game rolls a die (1–20). If the roll is at or under the
// night's AI level, the animatronic moves one step along its route:
// CAM 1 → CAM 3 → CAM 5 → HALLWAY → DOOR/KEYHOLE. At the door it presses an
// eye against the keyhole — stare back for more than 4.2s and it jumpscares;
// otherwise it gives up after 15s and starts its route over.
import { useEffect, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";

export type EnemySpot =
  | { kind: "gone" }
  | { kind: "cam"; cam: number }
  | { kind: "hall" }
  | { kind: "door" };

const ROUTE: EnemySpot[] = [
  { kind: "cam", cam: 1 },
  { kind: "cam", cam: 3 },
  { kind: "cam", cam: 5 },
  { kind: "hall" },
  { kind: "door" },
];

const MOVE_CHECK_MS = 5000;
const PRESENCE_MS = 15000;
const STARE_GRACE_MS = 4200;
const HALL_GLORY_MS = 3100;
const HALL_ANIMATION_MS = 2500;
const SCARE_SHAKE_MS = 1050;
const SCARE_FADE_MS = 650;
const RESPAWN_MIN_MS = 6000;
const RESPAWN_MAX_MS = 12000;

export function useAnimatronic(view: string, aiLevel: number, active = true) {
  const [spot, setSpot] = useState<EnemySpot>({ kind: "gone" });
  const [caught, setCaught] = useState(false);
  const [scare, setScare] = useState<null | "shake" | "fade">(null);
  // Increments on every successful move — the camera system flashes static on it.
  const [moveCount, setMoveCount] = useState(0);
  const [hallAnimating, setHallAnimating] = useState(false);
  const [encounterId, setEncounterId] = useState(0);
  const posRef = useRef(0); // index into ROUTE
  const scareRef = useRef<null | "shake" | "fade">(null);
  const setScarePhase = (phase: null | "shake" | "fade") => {
    scareRef.current = phase;
    setScare(phase);
  };
  const viewRef = useRef(view);
  viewRef.current = view;
  const levelRef = useRef(aiLevel);
  levelRef.current = aiLevel;
  const timers = useRef<number[]>([]);
  const stareTimer = useRef<number | null>(null);
  const staringRef = useRef(false);
  const aliveRef = useRef(true);
  const hallDangerRef = useRef(false);

  const startScare = () => {
    if (!aliveRef.current || scareRef.current) return;
    hallDangerRef.current = false;
    if (stareTimer.current != null) { window.clearTimeout(stareTimer.current); stareTimer.current = null; }
    setCaught(true);
    at(900, () => setCaught(false));
    mayhemSfx.jumpscare();
    setScarePhase("shake");
    at(SCARE_SHAKE_MS, () => setScarePhase("fade"));
    at(SCARE_SHAKE_MS + SCARE_FADE_MS, () => {
      setScarePhase(null);
      setSpot({ kind: "gone" });
      scheduleSpawn();
    });
  };

  const enterHall = () => {
    const playerIsInHall = viewRef.current === "hallway";
    setSpot({ kind: "hall" });
    setHallAnimating(true);
    setEncounterId((id) => id + 1);
    at(HALL_ANIMATION_MS, () => setHallAnimating(false));
    if (playerIsInHall) {
      hallDangerRef.current = true;
      mayhemSfx.animHallEncounter();
      at(HALL_GLORY_MS, () => {
        if (hallDangerRef.current && viewRef.current === "hallway") startScare();
      });
    } else {
      mayhemSfx.animInHall();
    }
  };

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const at = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const spawn = () => {
    if (!aliveRef.current) return;
    posRef.current = 0;
    setSpot(ROUTE[0]);
  };

  const scheduleSpawn = () => {
    at(RESPAWN_MIN_MS + Math.random() * (RESPAWN_MAX_MS - RESPAWN_MIN_MS), spawn);
  };

  // One successful dice roll advances the animatronic one step along the route.
  const advance = () => {
    if (!aliveRef.current || scareRef.current) return;
    if (hallDangerRef.current) return;
    if (posRef.current >= ROUTE.length - 1) return; // already at the door
    posRef.current += 1;
    const next = ROUTE[posRef.current];
    if (next.kind === "hall") enterHall();
    else setSpot(next);
    setMoveCount((c) => c + 1);
    if (next.kind === "door") {
      at(PRESENCE_MS, leave);
    }
  };

  const leave = () => {
    if (!aliveRef.current || scareRef.current) return; // never interrupt a jumpscare
    if (stareTimer.current != null) { window.clearTimeout(stareTimer.current); stareTimer.current = null; }
    staringRef.current = false;
    hallDangerRef.current = false;
    // Cut every sound it just made, then a single footstep away.
    mayhemSfx.animMove();
    setSpot({ kind: "gone" });
    scheduleSpawn();
  };

  // ---- spawn + dice-roll movement loop ----
  useEffect(() => {
    if (!active) return;
    aliveRef.current = true;
    spawn();

    // Movement opportunity every 5s: roll 1–20, move if roll <= AI level.
    const roller = window.setInterval(() => {
      if (!aliveRef.current || scareRef.current) return;
      if (posRef.current >= ROUTE.length - 1) return; // at the door — no more moves
      if (1 + Math.floor(Math.random() * 20) <= levelRef.current) advance();
    }, MOVE_CHECK_MS);

    // Debug: [I] instantly puts the animatronic in the hallway.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "i" && e.key !== "I") return;
      if (!aliveRef.current) return;
      posRef.current = 3; // hall index in ROUTE
      enterHall();
      setMoveCount((c) => c + 1);
      at(HALL_DEBUG_MS, () => {
        if (!aliveRef.current || scareRef.current || hallDangerRef.current) return;
        posRef.current = 4;
        setSpot({ kind: "door" });
        setMoveCount((c) => c + 1);
        at(PRESENCE_MS, leave);
      });
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearInterval(roller);
      aliveRef.current = false;
      clearTimers();
      if (stareTimer.current != null) window.clearTimeout(stareTimer.current);
      mayhemSfx.stopAnimSounds();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Escaping the hallway before glory time expires cancels that encounter.
  useEffect(() => {
    if (view !== "hallway") hallDangerRef.current = false;
  }, [view]);

  // ---- eye-to-eye at the keyhole ----
  useEffect(() => {
    const staring = spot.kind === "door" && view === "keyhole";
    if (staring && !staringRef.current) {
      staringRef.current = true;
      mayhemSfx.animKeyholeStare();
      stareTimer.current = window.setTimeout(() => {
        stareTimer.current = null;
        // Held eye contact too long — jumpscare: shake + scream, after-burn, gone.
        startScare();
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
    scare,
    moveCount,
    hallAnimating,
    encounterId,
    enemyCam: spot.kind === "cam" ? spot.cam : null,
    atKeyhole: spot.kind === "door",
  };
}

const HALL_DEBUG_MS = 5000;
