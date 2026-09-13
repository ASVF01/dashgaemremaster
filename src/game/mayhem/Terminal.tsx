// MAYHEM — the COMPANY PANEL terminal.
// Slides up from the bottom of the screen when the player presses S.
// Screens are the hand-drawn sprites; interactions are invisible hotspots.
import { useEffect, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";
import { useSettings } from "@/game/settings";
import loadingArt from "@/assets/mayhem/terminal/TERMINAL_Loading.png.asset.json";
import homeArt from "@/assets/mayhem/terminal/TERMINAL_Home_Page.png.asset.json";
import rcsArt from "@/assets/mayhem/terminal/TERMINAL_RCS.png.asset.json";
import wait1Art from "@/assets/mayhem/terminal/TERMINAL_Wait_1.png.asset.json";
import wait2Art from "@/assets/mayhem/terminal/TERMINAL_Wait_2.png.asset.json";
import wait3Art from "@/assets/mayhem/terminal/TERMINAL_Wait_3.png.asset.json";
import doneArt from "@/assets/mayhem/terminal/TERMINAL_DONE.png.asset.json";
import whichArt from "@/assets/mayhem/terminal/TERMINAL_W.png.asset.json";

type Screen =
  | "loading"
  | "home"
  | "rcs" // reset camera system confirm
  | "which" // which camera? 1-5
  | "wait1"
  | "wait2"
  | "wait3"
  | "done";

const ART: Record<Screen, string> = {
  loading: loadingArt.url,
  home: homeArt.url,
  rcs: rcsArt.url,
  which: whichArt.url,
  wait1: wait1Art.url,
  wait2: wait2Art.url,
  wait3: wait3Art.url,
  done: doneArt.url,
};

export const TERMINAL_ASSET_URLS = Object.values(ART);

const BOOT_MS = 1800;
const WAIT_MS = 1100;
const DONE_MS = 1200;

export default function Terminal({ onClose }: { onClose: () => void }) {
  const [settings] = useSettings();
  const aiMode = settings.aiMode;
  const [screen, setScreen] = useState<Screen>("loading");
  const timer = useRef<number | null>(null);

  // selection sound + screen change
  const go = (s: Screen) => {
    mayhemSfx.terminalSelect();
    setScreen(s);
  };

  // boot hum when the terminal powers on
  useEffect(() => { mayhemSfx.terminalBoot(); }, []);

  const later = (fn: () => void, ms: number) => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  };
  useEffect(() => () => { if (timer.current != null) window.clearTimeout(timer.current); }, []);

  // boot → home
  useEffect(() => {
    if (screen === "loading") later(() => setScreen("home"), BOOT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // waiting sequence → done → home
  useEffect(() => {
    if (screen === "wait1") later(() => setScreen("wait2"), WAIT_MS);
    else if (screen === "wait2") later(() => setScreen("wait3"), WAIT_MS);
    else if (screen === "wait3") later(() => setScreen("done"), WAIT_MS);
    else if (screen === "done") {
      mayhemSfx.terminalDone();
      later(() => setScreen("home"), DONE_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // keyboard: y/n on confirm, 1-5 on which camera
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (screen === "rcs") {
        if (k === "y") go("wait1");
        else if (k === "n") go("home");
      } else if (screen === "which") {
        if (["1", "2", "3", "4", "5"].includes(k)) go("wait1");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  return (
    <>
      {/* Soft room dimmer; CRT texture remains inside the terminal itself. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[69] bg-black/25"
      />

      <div
        className="absolute bottom-0 left-1/2 z-[70] h-[min(46vh,420px)] w-[min(720px,76vw)] -translate-x-1/2 rounded-t-md border-x-4 border-t-4 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))] shadow-[0_-12px_55px_hsl(var(--hell-black))] max-sm:h-[40vh] max-sm:w-[94vw]"
        style={{ animation: "mayhemTerminalUp 420ms cubic-bezier(0.22,1,0.36,1)" }}
      >
        {/* screen */}
        <div className="absolute inset-0 flex items-stretch justify-center overflow-hidden rounded-md">
          <div className="relative h-full w-full bg-black">
            <img
              key={screen}
              src={ART[screen]}
              alt="Company panel terminal"
              draggable={false}
              className="h-full w-full object-fill"
              style={{ imageRendering: "pixelated" }}
            />

            {aiMode && <AiTerminalScreen screen={screen} go={go} />}

            {/* home hotspots: two panels at the bottom */}
            {screen === "home" && (
              <>
                <button
                  type="button"
                  aria-label="Reset camera system"
                  onClick={() => go("rcs")}
                  className="absolute border-2 border-transparent hover:border-[#39ff6a]/70"
                  style={{ left: "2%", top: "46%", width: "47%", height: "52%" }}
                />
                <button
                  type="button"
                  aria-label="Reset individual camera"
                  onClick={() => go("which")}
                  className="absolute border-2 border-transparent hover:border-[#39ff6a]/70"
                  style={{ left: "50%", top: "46%", width: "48%", height: "52%" }}
                />
              </>
            )}

            {/* rcs hotspots: Y / N */}
            {screen === "rcs" && (
              <>
                <button
                  type="button"
                  aria-label="Yes"
                  onClick={() => go("wait1")}
                  className="absolute border-2 border-transparent hover:border-[#39ff6a]/70"
                  style={{ left: "38%", top: "55%", width: "10%", height: "20%" }}
                />
                <button
                  type="button"
                  aria-label="No"
                  onClick={() => go("home")}
                  className="absolute border-2 border-transparent hover:border-[#39ff6a]/70"
                  style={{ left: "50%", top: "55%", width: "10%", height: "20%" }}
                />
              </>
            )}

            {/* which camera hotspots: 1..5 */}
            {screen === "which" && (
              <div className="absolute" style={{ left: "37%", top: "62%", width: "26%", height: "16%", display: "flex" }}>
                {["1", "2", "3", "4", "5"].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Camera ${n}`}
                    onClick={() => go("wait1")}
                    className="h-full flex-1 border border-transparent hover:border-[#39ff6a]/70"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-2 text-center font-pixel text-[9px] tracking-[0.3em] text-[hsl(var(--hell-terminal))]/60">
          [ S ] CLOSE TERMINAL
        </div>
      </div>
    </>
  );
}

/**
 * AI MODE terminal: the same screen flow drawn as a green phosphor console
 * instead of the hand-drawn sprites. Sits on top of the sprite screen.
 */
function AiTerminalScreen({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const shell = "absolute inset-0 flex flex-col bg-[#03110a] p-3 font-pixel text-[hsl(var(--hell-terminal))] sm:p-4";
  const head = (
    <div className="mb-2 flex items-center justify-between border-b border-[hsl(var(--hell-terminal))]/40 pb-1 text-[8px] tracking-[0.3em] opacity-80">
      <span>MAYHEM // CTRL CONSOLE</span>
      <span>v0.9 AI</span>
    </div>
  );
  const btn = "border border-[hsl(var(--hell-terminal))]/70 bg-[hsl(var(--hell-terminal))]/10 px-2 py-2 text-[10px] tracking-[0.2em] hover:bg-[hsl(var(--hell-terminal))]/25";

  return (
    <div className={shell} style={{ textShadow: "0 0 8px hsl(var(--hell-terminal))" }}>
      {head}
      <div className="flex flex-1 flex-col justify-center gap-3 text-[11px] leading-relaxed">
        {screen === "loading" && <div className="text-center opacity-80">BOOTING CAMERA CONTROL...<br />[■■■■■□□□□□]</div>}

        {screen === "home" && (
          <>
            <div className="text-[10px] opacity-70">SELECT AN OPERATION</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btn} onClick={() => go("rcs")}>RESET ALL CAMS</button>
              <button type="button" className={btn} onClick={() => go("which")}>RESET ONE CAM</button>
            </div>
          </>
        )}

        {screen === "rcs" && (
          <>
            <div>RESET THE ENTIRE CAMERA SYSTEM?</div>
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={() => go("wait1")}>[ Y ] YES</button>
              <button type="button" className={btn} onClick={() => go("home")}>[ N ] NO</button>
            </div>
          </>
        )}

        {screen === "which" && (
          <>
            <div>WHICH CAMERA?</div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={btn} onClick={() => go("wait1")}>{n}</button>
              ))}
            </div>
          </>
        )}

        {(screen === "wait1" || screen === "wait2" || screen === "wait3") && (
          <div className="text-center opacity-85">
            WORKING{screen === "wait1" ? "." : screen === "wait2" ? ".." : "..."}
            <div className="mt-2 text-[9px] opacity-60">DO NOT LEAVE THE TERMINAL</div>
          </div>
        )}

        {screen === "done" && <div className="text-center text-[clamp(16px,3vw,28px)]">DONE</div>}
      </div>
    </div>
  );
}
