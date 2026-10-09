import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Cylindrical panorama projection: the centre stays unchanged while the
// ceiling/floor stretch toward the edges, unlike a rotated flat rectangle.
export function roomPerspectiveOffset(x: number, y: number) {
  if (x === 0.5 || y === 0.5) return 0;
  const angle = (x - 0.5) * 1.7;
  return (y - 0.5) * (Math.cos(angle) - 1);
}

export default function RoomPerspective({ children }: { children: ReactNode }) {
  const id = `room-perspective-${useId().replace(/:/g, "")}`;
  const host = useRef<HTMLDivElement>(null);
  const displacement = useRef<SVGFEDisplacementMapElement>(null);
  const mapImage = useRef<SVGFEImageElement>(null);
  const [map, setMap] = useState("");

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        pixels.data[i] = 128;
        pixels.data[i + 1] = Math.round(255 * (0.5 + roomPerspectiveOffset(x / (canvas.width - 1), y / (canvas.height - 1))));
        pixels.data[i + 2] = 128;
        pixels.data[i + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    setMap(canvas.toDataURL());
    const el = host.current;
    if (!el) return;
    const resize = () => {
      displacement.current?.setAttribute("scale", String(el.clientHeight));
      mapImage.current?.setAttribute("width", String(el.clientWidth));
      mapImage.current?.setAttribute("height", String(el.clientHeight));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
        <defs>
          <filter id={id} x="0" y="0" width="100%" height="100%" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage ref={mapImage} href={map || undefined} xlinkHref={map || undefined} result="panorama-map" x="0" y="0" preserveAspectRatio="none" />
            <feDisplacementMap ref={displacement} in="SourceGraphic" in2="panorama-map" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div ref={host} className="absolute inset-0" style={{ filter: map ? `url(#${id})` : undefined }}>{children}</div>
    </>
  );
}