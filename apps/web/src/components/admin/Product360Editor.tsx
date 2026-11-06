'use client';

// Tab "Ảnh 360°" trong form sản phẩm (admin): bật/tắt 360°, chọn màu, tải nhiều ảnh (tự sắp xếp theo tên file frame-01…36),
// kéo thả đổi thứ tự, xem trước xoay, cảnh báo khi số frame giữa các màu không bằng nhau.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import UploadDropzone, { readAsDataUrl } from '@/components/admin/UploadDropzone';
import Rotator360 from '@/components/product/Rotator360';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';

type ColorFrames = { name: string; hex: string; frames: string[] };

export default function Product360Editor({ productId }: { productId: number }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'p360', productId],
    queryFn: () => adminApi.products.get360(productId),
  });
  const [enabled, setEnabled] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [colors, setColors] = useState<ColorFrames[]>([]);
  const [active, setActive] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const d = q.data;
    if (!d) return;
    setEnabled(d.enabled);
    setAutoRotate(d.autoRotate);
    const all: ColorFrames[] = d.variantColors.map(
      (c) => d.colors.find((x) => x.name === c.name) ?? { name: c.name, hex: c.hex, frames: [] },
    );
    setColors(all);
    setActive((a) => a || all[0]?.name || '');
  }, [q.data]);

  const cur = colors.find((c) => c.name === active);
  const setFrames = (frames: string[]) =>
    setColors((cs) => cs.map((c) => (c.name === active ? { ...c, frames } : c)));
  const counts = colors.filter((c) => c.frames.length).map((c) => c.frames.length);
  const mismatch = new Set(counts).size > 1;

  const save = useMutation({
    mutationFn: () => adminApi.products.save360(productId, { enabled, autoRotate, colors }),
    onSuccess: () => {
      toast.success('Đã lưu ảnh 360°.');
      qc.invalidateQueries({ queryKey: ['admin', 'p360', productId] });
      qc.invalidateQueries({ queryKey: ['p360'] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const addFiles = async (files: File[]) => {
    // tự sắp xếp theo tên file (frame-01 … frame-36), so sánh số
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const urls = await Promise.all(sorted.map(readAsDataUrl));
    setFrames([...(cur?.frames ?? []), ...urls]);
    setFrame(0);
  };
  const drop = (to: number) => {
    if (drag === null || !cur || drag === to) return;
    const next = [...cur.frames];
    const [m] = next.splice(drag, 1);
    next.splice(to, 0, m);
    setFrames(next);
    setDrag(null);
  };

  if (q.isLoading) return <Skeleton className="h-60 w-full" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />{' '}
          Bật xem 360° cho sản phẩm này
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={(e) => setAutoRotate(e.target.checked)}
            className="accent-primary"
          />{' '}
          Tự xoay khi mở trang
        </label>
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Lưu ảnh 360°
        </Button>
      </div>

      {mismatch && (
        <p role="alert" className="rounded-btn bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <Icon name="alert" size={15} className="mr-1 inline" /> Số frame giữa các màu không bằng nhau (
          {counts.join(' / ')}). Nên dùng cùng một số frame (24 hoặc 36) cho mọi màu để giữ nguyên góc khi đổi
          màu.
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Chọn màu">
        {colors.map((c) => (
          <button
            key={c.name}
            type="button"
            role="tab"
            aria-selected={c.name === active}
            onClick={() => {
              setActive(c.name);
              setFrame(0);
            }}
            className={cn(
              'flex items-center gap-2 rounded-btn border px-3 py-1.5 text-sm font-medium',
              c.name === active ? 'border-primary bg-primary-soft/40' : 'border-line hover:border-primary',
            )}
          >
            <span className="h-4 w-4 rounded-full border border-black/15" style={{ background: c.hex }} />{' '}
            {c.name}
            <span className="text-xs text-muted">({c.frames.length})</span>
          </button>
        ))}
      </div>

      <UploadDropzone
        label={`Tải ảnh frame cho màu ${active}`}
        multiple
        maxMB={2}
        hint="Kéo thả nhiều ảnh (frame-01.jpg … frame-36.jpg, tối đa 2MB/ảnh) – tự sắp xếp theo tên tệp"
        onError={toast.error}
        onFiles={addFiles}
      />

      {cur && cur.frames.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="mb-2 text-sm text-muted">{cur.frames.length} frame · kéo thả để đổi thứ tự</p>
            <ul className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {cur.frames.map((u, i) => (
                <li
                  key={u + i}
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(i)}
                  className={cn(
                    'group relative cursor-grab overflow-hidden rounded border bg-surface-muted',
                    drag === i ? 'border-primary opacity-50' : 'border-line',
                  )}
                >
                  <img
                    src={u}
                    alt={`Frame ${i + 1}`}
                    draggable={false}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="absolute left-0.5 top-0.5 rounded bg-ink/70 px-1 text-[10px] text-white">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`Xóa frame ${i + 1}`}
                    onClick={() => setFrames(cur.frames.filter((_, k) => k !== i))}
                    className="absolute right-0.5 top-0.5 hidden rounded bg-white/90 p-0.5 text-danger group-hover:block"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setFrames([])}>
              Xóa toàn bộ frame của màu này
            </Button>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Xem trước xoay</p>
            <div className="overflow-hidden rounded-card border border-line">
              <Rotator360
                frames={cur.frames}
                frame={Math.min(frame, cur.frames.length - 1)}
                onFrame={setFrame}
                playing={playing}
                onPlaying={setPlaying}
                alt={`Xem trước màu ${cur.name}`}
                className="h-[340px]"
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-card bg-surface-muted/60 p-4 text-sm text-muted">
          Màu {active} chưa có ảnh 360°.
        </p>
      )}
    </div>
  );
}
