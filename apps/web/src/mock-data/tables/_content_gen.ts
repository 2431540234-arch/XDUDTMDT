// Sinh: settings, faq_topics
import type { Setting } from '@aurelia-living/shared-types';

const at = '2026-01-03T08:00:00.000Z';

// ---------------- FAQ (chưa có trong DB) ----------------
export const faqTopics = [
  {
    key: 'giao-hang',
    label: 'Giao hàng & lắp đặt',
    items: [
      [
        'Thời gian giao hàng là bao lâu?',
        'Nội thành TP.HCM và Hà Nội 1–2 ngày, các tỉnh khác 3–5 ngày làm việc kể từ khi đơn được xác nhận.',
      ],
      [
        'Aurelia có lắp đặt tại nhà không?',
        'Có. Với sofa, giường, tủ, bàn ăn, đội kỹ thuật sẽ lắp đặt miễn phí tại nhà khi giao hàng.',
      ],
      [
        'Phí vận chuyển được tính thế nào?',
        'Tính theo khu vực và hiển thị khi thanh toán. Đơn từ 10 triệu đồng được miễn phí vận chuyển.',
      ],
    ],
  },
  {
    key: 'thanh-toan',
    label: 'Thanh toán',
    items: [
      [
        'Tôi có thể thanh toán bằng những cách nào?',
        'COD, chuyển khoản ngân hàng và cổng VNPAY. MoMo, ZaloPay, thẻ quốc tế sẽ được bổ sung trong thời gian tới.',
      ],
      [
        'Thanh toán online có an toàn không?',
        'Giao dịch được xử lý qua cổng thanh toán chuẩn PCI-DSS, Aurelia không lưu thông tin thẻ của bạn.',
      ],
      [
        'Tôi có thể xuất hóa đơn VAT không?',
        'Có. Vui lòng ghi chú thông tin công ty khi đặt hàng hoặc liên hệ hotline để được hỗ trợ.',
      ],
    ],
  },
  {
    key: 'doi-tra',
    label: 'Đổi trả & bảo hành',
    items: [
      [
        'Điều kiện đổi trả sản phẩm?',
        'Đổi trả trong 7 ngày kể từ ngày nhận hàng với sản phẩm lỗi, giao sai hoặc không đúng mô tả.',
      ],
      [
        'Bao lâu tôi nhận được tiền hoàn?',
        'Sau khi kiểm tra sản phẩm, tiền được hoàn trong 3–5 ngày làm việc.',
      ],
      ['Thời hạn bảo hành là bao lâu?', 'Từ 12 đến 36 tháng tùy sản phẩm, được ghi rõ ở trang chi tiết.'],
    ],
  },
  {
    key: '3d-ar',
    label: 'Sản phẩm 3D',
    items: [
      [
        'Làm sao để xem sản phẩm 3D?',
        'Bấm ô "3D" ở hình ảnh sản phẩm hoặc nút "Trải nghiệm 3D ngay" để mở trình xem 3D.',
      ],
      [
        'Sản phẩm nào cũng có mô hình 3D không?',
        'Chưa. Nút 3D chỉ hiện ở sản phẩm đã có mô hình được duyệt. Mô hình mang tính minh họa, màu và chi tiết có thể khác sản phẩm thật.',
      ],
    ],
  },
  {
    key: 'tai-khoan',
    label: 'Tài khoản',
    items: [
      [
        'Tôi quên mật khẩu thì làm thế nào?',
        'Bấm "Quên mật khẩu?" ở trang đăng nhập, nhập email để nhận mã OTP 6 số và đặt lại mật khẩu mới.',
      ],
      [
        'Làm sao để thay đổi địa chỉ giao hàng?',
        'Vào Tài khoản > Địa chỉ của tôi để thêm, sửa hoặc đặt địa chỉ mặc định.',
      ],
    ],
  },
  {
    key: 'khuyen-mai',
    label: 'Khuyến mãi',
    items: [
      [
        'Mã giảm giá áp dụng như thế nào?',
        'Nhập mã ở trang Giỏ hàng. Hệ thống kiểm tra điều kiện đơn tối thiểu, hạn dùng và phạm vi áp dụng.',
      ],
      ['Một đơn có dùng nhiều mã được không?', 'Mỗi đơn hàng áp dụng tối đa một mã giảm giá.'],
    ],
  },
].map((t) => ({ ...t, items: t.items.map(([question, answer], i) => ({ id: i + 1, question, answer })) }));

// ---------------- Cài đặt (settings: key/value JSON) ----------------
export const settings: Setting[] = [
  {
    id: 1,
    key: 'store',
    value: {
      name: 'Aurelia Living',
      slogan: 'Nội thất cho không gian sống hiện đại',
      email: 'aurelia@gmail.com',
      hotline: '0123 456 789',
      address: '123 Nguyễn Văn A, TP.HCM',
      taxCode: '0312345678',
      logoUrl: null,
    },
    description: 'Thông tin cửa hàng',
    createdAt: at,
    updatedAt: at,
  },
  {
    id: 2,
    key: 'payments',
    value: [
      { method: 'cod', enabled: true, description: 'Thanh toán bằng tiền mặt khi nhận hàng' },
      { method: 'bank_transfer', enabled: true, description: 'Chuyển khoản, admin xác nhận thủ công' },
      { method: 'vnpay', enabled: true, description: 'Cổng thanh toán VNPAY (sandbox)' },
      { method: 'momo', enabled: true, description: 'Ví MoMo – mô phỏng (chưa tích hợp thật, D-N20)' },
      { method: 'zalopay', enabled: true, description: 'Ví ZaloPay – mô phỏng (chưa tích hợp thật, D-N20)' },
      {
        method: 'card',
        enabled: true,
        description: 'Thẻ ngân hàng / thẻ tín dụng – đi qua cổng VNPAY (D-N17)',
      },
    ],
    description: 'Phương thức thanh toán',
    createdAt: at,
    updatedAt: at,
  },
  {
    id: 3,
    key: 'shippingZones',
    value: [
      { id: 1, name: 'TP. Hồ Chí Minh', fee: 30000, freeFrom: 10_000_000, eta: '1–2 ngày' },
      { id: 2, name: 'Hà Nội', fee: 45000, freeFrom: 10_000_000, eta: '1–3 ngày' },
      { id: 3, name: 'Đà Nẵng', fee: 60000, freeFrom: 10_000_000, eta: '2–4 ngày' },
      { id: 4, name: 'Cần Thơ', fee: 70000, freeFrom: 10_000_000, eta: '3–5 ngày' },
      { id: 5, name: 'Bình Dương', fee: 45000, freeFrom: 10_000_000, eta: '2–3 ngày' },
    ],
    description: 'Phí vận chuyển theo khu vực',
    createdAt: at,
    updatedAt: at,
  },
];
