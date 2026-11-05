import { useEffect, useRef, useState } from "react";
import { canExitNightTitle, NIGHT_REVEAL_MS, NIGHT_STATIC_MS, NIGHT_TITLE_EXIT_MS } from "./nightIntroRules";
import "./nightIntro.css";

export default function NightIntro({ night, assetsReady, onDone, onTitleShown }: { night: number; assetsReady: boolean; onDone: () => void; onTitleShown: () => void }) {
  const [phase, setPhase] = useState("static");
  const ready = useRef(assetsReady);
  const done = useRef(onDone);
  const titleShown = useRef(onTitleShown);
  ready.current = assetsReady;
  done.current = onDone;
  titleShown.current = onTitleShown;
  useEffect(() => {
    const started = performance.now();
    let exit: number | undefined;
    let reveal: number | undefined;
    const enter = window.setTimeout(() => { setPhase("hold"); titleShown.current(); }, NIGHT_STATIC_MS);
    const check = window.setInterval(() => {
      if (!canExitNightTitle(performance.now() - started, ready.current)) return;
      window.clearInterval(check);
      setPhase("exit");
      exit = window.setTimeout(() => {
        setPhase("reveal");
        reveal = window.setTimeout(() => done.current(), NIGHT_REVEAL_MS);
      }, NIGHT_TITLE_EXIT_MS);
    }, 50);
    return () => { window.clearTimeout(enter); window.clearInterval(check); window.clearTimeout(exit); window.clearTimeout(reveal); };
  }, []);
  return <div className="authored-night-intro" data-phase={phase} aria-label={`Starting Night ${night}`}>
    {phase === "static" ? <div className="authored-night-static" aria-hidden="true" /> : <div className="authored-night-copy">
      <h2>Night {night}</h2>
      {night === 1 && <p>Graceful Beginnings</p>}
    </div>}
  </div>;
}