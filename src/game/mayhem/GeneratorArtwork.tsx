import { useState } from "react";
import generatorArt from "@/assets/mayhem/generator_panel_local.png";

const LABEL = "Stevenson's Ultra Power Generator 9000";

export default function GeneratorArtwork({ alt = LABEL, className }: { alt?: string; className: string }) {
  const [unavailable, setUnavailable] = useState(false);

  if (!unavailable) {
    return <img className={className} src={generatorArt} alt={alt} draggable={false} onError={() => setUnavailable(true)} />;
  }

  return (
    <svg className={className} viewBox="0 0 686 389" role="img" aria-label={alt} preserveAspectRatio="none">
      <rect x="22" y="16" width="642" height="355" rx="14" fill="#29302d" stroke="#111715" strokeWidth="14" />
      <path d="M47 48h592v27H47z" fill="#151c19" />
      <text x="343" y="67" textAnchor="middle" fill="#d5d9ca" fontSize="17" fontFamily="monospace" letterSpacing="4">STEVENSON 9000</text>
      <rect x="94" y="81" width="438" height="18" rx="3" fill="#101512" stroke="#778276" strokeWidth="3" />
      <path d="M51 118h584v226H51z" fill="#39433b" stroke="#78836e" strokeWidth="5" />
      <path d="M72 138h542v187H72z" fill="#252d29" stroke="#111715" strokeWidth="4" />
      <path d="M90 158h112v145H90z" fill="#313b34" stroke="#606c5c" strokeWidth="4" />
      <path d="M99 171h94m-94 15h94m-94 15h94m-94 15h94m-94 15h94m-94 15h94m-94 15h94" stroke="#111715" strokeWidth="6" />
      <circle cx="343" cy="229" r="73" fill="#151b18" stroke="#aab19f" strokeWidth="8" />
      <circle cx="343" cy="229" r="53" fill="#343d37" stroke="#687466" strokeWidth="5" />
      <circle cx="343" cy="229" r="14" fill="#d4d8c8" stroke="#111715" strokeWidth="5" />
      <path d="M343 216V174" stroke="#c0c6b7" strokeWidth="12" strokeLinecap="round" />
      <circle cx="343" cy="171" r="12" fill="#a7322a" stroke="#111715" strokeWidth="4" />
      <path d="M476 157h111v146H476z" fill="#18201b" stroke="#606c5c" strokeWidth="4" />
      <circle cx="531" cy="185" r="12" fill="#b42d28" stroke="#111715" strokeWidth="4" />
      <circle cx="531" cy="225" r="12" fill="#338b4a" stroke="#111715" strokeWidth="4" />
      <path d="M493 265h77" stroke="#78836e" strokeWidth="7" strokeLinecap="round" />
      <text x="343" y="357" textAnchor="middle" fill="#c6ccbd" fontSize="12" fontFamily="monospace" letterSpacing="3">COMPANY PACE · AUX POWER</text>
    </svg>
  );
}
