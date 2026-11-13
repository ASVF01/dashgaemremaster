import { useSettings } from "@/game/settings";

/** Screen-space effects sit below controls and never alter the box camera. */
export default function OfficeAtmosphere({ powered, flashlight }: { powered: boolean; flashlight: boolean }) {
  const [settings] = useSettings();
  return (
    <div className={`mo-atmosphere${flashlight ? " flashlight" : ""}${powered ? " powered" : ""}`} aria-hidden="true">
      <div className="mo-atmosphere-vignette" />
      <svg className="mo-atmosphere-grain" width="100%" height="100%">
        <filter id="mo-atmosphere-grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="21" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#mo-atmosphere-grain)" />
      </svg>
      {!settings.reducedFx && <svg className="mo-atmosphere-dust" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {Array.from({ length: 24 }, (_, i) => (
          <path key={i} className="mo-dust-mote" d={`M ${(i * 137 + 43) % 1000} ${(i * 211 + 83) % 1000} l 1.2 -0.8 l 0.6 1.3`} />
        ))}
      </svg>}
      <div className="mo-atmosphere-scanlines" />
    </div>
  );
}