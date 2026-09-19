// MAYHEM — VR prototype page. WebXR runs in the headset's browser
// (e.g. Quest → open this URL in its browser). Desktop gets a mouse-look fallback.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VrOffice from "@/game/vr/VrOffice";

export default function VrPage() {
  const [vrSupported, setVrSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } };
    nav.xr?.isSessionSupported("immersive-vr")
      .then(setVrSupported)
      .catch(() => setVrSupported(false));
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <VrOffice />

      <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        {vrSupported === false && (
          <div className="border border-white/30 bg-black/80 px-3 py-2 font-pixel text-[9px] tracking-[0.2em] text-white/70">
            NO VR HEADSET FOUND — MOUSE-LOOK MODE
          </div>
        )}
        <Link
          to="/"
          className="border border-white/40 bg-black/70 px-3 py-2 font-pixel text-[9px] tracking-[0.2em] text-white hover:border-white"
        >
          [ ESC ] BACK TO GAME
        </Link>
      </div>

    </div>
  );
}
