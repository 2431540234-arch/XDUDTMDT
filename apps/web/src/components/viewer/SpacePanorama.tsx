'use client';

// Viewer ảnh 360° tự dựng bằng React Three Fiber (DECISIONS D-T32): mặt cầu + ảnh equirectangular,
// hotspot lưu tọa độ (yaw, pitch). Kéo để xoay, cuộn để zoom, tự xoay, toàn màn hình.
import { Html, OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { PanoramaView, PlacementModel, PlacementView } from '@/types/api';
import { preferredLod } from './ProductViewer3D';

type Hotspot = PanoramaView['hotspots'][number];

const R = 50;
/** yaw (-180..180°), pitch (-90..90°) → toạ độ trên mặt cầu (khớp cách ảnh được lật ngang) */
export function toPosition(yawDeg: number, pitchDeg: number, r = R - 2): [number, number, number] {
  const f = (yawDeg + 180) / 360;
  const phi = (1 - f) * Math.PI * 2;
  const theta = Math.PI / 2 - THREE.MathUtils.degToRad(pitchDeg);
  return [-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta)];
}

/** Ngược của toPosition: hướng (x,y,z) từ tâm ảnh → yaw/pitch (độ). Dùng khi kéo mô hình trong editor. */
export function fromDirection(x: number, y: number, z: number): { yaw: number; pitch: number } {
  const r = Math.hypot(x, y, z) || 1;
  const pitch = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, y / r))));
  const phi = (Math.atan2(z, -x) + Math.PI * 2) % (Math.PI * 2);
  let yaw = (1 - phi / (Math.PI * 2)) * 360 - 180;
  if (yaw > 180) yaw -= 360;
  if (yaw < -180) yaw += 360;
  return { yaw, pitch };
}

/** Món được khách "Đổi món" thử: thay mô hình/biến thể tại vị trí cũ, chỉ ở client */
export interface PlacementOverride {
  productId: number;
  name: string;
  variantId: number | null;
  model: PlacementModel;
}

type Lod = 'high' | 'medium' | 'low';
/** Chọn tệp GLB theo LOD phù hợp thiết bị (điện thoại/mạng chậm ⇒ low), thiếu thì lùi về LOD gần nhất */
export function pickLodUrl(files: PlacementModel['files'], want: Lod): string | null {
  const order: Lod[] =
    want === 'low'
      ? ['low', 'medium', 'high']
      : want === 'medium'
        ? ['medium', 'high', 'low']
        : ['high', 'medium', 'low'];
  for (const l of order) {
    const f = files.find((x) => x.lod === l);
    if (f?.url) return f.url;
  }
  return files[0]?.url ?? null;
}

/** Bản sao của cảnh GLB (cache của useGLTF dùng chung) với cấu hình vật liệu của biến thể được áp lên vật liệu cùng tên */
function tinted(scene: THREE.Object3D, model: PlacementModel, variantId: number | null): THREE.Object3D {
  const root = scene.clone(true);
  const mv = variantId == null ? undefined : model.materialVariants.find((m) => m.variantId === variantId);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const clone = (m: THREE.Material) => {
      const c = m.clone() as THREE.MeshStandardMaterial;
      if (mv && c.name === mv.materialName) {
        if (mv.config.baseColor && c.color) c.color.set(mv.config.baseColor);
        if (mv.config.roughness !== undefined) c.roughness = mv.config.roughness;
        if (mv.config.metalness !== undefined) c.metalness = mv.config.metalness;
      }
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
  });
  return root;
}

function Sphere({ url, onReady }: { url: string; onReady?: () => void }) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.needsUpdate = true;
  }, [tex]);
  useEffect(() => onReady?.(), []);
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
  dragging,
}: {
  yaw: number;
  pitch: number;
  fov: number;
  autoRotate: boolean;
  dragging: boolean;
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
      enabled={!dragging}
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

/** Ảnh 360° tải lỗi (mất mạng, tệp bị xóa…) chỉ làm hỏng khung xem, không làm sập cả trang */
class PanoramaBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 bg-ink p-6 text-center text-white/80"
      >
        <p className="text-sm">Không tải được ảnh 360° này. Vui lòng kiểm tra kết nối rồi thử lại.</p>
        <button
          type="button"
          onClick={() => {
            useTexture.clear(this.props.resetKey); // bỏ kết quả lỗi đã nhớ để tải lại thật sự
            this.setState({ failed: false });
          }}
          className="rounded-btn bg-white px-4 py-1.5 text-sm font-semibold text-ink"
        >
          Thử lại
        </button>
      </div>
    );
  }
}

