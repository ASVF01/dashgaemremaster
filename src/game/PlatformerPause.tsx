import { useEffect } from "react";
import { useSettings } from "@/game/settings";
import { sfx, setSfxVolume } from "@/game/sfx";
import { setBgmVolume } from "@/game/bgm";

/** Platformer pause menu: resume, volume, timer toggle, quit to menu. */
export default function PlatformerPause({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  const [settings, setSettings] = useSettings();
  useEffect(() => { setSfxVolume(settings.sfxVolume); }, [settings.sfxVolume]);
  useEffect(() => { setBgmVolume(settings.bgmVolume); }, [settings.bgmVolume]);

  const slider = (label: string, key: "bgmVolume" | "sfxVolume") => (
    <label className="flex flex-col gap-1 font-marker text-sm text-ink">
      <span className="flex justify-between"><span>{label}</span><span>{Math.round(settings[key] * 100)}%</span></span>
      <input type="range" min={0} max={1} step={0.05} value={settings[key]}
        onChange={(e) => setSettings({ [key]: Number(e.target.value) })} className="accent-[hsl(var(--accent))]" />
    </label>
  );

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background/70 px-4">
      <div className="scribble-border bg-paper w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="font-bungee text-ink text-3xl text-center">PAUSED</div>
        <button type="button" className="scribble-border bg-paper py-2 font-bungee text-ink hover:bg-[hsl(var(--accent))]"
          onMouseEnter={() => sfx.menuHover()} onClick={() => { sfx.menuConfirm(); onResume(); }}>RESUME</button>
        {slider("MUSIC", "bgmVolume")}
        {slider("SFX", "sfxVolume")}
        <button type="button" className="flex justify-between font-marker text-sm text-ink" role="switch" aria-checked={settings.showTimer}
          onClick={() => { sfx.menuClick(); setSettings({ showTimer: !settings.showTimer }); }}>
          <span>SHOW TIMER</span><span>{settings.showTimer ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className="scribble-border bg-paper py-2 font-bungee text-ink hover:bg-[hsl(var(--accent))]"
          onMouseEnter={() => sfx.menuHover()} onClick={() => { sfx.menuBack?.(); onQuit(); }}>QUIT TO MENU</button>
      </div>
    </div>
  );
}
