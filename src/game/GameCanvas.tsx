import { useEffect, useRef, useState } from "react";
import {
  GRAVITY, MOVE_ACCEL, MAX_SPEED, FRICTION, JUMP_VEL,
  SLIDE_BOOST, SLIDE_FRICTION, PARRY_WINDOW, PARRY_COOLDOWN, PARRY_BOOST,
  DASH_IMPULSE, DASH_BONUS, DASH_DURATION, DASH_COOLDOWN,
  PLAYER_W, PLAYER_H, SLIDE_H,
  MACH_THRESHOLDS, MACH_COLORS, MACH_LABELS,
  type Particle, type Projectile, type Enemy,
} from "@/game/constants";
import { buildLevel, type Level, type LevelId } from "@/game/level";
import { sketchLine, sketchRect, sketchCircle, jaggedBolt, INK } from "@/game/draw";
import { isPressed, matchesAction, getLiveBinds } from "@/game/keybinds";
import { sfx, unlockAudio } from "@/game/sfx";
import { getSprite, type SpriteState } from "@/game/sprites";

type Keys = Record<string, boolean>;

interface Player {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number;
  facing: 1 | -1;
  onGround: boolean;
  sliding: boolean;
  diving: boolean;
  dashTime: number; // remaining seconds of active dash
  dashCooldown: number;
  dashVx: number;   // locked velocity during current dash
  dashVy: number;
  parrying: number; // remaining seconds of parry active window
  parryCooldown: number;
  invuln: number;
  hp: number;
  hitFlash: number;
  squash: number; // 0..1 transient
  stretch: number; // 0..1 transient
  smearTimer: number;
  alive: boolean;
}

interface Afterimage {
  x: number; y: number; w: number; h: number;
  facing: 1 | -1;
  sliding: boolean;
  diving: boolean;
  state: SpriteState;
  life: number; maxLife: number;
  color: string;
}

interface GameRefs {
  level: Level;
  player: Player;
  projectiles: Projectile[];
  particles: Particle[];
  afterimages: Afterimage[];
  afterTimer: number;
  cameraX: number;
  shake: number;
  freezeFrames: number;
  time: number;
  combo: number;
  comboTimer: number;
  score: number;
  bestMach: number;
  glitch: number;
  startedAt: number;
  finished: boolean;
  finishTime: number;
}

interface Props {
  onHud: (hud: HudState) => void;
  onFinish: (timeMs: number, score: number) => void;
  onDeath: () => void;
  paused: boolean;
  resetKey: number;
  levelId?: LevelId;
}

export interface HudState {
  hp: number;
  mach: number;
  speed: number;
  score: number;
  combo: number;
  progress: number;
  timeMs: number;
  parryReady: boolean;
  dashCooldown: number;
  dashCooldownMax: number;
}

