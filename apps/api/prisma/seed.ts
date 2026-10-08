// Seed dữ liệu cho cơ sở dữ liệu (idempotent: chạy nhiều lần không lỗi, không nhân đôi dữ liệu).
//   - Phần BẮT BUỘC: 2 vai trò, 6 quyền, role_permissions, settings, tài khoản admin
//   - Phần MẪU (dev/test): giống database/07_sample_data.sql; tắt bằng SEED_SAMPLE=false
// Admin: email/mật khẩu lấy từ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (mặc định chỉ cho dev, ĐỔI khi triển khai thật).
// User mẫu (chỉ khi SEED_SAMPLE != false) dùng SEED_SAMPLE_USER_PASSWORD.
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@aurelia.vn';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';
const SAMPLE_USER_PASSWORD = process.env.SEED_SAMPLE_USER_PASSWORD ?? 'User@123456';
const VISITOR_ID = '5b3f1c1e-8a47-4c0e-9d5f-0c6b7d1e2a33';

const PERMISSIONS = [
  ['manage_users', 'Quản lý người dùng', 'Xem, khóa, mở khóa, cấm tài khoản; gán vai trò'],
  [
    'manage_products',
    'Quản lý sản phẩm',
    'Sản phẩm, biến thể, tồn kho, mô hình 3D/AR, danh mục, thương hiệu',
  ],
  ['view_orders', 'Xem đơn hàng', 'Xem danh sách và chi tiết đơn hàng'],
  ['process_orders', 'Xử lý đơn hàng', 'Xác nhận, đổi trạng thái, hủy, hoàn tiền, vận chuyển'],
  ['manage_content', 'Quản lý nội dung', 'Trang tĩnh, không gian mẫu, duyệt đánh giá, mã giảm giá'],
  ['manage_settings', 'Cấu hình hệ thống', 'Cấu hình website, kho media, xem nhật ký thao tác'],
] as const;

const SETTINGS: [string, unknown, string][] = [
  ['site_name', 'Aurelia Living', 'Tên website'],
  ['contact_email', 'support@aurelia.vn', 'Email liên hệ'],
  ['contact_phone', '1900 0000', 'Số điện thoại liên hệ'],
  ['currency', 'VND', 'Đơn vị tiền tệ'],
  ['default_shipping_fee', 150000, 'Phí vận chuyển mặc định (VND)'],
  ['free_shipping_threshold', 5000000, 'Miễn phí vận chuyển cho đơn từ mức này (VND)'],
  ['ar_enabled', true, 'Bật tính năng xem AR'],
  ['maintenance_mode', false, 'Chế độ bảo trì'],
];

async function seedCore() {
  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: { code: 'admin', name: 'Quản trị viên', description: 'Toàn bộ quyền quản trị hệ thống' },
  });
  await prisma.role.upsert({
    where: { code: 'user' },
    update: {},
    create: {
      code: 'user',
      name: 'Người dùng',
      description:
        'Mua hàng, giỏ hàng, mã giảm giá, đánh giá, yêu thích, sổ địa chỉ, ảnh AR, lưu không gian mẫu; chỉ thao tác trên dữ liệu của chính mình',
    },
  });

  for (const [code, name, description] of PERMISSIONS) {
    const p = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name, description },
    });
    // Admin có tất cả quyền; user không có quyền nào
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }

  for (const [key, value, description] of SETTINGS) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never, description },
    });
  }

  // Admin: tạo user + gán vai trò admin trong CÙNG transaction để trigger (deferred)
  // trg_users_assign_default_role không gán thêm vai trò "user".
  // email không có @unique (partial unique index trong DB) nên dùng findFirst.
  const existing = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL, deletedAt: null } });
  if (!existing) {
    const passwordHash = await hash(ADMIN_PASSWORD, 10);
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          fullName: 'Quản trị viên',
          email: ADMIN_EMAIL,
          phone: '0900000000',
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      });
      await tx.userRole.create({ data: { userId: u.id, roleId: adminRole.id } });
    });
  }
}

