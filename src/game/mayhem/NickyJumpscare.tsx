// Nicole demake's jumpscare: still sprite slowly morphing _1 → _2 over a
// drifting grid of the Denny Scare token (white kept intact). No shaking.
import { useEffect, useState } from "react";
import js1 from "@/assets/mayhem/encounter/js-1.png.asset.json";
import js2 from "@/assets/mayhem/encounter/js-2.png.asset.json";
import denny from "@/assets/mayhem/encounter/denny-scare.png.asset.json";
import jumpscareAudio from "@/assets/audio/encounter/jumpscare.mp3.asset.json";

export const JUMPSCARE_URLS = [js1.url, js2.url, denny.url];

export default function NickyJumpscare({ volume, onDone }: { volume: number; onDone: () => void }) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    const audio = new Audio(jumpscareAudio.url);
    audio.volume = Math.min(1, volume);
    void audio.play().catch(() => {});
    const t = window.setTimeout(() => { setOver(true); onDone(); }, 4000);
    return () => { window.clearTimeout(t); audio.pause(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 z-[130] overflow-hidden bg-white">
      <div
        aria-hidden="true"
        className="nicky-js-grid absolute -inset-[160px]"
        style={{ backgroundImage: `url(${denny.url})`, backgroundSize: "160px 160px" }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative h-[70vh] w-[70vh] max-w-[90vw]">
          <img src={js1.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain" />
          <img src={js2.url} alt="" draggable={false} className="nicky-js-morph absolute inset-0 h-full w-full object-contain" />
        </div>
        <div className="mt-2 font-pixel text-[clamp(20px,4vw,52px)] tracking-widest text-[hsl(var(--hell-warning))] drop-shadow-[0_0_12px_black]">
          YOU'RE A FAILURE
        </div>
      </div>
      {over && <div className="absolute inset-0 bg-black/40" />}
    </div>
  );
}
