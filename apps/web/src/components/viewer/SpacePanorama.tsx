'use client';

// Viewer ảnh 360° tự dựng bằng React Three Fiber (DECISIONS D-T32): mặt cầu + ảnh equirectangular,
// hotspot lưu tọa độ (yaw, pitch). Kéo để xoay, cuộn để zoom, tự xoay, toàn màn hình.
import { Html, OrbitControls, useTexture } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { PanoramaView } from '@/types/api';

type Hotspot = PanoramaView['hotspots'][number];

const R = 50;
/** yaw (-180..180°), pitch (-90..90°) → toạ độ trên mặt cầu (khớp cách ảnh được lật ngang) */
export function toPosition(yawDeg: number, pitchDeg: number, r = R - 2): [number, number, number] {
  const f = (yawDeg + 180) / 360;
  const phi = (1 - f) * Math.PI * 2;
  const theta = Math.PI / 2 - THREE.MathUtils.degToRad(pitchDeg);
  return [-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta)];
}

function Sphere({ url }: { url: string }) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.needsUpdate = true;
  }, [tex]);
  return (
    <mesh>
      <sphereGeometry args={[R, 64, 40]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} />
    </mesh>
  );
}

function Rig({
  yaw,
  pitch,
  fov,
  autoRotate,
}: {
  yaw: number;
  pitch: number;
  fov: number;
  autoRotate: boolean;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const [x, y, z] = toPosition(yaw, pitch, 0.1);
    camera.position.set(-x, -y, -z);
    camera.updateProjectionMatrix();
  }, [camera, yaw, pitch]);
  useEffect(() => {
    (camera as THREE.PerspectiveCamera).fov = fov;
    camera.updateProjectionMatrix();
  }, [camera, fov]);
  return (
    <OrbitControls
      enableZoom={false}
      enablePan={false}
      rotateSpeed={-0.35}
      autoRotate={autoRotate}
      autoRotateSpeed={-0.6}
    />
  );
}

function HotspotDot({
  h,
  onSelect,
  active,
}: {
  h: Hotspot;
  onSelect: (h: Hotspot) => void;
  active: boolean;
}) {
  const label =
    h.type === 'product'
      ? (h.product?.name ?? 'Sản phẩm')
      : h.type === 'navigation'
        ? (h.title ?? 'Đi tới góc khác')
        : (h.title ?? 'Thông tin');
  return (
    <Html position={toPosition(h.yaw, h.pitch)} center zIndexRange={[20, 0]}>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(h);
        }}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition hover:scale-110',
          h.type === 'product' ? 'bg-primary' : h.type === 'navigation' ? 'bg-sky-600' : 'bg-stone-600',
          active && 'ring-4 ring-white/60',
        )}
      >
        <Icon
          name={h.type === 'product' ? 'tag' : h.type === 'navigation' ? 'arrowRight' : 'info'}
          size={16}
        />
      </button>
    </Html>
  );
}

interface Props {
  panorama: PanoramaView;
  onSelect: (h: Hotspot) => void;
  selectedId?: number | null;
  /** Hiển thị trên viewer: popover do trang cha render */
  overlay?: React.ReactNode;
  onNavigate?: (panoramaId: number) => void;
  /** Nút phụ ở góc (vd. "Xem 3D") */
  className?: string;
}

export default function SpacePanorama({ panorama, onSelect, selectedId, overlay, className }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [fov, setFov] = useState(panorama.defaultFov || 80);
  const [auto, setAuto] = useState(false);

  useEffect(() => setFov(panorama.defaultFov || 80), [panorama.id, panorama.defaultFov]);

  const zoom = (d: number) => setFov((f) => Math.min(100, Math.max(35, f + d)));

  return (
    <div
      ref={wrap}
      className={cn('relative h-full min-h-[360px] w-full overflow-hidden bg-ink', className)}
      onWheel={(e) => zoom(e.deltaY > 0 ? 4 : -4)}
    >
      <Canvas
        camera={{ fov, near: 0.1, far: 200, position: [0, 0, 0.1] }}
        dpr={[1, 2]}
        aria-label="Ảnh 360 độ"
      >
        <Sphere url={panorama.url} />
        <Rig yaw={panorama.defaultYaw} pitch={panorama.defaultPitch} fov={fov} autoRotate={auto} />
        {panorama.hotspots.map((h) => (
          <HotspotDot key={h.id} h={h} onSelect={onSelect} active={selectedId === h.id} />
        ))}
      </Canvas>
      <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white">
        360° · Kéo để xoay
      </span>
      <div className="absolute bottom-4 right-4 flex gap-2">
        {[
          { icon: 'zoomIn', label: 'Phóng to', run: () => zoom(-8) },
          { icon: 'zoomOut', label: 'Thu nhỏ', run: () => zoom(8) },
          {
            icon: 'rotate',
            label: auto ? 'Tắt tự xoay' : 'Tự xoay',
            run: () => setAuto((a) => !a),
            active: auto,
          },
          { icon: 'expand', label: 'Toàn màn hình', run: () => wrap.current?.requestFullscreen?.() },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.label}
            aria-label={b.label}
            onClick={b.run}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full shadow',
              'active' in b && b.active ? 'bg-primary text-white' : 'bg-white/90 hover:bg-white',
            )}
          >
            <Icon name={b.icon as 'zoomIn'} size={17} />
          </button>
        ))}
      </div>
      {overlay}
    </div>
  );
}
