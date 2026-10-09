'use client';

// Cửa vào dùng trong trang: tắt SSR cho model-viewer (Web Component chỉ có ở trình duyệt).
import dynamic from 'next/dynamic';

export const ModelViewer = dynamic(() => import('./ModelViewerElement'), {
  ssr: false,
  loading: () => <div aria-busy="true" />,
});