/** Một mô hình lỗi tải (mất mạng, tệp hỏng) chỉ bị bỏ qua, không làm hỏng cả ảnh 360° */
class ModelBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface PlacedItem {
  key: string;
  p: PlacementView;
  model: PlacementModel;
  variantId: number | null;
  name: string;
}

/** UC-SPACE-04: mô hình 3D đặt tại (yaw, pitch, distance), xoay rotationX/Y/Z (độ), tỉ lệ scale; mặt trước hướng về tâm ảnh */
function PlacedModel({
  item,
  selected,
  draggable,
  onLoaded,
  onSelect,
  onDragStart,
}: {
  item: PlacedItem;
  selected: boolean;
  draggable: boolean;
  onLoaded: () => void;
  onSelect: () => void;
  onDragStart: () => void;
}) {
  const { p, model, variantId, name } = item;
  const [want] = useState(preferredLod);
  const url = pickLodUrl(model.files, want) ?? '';
  const { scene } = useGLTF(url, false); // Meshopt có sẵn; không dùng Draco (tránh tải bộ giải nén từ CDN)
  const obj = useMemo(() => tinted(scene, model, variantId), [scene, model, variantId]);
  useEffect(() => {
    onLoaded();
  }, []);
  const pos = toPosition(p.yaw, p.pitch, p.distance);
  const g = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    g.current?.lookAt(0, 0, 0);
  }, [pos[0], pos[1], pos[2]]);
  const rad = THREE.MathUtils.degToRad;
  return (
    <>
      <group ref={g} position={pos}>
        <group rotation={[rad(p.rotationX), rad(p.rotationY), rad(p.rotationZ)]} scale={p.scale}>
          <primitive
            object={obj}
            onClick={(e: { stopPropagation: () => void }) => {
              e.stopPropagation();
              onSelect();
            }}
          />
        </group>
      </group>
      <Html position={pos} center zIndexRange={[20, 0]}>
        <button
          type="button"
          data-testid={`placement-pin-${p.id}`}
          aria-label={`Mô hình 3D: ${name}`}
          title={name}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onPointerDown={(e) => {
            if (!draggable) return;
            e.stopPropagation();
            e.preventDefault();
            onDragStart();
          }}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-ink/80 text-white shadow-lg transition hover:scale-110',
            draggable && 'cursor-grab touch-none',
            selected && 'ring-4 ring-white/60',
          )}
        >
          <Icon name="cube" size={15} />
        </button>
      </Html>
    </>
  );
}

/** Kéo ghim của mô hình đang sửa: chuyển vị trí con trỏ thành hướng yaw/pitch trên ảnh 360° */
function DragController({
  active,
  onMove,
  onEnd,
}: {
  active: boolean;
  onMove: (yaw: number, pitch: number) => void;
  onEnd: () => void;
}) {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!active) return;
    const rc = new THREE.Raycaster();
    const move = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      rc.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const d = rc.ray.direction;
      const { yaw, pitch } = fromDirection(d.x, d.y, d.z);
      onMove(Math.round(yaw * 10) / 10, Math.round(pitch * 10) / 10);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', onEnd);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', onEnd);
    };
  }, [active, camera, gl, onMove, onEnd]);
  return null;
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
  /** Mô hình 3D đã đặt trong ảnh (UC-SPACE-04). Không có/rỗng ⇒ hiển thị y như trước */
  placements?: PlacementView[];
  /** "Đổi món" thử ở client: placementId → món thay thế (không lưu) */
  overrides?: Record<number, PlacementOverride>;
  selectedPlacementId?: number | null;
  onSelectPlacement?: (p: PlacementView) => void;
  /** Chế độ sửa của admin: ghim của placement `id` kéo được, onMove nhận yaw/pitch mới */
  edit?: { id: number; onMove: (yaw: number, pitch: number) => void } | null;
}

