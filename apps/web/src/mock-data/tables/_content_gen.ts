// Sinh: pages, settings, banners, posts, faq_topics, suppliers, stock_receipts, expenses, contact_messages
import type { Page, Setting } from '@aurelia-living/shared-types';
import type { Banner, ContactMessage, Expense, Post, StockReceipt, Supplier } from '@/types/api';
import { bannerImg, roomImg } from '../utils/img';
import { addDays, iso, makeRng, MOCK_NOW } from '../utils/rng';
import { orderItems, orders, payments, shipments } from './_orders_gen';
import { productExtras, productVariants } from './_products_gen';

const rng = makeRng(707);
const at = '2026-01-03T08:00:00.000Z';

// ---------------- Trang tĩnh (pages) ----------------
const policy = (title: string, sections: Array<[string, string[]]>) =>
  sections
    .map(([h, lines], i) => `## ${i + 1}. ${h}\n${lines.map((l) => (l.startsWith('-') ? l : l)).join('\n')}`)
    .join('\n\n') + `\n\n_${title} – cập nhật lần cuối 01/10/2026._`;

const pageDefs: Array<{ slug: string; title: string; content: string }> = [
  {
    slug: 'about',
    title: 'Về chúng tôi',
    content: policy('Về chúng tôi', [
      [
        'Câu chuyện của Aurelia Living',
        [
          'Aurelia Living ra đời với mong muốn mang không gian sống mơ ước đến gần mọi gia đình Việt. Chúng tôi kết hợp nội thất chất lượng cao với trải nghiệm xem 3D, thực tế tăng cường (AR) và không gian mẫu 360° để bạn hình dung rõ ràng trước khi mua.',
        ],
      ],
      [
        'Giá trị cốt lõi',
        [
          '- Chất lượng: vật liệu chọn lọc, kiểm tra 5 bước.',
          '- Minh bạch: giá niêm yết rõ ràng, đổi trả dễ dàng.',
          '- Sáng tạo: công nghệ 3D giúp chọn đồ chính xác.',
          '- Tận tâm: đồng hành cùng bạn từ tư vấn đến lắp đặt.',
        ],
      ],
    ]),
  },
  {
    slug: 'chinh-sach-mua-hang',
    title: 'Chính sách mua hàng',
    content: policy('Chính sách mua hàng', [
      ['Phạm vi áp dụng', ['Chính sách áp dụng cho mọi đơn hàng đặt qua website Aurelia Living.']],
      [
        'Đặt hàng và xác nhận',
        [
          'Sau khi đặt hàng, hệ thống gửi email xác nhận. Nhân viên cửa hàng sẽ liên hệ trong vòng 24 giờ đối với đơn thanh toán khi nhận hàng.',
        ],
      ],
      [
        'Phương thức thanh toán',
        ['- Thanh toán khi nhận hàng (COD).', '- Chuyển khoản ngân hàng.', '- Cổng VNPAY.'],
      ],
      [
        'Giao hàng',
        ['Giao hàng toàn quốc trong 2–5 ngày làm việc. Miễn phí vận chuyển cho đơn từ 10 triệu đồng.'],
      ],
    ]),
  },
  {
    slug: 'chinh-sach-doi-tra',
    title: 'Chính sách đổi trả',
    content: policy('Chính sách đổi trả', [
      [
        'Điều kiện đổi trả',
        [
          'Sản phẩm được đổi trả trong vòng 7 ngày kể từ ngày nhận hàng nếu có lỗi từ nhà sản xuất, giao sai mẫu hoặc không đúng mô tả.',
        ],
      ],
      [
        'Quy trình xử lý',
        [
          '- Gửi yêu cầu trong mục Đổi trả & hoàn tiền.',
          '- Cửa hàng duyệt và tạo lệnh lấy hàng miễn phí.',
          '- Kiểm tra sản phẩm và hoàn tiền trong 3–5 ngày làm việc.',
        ],
      ],
      ['Trường hợp không áp dụng', ['Sản phẩm đã qua sử dụng, tự ý sửa chữa hoặc hư hỏng do người dùng.']],
    ]),
  },
  {
    slug: 'chinh-sach-bao-hanh',
    title: 'Chính sách bảo hành',
    content: policy('Chính sách bảo hành', [
      [
        'Thời hạn bảo hành',
        ['Khung gỗ và kết cấu bảo hành 12–36 tháng tùy sản phẩm; vải, mút, da bảo hành 12 tháng.'],
      ],
      [
        'Phạm vi bảo hành',
        [
          'Bảo hành lỗi kỹ thuật phát sinh trong điều kiện sử dụng bình thường: bong keo, gãy mộng, xẹp mút bất thường.',
        ],
      ],
    ]),
  },
  {
    slug: 'chinh-sach-bao-mat',
    title: 'Chính sách bảo mật',
    content: policy('Chính sách bảo mật', [
      [
        'Thông tin thu thập',
        ['Họ tên, email, số điện thoại, địa chỉ giao hàng và lịch sử mua hàng nhằm phục vụ việc xử lý đơn.'],
      ],
      [
        'Cam kết',
        [
          'Aurelia Living không bán hoặc chia sẻ thông tin cá nhân cho bên thứ ba khi chưa có sự đồng ý của bạn.',
        ],
      ],
    ]),
  },
  {
    slug: 'dieu-khoan-su-dung',
    title: 'Điều khoản sử dụng',
    content: policy('Điều khoản sử dụng', [
      ['Chấp nhận điều khoản', ['Khi sử dụng website, bạn đồng ý tuân thủ các điều khoản dưới đây.']],
      [
        'Tài khoản',
        ['Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động trên tài khoản của mình.'],
      ],
    ]),
  },
  {
    slug: 'chinh-sach-van-chuyen',
    title: 'Chính sách vận chuyển',
    content: policy('Chính sách vận chuyển', [
      ['Thời gian giao hàng', ['Nội thành TP.HCM và Hà Nội: 1–2 ngày. Các tỉnh thành khác: 3–5 ngày.']],
      ['Phí vận chuyển', ['Tính theo khu vực, hiển thị khi thanh toán. Miễn phí từ 10 triệu đồng.']],
    ]),
  },
];

