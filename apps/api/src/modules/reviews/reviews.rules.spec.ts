// Unit test: quy tắc đánh giá (điều kiện được đánh giá, tính lại điểm trung bình) và chuẩn hóa nội dung Markdown.
import { MAX_MARKDOWN_LENGTH, normalizeMarkdown } from '../pages/admin-content.service';
import { averageRating, MAX_REVIEW_IMAGES, reviewEligibility } from './reviews.service';

describe('điều kiện được đánh giá', () => {
  it('chỉ khi sản phẩm thuộc đơn đã giao của chính khách và chưa đánh giá', () => {
    expect(reviewEligibility({ purchasedAndDelivered: true, alreadyReviewed: false })).toBeNull();
  });
  it('chưa mua / đơn chưa giao / đơn của người khác ⇒ PURCHASE_REQUIRED', () => {
    expect(reviewEligibility({ purchasedAndDelivered: false, alreadyReviewed: false })).toBe(
      'PURCHASE_REQUIRED',
    );
    expect(reviewEligibility({ purchasedAndDelivered: false, alreadyReviewed: true })).toBe(
      'PURCHASE_REQUIRED',
    );
  });
  it('một đánh giá / sản phẩm / đơn ⇒ trùng là CONFLICT', () => {
    expect(reviewEligibility({ purchasedAndDelivered: true, alreadyReviewed: true })).toBe('CONFLICT');
  });
  it('tối đa 5 ảnh cho mỗi đánh giá', () => {
    expect(MAX_REVIEW_IMAGES).toBe(5);
  });
});

describe('averageRating (chỉ tính approved)', () => {
  const r = (rating: number, status: string) => ({ rating, status });
  it('trung bình và số lượng chỉ từ approved', () => {
    expect(averageRating([r(5, 'approved'), r(4, 'approved'), r(1, 'pending'), r(1, 'rejected')])).toEqual({
      avg: 4.5,
      count: 2,
    });
  });
  it('làm tròn 2 chữ số', () => {
    expect(averageRating([r(5, 'approved'), r(4, 'approved'), r(4, 'approved')])).toEqual({
      avg: 4.33,
      count: 3,
    });
  });
  it('duyệt thêm / ẩn đi làm điểm đổi theo', () => {
    const base = [r(5, 'approved'), r(3, 'pending')];
    expect(averageRating(base).avg).toBe(5);
    expect(averageRating([r(5, 'approved'), r(3, 'approved')]).avg).toBe(4);
    expect(averageRating([r(5, 'approved'), r(3, 'rejected')]).avg).toBe(5);
  });
  it('không có đánh giá hiển thị ⇒ 0', () => {
    expect(averageRating([])).toEqual({ avg: 0, count: 0 });
    expect(averageRating([r(5, 'pending')])).toEqual({ avg: 0, count: 0 });
  });
});

describe('normalizeMarkdown (nội dung Markdown lưu nguyên văn; chống XSS do FE khi hiển thị)', () => {
  it('giữ nguyên cú pháp Markdown, liên kết và tiếng Việt', () => {
    const md =
      '## Tiêu đề\n\n- Gạch đầu dòng **đậm**\n- Xem [chính sách](https://aurelia.vn/doi-tra)\n\n_Ghi chú_';
    expect(normalizeMarkdown(md)).toBe(md);
  });
  it('mã độc dạng văn bản được lưu như văn bản (không chạy được vì FE tắt HTML thô, chặn javascript:)', () => {
    const evil = '<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>';
    expect(normalizeMarkdown(evil)).toBe(evil);
  });
  it('bỏ ký tự điều khiển (NUL, ESC, DEL), giữ xuống dòng/tab, chuẩn hóa CRLF', () => {
    expect(normalizeMarkdown('a\u0000b\u001b[31mc\u007fd\r\ne\tf')).toBe('ab[31mcd\ne\tf');
  });
  it('cắt khoảng trắng hai đầu và giới hạn độ dài', () => {
    expect(normalizeMarkdown('  xin chào  \n')).toBe('xin chào');
    expect(normalizeMarkdown('x'.repeat(MAX_MARKDOWN_LENGTH + 50))).toHaveLength(MAX_MARKDOWN_LENGTH);
  });
});