// Tạo user nếu chưa có (trigger tự gán vai trò user)
async function ensureUser(fullName: string, email: string, phone: string) {
  const found = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (found) return found;
  return prisma.user.create({
    data: {
      fullName,
      email,
      phone,
      passwordHash: await hash(SAMPLE_USER_PASSWORD, 10),
      emailVerifiedAt: new Date(),
    },
  });
}

async function media(admin: number, fileName: string, mimeType: string, fileSize: number, altText?: string) {
  const filePath = `uploads/sample/${fileName}`;
  return prisma.media.upsert({
    where: { filePath },
    update: {},
    create: { fileName, filePath, mimeType, fileSize, altText, uploadedBy: admin },
  });
}

async function seedSample() {
  const admin = await prisma.user.findFirstOrThrow({ where: { email: ADMIN_EMAIL, deletedAt: null } });
  const u1 = await ensureUser('Nguyễn Văn A', 'nguyenvana@example.com', '0911111111');
  const u2 = await ensureUser('Trần Thị B', 'tranthib@example.com', '0922222222');

  if (!(await prisma.address.findFirst({ where: { userId: u1.id } }))) {
    await prisma.address.createMany({
      data: [
        {
          userId: u1.id,
          recipientName: 'Nguyễn Văn A',
          phone: '0911111111',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Nghé',
          addressLine: '12 Lê Lợi',
          isDefault: true,
        },
        {
          userId: u1.id,
          recipientName: 'Nguyễn Văn A (cơ quan)',
          phone: '0911111111',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 3',
          ward: 'Phường 6',
          addressLine: '45 Võ Văn Tần',
          isDefault: false,
        },
      ],
    });
  }

  // Danh mục cha - con
  const root = await prisma.category.upsert({
    where: { slug: 'noi-that' },
    update: {},
    create: { name: 'Nội thất', slug: 'noi-that', sortOrder: 1 },
  });
  const living = await prisma.category.upsert({
    where: { slug: 'phong-khach' },
    update: {},
    create: { name: 'Phòng khách', slug: 'phong-khach', parentId: root.id, sortOrder: 1 },
  });
  const catSofa = await prisma.category.upsert({
    where: { slug: 'sofa' },
    update: {},
    create: { name: 'Sofa', slug: 'sofa', parentId: living.id, sortOrder: 1 },
  });
  const catTable = await prisma.category.upsert({
    where: { slug: 'ban-tra' },
    update: {},
    create: { name: 'Bàn trà', slug: 'ban-tra', parentId: living.id, sortOrder: 2 },
  });

  const logo = await media(admin.id, 'aurelia-home-logo.png', 'image/png', 20480, 'Logo Aurelia Home');
  const brand = await prisma.brand.upsert({
    where: { slug: 'aurelia-home' },
    update: {},
    create: { name: 'Aurelia Home', slug: 'aurelia-home', logoMediaId: logo.id },
  });

  // Thuộc tính
  const color = await prisma.attribute.upsert({
    where: { code: 'color' },
    update: {},
    create: { code: 'color', name: 'Màu sắc' },
  });
  const material = await prisma.attribute.upsert({
    where: { code: 'material' },
    update: {},
    create: { code: 'material', name: 'Chất liệu' },
  });
  const av = async (attributeId: number, value: string) =>
    prisma.attributeValue.upsert({
      where: { attributeId_value: { attributeId, value } },
      update: {},
      create: { attributeId, value },
    });
  const vXam = await av(color.id, 'Xám');
  const vBe = await av(color.id, 'Be');
  const vSoi = await av(material.id, 'Gỗ sồi');
  const vOc = await av(material.id, 'Gỗ óc chó');

  // Sản phẩm 1: Sofa; Sản phẩm 2: Bàn trà
  const sofa = await prisma.product.upsert({
    where: { slug: 'sofa-oslo-3-cho' },
    update: {},
    create: {
      name: 'Sofa Oslo 3 chỗ',
      slug: 'sofa-oslo-3-cho',
      shortDescription: 'Sofa vải phong cách Scandinavian',
      description: 'Sofa 3 chỗ khung gỗ tự nhiên, bọc vải chống bám bụi.',
      categoryId: catSofa.id,
      brandId: brand.id,
      status: 'published',
      isFeatured: true,
    },
  });
  const table = await prisma.product.upsert({
    where: { slug: 'ban-tra-nordic' },
    update: {},
    create: {
      name: 'Bàn trà Nordic',
      slug: 'ban-tra-nordic',
      shortDescription: 'Bàn trà gỗ mặt tròn',
      description: 'Bàn trà gỗ mặt tròn đường kính 80cm, chân gỗ thon.',
      categoryId: catTable.id,
      brandId: brand.id,
      status: 'published',
    },
  });

  // Biến thể (tồn kho ban đầu 20/15; chỉ đặt khi tạo mới để không ghi đè lần chạy sau)
  const variant = async (
    productId: number,
    sku: string,
    price: number,
    stockQuantity: number,
    weightGram: number,
    salePrice?: number,
  ) =>
    prisma.productVariant.upsert({
      where: { sku },
      update: {},
      create: { productId, sku, price, salePrice, stockQuantity, weightGram },
    });
  const vSofaXam = await variant(sofa.id, 'SOFA-OSLO-XAM', 12000000, 20, 45000, 10900000);
  const vSofaBe = await variant(sofa.id, 'SOFA-OSLO-BE', 12000000, 20, 45000);
  const vBanSoi = await variant(table.id, 'BAN-NORDIC-SOI', 3200000, 15, 12000);
  const vBanOc = await variant(table.id, 'BAN-NORDIC-OC', 3500000, 15, 12500);
  const link = async (variantId: number, attributeValueId: number, attributeId: number) =>
    prisma.variantAttributeValue.upsert({
      where: { variantId_attributeValueId: { variantId, attributeValueId } },
      update: {},
      create: { variantId, attributeValueId, attributeId },
    });
  await link(vSofaXam.id, vXam.id, color.id);
  await link(vSofaBe.id, vBe.id, color.id);
  await link(vBanSoi.id, vSoi.id, material.id);
  await link(vBanOc.id, vOc.id, material.id);

  // Ảnh đại diện (mỗi sản phẩm một ảnh)
  for (const [p, file, alt] of [
    [sofa, 'sofa-oslo.jpg', 'Sofa Oslo 3 chỗ'],
    [table, 'ban-tra-nordic.jpg', 'Bàn trà Nordic'],
  ] as const) {
    if (!(await prisma.productImage.findFirst({ where: { productId: p.id, isPrimary: true } }))) {
      const m = await media(admin.id, file, 'image/jpeg', 300000, alt);
      await prisma.productImage.create({
        data: { productId: p.id, mediaId: m.id, sortOrder: 0, isPrimary: true },
      });
    }
  }

  // Mô hình 3D sofa (GLB + USDZ => trigger bật has_3d_model, has_ar)
  let model = await prisma.product3DModel.findFirst({ where: { productId: sofa.id, isPrimary: true } });
  if (!model) {
    const poster = await media(
      admin.id,
      'sofa-oslo-poster.webp',
      'image/webp',
      60000,
      'Ảnh chờ mô hình Sofa Oslo',
    );
    model = await prisma.product3DModel.create({
      data: {
        productId: sofa.id,
        lengthMm: 2100,
        widthMm: 900,
        heightMm: 820,
        placement: 'floor',
        allowScaling: false,
        viewerConfig: {
          camera_orbit: '45deg 70deg 3m',
          auto_rotate: true,
          exposure: 1.0,
          shadow_intensity: 0.8,
        },
        posterMediaId: poster.id,
        status: 'ready',
        isPrimary: true,
      },
    });
    const glb = await media(admin.id, 'sofa-oslo-high.glb', 'model/gltf-binary', 4200000, 'GLB sofa');
    const usdz = await media(admin.id, 'sofa-oslo-high.usdz', 'model/vnd.usdz+zip', 5100000, 'USDZ sofa');
    await prisma.modelFile.createMany({
      data: [
        {
          modelId: model.id,
          format: 'glb',
          lod: 'high',
          mediaId: glb.id,
          polygonCount: 85000,
          textureResolution: 2048,
          isCompressed: true,
          checksum: 'a3f5c1d2e4b6a8f0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8',
        },
        {
          modelId: model.id,
          format: 'usdz',
          lod: 'high',
          mediaId: usdz.id,
          polygonCount: 85000,
          textureResolution: 2048,
          isCompressed: false,
          checksum: 'b4a6d2e3f5c7b9a1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9',
        },
      ],
    });
    await prisma.modelMaterialVariant.createMany({
      data: [
        {
          modelId: model.id,
          variantId: vSofaXam.id,
          materialName: 'fabric_main',
          config: { baseColor: '#8A8D91', roughness: 0.9 },
        },
        {
          modelId: model.id,
          variantId: vSofaBe.id,
          materialName: 'fabric_main',
          config: { baseColor: '#D9C7A7', roughness: 0.9 },
        },
      ],
    });
  }

  // Không gian mẫu: 2 ảnh 360° + đủ 3 loại hotspot + 1 placement
  let space = await prisma.space.findUnique({ where: { slug: 'phong-khach-toi-gian-20m2' } });
  if (!space) {
    const cover = await media(
      admin.id,
      'space-living-cover.jpg',
      'image/jpeg',
      400000,
      'Ảnh bìa phòng khách',
    );
    space = await prisma.space.create({
      data: {
        title: 'Phòng khách tối giản 20m²',
        slug: 'phong-khach-toi-gian-20m2',
        description: 'Không gian phòng khách phong cách Scandinavian với tông màu trung tính.',
        roomType: 'living_room',
        style: 'Scandinavian',
        categoryId: living.id,
        coverMediaId: cover.id,
        status: 'published',
        publishedAt: new Date(),
      },
    });
    const m1 = await media(admin.id, 'living-pano-1.jpg', 'image/jpeg', 6500000, '360 phòng khách');
    const m2 = await media(admin.id, 'living-pano-2.jpg', 'image/jpeg', 6200000, '360 khu bếp');
    const pano1 = await prisma.spacePanorama.create({
      data: {
        spaceId: space.id,
        mediaId: m1.id,
        title: 'Phòng khách',
        defaultYaw: 0,
        defaultPitch: 0,
        defaultFov: 90,
        sortOrder: 0,
        isStart: true,
      },
    });
    const pano2 = await prisma.spacePanorama.create({
      data: {
        spaceId: space.id,
        mediaId: m2.id,
        title: 'Khu bếp',
        defaultYaw: 90,
        defaultPitch: -5,
        defaultFov: 85,
        sortOrder: 1,
        isStart: false,
      },
    });
    await prisma.spaceHotspot.createMany({
      data: [
        {
          panoramaId: pano1.id,
          type: 'product',
          yaw: 15.5,
          pitch: -10,
          productId: sofa.id,
          title: 'Sofa Oslo 3 chỗ',
        },
        {
          panoramaId: pano1.id,
          type: 'navigation',
          yaw: 120,
          pitch: 0,
          targetPanoramaId: pano2.id,
          title: 'Sang khu bếp',
        },
        {
          panoramaId: pano1.id,
          type: 'info',
          yaw: -45,
          pitch: 5,
          title: 'Tường sơn trắng',
          content: 'Sơn nước màu trắng sứ, bề mặt mờ.',
        },
      ],
    });
    await prisma.spaceProductPlacement.create({
      data: {
        panoramaId: pano1.id,
        productId: sofa.id,
        variantId: vSofaXam.id,
        modelId: model.id,
        yaw: 15.5,
        pitch: -12,
        distance: 2.8,
        rotationY: 180,
        scale: 1,
      },
    });
  }

  // Mã giảm giá
  const coupon = await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: 'percent',
      value: 10,
      maxDiscount: 500000,
      minOrderValue: 1000000,
      usageLimit: 1000,
      perUserLimit: 1,
      usedCount: 1,
      startsAt: new Date(Date.now() - 30 * 864e5),
      endsAt: new Date(Date.now() + 330 * 864e5),
    },
  });

  // Giỏ hàng của user B (mỗi user một giỏ)
  const cart = await prisma.cart.upsert({ where: { userId: u2.id }, update: {}, create: { userId: u2.id } });
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: vSofaBe.id } },
    update: {},
    create: { cartId: cart.id, variantId: vSofaBe.id, quantity: 1 },
  });

  // Đơn hàng hoàn chỉnh của user A: 10.900.000 + 3.500.000 = 14.400.000; giảm 500.000 (chặn bởi max_discount); ship 150.000 => 14.050.000
  const orderCode = 'ALV-20261006-0001';
  let order = await prisma.order.findUnique({ where: { orderCode } });
  if (!order) {
    order = await prisma.order.create({
      data: {
        orderCode,
        userId: u1.id,
        status: 'pending',
        recipientName: 'Nguyễn Văn A',
        recipientPhone: '0911111111',
        shippingProvince: 'TP. Hồ Chí Minh',
        shippingDistrict: 'Quận 1',
        shippingWard: 'Phường Bến Nghé',
        shippingAddress: '12 Lê Lợi',
        subtotal: 14400000,
        discountAmount: 500000,
        shippingFee: 150000,
        total: 14050000,
        couponId: coupon.id,
        paymentMethod: 'vnpay',
        paymentStatus: 'unpaid',
        note: 'Giao giờ hành chính',
      },
    });
    await prisma.orderItem.createMany({
      data: [
        {
          orderId: order.id,
          variantId: vSofaXam.id,
          productName: 'Sofa Oslo 3 chỗ',
          sku: 'SOFA-OSLO-XAM',
          unitPrice: 10900000,
          quantity: 1,
        },
        {
          orderId: order.id,
          variantId: vBanOc.id,
          productName: 'Bàn trà Nordic',
          sku: 'BAN-NORDIC-OC',
          unitPrice: 3500000,
          quantity: 1,
        },
      ],
    });
    await prisma.couponUsage.create({ data: { couponId: coupon.id, userId: u1.id, orderId: order.id } });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'vnpay',
        amount: 14050000,
        status: 'success',
        transactionCode: 'VNP-20261006-0001',
        gatewayResponse: { vnp_ResponseCode: '00', vnp_BankCode: 'NCB' },
        paidAt: new Date(),
      },
    });
    await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: 'ghn',
        trackingCode: 'GHN123456789',
        status: 'delivered',
        fee: 150000,
        shippedAt: new Date(Date.now() - 2 * 864e5),
        deliveredAt: new Date(),
      },
    });
    // Vòng đời đơn: mỗi lần đổi trạng thái trigger tự ghi order_status_history
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'paid' } });
    for (const status of ['confirmed', 'processing', 'shipping', 'completed'] as const) {
      await prisma.order.update({ where: { id: order.id }, data: { status } });
    }
    // Trừ kho + sold_count (việc của tầng Service; ghi tay cho dữ liệu mẫu nhất quán)
    await prisma.inventoryMovement.createMany({
      data: [
        {
          variantId: vSofaXam.id,
          type: 'import',
          quantityChange: 20,
          reason: 'Nhập kho ban đầu',
          referenceCode: 'PN-0001',
          performedBy: admin.id,
        },
        {
          variantId: vSofaBe.id,
          type: 'import',
          quantityChange: 20,
          reason: 'Nhập kho ban đầu',
          referenceCode: 'PN-0001',
          performedBy: admin.id,
        },
        {
          variantId: vBanSoi.id,
          type: 'import',
          quantityChange: 15,
          reason: 'Nhập kho ban đầu',
          referenceCode: 'PN-0001',
          performedBy: admin.id,
        },
        {
          variantId: vBanOc.id,
          type: 'import',
          quantityChange: 15,
          reason: 'Nhập kho ban đầu',
          referenceCode: 'PN-0001',
          performedBy: admin.id,
        },
        {
          variantId: vSofaXam.id,
          type: 'sale',
          quantityChange: -1,
          reason: 'Bán hàng',
          referenceCode: orderCode,
        },
        {
          variantId: vBanOc.id,
          type: 'sale',
          quantityChange: -1,
          reason: 'Bán hàng',
          referenceCode: orderCode,
        },
      ],
    });
    await prisma.productVariant.updateMany({
      where: { id: { in: [vSofaXam.id, vBanOc.id] } },
      data: { stockQuantity: { decrement: 1 } },
    });
    await prisma.product.updateMany({
      where: { id: { in: [sofa.id, table.id] } },
      data: { soldCount: { increment: 1 } },
    });
    await prisma.notification.create({
      data: {
        userId: u1.id,
        title: `Đơn hàng ${orderCode} đã được giao`,
        data: { order_id: order.id, type: 'order_delivered' },
      },
    });
  }

  // Review: tạo pending rồi duyệt => trigger cập nhật rating_avg / rating_count
  if (!(await prisma.review.findFirst({ where: { userId: u1.id, productId: sofa.id, orderId: order.id } }))) {
    const r = await prisma.review.create({
      data: {
        userId: u1.id,
        productId: sofa.id,
        orderId: order.id,
        rating: 5,
        content: 'Sofa êm, đúng kích thước như xem AR.',
        status: 'pending',
      },
    });
    await prisma.review.update({ where: { id: r.id }, data: { status: 'approved' } });
  }

  await prisma.wishlist.upsert({
    where: { userId_productId: { userId: u1.id, productId: table.id } },
    update: {},
    create: { userId: u1.id, productId: table.id },
  });
  await prisma.spaceBookmark.upsert({
    where: { userId_spaceId: { userId: u1.id, spaceId: space.id } },
    update: {},
    create: { userId: u1.id, spaceId: space.id },
  });

  // Thống kê AR + lượt xem space: chỉ tạo một lần (nhật ký, không có khóa tự nhiên)
  if (
    !(await prisma.arSession.findFirst({ where: { OR: [{ userId: u1.id }, { visitorId: VISITOR_ID }] } }))
  ) {
    const s = await prisma.arSession.create({
      data: {
        userId: u1.id,
        productId: sofa.id,
        modelId: model.id,
        device: 'iPhone 15',
        os: 'iOS 18',
        arPlatform: 'quick_look',
        mode: 'ar',
        durationSeconds: 95,
        placed: true,
        captured: true,
        addedToCart: true,
      },
    });
    await prisma.arSession.create({
      data: {
        visitorId: VISITOR_ID,
        productId: sofa.id,
        modelId: model.id,
        device: 'Pixel 8',
        os: 'Android 15',
        arPlatform: 'scene_viewer',
        mode: 'view_3d',
        durationSeconds: 30,
      },
    });
    const snap = await media(
      admin.id,
      'ar-snapshot-1.jpg',
      'image/jpeg',
      520000,
      'Sofa đặt trong phòng khách',
    );
    await prisma.arSnapshot.create({
      data: { userId: u1.id, productId: sofa.id, arSessionId: s.id, mediaId: snap.id, isPublic: true },
    });
  }
  if (!(await prisma.spaceView.findFirst({ where: { spaceId: space.id } }))) {
    // Khách vãng lai: userId NULL + visitorId; trigger tăng spaces.view_count
    await prisma.spaceView.create({
      data: {
        spaceId: space.id,
        visitorId: VISITOR_ID,
        sourceProductId: sofa.id,
        hotspotClickCount: 1,
        addedToCart: false,
      },
    });
    await prisma.spaceView.create({
      data: {
        spaceId: space.id,
        userId: u1.id,
        sourceProductId: sofa.id,
        hotspotClickCount: 3,
        addedToCart: true,
      },
    });
  }

  await prisma.page.upsert({
    where: { slug: 'chinh-sach-doi-tra' },
    update: {},
    create: {
      title: 'Chính sách đổi trả',
      slug: 'chinh-sach-doi-tra',
      content: '<p>Đổi trả trong 7 ngày nếu sản phẩm lỗi do nhà sản xuất.</p>',
      status: 'published',
      publishedAt: new Date(),
    },
  });
  if (
    !(await prisma.activityLog.findFirst({
      where: { actorId: admin.id, action: 'product.create', targetId: sofa.id },
    }))
  ) {
    await prisma.activityLog.create({
      data: {
        actorId: admin.id,
        action: 'product.create',
        targetType: 'products',
        targetId: sofa.id,
        changes: { after: { name: 'Sofa Oslo 3 chỗ' } },
        ipAddress: '127.0.0.1',
      },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error('Môi trường production bắt buộc đặt SEED_ADMIN_PASSWORD.');
  }
  await seedCore();
  if (process.env.SEED_SAMPLE !== 'false') await seedSample();
  console.log('Seed hoàn tất.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