export const pages: Page[] = pageDefs.map((p, i) => ({
  id: i + 1,
  title: p.title,
  slug: p.slug,
  content: p.content,
  status: 'published',
  metaTitle: `${p.title} – Aurelia Living`,
  metaDescription: p.title,
  publishedAt: at,
  createdAt: at,
  updatedAt: '2026-10-01T08:00:00.000Z',
}));

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
        'Xem AR tại nhà cần thiết bị gì?',
        'iPhone/iPad (iOS 12+) dùng AR Quick Look, thiết bị Android hỗ trợ ARCore dùng Scene Viewer.',
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

// ---------------- Banner & bài viết (chưa có trong DB) ----------------
export const banners: Banner[] = [
  {
    id: 1,
    title: 'KHÔNG GIAN SỐNG, THEO CÁCH CỦA BẠN',
    subtitle: 'Khám phá bộ sưu tập nội thất hiện đại với trải nghiệm sản phẩm 3D chân thực.',
    imageUrl: bannerImg('Hiện đại', 1),
    link: '/products',
    position: 'hero-1',
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: null,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 2,
    title: 'PHÒNG KHÁCH BẮC ÂU – ẤM ÁP & GỌN GÀNG',
    subtitle: 'Bộ sưu tập phối sẵn với giá combo ưu đãi, xem ảnh 360° ngay tại nhà.',
    imageUrl: bannerImg('Bắc Âu', 2),
    link: '/spaces',
    position: 'hero-2',
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: null,
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 3,
    title: 'ƯU ĐÃI 11.11 – GIẢM ĐẾN 11%',
    subtitle: 'Nhập mã FLASH11 cho đơn từ 2 triệu, áp dụng đến 15/11.',
    imageUrl: bannerImg('Luxury', 3),
    link: '/products',
    position: 'hero-3',
    startAt: '2026-11-01T00:00:00.000Z',
    endAt: '2026-11-15T16:59:00.000Z',
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 4,
    title: 'BỘ SƯU TẬP MỚI',
    subtitle: 'Phong cách hiện đại cho mọi không gian',
    imageUrl: roomImg('Japandi', 'living_room', 4),
    link: '/spaces',
    position: 'home-left',
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: null,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 5,
    title: 'ƯU ĐÃI ĐẶC BIỆT',
    subtitle: 'Giảm đến 20% cho nhiều sản phẩm',
    imageUrl: roomImg('Hiện đại', 'bedroom', 5),
    link: '/products?sort=price:asc',
    position: 'home-right',
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: null,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 6,
    title: 'BLACK FRIDAY – GIẢM 25%',
    subtitle: 'Sắp diễn ra từ 24/11',
    imageUrl: bannerImg('Cổ điển', 6),
    link: '/account/coupons',
    position: 'hero-3',
    startAt: '2026-11-24T00:00:00.000Z',
    endAt: '2026-11-30T16:59:00.000Z',
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 7,
    title: 'Banner Tết 2027 (nháp)',
    subtitle: null,
    imageUrl: bannerImg('Cổ điển', 7),
    link: '/products',
    position: 'hero-3',
    startAt: '2027-01-10T00:00:00.000Z',
    endAt: null,
    sortOrder: 5,
    isActive: false,
  },
];