export default function GameCanvas({ onHud, onFinish, onDeath, paused, resetKey, levelId = "scribble-1" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refs = useRef<GameRefs | null>(null);
  const keysRef = useRef<Keys>({});
  const [size, setSize] = useState({ w: 1200, h: 600 });

  // resize
  useEffect(() => {
    const update = () => {
      const w = Math.min(window.innerWidth - 24, 1400);
      const h = Math.min(window.innerHeight - 180, 720);
      setSize({ w, h: Math.max(420, h) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // init / reset
  useEffect(() => {
    const level = buildLevel(levelId);
    refs.current = {
      level,
      player: {
        x: level.spawn.x, y: level.spawn.y,
        vx: 0, vy: 0,
        w: PLAYER_W, h: PLAYER_H,
        facing: 1,
        onGround: false,
        sliding: false,
        diving: false,
        dashTime: 0,
        dashCooldown: 0,
        dashVx: 0, dashVy: 0,
        parrying: 0,
        parryCooldown: 0,
        invuln: 0,
        hp: 3,
        hitFlash: 0,
        squash: 0, stretch: 0, smearTimer: 0,
        alive: true,
      },
      projectiles: [],
      particles: [],
      afterimages: [],
      afterTimer: 0,
      cameraX: 0,
      shake: 0,
      freezeFrames: 0,
      time: 0,
      combo: 0,
      comboTimer: 0,
      score: 0,
      bestMach: 0,
      glitch: 0,
      startedAt: performance.now(),
      finished: false,
      finishTime: 0,
    };
  }, [resetKey, levelId]);

  // keys
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      // parry — bound action
      if (matchesAction(e.code, "parry") && refs.current) {
        unlockAudio();
        const r = refs.current;
        if (r.player.parryCooldown <= 0 && r.player.parrying <= 0) {
          r.player.parrying = PARRY_WINDOW;
          r.player.parryCooldown = PARRY_COOLDOWN + PARRY_WINDOW;
          // i-frames for the entire parry active window so you can't get hit while parrying
          if (r.player.invuln < PARRY_WINDOW) r.player.invuln = PARRY_WINDOW;
          sfx.parryStart();
        }
      }
      // dash — bound action. Direction comes from currently held movement
      // keys (8-way). If nothing is held, dash horizontally in facing dir.
      // Pressing dash + jump together performs a "dash jump".
      if (matchesAction(e.code, "dash") && refs.current) {
        unlockAudio();
        const r = refs.current;
        const p = r.player;
        if (p.dashCooldown <= 0 && p.dashTime <= 0 && p.alive) {
          const k = keysRef.current;
          const b = getLiveBinds();
          let dx = 0, dy = 0;
          if (isPressed(k, "left",  b)) dx -= 1;
          if (isPressed(k, "right", b)) dx += 1;
          // up = jump key currently held; down = slide key currently held
          const jumpAlso = isPressed(k, "jump", b);
          const downHeld = isPressed(k, "slide", b);
          if (jumpAlso) dy -= 1;
          if (downHeld) dy += 1;
          if (dx === 0 && dy === 0) dx = p.facing;
          const len = Math.hypot(dx, dy) || 1;
          const nx = dx / len, ny = dy / len;
          // Impulse: shove in the aimed direction. Existing velocity along
          // that direction is preserved + boosted by DASH_BONUS; perpendicular
          // velocity is kept as-is so momentum carries through.
          const along = p.vx * nx + p.vy * ny;
          const newAlong = Math.max(along, 0) + DASH_IMPULSE + DASH_BONUS;
          // remove old along-component, add the new one
          p.vx += (newAlong - along) * nx;
          p.vy += (newAlong - along) * ny;
          // dash-jump: pressing jump together pops you off the ground too
          if (jumpAlso && p.onGround) {
            p.vy = Math.min(p.vy, -JUMP_VEL);
            p.onGround = false;
            p.squash = 1;
            sfx.jump();
          }
          p.dashTime = DASH_DURATION;        // visual / i-frame window only
          p.dashCooldown = DASH_COOLDOWN;
          p.dashVx = nx; p.dashVy = ny;      // store aim for sprite/afterimage tinting
          p.facing = dx >= 0 ? 1 : -1;
          p.stretch = 1;
          if (p.invuln < DASH_DURATION) p.invuln = DASH_DURATION;
          burst(r, p.x + p.w / 2, p.y + p.h / 2, "#22e2ff", 14, 320);
          sfx.parryStart();
          sfx.mach();
        }
      }
    };
    const up = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const r = refs.current;
      const c = canvasRef.current;
      if (!r || !c) return;
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      if (!paused && !r.finished && r.player.alive) {
        update(r, dt, keysRef.current);
      }
      render(c, r, size.w, size.h);

      // HUD
      const speed = Math.abs(r.player.vx);
      const mach = machTier(speed);
      onHud({
        hp: r.player.hp,
        mach,
        speed,
        score: r.score,
        combo: r.combo,
        progress: Math.min(1, r.player.x / r.level.width),
        timeMs: r.finished ? r.finishTime : performance.now() - r.startedAt,
        parryReady: r.player.parryCooldown <= 0,
        dashCooldown: Math.max(0, r.player.dashCooldown),
        dashCooldownMax: DASH_COOLDOWN,
      });

      if (!r.player.alive && !r.finished) {
        r.finished = true;
        r.finishTime = performance.now() - r.startedAt;
        sfx.die();
        onDeath();
      }
      if (r.finished && r.player.alive && r.finishTime === 0) {
        // shouldn't happen; finish handled in update
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, paused, onHud, onDeath, onFinish]);

  return (
    <canvas
      ref={canvasRef}
      width={size.w}
      height={size.h}
      className="block mx-auto scribble-border bg-paper"
      style={{ imageRendering: "pixelated" }}
    />
  );

  // ----- helpers in closure -----
  function machTier(speed: number) {
    let tier = 0;
    for (let i = MACH_THRESHOLDS.length - 1; i >= 0; i--) {
      if (speed >= MACH_THRESHOLDS[i]) { tier = i; break; }
    }
    return tier;
  }

  function spawnParticle(r: GameRefs, p: Partial<Particle> & { x: number; y: number }) {
    r.particles.push({
      x: p.x, y: p.y,
      vx: p.vx ?? 0, vy: p.vy ?? 0,
      life: p.life ?? 0.4, maxLife: p.life ?? 0.4,
      color: p.color ?? "#141414",
      size: p.size ?? 3,
      kind: p.kind ?? "spark",
      angle: p.angle ?? 0,
    });
  }

  function burst(r: GameRefs, x: number, y: number, color: string, n = 14, speed = 280) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawnParticle(r, {
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
        color, size: 2 + Math.random() * 3,
        life: 0.35 + Math.random() * 0.3,
        kind: Math.random() < 0.4 ? "shard" : "spark",
        angle: Math.random() * Math.PI,
      });
    }
  }

  function update(r: GameRefs, dt: number, keys: Keys) {
    r.time += dt;
    const p = r.player;
    const onGround = p.onGround;

    // input (bound)
    const b = getLiveBinds();
    const left = isPressed(keys, "left", b);
    const right = isPressed(keys, "right", b);
    const jumpHeld = isPressed(keys, "jump", b);
    const slideHeld = isPressed(keys, "slide", b);

    // horizontal accel
    let dir = 0;
    if (left) dir -= 1;
    if (right) dir += 1;
    if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

    if (dir !== 0) {
      p.vx += dir * MOVE_ACCEL * dt;
    } else {
      // friction (more if not sliding)
      const fr = p.sliding ? SLIDE_FRICTION : FRICTION;
      const sign = Math.sign(p.vx);
      const mag = Math.max(0, Math.abs(p.vx) - fr * dt);
      p.vx = sign * mag;
    }

    // slide (ground) / dive (air) — both on the slide button
    if (slideHeld && onGround && !p.sliding && Math.abs(p.vx) > 120) {
      p.sliding = true;
      p.h = SLIDE_H;
      p.y += PLAYER_H - SLIDE_H;
      // boost in facing dir
      p.vx += p.facing * SLIDE_BOOST;
      spawnParticle(r, { x: p.x, y: p.y + p.h, vx: -p.facing * 200, vy: -80, color: INK, life: 0.4, size: 4, kind: "smear" });
      sfx.slide();
    }
    // dive — pressed while airborne
    if (slideHeld && !onGround && !p.diving) {
      p.diving = true;
      p.vx += p.facing * 260;
      p.vy = Math.max(p.vy + 200, 520);
      p.stretch = 1;
      spawnParticle(r, { x: p.x + p.w / 2, y: p.y, vx: -p.facing * 120, vy: -60, color: INK, life: 0.35, size: 3, kind: "smear" });
      sfx.slide();
    }
    if (!slideHeld && p.sliding) {
      // try to stand
      const above = !collidesAt(r, p.x, p.y - (PLAYER_H - SLIDE_H), p.w, PLAYER_H);
      if (above) {
        p.y -= PLAYER_H - SLIDE_H;
        p.h = PLAYER_H;
        p.sliding = false;
      }
    }

    // jump (also cancels dive when grounded — handled by jump flow naturally)
    if (jumpHeld && onGround) {
      p.vy = -JUMP_VEL;
      p.onGround = false;
      p.squash = 1;
      p.diving = false;
      spawnParticle(r, { x: p.x + p.w / 2, y: p.y + p.h, color: INK, vy: -40, life: 0.3, size: 4, kind: "ring" });
      sfx.jump();
    }
    // variable jump
    if (!jumpHeld && p.vy < -300) p.vy = -300;

    // speed cap (dash impulse can briefly exceed it; we let momentum carry)
    const speedCap = MAX_SPEED + (p.sliding ? 120 : 0) + (p.dashTime > 0 ? 600 : 0);
    if (Math.abs(p.vx) > speedCap) p.vx = Math.sign(p.vx) * speedCap;

    // gravity — always on; dash no longer freezes vertical motion
    p.vy += GRAVITY * dt;
    if (p.vy > 1400) p.vy = 1400;

    // dash visual / i-frame window timer (velocity is no longer locked)
    if (p.dashTime > 0) p.dashTime -= dt;
    if (p.dashCooldown > 0) p.dashCooldown -= dt;

    // parry timers
    if (p.parrying > 0) p.parrying -= dt;
    if (p.parryCooldown > 0) p.parryCooldown -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 4);
    if (p.stretch > 0) p.stretch = Math.max(0, p.stretch - dt * 4);
    if (p.smearTimer > 0) p.smearTimer -= dt;

    // move + collide axis-separated
    moveAxis(r, "x", p.vx * dt);
    moveAxis(r, "y", p.vy * dt);

    // out of world death
    if (p.y > r.level.height + 200) {
      p.alive = false;
    }

    // mach particles
    const speed = Math.abs(p.vx);
    const mach = machTier(speed);
    if (mach > r.bestMach) { r.bestMach = mach; if (mach >= 1) sfx.mach(); }

    // afterimages — spawn when fast, diving, or dashing
    r.afterTimer -= dt;
    if ((mach >= 1 || p.diving || p.dashTime > 0) && r.afterTimer <= 0) {
      r.afterTimer = p.dashTime > 0 ? 0.012 : Math.max(0.018, 0.05 - mach * 0.008);
      const life = 0.2;
      const aiState: SpriteState =
        p.dashTime > 0 ? "dash" :
        p.diving ? "dive" :
        p.sliding ? "slide" :
        !p.onGround ? (p.vy > 60 ? "fall" : "jump") :
        Math.abs(p.vx) > 60 ? "run" :
        "idle";
      r.afterimages.push({
        x: p.x, y: p.y, w: p.w, h: p.h,
        facing: p.facing,
        sliding: p.sliding,
        diving: p.diving,
        state: aiState,
        life, maxLife: life,
        color: p.dashTime > 0 ? "#22e2ff" : p.diving ? "#ffd11a" : MACH_COLORS[Math.max(1, mach)],
      });
      if (r.afterimages.length > 32) r.afterimages.shift();
    }
    for (const ai of r.afterimages) ai.life -= dt;
    r.afterimages = r.afterimages.filter((a) => a.life > 0);

    // Thin speed lines while running on the ground (any speed above a small threshold).
    if (p.onGround && Math.abs(p.vx) > 140 && Math.random() < 0.55) {
      const len = 14 + Math.random() * 18 + Math.min(40, Math.abs(p.vx) * 0.04);
      spawnParticle(r, {
        x: p.x + p.w / 2 - p.facing * (p.w * 0.4 + Math.random() * 30),
        y: p.y + 4 + Math.random() * (p.h - 8),
        vx: -p.facing * (Math.abs(p.vx) * 0.5 + 80),
        vy: 0,
        color: "#ffffff",
        size: len / 2,
        life: 0.18 + Math.random() * 0.12,
        kind: "smear",
      });
    }

    // (mach color trail removed — speed lines + afterimage handle the feedback)

    // combo decay
    if (r.comboTimer > 0) {
      r.comboTimer -= dt;
      if (r.comboTimer <= 0) r.combo = 0;
    }
    if (r.shake > 0) r.shake = Math.max(0, r.shake - dt * 3);
    if (r.glitch > 0) r.glitch = Math.max(0, r.glitch - dt * 4);

    // enemies update
    for (const e of r.level.enemies) {
      if (!e.alive) continue;
      if (e.hitFlash && e.hitFlash > 0) e.hitFlash -= dt;
      if (e.kind === "grunt") {
        e.x += e.vx * dt;
        // simple ledge / wall turn
        const ahead = collidesAt(r, e.x + (e.vx > 0 ? e.w : -2), e.y, 2, e.h);
        const groundAhead = collidesAt(r, e.x + (e.vx > 0 ? e.w + 2 : -4), e.y + e.h + 2, 2, 4);
        if (ahead || !groundAhead) e.vx = -e.vx;
      } else if (e.kind === "shooter") {
        e.shootTimer = (e.shootTimer ?? 1.2) - dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 1.4 + Math.random() * 0.6;
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const sp = 380;
          r.projectiles.push({
            x: e.x + e.w / 2, y: e.y + e.h / 2,
            vx: (dx / len) * sp, vy: (dy / len) * sp - 30,
            r: 7, alive: true, danger: true,
          });
          sfx.shoot();
        }
      } else if (e.kind === "chaser") {
        // Pursue forward at base speed; if the player gets too far ahead,
        // catch up faster. Stay glued to the floor.
        const stunned = (e.stunTimer ?? 0) > 0;
        if (stunned) {
          e.stunTimer = (e.stunTimer ?? 0) - dt;
          // ride out knockback velocity then settle
          e.x += e.vx * dt;
          e.vx *= 1 - Math.min(1, dt * 2.5);
        } else {
          const base = e.baseSpeed ?? 360;
          const gap = (p.x) - (e.x + e.w);
          // if player pulls ahead, accelerate up to +60% to catch up
          const catchup = Math.max(1, Math.min(1.6, gap / 600));
          e.vx = base * catchup;
          e.x += e.vx * dt;
        }
        e.y = (r.level.height - 80) - e.h; // pin to ground
      }

      // enemy vs player
      if (rectOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
        if (e.kind === "chaser") {
          // Chaser is unkillable — only parry pushes it back.
          if (p.parrying > 0) {
            // shove it backwards a long way + stun
            e.vx = -1400;
            e.stunTimer = 0.9;
            parrySuccess(r, e.x + e.w / 2, e.y + e.h / 2);
            e.hitFlash = 0.2;
          } else if (p.invuln <= 0) {
            damage(r, e.x + e.w / 2, e.y + e.h / 2);
          }
        } else if (p.vy > 80 && p.y + p.h - 20 < e.y) {
          // stomp
          e.alive = false;
          p.vy = -520;
          r.combo += 1;
          r.comboTimer = 2.5;
          r.score += 100 * Math.max(1, r.combo);
          burst(r, e.x + e.w / 2, e.y + e.h / 2, "#f5234c", 14);
          r.shake = 0.4;
          sfx.enemyKill();
        } else if (p.parrying > 0) {
          parrySuccess(r, e.x + e.w / 2, e.y + e.h / 2);
          e.alive = false;
        } else if (p.sliding && Math.abs(p.vx) > 350) {
          e.alive = false;
          burst(r, e.x + e.w / 2, e.y + e.h / 2, "#ff7a1a", 18);
          r.combo += 1;
          r.comboTimer = 2.5;
          r.score += 150 * Math.max(1, r.combo);
          r.shake = 0.5;
          sfx.enemyKill();
        } else if (p.invuln <= 0) {
          damage(r, e.x + e.w / 2, e.y + e.h / 2);
        }
      }
    }

    // projectiles
    for (const pr of r.projectiles) {
      if (!pr.alive) continue;
      if (!pr.danger) {
        // homing toward nearest enemy
        let best: Enemy | null = null;
        let bestD = Infinity;
        for (const e of r.level.enemies) {
          if (!e.alive) continue;
          const dx = (e.x + e.w / 2) - pr.x;
          const dy = (e.y + e.h / 2) - pr.y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const dx = (best.x + best.w / 2) - pr.x;
          const dy = (best.y + best.h / 2) - pr.y;
          const len = Math.hypot(dx, dy) || 1;
          const homeSpeed = 620;
          // smoothly steer
          pr.vx += ((dx / len) * homeSpeed - pr.vx) * Math.min(1, dt * 8);
          pr.vy += ((dy / len) * homeSpeed - pr.vy) * Math.min(1, dt * 8);
        } else {
          // no gravity drift for homing shots
          pr.vy *= 1 - Math.min(1, dt * 2);
        }
      } else {
        pr.vy += GRAVITY * 0.25 * dt;
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.x < r.cameraX - 400 || pr.x > r.cameraX + size.w + 400 || pr.y > r.level.height) pr.alive = false;
      // hit player
      if (pr.danger && rectOverlap(p.x, p.y, p.w, p.h, pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2)) {
        if (p.parrying > 0) {
          // reflect — will home next frame
          pr.vx *= -1; pr.vy = -260; pr.danger = false; pr.r = 9;
          parrySuccess(r, pr.x, pr.y);
        } else if (p.invuln <= 0) {
          pr.alive = false;
          damage(r, pr.x, pr.y);
        }
      }
      // reflected projectile kills enemies
      if (!pr.danger) {
        for (const e of r.level.enemies) {
          if (!e.alive) continue;
          if (rectOverlap(e.x, e.y, e.w, e.h, pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2)) {
            e.alive = false;
            pr.alive = false;
            burst(r, e.x + e.w / 2, e.y + e.h / 2, "#b14cff", 14);
            r.combo += 1;
            r.comboTimer = 2.5;
            r.score += 200 * Math.max(1, r.combo);
            r.shake = 0.4;
            sfx.enemyKill();
            break;
          }
        }
      }
    }
    r.projectiles = r.projectiles.filter((x) => x.alive);

    // hazards
    for (const h of r.level.hazards) {
      if (rectOverlap(p.x, p.y, p.w, p.h, h.x, h.y, h.w, h.h)) {
        if (p.parrying > 0) {
          // PARRY ANYTHING — bounce off the hazard
          const cx = h.x + h.w / 2;
          const cy = h.y + h.h / 2;
          const dx = (p.x + p.w / 2) - cx;
          const dy = (p.y + p.h / 2) - cy;
          const len = Math.hypot(dx, dy) || 1;
          p.vx = (dx / len) * (PARRY_BOOST + 200) + p.facing * 120;
          p.vy = -480;
          parrySuccess(r, cx, cy);
        } else if (p.invuln <= 0) {
          damage(r, p.x + p.w / 2, p.y + p.h);
        }
      }
    }

    // pickups
    for (const pk of r.level.pickups) {
      if (pk.collected) continue;
      if (rectOverlap(p.x, p.y, p.w, p.h, pk.x - 10, pk.y - 10, 20, 20)) {
        pk.collected = true;
        r.score += 25;
        burst(r, pk.x, pk.y, "#ffd11a", 8, 180);
        sfx.pickup();
      }
    }

    // particles
    for (const pa of r.particles) {
      pa.life -= dt;
      pa.vy += 600 * dt * (pa.kind === "smear" ? 0 : 1);
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      if (pa.angle !== undefined) pa.angle += dt * 8;
    }
    r.particles = r.particles.filter((x) => x.life > 0);

    // goal
    const g = r.level.goal;
    if (rectOverlap(p.x, p.y, p.w, p.h, g.x, g.y, g.w, g.h)) {
      r.finished = true;
      r.finishTime = performance.now() - r.startedAt;
      r.score += Math.max(0, 5000 - Math.floor(r.finishTime / 10));
      sfx.win();
      onFinish(r.finishTime, r.score);
    }

    // camera follow with lookahead
    const targetCam = p.x - size.w * 0.35 + p.facing * 80 + p.vx * 0.12;
    r.cameraX += (targetCam - r.cameraX) * Math.min(1, dt * 6);
    if (r.cameraX < 0) r.cameraX = 0;
    if (r.cameraX > r.level.width - size.w) r.cameraX = r.level.width - size.w;
  }

  function damage(r: GameRefs, x: number, y: number) {
    r.player.hp -= 1;
    r.player.invuln = 1.0;
    r.player.hitFlash = 0.4;
    r.player.vx *= -0.3;
    r.player.vy = -380;
    r.combo = 0;
    r.shake = 0.6;
    r.glitch = 0.5;
    burst(r, x, y, "#f5234c", 18, 240);
    sfx.hit();
    if (r.player.hp <= 0) {
      r.player.alive = false;
    }
  }

  function parrySuccess(r: GameRefs, x: number, y: number) {
    r.combo += 2;
    r.comboTimer = 3;
    r.score += 250 * Math.max(1, r.combo);
    r.shake = 0.7;
    r.glitch = 0.7;
    r.freezeFrames = 4;
    r.player.parryCooldown = 0.15; // refund cooldown a bit
    // refresh i-frames briefly so chained parries stay safe
    if (r.player.invuln < 0.4) r.player.invuln = 0.4;
    sfx.parryHit();
    // boost in facing dir
    r.player.vx += r.player.facing * PARRY_BOOST;
    r.player.vy = -220;
    burst(r, x, y, "#fff34a", 22, 380);
    burst(r, x, y, "#22e2ff", 14, 320);
  }

  function moveAxis(r: GameRefs, axis: "x" | "y", delta: number) {
    const p = r.player;
    if (axis === "x") {
      p.x += delta;
      // collide
      for (const pl of r.level.platforms) {
        if (rectOverlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) {
          if (delta > 0) p.x = pl.x - p.w;
          else if (delta < 0) p.x = pl.x + pl.w;
          p.vx = 0;
        }
      }
      // world bounds
      if (p.x < 0) { p.x = 0; p.vx = 0; }
      if (p.x + p.w > r.level.width) { p.x = r.level.width - p.w; p.vx = 0; }
    } else {
      p.y += delta;
      let landed = false;
      for (const pl of r.level.platforms) {
        if (rectOverlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) {
          if (delta > 0) {
            p.y = pl.y - p.h;
            if (!p.onGround && p.vy > 200) { p.squash = 1; sfx.land(); }
            // dive impact — convert to slide, shake, sparks
            if (p.diving) {
              p.diving = false;
              r.shake = Math.max(r.shake, 0.55);
              burst(r, p.x + p.w / 2, pl.y, "#ffd11a", 12, 280);
              if (!p.sliding) {
                p.sliding = true;
                p.h = SLIDE_H;
                p.y = pl.y - p.h;
                p.vx += p.facing * SLIDE_BOOST;
              }
              sfx.land();
            }
            p.vy = 0;
            landed = true;
          } else if (delta < 0) {
            p.y = pl.y + pl.h;
            p.vy = 0;
          }
        }
      }
      p.onGround = landed;
    }
  }

  function collidesAt(r: GameRefs, x: number, y: number, w: number, h: number) {
    for (const pl of r.level.platforms) {
      if (rectOverlap(x, y, w, h, pl.x, pl.y, pl.w, pl.h)) return true;
    }
    return false;
  }

  function rectOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ----- render -----
  function render(c: HTMLCanvasElement, r: GameRefs, w: number, h: number) {
    const ctx = c.getContext("2d")!;
    ctx.save();
    // paper bg
    ctx.fillStyle = "#f0ead6";
    ctx.fillRect(0, 0, w, h);

    // shake
    const shakeX = (Math.random() - 0.5) * r.shake * 16;
    const shakeY = (Math.random() - 0.5) * r.shake * 16;
    ctx.translate(shakeX, shakeY);

    // glitch background flashes
    if (r.glitch > 0) {
      ctx.fillStyle = `rgba(34,226,255,${0.18 * r.glitch})`;
      ctx.fillRect(0, Math.random() * h, w, 8);
      ctx.fillStyle = `rgba(245,35,76,${0.18 * r.glitch})`;
      ctx.fillRect(0, Math.random() * h, w, 6);
    }

    const camX = Math.floor(r.cameraX);
    ctx.translate(-camX, 0);

    // distant scribbled clouds / scenery
    drawScenery(ctx, camX, w, r.level.height);

    // platforms
    for (const pl of r.level.platforms) {
      if (pl.x + pl.w < camX - 40 || pl.x > camX + w + 40) continue;
      const isGround = pl.kind === "ground";
      sketchRect(ctx, pl.x, pl.y, pl.w, pl.h, isGround ? "#e5dfc2" : "#f7f1dc", INK, isGround ? 3 : 2.6, isGround ? 1.6 : 1.2);
      // hatching
      ctx.save();
      ctx.strokeStyle = "rgba(20,20,20,0.35)";
      ctx.lineWidth = 1;
      for (let hx = pl.x + 6; hx < pl.x + pl.w - 4; hx += 14) {
        ctx.beginPath();
        ctx.moveTo(hx, pl.y + 4);
        ctx.lineTo(hx - 6, pl.y + pl.h - 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // tutorial signs (if any)
    if (r.level.signs) {
      ctx.save();
      for (const s of r.level.signs) {
        if (s.x < camX - 200 || s.x > camX + w + 200) continue;
        // post
        sketchLine(ctx, s.x, s.y + 60, s.x, s.y + 110, 3, INK, 1.4);
        // board
        const bw = Math.max(140, ctx.measureText(s.text).width + 40);
        sketchRect(ctx, s.x - bw / 2, s.y, bw, 50, "#fff8d6", INK, 2.6, 1.2);
        ctx.fillStyle = INK;
        ctx.font = "bold 16px 'Permanent Marker', cursive";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.text, s.x, s.y + 25);
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();
    }

    // hazards (spikes - scribbled triangles)
    for (const hz of r.level.hazards) {
      if (hz.x + hz.w < camX - 40 || hz.x > camX + w + 40) continue;
      const teeth = Math.max(3, Math.floor(hz.w / 14));
      ctx.save();
      ctx.fillStyle = "#f5234c";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < teeth; i++) {
        const tx = hz.x + (i * hz.w) / teeth;
        const tw = hz.w / teeth;
        ctx.beginPath();
        ctx.moveTo(tx, hz.y + hz.h);
        ctx.lineTo(tx + tw / 2 + (Math.random() - 0.5) * 2, hz.y - 2);
        ctx.lineTo(tx + tw, hz.y + hz.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // pickups
    for (const pk of r.level.pickups) {
      if (pk.collected) continue;
      if (pk.x < camX - 30 || pk.x > camX + w + 30) continue;
      const bob = Math.sin(r.time * 6 + pk.x) * 3;
      sketchCircle(ctx, pk.x, pk.y + bob, 7, "#ffd11a", INK, 2, 0.8);
      // star sparkle
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(pk.x - 3, pk.y + bob);
      ctx.lineTo(pk.x + 3, pk.y + bob);
      ctx.moveTo(pk.x, pk.y + bob - 3);
      ctx.lineTo(pk.x, pk.y + bob + 3);
      ctx.stroke();
      ctx.restore();
    }

    // enemies
    for (const e of r.level.enemies) {
      if (!e.alive) continue;
      if (e.x + e.w < camX - 40 || e.x > camX + w + 40) continue;
      drawEnemy(ctx, e.x, e.y, e.w, e.h, e.kind, e.vx, r.time);
    }

    // projectiles
    for (const pr of r.projectiles) {
      if (!pr.alive) continue;
      const col = pr.danger ? "#f5234c" : "#22e2ff";
      sketchCircle(ctx, pr.x, pr.y, pr.r, col, INK, 2, 0.8);
      // tail
      jaggedBolt(ctx, pr.x, pr.y, pr.x - pr.vx * 0.04, pr.y - pr.vy * 0.04, col, 2, 4, 4);
    }

    // goal
    drawGoal(ctx, r.level.goal.x, r.level.goal.y, r.level.goal.w, r.level.goal.h, r.time);

    // afterimages — draw before player so player sits on top
    for (const ai of r.afterimages) {
      const t = ai.life / ai.maxLife; // 1 → 0
      drawAfterimage(ctx, ai, t);
    }

    // player
    drawPlayer(ctx, r);

    // particles
    for (const pa of r.particles) {
      const a = Math.max(0, pa.life / pa.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      if (pa.kind === "ring") {
        sketchCircle(ctx, pa.x, pa.y, (1 - a) * 24 + 4, null, pa.color, 2, 1);
      } else if (pa.kind === "smear") {
        ctx.fillStyle = pa.color;
        ctx.fillRect(pa.x - pa.size, pa.y - 2, pa.size * 2, 4);
      } else if (pa.kind === "shard") {
        ctx.fillStyle = pa.color;
        ctx.translate(pa.x, pa.y);
        ctx.rotate(pa.angle ?? 0);
        ctx.fillRect(-pa.size, -1, pa.size * 2, 2);
      } else {
        ctx.fillStyle = pa.color;
        ctx.beginPath();
        ctx.arc(pa.x, pa.y, pa.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // parry flash overlay
    if (r.player.parrying > 0) {
      ctx.save();
      ctx.globalAlpha = 0.4 * (r.player.parrying / PARRY_WINDOW);
      ctx.fillStyle = "#fff34a";
      ctx.beginPath();
      ctx.arc(r.player.x + r.player.w / 2, r.player.y + r.player.h / 2, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // vignette / mach overlay
    const vmach = machTier(Math.abs(r.player.vx));
    if (vmach >= 2) {
      ctx.save();
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${0.15 + vmach * 0.06})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function drawScenery(ctx: CanvasRenderingContext2D, camX: number, w: number, levelH: number) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 14; i++) {
      const baseX = ((i * 480) - (camX * 0.3) % 480 + camX * 0.3);
      const x = baseX;
      const y = 80 + (i % 3) * 50;
      sketchCircle(ctx, x + camX * 0, y, 28 + (i % 4) * 6, null, "rgba(20,20,20,0.4)", 1.4, 1.2);
      sketchCircle(ctx, x + 30, y + 6, 22, null, "rgba(20,20,20,0.4)", 1.4, 1.2);
    }
    // distant mountains
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const baseY = levelH - 90;
    ctx.moveTo(camX - 40, baseY);
    let x = camX - 40;
    while (x < camX + w + 40) {
      const peak = baseY - 100 - Math.sin(x * 0.01) * 60;
      ctx.lineTo(x + 80, peak);
      ctx.lineTo(x + 160, baseY - 30);
      x += 160;
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawAfterimage(ctx: CanvasRenderingContext2D, ai: Afterimage, t: number) {
    // t: 1 (fresh) → 0 (faded)
    const sprite = getSprite(ai.state);
    ctx.save();
    ctx.globalAlpha = 0.55 * t;

    if (sprite) {
      // Match drawPlayer's sizing exactly so the trail fits the PNG.
      const ratio = sprite.width / sprite.height;
      const wide = ratio > 1.1;
      let drawW: number, drawH: number;
      if (ai.state === "slide") {
        drawW = ai.w * 2.2;
        drawH = drawW / ratio;
      } else if (wide) {
        drawH = ai.w * 1.6 / ratio;
        drawW = ai.w * 1.6;
      } else {
        drawH = ai.h;
        drawW = drawH * ratio;
      }
      const dx = ai.x + ai.w / 2 - drawW / 2;
      const dy = ai.y + ai.h - drawH;

      // Flip horizontally for facing without changing the sprite's angle.
      if (ai.facing === -1) {
        ctx.translate(dx + drawW / 2, dy + drawH / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(dx + drawW / 2), -(dy + drawH / 2));
      }

      ctx.imageSmoothingEnabled = false;
      // Just draw the sprite faintly — no solid color overlay (that made a block).
      ctx.globalAlpha = 0.5 * t;
      ctx.drawImage(sprite, dx, dy, drawW, drawH);
      ctx.restore();
      return;
    }

    // Fallback (no sprite loaded): old stick-figure silhouette.
    ctx.fillStyle = ai.color;
    ctx.strokeStyle = ai.color;
    ctx.lineWidth = 2;
    const cx = ai.x + ai.w / 2;
    const cy = ai.y + ai.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(ai.facing, 1);
    ctx.translate(-ai.w / 2, -ai.h / 2);
    if (ai.sliding) {
      ctx.beginPath();
      ctx.ellipse(ai.w / 2, ai.h / 2, ai.w * 0.7, ai.h * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const headR = 12;
      const headX = ai.w / 2;
      const headY = headR + 2;
      ctx.beginPath();
      ctx.arc(headX, headY, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(headX - 6, headY + headR - 4, 12, ai.h - headY - headR - 6, 4);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(ctx: CanvasRenderingContext2D, r: GameRefs) {
    const p = r.player;
    const speed = Math.abs(p.vx);
    const mach = machTier(speed);

    ctx.save();
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.translate(cx, cy);
    // squash & stretch
    const sx = 1 + p.stretch * 0.3 - p.squash * 0.2;
    const sy = 1 - p.stretch * 0.2 + p.squash * 0.3;
    // (running tilt removed — sprite stays upright)
    ctx.scale(sx * p.facing, sy);
    ctx.translate(-p.w / 2, -p.h / 2);

    // hit flash
    const flash = p.hitFlash > 0 && Math.floor(r.time * 30) % 2 === 0;
    const blink = p.invuln > 0 && Math.floor(r.time * 20) % 2 === 0;
    if (blink && p.hitFlash <= 0) {
      ctx.globalAlpha = 0.4;
    }

    const inkCol = flash ? "#f5234c" : INK;

    // ---- sprite override (use uploaded PNG if available for current state) ----
    const state: SpriteState =
      p.dashTime > 0 ? "dash" :
      p.diving ? "dive" :
      p.sliding ? "slide" :
      !p.onGround ? (p.vy > 60 ? "fall" : "jump") :
      Math.abs(p.vx) > 60 ? "run" :
      "idle";
    const sprite = getSprite(state);
    if (sprite) {
      // Fit the sprite to the player AABB. For wide sprites (slide/dive) we
      // size by width so the pose stays readable; for tall sprites we size
      // by height. Either way the sprite is anchored to the bottom of the box.
      const ratio = sprite.width / sprite.height;
      const wide = ratio > 1.1;
      // Slide pose lives inside a square PNG, so force a wider render.
      const slideScale = 2.2;
      let drawW: number, drawH: number;
      if (state === "slide") {
        drawW = p.w * slideScale;
        drawH = drawW / ratio;
      } else if (wide) {
        drawH = p.w * 1.6 / ratio;
        drawW = p.w * 1.6;
      } else {
        drawH = p.h;
        drawW = drawH * ratio;
      }
      const dx = p.w / 2 - drawW / 2;
      const dy = p.h - drawH;
      if (flash) {
        // flash tint: draw red silhouette behind the sprite
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(sprite, dx, dy, drawW, drawH);
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = "#f5234c";
        ctx.fillRect(dx, dy, drawW, drawH);
        ctx.restore();
      } else {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, dx, dy, drawW, drawH);
      }
      ctx.restore();
      return;
    }
    // ---- end sprite override ----

    if (p.sliding) {
      // slide pose
      // body oval
      sketchCircle(ctx, p.w / 2, p.h / 2, 14, "#fff8d6", inkCol, 2.4, 1);
      // head forward
      sketchCircle(ctx, p.w + 6, p.h / 2 - 6, 12, "#fff8d6", inkCol, 2.4, 1);
      drawFace(ctx, p.w + 6, p.h / 2 - 6, 12, inkCol, "wild");
      // trailing arm
      sketchLine(ctx, p.w / 2, p.h / 2, -8, p.h / 2 + 4, 2.6, inkCol, 1.4);
      // legs back
      sketchLine(ctx, p.w / 2 + 4, p.h / 2 + 4, -2, p.h - 2, 2.6, inkCol, 1.4);
      sketchLine(ctx, p.w / 2 + 4, p.h / 2 + 6, -6, p.h - 4, 2.6, inkCol, 1.4);
    } else {
      // head
      const headR = 14;
      const headX = p.w / 2;
      const headY = headR + 2;
      sketchCircle(ctx, headX, headY, headR, "#fff8d6", inkCol, 2.6, 1.2);
      drawFace(ctx, headX, headY, headR, inkCol, mach >= 3 ? "feral" : mach >= 1 ? "intense" : "calm");

      // body
      const bodyTop = headY + headR - 2;
      const bodyBot = p.h - 18;
      sketchLine(ctx, headX, bodyTop, headX + Math.sin(r.time * 14) * 1.5, bodyBot, 3, inkCol, 1.2);

      // arms — flailing when running
      const armPhase = r.time * (8 + mach * 4);
      const armAmp = p.onGround ? 12 + mach * 4 : 8;
      sketchLine(ctx, headX, bodyTop + 4,
        headX - 14, bodyTop + 14 + Math.sin(armPhase) * armAmp, 2.6, inkCol, 1.4);
      sketchLine(ctx, headX, bodyTop + 4,
        headX + 14, bodyTop + 14 + Math.sin(armPhase + Math.PI) * armAmp, 2.6, inkCol, 1.4);

      // legs
      const legPhase = r.time * (10 + mach * 5);
      if (p.onGround) {
        const lx1 = headX - 8 + Math.sin(legPhase) * 8;
        const lx2 = headX + 8 + Math.sin(legPhase + Math.PI) * 8;
        sketchLine(ctx, headX - 4, bodyBot, lx1, p.h, 2.8, inkCol, 1.4);
        sketchLine(ctx, headX + 4, bodyBot, lx2, p.h, 2.8, inkCol, 1.4);
      } else {
        // tucked / extended
        sketchLine(ctx, headX - 4, bodyBot, headX - 8, p.h - 2, 2.8, inkCol, 1.4);
        sketchLine(ctx, headX + 4, bodyBot, headX + 10, p.h - 6, 2.8, inkCol, 1.4);
      }

      // smear frame at high mach
      if (mach >= 3) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = MACH_COLORS[mach];
        ctx.fillRect(-p.w * 0.6, headY - 2, p.w * 0.6, p.h - headY + 6);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, mood: "calm" | "intense" | "feral" | "wild") {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 2;
    // eyes
    if (mood === "calm") {
      ctx.beginPath(); ctx.arc(cx - 4, cy - 2, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy - 2, 1.6, 0, Math.PI * 2); ctx.fill();
      // mouth small
      sketchLine(ctx, cx - 3, cy + 5, cx + 3, cy + 5, 1.6, col, 0.6);
    } else if (mood === "intense") {
      sketchLine(ctx, cx - 7, cy - 4, cx - 1, cy - 1, 2.2, col, 0.6);
      sketchLine(ctx, cx + 1, cy - 1, cx + 7, cy - 4, 2.2, col, 0.6);
      ctx.beginPath(); ctx.arc(cx - 4, cy - 1, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy - 1, 1.6, 0, Math.PI * 2); ctx.fill();
      sketchLine(ctx, cx - 4, cy + 6, cx + 4, cy + 6, 2, col, 0.6);
    } else {
      // feral / wild
      sketchLine(ctx, cx - 8, cy - 5, cx - 1, cy - 2, 2.4, col, 0.8);
      sketchLine(ctx, cx + 1, cy - 2, cx + 8, cy - 5, 2.4, col, 0.8);
      ctx.beginPath(); ctx.arc(cx - 4, cy, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy, 2.4, 0, Math.PI * 2); ctx.fill();
      // big teeth grin
      ctx.save();
      ctx.fillStyle = "#fff8d6";
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 4);
      ctx.lineTo(cx + 8, cy + 4);
      ctx.lineTo(cx + 6, cy + 10);
      ctx.lineTo(cx - 6, cy + 10);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // jagged teeth
      for (let i = -6; i <= 6; i += 3) {
        ctx.beginPath();
        ctx.moveTo(cx + i, cy + 4);
        ctx.lineTo(cx + i + 1.5, cy + 8);
        ctx.lineTo(cx + i + 3, cy + 4);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: "grunt" | "shooter" | "chaser", vx: number, time: number) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    const wobbleA = Math.sin(time * 8) * 0.08;
    ctx.rotate(wobbleA);
    ctx.translate(-w / 2, -h / 2);

    if (kind === "grunt") {
      // angry blob with legs
      sketchCircle(ctx, w / 2, h / 2, 16, "#f5234c", INK, 2.6, 1.4);
      // eyes
      ctx.fillStyle = "#fff8d6";
      ctx.beginPath(); ctx.arc(w / 2 - 5, h / 2 - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2 + 5, h / 2 - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(w / 2 - 5 + Math.sign(vx), h / 2 - 4, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2 + 5 + Math.sign(vx), h / 2 - 4, 1.8, 0, Math.PI * 2); ctx.fill();
      // angry brows
      sketchLine(ctx, w / 2 - 9, h / 2 - 9, w / 2 - 2, h / 2 - 6, 2, INK, 0.6);
      sketchLine(ctx, w / 2 + 2, h / 2 - 6, w / 2 + 9, h / 2 - 9, 2, INK, 0.6);
      // jagged mouth
      ctx.beginPath();
      ctx.moveTo(w / 2 - 6, h / 2 + 4);
      ctx.lineTo(w / 2 - 3, h / 2 + 7);
      ctx.lineTo(w / 2, h / 2 + 4);
      ctx.lineTo(w / 2 + 3, h / 2 + 7);
      ctx.lineTo(w / 2 + 6, h / 2 + 4);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      // legs
      const lp = Math.sin(time * 14) * 4;
      sketchLine(ctx, w / 2 - 6, h - 4, w / 2 - 8, h + 2 + lp, 2.4, INK, 1);
      sketchLine(ctx, w / 2 + 6, h - 4, w / 2 + 8, h + 2 - lp, 2.4, INK, 1);
    } else if (kind === "shooter") {
      // shooter: tall, one big eye, glowing
      sketchRect(ctx, 4, 4, w - 8, h - 8, "#b14cff", INK, 2.6, 1.4);
      sketchCircle(ctx, w / 2, h / 2 - 4, 8, "#fff8d6", INK, 2, 1);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(w / 2 + Math.sin(time * 6) * 2, h / 2 - 4, 3.2, 0, Math.PI * 2); ctx.fill();
      // antenna
      sketchLine(ctx, w / 2, 4, w / 2 + Math.sin(time * 4) * 4, -10, 2, INK, 0.8);
      sketchCircle(ctx, w / 2 + Math.sin(time * 4) * 4, -12, 3, "#22e2ff", INK, 1.8, 0.8);
    } else {
      // CHASER: looming dark scribble wall
      // jagged ink mass
      ctx.fillStyle = "#1a1a1a";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const segs = 10;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const px = t * w;
        const py = Math.sin(time * 6 + i) * 6;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // hungry eyes
      const eyeY = h * 0.35;
      ctx.fillStyle = "#f5234c";
      ctx.beginPath(); ctx.arc(w * 0.35, eyeY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.65, eyeY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff8d6";
      ctx.beginPath(); ctx.arc(w * 0.35 + Math.sin(time * 5) * 1.5, eyeY, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.65 + Math.sin(time * 5) * 1.5, eyeY, 2, 0, Math.PI * 2); ctx.fill();
      // jagged teeth
      ctx.strokeStyle = "#fff8d6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const teethY = h * 0.55;
      for (let i = 0; i < 7; i++) {
        const tx = (i / 6) * (w - 16) + 8;
        ctx.moveTo(tx, teethY);
        ctx.lineTo(tx + 6, teethY + 10);
        ctx.lineTo(tx + 12, teethY);
      }
      ctx.stroke();
      // wispy tendrils trailing behind
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const ty = h * (0.3 + i * 0.18);
        const sway = Math.sin(time * 3 + i) * 8;
        sketchLine(ctx, 0, ty, -22 - i * 6, ty + sway, 2, INK, 0.8);
      }
    }
    ctx.restore();
  }

  function drawGoal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number) {
    // big swirling FINISH flag
    ctx.save();
    sketchLine(ctx, x + w / 2, y - 20, x + w / 2, y + h, 3, INK, 1.6);
    // flag wobble
    const off = Math.sin(time * 4) * 6;
    ctx.fillStyle = "#fff34a";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - 18);
    ctx.lineTo(x + w / 2 + 60, y - 8 + off);
    ctx.lineTo(x + w / 2, y + 12);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = "bold 14px 'Permanent Marker', cursive";
    ctx.fillText("GO!", x + w / 2 + 14, y);
    ctx.restore();
  }
}
