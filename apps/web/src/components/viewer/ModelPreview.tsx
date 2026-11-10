'use client';

// Xem trước 360° nhỏ gọn cho một tệp GLB (dùng trong modal tải lên mô hình, WIREFRAME 7.23, và chi tiết mô hình)
import { useEffect, useRef, useState } from 'react';

export default function ModelPreview({ src, alt }: { src: string; alt: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const viewer = useRef<HTMLElement | null>(null);
  useEffect(() => {
    import('@google/model-viewer').then(() => setReady(true));
  }, []);
  // đổi tệp ⇒ thử lại từ đầu
  useEffect(() => setFailed(false), [src]);
  // <model-viewer> phát sự kiện 'error' khi không tải/giải mã được tệp (React không gắn được onError cho phần tử tùy biến)
  useEffect(() => {
    const el = viewer.current;
    if (!el) return;
    const onError = () => setFailed(true);
    el.addEventListener('error', onError);
    return () => el.removeEventListener('error', onError);
  }, [ready, src, failed]);
  if (failed)
    return (
      <div
        role="alert"
        className="flex h-full items-center justify-center px-3 text-center text-xs text-danger"
      >
        Không tải được tệp mô hình. Kiểm tra lại tệp GLB.
      </div>
    );
  if (!ready)
    return <div className="flex h-full items-center justify-center text-xs text-muted">Đang tải…</div>;
  return (
    <model-viewer
      ref={viewer}
      class="h-full w-full"
      src={src}
      alt={alt}
      camera-controls
      auto-rotate
      shadow-intensity="1"
    />
  );
}