const postDefs: Array<[string, string, string, string, 'published' | 'draft', number]> = [
  [
    '5 mẹo chọn sofa cho phòng khách nhỏ',
    'Mẹo chọn nội thất',
    'Lê Minh Quân',
    'Sofa văng, sofa đơn và sofa module là lựa chọn tiết kiệm diện tích mà vẫn đủ ấm cúng cho phòng khách dưới 20m².',
    'published',
    1840,
  ],
  [
    'Xu hướng nội thất 2026: Japandi lên ngôi',
    'Xu hướng',
    'Nguyễn Thị Thu',
    'Sự giao thoa giữa tối giản Nhật Bản và ấm áp Bắc Âu tiếp tục dẫn đầu xu hướng năm nay.',
    'published',
    2630,
  ],
  [
    'Cách bảo quản đồ gỗ tự nhiên bền đẹp',
    'Bảo quản',
    'Trần Quốc Bảo',
    'Lau bằng khăn ẩm, tránh ánh nắng trực tiếp và duy trì độ ẩm 50–60% giúp đồ gỗ không cong vênh.',
    'published',
    980,
  ],
  [
    'Phối màu phòng ngủ giúp ngủ ngon hơn',
    'Cảm hứng',
    'Phạm Ngọc Linh',
    'Các gam màu trung tính như be, kem, xanh rêu nhạt giúp tạo cảm giác thư thái.',
    'published',
    1420,
  ],
  [
    'Hướng dẫn xem sản phẩm bằng AR tại nhà',
    'Hướng dẫn',
    'Lê Minh Quân',
    'Chỉ với 3 bước, bạn có thể đặt thử sofa vào phòng khách bằng điện thoại.',
    'published',
    3110,
  ],
  [
    'Bàn làm việc tại nhà: chọn sao cho đúng?',
    'Mẹo chọn nội thất',
    'Nguyễn Thị Thu',
    'Chiều cao bàn 72–76cm kết hợp ghế công thái học giúp bảo vệ cột sống.',
    'published',
    760,
  ],
  ['Bộ sưu tập Tết 2027 (bản nháp)', 'Xu hướng', 'Trần Quốc Bảo', 'Nội dung đang được biên tập.', 'draft', 0],
];
export const posts: Post[] = postDefs.map(([title, category, authorName, content, status, views], i) => ({
  id: i + 1,
  title,
  slug: title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, ''),
  category,
  coverUrl: roomImg(
    ['Hiện đại', 'Japandi', 'Cổ điển', 'Bắc Âu', 'Tối giản', 'Luxury', 'Hiện đại'][i],
    ['living_room', 'living_room', 'dining_room', 'bedroom', 'living_room', 'office', 'living_room'][i],
    10 + i,
  ),
  content,
  authorName,
  status,
  views,
  publishedAt: status === 'published' ? iso(addDays(new Date('2026-03-01T08:00:00.000Z'), i * 32)) : null,
  createdAt: iso(addDays(new Date('2026-03-01T08:00:00.000Z'), i * 32)),
}));

// ---------------- Kho: nhà cung cấp, phiếu nhập/xuất (chưa có trong DB) ----------------
export const suppliers: Supplier[] = [
  {
    id: 1,
    name: 'Công ty TNHH Gỗ Việt Phát',
    phone: '0283 812 3456',
    email: 'sales@govietphat.vn',
    address: 'KCN Tân Bình, TP.HCM',
  },
  {
    id: 2,
    name: 'Xưởng Mộc Hoàng Gia',
    phone: '0274 365 8899',
    email: 'info@mochoanggia.vn',
    address: 'TP. Thủ Dầu Một, Bình Dương',
  },
  {
    id: 3,
    name: 'Vải & Da Minh Long',
    phone: '0243 765 4321',
    email: 'contact@minhlong.vn',
    address: 'Cầu Giấy, Hà Nội',
  },
  {
    id: 4,
    name: 'Nordic Furniture Import',
    phone: '0286 273 9000',
    email: 'import@nordicfurn.vn',
    address: 'Quận 7, TP.HCM',
  },
  {
    id: 5,
    name: 'Đèn & Phụ kiện Ánh Dương',
    phone: '0236 355 7788',
    email: 'anhduong@den.vn',
    address: 'Hải Châu, Đà Nẵng',
  },
];

