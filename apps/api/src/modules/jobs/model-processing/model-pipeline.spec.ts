import type { ModelStatus } from '@aurelia-living/shared-types';
import { actionBlocker, publicViewerConfig, readPipeline, type ModelPipeline } from './model-pipeline';

const pipeline = (over: Partial<ModelPipeline> = {}): ModelPipeline => ({
  source: 'ai',
  stage: 'review',
  createdAt: new Date(0).toISOString(),
  createdBy: 1,
  fileName: 'x.glb',
  rawKey: 'models/incoming/x.glb',
  options: { removeFloor: true, yawDeg: 0 },
  variants: {},
  ...over,
});
const STATUSES: ModelStatus[] = ['uploading', 'processing', 'pending_review', 'ready', 'failed'];
const allowed = (action: Parameters<typeof actionBlocker>[0], p: ModelPipeline | null) =>
  STATUSES.filter((s) => actionBlocker(action, s, p) === null);

describe('máy trạng thái duyệt mô hình', () => {
  it('chỉ duyệt được bản đang chờ duyệt', () => {
    expect(allowed('approve', pipeline())).toEqual(['pending_review']);
    expect(allowed('approve', null)).toEqual([]);
  });
  it('bỏ: chờ duyệt, lỗi, tải dở – không bỏ bản đã duyệt hay đang xử lý', () => {
    expect(allowed('reject', pipeline())).toEqual(['uploading', 'pending_review', 'failed']);
  });
  it('chuẩn hóa lại cần tệp gốc; tạo lại chỉ cho mô hình AI', () => {
    expect(allowed('renormalize', pipeline())).toEqual(['pending_review', 'failed']);
    expect(allowed('renormalize', pipeline({ rawKey: undefined }))).toEqual([]);
    expect(allowed('regenerate', pipeline())).toEqual(['pending_review', 'failed']);
    expect(allowed('regenerate', pipeline({ source: 'upload' }))).toEqual([]);
  });
  it('dữ liệu cho khách không chứa thông tin quy trình', () => {
    const config = { autoRotate: true, pipeline: pipeline() };
    expect(publicViewerConfig(config)).toEqual({ autoRotate: true });
    expect(readPipeline(config)?.source).toBe('ai');
    expect(readPipeline({ autoRotate: true })).toBeNull();
  });
});
