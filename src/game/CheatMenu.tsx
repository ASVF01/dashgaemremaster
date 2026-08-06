import { useEffect, useRef, useState } from "react";
import { sfx } from "@/game/sfx";
import { addTokens } from "@/game/shop";
import { isBgmMuted, pauseBgm, resumeBgm } from "@/game/bgm";
import { isCheatOn, toggleCheat } from "@/game/cheats";
import bgmOpeningAsset from "@/assets/audio/bgm_opening.mp3.asset.json";

type Cheat = {
  code: string;
  label: string;
  hint: string;
  /** what happens when it's armed and you press the trigger key */
  trigger?: string;
};

const CHEATS: Cheat[] = [
  { code: "nicole", label: "MTSIN", hint: "+1000 T per press", trigger: "+" },
  { code: "deadeye", label: "V-LOCK", hint: "every shot is a guaranteed JUST", trigger: "ENTER (toggle)" },
];

export default function CheatMenu() {
  const [typed, setTyped] = useState("");
  const [armed, setArmed] = useState<string[]>([]);
  const [line, setLine] = useState("READY.");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // CRT menu music — takes over while this tab is open
  useEffect(() => {
    const a = new Audio(bgmOpeningAsset.url);
    a.loop = true;
    a.volume = isBgmMuted() ? 0 : 0.4;
    audioRef.current = a;
    pauseBgm();
    void a.play().catch(() => {});
    return () => {
      a.pause();
      a.currentTime = 0;
      audioRef.current = null;
      resumeBgm();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") { setTyped((t) => t.slice(0, -1)); return; }
      if (e.key === "Enter") {
        const code = typed.trim().toLowerCase();
        const found = CHEATS.find((c) => c.code === code);
        if (found) {
          if (!armed.includes(found.code)) setArmed((a) => [...a, found.code]);
          sfx.cheatChime();
          if (found.code === "deadeye") {
            const on = toggleCheat("perfectAim");
            setLine(`V-LOCK ${on ? "ON" : "OFF"} — GUARANTEED JUST`);
          } else {
            setLine(`${found.label} ARMED — PRESS ${found.trigger}`);
          }
        } else {
          sfx.menuBack();
          setLine("BAD CODE.");
        }
        setTyped("");
        return;
      }
      if (armed.includes("nicole") && (e.key === "+" || e.key === "Add" || e.code === "NumpadAdd")) {
        addTokens(1000);
        sfx.menuConfirm();
        setLine("+1000 T GRANTED.");
        return;
      }
      if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
        setTyped((t) => (t + e.key.toLowerCase()).slice(0, 20));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [typed, armed]);

  return (
    <div
      className="relative mx-auto max-w-3xl overflow-hidden rounded-[36px] border-8 border-[#3a3a3a] bg-[#050505] p-8 shadow-[0_0_60px_rgba(0,255,220,0.12)_inset]"
      style={{ transform: "perspective(900px) rotateX(2deg) rotateZ(-0.6deg)" }}
    >
      {/* scanlines + glass glare */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px, transparent 1px, transparent 3px)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,0.85) 100%)" }}
      />
      <div
        className="pointer-events-none absolute -right-10 top-0 h-full w-40 opacity-15"
        style={{ background: "linear-gradient(115deg, transparent, #ffffff 60%, transparent)" }}
      />

      <div className="relative font-mono uppercase tracking-[0.15em] text-[#3ef2d2] [text-shadow:0_0_8px_currentColor]">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-lg sm:grid-cols-3">
          <div>CHEAT</div>
          <div className="bg-[#8bff3a] px-1 text-[#020202] [text-shadow:none]">MTSIN</div>
          <div className="text-[#eafcff]">SEPAL</div>
          <div>CODES</div>
          <div className="text-[#eafcff]">CLOCK</div>
          <div className="text-[#eafcff]">SEPAH</div>
          <div>VIDEO</div>
          <div className="text-[#eafcff]">COLOR</div>
          <div className="text-[#eafcff]">CUT_G</div>
        </div>

        <div className="mt-8 space-y-3 text-lg">
          <div className="flex items-center gap-4">
            <span>H-POS</span>
            <span className="text-[#eafcff]">
              {typed ? typed.toUpperCase() : "_____"}
              <span className="animate-pulse">|</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>VDEF</span>
            <span className="text-[#eafcff]">{line}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>SETID</span>
            <span className="text-[#eafcff]">
              ARMED {armed.length}/{CHEATS.length}
            </span>
          </div>
        </div>

        <div className="mt-8 space-y-1 text-sm text-[#3ef2d2]/70">
          <div>TYPE A CODE, PRESS ENTER.</div>
          {CHEATS.map((c) => (
            <div key={c.code}>
              {armed.includes(c.code)
                ? `${c.label} :: ${c.hint} (PRESS ${c.trigger})`
                : "?????? :: LOCKED"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
