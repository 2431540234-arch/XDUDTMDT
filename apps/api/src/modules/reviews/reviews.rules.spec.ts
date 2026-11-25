// Unit test: quy tắc đánh giá (điều kiện được đánh giá, tính lại điểm trung bình).
import { averageRating, reviewEligibility } from './reviews.service';

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
