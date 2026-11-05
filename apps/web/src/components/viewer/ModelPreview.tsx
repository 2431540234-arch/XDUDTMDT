'use client';

// Xem trước 360° nhỏ gọn cho một tệp GLB (dùng trong modal tải lên mô hình, WIREFRAME 7.23)
import { useEffect, useState } from 'react';

export default function ModelPreview({ src, alt }: { src: string; alt: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    import('@google/model-viewer').then(() => setReady(true));
  }, []);
  if (!ready)
    return <div className="flex h-full items-center justify-center text-xs text-muted">Đang tải…</div>;
  return (
    <model-viewer
      class="h-full w-full"
      src={src}
      alt={alt}
      camera-controls
      auto-rotate
      shadow-intensity="1"
    />
  );
}
