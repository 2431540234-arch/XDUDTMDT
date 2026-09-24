// TODO: tham khảo cho Đợt 2 - trang chi tiết sản phẩm, cần port sang kiến trúc Tailwind + zustand trước khi dùng
import type { SyntheticEvent } from "react";

export type Product = {
  img: string;
  name: string;
  price: number;
  oldPrice: number;
};

export const formatPrice = (n: number) => n.toLocaleString("vi-VN") + "₫";

export const onImgError = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = "/images/aurelia-living-logo.jpg";
};

/* ===== MENU ĐIỀU HƯỚNG ===== */
export const MENU_ITEMS = [
  { label: "TRANG CHỦ", slug: "" },
  { label: "GIƯỜNG NGỦ", slug: "giuong-ngu" },
  { label: "TỦ ÁO", slug: "tu-ao" },
  { label: "TỦ BẾP", slug: "tu-bep" },
  { label: "BÀN GHẾ", slug: "ban-ghe" },
  { label: "BÀN LÀM VIỆC", slug: "ban-lam-viec" },
  { label: "TỦ GIÀY", slug: "tu-giay" },
  { label: "KỆ TIVI", slug: "ke-tivi" },
  { label: "COMBO", slug: "combo" },
];

export const menuHref = (slug: string) => (slug ? `/danh-muc/${slug}` : "/");

/* ===== DỮ LIỆU 8 DANH MỤC (thêm sản phẩm bằng cách nhân bản 1 phần tử) ===== */
export type CategoryData = {
  slug: string;
  title: string;
  description: string;
  tabs: string[];
  products: Product[];
};

