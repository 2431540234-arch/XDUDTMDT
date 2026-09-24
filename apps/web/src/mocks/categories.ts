// Dữ liệu danh mục mock tạm thời cho mega-menu và navbar - cần nối API thật sau này
import type { CategoryGroup } from "@/types/product";

export const mockCategoryGroups: CategoryGroup[] = [
  {
    slug: "phong-ngu",
    name: "Nội thất phòng ngủ",
    children: [
      { slug: "giuong-ngu", name: "Giường ngủ" },
      { slug: "tu-ao", name: "Tủ quần áo" },
      { slug: "ban-phan", name: "Bàn trang điểm" },
      { slug: "tu-dau-giuong", name: "Tủ đầu giường" },
    ],
  },
  {
    slug: "phong-khach",
    name: "Nội thất phòng khách",
    children: [
      { slug: "ke-tivi", name: "Kệ Tivi" },
      { slug: "tu-ruou", name: "Tủ rượu" },
      { slug: "tu-giay", name: "Tủ giày" },
      { slug: "ke-trang-tri", name: "Kệ trang trí" },
      { slug: "ban-ghe", name: "Bàn ghế" },
    ],
  },
  {
    slug: "phong-bep",
    name: "Nội thất phòng bếp",
    children: [
      { slug: "tu-bep", name: "Tủ bếp" },
      { slug: "ban-an", name: "Bàn ăn" },
      { slug: "tu-chen-bat", name: "Tủ chén bát" },
      { slug: "noi-that-bep", name: "Nội thất bếp" },
    ],
  },
  {
    slug: "van-phong",
    name: "Nội thất văn phòng",
    children: [
      { slug: "ban-lam-viec", name: "Bàn làm việc" },
      { slug: "ke-sach", name: "Kệ sách" },
      { slug: "tu-ho-so", name: "Tủ hồ sơ" },
      { slug: "ghe-van-phong", name: "Ghế văn phòng" },
    ],
  },
  {
    slug: "tre-em",
    name: "Nội thất trẻ em",
    children: [
      { slug: "ban-hoc", name: "Bàn học" },
      { slug: "giuong-tang", name: "Giường tầng" },
      { slug: "tu-ao-tre-em", name: "Tủ áo trẻ em" },
    ],
  },
  {
    slug: "combo",
    name: "Combo nội thất",
    children: [
      { slug: "combo-phong-ngu", name: "Combo phòng ngủ" },
      { slug: "combo-phong-khach", name: "Combo phòng khách" },
      { slug: "combo-phong-tre-em", name: "Combo phòng trẻ em" },
    ],
  },
];

// Dãy link nhanh trên navbar (mục con hay được click)
export const quickNavLinks = [
  { slug: "giuong-ngu", name: "Giường ngủ" },
  { slug: "tu-ao", name: "Tủ áo" },
  { slug: "tu-bep", name: "Tủ bếp" },
  { slug: "ban-phan", name: "Bàn phấn" },
  { slug: "ban-lam-viec", name: "Bàn làm việc" },
  { slug: "tu-giay", name: "Tủ giày" },
  { slug: "ke-tivi", name: "Kệ Tivi" },
  { slug: "combo", name: "Combo" },
];
