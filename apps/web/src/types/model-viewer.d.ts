// Khai báo kiểu cho thẻ <model-viewer> (Web Component của @google/model-viewer) dùng trong JSX.
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

interface ModelViewerAttributes extends HTMLAttributes<HTMLElement> {
  class?: string;
  src?: string;
  alt?: string;
  poster?: string;
  'camera-controls'?: boolean;
  'camera-orbit'?: string;
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
