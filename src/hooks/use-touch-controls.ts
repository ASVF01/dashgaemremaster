import { useEffect, useState } from "react";
import { usesTouchControls } from "@/game/viewportRules";

export function useTouchControls() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const pointer = window.matchMedia("(pointer: coarse)");
    const update = () => setTouch(usesTouchControls(pointer.matches));
    update();
    pointer.addEventListener("change", update);
    return () => pointer.removeEventListener("change", update);
  }, []);
  return touch;
}