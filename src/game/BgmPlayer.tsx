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

  // Restore game BGM on unmount.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) { a.pause(); }
      if (mutedGameRef.current) {
        setBgmMuted(false);
        mutedGameRef.current = false;
      }
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
