// MAYHEM — the COMPANY PANEL terminal.
// Slides up from the bottom of the screen when the player presses S.
// Screens are the hand-drawn sprites; interactions are invisible hotspots.
import { useEffect, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";
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
      {/* full-screen CRT backdrop — the tv effect lives in the black area around the terminal */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[69] bg-black/55"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)",
          boxShadow: "inset 0 0 160px rgba(0,0,0,0.95)",
        }}
      />

      <div
        className="absolute left-[7.5%] right-[7.5%] top-[7.5%] bottom-[7.5%] z-[70] rounded-lg border-4 border-[#2a2f2a] bg-black shadow-[0_20px_80px_rgba(0,0,0,0.9)]"
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

        <div className="pointer-events-none absolute inset-x-0 top-3 text-center font-pixel text-[9px] tracking-[0.3em] text-[#39ff6a]/60">
          [ S ] CLOSE TERMINAL
        </div>
      </div>
    </>
  );
}
