import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export interface RoomGaze { x: number; y: number }

// Re-project the supplied painting onto an angular surface. Rotating the view
// changes wall inclination instead of translating a rigid rectangular picture.
export default function CurvedRoom({ src, gaze, onReady }: {
  src: string;
  gaze: MutableRefObject<RoomGaze>;
  onReady: (ready: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false }); }
    catch { readyRef.current(false); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const uniforms = {
      painting: { value: new THREE.Texture() },
      aspect: { value: 1 }, imageAspect: { value: 1 },
      gaze: { value: new THREE.Vector2() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform sampler2D painting;
        uniform float aspect;
        uniform float imageAspect;
        uniform vec2 gaze;
        varying vec2 vUv;
        void main() {
          vec2 screen = (vUv - 0.5) * 2.0;
          float lens = 0.66;
          // Constant horizontal field on wide views; constant vertical field
          // on tall ones. The painting remains cover-cropped, never stretched.
          vec2 field = vec2(lens * min(aspect, 1.6), lens * min(1.0, 1.6 / aspect));
          vec3 ray = normalize(vec3(screen * field, -1.0));
          float yaw = -gaze.x * 0.19;
          float pitch = -gaze.y * 0.12;
          ray.yz = mat2(cos(pitch), -sin(pitch), sin(pitch), cos(pitch)) * ray.yz;
          ray.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * ray.xz;
          vec2 angular = vec2(atan(ray.x, -ray.z), atan(ray.y, length(ray.xz)));
          vec2 extent = atan(field) * 1.08;
          vec2 uv = angular / (extent * 2.0) + 0.5;
          vec2 crop = vec2(min(1.0, aspect / imageAspect), min(1.0, imageAspect / aspect));
          uv = (uv - 0.5) * crop + 0.5;
          gl_FragColor = texture2D(painting, clamp(uv, 0.001, 0.999));
        }`,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.Camera();
    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      uniforms.aspect.value = width / height;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    let active = true;
    let frame = 0;
    let texture: THREE.Texture | undefined;
    readyRef.current(false);
    new THREE.TextureLoader().load(src, (loaded) => {
      if (!active) { loaded.dispose(); return; }
      texture = loaded;
      loaded.minFilter = THREE.LinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      uniforms.painting.value.dispose();
      uniforms.painting.value = loaded;
      const image = loaded.image as HTMLImageElement;
      uniforms.imageAspect.value = image.width / image.height;
      const draw = () => {
        uniforms.gaze.value.set(gaze.current.x, gaze.current.y);
        renderer.render(scene, camera);
        frame = requestAnimationFrame(draw);
      };
      draw();
      readyRef.current(true);
    }, undefined, () => readyRef.current(false));
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      texture?.dispose();
      if (!texture) uniforms.painting.value.dispose();
      geometry.dispose(); material.dispose(); renderer.dispose();
    };
  }, [src, gaze]);
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}