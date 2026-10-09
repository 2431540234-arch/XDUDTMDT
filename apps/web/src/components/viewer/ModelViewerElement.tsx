'use client';

// Bọc thẻ <model-viewer>. Chỉ chạy phía trình duyệt: thư viện đăng ký Web Component nên không được nạp lúc SSR.
// Đừng import trực tiếp file này; dùng ModelViewer.tsx (đã tắt SSR).
import { useEffect, useState } from 'react';

export interface ModelViewerElementProps {
  /** URL tệp GLB (Android, web) */
  src: string;
  /** URL tệp USDZ (iOS Quick Look) */
  iosSrc?: string;
  alt: string;
  poster?: string;
  /** Bật nút AR (Scene Viewer / Quick Look / WebXR) */
  ar?: boolean;
  /** Khóa tỉ lệ khi AR (khớp Product3DModel.allowScaling = false) */
  fixedScale?: boolean;
  className?: string;
}

export default function ModelViewerElement({
  src,
  iosSrc,
  alt,
  poster,
  ar = true,
  fixedScale = true,
  className,
}: ModelViewerElementProps) {
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
      ios-src={iosSrc}
      alt={alt}
      poster={poster}
      ar={ar ? true : undefined} // thuộc tính boolean của Web Component: có mặt là bật, nên không truyền false
      ar-modes="webxr scene-viewer quick-look"
      ar-scale={fixedScale ? 'fixed' : 'auto'}
      camera-controls
      shadow-intensity="1"
    />
  );
}