export const stockReceipts: StockReceipt[] = [];
{
  for (let i = 0; i < 12; i++) {
    const sup = suppliers[i % suppliers.length];
    const count = rng.int(2, 6);
    const picks = rng.sample(productVariants, count);
    const total = picks.reduce((s, v) => {
      const ex = productExtras.find((e) => e.productId === v.productId)!;
      return s + Math.round((v.salePrice ?? v.price) * ex.costRatio) * rng.int(4, 20);
    }, 0);
    stockReceipts.push({
      id: i + 1,
      code: `PN${String(i + 1).padStart(4, '0')}`,
      type: 'in',
      supplierId: sup.id,
      supplierName: sup.name,
      orderCode: null,
      itemCount: count,
      total,
      status: i === 11 ? 'draft' : 'completed',
      createdAt: iso(addDays(new Date('2026-01-20T08:00:00.000Z'), i * 26)),
    });
  }
  const shipped = orders.filter((o) => o.status === 'completed').slice(-4);
  shipped.forEach((o, i) => {
    const its = orderItems.filter((x) => x.orderId === o.id);
    stockReceipts.push({
      id: stockReceipts.length + 1,
      code: `PX${String(i + 1).padStart(4, '0')}`,
      type: 'out',
      supplierId: null,
      supplierName: null,
      orderCode: o.orderCode,
      itemCount: its.length,
      total: its.reduce((s, x) => s + x.lineTotal!, 0),
      status: 'completed',
      createdAt: o.createdAt,
    });
  });
  stockReceipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------- Phiếu chi (tính từ dữ liệu đơn hàng) ----------------
export const expenses: Expense[] = [];
{
  const cost = (variantId: number) => {
    const v = productVariants.find((x) => x.id === variantId)!;
    const ex = productExtras.find((e) => e.productId === v.productId)!;
    return Math.round((v.salePrice ?? v.price) * ex.costRatio);
  };
  const monthEnd = (m: number) =>
    m === 10 ? '2026-11-05T09:00:00.000Z' : new Date(Date.UTC(2026, m + 1, 0, 12)).toISOString();
  let seq = 0;
  const push = (category: Expense['category'], amount: number, note: string, date: string) => {
    if (amount <= 0) return;
    expenses.push({
      id: ++seq,
      code: `CH-${String(seq).padStart(4, '0')}`,
      category,
      amount: Math.round(amount),
      note,
      date,
    });
  };
  for (let m = 0; m <= 10; m++) {
    const inMonth = orders.filter((o) => new Date(o.createdAt).getUTCMonth() === m);
    const sold = inMonth.filter((o) =>
      ['completed', 'shipping', 'processing', 'confirmed'].includes(o.status),
    );
    const cogs = sold.reduce(
      (s, o) =>
        s +
        orderItems
          .filter((x) => x.orderId === o.id)
          .reduce((t, it) => t + cost(it.variantId!) * it.quantity, 0),
      0,
    );
    const ship =
      inMonth.reduce((s, o) => s + (shipments.find((x) => x.orderId === o.id)?.fee ?? 0), 0) +
      inMonth.filter((o) => o.shippingFee === 0 && shipments.some((x) => x.orderId === o.id)).length * 45000;
    const online = payments
      .filter(
        (p) =>
          ['vnpay', 'momo', 'zalopay', 'card'].includes(p.method) &&
          p.status === 'success' &&
          new Date(p.createdAt).getUTCMonth() === m,
      )
      .reduce((s, p) => s + p.amount, 0);
    const refunds = inMonth.filter((o) => o.status === 'refunded').reduce((s, o) => s + o.total, 0);
    const date = monthEnd(m);
    push('cogs', cogs, `Giá vốn hàng bán tháng ${m + 1}/2026`, date);
    push('shipping', ship, `Chi phí vận chuyển & lắp đặt tháng ${m + 1}/2026`, date);
    push('marketing', rng.int(9, 24) * 1_000_000, `Quảng cáo Facebook/Google tháng ${m + 1}/2026`, date);
    push('payment_fee', online * 0.018, `Phí cổng thanh toán tháng ${m + 1}/2026`, date);
    push('refund', refunds, `Hoàn tiền cho khách tháng ${m + 1}/2026`, date);
    push(
      'other',
      rng.int(3, 7) * 1_000_000,
      `Chi phí vận hành (điện, nước, mặt bằng) tháng ${m + 1}/2026`,
      date,
    );
  }
}

export const contactMessages: ContactMessage[] = [];
void MOCK_NOW;
