// MAYHEM — the COMPANY PANEL terminal and its recoverable fault states.
import { useEffect, useMemo, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";
import FlowPuzzle, { makeRandomFlowPairs } from "./minigames/FlowPuzzle";
import loadingArt from "@/assets/mayhem/terminal/TERMINAL_Loading.png.asset.json";
import homeArt from "@/assets/mayhem/terminal/TERMINAL_Home_Page.png.asset.json";
import rcsArt from "@/assets/mayhem/terminal/TERMINAL_RCS.png.asset.json";
import wait1Art from "@/assets/mayhem/terminal/TERMINAL_Wait_1.png.asset.json";
import wait2Art from "@/assets/mayhem/terminal/TERMINAL_Wait_2.png.asset.json";
import wait3Art from "@/assets/mayhem/terminal/TERMINAL_Wait_3.png.asset.json";
import doneArt from "@/assets/mayhem/terminal/TERMINAL_DONE.png.asset.json";
import whichArt from "@/assets/mayhem/terminal/TERMINAL_W.png.asset.json";

type Screen = "loading" | "home" | "rcs" | "which" | "wait1" | "wait2" | "wait3" | "done";
export type TerminalError = "273" | "104" | null;
export type TerminalSession = { initialized: boolean; error: TerminalError; videoTime: number; videoDone: boolean; puzzleSeed: number };

const ART: Record<Screen, string> = { loading: loadingArt.url, home: homeArt.url, rcs: rcsArt.url, which: whichArt.url, wait1: wait1Art.url, wait2: wait2Art.url, wait3: wait3Art.url, done: doneArt.url };
export const TERMINAL_ASSET_URLS = Object.values(ART);
const BOOT_MS = 1800;
const WAIT_MS = 1100;
const DONE_MS = 1200;

export function makeTerminalSession(): TerminalSession {
  const roll = Math.random();
  return { initialized: true, error: roll < 0.02 ? "104" : roll < 0.07 ? "273" : null, videoTime: 0, videoDone: false, puzzleSeed: Math.floor(Math.random() * 0xFFFFFFFF) };
}

export default function Terminal({ paused, session, onSessionChange, onClose }: {
  paused: boolean;
  session: TerminalSession;
  onSessionChange: (next: TerminalSession) => void;
  onClose: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("loading");
  const timer = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const latestTime = useRef(session.videoTime);
  const errorFlowPairs = useMemo(() => makeRandomFlowPairs(9, 5, session.puzzleSeed), [session.puzzleSeed]);

  const sendVideo = (func: "playVideo" | "pauseVideo" | "seekTo", args: number[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "https://www.youtube.com");
  };
  const go = (next: Screen) => { mayhemSfx.terminalSelect(); setScreen(next); };
  const later = (fn: () => void, ms: number) => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  };

  useEffect(() => { mayhemSfx.terminalBoot(); }, []);
  useEffect(() => () => { if (timer.current != null) window.clearTimeout(timer.current); }, []);
  useEffect(() => { if (screen === "loading") later(() => setScreen("home"), BOOT_MS); }, []);
  useEffect(() => {
    if (paused) return;
    if (screen === "wait1") later(() => setScreen("wait2"), WAIT_MS);
    else if (screen === "wait2") later(() => setScreen("wait3"), WAIT_MS);
    else if (screen === "wait3") later(() => setScreen("done"), WAIT_MS);
    else if (screen === "done") { mayhemSfx.terminalDone(); later(() => setScreen("home"), DONE_MS); }
  }, [screen, paused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (screen === "rcs") { if (key === "y") go("wait1"); else if (key === "n") go("home"); }
      else if (screen === "which" && ["1", "2", "3", "4", "5"].includes(key)) go("wait1");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  useEffect(() => {
    if (session.error !== "104") return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      let data: { event?: string; info?: { currentTime?: number; duration?: number; playerState?: number } };
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      const current = data.info?.currentTime;
      const duration = data.info?.duration;
      if (typeof current === "number") latestTime.current = current;
      if ((typeof duration === "number" && duration > 0 && typeof current === "number" && current >= duration - 1) || data.info?.playerState === 0) {
        onSessionChange({ ...session, error: null, videoTime: duration ?? current ?? latestTime.current, videoDone: true });
        mayhemSfx.terminalDone();
      }
    };
    window.addEventListener("message", onMessage);
    const listen = window.setInterval(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "mayhem-err104" }), "https://www.youtube.com"), 1000);
    return () => { window.removeEventListener("message", onMessage); window.clearInterval(listen); };
  }, [session, onSessionChange]);

  useEffect(() => {
    if (session.error !== "104") return;
    sendVideo(paused ? "pauseVideo" : "playVideo");
  }, [paused, session.error]);

  useEffect(() => () => {
    if (session.error === "104") {
      sendVideo("pauseVideo");
      onSessionChange({ ...session, videoTime: latestTime.current });
    }
  }, []);

  const clearError = () => { onSessionChange({ ...session, error: null }); mayhemSfx.terminalDone(); setScreen("home"); };

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[69] bg-[hsl(var(--hell-black))]/55" />
      <div className="absolute bottom-0 left-1/2 z-[70] h-[min(58vh,560px)] w-[min(820px,88vw)] -translate-x-1/2 border-x-4 border-t-4 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))] shadow-[0_-12px_55px_hsl(var(--hell-black))]" style={{ animation: "mayhemTerminalUp 420ms cubic-bezier(0.22,1,0.36,1)" }}>
        <div className="absolute inset-0 overflow-hidden bg-[hsl(var(--hell-black))]">
          {session.error === "273" ? (
            <div className="flex h-full flex-col p-5 text-[hsl(var(--hell-terminal))]">
              <div className="mb-3 border-b border-[hsl(var(--hell-terminal))]/50 pb-2 font-pixel text-[clamp(13px,2vw,22px)]">FATAL ERROR // ERR_273</div>
              <p className="mb-3 font-pixel text-[8px] leading-relaxed text-[hsl(var(--hell-muted))]">SIGNAL PATHS CORRUPTED. CONNECT EVERY MATCHING NODE TO RESTORE COMPANY PANEL ACCESS.</p>
              <div className="mx-auto min-h-0 w-[min(390px,70vh)] flex-1"><FlowPuzzle size={9} pairs={errorFlowPairs} paused={paused} onComplete={clearError} /></div>
            </div>
          ) : session.error === "104" ? (
            <div className="flex h-full flex-col p-5 text-[hsl(var(--hell-warning))]">
              <div className="mb-2 border-b border-[hsl(var(--hell-warning))]/60 pb-2 font-pixel text-[clamp(13px,2vw,22px)]">SECURITY HOLD // ERR_104</div>
              <p className="mb-3 font-pixel text-[8px] leading-relaxed text-[hsl(var(--hell-muted))]">MANDATORY TRAINING RECORD. THE COMPLETE RECORDING MUST PLAY BEFORE TERMINAL ACCESS IS RESTORED.</p>
              <iframe ref={iframeRef} title="ERR_104 mandatory training" className="min-h-0 w-full flex-1 border-2 border-[hsl(var(--hell-steel))]" src={`https://www.youtube.com/embed/FtEOS-IyY0?enablejsapi=1&playsinline=1&rel=0&start=${Math.floor(session.videoTime)}`} allow="autoplay; encrypted-media; picture-in-picture" />
            </div>
          ) : (
            <>
              <img key={screen} src={ART[screen]} alt="Company panel terminal" draggable={false} className="h-full w-full object-fill [image-rendering:pixelated]" />
              {screen === "home" && <>
                <button type="button" aria-label="Reset camera system" onClick={() => go("rcs")} className="absolute border-2 border-transparent hover:border-[hsl(var(--hell-terminal))]/70" style={{ left: "2%", top: "46%", width: "47%", height: "52%" }} />
                <button type="button" aria-label="Reset individual camera" onClick={() => go("which")} className="absolute border-2 border-transparent hover:border-[hsl(var(--hell-terminal))]/70" style={{ left: "50%", top: "46%", width: "48%", height: "52%" }} />
              </>}
              {screen === "rcs" && <><button type="button" aria-label="Yes" onClick={() => go("wait1")} className="absolute border-2 border-transparent hover:border-[hsl(var(--hell-terminal))]/70" style={{ left: "38%", top: "55%", width: "10%", height: "20%" }} /><button type="button" aria-label="No" onClick={() => go("home")} className="absolute border-2 border-transparent hover:border-[hsl(var(--hell-terminal))]/70" style={{ left: "50%", top: "55%", width: "10%", height: "20%" }} /></>}
              {screen === "which" && <div className="absolute flex" style={{ left: "37%", top: "62%", width: "26%", height: "16%" }}>{["1","2","3","4","5"].map((number) => <button key={number} type="button" aria-label={`Camera ${number}`} onClick={() => go("wait1")} className="h-full flex-1 border border-transparent hover:border-[hsl(var(--hell-terminal))]/70" />)}</div>}
            </>
          )}
          <div className="pointer-events-none absolute inset-0 hell-static opacity-20" />
        </div>
        <button type="button" onClick={() => { sendVideo("pauseVideo"); onClose(); }} className="absolute right-3 top-3 z-10 border border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))]/85 px-3 py-2 font-pixel text-[8px] text-[hsl(var(--hell-muted))]">[ S ] CLOSE</button>
      </div>
    </>
  );
}