export const CATEGORIES: CategoryData[] = [
  {
    slug: "giuong-ngu",
    title: "NỘI THẤT GIƯỜNG NGỦ",
    description: "Giường gỗ, giường bọc nệm cao cấp — mang giấc ngủ sâu cho cả gia đình.",
    tabs: ["Giường Ngủ", "Tủ Đầu Giường", "Nệm Cao Su Non", "Bàn Trang Điểm"],
    products: [
      { img: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=640&q=80", name: "Giường Ngủ Gỗ Sồi Hiện Đại", price: 9800000, oldPrice: 12000000 },
      { img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=640&q=80", name: "Giường Ngủ Bay Có Đèn Led Cao Cấp", price: 5000000, oldPrice: 5560000 },
      { img: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=640&q=80", name: "Giường Ngủ Kệ Đa Năng Tiện Lợi", price: 7900000, oldPrice: 9500000 },
      { img: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=640&q=80", name: "Bộ Chăn Ga Gối Cao Cấp Xuất Khẩu", price: 1850000, oldPrice: 2300000 },
    ],
  },
  {
    slug: "tu-ao",
    title: "NỘI THẤT TỦ ÁO",
    description: "Tủ quần áo cửa lùa, 2 cánh, 4 cánh — đúng kích thước mọi không gian.",
    tabs: ["Tủ 2 Cánh", "Tủ Cửa Lùa", "Tủ 4 Cánh", "Tủ Nhập Khẩu"],
    products: [
      { img: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=640&q=80", name: "Tủ Quần Áo 2 Cánh Gỗ Công Nghiệp", price: 7900000, oldPrice: 9500000 },
      { img: "https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=640&q=80", name: "Tủ Quần Áo Cửa Lùa Tiết Kiệm Diện Tích", price: 8400000, oldPrice: 9330000 },
      { img: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=640&q=80", name: "Tủ Áo Tân Cổ Điển Sang Trọng", price: 6160000, oldPrice: 6840000 },
      { img: "https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=640&q=80", name: "Tủ Quần Áo Nhập Khẩu Cao Cấp", price: 9800000, oldPrice: 10900000 },
    ],
  },
  {
    slug: "tu-bep",
    title: "NỘI THẤT TỦ BẾP",
    description: "Tủ bếp chống ẩm, phụ kiện thông minh — trái tim của căn bếp.",
    tabs: ["Tủ Bếp Gỗ", "Tủ Bếp Acrylic", "Bồn Rửa", "Kệ Gia Vị"],
    products: [
      { img: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=640&q=80", name: "Tủ Bếp Gỗ Công Nghiệp Chống Ẩm", price: 12500000, oldPrice: 15600000 },
      { img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=640&q=80", name: "Tủ Bếp Acrylic Bóng Gương Cao Cấp", price: 15800000, oldPrice: 17500000 },
      { img: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=640&q=80", name: "Tổ Hợp Bồn Rửa Bát Kèm Tủ Dưới", price: 4500000, oldPrice: 5200000 },
      { img: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=80", name: "Kệ Gia Vị Treo Tường Tiện Lợi", price: 890000, oldPrice: 1200000 },
    ],
  },
  {
    slug: "ban-ghe",
    title: "NỘI THẤT BÀN GHẾ",
    description: "Sofa, bàn ăn, ghế thư giãn — điểm nhấn của phòng khách và phòng ăn.",
    tabs: ["Sofa", "Bàn Ăn", "Ghế Thư Giãn", "Bàn Sofa"],
    products: [
      { img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=80", name: "Sofa Văng Nỉ Cao Cấp AV-101", price: 12500000, oldPrice: 15900000 },
      { img: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=640&q=80", name: "Bộ Bàn Ghế Ăn Gỗ Óc Chó Sang Trọng", price: 15600000, oldPrice: 18500000 },
      { img: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=640&q=80", name: "Ghế Thư Giãn Lười Êm Ái", price: 5600000, oldPrice: 6900000 },
      { img: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=640&q=80", name: "Bàn Sofa Đá Cao Cấp Hiện Đại", price: 3450000, oldPrice: 4200000 },
    ],
  },
  {
    slug: "ban-lam-viec",
    title: "BÀN LÀM VIỆC",
    description: "Bàn làm việc, ghế công thái độ — năng suất cho ngày dài.",
    tabs: ["Bàn Làm Việc", "Ghế Xoay", "Kệ Sách", "Tổ Hợp Bàn Kệ"],
    products: [
      { img: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=640&q=80", name: "Bàn Làm Việc Gỗ Tự Nhiên Thiết Kế Hiện Đại", price: 2150000, oldPrice: 2800000 },
      { img: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=640&q=80", name: "Ghế Xoay Công Thái Độ Thoải Mái Cả Ngày", price: 1250000, oldPrice: 1590000 },
      { img: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=640&q=80", name: "Kệ Sách Gỗ Nhiều Tầng Chứa Đựng Đa Năng", price: 1890000, oldPrice: 2300000 },
      { img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=640&q=80", name: "Tổ Hợp Bàn Làm Việc Kèm Kệ Hồ Sơ", price: 3590000, oldPrice: 4200000 },
    ],
  },
  {
    slug: "tu-giay",
    title: "TỦ GIÀY",
    description: "Tủ giày nhiều kích thước, chống mùi — gọn gàng từ thềm cửa.",
    tabs: ["Tủ Giày 2 Cánh", "Tủ Giày 4 Cánh", "Tủ Thông Minh", "Kệ Treo"],
    products: [
      { img: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=640&q=80", name: "Tủ Giày Tân Cổ Điển Màu Trắng Đẹp", price: 2800000, oldPrice: 3100000 },
      { img: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=640&q=80", name: "Tủ Giày 4 Cánh Gỗ Công Nghiệp", price: 2450000, oldPrice: 2720000 },
      { img: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=640&q=80", name: "Tủ Giày Thông Minh Khử Mùi", price: 1980000, oldPrice: 2500000 },
      { img: "https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=640&q=80", name: "Kệ Giày Treo Tường Tiện Lợi", price: 890000, oldPrice: 1150000 },
    ],
  },
  {
    slug: "ke-tivi",
    title: "KỆ TIVI",
    description: "Kệ tivi treo tường, tủ kệ phòng khách — sang trọng không gian sống.",
    tabs: ["Kệ Treo Tường", "Kệ Sàn", "Tủ Kệ Phòng Khách", "Vách Tivi"],
    products: [
      { img: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=640&q=80", name: "Kệ Tivi Treo Tường Gỗ Công Nghiệp", price: 2450000, oldPrice: 2720000 },
      { img: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=640&q=80", name: "Kệ Tivi Hiện Đại Gỗ MDF Cao Cấp", price: 2990000, oldPrice: 3320000 },
      { img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=80", name: "Tủ Kệ Tivi Phòng Khách Đẹp", price: 8400000, oldPrice: 9330000 },
      { img: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=640&q=80", name: "Kệ Tivi Gỗ Cánh Dân Bền Đẹp", price: 2990000, oldPrice: 3300000 },
    ],
  },
  {
    slug: "combo",
    title: "COMBO NỘI THẤT",
    description: "Trọn gói cả căn phòng — giá tốt hơn mua lẻ đến 20%.",
    tabs: ["Combo Phòng Ngủ", "Combo Phòng Khách", "Combo Chung Cư", "Combo Home Office"],
    products: [
      { img: "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=640&q=80", name: "Combo Phòng Ngủ Trọn Bộ Đủ Đồ", price: 18500000, oldPrice: 22000000 },
      { img: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=640&q=80", name: "Combo Phòng Khách Sofa + Kệ Tivi", price: 16900000, oldPrice: 19800000 },
      { img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=640&q=80", name: "Combo Căn Hộ Chung Cư 50m²", price: 25000000, oldPrice: 29500000 },
      { img: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=640&q=80", name: "Combo Phòng Làm Việc Tại Nhà", price: 9500000, oldPrice: 11200000 },
    ],
  },
];
/* ============================================================
   PHẦN MỞ RỘNG: SLUG + DỮ LIỆU TRANG CHỦ + TRA CỨU SẢN PHẨM
   ============================================================ */

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const withSlug = <T extends { name: string }>(p: T) => ({
  ...p,
  slug: slugify(p.name),
});

/* ===== 3 CỘT TRANG CHỦ ===== */
export const flashSale = [
  withSlug({ img: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=400&q=80", name: "Tủ Giày Tân Cổ Điển Màu Trắng Đẹp Hiện Đại", price: 2800000, oldPrice: 3100000 }),
  withSlug({ img: "https://images.unsplash.com/photo-1518051870910-a46e30d9db16?auto=format&fit=crop&w=400&q=80", name: "Bàn Học Sinh Gỗ Công Nghiệp Thông Minh Cho Bé", price: 3000000, oldPrice: 3750000 }),
  withSlug({ img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=400&q=80", name: "Bộ Bàn Học Sinh Đôi Gỗ Công Nghiệp Đẹp Tiện Lợi", price: 3960000, oldPrice: 4950000 }),
];

export const noiBat = [
  withSlug({ img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=400&q=80", name: "Giường Ngủ Bay Gỗ Công Nghiệp Có Đèn Led Cao Cấp", price: 5000000, oldPrice: 5560000 }),
  withSlug({ img: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=400&q=80", name: "Tủ Quần Áo Hiện Đại Gỗ Công Nghiệp Cao Cấp", price: 6160000, oldPrice: 6840000 }),
  withSlug({ img: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=400&q=80", name: "Bàn Trang Điểm Gương Tròn Thiết Kế Hiện Đại", price: 2100000, oldPrice: 2300000 }),
];

export const sanPhamMoi = [
  withSlug({ img: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=400&q=80", name: "Bộ Bàn Ghế Học Sinh Thông Minh Chống Gù Cao Cấp", price: 2250000, oldPrice: 2500000 }),
  withSlug({ img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80", name: "Hệ Tủ Kệ Phòng Khách Gỗ MDF Cao Cấp", price: 2790000, oldPrice: 3100000 }),
  withSlug({ img: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=400&q=80", name: "Kệ Tivi Treo Tường Gỗ Công Nghiệp Tiện Lợi", price: 2450000, oldPrice: 2720000 }),
];

/* ===== CÁC KHỐI SHOWCASE TRANG CHỦ ===== */
export type ShowcaseData = {
  title: string;
  tabs: string[];
  products: ReturnType<typeof withSlug>[];
};

export const showcases: ShowcaseData[] = [
  {
    title: "NỘI THẤT PHÒNG NGỦ",
    tabs: ["Bàn Trang Điểm", "Tủ Quần Áo", "Tủ Đầu Giường", "Nệm Cao Su Non", "Giường Ngủ", "Phòng Ngủ"],
    products: [
      withSlug({ img: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=640&q=80", name: "Bàn Trang Điểm Gỗ Trầm Bóng Vàng Đẹp Hiện Đại", price: 3200000, oldPrice: 3980000 }),
      withSlug({ img: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=640&q=80", name: "Bàn Trang Điểm Kết Hợp Tủ Ngăn Kéo Gỗ Công Nghiệp", price: 2850000, oldPrice: 3390000 }),
      withSlug({ img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=640&q=80", name: "Bàn Trang Điểm Thông Minh Gương Led Cao Cấp", price: 2756000, oldPrice: 3200000 }),
      withSlug({ img: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=640&q=80", name: "Bàn Phấn Trang Điểm Nhập Khẩu Cao Cấp Giá Rẻ", price: 2236000, oldPrice: 2756000 }),
    ],
  },
  {
    title: "NỘI THẤT PHÒNG KHÁCH",
    tabs: ["Kệ Tivi", "Vách Ngăn", "Tủ Cầu Thang", "Tủ Giày", "Tủ Rượu", "Bàn Sofa", "Kệ Trang Trí", "Ghế Sofa"],
    products: [
      withSlug({ img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=80", name: "Hệ Tủ Kệ Phòng Khách Gỗ MDF Cao Cấp", price: 2790000, oldPrice: 3100000 }),
      withSlug({ img: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=640&q=80", name: "Kệ Tivi Treo Tường Gỗ Công Nghiệp Tiện Lợi", price: 2450000, oldPrice: 2720000 }),
      withSlug({ img: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=640&q=80", name: "Kệ Tivi Hiện Đại Gỗ MDF Cao Cấp", price: 2990000, oldPrice: 3320000 }),
      withSlug({ img: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=640&q=80", name: "Kệ Tivi Đẹp Gỗ Công Nghiệp Cao Cấp", price: 3290000, oldPrice: 3660000 }),
    ],
  },
  {
    title: "NỘI THẤT VĂN PHÒNG",
    tabs: ["Bàn Làm Việc", "Kệ Sách", "Tủ Hồ Sơ", "Ghế Công Thái Độ", "Bàn Học", "Ghế Xoay"],
    products: [
      withSlug({ img: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=640&q=80", name: "Bàn Làm Việc Gỗ Tự Nhiên Thiết Kế Hiện Đại", price: 2150000, oldPrice: 2800000 }),
      withSlug({ img: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=640&q=80", name: "Kệ Sách Gỗ Nhiều Tầng Chứa Đựng Đa Năng", price: 1890000, oldPrice: 2300000 }),
      withSlug({ img: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=640&q=80", name: "Ghế Xoay Công Thái Độ Thoải Mái Cả Ngày", price: 1250000, oldPrice: 1590000 }),
      withSlug({ img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=640&q=80", name: "Tổ Hợp Bàn Làm Việc Kèm Kệ Hồ Sơ Tiện Lợi", price: 3590000, oldPrice: 4200000 }),
    ],
  },
];

/* ===== TRA CỨU SẢN PHẨM CHI TIẾT ===== */
export type ProductDetail = Product & {
  slug: string;
  categorySlug: string;
  categoryTitle: string;
};

export const ALL_PRODUCTS: ProductDetail[] = [
  ...CATEGORIES.flatMap((c) =>
    c.products.map((p) => ({
      ...p,
      slug: slugify(p.name),
      categorySlug: c.slug,
      categoryTitle: c.title,
    }))
  ),
  ...flashSale.map((p) => ({ ...p, categorySlug: "", categoryTitle: "Flash Sale" })),
  ...noiBat.map((p) => ({ ...p, categorySlug: "", categoryTitle: "Sản phẩm nổi bật" })),
  ...sanPhamMoi.map((p) => ({ ...p, categorySlug: "", categoryTitle: "Sản phẩm mới" })),
  ...showcases.flatMap((s) =>
    s.products.map((p) => ({ ...p, categorySlug: "", categoryTitle: s.title }))
  ),
];

export const findProduct = (slug: string) =>
  ALL_PRODUCTS.find((p) => p.slug === slug);

export const relatedProducts = (p: ProductDetail, count = 4): ProductDetail[] => {
  const sameCat = ALL_PRODUCTS.filter(
    (x) => x.slug !== p.slug && x.categoryTitle === p.categoryTitle
  );
  const others = ALL_PRODUCTS.filter(
    (x) => x.slug !== p.slug && x.categoryTitle !== p.categoryTitle
  );
  return [...sameCat, ...others].slice(0, count);
};