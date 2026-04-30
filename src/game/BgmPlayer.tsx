import { useEffect, useRef, useState } from "react";
import { setBgmMuted, isBgmMuted } from "@/game/bgm";
import bgmJustRunBro from "@/assets/audio/bgm_just_run_bro_ts.wav";
import bgmMenu from "@/assets/audio/bgm_menu.mp3";
import bgmChampionPlay from "@/assets/audio/bgm_champion_play.mp3";
import bgmChampionDuel2 from "@/assets/audio/bgm_champion_duel2.mp3";
import bgmTutorial from "@/assets/audio/bgm_tutorial.mp3";
import bgmStarman from "@/assets/audio/bgm_starman.mp3";
import bgmSomSom from "@/assets/audio/a_lil_som_som.mp3";
import bgmMap1 from "@/assets/audio/bgm_map1.mp3";
import bgmBlackKnife from "@/assets/audio/black_knife.mp3";

type Track = { id: string; title: string; src: string };

const TRACKS: Track[] = [
  { id: "menu",     title: "Menu Theme",                src: bgmMenu },
  { id: "tutorial", title: "Tutorial Vibes",            src: bgmTutorial },
  { id: "champion", title: "Champion Play",             src: bgmChampionPlay },
  { id: "duel2",    title: "Champion Duel II (chase)",  src: bgmChampionDuel2 },
  { id: "jrb",      title: "Just Run Bro",              src: bgmJustRunBro },
  { id: "map1",     title: "Map 1 (speed test)",        src: bgmMap1 },
  { id: "starman",  title: "Starman",                   src: bgmStarman },
  { id: "somsom",   title: "A Lil Som Som",             src: bgmSomSom },
  { id: "knight",   title: "Black Knife (Roaring Knight)", src: bgmBlackKnife },
];

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(0.7);
  // Remember whether we muted the game BGM so we can restore it on stop.
  const mutedGameRef = useRef(false);

  // ---- Audio visualizer (AnalyserNode -> canvas) ----
  const vizCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const beatPulseRef = useRef(0);
  const lastBassRef = useRef(0);

  // Lazily build the audio graph on the first play (needs a user gesture).
  const ensureAnalyser = () => {
    const a = audioRef.current;
    if (!a || sourceRef.current) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ac = new Ctx();
      const src = ac.createMediaElementSource(a);
      const an = ac.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.78;
      src.connect(an);
      an.connect(ac.destination);
      audioCtxRef.current = ac;
      analyserRef.current = an;
      sourceRef.current = src;
    } catch { /* element already wired or blocked */ }
  };

  // Draw loop: bars + reactive beat ring.
  useEffect(() => {
    const draw = () => {
      const an = analyserRef.current;
      const cvs = vizCanvasRef.current;
      if (an && cvs) {
        const ctx = cvs.getContext("2d");
        if (ctx) {
          // Hi-DPI sizing on the fly.
          const dpr = window.devicePixelRatio || 1;
          const cssW = cvs.clientWidth;
          const cssH = cvs.clientHeight;
          if (cvs.width !== cssW * dpr || cvs.height !== cssH * dpr) {
            cvs.width = cssW * dpr;
            cvs.height = cssH * dpr;
          }
          const W = cvs.width, H = cvs.height;
          const data = new Uint8Array(an.frequencyBinCount);
          an.getByteFrequencyData(data);

          // Beat detection: simple bass-energy delta on lowest ~6 bins.
          let bass = 0;
          for (let i = 0; i < 6; i++) bass += data[i];
          bass /= 6 * 255;
          const delta = Math.max(0, bass - lastBassRef.current);
          lastBassRef.current = bass * 0.86 + lastBassRef.current * 0.14;
          if (delta > 0.07) beatPulseRef.current = Math.min(1, beatPulseRef.current + delta * 2.2);
          beatPulseRef.current *= 0.92;

          // Background — paper-tinted with a subtle pulse.
          ctx.clearRect(0, 0, W, H);
          const pulse = beatPulseRef.current;
          ctx.fillStyle = `rgba(20,20,20,${0.04 + pulse * 0.18})`;
          ctx.fillRect(0, 0, W, H);

          // Bars
          const bars = 48;
          const step = Math.floor(data.length / bars);
          const bw = W / bars;
          for (let i = 0; i < bars; i++) {
            let v = 0;
            for (let k = 0; k < step; k++) v += data[i * step + k];
            v = v / step / 255; // 0..1
            const bh = Math.pow(v, 1.2) * H * 0.92;
            const x = i * bw;
            const y = H - bh;
            // Color: ink with accent tint scaling on energy + beat.
            const intensity = Math.min(1, v + pulse * 0.5);
            const r = Math.round(20 + intensity * 235);
            const g = Math.round(20 + intensity * 60);
            const b = Math.round(20 + (1 - intensity) * 60);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x + 1, y, Math.max(1, bw - 2), bh);
          }

          // Beat ring overlay
          if (pulse > 0.05) {
            ctx.save();
            ctx.globalAlpha = pulse * 0.6;
            ctx.strokeStyle = `rgb(255,${Math.round(60 + pulse * 120)},80)`;
            ctx.lineWidth = 2 + pulse * 6;
            ctx.beginPath();
            ctx.arc(W / 2, H / 2, Math.min(W, H) * (0.18 + pulse * 0.18), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Restore game BGM on unmount.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) { a.pause(); }
      if (mutedGameRef.current) {
        setBgmMuted(false);
        mutedGameRef.current = false;
      }
      try { audioCtxRef.current?.close(); } catch { /* noop */ }
    };
  }, []);

  // Sync audio element volume.
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  const track = TRACKS[idx];

  const play = async (newIdx?: number) => {
    const a = audioRef.current;
    if (!a) return;
    if (newIdx != null && newIdx !== idx) {
      setIdx(newIdx);
      // wait a tick so src updates before we play
      requestAnimationFrame(() => { play(); });
      return;
    }
    // Mute game BGM while the jukebox is playing so they don't overlap.
    if (!isBgmMuted()) {
      setBgmMuted(true);
      mutedGameRef.current = true;
    }
    ensureAnalyser();
    try { await audioCtxRef.current?.resume(); } catch { /* noop */ }
    try { await a.play(); setPlaying(true); } catch { /* user gesture needed */ }
  };

  const pause = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setPlaying(false);
  };

  const stop = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setPlaying(false);
    if (mutedGameRef.current) {
      setBgmMuted(false);
      mutedGameRef.current = false;
    }
  };

  const next = () => play((idx + 1) % TRACKS.length);
  const prev = () => play((idx - 1 + TRACKS.length) % TRACKS.length);

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const v = Number(e.target.value);
    a.currentTime = v;
    setTime(v);
  };

  return (
    <div className="scribble-border bg-paper p-5">
      <div className="font-marker text-3xl text-ink -rotate-1 mb-3">BGM PLAYER</div>
      <p className="font-scribble text-base text-ink/70 mb-3">
        Listen to every track in the game. Pauses the game music while playing.
      </p>

      <audio
        ref={audioRef}
        src={track.src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur((e.target as HTMLAudioElement).duration || 0)}
        onTimeUpdate={(e) => setTime((e.target as HTMLAudioElement).currentTime || 0)}
        onEnded={() => next()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Now playing */}
      <div className="scribble-border bg-paper p-3 mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-scribble text-sm text-ink/60 uppercase">Now Playing</div>
          <div className="font-marker text-2xl text-ink">{track.title}</div>
        </div>
        <div className="font-scribble text-lg text-ink/70 tabular-nums">
          {fmt(time)} / {fmt(dur)}
        </div>
      </div>

      {/* Visualizer */}
      <div className="scribble-border bg-paper p-1 mb-3 relative overflow-hidden">
        <canvas
          ref={vizCanvasRef}
          className="block w-full h-24 sm:h-28"
          aria-hidden="true"
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none font-marker text-xl text-ink/40">
            ♪ press play ♪
          </div>
        )}
      </div>

      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={dur || 0}
        step={0.01}
        value={Math.min(time, dur || 0)}
        onChange={seek}
        className="w-full mb-3 accent-[hsl(var(--accent))]"
        aria-label="Seek"
      />

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button
          onClick={prev}
          className="scribble-border bg-paper px-3 py-1.5 font-marker text-lg text-ink hover:-rotate-2 transition-transform"
        >
          ⏮ PREV
        </button>
        {playing ? (
          <button
            onClick={pause}
            className="scribble-border bg-ink text-paper px-4 py-1.5 font-marker text-lg hover:rotate-1 transition-transform"
          >
            ❚❚ PAUSE
          </button>
        ) : (
          <button
            onClick={() => play()}
            className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground px-4 py-1.5 font-marker text-lg hover:-rotate-2 transition-transform"
          >
            ▶ PLAY
          </button>
        )}
        <button
          onClick={stop}
          className="scribble-border bg-paper px-3 py-1.5 font-marker text-lg text-ink hover:rotate-2 transition-transform"
        >
          ■ STOP
        </button>
        <button
          onClick={next}
          className="scribble-border bg-paper px-3 py-1.5 font-marker text-lg text-ink hover:-rotate-2 transition-transform"
        >
          NEXT ⏭
        </button>
        <label className="ml-auto flex items-center gap-2 font-scribble text-base text-ink/80">
          VOL
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-32 accent-[hsl(var(--accent))]"
            aria-label="Volume"
          />
        </label>
      </div>

      {/* Track list */}
      <div className="font-marker text-xl text-ink/70 mb-2">TRACKS</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {TRACKS.map((t, i) => {
          const active = i === idx;
          return (
            <button
              key={t.id}
              onClick={() => play(i)}
              className={[
                "scribble-border font-marker text-lg px-3 py-2 text-left transition-transform hover:-rotate-1",
                active ? "bg-ink text-paper" : "bg-paper text-ink",
              ].join(" ")}
            >
              {active && playing ? "♪ " : "▶ "}{t.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
