// MAYHEM — VR office prototype (WebXR).
// Sit in the office, turn your head, peek through the keyhole, check the monitor.
// Desktop fallback: click to capture the mouse and look around.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, useTexture } from "@react-three/drei";
import { XR, XRButton, Controllers } from "@react-three/xr";
import wallTex from "@/assets/vr/vr_wall.jpg";
import floorTex from "@/assets/vr/vr_floor.jpg";
import doorTex from "@/assets/vr/vr_door.png";
import enemyTex from "@/assets/vr/vr_enemy.png";
import cam1 from "@/assets/vr/cam1_feed.png";

// Room dimensions (metres). Door wall sits at z = -2.
const ROOM = { w: 6, d: 4, h: 3 };
const DOOR = { w: 1.15, h: 2.25 };

function AimAtDoor() {
  // Seat the player facing the door on load (desktop only — VR owns the head).
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(0, 1.25, -2);
  }, [camera]);
  return null;
}

function useRepeating(map: THREE.Texture, rx: number, ry: number) {
  return useMemo(() => {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(rx, ry);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [map, rx, ry]);
}

function Room() {
  const wall = useTexture(wallTex);
  const floor = useTexture(floorTex);
  const wallMap = useRepeating(wall, 3, 2);
  const floorMap = useRepeating(floor, 4, 3);
  return (
    <group>
      {/* floor + ceiling */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={floorMap} roughness={0.95} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, ROOM.h, 0]}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={wallMap} color="#3a3f42" roughness={1} />
      </mesh>
      {/* back + side walls */}
      <mesh position={[0, ROOM.h / 2, ROOM.d / 2]} rotation-y={Math.PI}>
        <planeGeometry args={[ROOM.w, ROOM.h]} />
        <meshStandardMaterial map={wallMap} roughness={1} />
      </mesh>
      <mesh position={[-ROOM.w / 2, ROOM.h / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial map={wallMap} roughness={1} />
      </mesh>
      <mesh position={[ROOM.w / 2, ROOM.h / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial map={wallMap} roughness={1} />
      </mesh>
    </group>
  );
}

function Hallway() {
  const enemy = useTexture(enemyTex);
  const red = useRef<THREE.PointLight>(null);
  // Flickering red glow bleeding through the keyhole.
  useFrame(({ clock }) => {
    if (!red.current) return;
    const t = clock.getElapsedTime();
    const flick = 0.72 + 0.18 * Math.sin(t * 1.7) + 0.1 * Math.sin(t * 13.3);
    red.current.intensity = Math.max(0.35, flick) * (Math.random() > 0.985 ? 0.2 : 1);
  });
  return (
    <group>
      {/* black void behind the enemy so nothing else shows through the hole */}
      <mesh position={[0, 1.5, -5.4]}>
        <planeGeometry args={[10, 6]} />
        <meshBasicMaterial color="#020202" />
      </mesh>
      <mesh position={[0, 1.1, -3.4]}>
        <planeGeometry args={[1.7, 2.55]} />
        <meshStandardMaterial map={enemy} transparent alphaTest={0.15} roughness={0.8} />
      </mesh>
      <pointLight ref={red} position={[0, 1.7, -3.1]} color="#ff2a1a" intensity={0.9} distance={5.5} decay={2} />
    </group>
  );
}

function Door() {
  const map = useTexture(doorTex);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [map]);
  return (
    <mesh position={[0, DOOR.h / 2, -1.98]}>
      <planeGeometry args={[DOOR.w, DOOR.h]} />
      <meshStandardMaterial map={map} transparent alphaTest={0.5} roughness={0.9} />
    </mesh>
  );
}

function Desk() {
  const feed = useTexture(cam1);
  useMemo(() => {
    feed.colorSpace = THREE.SRGBColorSpace;
    return feed;
  }, [feed]);
  const metal = <meshStandardMaterial color="#23282b" metalness={0.6} roughness={0.5} />;
  return (
    <group position={[-1.35, 0, -0.55]} rotation-y={0.5}>
      {/* desk top + legs */}
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.05, 0.7]} />
        {metal}
      </mesh>
      {[[-0.68, -0.28], [0.68, -0.28], [-0.68, 0.28], [0.68, 0.28]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.37, z]}>
          <boxGeometry args={[0.05, 0.74, 0.05]} />
          <meshStandardMaterial color="#1a1e20" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
      {/* CCTV monitor showing CAM 1 — unlit so the screen glows in the dark */}
      <mesh position={[-0.12, 1.12, -0.12]} rotation-y={0.42} rotation-x={-0.06}>
        <boxGeometry args={[0.86, 0.56, 0.05]} />
        <meshStandardMaterial color="#101314" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[-0.118, 1.12, -0.086]} rotation-y={0.42} rotation-x={-0.06}>
        <planeGeometry args={[0.78, 0.47]} />
        <meshBasicMaterial map={feed} toneMapped={false} />
      </mesh>
      {/* faint screen light on the desk */}
      <pointLight position={[-0.1, 1.05, 0.15]} color="#7fd8c8" intensity={0.55} distance={1.6} decay={2} />
      <pointLight position={[-0.1, 1.05, -0.2]} color="#4fae9e" intensity={0.35} distance={1.2} decay={2} />
    </group>
  );
}

export default function VrOffice() {
  const [locked, setLocked] = useState(false);
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas
        shadows={false}
        camera={{ position: [0.4, 1.35, 1.7], fov: 72, near: 0.05, far: 30 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#040505"]} />
        <fog attach="fog" args={["#040505", 5, 16]} />
        <ambientLight intensity={0.3} />
        {/* dim ceiling fixture */}
        <pointLight position={[0.8, 2.8, 0.6]} color="#cfd8d2" intensity={1.1} distance={8} decay={2} />
        <AimAtDoor />
        <XR>
          <Room />
          <Hallway />
          <Door />
          <Desk />
          <Controllers />
        </XR>
        {!locked && <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />}
      </Canvas>

      {/* desktop fallback hint */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-pixel text-[10px] tracking-[0.25em] text-white/60">
        {locked ? "MOUSE — LOOK AROUND   ·   ESC — RELEASE" : "CLICK TO LOOK AROUND (DESKTOP)"}
      </div>
      <div className="pointer-events-none absolute left-4 top-4 font-pixel text-[10px] tracking-[0.3em] text-white/70">
        MAYHEM — VR OFFICE [ PROTOTYPE ]
      </div>
      <div className="absolute bottom-6 right-4 z-10">
        <XRButton
          mode="VR"
          className="border border-white/40 bg-black/70 px-3 py-2 font-pixel text-[9px] tracking-[0.2em] text-white hover:border-white"
        >
          ENTER VR
        </XRButton>
      </div>
    </div>
  );
}
