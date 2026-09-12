import { useEffect, useState } from "react";
import { mayhemSfx } from "@/game/sfx";

import { useSettings } from "@/game/settings";
import { sfx, setSfxVolume } from "@/game/sfx";
import { setBgmVolume } from "@/game/bgm";

/**
 * MAYHEM pause menu. Covers the whole mode (which itself takes over the
 * screen) with the same animated grid background as the MAYHEM tab, and is
 * the only way out of the mode.
 */
export default function MayhemPause({
  onResume,
  onQuit,
}: {
  onResume: () => void;
  onQuit: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useSettings();

  // deep thunk when the pause menu opens
  useEffect(() => { mayhemSfx.pauseOpen(); }, []);

  useEffect(() => { setSfxVolume(settings.sfxVolume); }, [settings.sfxVolume]);
  useEffect(() => { setBgmVolume(settings.bgmVolume * 0.5); }, [settings.bgmVolume]);

  return (
    <div className="absolute inset-0 z-[60] overflow-hidden">
      <div aria-hidden="true" className="mayhem-menu-grid absolute inset-0" />
      <div aria-hidden="true" className="hell-static absolute inset-0" />

      {!settingsOpen ? (
        <div className="mayhem-menu absolute inset-0 z-10 flex flex-col items-center justify-center px-4">
          <div className="hell-title font-pixel text-[clamp(20px,4vw,44px)]">PAUSED</div>
          <div className="mt-5 flex w-full max-w-sm flex-col gap-2.5">
            <button
              type="button"
              onClick={() => { sfx.menuConfirm(); onResume(); }}
              onMouseEnter={() => sfx.menuHover()}
              className="mayhem-menu-button mayhem-menu-primary"
            >
              RESUME
            </button>
            <button
              type="button"
              onClick={() => { sfx.menuClick(); setSettingsOpen(true); }}
              onMouseEnter={() => sfx.menuHover()}
              className="mayhem-menu-button"
            >
              SETTINGS
            </button>
            <button
              type="button"
              onClick={() => { sfx.menuBack(); onQuit(); }}
              onMouseEnter={() => sfx.menuHover()}
              className="mayhem-menu-button"
            >
              LEAVE MAYHEM
            </button>
          </div>
        </div>
      ) : (
        <div className="mayhem-settings absolute inset-3 z-20 flex items-center justify-center sm:inset-8">
          <div className="w-full max-w-lg border-2 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))/0.94] p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 className="hell-title font-pixel text-base sm:text-xl">SETTINGS</h3>
              <button
                type="button"
                onClick={() => { sfx.menuBack(); setSettingsOpen(false); }}
                className="mayhem-settings-close font-pixel"
                aria-label="Close MAYHEM settings"
              >
                ×
              </button>
            </div>
            <label className="mayhem-settings-row">
              <span>SFX VOLUME</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => setSettings({ sfxVolume: Number(e.target.value) })}
              />
              <output>{Math.round(settings.sfxVolume * 100)}</output>
            </label>
            <label className="mayhem-settings-row">
              <span>MUSIC VOLUME</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={settings.bgmVolume}
                onChange={(e) => setSettings({ bgmVolume: Number(e.target.value) })}
              />
              <output>{Math.round(settings.bgmVolume * 100)}</output>
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={settings.reduceShake}
              onClick={() => { sfx.menuClick(); setSettings({ reduceShake: !settings.reduceShake }); }}
              className="mayhem-settings-toggle"
            >
              <span>REDUCE SCREEN SHAKE</span>
              <strong>{settings.reduceShake ? "ON" : "OFF"}</strong>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={settings.reducedFx}
              onClick={() => { sfx.menuClick(); setSettings({ reducedFx: !settings.reducedFx }); }}
              className="mayhem-settings-toggle"
            >
              <span>REDUCED FX</span>
              <strong>{settings.reducedFx ? "ON" : "OFF"}</strong>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
