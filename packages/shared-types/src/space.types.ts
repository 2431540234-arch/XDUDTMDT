// Định nghĩa các kiểu dữ liệu dùng chung cho không gian (Space) panorama 360°

export interface Space {
  id: string;
  name: string;
  panoramaUrl: string;
  hotspots: SpaceHotspot[];
}

export interface SpaceHotspot {
  id: string;
  productId: string;
  position: { x: number; y: number; z: number };
}
