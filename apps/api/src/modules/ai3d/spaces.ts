// Các space Hugging Face đã khảo sát. Mỗi space có API riêng nên mỗi space một "adapter" (endpoint, tham số, thứ tự gọi).
// Thêm space mới (hoặc dịch vụ trả phí) không phải sửa luồng tạo/duyệt.

/** Gọi một endpoint của space và trả về mảng kết quả */
export type SpaceCall = (endpoint: string, payload: Record<string, unknown>) => Promise<unknown[]>;

export interface SpaceAdapter {
  label: string;
  /** ghi chú hiện cho admin (giấy phép, giới hạn) */
  note: string;
  /** chạy đủ các bước và trả về tệp GLB ({ url }) trong dữ liệu kết quả */
  run(call: SpaceCall, image: unknown): Promise<{ url: string }>;
}

/** Tìm tệp .glb đầu tiên trong kết quả (đối tượng FileData có url) */
export function findGlb(data: unknown, prefer?: RegExp): { url: string } | null {
  const found: Array<{ url: string; name: string }> = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    const o = v as { url?: unknown; path?: unknown; orig_name?: unknown };
    if (typeof o.url === 'string') {
      const name = String(o.orig_name ?? o.path ?? o.url).split('?')[0];
      if (/\.glb$/i.test(name)) found.push({ url: o.url, name });
      return;
    }
    Object.values(v as object).forEach(walk);
  };
  walk(data);
  return (prefer && found.find((f) => prefer.test(f.name))) || found[0] || null;
}

const required = (file: { url: string } | null) => {
  if (!file) throw new Error('Kết quả không có tệp GLB.');
  return file;
};

export const SPACE_ADAPTERS: Record<string, SpaceAdapter> = {
  'trellis-community/TRELLIS': {
    label: 'TRELLIS (cộng đồng)',
    note: 'Nhanh. Model TRELLIS ghi giấy phép MIT. Space do cộng đồng duy trì.',
    async run(call, image) {
      await call('/start_session', {});
      const data = await call('/generate_and_extract_glb', {
        image,
        multiimages: [],
        seed: 0,
        ss_guidance_strength: 7.5,
        ss_sampling_steps: 12,
        slat_guidance_strength: 3,
        slat_sampling_steps: 12,
        multiimage_algo: 'stochastic',
        mesh_simplify: 0.95,
        texture_size: 1024,
      });
      return required(findGlb(data));
    },
  },
  'tencent/Hunyuan3D-2.1': {
    label: 'Hunyuan3D 2.1 (Tencent)',
    note: 'Chậm (khoảng 2 phút, tốn nhiều lượt GPU). Giấy phép Tencent KHÔNG áp dụng tại EU, Anh và Hàn Quốc, kể cả với mô hình tạo ra.',
    async run(call, image) {
      const data = await call('/generation_all', {
        image,
        steps: 30,
        guidance_scale: 5,
        seed: 1234,
        octree_resolution: 256,
        check_box_rembg: true,
        num_chunks: 8000,
        randomize_seed: false,
      });
      return required(findGlb(data, /textured/i));
    },
  },
};
