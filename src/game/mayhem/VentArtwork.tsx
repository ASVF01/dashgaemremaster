import { useState } from "react";
import ventMataArt from "@/assets/manager/vent_mata_local.png";
import ventMataShockedArt from "@/assets/manager/vent_mata_shocked_local.png";

type Props = {
  src: string;
  alt: string;
  present: boolean;
  shocked: boolean;
  onVentRef: (node: SVGSVGElement | HTMLImageElement | null) => void;
};

export default function VentArtwork({ src, alt, present, shocked, onVentRef }: Props) {
  const [unavailableSrc, setUnavailableSrc] = useState<string | null>(null);
  const className = `mo-vent${shocked ? " mo-mata-shocked" : ""}`;
  const image = present ? (shocked ? ventMataShockedArt : ventMataArt) : src;

  if (unavailableSrc !== image) {
    return <img ref={onVentRef} src={image} alt={alt} draggable={false} className={className} onError={() => setUnavailableSrc(image)} />;
  }

  return (
    <svg ref={onVentRef} className={className} viewBox="0 0 354 180" role="img" aria-label={alt}>
      <path d="M8 25 32 8h290l24 17v129l-24 18H32L8 154z" fill="#171b1b" stroke="#080a0a" strokeWidth="10" />
      <path d="M25 42h304M25 68h304M25 94h304M25 120h304M25 146h304" stroke="#69716d" strokeWidth="11" />
      <path d="M39 42h276M39 68h276M39 94h276M39 120h276M39 146h276" stroke="#303735" strokeWidth="5" />
      <path d="M91 139q-23-23 0-48l25-28q15-18 33-5l14 11 19-9q25-13 47 5l27 22q19 16 1 36l-18 20q-12 13-27 4l-20-12-24 15q-16 9-30-2l-16-13q-13 11-27 4z" fill="#070909" stroke="#a9b0a7" strokeWidth="6" />
      <path d="M131 100q13-14 28 0M204 100q13-14 28 0" fill="none" stroke={shocked ? "#fff6b8" : "#c92f38"} strokeWidth="10" strokeLinecap="round" />
      <circle cx="145" cy="101" r="5" fill="#fff" />
      <circle cx="218" cy="101" r="5" fill="#fff" />
      {shocked && <path d="m177 17-17 39 22-4-16 37 39-48-23 4 16-28z" fill="#ffe45c" stroke="#fff4b1" strokeWidth="3" />}
      <path d="M91 130 66 153M260 127l25 24" stroke="#090b0b" strokeWidth="13" strokeLinecap="round" />
    </svg>
  );
}
