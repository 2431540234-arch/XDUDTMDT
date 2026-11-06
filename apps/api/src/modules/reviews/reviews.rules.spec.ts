// Unit test: quy tắc đánh giá (điều kiện được đánh giá, tính lại điểm trung bình) và lọc HTML chống XSS.
import { sanitizeRichText } from '../pages/admin-content.service';
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

describe('sanitizeRichText (chống XSS)', () => {
  it('bỏ script, sự kiện on*, javascript: và iframe', () => {
    const out = sanitizeRichText(
      '<p onclick="x()">Chào</p><script>alert(1)</script><a href="javascript:alert(1)">bấm</a><iframe src="//evil"></iframe><img src=x onerror=alert(1)>',
    );
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|iframe/i);
    expect(out).toContain('<p>Chào</p>');
  });
  it('giữ định dạng cơ bản, liên kết https và ảnh https', () => {
    const out = sanitizeRichText(
      '<h2>Tiêu đề</h2><p><strong>đậm</strong> <a href="https://aurelia.vn">link</a></p><img src="https://x.vn/a.png" alt="a">',
    );
    expect(out).toContain('<h2>Tiêu đề</h2>');
    expect(out).toContain('<strong>đậm</strong>');
    expect(out).toContain('href="https://aurelia.vn"');
    expect(out).toContain('src="https://x.vn/a.png"');
  });
  it('ảnh data: và liên kết vbscript bị loại', () => {
    expect(sanitizeRichText('<img src="data:text/html;base64,AAAA">')).not.toContain('data:');
    expect(sanitizeRichText('<a href="vbscript:x">a</a>')).not.toContain('vbscript');
  });
});