export default function SpacePanorama({
  panorama,
  onSelect,
  selectedId,
  overlay,
  className,
  placements,
  overrides,
  selectedPlacementId,
  onSelectPlacement,
  edit,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [fov, setFov] = useState(panorama.defaultFov || 80);
  const [auto, setAuto] = useState(false);
  const [bgReady, setBgReady] = useState(false); // ảnh 360° đã hiện ⇒ mới bắt đầu tải mô hình 3D (nhẹ cho điện thoại)
  const [loaded, setLoaded] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const items: PlacedItem[] = (placements ?? []).flatMap((p) => {
    const o = overrides?.[p.id];
    const model = o?.model ?? p.model;
    if (!model) return [];
    return [
      {
        key: `${p.id}:${model.id}`,
        p,
        model,
        variantId: o ? o.variantId : p.variantId,
        name: o?.name ?? p.product?.name ?? 'Sản phẩm',
      },
    ];
  });
  const markLoaded = (k: string) => setLoaded((l) => (l.includes(k) ? l : [...l, k]));

  useEffect(() => setFov(panorama.defaultFov || 80), [panorama.id, panorama.defaultFov]);
  useEffect(() => {
    setBgReady(false);
    setLoaded([]);
  }, [panorama.url]);

  const zoom = (d: number) => setFov((f) => Math.min(100, Math.max(35, f + d)));

  return (
    <div
      ref={wrap}
      className={cn('relative h-full min-h-[360px] w-full overflow-hidden bg-ink', className)}
      onWheel={(e) => zoom(e.deltaY > 0 ? 4 : -4)}
    >
      <PanoramaBoundary resetKey={panorama.url}>
        <Canvas
          camera={{ fov, near: 0.1, far: 200, position: [0, 0, 0.1] }}
          dpr={[1, 2]}
          aria-label="Ảnh 360 độ"
        >
          <Sphere url={panorama.url} onReady={() => setBgReady(true)} />
          <Rig
            yaw={panorama.defaultYaw}
            pitch={panorama.defaultPitch}
            fov={fov}
            autoRotate={auto}
            dragging={dragging}
          />
          {panorama.hotspots.map((h) => (
            <HotspotDot key={h.id} h={h} onSelect={onSelect} active={selectedId === h.id} />
          ))}
          {bgReady && items.length > 0 && (
            <>
              <ambientLight intensity={1.3} />
              <directionalLight position={[3, 5, 4]} intensity={1.6} />
              <DragController
                active={dragging}
                onMove={(yaw, pitch) => edit?.onMove(yaw, pitch)}
                onEnd={() => setDragging(false)}
              />
              {items.map((it) => (
                <ModelBoundary key={it.key} onFail={() => markLoaded(it.key)}>
                  <Suspense fallback={null}>
                    <PlacedModel
                      item={it}
                      selected={selectedPlacementId === it.p.id}
                      draggable={edit?.id === it.p.id}
                      onLoaded={() => markLoaded(it.key)}
                      onSelect={() => onSelectPlacement?.(it.p)}
                      onDragStart={() => setDragging(true)}
                    />
                  </Suspense>
                </ModelBoundary>
              ))}
            </>
          )}
        </Canvas>
      </PanoramaBoundary>
      {items.length > 0 && (
        <>
          <div
            data-testid="placed-models"
            data-total={items.length}
            data-loaded={items.filter((i) => loaded.includes(i.key)).length}
            data-items={JSON.stringify(
              items.map((i) => ({
                id: i.p.id,
                productId: overrides?.[i.p.id]?.productId ?? i.p.productId,
                modelId: i.model.id,
                variantId: i.variantId,
                loaded: loaded.includes(i.key),
              })),
            )}
            className="sr-only"
          />
          {bgReady && loaded.length < items.length && (
            <span
              data-testid="placements-loading"
              role="status"
              className="pointer-events-none absolute left-4 top-14 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white"
            >
              Đang tải mô hình 3D…
            </span>
          )}
        </>
      )}
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
