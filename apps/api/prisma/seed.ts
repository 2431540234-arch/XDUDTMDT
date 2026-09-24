// Script seed dữ liệu mẫu ban đầu cho cơ sở dữ liệu
// Nguồn đối chiếu: apps/web/src/mocks/{users,categories,products}.ts
// Chạy: npx prisma db seed (hoặc tự động sau khi npx prisma migrate dev)

import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ---------- Người dùng (đối chiếu apps/web/src/mocks/users.ts) ----------

const users = [
  {
    name: "Khách demo",
    email: "demo@aurelialiving.vn",
    password: "123456",
    role: Role.CUSTOMER,
  },
];

// ---------- Danh mục (đối chiếu apps/web/src/mocks/categories.ts) ----------

const categoryGroups = [
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

// ---------- Sản phẩm (đối chiếu apps/web/src/mocks/products.ts, id p10-p40) ----------
// Ghi chú: sku/description tự sinh theo template; widthCm/heightCm/depthCm là số liệu
// ƯỚC LƯỢNG TẠM cho từng loại sản phẩm - CẦN THAY BẰNG SỐ ĐO THẬT trước khi dùng cho AR.
// 9 sản phẩm trang chủ gốc (p1-p9) không có category nên KHÔNG seed vào DB lần này.

interface SeedProduct {
  id: string; // trùng id phía frontend mock, chỉ dùng để tham chiếu/log, KHÔNG ghi vào DB
  slug: string;
  name: string;
  price: number;
  oldPrice: number; // -> compareAtPrice, lấy đúng theo mocks/products.ts
  image: string;
  categorySlug: string;
  widthCm: number;
  heightCm: number;
  depthCm: number;
}

const products: SeedProduct[] = [
  // giuong-ngu
  { id: "p10", slug: "giuong-ngu-go-soi-hien-dai", name: "Giường Ngủ Gỗ Sồi Hiện Đại", price: 9800000, oldPrice: 12000000, image: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=640&q=80", categorySlug: "giuong-ngu", widthCm: 160, heightCm: 45, depthCm: 200 },
  { id: "p11", slug: "giuong-ngu-bay-den-led", name: "Giường Ngủ Bay Có Đèn Led Cao Cấp", price: 5000000, oldPrice: 5560000, image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=640&q=80", categorySlug: "giuong-ngu", widthCm: 160, heightCm: 50, depthCm: 200 },
  { id: "p12", slug: "giuong-ngu-ke-da-nang", name: "Giường Ngủ Kệ Đa Năng Tiện Lợi", price: 7900000, oldPrice: 9500000, image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=640&q=80", categorySlug: "giuong-ngu", widthCm: 160, heightCm: 45, depthCm: 200 },
  { id: "p13", slug: "bo-chan-ga-goi-cao-cap", name: "Bộ Chăn Ga Gối Cao Cấp Xuất Khẩu", price: 1850000, oldPrice: 2300000, image: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=640&q=80", categorySlug: "giuong-ngu", widthCm: 50, heightCm: 15, depthCm: 40 },
  // tu-ao
  { id: "p14", slug: "tu-quan-ao-2-canh-cong-nghiep", name: "Tủ Quần Áo 2 Cánh Gỗ Công Nghiệp", price: 7900000, oldPrice: 9500000, image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-ao", widthCm: 100, heightCm: 200, depthCm: 60 },
  { id: "p15", slug: "tu-quan-ao-cua-lua", name: "Tủ Quần Áo Cửa Lùa Tiết Kiệm Diện Tích", price: 8400000, oldPrice: 9330000, image: "https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-ao", widthCm: 180, heightCm: 220, depthCm: 60 },
  { id: "p16", slug: "tu-ao-tan-co-dien-sang-trong", name: "Tủ Áo Tân Cổ Điển Sang Trọng", price: 6160000, oldPrice: 6840000, image: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-ao", widthCm: 150, heightCm: 220, depthCm: 60 },
  { id: "p17", slug: "tu-quan-ao-nhap-khau-cao-cap", name: "Tủ Quần Áo Nhập Khẩu Cao Cấp", price: 9800000, oldPrice: 10900000, image: "https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-ao", widthCm: 200, heightCm: 230, depthCm: 65 },
  // tu-bep
  { id: "p18", slug: "tu-bep-cong-nghiep-chong-am", name: "Tủ Bếp Gỗ Công Nghiệp Chống Ẩm", price: 12500000, oldPrice: 15600000, image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-bep", widthCm: 240, heightCm: 85, depthCm: 60 },
  { id: "p19", slug: "tu-bep-acrylic-bong-guong", name: "Tủ Bếp Acrylic Bóng Gương Cao Cấp", price: 15800000, oldPrice: 17500000, image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-bep", widthCm: 300, heightCm: 85, depthCm: 60 },
  { id: "p20", slug: "to-hop-bon-rua-bat-kem-tu-duoi", name: "Tổ Hợp Bồn Rửa Bát Kèm Tủ Dưới", price: 4500000, oldPrice: 5200000, image: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-bep", widthCm: 80, heightCm: 85, depthCm: 60 },
  { id: "p21", slug: "ke-gia-vi-treo-tuong", name: "Kệ Gia Vị Treo Tường Tiện Lợi", price: 890000, oldPrice: 1200000, image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-bep", widthCm: 60, heightCm: 40, depthCm: 20 },
  // ban-ghe
  { id: "p22", slug: "sofa-vang-ni-cao-cap", name: "Sofa Văng Nỉ Cao Cấp AV-101", price: 12500000, oldPrice: 15900000, image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=80", categorySlug: "ban-ghe", widthCm: 220, heightCm: 85, depthCm: 95 },
  { id: "p23", slug: "bo-ban-ghe-an-go-oc-cho", name: "Bộ Bàn Ghế Ăn Gỗ Óc Chó Sang Trọng", price: 15600000, oldPrice: 18500000, image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=640&q=80", categorySlug: "ban-ghe", widthCm: 160, heightCm: 75, depthCm: 90 },
  { id: "p24", slug: "ghe-thu-gian-luoi-em-ai", name: "Ghế Thư Giãn Lười Êm Ái", price: 5600000, oldPrice: 6900000, image: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=640&q=80", categorySlug: "ban-ghe", widthCm: 80, heightCm: 90, depthCm: 85 },
  { id: "p25", slug: "ban-sofa-da-cao-cap", name: "Bàn Sofa Đá Cao Cấp Hiện Đại", price: 3450000, oldPrice: 4200000, image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=640&q=80", categorySlug: "ban-ghe", widthCm: 120, heightCm: 45, depthCm: 60 },
  // ban-lam-viec
  { id: "p26", slug: "ban-lam-viec-go-tu-nhien", name: "Bàn Làm Việc Gỗ Tự Nhiên Thiết Kế Hiện Đại", price: 2150000, oldPrice: 2800000, image: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=640&q=80", categorySlug: "ban-lam-viec", widthCm: 120, heightCm: 75, depthCm: 60 },
  { id: "p27", slug: "ghe-xoay-cong-thai-do", name: "Ghế Xoay Công Thái Độ Thoải Mái Cả Ngày", price: 1250000, oldPrice: 1590000, image: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=640&q=80", categorySlug: "ban-lam-viec", widthCm: 65, heightCm: 110, depthCm: 65 },
  { id: "p28", slug: "ke-sach-go-nhieu-tang", name: "Kệ Sách Gỗ Nhiều Tầng Chứa Đựng Đa Năng", price: 1890000, oldPrice: 2300000, image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=640&q=80", categorySlug: "ban-lam-viec", widthCm: 80, heightCm: 180, depthCm: 30 },
  { id: "p29", slug: "to-hop-ban-lam-viec-kem-ke-ho-so", name: "Tổ Hợp Bàn Làm Việc Kèm Kệ Hồ Sơ", price: 3590000, oldPrice: 4200000, image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=640&q=80", categorySlug: "ban-lam-viec", widthCm: 140, heightCm: 75, depthCm: 60 },
  // tu-giay
  { id: "p30", slug: "tu-giay-tan-co-dien-trang-dep", name: "Tủ Giày Tân Cổ Điển Màu Trắng Đẹp", price: 2800000, oldPrice: 3100000, image: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-giay", widthCm: 90, heightCm: 85, depthCm: 35 },
  { id: "p31", slug: "tu-giay-4-canh-cong-nghiep", name: "Tủ Giày 4 Cánh Gỗ Công Nghiệp", price: 2450000, oldPrice: 2720000, image: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-giay", widthCm: 120, heightCm: 90, depthCm: 35 },
  { id: "p32", slug: "tu-giay-thong-minh-khu-mui", name: "Tủ Giày Thông Minh Khử Mùi", price: 1980000, oldPrice: 2500000, image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-giay", widthCm: 80, heightCm: 80, depthCm: 35 },
  { id: "p33", slug: "ke-giay-treo-tuong", name: "Kệ Giày Treo Tường Tiện Lợi", price: 890000, oldPrice: 1150000, image: "https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=640&q=80", categorySlug: "tu-giay", widthCm: 60, heightCm: 50, depthCm: 25 },
  // ke-tivi
  { id: "p34", slug: "ke-tivi-hien-dai-mdf", name: "Kệ Tivi Hiện Đại Gỗ MDF Cao Cấp", price: 2990000, oldPrice: 3320000, image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=640&q=80", categorySlug: "ke-tivi", widthCm: 180, heightCm: 45, depthCm: 40 },
  { id: "p35", slug: "tu-ke-tivi-phong-khach-dep", name: "Tủ Kệ Tivi Phòng Khách Đẹp", price: 8400000, oldPrice: 9330000, image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=80", categorySlug: "ke-tivi", widthCm: 200, heightCm: 50, depthCm: 40 },
  { id: "p36", slug: "ke-tivi-go-canh-dan-ben-dep", name: "Kệ Tivi Gỗ Cánh Dân Bền Đẹp", price: 2990000, oldPrice: 3300000, image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=640&q=80", categorySlug: "ke-tivi", widthCm: 160, heightCm: 45, depthCm: 40 },
  // combo
  { id: "p37", slug: "combo-phong-ngu-tron-bo", name: "Combo Phòng Ngủ Trọn Bộ Đủ Đồ", price: 18500000, oldPrice: 22000000, image: "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=640&q=80", categorySlug: "combo", widthCm: 300, heightCm: 200, depthCm: 250 },
  { id: "p38", slug: "combo-phong-khach-sofa-ke-tivi", name: "Combo Phòng Khách Sofa + Kệ Tivi", price: 16900000, oldPrice: 19800000, image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=640&q=80", categorySlug: "combo", widthCm: 300, heightCm: 90, depthCm: 200 },
  { id: "p39", slug: "combo-can-ho-chung-cu-50m2", name: "Combo Căn Hộ Chung Cư 50m²", price: 25000000, oldPrice: 29500000, image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=640&q=80", categorySlug: "combo", widthCm: 500, heightCm: 250, depthCm: 500 },
  { id: "p40", slug: "combo-phong-lam-viec-tai-nha", name: "Combo Phòng Làm Việc Tại Nhà", price: 9500000, oldPrice: 11200000, image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=640&q=80", categorySlug: "combo", widthCm: 200, heightCm: 120, depthCm: 150 },
];

function buildSku(id: string): string {
  return `SKU-${id.toUpperCase()}`;
}

function buildDescription(name: string): string {
  return `${name} - nội thất chất lượng cao từ Aurelia Living, sản xuất trực tiếp tại xưởng, không qua trung gian.`;
}

async function seedUsers() {
  for (const u of users) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        password: hashedPassword,
        role: u.role,
      },
    });
  }
  console.log(`Seeded ${users.length} user(s).`);
}

async function seedCategories() {
  // Bảng cha trước
  for (const group of categoryGroups) {
    await prisma.category.upsert({
      where: { slug: group.slug },
      update: { name: group.name },
      create: { slug: group.slug, name: group.name },
    });
  }
  // Bảng con sau (cần parentId của cha vừa tạo)
  let childCount = 0;
  for (const group of categoryGroups) {
    const parent = await prisma.category.findUniqueOrThrow({ where: { slug: group.slug } });
    for (const child of group.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: parent.id },
        create: { slug: child.slug, name: child.name, parentId: parent.id },
      });
      childCount++;
    }
  }
  console.log(`Seeded ${categoryGroups.length} parent + ${childCount} child categories.`);
}

async function seedProducts() {
  for (const p of products) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.categorySlug } });
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        sku: buildSku(p.id),
        description: buildDescription(p.name),
        basePrice: p.price,
        compareAtPrice: p.oldPrice,
        widthCm: p.widthCm,
        heightCm: p.heightCm,
        depthCm: p.depthCm,
        categoryId: category.id,
      },
      create: {
        name: p.name,
        slug: p.slug,
        sku: buildSku(p.id),
        description: buildDescription(p.name),
        basePrice: p.price,
        compareAtPrice: p.oldPrice,
        widthCm: p.widthCm,
        heightCm: p.heightCm,
        depthCm: p.depthCm,
        categoryId: category.id,
        images: {
          create: [{ url: p.image, alt: p.name, isPrimary: true, sortOrder: 0 }],
        },
      },
    });
  }
  console.log(`Seeded ${products.length} products.`);
}

async function main() {
  await seedUsers();
  await seedCategories();
  await seedProducts();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
