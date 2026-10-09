// Khai báo kiểu cho thẻ <model-viewer> (Web Component của @google/model-viewer) dùng trong JSX.
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

interface ModelViewerAttributes extends HTMLAttributes<HTMLElement> {
  class?: string;
  src?: string;
  /** Tệp USDZ cho iOS Quick Look */
  'ios-src'?: string;
  alt?: string;
  poster?: string;
  ar?: boolean;
  /** Thứ tự chế độ AR: webxr, scene-viewer (Android), quick-look (iOS) */
  'ar-modes'?: string;
  /** fixed: khóa tỉ lệ (khớp allowScaling = false); auto: cho phóng/thu */
  'ar-scale'?: 'auto' | 'fixed';
  'ar-placement'?: 'floor' | 'wall';
  'camera-controls'?: boolean;
  'auto-rotate'?: boolean;
  'shadow-intensity'?: string | number;
  'environment-image'?: string;
  exposure?: string | number;
  loading?: 'auto' | 'lazy' | 'eager';
  reveal?: 'auto' | 'interaction' | 'manual';
}

type ModelViewerProps = DetailedHTMLProps<ModelViewerAttributes, HTMLElement>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerProps;
    }
  }
}

export {};
