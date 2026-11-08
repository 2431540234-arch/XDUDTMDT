'use client';

// Bọc thẻ <model-viewer>. Chỉ chạy phía trình duyệt: thư viện đăng ký Web Component nên không được nạp lúc SSR.
// Đừng import trực tiếp file này; dùng ModelViewer.tsx (đã tắt SSR).
import { useEffect, useState } from 'react';

export interface ModelViewerElementProps {
  /** URL tệp GLB (hệ thống chỉ hỗ trợ GLB; AR ngoài phạm vi, D-P11) */
  src: string;
  alt: string;
  poster?: string;
  className?: string;
}

export default function ModelViewerElement({ src, alt, poster, className }: ModelViewerElementProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Nạp thư viện sau khi mount để không đụng SSR/hydration
    import('@google/model-viewer').then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <div className={className} aria-busy="true" />;

  return (
    <model-viewer
      // React 18 không chuyển className thành class cho Web Component, nên dùng thẳng thuộc tính class
      class={className}
      src={src}
      alt={alt}
      poster={poster}
      camera-controls
      shadow-intensity="1"
    />
  );
}
