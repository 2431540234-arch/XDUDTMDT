// Trang tĩnh viết cứng (thay cho bảng `pages` đã xóa): Về chúng tôi và các chính sách. Giữ nguyên slug (URL), tiêu đề, nội dung Markdown
// và thẻ SEO của dữ liệu trước đây. Nội dung hiển thị bằng components/ui/RichText.
export interface StaticPage {
  slug: string;
  title: string;
  /** 'policy' hiện trong menu danh sách chính sách tại /policies; 'static' là trang riêng (ví dụ /about) */
  type: 'static' | 'policy';
  /** Markdown */
  content: string;
  metaTitle: string;
  metaDescription: string;
  /** ISO – "Cập nhật lần cuối" */
  updatedAt: string;
}

export const STATIC_PAGES: StaticPage[] = [
  {
    slug: 'about',
    title: 'Về chúng tôi',
    type: 'static',
    content:
      '## 1. Câu chuyện của Aurelia Living\nAurelia Living ra đời với mong muốn mang không gian sống mơ ước đến gần mọi gia đình Việt. Chúng tôi kết hợp nội thất chất lượng cao với trải nghiệm xem 3D, thực tế tăng cường (AR) và không gian mẫu 360° để bạn hình dung rõ ràng trước khi mua.\n\n## 2. Giá trị cốt lõi\n- Chất lượng: vật liệu chọn lọc, kiểm tra 5 bước.\n- Minh bạch: giá niêm yết rõ ràng, đổi trả dễ dàng.\n- Sáng tạo: công nghệ 3D giúp chọn đồ chính xác.\n- Tận tâm: đồng hành cùng bạn từ tư vấn đến lắp đặt.\n\n_Về chúng tôi – cập nhật lần cuối 01/10/2026._',
    metaTitle: 'Về chúng tôi – Aurelia Living',
    metaDescription: 'Về chúng tôi',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  {
    slug: 'chinh-sach-mua-hang',
    title: 'Chính sách mua hàng',
    type: 'policy',
    content:
      '## 1. Phạm vi áp dụng\nChính sách áp dụng cho mọi đơn hàng đặt qua website Aurelia Living.\n\n## 2. Đặt hàng và xác nhận\nSau khi đặt hàng, hệ thống gửi email xác nhận. Nhân viên cửa hàng sẽ liên hệ trong vòng 24 giờ đối với đơn thanh toán khi nhận hàng.\n\n## 3. Phương thức thanh toán\n- Thanh toán khi nhận hàng (COD).\n- Chuyển khoản ngân hàng.\n- Cổng VNPAY.\n\n## 4. Giao hàng\nGiao hàng toàn quốc trong 2–5 ngày làm việc. Miễn phí vận chuyển cho đơn từ 10 triệu đồng.\n\n_Chính sách mua hàng – cập nhật lần cuối 01/10/2026._',
    metaTitle: 'Chính sách mua hàng – Aurelia Living',
    metaDescription: 'Chính sách mua hàng',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  {
    slug: 'chinh-sach-doi-tra',
    title: 'Chính sách đổi trả',
    type: 'policy',
    content:
      '## 1. Điều kiện đổi trả\nSản phẩm được đổi trả trong vòng 7 ngày kể từ ngày nhận hàng nếu có lỗi từ nhà sản xuất, giao sai mẫu hoặc không đúng mô tả.\n\n## 2. Quy trình xử lý\n- Gửi yêu cầu trong mục Đổi trả & hoàn tiền.\n- Cửa hàng duyệt và tạo lệnh lấy hàng miễn phí.\n- Kiểm tra sản phẩm và hoàn tiền trong 3–5 ngày làm việc.\n\n## 3. Trường hợp không áp dụng\nSản phẩm đã qua sử dụng, tự ý sửa chữa hoặc hư hỏng do người dùng.\n\n_Chính sách đổi trả – cập nhật lần cuối 01/10/2026._',
    metaTitle: 'Chính sách đổi trả – Aurelia Living',
    metaDescription: 'Chính sách đổi trả',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  {
    slug: 'chinh-sach-bao-hanh',
    title: 'Chính sách bảo hành',
    type: 'policy',
    content:
      '## 1. Thời hạn bảo hành\nKhung gỗ và kết cấu bảo hành 12–36 tháng tùy sản phẩm; vải, mút, da bảo hành 12 tháng.\n\n## 2. Phạm vi bảo hành\nBảo hành lỗi kỹ thuật phát sinh trong điều kiện sử dụng bình thường: bong keo, gãy mộng, xẹp mút bất thường.\n\n_Chính sách bảo hành – cập nhật lần cuối 01/10/2026._',
    metaTitle: 'Chính sách bảo hành – Aurelia Living',
    metaDescription: 'Chính sách bảo hành',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  {
    slug: 'chinh-sach-bao-mat',
    title: 'Chính sách bảo mật',
    type: 'policy',
    content:
      '## 1. Thông tin thu thập\nHọ tên, email, số điện thoại, địa chỉ giao hàng và lịch sử mua hàng nhằm phục vụ việc xử lý đơn.\n\n## 2. Cam kết\nAurelia Living không bán hoặc chia sẻ thông tin cá nhân cho bên thứ ba khi chưa có sự đồng ý của bạn.\n\n_Chính sách bảo mật – cập nhật lần cuối 01/10/2026._',
    metaTitle: 'Chính sách bảo mật – Aurelia Living',
    metaDescription: 'Chính sách bảo mật',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  {
    slug: 'dieu-khoan-su-dung',
    title: 'Điều khoản sử dụng',
    type: 'static',
    content:
      '## 1. Chấp nhận điều khoản\nKhi sử dụng website, bạn đồng ý tuân thủ các điều khoản dưới đây.\n\n## 2. Tài khoản\nBạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động trên tài khoản của mình.\n\n_Điều khoản sử dụng – cập nhật lần cuối 01/10/2026._',
    metaTitle: 'Điều khoản sử dụng – Aurelia Living',
    metaDescription: 'Điều khoản sử dụng',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  {
    slug: 'chinh-sach-van-chuyen',
    title: 'Chính sách vận chuyển',
    type: 'policy',
    content:
      '## 1. Thời gian giao hàng\nNội thành TP.HCM và Hà Nội: 1–2 ngày. Các tỉnh thành khác: 3–5 ngày.\n\n## 2. Phí vận chuyển\nTính theo khu vực, hiển thị khi thanh toán. Miễn phí từ 10 triệu đồng.\n\n_Chính sách vận chuyển – cập nhật lần cuối 01/10/2026._',
    metaTitle: 'Chính sách vận chuyển – Aurelia Living',
    metaDescription: 'Chính sách vận chuyển',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
];

export const pageBySlug = (slug: string) => STATIC_PAGES.find((p) => p.slug === slug);
export const policyPages = () => STATIC_PAGES.filter((p) => p.type === 'policy');
